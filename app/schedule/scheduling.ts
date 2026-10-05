// app/schedule/scheduling.ts
// Pure date + hierarchy helpers. No React, no DOM.
// Depends on calendar.ts for holiday-aware helpers.

import type { Sequence, Task } from "./data";
import {
  addWorkdays,
  countWorkdays,
  isHoliday,
  nextWorkday,
  DAY,
  type WorkingCalendar,
} from "./calendar";

// ---------- date math (day numbers) ----------
export const toDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
export const toISO = (day: number) =>
  new Date(day * DAY).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toISO(toDay(iso) + n);
export const durationDays = (t: Task) =>
  toDay(t.scheduleFinish) - toDay(t.scheduleStart) + 1;
export const todayISO = () => {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};

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

export function descendantIds(tasks: Task[], id: string) {
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

export function ancestorIds(tasks: Task[], id: string) {
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
  };
  tasks
    .filter((t) => !t.parentId || !map.has(t.parentId))
    .forEach((t) => visit(t.id));
  return tasks.map((t) => map.get(t.id)!);
}

// ---------- dependencies ----------
// Forward pass: push successors later when a link is violated (never pulls earlier).
export function autoSchedule(tasks: Task[], seqs: Sequence[]): Task[] {
  const parents = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  let cur = rollup(tasks);
  for (let i = 0; i <= tasks.length; i++) {
    const map = new Map(cur.map((t) => [t.id, t]));
    let changed = false;
    for (const s of seqs) {
      const p = map.get(s.relatingTask);
      const q = map.get(s.relatedTask);
      if (!p || !q || parents.has(q.id)) continue; // groups are derived
      const dur = toDay(q.scheduleFinish) - toDay(q.scheduleStart);
      const ps = toDay(p.scheduleStart);
      const pf = toDay(p.scheduleFinish);
      let earliest: number;
      switch (s.sequenceType) {
        case "FINISH_START":
          earliest = pf + 1 + s.lagDays;
          break;
        case "START_START":
          earliest = ps + s.lagDays;
          break;
        case "FINISH_FINISH":
          earliest = pf + s.lagDays - dur;
          break;
        case "START_FINISH":
          earliest = ps + s.lagDays - dur;
          break;
      }
      if (toDay(q.scheduleStart) < earliest) {
        map.set(q.id, {
          ...q,
          scheduleStart: toISO(earliest),
          scheduleFinish: toISO(earliest + dur),
        });
        changed = true;
      }
    }
    cur = rollup(tasks.map((t) => map.get(t.id)!));
    if (!changed) break;
  }
  return cur;
}

// Would adding predecessor -> successor create a loop?
export function wouldCycle(
  seqs: Sequence[],
  predecessor: string,
  successor: string
) {
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
 *
 * (Calendar-day version. Use setDurationWithCalendar for working-day mode.)
 */
export function setDuration(task: Task, newDays: number): Task {
  const days = Math.max(1, Math.round(newDays));
  const startDay = toDay(task.scheduleStart);
  const finishDay = startDay + days - 1;
  return { ...task, scheduleFinish: toISO(finishDay) };
}

// ---------- duration (working-day) ----------
/**
 * Duration in working days, using the calendar.
 * Falls back to calendar-day duration if `cal` is undefined.
 */
export function durationWorkdays(task: Task, cal?: WorkingCalendar): number {
  if (!cal) return durationDays(task);
  return Math.max(1, countWorkdays(task.scheduleStart, task.scheduleFinish, cal));
}

/**
 * Change duration by shifting the finish date.
 *
 * - If `cal` is undefined → calendar-day behaviour
 *   (finish = start + days - 1).
 * - If `cal` is given → working-day behaviour
 *   (start snaps forward to the next workday; finish is the day that is
 *    `newDays` working days after start, inclusive).
 */
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
  const finish = addWorkdays(start, days, cal);
  return { ...task, scheduleStart: start, scheduleFinish: finish };
}

/** True if the task's span touches any holiday. Useful for warnings. */
export function hasHolidayInside(task: Task, cal: WorkingCalendar): boolean {
  const s = toDay(task.scheduleStart);
  const f = toDay(task.scheduleFinish);
  for (let d = s; d <= f; d++) if (isHoliday(d, cal)) return true;
  return false;
}