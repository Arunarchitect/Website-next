// app/issues/[id]/page.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import {
  getIssue,
  updateIssue,
  resolveIssue,
  removeSnapshot,
  removeAttachment,
  addComment,
  deleteComment,
  editComment,
  deleteIssue,
  updateIssueAccess,
} from "../issueApi";
import { Issue } from "../issueTypes";
import { IssueDetail } from "../IssueDetail";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { CurrentUser } from "../issueCardHelpers";
import "../issues.css";

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [issue, setIssue] = useState<Issue | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [commentSortOrder, setCommentSortOrder] = useState<"asc" | "desc">("desc");

  const currentUserData = useCurrentUser();
  const currentUser: CurrentUser = {
    id: currentUserData?.id ?? null,
    email: currentUserData?.email || '',
    firstName: currentUserData?.first_name || '',
    lastName: currentUserData?.last_name || '',
    fullName: currentUserData?.full_name || `${currentUserData?.first_name || ''} ${currentUserData?.last_name || ''}`.trim() || currentUserData?.display_name || '',
    username: currentUserData?.username || '',
    displayName: currentUserData?.display_name || currentUserData?.full_name || `${currentUserData?.first_name || ''} ${currentUserData?.last_name || ''}`.trim() || currentUserData?.email || '',
  };

  const isUserCreator = (reportedBy: string, user: CurrentUser): boolean => {
    if (!reportedBy || reportedBy === 'Unknown') return false;
    const rb = reportedBy.toLowerCase().trim().replace(/\s+/g, '');
    const candidates = [
      user.email.toLowerCase().trim(),
      user.fullName.toLowerCase().trim().replace(/\s+/g, ''),
      user.username.toLowerCase().trim(),
      user.displayName.toLowerCase().trim().replace(/\s+/g, ''),
      ((user.firstName || '') + (user.lastName || '')).toLowerCase().trim(),
    ].filter(Boolean);
    return candidates.includes(rb);
  };

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setForbidden(false);
      const data = await getIssue(id);
      if (!data) {
        setError('Issue not found.');
      }
      setIssue(data);
      return data;
    } catch (err: unknown) {
      console.error('Refresh error:', err);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setForbidden(true);
        setError("You don't have access to this issue. Ask an organisation admin to add you.");
      } else if (!(axios.isAxiosError(err) && err.response?.status === 401)) {
        // 401 is handled globally by the apiClient interceptor (redirects
        // to /login?next=...), so no local error is needed for that case.
        setError('Failed to load issue. Please try again.');
      }
      throw err;
    }
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const handleOpenDrawing = (documentId: number) => {
    window.open(`/drawing?openDoc=${documentId}`, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
      return;
    }
    try {
      setError(null);
      await deleteIssue(issueId);
      router.push('/issues');
    } catch (err: unknown) {
      console.error('Delete issue error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete issue. Please try again.');
    }
  };

  if (loading) {
    return <main className="issues-page"><p className="hero-subtitle">Loading issue…</p></main>;
  }

  if (error && !issue) {
    return (
      <main className="issues-page">
        <p className="hero-subtitle">{error}</p>
        {forbidden && (
          <p className="hero-subtitle" style={{ fontSize: '13px', color: 'var(--slate)' }}>
            Signed in as {currentUser.email || currentUser.displayName || 'unknown user'}.
          </p>
        )}
        <button className="btn-outline" onClick={() => router.push('/issues')} type="button">
          <i className="ti ti-arrow-left" /> Back to issues
        </button>
      </main>
    );
  }

  if (!issue) return null;

  return (
    <main className="issues-page">
      <button
        className="btn-outline"
        onClick={() => router.push('/issues')}
        type="button"
        style={{ marginBottom: '16px' }}
      >
        <i className="ti ti-arrow-left" /> Back to issues
      </button>

      {error && (
        <div className="error-banner">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <IssueDetail
        issue={issue}
        commentSortOrder={commentSortOrder}
        onSortChange={() => setCommentSortOrder(commentSortOrder === "desc" ? "asc" : "desc")}
        currentUser={currentUser}
        isUserCreator={isUserCreator}
        onOpenDrawing={handleOpenDrawing}
        onDeleteIssue={handleDeleteIssue}
        onSave={async (patch) => {
          setError(null);
          await updateIssue(issue.id, patch);
          await refresh();
        }}
        onResolve={async (resolution, snapshotData, snapshotFormat) => {
          setError(null);
          await resolveIssue(issue.id, resolution, currentUser.email, snapshotData, snapshotFormat);
          await refresh();
        }}
        onUpdateAccess={async (access) => {
          setError(null);
          await updateIssueAccess(issue.id, access);
          await refresh();
        }}
        onRemoveSnapshot={async () => {
          setError(null);
          await removeSnapshot(issue.id);
          await refresh();
        }}
        onRemoveAttachment={async (index) => {
          setError(null);
          await removeAttachment(issue.id, index);
          await refresh();
        }}
        onAddComment={async (text, snapshotData, snapshotFormat) => {
          setError(null);
          await addComment(issue.id, currentUser.email || currentUser.fullName, text, snapshotData, snapshotFormat);
          await refresh();
        }}
        onDeleteComment={async (commentId) => {
          setError(null);
          await deleteComment(issue.id, commentId);
          await refresh();
        }}
        onEditComment={async (commentId, text, snapshotData, snapshotFormat, removeSnapshotFlag) => {
          setError(null);
          await editComment(issue.id, commentId, text, snapshotData, snapshotFormat, removeSnapshotFlag);
          await refresh();
        }}
      />
    </main>
  );
}