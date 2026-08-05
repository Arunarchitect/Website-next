// app/issues/IssueDetail.tsx
//
// Full single-issue view. This is exactly what used to be the "expanded"
// branch of IssueCard, pulled out into its own component so it can be
// rendered standalone on the dedicated /issues/[id] page instead of
// inline-expanding inside the list.

"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  getPriorityColor,
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


import { ExpandableText } from "./ExpandableText";

import { ManageAccessPanel } from "./IssueCardAccessParts";
import {
  getImageSource,
  useScreenshotUpload,
  linkifyText,
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
  AddCommentPanel,
  IssueSidebar,
  ScreenshotModal,
} from "./IssueCardParts";

interface IssueDetailProps {
  issue: Issue;
  commentSortOrder: "asc" | "desc";
  onSortChange: () => void;
  onSave: (patch: Partial<Issue>) => Promise<void>;
  onResolve: (resolution: string, snapshotData?: string, snapshotFormat?: "png" | "jpg") => Promise<void>;
  onRemoveSnapshot: () => Promise<void>;
  onRemoveAttachment: (index: number) => Promise<void>;
  onAddComment: (text: string, snapshotData?: string, snapshotFormat?: "png" | "jpg") => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, text: string, snapshotData?: string, snapshotFormat?: "png" | "jpg", removeSnapshot?: boolean) => Promise<void>;
  onDeleteIssue: (issueId: string) => Promise<void>;
  onOpenDrawing: (documentId: number) => void;
  currentUser: CurrentUser;
  isUserCreator: (reportedBy: string, user: CurrentUser) => boolean;
  onUpdateAccess: (access: {
    classification: Issue["classification"];
    allowedRoles: string[];
    sharedWith: number[];
  }) => Promise<void>;
}

export function IssueDetail({
  issue,
  commentSortOrder,
  onSortChange,
  onSave,
  onResolve,
  onRemoveSnapshot,
  onRemoveAttachment,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onDeleteIssue,
  onOpenDrawing,
  currentUser,
  isUserCreator,
  onUpdateAccess,
}: IssueDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showManageAccess, setShowManageAccess] = useState(false);
  const [accessOrgMembers, setAccessOrgMembers] = useState<AssigneeOption[]>([]);
  const [loadingAccessMembers, setLoadingAccessMembers] = useState(false);
  const shareUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/issues/${issue.id}`
    : "";

  // Screenshot upload flows — one hook instance per independent upload site.
  const mainScreenshot = useScreenshotUpload(setSaveError, false);
  const resolutionScreenshot = useScreenshotUpload(setSaveError, true);
  const commentScreenshot = useScreenshotUpload(setSaveError, true);
  const editingCommentScreenshotUpload = useScreenshotUpload(setSaveError, true);

  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");

  const [showHistory, setShowHistory] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentHasExistingImage, setEditingCommentHasExistingImage] = useState(false);

  const [form, setForm] = useState({
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    assignedTo: issue.assignedTo ?? "",
    assignedToId: issue.assignedToId ?? null,
    dueDate: issue.dueDate ?? "",
  });

  // Keep the edit form in sync if the underlying issue changes out from
  // under us (e.g. a refresh() landed while the user wasn't editing).
  useEffect(() => {
    if (!isEditing) {
      setForm({
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        assignedTo: issue.assignedTo ?? "",
        assignedToId: issue.assignedToId ?? null,
        dueDate: issue.dueDate ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id, issue.title, issue.description, issue.status, issue.priority, issue.assignedTo, issue.assignedToId, issue.dueDate]);

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
    if (!showManageAccess || !issueOrganisationId) return;
    let cancelled = false;
    setLoadingAccessMembers(true);
    getOrganisationMembers(issueOrganisationId)
      .then((opts) => { if (!cancelled) setAccessOrgMembers(opts); })
      .finally(() => { if (!cancelled) setLoadingAccessMembers(false); });
    return () => { cancelled = true; };
  }, [showManageAccess, issueOrganisationId]);

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

    const isCreator = isUserCreator(issue.reportedBy, currentUser) ||
    (!!issue.reportedById && !!currentUser.id && issue.reportedById === currentUser.id);

      const isCommentAuthor = useCallback((commentAuthor: string): boolean => {
    if (!commentAuthor || commentAuthor === 'Unknown') return false;
    const ca = commentAuthor.toLowerCase().trim().replace(/\s+/g, '');
    const candidates = [
      currentUser.email.toLowerCase().trim(),
      currentUser.fullName.toLowerCase().trim().replace(/\s+/g, ''),
      currentUser.username.toLowerCase().trim(),
      currentUser.displayName.toLowerCase().trim().replace(/\s+/g, ''),
      ((currentUser.firstName || '') + (currentUser.lastName || '')).toLowerCase().trim(),
    ].filter(Boolean);
    return candidates.includes(ca);
  }, [currentUser]);

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

  const handleSaveAccess = async (access: {
    classification: Issue["classification"];
    allowedRoles: string[];
    sharedWith: number[];
  }) => {
    await onUpdateAccess(access);
    setShowManageAccess(false);
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
    if (!window.confirm('Are you sure you want to delete this screenshot? This cannot be undone.')) {
      return;
    }
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

    const handleUnlinkDrawing = async (documentId: number) => {
    if (!window.confirm('Are you sure you want to unlink this drawing from the issue?')) return;
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
              onPaste={mainScreenshot.handlePaste}
              rows={3}
            />
          ) : (
            <ExpandableText
              text={issue.description}
              linkify={linkifyText}
              className="issue-description"
              wordLimit={30}
            />
          )}

          <ScreenshotSection
            isEditing={isEditing}
            isCreator={isCreator}
            hasScreenshot={hasScreenshot}
            displayScreenshot={displayScreenshot}
            newScreenshot={mainScreenshot.screenshot}
            newScreenshotFormat={mainScreenshot.format}
            processingScreenshot={mainScreenshot.processing}
            isDragging={mainScreenshot.isDragging}
            fileInputRef={mainScreenshot.fileInputRef}
            onFileUpload={mainScreenshot.handleFileUpload}
            onPaste={mainScreenshot.handlePaste}
            onDrop={mainScreenshot.handleDrop}
            onDragOver={mainScreenshot.handleDragOver}
            onDragLeave={mainScreenshot.handleDragLeave}
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
              editingCommentIsDragging={editingCommentScreenshotUpload.isDragging}
              editCommentFileInputRef={editingCommentScreenshotUpload.fileInputRef}
              onEditCommentFileUpload={editingCommentScreenshotUpload.handleFileUpload}
              onEditCommentPaste={editingCommentScreenshotUpload.handlePaste}
              onEditCommentDrop={editingCommentScreenshotUpload.handleDrop}
              onEditCommentDragOver={editingCommentScreenshotUpload.handleDragOver}
              onEditCommentDragLeave={editingCommentScreenshotUpload.handleDragLeave}
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
              onResolutionPaste={resolutionScreenshot.handlePaste}
              onResolutionDrop={resolutionScreenshot.handleDrop}
              onResolutionDragOver={resolutionScreenshot.handleDragOver}
              onResolutionDragLeave={resolutionScreenshot.handleDragLeave}
              resolutionIsDragging={resolutionScreenshot.isDragging}
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
            canManageAccess={issue.canManageAccess}
            canResolve={canResolve}
            shareUrl={shareUrl}  
            onCancelEdit={() => {
              setIsEditing(false);
              mainScreenshot.setScreenshot(null);
            }}
            onSave={handleSave}
            onEdit={() => setIsEditing(true)}
            onDeleteIssue={handleDeleteIssueClick}
            onToggleResolve={() => setIsResolving((v) => !v)}
            onToggleCommentInput={() => setShowCommentInput((v) => !v)}
            onToggleManageAccess={() => setShowManageAccess((v) => !v)}
          />

          {showManageAccess && (
            <ManageAccessPanel
              classification={issue.classification}
              allowedRoles={issue.allowedRoles}
              sharedWith={issue.sharedWith}
              sharedWithDetails={issue.sharedWithDetails}
              orgMembers={accessOrgMembers}
              loadingOrgMembers={loadingAccessMembers}
              onCancel={() => setShowManageAccess(false)}
              onSave={handleSaveAccess}
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
              onCommentPaste={commentScreenshot.handlePaste}
              onCommentDrop={commentScreenshot.handleDrop}
              onCommentDragOver={commentScreenshot.handleDragOver}
              onCommentDragLeave={commentScreenshot.handleDragLeave}
              commentIsDragging={commentScreenshot.isDragging}
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