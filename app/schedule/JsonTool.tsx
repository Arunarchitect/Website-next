"use client";

import { useEffect, useState } from "react";
import type { Sequence, SequenceType, Task } from "./data";
import { toDay } from "./scheduling";

/**
 * Copy / paste SELECTED tasks as JSON for AI editing.
 *
 * COPY: the chosen tasks (scopeIds) + the links whose BOTH ends are in the
 * selection ("sequences"). Links with only ONE end in the selection are listed
 * read-only in "externalLinks" (+ "outsideTasks" names) so the AI knows they
 * exist; they are kept automatically on paste.
 *
 * PASTE (matched by task id):
 *   - id exists in the schedule  → that task is updated (fields merged)
 *   - id is new                  → task is added
 *   - id in scopeIds but missing → task is removed (links to it dropped)
 * Tasks outside scopeIds are never touched.
 *
 * scopeIds is OPTIONAL. When missing, the paste is a WHOLE-DOCUMENT replace.
 */

export interface SelectionJson {
  request?: string;
  instructions?: string[];
  scopeIds: string[];
  tasks: Task[];
  sequences: Sequence[];
  parents?: { id: string; name: string }[];
  people?: { id: number; name: string }[];
  /** Read-only context. */
  groupIds?: string[];
  outsideTasks?: { id: string; name: string; isGroup: boolean }[];
  externalLinks?: unknown[];
  exportedAt: string;
}

/**
 * Shared by "Copy selected" and "Copy for AI" (ScheduleExport imports this),
 * so both buttons always tell the AI the same thing about links.
 */
export const LINK_RULES = [
  "LINKS: every item in 'sequences' is {id, relatingTask, relatedTask, sequenceType, lagDays}.",
  "relatingTask = the PREDECESSOR (the task that comes first). relatedTask = the SUCCESSOR (the task that waits for it). Never swap them. Never use the names from/to/predecessor/successor.",
  "Read a link as: relatingTask <sequenceType> relatedTask. Example: 'Plastering must finish before Tiling can start' = {\"id\":\"s-new-1\",\"relatingTask\":\"a-plast\",\"relatedTask\":\"a-tile\",\"sequenceType\":\"FINISH_START\",\"lagDays\":0}.",
  "sequenceType must be EXACTLY one of: FINISH_START (successor starts after predecessor finishes; the default and most common), START_START (successor starts after predecessor starts), FINISH_FINISH (successor finishes after predecessor finishes), START_FINISH (successor finishes after predecessor starts; rare). Never write FS/SS/FF/SF.",
  "lagDays is a whole number of CALENDAR days (not working days): 0 = no gap, 5 = wait 5 days, negative = overlap (lead).",
  "Link LEAF tasks only (tasks that have no children). Never link a group/phase (see 'groupIds').",
  "Both ids in a link must be real task ids: in 'tasks', in 'outsideTasks', or already in the schedule. Never invent an id in a link.",
  "No self-links. No duplicate pair (same relatingTask + relatedTask). No cycles: if A→B exists, never add B→A, directly or through a chain (A→B→C→A).",
  "To edit an existing link keep its 'id'. A new link needs a new unique id (e.g. 's-new-1'). To delete a link, remove it from 'sequences'. If you delete a task, its links disappear automatically.",
  "Keep dates consistent with links: for FINISH_START the successor's scheduleStart must be after the predecessor's scheduleFinish plus lagDays. Do NOT change dates, completion or actual dates of tasks that have actualStart/actualFinish or completion above 0.",
];

const AI_INSTRUCTIONS = [
  "You are editing part of a construction schedule (Gantt). Do what 'request' asks by editing ONLY 'tasks' and 'sequences', then reply with the full JSON object only (no commentary, no markdown fences, no extra fields).",
  "KEEP 'scopeIds' EXACTLY as given — it lists which existing task ids this paste is allowed to touch. Do not rename, drop, or reorder it.",
  "Keep existing task ids. Every NEW task needs a unique new id (e.g. 'a-new-1'). To delete a task, remove it from 'tasks'.",
  "Dates are YYYY-MM-DD, scheduleFinish must not be before scheduleStart, completion is 0-100, isMilestone is true/false.",
  "parentId must be null, the id of another task in 'tasks', or one of the ids listed in 'parents'.",
  "assigneeIds is a list of person ids from 'people' (if present). Use only those ids; never invent ids. Only leaf tasks get assignees.",
  ...LINK_RULES,
  "'sequences' contains ONLY links where both ends are inside the selection. 'externalLinks' are links between a selected task and a task OUTSIDE it: they are read-only, they are kept automatically, and you must NOT copy them into 'sequences'. To ADD a new link to an outside task, put it in 'sequences' using that task's id from 'outsideTasks'.",
  "Leave 'request', 'instructions', 'parents', 'groupIds', 'outsideTasks', 'externalLinks' and 'people' unchanged or omit them.",
];

/** Accepts raw JSON, ```json fenced JSON, or JSON surrounded by chatter. */
function extractJson(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const seqKey = (s: Pick<Sequence, "relatingTask" | "relatedTask">) =>
  `${s.relatingTask}->${s.relatedTask}`;

const VALID_TYPES = new Set<string>([
  "FINISH_START",
  "START_START",
  "FINISH_FINISH",
  "START_FINISH",
]);
const TYPE_ALIASES: Record<string, SequenceType> = {
  FS: "FINISH_START",
  SS: "START_START",
  FF: "FINISH_FINISH",
  SF: "START_FINISH",
};
const TYPE_LABEL: Record<string, string> = {
  FINISH_START: "finishes → starts",
  START_START: "starts → starts",
  FINISH_FINISH: "finishes → finishes",
  START_FINISH: "starts → finishes",
};

/** "fs", "Finish-Start", "FINISH START" → canonical enum; unknown stays as-is. */
function normType(v: unknown): string | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  const k = v.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return TYPE_ALIASES[k] ?? k;
}

// ── NORMALIZE (AI-shape tolerance) ────────────────────────────────────────

type RawSequence = {
  id?: string;
  relatingTask?: string;
  relatedTask?: string;
  from?: string;
  to?: string;
  predecessor?: string;
  successor?: string;
  sequenceType?: string;
  type?: string;
  lagDays?: number | string;
  lag?: number | string;
};

function pickEnds(s: RawSequence): { pred?: string; succ?: string } {
  return {
    pred: s.relatingTask ?? s.from ?? s.predecessor ?? undefined,
    succ: s.relatedTask ?? s.to ?? s.successor ?? undefined,
  };
}

/** Turn whatever the AI sent into Sequence[] (type / lag are checked later). */
function normalizeSequences(rawSeqs: unknown): {
  sequences: Sequence[];
  warnings: string[];
} {
  const warnings: string[] = [];
  if (rawSeqs === undefined) return { sequences: [], warnings };
  if (!Array.isArray(rawSeqs)) {
    warnings.push('"sequences" is not an array — all links ignored.');
    return { sequences: [], warnings };
  }
  const out: Sequence[] = [];
  rawSeqs.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") {
      warnings.push(`sequences[${i}] is not an object — skipped.`);
      return;
    }
    const s = raw as RawSequence;
    const { pred, succ } = pickEnds(s);
    if (!pred || !succ) {
      warnings.push(
        `sequences[${i}] is missing relatingTask (predecessor) or relatedTask (successor) — skipped.`
      );
      return;
    }
    if (s.from !== undefined || s.to !== undefined) {
      warnings.push(
        `sequences[${i}] used from/to — read as predecessor=from, successor=to.`
      );
    }
    const type = normType(s.sequenceType ?? s.type) ?? "FINISH_START";
    const lagRaw = s.lagDays ?? s.lag ?? 0;
    out.push({
      id: typeof s.id === "string" && s.id ? s.id : `s-${pred}->${succ}`,
      relatingTask: pred,
      relatedTask: succ,
      sequenceType: type as SequenceType,
      lagDays: lagRaw === "" ? 0 : Number(lagRaw),
    });
  });
  return { sequences: out, warnings };
}

// ── COPY ──────────────────────────────────────────────────────────────────

export function withDescendants(id: string, tasks: Task[]): string[] {
  const ids = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const t of tasks) {
      if (t.parentId === cur && !ids.has(t.id)) {
        ids.add(t.id);
        stack.push(t.id);
      }
    }
  }
  return [...ids];
}

function stripTaskForAi(t: Task): Task {
  return { ...t };
}

export function collectSelection(
  ids: Iterable<string>,
  tasks: Task[],
  sequences: Sequence[],
  people?: { id: number; name: string }[]
): SelectionJson {
  const scope = new Set(ids);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const groupSet = new Set(
    tasks.map((t) => t.parentId).filter((x): x is string => !!x)
  );
  const nm = (id: string) => byId.get(id)?.name ?? id;
  const picked = tasks.filter((t) => scope.has(t.id));
  const parentIds = new Set(
    picked.map((t) => t.parentId).filter((p): p is string => !!p && !scope.has(p))
  );

  const inside = sequences.filter(
    (s) => scope.has(s.relatingTask) && scope.has(s.relatedTask)
  );
  const crossing = sequences.filter(
    (s) => scope.has(s.relatingTask) !== scope.has(s.relatedTask)
  );
  const outsideIds = new Set<string>();
  for (const s of crossing) {
    if (!scope.has(s.relatingTask)) outsideIds.add(s.relatingTask);
    if (!scope.has(s.relatedTask)) outsideIds.add(s.relatedTask);
  }

  return {
    scopeIds: picked.map((t) => t.id),
    tasks: picked.map(stripTaskForAi),
    sequences: inside.map((s) => ({
      id: s.id,
      relatingTask: s.relatingTask,
      relatedTask: s.relatedTask,
      sequenceType: s.sequenceType,
      lagDays: s.lagDays,
    })),
    request:
      "Edit ONLY the 'tasks' and 'sequences' arrays. DO NOT remove or rename 'scopeIds' — it must stay exactly as copied. Then: <<WRITE YOUR CHANGE HERE>>",
    instructions: AI_INSTRUCTIONS,
    parents: tasks
      .filter((t) => parentIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name })),
    groupIds: picked.filter((t) => groupSet.has(t.id)).map((t) => t.id),
    outsideTasks: [...outsideIds].map((id) => ({
      id,
      name: nm(id),
      isGroup: groupSet.has(id),
    })),
    externalLinks: crossing.map((s) => ({
      id: s.id,
      relatingTask: s.relatingTask,
      relatedTask: s.relatedTask,
      sequenceType: s.sequenceType,
      lagDays: s.lagDays,
      outside: scope.has(s.relatingTask) ? "successor" : "predecessor",
      meaning: `"${nm(s.relatingTask)}" ${TYPE_LABEL[s.sequenceType] ?? s.sequenceType} "${nm(s.relatedTask)}"`,
    })),
    exportedAt: new Date().toISOString(),
    ...(people?.length
      ? { people: people.map((p) => ({ id: p.id, name: p.name })) }
      : {}),
  };
}

export async function copyTasksForAi(
  ids: Iterable<string>,
  tasks: Task[],
  sequences: Sequence[],
  people?: { id: number; name: string }[]
): Promise<{ ok: boolean; message: string }> {
  const payload = collectSelection(ids, tasks, sequences, people);
  const text = JSON.stringify(payload, null, 2);
  const ext = payload.externalLinks?.length ?? 0;
  const msg =
    `Copied ${payload.tasks.length} task(s), ${payload.sequences.length} link(s)` +
    (ext ? ` (+${ext} external, read-only).` : ".");
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, message: msg };
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok
      ? { ok: true, message: msg }
      : { ok: false, message: "Clipboard blocked — copy failed." };
  }
}

// ── VALIDATE ──────────────────────────────────────────────────────────────

export interface PasteResult {
  ok: boolean;
  errors: string[];
  notes?: string[];
  data?: SelectionJson;
  summary?: string;
}

/** Returns a cycle as a list of ids (first == last), or null. */
function findCycle(ids: Set<string>, seqs: Sequence[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const s of seqs) {
    if (!ids.has(s.relatingTask) || !ids.has(s.relatedTask)) continue;
    adj.set(s.relatingTask, [...(adj.get(s.relatingTask) ?? []), s.relatedTask]);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const dfs = (u: string): string[] | null => {
    state.set(u, 1);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const st = state.get(v) ?? 0;
      if (st === 1) return [...stack.slice(stack.indexOf(v)), v];
      if (st === 0) {
        const r = dfs(v);
        if (r) return r;
      }
    }
    stack.pop();
    state.set(u, 2);
    return null;
  };
  for (const id of ids) {
    if ((state.get(id) ?? 0) === 0) {
      const r = dfs(id);
      if (r) return r;
    }
  }
  return null;
}

function keptSequences(
  sequences: Sequence[],
  scope: Set<string>,
  removed: Set<string>
): Sequence[] {
  return sequences.filter((s) => {
    if (removed.has(s.relatingTask) || removed.has(s.relatedTask)) return false;
    if (scope.has(s.relatingTask) && scope.has(s.relatedTask)) return false;
    return true;
  });
}

export function validatePasteJson(
  text: string,
  tasks: Task[],
  sequences: Sequence[],
  restrictTo?: Set<string>
): PasteResult {
  const errors: string[] = [];
  const notes: string[] = [];

  // 1 ── parse
  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(text));
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const obj = raw as Partial<SelectionJson> & Record<string, unknown>;
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["Top level must be a JSON object."] };
  }

  const KNOWN_KEYS = new Set([
    "request",
    "instructions",
    "_instructions",
    "_linkMeanings",
    "scopeIds",
    "tasks",
    "sequences",
    "parents",
    "people",
    "groupIds",
    "outsideTasks",
    "externalLinks",
    "calendar",
    "exportedAt",
  ]);
  const extras = Object.keys(obj).filter((k) => !KNOWN_KEYS.has(k));
  if (extras.length) {
    notes.push(
      `Ignored extra top-level key(s): ${extras.join(", ")}. Only "scopeIds", "tasks" and "sequences" are used.`
    );
  }

  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    errors.push('"tasks" must be a non-empty array.');
  }

  const scopeProvided =
    Array.isArray(obj.scopeIds) && (obj.scopeIds as unknown[]).length > 0;

  if (obj.scopeIds !== undefined && !Array.isArray(obj.scopeIds)) {
    errors.push('"scopeIds", if present, must be an array of task ids.');
  }
  if (!scopeProvided && restrictTo) {
    errors.push(
      '"scopeIds" is required for a scoped paste. Re-copy the selected tasks and try again.'
    );
  }
  if (errors.length) return { ok: false, errors, notes };

  const rawTasks = obj.tasks as Task[];
  const scope: Set<string> = scopeProvided
    ? new Set(obj.scopeIds as string[])
    : new Set(tasks.map((t) => t.id));
  const existingById = new Map(tasks.map((t) => [t.id, t]));

  // 2 ── scope must exist
  for (const id of scope) {
    if (!existingById.has(id)) {
      errors.push(`scopeIds has "${id}" which no longer exists in the schedule.`);
    }
  }
  if (restrictTo) {
    for (const id of scope) {
      if (!restrictTo.has(id)) {
        errors.push(
          `scopeIds has "${existingById.get(id)?.name ?? id}", which is not in your current selection — this paste is limited to the ticked tasks.`
        );
      }
    }
  }
  if (errors.length) return { ok: false, errors, notes };

  // 3 ── per-task shape
  const pasteIds = new Set<string>();
  const cleaned: Task[] = [];
  rawTasks.forEach((t, i) => {
    const label = t?.name ? `"${t.name}"` : `task #${i + 1}`;
    if (!t || typeof t !== "object") {
      errors.push(`tasks[${i}] is not an object.`);
      return;
    }
    if (typeof t.id !== "string" || !t.id) {
      errors.push(`${label}: missing "id".`);
      return;
    }
    if (pasteIds.has(t.id)) {
      errors.push(`${label}: duplicate id "${t.id}" inside the paste.`);
      return;
    }
    if (typeof t.name !== "string" || !t.name.trim()) {
      errors.push(`"${t.id}": missing name.`);
    }
    if (!DATE_RE.test(t.scheduleStart ?? "")) {
      errors.push(`"${t.name ?? t.id}": scheduleStart must be YYYY-MM-DD.`);
    }
    if (!DATE_RE.test(t.scheduleFinish ?? "")) {
      errors.push(`"${t.name ?? t.id}": scheduleFinish must be YYYY-MM-DD.`);
    }
    if (
      DATE_RE.test(t.scheduleStart ?? "") &&
      DATE_RE.test(t.scheduleFinish ?? "") &&
      t.scheduleFinish < t.scheduleStart
    ) {
      errors.push(`"${t.name ?? t.id}": finish is before start.`);
    }
    pasteIds.add(t.id);
    cleaned.push({
      ...t,
      name: (t.name ?? "").trim(),
      completion: Math.max(0, Math.min(100, Math.round(t.completion ?? 0))),
      parentId: t.parentId ?? null,
      isMilestone: !!t.isMilestone,
    });
  });
  if (errors.length) return { ok: false, errors, notes };

  // 4 ── id collisions
  for (const t of cleaned) {
    if (existingById.has(t.id) && !scope.has(t.id)) {
      errors.push(
        `"${t.name}": id "${t.id}" belongs to a task outside the selection — use a new id.`
      );
    }
  }

  // 5 ── removed
  const removed = new Set([...scope].filter((id) => !pasteIds.has(id)));
  const finalIds = new Set<string>([
    ...tasks.filter((t) => !removed.has(t.id)).map((t) => t.id),
    ...pasteIds,
  ]);

  // 6 ── parents
  const finalParent = new Map<string, string | null>();
  for (const t of tasks) {
    if (!removed.has(t.id)) finalParent.set(t.id, t.parentId ?? null);
  }
  for (const t of cleaned) finalParent.set(t.id, t.parentId ?? null);

  for (const [id, p] of finalParent) {
    if (p && !finalIds.has(p)) {
      const nm =
        (cleaned.find((x) => x.id === id) ?? existingById.get(id))?.name ?? id;
      const pn = existingById.get(p)?.name ?? p;
      errors.push(
        removed.has(p)
          ? `"${nm}" would be orphaned: its parent "${pn}" is removed by this paste.`
          : `"${nm}": parentId "${p}" does not exist.`
      );
    }
  }
  for (const id of pasteIds) {
    const seen = new Set<string>([id]);
    let cur = finalParent.get(id) ?? null;
    while (cur) {
      if (seen.has(cur)) {
        errors.push(
          `"${cleaned.find((x) => x.id === id)?.name ?? id}": parent chain forms a loop.`
        );
        break;
      }
      seen.add(cur);
      cur = finalParent.get(cur) ?? null;
    }
  }

  // 6b ── scoped paste parents
  if (restrictTo) {
    const allowedParents = new Set<string | null>([...pasteIds]);
    for (const id of scope) allowedParents.add(existingById.get(id)?.parentId ?? null);
    for (const t of cleaned) {
      if (!allowedParents.has(t.parentId ?? null)) {
        errors.push(
          `"${t.name}": parentId "${t.parentId}" is outside this selection — move it in the app instead.`
        );
      }
    }
  }

  // Helpers for readable link errors
  const cleanedById = new Map(cleaned.map((t) => [t.id, t]));
  const nameOf = (id: string) =>
    cleanedById.get(id)?.name ?? existingById.get(id)?.name ?? id;
  const finalGroups = new Set(
    [...finalParent.values()].filter((p): p is string => !!p)
  );
  const linkLabel = (s: Sequence) =>
    `Link "${nameOf(s.relatingTask)}" → "${nameOf(s.relatedTask)}"`;

  // 7 ── sequences
  const { sequences: rawSeqs, warnings: seqWarn } = normalizeSequences(
    obj.sequences
  );
  for (const w of seqWarn) notes.push(w);

  const kept = keptSequences(sequences, scope, removed);
  const keptKeys = new Set(kept.map(seqKey));
  const keptIds = new Set(kept.map((s) => s.id));

  const seenSeq = new Set<string>();
  const seenSeqIds = new Set<string>();
  const cleanedSeqs: Sequence[] = [];
  for (const s of rawSeqs) {
    const label = linkLabel(s);

    if (!VALID_TYPES.has(s.sequenceType)) {
      errors.push(
        `${label}: sequenceType "${s.sequenceType}" is invalid. Use FINISH_START, START_START, FINISH_FINISH or START_FINISH.`
      );
      continue;
    }
    if (!Number.isFinite(s.lagDays)) {
      errors.push(`${label}: lagDays must be a number (calendar days).`);
      continue;
    }
    if (!Number.isInteger(s.lagDays)) {
      notes.push(`${label}: lagDays ${s.lagDays} rounded to a whole number.`);
    }
    if (!finalIds.has(s.relatingTask)) {
      errors.push(
        `${label}: predecessor id "${s.relatingTask}" does not exist (or was removed).`
      );
      continue;
    }
    if (!finalIds.has(s.relatedTask)) {
      errors.push(
        `${label}: successor id "${s.relatedTask}" does not exist (or was removed).`
      );
      continue;
    }
    if (s.relatingTask === s.relatedTask) {
      errors.push(`${label}: a task cannot be linked to itself.`);
      continue;
    }
    if (finalGroups.has(s.relatingTask) || finalGroups.has(s.relatedTask)) {
      const g = finalGroups.has(s.relatingTask) ? s.relatingTask : s.relatedTask;
      errors.push(
        `${label}: "${nameOf(g)}" is a group (it has sub-tasks). Link leaf tasks only.`
      );
      continue;
    }
    if (
      restrictTo &&
      !pasteIds.has(s.relatingTask) &&
      !pasteIds.has(s.relatedTask)
    ) {
      errors.push(`${label}: does not involve any selected task.`);
      continue;
    }
    const k = seqKey(s);
    if (seenSeq.has(k)) {
      errors.push(`${label}: duplicate link (same predecessor and successor).`);
      continue;
    }
    seenSeq.add(k);

    let id = typeof s.id === "string" && s.id ? s.id : `s-${k}`;
    if (seenSeqIds.has(id) || keptIds.has(id)) {
      notes.push(`${label}: link id "${id}" was already used — a new id was generated.`);
      id = `s-${k}-${seenSeqIds.size + 1}`;
    }
    seenSeqIds.add(id);

    cleanedSeqs.push({ ...s, id, lagDays: Math.round(s.lagDays) });
  }

  for (const s of cleanedSeqs) {
    if (keptKeys.has(seqKey(s))) {
      errors.push(
        `${linkLabel(s)}: this link already exists outside the selection (it is kept automatically — do not repeat it).`
      );
    }
    const reverse = `${s.relatedTask}->${s.relatingTask}`;
    if (seenSeq.has(reverse) || keptKeys.has(reverse)) {
      errors.push(
        `${linkLabel(s)}: the opposite link already exists — that would be a loop.`
      );
    }
  }

  const cycle = findCycle(finalIds, [...kept, ...cleanedSeqs]);
  if (cycle) {
    errors.push(
      `Dependency cycle: ${cycle.map(nameOf).map((n) => `"${n}"`).join(" → ")}. A task cannot (indirectly) depend on itself.`
    );
  }

  if (errors.length) return { ok: false, errors, notes };

  // 8 ── soft check: do the dates respect the links? (note only)
  const dateOf = (id: string) => cleanedById.get(id) ?? existingById.get(id);
  const conflicts: string[] = [];
  for (const s of [...kept, ...cleanedSeqs]) {
    if (!pasteIds.has(s.relatingTask) && !pasteIds.has(s.relatedTask)) continue;
    const p = dateOf(s.relatingTask);
    const q = dateOf(s.relatedTask);
    if (!p || !q) continue;
    const ps = toDay(p.scheduleStart);
    const pf = toDay(p.scheduleFinish);
    const qs = toDay(q.scheduleStart);
    const qf = toDay(q.scheduleFinish);
    const bad =
      s.sequenceType === "FINISH_START"
        ? qs < pf + 1 + s.lagDays
        : s.sequenceType === "START_START"
          ? qs < ps + s.lagDays
          : s.sequenceType === "FINISH_FINISH"
            ? qf < pf + s.lagDays
            : qf < ps + s.lagDays;
    if (bad) conflicts.push(linkLabel(s));
  }
  if (conflicts.length) {
    notes.push(
      `${conflicts.length} link(s) have dates that break the rule (e.g. successor starts too early): ${conflicts
        .slice(0, 4)
        .join("; ")}${conflicts.length > 4 ? "; …" : ""}. Run Auto-schedule after applying to fix them.`
    );
  }

  const added = cleaned.filter((t) => !existingById.has(t.id)).length;
  const updated = cleaned.length - added;
  const starts = cleaned.map((t) => t.scheduleStart).sort();
  const finishes = cleaned.map((t) => t.scheduleFinish).sort();
  return {
    ok: true,
    errors: [],
    notes,
    data: {
      scopeIds: [...scope],
      tasks: cleaned,
      sequences: cleanedSeqs,
      exportedAt: new Date().toISOString(),
    },
    summary:
      `${updated} updated, ${added} added, ${removed.size} removed, ` +
      `${cleanedSeqs.length} link(s) — ${starts[0]} → ${finishes[finishes.length - 1]}.`,
  };
}

// ── APPLY ─────────────────────────────────────────────────────────────────

export function applySelection(
  data: SelectionJson,
  tasks: Task[],
  sequences: Sequence[]
): { tasks: Task[]; sequences: Sequence[] } {
  const scope = new Set(data.scopeIds);
  const pasteById = new Map(data.tasks.map((t) => [t.id, t]));
  const removed = new Set([...scope].filter((id) => !pasteById.has(id)));
  const existingIds = new Set(tasks.map((t) => t.id));

  const nextTasks: Task[] = [];
  for (const t of tasks) {
    if (removed.has(t.id)) continue;
    const p = pasteById.get(t.id);
    nextTasks.push(p ? { ...t, ...p } : t);
  }
  for (const t of data.tasks) {
    if (!existingIds.has(t.id)) nextTasks.push(t);
  }

  const kept = keptSequences(sequences, scope, removed);
  const keptKeys = new Set(kept.map(seqKey));
  const added = data.sequences.filter((s) => !keptKeys.has(seqKey(s)));

  return { tasks: nextTasks, sequences: [...kept, ...added] };
}

// ── PASTE MODAL ───────────────────────────────────────────────────────────

export function PasteJsonModal({
  tasks,
  sequences,
  onApply,
  onClose,
  restrictTo,
}: {
  tasks: Task[];
  sequences: Sequence[];
  onApply: (data: SelectionJson) => void;
  onClose: () => void;
  restrictTo?: Set<string>;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PasteResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validate = () =>
    setResult(validatePasteJson(text, tasks, sequences, restrictTo));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-800">
            {restrictTo
              ? `Paste into selection (${restrictTo.size} task${restrictTo.size === 1 ? "" : "s"})`
              : "Paste schedule JSON"}
          </h2>
          <button
            onClick={onClose}
            className="rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-xs text-gray-500">
            Paste the JSON copied from your selected tasks (possibly edited by
            an AI). Tasks are matched by <code>id</code>: existing ids are
            updated, new ids are added, ids in <code>scopeIds</code> that are
            missing from <code>tasks</code> are removed. If{" "}
            <code>scopeIds</code> is omitted, the paste replaces the entire
            schedule. Links: <code>relatingTask</code> is the predecessor,{" "}
            <code>relatedTask</code> the successor; links to groups, unknown
            ids, wrong types and cycles are reported before anything changes.
            {restrictTo && (
              <>
                {" "}
                <strong>
                  Scoped mode: the JSON can only change the currently ticked
                  tasks, and must include <code>scopeIds</code>.
                </strong>
              </>
            )}
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            rows={14}
            spellCheck={false}
            placeholder='{ "scopeIds": [ … ], "tasks": [ … ], "sequences": [ … ] }'
            className="w-full rounded border px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {result && result.notes && result.notes.length > 0 && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="mb-1 font-semibold">Notes</div>
              <ul className="list-inside list-disc">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {result && !result.ok && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-red-200 bg-red-50 px-3 py-2">
              <div className="mb-1 text-xs font-semibold text-red-700">
                {result.errors.length} problem(s) found — nothing was changed:
              </div>
              <ul className="list-inside list-disc text-xs text-red-700">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result?.ok && (
            <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              ✓ Valid — {result.summary}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-gray-50 px-4 py-2.5">
          <button
            onClick={onClose}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={validate}
            disabled={!text.trim()}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
          >
            Validate
          </button>
          <button
            onClick={() => result?.data && onApply(result.data)}
            disabled={!result?.ok}
            className="rounded bg-black px-3 py-1 text-sm text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={result?.ok ? "Apply to the selected tasks" : "Validate first"}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}