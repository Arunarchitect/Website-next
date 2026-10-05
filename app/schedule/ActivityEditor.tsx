"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "./data";

/**
 * CRUD helpers for schedule activities.
 *
 * Two exports:
 *   <ActivityEditorModal>  — full edit dialog for one task
 *   <RowMenu>              — small dropdown with Edit / Add child / Add sibling / Delete / Move
 *
 * The parent (page.tsx) owns state; these are pure UI that call back with
 * concrete mutations.
 */

export type MoveTarget = { kind: "root" } | { kind: "under"; id: string };

// ---------------- helper: cycles ----------------
/** True if `candidateParentId` is inside the subtree of `taskId` (or is itself). */
export function isDescendant(
  tasks: Task[],
  taskId: string,
  candidateParentId: string
): boolean {
  if (taskId === candidateParentId) return true;
  let cur: string | null = candidateParentId;
  while (cur) {
    if (cur === taskId) return true;
    cur = tasks.find((t) => t.id === cur)?.parentId ?? null;
  }
  return false;
}

// ---------------- modal ----------------
export function ActivityEditorModal({
  task,
  tasks,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  tasks: Task[];
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [code, setCode] = useState(task.workCode ?? "");
  const [start, setStart] = useState(task.scheduleStart);
  const [finish, setFinish] = useState(task.scheduleFinish);
  const [completion, setCompletion] = useState(task.completion);
  const [milestone, setMilestone] = useState(task.isMilestone);
  const [remarks, setRemarks] = useState(task.remarks ?? "");
  const [parentId, setParentId] = useState<string | null>(task.parentId);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Valid parents: anything that is NOT this task or its descendants
  const validParents = useMemo(
    () =>
      tasks.filter(
        (t) => t.id !== task.id && !isDescendant(tasks, task.id, t.id)
      ),
    [tasks, task.id]
  );

  const save = () => {
    onSave({
      name: name.trim() || task.name,
      workCode: code.trim() || undefined,
      scheduleStart: start,
      scheduleFinish: finish,
      completion: Math.max(0, Math.min(100, Math.round(completion))),
      isMilestone: milestone,
      remarks: remarks.trim() || undefined,
      parentId,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-800">
            Edit activity
          </h2>
          <button
            onClick={onClose}
            className="rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-3 px-4 py-3 text-sm">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">
                Work code
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 7-9"
                className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">
                Parent group
              </span>
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value || null)}
                className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">— Top level —</option>
                {validParents.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Start</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-600">Finish</span>
              <input
                type="date"
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="flex items-center justify-between text-xs font-medium text-gray-600">
              <span>Completion</span>
              <span className="tabular-nums text-gray-800">{completion}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={completion}
              onChange={(e) => setCompletion(Number(e.target.value))}
              className="w-full"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={milestone}
              onChange={(e) => setMilestone(e.target.checked)}
            />
            <span className="text-xs text-gray-700">
              Milestone (single-day, no work)
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-600">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t bg-gray-50 px-4 py-2.5">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-700">
                Delete “{task.name}” and all its children?
              </span>
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded border px-2 py-1 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Delete…
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded bg-black px-3 py-1 text-sm text-white hover:bg-gray-800"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- row menu ----------------
export type RowMenuAction =
  | { kind: "edit" }
  | { kind: "addChild" }
  | { kind: "addSibling" }
  | { kind: "delete" }
  | { kind: "move"; target: MoveTarget };

export function RowMenu({
  task,
  tasks,
  onAction,
  onClose,
}: {
  task: Task;
  tasks: Task[];
  onAction: (a: RowMenuAction) => void;
  onClose: () => void;
}) {
  const [moving, setMoving] = useState(false);

  // Valid move targets: any task that isn't this task or its descendants
  const validParents = useMemo(
    () =>
      tasks
        .filter(
          (t) => t.id !== task.id && !isDescendant(tasks, task.id, t.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tasks, task.id]
  );

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border bg-white text-xs shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          onAction({ kind: "edit" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
      >
        ✎  Edit…
      </button>
      <button
        onClick={() => {
          onAction({ kind: "addChild" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
      >
        ＋  Add child…
      </button>
      <button
        onClick={() => {
          onAction({ kind: "addSibling" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
      >
        ＋  Add sibling…
      </button>

      <div className="border-t" />

      {!moving ? (
        <button
          onClick={() => setMoving(true)}
          className="block w-full px-3 py-1.5 text-left hover:bg-gray-50"
        >
          ⇄  Move into…
        </button>
      ) : (
        <div className="px-2 py-1.5">
          <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">
            Move under
          </div>
          <select
            autoFocus
            onChange={(e) => {
              const v = e.target.value;
              const target: MoveTarget =
                v === "__root__" ? { kind: "root" } : { kind: "under", id: v };
              onAction({ kind: "move", target });
              onClose();
            }}
            className="w-full rounded border px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Choose…</option>
            <option value="__root__">— Top level —</option>
            {validParents.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="border-t" />

      <button
        onClick={() => {
          onAction({ kind: "delete" });
          onClose();
        }}
        className="block w-full px-3 py-1.5 text-left text-red-700 hover:bg-red-50"
      >
        🗑  Delete…
      </button>
    </div>
  );
}