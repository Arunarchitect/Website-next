// app/issues/IssueCard.tsx

"use client";

import { useState, useRef } from "react";
import {
  getPriorityColor,
  getStatusColor,
} from "./issueApi";
import {
  Issue,
  IssueStatus,
  IssuePriority,
  isBimIssue,
} from "./issueTypes";
import { isUserMatch } from '@/components/utils/userMatching';

const STATUS_OPTIONS: IssueStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTIONS: IssuePriority[] = ["High", "Medium", "Low"];

const getImageSource = (imageData: string | undefined): string => {
  if (!imageData) {
    return '/images/test.jpg';
  }

  if (imageData.startsWith('data:image')) {
    return imageData;
  }

  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }

  if (imageData.startsWith('/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    return `${baseUrl}${imageData}`;
  }

  if (imageData.includes('issue_snapshots/') || imageData.includes('media/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    const path = imageData.startsWith('/') ? imageData : `/${imageData}`;
    return `${baseUrl}${path}`;
  }

  if (imageData.length > 100) {
    try {
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(imageData.substring(0, 100));
      if (isBase64) {
        const isPng = imageData.startsWith('iVBORw0KGgo');
        const format = isPng ? 'png' : 'jpeg';
        return `data:image/${format};base64,${imageData}`;
      }
    } catch (e) {
      console.warn('Failed to process image data:', e);
    }
  }

  return '/images/test.jpg';
};

const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 0 };
const DEFAULT_CAMERA_DIRECTION = { x: 0, y: 0, z: -1 };
const DEFAULT_CAMERA_UP_VECTOR = { x: 0, y: 1, z: 0 };
const DEFAULT_FIELD_OF_VIEW = 60;

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
  currentUser: { email: string; fullName: string; username: string; displayName: string };
  isUserCreator: (reportedBy: string, user: any) => boolean;
  
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
  currentUser,
  isUserCreator,
}: IssueCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newScreenshot, setNewScreenshot] = useState<string | null>(null);
  const [newScreenshotFormat, setNewScreenshotFormat] = useState<"png" | "jpg">("png");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resolutionScreenshot, setResolutionScreenshot] = useState<string | null>(null);
  const [resolutionScreenshotFormat, setResolutionScreenshotFormat] = useState<"png" | "jpg">("png");
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);
  const resolveFileInputRef = useRef<HTMLInputElement>(null);

  const [extraScreenshot, setExtraScreenshot] = useState<string | null>(null);
  const [extraScreenshotFormat, setExtraScreenshotFormat] = useState<"png" | "jpg">("png");
  const [extraPreview, setExtraPreview] = useState<string | null>(null);
  const [showAddScreenshot, setShowAddScreenshot] = useState(false);
  const extraFileInputRef = useRef<HTMLInputElement>(null);

  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentScreenshot, setCommentScreenshot] = useState<string | null>(null);
  const [commentScreenshotFormat, setCommentScreenshotFormat] = useState<"png" | "jpg">("png");
  const [commentPreview, setCommentPreview] = useState<string | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentScreenshot, setEditingCommentScreenshot] = useState<string | null>(null);
  const [editingCommentScreenshotFormat, setEditingCommentScreenshotFormat] = useState<"png" | "jpg">("png");
  const [editingCommentPreview, setEditingCommentPreview] = useState<string | null>(null);
  const [editingCommentHasExistingImage, setEditingCommentHasExistingImage] = useState(false);
  const editCommentFileInputRef = useRef<HTMLInputElement>(null);

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

  const canResolve = issue.status !== "Resolved" && issue.status !== "Closed";
  const isBim = isBimIssue(issue);

  const isCreator = isUserCreator(issue.reportedBy, currentUser);

  const isCommentAuthor = (commentAuthor: string): boolean => {
    return isUserMatch(commentAuthor, currentUser);
  };

  const getCurrentScreenshot = (): string | null => {
    if (isBim) {
      if (!isBimIssue(issue) || !issue.viewpoint?.snapshot) return null;
      return getImageSource(issue.viewpoint.snapshot.data);
    }
    const attachments = (issue as any).attachments as string[] | undefined;
    if (attachments && attachments.length > 0) {
      return getImageSource(attachments[0]);
    }
    return null;
  };

  const currentScreenshot = getCurrentScreenshot();
  const displayScreenshot = newScreenshot
    ? `data:image/${newScreenshotFormat};base64,${newScreenshot}`
    : currentScreenshot;
  const hasScreenshot = !!displayScreenshot && displayScreenshot.length > 0;

  const commentSnapshots = issue.comments.filter((c) => !!c.snapshot);

  const sortedComments = [...issue.comments].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return commentSortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setNewScreenshot(base64);
      setNewScreenshotFormat(format);
    };
    reader.onerror = () => {
      setSaveError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleCommentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setCommentScreenshot(base64);
      setCommentScreenshotFormat(format);
      setCommentPreview(dataUrl);
    };
    reader.onerror = () => {
      setSaveError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleEditCommentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setEditingCommentScreenshot(base64);
      setEditingCommentScreenshotFormat(format);
      setEditingCommentPreview(dataUrl);
    };
    reader.onerror = () => {
      setSaveError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleResolutionFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setResolutionScreenshot(base64);
      setResolutionScreenshotFormat(format);
      setResolutionPreview(dataUrl);
    };
    reader.onerror = () => {
      setSaveError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleExtraFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image size must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setExtraScreenshot(dataUrl.split(',')[1]);
      setExtraScreenshotFormat(file.type === 'image/jpeg' ? 'jpg' : 'png');
      setExtraPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAddScreenshot = async () => {
    if (!extraScreenshot) return;
    try {
      setSaveError(null);
      await onAddScreenshot(
        extraCommentText.trim() || "Screenshot added",
        extraScreenshot,
        extraScreenshotFormat
      );
      setExtraScreenshot(null);
      setExtraPreview(null);
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
        commentScreenshot || undefined,
        commentScreenshot ? commentScreenshotFormat : undefined
      );
      setCommentText("");
      setCommentScreenshot(null);
      setCommentPreview(null);
      setShowCommentInput(false);
    } catch {
      setSaveError('Failed to add comment.');
    }
  };

  const handleEditComment = async (commentId: string, originalHadSnapshot: boolean) => {
    if (!editingCommentText.trim()) return;
    try {
      setSaveError(null);
      const removeSnapshot = originalHadSnapshot && !editingCommentHasExistingImage && !editingCommentScreenshot;
      await onEditComment(
        commentId,
        editingCommentText.trim(),
        editingCommentScreenshot || undefined,
        editingCommentScreenshot ? editingCommentScreenshotFormat : undefined,
        removeSnapshot
      );
      setEditingCommentId(null);
      setEditingCommentText("");
      setEditingCommentScreenshot(null);
      setEditingCommentPreview(null);
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
      const patch: any = {
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

      if (newScreenshot) {
        if (isBim) {
          patch.domain = 'bim';
          patch.viewpoint = {
            camera_position: (issue as any).viewpoint?.cameraPosition || DEFAULT_CAMERA_POSITION,
            camera_direction: (issue as any).viewpoint?.cameraDirection || DEFAULT_CAMERA_DIRECTION,
            camera_up_vector: (issue as any).viewpoint?.cameraUpVector || DEFAULT_CAMERA_UP_VECTOR,
            field_of_view: (issue as any).viewpoint?.fieldOfView || DEFAULT_FIELD_OF_VIEW,
            clipping_planes: (issue as any).viewpoint?.clippingPlanes || [],
            snapshot_data: newScreenshot,
            snapshot_format: newScreenshotFormat,
          };
        } else {
          patch.domain = 'other';
          patch.newAttachmentData = newScreenshot;
          patch.newAttachmentFormat = newScreenshotFormat;
        }
      }

      await onSave(patch);
      setIsEditing(false);
      setNewScreenshot(null);
    } catch (err: any) {
      console.error('Save error:', err);
      if (err.response?.data) {
        const errors = Object.values(err.response.data).flat().join('\n');
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
        resolutionScreenshot || undefined,
        resolutionScreenshot ? resolutionScreenshotFormat : undefined
      );
      setResolutionText("");
      setResolutionScreenshot(null);
      setResolutionPreview(null);
      setIsResolving(false);
    } catch (err: any) {
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
    } catch (err) {
      setSaveError('Failed to remove screenshot. Please try again.');
    }
  };

  const handleDeleteIssueClick = async () => {
    if (!confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
      return;
    }
    try {
      setSaveError(null);
      await onDeleteIssue(issue.id);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to delete issue.');
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (!img.src.includes('test.jpg')) {
      img.src = '/images/test.jpg';
    }
  };

  const startEditComment = (comment: any) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
    setEditingCommentHasExistingImage(!!comment.snapshot);
    setEditingCommentScreenshot(null);
    setEditingCommentPreview(null);
  };

  const removeCommentImage = () => {
    setEditingCommentHasExistingImage(false);
    setEditingCommentScreenshot(null);
    setEditingCommentPreview(null);
  };

  return (
    <div className="issue-card">
      <div className="issue-left">
        <div className="priority-strip" style={{ background: getPriorityColor(issue.priority) }} />

        <div className="issue-content">
          <div className="issue-header-row">
            <span className="issue-id">#{issue.id}</span>
            {isEditing ? (
              <input
                className="field-input title-input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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

          <div className="screenshot-section">
            {!isEditing && hasScreenshot && (
              <div className="screenshot-thumbnail-container">
                <img
                  src={displayScreenshot || '/images/test.jpg'}
                  alt="Issue screenshot"
                  className="screenshot-thumbnail-image"
                  onClick={() => handleImageClick(getImageSource(displayScreenshot!))}
                  onError={handleImageError}
                />
                <span className="screenshot-hint">Click to enlarge</span>
                {isCreator && (
                  <button
                    className="screenshot-delete-btn"
                    onClick={handleRemoveSavedScreenshot}
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
                  <div className="screenshot-preview-container">
                    <img
                      src={displayScreenshot || '/images/test.jpg'}
                      alt="Screenshot preview"
                      className="screenshot-preview-image"
                      onError={handleImageError}
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
                  >
                    <i className="ti ti-upload" />
                    {newScreenshot ? 'Change New Image' : hasScreenshot ? 'Replace Image' : 'Upload Image'}
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />

                  {newScreenshot && (
                    <button
                      className="btn-outline small danger"
                      onClick={() => setNewScreenshot(null)}
                    >
                      <i className="ti ti-x" /> Discard New
                    </button>
                  )}

                  {!newScreenshot && hasScreenshot && (
                    <button
                      className="btn-outline small danger"
                      onClick={handleRemoveSavedScreenshot}
                    >
                      <i className="ti ti-trash" /> Delete
                    </button>
                  )}

                  <span className="file-hint">Max 5MB (PNG/JPG)</span>
                </div>

                {newScreenshot && (
                  <div className="screenshot-new-preview">
                    <span className="preview-label">📸 New image (will replace current):</span>
                    <img
                      src={`data:image/${newScreenshotFormat};base64,${newScreenshot}`}
                      alt="New screenshot preview"
                      className="screenshot-preview-image"
                      onError={handleImageError}
                    />
                    <span className="screenshot-pending-badge">Pending replacement</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {commentSnapshots.length > 0 && (
            <div className="screenshot-history">
              <button
                className="history-toggle"
                onClick={() => setShowHistory((v) => !v)}
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
                      <img
                        src={getImageSource(c.snapshot!)}
                        alt={`Snapshot from ${c.author}`}
                        onClick={() => handleImageClick(getImageSource(c.snapshot!))}
                        onError={handleImageError}
                      />
                      <span className="history-thumbnail-caption">
                        {c.author} · {c.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                {(issue as any).topicType}
              </span>
            )}

            {isBim && (issue as any).ifcElements && (issue as any).ifcElements.length > 0 && (
              <span className="meta-item">
                <i className="ti ti-cube" />
                {(issue as any).ifcElements.length} IFC elements
              </span>
            )}

            {!isBim && (issue as any).category && (
              <span className="meta-item topic-type">
                <i className="ti ti-tag" />
                {(issue as any).category}
              </span>
            )}

            {issue.comments.length > 0 && (
              <span className="meta-item">
                <i className="ti ti-message" />
                {issue.comments.length} comments
              </span>
            )}

            {issue.dueDate && (
              <span className="meta-item due-date">
                <i className="ti ti-calendar-due" />
                Due: {issue.dueDate}
              </span>
            )}

            {isEditing ? (
              <>
                <select
                  className="field-select"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as IssuePriority }))}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  className="field-select"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IssueStatus }))}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input small"
                  placeholder="Assigned to ID (number)"
                  value={form.assignedToId ?? ''}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    assignedToId: e.target.value ? Number(e.target.value) : null
                  }))}
                />
                <input
                  className="field-input small"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </>
            ) : (
              <>
                {issue.assignedTo && (
                  <span className="meta-item">
                    <i className="ti ti-user-check" />
                    {issue.assignedTo}
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
              </>
            )}
          </div>

          {issue.comments.length > 0 && !isEditing && (
            <div className="comments-section">
              <div className="comments-header">
                <div className="comments-header-left">
                  <i className="ti ti-message-circle" />
                  <span>{issue.comments.length} comments</span>
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
                  {issue.comments.length > 3 && (
                    <button
                      className="comments-toggle"
                      onClick={() => setShowAllComments(!showAllComments)}
                    >
                      {showAllComments ? 'Show less' : `Show all (${issue.comments.length})`}
                    </button>
                  )}
                </div>
              </div>
              <div className="comments-list">
                {(showAllComments ? sortedComments : sortedComments.slice(0, 3)).map((comment) => {
                  const isAuthor = isCommentAuthor(comment.author);

                  return (
                    <div key={comment.id} className="comment-item">
                      {editingCommentId === comment.id ? (
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
                                <img
                                  src={comment.snapshot ? getImageSource(comment.snapshot) : '/images/test.jpg'}
                                  alt="Existing comment image"
                                  className="comment-edit-image-preview"
                                  onError={handleImageError}
                                />
                                <span className="existing-image-label">Current image</span>
                                <button
                                  className="btn-outline small danger"
                                  onClick={removeCommentImage}
                                  style={{ marginTop: '4px' }}
                                >
                                  <i className="ti ti-trash" /> Remove image
                                </button>
                              </div>
                            )}

                            {editingCommentScreenshot && (
                              <div className="comment-new-image-preview">
                                <img
                                  src={editingCommentPreview || ''}
                                  alt="New comment image preview"
                                  className="comment-edit-image-preview"
                                />
                                <span className="new-image-label">📸 New image (pending)</span>
                                <button
                                  className="btn-outline small danger"
                                  onClick={() => {
                                    setEditingCommentScreenshot(null);
                                    setEditingCommentPreview(null);
                                  }}
                                >
                                  <i className="ti ti-x" /> Discard
                                </button>
                              </div>
                            )}

                            <div className="comment-image-upload-actions">
                              <button
                                className="btn-outline small"
                                onClick={() => editCommentFileInputRef.current?.click()}
                              >
                                <i className="ti ti-upload" />
                                {editingCommentScreenshot ? 'Change Image' : editingCommentHasExistingImage ? 'Replace Image' : 'Add Image'}
                              </button>
                              <input
                                ref={editCommentFileInputRef}
                                type="file"
                                accept="image/png,image/jpeg"
                                onChange={handleEditCommentFileUpload}
                                style={{ display: 'none' }}
                              />
                              <span className="file-hint">Max 5MB</span>
                            </div>
                          </div>

                          <div className="comment-edit-actions">
                            <button
                              className="btn-outline small"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                                setEditingCommentScreenshot(null);
                                setEditingCommentPreview(null);
                                setEditingCommentHasExistingImage(false);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn-primary small"
                              onClick={() => handleEditComment(comment.id, !!comment.snapshot)}
                              disabled={!editingCommentText.trim()}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="comment-header">
                            <span className="comment-author">{comment.author}</span>
                            <span className="comment-time">{comment.timestamp}</span>
                            {isAuthor && (
                              <span className="comment-owner-badge">(You)</span>
                            )}
                          </div>
                          <div className="comment-text">{comment.text}</div>
                          {comment.snapshot && (
                            <div className="comment-snapshot">
                              <img
                                src={getImageSource(comment.snapshot)}
                                alt="Comment screenshot"
                                onClick={() => handleImageClick(getImageSource(comment.snapshot))}
                                className="comment-snapshot-thumb"
                                onError={handleImageError}
                              />
                            </div>
                          )}
                          {isAuthor && (
                            <div className="comment-actions">
                              <button
                                className="comment-action-btn"
                                onClick={() => startEditComment(comment)}
                              >
                                <i className="ti ti-edit" /> Edit
                              </button>
                              <button
                                className="comment-action-btn danger"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <i className="ti ti-trash" /> Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {!showAllComments && sortedComments.length > 3 && (
                  <div className="comments-more">
                    + {sortedComments.length - 3} more comments
                  </div>
                )}
              </div>
            </div>
          )}

          {isResolving && (
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
                  <div className="screenshot-preview">
                    <img src={resolutionPreview} alt="Resolution screenshot preview" />
                    <button
                      className="remove-btn"
                      onClick={() => {
                        setResolutionScreenshot(null);
                        setResolutionPreview(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-outline small"
                    onClick={() => resolveFileInputRef.current?.click()}
                    type="button"
                  >
                    <i className="ti ti-camera" /> Attach proof-of-fix screenshot (optional)
                  </button>
                )}
                <input
                  ref={resolveFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleResolutionFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="form-actions">
                <button
                  className="btn-outline"
                  onClick={() => {
                    setIsResolving(false);
                    setResolutionScreenshot(null);
                    setResolutionPreview(null);
                  }}
                >
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleResolveConfirm}>
                  <i className="ti ti-check" /> Confirm Resolve
                </button>
              </div>
            </div>
          )}

          <div className="issue-actions">
            {isEditing ? (
              <>
                <button className="btn-outline" onClick={() => {
                  setIsEditing(false);
                  setNewScreenshot(null);
                }}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSave}>
                  <i className="ti ti-device-floppy" /> Save
                </button>
              </>
            ) : (
              <>
                {isCreator && (
                  <>
                    <button className="btn-outline" onClick={() => setIsEditing(true)}>
                      <i className="ti ti-edit" /> Edit
                    </button>
                    <button
                      className="btn-outline danger"
                      onClick={handleDeleteIssueClick}
                    >
                      <i className="ti ti-trash" /> Delete
                    </button>
                  </>
                )}

                {canResolve && (
                  <button className="btn-outline" onClick={() => setIsResolving((v) => !v)}>
                    <i className="ti ti-check" /> Resolve
                  </button>
                )}
                <button
                  className="btn-outline"
                  onClick={() => setShowAddScreenshot((v) => !v)}
                >
                  <i className="ti ti-photo-plus" /> Add Screenshot
                </button>
                <button
                  className="btn-outline"
                  onClick={() => setShowCommentInput((v) => !v)}
                >
                  <i className="ti ti-message-plus" /> Add Comment
                </button>
              </>
            )}
          </div>

          {showAddScreenshot && (
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
                <div className="screenshot-preview">
                  <img src={extraPreview} alt="New screenshot preview" />
                  <button
                    className="remove-btn"
                    onClick={() => {
                      setExtraScreenshot(null);
                      setExtraPreview(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  className="btn-outline small"
                  onClick={() => extraFileInputRef.current?.click()}
                  type="button"
                >
                  <i className="ti ti-camera" /> Choose image
                </button>
              )}
              <input
                ref={extraFileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleExtraFileUpload}
                style={{ display: 'none' }}
              />
              {extraScreenshot && (
                <button
                  className="btn-primary small"
                  onClick={handleAddScreenshot}
                  style={{ marginTop: '8px' }}
                >
                  Add
                </button>
              )}
            </div>
          )}

          {showCommentInput && (
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
                  <div className="comment-image-preview">
                    <img src={commentPreview} alt="Comment image preview" />
                    <button
                      className="remove-btn"
                      onClick={() => {
                        setCommentScreenshot(null);
                        setCommentPreview(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-outline small"
                    onClick={() => commentFileInputRef.current?.click()}
                    type="button"
                  >
                    <i className="ti ti-camera" /> Add image (optional)
                  </button>
                )}
                <input
                  ref={commentFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleCommentFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '8px' }}>
                <button
                  className="btn-outline"
                  onClick={() => {
                    setShowCommentInput(false);
                    setCommentText('');
                    setCommentScreenshot(null);
                    setCommentPreview(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                >
                  <i className="ti ti-send" /> Post Comment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="issue-right">
        <div className="issue-timestamps">
          <span className="issue-time">
            <i className="ti ti-clock" />
            {issue.created}
          </span>
          {issue.updated && (
            <span className="issue-time updated">
              <i className="ti ti-refresh" />
              {issue.updated}
            </span>
          )}
        </div>
        <i className="ti ti-chevron-right issue-arrow" />
      </div>

      {selectedScreenshot && (
        <div className="screenshot-modal" onClick={() => setSelectedScreenshot(null)}>
          <button
            className="screenshot-modal-close"
            onClick={() => setSelectedScreenshot(null)}
          >
            ✕
          </button>
          <div className="screenshot-modal-content">
            <img
              src={selectedScreenshot}
              alt="Full size screenshot"
              onClick={(e) => e.stopPropagation()}
              onError={handleImageError}
            />
          </div>
        </div>
      )}
    </div>
  );
}