"use client";

import Image from "next/image";
import { getPriorityColor, getStatusColor, AssigneeOption, DrawingOption } from "./issueApi";
import {
  Issue,
  IssueStatus,
  IssuePriority,
  IssueComment,
  BimIssue,
} from "./issueTypes";
import {
  getDrawingIcon,
  NonBimIssue,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from "./issueCardHelpers";

// Derived rather than imported: the original component never named this
// shape explicitly, it just indexed into `issue.linkedDocuments`.
type LinkedDocumentRef = NonNullable<Issue['linkedDocuments']>[number];

// ---------------------------------------------------------------------------
// IssueHeader — id, title (view/edit), domain badge, owner badge, org badge
// ---------------------------------------------------------------------------

interface IssueHeaderProps {
  issue: Issue;
  isEditing: boolean;
  titleValue: string;
  onTitleChange: (value: string) => void;
  isBim: boolean;
  isCreator: boolean;
}

export function IssueHeader({ issue, isEditing, titleValue, onTitleChange, isBim, isCreator }: IssueHeaderProps) {
  return (
    <div className="issue-header-row">
      <span className="issue-id">#{issue.id}</span>
      {isEditing ? (
        <input
          className="field-input title-input"
          value={titleValue}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      ) : (
        <h3 className="issue-title">{issue.title}</h3>
      )}
      <span className={`domain-badge domain-${issue.domain}`}>
        {isBim ? (
          <>
            <i className="ti ti-file-barcode" /> BIM
          </>
        ) : (
          <>
            <i className="ti ti-pencil" /> Other
          </>
        )}
      </span>
      {!isEditing && isCreator && (
        <span className="issue-owner-badge">(You)</span>
      )}
      {!isEditing && issue.organisation && (
        <span className="issue-organisation-badge">
          <i className="ti ti-building" />
          {issue.organisation}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueMeta — module/reporter/topic-type/IFC-count/comment-count/due-date/
// assignee/priority/status row
// ---------------------------------------------------------------------------

interface IssueMetaProps {
  issue: Issue;
  isEditing: boolean;
  isBim: boolean;
  ifcElementCount: number;
}

export function IssueMeta({ issue, isEditing, isBim, ifcElementCount }: IssueMetaProps) {
  return (
    <div className="issue-meta">
      <span className="meta-item">
        <i className="ti ti-box" />
        {issue.module}
      </span>

      <span className="meta-item">
        <i className="ti ti-user" />
        {issue.reportedBy}
      </span>

      {isBim && (
        <span className="meta-item topic-type">
          <i className="ti ti-tag" />
          {(issue as BimIssue).topicType}
        </span>
      )}

      {ifcElementCount > 0 && (
        <span className="meta-item">
          <i className="ti ti-cube" />
          {ifcElementCount} IFC elements
        </span>
      )}

      {!isBim && (issue as NonBimIssue).category && (
        <span className="meta-item topic-type">
          <i className="ti ti-tag" />
          {(issue as NonBimIssue).category}
        </span>
      )}

      {issue.comments.length > 0 && (
        <span className="meta-item">
          <i className="ti ti-message" />
          {issue.comments.length} comments
        </span>
      )}

      {!isEditing && issue.dueDate && (
        <span className="meta-item due-date">
          <i className="ti ti-calendar-due" />
          Due: {issue.dueDate}
        </span>
      )}

      {!isEditing && issue.assignedTo && (
        <span className="meta-item">
          <i className="ti ti-user-check" />
          {issue.assignedTo}
        </span>
      )}

      {!isEditing && (
        <>
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
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueEditForm — priority / status / assignee / due-date editable fields.
// Parent only mounts this when isEditing is true.
// ---------------------------------------------------------------------------

interface IssueEditFormValues {
  priority: IssuePriority;
  status: IssueStatus;
  assignedToId: number | null;
  dueDate: string;
}

interface IssueEditFormProps {
  form: IssueEditFormValues;
  setForm: React.Dispatch<React.SetStateAction<IssueEditFormValues & { title: string; description: string; assignedTo: string }>>;
  assigneeOptions: AssigneeOption[];
  loadingAssignees: boolean;
  issueOrganisationId: string | number | undefined | null;
  fallbackAssignedToLabel: string | undefined;
}

export function IssueEditForm({
  form,
  setForm,
  assigneeOptions,
  loadingAssignees,
  issueOrganisationId,
  fallbackAssignedToLabel,
}: IssueEditFormProps) {
  return (
    <div className="form-row" style={{ marginTop: '10px', marginBottom: '4px' }}>
      <div className="form-field">
        <label>Priority</label>
        <select
          className="field-select"
          value={form.priority}
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as IssuePriority }))}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Status</label>
        <select
          className="field-select"
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IssueStatus }))}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Assigned To</label>
        <select
          className="field-select"
          value={form.assignedToId ?? ''}
          onChange={(e) => setForm((f) => ({
            ...f,
            assignedToId: e.target.value ? Number(e.target.value) : null,
          }))}
        >
          <option value="">Unassigned</option>
          {assigneeOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
          {form.assignedToId !== null &&
            !assigneeOptions.some((a) => a.id === form.assignedToId) && (
              <option value={form.assignedToId}>
                {fallbackAssignedToLabel || `User #${form.assignedToId}`}
              </option>
          )}
        </select>
        {loadingAssignees && <span className="file-hint">Loading people…</span>}
        {!loadingAssignees && assigneeOptions.length === 0 && issueOrganisationId && (
          <span className="file-hint">No members found for this organisation.</span>
        )}
      </div>

      <div className="form-field">
        <label>Due Date</label>
        <input
          className="field-input"
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScreenshotSection — current screenshot display (view mode) plus the full
// upload / replace / discard / delete area (edit mode)
// ---------------------------------------------------------------------------

interface ScreenshotSectionProps {
  isEditing: boolean;
  isCreator: boolean;
  hasScreenshot: boolean;
  displayScreenshot: string | null;
  newScreenshot: string | null;
  newScreenshotFormat: "png" | "jpg";
  processingScreenshot: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDiscardNew: () => void;
  onRemoveSavedScreenshot: () => void;
  onImageClick: (src: string) => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  getImageSource: (imageData: string | undefined) => string;
}

export function ScreenshotSection({
  isEditing,
  isCreator,
  hasScreenshot,
  displayScreenshot,
  newScreenshot,
  newScreenshotFormat,
  processingScreenshot,
  fileInputRef,
  onFileUpload,
  onDiscardNew,
  onRemoveSavedScreenshot,
  onImageClick,
  onImageError,
  getImageSource,
}: ScreenshotSectionProps) {
  return (
    <div className="screenshot-section">
      {!isEditing && hasScreenshot && (
        <div className="screenshot-thumbnail-container" style={{ position: 'relative', width: 150, height: 100 }}>
          <Image
            src={displayScreenshot || '/images/test.jpg'}
            alt="Issue screenshot"
            fill
            unoptimized
            sizes="150px"
            className="screenshot-thumbnail-image"
            style={{ objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => onImageClick(getImageSource(displayScreenshot!))}
            onError={onImageError}
          />
          <span className="screenshot-hint">Click to enlarge</span>
          {isCreator && (
            <button
              className="screenshot-delete-btn"
              onClick={onRemoveSavedScreenshot}
              title="Delete screenshot"
            >
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
      )}

      {isEditing && (
        <div className="screenshot-edit-area">
          <div className="screenshot-edit-header">
            <i className="ti ti-photo" />
            <span className="screenshot-label">Screenshot</span>
          </div>

          {hasScreenshot && (
            <div className="screenshot-preview-container" style={{ position: 'relative', width: 200, height: 150 }}>
              <Image
                src={displayScreenshot || '/images/test.jpg'}
                alt="Screenshot preview"
                fill
                unoptimized
                sizes="200px"
                className="screenshot-preview-image"
                style={{ objectFit: 'contain' }}
                onError={onImageError}
              />
              {!newScreenshot && (
                <span className="screenshot-current-label">Current image</span>
              )}
            </div>
          )}

          <div className="screenshot-upload-actions">
            <button
              className="btn-primary small"
              onClick={() => fileInputRef.current?.click()}
              disabled={processingScreenshot}
              type="button"
            >
              <i className={`ti ${processingScreenshot ? 'ti-loader' : 'ti-upload'}`} />
              {processingScreenshot
                ? 'Processing…'
                : newScreenshot ? 'Change New Image' : hasScreenshot ? 'Replace Image' : 'Upload Image'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={onFileUpload}
              style={{ display: 'none' }}
            />

            {newScreenshot && (
              <button
                className="btn-outline small danger"
                onClick={onDiscardNew}
                type="button"
              >
                <i className="ti ti-x" /> Discard New
              </button>
            )}

            {!newScreenshot && hasScreenshot && (
              <button
                className="btn-outline small danger"
                onClick={onRemoveSavedScreenshot}
                type="button"
              >
                <i className="ti ti-trash" /> Delete
              </button>
            )}

            <span className="file-hint">Max 5MB (PNG/JPG) — auto-compressed</span>
          </div>

          {newScreenshot && (
            <div className="screenshot-new-preview">
              <span className="preview-label">📸 New image (will replace current):</span>
              <div className="screenshot-preview-image" style={{ position: 'relative', width: 200, height: 150 }}>
                <Image
                  src={`data:image/${newScreenshotFormat};base64,${newScreenshot}`}
                  alt="New screenshot preview"
                  fill
                  unoptimized
                  sizes="200px"
                  style={{ objectFit: 'contain' }}
                  onError={onImageError}
                />
              </div>
              <span className="screenshot-pending-badge">Pending replacement</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScreenshotHistory — collapsible list of snapshots pulled from comments
// ---------------------------------------------------------------------------

interface ScreenshotHistoryProps {
  commentSnapshots: IssueComment[];
  showHistory: boolean;
  onToggleHistory: () => void;
  onImageClick: (src: string) => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  getImageSource: (imageData: string | undefined) => string;
}

export function ScreenshotHistory({
  commentSnapshots,
  showHistory,
  onToggleHistory,
  onImageClick,
  onImageError,
  getImageSource,
}: ScreenshotHistoryProps) {
  if (commentSnapshots.length === 0) return null;

  return (
    <div className="screenshot-history">
      <button
        className="history-toggle"
        onClick={onToggleHistory}
        type="button"
      >
        <i className={`ti ${showHistory ? 'ti-chevron-down' : 'ti-chevron-right'}`} />
        <i className="ti ti-photo" />
        {commentSnapshots.length} snapshot{commentSnapshots.length > 1 ? 's' : ''} in history
      </button>
      {showHistory && (
        <div className="history-thumbnails">
          {commentSnapshots.map((c) => (
            <div key={c.id} className="history-thumbnail-item">
              <div style={{ position: 'relative', width: '100px', height: '80px' }}>
                <Image
                  src={getImageSource(c.snapshot!)}
                  alt={`Snapshot from ${c.author}`}
                  fill
                  unoptimized
                  sizes="100px"
                  style={{ objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => onImageClick(getImageSource(c.snapshot!))}
                  onError={onImageError}
                />
              </div>
              <span className="history-thumbnail-caption">
                {c.author} · {c.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedDrawingsView — read-only chips (view mode), with an optional direct
// unlink action for the issue creator so drawings can be unlinked without
// entering full edit mode.
// ---------------------------------------------------------------------------

interface LinkedDrawingsViewProps {
  linkedDocuments: LinkedDocumentRef[] | undefined;
  onOpenDrawing: (documentId: number) => void;
  isCreator?: boolean;
  onUnlinkDrawing?: (documentId: number) => void;
}

export function LinkedDrawingsView({
  linkedDocuments,
  onOpenDrawing,
  isCreator,
  onUnlinkDrawing,
}: LinkedDrawingsViewProps) {
  if (!linkedDocuments || linkedDocuments.length === 0) return null;

  const canUnlink = !!isCreator && !!onUnlinkDrawing;

  return (
    <div className="issue-linked-drawings">
      <span className="issue-linked-drawings-label">
        <i className="ti ti-paperclip" /> Linked drawings
      </span>
      <div className="issue-linked-drawings-list">
        {linkedDocuments.map((doc) => (
          <span key={doc.id} className="issue-linked-drawing-chip">
            <button
              onClick={() => onOpenDrawing(doc.id)}
              type="button"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <i className={`ti ${getDrawingIcon(doc.file_type)}`} />
              {doc.title}
            </button>
            {canUnlink && (
              <button
                type="button"
                className="linked-drawing-unlink-btn"
                onClick={() => onUnlinkDrawing!(doc.id)}
                title="Unlink drawing"
              >
                <i className="ti ti-x" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedDrawingsEdit — link/unlink editor (edit mode)
// ---------------------------------------------------------------------------

interface LinkedDrawingsEditProps {
  linkedDocIds: number[];
  setLinkedDocIds: React.Dispatch<React.SetStateAction<number[]>>;
  existingLinkedDocuments: LinkedDocumentRef[] | undefined;
  drawingOptions: DrawingOption[];
  loadingDrawings: boolean;
  drawingToAdd: number | "";
  setDrawingToAdd: React.Dispatch<React.SetStateAction<number | "">>;
  issueProjectId: number | string | undefined | null;
}

export function LinkedDrawingsEdit({
  linkedDocIds,
  setLinkedDocIds,
  existingLinkedDocuments,
  drawingOptions,
  loadingDrawings,
  drawingToAdd,
  setDrawingToAdd,
  issueProjectId,
}: LinkedDrawingsEditProps) {
  return (
    <div className="issue-linked-drawings" style={{ marginTop: '12px' }}>
      <span className="issue-linked-drawings-label">
        <i className="ti ti-paperclip" /> Linked drawings
      </span>

      <div className="issue-linked-drawings-list" style={{ marginTop: '8px' }}>
        {linkedDocIds.map((docId) => {
          const doc =
            existingLinkedDocuments?.find((d) => d.id === docId) ||
            drawingOptions.find((d) => d.id === docId);
          return (
            <span key={docId} className="issue-linked-drawing-chip">
              <i className={`ti ${getDrawingIcon(doc?.file_type || '')}`} />
              {doc?.title || `Drawing #${docId}`}
              <button
                type="button"
                className="linked-drawing-unlink-btn"
                onClick={() => setLinkedDocIds((ids) => ids.filter((id) => id !== docId))}
                title="Unlink"
              >
                <i className="ti ti-x" />
              </button>
            </span>
          );
        })}
        {linkedDocIds.length === 0 && (
          <span className="file-hint">No drawings linked yet.</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
        <select
          className="field-select small"
          value={drawingToAdd}
          onChange={(e) => setDrawingToAdd(e.target.value ? Number(e.target.value) : "")}
          disabled={!issueProjectId}
        >
          <option value="">
            {loadingDrawings ? 'Loading drawings…' : 'Select a drawing to link…'}
          </option>
          {drawingOptions
            .filter((d) => !linkedDocIds.includes(d.id))
            .map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
        </select>
        <button
          type="button"
          className="btn-outline small"
          disabled={!drawingToAdd}
          onClick={() => {
            if (drawingToAdd) {
              setLinkedDocIds((ids) => [...ids, Number(drawingToAdd)]);
              setDrawingToAdd("");
            }
          }}
        >
          <i className="ti ti-plus" /> Link
        </button>
      </div>
      {!loadingDrawings && drawingOptions.length === 0 && (
        <span className="file-hint">No drawings found for this project.</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentsList / CommentItem — comment feed with inline edit mode
// ---------------------------------------------------------------------------

interface CommentEditState {
  editingCommentId: string | null;
  editingCommentText: string;
  setEditingCommentText: (v: string) => void;
  editingCommentHasExistingImage: boolean;
  editingCommentScreenshot: string | null;
  editingCommentPreview: string | null;
  processingEditCommentScreenshot: boolean;
  editCommentFileInputRef: React.RefObject<HTMLInputElement | null>;
  onEditCommentFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCommentImage: () => void;
  onDiscardNewCommentImage: () => void;
  onCancelEditComment: () => void;
  onSaveEditComment: (commentId: string, originalHadSnapshot: boolean) => void;
}

interface CommentItemProps extends CommentEditState {
  comment: IssueComment;
  isAuthor: boolean;
  onStartEditComment: (comment: IssueComment) => void;
  onDeleteComment: (commentId: string) => void;
  onImageClick: (src: string) => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  getImageSource: (imageData: string | undefined) => string;
}

function CommentItem({
  comment,
  isAuthor,
  editingCommentId,
  editingCommentText,
  setEditingCommentText,
  editingCommentHasExistingImage,
  editingCommentScreenshot,
  editingCommentPreview,
  processingEditCommentScreenshot,
  editCommentFileInputRef,
  onEditCommentFileUpload,
  onRemoveCommentImage,
  onDiscardNewCommentImage,
  onCancelEditComment,
  onSaveEditComment,
  onStartEditComment,
  onDeleteComment,
  onImageClick,
  onImageError,
  getImageSource,
}: CommentItemProps) {
  if (editingCommentId === comment.id) {
    return (
      <div className="comment-item">
        <div className="comment-edit-mode">
          <textarea
            className="field-input"
            value={editingCommentText}
            onChange={(e) => setEditingCommentText(e.target.value)}
            rows={2}
          />

          <div className="comment-image-edit-section">
            <div className="comment-image-edit-header">
              <i className="ti ti-photo" />
              <span>Comment Image</span>
            </div>

            {editingCommentHasExistingImage && !editingCommentScreenshot && (
              <div className="comment-existing-image">
                <div style={{ position: 'relative', width: 150, height: 100 }}>
                  <Image
                    src={comment.snapshot ? getImageSource(comment.snapshot) : '/images/test.jpg'}
                    alt="Existing comment image"
                    fill
                    unoptimized
                    sizes="150px"
                    className="comment-edit-image-preview"
                    style={{ objectFit: 'contain' }}
                    onError={onImageError}
                  />
                </div>
                <span className="existing-image-label">Current image</span>
                <button
                  className="btn-outline small danger"
                  onClick={onRemoveCommentImage}
                  style={{ marginTop: '4px' }}
                  type="button"
                >
                  <i className="ti ti-trash" /> Remove image
                </button>
              </div>
            )}

            {editingCommentScreenshot && (
              <div className="comment-new-image-preview">
                <div style={{ position: 'relative', width: 150, height: 100 }}>
                  <Image
                    src={editingCommentPreview || '/images/test.jpg'}
                    alt="New comment image preview"
                    fill
                    unoptimized
                    sizes="150px"
                    className="comment-edit-image-preview"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <span className="new-image-label">📸 New image (pending)</span>
                <button
                  className="btn-outline small danger"
                  onClick={onDiscardNewCommentImage}
                  type="button"
                >
                  <i className="ti ti-x" /> Discard
                </button>
              </div>
            )}

            <div className="comment-image-upload-actions">
              <button
                className="btn-outline small"
                onClick={() => editCommentFileInputRef.current?.click()}
                disabled={processingEditCommentScreenshot}
                type="button"
              >
                <i className={`ti ${processingEditCommentScreenshot ? 'ti-loader' : 'ti-upload'}`} />
                {processingEditCommentScreenshot
                  ? 'Processing…'
                  : editingCommentScreenshot ? 'Change Image' : editingCommentHasExistingImage ? 'Replace Image' : 'Add Image'}
              </button>
              <input
                ref={editCommentFileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={onEditCommentFileUpload}
                style={{ display: 'none' }}
              />
              <span className="file-hint">Max 5MB — auto-compressed</span>
            </div>
          </div>

          <div className="comment-edit-actions">
            <button
              className="btn-outline small"
              onClick={onCancelEditComment}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn-primary small"
              onClick={() => onSaveEditComment(comment.id, !!comment.snapshot)}
              disabled={!editingCommentText.trim()}
              type="button"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="comment-item">
      <div className="comment-header">
        <span className="comment-author">{comment.author}</span>
        <span className="comment-time">{comment.timestamp}</span>
        {isAuthor && (
          <span className="comment-owner-badge">(You)</span>
        )}
      </div>
      <div className="comment-text">{comment.text}</div>
      {comment.snapshot && (
        <div className="comment-snapshot" style={{ position: 'relative', width: 200, height: 150 }}>
          <Image
            src={getImageSource(comment.snapshot)}
            alt="Comment screenshot"
            fill
            unoptimized
            sizes="200px"
            className="comment-snapshot-thumb"
            style={{ objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => onImageClick(getImageSource(comment.snapshot))}
            onError={onImageError}
          />
        </div>
      )}
      {isAuthor && (
        <div className="comment-actions">
          <button
            className="comment-action-btn"
            onClick={() => onStartEditComment(comment)}
          >
            <i className="ti ti-edit" /> Edit
          </button>
          <button
            className="comment-action-btn danger"
            onClick={() => onDeleteComment(comment.id)}
          >
            <i className="ti ti-trash" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface CommentsListProps extends CommentEditState {
  totalCommentCount: number;
  commentSortOrder: "asc" | "desc";
  onSortChange: () => void;
  showAllComments: boolean;
  setShowAllComments: (v: boolean) => void;
  sortedComments: IssueComment[];
  isCommentAuthor: (author: string) => boolean;
  onStartEditComment: (comment: IssueComment) => void;
  onDeleteComment: (commentId: string) => void;
  onImageClick: (src: string) => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  getImageSource: (imageData: string | undefined) => string;
}

export function CommentsList({
  totalCommentCount,
  commentSortOrder,
  onSortChange,
  showAllComments,
  setShowAllComments,
  sortedComments,
  isCommentAuthor,
  onStartEditComment,
  onDeleteComment,
  onImageClick,
  onImageError,
  getImageSource,
  ...commentEditState
}: CommentsListProps) {
  if (totalCommentCount === 0) return null;

  return (
    <div className="comments-section">
      <div className="comments-header">
        <div className="comments-header-left">
          <i className="ti ti-message-circle" />
          <span>{totalCommentCount} comments</span>
        </div>
        <div className="comments-header-actions">
          <button
            className="sort-toggle"
            onClick={onSortChange}
            title={commentSortOrder === "desc" ? "Newest first" : "Oldest first"}
          >
            <i className={`ti ${commentSortOrder === "desc" ? 'ti-arrow-down' : 'ti-arrow-up'}`} />
            {commentSortOrder === "desc" ? "Newest" : "Oldest"}
          </button>
          {totalCommentCount > 3 && (
            <button
              className="comments-toggle"
              onClick={() => setShowAllComments(!showAllComments)}
            >
              {showAllComments ? 'Show less' : `Show all (${totalCommentCount})`}
            </button>
          )}
        </div>
      </div>
      <div className="comments-list">
        {(showAllComments ? sortedComments : sortedComments.slice(0, 3)).map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            isAuthor={isCommentAuthor(comment.author)}
            onStartEditComment={onStartEditComment}
            onDeleteComment={onDeleteComment}
            onImageClick={onImageClick}
            onImageError={onImageError}
            getImageSource={getImageSource}
            {...commentEditState}
          />
        ))}
        {!showAllComments && sortedComments.length > 3 && (
          <div className="comments-more">
            + {sortedComments.length - 3} more comments
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResolvePanel
// ---------------------------------------------------------------------------

interface ResolvePanelProps {
  resolutionText: string;
  setResolutionText: (v: string) => void;
  resolutionPreview: string | null;
  onRemoveResolutionScreenshot: () => void;
  resolveFileInputRef: React.RefObject<HTMLInputElement | null>;
  onResolutionFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processingResolutionScreenshot: boolean;
  onCancelResolve: () => void;
  onConfirmResolve: () => void;
}

export function ResolvePanel({
  resolutionText,
  setResolutionText,
  resolutionPreview,
  onRemoveResolutionScreenshot,
  resolveFileInputRef,
  onResolutionFileUpload,
  processingResolutionScreenshot,
  onCancelResolve,
  onConfirmResolve,
}: ResolvePanelProps) {
  return (
    <div className="resolve-panel">
      <textarea
        className="field-input"
        placeholder="Describe how this was resolved…"
        value={resolutionText}
        onChange={(e) => setResolutionText(e.target.value)}
        rows={2}
      />

      <div className="resolve-screenshot-upload">
        {resolutionPreview ? (
          <div className="screenshot-preview" style={{ position: 'relative', width: 200, height: 150 }}>
            <Image
              src={resolutionPreview}
              alt="Resolution screenshot preview"
              fill
              unoptimized
              sizes="200px"
              style={{ objectFit: 'contain' }}
            />
            <button
              className="remove-btn"
              onClick={onRemoveResolutionScreenshot}
              type="button"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            className="btn-outline small"
            onClick={() => resolveFileInputRef.current?.click()}
            disabled={processingResolutionScreenshot}
            type="button"
          >
            <i className={`ti ${processingResolutionScreenshot ? 'ti-loader' : 'ti-camera'}`} />
            {processingResolutionScreenshot ? 'Processing…' : 'Attach proof-of-fix screenshot (optional)'}
          </button>
        )}
        <input
          ref={resolveFileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={onResolutionFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="form-actions">
        <button
          className="btn-outline"
          onClick={onCancelResolve}
          type="button"
        >
          Cancel
        </button>
        <button className="btn-primary" onClick={onConfirmResolve} type="button">
          <i className="ti ti-check" /> Confirm Resolve
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionsBar — edit/save/cancel/delete/resolve/add-screenshot/add-comment
// ---------------------------------------------------------------------------

interface ActionsBarProps {
  isEditing: boolean;
  isCreator: boolean;
  canResolve: boolean;
  onCancelEdit: () => void;
  onSave: () => void;
  onEdit: () => void;
  onDeleteIssue: () => void;
  onToggleResolve: () => void;
  onToggleAddScreenshot: () => void;
  onToggleCommentInput: () => void;
}

export function ActionsBar({
  isEditing,
  isCreator,
  canResolve,
  onCancelEdit,
  onSave,
  onEdit,
  onDeleteIssue,
  onToggleResolve,
  onToggleAddScreenshot,
  onToggleCommentInput,
}: ActionsBarProps) {
  return (
    <div className="issue-actions">
      {isEditing ? (
        <>
          <button className="btn-outline" onClick={onCancelEdit}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSave}>
            <i className="ti ti-device-floppy" /> Save
          </button>
        </>
      ) : (
        <>
          {isCreator && (
            <>
              <button className="btn-outline" onClick={onEdit}>
                <i className="ti ti-edit" /> Edit
              </button>
              <button
                className="btn-outline danger"
                onClick={onDeleteIssue}
              >
                <i className="ti ti-trash" /> Delete
              </button>
            </>
          )}

          {canResolve && (
            <button className="btn-outline" onClick={onToggleResolve}>
              <i className="ti ti-check" /> Resolve
            </button>
          )}
          <button
            className="btn-outline"
            onClick={onToggleAddScreenshot}
          >
            <i className="ti ti-photo-plus" /> Add Screenshot
          </button>
          <button
            className="btn-outline"
            onClick={onToggleCommentInput}
          >
            <i className="ti ti-message-plus" /> Add Comment
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddScreenshotPanel
// ---------------------------------------------------------------------------

interface AddScreenshotPanelProps {
  extraCommentText: string;
  setExtraCommentText: (v: string) => void;
  extraPreview: string | null;
  onRemoveExtraScreenshot: () => void;
  extraFileInputRef: React.RefObject<HTMLInputElement | null>;
  onExtraFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processingExtraScreenshot: boolean;
  extraScreenshot: string | null;
  onAddScreenshot: () => void;
}

export function AddScreenshotPanel({
  extraCommentText,
  setExtraCommentText,
  extraPreview,
  onRemoveExtraScreenshot,
  extraFileInputRef,
  onExtraFileUpload,
  processingExtraScreenshot,
  extraScreenshot,
  onAddScreenshot,
}: AddScreenshotPanelProps) {
  return (
    <div className="resolve-screenshot-upload" style={{ marginTop: '12px' }}>
      <textarea
        className="field-input"
        placeholder="Add a note about this screenshot (optional)…"
        value={extraCommentText}
        onChange={(e) => setExtraCommentText(e.target.value)}
        rows={2}
        style={{ marginBottom: '8px' }}
      />
      {extraPreview ? (
        <div className="screenshot-preview" style={{ position: 'relative', width: 200, height: 150 }}>
          <Image
            src={extraPreview}
            alt="New screenshot preview"
            fill
            unoptimized
            sizes="200px"
            style={{ objectFit: 'contain' }}
          />
          <button
            className="remove-btn"
            onClick={onRemoveExtraScreenshot}
            type="button"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          className="btn-outline small"
          onClick={() => extraFileInputRef.current?.click()}
          disabled={processingExtraScreenshot}
          type="button"
        >
          <i className={`ti ${processingExtraScreenshot ? 'ti-loader' : 'ti-camera'}`} />
          {processingExtraScreenshot ? 'Processing…' : 'Choose image'}
        </button>
      )}
      <input
        ref={extraFileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={onExtraFileUpload}
        style={{ display: 'none' }}
      />
      {extraScreenshot && (
        <button
          className="btn-primary small"
          onClick={onAddScreenshot}
          style={{ marginTop: '8px' }}
          type="button"
        >
          Add
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddCommentPanel
// ---------------------------------------------------------------------------

interface AddCommentPanelProps {
  commentText: string;
  setCommentText: (v: string) => void;
  commentPreview: string | null;
  onRemoveCommentScreenshot: () => void;
  commentFileInputRef: React.RefObject<HTMLInputElement | null>;
  onCommentFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processingCommentScreenshot: boolean;
  onCancelComment: () => void;
  onAddComment: () => void;
}

export function AddCommentPanel({
  commentText,
  setCommentText,
  commentPreview,
  onRemoveCommentScreenshot,
  commentFileInputRef,
  onCommentFileUpload,
  processingCommentScreenshot,
  onCancelComment,
  onAddComment,
}: AddCommentPanelProps) {
  return (
    <div className="comment-input-panel" style={{ marginTop: '12px' }}>
      <textarea
        className="field-input"
        placeholder="Add a comment…"
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        rows={2}
      />

      <div className="comment-image-upload">
        {commentPreview ? (
          <div className="comment-image-preview" style={{ position: 'relative', width: 150, height: 100 }}>
            <Image
              src={commentPreview}
              alt="Comment image preview"
              fill
              unoptimized
              sizes="150px"
              style={{ objectFit: 'contain' }}
            />
            <button
              className="remove-btn"
              onClick={onRemoveCommentScreenshot}
              type="button"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            className="btn-outline small"
            onClick={() => commentFileInputRef.current?.click()}
            disabled={processingCommentScreenshot}
            type="button"
          >
            <i className={`ti ${processingCommentScreenshot ? 'ti-loader' : 'ti-camera'}`} />
            {processingCommentScreenshot ? 'Processing…' : 'Add image (optional)'}
          </button>
        )}
        <input
          ref={commentFileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={onCommentFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="form-actions" style={{ marginTop: '8px' }}>
        <button
          className="btn-outline"
          onClick={onCancelComment}
          type="button"
        >
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={onAddComment}
          disabled={!commentText.trim()}
          type="button"
        >
          <i className="ti ti-send" /> Post Comment
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IssueSidebar — created/updated timestamps + chevron (issue-right column)
// ---------------------------------------------------------------------------

interface IssueSidebarProps {
  created: string;
  updated?: string;
}

export function IssueSidebar({ created, updated }: IssueSidebarProps) {
  return (
    <div className="issue-right">
      <div className="issue-timestamps">
        <span className="issue-time">
          <i className="ti ti-clock" />
          {created}
        </span>
        {updated && (
          <span className="issue-time updated">
            <i className="ti ti-refresh" />
            {updated}
          </span>
        )}
      </div>
      <i className="ti ti-chevron-right issue-arrow" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScreenshotModal — full-size lightbox
// ---------------------------------------------------------------------------

interface ScreenshotModalProps {
  selectedScreenshot: string | null;
  onClose: () => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function ScreenshotModal({ selectedScreenshot, onClose, onImageError }: ScreenshotModalProps) {
  if (!selectedScreenshot) return null;

  return (
    <div className="screenshot-modal" onClick={onClose}>
      <button
        className="screenshot-modal-close"
        onClick={onClose}
      >
        ✕
      </button>
      <div
        className="screenshot-modal-content"
        style={{ position: 'relative', width: '90vw', height: '85vh' }}
      >
        <Image
          src={selectedScreenshot}
          alt="Full size screenshot"
          fill
          unoptimized
          sizes="90vw"
          style={{ objectFit: 'contain' }}
          onClick={(e) => e.stopPropagation()}
          onError={onImageError}
        />
      </div>
    </div>
  );
}