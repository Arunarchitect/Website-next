"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
import {
  demoSchedule,
  SEQUENCE_TYPES,
  type Sequence,
  type SequenceType,
  type Task,
} from "./data";
import {
  addDays,
  applyProgress,
  autoScheduleWorkdays,
  completionBlocker,
  durationDays,
  durationWorkdays,
  finishVariance,
  flatten,
  isoWeek,
  moveTaskWithinSiblings,
  reopenDownstream,
  rollup,
  setBaseline,
  setDurationWithCalendar,
  snapRangeToWorkdays,
  sortLeafTasks,
  sortTasks,
  toDay,
  toISO,
  todayISO,
  wouldCycle,
  type SortKey,
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
  nextWorkday,
  prevWorkday,
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
import BaselineCompare from "./BaselineCompare";
import { listMyProjects, type MyProject, type ScheduleDoc } from "./api";
import TaskPicker, { type PickerMode } from "./TaskPicker";
import SchedulePicker from "./SchedulePicker";
import ScheduleExportODS from "./ScheduleExportODS";
import {
  PasteJsonModal,
  applySelection,
  copyTasksForAi,
  withDescendants,
} from "./JsonTool";
import type { SelectionJson } from "./JsonTool";
import { useUndo } from "./useUndo";

const ROW_H = 28;
const LEFT_COL_W = 256; // desktop width
const LEFT_COL_W_MOBILE = 128; // phones (< 640px)

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

// Long-press (touch) tuning
const LONG_PRESS_MS = 400; // shorter than Android's ~500ms native long-press
const MOVE_TOLERANCE = 10; // px of finger drift allowed before cancelling

// Sort menu entries: [key, direction, label]
const SORT_OPTIONS: [SortKey, "asc" | "desc", string][] = [
  ["start", "asc", "Start date – earliest first"],
  ["start", "desc", "Start date – latest first"],
  ["finish", "asc", "Finish date – earliest first"],
  ["finish", "desc", "Finish date – latest first"],
  ["name", "asc", "Name A → Z"],
  ["name", "desc", "Name Z → A"],
  ["duration", "desc", "Duration – longest first"],
  ["duration", "asc", "Duration – shortest first"],
  ["completion", "desc", "Completion – highest first"],
  ["completion", "asc", "Completion – lowest first"],
];

const SORT_KEY_LABEL: Record<SortKey, string> = {
  start: "start date",
  finish: "finish date",
  name: "name",
  duration: "duration",
  completion: "completion",
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

// Basic template uploaded when the user clicks "Create schedule":
// one empty phase, default calendar.
const makeSeed = () => {
  const d = todayISOForNew();
  return {
    tasks: [
      {
        id: newId("g"),
        name: "Phase 1",
        parentId: null,
        scheduleStart: d,
        scheduleFinish: d,
        completion: 0,
        isMilestone: false,
      } as Task,
    ],
    sequences: [] as Sequence[],
    calendar: serialize(emptyCalendar()),
  };
};

// Read ?project= / ?schedule= from the URL.
const readParam = (key: string): number | null => {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get(key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

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
  const [showBaseline, setShowBaseline] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);

  const [picker, setPicker] = useState<{
    taskId: string;
    mode: PickerMode;
  } | null>(null);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [ganttOpen, setGanttOpen] = useState(true);
  const [scopedPasteOpen, setScopedPasteOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [includeChildren, setIncludeChildren] = useState(false);

  // Sort menu
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortDeep, setSortDeep] = useState(false);
  const [sortLeavesOnly, setSortLeavesOnly] = useState(false);

  const [nextIdx, setNextIdx] = useState(0);

  const [calendar, setCalendar] = useState<WorkingCalendar>(() =>
    emptyCalendar()
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [useWorkdays, setUseWorkdays] = useState(false);

  const calendarSer = useMemo(() => serialize(calendar), [calendar]);

  const undo = useUndo({
    tasks,
    sequences,
    calendar,
    apply: (s) => {
      setTasks(s.tasks);
      setSequences(s.sequences);
      setCalendar(s.calendar);
    },
  });

  // Left task column width: narrower on phones so the timeline gets room.
  const [leftW, setLeftW] = useState(LEFT_COL_W);
  useEffect(() => {
    const update = () =>
      setLeftW(window.innerWidth < 640 ? LEFT_COL_W_MOBILE : LEFT_COL_W);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
          const first = rows.find((r) => r.schedules.length > 0) ?? rows[0];
          setProjectId(first.id);
          setScheduleId(first.schedules[0]?.id ?? null);
        } else if (projectId != null && scheduleId == null) {
          const p = rows.find((r) => r.id === projectId);
          if (p) setScheduleId(p.schedules[0]?.id ?? null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setPickerError(
          e instanceof Error ? e.message : "Failed to load projects"
        );
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

  const seed = useMemo(() => makeSeed(), []);

  // Stable callback (only uses state setters). Resets the calendar to the
  // default when the server has none, so a previous schedule's holidays
  // never leak into the next one.
  const handleLoaded = useCallback(
    (d: ScheduleDoc) => {
      setTasks(d.tasks);
      setSequences(d.sequences);
      setCalendar(
        d.calendar
          ? deserialize(d.calendar as SerializedCalendar)
          : emptyCalendar()
      );
      undo.clear();
    },
    [undo.clear]
  );

  // ---------- backend sync ----------
  const sync = useScheduleSync({
    projectId,
    scheduleId,
    seed,
    tasks,
    sequences,
    calendar: calendarSer,
    onLoaded: handleLoaded,
  });

  const currentProject = myProjects.find((p) => p.id === projectId) ?? null;
  const isViewOnly = currentProject ? !currentProject.canEdit : false;
  const isAdmin = currentProject?.role === "admin";
  const readOnly = isViewOnly || !sync.canEdit;
  const ready = !["loading", "empty", "failed"].includes(sync.status);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);
  const pendingScroll = useRef<number | null>(null);
  const pendingCenter = useRef<number | null>(null);
  const [containerW, setContainerW] = useState(1000);

  useEffect(() => {
    if (readOnly || !ready) return;
    const isTextEntry = (el: HTMLElement | null) => {
      if (!el) return false;
      if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
      if (el.tagName === "INPUT") {
        const t = (el as HTMLInputElement).type;
        return !["checkbox", "radio", "range", "button"].includes(t);
      }
      return false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      if (isTextEntry(e.target as HTMLElement | null)) return; // native text undo
      if (editingId || pasteOpen || scopedPasteOpen || calendarOpen || compareOpen)
        return;
      e.preventDefault();
      const isRedo = k === "y" || e.shiftKey;
      const ok = isRedo ? undo.redo() : undo.undo();
      if (ok) {
        setCopiedMsg(isRedo ? "Redone" : "Undone");
        setTimeout(() => setCopiedMsg(null), 1500);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    readOnly,
    ready,
    editingId,
    pasteOpen,
    scopedPasteOpen,
    calendarOpen,
    compareOpen,
    undo,
  ]);

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
  }, [ready, ganttOpen]);

  // Close the row menu / sort menu on an outside click.
  useEffect(() => {
    if (!menuFor && !sortMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-row-menu]")) return;
      setMenuFor(null);
      setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuFor, sortMenuOpen]);

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
    setNextIdx((i) =>
      Math.min(Math.max(0, i), Math.max(0, upcoming.length - 1))
    );
  }, [upcoming.length]);

  const next = upcoming[nextIdx] ?? nextAuto;

  // Minimum 320px of timeline so on phones the chart is wider than the
  // screen and scrolls horizontally instead of being crushed.
  const fitZoom = useMemo(() => {
    const usable = Math.max(320, containerW - 24);
    return Math.max(ZOOM_MIN, usable / totalDays);
  }, [containerW, totalDays]);

  useEffect(() => {
    if (autoFit) setZoom(fitZoom);
  }, [autoFit, fitZoom]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (pendingScroll.current != null) {
      if (el) el.scrollLeft = Math.max(0, pendingScroll.current * zoom);
      pendingScroll.current = null;
    } else if (pendingCenter.current != null) {
      if (el) {
        el.scrollLeft = Math.max(
          0,
          pendingCenter.current * zoom - el.clientWidth / 2
        );
      }
      pendingCenter.current = null;
    }
  }, [zoom]);

  const ganttWidth = Math.max(totalDays * zoom, containerW);
  const ganttBodyHeight = rows.length * ROW_H;

  const showDayGrid = zoom >= SHOW_DAY_GRID_ABOVE;
  const showWeekGrid = zoom >= SHOW_WEEK_GRID_ABOVE;
  const showWeekHeader = zoom >= SHOW_WEEK_HEADER_ABOVE;
  const showDayHeader = zoom >= SHOW_DAY_HEADER_ABOVE;

  const headerH =
    20 * (1 + (showWeekHeader ? 1 : 0) + (showDayHeader ? 1 : 0)) + 1;

  const months = useMemo(() => {
    const out: { label: string; short: string; days: number; px: number }[] =
      [];
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

  // ── Auto-schedule: always holiday aware ─────────────────────────────────
  const runAutoSchedule = () => {
    setUseWorkdays(true); // durations and holiday shading match the result
    setTasks((prev) => autoScheduleWorkdays(prev, sequences, calendar));
  };

  const notify = (msg: string) => {
    setCopiedMsg(msg);
    setTimeout(() => setCopiedMsg(null), 4000);
  };

  const updateCompletion = (id: string, completion: number) => {
    const problem = completionBlocker(
      id,
      completion,
      tasks,
      sequences,
      useWorkdays ? calendar : undefined
    );
    if (problem) {
      notify(problem); // slider snaps back because it is controlled
      return;
    }
    const todayStr = todayISO();

    if (completion < 100) {
      const n = reopenDownstream(tasks, sequences, id).reopened.length;
      if (n > 0) notify(`Reopened ${n} downstream task${n > 1 ? "s" : ""}.`);
    }

    setTasks((prev) => {
      let next = prev.map((t) => {
        if (t.id !== id) return t;
        let u = applyProgress(t, completion, todayStr);
        if (
          u.completion > 0 &&
          u.completion < 100 &&
          !u.isMilestone &&
          u.scheduleFinish < todayStr
        ) {
          u = {
            ...u,
            scheduleFinish: useWorkdays
              ? nextWorkday(todayStr, calendar)
              : todayStr,
          };
        }
        return u;
      });
      if (completion < 100) {
        next = reopenDownstream(next, sequences, id).tasks;
      }
      // push-only pass: successors move later, nothing is pulled earlier
      return autoScheduleWorkdays(next, sequences, calendar, false);
    });
  };

  const updateActual = (
    id: string,
    field: "actualStart" | "actualFinish",
    value: string
  ) =>
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (field === "actualFinish" && t.completion < 100) return t;
        const nextTask: Task = { ...t, [field]: value || null };
        if (
          nextTask.actualStart &&
          nextTask.actualFinish &&
          nextTask.actualFinish < nextTask.actualStart
        ) {
          nextTask.actualFinish = nextTask.actualStart;
        }
        return nextTask;
      })
    );

  const setBaselineNow = () => {
    const hasOne = tasks.some((t) => t.baselineFinish);
    const msg = hasOne
      ? "Overwrite the existing baseline with the current planned dates?"
      : "Freeze the current planned dates as the baseline?";
    if (window.confirm(msg)) setTasks((prev) => setBaseline(prev));
  };

  /**
   * Update planned dates for one task. In working-day mode, snap the range
   * so it starts on a working day and ends on a working day (weekends and
   * holidays are excluded). In calendar mode this is a direct assignment
   * with the usual "finish must be ≥ start" clamp.
   */
  const updateDates = (id: string, start: string, finish: string) =>
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (!useWorkdays) {
          return {
            ...t,
            scheduleStart: start,
            scheduleFinish: finish < start ? start : finish,
          };
        }
        const { start: s, finish: f } = snapRangeToWorkdays(
          start,
          finish,
          calendar
        );
        return { ...t, scheduleStart: s, scheduleFinish: f };
      })
    );

  // Calendar-day math when no calendar is passed, working-day math when it is.
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
    setTimeout(
      () => setFlashId((cur) => (cur === id ? null : cur)),
      HIGHLIGHT_MS
    );
  };

  const addSibling = (anchor: Task) => addChild(anchor.parentId ?? null);

  /**
   * Sort the children of one group.
   * Target group = the selected row if it is a group (its children),
   * otherwise the selected row's siblings. Nothing selected = top level.
   * Row order comes from the order of the `tasks` array, so the new order
   * is saved with the schedule and is undoable (Ctrl+Z).
   */
  /**
   * Sort the children of one group.
   * Target group = the selected row if it is a group (its children),
   * otherwise the selected row's siblings. Nothing selected = top level.
   * When the "Sort end tasks only" box is ticked, no group or top-level row
   * ever moves — only the lowest-level tasks inside each group are sorted.
   * Row order comes from the order of the `tasks` array, so the new order
   * is saved with the schedule and is undoable (Ctrl+Z).
   */
  const applySort = (key: SortKey, dir: "asc" | "desc") => {
    if (sortLeavesOnly) {
      setTasks((prev) => sortLeafTasks(prev, rolled, key, dir));
      notify(
        `Sorted end tasks by ${SORT_KEY_LABEL[key]} (${dir === "asc" ? "ascending" : "descending"})`
      );
      setSortMenuOpen(false);
      return;
    }
    const sel = selectedId ? tasks.find((t) => t.id === selectedId) : null;
    const parent: string | null = !sel
      ? null
      : tasks.some((c) => c.parentId === sel.id)
        ? sel.id
        : sel.parentId ?? null;
    setTasks((prev) => sortTasks(prev, rolled, parent, key, dir, sortDeep));
    const where = parent
      ? `"${tasks.find((t) => t.id === parent)?.name ?? "group"}"`
      : "top level";
    notify(
      `Sorted ${where} by ${SORT_KEY_LABEL[key]} (${dir === "asc" ? "ascending" : "descending"})`
    );
    setSortMenuOpen(false);
  };

  /** Manual reorder: move the selected task one row up/down among its siblings. */
  const moveSelected = (dir: "up" | "down") => {
    if (!selectedId) return;
    const id = selectedId;
    setTasks((prev) => moveTaskWithinSiblings(prev, id, dir));
    setFlashId(id);
    setTimeout(
      () => setFlashId((cur) => (cur === id ? null : cur)),
      HIGHLIGHT_MS
    );
  };

  /**
   * Create a NEW activity in the SAME group as `anchorId`, linked to it as a
   * predecessor or successor (FS, 0d), then open its editor — the same flow
   * as "+ New phase" / "Add child…".
   *
   * It is called right after the editor's save(), so the task is read from
   * the latest state inside the updater (picks up just-saved date/group edits).
   */
  const addLinkedTask = (anchorId: string, mode: PickerMode) => {
    const anchorNow = tasks.find((t) => t.id === anchorId);
    if (!anchorNow) return;

    const id = newId("a");

    setTasks((prev) => {
      const a = prev.find((t) => t.id === anchorId);
      if (!a) return prev;

      // Successor: day after the anchor finishes. Predecessor: day before it starts.
      let start =
        mode === "succ"
          ? addDays(a.scheduleFinish, 1)
          : addDays(a.scheduleStart, -1);
      if (useWorkdays) {
        start =
          mode === "succ"
            ? nextWorkday(start, calendar)
            : prevWorkday(start, calendar);
      }

      const newTask: Task = {
        id,
        name: mode === "succ" ? "New successor" : "New predecessor",
        parentId: a.parentId, // same group as the selected activity
        scheduleStart: start,
        scheduleFinish: start,
        completion: 0,
        isMilestone: false,
      };

      // Place it right beside the anchor: before it (pred) or after it (succ).
      const i = prev.findIndex((t) => t.id === anchorId);
      const at = mode === "succ" ? i + 1 : i;
      return [...prev.slice(0, at), newTask, ...prev.slice(at)];
    });

    setSequences((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        relatingTask: mode === "succ" ? anchorId : id,
        relatedTask: mode === "succ" ? id : anchorId,
        sequenceType: "FINISH_START",
        lagDays: 0,
      },
    ]);

    if (anchorNow.parentId) {
      const pid = anchorNow.parentId;
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(pid);
        return n;
      });
    }

    setEditingId(id);
    setSelectedId(id);
    setFlashId(id);
    setTimeout(
      () => setFlashId((cur) => (cur === id ? null : cur)),
      HIGHLIGHT_MS
    );
  };

  const freezeIfLeaf = (prev: Task[], parentId: string | null): Task[] => {
    if (!parentId) return prev;
    if (prev.some((t) => t.parentId === parentId)) return prev;
    const r = rolled.find((t) => t.id === parentId);
    if (!r) return prev;
    return prev.map((t) =>
      t.id === parentId
        ? {
          ...t,
          scheduleStart: r.scheduleStart,
          scheduleFinish: r.scheduleFinish,
          baselineStart: r.baselineStart,
          baselineFinish: r.baselineFinish,
          actualStart: r.actualStart,
          actualFinish: r.actualFinish,
          completion: r.completion,
        }
        : t
    );
  };

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
    const parentOfRoot = tasks.find((t) => t.id === id)?.parentId ?? null;
    setTasks((prev) =>
      freezeIfLeaf(
        prev.filter((t) => !toRemove.has(t.id)),
        parentOfRoot && !toRemove.has(parentOfRoot) ? parentOfRoot : null
      )
    );
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

  const updateTask = (id: string, incoming: Partial<Task>) => {
    let patch: Partial<Task> = incoming;
    const existing = tasks.find((t) => t.id === id);

    if (
      incoming.completion !== undefined &&
      existing &&
      incoming.completion !== existing.completion
    ) {
      const problem = completionBlocker(
        id,
        incoming.completion,
        tasks,
        sequences,
        useWorkdays ? calendar : undefined
      );
      if (problem) {
        notify(problem);
        const rest: Partial<Task> = { ...incoming };
        delete rest.completion;
        delete rest.actualStart;
        delete rest.actualFinish;
        delete rest.scheduleStart;
        delete rest.scheduleFinish;
        patch = rest;
      }
    }

    const completionChanged =
      patch.completion !== undefined &&
      !!existing &&
      patch.completion !== existing.completion;
    const unfinished = completionChanged && (patch.completion as number) < 100;

    if (unfinished) {
      const n = reopenDownstream(tasks, sequences, id).reopened.length;
      if (n > 0) notify(`Reopened ${n} downstream task${n > 1 ? "s" : ""}.`);
    }

    setTasks((prev) => {
      let next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      if (unfinished) next = reopenDownstream(next, sequences, id).tasks;
      if (completionChanged) {
        next = autoScheduleWorkdays(next, sequences, calendar, false);
      }
      return next;
    });
  };

  const moveTask = (id: string, target: MoveTarget) => {
    const newParent = target.kind === "root" ? null : target.id;
    const oldParent = tasks.find((t) => t.id === id)?.parentId ?? null;
    setTasks((prev) =>
      freezeIfLeaf(
        prev.map((t) => (t.id === id ? { ...t, parentId: newParent } : t)),
        oldParent === newParent ? null : oldParent
      )
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
    setTimeout(
      () => setFlashId((cur) => (cur === id ? null : cur)),
      HIGHLIGHT_MS
    );
  };

  useEffect(() => {
    if (selectedId && !tasks.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [tasks, selectedId]);

  useEffect(() => {
    setCheckedIds((prev) => {
      const ids = new Set(tasks.map((t) => t.id));
      const nextSet = new Set([...prev].filter((id) => ids.has(id)));
      return nextSet.size === prev.size ? prev : nextSet;
    });
  }, [tasks]);

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

  // ---------- long-press (touch) ----------
  const openEditorFromBar = (id: string) => {
    if (readOnly) return;
    setEditingId(id);
    setSelectedId(id);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  const startLongPress = (id: string, e: ReactTouchEvent) => {
    if (readOnly) return;
    cancelLongPress();
    longPressFired.current = false;
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      openEditorFromBar(id);
    }, LONG_PRESS_MS);
  };

  // A real finger always drifts a few px; only cancel on real movement.
  const moveLongPress = (e: ReactTouchEvent) => {
    const s = touchStartPos.current;
    if (!s) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - s.x, t.clientY - s.y) > MOVE_TOLERANCE) {
      cancelLongPress();
    }
  };

  // Swallow the click that follows a long press so it doesn't select/zoom
  // or hit the modal backdrop and close the editor immediately.
  const consumeLongPress = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return true;
    }
    return false;
  };

  const handleRowClick = (id: string, isGroup: boolean) => {
    setSelectedId(id);
    if (isGroup) toggleCollapse(id);
  };

  const jumpToTask = (id: string) => handleSelectFromSearch(id);

  // ---------- programmatic zoom ----------
  const zoomToRange = (startDay: number, endDay: number, padDays = 2) => {
    const span = Math.max(1, endDay - startDay + 1) + padDays * 2;
    const usable = Math.max(120, containerW - 24);
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, usable / span));
    const offset = startDay - padDays - minDay;
    setAutoFit(false);
    if (Math.abs(z - zoom) < 1e-6) {
      const el = scrollerRef.current;
      if (el) el.scrollLeft = Math.max(0, offset * z);
    } else {
      pendingScroll.current = offset;
      setZoom(z);
    }
  };

  const zoomKeepCenter = (target: number) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, target));
    if (Math.abs(z - zoom) < 1e-6) return;
    const el = scrollerRef.current;
    if (el && zoom > 0) {
      if (selectedId) {
        const t = rolled.find((x) => x.id === selectedId);
        if (t) {
          const s = toDay(t.scheduleStart) - minDay;
          const f = toDay(t.scheduleFinish) - minDay;
          const mid = (s + f) / 2;
          const leftDay = el.scrollLeft / zoom;
          const rightDay = (el.scrollLeft + el.clientWidth) / zoom;
          if (mid >= leftDay && mid <= rightDay) {
            pendingCenter.current = mid;
            setZoom(z);
            return;
          }
        }
      }
      pendingCenter.current = (el.scrollLeft + el.clientWidth / 2) / zoom;
    }
    setZoom(z);
  };

  const zoomToTask = (t: Task) => {
    const s = toDay(t.scheduleStart);
    const f = toDay(t.scheduleFinish);
    const span = f - s + 1;
    zoomToRange(s, f, Math.max(2, Math.round(span * 0.15)));
  };

  const TODAY_WINDOW_DAYS = 10;
  const zoomToToday = () => {
    if (!todayInRange) return;
    zoomToRange(todayDay - TODAY_WINDOW_DAYS, todayDay + TODAY_WINDOW_DAYS, 0);
  };

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

  // Direct predecessors / successors of the selected task (soft tint).
  const { predIds, succIds } = useMemo(() => {
    const p = new Set<string>();
    const s = new Set<string>();
    if (selectedId) {
      for (const q of sequences) {
        if (q.relatedTask === selectedId) p.add(q.relatingTask);
        if (q.relatingTask === selectedId) s.add(q.relatedTask);
      }
    }
    return { predIds: p, succIds: s };
  }, [selectedId, sequences]);

  // ---------- load gates (ALL hooks are above this line) ----------
  if (pickerError) {
    return (
      <main className="mx-auto max-w-[1600px] p-3 text-sm sm:p-6">
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
      <main className="mx-auto max-w-[1600px] p-3 text-sm text-gray-500 sm:p-6">
        Loading your projects…
      </main>
    );
  }

  if (!pickerLoading && myProjects.length === 0) {
    return (
      <main className="mx-auto max-w-[1600px] p-3 text-sm text-gray-500 sm:p-6">
        You don&apos;t have access to any projects yet. Ask your organisation
        admin to add you to a project.
      </main>
    );
  }

  if (projectId == null) {
    return (
      <main className="mx-auto max-w-[1600px] p-3 text-sm text-gray-500 sm:p-6">
        Pick a project to view its schedule.
      </main>
    );
  }

  if (sync.status === "loading") {
    return (
      <main className="mx-auto max-w-[1600px] p-3 text-sm text-gray-500 sm:p-6">
        Loading schedule…
      </main>
    );
  }
  if (sync.status === "empty") {
    return (
      <main className="mx-auto max-w-[1600px] p-3 text-sm sm:p-6">
        <div className="mb-4">
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
        </div>
        <p className="mb-3 text-gray-500">
          No schedule has been created for this project yet.
        </p>
        {!isViewOnly && (
          <button
            onClick={async () => {
              const id = await sync.createAndSeed();
              if (id != null) {
                setScheduleId(id);
                listMyProjects()
                  .then(setMyProjects)
                  .catch(() => { });
              }
            }}
            className="rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            + Create schedule
          </button>
        )}
        {sync.message && <p className="mt-2 text-red-600">{sync.message}</p>}
      </main>
    );
  }
  if (sync.status === "failed") {
    return (
      <main className="mx-auto max-w-[1600px] p-3 text-sm sm:p-6">
        <div className="mb-4">
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
        </div>
        <p className="mb-2 text-red-600">
          Couldn&apos;t load the schedule
          {sync.message ? `: ${sync.message}` : "."}
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
  const hasBaseline = tasks.some((t) => t.baselineFinish);
  const parentIdSet = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const lateCount = tasks.filter(
    (t) => !parentIdSet.has(t.id) && (finishVariance(t) ?? 0) > 0
  ).length;
  const criticalDuration = cpm.projectFinish - cpm.projectStart + 1;
  // TEMP DEBUG: root causes of drift
  // Schedule consistency check: links that push a task later than its stored finish
  const cpmISO = (id: string) => {
    const ef = cpm.earlyFinish.get(id);
    return ef == null ? "" : toISO(ef);
  };
  const isDrifted = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    return !!t && !parentIdSet.has(id) && cpmISO(id) > t.scheduleFinish;
  };
  const linkProblems = tasks
    .filter((t) => isDrifted(t.id))
    .filter(
      (t) =>
        !sequences.some((s) => s.relatedTask === t.id && isDrifted(s.relatingTask))
    )
    .map((t) => ({
      id: t.id,
      name: t.name,
      stored: t.scheduleFinish,
      cpm: cpmISO(t.id),
      daysLate: toDay(cpmISO(t.id)) - toDay(t.scheduleFinish),
      preds: sequences
        .filter((s) => s.relatedTask === t.id)
        .map((s) => {
          const p = tasks.find((x) => x.id === s.relatingTask);
          return `${p?.name ?? "?"} (${s.sequenceType.replace("_", "→")}, lag ${s.lagDays})`;
        })
        .join("; "),
    }))
    .sort((a, b) => b.daysLate - a.daysLate)
    .slice(0, 5);

  const editingTask = editingId
    ? rolled.find((t) => t.id === editingId) ?? null
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
      case "addPred":
        addLinkedTask(task.id, "pred");
        break;
      case "addSucc":
        addLinkedTask(task.id, "succ");
        break;
      case "copyJson": {
        void copyTasksForAi(
          withDescendants(task.id, tasks),
          tasks,
          sequences
        ).then((r) => {
          setCopiedMsg(r.message);
          setFlashId(task.id);
          setTimeout(
            () => setFlashId((c) => (c === task.id ? null : c)),
            HIGHLIGHT_MS
          );
          setTimeout(() => setCopiedMsg(null), 4000);
          if (!r.ok) window.alert(r.message);
        });
        break;
      }
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

  const copyBaselineJson = async () => {
    const withBaseline = rolled.filter((t) => t.baselineStart && t.baselineFinish);
    if (!withBaseline.length) {
      notify("No baseline set yet.");
      return;
    }
    const ids = new Set(withBaseline.map((t) => t.id));

    const payload = {
      tasks: withBaseline.map((t) => ({
        id: t.id,
        name: t.name,
        // keep the parent only if it is also in the export, else top level
        parentId: t.parentId && ids.has(t.parentId) ? t.parentId : null,
        scheduleStart: t.baselineStart as string,
        scheduleFinish: t.baselineFinish as string,
        baselineStart: t.baselineStart as string,
        baselineFinish: t.baselineFinish as string,
        completion: t.completion,
        isMilestone: t.isMilestone,
        ...(t.workCode ? { workCode: t.workCode } : {}),
        ...(t.remarks ? { remarks: t.remarks } : {}),
      })),
      sequences: sequences.filter(
        (s) => ids.has(s.relatingTask) && ids.has(s.relatedTask)
      ),
    };

    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) {
        notify("Couldn't copy to clipboard.");
        return;
      }
    }
    notify(`Baseline JSON copied (${withBaseline.length} tasks).`);
  };
  
  const toggleChecked = (id: string) =>
    setCheckedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allVisibleChecked =
    rows.length > 0 && rows.every((r) => checkedIds.has(r.task.id));

  const toggleAllVisible = () =>
    setCheckedIds(
      allVisibleChecked ? new Set() : new Set(rows.map((r) => r.task.id))
    );

  const selectionIds = (): string[] =>
    includeChildren
      ? [
        ...new Set(
          [...checkedIds].flatMap((id) => withDescendants(id, tasks))
        ),
      ]
      : [...checkedIds];

  const applyPaste = (data: SelectionJson) => {
    const r = applySelection(data, tasks, sequences);
    setTasks(r.tasks);
    setSequences(r.sequences);
    setPasteOpen(false);
    setScopedPasteOpen(false);
    setCopiedMsg("Changes applied.");
    setTimeout(() => setCopiedMsg(null), 4000);
  };

  const copySelected = () => {
    if (checkedIds.size === 0) return;
    const ids = selectionIds();
    void copyTasksForAi(ids, tasks, sequences).then((r) => {
      setCopiedMsg(r.message);
      setTimeout(() => setCopiedMsg(null), 4000);
      if (!r.ok) window.alert(r.message);
    });
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
  const heading =
    currentScheduleMeta?.name ?? currentProject?.name ?? demoSchedule.name;

  return (
    <main className="mx-auto max-w-[1600px] p-3 sm:p-6">
      {/* ================= HEADER ================= */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {copiedMsg && (
          <div className="fixed bottom-4 right-4 z-[110] rounded bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
            {copiedMsg}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{heading}</h1>
          <p className="text-sm text-gray-500">
            {fmtDate(cpm.projectStart)} → {fmtDate(cpm.projectFinish)} ·{" "}
            {criticalDuration} days total · {criticalCount} critical activities
            {useWorkdays && " · working-day mode"}
            {hasBaseline && ` · ${lateCount} late vs baseline`}
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
          <PrintAct
            tasks={tasks}
            rows={rows}
            criticalIds={cpm.criticalIds}
            floats={cpm.totalFloat}
            title={heading}
            projectName={currentProject?.name ?? ""}
          />
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
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={copySelected}
                disabled={checkedIds.size === 0}
                className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Copy the ticked tasks as JSON (for AI editing)"
              >
                Copy selected ({checkedIds.size})
              </button>
              <button
                onClick={() => setScopedPasteOpen(true)}
                disabled={checkedIds.size === 0}
                className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Paste edited JSON back into ONLY the ticked tasks"
              >
                Paste into selection
              </button>
              <label
                className="flex items-center gap-1 text-xs text-gray-600"
                title="Also include every child under the ticked tasks"
              >
                <input
                  type="checkbox"
                  checked={includeChildren}
                  onChange={(e) => setIncludeChildren(e.target.checked)}
                />
                + children
              </label>
              {checkedIds.size > 0 && (
                <button
                  onClick={() => setCheckedIds(new Set())}
                  className="text-xs text-gray-500 underline hover:text-gray-800"
                >
                  clear
                </button>
              )}
            </div>
          )}
          {!readOnly && (
            <button
              onClick={() => setPasteOpen(true)}
              className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
              title="Paste a task/phase JSON (e.g. edited by an AI) and validate it"
            >
              Paste JSON
            </button>
          )}
          <ScheduleExport
            tasks={tasks}
            sequences={sequences}
            calendar={calendarSer}
          />
          <ScheduleExportODS
            rows={rows}
            criticalIds={cpm.criticalIds}
            name={heading}
          />
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => undo.undo()}
                disabled={!undo.canUndo}
                className="rounded border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                onClick={() => undo.redo()}
                disabled={!undo.canRedo}
                className="rounded border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
              >
                ↷ Redo
              </button>
            </div>
          )}

          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveSelected("up")}
                disabled={!selectedId}
                className="rounded border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Move selected task up one row (within its group)"
              >
                ↑
              </button>
              <button
                onClick={() => moveSelected("down")}
                disabled={!selectedId}
                className="rounded border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Move selected task down one row (within its group)"
              >
                ↓
              </button>
            </div>
          )}

          {/* ---- Sort menu ---- */}
          {!readOnly && (
            <div className="relative" data-row-menu>
              <button
                onClick={() => setSortMenuOpen((o) => !o)}
                className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
                title="Sort the tasks inside the selected group"
              >
                ⇅ Sort
              </button>
              {sortMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border bg-white text-xs shadow-lg">
                  <div className="border-b bg-gray-50 px-3 py-1.5 text-[10px] text-gray-500">
                    Applies to the selected group (or the siblings of the selected
                    activity). Nothing selected = top level.
                  </div>
                  {SORT_OPTIONS.map(([k, d, label]) => (
                    <button
                      key={`${k}-${d}`}
                      onClick={() => applySort(k, d)}
                      className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
                    >
                      {label}
                    </button>
                  ))}
                  <label className="flex items-center gap-1.5 border-t px-3 py-1.5 text-gray-600">
                    <input
                      type="checkbox"
                      checked={sortDeep}
                      onChange={(e) => setSortDeep(e.target.checked)}
                    />
                    Include sub-groups
                  </label>
                  <label
                    className="flex items-start gap-1.5 border-t px-3 py-1.5 text-gray-600"
                    title="Keep every phase/group in place; sort only the lowest-level tasks inside each group"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={sortLeavesOnly}
                      onChange={(e) => setSortLeavesOnly(e.target.checked)}
                    />
                    <span>
                      Sort end tasks only — never reorder phases or the top level, just the
                      lowest-level tasks inside each group
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

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
            onClick={() => setCompareOpen(true)}
            className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            title="Compare planned dates with the baseline"
          >
            Compare
          </button>
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
          {!readOnly && isAdmin && (
            <button
              onClick={copyBaselineJson}
              disabled={!hasBaseline}
              className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                hasBaseline
                  ? "Copy the baseline dates as JSON"
                  : "No baseline set yet"
              }
            >
              Copy baseline JSON
            </button>
          )}
          {!readOnly && isAdmin && (
            <button
              onClick={setBaselineNow}
              className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
              title="Freeze the current planned dates as the baseline"
            >
              Set baseline
            </button>
          )}
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

      {linkProblems.length > 0 && (
        <div
          className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          data-print-hide
        >
          <div className="mb-1 text-sm font-semibold">
            ⚠ There&apos;s a problem with the schedule links
          </div>
          <p className="mb-2">
            The links push these tasks later than their planned dates, so the header
            finish ({fmtDate(cpm.projectFinish)}) differs from the Gantt finish (
            {fmtDate(maxDay)}). Fix the link type or lag in the Predecessors column,
            or move the task&apos;s dates.
          </p>
          <ul className="space-y-1">
            {linkProblems.map((r) => (
              <li key={r.id} className="rounded bg-white/70 px-2 py-1">
                <button
                  onClick={() => handleSelectFromSearch(r.id)}
                  className="font-semibold underline hover:text-amber-700"
                  title="Jump to this task"
                >
                  {r.name}
                </button>
                : planned finish {r.stored}, links force {r.cpm} (+{r.daysLate}d).
                <span className="block text-amber-800">
                  Predecessors: {r.preds || "none"}
                </span>
              </li>
            ))}
          </ul>
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
                {fmtDate(rangeFor(current).es)} →{" "}
                {fmtDate(rangeFor(current).ef)}
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

      {/* ================= GANTT SHOW / HIDE ================= */}
      <div
        className="sticky top-0 z-30 mb-2 flex items-center gap-2 bg-white/90 py-1 backdrop-blur"
        data-print-hide
      >
        <button
          onClick={() => setGanttOpen((o) => !o)}
          className="rounded border bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          title={
            ganttOpen ? "Collapse the Gantt chart" : "Expand the Gantt chart"
          }
        >
          {ganttOpen ? "▼ Hide Gantt chart" : "▶ Show Gantt chart"}
        </button>
      </div>

      {/* ================= ZOOM BAR ================= */}
      {ganttOpen && (
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
              onClick={() => zoomKeepCenter(zoom / 1.5)}
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
              onChange={(e) => zoomKeepCenter(Math.exp(Number(e.target.value)))}
              className="w-40"
            />
            <button
              disabled={autoFit}
              onClick={() => zoomKeepCenter(zoom * 1.5)}
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

          <button
            onClick={() => setAutoFit(true)}
            className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
            title="Fit the whole schedule to the width"
          >
            Fit all
          </button>
          <button
            onClick={() => {
              const t = selectedId
                ? rolled.find((x) => x.id === selectedId)
                : null;
              if (t) zoomToTask(t);
            }}
            disabled={!selectedId}
            className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Zoom to the selected task"
          >
            Fit selected
          </button>
          <button
            onClick={zoomToToday}
            disabled={!todayInRange}
            className="rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              todayInRange
                ? "Zoom to today (±10 days)"
                : "Today is outside the schedule range"
            }
          >
            Today
          </button>

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

          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
            />
            Show baseline &amp; actual
          </label>

          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
            {showDayHeader
              ? "Detail: days"
              : showWeekHeader
                ? "Detail: weeks"
                : "Detail: months"}
          </span>
        </div>
      )}

      {/* ================= GANTT ================= */}
      {ganttOpen && (
        <section className="mb-8 rounded border">
          <div className="flex">
            <div
              className="shrink-0 border-r bg-white"
              style={{ width: leftW }}
            >
              <div
                className="box-border flex items-center border-b px-3 text-xs font-semibold text-gray-500"
                style={{ height: headerH }}
              >
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
                      onClick={() => {
                        if (consumeLongPress()) return;
                        handleRowClick(task.id, hasChildren);
                        zoomToTask(task);
                      }}
                      onDoubleClick={() => openEditorFromBar(task.id)}
                      onTouchStart={(e) => startLongPress(task.id, e)}
                      onTouchMove={moveLongPress}
                      onTouchEnd={cancelLongPress}
                      onTouchCancel={cancelLongPress}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`flex cursor-pointer select-none items-center gap-1 truncate px-2 text-xs transition-colors ${selected
                        ? "bg-blue-100 ring-1 ring-inset ring-blue-300"
                        : predIds.has(task.id)
                          ? "bg-amber-50 hover:bg-amber-100/60"
                          : succIds.has(task.id)
                            ? "bg-emerald-50 hover:bg-emerald-100/60"
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
                      {!readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditorFromBar(task.id);
                          }}
                          className="ml-auto shrink-0 px-1.5 text-gray-500 hover:text-gray-800"
                          title="Edit"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto">
              <div style={{ width: ganttWidth }}>
                <div
                  className="box-border border-b bg-gray-50"
                  style={{ height: headerH }}
                >
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
                      const holiday =
                        useWorkdays && isHoliday(dayNum, calendar);
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
                    const isPred = predIds.has(task.id);
                    const isSucc = succIds.has(task.id);
                    if (!selected && !flash && !isPred && !isSucc) return null;
                    return (
                      <div
                        key={`hl-${task.id}`}
                        className={`pointer-events-none absolute left-0 right-0 ${selected
                          ? "bg-blue-100/60"
                          : isPred
                            ? "bg-amber-100/30"
                            : isSucc
                              ? "bg-emerald-100/30"
                              : ""
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

                  {showBaseline &&
                    rows.map(({ task }, i) => {
                      if (!task.baselineStart || !task.baselineFinish)
                        return null;
                      const bl = (toDay(task.baselineStart) - minDay) * zoom;
                      const bw = Math.max(
                        2,
                        (toDay(task.baselineFinish) -
                          toDay(task.baselineStart) +
                          1) *
                        zoom -
                        2
                      );
                      return (
                        <div
                          key={`bl-${task.id}`}
                          className="pointer-events-none absolute z-10 h-1 rounded bg-gray-400/80"
                          style={{ left: bl, top: i * ROW_H + 22, width: bw }}
                          title={`Baseline ${task.baselineStart} → ${task.baselineFinish}`}
                        />
                      );
                    })}

                  {showBaseline &&
                    rows.map(({ task }, i) => {
                      if (!task.actualStart) return null;
                      const aStartDay = toDay(task.actualStart);
                      const aEndDay = task.actualFinish
                        ? toDay(task.actualFinish)
                        : Math.max(todayDay, aStartDay);
                      const late =
                        !!task.actualFinish &&
                        !!task.baselineFinish &&
                        task.actualFinish > task.baselineFinish;
                      return (
                        <div
                          key={`ac-${task.id}`}
                          className={`pointer-events-none absolute z-10 h-1 rounded ${late ? "bg-orange-500" : "bg-emerald-500"
                            } ${task.actualFinish ? "" : "opacity-70"}`}
                          style={{
                            left: (aStartDay - minDay) * zoom,
                            top: i * ROW_H + 3,
                            width: Math.max(
                              2,
                              (aEndDay - aStartDay + 1) * zoom - 2
                            ),
                          }}
                          title={`Actual ${task.actualStart} → ${task.actualFinish ?? "in progress"
                            }`}
                        />
                      );
                    })}

                  {rows.map(({ task, hasChildren }, i) => {
                    const s = toDay(task.scheduleStart) - minDay;
                    const dur = durationDays(task);
                    const w = Math.max(
                      task.isMilestone ? 6 : 2,
                      dur * zoom - (task.isMilestone ? 0 : 2)
                    );
                    const critical =
                      !hasChildren && cpm.criticalIds.has(task.id);
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
                        onClick={() => {
                          if (consumeLongPress()) return;
                          handleRowClick(task.id, !!hasChildren);
                        }}
                        onDoubleClick={() => openEditorFromBar(task.id)}
                        onTouchStart={(e) => startLongPress(task.id, e)}
                        onTouchMove={moveLongPress}
                        onTouchEnd={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`absolute h-3 cursor-pointer select-none rounded ${barColor} z-10 ${selected ? "ring-2 ring-blue-500 ring-offset-1" : ""
                          }`}
                        style={{
                          left: s * zoom,
                          top: i * ROW_H + 8,
                          width: w,
                          WebkitTouchCallout: "none",
                        }}
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
      )}

      {/* ================= TABLE ================= */}
      <section className="overflow-x-auto rounded border">
        <table className="w-full min-w-[1750px] border-collapse text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="w-8 px-2 py-2">
                {!readOnly && (
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={toggleAllVisible}
                    title="Select / unselect all visible rows"
                  />
                )}
              </th>
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
              <th className="w-28 px-2 py-2" title="Actual start">
                Act. start
              </th>
              <th className="w-28 px-2 py-2" title="Actual finish">
                Act. finish
              </th>
              <th
                className="w-16 px-2 py-2"
                title="Finish vs baseline (days). + = late, − = early"
              >
                Var
              </th>
              <th className="w-64 px-2 py-2" title="Lag is in calendar days">Predecessors</th>
              <th className="w-64 px-2 py-2" title="Lag is in calendar days">Successors</th>
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
              const variance = finishVariance(task);
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
                    : predIds.has(task.id)
                      ? "bg-amber-50/70 hover:bg-amber-50"
                      : succIds.has(task.id)
                        ? "bg-emerald-50/70 hover:bg-emerald-50"
                        : critical && showCritical
                          ? "bg-red-50/40 hover:bg-red-50/70"
                          : "hover:bg-gray-50"
                    } ${flash ? "animate-pulse" : ""}`}
                >
                  <td
                    className="px-2 py-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!readOnly && (
                      <input
                        type="checkbox"
                        checked={checkedIds.has(task.id)}
                        onChange={() => toggleChecked(task.id)}
                      />
                    )}
                  </td>
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
                        updateDates(
                          task.id,
                          e.target.value,
                          task.scheduleFinish
                        )
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

                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={task.actualStart ?? ""}
                      disabled={isGroup || readOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateActual(task.id, "actualStart", e.target.value)
                      }
                      className="w-full rounded border px-1 py-0.5 text-xs disabled:bg-gray-100"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={task.actualFinish ?? ""}
                      disabled={isGroup || readOnly}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateActual(task.id, "actualFinish", e.target.value)
                      }
                      className="w-full rounded border px-1 py-0.5 text-xs disabled:bg-gray-100"
                    />
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums text-xs ${variance === null
                      ? "text-gray-400"
                      : variance > 0
                        ? "font-semibold text-red-600"
                        : variance < 0
                          ? "text-emerald-600"
                          : "text-gray-600"
                      }`}
                    title={
                      variance === null
                        ? "No baseline set"
                        : variance > 0
                          ? `${variance} day(s) later than baseline`
                          : variance < 0
                            ? `${-variance} day(s) earlier than baseline`
                            : "On baseline"
                    }
                  >
                    {variance === null
                      ? "—"
                      : variance > 0
                        ? `+${variance}d`
                        : `${variance}d`}
                  </td>

                  <td
                    className="relative px-2 py-1.5 align-top"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-1">
                      {preds.map((s) => {
                        const pred = tasks.find((t) => t.id === s.relatingTask);
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
                              title="Lag in calendar days (Sundays/holidays count). Negative = lead"
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
                    {!isGroup &&
                      !readOnly &&
                      isPickerOpen &&
                      picker.mode === "pred" && (
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
                        const succ = tasks.find((t) => t.id === s.relatedTask);
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
                              title="Lag in calendar days (Sundays/holidays count). Negative = lead"
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
                    {!isGroup &&
                      !readOnly &&
                      isPickerOpen &&
                      picker.mode === "succ" && (
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

      {/* ================= MOBILE ACTION BAR (selected row) ================= */}
      {selectedId && !readOnly && !editingId && (
        <div
          className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-4 rounded-full bg-gray-900 px-4 py-2 text-xs text-white shadow-lg md:hidden"
          data-print-hide
        >
          <button onClick={() => setEditingId(selectedId)}>Edit</button>
          <button onClick={() => addChild(selectedId)}>+ Child</button>
          <button onClick={() => moveSelected("up")}>↑</button>
          <button onClick={() => moveSelected("down")}>↓</button>
          <button onClick={() => setSelectedId(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* ================= EDIT MODAL ================= */}
      {editingTask && !readOnly && (
        <ActivityEditorModal
          key={editingTask.id}
          task={editingTask}
          tasks={tasks}
          sequences={sequences}
          calendar={calendar}
          useWorkdays={useWorkdays}
          isAdmin={isAdmin}
          onSave={(patch) => updateTask(editingTask.id, patch)}
          onDelete={() => deleteTask(editingTask.id)}
          onClose={() => setEditingId(null)}
          onCreateLinked={(mode) => addLinkedTask(editingTask.id, mode)}
          onApplyLinks={(next) =>
            setSequences((prev) => [
              ...prev.filter(
                (s) =>
                  s.relatingTask !== editingTask.id &&
                  s.relatedTask !== editingTask.id
              ),
              ...next,
            ])
          }
        />
      )}

      {/* ================= PASTE JSON MODAL ================= */}
      {pasteOpen && !readOnly && (
        <PasteJsonModal
          tasks={tasks}
          sequences={sequences}
          onApply={applyPaste}
          onClose={() => setPasteOpen(false)}
        />
      )}
      {scopedPasteOpen && !readOnly && (
        <PasteJsonModal
          tasks={tasks}
          sequences={sequences}
          restrictTo={new Set(selectionIds())}
          onApply={applyPaste}
          onClose={() => setScopedPasteOpen(false)}
        />
      )}

      {/* ================= BASELINE COMPARE ================= */}
      {compareOpen && (
        <BaselineCompare
          tasks={rolled}
          onClose={() => setCompareOpen(false)}
          onJump={(id) => {
            const ancestors = new Set<string>();
            let cur = tasks.find((t) => t.id === id)?.parentId ?? null;
            while (cur && !ancestors.has(cur)) {
              ancestors.add(cur);
              const p: string = cur;
              cur = tasks.find((t) => t.id === p)?.parentId ?? null;
            }
            expandAncestors(Array.from(ancestors));
            setCompareOpen(false);
            handleSelectFromSearch(id);
          }}
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