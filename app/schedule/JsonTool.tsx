"use client";

import { useEffect, useState } from "react";
import type { Sequence, Task } from "./data";

/**
 * Copy / paste SELECTED tasks as JSON for AI editing.
 *
 * COPY: the chosen tasks (scopeIds) + the links whose BOTH ends are in the
 * selection. "parents" is read-only context so the AI knows valid parentIds.
 *
 * PASTE (matched by task id):
 *   - id exists in the schedule  → that task is updated (fields merged)
 *   - id is new                  → task is added
 *   - id in scopeIds but missing → task is removed (links to it dropped)
 * Tasks outside scopeIds are never touched. Links with one end outside the
 * selection are kept unless the inside end was removed. Pasted links may point
 * to any existing task.
 *
 * scopeIds is OPTIONAL. When missing, the paste is treated as a WHOLE-DOCUMENT
 * replace: every existing task is in scope, so anything not present in the
 * new `tasks[]` is removed. Scoped pastes (Paste into selection) still
 * require scopeIds.
 */

export interface SelectionJson {
  /** Read-only on paste: tells the AI what to do. */
  request?: string;
  instructions?: string[];
  scopeIds: string[];
  tasks: Task[];
  sequences: Sequence[];
  parents?: { id: string; name: string }[];
  exportedAt: string;
}

const AI_INSTRUCTIONS = [
  "You are editing part of a construction schedule (Gantt). Do what 'request' asks by editing ONLY 'tasks' and 'sequences', then reply with the full JSON object only (no commentary, no extra fields).",
  "KEEP 'scopeIds' EXACTLY as given — it lists which existing task ids this paste is allowed to touch. Do not rename, drop, or reorder it.",
  "Keep existing task ids. Every NEW task needs a unique new id (e.g. 'a-new-1'). To delete a task, remove it from 'tasks'.",
  "Dates are YYYY-MM-DD, scheduleFinish must not be before scheduleStart, completion is 0-100, isMilestone is true/false.",
  "parentId must be null, the id of another task in 'tasks', or one of the ids listed in 'parents'.",
  "Each sequence is {id, relatingTask (predecessor), relatedTask (successor), sequenceType: FINISH_START | START_START | FINISH_FINISH | START_FINISH, lagDays}. No self-links, duplicates or dependency cycles.",
  "Leave 'request', 'instructions' and 'parents' unchanged or omit them.",
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

// ── NORMALIZE (AI-shape tolerance) ────────────────────────────────────────
//
// Some AI tools emit sequences as { from, to, ... } instead of the app's
// { relatingTask, relatedTask, ... }. Some replies also add a "_instructions"
// array, "calendar", or other commentary keys. Normalize whatever the AI sent
// back into the app's canonical shape and drop everything we don't recognize.

type RawSequence = {
  id?: string;
  // canonical
  relatingTask?: string;
  relatedTask?: string;
  // AI-friendly aliases
  from?: string;
  to?: string;
  predecessor?: string;
  successor?: string;
  // common fields
  sequenceType?: Sequence["sequenceType"];
  lagDays?: number;
};

/** Best-effort extraction of (predecessor, successor) from a raw sequence. */
function pickEnds(s: RawSequence): { pred?: string; succ?: string } {
  const pred = s.relatingTask ?? s.from ?? s.predecessor ?? undefined;
  const succ = s.relatedTask ?? s.to ?? s.successor ?? undefined;
  return { pred, succ };
}

/** Turn whatever the AI sent into a canonical Sequence[]. */
function normalizeSequences(rawSeqs: unknown): {
  sequences: Sequence[];
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!Array.isArray(rawSeqs)) return { sequences: [], warnings };
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
        `sequences[${i}] is missing predecessor/successor ids — skipped.`
      );
      return;
    }
    out.push({
      id: typeof s.id === "string" && s.id ? s.id : `s-${pred}->${succ}`,
      relatingTask: pred,
      relatedTask: succ,
      sequenceType: s.sequenceType ?? "FINISH_START",
      lagDays: Number.isFinite(s.lagDays as number)
        ? (s.lagDays as number)
        : 0,
    });
  });
  return { sequences: out, warnings };
}

// ── COPY ──────────────────────────────────────────────────────────────────

/** id + all descendants of one task. */
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

/** Strip fields that the AI should not send back (none for now — keep whole Task). */
function stripTaskForAi(t: Task): Task {
  return { ...t };
}

export function collectSelection(
  ids: Iterable<string>,
  tasks: Task[],
  sequences: Sequence[]
): SelectionJson {
  const scope = new Set(ids);
  const picked = tasks.filter((t) => scope.has(t.id));
  const parentIds = new Set(
    picked.map((t) => t.parentId).filter((p): p is string => !!p && !scope.has(p))
  );
  return {
    // scopeIds FIRST — some AIs keep the first key they see but drop odd ones.
    scopeIds: picked.map((t) => t.id),
    tasks: picked.map(stripTaskForAi),
    sequences: sequences
      .filter((s) => scope.has(s.relatingTask) && scope.has(s.relatedTask))
      // Emit the canonical field names. No `from`/`to`, no extras.
      .map((s) => ({
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
    exportedAt: new Date().toISOString(),
  };
}

export async function copyTasksForAi(
  ids: Iterable<string>,
  tasks: Task[],
  sequences: Sequence[]
): Promise<{ ok: boolean; message: string }> {
  const payload = collectSelection(ids, tasks, sequences);
  const text = JSON.stringify(payload, null, 2);
  const msg = `Copied ${payload.tasks.length} task(s), ${payload.sequences.length} link(s).`;
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, message: msg };
  } catch {
    // Clipboard API denied (non-HTTPS / permissions) — fallback.
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
  /** Non-fatal notes (e.g. unknown top-level keys that were ignored). */
  notes?: string[];
  data?: SelectionJson;
  summary?: string;
}

/** Kahn's algorithm — true if the link graph has a cycle. */
function graphHasCycle(allTaskIds: Set<string>, seqs: Sequence[]): boolean {
  const succ = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of allTaskIds) indeg.set(id, 0);
  for (const s of seqs) {
    if (!allTaskIds.has(s.relatingTask) || !allTaskIds.has(s.relatedTask))
      continue;
    if (!succ.has(s.relatingTask)) succ.set(s.relatingTask, []);
    succ.get(s.relatingTask)!.push(s.relatedTask);
    indeg.set(s.relatedTask, (indeg.get(s.relatedTask) ?? 0) + 1);
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  let seen = 0;
  while (queue.length) {
    const id = queue.pop()!;
    seen++;
    for (const nxt of succ.get(id) ?? []) {
      const d = (indeg.get(nxt) ?? 0) - 1;
      indeg.set(nxt, d);
      if (d === 0) queue.push(nxt);
    }
  }
  return seen < allTaskIds.size;
}

/** Links that survive a paste (untouched by the selection). */
function keptSequences(
  sequences: Sequence[],
  scope: Set<string>,
  removed: Set<string>
): Sequence[] {
  return sequences.filter((s) => {
    if (removed.has(s.relatingTask) || removed.has(s.relatedTask)) return false;
    if (scope.has(s.relatingTask) && scope.has(s.relatedTask)) return false; // replaced by paste
    return true;
  });
}

export function validatePasteJson(
  text: string,
  tasks: Task[],
  sequences: Sequence[],
  /** When set (scoped paste), the JSON may only touch these task ids. */
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

  // Note (don't reject) unknown top-level keys. AI tools frequently echo
  // back "_instructions", "notes", "calendar", etc.
  const KNOWN_KEYS = new Set([
    "request",
    "instructions",
    "_instructions", // tolerated: AI reply header
    "scopeIds",
    "tasks",
    "sequences",
    "parents",
    "calendar", // tolerated: some AIs echo it back
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

  // scopeIds is OPTIONAL for a whole-document paste. When it's missing, every
  // existing task is treated as in-scope (i.e. anything not in the new tasks[]
  // is removed). For a SCOPED paste (Paste into selection), scopeIds must be
  // present, otherwise the paste could touch tasks the user did not select.
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

  // 2 ── scope must exist in the current schedule (no-op for whole-doc paste)
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

  // 4 ── id collisions: a pasted id that exists but was NOT in the selection
  for (const t of cleaned) {
    if (existingById.has(t.id) && !scope.has(t.id)) {
      errors.push(
        `"${t.name}": id "${t.id}" belongs to a task outside the selection — use a new id.`
      );
    }
  }

  // 5 ── removed = selected but missing from paste
  const removed = new Set([...scope].filter((id) => !pasteIds.has(id)));
  const finalIds = new Set<string>([
    ...tasks.filter((t) => !removed.has(t.id)).map((t) => t.id),
    ...pasteIds,
  ]);

  // 6 ── parents: must exist after the paste, no parent cycles, nobody orphaned
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

  // 6b ── scoped paste: parents may only be pasted tasks or the selection's existing parents
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

  // 7 ── sequences (tolerant normalization: accept `from`/`to` too)
  const { sequences: rawSeqs, warnings: seqWarn } = normalizeSequences(
    obj.sequences
  );
  for (const w of seqWarn) notes.push(w);

  const seenSeq = new Set<string>();
  const cleanedSeqs: Sequence[] = [];
  for (const s of rawSeqs) {
    if (!finalIds.has(s.relatingTask) || !finalIds.has(s.relatedTask)) {
      errors.push(
        `Sequence ${s.relatingTask}→${s.relatedTask} points to a task that does not exist.`
      );
      continue;
    }
    if (s.relatingTask === s.relatedTask) {
      errors.push(`Sequence ${s.relatingTask}→itself is a self-link.`);
      continue;
    }
    if (
      restrictTo &&
      !pasteIds.has(s.relatingTask) &&
      !pasteIds.has(s.relatedTask)
    ) {
      errors.push(
        `Sequence ${s.relatingTask}→${s.relatedTask} does not involve any selected task.`
      );
      continue;
    }
    const k = seqKey(s);
    if (seenSeq.has(k)) {
      errors.push(`Duplicate sequence ${k}.`);
      continue;
    }
    seenSeq.add(k);
    cleanedSeqs.push({
      ...s,
      id: typeof s.id === "string" && s.id ? s.id : `s-${k}`,
      sequenceType: s.sequenceType ?? "FINISH_START",
      lagDays: Number.isFinite(s.lagDays) ? s.lagDays : 0,
    });
  }

  const kept = keptSequences(sequences, scope, removed);
  const keptKeys = new Set(kept.map(seqKey));
  for (const s of cleanedSeqs) {
    if (keptKeys.has(seqKey(s))) {
      errors.push(`Sequence ${seqKey(s)} already exists outside the selection.`);
    }
  }
  if (graphHasCycle(finalIds, [...kept, ...cleanedSeqs])) {
    errors.push("The pasted links would create a dependency cycle.");
  }

  if (errors.length) return { ok: false, errors, notes };

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

  // Update in place (merge so fields the AI left out are not lost), drop removed.
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
  /** Scoped mode: only these task ids may be changed. */
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
            schedule. Nothing outside the selection is touched. Fenced or
            chatty AI replies are fine — unknown keys are ignored and{" "}
            <code>from</code>/<code>to</code> links are accepted as aliases.
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