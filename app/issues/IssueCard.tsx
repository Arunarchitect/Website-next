// app/issues/IssueCard.tsx

"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  getPriorityColor,
  getStatusColor,
  getOrganisationMembers,
  getProjectDrawings,
  AssigneeOption,
  DrawingOption,
} from "./issueApi";
import {
  Issue,
  IssueComment,
  BimIssue,
  isBimIssue,
} from "./issueTypes";
import { isUserMatch } from '@/components/utils/userMatching';
import {
  getImageSource,
  useScreenshotUpload,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_DIRECTION,
  DEFAULT_CAMERA_UP_VECTOR,
  DEFAULT_FIELD_OF_VIEW,
  NonBimIssue,
  IssuePatch,
  CurrentUser,
} from "./issueCardHelpers";
import {
  IssueHeader,
  IssueMeta,
  IssueEditForm,
  ScreenshotSection,
  ScreenshotHistory,
  LinkedDrawingsView,
  LinkedDrawingsEdit,
  CommentsList,
  ResolvePanel,
  ActionsBar,
  AddScreenshotPanel,
  AddCommentPanel,
  IssueSidebar,
  ScreenshotModal,
} from "./IssueCardParts";

interface IssueCardProps {
  issue: Issue;
  commentSortOrder: "asc" | "desc";
  onSortChange: () => void;
  onSave: (patch: Partial<Issue>) => Promise<void>;
  onResolve: (resolution: string, snapshotData?: string, snapshotFormat?: "png" | "jpg") => Promise<void>;
  onRemoveSnapshot: () => Promise<void>;
  onRemoveAttachment: (index: number) => Promise<void>;
  onAddScreenshot: (text: string, snapshotData: string, snapshotFormat: "png" | "jpg") => Promise<void>;
  onAddComment: (text: string, snapshotData?: string, snapshotFormat?: "png" | "jpg") => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, text: string, snapshotData?: string, snapshotFormat?: "png" | "jpg", removeSnapshot?: boolean) => Promise<void>;
  onDeleteIssue: (issueId: string) => Promise<void>;
  onOpenDrawing: (documentId: number) => void;
  currentUser: CurrentUser;
  isUserCreator: (reportedBy: string, user: CurrentUser) => boolean;
}

export function IssueCard({
  issue,
  commentSortOrder,
  onSortChange,
  onSave,
  onResolve,
  onRemoveSnapshot,
  onRemoveAttachment,
  onAddScreenshot,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onDeleteIssue,
  onOpenDrawing,
  currentUser,
  isUserCreator,
}: IssueCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Screenshot upload flows — one hook instance per independent upload site,
  // matching the five separate state blocks in the original component.
  const mainScreenshot = useScreenshotUpload(setSaveError, false);
  const resolutionScreenshot = useScreenshotUpload(setSaveError, true);
  const extraScreenshot = useScreenshotUpload(setSaveError, true);
  const commentScreenshot = useScreenshotUpload(setSaveError, true);
  const editingCommentScreenshotUpload = useScreenshotUpload(setSaveError, true);

  const [showAddScreenshot, setShowAddScreenshot] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");

  const [showHistory, setShowHistory] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentHasExistingImage, setEditingCommentHasExistingImage] = useState(false);

  const [extraCommentText, setExtraCommentText] = useState("");

  const [form, setForm] = useState({
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    assignedTo: issue.assignedTo ?? "",
    assignedToId: issue.assignedToId ?? null,
    dueDate: issue.dueDate ?? "",
  });

  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);

  const [drawingOptions, setDrawingOptions] = useState<DrawingOption[]>([]);
  const [loadingDrawings, setLoadingDrawings] = useState(false);
  const [linkedDocIds, setLinkedDocIds] = useState<number[]>(
    (issue.linkedDocuments || []).map((d) => d.id)
  );
  const [drawingToAdd, setDrawingToAdd] = useState<number | "">("");

  const issueProjectId = issue.project_id ?? issue.project;
  const issueOrganisationId = issue.organisationId;

  useEffect(() => {
    if (!isEditing || !issueOrganisationId) return;
    let cancelled = false;
    setLoadingAssignees(true);
    getOrganisationMembers(issueOrganisationId)
      .then((opts) => { if (!cancelled) setAssigneeOptions(opts); })
      .finally(() => { if (!cancelled) setLoadingAssignees(false); });
    return () => { cancelled = true; };
  }, [isEditing, issueOrganisationId]);

  useEffect(() => {
    if (!isEditing || !issueProjectId) {
      setDrawingOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingDrawings(true);
    getProjectDrawings(issueProjectId)
      .then((opts) => { if (!cancelled) setDrawingOptions(opts); })
      .finally(() => { if (!cancelled) setLoadingDrawings(false); });
    return () => { cancelled = true; };
  }, [isEditing, issueProjectId]);

  useEffect(() => {
    if (isEditing) {
      setLinkedDocIds((issue.linkedDocuments || []).map((d) => d.id));
    }
  }, [isEditing, issue.linkedDocuments]);

  const canResolve = issue.status !== "Resolved" && issue.status !== "Closed";
  const isBim = isBimIssue(issue);

  const ifcElementCount = isBimIssue(issue) ? (issue.ifcElements?.length ?? 0) : 0;

  const isCreator = isUserCreator(issue.reportedBy, currentUser);

  const isCommentAuthor = (commentAuthor: string): boolean => {
    return isUserMatch(commentAuthor, currentUser);
  };

  const getCurrentScreenshot = (): string | null => {
    if (isBim) {
      if (!isBimIssue(issue) || !issue.viewpoint?.snapshot) return null;
      return getImageSource(issue.viewpoint.snapshot.data);
    }
    const attachments = (issue as NonBimIssue).attachments;
    if (attachments && attachments.length > 0) {
      return getImageSource(attachments[0]);
    }
    return null;
  };

  const currentScreenshot = getCurrentScreenshot();
  const displayScreenshot = mainScreenshot.screenshot
    ? `data:image/${mainScreenshot.format};base64,${mainScreenshot.screenshot}`
    : currentScreenshot;
  const hasScreenshot = !!displayScreenshot && displayScreenshot.length > 0;

  const commentSnapshots = issue.comments.filter((c) => !!c.snapshot);

  const sortedComments = [...issue.comments].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return commentSortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  const handleAddScreenshot = async () => {
    if (!extraScreenshot.screenshot) return;
    try {
      setSaveError(null);
      await onAddScreenshot(
        extraCommentText.trim() || "Screenshot added",
        extraScreenshot.screenshot,
        extraScreenshot.format
      );
      extraScreenshot.reset();
      setExtraCommentText("");
      setShowAddScreenshot(false);
    } catch {
      setSaveError('Failed to add screenshot.');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      setSaveError(null);
      await onAddComment(
        commentText.trim(),
        commentScreenshot.screenshot || undefined,
        commentScreenshot.screenshot ? commentScreenshot.format : undefined
      );
      setCommentText("");
      commentScreenshot.reset();
      setShowCommentInput(false);
    } catch {
      setSaveError('Failed to add comment.');
    }
  };

  const handleEditComment = async (commentId: string, originalHadSnapshot: boolean) => {
    if (!editingCommentText.trim()) return;
    try {
      setSaveError(null);
      const removeSnapshot = originalHadSnapshot && !editingCommentHasExistingImage && !editingCommentScreenshotUpload.screenshot;
      await onEditComment(
        commentId,
        editingCommentText.trim(),
        editingCommentScreenshotUpload.screenshot || undefined,
        editingCommentScreenshotUpload.screenshot ? editingCommentScreenshotUpload.format : undefined,
        removeSnapshot
      );
      setEditingCommentId(null);
      setEditingCommentText("");
      editingCommentScreenshotUpload.reset();
      setEditingCommentHasExistingImage(false);
    } catch {
      setSaveError('Failed to edit comment.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment? This cannot be undone.')) return;
    try {
      setSaveError(null);
      await onDeleteComment(commentId);
    } catch {
      setSaveError('Failed to delete comment.');
    }
  };

  const handleSave = async () => {
    try {
      setSaveError(null);
      const patch: IssuePatch = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      };

      if (form.assignedToId && typeof form.assignedToId === 'number') {
        patch.assignedToId = form.assignedToId;
      } else if (form.assignedTo && !isNaN(Number(form.assignedTo))) {
        patch.assignedToId = Number(form.assignedTo);
      }

      if (mainScreenshot.screenshot) {
        if (isBim) {
          const bimIssue = issue as BimIssue;
          patch.domain = 'bim';
          patch.viewpoint = {
            camera_position: bimIssue.viewpoint?.cameraPosition || DEFAULT_CAMERA_POSITION,
            camera_direction: bimIssue.viewpoint?.cameraDirection || DEFAULT_CAMERA_DIRECTION,
            camera_up_vector: bimIssue.viewpoint?.cameraUpVector || DEFAULT_CAMERA_UP_VECTOR,
            field_of_view: bimIssue.viewpoint?.fieldOfView || DEFAULT_FIELD_OF_VIEW,
            clipping_planes: bimIssue.viewpoint?.clippingPlanes || [],
            snapshot_data: mainScreenshot.screenshot,
            snapshot_format: mainScreenshot.format,
          };
        } else {
          patch.domain = 'other';
          patch.newAttachmentData = mainScreenshot.screenshot;
          patch.newAttachmentFormat = mainScreenshot.format;
        }
      }

      patch.linkedDocumentIds = linkedDocIds;

      await onSave(patch as Partial<Issue>);
      setIsEditing(false);
      mainScreenshot.setScreenshot(null);
    } catch (err: unknown) {
      console.error('Save error:', err);
      if (axios.isAxiosError(err) && err.response?.data) {
        const errors = Object.values(err.response.data as Record<string, unknown>).flat().join('\n');
        setSaveError(`Validation Error: ${errors}`);
      } else {
        setSaveError('Failed to save changes. Please try again.');
      }
    }
  };

  const handleResolveConfirm = async () => {
    if (!resolutionText.trim()) return;
    try {
      setSaveError(null);
      await onResolve(
        resolutionText.trim(),
        resolutionScreenshot.screenshot || undefined,
        resolutionScreenshot.screenshot ? resolutionScreenshot.format : undefined
      );
      setResolutionText("");
      resolutionScreenshot.reset();
      setIsResolving(false);
    } catch (err: unknown) {
      console.error('Resolve error:', err);
      setSaveError('Failed to resolve issue. Please try again.');
    }
  };

  const handleImageClick = (src: string) => {
    setSelectedScreenshot(src);
  };

  const handleRemoveSavedScreenshot = async () => {
    try {
      setSaveError(null);
      if (isBim) {
        await onRemoveSnapshot();
      } else {
        await onRemoveAttachment(0);
      }
    } catch {
      setSaveError('Failed to remove screenshot. Please try again.');
    }
  };

  const handleDeleteIssueClick = async () => {
    if (!confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
      return;
    }
    try {
      setSaveError(null);
      await onDeleteIssue(String(issue.id));
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete issue.');
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (!img.src.includes('test.jpg')) {
      img.src = '/images/test.jpg';
    }
  };

  const startEditComment = (comment: IssueComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    setEditingCommentHasExistingImage(!!comment.snapshot);
    editingCommentScreenshotUpload.reset();
  };

  const removeCommentImage = () => {
    setEditingCommentHasExistingImage(false);
    editingCommentScreenshotUpload.reset();
  };

  // Direct "unlink" action for the view (non-edit) state — lets the creator
  // detach a linked drawing without opening the full issue edit form.
  const handleUnlinkDrawing = async (documentId: number) => {
    if (!confirm('Unlink this drawing from the issue?')) return;
    try {
      setSaveError(null);
      const remainingIds = (issue.linkedDocuments || [])
        .map((d) => d.id)
        .filter((id) => id !== documentId);
      await onSave({ linkedDocumentIds: remainingIds } as Partial<Issue>);
    } catch {
      setSaveError('Failed to unlink drawing. Please try again.');
    }
  };

  // ------------------------------------------------------------------
  // Collapsed (default) view: a compact ~2-line summary. Nothing heavy
  // (screenshots, comment threads, edit form, linked drawings) mounts
  // until the person actually expands the card, which keeps the initial
  // render of a long issue list cheap even though all issues were
  // fetched up front.
  // ------------------------------------------------------------------
  if (!isExpanded) {
    return (
      <div className="issue-card issue-card-collapsed">
        <div
          className="issue-card-compact"
          role="button"
          tabIndex={0}
          onClick={() => setIsExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(true);
            }
          }}
        >
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

          <button
            type="button"
            className="expand-toggle-btn"
            title="Expand issue"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
          >
            <i className="ti ti-chevron-down" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="issue-card">
      <div className="issue-left">
        <div className="priority-strip" style={{ background: getPriorityColor(issue.priority) }} />

        <div className="issue-content">
          <div className="issue-expanded-header">
            <IssueHeader
              issue={issue}
              isEditing={isEditing}
              titleValue={form.title}
              onTitleChange={(value) => setForm((f) => ({ ...f, title: value }))}
              isBim={isBim}
              isCreator={isCreator}
            />
            {!isEditing && (
              <button
                type="button"
                className="collapse-toggle-btn"
                title="Collapse issue"
                onClick={() => setIsExpanded(false)}
              >
                <i className="ti ti-chevron-up" /> Collapse
              </button>
            )}
          </div>

          {saveError && (
            <div className="error-banner small">
              <i className="ti ti-alert-circle" />
              <span>{saveError}</span>
              <button onClick={() => setSaveError(null)}>✕</button>
            </div>
          )}

          {isEditing ? (
            <textarea
              className="field-input description-input"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          ) : (
            <p className="issue-description">{issue.description}</p>
          )}

          <ScreenshotSection
            isEditing={isEditing}
            isCreator={isCreator}
            hasScreenshot={hasScreenshot}
            displayScreenshot={displayScreenshot}
            newScreenshot={mainScreenshot.screenshot}
            newScreenshotFormat={mainScreenshot.format}
            processingScreenshot={mainScreenshot.processing}
            fileInputRef={mainScreenshot.fileInputRef}
            onFileUpload={mainScreenshot.handleFileUpload}
            onDiscardNew={() => mainScreenshot.setScreenshot(null)}
            onRemoveSavedScreenshot={handleRemoveSavedScreenshot}
            onImageClick={handleImageClick}
            onImageError={handleImageError}
            getImageSource={getImageSource}
          />

          <ScreenshotHistory
            commentSnapshots={commentSnapshots}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory((v) => !v)}
            onImageClick={handleImageClick}
            onImageError={handleImageError}
            getImageSource={getImageSource}
          />

          <IssueMeta
            issue={issue}
            isEditing={isEditing}
            isBim={isBim}
            ifcElementCount={ifcElementCount}
          />

          {isEditing && (
            <IssueEditForm
              form={form}
              setForm={setForm}
              assigneeOptions={assigneeOptions}
              loadingAssignees={loadingAssignees}
              issueOrganisationId={issueOrganisationId}
              fallbackAssignedToLabel={issue.assignedTo ?? undefined}
            />
          )}

          {!isEditing && (
            <LinkedDrawingsView
              linkedDocuments={issue.linkedDocuments}
              onOpenDrawing={onOpenDrawing}
              isCreator={isCreator}
              onUnlinkDrawing={handleUnlinkDrawing}
            />
          )}

          {isEditing && (
            <LinkedDrawingsEdit
              linkedDocIds={linkedDocIds}
              setLinkedDocIds={setLinkedDocIds}
              existingLinkedDocuments={issue.linkedDocuments}
              drawingOptions={drawingOptions}
              loadingDrawings={loadingDrawings}
              drawingToAdd={drawingToAdd}
              setDrawingToAdd={setDrawingToAdd}
              issueProjectId={issueProjectId}
            />
          )}

          {!isEditing && (
            <CommentsList
              totalCommentCount={issue.comments.length}
              commentSortOrder={commentSortOrder}
              onSortChange={onSortChange}
              showAllComments={showAllComments}
              setShowAllComments={setShowAllComments}
              sortedComments={sortedComments}
              isCommentAuthor={isCommentAuthor}
              onStartEditComment={startEditComment}
              onDeleteComment={handleDeleteComment}
              onImageClick={handleImageClick}
              onImageError={handleImageError}
              getImageSource={getImageSource}
              editingCommentId={editingCommentId}
              editingCommentText={editingCommentText}
              setEditingCommentText={setEditingCommentText}
              editingCommentHasExistingImage={editingCommentHasExistingImage}
              editingCommentScreenshot={editingCommentScreenshotUpload.screenshot}
              editingCommentPreview={editingCommentScreenshotUpload.preview}
              processingEditCommentScreenshot={editingCommentScreenshotUpload.processing}
              editCommentFileInputRef={editingCommentScreenshotUpload.fileInputRef}
              onEditCommentFileUpload={editingCommentScreenshotUpload.handleFileUpload}
              onRemoveCommentImage={removeCommentImage}
              onDiscardNewCommentImage={() => editingCommentScreenshotUpload.reset()}
              onCancelEditComment={() => {
                setEditingCommentId(null);
                setEditingCommentText("");
                editingCommentScreenshotUpload.reset();
                setEditingCommentHasExistingImage(false);
              }}
              onSaveEditComment={handleEditComment}
            />
          )}

          {isResolving && (
            <ResolvePanel
              resolutionText={resolutionText}
              setResolutionText={setResolutionText}
              resolutionPreview={resolutionScreenshot.preview}
              onRemoveResolutionScreenshot={() => resolutionScreenshot.reset()}
              resolveFileInputRef={resolutionScreenshot.fileInputRef}
              onResolutionFileUpload={resolutionScreenshot.handleFileUpload}
              processingResolutionScreenshot={resolutionScreenshot.processing}
              onCancelResolve={() => {
                setIsResolving(false);
                resolutionScreenshot.reset();
              }}
              onConfirmResolve={handleResolveConfirm}
            />
          )}

          <ActionsBar
            isEditing={isEditing}
            isCreator={isCreator}
            canResolve={canResolve}
            onCancelEdit={() => {
              setIsEditing(false);
              mainScreenshot.setScreenshot(null);
            }}
            onSave={handleSave}
            onEdit={() => setIsEditing(true)}
            onDeleteIssue={handleDeleteIssueClick}
            onToggleResolve={() => setIsResolving((v) => !v)}
            onToggleAddScreenshot={() => setShowAddScreenshot((v) => !v)}
            onToggleCommentInput={() => setShowCommentInput((v) => !v)}
          />

          {showAddScreenshot && (
            <AddScreenshotPanel
              extraCommentText={extraCommentText}
              setExtraCommentText={setExtraCommentText}
              extraPreview={extraScreenshot.preview}
              onRemoveExtraScreenshot={() => extraScreenshot.reset()}
              extraFileInputRef={extraScreenshot.fileInputRef}
              onExtraFileUpload={extraScreenshot.handleFileUpload}
              processingExtraScreenshot={extraScreenshot.processing}
              extraScreenshot={extraScreenshot.screenshot}
              onAddScreenshot={handleAddScreenshot}
            />
          )}

          {showCommentInput && (
            <AddCommentPanel
              commentText={commentText}
              setCommentText={setCommentText}
              commentPreview={commentScreenshot.preview}
              onRemoveCommentScreenshot={() => commentScreenshot.reset()}
              commentFileInputRef={commentScreenshot.fileInputRef}
              onCommentFileUpload={commentScreenshot.handleFileUpload}
              processingCommentScreenshot={commentScreenshot.processing}
              onCancelComment={() => {
                setShowCommentInput(false);
                setCommentText('');
                commentScreenshot.reset();
              }}
              onAddComment={handleAddComment}
            />
          )}
        </div>
      </div>

      <IssueSidebar created={issue.created} updated={issue.updated} />

      <ScreenshotModal
        selectedScreenshot={selectedScreenshot}
        onClose={() => setSelectedScreenshot(null)}
        onImageError={handleImageError}
      />
    </div>
  );
}