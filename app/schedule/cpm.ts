// app/schedule/cpm.ts
// Pure CPM math + Now/Next helpers. No React, no DOM.
// Depends on data.ts, scheduling.ts, calendar.ts.

import type { Sequence, Task } from "./data";
import { durationDays, toDay, toISO } from "./scheduling";
import {
  addWorkdays,
  countWorkdays,
  nextWorkday,
  type WorkingCalendar,
} from "./calendar";

// Re-export DAY so `import { DAY } from "./cpm"` keeps working.
// (The canonical definition lives in calendar.ts.)
export { DAY } from "./calendar";

// ---------- CPM result ----------
export interface CpmResult {
  earlyStart: Map<string, number>;
  earlyFinish: Map<string, number>;
  lateStart: Map<string, number>;
  lateFinish: Map<string, number>;
  totalFloat: Map<string, number>;
  criticalIds: Set<string>;
  projectStart: number;
  projectFinish: number;
}

// ---------- CPM (forward + backward pass) ----------
export function computeCpm(tasks: Task[], seqs: Sequence[]): CpmResult {
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();
  const totalFloat = new Map<string, number>();
  const criticalIds = new Set<string>();

  // ignore group rows — CPM is over leaves
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const leaves = tasks.filter((t) => !parents.has(t.id));
  const byId = new Map(leaves.map((t) => [t.id, t]));

  if (!leaves.length) {
    return {
      earlyStart,
      earlyFinish,
      lateStart,
      lateFinish,
      totalFloat,
      criticalIds,
      projectStart: 0,
      projectFinish: 0,
    };
  }

  // Build adjacency (only between leaves)
  const succ = new Map<string, Sequence[]>();
  const pred = new Map<string, Sequence[]>();
  for (const s of seqs) {
    if (!byId.has(s.relatingTask) || !byId.has(s.relatedTask)) continue;
    if (!succ.has(s.relatingTask)) succ.set(s.relatingTask, []);
    if (!pred.has(s.relatedTask)) pred.set(s.relatedTask, []);
    succ.get(s.relatingTask)!.push(s);
    pred.get(s.relatedTask)!.push(s);
  }

  // Topological order (Kahn)
  const indeg = new Map<string, number>();
  for (const t of leaves) indeg.set(t.id, pred.get(t.id)?.length ?? 0);
  const queue: string[] = leaves
    .filter((t) => indeg.get(t.id) === 0)
    .map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succ.get(id) ?? []) {
      indeg.set(s.relatedTask, (indeg.get(s.relatedTask) ?? 1) - 1);
      if (indeg.get(s.relatedTask) === 0) queue.push(s.relatedTask);
    }
  }
  // fallback if graph has cycles (shouldn't happen — wouldCycle prevents)
  if (order.length < leaves.length) {
    for (const t of leaves) if (!order.includes(t.id)) order.push(t.id);
  }

  // ---------- forward pass ----------
  for (const id of order) {
    const t = byId.get(id)!;
    const dur = durationDays(t) - 1; // inclusive-1
    const manualStart = toDay(t.scheduleStart);

    let es = manualStart; // honour user-set start as a minimum
    for (const s of pred.get(id) ?? []) {
      const p = byId.get(s.relatingTask)!;
      const pES = earlyStart.get(p.id) ?? toDay(p.scheduleStart);
      const pEF = earlyFinish.get(p.id) ?? pES + durationDays(p) - 1;
      let candidate: number;
      switch (s.sequenceType) {
        case "START_START":
          candidate = pES + s.lagDays;
          break;
        case "FINISH_FINISH":
          candidate = pEF + s.lagDays - dur;
          break;
        case "START_FINISH":
          candidate = pES + s.lagDays - dur;
          break;
        case "FINISH_START":
        default:
          candidate = pEF + 1 + s.lagDays;
          break;
      }
      if (candidate > es) es = candidate;
    }
    earlyStart.set(id, es);
    earlyFinish.set(id, es + dur);
  }

  // project finish / start
  let projectFinish = 0;
  for (const id of order) {
    const ef = earlyFinish.get(id) ?? 0;
    if (ef > projectFinish) projectFinish = ef;
  }
  let projectStart = Infinity;
  for (const id of order) {
    const es = earlyStart.get(id) ?? 0;
    if (es < projectStart) projectStart = es;
  }
  if (!isFinite(projectStart)) projectStart = 0;

  // ---------- backward pass ----------
  for (const id of order) lateFinish.set(id, projectFinish);

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const t = byId.get(id)!;
    const dur = durationDays(t) - 1;

    const ss = succ.get(id);
    if (!ss || ss.length === 0) {
      // terminal task — keep LF = projectFinish
      const lf = lateFinish.get(id) ?? projectFinish;
      lateFinish.set(id, lf);
      lateStart.set(id, lf - dur);
    } else {
      let lf = projectFinish;
      for (const s of ss) {
        const q = byId.get(s.relatedTask)!;
        const qLS = lateStart.get(q.id) ?? projectFinish;
        const qLF = lateFinish.get(q.id) ?? projectFinish;
        let candidate: number;
        switch (s.sequenceType) {
          case "START_START":
            candidate = qLS - s.lagDays + dur;
            break;
          case "FINISH_FINISH":
            candidate = qLF - s.lagDays;
            break;
          case "START_FINISH":
            candidate = qLF - s.lagDays + dur;
            break;
          case "FINISH_START":
          default:
            candidate = qLS - 1 - s.lagDays;
            break;
        }
        if (candidate < lf) lf = candidate;
      }
      lateFinish.set(id, lf);
      lateStart.set(id, lf - dur);
    }
  }

  // ---------- float + critical ----------
  for (const id of order) {
    const es = earlyStart.get(id) ?? 0;
    const ls = lateStart.get(id) ?? es;
    const f = ls - es;
    totalFloat.set(id, f);
    if (f <= 0) criticalIds.add(id);
  }

  return {
    earlyStart,
    earlyFinish,
    lateStart,
    lateFinish,
    totalFloat,
    criticalIds,
    projectStart,
    projectFinish,
  };
}

// ---------- working-day CPM ----------
/**
 * Working-day version of the CPM.
 *
 * Strategy: snap every leaf task's dates to the working calendar, run the
 * standard CPM on the snapped dates, then convert the resulting float from
 * calendar days to working days (counting only the working days inside the
 * float window) and recompute which tasks are critical from that float.
 *
 * Good enough for typical construction schedules (contiguous activities,
 * FS/SS/FF/SF links with small lags). For schedules with long shutdowns in
 * the middle of chains, a fully working-day backward pass would be more
 * accurate — but this is a deliberate readability trade-off.
 */
export function computeCpmWorkdays(
  tasks: Task[],
  seqs: Sequence[],
  cal: WorkingCalendar
): CpmResult {
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const snappedTasks: Task[] = tasks.map((t) => {
    if (parents.has(t.id)) return t;
    const s = nextWorkday(t.scheduleStart, cal);
    const wd = Math.max(1, countWorkdays(s, t.scheduleFinish, cal));
    // addWorkdays(start, n) moves forward n working days, so a task of
    // `wd` working days finishes `wd - 1` working days after its start.
    const f = addWorkdays(s, wd - 1, cal);
    return { ...t, scheduleStart: s, scheduleFinish: f };
  });

  const cpm = computeCpm(snappedTasks, seqs);

  const totalFloatWork = new Map<string, number>();
  const criticalIds = new Set<string>();
  for (const [id, f] of cpm.totalFloat) {
    let wf = f;
    if (f > 0) {
      const ef = cpm.earlyFinish.get(id);
      if (ef !== undefined) {
        wf = countWorkdays(toISO(ef + 1), toISO(ef + f), cal);
      }
    }
    totalFloatWork.set(id, wf);
    if (wf <= 0) criticalIds.add(id);
  }

  return { ...cpm, totalFloat: totalFloatWork, criticalIds };
}

// ---------- "now / next" ----------
export function findCurrentAndNext(
  tasks: Task[],
  cpm: CpmResult,
  todayDay: number
): { current?: Task; next?: Task } {
  const leaves = tasks.filter((t) => {
    const hasKids = tasks.some((c) => c.parentId === t.id);
    return !hasKids;
  });

  const sorted = [...leaves].sort((a, b) => {
    const aS = cpm.earlyStart.get(a.id) ?? toDay(a.scheduleStart);
    const bS = cpm.earlyStart.get(b.id) ?? toDay(b.scheduleStart);
    return aS - bS;
  });

  const current = sorted.find((t) => {
    const es = cpm.earlyStart.get(t.id) ?? toDay(t.scheduleStart);
    const ef = cpm.earlyFinish.get(t.id) ?? toDay(t.scheduleFinish);
    return es <= todayDay && todayDay <= ef;
  });

  const next = sorted.find((t) => {
    const es = cpm.earlyStart.get(t.id) ?? toDay(t.scheduleStart);
    return es > todayDay;
  });

  return { current, next };
}

// ---------- upcoming queue (for the "Next up" stepper) ----------
/**
 * All leaf tasks with early-start strictly after today, sorted by (es, name).
 * Drives the Next-up stepper in the header card.
 */
export function upcomingQueue(
  tasks: Task[],
  cpm: CpmResult,
  todayDay: number
): Task[] {
  const leaves = tasks.filter((t) => {
    const hasKids = tasks.some((c) => c.parentId === t.id);
    return !hasKids;
  });

  const withStart = leaves.map((t) => ({
    t,
    es: cpm.earlyStart.get(t.id) ?? toDay(t.scheduleStart),
  }));

  return withStart
    .filter((x) => x.es > todayDay)
    .sort((a, b) => a.es - b.es || a.t.name.localeCompare(b.t.name))
    .map((x) => x.t);
}

/** Days from today to the task's early start (0 = today, negative = past). */
export function daysUntil(
  task: Task,
  cpm: CpmResult,
  todayDay: number
): number {
  const es = cpm.earlyStart.get(task.id) ?? toDay(task.scheduleStart);
  return es - todayDay;
}

/** Human-friendly "in 2 days" / "tomorrow" / "today" label. */
export function humanizeDaysUntil(d: number): string {
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 7) return `in ${d} days`;
  if (d < 14) return "next week";
  if (d < 30) return `in ${Math.round(d / 7)} weeks`;
  if (d < 60) return "next month";
  return `in ${Math.round(d / 30)} months`;
}

// ---------- formatting / description helpers ----------
export const fmtDate = (day: number): string =>
  new Date(day * 86400000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** One-line description used by the Now / Next cards. */
export function describe(task: Task, allTasks: Task[]): string {
  if (task.remarks?.trim()) return task.remarks.trim();
  if (task.parentId) {
    const parent = allTasks.find((x) => x.id === task.parentId);
    return parent ? `Part of ${parent.name}` : "Project activity";
  }
  return "Project activity";
}