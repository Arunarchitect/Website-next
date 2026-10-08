// app/schedule/scheduling.ts
// Pure date + hierarchy helpers. No React, no DOM.
// Depends on calendar.ts for holiday-aware helpers.

import type { Sequence, Task } from "./data";
import {
  addWorkdays,
  countWorkdays,
  isHoliday,
  nextWorkday,
  prevWorkday,
  DAY,
  type WorkingCalendar,
} from "./calendar";

// ---------- date math (day numbers) ----------
export const toDay = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const toISO = (day: number): string =>
  new Date(day * DAY).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number): string =>
  toISO(toDay(iso) + n);
export const durationDays = (t: Task): number =>
  toDay(t.scheduleFinish) - toDay(t.scheduleStart) + 1;
export const todayISO = (): string => {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

// ISO dates (YYYY-MM-DD) sort correctly as strings.
const minIso = (xs: string[]): string => xs.reduce((a, b) => (a < b ? a : b));
const maxIso = (xs: string[]): string => xs.reduce((a, b) => (a > b ? a : b));

// ---------- hierarchy ----------
export interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
  wbs: string;
}

export function flatten(tasks: Task[], collapsed: Set<string>): Row[] {
  const out: Row[] = [];
  const walk = (parent: string | null, depth: number, prefix: string) => {
    tasks
      .filter((t) => t.parentId === parent)
      .forEach((t, i) => {
        const wbs = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const hasChildren = tasks.some((c) => c.parentId === t.id);
        out.push({ task: t, depth, hasChildren, wbs });
        if (hasChildren && !collapsed.has(t.id)) walk(t.id, depth + 1, wbs);
      });
  };
  walk(null, 0, "");
  return out;
}

export function descendantIds(tasks: Task[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    tasks.forEach((t) => {
      if (t.parentId === x && !out.has(t.id)) {
        out.add(t.id);
        stack.push(t.id);
      }
    });
  }
  return out;
}

export function ancestorIds(tasks: Task[], id: string): Set<string> {
  const out = new Set<string>();
  let cur: string | null | undefined = tasks.find((t) => t.id === id)?.parentId;
  while (cur && !out.has(cur)) {
    out.add(cur);
    const p: string = cur;
    cur = tasks.find((t) => t.id === p)?.parentId;
  }
  return out;
}

// Group (summary) tasks take dates + % from their children.
// Baseline: earliest child baseline start / latest child baseline finish.
// Actual:   earliest child actual start; actual finish only once EVERY child has finished.
export function rollup(tasks: Task[]): Task[] {
  const map = new Map(tasks.map((t) => [t.id, { ...t }]));
  const kids = new Map<string, string[]>();
  tasks.forEach((t) => {
    if (t.parentId) kids.set(t.parentId, [...(kids.get(t.parentId) ?? []), t.id]);
  });
  const visit = (id: string) => {
    const k = kids.get(id);
    if (!k) return;
    k.forEach(visit);
    const ch = k.map((c) => map.get(c)!);
    const s = Math.min(...ch.map((c) => toDay(c.scheduleStart)));
    const f = Math.max(...ch.map((c) => toDay(c.scheduleFinish)));
    const total = ch.reduce((a, c) => a + durationDays(c), 0);
    const done = ch.reduce((a, c) => a + durationDays(c) * c.completion, 0);
    const g = map.get(id)!;
    g.scheduleStart = toISO(s);
    g.scheduleFinish = toISO(f);
    g.completion = total > 0 ? Math.round(done / total) : 0;
    g.isMilestone = false;

    const bStarts = ch.map((c) => c.baselineStart).filter((x): x is string => !!x);
    const bFins = ch.map((c) => c.baselineFinish).filter((x): x is string => !!x);
    g.baselineStart = bStarts.length ? minIso(bStarts) : null;
    g.baselineFinish = bFins.length ? maxIso(bFins) : null;

    const aStarts = ch.map((c) => c.actualStart).filter((x): x is string => !!x);
    const aFins = ch.map((c) => c.actualFinish).filter((x): x is string => !!x);
    g.actualStart = aStarts.length ? minIso(aStarts) : null;
    g.actualFinish = aFins.length === ch.length ? maxIso(aFins) : null;
  };
  tasks
    .filter((t) => !t.parentId || !map.has(t.parentId))
    .forEach((t) => visit(t.id));
  return tasks.map((t) => map.get(t.id)!);
}

// ---------- baseline / actual ----------
/** Freeze the current dates as the baseline (overwrites any existing baseline). */
export function setBaseline(tasks: Task[]): Task[] {
  return tasks.map((t) => ({
    ...t,
    baselineStart: t.scheduleStart,
    baselineFinish: t.scheduleFinish,
  }));
}

/**
 * Finish variance in days against the baseline. Positive = late, negative = early.
 * Uses the actual finish once the task is done, otherwise the current forecast.
 * Returns null when there is no baseline.
 */
export function finishVariance(t: Task): number | null {
  if (!t.baselineFinish) return null;
  const end = t.actualFinish ?? t.scheduleFinish;
  return toDay(end) - toDay(t.baselineFinish);
}

/**
 * Set completion and keep the actual dates in step:
 *  - first time % goes above 0   -> actualStart = today (if empty)
 *  - reaches 100                 -> actualFinish = today (if empty), actualStart filled if missing
 *  - drops below 100             -> actualFinish cleared
 *  - back to 0                   -> actualStart and actualFinish cleared
 * actualFinish is never earlier than actualStart.
 */
export function applyProgress(t: Task, completion: number, today: string): Task {
  const c = Math.max(0, Math.min(100, completion));
  let actualStart = t.actualStart ?? null;
  let actualFinish = t.actualFinish ?? null;

  if (c === 0) {
    actualStart = null;
    actualFinish = null;
  } else {
    if (!actualStart) actualStart = today;
    if (c >= 100) {
      if (!actualFinish) actualFinish = today > actualStart ? today : actualStart;
    } else {
      actualFinish = null;
    }
  }
  return { ...t, completion: c, actualStart, actualFinish };
}


/**
 * Completion rule: a task can only be 100% when every predecessor is 100%.
 * Returns an error message when the change is not allowed, else null.
 *  - going to 100%  -> blocked if any predecessor is below 100%
 *  - dropping below 100% -> blocked if any successor is already 100%
 */
export function completionBlocker(
  id: string,
  pct: number,
  tasks: Task[],
  seqs: Sequence[]
): string | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const names = (list: (Task | undefined)[]) =>
    [...new Set(list.filter((t): t is Task => !!t).map((t) => `"${t.name}"`))].join(", ");

  if (pct >= 100) {
    const open = seqs
      .filter((s) => s.relatedTask === id)
      .map((s) => byId.get(s.relatingTask))
      .filter((p) => p && p.completion < 100);
    if (open.length) {
      return `Can't mark 100%: predecessor ${names(open)} is not 100% yet.`;
    }
  } else {
    const done = seqs
      .filter((s) => s.relatingTask === id)
      .map((s) => byId.get(s.relatedTask))
      .filter((t) => t && t.completion >= 100);
    if (done.length) {
      return `Can't reduce below 100%: successor ${names(done)} is already 100%.`;
    }
  }
  return null;
}
// ---------- dependencies ----------
/** Started or finished tasks are never moved by auto-schedule. */
const isLocked = (t: Task): boolean =>
  !!t.actualStart || !!t.actualFinish || t.completion > 0;

// Prefer real dates over planned dates when a predecessor has them.
const effStart = (t: Task): string => t.actualStart ?? t.scheduleStart;
const effFinish = (t: Task): string => t.actualFinish ?? t.scheduleFinish;

/**
 * Tasks at 100% get their actual dates filled in (then they are locked):
 *  - actualFinish = planned finish if that is today or earlier, else today
 *  - actualStart  = planned start (never later than actualFinish)
 * Group rows are skipped (they roll up from their children).
 */
/**
 * Tasks at 100% are normalised so nothing "completed" sits in the future:
 *  - actualFinish: filled if missing (planned finish if <= today, else today),
 *    and clamped to today if it is later.
 *  - actualStart: filled if missing (planned start, never after actualFinish),
 *    and pulled back to actualFinish if it is later.
 *  - planned start/finish: clamped so finish <= today and start <= finish.
 * Group rows are skipped (they roll up from their children).
 */
function finalizeCompleted(
  tasks: Task[],
  parents: Set<string>,
  today: string,
  cal?: WorkingCalendar
): Task[] {
  return tasks.map((t) => {
    if (parents.has(t.id)) return t;

    if (t.completion < 100) {
      // "Started" in the future: invalid. Drop it (or use today if it has progress).
      if (t.actualStart && t.actualStart > today && !t.actualFinish) {
        return { ...t, actualStart: t.completion > 0 ? today : null };
      }

      // Started, not finished: planned dates follow reality.
      // Start = actual start, same length, finish never before today.
      if (t.actualStart && !t.actualFinish && !t.isMilestone) {
        const start = t.actualStart;
        let finish: string;
        if (cal) {
          const wdur = Math.max(
            1,
            countWorkdays(t.scheduleStart, t.scheduleFinish, cal)
          );
          finish = addWorkdays(nextWorkday(start, cal), wdur - 1, cal);
          if (finish < today) finish = nextWorkday(today, cal);
        } else {
          const dur = toDay(t.scheduleFinish) - toDay(t.scheduleStart);
          finish = toISO(toDay(start) + Math.max(0, dur));
          if (finish < today) finish = today;
        }
        if (start === t.scheduleStart && finish === t.scheduleFinish) return t;
        return { ...t, scheduleStart: start, scheduleFinish: finish };
      }
      return t;
    }

    // ---- completed tasks: nothing may sit in the future ----
    let actualFinish =
      t.actualFinish ??
      (t.scheduleFinish <= today ? t.scheduleFinish : today);
    if (actualFinish > today) actualFinish = today;

    let actualStart =
      t.actualStart ??
      (t.scheduleStart <= actualFinish ? t.scheduleStart : actualFinish);
    if (actualStart > actualFinish) actualStart = actualFinish;

    const scheduleFinish =
      t.scheduleFinish > today ? today : t.scheduleFinish;
    const scheduleStart =
      t.scheduleStart > scheduleFinish ? scheduleFinish : t.scheduleStart;

    if (
      actualStart === t.actualStart &&
      actualFinish === t.actualFinish &&
      scheduleStart === t.scheduleStart &&
      scheduleFinish === t.scheduleFinish
    ) {
      return t;
    }
    return { ...t, actualStart, actualFinish, scheduleStart, scheduleFinish };
  });
}


/**
 * Order task ids so every predecessor comes before its successors (Kahn).
 * Only links between the given ids count. If the graph has a loop, the
 * leftover ids are appended so nothing is dropped.
 */
function topoOrder(ids: string[], seqs: Sequence[]): string[] {
  const idSet = new Set(ids);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const succ = new Map<string, string[]>();
  for (const s of seqs) {
    if (!idSet.has(s.relatingTask) || !idSet.has(s.relatedTask)) continue;
    indeg.set(s.relatedTask, (indeg.get(s.relatedTask) ?? 0) + 1);
    succ.set(s.relatingTask, [...(succ.get(s.relatingTask) ?? []), s.relatedTask]);
  }
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const n of succ.get(id) ?? []) {
      const d = (indeg.get(n) ?? 1) - 1;
      indeg.set(n, d);
      if (d === 0) queue.push(n);
    }
  }
  if (order.length < ids.length) {
    for (const id of ids) if (!order.includes(id)) order.push(id);
  }
  return order;
}

/**
 * Auto-schedule (calendar days, ignores holidays).
 *
 * - Completed / started tasks and groups are never moved.
 * - Unfinished task with no predecessor -> anchor
 *   (anchor = later of: earliest start in the schedule, today).
 * - Unfinished task with predecessors -> latest date its links allow,
 *   but never earlier than the anchor.
 *
 * compress = true (default): tasks sit exactly at their earliest start.
 * compress = false: tasks are only pushed later, never pulled earlier.
 */
export function autoSchedule(
  tasks: Task[],
  seqs: Sequence[],
  compress = true
): Task[] {
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const today = todayISO();
  tasks = finalizeCompleted(tasks, parents, today);

  const leaves = tasks.filter((t) => !parents.has(t.id));
  if (!leaves.length) return rollup(tasks);

  const earliest = Math.min(...leaves.map((t) => toDay(t.scheduleStart)));
  const anchor = Math.max(earliest, toDay(today));
  const map = new Map(tasks.map((t) => [t.id, t]));

  for (const id of topoOrder(leaves.map((t) => t.id), seqs)) {
    const q = map.get(id);
    if (!q || isLocked(q)) continue;
    const qs = toDay(q.scheduleStart);
    const dur = toDay(q.scheduleFinish) - qs;

    let target: number | null = null;
    for (const s of seqs) {
      if (s.relatedTask !== id) continue;
      const p = map.get(s.relatingTask);
      if (!p || parents.has(p.id)) continue;
      const ps = toDay(effStart(p));
      const pf = toDay(effFinish(p));
      let candidate: number;
      switch (s.sequenceType) {
        case "START_START":
          candidate = ps + s.lagDays;
          break;
        case "FINISH_FINISH":
          candidate = pf + s.lagDays - dur;
          break;
        case "START_FINISH":
          candidate = ps + s.lagDays - dur;
          break;
        case "FINISH_START":
        default:
          candidate = pf + 1 + s.lagDays;
          break;
      }
      if (target === null || candidate > target) target = candidate;
    }

    // No predecessor -> anchor. Has predecessor -> never before anchor.
    target = target === null ? anchor : Math.max(target, anchor);
    if (!compress) target = Math.max(target, qs);

    if (target !== qs) {
      map.set(id, {
        ...q,
        scheduleStart: toISO(target),
        scheduleFinish: toISO(target + dur),
      });
    }
  }
  return rollup(tasks.map((t) => map.get(t.id)!));
}

/**
 * Working-day variant of autoSchedule (holiday aware).
 *
 * Same rules as above, plus:
 *  - every start snaps FORWARD to the next working day (weekly off days,
 *    holidays and shutdown ranges are skipped), even for 1-day tasks;
 *  - every task keeps its length in WORKING days, so a task that crosses a
 *    holiday is stretched over it (Mon-Wed with a Tue holiday -> Mon-Thu);
 *  - tasks that are not moved by links are still re-snapped, so nothing is
 *    left sitting on a holiday.
 */
export function autoScheduleWorkdays(
  tasks: Task[],
  seqs: Sequence[],
  cal: WorkingCalendar,
  compress = true
): Task[] {
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const today = todayISO();
  tasks = finalizeCompleted(tasks, parents, today, cal);

  const leaves = tasks.filter((t) => !parents.has(t.id));
  if (!leaves.length) return rollup(tasks);

  const earliest = Math.min(...leaves.map((t) => toDay(t.scheduleStart)));
  const anchor = toDay(
    nextWorkday(toISO(Math.max(earliest, toDay(today))), cal)
  );
  const map = new Map(tasks.map((t) => [t.id, t]));

  for (const id of topoOrder(leaves.map((t) => t.id), seqs)) {
    const q = map.get(id);
    if (!q || isLocked(q)) continue;
    const qs = toDay(q.scheduleStart);
    // Length in working days (a task sitting entirely on a holiday counts as 1).
    const wdur = Math.max(
      1,
      countWorkdays(q.scheduleStart, q.scheduleFinish, cal)
    );

    let target: number | null = null;
    for (const s of seqs) {
      if (s.relatedTask !== id) continue;
      const p = map.get(s.relatingTask);
      if (!p || parents.has(p.id)) continue;
      const ps = toDay(effStart(p));
      const pf = toDay(effFinish(p));
      let earliestDay: number;
      switch (s.sequenceType) {
        case "START_START":
          earliestDay = ps + s.lagDays;
          break;
        case "FINISH_FINISH":
          earliestDay = pf + s.lagDays - (wdur - 1);
          break;
        case "START_FINISH":
          earliestDay = ps + s.lagDays - (wdur - 1);
          break;
        case "FINISH_START":
        default:
          earliestDay = pf + 1 + s.lagDays;
          break;
      }
      if (target === null || earliestDay > target) target = earliestDay;
    }

    // No predecessor -> anchor. Has predecessor -> never before anchor.
    let startDay = target === null ? anchor : Math.max(target, anchor);
    if (!compress) startDay = Math.max(startDay, qs);

    // Holiday handling: land on a working day, then stretch over holidays.
    const start = nextWorkday(toISO(startDay), cal);
    const finish = addWorkdays(start, wdur - 1, cal);

    if (start !== q.scheduleStart || finish !== q.scheduleFinish) {
      map.set(id, { ...q, scheduleStart: start, scheduleFinish: finish });
    }
  }
  return rollup(tasks.map((t) => map.get(t.id)!));
}

// Would adding predecessor -> successor create a loop?
export function wouldCycle(
  seqs: Sequence[],
  predecessor: string,
  successor: string
): boolean {
  if (predecessor === successor) return true;
  const stack = [successor];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === predecessor) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    seqs.forEach((s) => {
      if (s.relatingTask === id) stack.push(s.relatedTask);
    });
  }
  return false;
}

// ---------- duration (calendar-day) ----------
/**
 * Change a task's duration by shifting its finish date.
 * Start date is preserved; finish = start + newDays - 1 (inclusive).
 * newDays is clamped to a minimum of 1.
 */
export function setDuration(task: Task, newDays: number): Task {
  const days = Math.max(1, Math.round(newDays));
  const startDay = toDay(task.scheduleStart);
  const finishDay = startDay + days - 1;
  return { ...task, scheduleFinish: toISO(finishDay) };
}

// ---------- duration (working-day) ----------
export function durationWorkdays(task: Task, cal?: WorkingCalendar): number {
  if (!cal) return durationDays(task);
  return Math.max(1, countWorkdays(task.scheduleStart, task.scheduleFinish, cal));
}

export function setDurationWithCalendar(
  task: Task,
  newDays: number,
  cal?: WorkingCalendar
): Task {
  const days = Math.max(1, Math.round(newDays));
  if (!cal) {
    const startDay = toDay(task.scheduleStart);
    return { ...task, scheduleFinish: toISO(startDay + days - 1) };
  }
  const start = nextWorkday(task.scheduleStart, cal);
  const finish = addWorkdays(start, days - 1, cal);
  return { ...task, scheduleStart: start, scheduleFinish: finish };
}

/** True if the task's span touches any holiday. Useful for warnings. */
export function hasHolidayInside(task: Task, cal: WorkingCalendar): boolean {
  const s = toDay(task.scheduleStart);
  const f = toDay(task.scheduleFinish);
  for (let d = s; d <= f; d++) if (isHoliday(d, cal)) return true;
  return false;
}

// ---------- snap an inclusive range to working days ----------
/**
 * Snap [startISO, finishISO] to a working-day-only range:
 *   - start snaps FORWARD to the next workday ≥ startISO
 *   - finish snaps BACKWARD to the previous workday ≤ finishISO
 *   - if the snapped finish ends up before the snapped start, it becomes
 *     the snapped start (a 1-working-day task)
 *
 * Callers in calendar mode should NOT use this.
 */
export function snapRangeToWorkdays(
  startISO: string,
  finishISO: string,
  cal: WorkingCalendar
): { start: string; finish: string } {
  const start = nextWorkday(startISO, cal);
  let finish = prevWorkday(finishISO, cal);
  if (finish < start) finish = start;
  return { start, finish };
}

/** ISO-8601 week number for a date (used for Gantt week labels). */
export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}