import { QuantityColumnConfig, QuantityConfig, QuantityRole } from "./types";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

const NUMERIC: QuantityRole[] = ["sum", "avg", "min", "max"];

const count = (s: string, ch: string) => s.split(ch).length - 1;

const isNum = (v: string) =>
  /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(v) || /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v);

// Keep identical to dedupe_headers() in quantity_parser.py
export const dedupeHeaders = (cells: string[]): string[] => {
  const seen = new Set<string>();
  return cells.map((c, i) => {
    const base = c.trim() || `Column ${i + 1}`;
    let name = base;
    let k = 2;
    while (seen.has(name)) name = `${base}_${k++}`;
    seen.add(name);
    return name;
  });
};

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const firstLine = text.split("\n", 1)[0] ?? "";
  const delim = [",", ";", "\t"].reduce((b, d) => (count(firstLine, d) > count(firstLine, b) ? d : b), ",");

  const all: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      all.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    all.push(row);
  }

  const clean = all.filter((r) => r.some((c) => c.trim() !== ""));
  if (clean.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const headers = dedupeHeaders(clean[0]);
  const rows = clean.slice(1).map((r) => headers.map((_, i) => (r[i] ?? "").trim()));
  return { headers, rows };
}

export const firstValues = (p: ParsedCsv): Record<string, string> => {
  const out: Record<string, string> = {};
  p.headers.forEach((h, i) => {
    out[h] = p.rows.find((r) => r[i] !== "")?.[i] ?? "";
  });
  return out;
};

/** Heuristic starting config; settings from `prev` are kept for matching column names. */
export function suggestConfig(parsed: ParsedCsv, prev?: QuantityConfig | null): QuantityConfig {
  const prevBy = new Map((prev?.columns ?? []).map((c) => [c.key, c]));
  const n = parsed.rows.length;
  let groupPicked = (prev?.columns ?? []).some((c) => c.show && c.role === "group");

  const columns: QuantityColumnConfig[] = parsed.headers.map((key, i) => {
    const old = prevBy.get(key);
    if (old) return { ...old };
    const vals = parsed.rows.map((r) => r[i]).filter((v) => v !== "");
    const numeric = vals.length > 0 && vals.filter(isNum).length / vals.length >= 0.8;
    if (numeric) return { key, label: key, show: true, role: "sum", unit: "" };
    const distinct = new Set(vals).size;
    if (!groupPicked && distinct > 1 && distinct < n) {
      groupPicked = true;
      return { key, label: key, show: true, role: "group", unit: "" };
    }
    return { key, label: key, show: false, role: "text", unit: "" };
  });

  const ok = (k: string | null | undefined) =>
    !!k && columns.some((c) => c.key === k && c.show && NUMERIC.includes(c.role));
  const sums = columns.filter((c) => c.show && c.role === "sum");
  const final = ok(prev?.final) ? (prev!.final as string) : sums.length ? sums[sums.length - 1].key : null;

  return {
    columns,
    final,
    show_count: prev?.show_count ?? true,
    show_details: prev?.show_details ?? true,
    decimals: prev?.decimals ?? 2,
    adjust: prev?.adjust,
  };
}