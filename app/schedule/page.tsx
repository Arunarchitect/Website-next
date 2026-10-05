"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  demoSchedule,
  SEQUENCE_TYPES,
  type Sequence,
  type SequenceType,
  type Task,
} from "./data";
import {
  autoSchedule,
  durationDays,
  durationWorkdays,
  flatten,
  rollup,
  setDurationWithCalendar,
  todayISO,
  toDay,
  wouldCycle,
} from "./scheduling";
import {
  DAY,
  computeCpm,
  computeCpmWorkdays,
  daysUntil,
  describe,
  findCurrentAndNext,
  fmtDate,
  humanizeDaysUntil,
  upcomingQueue,
} from "./cpm";
import {
  deserialize,
  emptyCalendar,
  isHoliday,
  serialize,
  type SerializedCalendar,
  type WorkingCalendar,
} from "./calendar";
import { CalendarButton, CalendarChips, CalendarModal } from "./CalendarUI";
import { SearchAct } from "./SearchAct";
import { PrintAct } from "./PrintAct";
import ScheduleExport from "./ScheduleExport";
import {
  ActivityEditorModal,
  RowMenu,
  type MoveTarget,
  type RowMenuAction,
} from "./ActivityEditor";
import { useScheduleSync } from "./useScheduleSync";
import SyncBadge from "./SyncBadge";
import ScheduleImport from "./ScheduleImport";
import { listMyProjects, type MyProject } from "./api";

const ROW_H = 28;
const LEFT_COL_W = 256;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 80;
const SHOW_DAY_GRID_ABOVE = 6;
const SHOW_DAY_HEADER_ABOVE = 14;
const SHOW_WEEK_HEADER_ABOVE = 4;
const SHOW_WEEK_GRID_ABOVE = 4;
const MIN_MONTH_LABEL_W = 34;

const LINK_ARROW_GAP = 6;
const LINK_LANE_OFFSET = 4;

const HIGHLIGHT_MS = 2200;

const SEED = {
  tasks: demoSchedule.tasks,
  sequences: demoSchedule.sequences,
  calendar: serialize(emptyCalendar()),
};

const newId = (prefix = "a") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

const todayISOForNew = () => {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Read ?project= / ?schedule= from the URL (Next.js pages can't take custom props).
const readParam = (key: string): number | null => {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get(key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------- Searchable task picker ----------
type PickerMode = "pred" | "succ";

function TaskPicker({
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

// ---------- Org → Project → Schedule picker ----------
function SchedulePicker({
  projects,
  orgName,
  projectId,
  scheduleId,
  onPick,
}: {
  projects: MyProject[];
  orgName: string | null;
  projectId: number | null;
  scheduleId: number | null;
  onPick: (projectId: number, scheduleId: number | null) => void;
}) {
  const orgs = useMemo(() => {
    const m = new Map<string, MyProject[]>();
    for (const p of projects) {
      if (!m.has(p.organisation)) m.set(p.organisation, []);
      m.get(p.organisation)!.push(p);
    }
    return Array.from(m.entries());
  }, [projects]);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(orgName);

  useEffect(() => {
    setSelectedOrg(orgName);
  }, [orgName]);

  const visibleProjects = useMemo(
    () => projects.filter((p) => p.organisation === selectedOrg),
    [projects, selectedOrg]
  );

  const currentProject = visibleProjects.find((p) => p.id === projectId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={selectedOrg ?? ""}
        onChange={(e) => setSelectedOrg(e.target.value || null)}
        className="rounded border bg-white px-2 py-1.5"
        title="Organisation"
      >
        {orgs.map(([name]) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        value={projectId ?? ""}
        onChange={(e) => {
          const pid = Number(e.target.value);
          const p = projects.find((x) => x.id === pid);
          onPick(pid, p?.schedules[0]?.id ?? null);
        }}
        className="rounded border bg-white px-2 py-1.5"
        title="Project"
      >
        {visibleProjects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isCompleted ? " (completed)" : ""}
            {p.canEdit ? "" : " · read-only"}
          </option>
        ))}
      </select>

      {currentProject && currentProject.schedules.length > 1 && (
        <select
          value={scheduleId ?? ""}
          onChange={(e) => onPick(currentProject.id, Number(e.target.value))}
          className="rounded border bg-white px-2 py-1.5"
          title="Schedule"
        >
          {currentProject.schedules.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.predefinedType})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function ScheduleView() {
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<number | null>(() =>
    readParam("project")
  );
  const [scheduleId, setScheduleId] = useState<number | null>(() =>
    readParam("schedule")
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showCritical, setShowCritical] = useState(true);

  const [picker, setPicker] = useState<{ taskId: string; mode: PickerMode } | null>(
    null
  );

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const [nextIdx, setNextIdx] = useState(0);

  const [calendar, setCalendar] = useState<WorkingCalendar>(() => emptyCalendar());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [useWorkdays, setUseWorkdays] = useState(false);

  const calendarSer = useMemo(() => serialize(calendar), [calendar]);

  // ── Fetch the accessible project list once ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPickerLoading(true);
    setPickerError(null);
    listMyProjects()
      .then((rows) => {
        if (cancelled) return;
        setMyProjects(rows);
        if (projectId == null && rows.length > 0) {
          const first = rows[0];
          setProjectId(first.id);
          setScheduleId(first.schedules[0]?.id ?? null);
        } else if (projectId != null && scheduleId == null) {
          const p = rows.find((r) => r.id === projectId);
          if (p) setScheduleId(p.schedules[0]?.id ?? null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setPickerError(e instanceof Error ? e.message : "Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror selection into the URL for deep-linking.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (projectId == null) return;
    const q = new URLSearchParams(window.location.search);
    q.set("project", String(projectId));
    if (scheduleId != null) q.set("schedule", String(scheduleId));
    else q.delete("schedule");
    const next = `${window.location.pathname}?${q.toString()}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", next);
    }
  }, [projectId, scheduleId]);

  // ---------- backend sync ----------
  const sync = useScheduleSync({
    projectId,
    scheduleId,
    seed: SEED,
    tasks,
    sequences,
    calendar: calendarSer,
    onLoaded: (d) => {
      setTasks(d.tasks);
      setSequences(d.sequences);
      if (d.calendar) setCalendar(deserialize(d.calendar as SerializedCalendar));
    },
  });

  const currentProject = myProjects.find((p) => p.id === projectId) ?? null;
  const projectRole = currentProject?.role ?? null;
  const isViewOnly = projectRole === "member" || projectRole === "manager";
  const readOnly = isViewOnly || !sync.canEdit;
  const ready = !["loading", "empty", "failed"].includes(sync.status);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(1000);

  useEffect(() => {
    if (!ready) return;
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!menuFor) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-row-menu]")) return;
      setMenuFor(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuFor]);

  // ---------- derived ----------
  const rolled = useMemo(() => rollup(tasks), [tasks]);
  const rows = useMemo(() => flatten(rolled, collapsed), [rolled, collapsed]);

  const { minDay, maxDay } = useMemo(() => {
    if (!rolled.length) return { minDay: 0, maxDay: 0 };
    const starts = rolled.map((t) => toDay(t.scheduleStart));
    const finishes = rolled.map((t) => toDay(t.scheduleFinish));
    return { minDay: Math.min(...starts), maxDay: Math.max(...finishes) };
  }, [rolled]);
  const totalDays = Math.max(1, maxDay - minDay + 1);

  const today = todayISO();
  const todayDay = toDay(today);
  const todayInRange = todayDay >= minDay && todayDay <= maxDay;

  const cpm = useMemo(
    () =>
      useWorkdays
        ? computeCpmWorkdays(tasks, sequences, calendar)
        : computeCpm(tasks, sequences),
    [tasks, sequences, useWorkdays, calendar]
  );

  const { current, next: nextAuto } = useMemo(
    () => findCurrentAndNext(tasks, cpm, todayDay),
    [tasks, cpm, todayDay]
  );

  const upcoming = useMemo(
    () => upcomingQueue(tasks, cpm, todayDay),
    [tasks, cpm, todayDay]
  );
  useEffect(() => {
    setNextIdx((i) => Math.min(Math.max(0, i), Math.max(0, upcoming.length - 1)));
  }, [upcoming.length]);

  const next = upcoming[nextIdx] ?? nextAuto;

  const fitZoom = useMemo(() => {
    const usable = Math.max(120, containerW - 24);
    return Math.max(ZOOM_MIN, usable / totalDays);
  }, [containerW, totalDays]);

  useEffect(() => {
    if (autoFit) setZoom(fitZoom);
  }, [autoFit, fitZoom]);

  const ganttWidth = Math.max(totalDays * zoom, containerW);
  const ganttBodyHeight = rows.length * ROW_H;

  const showDayGrid = zoom >= SHOW_DAY_GRID_ABOVE;
  const showWeekGrid = zoom >= SHOW_WEEK_GRID_ABOVE;
  const showWeekHeader = zoom >= SHOW_WEEK_HEADER_ABOVE;
  const showDayHeader = zoom >= SHOW_DAY_HEADER_ABOVE;

  const months = useMemo(() => {
    const out: { label: string; short: string; days: number; px: number }[] = [];
    let d = minDay;
    while (d <= maxDay) {
      const date = new Date(d * DAY);
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const monthStart = Math.round(Date.UTC(y, m, 1) / DAY);
      const monthEnd = Math.round(Date.UTC(y, m, daysInMonth) / DAY);
      const segStart = Math.max(minDay, monthStart);
      const segEnd = Math.min(maxDay, monthEnd);
      out.push({
        label: date.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        short: date.toLocaleString("en-US", {
          month: "short",
          timeZone: "UTC",
        }),
        days: segEnd - segStart + 1,
        px: (segEnd - segStart + 1) * zoom,
      });
      d = segEnd + 1;
    }
    return out;
  }, [minDay, maxDay, zoom]);

  const weeks = useMemo(() => {
    const out: { label: string; days: number; px: number }[] = [];
    let d = minDay;
    while (d <= maxDay) {
      const date = new Date(d * DAY);
      const dow = date.getUTCDay();
      const daysToMonday = (dow + 6) % 7;
      const weekStart = d - daysToMonday;
      const weekEnd = weekStart + 6;
      const segStart = Math.max(minDay, weekStart);
      const segEnd = Math.min(maxDay, weekEnd);
      out.push({
        label: `W${isoWeek(new Date(weekStart * DAY))}`,
        days: segEnd - segStart + 1,
        px: (segEnd - segStart + 1) * zoom,
      });
      d = segEnd + 1;
    }
    return out;
  }, [minDay, maxDay, zoom]);

  // ---------- helpers ----------
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runAutoSchedule = () => setTasks((prev) => autoSchedule(prev, sequences));

  const updateCompletion = (id: string, completion: number) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completion: Math.max(0, Math.min(100, completion)) }
          : t
      )
    );

  const updateDates = (id: string, start: string, finish: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
            ...t,
            scheduleStart: start,
            scheduleFinish: finish < start ? start : finish,
          }
          : t
      )
    );

  const updateDuration = (id: string, newDays: number) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? setDurationWithCalendar(
            t,
            newDays,
            useWorkdays ? calendar : undefined
          )
          : t
      )
    );

  const predecessorsOf = (id: string) =>
    sequences.filter((s) => s.relatedTask === id);
  const successorsOf = (id: string) =>
    sequences.filter((s) => s.relatingTask === id);

  const handlePick = (anchorId: string, mode: PickerMode, otherId: string) => {
    const predId = mode === "pred" ? otherId : anchorId;
    const succId = mode === "pred" ? anchorId : otherId;
    if (wouldCycle(sequences, predId, succId)) {
      alert("That would create a cycle.");
      return;
    }
    setSequences((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        relatingTask: predId,
        relatedTask: succId,
        sequenceType: "FINISH_START",
        lagDays: 0,
      },
    ]);
    setPicker(null);
  };

  const updateSequence = (id: string, patch: Partial<Sequence>) =>
    setSequences((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );

  const removeSequence = (id: string) =>
    setSequences((prev) => prev.filter((s) => s.id !== id));

  const rowIndexById = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.task.id, i));
    return m;
  }, [rows]);

  // ---------- CRUD ----------
  const addChild = (parentId: string | null) => {
    const d = todayISOForNew();
    const id = newId(parentId ? "a" : "g");
    const siblingCount = tasks.filter((t) => t.parentId === parentId).length;
    const isRootGroup = parentId === null;
    const newTask: Task = {
      id,
      name: isRootGroup ? `New phase ${siblingCount + 1}` : "New activity",
      parentId,
      scheduleStart: d,
      scheduleFinish: d,
      completion: 0,
      isMilestone: false,
    };
    setTasks((prev) => [...prev, newTask]);
    if (parentId) {
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(parentId);
        return n;
      });
    }
    setEditingId(id);
    setSelectedId(id);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), HIGHLIGHT_MS);
  };

  const addSibling = (anchor: Task) => addChild(anchor.parentId ?? null);

  const deleteTask = (id: string) => {
    const toRemove = new Set<string>([id]);
    const stack = [id];
    while (stack.length) {
      const x = stack.pop()!;
      for (const t of tasks) {
        if (t.parentId === x && !toRemove.has(t.id)) {
          toRemove.add(t.id);
          stack.push(t.id);
        }
      }
    }
    setTasks((prev) => prev.filter((t) => !toRemove.has(t.id)));
    setSequences((prev) =>
      prev.filter(
        (s) => !toRemove.has(s.relatingTask) && !toRemove.has(s.relatedTask)
      )
    );
    setSelectedId((cur) => (cur && toRemove.has(cur) ? null : cur));
    setFlashId((cur) => (cur && toRemove.has(cur) ? null : cur));
    setPicker((cur) => (cur && toRemove.has(cur.taskId) ? null : cur));
    setMenuFor((cur) => (cur && toRemove.has(cur) ? null : cur));
    setEditingId((cur) => (cur && toRemove.has(cur) ? null : cur));
  };

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const moveTask = (id: string, target: MoveTarget) => {
    const newParent = target.kind === "root" ? null : target.id;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, parentId: newParent } : t))
    );
    if (newParent) {
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(newParent);
        return n;
      });
    }
    setSelectedId(id);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), HIGHLIGHT_MS);
  };

  useEffect(() => {
    if (selectedId && !tasks.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [tasks, selectedId]);

  // ---------- selection ----------
  const expandAncestors = (ids: string[]) => {
    if (!ids.length) return;
    setCollapsed((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  };

  const handleSelectFromSearch = (id: string) => {
    setSelectedId(id);
    setFlashId(id);
    setTimeout(() => {
      const el = document.getElementById(`row-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    setTimeout(() => {
      setFlashId((cur) => (cur === id ? null : cur));
    }, HIGHLIGHT_MS);
  };

  const handleRowClick = (id: string, isGroup: boolean) => {
    setSelectedId(id);
    if (isGroup) toggleCollapse(id);
  };

  const jumpToTask = (id: string) => handleSelectFromSearch(id);

  // ---------- link geometry ----------
  const links = useMemo(() => {
    const out: {
      id: string;
      path: string;
      critical: boolean;
      dotX: number;
      dotY: number;
    }[] = [];
    for (const s of sequences) {
      const pi = rowIndexById.get(s.relatingTask);
      const si = rowIndexById.get(s.relatedTask);
      if (pi === undefined || si === undefined) continue;
      const p = rolled.find((t) => t.id === s.relatingTask);
      const q = rolled.find((t) => t.id === s.relatedTask);
      if (!p || !q) continue;

      const pLeft = (toDay(p.scheduleStart) - minDay) * zoom;
      const pRight = (toDay(p.scheduleFinish) - minDay + 1) * zoom;
      const qLeft = (toDay(q.scheduleStart) - minDay) * zoom;
      const qRight = (toDay(q.scheduleFinish) - minDay + 1) * zoom;
      const y1 = pi * ROW_H + ROW_H / 2;
      const y2 = si * ROW_H + ROW_H / 2;

      const pIsStart =
        s.sequenceType === "START_START" || s.sequenceType === "START_FINISH";
      const qIsStart =
        s.sequenceType === "START_START" || s.sequenceType === "FINISH_START";

      const x1 = pIsStart ? pLeft - LINK_ARROW_GAP : pRight + LINK_ARROW_GAP;
      const x2 = qIsStart ? qLeft - LINK_ARROW_GAP : qRight + LINK_ARROW_GAP;

      const critical =
        cpm.criticalIds.has(s.relatingTask) &&
        cpm.criticalIds.has(s.relatedTask);

      let path: string;
      if (x2 >= x1) {
        const midX = x1 + Math.max(8, (x2 - x1) / 2);
        path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
      } else {
        const laneY = si * ROW_H - LINK_LANE_OFFSET;
        path =
          `M ${x1} ${y1} ` +
          `H ${x1 + 8} ` +
          `V ${laneY} ` +
          `H ${x2 - 8} ` +
          `V ${y2} ` +
          `H ${x2}`;
      }
      out.push({ id: s.id, path, critical, dotX: x2, dotY: y2 });
    }
    return out;
  }, [sequences, rowIndexById, rolled, minDay, zoom, cpm]);

  // ---------- load gates (ALL hooks are above this line) ----------
  if (pickerError) {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm">
        <p className="mb-2 text-red-600">
          Couldn&apos;t load your projects: {pickerError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded border px-3 py-1.5 hover:bg-gray-50"
        >
          Retry
        </button>
      </main>
    );
  }

  if (pickerLoading && myProjects.length === 0) {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm text-gray-500">
        Loading your projects…
      </main>
    );
  }

  if (!pickerLoading && myProjects.length === 0) {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm text-gray-500">
        You don&apos;t have access to any projects yet. Ask your organisation
        admin to add you to a project.
      </main>
    );
  }

  if (projectId == null) {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm text-gray-500">
        Pick a project to view its schedule.
      </main>
    );
  }

  if (sync.status === "loading") {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm text-gray-500">
        Loading schedule…
      </main>
    );
  }
  if (sync.status === "empty") {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm text-gray-500">
        No schedule has been created for this project yet.
      </main>
    );
  }
  if (sync.status === "failed") {
    return (
      <main className="mx-auto max-w-[1600px] p-6 text-sm">
        <p className="mb-2 text-red-600">
          Couldn&apos;t load the schedule{sync.message ? `: ${sync.message}` : "."}
        </p>
        <button
          onClick={sync.reload}
          className="rounded border px-3 py-1.5 hover:bg-gray-50"
        >
          Retry
        </button>
      </main>
    );
  }

  const rangeFor = (t: Task) => {
    const es = cpm.earlyStart.get(t.id) ?? toDay(t.scheduleStart);
    const ef = cpm.earlyFinish.get(t.id) ?? toDay(t.scheduleFinish);
    return { es, ef, dur: ef - es + 1 };
  };

  const criticalCount = cpm.criticalIds.size;
  const criticalDuration = cpm.projectFinish - cpm.projectStart + 1;

  const editingTask = editingId
    ? tasks.find((t) => t.id === editingId) ?? null
    : null;

  const handleRowAction = (task: Task, action: RowMenuAction) => {
    switch (action.kind) {
      case "edit":
        setEditingId(task.id);
        break;
      case "addChild":
        addChild(task.id);
        break;
      case "addSibling":
        addSibling(task);
        break;
      case "delete":
        if (
          window.confirm(
            `Delete "${task.name}" and everything under it? This cannot be undone.`
          )
        ) {
          deleteTask(task.id);
        }
        break;
      case "move":
        moveTask(task.id, action.target);
        break;
    }
  };

  const nextDays = next ? daysUntil(next, cpm, todayDay) : 0;
  const nextCountdownClass =
    nextDays <= 0
      ? "bg-red-100 text-red-700 ring-red-200"
      : nextDays <= 2
        ? "bg-red-100 text-red-700 ring-red-200"
        : nextDays <= 7
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-gray-100 text-gray-700 ring-gray-200";

  const hasNextQueue = upcoming.length > 1;

  const currentScheduleMeta = currentProject?.schedules.find(
    (s) => s.id === scheduleId
  );
  const heading = currentScheduleMeta?.name ?? currentProject?.name ?? demoSchedule.name;

  return (
    <main className="mx-auto max-w-[1600px] p-6">
      {/* ================= HEADER ================= */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{heading}</h1>
          <p className="text-sm text-gray-500">
            {fmtDate(cpm.projectStart)} → {fmtDate(cpm.projectFinish)} ·{" "}
            {criticalDuration} days total · {criticalCount} critical activities
            {useWorkdays && " · working-day mode"}
            {isViewOnly && " · view-only"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-print-hide>
          <SchedulePicker
            projects={myProjects}
            orgName={currentProject?.organisation ?? null}
            projectId={projectId}
            scheduleId={scheduleId}
            onPick={(pid, sid) => {
              setProjectId(pid);
              setScheduleId(sid);
            }}
          />

          <SyncBadge
            status={sync.status}
            savedAt={sync.savedAt}
            message={sync.message}
            onRetry={sync.saveNow}
            onReload={sync.reload}
          />
          <SearchAct
            tasks={tasks}
            onSelect={handleSelectFromSearch}
            onExpand={expandAncestors}
          />
          {!readOnly && (
            <CalendarButton
              calendar={calendar}
              onOpen={() => setCalendarOpen(true)}
            />
          )}
          <label
            className="flex items-center gap-1.5 rounded border bg-white px-2 py-1.5 text-xs text-gray-700"
            title="Use the working calendar for durations, CPM, and holiday shading"
          >
            <input
              type="checkbox"
              checked={useWorkdays}
              onChange={(e) => setUseWorkdays(e.target.checked)}
            />
            Working days
          </label>
          <PrintAct tasks={tasks} />
          {!readOnly && (
            <ScheduleImport
              scheduleId={scheduleId}
              canEdit={!readOnly}
              onImported={(doc) => {
                setTasks(doc.tasks);
                setSequences(doc.sequences);
                const cal = doc.calendar
                  ? deserialize(doc.calendar as SerializedCalendar)
                  : emptyCalendar();
                setCalendar(cal);
                sync.setVersion(doc.version);
                sync.markSaved({
                  tasks: doc.tasks,
                  sequences: doc.sequences,
                  calendar: serialize(cal),
                });
              }}
            />
          )}
          <ScheduleExport
            tasks={tasks}
            sequences={sequences}
            calendar={calendarSer}
          />
          {!readOnly && (
            <button
              onClick={() => addChild(null)}
              className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
              title="Create a new top-level phase"
            >
              + New phase
            </button>
          )}
          <button
            onClick={() => setCollapsed(new Set())}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Expand all
          </button>
          <button
            onClick={() => setCollapsed(new Set(rolled.map((t) => t.id)))}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Collapse all
          </button>
          {!readOnly && (
            <button
              onClick={runAutoSchedule}
              className="rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
            >
              Auto-schedule
            </button>
          )}
        </div>
      </header>

      {useWorkdays && (
        <div className="mb-3" data-print-hide>
          <CalendarChips calendar={calendar} />
        </div>
      )}

      {/* ================= NOW / NEXT STRIP ================= */}
      <section className="mb-4 grid gap-3 md:grid-cols-2">
        <div
          className={`rounded border-l-4 p-3 ${current
              ? "border-blue-500 bg-blue-50/60"
              : "border-gray-300 bg-gray-50"
            }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <span
              className={`h-2 w-2 rounded-full ${current ? "bg-blue-500 animate-pulse" : "bg-gray-400"
                }`}
            />
            Now
          </div>
          {current ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold text-gray-900">
                  {current.name}
                </span>
                {cpm.criticalIds.has(current.id) && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                    CRITICAL
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                {fmtDate(rangeFor(current).es)} → {fmtDate(rangeFor(current).ef)}
                {" · "}
                {rangeFor(current).dur} days · {current.completion}% complete
              </div>
              <p className="mt-1 text-xs text-gray-700">
                {describe(current, tasks)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              No activity scheduled for {fmtDate(todayDay)}.
            </p>
          )}
        </div>

        <div
          className={`rounded border-l-4 p-3 ${next
              ? "border-emerald-500 bg-emerald-50/60"
              : "border-gray-300 bg-gray-50"
            }`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <span
                className={`h-2 w-2 rounded-full ${next ? "bg-emerald-500" : "bg-gray-400"
                  }`}
              />
              Next up
              {upcoming.length > 0 && (
                <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200">
                  {Math.min(nextIdx + 1, upcoming.length)} / {upcoming.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setNextIdx((i) => Math.max(0, i - 1))}
                disabled={nextIdx === 0}
                className="flex h-6 w-6 items-center justify-center rounded border bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Previous upcoming activity"
              >
                ◀
              </button>
              <button
                onClick={() =>
                  setNextIdx((i) => Math.min(upcoming.length - 1, i + 1))
                }
                disabled={!hasNextQueue || nextIdx >= upcoming.length - 1}
                className="flex h-6 w-6 items-center justify-center rounded border bg-white text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Next upcoming activity"
              >
                ▶
              </button>
            </div>
          </div>

          {next ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold text-gray-900">
                  {next.name}
                </span>
                {cpm.criticalIds.has(next.id) && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                    CRITICAL
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${nextCountdownClass}`}
                  title={`Early start: ${fmtDate(rangeFor(next).es)}`}
                >
                  {humanizeDaysUntil(nextDays)}
                </span>
              </div>

              <div className="mt-0.5 text-xs text-gray-600">
                Starts {fmtDate(rangeFor(next).es)} · runs{" "}
                {rangeFor(next).dur} days · ends {fmtDate(rangeFor(next).ef)}
              </div>

              <p className="mt-1 text-xs text-gray-700">
                {describe(next, tasks)}
              </p>

              <div className="mt-2 flex items-center gap-2" data-print-hide>
                <button
                  onClick={() => jumpToTask(next.id)}
                  className="rounded border bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                  title="Scroll to and highlight this activity"
                >
                  Jump to activity →
                </button>
                {hasNextQueue && (
                  <button
                    onClick={() =>
                      setNextIdx((i) => Math.min(upcoming.length - 1, i + 1))
                    }
                    disabled={nextIdx >= upcoming.length - 1}
                    className="rounded bg-emerald-600 px-2 py-1 text-[11px] text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Show the following upcoming activity"
                  >
                    Next activity ▶
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">All activities complete.</p>
          )}
        </div>
      </section>

      {/* ================= ZOOM BAR ================= */}
      <div
        className="mb-3 flex flex-wrap items-center gap-3 rounded border bg-gray-50 px-3 py-2 text-sm"
        data-print-hide
      >
        <span className="font-medium text-gray-700">Timeline</span>

        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={autoFit}
            onChange={(e) => setAutoFit(e.target.checked)}
          />
          Fit to width
        </label>

        <div
          className={`flex items-center gap-1 ${autoFit ? "opacity-50" : ""}`}
          title={autoFit ? "Uncheck 'Fit to width' to zoom manually" : ""}
        >
          <button
            disabled={autoFit}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.5))}
            className="rounded border bg-white px-2 py-1 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            type="range"
            min={Math.log(ZOOM_MIN)}
            max={Math.log(ZOOM_MAX)}
            step={0.01}
            value={Math.log(zoom)}
            disabled={autoFit}
            onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
            className="w-40"
          />
          <button
            disabled={autoFit}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.5))}
            className="rounded border bg-white px-2 py-1 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        <span className="tabular-nums text-xs text-gray-500">
          {zoom >= 1
            ? `${zoom.toFixed(1)} px/day`
            : `${(1 / zoom).toFixed(1)} day/px`}
        </span>

        <span className="mx-1 h-4 w-px bg-gray-300" />

        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={showLinks}
            onChange={(e) => setShowLinks(e.target.checked)}
          />
          Show links
        </label>

        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={showCritical}
            onChange={(e) => setShowCritical(e.target.checked)}
          />
          Highlight critical path
        </label>

        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
          {showDayHeader
            ? "Detail: days"
            : showWeekHeader
              ? "Detail: weeks"
              : "Detail: months"}
        </span>
      </div>

      {/* ================= GANTT ================= */}
      <section className="mb-8 rounded border">
        <div className="flex">
          <div
            className="shrink-0 border-r bg-white"
            style={{ width: LEFT_COL_W }}
          >
            <div className="flex h-10 items-center border-b px-3 text-xs font-semibold text-gray-500">
              Task
            </div>
            <div>
              {rows.map(({ task, depth, hasChildren }) => {
                const isCollapsed = collapsed.has(task.id);
                const critical = cpm.criticalIds.has(task.id);
                const selected = selectedId === task.id;
                const flash = flashId === task.id;
                return (
                  <div
                    key={task.id}
                    id={`row-${task.id}`}
                    onClick={() => handleRowClick(task.id, hasChildren)}
                    className={`flex cursor-pointer items-center gap-1 truncate px-2 text-xs transition-colors ${selected
                        ? "bg-blue-100 ring-1 ring-inset ring-blue-300"
                        : "hover:bg-gray-50"
                      } ${flash ? "animate-pulse" : ""}`}
                    style={{ height: ROW_H, paddingLeft: 8 + depth * 14 }}
                  >
                    {hasChildren ? (
                      <span
                        className="w-3 text-gray-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(task.id);
                        }}
                      >
                        {isCollapsed ? "▶" : "▼"}
                      </span>
                    ) : (
                      <span className="w-3" />
                    )}
                    {!hasChildren && critical && showCritical && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                        title={`Critical · float ${cpm.totalFloat.get(task.id) ?? 0
                          }d`}
                      />
                    )}
                    <span
                      className={`truncate ${hasChildren ? "font-semibold" : ""
                        }`}
                      title={task.name}
                    >
                      {task.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-x-auto">
            <div style={{ width: ganttWidth }}>
              <div className="border-b bg-gray-50">
                <div className="flex h-5 text-[10px] text-gray-700">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="overflow-hidden whitespace-nowrap border-r px-2 leading-5"
                      style={{ width: m.days * zoom }}
                      title={m.label}
                    >
                      {m.px >= MIN_MONTH_LABEL_W ? m.label : m.short}
                    </div>
                  ))}
                </div>
                {showWeekHeader && (
                  <div className="flex h-5 border-t text-[10px] text-gray-500">
                    {weeks.map((w, i) => (
                      <div
                        key={i}
                        className="overflow-hidden whitespace-nowrap border-r px-1 leading-5"
                        style={{ width: w.days * zoom }}
                      >
                        {w.px > 26 ? w.label : ""}
                      </div>
                    ))}
                  </div>
                )}
                {showDayHeader && (
                  <div className="flex h-5 border-t text-[9px] text-gray-500">
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const d = new Date((minDay + i) * DAY);
                      const isWeekend =
                        d.getUTCDay() === 0 || d.getUTCDay() === 6;
                      const holiday =
                        useWorkdays && isHoliday(minDay + i, calendar);
                      return (
                        <div
                          key={i}
                          className={`overflow-hidden border-r text-center leading-5 ${holiday
                              ? "bg-pink-100"
                              : isWeekend
                                ? "bg-gray-100"
                                : ""
                            }`}
                          style={{ width: zoom }}
                          title={holiday ? "Holiday" : undefined}
                        >
                          {zoom >= 12 ? d.getUTCDate() : ""}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="relative" style={{ height: ganttBodyHeight }}>
                <div className="absolute inset-0 flex">
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const dayNum = minDay + i;
                    const d = new Date(dayNum * DAY);
                    const isWeekend =
                      d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    const holiday = useWorkdays && isHoliday(dayNum, calendar);
                    return (
                      <div
                        key={i}
                        className={`h-full ${holiday
                            ? "bg-pink-50"
                            : isWeekend
                              ? "bg-gray-50"
                              : ""
                          } ${showDayGrid ? "border-r" : ""}`}
                        style={{ width: zoom }}
                      />
                    );
                  })}
                </div>

                {showWeekGrid &&
                  weeks.map((w, i) => {
                    const leftDays = weeks
                      .slice(0, i)
                      .reduce((a, x) => a + x.days, 0);
                    return (
                      <div
                        key={i}
                        className="pointer-events-none absolute top-0 h-full border-l border-gray-300/60"
                        style={{ left: leftDays * zoom }}
                      />
                    );
                  })}

                {months.map((m, i) => {
                  const leftDays = months
                    .slice(0, i)
                    .reduce((a, x) => a + x.days, 0);
                  return (
                    <div
                      key={i}
                      className="pointer-events-none absolute top-0 h-full border-l border-gray-400/70"
                      style={{ left: leftDays * zoom }}
                    />
                  );
                })}

                {todayInRange && (
                  <div
                    className="pointer-events-none absolute top-0 z-20 h-full w-px bg-red-500"
                    style={{ left: (todayDay - minDay) * zoom }}
                    title={`Today · ${today}`}
                  >
                    <div className="absolute -top-0.5 -translate-x-1/2 rounded bg-red-500 px-1 text-[9px] leading-tight text-white">
                      today
                    </div>
                  </div>
                )}

                {rows.map(({ task }, i) => {
                  const selected = selectedId === task.id;
                  const flash = flashId === task.id;
                  if (!selected && !flash) return null;
                  return (
                    <div
                      key={`hl-${task.id}`}
                      className={`pointer-events-none absolute left-0 right-0 ${selected ? "bg-blue-100/60" : ""
                        } ${flash ? "bg-yellow-200/40 animate-pulse" : ""}`}
                      style={{ top: i * ROW_H, height: ROW_H }}
                    />
                  );
                })}

                {showLinks && (
                  <svg
                    className="pointer-events-none absolute inset-0"
                    width={ganttWidth}
                    height={ganttBodyHeight}
                  >
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
                      </marker>
                      <marker
                        id="arrowCrit"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
                      </marker>
                    </defs>
                    {links.map((l) => {
                      const isCrit = l.critical && showCritical;
                      return (
                        <path
                          key={l.id}
                          d={l.path}
                          fill="none"
                          stroke={isCrit ? "#dc2626" : "#9ca3af"}
                          strokeWidth={isCrit ? 1.75 : 1}
                          strokeOpacity={isCrit ? 1 : 0.7}
                          markerEnd={
                            isCrit ? "url(#arrowCrit)" : "url(#arrow)"
                          }
                        />
                      );
                    })}
                  </svg>
                )}

                {rows.map(({ task, hasChildren }, i) => {
                  const s = toDay(task.scheduleStart) - minDay;
                  const dur = durationDays(task);
                  const w = Math.max(
                    task.isMilestone ? 6 : 2,
                    dur * zoom - (task.isMilestone ? 0 : 2)
                  );
                  const critical = !hasChildren && cpm.criticalIds.has(task.id);
                  const selected = selectedId === task.id;
                  const barColor = hasChildren
                    ? "bg-gray-800"
                    : task.isMilestone
                      ? "bg-amber-500"
                      : critical && showCritical
                        ? "bg-red-500"
                        : "bg-blue-500";
                  const innerColor =
                    critical && showCritical ? "bg-red-700" : "bg-blue-700";
                  const durLabel =
                    useWorkdays && !hasChildren
                      ? `${durationWorkdays(task, calendar)} working days`
                      : `${dur}d`;
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleRowClick(task.id, !!hasChildren)}
                      className={`absolute h-3 cursor-pointer rounded ${barColor} z-10 ${selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
                        }`}
                      style={{ left: s * zoom, top: i * ROW_H + 8, width: w }}
                      title={`${task.name}\n${task.scheduleStart} → ${task.scheduleFinish
                        } · ${durLabel}${task.completion > 0 ? ` · ${task.completion}%` : ""
                        }${critical
                          ? `\nCRITICAL · float ${cpm.totalFloat.get(task.id) ?? 0
                          }d`
                          : ""
                        }`}
                    >
                      {!hasChildren &&
                        !task.isMilestone &&
                        task.completion > 0 && (
                          <div
                            className={`h-full rounded ${innerColor}`}
                            style={{ width: `${task.completion}%` }}
                          />
                        )}
                    </div>
                  );
                })}

                {showLinks && showCritical && (
                  <svg
                    className="pointer-events-none absolute inset-0 z-20"
                    width={ganttWidth}
                    height={ganttBodyHeight}
                  >
                    <defs>
                      <marker
                        id="arrowCritTop"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
                      </marker>
                    </defs>
                    {links
                      .filter((l) => l.critical)
                      .map((l) => (
                        <path
                          key={`crit-${l.id}`}
                          d={l.path}
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth={1.75}
                          markerEnd="url(#arrowCritTop)"
                        />
                      ))}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TABLE ================= */}
      <section className="overflow-x-auto rounded border">
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="w-10 px-2 py-2"></th>
              <th className="w-12 px-2 py-2">#</th>
              <th className="min-w-[200px] px-2 py-2">Task</th>
              <th className="w-28 px-2 py-2">Start</th>
              <th className="w-28 px-2 py-2">Finish</th>
              <th
                className="w-24 px-2 py-2"
                title={
                  useWorkdays
                    ? "Duration in working days (editable)"
                    : "Duration in calendar days (editable)"
                }
              >
                Dur
              </th>
              <th className="w-16 px-2 py-2" title="Total float (days)">
                Float
              </th>
              <th className="w-24 px-2 py-2">%</th>
              <th className="w-64 px-2 py-2">Predecessors</th>
              <th className="w-64 px-2 py-2">Successors</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ task, depth, hasChildren, wbs }) => {
              const dur =
                useWorkdays && !hasChildren
                  ? durationWorkdays(task, calendar)
                  : durationDays(task);
              const isGroup = hasChildren;
              const preds = predecessorsOf(task.id);
              const succs = successorsOf(task.id);
              const critical = !isGroup && cpm.criticalIds.has(task.id);
              const float = cpm.totalFloat.get(task.id);
              const isPickerOpen = picker?.taskId === task.id;
              const selected = selectedId === task.id;
              const flash = flashId === task.id;
              const isMenuOpen = menuFor === task.id;
              return (
                <tr
                  key={task.id}
                  id={`row-${task.id}`}
                  onClick={() => handleRowClick(task.id, !!hasChildren)}
                  className={`cursor-pointer border-t transition-colors ${selected
                      ? "bg-blue-100"
                      : critical && showCritical
                        ? "bg-red-50/40 hover:bg-red-50/70"
                        : "hover:bg-gray-50"
                    } ${flash ? "animate-pulse" : ""}`}
                >
                  <td
                    className="relative px-1 py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!readOnly && (
                      <button
                        onClick={() => setMenuFor(isMenuOpen ? null : task.id)}
                        className="rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        title="Row actions"
                        data-row-menu
                      >
                        ⋯
                      </button>
                    )}
                    {!readOnly && isMenuOpen && (
                      <div data-row-menu>
                        <RowMenu
                          task={task}
                          tasks={tasks}
                          onAction={(a) => handleRowAction(task, a)}
                          onClose={() => setMenuFor(null)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs text-gray-500">
                    {wbs}
                  </td>
                  <td className="px-2 py-1.5">
                    <div
                      className="flex items-center gap-1"
                      style={{ paddingLeft: depth * 16 }}
                    >
                      {hasChildren ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(task.id);
                          }}
                          className="w-4 text-xs text-gray-500"
                        >
                          {collapsed.has(task.id) ? "▶" : "▼"}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      {critical && showCritical && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      )}
                      <span className={isGroup ? "font-semibold" : ""}>
                        {task.name}
                      </span>
                      {task.isMilestone && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                          MILESTONE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={task.scheduleStart}
                      disabled={isGroup || readOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateDates(task.id, e.target.value, task.scheduleFinish)
                      }
                      className="w-full rounded border px-1 py-0.5 text-xs disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={task.scheduleFinish}
                      disabled={isGroup || readOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateDates(task.id, task.scheduleStart, e.target.value)
                      }
                      className="w-full rounded border px-1 py-0.5 text-xs disabled:bg-gray-100"
                    />
                  </td>

                  <td
                    className="px-2 py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isGroup ? (
                      <span className="block text-right tabular-nums text-xs text-gray-600">
                        {dur}d
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-0.5">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={dur}
                          disabled={readOnly}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isFinite(v)) return;
                            updateDuration(task.id, v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-14 rounded border px-1 py-0.5 text-right text-xs tabular-nums disabled:bg-gray-100"
                          title={
                            useWorkdays
                              ? "Change duration — finish date shifts by working days"
                              : "Change duration — finish date shifts by calendar days"
                          }
                        />
                        <span className="text-[10px] text-gray-500">d</span>
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-1.5 text-right tabular-nums text-xs text-gray-600">
                    {!isGroup && float !== undefined ? `${float}d` : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={task.completion}
                        disabled={isGroup || readOnly}
                        onChange={(e) =>
                          updateCompletion(task.id, Number(e.target.value))
                        }
                        className="w-14"
                      />
                      <span className="w-9 text-right tabular-nums text-xs">
                        {task.completion}%
                      </span>
                    </div>
                  </td>

                  <td
                    className="relative px-2 py-1.5 align-top"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1">
                      {preds.map((s) => {
                        const pred = tasks.find(
                          (t) => t.id === s.relatingTask
                        );
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs"
                          >
                            <span
                              className="truncate font-medium"
                              title={pred?.name}
                            >
                              {pred?.name ?? s.relatingTask}
                            </span>
                            <select
                              value={s.sequenceType}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateSequence(s.id, {
                                  sequenceType: e.target.value as SequenceType,
                                })
                              }
                              className="rounded border text-[10px]"
                            >
                              {SEQUENCE_TYPES.map((st) => (
                                <option key={st.value} value={st.value}>
                                  {st.short}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={s.lagDays}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateSequence(s.id, {
                                  lagDays: Number(e.target.value),
                                })
                              }
                              className="w-10 rounded border text-[10px]"
                            />
                            {!readOnly && (
                              <button
                                onClick={() => removeSequence(s.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!isGroup && !readOnly && (
                        <button
                          onClick={() =>
                            setPicker(
                              isPickerOpen && picker.mode === "pred"
                                ? null
                                : { taskId: task.id, mode: "pred" }
                            )
                          }
                          className="self-start rounded border border-dashed px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50"
                        >
                          + predecessor
                        </button>
                      )}
                    </div>
                    {!isGroup && !readOnly && isPickerOpen && picker.mode === "pred" && (
                      <TaskPicker
                        mode="pred"
                        anchorTask={task}
                        allTasks={tasks}
                        sequences={sequences}
                        onPick={(otherId) =>
                          handlePick(task.id, "pred", otherId)
                        }
                        onClose={() => setPicker(null)}
                      />
                    )}
                  </td>

                  <td
                    className="relative px-2 py-1.5 align-top"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1">
                      {succs.map((s) => {
                        const succ = tasks.find(
                          (t) => t.id === s.relatedTask
                        );
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs"
                          >
                            <span
                              className="truncate font-medium"
                              title={succ?.name}
                            >
                              {succ?.name ?? s.relatedTask}
                            </span>
                            <select
                              value={s.sequenceType}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateSequence(s.id, {
                                  sequenceType: e.target.value as SequenceType,
                                })
                              }
                              className="rounded border text-[10px]"
                            >
                              {SEQUENCE_TYPES.map((st) => (
                                <option key={st.value} value={st.value}>
                                  {st.short}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={s.lagDays}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateSequence(s.id, {
                                  lagDays: Number(e.target.value),
                                })
                              }
                              className="w-10 rounded border text-[10px]"
                            />
                            {!readOnly && (
                              <button
                                onClick={() => removeSequence(s.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!isGroup && !readOnly && (
                        <button
                          onClick={() =>
                            setPicker(
                              isPickerOpen && picker.mode === "succ"
                                ? null
                                : { taskId: task.id, mode: "succ" }
                            )
                          }
                          className="self-start rounded border border-dashed px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-50"
                        >
                          + successor
                        </button>
                      )}
                    </div>
                    {!isGroup && !readOnly && isPickerOpen && picker.mode === "succ" && (
                      <TaskPicker
                        mode="succ"
                        anchorTask={task}
                        allTasks={tasks}
                        sequences={sequences}
                        onPick={(otherId) =>
                          handlePick(task.id, "succ", otherId)
                        }
                        onClose={() => setPicker(null)}
                      />
                    )}
                  </td>

                  <td
                    className="px-2 py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!readOnly && (
                      <button
                        onClick={() => setEditingId(task.id)}
                        className="rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        title="Quick edit"
                      >
                        ✎
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ================= EDIT MODAL ================= */}
      {editingTask && !readOnly && (
        <ActivityEditorModal
          task={editingTask}
          tasks={tasks}
          onSave={(patch) => updateTask(editingTask.id, patch)}
          onDelete={() => deleteTask(editingTask.id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* ================= CALENDAR MODAL ================= */}
      {calendarOpen && !readOnly && (
        <CalendarModal
          calendar={calendar}
          onChange={setCalendar}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </main>
  );
}

function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}