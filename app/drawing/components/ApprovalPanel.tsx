// app/drawing/components/ApprovalPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveDocument,
  rejectDocument,
  archiveDocument,
  restoreDocument,
  getDocumentActivity,
} from "../drawingApi";
import { ActivityAction, DrawingActivity, DrawingDocumentResolved } from "../types";

const Spinner = () => <span className="btn-spinner" aria-hidden="true" />;

/** Full phrase after the person's name, e.g. "Arun" + "approved this drawing". */
export const ACTIVITY_VERB: Record<ActivityAction, string> = {
  uploaded: "uploaded this drawing",
  edited: "edited this drawing",
  resubmitted: "resubmitted this drawing for review",
  approved: "approved this drawing",
  rejected: "rejected this drawing",
  archived: "archived this drawing",
  restored: "restored this drawing to published",
  deleted: "deleted this drawing",
  link_created: "created a share link",
  link_revoked: "revoked the share link",
};

export const ACTIVITY_ICON: Record<ActivityAction, string> = {
  uploaded: "ti-upload",
  edited: "ti-edit",
  resubmitted: "ti-refresh",
  approved: "ti-circle-check",
  rejected: "ti-circle-x",
  archived: "ti-archive",
  restored: "ti-arrow-back-up",
  deleted: "ti-trash",
  link_created: "ti-link",
  link_revoked: "ti-link-off",
};

export const formatDateTime = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString() : "";

interface ApprovalPanelProps {
  document: DrawingDocumentResolved;
  /** Called with the fresh document after approve/reject/archive/restore. */
  onChanged?: (doc: DrawingDocumentResolved) => void;
}

export default function ApprovalPanel({ document: doc, onChanged }: ApprovalPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false); // blocks double-clicks before React re-renders
  const [error, setError] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState<boolean>(false);
  const [activity, setActivity] = useState<DrawingActivity[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState<boolean>(false);

  const perms = doc.permissions;
  const state = doc.review_state ?? (doc.status === "published" ? "approved" : doc.status);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      setActivity(await getDocumentActivity(doc.id));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setActivityLoading(false);
    }
  }, [doc.id]);

  // Reset when a different drawing is shown
  useEffect(() => {
    setActivity(null);
    setActivityError(null);
    setShowActivity(false);
    setError(null);
  }, [doc.id]);

  useEffect(() => {
    if (showActivity && activity === null && !activityLoading) loadActivity();
  }, [showActivity, activity, activityLoading, loadActivity]);

  const run = async (
    key: string,
    fn: () => Promise<DrawingDocumentResolved>,
    confirmText?: string
  ) => {
    if (busyRef.current) return; // something is already running
    if (confirmText && !window.confirm(confirmText)) return;
    busyRef.current = true;
    setBusy(key);
    setError(null);
    try {
      const updated = await fn();
      onChanged?.(updated);
      if (showActivity) await loadActivity();
      else setActivity(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleReject = () => {
    if (busyRef.current) return;
    const reason = window.prompt("Reason for rejecting this drawing (optional):");
    if (reason === null) return; // cancelled
    run("reject", () => rejectDocument(doc.id, reason));
  };

  const isBusy = busy !== null;

  const hasActions =
    !!perms &&
    (perms.can_approve || perms.can_reject || perms.can_archive || perms.can_restore);

  return (
    <div className={`approval-panel approval-panel-${state}`}>
      <div className="approval-panel-row">
        <div className="approval-panel-status">
          {state === "pending" && (
            <>
              <span className="approval-badge approval-badge-pending">
                <i className="ti ti-clock" /> Draft · awaiting approval
              </span>
              <span className="approval-panel-note">
                Not visible to the public until an admin approves it.
              </span>
            </>
          )}
          {state === "rejected" && (
            <>
              <span className="approval-badge approval-badge-rejected">
                <i className="ti ti-circle-x" /> Rejected
              </span>
              <span className="approval-panel-note">
                {doc.rejected_by_name ? `by ${doc.rejected_by_name}` : ""}
                {doc.rejected_at ? ` on ${formatDateTime(doc.rejected_at)}` : ""}
                {doc.rejection_reason ? ` — ${doc.rejection_reason}` : ""}
              </span>
            </>
          )}
          {state === "approved" && (
            <>
              <span className="approval-badge approval-badge-approved">
                <i className="ti ti-circle-check" /> Approved
              </span>
              <span className="approval-panel-note">
                {doc.approved_by_name ? `by ${doc.approved_by_name}` : ""}
                {doc.approved_at ? ` on ${formatDateTime(doc.approved_at)}` : ""}
              </span>
            </>
          )}
          {state === "archived" && (
            <>
              <span className="approval-badge approval-badge-archived">
                <i className="ti ti-archive" /> Archived
              </span>
              <span className="approval-panel-note">
                Hidden from the public. An admin can restore it to published.
              </span>
            </>
          )}
        </div>

        <div className="approval-panel-actions" aria-busy={isBusy}>
          {perms?.can_approve && (
            <button
              className="approval-btn approval-btn-approve"
              disabled={isBusy}
              onClick={() => run("approve", () => approveDocument(doc.id))}
            >
              {busy === "approve" ? <Spinner /> : <i className="ti ti-check" />}
              {busy === "approve" ? "Approving…" : state === "rejected" ? "Re-approve" : "Approve"}
            </button>
          )}
          {perms?.can_reject && (
            <button
              className="approval-btn approval-btn-reject"
              disabled={isBusy}
              onClick={handleReject}
            >
              {busy === "reject" ? <Spinner /> : <i className="ti ti-x" />}
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          )}
          {perms?.can_archive && (
            <button
              className="approval-btn"
              disabled={isBusy}
              onClick={() =>
                run(
                  "archive",
                  () => archiveDocument(doc.id),
                  `Archive "${doc.title}"? It will be hidden from the public and its share link will stop working.`
                )
              }
            >
              {busy === "archive" ? <Spinner /> : <i className="ti ti-archive" />}
              {busy === "archive" ? "Archiving…" : "Archive"}
            </button>
          )}
          {perms?.can_restore && (
            <button
              className="approval-btn"
              disabled={isBusy}
              onClick={() =>
                run(
                  "restore",
                  () => restoreDocument(doc.id),
                  `Restore "${doc.title}" to published? It will be public again (its old share link stays revoked).`
                )
              }
            >
              {busy === "restore" ? <Spinner /> : <i className="ti ti-arrow-back-up" />}
              {busy === "restore" ? "Restoring…" : "Restore"}
            </button>
          )}
          {perms?.can_view_activity && (
            <button
              className="approval-btn approval-btn-ghost"
              disabled={isBusy}
              onClick={() => setShowActivity((v) => !v)}
              aria-expanded={showActivity}
            >
              <i className="ti ti-history" />
              {showActivity ? "Hide history" : "History"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="approval-panel-error">
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {state === "rejected" && perms?.can_edit && !perms?.can_approve && (
        <div className="approval-panel-hint">
          Edit the drawing to fix it and it goes back for review, or delete it.
        </div>
      )}

      {hasActions && state === "pending" && perms?.can_approve && (
        <div className="approval-panel-hint">
          Review the drawing below, then approve to make it public or reject to send it back.
        </div>
      )}

      {showActivity && (
        <div className="approval-activity">
          {activityLoading && <div className="approval-activity-empty">Loading history…</div>}
          {activityError && <div className="approval-panel-error">{activityError}</div>}
          {!activityLoading && !activityError && activity && activity.length === 0 && (
            <div className="approval-activity-empty">No history yet.</div>
          )}
          {!activityLoading && activity && activity.length > 0 && (
            <ul className="approval-activity-list">
              {activity.map((a) => (
                <li key={a.id} className={`approval-activity-item approval-activity-${a.action}`}>
                  <span className="approval-activity-icon">
                    <i className={`ti ${ACTIVITY_ICON[a.action] ?? "ti-point"}`} />
                  </span>
                  <div className="approval-activity-body">
                    <div className="approval-activity-text">
                      <strong>{a.actor_name || "Someone"}</strong>{" "}
                      {ACTIVITY_VERB[a.action] ?? a.action_display}
                    </div>
                    {a.note && <div className="approval-activity-note">“{a.note}”</div>}
                    <div className="approval-activity-time">{formatDateTime(a.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}