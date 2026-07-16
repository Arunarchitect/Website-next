// app/issues/page.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import axios from "axios";
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
  deleteIssue,
  getProjectDrawings,
  getMyOrganisations,
  getOrganisationProjects,
  getDeliverablesForProject,
  DrawingOption,
  DeliverableOption,
  OrganisationSummary,
  ProjectSummary,
  API_URL,
} from "./issueApi";
import {
  Issue,
  IssueStatus,
  IssuePriority,
  IssueDomain,
  BcfTopicType,
  isBimIssue,
} from "./issueTypes";
import { IssueCard } from "./IssueCard";
import { compressImage } from "./imageUtils";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isUserMatch } from '@/components/utils/userMatching';
import { useAppDispatch } from '@/redux/hooks';
import { setUser } from '@/redux/features/authSlice';

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

const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 0 };
const DEFAULT_CAMERA_DIRECTION = { x: 0, y: 0, z: -1 };
const DEFAULT_CAMERA_UP_VECTOR = { x: 0, y: 1, z: 0 };
const DEFAULT_FIELD_OF_VIEW = 60;

const getDrawingIcon = (fileType: string): string => {
  switch (fileType) {
    case 'pdf': return 'ti-file-pdf';
    case 'image': return 'ti-photo';
    case 'dxf': return 'ti-file-code';
    case 'ifc': return 'ti-building';
    default: return 'ti-file';
  }
};

interface OrganisationOption {
  id: number;
  name: string;
}

interface ProjectOption {
  id: number;
  name: string;
  organisation_id: number;
  organisation_name: string;
}

interface NewIssueBase {
  project_id: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  module: string;
  linkedDocumentIds?: number[];
}

interface NewIssueViewpointInput {
  camera_position: { x: number; y: number; z: number };
  camera_direction: { x: number; y: number; z: number };
  camera_up_vector: { x: number; y: number; z: number };
  field_of_view: number;
  clipping_planes: unknown[];
  snapshot_data?: string;
  snapshot_format?: "png" | "jpg";
}

interface NewBimIssueInput extends NewIssueBase {
  domain: "bim";
  topicType: BcfTopicType;
  viewpoint: NewIssueViewpointInput;
}

interface NewDesignIssueInput extends NewIssueBase {
  domain: "other";
  category?: string;
  newAttachmentData?: string;
  newAttachmentFormat?: "png" | "jpg";
}

type NewIssueInput = NewBimIssueInput | NewDesignIssueInput;

type StatFilterKey = "open" | "inProgress" | "resolved" | "bim" | "clash" | "highPriority" | null;

const STAT_FILTER_PREDICATES: Record<Exclude<StatFilterKey, null>, (issue: Issue) => boolean> = {
  open: (i) => i.status === "Open",
  inProgress: (i) => i.status === "In Progress",
  resolved: (i) => i.status === "Resolved",
  bim: (i) => isBimIssue(i),
  clash: (i) => isBimIssue(i) && i.topicType === "Clash",
  highPriority: (i) => i.priority === "High",
};

const STAT_FILTER_LABELS: Record<Exclude<StatFilterKey, null>, string> = {
  open: "Open",
  inProgress: "In Progress",
  resolved: "Resolved",
  bim: "BCF Topics",
  clash: "Clashes",
  highPriority: "High Priority",
};

function extractValidationMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Record<string, unknown>;
    return `Validation Error: ${Object.values(data).flat().join('\n')}`;
  }
  return fallback;
}

export default function IssuesPage() {
  const dispatch = useAppDispatch();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<"all" | IssueDomain>("all");
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentSortOrder, setCommentSortOrder] = useState<"asc" | "desc">("desc");

  // --- Organisation / Project / Deliverable filter cascade -----------------
  const [filterOrgId, setFilterOrgId] = useState<number | "">("");
  const [filterProjectId, setFilterProjectId] = useState<number | "">("");
  const [filterDeliverableId, setFilterDeliverableId] = useState<number | "">("");

  const [filterOrganisations, setFilterOrganisations] = useState<OrganisationSummary[]>([]);
  const [filterProjects, setFilterProjects] = useState<ProjectSummary[]>([]);
  const [filterDeliverables, setFilterDeliverables] = useState<DeliverableOption[]>([]);

  const [loadingFilterOrgs, setLoadingFilterOrgs] = useState(false);
  const [loadingFilterProjects, setLoadingFilterProjects] = useState(false);
  const [loadingFilterDeliverables, setLoadingFilterDeliverables] = useState(false);

  // Which stats-strip card is currently driving the list filter (if any).
  // Clicking a card toggles it on/off.
  const [statFilter, setStatFilter] = useState<StatFilterKey>(null);

  useEffect(() => {
    const loadUserFromStorage = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          dispatch(setUser(userData));
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    };
    loadUserFromStorage();
  }, [dispatch]);

  const currentUserData = useCurrentUser();

  const currentUser = {
    email: currentUserData?.email || '',
    fullName: currentUserData?.full_name || currentUserData?.display_name || '',
    username: currentUserData?.username || '',
    displayName: currentUserData?.display_name || currentUserData?.full_name || currentUserData?.email || '',
  };

  const isUserCreator = (reportedBy: string, user: { email: string; fullName: string; username: string; displayName: string }): boolean => {
    return isUserMatch(reportedBy, user);
  };

  const handleOpenDrawing = (documentId: number) => {
    window.open(`/drawing?openDoc=${documentId}`, '_blank', 'noopener,noreferrer');
  };

  const refresh = async () => {
    try {
      setError(null);
      const data = await getIssues();
      setIssues(data);
      return data;
    } catch (err: unknown) {
      console.error('Refresh error:', err);
      setError('Failed to load issues. Please try again.');
      throw err;
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  // Load the organisation list once, for the filter bar.
  useEffect(() => {
    setLoadingFilterOrgs(true);
    getMyOrganisations()
      .then(setFilterOrganisations)
      .finally(() => setLoadingFilterOrgs(false));
  }, []);

  // When the selected organisation changes, load its projects and reset
  // whatever was selected downstream (project / deliverable).
  useEffect(() => {
    if (!filterOrgId) {
      setFilterProjects([]);
      setFilterProjectId("");
      setFilterDeliverables([]);
      setFilterDeliverableId("");
      return;
    }
    let cancelled = false;
    setLoadingFilterProjects(true);
    getOrganisationProjects(filterOrgId)
      .then((opts) => { if (!cancelled) setFilterProjects(opts); })
      .finally(() => { if (!cancelled) setLoadingFilterProjects(false); });
    setFilterProjectId("");
    setFilterDeliverables([]);
    setFilterDeliverableId("");
    return () => { cancelled = true; };
  }, [filterOrgId]);

  // When the selected project changes, load its deliverables and reset the
  // deliverable selection.
  useEffect(() => {
    if (!filterProjectId) {
      setFilterDeliverables([]);
      setFilterDeliverableId("");
      return;
    }
    let cancelled = false;
    setLoadingFilterDeliverables(true);
    getDeliverablesForProject(filterProjectId)
      .then((opts) => { if (!cancelled) setFilterDeliverables(opts); })
      .finally(() => { if (!cancelled) setLoadingFilterDeliverables(false); });
    setFilterDeliverableId("");
    return () => { cancelled = true; };
  }, [filterProjectId]);

  const hasActiveFilters = !!filterOrgId || !!filterProjectId || !!filterDeliverableId || !!statFilter;

  const clearFilters = () => {
    setFilterOrgId("");
    setFilterProjectId("");
    setFilterDeliverableId("");
    setStatFilter(null);
  };

  // Clicking an active stat card again turns the filter off.
  const handleStatClick = (key: Exclude<StatFilterKey, null>) => {
    setStatFilter((prev) => (prev === key ? null : key));
  };

  const visibleIssues = issues.filter((issue) => {
    if (domainFilter !== "all" && issue.domain !== domainFilter) return false;
    if (filterOrgId && issue.organisationId !== filterOrgId) return false;
    if (filterProjectId) {
      const issueProjectId = issue.project_id ?? issue.project;
      if (issueProjectId !== filterProjectId) return false;
    }
    if (filterDeliverableId && issue.deliverable !== filterDeliverableId) return false;
    if (statFilter && !STAT_FILTER_PREDICATES[statFilter](issue)) return false;
    return true;
  });

  const openIssues = issues.filter((i) => i.status === "Open").length;
  const inProgressIssues = issues.filter((i) => i.status === "In Progress").length;
  const resolvedIssues = issues.filter((i) => i.status === "Resolved").length;
  const bimIssueCount = issues.filter(isBimIssue).length;
  const clashIssues = issues.filter(i => isBimIssue(i) && i.topicType === "Clash").length;
  const highPriorityIssues = issues.filter((i) => i.priority === "High").length;

  const assignees = [...new Set(issues.map((i) => i.assignedTo).filter(Boolean))] as string[];

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
      return;
    }
    try {
      setError(null);
      await deleteIssue(issueId);
      await refresh();
    } catch (err: unknown) {
      console.error('Delete issue error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete issue. Please try again.');
    }
  };

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
          <div className="header-actions">
            <button className="btn-primary" onClick={() => setShowNewIssueForm((v) => !v)}>
              <i className="ti ti-plus" />
              New Issue
            </button>
          </div>
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
            } catch (err: unknown) {
              console.error('Create error:', err);
              setError(extractValidationMessage(err, 'Failed to create issue. Please try again.'));
            }
          }}
        />
      )}

      <section className="stats-grid">
        <StatCard
          icon="ti-alert-circle"
          label="Open"
          value={openIssues}
          active={statFilter === "open"}
          urgent={openIssues > 0}
          onClick={() => handleStatClick("open")}
        />
        <StatCard
          icon="ti-loader"
          label="In Progress"
          value={inProgressIssues}
          active={statFilter === "inProgress"}
          onClick={() => handleStatClick("inProgress")}
        />
        <StatCard
          icon="ti-check"
          label="Resolved"
          value={resolvedIssues}
          active={statFilter === "resolved"}
          onClick={() => handleStatClick("resolved")}
        />
        <StatCard
          icon="ti-files"
          label="BCF Topics"
          value={bimIssueCount}
          active={statFilter === "bim"}
          onClick={() => handleStatClick("bim")}
        />
        <StatCard
          icon="ti-cube"
          label="Clashes"
          value={clashIssues}
          active={statFilter === "clash"}
          onClick={() => handleStatClick("clash")}
        />
        <StatCard
          icon="ti-flag"
          label="High Priority"
          value={highPriorityIssues}
          active={statFilter === "highPriority"}
          urgent={highPriorityIssues > 0}
          onClick={() => handleStatClick("highPriority")}
        />
      </section>

      {statFilter && (
        <div className="stat-filter-banner">
          <i className="ti ti-filter" />
          <span>Showing <strong>{STAT_FILTER_LABELS[statFilter]}</strong> issues only</span>
          <button
            type="button"
            className="stat-filter-banner-clear"
            onClick={() => setStatFilter(null)}
          >
            <i className="ti ti-x" /> Clear
          </button>
        </div>
      )}

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

      <section className="filters-section">
        <div className="section-title">
          <span>Filter by Organisation / Project / Deliverable</span>
          {hasActiveFilters && (
            <button className="filters-clear-btn" onClick={clearFilters} type="button">
              Clear filters
            </button>
          )}
        </div>
        <div className="filters-row">
          <div className="form-field">
            <label>Organisation</label>
            <select
              className="field-select"
              value={filterOrgId}
              onChange={(e) => setFilterOrgId(e.target.value ? Number(e.target.value) : "")}
              disabled={loadingFilterOrgs}
            >
              <option value="">
                {loadingFilterOrgs ? 'Loading organisations…' : 'All organisations'}
              </option>
              {filterOrganisations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Project</label>
            <select
              className="field-select"
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value ? Number(e.target.value) : "")}
              disabled={!filterOrgId || loadingFilterProjects}
            >
              <option value="">
                {!filterOrgId
                  ? 'Select an organisation first'
                  : loadingFilterProjects ? 'Loading projects…' : 'All projects'}
              </option>
              {filterProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Deliverable</label>
            <select
              className="field-select"
              value={filterDeliverableId}
              onChange={(e) => setFilterDeliverableId(e.target.value ? Number(e.target.value) : "")}
              disabled={!filterProjectId || loadingFilterDeliverables}
            >
              <option value="">
                {!filterProjectId
                  ? 'Select a project first'
                  : loadingFilterDeliverables ? 'Loading deliverables…' : 'All deliverables'}
              </option>
              {filterDeliverables.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title">
          <span>All Issues</span>
          <span className="issue-count">{visibleIssues.length} shown</span>
        </div>

        {loading ? (
          <p className="hero-subtitle">Loading issues…</p>
        ) : visibleIssues.length === 0 ? (
          <>
            <p className="hero-subtitle">
              {hasActiveFilters
                ? "No issues match the selected filters."
                : "No issues found. Create a new issue to get started!"}
            </p>
            {hasActiveFilters && (
              <button className="btn-outline" onClick={clearFilters} type="button" style={{ marginTop: '10px' }}>
                <i className="ti ti-x" /> Clear all filters
              </button>
            )}
          </>
        ) : (
          <div className="issues-grid">
            {visibleIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                commentSortOrder={commentSortOrder}
                onSortChange={() => setCommentSortOrder(commentSortOrder === "desc" ? "asc" : "desc")}
                currentUser={currentUser}
                isUserCreator={isUserCreator}
                onDeleteIssue={handleDeleteIssue}
                onOpenDrawing={handleOpenDrawing}
                onSave={async (patch) => {
                  try {
                    setError(null);
                    await updateIssue(issue.id, patch);
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Update error:', err);
                    setError(extractValidationMessage(err, 'Failed to update issue. Please try again.'));
                  }
                }}
                onResolve={async (resolution, snapshotData, snapshotFormat) => {
                  try {
                    setError(null);
                    await resolveIssue(issue.id, resolution, currentUser.email, snapshotData, snapshotFormat);
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Resolve error:', err);
                    setError('Failed to resolve issue. Please try again.');
                  }
                }}
                onRemoveSnapshot={async () => {
                  try {
                    setError(null);
                    await removeSnapshot(issue.id);
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Remove snapshot error:', err);
                    setError('Failed to remove screenshot. Please try again.');
                  }
                }}
                onRemoveAttachment={async (index) => {
                  try {
                    setError(null);
                    await removeAttachment(issue.id, index);
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Remove attachment error:', err);
                    setError('Failed to remove screenshot. Please try again.');
                  }
                }}
                onAddScreenshot={async (text, snapshotData, snapshotFormat) => {
                  try {
                    setError(null);
                    await addCommentWithSnapshot(
                      issue.id,
                      currentUser.email || currentUser.fullName,
                      text,
                      snapshotData,
                      snapshotFormat
                    );
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Add screenshot error:', err);
                    setError('Failed to add screenshot. Please try again.');
                  }
                }}
                onAddComment={async (text) => {
                  try {
                    setError(null);
                    await addComment(issue.id, currentUser.email || currentUser.fullName, text);
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Add comment error:', err);
                    setError('Failed to add comment. Please try again.');
                  }
                }}
                onDeleteComment={async (commentId) => {
                  try {
                    setError(null);
                    await deleteComment(issue.id, commentId);
                    await refresh();
                  } catch (err: unknown) {
                    console.error('Delete comment error:', err);
                    setError('Failed to delete comment. Please try again.');
                  }
                }}
                onEditComment={async (commentId, text, snapshotData, snapshotFormat, removeSnapshot) => {
                  try {
                    setError(null);
                    await editComment(issue.id, commentId, text, snapshotData, snapshotFormat, removeSnapshot);
                    await refresh();
                  } catch (err: unknown) {
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

function StatCard({
  icon,
  label,
  value,
  onClick,
  active,
  urgent,
}: {
  icon: string;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
  urgent?: boolean;
}) {
  const isBlinking = !!urgent && value > 0;
  const classes = [
    "stat-card",
    active ? "stat-card-active" : "",
    isBlinking ? "stat-card-urgent" : "",
  ].filter(Boolean).join(" ");

  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={!!active}>
      <i className={`ti ${icon} stat-icon`} />
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </button>
  );
}

function NewIssueForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: NewIssueInput) => Promise<void>;
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
  const [projectId, setProjectId] = useState<number | null>(null);
  const [organisationId, setOrganisationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectOption[]>([]);
  const [loadingOrganisations, setLoadingOrganisations] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [availableDrawings, setAvailableDrawings] = useState<DrawingOption[]>([]);
  const [loadingDrawings, setLoadingDrawings] = useState(false);
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchOrganisations = async () => {
      setLoadingOrganisations(true);
      try {
        const token = localStorage.getItem('access');
        if (!token) {
          setLoadingOrganisations(false);
          return;
        }

        const response = await fetch(`${API_URL}/my-organisations/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOrganisations(data);
          if (data.length > 0) {
            setOrganisationId(data[0].id);
          }
        } else {
          setError('Failed to load organisations.');
        }
      } catch {
        setError('Failed to load organisations.');
      } finally {
        setLoadingOrganisations(false);
      }
    };
    fetchOrganisations();
  }, []);

  useEffect(() => {
    if (!organisationId) {
      setFilteredProjects([]);
      setProjectId(null);
      return;
    }

    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const token = localStorage.getItem('access');
        if (!token) {
          setLoadingProjects(false);
          return;
        }

        const response = await fetch(`${API_URL}/organisations/${organisationId}/projects/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setFilteredProjects(data);
          if (data.length > 0) {
            setProjectId(data[0].id);
          } else {
            setProjectId(null);
          }
        } else {
          setFilteredProjects([]);
          setProjectId(null);
        }
      } catch {
        setFilteredProjects([]);
        setProjectId(null);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [organisationId]);

  useEffect(() => {
    if (!projectId) {
      setAvailableDrawings([]);
      setLinkedDocumentIds([]);
      return;
    }
    let cancelled = false;
    setLoadingDrawings(true);
    getProjectDrawings(projectId)
      .then((opts) => { if (!cancelled) setAvailableDrawings(opts); })
      .finally(() => { if (!cancelled) setLoadingDrawings(false); });
    setLinkedDocumentIds([]);
    return () => { cancelled = true; };
  }, [projectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadError(null);
    setUploadingImage(true);
    try {
      const { base64, format } = await compressImage(file);
      setScreenshot(base64);
      setScreenshotFormat(format);
      setPreviewImage(`data:image/${format};base64,${base64}`);
    } catch {
      setUploadError('Failed to process image file');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setError(null);

      if (!title.trim()) {
        setError('Title is required');
        return;
      }

      if (!projectId) {
        setError('Please select a project');
        return;
      }

      const base: NewIssueBase = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        status: "Open",
        priority,
        module: module.trim() || (domain === "bim" ? "Modeling" : "General"),
        linkedDocumentIds: linkedDocumentIds.length > 0 ? linkedDocumentIds : undefined,
      };

      if (domain === "bim") {
        const bimInput: NewBimIssueInput = {
          ...base,
          domain: "bim",
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
        await onCreate(bimInput);
      } else {
        const designInput: NewDesignIssueInput = {
          ...base,
          domain: "other",
          category: category.trim() || undefined,
          ...(screenshot ? {
            newAttachmentData: screenshot,
            newAttachmentFormat: screenshotFormat,
          } : {})
        };
        await onCreate(designInput);
      }
    } catch (err: unknown) {
      console.error('Submit error:', err);
      setError(extractValidationMessage(err, 'Failed to create issue. Please try again.'));
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
          <label>Organisation <span style={{ color: '#D43E3E' }}>*</span></label>
          {loadingOrganisations ? (
            <div className="loading-indicator">Loading organisations...</div>
          ) : organisations.length > 0 ? (
            <select
              className="field-select"
              value={organisationId || ''}
              onChange={(e) => setOrganisationId(Number(e.target.value))}
              required
            >
              <option value="">Select an organisation...</option>
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ color: '#D43E3E', fontSize: '14px', padding: '8px' }}>
              You are not a member of any organisation.
            </div>
          )}
        </div>

        <div className="form-field">
          <label>Project <span style={{ color: '#D43E3E' }}>*</span></label>
          {loadingProjects ? (
            <div className="loading-indicator">Loading projects...</div>
          ) : organisationId ? (
            <select
              className="field-select"
              value={projectId || ''}
              onChange={(e) => setProjectId(Number(e.target.value))}
              required
              disabled={filteredProjects.length === 0}
            >
              <option value="">Select a project...</option>
              {filteredProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ color: '#6B7280', fontSize: '14px', padding: '8px' }}>
              Please select an organisation first
            </div>
          )}
          {filteredProjects.length === 0 && organisationId && !loadingProjects && (
            <div style={{ color: '#D43E3E', fontSize: '12px', marginTop: '4px' }}>
              No projects available in this organisation.
            </div>
          )}
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
        <label>Title <span style={{ color: '#D43E3E' }}>*</span></label>
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
            disabled={uploadingImage}
            type="button"
          >
            <i className={`ti ${uploadingImage ? 'ti-loader' : 'ti-camera'}`} />
            {uploadingImage ? 'Processing image…' : 'Upload screenshot (max 5MB)'}
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
          <div className="screenshot-preview" style={{ position: 'relative', width: 200, height: 150 }}>
            <Image
              src={previewImage}
              alt="Preview"
              fill
              unoptimized
              sizes="200px"
              style={{ objectFit: 'contain' }}
            />
            <button
              className="remove-btn"
              onClick={() => {
                setScreenshot(null);
                setPreviewImage(null);
              }}
              type="button"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="form-field">
        <label>Linked Drawings (optional)</label>
        {!projectId ? (
          <div style={{ color: 'var(--slate)', fontSize: '13px', padding: '4px' }}>
            Select a project to see its drawings.
          </div>
        ) : loadingDrawings ? (
          <div className="loading-indicator">Loading drawings...</div>
        ) : availableDrawings.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              maxHeight: '160px',
              overflowY: 'auto',
              border: '1px solid var(--line)',
              borderRadius: '4px',
              padding: '8px',
            }}
          >
            {availableDrawings.map((d) => (
              <label
                key={d.id}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={linkedDocumentIds.includes(d.id)}
                  onChange={(e) => {
                    setLinkedDocumentIds((ids) =>
                      e.target.checked ? [...ids, d.id] : ids.filter((id) => id !== d.id)
                    );
                  }}
                />
                <i className={`ti ${getDrawingIcon(d.file_type)}`} />
                {d.title}
              </label>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--slate)', fontSize: '13px', padding: '4px' }}>
            No drawings found for this project.
          </div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn-outline" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!projectId || !title.trim() || !organisationId || uploadingImage}
          type="button"
        >
          <i className="ti ti-plus" /> Create Issue
        </button>
      </div>
    </section>
  );
}