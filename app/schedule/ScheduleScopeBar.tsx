"use client";

import type { ScheduleDoc } from "./api";

export default function ScheduleScopeBar({
  meta,
  isAdmin,
  canHaveCopy,
  mySchedId,
  mainId,
  busy,
  onFork,
  onOpen,
  onPull,
  onPromote,
}: {
  meta: ScheduleDoc | null;
  isAdmin: boolean;
  canHaveCopy: boolean; // admin / manager / member
  mySchedId: number | null; // id of my existing copy, if any
  mainId: number | null;
  busy: boolean;
  onFork: () => void;
  onOpen: (id: number) => void;
  onPull: () => void;
  onPromote: () => void;
}) {
  if (!meta || !meta.scope) return null;

  const btn =
    "rounded border bg-white px-2.5 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";

  // ── MAIN ──
  if (meta.scope === "MAIN") {
    return (
      <div
        className="mb-3 flex flex-wrap items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-700"
        data-print-hide
      >
        <span className="font-semibold">Main schedule</span>
        {!meta.canEdit && (
          <span className="text-gray-500">
            · read-only
            {canHaveCopy ? " — work in your own copy and an admin can merge it" : ""}
          </span>
        )}
        {canHaveCopy && !isAdmin && mySchedId == null && (
          <button className={btn} disabled={busy} onClick={onFork}>
            Create my copy
          </button>
        )}
        {canHaveCopy && mySchedId != null && (
          <button className={btn} onClick={() => onOpen(mySchedId)}>
            Open my copy
          </button>
        )}
        {canHaveCopy && isAdmin && mySchedId == null && (
          <button className={btn} disabled={busy} onClick={onFork}>
            Create my copy
          </button>
        )}
      </div>
    );
  }

  // ── PERSONAL ──
  const stale =
    meta.basedOnVersion != null &&
    meta.mainVersion != null &&
    meta.mainVersion > meta.basedOnVersion;
  const mine = !!meta.canEdit;

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-gray-700"
      data-print-hide
    >
      <span className="font-semibold">
        {mine ? "My copy" : `${meta.ownerName ?? "Someone"}'s copy`}
      </span>
      {!mine && <span className="text-gray-500">· read-only</span>}
      {stale && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">
          Main changed since {mine ? "you pulled" : "this was pulled"}
        </span>
      )}
      {mine && (
        <button className={btn} disabled={busy} onClick={onPull}>
          Pull from main
        </button>
      )}
      {isAdmin && (
        <button className={btn} disabled={busy} onClick={onPromote}>
          Make this the main schedule
        </button>
      )}
      {mainId != null && (
        <button className={btn} onClick={() => onOpen(mainId)}>
          Go to main
        </button>
      )}
    </div>
  );
}