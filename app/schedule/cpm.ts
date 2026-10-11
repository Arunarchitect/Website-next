// app/schedule/cpm.ts
// Pure CPM math + Now/Next helpers. No React, no DOM.
// Depends on data.ts, scheduling.ts, calendar.ts.

import type { Sequence, Task } from "./data";
import { durationDays, toDay } from "./scheduling";
import {
  countWorkdays,
  isWorkday,
  nextWorkday,
  type WorkingCalendar,
} from "./calendar";

// Re-export DAY so `import { DAY } from "./cpm"` keeps working.
// (The canonical definition lives in calendar.ts.)
export { DAY } from "./calendar";

// ---------- finished-task helpers ----------
/**
 * A finished task is history: its ACTUAL dates are the truth.
 * CPM never moves it, never snaps it to the working calendar, and ignores
 * any incoming link that would contradict it. It still acts as a
 * predecessor, using its real dates.
 */
const isDone = (t: Task): boolean => t.completion >= 100 || !!t.actualFinish;
const doneStart = (t: Task): string => t.actualStart ?? t.scheduleStart;
const doneFinish = (t: Task): string => t.actualFinish ?? t.scheduleFinish;

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

const emptyResult = (): CpmResult => ({
  earlyStart: new Map(),
  earlyFinish: new Map(),
  lateStart: new Map(),
  lateFinish: new Map(),
  totalFloat: new Map(),
  criticalIds: new Set(),
  projectStart: 0,
  projectFinish: 0,
});

// ---------- generic CPM core ----------
/**
 * One node = one leaf task expressed in an arbitrary integer "unit space".
 *  - calendar mode: units are day numbers
 *  - working mode : units are working-day indexes (weekends/holidays removed)
 * es0 = the task's own start (acts as a floor), dur = length - 1 (inclusive).
 *
 * fixed = finished task: pinned to its real dates. startDay / finishDay are
 * the real day numbers (used in working mode, where the index space cannot
 * represent a Sunday / holiday date exactly).
 */
interface CoreNode {
  id: string;
  es0: number;
  dur: number;
  fixed?: boolean;
  startDay?: number;
  finishDay?: number;
}

interface CoreResult {
  es: Map<string, number>;
  ef: Map<string, number>;
  ls: Map<string, number>;
  lf: Map<string, number>;
  float: Map<string, number>;
  critical: Set<string>;
  pStart: number;
  pFinish: number;
}

/**
 * Calendar map, only passed in working-day mode. It lets the core convert
 * between working-day indexes and real day numbers so that LAG can be
 * counted in calendar days (curing, drying) and then snapped forward to the
 * next working day.
 */
interface CalMap {
  dayOf: (i: number) => number; // working-day index -> day number
  idxOf: (day: number) => number; // day number -> index of first workday on/after it
  size: number; // number of working days in the table
}

function runCore(nodes: CoreNode[], seqs: Sequence[], cal?: CalMap): CoreResult {
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  const float = new Map<string, number>();
  const critical = new Set<string>();

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Largest working-day index i with f(i) <= limit (f is non-decreasing).
  const latestIdx = (f: (i: number) => number, limit: number): number => {
    let lo = -1;
    let hi = cal!.size - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (f(mid) <= limit) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  // adjacency (only between the given nodes)
  const succ = new Map<string, Sequence[]>();
  const pred = new Map<string, Sequence[]>();
  for (const s of seqs) {
    if (!byId.has(s.relatingTask) || !byId.has(s.relatedTask)) continue;
    if (!succ.has(s.relatingTask)) succ.set(s.relatingTask, []);
    if (!pred.has(s.relatedTask)) pred.set(s.relatedTask, []);
    succ.get(s.relatingTask)!.push(s);
    pred.get(s.relatedTask)!.push(s);
  }

  // topological order (Kahn)
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, pred.get(n.id)?.length ?? 0);
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succ.get(id) ?? []) {
      indeg.set(s.relatedTask, (indeg.get(s.relatedTask) ?? 1) - 1);
      if (indeg.get(s.relatedTask) === 0) queue.push(s.relatedTask);
    }
  }
  if (order.length < nodes.length) {
    for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  }

  // forward pass
  for (const id of order) {
    const n = byId.get(id)!;
    let e = n.es0; // user-set start is a floor
    // Finished tasks ignore their incoming links entirely.
    const incoming = n.fixed ? [] : pred.get(id) ?? [];
    for (const s of incoming) {
      const p = byId.get(s.relatingTask)!;
      const pES = es.get(p.id) ?? p.es0;
      const pEF = ef.get(p.id) ?? pES + p.dur;
      let cand: number;
      if (cal) {
        // A finished predecessor uses its REAL day numbers (it may sit on a
        // Sunday/holiday). Otherwise convert the working-day index.
        const pSD =
          p.fixed && p.startDay != null ? p.startDay : cal.dayOf(pES);
        const pFD =
          p.fixed && p.finishDay != null ? p.finishDay : cal.dayOf(pEF);
        // lag = calendar days; result snaps forward to the next workday
        switch (s.sequenceType) {
          case "START_START":
            cand = cal.idxOf(pSD + s.lagDays);
            break;
          case "FINISH_FINISH":
            cand = cal.idxOf(pFD + s.lagDays) - n.dur;
            break;
          case "START_FINISH":
            cand = cal.idxOf(pSD + s.lagDays) - n.dur;
            break;
          case "FINISH_START":
          default:
            cand = cal.idxOf(pFD + 1 + s.lagDays);
            break;
        }
      } else {
        switch (s.sequenceType) {
          case "START_START":
            cand = pES + s.lagDays;
            break;
          case "FINISH_FINISH":
            cand = pEF + s.lagDays - n.dur;
            break;
          case "START_FINISH":
            cand = pES + s.lagDays - n.dur;
            break;
          case "FINISH_START":
          default:
            cand = pEF + 1 + s.lagDays;
            break;
        }
      }
      if (cand > e) e = cand;
    }
    es.set(id, e);
    ef.set(id, e + n.dur);
  }

  let pFinish = -Infinity;
  let pStart = Infinity;
  for (const id of order) {
    pFinish = Math.max(pFinish, ef.get(id)!);
    pStart = Math.min(pStart, es.get(id)!);
  }
  if (!isFinite(pFinish)) pFinish = 0;
  if (!isFinite(pStart)) pStart = 0;

  // backward pass
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const n = byId.get(id)!;

    // Finished task: no slack, late dates = early dates.
    if (n.fixed) {
      lf.set(id, ef.get(id)!);
      ls.set(id, es.get(id)!);
      continue;
    }

    let f = pFinish;
    for (const s of succ.get(id) ?? []) {
      const q = byId.get(s.relatedTask)!;
      if (q.fixed) continue; // a finished successor does not constrain us
      const qLS = ls.get(q.id) ?? pFinish - q.dur;
      const qLF = lf.get(q.id) ?? pFinish;
      let cand: number;
      if (cal) {
        // latest predecessor position that still satisfies the forward rule
        switch (s.sequenceType) {
          case "START_START":
            cand =
              latestIdx((k) => cal.idxOf(cal.dayOf(k) + s.lagDays), qLS) +
              n.dur;
            break;
          case "FINISH_FINISH":
            cand = latestIdx((k) => cal.idxOf(cal.dayOf(k) + s.lagDays), qLF);
            break;
          case "START_FINISH":
            cand =
              latestIdx((k) => cal.idxOf(cal.dayOf(k) + s.lagDays), qLF) +
              n.dur;
            break;
          case "FINISH_START":
          default:
            cand = latestIdx(
              (k) => cal.idxOf(cal.dayOf(k) + 1 + s.lagDays),
              qLS
            );
            break;
        }
      } else {
        switch (s.sequenceType) {
          case "START_START":
            cand = qLS - s.lagDays + n.dur;
            break;
          case "FINISH_FINISH":
            cand = qLF - s.lagDays;
            break;
          case "START_FINISH":
            cand = qLF - s.lagDays + n.dur;
            break;
          case "FINISH_START":
          default:
            cand = qLS - 1 - s.lagDays;
            break;
        }
      }
      if (cand < f) f = cand;
    }
    lf.set(id, f);
    ls.set(id, f - n.dur);
  }

  // float + critical (finished tasks: 0 float, never critical)
  for (const id of order) {
    if (byId.get(id)!.fixed) {
      float.set(id, 0);
      continue;
    }
    const fl = ls.get(id)! - es.get(id)!;
    float.set(id, fl);
    if (fl <= 0) critical.add(id);
  }

  return { es, ef, ls, lf, float, critical, pStart, pFinish };
}

const leavesOf = (tasks: Task[]): Task[] => {
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  return tasks.filter((t) => !parents.has(t.id));
};

// ---------- CPM (calendar days) ----------
export function computeCpm(tasks: Task[], seqs: Sequence[]): CpmResult {
  const leaves = leavesOf(tasks);
  if (!leaves.length) return emptyResult();

  const core = runCore(
    leaves.map((t): CoreNode => {
      if (isDone(t)) {
        const s = toDay(doneStart(t));
        return {
          id: t.id,
          es0: s,
          dur: Math.max(0, toDay(doneFinish(t)) - s),
          fixed: true,
        };
      }
      return {
        id: t.id,
        es0: toDay(t.scheduleStart),
        dur: durationDays(t) - 1,
      };
    }),
    seqs
  );

  return {
    earlyStart: core.es,
    earlyFinish: core.ef,
    lateStart: core.ls,
    lateFinish: core.lf,
    totalFloat: core.float,
    criticalIds: core.critical,
    projectStart: core.pStart,
    projectFinish: core.pFinish,
  };
}

// ---------- CPM (working days) ----------
/**
 * Working-day CPM. Saturdays, Sundays, holidays and shutdown ranges do not
 * exist in the calculation:
 *  - every date is mapped to a working-day index,
 *  - task durations are counted in working days,
 *  - LAG is counted in CALENDAR days (curing/drying), then snapped forward
 *    to the next working day, matching autoScheduleWorkdays,
 *  - float is in working days, so a Fri -> Mon link has zero float,
 *  - results are mapped back to real dates (day numbers).
 *
 * Finished tasks are NOT snapped: they keep their real actual dates (even
 * on an off day), ignore their incoming links, and report 0 float.
 */
export function computeCpmWorkdays(
  tasks: Task[],
  seqs: Sequence[],
  cal: WorkingCalendar
): CpmResult {
  const leaves = leavesOf(tasks);
  if (!leaves.length) return emptyResult();

  // Snap each unfinished leaf to a working start and a working-day length.
  // Finished leaves keep their real dates.
  const snapped = leaves.map((t) => {
    const done = isDone(t);
    const start = done ? doneStart(t) : nextWorkday(t.scheduleStart, cal);
    const finish = done ? doneFinish(t) : t.scheduleFinish;
    const wd = Math.max(1, countWorkdays(start, finish, cal));
    return {
      id: t.id,
      startDay: toDay(start),
      finishDay: toDay(finish),
      wd,
      fixed: done,
    };
  });

  // Working-day index table over a generous window.
  const minStart = Math.min(...snapped.map((s) => s.startDay));
  const maxStart = Math.max(
    ...snapped.map((s) => Math.max(s.startDay, s.finishDay))
  );
  const base = minStart - 366; // room for negative lags
  const horizon =
    maxStart + snapped.reduce((a, s) => a + s.wd, 0) + 3650; // room to grow

  const workDays: number[] = []; // index -> day number
  const cum: number[] = []; // cum[d - base] = working days before day d
  for (let d = base; d <= horizon; d++) {
    cum.push(workDays.length);
    if (isWorkday(d, cal)) workDays.push(d);
  }
  // Number of workdays before `day` = index of the first workday on/after it.
  const idxOf = (day: number) =>
    cum[Math.max(0, Math.min(cum.length - 1, day - base))];
  const dayOf = (i: number) =>
    workDays[Math.max(0, Math.min(workDays.length - 1, i))];

  const core = runCore(
    snapped.map(
      (s): CoreNode => ({
        id: s.id,
        es0: idxOf(s.startDay),
        dur: s.wd - 1,
        fixed: s.fixed,
        startDay: s.startDay,
        finishDay: s.finishDay,
      })
    ),
    seqs,
    { dayOf, idxOf, size: workDays.length }
  );

  const toDays = (m: Map<string, number>) => {
    const out = new Map<string, number>();
    for (const [id, i] of m) out.set(id, dayOf(i));
    return out;
  };

  const eS = toDays(core.es);
  const eF = toDays(core.ef);
  const lS = toDays(core.ls);
  const lF = toDays(core.lf);

  // Finished tasks report their real dates, even on an off day.
  for (const s of snapped) {
    if (!s.fixed) continue;
    eS.set(s.id, s.startDay);
    lS.set(s.id, s.startDay);
    eF.set(s.id, s.finishDay);
    lF.set(s.id, s.finishDay);
  }

  return {
    earlyStart: eS,
    earlyFinish: eF,
    lateStart: lS,
    lateFinish: lF,
    totalFloat: core.float, // already in working days
    criticalIds: core.critical,
    projectStart: dayOf(core.pStart),
    projectFinish: dayOf(core.pFinish),
  };
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

// ---------- all tasks running today ----------
/**
 * Every unfinished leaf task whose early window covers today.
 * Critical first, then earliest finish, then name.
 */
export function findAllCurrent(
  tasks: Task[],
  cpm: CpmResult,
  todayDay: number
): Task[] {
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const fin = (t: Task) =>
    cpm.earlyFinish.get(t.id) ?? toDay(t.scheduleFinish);

  return tasks
    .filter((t) => {
      if (parents.has(t.id)) return false;
      if (t.completion >= 100) return false;
      const es = cpm.earlyStart.get(t.id) ?? toDay(t.scheduleStart);
      return es <= todayDay && todayDay <= fin(t);
    })
    .sort((a, b) => {
      const ca = cpm.criticalIds.has(a.id) ? 0 : 1;
      const cb = cpm.criticalIds.has(b.id) ? 0 : 1;
      return ca - cb || fin(a) - fin(b) || a.name.localeCompare(b.name);
    });
}

// ---------- upcoming queue (for the "Next up" stepper) ----------
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