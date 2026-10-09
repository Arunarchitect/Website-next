"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Sequence, Task } from "./data";
import { SEQUENCE_TYPES, type SequenceType } from "./data";
import { durationDays, durationWorkdays, toDay, wouldCycle } from "./scheduling";
import {
  addWorkdays,
  countWorkdays,
  nextWorkday,
  prevWorkday,
  type WorkingCalendar,
} from "./calendar";

export type MoveTarget = { kind: "root" } | { kind: "under"; id: string };

// ---------------- helper: cycles ----------------
export function isDescendant(
  tasks: Task[],
  taskId: string,
  candidateParentId: string
): boolean {
  if (taskId === candidateParentId) return true;
  let cur: string | null = candidateParentId;
  while (cur) {
    if (cur === taskId) return true;
    cur = tasks.find((t) => t.id === cur)?.parentId ?? null;
  }
  return false;
}

// ---------------- helper: date math (calendar-day) ----------------
const DAY = 86_400_000;

function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function finishFromStart(iso: string, days: number): string {
  const d = new Date(toDay(iso) * DAY);
  d.setUTCDate(d.getUTCDate() + Math.max(0, days - 1));
  return toISO(d);
}

function daysBetween(startISO: string, finishISO: string): number {
  return Math.max(1, toDay(finishISO) - toDay(startISO) + 1);
}

// ---------------- number input ----------------
// Keeps the raw typed text so you can backspace to empty and retype.
// onChange fires live (only for real numbers); onCommit fires on blur/Enter.
function NumberInput({
  value,
  min = 1,
  max,
  disabled,
  onCommit,
  onChange,
  className,
  title,
  suffix,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (n: number) => void;
  onChange?: (n: number) => void;
  className?: string;
  title?: string;
  suffix?: string;
}) {
  const [raw, setRaw] = useState<string>(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setRaw(String(value));
  }, [value, focused]);

  const commit = () => {
    const trimmed = raw.trim();
    let n = Number(trimmed);
    if (trimmed === "" || trimmed === "-" || !Number.isFinite(n)) n = value;
    n = Math.round(n);
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    setRaw(String(n));
    if (n !== value) onCommit(n);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={raw}
        disabled={disabled}
        title={title}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d-]/g, "");
          setRaw(v);
          if (onChange && v !== "" && v !== "-") {
            const n = Number(v);
            if (Number.isFinite(n)) onChange(Math.round(n));
          }
        }}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setRaw(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={className}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ---------------- date input ----------------
// Native date inputs fire onChange on partial years (0002, 0020, 0202...).
// This keeps a local draft, only commits plausible full dates, and does not
// resync from the saved value while the field is focused.
function DateField({
  value,
  onCommit,
  disabled,
  className,
  allowEmpty = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const plausible = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const y = Number(v.slice(0, 4));
    return y >= 1900 && y <= 2200;
  };

  return (
    <input
      type="date"
      value={draft}
      disabled={disabled}
      className={className}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (v === "") {
          if (allowEmpty) onCommit("");
          return;
        }
        if (plausible(v)) onCommit(v);
      }}
      onBlur={() => {
        focusedRef.current = false;
        setDraft(value);
      }}
    />
  );
}

// ---------------- searchable task picker ----------------
function ParentPicker({
  tasks,
  excludeId,
  value,
  onChange,
  allowRoot = true,
  placeholder = "Search…",
  inputCls = "rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400",
  autoFocus = false,
}: {
  tasks: Task[];
  excludeId?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  allowRoot?: boolean;
  placeholder?: string;
  inputCls?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => {
    const list = excludeId
      ? tasks.filter(
        (t) => t.id !== excludeId && !isDescendant(tasks, excludeId, t.id)
      )
      : tasks;
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [tasks, excludeId]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? candidates.filter((t) => t.name.toLowerCase().includes(q))
      : candidates;
    const rootOpt = allowRoot
      ? [{ id: "__root__", name: "— Top level —", isRoot: true as const }]
      : [];
    return [
      ...rootOpt,
      ...matches.map((t) => ({
        id: t.id,
        name: t.name,
        isRoot: false as const,
      })),
    ];
  }, [candidates, query, allowRoot]);

  const selectedLabel = useMemo(() => {
    if (value == null) return allowRoot ? "— Top level —" : "";
    return candidates.find((t) => t.id === value)?.name ?? value;
  }, [value, candidates, allowRoot]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current?.querySelector<HTMLElement>(
      `[data-opt-idx="${highlight}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const commit = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    setHighlight(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (!opt) return;
      commit(opt.isRoot ? null : opt.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) setQuery("");
      else setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={`w-full ${inputCls}`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        autoFocus={autoFocus}
      />
      {value != null && !open && (
        <button
          type="button"
          onClick={() => commit(null)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="Clear"
        >
          ✕
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-56 overflow-y-auto rounded-md border bg-white text-xs shadow-lg">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-gray-500">
              No matches for “{query}”.
            </div>
          ) : (
            options.map((opt, i) => {
              const selected =
                (opt.isRoot && value == null) ||
                (!opt.isRoot && value === opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-opt-idx={i}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commit(opt.isRoot ? null : opt.id)}
                  className={`block w-full truncate px-2 py-1 text-left ${i === highlight ? "bg-blue-50" : ""
                    } ${selected ? "font-semibold text-blue-700" : ""}`}
                  title={opt.name}
                >
                  {opt.name}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- link row ----------------
function LinkRow({
  kind,
  other,
  sequence,
  readOnly,
  onChange,
  onRemove,
}: {
  kind: "pred" | "succ";
  other: Task | undefined;
  sequence: Sequence;
  readOnly?: boolean;
  onChange: (patch: Partial<Sequence>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded border bg-white px-1.5 py-1 text-xs">
      <span
        className="min-w-0 flex-1 truncate font-medium text-gray-800"
        title={other?.name ?? sequence.relatingTask}
      >
        {other?.name ??
          (kind === "pred" ? sequence.relatingTask : sequence.relatedTask)}
      </span>
      <select
        value={sequence.sequenceType}
        disabled={readOnly}
        onChange={(e) =>
          onChange({ sequenceType: e.target.value as SequenceType })
        }
        className="rounded border bg-white px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
        title="Dependency type"
      >
        {SEQUENCE_TYPES.map((st) => (
          <option key={st.value} value={st.value}>
            {st.short}
          </option>
        ))}
      </select>
      <NumberInput
        value={sequence.lagDays}
        min={-9999}
        max={9999}
        disabled={readOnly}
        onCommit={(n) => onChange({ lagDays: n })}
        onChange={(n) => onChange({ lagDays: n })}
        className="w-12 rounded border px-1 py-0.5 text-right text-[10px] tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
        title="Lag in days (negative = lead)"
      />
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-1 text-red-600 hover:bg-red-50 hover:text-red-800"
          title="Remove link"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ---------------- links editor (pred or succ) ----------------
// Works on a LOCAL draft list; nothing reaches the schedule until Save.
function LinksEditor({
  kind,
  task,
  tasks,
  allSequences,
  readOnly,
  onAdd,
  onChange,
  onRemove,
  onCreateNew,
}: {
  kind: "pred" | "succ";
  task: Task;
  tasks: Task[];
  allSequences: Sequence[];
  readOnly?: boolean;
  onAdd: (otherId: string) => void;
  onChange: (id: string, patch: Partial<Sequence>) => void;
  onRemove: (id: string) => void;
  /** Create a brand-new activity (same group) linked as pred/succ. */
  onCreateNew?: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const links: { seq: Sequence; otherId: string }[] = useMemo(() => {
    return allSequences
      .filter((s) =>
        kind === "pred"
          ? s.relatedTask === task.id
          : s.relatingTask === task.id
      )
      .map((s) => ({
        seq: s,
        otherId: kind === "pred" ? s.relatingTask : s.relatedTask,
      }));
  }, [allSequences, task.id, kind]);

  const linkedIds = useMemo(
    () => new Set(links.map((l) => l.otherId)),
    [links]
  );

  const candidates = useMemo(() => {
    return tasks.filter((t) => {
      if (t.id === task.id) return false;
      if (linkedIds.has(t.id)) return false;
      const hasChildren = tasks.some((c) => c.parentId === t.id);
      if (hasChildren) return false;
      const predId = kind === "pred" ? t.id : task.id;
      const succId = kind === "pred" ? task.id : t.id;
      if (wouldCycle(allSequences, predId, succId)) return false;
      return true;
    });
  }, [tasks, task.id, linkedIds, kind, allSequences]);

  const addLink = (otherId: string) => {
    onAdd(otherId);
    setAdding(false);
  };

  return (
    <div className="rounded border border-gray-200 bg-gray-50/60 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {kind === "pred" ? "Predecessors" : "Successors"}
        </span>
        {!readOnly && !adding && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded border bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
              title="Link an existing activity"
            >
              + Add
            </button>
            {onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className="rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-100"
                title={`Save, then create a new activity in this group as ${kind === "pred" ? "predecessor" : "successor"
                  }`}
              >
                ＋ New
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {links.length === 0 && !adding && (
          <div className="text-[11px] italic text-gray-400">
            No {kind === "pred" ? "predecessors" : "successors"}.
          </div>
        )}
        {links.map(({ seq, otherId }) => (
          <LinkRow
            key={seq.id}
            kind={kind}
            other={tasks.find((t) => t.id === otherId)}
            sequence={seq}
            readOnly={readOnly}
            onChange={(patch) => onChange(seq.id, patch)}
            onRemove={() => onRemove(seq.id)}
          />
        ))}

        {adding && !readOnly && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <ParentPicker
                tasks={candidates}
                value={null}
                onChange={(id) => {
                  if (id) addLink(id);
                  else setAdding(false);
                }}
                allowRoot={false}
                placeholder={`Search ${kind === "pred" ? "predecessor" : "successor"}…`}
                inputCls="w-full rounded border px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded border px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {adding && candidates.length === 0 && (
          <div className="text-[11px] italic text-gray-400">
            No eligible {kind === "pred" ? "predecessors" : "successors"}{" "}
            available.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- modal ----------------
export function ActivityEditorModal({
  task,
  tasks,
  sequences,
  calendar,
  useWorkdays,
  isAdmin,
  onSave,
  onDelete,
  onClose,
  onApplyLinks,
  onCreateLinked,
}: {
  task: Task;
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkingCalendar;
  useWorkdays: boolean;
  isAdmin: boolean;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
  /** Called once on Save with this task's full, edited list of links. */
  onApplyLinks?: (next: Sequence[]) => void;
  /**
   * Create a NEW activity in the same group as this one, linked as its
   * predecessor or successor, and open it for editing (like "+ New phase").
   */
  onCreateLinked?: (mode: "pred" | "succ") => void;
}) {
  const [name, setName] = useState(task.name);
  const [code, setCode] = useState(task.workCode ?? "");
  const [start, setStart] = useState(task.scheduleStart);
  const [finish, setFinish] = useState(task.scheduleFinish);
  const [duration, setDuration] = useState<number>(
    useWorkdays ? durationWorkdays(task, calendar) : durationDays(task)
  );
  const [baseStart, setBaseStart] = useState(task.baselineStart ?? "");
  const [baseFinish, setBaseFinish] = useState(task.baselineFinish ?? "");
  const [actStart, setActStart] = useState(task.actualStart ?? "");
  const [actFinish, setActFinish] = useState(task.actualFinish ?? "");
  const [completion, setCompletion] = useState(task.completion);
  const [milestone, setMilestone] = useState(task.isMilestone);
  const [remarks, setRemarks] = useState(task.remarks ?? "");
  const [parentId, setParentId] = useState<string | null>(task.parentId);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Group heads: dates, progress, baseline and actuals come from the children.
  const isGroup = tasks.some((t) => t.parentId === task.id);
  // Baseline is admin-only, and never editable on a group (derived).
  const canEditBaseline = isAdmin && !isGroup;

  const linksEnabled = !!onApplyLinks;

  // ── Local draft of this task's links (applied only on Save) ────────────
  const isMine = (s: Sequence) =>
    s.relatingTask === task.id || s.relatedTask === task.id;

  const [draftLinks, setDraftLinks] = useState<Sequence[]>(() =>
    sequences.filter(isMine).map((s) => ({ ...s }))
  );

  // Everything else + the draft, so cycle checks see the edited state.
  const draftAllSeqs = useMemo(
    () => [...sequences.filter((s) => !isMine(s)), ...draftLinks],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sequences, draftLinks, task.id]
  );

  const addDraftLink = (predId: string, succId: string) =>
    setDraftLinks((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        relatingTask: predId,
        relatedTask: succId,
        sequenceType: "FINISH_START",
        lagDays: 0,
      } as Sequence,
    ]);

  const updateDraftLink = (id: string, patch: Partial<Sequence>) =>
    setDraftLinks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );

  const removeDraftLink = (id: string) =>
    setDraftLinks((prev) => prev.filter((s) => s.id !== id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Linked date / duration handlers ────────────────────────────────────

  const recomputeFinish = (nextStart: string, nextDuration: number): string => {
    const d = Math.max(1, Math.round(nextDuration));
    if (milestone) return nextStart;
    if (!useWorkdays) return finishFromStart(nextStart, d);
    const s = nextWorkday(nextStart, calendar);
    return addWorkdays(s, d - 1, calendar);
  };

  const onStartChange = (v: string) => {
    if (!v) return;
    const s = useWorkdays ? nextWorkday(v, calendar) : v;
    setStart(s);
    setFinish(recomputeFinish(s, duration));
  };

  const onDurationCommit = (n: number) => {
    const d = Math.max(1, Math.round(n));
    setDuration(d);
    setFinish(recomputeFinish(start, d));
  };

  const onFinishChange = (v: string) => {
    if (!v) return;
    if (!useWorkdays) {
      setFinish(v);
      if (!start) return;
      if (v < start) {
        setFinish(start);
        setDuration(1);
      } else {
        setDuration(daysBetween(start, v));
      }
      return;
    }
    let f = prevWorkday(v, calendar);
    if (f < start) {
      f = start;
      setFinish(f);
      setDuration(1);
      return;
    }
    setFinish(f);
    setDuration(Math.max(1, countWorkdays(start, f, calendar)));
  };

  const save = () => {
    // Group heads: only send the fields that are genuinely editable, so
    // derived dates / progress / baseline / actuals are never written back.
    if (isGroup) {
      onSave({
        name: name.trim() || task.name,
        workCode: code.trim() || undefined,
        remarks: remarks.trim() || undefined,
        parentId,
      });
      onClose();
      return;
    }

    const bs = baseStart || null;
    let bf = baseFinish || null;
    if (bs && bf && bf < bs) bf = bs;
    let as = actStart || null;
    let af = actFinish || null;

    const todayStr = (() => {
      const n = new Date();
      const p = (x: number) => String(x).padStart(2, "0");
      return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
    })();
    const done = completion >= 100;

    // Unfinished tasks never have an actual finish; 0% has no actual start.
    if (!done) af = null;
    if (completion <= 0) as = null;

    if (as && af && af < as) af = as;

    // Completed tasks: actual dates can't be in the future.
    if (done && af && af > todayStr) af = todayStr;
    if (done && as && af && as > af) as = af;

    // Recompute finish from start + duration so the saved values agree.
    let finalStart = start;
    let finalFinish = finish;
    if (milestone) {
      finalFinish = finalStart;
    } else if (!useWorkdays) {
      finalFinish = finishFromStart(
        finalStart,
        Math.max(1, Math.round(duration))
      );
    } else {
      finalStart = nextWorkday(finalStart, calendar);
      finalFinish = addWorkdays(
        finalStart,
        Math.max(1, Math.round(duration)) - 1,
        calendar
      );
    }

    // Completed tasks: planned dates can't be in the future either.
    if (done && finalFinish > todayStr) finalFinish = todayStr;

    // In progress (1-99%): planned finish can't be in the past -> extend to today.
    if (!done && completion > 0 && !milestone && finalFinish < todayStr) {
      finalFinish = useWorkdays ? nextWorkday(todayStr, calendar) : todayStr;
    }

    if (finalStart > finalFinish) finalStart = finalFinish;

    onSave({
      name: name.trim() || task.name,
      workCode: code.trim() || undefined,
      scheduleStart: finalStart,
      scheduleFinish: finalFinish,
      // Non-admins never send baseline fields, so they can't overwrite them.
      ...(isAdmin ? { baselineStart: bs, baselineFinish: bf } : {}),
      actualStart: as,
      actualFinish: af,
      completion: Math.max(0, Math.min(100, Math.round(completion))),
      isMilestone: milestone,
      remarks: remarks.trim() || undefined,
      parentId,
    });

    // Links: apply only if something actually changed.
    if (onApplyLinks) {
      const orig = sequences.filter(isMine);
      const same =
        orig.length === draftLinks.length &&
        orig.every((o) => {
          const d = draftLinks.find((x) => x.id === o.id);
          return (
            !!d &&
            d.sequenceType === o.sequenceType &&
            d.lagDays === o.lagDays &&
            d.relatingTask === o.relatingTask &&
            d.relatedTask === o.relatedTask
          );
        });
      if (!same) onApplyLinks(draftLinks);
    }

    onClose();
  };


  // "＋ New" next to Predecessors / Successors:
  // 1) save what has been typed so far (also closes this editor),
  // 2) the parent creates the new activity in the same group, links it,
  //    and opens ITS editor — exactly like "+ New phase".
  const createLinked = (mode: "pred" | "succ") => {
    if (!onCreateLinked) return;
    save();
    onCreateLinked(mode);
  };

  const inputCls =
    "rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-800">
            Edit activity
          </h2>
          <button
            onClick={onClose}
            className="rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-3 px-4 py-3 text-sm">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">
                Work code
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 7-9"
                className={inputCls}
              />
            </label>

            <div className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">
                Parent group
              </span>
              <ParentPicker
                tasks={tasks}
                excludeId={task.id}
                value={parentId}
                onChange={setParentId}
                allowRoot
                placeholder="Search parent…"
                inputCls={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Start</span>
              <DateField
                value={start}
                onCommit={onStartChange}
                disabled={milestone || isGroup}
                className={`${inputCls} disabled:bg-gray-100`}
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">
                {useWorkdays ? "Duration (work days)" : "Duration (days)"}
              </span>
              <NumberInput
                value={milestone ? 1 : duration}
                min={1}
                max={9999}
                disabled={milestone || isGroup}
                onChange={(n) => {
                  if (n >= 1) onDurationCommit(n);
                }}
                onCommit={onDurationCommit}
                className={`${inputCls} w-full tabular-nums disabled:bg-gray-100`}
                title={
                  useWorkdays
                    ? "Editing duration shifts the finish by working days"
                    : "Editing duration shifts the finish by calendar days"
                }
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Finish</span>
              <DateField
                value={finish}
                onCommit={onFinishChange}
                disabled={milestone || isGroup}
                className={`${inputCls} disabled:bg-gray-100`}
              />
            </div>
          </div>
          <p className="-mt-1 text-[10px] text-gray-500">
            Editing <strong>Duration</strong> keeps the start date fixed and
            moves the finish. Editing <strong>Finish</strong> recalculates the
            duration.{" "}
            {useWorkdays
              ? "In working-day mode, weekends and holidays are skipped."
              : "Milestones are always 1 day."}{" "}
            Nothing is applied until you press <strong>Save</strong>.
          </p>
          {isGroup && (
            <p className="-mt-1 text-[10px] text-amber-700">
              Group dates, progress, baseline and actuals are derived from the
              children. Use Auto-schedule to refresh them.
            </p>
          )}

          {linksEnabled && !milestone && !isGroup && (
            <div className="grid grid-cols-2 gap-3">
              <LinksEditor
                kind="pred"
                task={task}
                tasks={tasks}
                allSequences={draftAllSeqs}
                onAdd={(otherId) => addDraftLink(otherId, task.id)}
                onChange={updateDraftLink}
                onRemove={removeDraftLink}
                onCreateNew={
                  onCreateLinked ? () => createLinked("pred") : undefined
                }
              />
              <LinksEditor
                kind="succ"
                task={task}
                tasks={tasks}
                allSequences={draftAllSeqs}
                onAdd={(otherId) => addDraftLink(task.id, otherId)}
                onChange={updateDraftLink}
                onRemove={removeDraftLink}
                onCreateNew={
                  onCreateLinked ? () => createLinked("succ") : undefined
                }
              />
            </div>
          )}

          <div className="rounded border border-gray-200 bg-gray-50/60 p-2.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Baseline (frozen plan)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-gray-600">
                  Baseline start
                </span>
                <DateField
                  value={baseStart}
                  onCommit={setBaseStart}
                  allowEmpty
                  disabled={!canEditBaseline}
                  className={`${inputCls} disabled:bg-gray-100`}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-gray-600">
                  Baseline finish
                </span>
                <DateField
                  value={baseFinish}
                  onCommit={setBaseFinish}
                  allowEmpty
                  disabled={!canEditBaseline}
                  className={`${inputCls} disabled:bg-gray-100`}
                />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500">
              {isGroup
                ? "Derived from the children."
                : isAdmin
                  ? 'Normally set for every task at once with "Set baseline" in the header.'
                  : "Only admins can edit the baseline."}
            </p>
          </div>

          <div className="rounded border border-emerald-200 bg-emerald-50/50 p-2.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Actual (what really happened)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-gray-600">
                  Actual start
                </span>
                <DateField
                  value={actStart}
                  onCommit={setActStart}
                  allowEmpty
                  disabled={isGroup}
                  className={`${inputCls} disabled:bg-gray-100`}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-xs font-medium text-gray-600">
                  Actual finish
                </span>
                <DateField
                  value={actFinish}
                  onCommit={setActFinish}
                  allowEmpty
                  disabled={isGroup}
                  className={`${inputCls} disabled:bg-gray-100`}
                />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-500">
              {isGroup
                ? "Derived from the children: starts with the earliest child start, finishes once every child has finished."
                : "Filled automatically when you move the % slider; edit here to correct a date."}
            </p>
          </div>

          <label className="grid gap-1">
            <span className="flex items-center justify-between text-xs font-medium text-gray-600">
              <span>Completion</span>
              <span className="tabular-nums text-gray-800">{completion}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={completion}
              disabled={isGroup}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCompletion(v);
                if (v < 100) setActFinish(""); // unfinished = no actual finish
                if (v === 0) setActStart("");  // not started = no actual start
              }}
              className="w-full"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={milestone}
              disabled={isGroup}
              onChange={(e) => {
                const v = e.target.checked;
                setMilestone(v);
                if (v && start) {
                  setFinish(start);
                  setDuration(1);
                }
              }}
            />
            <span className="text-xs text-gray-700">
              Milestone (single-day, no work)
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-600">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-gray-50 px-4 py-2.5">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-700">
                Delete &quot;{task.name}&quot; and all its children?
              </span>
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded border px-2 py-1 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Delete…
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded bg-black px-3 py-1 text-sm text-white hover:bg-gray-800"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- row menu ----------------
export type RowMenuAction =
  | { kind: "edit" }
  | { kind: "addChild" }
  | { kind: "addSibling" }
  | { kind: "addPred" }
  | { kind: "addSucc" }
  | { kind: "copyJson" }
  | { kind: "delete" }
  | { kind: "move"; target: MoveTarget };

export function RowMenu({
  task,
  tasks,
  onAction,
  onClose,
}: {
  task: Task;
  tasks: Task[];
  onAction: (a: RowMenuAction) => void;
  onClose: () => void;
}) {
  const [moving, setMoving] = useState(false);

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border bg-white text-xs shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          onAction({ kind: "edit" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
      >
        ✎  Edit…
      </button>
      <button
        onClick={() => {
          onAction({ kind: "addChild" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
      >
        ＋  Add child…
      </button>
      <button
        onClick={() => {
          onAction({ kind: "addSibling" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
      >
        ＋  Add sibling…
      </button>
      {!task.isMilestone && !tasks.some((t) => t.parentId === task.id) && (
        <>
          <button
            onClick={() => {
              onAction({ kind: "addPred" });
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
            title="Create a new activity in this group, linked before this one"
          >
            ＋  Add predecessor…
          </button>
          <button
            onClick={() => {
              onAction({ kind: "addSucc" });
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
            title="Create a new activity in this group, linked after this one"
          >
            ＋  Add successor…
          </button>
        </>
      )}
      <button
        onClick={() => {
          onAction({ kind: "copyJson" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
        title="Copy this task/phase and everything under it as JSON (for AI editing)"
      >
        ⧉  Copy JSON for AI
      </button>

      <div className="border-t" />

      {!moving ? (
        <button
          onClick={() => setMoving(true)}
          className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
        >
          ⇄  Move into…
        </button>
      ) : (
        <div className="px-2 py-1.5">
          <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">
            Move under
          </div>
          <ParentPicker
            tasks={tasks}
            excludeId={task.id}
            value={null}
            onChange={(id) => {
              const target: MoveTarget =
                id == null ? { kind: "root" } : { kind: "under", id };
              onAction({ kind: "move", target });
              onClose();
            }}
            allowRoot
            placeholder="Search parent…"
            inputCls="w-full rounded border px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}

      <div className="border-t" />

      <button
        onClick={() => {
          onAction({ kind: "delete" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left text-red-700 hover:bg-red-50"
      >
        🗑  Delete…
      </button>
    </div>
  );
}