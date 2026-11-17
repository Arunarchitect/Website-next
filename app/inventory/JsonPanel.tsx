"use client";

import { useEffect, useState } from "react";
import {
  bulkItems,
  getApiErrorMessage,
  type BulkResult,
  type BulkRowResult,
} from "./inventoryApi";
import { parseItemsJson } from "./itemJson";

const badge: Record<BulkRowResult["status"], string> = {
  create: "bg-emerald-100 text-emerald-900",
  update: "bg-sky-100 text-sky-900",
  unchanged: "bg-slate-100 text-slate-600",
  error: "bg-rose-100 text-rose-900",
};

const badgeLabel: Record<BulkRowResult["status"], string> = {
  create: "New",
  update: "Update",
  unchanged: "No change",
  error: "Error",
};

interface Props {
  projectId: number;
  onDone: () => Promise<void>;
  onClose: () => void;
}

export default function JsonPanel({ projectId, onDone, onClose }: Props) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [applied, setApplied] = useState<BulkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function validate() {
    setErr("");
    setApplied(null);
    setResult(null);
    setCheckedText(null);
    let items: unknown[];
    try {
      items = parseItemsJson(text, projectId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid JSON.");
      return;
    }
    setBusy(true);
    try {
      const r = await bulkItems(projectId, items, true);
      setResult(r);
      if (r.ok) setCheckedText(text);
    } catch (e) {
      setErr(getApiErrorMessage(e, "Couldn’t validate the JSON."));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result) return;
    let items: unknown[];
    try {
      items = parseItemsJson(text, projectId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid JSON.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await bulkItems(projectId, items, false);
      if (!r.ok) {
        setResult(r);
        setCheckedText(null);
      } else {
        setApplied(r);
        await onDone();
      }
    } catch (e) {
      setErr(getApiErrorMessage(e, "Couldn’t apply the changes."));
    } finally {
      setBusy(false);
    }
  }

  const changes = result ? result.summary.create + result.summary.update : 0;
  const stale = result?.ok && checkedText !== text && !applied;
  const canApply = !!result && result.ok && checkedText === text && changes > 0 && !applied;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Paste JSON</h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste JSON copied from the table (edited in an AI or by hand) and validate it. Items with a
          code are updated, items without one are added. Nothing is saved until you apply, and
          nothing is saved at all if any item has an error. Items you leave out are not deleted.
        </p>

        <textarea
          className="mt-3 h-56 w-full rounded border border-slate-300 p-2 font-mono text-xs focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste JSON here"
          spellCheck={false}
        />

        {err && (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {err}
          </p>
        )}

        {stale && (
          <p className="mt-2 text-sm text-amber-800">
            The JSON changed since it was validated. Validate again before applying.
          </p>
        )}

        {applied && (
          <p className="mt-2 rounded bg-emerald-50 p-3 text-sm text-emerald-900">
            Applied: {applied.summary.create} added, {applied.summary.update} updated,{" "}
            {applied.summary.unchanged} unchanged.
          </p>
        )}

        {result && (
          <div className="mt-3">
            <p
              className={`text-sm font-medium ${result.ok ? "text-emerald-800" : "text-rose-800"}`}
            >
              {result.ok
                ? `Valid: ${result.summary.create} new, ${result.summary.update} to update, ${result.summary.unchanged} unchanged.`
                : `${result.summary.error} item(s) have errors. Fix them and validate again.`}
            </p>
            <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200 text-sm">
              {result.rows.map((r) => (
                <li key={r.index} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge[r.status]}`}
                    >
                      {badgeLabel[r.status]}
                    </span>
                    <span className="text-slate-500">
                      #{r.index + 1}
                      {r.code ? ` · code ${r.code}` : ""}
                    </span>
                    <span className="font-medium text-slate-900">{r.name || "(no name)"}</span>
                    {r.changes.length > 0 && (
                      <span className="text-xs text-slate-500">changes: {r.changes.join(", ")}</span>
                    )}
                  </div>
                  {r.errors.map((m, i) => (
                    <p key={i} className="mt-1 text-xs text-rose-700">
                      {m}
                    </p>
                  ))}
                  {r.warnings.map((m, i) => (
                    <p key={i} className="mt-1 text-xs text-amber-800">
                      {m}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {applied ? "Close" : "Cancel"}
          </button>
          {!applied && (
            <>
              <button
                onClick={validate}
                disabled={busy || !text.trim()}
                className="rounded border border-slate-800 px-4 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy && !canApply ? "Checking…" : "Validate"}
              </button>
              <button
                onClick={apply}
                disabled={busy || !canApply}
                className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-60"
              >
                {busy ? "Working…" : `Apply ${changes} change${changes === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}