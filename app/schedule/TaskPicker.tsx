"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Sequence, type Task } from "./data";
import { durationDays, toDay, wouldCycle } from "./scheduling";

// ---------- Searchable task picker ----------
// ---------- Searchable task picker ----------
export type PickerMode = "pred" | "succ";

export default function TaskPicker({
  mode,
  anchorTask,
  allTasks,
  sequences,
  onPick,
  onClose,
}: {
  mode: PickerMode;
  anchorTask: Task;
  allTasks: Task[];
  sequences: Sequence[];
  onPick: (otherId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const leaves = useMemo(() => {
    const parents = new Set(
      allTasks.map((t) => t.parentId).filter((x): x is string => !!x)
    );
    return allTasks.filter((t) => !parents.has(t.id) && t.id !== anchorTask.id);
  }, [allTasks, anchorTask.id]);

  const blocked = useMemo(() => {
    const set = new Set<string>();
    if (mode === "pred") {
      for (const s of sequences) {
        if (s.relatedTask === anchorTask.id) set.add(s.relatingTask);
      }
      for (const t of leaves) {
        if (wouldCycle(sequences, t.id, anchorTask.id)) set.add(t.id);
      }
    } else {
      for (const s of sequences) {
        if (s.relatingTask === anchorTask.id) set.add(s.relatedTask);
      }
      for (const t of leaves) {
        if (wouldCycle(sequences, anchorTask.id, t.id)) set.add(t.id);
      }
    }
    return set;
  }, [mode, sequences, anchorTask.id, leaves]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = leaves.filter((t) => !blocked.has(t.id));
    const matched = q
      ? base.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.workCode ?? "").toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      )
      : base;
    return [...matched].sort(
      (a, b) => toDay(a.scheduleStart) - toDay(b.scheduleStart)
    );
  }, [leaves, blocked, query]);

  const title =
    mode === "pred"
      ? `Pick a predecessor for "${anchorTask.name}"`
      : `Pick a successor for "${anchorTask.name}"`;

  return (
    <div
      ref={boxRef}
      className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border bg-white shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b px-3 py-2 text-xs font-semibold text-gray-700">
        {title}
      </div>
      <div className="border-b px-2 py-1.5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, code or id…"
          className="w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-gray-500">
            No matching tasks.
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onPick(t.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-blue-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-800">
                      {t.name}
                    </div>
                    <div className="truncate text-[10px] text-gray-500">
                      {t.workCode ? `${t.workCode} · ` : ""}
                      {t.scheduleStart} → {t.scheduleFinish}
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums text-[10px] text-gray-400">
                    {durationDays(t)}d
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-gray-50 px-3 py-1.5 text-[10px] text-gray-500">
        <span>{filtered.length} available</span>
        <button onClick={onClose} className="hover:text-gray-800">
          Cancel
        </button>
      </div>
    </div>
  );
}