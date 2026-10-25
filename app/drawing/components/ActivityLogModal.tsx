// app/drawing/components/ActivityLogModal.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getActivityLog } from "../drawingApi";
import { ActivityAction, DrawingActivity, Organisation } from "../types";
import { ACTIVITY_ICON, formatDateTime } from "./ApprovalPanel";

interface ActivityLogModalProps {
  open: boolean;
  onClose: () => void;
  organisations: Organisation[];
  /** Pre-select an organisation (e.g. the page's current filter). */
  initialOrganisationId?: number;
  /** If set, a toggle lets the admin narrow the log to this one drawing. */
  focusDocument?: { id: number; title: string } | null;
}

const ACTION_OPTIONS: { value: ActivityAction; label: string }[] = [
  { value: "uploaded", label: "Uploaded" },
  { value: "edited", label: "Edited" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
  { value: "restored", label: "Restored" },
  { value: "deleted", label: "Deleted" },
  { value: "link_created", label: "Link created" },
  { value: "link_revoked", label: "Link revoked" },
];

const PAGE_SIZE = 25;

export default function ActivityLogModal({
  open,
  onClose,
  organisations,
  initialOrganisationId,
  focusDocument,
}: ActivityLogModalProps) {
  const [orgId, setOrgId] = useState<number | undefined>(initialOrganisationId);
  const [action, setAction] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [onlyFocus, setOnlyFocus] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const [entries, setEntries] = useState<DrawingActivity[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Primitives so a new `focusDocument` object each parent render doesn't
  // retrigger effects / refetches.
  const focusId = focusDocument?.id;
  const focusTitle = focusDocument?.title;

  // Each time the modal opens: start from the page's organisation filter and
  // show the WHOLE log (the admin can tick "Only <drawing>" to narrow it).
  useEffect(() => {
    if (open) {
      setOrgId(initialOrganisationId);
      setOnlyFocus(false);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change goes back to page 1
  useEffect(() => {
    setPage(1);
  }, [orgId, action, debouncedSearch, dateFrom, dateTo, onlyFocus]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActivityLog({
        organisationId: orgId,
        action: action || undefined,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        documentId: onlyFocus && focusId ? focusId : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setEntries(data.results);
      setTotal(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [orgId, action, debouncedSearch, dateFrom, dateTo, onlyFocus, focusId, page]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasFilters = !!(orgId || action || debouncedSearch || dateFrom || dateTo);
  const clear = () => {
    setOrgId(undefined);
    setAction("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="document-form-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="activity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="document-form-header">
          <h2 className="document-form-title">
            <i className="ti ti-history" /> Drawing activity
          </h2>
          <button className="document-form-close" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="activity-filters">
          <select
            className="documents-filter-select"
            value={orgId ?? ""}
            onChange={(e) => setOrgId(e.target.value ? Number(e.target.value) : undefined)}
            aria-label="Organisation"
          >
            <option value="">All my organisations</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <select
            className="documents-filter-select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label="Action"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <input
            type="search"
            className="documents-filter-select activity-search"
            placeholder="Search person, drawing, project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search"
          />

          <label className="activity-date">
            From
            <input
              type="date"
              className="documents-filter-select"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="activity-date">
            To
            <input
              type="date"
              className="documents-filter-select"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>

          {focusId && (
            <label className="activity-focus">
              <input
                type="checkbox"
                checked={onlyFocus}
                onChange={(e) => setOnlyFocus(e.target.checked)}
              />
              Only “{focusTitle}”
            </label>
          )}

          {hasFilters && (
            <button className="documents-filter-clear" onClick={clear}>
              <i className="ti ti-x" /> Clear
            </button>
          )}
        </div>

        <div className="activity-body">
          {loading && entries.length === 0 && (
            <div className="documents-loading">
              <i className="ti ti-loader" />
              <p>Loading activity…</p>
            </div>
          )}

          {error && (
            <div className="documents-error">
              <i className="ti ti-alert-circle" />
              <p>{error}</p>
              <button className="documents-retry-btn" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {!error && !loading && entries.length === 0 && (
            <div className="documents-empty">
              <i className="ti ti-history" />
              <h3>No activity found</h3>
              <p>{hasFilters || onlyFocus ? "Nothing matches these filters." : "Nothing has happened yet."}</p>
            </div>
          )}

          {entries.length > 0 && (
            <ul className="activity-list">
              {entries.map((a) => (
                <li key={a.id} className={`activity-row activity-row-${a.action}`}>
                  <span className={`activity-row-icon activity-icon-${a.action}`}>
                    <i className={`ti ${ACTIVITY_ICON[a.action] ?? "ti-point"}`} />
                  </span>
                  <div className="activity-row-main">
                    <div className="activity-row-line">
                      <strong>{a.actor_name || "Someone"}</strong>{" "}
                      <span className={`activity-action activity-action-${a.action}`}>
                        {a.action_display.toLowerCase()}
                      </span>{" "}
                      <span className="activity-doc-title">“{a.document_title}”</span>
                      {a.document_id === null && a.action !== "deleted" && (
                        <span className="activity-deleted-tag">(since deleted)</span>
                      )}
                    </div>
                    <div className="activity-row-meta">
                      {a.organisation_name}
                      {a.project_name ? ` › ${a.project_name}` : ""}
                      {a.deliverable_name ? ` › ${a.deliverable_name}` : ""}
                    </div>
                    {a.note && <div className="activity-row-note">“{a.note}”</div>}
                  </div>
                  <time className="activity-row-time" dateTime={a.created_at}>
                    {formatDateTime(a.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="activity-footer">
          <span className="documents-pagination-info">
            {total === 0
              ? "0 entries"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          </span>
          <div className="documents-pagination-buttons">
            <button
              className="documents-pagination-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <i className="ti ti-chevron-left" /> Prev
            </button>
            <span className="documents-pagination-info">
              Page {page} / {totalPages}
            </span>
            <button
              className="documents-pagination-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <i className="ti ti-chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}