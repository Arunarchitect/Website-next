"use client";

import { useEffect, useState } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./issues.css";
import {
  getIssues,
  updateIssue,
  resolveIssue,
  createIssue,
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

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<"all" | IssueDomain>("all");
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);

  const refresh = async () => setIssues(await getIssues());

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
              className={`tab ${domainFilter === "design" ? "active" : ""}`}
              onClick={() => setDomainFilter("design")}
            >
              Design
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

      {showNewIssueForm && (
        <NewIssueForm
          onCancel={() => setShowNewIssueForm(false)}
          onCreate={async (input) => {
            await createIssue(input);
            await refresh();
            setShowNewIssueForm(false);
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
                onSave={async (patch) => {
                  await updateIssue(issue.id, patch);
                  await refresh();
                }}
                onResolve={async (resolution) => {
                  await resolveIssue(issue.id, resolution, CURRENT_USER);
                  await refresh();
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
  onSave,
  onResolve,
}: {
  issue: Issue;
  onSave: (patch: Partial<Issue>) => Promise<void>;
  onResolve: (resolution: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionText, setResolutionText] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    assignedTo: issue.assignedTo ?? "",
    dueDate: issue.dueDate ?? "",
  });

  const canResolve = issue.status !== "Resolved" && issue.status !== "Closed";

  const handleSave = async () => {
    await onSave({
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      assignedTo: form.assignedTo || undefined,
      dueDate: form.dueDate || undefined,
    });
    setIsEditing(false);
  };

  const handleResolveConfirm = async () => {
    if (!resolutionText.trim()) return;
    await onResolve(resolutionText.trim());
    setResolutionText("");
    setIsResolving(false);
  };

  const hasScreenshot = isBimIssue(issue) && issue.viewpoint?.snapshot;
  const commentWithScreenshots = issue.comments.filter(c => c.snapshot);

  // Helper to get image source
  const getImageSrc = (imageData: string): string => {
    // If it's a URL (starts with / or http), use it directly
    if (imageData.startsWith('/') || imageData.startsWith('http')) {
      return imageData;
    }
    // Otherwise treat as base64
    return `data:image/jpeg;base64,${imageData}`;
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
              {isBimIssue(issue) ? (
                <>
                  <i className="ti ti-file-barcode" /> BCF
                </>
              ) : (
                <>
                  <i className="ti ti-pencil" /> Design
                </>
              )}
            </span>
          </div>

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

          {/* Display main screenshot from viewpoint if available */}
          {hasScreenshot && isBimIssue(issue) && (
            <div className="screenshot-container">
              <img
                src={getImageSrc(issue.viewpoint!.snapshot!.data)}
                alt="Viewpoint snapshot"
                onClick={() => setSelectedScreenshot(issue.viewpoint!.snapshot!.data)}
                style={{ cursor: 'pointer' }}
              />
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

            {isBimIssue(issue) && (
              <span className="meta-item topic-type">
                <i className="ti ti-tag" />
                {issue.topicType}
              </span>
            )}

            {isBimIssue(issue) && issue.ifcElements && issue.ifcElements.length > 0 && (
              <span className="meta-item">
                <i className="ti ti-cube" />
                {issue.ifcElements.length} IFC elements
              </span>
            )}

            {!isBimIssue(issue) && issue.category && (
              <span className="meta-item topic-type">
                <i className="ti ti-tag" />
                {issue.category}
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
                  placeholder="Assigned to"
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
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

          {/* Display comments with screenshots */}
          {commentWithScreenshots.map((comment, index) => (
            <div key={`${comment.id}-snapshot`} className="comment-with-snapshot">
              {comment.snapshot && (
                <img
                  className="screenshot-thumbnail"
                  src={getImageSrc(comment.snapshot)}
                  alt="Comment screenshot"
                  onClick={() => setSelectedScreenshot(comment.snapshot!)}
                />
              )}
              <div>
                <div className="comment-text">{comment.text}</div>
                <div className="comment-meta">
                  <span>{comment.author}</span>
                  <span>•</span>
                  <span>{new Date(comment.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}

          {issue.comments.length > 0 && !isEditing && commentWithScreenshots.length === 0 && (
            <div className="comments-preview">
              <i className="ti ti-message-circle" />
              <span>{issue.comments[issue.comments.length - 1].text}</span>
              <span className="comment-author">
                — {issue.comments[issue.comments.length - 1].author}
              </span>
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
              <div className="form-actions">
                <button className="btn-outline" onClick={() => setIsResolving(false)}>
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
                <button className="btn-outline" onClick={() => setIsEditing(false)}>
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
              </>
            )}
          </div>
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

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div className="screenshot-modal" onClick={() => setSelectedScreenshot(null)}>
          <button 
            className="screenshot-modal-close"
            onClick={() => setSelectedScreenshot(null)}
          >
            ✕
          </button>
          <img 
            src={getImageSrc(selectedScreenshot)}
            alt="Full size screenshot"
            onClick={(e) => e.stopPropagation()}
          />
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setScreenshot(base64);
      setScreenshotFormat(format);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    const base = {
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
        viewpoint: screenshot ? {
          guid: `vp-${Date.now()}`,
          cameraPosition: { x: 0, y: 0, z: 0 },
          cameraDirection: { x: 0, y: 0, z: -1 },
          snapshot: {
            data: screenshot,
            format: screenshotFormat,
          }
        } : undefined
      };
      await onCreate(bimInput);
    } else {
      await onCreate({ 
        ...base, 
        domain: "design", 
        category: category.trim() || undefined 
      });
    }
  };

  return (
    <section className="new-issue-form">
      <div className="form-row">
        <div className="form-field">
          <label>Type</label>
          <select className="field-select" value={domain} onChange={(e) => setDomain(e.target.value as IssueDomain)}>
            <option value="bim">BIM (model-linked, BCF)</option>
            <option value="design">Design (general)</option>
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
          <button className="btn-outline" style={{ width: '100%' }}>
            <i className="ti ti-camera" /> Upload screenshot
          </button>
          <input 
            type="file" 
            accept="image/png,image/jpeg" 
            onChange={handleFileUpload}
          />
        </div>
        {screenshot && (
          <div className="screenshot-preview">
            <img src={`data:image/${screenshotFormat};base64,${screenshot}`} alt="Preview" />
            <button 
              className="remove-btn" 
              onClick={() => setScreenshot(null)}
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