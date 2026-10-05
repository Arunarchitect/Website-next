'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

/* ---------- types ---------- */
type Item = { id: string; name: string; label: string; url: string; w: number; h: number };
type P = { idx: number; x: number; y: number; w: number; h: number; rot?: boolean }; // image rect (mm, inside margins); rot = rotated 90° CCW
type Style = 'grid' | 'composed' | 'dense';
type CountBy = 'perPage' | 'pages';
type Orient = 'portrait' | 'landscape';
type CropMode = 'uniform' | 'limit';
type Unit = 'mm' | 'in';
type Node = { al: number; be: number; idx?: number; dir?: 'h' | 'v'; l?: Node; r?: Node }; // width = al*height + be
type Lim = { minL: number; maxL: number; minS: number; maxS: number }; // mm, 0 = off
type Slot = { x: number; y: number; w: number; h: number };
type Opts = {
  lim: Lim;
  style: Style;
  countBy: CountBy;
  perPage: number;
  pageCount: number;
  W: number;
  H: number;
  gap: number;
  cap: number; // caption height in mm (0 = off)
  seed: number;
  rotate: boolean; // allow 90° rotation to use space better
  crop: boolean; // allow center crop to a common aspect ratio
  cropMode: CropMode; // uniform = every image gets the ratio, limit = only images longer than the ratio are trimmed
  ratio: number; // long:short target, 0 = auto (median of the images)
  exact: boolean; // grid only: every image gets exactly exW x exH
  exW: number; // exact image width in mm
  exH: number; // exact image height in mm
};

const SIZES: Record<string, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};
const RATIOS: Record<string, number> = {
  auto: 0,
  '1:1': 1,
  '5:4': 1.25,
  '4:3': 4 / 3,
  '3:2': 1.5,
  '16:9': 16 / 9,
  '2:1': 2,
};
const PT = 0.3528; // mm per pt
const MM_PER_IN = 25.4;

/* ---------- helpers ---------- */
const loadImg = (url: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('load failed'));
    img.src = url;
  });

async function toItem(file: File, i: number): Promise<Item | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return {
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name: path || file.name,
      label: file.name.replace(/\.[^./\\]+$/, ''),
      url,
      w: img.naturalWidth,
      h: img.naturalHeight,
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// "16:9", "16/9", "16x9", "1.75", "0.5" -> long:short ratio (>= 1), 0 if invalid
const parseRatio = (s: string) => {
  const t = s.trim().replace(/\s+/g, '');
  let r = 0;
  const m = t.match(/^(\d*\.?\d+)[:/x×](\d*\.?\d+)$/i);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 0 && b > 0) r = a / b;
  } else if (/^\d*\.?\d+$/.test(t)) {
    r = Number(t);
  }
  if (!Number.isFinite(r) || r <= 0) return 0;
  return r >= 1 ? r : 1 / r;
};

const fit = (a: number, w: number, h: number) => {
  let bw = w;
  let bh = w / a;
  if (bh > h) {
    bh = h;
    bw = h * a;
  }
  return { w: bw, h: bh };
};

// limits apply to the long / short side of each image, so they work for portrait
// (long = height) and landscape (long = width) alike
const violation = (w: number, h: number, l: Lim) => {
  const L = Math.max(w, h);
  const S = Math.min(w, h);
  let v = 0;
  if (l.minL > 0 && L < l.minL) v += (l.minL - L) / l.minL;
  if (l.maxL > 0 && L > l.maxL) v += (L - l.maxL) / l.maxL;
  if (l.minS > 0 && S < l.minS) v += (l.minS - S) / l.minS;
  if (l.maxS > 0 && S > l.maxS) v += (S - l.maxS) / l.maxS;
  return v;
};
const clampSize = (w: number, h: number, l: Lim) => {
  const L = Math.max(w, h);
  const S = Math.min(w, h);
  let f = 1;
  if (l.maxL > 0 && L > l.maxL) f = Math.min(f, l.maxL / L);
  if (l.maxS > 0 && S > l.maxS) f = Math.min(f, l.maxS / S);
  return { w: w * f, h: h * f };
};

// aspect (w/h) an image will have after the optional center crop, in its OWN orientation:
// landscape stays landscape, portrait stays portrait
const cropAsp = (a: number, crop: boolean, mode: CropMode, r: number) => {
  if (!crop) return a;
  const L = Math.max(a, 1 / a); // long / short, >= 1
  const t = mode === 'uniform' ? r : Math.min(L, r);
  return a >= 1 ? t : 1 / t;
};

const areaOf = (pages: P[][]) => pages.flat().reduce((s, p) => s + p.w * p.h, 0);

/* ---- exact size: every image gets the same w x h cell ---- */
// Packs as many w x h cells as possible on a W x H page. With rotate on, cells may be
// turned 90° (h x w): the main block uses one orientation, the leftover strips on the
// right / bottom are filled with whichever orientation fits more.
function packExact(W: number, H: number, gap: number, cap: number, w: number, h: number, rotate: boolean): Slot[] {
  const EPS = 1e-6;
  const dims: [number, number][] = rotate ? [[w, h], [h, w]] : [[w, h]];

  const fill = (x0: number, y0: number, Wa: number, Ha: number, cw: number, ch: number) => {
    const slots: Slot[] = [];
    if (Wa <= 0 || Ha <= 0) return { slots, bw: 0, bh: 0 };
    const cols = Math.floor((Wa + gap) / (cw + gap) + EPS);
    const rows = Math.floor((Ha + gap) / (ch + cap + gap) + EPS);
    if (cols < 1 || rows < 1) return { slots, bw: 0, bh: 0 };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({ x: x0 + c * (cw + gap), y: y0 + r * (ch + cap + gap), w: cw, h: ch });
      }
    }
    return { slots, bw: cols * cw + (cols - 1) * gap, bh: rows * (ch + cap) + (rows - 1) * gap };
  };

  const fillBest = (x0: number, y0: number, Wa: number, Ha: number) => {
    let best: Slot[] = [];
    for (const [cw, ch] of dims) {
      const f = fill(x0, y0, Wa, Ha, cw, ch);
      if (f.slots.length > best.length) best = f.slots;
    }
    return best;
  };

  let best: Slot[] = [];
  for (const [mw, mh] of dims) {
    const m = fill(0, 0, W, H, mw, mh);
    if (!m.slots.length) continue;
    const cands: Slot[][] = [m.slots];
    if (rotate) {
      const rw = W - m.bw - gap;
      const bhh = H - m.bh - gap;
      // A) right strip full height + bottom strip under the block
      cands.push([...m.slots, ...fillBest(m.bw + gap, 0, rw, H), ...fillBest(0, m.bh + gap, m.bw, bhh)]);
      // B) bottom strip full width + right strip beside the block
      cands.push([...m.slots, ...fillBest(0, m.bh + gap, W, bhh), ...fillBest(m.bw + gap, 0, rw, m.bh)]);
    }
    for (const c of cands) if (c.length > best.length) best = c;
  }
  return best;
}

function exactSlots(W: number, H: number, gap: number, cap: number, w: number, h: number, rotate: boolean): Slot[] {
  if (W <= 0 || H - cap <= 0 || w <= 0 || h <= 0) return [];
  let slots = packExact(W, H, gap, cap, w, h, rotate);
  if (!slots.length) {
    // cell is bigger than the printable area: shrink it (aspect kept) until it fits
    const sA = Math.min(W / w, (H - cap) / h);
    const sB = rotate ? Math.min(W / h, (H - cap) / w) : 0;
    const s = Math.max(sA, sB) * 0.9999;
    if (s > 0 && Number.isFinite(s)) slots = packExact(W, H, gap, cap, w * s, h * s, rotate);
  }
  if (!slots.length) return [];
  // center the used block on the page
  const maxX = Math.max(...slots.map((s) => s.x + s.w));
  const maxY = Math.max(...slots.map((s) => s.y + s.h + cap));
  const ox = Math.max(0, (W - maxX) / 2);
  const oy = Math.max(0, (H - maxY) / 2);
  return slots
    .map((s) => ({ ...s, x: s.x + ox, y: s.y + oy }))
    .sort((a, b) => (Math.abs(a.y - b.y) > 0.01 ? a.y - b.y : a.x - b.x));
}

// -1 portrait, 1 landscape, 0 (almost) square
const ori = (a: number) => (a > 1.02 ? 1 : a < 0.98 ? -1 : 0);

function exactLayout(raw: number[], o: Opts): P[][] {
  const slots = exactSlots(o.W, o.H, o.gap, o.cap, o.exW, o.exH, o.rotate);
  if (!slots.length) return [];
  const per = slots.length;
  const pages: P[][] = [];
  for (let start = 0; start < raw.length; start += per) {
    const free = slots.map((_, i) => i);
    const pg: P[] = [];
    for (let id = start; id < Math.min(start + per, raw.length); id++) {
      const a = raw[id];
      const oa = ori(a);
      // prefer a slot with the same orientation so less of the image is cropped
      let pick = o.rotate && oa !== 0 ? free.findIndex((si) => ori(slots[si].w / slots[si].h) === oa) : 0;
      if (pick < 0) pick = 0;
      const si = free.splice(pick, 1)[0];
      const s = slots[si];
      const rot = o.rotate && oa * ori(s.w / s.h) === -1;
      pg.push({ idx: id, x: s.x, y: s.y, w: s.w, h: s.h, rot });
    }
    pages.push(pg);
  }
  return pages;
}

/* ---- uniform grid ---- */
function gridLayout(asp: number[], k: number, o: Opts): P[][] {
  const { W, H, gap, cap } = o;
  const avg = asp.reduce((s, a) => s + a, 0) / Math.max(asp.length, 1);
  let best = { cols: 1, rows: k, score: -1 };
  for (let cols = 1; cols <= k; cols++) {
    const rows = Math.ceil(k / cols);
    const cw = (W - gap * (cols - 1)) / cols;
    const ch = (H - gap * (rows - 1)) / rows - cap;
    if (cw <= 0 || ch <= 0.5) continue;
    const f = fit(avg, cw, ch);
    if (f.w * f.h > best.score) best = { cols, rows, score: f.w * f.h };
  }
  const { cols, rows } = best;
  const cw = (W - gap * (cols - 1)) / cols;
  const ch = (H - gap * (rows - 1)) / rows - cap;
  const pages: P[][] = [];
  asp.forEach((a, i) => {
    const s = i % k;
    const c = s % cols;
    const r = Math.floor(s / cols);
    const f0 = fit(a, cw, Math.max(ch, 0.5));
    const f = clampSize(f0.w, f0.h, o.lim);
    (pages[Math.floor(i / k)] ||= []).push({
      idx: i,
      x: c * (cw + gap) + (cw - f.w) / 2,
      y: r * (ch + cap + gap) + (ch - f.h) / 2,
      w: f.w,
      h: f.h,
    });
  });
  return pages;
}

/* ---- dense row packing ---- */
function shelfPack(asp: number[], o: Opts, h: number): P[][] {
  const { W, H, gap, cap } = o;
  const pages: P[][] = [[]];
  let y = 0;
  let row: P[] = [];
  let rowX = 0;
  let rowH = 0;
  const flush = () => {
    if (!row.length) return;
    if (y > 0 && y + rowH > H + 1e-6) {
      pages.push([]);
      y = 0;
    }
    const offX = (W - (rowX - gap)) / 2;
    const pg = pages[pages.length - 1];
    row.forEach((r) => pg.push({ ...r, x: r.x + offX, y: y + (rowH - (r.h + cap)) / 2 }));
    y += rowH + gap;
    row = [];
    rowX = 0;
    rowH = 0;
  };
  asp.forEach((a, idx) => {
    let w = h * a;
    let hh = h;
    if (w > W) {
      w = W;
      hh = W / a;
    }
    if (hh + cap > H) {
      hh = Math.max(H - cap, 1);
      w = hh * a;
    }
    const cs = clampSize(w, hh, o.lim);
    w = cs.w;
    hh = cs.h;
    if (row.length && rowX + w > W + 1e-6) flush();
    row.push({ idx, x: rowX, y: 0, w, h: hh });
    rowX += w + gap;
    rowH = Math.max(rowH, hh + cap);
  });
  flush();
  return pages;
}

function denseLayout(asp: number[], o: Opts): P[][] {
  let lo = 1;
  let hi = Math.max(o.W, o.H);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (shelfPack(asp, o, mid).length <= Math.max(1, o.pageCount)) lo = mid;
    else hi = mid;
  }
  return shelfPack(asp, o, lo);
}

/* ---- composed (aligned edges, guillotine tree) ---- */
// each node: width = al * height + be (exact, includes gaps + captions)
function build(ids: number[], asp: number[], rnd: () => number, gap: number, cap: number): Node {
  if (ids.length === 1) {
    const a = asp[ids[0]];
    return { al: a, be: -a * cap, idx: ids[0] };
  }
  const s = 1 + Math.floor(rnd() * (ids.length - 1));
  const dir = rnd() < 0.5 ? 'h' : 'v';
  const l = build(ids.slice(0, s), asp, rnd, gap, cap);
  const r = build(ids.slice(s), asp, rnd, gap, cap);
  if (dir === 'h') return { al: l.al + r.al, be: l.be + r.be + gap, dir, l, r };
  const sum = 1 / l.al + 1 / r.al;
  const c = l.be / l.al + r.be / r.al - gap;
  return { al: 1 / sum, be: c / sum, dir, l, r };
}

function place(n: Node, x: number, y: number, w: number, h: number, gap: number, cap: number, out: P[]) {
  if (n.idx !== undefined) {
    out.push({ idx: n.idx, x, y, w, h: h - cap });
    return;
  }
  const l = n.l as Node;
  const r = n.r as Node;
  if (n.dir === 'h') {
    const wl = l.al * h + l.be;
    place(l, x, y, wl, h, gap, cap, out);
    place(r, x + wl + gap, y, w - wl - gap, h, gap, cap, out);
  } else {
    const hl = (w - l.be) / l.al;
    place(l, x, y, w, hl, gap, cap, out);
    place(r, x, y + hl + gap, w, h - hl - gap, gap, cap, out);
  }
}

// b = base aspect of every image (global index). With rotate on, each trial also
// picks which images to turn 90° (all landscape / all portrait / random mixes).
function composePage(ids: number[], b: number[], o: Opts, rnd: () => number): P[] {
  const { W, H, gap, cap } = o;
  if (ids.length === 1) {
    const a = b[ids[0]];
    let one: P | null = null;
    for (const flip of o.rotate ? [false, true] : [false]) {
      const f0 = fit(flip ? 1 / a : a, W, Math.max(H - cap, 1));
      const f = clampSize(f0.w, f0.h, o.lim);
      if (!one || f.w * f.h > one.w * one.h * 1.001) {
        one = { idx: ids[0], x: (W - f.w) / 2, y: (H - cap - f.h) / 2, w: f.w, h: f.h, rot: flip };
      }
    }
    return [one as P];
  }
  const loc = ids.map((_, k) => k);
  const none = ids.map(() => false);
  const allLand = ids.map((id) => b[id] < 1); // flip portraits -> everything landscape
  const allPort = ids.map((id) => b[id] > 1); // flip landscapes -> everything portrait
  const trials = ids.length > 16 ? 200 : 500;
  let best: P[] = [];
  let bestScore = Infinity;
  for (let t = 0; t < trials; t++) {
    let flips = none;
    if (o.rotate) {
      if (t === 1) flips = allLand;
      else if (t === 2) flips = allPort;
      else if (t >= 3) {
        const base = t % 3 === 0 ? none : t % 3 === 1 ? allLand : allPort;
        const pf = t % 2 === 0 ? 0.5 : 0.12;
        flips = base.map((v) => (rnd() < pf ? !v : v));
      }
    }
    const asp = ids.map((id, k) => (flips[k] ? 1 / b[id] : b[id]));
    const tree = build(loc, asp, rnd, gap, cap);
    // largest block of this structure that fits the page, aspect preserved exactly
    const bh = Math.min(H, (W - tree.be) / tree.al);
    const bw = tree.al * bh + tree.be;
    if (bh <= 0 || bw <= 0) continue;
    const out: P[] = [];
    place(tree, (W - bw) / 2, (H - bh) / 2, bw, bh, gap, cap, out);
    if (out.some((c) => c.w < 0.5 || c.h < 0.5)) continue;
    const areas = out.map((c) => c.w * c.h);
    const used = areas.reduce((s, v) => s + v, 0);
    const small = Math.max(0, Math.log(used / areas.length / Math.max(Math.min(...areas), 1e-6)) - 0.7);
    const viol = out.reduce((s2, c) => s2 + violation(c.w, c.h, o.lim), 0);
    const score = -Math.log(used / (W * H)) * 4 + small * 0.5 + viol * 20;
    if (score < bestScore) {
      bestScore = score;
      best = out.map((c) => ({ ...c, idx: ids[c.idx], rot: flips[c.idx] }));
    }
  }
  if (!best.length) {
    return gridLayout(ids.map((i) => b[i]), ids.length, o)[0].map((q) => ({ ...q, idx: ids[q.idx] }));
  }
  return best;
}

function computeLayout(items: Item[], o: Opts): P[][] {
  if (!items.length || o.W <= 0 || o.H <= 0) return [];
  const raw = items.map((i) => i.w / i.h);

  // 0) grid + exact size: every image gets the same cell, nothing else applies
  if (o.style === 'grid' && o.exact) return exactLayout(raw, o);

  // 1) crop: effective aspect of every image after the optional center crop
  const target = o.crop ? Math.max(1, o.ratio > 0 ? o.ratio : median(raw.map((a) => Math.max(a, 1 / a)))) : 1;
  const b = raw.map((a) => cropAsp(a, o.crop, o.cropMode, target));

  const n = items.length;
  const k = o.countBy === 'pages' ? Math.ceil(n / Math.max(1, o.pageCount)) : Math.max(1, o.perPage);

  // 2) composed handles rotation internally (per page, per trial)
  if (o.style === 'composed') {
    const rnd = rng(o.seed);
    const pages: P[][] = [];
    for (let s = 0; s < n; s += k) {
      const ids = Array.from({ length: Math.min(k, n - s) }, (_, i) => s + i);
      pages.push(composePage(ids, b, o, rnd));
    }
    return pages;
  }

  // 3) grid / dense: try orientation sets and keep the one covering the most area
  const none = b.map(() => false);
  let cands: boolean[][] = [none];
  if (o.rotate) {
    cands = [none, b.map((a) => a < 1), b.map((a) => a > 1)];
    cands = cands.filter((f, i) => cands.findIndex((g) => g.every((v, j) => v === f[j])) === i);
  }
  let best: P[][] = [];
  let bestArea = -1;
  for (const flip of cands) {
    const asp = b.map((a, i) => (flip[i] ? 1 / a : a));
    const laid = o.style === 'dense' ? denseLayout(asp, o) : gridLayout(asp, k, o);
    const pages = laid.map((pg) => pg.map((p) => ({ ...p, rot: flip[p.idx] })));
    const ar = areaOf(pages);
    if (ar > bestArea * 1.001) {
      best = pages;
      bestArea = ar;
    }
  }
  return best;
}

const naturalSort = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { numeric: true });
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- number input ----------
   value / min / max are always stored in the base unit (mm for lengths).
   `k` converts to what the person sees (1 for mm, 25.4 for inches).
   Free typing, backspace to empty, clamps on blur. */
const fmtNum = (v: number, zeroOff: boolean, k: number) => {
  if (zeroOff && v === 0) return '';
  const d = k === 1 ? 100 : 1000;
  return String(Math.round((v / k) * d) / d);
};

type NumProps = {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number; // in displayed units
  float?: boolean; // allow decimals
  zeroOff?: boolean; // 0 shows as empty ("off")
  placeholder?: string;
  k?: number; // display unit factor
};

function NumInput({ value, onChange, min, max, step = 1, float = false, zeroOff = false, placeholder, k = 1 }: NumProps) {
  const [text, setText] = useState(fmtNum(value, zeroOff, k));
  const focused = useRef(false);

  // follow external changes (and unit switches) only while the user isn't typing in this field
  useEffect(() => {
    if (!focused.current) setText(fmtNum(value, zeroOff, k));
  }, [value, zeroOff, k]);

  const decimals = float || k !== 1;
  const re = decimals ? /^\d*\.?\d*$/ : /^\d*$/;
  const toBase = (shown: number) => Math.round(shown * k * 100) / 100;

  const handle = (t: string) => {
    if (!re.test(t)) return;
    setText(t);
    if (t === '') {
      if (zeroOff) onChange(0);
      return;
    }
    if (t === '.') return;
    const n = toBase(Number(t));
    if (Number.isFinite(n) && n >= min - 1e-6 && n <= max + 1e-6) onChange(n);
  };

  const commit = () => {
    focused.current = false;
    if (text === '' || text === '.') {
      if (zeroOff) {
        onChange(0);
        setText('');
      } else {
        setText(fmtNum(value, zeroOff, k));
      }
      return;
    }
    const n = Math.min(max, Math.max(min, toBase(Number(text))));
    onChange(n);
    setText(fmtNum(n, zeroOff, k));
  };

  return (
    <input
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onChange={(e) => handle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const cur = Number(text) || 0;
          const shown = Math.round((cur + (e.key === 'ArrowUp' ? step : -step)) * 1000) / 1000;
          const nv = Math.min(max, Math.max(min, toBase(shown)));
          setText(fmtNum(nv, zeroOff, k));
          onChange(nv);
        }
      }}
    />
  );
}

/* ---------- component ---------- */
export default function PdfPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [unit, setUnit] = useState<Unit>('mm');
  const [paper, setPaper] = useState('A4');
  const [orient, setOrient] = useState<Orient>('portrait');
  const [margin, setMargin] = useState(10);
  const [gap, setGap] = useState(4);
  const [style, setStyle] = useState<Style>('composed');
  const [countBy, setCountBy] = useState<CountBy>('perPage');
  const [perPage, setPerPage] = useState(6);
  const [pageCount, setPageCount] = useState(1);
  const [seed, setSeed] = useState(1);
  const [lim, setLim] = useState<Lim>({ minL: 0, maxL: 0, minS: 0, maxS: 0 });
  const [exW, setExW] = useState(100); // exact size, mm
  const [exH, setExH] = useState(150);
  const [useExact, setUseExact] = useState(false);
  const [exactFit, setExactFit] = useState<'crop' | 'fit'>('crop'); // crop = fill the box, fit = whole image + padding
  const [padColor, setPadColor] = useState('#ffffff');
  const [rotate, setRotate] = useState(false);
  const [crop, setCrop] = useState(false);
  const [cropMode, setCropMode] = useState<CropMode>('uniform');
  const [ratioKey, setRatioKey] = useState('auto');
  const [customRatio, setCustomRatio] = useState('1.75');
  const [border, setBorder] = useState(false);
  const [borderW, setBorderW] = useState(0.3);
  const [captions, setCaptions] = useState(false);
  const [capPt, setCapPt] = useState(8);
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(0.85);
  const [fileName, setFileName] = useState('images');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const folderRef = useCallback((el: HTMLInputElement | null) => {
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, []);

  // unit helpers: everything is stored in mm, only the display changes
  const k = unit === 'in' ? MM_PER_IN : 1;
  const u = unit === 'in' ? 'in' : 'mm';
  const st = (mm: number, inch: number) => (unit === 'in' ? inch : mm);
  const fmtL = (mm: number) => (unit === 'in' ? `${(mm / MM_PER_IN).toFixed(2)} in` : `${Math.round(mm * 10) / 10} mm`);

  const [bw, bh] = SIZES[paper];
  const pw = orient === 'portrait' ? bw : bh;
  const ph = orient === 'portrait' ? bh : bw;
  const W = Math.max(0, pw - margin * 2);
  const H = Math.max(0, ph - margin * 2);
  const capMm = captions ? capPt * PT * 1.8 : 0;
  const customParsed = parseRatio(customRatio);
  const ratio = ratioKey === 'custom' ? customParsed : RATIOS[ratioKey] ?? 0;
  const exactOn = style === 'grid' && useExact;
  const objFit = exactOn && exactFit === 'fit' ? 'contain' : 'cover';

  const pages = useMemo(
    () =>
      computeLayout(items, {
        style,
        countBy,
        perPage,
        pageCount,
        W,
        H,
        gap,
        cap: capMm,
        seed,
        lim,
        rotate,
        crop,
        cropMode,
        ratio,
        exact: exactOn,
        exW,
        exH,
      }),
    [items, style, countBy, perPage, pageCount, W, H, gap, capMm, seed, lim, rotate, crop, cropMode, ratio, exactOn, exW, exH],
  );

  // how many exact-size cells fit on one page (and whether they had to be shrunk)
  const exactInfo = useMemo(() => {
    if (!exactOn) return null;
    const s = exactSlots(W, H, gap, capMm, exW, exH, rotate);
    const shrunk = s.length > 0 && Math.max(...s.map((q) => q.w * q.h)) < exW * exH * 0.999;
    return { count: s.length, shrunk };
  }, [exactOn, W, H, gap, capMm, exW, exH, rotate]);

  const outOfRange = useMemo(
    () => (exactOn ? 0 : pages.flat().filter((p) => violation(p.w, p.h, lim) > 0.005).length),
    [pages, lim, exactOn],
  );
  const rotatedCount = useMemo(() => pages.flat().filter((p) => p.rot).length, [pages]);

  const addFiles = async (list: FileList | File[] | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      setError('No image files found.');
      return;
    }
    setError('');
    const loaded = (await Promise.all(files.map(toItem))).filter((x): x is Item => !!x);
    loaded.sort(naturalSort);
    setItems((prev) => [...prev, ...loaded]);
  };

  const removeItem = (id: string) =>
    setItems((prev) => {
      const t = prev.find((i) => i.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((i) => i.id !== id);
    });

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
  };

  const generate = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    setProgress(0);
    setError('');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: orient, unit: 'mm', format: [pw, ph], compress: true });
      let done = 0;
      for (let p = 0; p < pages.length; p++) {
        if (p > 0) doc.addPage([pw, ph], orient);
        for (const pl of pages[p]) {
          const it = items[pl.idx];
          const img = await loadImg(it.url);
          // cover-crop source (centered) to the cell aspect, measured in the SOURCE frame:
          // a rotated cell is h/w tall-vs-wide before the 90° turn
          const fitMode = objFit === 'contain';
          const ac = pl.rot ? pl.h / pl.w : pl.w / pl.h;
          const ia = it.w / it.h;
          let sx = 0;
          let sy = 0;
          let sw = it.w;
          let sh = it.h;
          if (!fitMode && ia > ac) {
            sw = it.h * ac;
            sx = (it.w - sw) / 2;
          } else if (!fitMode) {
            sh = it.w / ac;
            sy = (it.h - sh) / 2;
          }
          // target pixels at chosen dpi, never upscaled past the source crop
          const tw = Math.max(1, (pl.w / 25.4) * dpi);
          const th = Math.max(1, (pl.h / 25.4) * dpi);
          const srcAlongW = pl.rot ? sh : sw;
          // cell width (mm) that image pixels actually cover (less than the cell when padded)
          let drawnW = pl.w;
          if (fitMode) drawnW = fit(pl.rot ? it.h / it.w : it.w / it.h, pl.w, pl.h).w;
          const sc = Math.min(1, srcAlongW / Math.max(1, (drawnW / 25.4) * dpi));
          const cw = Math.max(1, Math.round(tw * sc));
          const ch = Math.max(1, Math.round(th * sc));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unsupported');
          ctx.fillStyle = fitMode ? padColor : '#fff';
          ctx.fillRect(0, 0, cw, ch);
          // box available to the image, in the image's own (unrotated) frame
          const dw = pl.rot ? ch : cw;
          const dh = pl.rot ? cw : ch;
          let iw = dw;
          let ih = dh;
          if (fitMode) {
            const scl = Math.min(dw / sw, dh / sh);
            iw = sw * scl;
            ih = sh * scl;
          }
          if (pl.rot) {
            // turn 90° counter-clockwise (top of the image faces left)
            ctx.save();
            ctx.translate(cw / 2, ch / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(img, sx, sy, sw, sh, -iw / 2, -ih / 2, iw, ih);
            ctx.restore();
          } else {
            ctx.drawImage(img, sx, sy, sw, sh, (cw - iw) / 2, (ch - ih) / 2, iw, ih);
          }
          const data = canvas.toDataURL('image/jpeg', quality);
          canvas.width = 0;
          canvas.height = 0;
          const x = margin + pl.x;
          const y = margin + pl.y;
          doc.addImage(data, 'JPEG', x, y, pl.w, pl.h, undefined, 'FAST');
          if (border) {
            doc.setDrawColor(0);
            doc.setLineWidth(borderW);
            doc.rect(x, y, pl.w, pl.h, 'S');
          }
          if (captions) {
            doc.setFontSize(capPt);
            doc.setTextColor(40);
            let t = it.label;
            if (doc.getTextWidth(t) > pl.w) {
              while (t.length > 1 && doc.getTextWidth(t + '...') > pl.w) t = t.slice(0, -1);
              t += '...';
            }
            doc.text(t, x + pl.w / 2, y + pl.h + capMm / 2 + capPt * PT * 0.35, { align: 'center' });
          }
          done++;
          setProgress(Math.round((done / items.length) * 100));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      doc.save(`${fileName.trim() || 'images'}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF generation failed');
    } finally {
      setBusy(false);
    }
  };

  const seg = <T extends string>(val: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="pdfx-seg" style={{ gridTemplateColumns: `repeat(${opts.length}, 1fr)` }}>
      {opts.map(([v, label]) => (
        <button key={v} type="button" className={val === v ? 'on' : ''} onClick={() => set(v)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <main className="pdfx">
      <header className="pdfx-head">
        <h1>Images → PDF</h1>
        <p>Pick images or a whole folder, arrange them on A-size sheets, download one PDF. Everything runs in your browser.</p>
      </header>

      <div className="pdfx-layout">
        {/* ---------- controls ---------- */}
        <aside className="pdfx-panel">
          <section>
            <h2>Images</h2>
            <div
              className={`pdfx-drop ${dragOver ? 'is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              Drop images here
            </div>
            <div className="pdfx-row">
              <label className="pdfx-btn">
                Select images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <label className="pdfx-btn">
                Select folder
                <input
                  ref={folderRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="pdfx-row">
              <button type="button" className="pdfx-btn ghost" disabled={!items.length} onClick={() => setItems((p) => [...p].sort(naturalSort))}>
                A→Z
              </button>
              <button type="button" className="pdfx-btn ghost" disabled={!items.length} onClick={() => setItems((p) => shuffle(p))}>
                Shuffle
              </button>
              <button type="button" className="pdfx-btn ghost" disabled={!items.length} onClick={() => setItems((p) => [...p].reverse())}>
                Reverse
              </button>
              <button type="button" className="pdfx-btn ghost danger" disabled={!items.length} onClick={clearAll}>
                Clear
              </button>
            </div>
          </section>

          <section>
            <h2>Page</h2>
            <div className="pdfx-field">
              <span className="pdfx-label">Units</span>
              {seg(unit, setUnit, [
                ['mm', 'Millimetres'],
                ['in', 'Inches'],
              ])}
            </div>
            <div className="pdfx-grid2">
              <label>
                Paper
                <select value={paper} onChange={(e) => setPaper(e.target.value)}>
                  {Object.keys(SIZES).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Orientation
                <select value={orient} onChange={(e) => setOrient(e.target.value as Orient)}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label>
                Margin ({u})
                <NumInput value={margin} onChange={setMargin} min={0} max={50} k={k} step={st(1, 0.05)} float />
              </label>
              <label>
                Gap ({u})
                <NumInput value={gap} onChange={setGap} min={0} max={50} k={k} step={st(1, 0.05)} float />
              </label>
            </div>
          </section>

          <section>
            <h2>Arrangement</h2>
            {seg(style, setStyle, [
              ['grid', 'Grid'],
              ['composed', 'Composed'],
              ['dense', 'Max dense'],
            ])}
            {style === 'grid' && (
              <>
                <p className="pdfx-hint">
                  {useExact
                    ? 'Equal cells of the exact size below.'
                    : 'Equal cells, each image fitted inside without cropping (unless Allow crop is on).'}
                </p>
                <label className="pdfx-check">
                  <input type="checkbox" checked={useExact} onChange={(e) => setUseExact(e.target.checked)} />
                  Exact image size (width × height)
                </label>
              </>
            )}
            {style === 'composed' && (
              <>
                <p className="pdfx-hint">
                  Images are resized so edges and widths line up in one tidy block per page. Nothing is cropped unless Allow crop is on; the block is centered, leaving a small margin if the shapes don&apos;t fill the page exactly. Size limits steer the search toward arrangements that respect them.
                </p>
                <button type="button" className="pdfx-btn ghost" onClick={() => setSeed((s) => s + 1)}>
                  ↻ New composition
                </button>
              </>
            )}

            {exactOn ? (
              <>
                <div className="pdfx-grid2">
                  <label>
                    Width ({u})
                    <NumInput value={exW} onChange={setExW} min={5} max={2000} k={k} step={st(5, 0.25)} float />
                  </label>
                  <label>
                    Height ({u})
                    <NumInput value={exH} onChange={setExH} min={5} max={2000} k={k} step={st(5, 0.25)} float />
                  </label>
                </div>
                {seg(exactFit, setExactFit, [
                  ['crop', 'Crop to fill'],
                  ['fit', 'Fit + add space'],
                ])}
                {exactFit === 'fit' && (
                  <div className="pdfx-color">
                    <label>
                      Space colour
                      <input type="color" value={padColor} onChange={(e) => setPadColor(e.target.value)} />
                    </label>
                    <code>{padColor}</code>
                    <button type="button" className="pdfx-btn ghost" onClick={() => setPadColor('#ffffff')}>
                      White
                    </button>
                    <button type="button" className="pdfx-btn ghost" onClick={() => setPadColor('#000000')}>
                      Black
                    </button>
                  </div>
                )}
                <p className="pdfx-hint">
                  {exactFit === 'crop'
                    ? `Every image is zoomed to fill exactly ${fmtL(exW)} × ${fmtL(exH)}; the parts that stick out are cut off (centered).`
                    : `Every image is scaled to fit inside ${fmtL(exW)} × ${fmtL(exH)} with nothing cut off; the leftover space is filled with the colour above.`}{' '}
                  Page count follows from how many fit. Size limits and per-page settings are ignored while this is on.
                </p>
                {exactInfo && exactInfo.count > 0 && (
                  <p className="pdfx-hint">
                    <strong>{exactInfo.count}</strong> image{exactInfo.count === 1 ? '' : 's'} fit on each page.
                  </p>
                )}
                {exactInfo && exactInfo.count === 0 && <p className="pdfx-hint pdfx-warn-text">The printable area is too small for this size. Reduce the margin or caption size.</p>}
                {exactInfo?.shrunk && (
                  <p className="pdfx-hint pdfx-warn-text">This size is larger than the printable area, so it was scaled down (same shape) to fit one image per page.</p>
                )}
              </>
            ) : style !== 'dense' ? (
              <>
                {seg(countBy, setCountBy, [
                  ['perPage', 'Per page'],
                  ['pages', 'No. of pages'],
                ])}
                {countBy === 'perPage' ? (
                  <label>
                    Images per page
                    <NumInput value={perPage} onChange={setPerPage} min={1} max={200} />
                  </label>
                ) : (
                  <label>
                    Number of pages
                    <NumInput value={pageCount} onChange={setPageCount} min={1} max={500} />
                  </label>
                )}
              </>
            ) : (
              <>
                <label>
                  Fit into max pages
                  <NumInput value={pageCount} onChange={setPageCount} min={1} max={500} />
                </label>
                <p className="pdfx-hint">Packs rows tightly and scales images as large as possible so everything fits in this many pages.</p>
              </>
            )}
          </section>

          <section>
            <h2>{exactOn ? 'Rotate' : 'Rotate & crop'}</h2>
            <label className="pdfx-check">
              <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
              Allow rotate (best fit, max space)
            </label>
            <p className="pdfx-hint">
              {exactOn
                ? 'Cells can turn 90° on the page (e.g. 100 × 150 becomes 150 × 100) wherever that fits more images. Landscape pictures go into turned cells, portrait pictures into upright ones, so little is cropped or padded.'
                : 'Turns images 90° (counter-clockwise) wherever that lets them fill more of the page. Mixed portrait/landscape sets benefit most.'}
            </p>
            {!exactOn && (
              <>
                <label className="pdfx-check">
                  <input type="checkbox" checked={crop} onChange={(e) => setCrop(e.target.checked)} />
                  Allow crop (centered)
                </label>
                {crop && (
                  <>
                    {seg(cropMode, setCropMode, [
                      ['uniform', 'All same ratio'],
                      ['limit', 'Only extra-long'],
                    ])}
                    <label>
                      Aspect ratio (long : short)
                      <select value={ratioKey} onChange={(e) => setRatioKey(e.target.value)}>
                        {Object.keys(RATIOS).map((key) => (
                          <option key={key} value={key}>
                            {key === 'auto' ? 'Auto (median of images)' : key}
                          </option>
                        ))}
                        <option value="custom">Custom…</option>
                      </select>
                    </label>
                    {ratioKey === 'custom' && (
                      <>
                        <label>
                          Custom ratio
                          <input
                            type="text"
                            value={customRatio}
                            placeholder="e.g. 1.75 or 7:4"
                            spellCheck={false}
                            autoComplete="off"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setCustomRatio(e.target.value)}
                          />
                        </label>
                        {customParsed > 0 ? (
                          <p className="pdfx-hint">= {Math.round(customParsed * 1000) / 1000} : 1 (long side : short side)</p>
                        ) : (
                          <p className="pdfx-hint pdfx-warn-text">Not a valid ratio, using Auto. Type a number like 1.75 or a pair like 7:4.</p>
                        )}
                      </>
                    )}
                    <p className="pdfx-hint">
                      {cropMode === 'uniform'
                        ? 'Every image is center-cropped to this ratio (landscape stays landscape, portrait stays portrait). Turn on Allow rotate too and every picture ends up with exactly the same shape.'
                        : 'Only images longer than this ratio are center-cropped down to it; the rest stay untouched.'}
                    </p>
                  </>
                )}
              </>
            )}
          </section>

          <section>
            <h2>Style</h2>
            <label className="pdfx-check">
              <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} />
              Image border
            </label>
            {border && (
              <label>
                Border width ({u})
                <NumInput value={borderW} onChange={setBorderW} min={0.1} max={3} k={k} step={st(0.1, 0.005)} float />
              </label>
            )}
            <label className="pdfx-check">
              <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
              Captions (file name)
            </label>
            {captions && (
              <label>
                Caption size (pt)
                <NumInput value={capPt} onChange={setCapPt} min={4} max={36} />
              </label>
            )}
          </section>

          <section className={exactOn ? 'pdfx-off' : ''}>
            <h2>Image size limits ({u})</h2>
            <div className="pdfx-grid2">
              {(
                [
                  ['minL', 'Min long side'],
                  ['maxL', 'Max long side'],
                  ['minS', 'Min short side'],
                  ['maxS', 'Max short side'],
                ] as [keyof Lim, string][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <NumInput
                    value={lim[key]}
                    onChange={(n) => setLim((l) => ({ ...l, [key]: n }))}
                    min={0}
                    max={2000}
                    k={k}
                    step={st(5, 0.25)}
                    float
                    zeroOff
                    placeholder="off"
                  />
                </label>
              ))}
            </div>
            <p className="pdfx-hint">
              {exactOn
                ? 'Not used while Exact image size is on.'
                : 'Long side = height for portrait images, width for landscape. Max is always enforced; min is respected where the layout allows, otherwise a warning shows.'}
            </p>
          </section>

          <section>
            <h2>Output</h2>
            <div className="pdfx-grid2">
              <label>
                Resolution
                <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                  <option value={100}>100 dpi (small)</option>
                  <option value={150}>150 dpi</option>
                  <option value={200}>200 dpi</option>
                  <option value={300}>300 dpi (large)</option>
                </select>
              </label>
              <label>
                JPEG quality {Math.round(quality * 100)}%
                <input type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </label>
            </div>
            <label>
              File name
              <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </label>
          </section>

          <button type="button" className="pdfx-go" disabled={!items.length || busy || !pages.length} onClick={generate}>
            {busy ? `Building… ${progress}%` : `Download PDF (${pages.length} page${pages.length === 1 ? '' : 's'})`}
          </button>
          {error && <p className="pdfx-error">{error}</p>}
        </aside>

        {/* ---------- preview ---------- */}
        <section className="pdfx-main">
          <div className="pdfx-stats">
            <span>{items.length} images</span>
            <span>{pages.length} pages</span>
            {exactInfo && exactInfo.count > 0 && <span>{exactInfo.count} per page</span>}
            {rotatedCount > 0 && <span>{rotatedCount} rotated</span>}
            {outOfRange > 0 && <span className="warn">{outOfRange} outside size limits</span>}
            <span>
              {paper} {orient} · {fmtL(pw)} × {fmtL(ph)}
            </span>
          </div>

          {!items.length ? (
            <div className="pdfx-empty">No images yet. Select images or a folder to start.</div>
          ) : (
            <>
              <div className="pdfx-pages">
                {pages.map((pg, pi) => (
                  <figure key={pi} className="pdfx-page-wrap">
                    <div className="pdfx-page" style={{ aspectRatio: `${pw} / ${ph}` }}>
                      {pg.map((pl) => (
                        <div
                          key={pl.idx}
                          className="pdfx-cell"
                          style={{
                            position: 'absolute',
                            left: `${((margin + pl.x) / pw) * 100}%`,
                            top: `${((margin + pl.y) / ph) * 100}%`,
                            width: `${(pl.w / pw) * 100}%`,
                            height: `${(pl.h / ph) * 100}%`,
                            background: objFit === 'contain' ? padColor : undefined,
                            outline: border ? `max(0.5px, ${(borderW / pw) * 100}cqw) solid #000` : 'none',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={items[pl.idx].url}
                            alt={items[pl.idx].label}
                            style={
                              pl.rot
                                ? {
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    width: `${(pl.h / pl.w) * 100}%`,
                                    height: `${(pl.w / pl.h) * 100}%`,
                                    maxWidth: 'none',
                                    objectFit: objFit,
                                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                                  }
                                : { display: 'block', width: '100%', height: '100%', objectFit: objFit }
                            }
                          />
                          {captions && (
                            <span
                              className="pdfx-cap"
                              style={{
                                height: `${(capMm / pl.h) * 100}%`,
                                fontSize: `${((capPt * PT) / pw) * 100}cqw`,
                              }}
                            >
                              {items[pl.idx].label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <figcaption>
                      Page {pi + 1} · {pg.length} image{pg.length === 1 ? '' : 's'}
                    </figcaption>
                  </figure>
                ))}
              </div>

              <h2 className="pdfx-sub">Files</h2>
              <ul className="pdfx-files">
                {items.map((it) => (
                  <li key={it.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt="" />
                    <span title={it.name}>{it.name}</span>
                    <small>
                      {it.w}×{it.h}
                    </small>
                    <button type="button" aria-label="Remove" onClick={() => removeItem(it.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}