import { QuantityAdjust, QuantityCell, QuantityData, QuantityMerge } from "./types";

export type SortDir = "none" | "asc" | "desc";
/** One sort level. The order of levels is the priority: first = main sort, next = tie-breaker. */
export type SortKey = { key: string; dir: "asc" | "desc" };

export const normAdjust = (a?: QuantityAdjust | null): QuantityAdjust => ({
  wastage: {
    percent: a?.wastage?.percent ?? 0,
    all: !!a?.wastage?.all,
    keys: a?.wastage?.keys ?? [],
  },
  merges: a?.merges ?? [],
  waste_label: a?.waste_label ?? "",
  combined_label: a?.combined_label ?? "",
  combined_waste_label: a?.combined_waste_label ?? "",
  sort: a?.sort === "asc" || a?.sort === "desc" ? a.sort : "none", // legacy single sort
  sort_by: Array.isArray(a?.sort_by)
    ? a!.sort_by!
        .filter((s) => s && typeof s.key === "string" && (s.dir === "asc" || s.dir === "desc"))
        .slice(0, 5)
    : [],
  order: Array.isArray(a?.order) ? a!.order!.filter((k) => typeof k === "string") : [],
  show_total: a?.show_total !== false,
});

/** Column headings: the custom text if set, otherwise a default built from the Final column's label. */
export function adjustHeaders(data: QuantityData, adjust: QuantityAdjust | null | undefined, percent: number) {
  const a = normAdjust(adjust);
  const fc = data.final ? data.columns.find((c) => c.key === data.final) : undefined;
  const fl = fc ? (fc.unit ? `${fc.label} (${fc.unit})` : fc.label) : "";
  return {
    waste: a.waste_label!.trim() || `With wastage (${percent}%)`,
    combined: a.combined_label!.trim() || `Combined ${fl}`.trim(),
    combinedWaste: a.combined_waste_label!.trim() || `Combined ${fl} with wastage`.trim(),
  };
}

/** The first "group" column, else the first "text" column (used to read an old single-sort setting). */
export const sortColumn = (data: QuantityData) =>
  data.columns.find((c) => c.role === "group") ?? data.columns.find((c) => c.role === "text");

/** Active sort levels, main sort first. Falls back to the old single sort on the first group/text column. */
export function sortSpec(data: QuantityData, adjust?: QuantityAdjust | null): SortKey[] {
  const a = normAdjust(adjust);
  const have = new Set(data.columns.map((c) => c.key));
  const seen = new Set<string>();
  const by = (a.sort_by ?? []).filter((s) => {
    if (!have.has(s.key) || seen.has(s.key)) return false;
    seen.add(s.key);
    return true;
  });
  if (by.length) return by;
  if (a.sort === "asc" || a.sort === "desc") {
    const c = sortColumn(data);
    if (c) return [{ key: c.key, dir: a.sort }];
  }
  return [];
}

/** Original row positions, so row keys stay stable for tables with no group column even after sorting. */
const origIndex = new WeakMap<object, number>();

/**
 * Display order of the rows. Steps:
 *  1. start from the manual order (`adjust.order`), or the original order;
 *  2. sort by the chosen columns in priority order (stable, so ties keep the manual order);
 *  3. every merged block is gathered into one unit: sorted inside, then placed among the other
 *     rows by its first row, so a block is always together and adjacent.
 * Detail rows travel with their row.
 */
export function sortData(data: QuantityData, adjust?: QuantityAdjust | null): QuantityData {
  data.rows.forEach((r, i) => {
    if (!origIndex.has(r)) origIndex.set(r, i);
  });
  const adj = normAdjust(adjust);
  const spec = sortSpec(data, adj);
  const merges = adj.merges;
  const order = adj.order ?? [];
  if (!spec.length && !merges.length && !order.length) return data;

  type Row = QuantityData["rows"][number];
  const keys = rowKeys(data);
  const idx = new Map<string, number>(keys.map((k, i) => [k, i] as [string, number]));

  // position of every row in the base (manual or original) order
  const rank = new Map<string, number>(order.map((k, i) => [k, i] as [string, number]));
  const baseOrder = data.rows
    .map((_, i) => i)
    .sort((a, b) => (rank.get(keys[a]) ?? 1e9 + a) - (rank.get(keys[b]) ?? 1e9 + b));
  const basePos: number[] = [];
  baseOrder.forEach((rowIdx, p) => (basePos[rowIdx] = p));

  const colRole = new Map(data.columns.map((c) => [c.key, c.role] as [string, string]));
  const cmp = (a: Row, b: Row): number => {
    for (const s of spec) {
      const av = a.cells[s.key];
      const bv = b.cells[s.key];
      let c: number;
      if (typeof av === "number" && typeof bv === "number" && colRole.get(s.key) !== "text") c = av - bv;
      else c = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
      if (c) return s.dir === "asc" ? c : -c;
    }
    return 0;
  };

  const used = new Set<number>();
  const units: { rows: Row[]; pos: number }[] = [];

  merges.forEach((m) => {
    const ids = Array.from(new Set(m.keys.map((k) => idx.get(k)).filter((x): x is number => x !== undefined)));
    if (ids.length < 2 || ids.some((i) => used.has(i))) return;
    ids.forEach((i) => used.add(i));
    const inner = ids
      .map((i) => ({ r: data.rows[i], p: basePos[i] }))
      .sort((a, b) => cmp(a.r, b.r) || a.p - b.p)
      .map((x) => x.r);
    units.push({ rows: inner, pos: Math.min(...ids.map((i) => basePos[i])) });
  });
  data.rows.forEach((r, i) => {
    if (!used.has(i)) units.push({ rows: [r], pos: basePos[i] });
  });

  units.sort((a, b) => cmp(a.rows[0], b.rows[0]) || a.pos - b.pos);
  return { ...data, rows: units.flatMap((u) => u.rows) };
}

export const num = (v: QuantityCell | undefined): number => (typeof v === "number" ? v : 0);
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Stable row id: the group values joined by "|", or the row index when nothing is grouped. */
export const rowKeys = (data: QuantityData): string[] => {
  const g = data.columns.filter((c) => c.role === "group");
  return data.rows.map((r, i) =>
    g.length ? g.map((c) => String(r.cells[c.key] ?? "")).join("|") : String(origIndex.get(r) ?? i)
  );
};

export interface Block {
  id: string;
  label: string;
  start: number;
  end: number;
  value: number; // sum including wastage
  raw: number; // sum without wastage
}

export interface Computed {
  keys: string[];
  hasFinal: boolean;
  wasteOn: boolean;
  percent: number;
  factor: number[];
  base: number[];
  eff: number[];
  baseTotal: number;
  effTotal: number;
  blocks: Block[];
  blockAt: (Block | undefined)[];
}

export function compute(data: QuantityData, adjust?: QuantityAdjust | null): Computed {
  const adj = normAdjust(adjust);
  const keys = rowKeys(data);
  const final = data.final;
  const hasFinal = !!final;
  const percent = adj.wastage.percent;
  const sel = new Set(adj.wastage.keys);
  const wasteOn = hasFinal && percent > 0 && (adj.wastage.all || sel.size > 0);

  const factor = keys.map((k) => (wasteOn && (adj.wastage.all || sel.has(k)) ? 1 + percent / 100 : 1));
  const base = data.rows.map((r) => (final ? num(r.cells[final]) : 0));
  const eff = base.map((b, i) => r6(b * factor[i]));

  const blockAt: (Block | undefined)[] = keys.map(() => undefined);
  const blocks: Block[] = [];
  if (hasFinal) {
    const idx = new Map<string, number>(keys.map((k, i) => [k, i] as [string, number]));
    adj.merges.forEach((m) => {
      const ids = m.keys
        .map((k) => idx.get(k))
        .filter((x): x is number => x !== undefined)
        .sort((a, b) => a - b);
      if (ids.length < 2) return;
      const contiguous = ids.every((v, j) => j === 0 || v === ids[j - 1] + 1);
      if (!contiguous || ids.some((i) => blockAt[i])) return; // stale or overlapping merge: ignored
      const b: Block = {
        id: m.id,
        label: m.label,
        start: ids[0],
        end: ids[ids.length - 1],
        value: r6(ids.reduce((s, i) => s + eff[i], 0)),
        raw: r6(ids.reduce((s, i) => s + base[i], 0)),
      };
      ids.forEach((i) => (blockAt[i] = b));
      blocks.push(b);
    });
  }

  return {
    keys,
    hasFinal,
    wasteOn,
    percent,
    factor,
    base,
    eff,
    baseTotal: r6(base.reduce((s, v) => s + v, 0)),
    effTotal: r6(eff.reduce((s, v) => s + v, 0)),
    blocks,
    blockAt,
  };
}



/* ── manual row moves ─────────────────────────────────────────────────
 * All helpers work on the CURRENT display order (calc.keys / calc.blockAt)
 * and return the new full key order, or null if the move is not allowed.
 */

/** Movable units in display order: a merged block is one unit, any other row is its own unit. */
function unitList(n: number, blockAt: (Block | undefined)[]): { start: number; end: number }[] {
  const us: { start: number; end: number }[] = [];
  for (let i = 0; i < n; ) {
    const b = blockAt[i];
    if (b) {
      us.push({ start: b.start, end: b.end });
      i = b.end + 1;
    } else {
      us.push({ start: i, end: i });
      i++;
    }
  }
  return us;
}

/** Move the unit (single row or whole merged block) that contains row i, one step up (-1) or down (+1). */
export function moveUnit(keys: string[], blockAt: (Block | undefined)[], i: number, dir: -1 | 1): string[] | null {
  const us = unitList(keys.length, blockAt);
  const ui = us.findIndex((u) => i >= u.start && i <= u.end);
  const nj = ui + dir;
  if (ui < 0 || nj < 0 || nj >= us.length) return null;
  const parts = us.map((u) => keys.slice(u.start, u.end + 1));
  [parts[ui], parts[nj]] = [parts[nj], parts[ui]];
  return parts.reduce<string[]>((acc, p) => acc.concat(p), []);
}

/** Move row i inside its merged block only. Returns null at the block edge (cannot leave the group). */
export function moveWithin(keys: string[], blockAt: (Block | undefined)[], i: number, dir: -1 | 1): string[] | null {
  const b = blockAt[i];
  if (!b) return null;
  const j = i + dir;
  if (j < b.start || j > b.end) return null;
  const out = keys.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}