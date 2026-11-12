import { QuantityAdjust, QuantityCell, QuantityData, QuantityMerge } from "./types";

export type SortDir = "none" | "asc" | "desc";

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
  sort: a?.sort === "asc" || a?.sort === "desc" ? a.sort : "none",
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

/** The column the table is sorted by: the first "group" column, else the first "text" column. */
export const sortColumn = (data: QuantityData) =>
  data.columns.find((c) => c.role === "group") ?? data.columns.find((c) => c.role === "text");

/** Original row positions, so row keys stay stable for tables with no group column even after sorting. */
const origIndex = new WeakMap<object, number>();

/**
 * Alphabetical sort. Detail rows travel with their row.
 * Merged blocks are sorted inside first, then the whole block is treated as one object and placed
 * among the other rows by its first row. So a merged block always stays together and adjacent.
 */
export function sortData(data: QuantityData, sort?: SortDir | null, merges?: QuantityMerge[] | null): QuantityData {
  data.rows.forEach((r, i) => {
    if (!origIndex.has(r)) origIndex.set(r, i);
  });
  if (sort !== "asc" && sort !== "desc") return data;
  const col = sortColumn(data);
  if (!col) return data;
  type Row = QuantityData["rows"][number];
  const dir = sort === "asc" ? 1 : -1;
  const val = (r: Row) => String(r.cells[col.key] ?? "");
  const cmp = (a: Row, b: Row) =>
    dir * val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: "base" });

  const keys = rowKeys(data);
  const idx = new Map<string, number>(keys.map((k, i) => [k, i] as [string, number]));
  const used = new Set<number>();
  const units: { rows: Row[]; pos: number }[] = [];

  (merges ?? []).forEach((m) => {
    const ids = Array.from(new Set(m.keys.map((k) => idx.get(k)).filter((x): x is number => x !== undefined)));
    if (ids.length < 2 || ids.some((i) => used.has(i))) return;
    ids.forEach((i) => used.add(i));
    const inner = ids
      .map((i) => ({ r: data.rows[i], i }))
      .sort((a, b) => cmp(a.r, b.r) || a.i - b.i)
      .map((x) => x.r);
    units.push({ rows: inner, pos: Math.min(...ids) });
  });
  data.rows.forEach((r, i) => {
    if (!used.has(i)) units.push({ rows: [r], pos: i });
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