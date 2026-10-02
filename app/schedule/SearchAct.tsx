"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "./data";
import { toDay } from "./scheduling";

/**
 * Searchable dropdown for jumping to a task.
 *
 * Props:
 *   tasks           — full task list (flat)
 *   collapsed       — current collapsed set (so we can expand ancestors of picked)
 *   onSelect(id)    — called when user picks a task
 *   onExpand(ids)   — called with ancestor ids to un-collapse
 */
export function SearchAct({
  tasks,
  onSelect,
  onExpand,
}: {
  tasks: Task[];
  onSelect: (id: string) => void;
  onExpand: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Build a lookup for ancestor chains once per task list change
  const parentOf = useMemo(() => {
    const m = new Map<string, string | null>();
    tasks.forEach((t) => m.set(t.id, t.parentId));
    return m;
  }, [tasks]);

  const ancestorsOf = (id: string): string[] => {
    const out: string[] = [];
    let cur = parentOf.get(id);
    while (cur) {
      out.push(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return out;
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const leaves = tasks.filter((t) => {
      const hasKids = tasks.some((c) => c.parentId === t.id);
      return !hasKids;
    });
    const base = q
      ? leaves.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.workCode ?? "").toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
        )
      : leaves;
    return [...base]
      .sort((a, b) => toDay(a.scheduleStart) - toDay(b.scheduleStart))
      .slice(0, 12);
  }, [tasks, query]);

  useEffect(() => setActiveIdx(0), [query]);

  const pick = (t: Task) => {
    // Expand all ancestors so the task is visible
    onExpand(ancestorsOf(t.id));
    onSelect(t.id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = results[activeIdx];
      if (t) pick(t);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search activities…  (name, code, or id)"
          className="w-72 rounded border bg-white px-3 py-1.5 pl-8 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Search activities"
        />
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.63 3.64a1 1 0 0 0 1.42-1.42l-3.64-3.63A5.5 5.5 0 0 0 9 3.5Zm-3.5 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 overflow-hidden rounded-md border bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-500">
              No activities match “{query}”.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((t, i) => {
                const parent = t.parentId
                  ? tasks.find((x) => x.id === t.parentId)
                  : null;
                const active = i === activeIdx;
                return (
                  <li key={t.id}>
                    <button
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => pick(t)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs ${
                        active ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-gray-800">
                          {t.name}
                        </div>
                        <div className="truncate text-[10px] text-gray-500">
                          {parent ? `${parent.name} · ` : ""}
                          {t.scheduleStart} → {t.scheduleFinish}
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-[10px] text-gray-400">
                        {t.workCode ?? ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t bg-gray-50 px-3 py-1.5 text-[10px] text-gray-500">
            ↑↓ to navigate · Enter to jump · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}