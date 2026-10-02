// Pure scheduling helpers (no React). Dates are YYYY-MM-DD strings, math is done on day numbers.
import type { Sequence, Task } from "./data";

const DAY = 86400000;

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