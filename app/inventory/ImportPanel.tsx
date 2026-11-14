"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, importRows, type ImportResult } from "./inventoryApi";

// Sheet header (lowercase) -> field the API understands. Anything else is ignored.
const HEADER_MAP: Record<string, string> = {
  object: "name", item: "name", name: "name",
  type: "variant", variant: "variant",
  custodian: "custodian", owner: "custodian",
  category: "category",
  subcategory: "subcategory", "sub category": "subcategory", "sub-category": "subcategory",
  space: "location", location: "location",
  brand: "brand",
  condition: "condition",
  quantity: "qty_have", qty: "qty_have", "qty have": "qty_have",
  "qty needed": "qty_needed",
  remarks: "remarks",
};

function parse(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const keys = lines[0].split(delim).map((h) => HEADER_MAP[h.trim().toLowerCase()] ?? "");
  return lines
    .slice(1)
    .map((line) => {
      const cells = line.split(delim);
      const row: Record<string, string> = {};
      keys.forEach((key, i) => {
        const v = (cells[i] ?? "").trim();
        if (key && v) row[key] = v;
      });
      return row;
    })
    .filter((r) => r.name);
}

interface Props {
  projectId: number;
  onDone: () => Promise<void>;
  onClose: () => void;
}

export default function ImportPanel({ projectId, onDone, onClose }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => parse(text), [text]);

  async function run() {
    setBusy(true);
    setErr("");
    try {
      setResult(await importRows(projectId, rows));
      await onDone();
    } catch (e) {
      setErr(getApiErrorMessage(e, "Couldn’t import the rows."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Import from a sheet</h2>
        <p className="mt-1 text-sm text-slate-600">
          Copy the rows from Excel or Google Sheets, header row included, and paste them here. Columns
          are matched by name: Object, Type, Custodian, Category, SubCategory, Space, Brand, Condition,
          Quantity, Remarks. Other columns are ignored. Categories, subcategories and spaces in the sheet
          are created for you, and rows with no quantity import as 1.
        </p>

        <input
          type="file"
          accept=".csv,.tsv,.txt"
          className="mt-3 block text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setText(await file.text());
          }}
        />
        <textarea
          className="mt-3 h-48 w-full rounded border border-slate-300 p-2 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste rows here"
        />

        <p className="mt-2 text-sm text-slate-700">
          {text.trim() ? `${rows.length} items ready to import.` : "Nothing pasted yet."}
        </p>

        {err && <p role="alert" className="mt-2 text-sm text-rose-700">{err}</p>}
        {result && (
          <div className="mt-2 rounded bg-emerald-50 p-3 text-sm text-emerald-900">
            Imported {result.created} items, skipped {result.skipped}. Created {result.categories_created} categories
            and {result.subcategories_created} subcategories.
            {result.unmatched_custodians.length > 0 && (
              <p className="mt-1 text-amber-800">
                No person on this project matched: {result.unmatched_custodians.join(", ")}. Those items are unassigned.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={run}
              disabled={busy || rows.length === 0}
              className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-60"
            >
              {busy ? "Importing…" : `Import ${rows.length} items`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
