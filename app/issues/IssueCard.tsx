// app/issues/IssueCard.tsx
//
// List-view card. Deliberately compact-only — clicking it navigates to the
// dedicated /issues/[id] page (IssueDetail) instead of expanding inline.
// This also gives every issue a real, linkable, bookmarkable URL.

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
}

export function IssueCard({ issue, currentUser, isUserCreator }: IssueCardProps) {
  const isBim = isBimIssue(issue);
  const isCreator = isUserCreator(issue.reportedBy, currentUser);

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
            <span className={`domain-badge domain-${issue.domain}`}>
              {isBim ? (
                <><i className="ti ti-file-barcode" /> BIM</>
              ) : (
                <><i className="ti ti-pencil" /> Other</>
              )}
            </span>
            <ClassificationBadge classification={issue.classification} />
            {isCreator && <span className="issue-owner-badge">(You)</span>}
          </div>

          <div className="issue-compact-line2">
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
          </div>
        </div>

        <span className="expand-toggle-btn" title="Open issue">
          <i className="ti ti-chevron-right" />
        </span>
      </div>
    </Link>
  );
}