"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./issues.css";
import {
  createIssue,
  getIssuesPaginated,
  getIssueStats,
  getProjectDrawings,
  getMyOrganisations,
  getOrganisationProjects,
  getDeliverablesForProject,
  DrawingOption,
  DeliverableOption,
  OrganisationSummary,
  ProjectSummary,
  IssueStats,
  API_URL,
} from "./issueApi";

import { Issue, IssueStatus, IssuePriority, IssueDomain, BcfTopicType } from "./issueTypes";
import { IssueCard } from "./IssueCard";
import { processImageFile, extractImageFromClipboard, extractImageFromDrop } from "./imageUtils";
import { ScreenshotDropzone } from "./IssueCardParts";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isUserMatch } from '@/components/utils/userMatching';
import { useAppDispatch } from '@/redux/hooks';
import { setUser } from '@/redux/features/authSlice';

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

const PRIORITY_OPTIONS: IssuePriority[] = ["High", "Medium", "Low"];
const TOPIC_TYPE_OPTIONS: BcfTopicType[] = ["Clash", "Coordinate", "Quality", "Safety", "General", "Request", "Fault"];

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

interface OrganisationOption { id: number; name: string; }
interface ProjectOption { id: number; name: string; organisation_id: number; organisation_name: string; }

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

// ---------------------------------------------------------------------------
// Stats-strip filter chips — multi-select, OR'd within a group (status vs.
// priority), AND'd across groups. These now drive SERVER-side filtering
// (status_in / priority_in) instead of filtering an in-memory array, so they
// stay correct across pages.
// ---------------------------------------------------------------------------

type StatFilterKey = "open" | "inProgress" | "resolved" | "lowPriority" | "mediumPriority" | "highPriority";

const STATUS_FILTER_KEYS: StatFilterKey[] = ["open", "inProgress", "resolved"];
const PRIORITY_FILTER_KEYS: StatFilterKey[] = ["lowPriority", "mediumPriority", "highPriority"];

const STAT_FILTER_BACKEND_CODE: Record<StatFilterKey, string> = {
  open: "open",
  inProgress: "in_progress",
  resolved: "resolved",
  lowPriority: "low",
  mediumPriority: "medium",
  highPriority: "high",
};

const STAT_FILTER_LABELS: Record<StatFilterKey, string> = {
  open: "Open",
  inProgress: "In Progress",
  resolved: "Resolved",
  lowPriority: "Low Priority",
  mediumPriority: "Medium Priority",
  highPriority: "High Priority",
};

function buildStatusInParam(active: Set<StatFilterKey>): string | undefined {
  const codes = STATUS_FILTER_KEYS.filter((k) => active.has(k)).map((k) => STAT_FILTER_BACKEND_CODE[k]);
  return codes.length > 0 ? codes.join(",") : undefined;
}

function buildPriorityInParam(active: Set<StatFilterKey>): string | undefined {
  const codes = PRIORITY_FILTER_KEYS.filter((k) => active.has(k)).map((k) => STAT_FILTER_BACKEND_CODE[k]);
  return codes.length > 0 ? codes.join(",") : undefined;
}

// ---------------------------------------------------------------------------
// Sort — server-side via `ordering`. Newest = descending.
// ---------------------------------------------------------------------------

type SortField = "created" | "updated";
type SortOrder = "newest" | "oldest";

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "created", label: "Date Created" },
  { value: "updated", label: "Last Updated" },
];

const SORT_ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
];

function buildOrderingParam(field: SortField, order: SortOrder): string {
  return order === "newest" ? `-${field}` : field;
}

function extractValidationMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Record<string, unknown>;
    return `Validation Error: ${Object.values(data).flat().join('\n')}`;
  }
  return fallback;
}

const PAGE_SIZE = 10;
const EMPTY_STATS: IssueStats = { open: 0, in_progress: 0, resolved: 0, closed: 0, low: 0, medium: 0, high: 0, total: 0 };

export default function IssuesPage() {
  const dispatch = useAppDispatch();

  // --- List (current page only, from the server) ---------------------------
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Stats (from the dedicated /stats/ endpoint, covers the WHOLE DB
  // within the current org/project/domain/deliverable scope) --------------
  const [stats, setStats] = useState<IssueStats>(EMPTY_STATS);

  const [domainFilter, setDomainFilter] = useState<"all" | IssueDomain>("all");
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);

  // --- Search ---------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // --- Sort -------------------------------------------------------------
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

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

  const [activeStatFilters, setActiveStatFilters] = useState<Set<StatFilterKey>>(new Set());

  useEffect(() => {
    const loadUserFromStorage = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          dispatch(setUser(JSON.parse(userStr)));
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

  const isUserCreator = (reportedBy: string, user: typeof currentUser): boolean => isUserMatch(reportedBy, user);

  // --- Scope params shared by the list request and the stats request -------
  const scopeParams = {
    organisation: filterOrgId || undefined,
    project: filterProjectId || undefined,
    domain: domainFilter !== "all" ? domainFilter : undefined,
    deliverable: filterDeliverableId || undefined,
  };

  const hasActiveFilters =
    !!filterOrgId || !!filterProjectId || !!filterDeliverableId ||
    activeStatFilters.size > 0 || !!debouncedSearch;

  const clearFilters = () => {
    setFilterOrgId("");
    setFilterProjectId("");
    setFilterDeliverableId("");
    setActiveStatFilters(new Set());
    setSearchQuery("");
  };

  const handleStatClick = (key: StatFilterKey) => {
    setActiveStatFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // --- Fetch the current page of issues -------------------------------------
  const refreshList = async (targetPage: number) => {
    try {
      setError(null);
      setLoading(true);
      const data = await getIssuesPaginated({
        ...scopeParams,
        status_in: buildStatusInParam(activeStatFilters),
        priority_in: buildPriorityInParam(activeStatFilters),
        search: debouncedSearch || undefined,
        ordering: buildOrderingParam(sortField, sortOrder),
        page: targetPage,
        page_size: PAGE_SIZE,
      });
      setIssues(data.results);
      setTotalCount(data.count);
      setHasNext(!!data.next);
      setHasPrevious(!!data.previous);
    } catch (err) {
      console.error('Refresh error:', err);
      setError('Failed to load issues. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch stats (scope only — NOT status_in/priority_in/search, so chip
  // counts don't collapse to just the active chip) --------------------------
  const refreshStats = async () => {
    try {
      const s = await getIssueStats(scopeParams);
      setStats(s);
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  // Scope/search/sort/chip changes reset to page 1 and refetch everything.
  useEffect(() => {
    setPage(1);
    refreshList(1);
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOrgId, filterProjectId, filterDeliverableId, domainFilter, activeStatFilters, debouncedSearch, sortField, sortOrder]);

  // Page changes only refetch the list.
  useEffect(() => {
    if (page === 1) return; // already covered by the effect above on first load
    refreshList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Load the organisation list once, for the filter bar.
  useEffect(() => {
    setLoadingFilterOrgs(true);
    getMyOrganisations().then(setFilterOrganisations).finally(() => setLoadingFilterOrgs(false));
  }, []);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);



  return (
    <main className={`${display.variable} ${mono.variable} issues-page`}>
      <header className="issues-header">
        <div className="issues-brand">
          <span className="issues-brand-icon"><i className="ti ti-bug" /></span>
          <span className="issues-brand-text">Issue Tracker</span>
        </div>
        <div className="issues-header-actions">
          <div className="domain-tabs">
            <button className={`tab ${domainFilter === "all" ? "active" : ""}`} onClick={() => setDomainFilter("all")}>All</button>
            <button className={`tab ${domainFilter === "bim" ? "active" : ""}`} onClick={() => setDomainFilter("bim")}>BIM</button>
            <button className={`tab ${domainFilter === "other" ? "active" : ""}`} onClick={() => setDomainFilter("other")}>Other</button>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => setShowNewIssueForm((v) => !v)}>
              <i className="ti ti-plus" /> New Issue
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
              await refreshList(1);
              await refreshStats();
              setPage(1);
              setShowNewIssueForm(false);
            } catch (err: unknown) {
              console.error('Create error:', err);
              setError(extractValidationMessage(err, 'Failed to create issue. Please try again.'));
            }
          }}
        />
      )}

      <section className="stats-grid">
        <StatCard icon="ti-alert-circle" label="Open" value={stats.open} active={activeStatFilters.has("open")} urgent={stats.open > 0} onClick={() => handleStatClick("open")} />
        <StatCard icon="ti-loader" label="In Progress" value={stats.in_progress} active={activeStatFilters.has("inProgress")} onClick={() => handleStatClick("inProgress")} />
        <StatCard icon="ti-check" label="Resolved" value={stats.resolved} active={activeStatFilters.has("resolved")} onClick={() => handleStatClick("resolved")} />
        <StatCard icon="ti-arrow-down" label="Low Priority" value={stats.low} active={activeStatFilters.has("lowPriority")} onClick={() => handleStatClick("lowPriority")} />
        <StatCard icon="ti-minus" label="Medium Priority" value={stats.medium} active={activeStatFilters.has("mediumPriority")} onClick={() => handleStatClick("mediumPriority")} />
        <StatCard icon="ti-flag" label="High Priority" value={stats.high} active={activeStatFilters.has("highPriority")} urgent={stats.high > 0} onClick={() => handleStatClick("highPriority")} />
      </section>

      {activeStatFilters.size > 0 && (
        <div className="stat-filter-banner">
          <i className="ti ti-filter" />
          <span>
            Showing <strong>{Array.from(activeStatFilters).map((k) => STAT_FILTER_LABELS[k]).join(', ')}</strong> issues only
          </span>
          <button type="button" className="stat-filter-banner-clear" onClick={() => setActiveStatFilters(new Set())}>
            <i className="ti ti-x" /> Clear
          </button>
        </div>
      )}

      <section className="filters-section">
        <div className="section-title">
          <span>Filter by Organisation / Project / Deliverable</span>
          {hasActiveFilters && (
            <button className="filters-clear-btn" onClick={clearFilters} type="button">Clear filters</button>
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
              <option value="">{loadingFilterOrgs ? 'Loading organisations…' : 'All organisations'}</option>
              {filterOrganisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
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
                {!filterOrgId ? 'Select an organisation first' : loadingFilterProjects ? 'Loading projects…' : 'All projects'}
              </option>
              {filterProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
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
                {!filterProjectId ? 'Select a project first' : loadingFilterDeliverables ? 'Loading deliverables…' : 'All deliverables'}
              </option>
              {filterDeliverables.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="search-section">
        <div className="search-bar">
          <i className="ti ti-search search-bar-icon" />
          <input
            type="text"
            className="search-bar-input"
            placeholder="Search issues by title, description, module, category…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="search-bar-clear" onClick={() => setSearchQuery("")} title="Clear search">
              <i className="ti ti-x" />
            </button>
          )}
        </div>

        <div className="sort-controls" style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <div className="form-field" style={{ flex: '0 0 auto', minWidth: '160px' }}>
            <label>Sort by</label>
            <select className="field-select" value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
              {SORT_FIELD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: '0 0 auto', minWidth: '160px' }}>
            <label>Order</label>
            <select className="field-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}>
              {SORT_ORDER_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title">
          <span>All Issues</span>
          <span className="issue-count">
            {totalCount === 0 ? '0 shown' : `${rangeStart}–${rangeEnd} of ${totalCount}`}
          </span>
        </div>

        {loading ? (
          <p className="hero-subtitle">Loading issues…</p>
        ) : issues.length === 0 ? (
          <>
            <p className="hero-subtitle">
              {hasActiveFilters ? "No issues match the selected filters." : "No issues found. Create a new issue to get started!"}
            </p>
            {hasActiveFilters && (
              <button className="btn-outline" onClick={clearFilters} type="button" style={{ marginTop: '10px' }}>
                <i className="ti ti-x" /> Clear all filters
              </button>
            )}
          </>
        ) : (
          <>
            <div className="issues-grid">
              {issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  currentUser={currentUser}
                  isUserCreator={isUserCreator}
                />
              ))}
            </div>

            <div
              className="pagination-controls"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '20px' }}
            >
              <button
                type="button"
                className="btn-outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrevious || loading}
              >
                <i className="ti ti-chevron-left" /> Previous
              </button>
              <span style={{ fontSize: '13px', color: 'var(--slate)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext || loading}
              >
                Next <i className="ti ti-chevron-right" />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({ icon, label, value, onClick, active, urgent }: {
  icon: string; label: string; value: number; onClick?: () => void; active?: boolean; urgent?: boolean;
}) {
  const isBlinking = !!urgent && value > 0;
  const classes = ["stat-card", active ? "stat-card-active" : "", isBlinking ? "stat-card-urgent" : ""].filter(Boolean).join(" ");
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

function NewIssueForm({ onCreate, onCancel }: {
  onCreate: (input: NewIssueInput) => Promise<void>;
  onCancel: () => void;
}) {
  // --- unchanged from your original file ---
  const [domain, setDomain] = useState<IssueDomain>("other");
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
  const [isDraggingScreenshot, setIsDraggingScreenshot] = useState(false);

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
        if (!token) { setLoadingOrganisations(false); return; }
        const response = await fetch(`${API_URL}/my-organisations/`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setOrganisations(data);
          if (data.length > 0) setOrganisationId(data[0].id);
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
    if (!organisationId) { setFilteredProjects([]); setProjectId(null); return; }
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const token = localStorage.getItem('access');
        if (!token) { setLoadingProjects(false); return; }
        const response = await fetch(`${API_URL}/organisations/${organisationId}/projects/`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setFilteredProjects(data);
          setProjectId(data.length > 0 ? data[0].id : null);
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
    if (!projectId) { setAvailableDrawings([]); setLinkedDocumentIds([]); return; }
    let cancelled = false;
    setLoadingDrawings(true);
    getProjectDrawings(projectId)
      .then((opts) => { if (!cancelled) setAvailableDrawings(opts); })
      .finally(() => { if (!cancelled) setLoadingDrawings(false); });
    setLinkedDocumentIds([]);
    return () => { cancelled = true; };
  }, [projectId]);

  const applyScreenshotFile = async (file: File) => {
    setUploadError(null);
    setUploadingImage(true);
    try {
      const result = await processImageFile(file, { onError: setUploadError });
      if (!result) return;
      setScreenshot(result.base64);
      setScreenshotFormat(result.format);
      setPreviewImage(`data:image/${result.format};base64,${result.base64}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await applyScreenshotFile(file);
    e.target.value = '';
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = extractImageFromClipboard(e);
    if (!file) return;
    e.preventDefault();
    await applyScreenshotFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingScreenshot(false);
    const file = extractImageFromDrop(e);
    if (!file) { setUploadError('Please drop a PNG or JPEG image.'); return; }
    await applyScreenshotFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingScreenshot(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingScreenshot(false); };

  const handleSubmit = async () => {
    try {
      setError(null);
      if (!title.trim()) { setError('Title is required'); return; }
      if (!projectId) { setError('Please select a project'); return; }

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
            ...(screenshot ? { snapshot_data: screenshot, snapshot_format: screenshotFormat } : {})
          }
        };
        await onCreate(bimInput);
      } else {
        const designInput: NewDesignIssueInput = {
          ...base,
          domain: "other",
          category: category.trim() || undefined,
          ...(screenshot ? { newAttachmentData: screenshot, newAttachmentFormat: screenshotFormat } : {})
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
            <select className="field-select" value={organisationId || ''} onChange={(e) => setOrganisationId(Number(e.target.value))} required>
              <option value="">Select an organisation...</option>
              {organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          ) : (
            <div style={{ color: '#D43E3E', fontSize: '14px', padding: '8px' }}>You are not a member of any organisation.</div>
          )}
        </div>

        <div className="form-field">
          <label>Project <span style={{ color: '#D43E3E' }}>*</span></label>
          {loadingProjects ? (
            <div className="loading-indicator">Loading projects...</div>
          ) : organisationId ? (
            <select className="field-select" value={projectId || ''} onChange={(e) => setProjectId(Number(e.target.value))} required disabled={filteredProjects.length === 0}>
              <option value="">Select a project...</option>
              {filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          ) : (
            <div style={{ color: '#6B7280', fontSize: '14px', padding: '8px' }}>Please select an organisation first</div>
          )}
          {filteredProjects.length === 0 && organisationId && !loadingProjects && (
            <div style={{ color: '#D43E3E', fontSize: '12px', marginTop: '4px' }}>No projects available in this organisation.</div>
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
            <select className="field-select" value={topicType} onChange={(e) => setTopicType(e.target.value as BcfTopicType)}>
              {TOPIC_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ) : (
          <div className="form-field">
            <label>Category</label>
            <input className="field-input" placeholder="e.g. Documentation" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        )}

        <div className="form-field">
          <label>Priority</label>
          <select className="field-select" value={priority} onChange={(e) => setPriority(e.target.value as IssuePriority)}>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Title <span style={{ color: '#D43E3E' }}>*</span></label>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-field">
        <label>Description</label>
        <textarea className="field-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} onPaste={handlePaste} />
        <span className="file-hint">Tip: you can paste a screenshot (Ctrl/Cmd+V) directly into this box.</span>
      </div>

      <div className="form-field">
        <label>Module</label>
        <input className="field-input" placeholder={domain === "bim" ? "e.g. Modeling" : "e.g. Documentation"} value={module} onChange={(e) => setModule(e.target.value)} />
      </div>

      <div className="form-field">
        <label>Screenshot (optional)</label>
        {previewImage ? (
          <div className="screenshot-preview" style={{ position: 'relative', width: 200, height: 150 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <button className="remove-btn" onClick={() => { setScreenshot(null); setPreviewImage(null); }} type="button">✕</button>
          </div>
        ) : (
          <ScreenshotDropzone
            fileInputRef={fileInputRef}
            onFileUpload={handleFileUpload}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            isDragging={isDraggingScreenshot}
            processing={uploadingImage}
          />
        )}
      </div>

      <div className="form-field">
        <label>Linked Drawings (optional)</label>
        {!projectId ? (
          <div style={{ color: 'var(--slate)', fontSize: '13px', padding: '4px' }}>Select a project to see its drawings.</div>
        ) : loadingDrawings ? (
          <div className="loading-indicator">Loading drawings...</div>
        ) : availableDrawings.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '4px', padding: '8px' }}>
            {availableDrawings.map((d) => (
              <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={linkedDocumentIds.includes(d.id)}
                  onChange={(e) => setLinkedDocumentIds((ids) => e.target.checked ? [...ids, d.id] : ids.filter((id) => id !== d.id))}
                />
                <i className={`ti ${getDrawingIcon(d.file_type)}`} />
                {d.title}
              </label>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--slate)', fontSize: '13px', padding: '4px' }}>No drawings found for this project.</div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn-outline" onClick={onCancel} type="button">Cancel</button>
        <button className="btn-primary" onClick={handleSubmit} disabled={!projectId || !title.trim() || !organisationId || uploadingImage} type="button">
          <i className="ti ti-plus" /> Create Issue
        </button>
      </div>
    </section>
  );
}