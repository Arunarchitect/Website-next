"use client";

import { useEffect, useState, useRef } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./issues.css";
import {
  getIssues,
  updateIssue,
  resolveIssue,
  createIssue,
  removeSnapshot,
  removeAttachment,
  addCommentWithSnapshot,
  addComment,
  deleteComment,
  editComment,
  getPriorityColor,
  getStatusColor,
} from "./issueApi";
import {
  Issue,
  IssueStatus,
  IssuePriority,
  IssueDomain,
  BcfTopicType,
  isBimIssue,
} from "./issueTypes";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const CURRENT_USER = "You";

const STATUS_OPTIONS: IssueStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTIONS: IssuePriority[] = ["High", "Medium", "Low"];
const TOPIC_TYPE_OPTIONS: BcfTopicType[] = [
  "Clash",
  "Coordinate",
  "Quality",
  "Safety",
  "General",
  "Request",
  "Fault",
];

const getImageSource = (imageData: string | undefined): string => {
  if (!imageData) return '';

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

  if (imageData.includes('issue_snapshots/') || imageData.includes('media/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    const path = imageData.startsWith('/') ? imageData : `/${imageData}`;
    return `${baseUrl}${path}`;
  }

  console.warn('Unable to process image data:', imageData.substring(0, 50) + '...');
  return '';
};

const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 0 };
const DEFAULT_CAMERA_DIRECTION = { x: 0, y: 0, z: -1 };
const DEFAULT_CAMERA_UP_VECTOR = { x: 0, y: 1, z: 0 };
const DEFAULT_FIELD_OF_VIEW = 60;

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<"all" | IssueDomain>("all");
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentSortOrder, setCommentSortOrder] = useState<"asc" | "desc">("desc");

  const refresh = async () => {
    try {
      setError(null);
      console.log('🔄 Refreshing issues...');
      const data = await getIssues();
      console.log('✅ Issues refreshed:', data.length, 'items');
      setIssues(data);
      return data;
    } catch (err: any) {
      console.error('Refresh error:', err);
      setError('Failed to load issues. Please try again.');
      throw err;
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const visibleIssues =
    domainFilter === "all" ? issues : issues.filter((i) => i.domain === domainFilter);

  const openIssues = issues.filter((i) => i.status === "Open").length;
  const inProgressIssues = issues.filter((i) => i.status === "In Progress").length;
  const resolvedIssues = issues.filter((i) => i.status === "Resolved").length;
  const bimIssueCount = issues.filter(isBimIssue).length;
  const clashIssues = issues.filter(isBimIssue).filter((i) => i.topicType === "Clash").length;
  const highPriorityIssues = issues.filter((i) => i.priority === "High").length;

  const assignees = [...new Set(issues.map((i) => i.assignedTo).filter(Boolean))] as string[];

  return (
    <main className={`${display.variable} ${mono.variable} issues-page`}>
      <header className="issues-header">
        <div className="issues-brand">
          <span className="issues-brand-icon">
            <i className="ti ti-bug" />
          </span>
          <span className="issues-brand-text">Issue Tracker</span>
        </div>
        <div className="issues-header-actions">
          <div className="domain-tabs">
            <button
              className={`tab ${domainFilter === "all" ? "active" : ""}`}
              onClick={() => setDomainFilter("all")}
            >
              All
            </button>
            <button
              className={`tab ${domainFilter === "bim" ? "active" : ""}`}
              onClick={() => setDomainFilter("bim")}
            >
              BIM
            </button>
            <button
              className={`tab ${domainFilter === "other" ? "active" : ""}`}
              onClick={() => setDomainFilter("other")}
            >
              Other
            </button>
          </div>
          <button className="btn-primary" onClick={() => setShowNewIssueForm((v) => !v)}>
            <i className="ti ti-plus" />
            New Issue
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="hero-eyebrow">Development</p>
        <h1 className="hero-title">Issues</h1>
        <p className="hero-subtitle">
          Track bugs, feature requests and ongoing improvements across the application — model
          issues (BCF-compatible) and general design issues, side by side.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showNewIssueForm && (
        <NewIssueForm
          onCancel={() => setShowNewIssueForm(false)}
          onCreate={async (input) => {
            try {
              setError(null);
              await createIssue(input);
              await refresh();
              setShowNewIssueForm(false);
            } catch (err: any) {
              console.error('Create error:', err);
              if (err.response?.data) {
                const errors = Object.values(err.response.data).flat().join('\n');
                setError(`Validation Error: ${errors}`);
              } else {
                setError('Failed to create issue. Please try again.');
              }
            }
          }}
        />
      )}

      <section className="stats-grid">
        <StatCard icon="ti-alert-circle" label="Open" value={openIssues} />
        <StatCard icon="ti-loader" label="In Progress" value={inProgressIssues} />
        <StatCard icon="ti-check" label="Resolved" value={resolvedIssues} />
        <StatCard icon="ti-files" label="BCF Topics" value={bimIssueCount} />
        <StatCard icon="ti-cube" label="Clashes" value={clashIssues} />
        <StatCard icon="ti-flag" label="High Priority" value={highPriorityIssues} />
      </section>

      {assignees.length > 0 && (
        <section className="assignees-section">
          <div className="section-title">
            <span>Assigned To</span>
          </div>
          <div className="assignees-grid">
            {assignees.map((assignee) => (
              <div key={assignee} className="assignee-chip">
                <i className="ti ti-user" />
                {assignee}
                <span className="assignee-count">
                  {issues.filter((i) => i.assignedTo === assignee).length}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">
          <span>All Issues</span>
          <span className="issue-count">{visibleIssues.length} shown</span>
        </div>

        {loading ? (
          <p className="hero-subtitle">Loading issues…</p>
        ) : (
          <div className="issues-grid">
            {visibleIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                commentSortOrder={commentSortOrder}
                onSortChange={() => setCommentSortOrder(commentSortOrder === "desc" ? "asc" : "desc")}
                onSave={async (patch) => {
                  try {
                    setError(null);
                    await updateIssue(issue.id, patch);
                    await refresh();
                  } catch (err: any) {
                    console.error('Update error:', err);
                    if (err.response?.data) {
                      const errors = Object.values(err.response.data).flat().join('\n');
                      setError(`Validation Error: ${errors}`);
                    } else {
                      setError('Failed to update issue. Please try again.');
                    }
                  }
                }}
                onResolve={async (resolution, snapshotData, snapshotFormat) => {
                  try {
                    setError(null);
                    await resolveIssue(issue.id, resolution, CURRENT_USER, snapshotData, snapshotFormat);
                    await refresh();
                  } catch (err: any) {
                    console.error('Resolve error:', err);
                    if (err.response?.data) {
                      const errors = Object.values(err.response.data).flat().join('\n');
                      setError(`Validation Error: ${errors}`);
                    } else {
                      setError('Failed to resolve issue. Please try again.');
                    }
                  }
                }}
                onRemoveSnapshot={async () => {
                  try {
                    setError(null);
                    await removeSnapshot(issue.id);
                    await refresh();
                  } catch (err: any) {
                    console.error('Remove snapshot error:', err);
                    setError('Failed to remove screenshot. Please try again.');
                  }
                }}
                onRemoveAttachment={async (index) => {
                  try {
                    setError(null);
                    await removeAttachment(issue.id, index);
                    await refresh();
                  } catch (err: any) {
                    console.error('Remove attachment error:', err);
                    setError('Failed to remove screenshot. Please try again.');
                  }
                }}
                onAddScreenshot={async (snapshotData, snapshotFormat) => {
                  try {
                    setError(null);
                    console.log('📸 Adding screenshot to issue:', issue.id);
                    await addCommentWithSnapshot(
                      issue.id, 
                      CURRENT_USER, 
                      "Screenshot added", 
                      snapshotData, 
                      snapshotFormat
                    );
                    await refresh();
                  } catch (err: any) {
                    console.error('Add screenshot error:', err);
                    setError('Failed to add screenshot. Please try again.');
                  }
                }}
                onAddComment={async (text) => {
                  try {
                    setError(null);
                    console.log('💬 Adding comment to issue:', issue.id);
                    await addComment(issue.id, CURRENT_USER, text);
                    await refresh();
                  } catch (err: any) {
                    console.error('Add comment error:', err);
                    setError('Failed to add comment. Please try again.');
                  }
                }}
                onDeleteComment={async (commentId) => {
                  try {
                    setError(null);
                    await deleteComment(issue.id, commentId);
                    await refresh();
                  } catch (err: any) {
                    console.error('Delete comment error:', err);
                    setError('Failed to delete comment. Please try again.');
                  }
                }}
                onEditComment={async (commentId, text) => {
                  try {
                    setError(null);
                    await editComment(issue.id, commentId, text);
                    await refresh();
                  } catch (err: any) {
                    console.error('Edit comment error:', err);
                    setError('Failed to edit comment. Please try again.');
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="stat-card">
      <i className={`ti ${icon} stat-icon`} />
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );
}

function IssueCard({
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
}: {
  issue: Issue;
  commentSortOrder: "asc" | "desc";
  onSortChange: () => void;
  onSave: (patch: Partial<Issue>) => Promise<void>;
  onResolve: (resolution: string, snapshotData?: string, snapshotFormat?: "png" | "jpg") => Promise<void>;
  onRemoveSnapshot: () => Promise<void>;
  onRemoveAttachment: (index: number) => Promise<void>;
  onAddScreenshot: (snapshotData: string, snapshotFormat: "png" | "jpg") => Promise<void>;
  onAddComment: (text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onEditComment: (commentId: string, text: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newScreenshot, setNewScreenshot] = useState<string | null>(null);
  const [newScreenshotFormat, setNewScreenshotFormat] = useState<"png" | "jpg">("png");
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
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
  
  const [showHistory, setShowHistory] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  
  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

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

  // Sort comments by timestamp
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
      setImageLoadError(false);
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
      await onAddScreenshot(extraScreenshot, extraScreenshotFormat);
      setExtraScreenshot(null);
      setExtraPreview(null);
      setShowAddScreenshot(false);
    } catch {
      setSaveError('Failed to add screenshot.');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      setSaveError(null);
      await onAddComment(commentText.trim());
      setCommentText("");
      setShowCommentInput(false);
    } catch {
      setSaveError('Failed to add comment.');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      setSaveError(null);
      await onEditComment(commentId, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch {
      setSaveError('Failed to edit comment.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
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

      if (newScreenshot && isBim) {
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
      } else if (newScreenshot && !isBim) {
        patch.domain = 'other';
        patch.newAttachmentData = newScreenshot;
        patch.newAttachmentFormat = newScreenshotFormat;
      }

      await onSave(patch);
      setIsEditing(false);
      setNewScreenshot(null);
      setImageLoadError(false);
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
      setImageLoadError(false);
    } catch (err) {
      setSaveError('Failed to remove screenshot. Please try again.');
    }
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
            {!isEditing && hasScreenshot && !imageLoadError && (
              <div className="screenshot-thumbnail-container">
                <img
                  src={displayScreenshot}
                  alt="Issue screenshot"
                  className="screenshot-thumbnail-image"
                  onClick={() => handleImageClick(displayScreenshot!)}
                  onError={() => setImageLoadError(true)}
                />
                <span className="screenshot-hint">Click to enlarge</span>
              </div>
            )}

            {isEditing && (
              <div className="screenshot-edit-area">
                {hasScreenshot && !imageLoadError && (
                  <div className="screenshot-preview-container">
                    <img
                      src={displayScreenshot}
                      alt="Screenshot preview"
                      className="screenshot-preview-image"
                      onError={() => setImageLoadError(true)}
                    />
                  </div>
                )}
                <div className="screenshot-upload">
                  <button
                    className="btn-outline small"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="ti ti-upload" />
                    {newScreenshot ? 'Change Screenshot' : hasScreenshot ? 'Change Screenshot' : 'Upload Screenshot'}
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
                      <i className="ti ti-x" /> Discard new upload
                    </button>
                  )}
                  {!newScreenshot && hasScreenshot && (
                    <button
                      className="btn-outline small danger"
                      onClick={handleRemoveSavedScreenshot}
                    >
                      <i className="ti ti-trash" /> Delete saved screenshot
                    </button>
                  )}
                  <span className="file-hint">Max 5MB</span>
                </div>
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
                        src={c.snapshot!}
                        alt={`Snapshot from ${c.author}`}
                        onClick={() => handleImageClick(c.snapshot!)}
                        onError={(e) => {
                          console.error('Failed to load image:', c.snapshot);
                          e.currentTarget.style.display = 'none';
                        }}
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

          {/* Comments section - with sort, edit, delete */}
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
                {(showAllComments ? sortedComments : sortedComments.slice(0, 3)).map((comment) => (
                  <div key={comment.id} className="comment-item">
                    {editingCommentId === comment.id ? (
                      // Edit mode
                      <div className="comment-edit-mode">
                        <textarea
                          className="field-input"
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          rows={2}
                        />
                        <div className="comment-edit-actions">
                          <button 
                            className="btn-outline small" 
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentText("");
                            }}
                          >
                            Cancel
                          </button>
                          <button 
                            className="btn-primary small" 
                            onClick={() => handleEditComment(comment.id)}
                            disabled={!editingCommentText.trim()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="comment-header">
                          <span className="comment-author">{comment.author}</span>
                          <span className="comment-time">{comment.timestamp}</span>
                        </div>
                        <div className="comment-text">{comment.text}</div>
                        {comment.snapshot && (
                          <div className="comment-snapshot">
                            <img 
                              src={comment.snapshot} 
                              alt="Comment screenshot"
                              onClick={() => handleImageClick(comment.snapshot)}
                              className="comment-snapshot-thumb"
                              onError={(e) => {
                                console.error('Failed to load comment image:', comment.snapshot);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="comment-actions">
                          <button 
                            className="comment-action-btn"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentText(comment.text);
                            }}
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
                      </>
                    )}
                  </div>
                ))}
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
                  setImageLoadError(false);
                }}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSave}>
                  <i className="ti ti-device-floppy" /> Save
                </button>
              </>
            ) : (
              <>
                <button className="btn-outline" onClick={() => setIsEditing(true)}>
                  <i className="ti ti-edit" /> Edit
                </button>
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
              <div className="form-actions" style={{ marginTop: '8px' }}>
                <button 
                  className="btn-outline" 
                  onClick={() => {
                    setShowCommentInput(false);
                    setCommentText('');
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
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NewIssueForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [domain, setDomain] = useState<IssueDomain>("bim");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("Medium");
  const [topicType, setTopicType] = useState<BcfTopicType>("General");
  const [category, setCategory] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFormat, setScreenshotFormat] = useState<"png" | "jpg">("png");
  const [projectId, setProjectId] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setScreenshot(base64);
      setScreenshotFormat(format);
      setPreviewImage(dataUrl);
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    try {
      setError(null);

      if (!title.trim()) {
        setError('Title is required');
        return;
      }

      if (!projectId) {
        setError('Project ID is required');
        return;
      }

      const base = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        status: "Open" as IssueStatus,
        priority,
        module: module.trim() || (domain === "bim" ? "Modeling" : "General"),
        reportedBy: CURRENT_USER,
      };

      if (domain === "bim") {
        const bimInput = {
          ...base,
          domain: "bim" as const,
          topicType,
          viewpoint: {
            camera_position: DEFAULT_CAMERA_POSITION,
            camera_direction: DEFAULT_CAMERA_DIRECTION,
            camera_up_vector: DEFAULT_CAMERA_UP_VECTOR,
            field_of_view: DEFAULT_FIELD_OF_VIEW,
            clipping_planes: [],
            ...(screenshot ? {
              snapshot_data: screenshot,
              snapshot_format: screenshotFormat,
            } : {})
          }
        };
        console.log('📤 Creating BIM issue with viewpoint:', bimInput.viewpoint);
        await onCreate(bimInput);
      } else {
        await onCreate({
          ...base,
          domain: "other" as const,
          category: category.trim() || undefined,
          ...(screenshot ? {
            newAttachmentData: screenshot,
            newAttachmentFormat: screenshotFormat,
          } : {})
        });
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      if (err.response?.data) {
        const errors = Object.values(err.response.data).flat().join('\n');
        setError(`Validation Error: ${errors}`);
      } else {
        setError('Failed to create issue. Please try again.');
      }
    }
  };

  return (
    <section className="new-issue-form">
      {error && (
        <div className="error-banner small">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {uploadError && (
        <div className="error-banner small">
          <i className="ti ti-alert-circle" />
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>✕</button>
        </div>
      )}

      <div className="form-row">
        <div className="form-field">
          <label>Project ID</label>
          <input
            className="field-input"
            type="number"
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(Number(e.target.value))}
          />
        </div>
        <div className="form-field">
          <label>Type</label>
          <select className="field-select" value={domain} onChange={(e) => setDomain(e.target.value as IssueDomain)}>
            <option value="bim">BIM (model-linked, BCF)</option>
            <option value="other">Other (general)</option>
          </select>
        </div>
        {domain === "bim" ? (
          <div className="form-field">
            <label>Topic type</label>
            <select
              className="field-select"
              value={topicType}
              onChange={(e) => setTopicType(e.target.value as BcfTopicType)}
            >
              {TOPIC_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-field">
            <label>Category</label>
            <input
              className="field-input"
              placeholder="e.g. Documentation"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        )}
        <div className="form-field">
          <label>Priority</label>
          <select
            className="field-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Title</label>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-field">
        <label>Description</label>
        <textarea
          className="field-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>Module</label>
        <input
          className="field-input"
          placeholder={domain === "bim" ? "e.g. Modeling" : "e.g. Documentation"}
          value={module}
          onChange={(e) => setModule(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>Screenshot (optional)</label>
        <div className="btn-with-screenshot">
          <button
            className="btn-outline"
            style={{ width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="ti ti-camera" /> Upload screenshot (max 5MB)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
        {previewImage && (
          <div className="screenshot-preview">
            <img src={previewImage} alt="Preview" />
            <button
              className="remove-btn"
              onClick={() => {
                setScreenshot(null);
                setPreviewImage(null);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSubmit}>
          <i className="ti ti-plus" /> Create Issue
        </button>
      </div>
    </section>
  );
}