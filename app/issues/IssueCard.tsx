// app/issues/IssueCard.tsx
"use client";

import Link from "next/link";
import { getPriorityColor, getStatusColor } from "./issueApi";
import { Issue, isBimIssue } from "./issueTypes";
import { ClassificationBadge } from "./IssueCardAccessParts";

export interface CurrentUser {
  email: string;
  fullName: string;
  username: string;
  displayName: string;
}

interface IssueCardProps {
  issue: Issue;
  currentUser: CurrentUser;
  isUserCreator: (reportedBy: string, user: CurrentUser) => boolean;
  // Lets the page control how a linked drawing opens (e.g. reuse the same
  // handler as the detail page). Falls back to opening
  // /drawing?openDoc=<id> in a new tab if not provided.
  onOpenDrawing?: (documentId: number) => void;
  // How many linked-drawing chips to show before collapsing into "+N more".
  // Defaults to 2 to keep the compact row from overflowing.
  maxVisibleDrawings?: number;
}

const DEFAULT_MAX_VISIBLE_DRAWING_CHIPS = 2;

export function IssueCard({
  issue,
  currentUser,
  isUserCreator,
  onOpenDrawing,
  maxVisibleDrawings = DEFAULT_MAX_VISIBLE_DRAWING_CHIPS,
}: IssueCardProps) {
  const isBim = isBimIssue(issue);
  const isCreator = isUserCreator(issue.reportedBy, currentUser);

  const linkedDocuments = issue.linkedDocuments || [];
  const visibleDrawings = linkedDocuments.slice(0, maxVisibleDrawings);
  const extraDrawingCount = linkedDocuments.length - visibleDrawings.length;

  const openDrawing = (e: React.MouseEvent, documentId: number) => {
    // Card is wrapped in a Link to the issue detail page — stop the click
    // from bubbling to it so we go straight to the drawing instead.
    e.preventDefault();
    e.stopPropagation();
    if (onOpenDrawing) {
      onOpenDrawing(documentId);
    } else {
      window.open(`/drawing?openDoc=${documentId}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Link
      href={`/issues/${issue.id}`}
      className="issue-card issue-card-collapsed"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="issue-card-compact">
        <div className="priority-strip" style={{ background: getPriorityColor(issue.priority) }} />

        <div className="issue-compact-body">
          <div className="issue-compact-line1">
            <span className="issue-id">#{issue.id}</span>
            <span className="issue-compact-title">{issue.title}</span>
          </div>

          <div className="issue-compact-line2">
            <span className={`domain-badge domain-${issue.domain}`}>
              {isBim ? (
                <><i className="ti ti-file-barcode" /> BIM</>
              ) : (
                <><i className="ti ti-pencil" /> Other</>
              )}
            </span>
            <ClassificationBadge classification={issue.classification} />
            {isCreator && <span className="issue-owner-badge">(You)</span>}
            {issue.module && (
              <span className="meta-item">
                <i className="ti ti-box" />
                {issue.module}
              </span>
            )}
            {issue.organisation && (
              <span className="meta-item">
                <i className="ti ti-building" />
                {issue.organisation}
              </span>
            )}
            <span className="priority-badge" style={{ color: getPriorityColor(issue.priority) }}>
              <i className="ti ti-flag" />
              {issue.priority}
            </span>
            <span
              className="status-badge"
              style={{
                background: `${getStatusColor(issue.status)}20`,
                color: getStatusColor(issue.status),
              }}
            >
              {issue.status}
            </span>
            {issue.assignedTo && (
              <span className="meta-item">
                <i className="ti ti-user-check" />
                {issue.assignedTo}
              </span>
            )}
            {issue.dueDate && (
              <span className="meta-item due-date">
                <i className="ti ti-calendar-due" />
                {issue.dueDate}
              </span>
            )}
            {issue.comments.length > 0 && (
              <span className="meta-item">
                <i className="ti ti-message" />
                {issue.comments.length}
              </span>
            )}
            {visibleDrawings.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="meta-item"
                title={`Open drawing: ${doc.title}`}
                onClick={(e) => openDrawing(e, doc.id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "var(--blue)",
                }}
              >
                <i className="ti ti-paperclip" />
                {doc.title}
              </button>
            ))}
            {extraDrawingCount > 0 && (
              <span className="meta-item" title={`${extraDrawingCount} more linked drawing(s)`}>
                +{extraDrawingCount} more
              </span>
            )}
          </div>
        </div>

        <span className="expand-toggle-btn" title="Open issue">
          <i className="ti ti-chevron-right" />
        </span>
      </div>
    </Link>
  );
}