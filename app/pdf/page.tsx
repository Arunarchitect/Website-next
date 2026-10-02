'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';

/* ---------- types ---------- */
type Item = { id: string; name: string; label: string; url: string; w: number; h: number };
type P = { idx: number; x: number; y: number; w: number; h: number }; // image rect (mm, inside margins)
type Style = 'grid' | 'composed' | 'dense';
type CountBy = 'perPage' | 'pages';
type Orient = 'portrait' | 'landscape';
type Node = { al: number; be: number; idx?: number; dir?: 'h' | 'v'; l?: Node; r?: Node }; // width = al*height + be
type Lim = { minL: number; maxL: number; minS: number; maxS: number }; // mm, 0 = off
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
};

const SIZES: Record<string, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};
const PT = 0.3528; // mm per pt

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

/* ---- composed (aligned edges, guillotine tree, no cropping) ---- */
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

function composePage(ids: number[], asp: number[], o: Opts, rnd: () => number): P[] {
  const { W, H, gap, cap } = o;
  if (ids.length === 1) {
    const f0 = fit(asp[ids[0]], W, Math.max(H - cap, 1));
    const f = clampSize(f0.w, f0.h, o.lim);
    return [{ idx: ids[0], x: (W - f.w) / 2, y: (H - cap - f.h) / 2, w: f.w, h: f.h }];
  }
  const trials = ids.length > 16 ? 200 : 500;
  let best: P[] = [];
  let bestScore = Infinity;
  for (let t = 0; t < trials; t++) {
    const tree = build(ids, asp, rnd, gap, cap);
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
      best = out;
    }
  }
  if (!best.length) {
    return gridLayout(ids.map((i) => asp[i]), ids.length, o)[0].map((q) => ({ ...q, idx: ids[q.idx] }));
  }
  return best;
}

function computeLayout(items: Item[], o: Opts): P[][] {
  if (!items.length || o.W <= 0 || o.H <= 0) return [];
  const asp = items.map((i) => i.w / i.h);
  if (o.style === 'dense') return denseLayout(asp, o);
  const n = items.length;
  const k = o.countBy === 'pages' ? Math.ceil(n / Math.max(1, o.pageCount)) : Math.max(1, o.perPage);
  if (o.style === 'grid') return gridLayout(asp, k, o);
  const rnd = rng(o.seed);
  const pages: P[][] = [];
  for (let s = 0; s < n; s += k) {
    const ids = Array.from({ length: Math.min(k, n - s) }, (_, i) => s + i);
    pages.push(composePage(ids, asp, o, rnd));
  }
  return pages;
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

/* ---------- component ---------- */
export default function PdfPage() {
  const [items, setItems] = useState<Item[]>([]);
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

  const [bw, bh] = SIZES[paper];
  const pw = orient === 'portrait' ? bw : bh;
  const ph = orient === 'portrait' ? bh : bw;
  const W = pw - margin * 2;
  const H = ph - margin * 2;
  const capMm = captions ? capPt * PT * 1.8 : 0;

  const pages = useMemo(
    () => computeLayout(items, { style, countBy, perPage, pageCount, W, H, gap, cap: capMm, seed, lim }),
    [items, style, countBy, perPage, pageCount, W, H, gap, capMm, seed, lim],
  );
  const outOfRange = useMemo(() => pages.flat().filter((p) => violation(p.w, p.h, lim) > 0.005).length, [pages, lim]);

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
          // cover-crop source to the cell aspect (no-op when aspects match)
          const ac = pl.w / pl.h;
          const ia = it.w / it.h;
          let sx = 0;
          let sy = 0;
          let sw = it.w;
          let sh = it.h;
          if (ia > ac) {
            sw = it.h * ac;
            sx = (it.w - sw) / 2;
          } else {
            sh = it.w / ac;
            sy = (it.h - sh) / 2;
          }
          const cw = Math.max(1, Math.round(Math.min(sw, (pl.w / 25.4) * dpi)));
          const ch = Math.max(1, Math.round(cw / ac));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unsupported');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
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

  const num = (v: string, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };

  const seg = <T extends string>(val: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="pdfx-seg" style={{ gridTemplateColumns: `repeat(${opts.length}, 1fr)` }}>
      {opts.map(([v, label]) => (
        <button key={v} className={val === v ? 'on' : ''} onClick={() => set(v)}>
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
              <button className="pdfx-btn ghost" disabled={!items.length} onClick={() => setItems((p) => [...p].sort(naturalSort))}>
                A→Z
              </button>
              <button className="pdfx-btn ghost" disabled={!items.length} onClick={() => setItems((p) => shuffle(p))}>
                Shuffle
              </button>
              <button className="pdfx-btn ghost" disabled={!items.length} onClick={() => setItems((p) => [...p].reverse())}>
                Reverse
              </button>
              <button className="pdfx-btn ghost danger" disabled={!items.length} onClick={clearAll}>
                Clear
              </button>
            </div>
          </section>

          <section>
            <h2>Page</h2>
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
                Margin (mm)
                <input type="number" min={0} max={50} value={margin} onChange={(e) => setMargin(num(e.target.value, 0, 50, 10))} />
              </label>
              <label>
                Gap (mm)
                <input type="number" min={0} max={50} value={gap} onChange={(e) => setGap(num(e.target.value, 0, 50, 4))} />
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
            {style === 'grid' && <p className="pdfx-hint">Equal cells, each image fitted inside without cropping.</p>}
            {style === 'composed' && (
              <>
                <p className="pdfx-hint">Images are resized so edges and widths line up in one tidy block per page. Nothing is cropped; the block is centered, leaving a small margin if the shapes don't fill the page exactly. Size limits steer the search toward arrangements that respect them.</p>
                <button className="pdfx-btn ghost" onClick={() => setSeed((s) => s + 1)}>
                  ↻ New composition
                </button>
              </>
            )}
            {style !== 'dense' ? (
              <>
                {seg(countBy, setCountBy, [
                  ['perPage', 'Per page'],
                  ['pages', 'No. of pages'],
                ])}
                {countBy === 'perPage' ? (
                  <label>
                    Images per page
                    <input type="number" min={1} max={200} value={perPage} onChange={(e) => setPerPage(num(e.target.value, 1, 200, 6))} />
                  </label>
                ) : (
                  <label>
                    Number of pages
                    <input type="number" min={1} max={500} value={pageCount} onChange={(e) => setPageCount(num(e.target.value, 1, 500, 1))} />
                  </label>
                )}
              </>
            ) : (
              <>
                <label>
                  Fit into max pages
                  <input type="number" min={1} max={500} value={pageCount} onChange={(e) => setPageCount(num(e.target.value, 1, 500, 1))} />
                </label>
                <p className="pdfx-hint">Packs rows tightly and scales images as large as possible so everything fits in this many pages.</p>
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
                Border width (mm)
                <input type="number" min={0.1} max={3} step={0.1} value={borderW} onChange={(e) => setBorderW(Math.min(3, Math.max(0.1, Number(e.target.value) || 0.3)))} />
              </label>
            )}
            <label className="pdfx-check">
              <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
              Captions (file name)
            </label>
            {captions && (
              <label>
                Caption size (pt)
                <input type="number" min={4} max={36} value={capPt} onChange={(e) => setCapPt(num(e.target.value, 4, 36, 8))} />
              </label>
            )}
          </section>

          <section>
            <h2>Image size limits (mm)</h2>
            <div className="pdfx-grid2">
              {(
                [
                  ['minL', 'Min long side'],
                  ['maxL', 'Max long side'],
                  ['minS', 'Min short side'],
                  ['maxS', 'Max short side'],
                ] as [keyof Lim, string][]
              ).map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    value={lim[k] || ''}
                    placeholder="off"
                    onChange={(e) => setLim((l) => ({ ...l, [k]: num(e.target.value, 0, 2000, 0) }))}
                  />
                </label>
              ))}
            </div>
            <p className="pdfx-hint">
              Long side = height for portrait images, width for landscape. Max is always enforced; min is respected where the layout allows, otherwise a warning shows.
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

          <button className="pdfx-go" disabled={!items.length || busy} onClick={generate}>
            {busy ? `Building… ${progress}%` : `Download PDF (${pages.length} page${pages.length === 1 ? '' : 's'})`}
          </button>
          {error && <p className="pdfx-error">{error}</p>}
        </aside>

        {/* ---------- preview ---------- */}
        <section className="pdfx-main">
          <div className="pdfx-stats">
            <span>{items.length} images</span>
            <span>{pages.length} pages</span>
            {outOfRange > 0 && <span className="warn">{outOfRange} outside size limits</span>}
            <span>
              {paper} {orient} · {pw}×{ph} mm
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
                            left: `${((margin + pl.x) / pw) * 100}%`,
                            top: `${((margin + pl.y) / ph) * 100}%`,
                            width: `${(pl.w / pw) * 100}%`,
                            height: `${(pl.h / ph) * 100}%`,
                            outline: border ? `max(0.5px, ${(borderW / pw) * 100}cqw) solid #000` : 'none',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={items[pl.idx].url} alt={items[pl.idx].label} />
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
                    <button aria-label="Remove" onClick={() => removeItem(it.id)}>
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