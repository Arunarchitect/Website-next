"use client";

import { useEffect, useState } from "react";
import type { Sequence, Task } from "./data";

/**
 * Copy / paste a task subtree as JSON for AI editing.
 *
 * COPY: collectSubtree() gathers the anchor task + all descendants and the
 * sequences whose BOTH endpoints lie inside the subtree. Links crossing the
 * subtree boundary are intentionally left out — they belong to the parent
 * context and are preserved untouched on paste.
 *
 * PASTE: validatePasteJson() checks shape, dates, id collisions, parent
 * references and cycles. applySubtree() replaces the old subtree in place.
 */

export interface SubtreeJson {
  rootId: string;
  tasks: Task[];
  sequences: Sequence[];
  exportedAt: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const seqKey = (s: Pick<Sequence, "relatingTask" | "relatedTask">) =>
  `${s.relatingTask}->${s.relatedTask}`;

// ── COPY ──────────────────────────────────────────────────────────────────

export function collectSubtree(
  anchorId: string,
  tasks: Task[],
  sequences: Sequence[]
): SubtreeJson {
  const ids = new Set<string>([anchorId]);
  const stack = [anchorId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const t of tasks) {
      if (t.parentId === cur && !ids.has(t.id)) {
        ids.add(t.id);
        stack.push(t.id);
      }
    }
  }
  return {
    rootId: anchorId,
    tasks: tasks.filter((t) => ids.has(t.id)),
    sequences: sequences.filter(
      (s) => ids.has(s.relatingTask) && ids.has(s.relatedTask)
    ),
    exportedAt: new Date().toISOString(),
  };
}

export async function copySubtreeForAi(
  anchorId: string,
  tasks: Task[],
  sequences: Sequence[]
): Promise<{ ok: boolean; message: string }> {
  const payload = collectSubtree(anchorId, tasks, sequences);
  const text = JSON.stringify(payload, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    return {
      ok: true,
      message: `Copied ${payload.tasks.length} task(s), ${payload.sequences.length} link(s).`,
    };
  } catch {
    // Clipboard API denied (non-HTTPS / permissions) — fallback.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok
      ? {
          ok: true,
          message: `Copied ${payload.tasks.length} task(s), ${payload.sequences.length} link(s).`,
        }
      : { ok: false, message: "Clipboard blocked — copy failed." };
  }
}

// ── VALIDATE ──────────────────────────────────────────────────────────────

export interface PasteResult {
  ok: boolean;
  errors: string[];
  data?: SubtreeJson;
  summary?: string;
}

/** Kahn's algorithm over the merged link set — true if a cycle exists. */
function mergedGraphHasCycle(
  allTaskIds: Set<string>,
  seqs: Sequence[]
): boolean {
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

export function validatePasteJson(
  text: string,
  tasks: Task[],
  sequences: Sequence[]
): PasteResult {
  const errors: string[] = [];

  // 1 ── parse
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const obj = raw as Partial<SubtreeJson>;
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["Top level must be a JSON object."] };
  }
  if (typeof obj.rootId !== "string" || !obj.rootId) {
    errors.push('Missing "rootId" (string).');
  }
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    errors.push('"tasks" must be a non-empty array.');
  }
  if (errors.length) return { ok: false, errors };

  const rootId = obj.rootId as string;
  const rawTasks = obj.tasks as Task[];

  // 2 ── per-task shape
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
  if (errors.length) return { ok: false, errors };

  // 3 ── root must exist in the current schedule (replacement target)
  const currentRoot = tasks.find((t) => t.id === rootId);
  if (!currentRoot) {
    return {
      ok: false,
      errors: [
        `rootId "${rootId}" does not exist in the current schedule — paste must replace an existing task/phase.`,
      ],
    };
  }
  if (!pasteIds.has(rootId)) {
    return { ok: false, errors: [`"rootId" "${rootId}" is not among the pasted tasks.`] };
  }

  // 4 ── parent references: children must stay inside the subtree
  for (const t of cleaned) {
    if (t.id === rootId) continue; // root's parent is forced on apply
    if (t.parentId && !pasteIds.has(t.parentId)) {
      errors.push(
        `"${t.name}": parentId "${t.parentId}" is outside the pasted subtree — children cannot be re-parented outside their phase.`
      );
    }
  }

  // 5 ── id collisions with tasks outside the subtree being replaced
  const oldIds = new Set(
    collectSubtree(rootId, tasks, []).tasks.map((t) => t.id)
  );
  for (const t of cleaned) {
    if (t.id === rootId) continue;
    if (tasks.some((x) => x.id === t.id) && !oldIds.has(t.id)) {
      errors.push(
        `"${t.name}": id "${t.id}" already exists elsewhere in the schedule — ask the AI to invent new ids.`
      );
    }
  }

  // 6 ── sequences
  const rawSeqs = Array.isArray(obj.sequences) ? (obj.sequences as Sequence[]) : [];
  const seenSeq = new Set<string>();
  const cleanedSeqs: Sequence[] = [];
  for (const s of rawSeqs) {
    if (
      !s ||
      typeof s.relatingTask !== "string" ||
      typeof s.relatedTask !== "string"
    ) {
      errors.push("Every sequence needs relatingTask and relatedTask ids.");
      continue;
    }
    if (!pasteIds.has(s.relatingTask) || !pasteIds.has(s.relatedTask)) {
      errors.push(
        `Sequence ${s.relatingTask}→${s.relatedTask} points outside the pasted subtree.`
      );
      continue;
    }
    if (s.relatingTask === s.relatedTask) {
      errors.push(`Sequence ${s.relatingTask}→itself is a self-link.`);
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

  // 7 ── duplicate links against the outside world + cycle check on merge
  const kept = sequences.filter(
    (s) => !oldIds.has(s.relatingTask) && !oldIds.has(s.relatedTask)
  );
  const keptKeys = new Set(kept.map(seqKey));
  for (const s of cleanedSeqs) {
    if (keptKeys.has(seqKey(s))) {
      errors.push(`Sequence ${seqKey(s)} already exists outside the subtree.`);
    }
  }
  const mergedTaskIds = new Set([
    ...tasks.filter((t) => !oldIds.has(t.id)).map((t) => t.id),
    ...pasteIds,
  ]);
  if (mergedGraphHasCycle(mergedTaskIds, [...kept, ...cleanedSeqs])) {
    errors.push("The pasted links would create a dependency cycle.");
  }

  if (errors.length) return { ok: false, errors };

  const starts = cleaned.map((t) => t.scheduleStart).sort();
  const finishes = cleaned.map((t) => t.scheduleFinish).sort();
  return {
    ok: true,
    errors: [],
    data: { rootId, tasks: cleaned, sequences: cleanedSeqs, exportedAt: new Date().toISOString() },
    summary: `${cleaned.length} task(s), ${cleanedSeqs.length} link(s) — ` +
      `${starts[0]} → ${finishes[finishes.length - 1]}. ` +
      `Will replace "${currentRoot.name}" and its subtree.`,
  };
}

// ── APPLY ─────────────────────────────────────────────────────────────────

export function applySubtree(
  data: SubtreeJson,
  tasks: Task[],
  sequences: Sequence[]
): { tasks: Task[]; sequences: Sequence[] } {
  const oldIds = new Set(
    collectSubtree(data.rootId, tasks, []).tasks.map((t) => t.id)
  );
  const rootOriginal = tasks.find((t) => t.id === data.rootId);

  // Root keeps its current parent — the subtree slots back into the same spot.
  const incoming = data.tasks.map((t) =>
    t.id === data.rootId ? { ...t, parentId: rootOriginal?.parentId ?? null } : t
  );

  const keptSeqs = sequences.filter(
    (s) => !oldIds.has(s.relatingTask) && !oldIds.has(s.relatedTask)
  );
  const keptKeys = new Set(keptSeqs.map(seqKey));
  const newSeqs = data.sequences.filter((s) => !keptKeys.has(seqKey(s)));

  return {
    tasks: [...tasks.filter((t) => !oldIds.has(t.id)), ...incoming],
    sequences: [...keptSeqs, ...newSeqs],
  };
}

// ── PASTE MODAL ───────────────────────────────────────────────────────────

export function PasteJsonModal({
  tasks,
  sequences,
  onApply,
  onClose,
}: {
  tasks: Task[];
  sequences: Sequence[];
  onApply: (data: SubtreeJson) => void;
  onClose: () => void;
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

  const validate = () => setResult(validatePasteJson(text, tasks, sequences));

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
            Paste schedule JSON
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
            Paste the JSON copied from a task/phase (possibly edited by an
            AI). It must keep the same <code>rootId</code> — that phase will
            be replaced after validation.
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            rows={14}
            spellCheck={false}
            placeholder='{ "rootId": "a-…", "tasks": [ … ], "sequences": [ … ] }'
            className="w-full rounded border px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

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
            title={result?.ok ? "Replace the subtree" : "Validate first"}
          >
            Validate &amp; apply
          </button>
        </div>
      </div>
    </div>
  );
}