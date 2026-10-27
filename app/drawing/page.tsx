"use client";

import { useEffect, useState, useCallback, Suspense, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  getOrganisations,
  getProjects,
  getDeliverables,
  getDocuments,
  getDocument,
  toggleFavorite,
  downloadDocument,
  getCurrentUser,
  canAccessDocument,
  getDisplayFileUrl,
  getFullFileUrl,
  createDocument,
  updateDocument,
  deleteDocument,
  approveDocument,
  rejectDocument,
  archiveDocument,
  restoreDocument,
  getMyMemberships,
  RawMembership,
} from "./drawingApi";
import {
  Organisation,
  Project,
  Deliverable,
  DrawingDocumentResolved,
  UserContext,
} from "./types";
import DocumentViewer from "./components/DocumentViewer";
import DocumentForm from "./components/DocumentForm";
import PdfThumbnail from "./components/PdfThumbnail";
import GuestAccessGate from "./components/GuestAccessGate";
import BulkShareModal from "./components/BulkShareModal";
import ActivityLogModal from "./components/ActivityLogModal";
import "./styles.css";
import "./approval.css";

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

const UPLOAD_ROLES = ["admin", "manager", "member"];

const Spinner = () => <span className="btn-spinner" aria-hidden="true" />;

/**
 * What the Status dropdown can hold. "pending" / "rejected" are both
 * status=draft on the server, split by review_state.
 */
type StatusView = "all" | "draft" | "pending" | "rejected" | "published" | "archived";

const statusViewToParams = (
  view: StatusView | undefined
): { status?: "draft" | "published" | "archived"; reviewState?: "pending" | "rejected" } => {
  if (!view || view === "all") return {};
  if (view === "pending") return { status: "draft", reviewState: "pending" };
  if (view === "rejected") return { status: "draft", reviewState: "rejected" };
  return { status: view };
};

type ApiError = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <main className={`${display.variable} ${mono.variable} documents-page`}>
          <div className="documents-loading">
            <i className="ti ti-loader" aria-hidden="true" />
            <p>Loading...</p>
          </div>
        </main>
      }
    >
      <DocumentsPageInner />
    </Suspense>
  );
}

function DocumentsPageInner() {
  const searchParams = useSearchParams();

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [documents, setDocuments] = useState<DrawingDocumentResolved[]>([]);

  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showPrivateOnly, setShowPrivateOnly] = useState<boolean>(false);
  const [mineOnly, setMineOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  // Only meaningful for admin/manager/member — clients are always forced to
  // "published" and never see this control (see canFilterByStatus below).
  // Default view: published drawings only.
  const [selectedStatus, setSelectedStatus] = useState<StatusView>("published");

  const [selectedDoc, setSelectedDoc] = useState<DrawingDocumentResolved | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking message for failed actions (delete / approve / reject ...)
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // One review action at a time across ALL cards
  const [busyAction, setBusyAction] = useState<{ id: number; action: string } | null>(null);
  const busyRef = useRef(false);
  const isBusy = busyAction !== null;
  const isBtnBusy = (doc: DrawingDocumentResolved, action: string) =>
    busyAction?.id === doc.id && busyAction.action === action;


  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);

  // Real org-membership rows from /my-memberships/ (OrganisationMembership),
  // used instead of currentUser.roles — see getMyMemberships() in drawingApi.ts.
  const [memberships, setMemberships] = useState<RawMembership[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState<boolean>(false);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingDocument, setEditingDocument] = useState<DrawingDocumentResolved | null>(null);

  // Bulk share (checklist + A4 print of guest links)
  const [showBulkShare, setShowBulkShare] = useState<boolean>(false);

  // Org-wide activity log (admins only)
  const [showActivityLog, setShowActivityLog] = useState<boolean>(false);

  const [privateCount, setPrivateCount] = useState<number>(0);
  const [publicCount, setPublicCount] = useState<number>(0);

  const [hasHandledOpenDoc, setHasHandledOpenDoc] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === "object" && err !== null) {
      const apiError = err as ApiError;
      if (apiError.response?.data?.message) {
        return apiError.response.data.message;
      }
      if (apiError.message) {
        return apiError.message;
      }
    }
    if (typeof err === "string") {
      return err;
    }
    return "An unexpected error occurred";
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        console.error("Error loading user:", err);
      }
    };
    loadUser();
  }, []);

  const isGuest = currentUser?.id === 0;

  // Fetch real OrganisationMembership rows once we know who's logged in.
  useEffect(() => {
    if (!currentUser || isGuest) {
      setMembershipsLoaded(true);
      return;
    }
    let cancelled = false;
    const loadMemberships = async () => {
      try {
        const data = await getMyMemberships();
        if (!cancelled) setMemberships(data);
      } catch (err) {
        console.error("Error loading memberships:", err);
      } finally {
        if (!cancelled) setMembershipsLoaded(true);
      }
    };
    loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [currentUser, isGuest]);

  // UI gating only — the server enforces every rule regardless.
  const hasElevatedRole = useMemo(
    () => membershipsLoaded && memberships.some((m) => UPLOAD_ROLES.includes(m.role)),
    [membershipsLoaded, memberships]
  );
  const canUpload = hasElevatedRole;

  // Org-wide admin somewhere → can see the org activity log.
  const isAdmin = useMemo(
    () =>
      membershipsLoaded &&
      memberships.some((m) => m.role === "admin" && (m.project === null || m.project === undefined)),
    [membershipsLoaded, memberships]
  );

  const canFilterByStatus = hasElevatedRole;

  // Clients (and anyone without an admin/manager/member membership) are
  // always restricted to published documents, regardless of whatever
  // selectedStatus happens to hold.
  const effectiveStatusView: StatusView | undefined = canFilterByStatus
    ? selectedStatus
    : "published";
  const statusParams = statusViewToParams(effectiveStatusView);

  useEffect(() => {
    if (!currentUser || isGuest) return;
    const loadOrganisations = async () => {
      try {
        const data = await getOrganisations();
        setOrganisations(data);
      } catch (err) {
        console.error("Error loading organisations:", err);
        setError("Failed to load organisations");
      }
    };
    loadOrganisations();
  }, [currentUser, isGuest]);

  // Projects are only loaded once an organisation is selected.
  // With no organisation chosen the list stays empty and nothing is fetched.
  useEffect(() => {
    if (!currentUser || isGuest) return;

    setSelectedProjectId(undefined);
    setSelectedDeliverableId(undefined);

    if (selectedOrgId === undefined) {
      setProjects([]);
      return;
    }

    let cancelled = false;
    const loadProjects = async () => {
      try {
        const data = await getProjects(selectedOrgId);
        if (!cancelled) setProjects(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading projects:", err);
        setError("Failed to load projects");
      }
    };
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, currentUser, isGuest]);

  useEffect(() => {
    if (!currentUser || isGuest) return;
    const loadDeliverables = async () => {
      try {
        const data = await getDeliverables(selectedProjectId);
        setDeliverables(data);
      } catch (err) {
        console.error("Error loading deliverables:", err);
        setError("Failed to load deliverables");
      }
    };
    loadDeliverables();
    setSelectedDeliverableId(undefined);
  }, [selectedProjectId, currentUser, isGuest]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedOrgId,
    selectedProjectId,
    selectedDeliverableId,
    searchTerm,
    showPrivateOnly,
    mineOnly,
    pageSize,
    sortOrder,
    selectedStatus,
  ]);

  const loadDocuments = useCallback(
    async (silent: boolean = false) => {
      if (!currentUser || isGuest) return;

      try {
        if (!silent) setLoading(true);
        setError(null);

        const ordering = sortOrder === "newest" ? "-created_at" : "created_at";

        const data = await getDocuments({
          organisationId: selectedOrgId,
          projectId: selectedProjectId,
          deliverableId: selectedDeliverableId,
          search: searchTerm,
          showPrivate: showPrivateOnly,
          mine: mineOnly,
          page: currentPage,
          pageSize,
          ordering,
          status: statusParams.status,
          reviewState: statusParams.reviewState,
        });

        setDocuments(data.results);
        setTotalCount(data.count);

        // Optional: privacy counts (backend caps page_size at 100, so this
        // only counts the first 100 matches — known limitation)
        const all = await getDocuments({
          organisationId: selectedOrgId,
          projectId: selectedProjectId,
          deliverableId: selectedDeliverableId,
          search: searchTerm,
          mine: mineOnly,
          page: 1,
          pageSize: 1000,
          ordering,
          status: statusParams.status,
          reviewState: statusParams.reviewState,
        });
        setPrivateCount(all.results.filter((d) => d.is_private).length);
        setPublicCount(all.results.filter((d) => !d.is_private).length);
      } catch (err) {
        console.error("Error loading documents:", err);
        setError("Failed to load documents. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedOrgId,
      selectedProjectId,
      selectedDeliverableId,
      searchTerm,
      showPrivateOnly,
      mineOnly,
      currentPage,
      pageSize,
      currentUser,
      isGuest,
      sortOrder,
      effectiveStatusView,
    ]
  );

  useEffect(() => {
    if (currentUser && !isGuest) {
      loadDocuments();
    } else {
      setLoading(false);
    }
  }, [loadDocuments, currentUser, isGuest]);

  useEffect(() => {
    if (hasHandledOpenDoc || !currentUser || isGuest) return;

    const openDocId = searchParams.get("openDoc");
    if (!openDocId) return;

    const id = Number(openDocId);
    if (!id) return;

    setHasHandledOpenDoc(true);

    (async () => {
      try {
        const fullDoc = await getDocument(id);
        if (!canAccessDocument(fullDoc, currentUser)) {
          setError("You do not have permission to view this document.");
          return;
        }
        setSelectedDoc(fullDoc);
        setIsViewerOpen(true);
      } catch (err) {
        console.error("Error auto-opening linked document:", err);
        setError("Failed to load the linked document.");
      }
    })();
  }, [searchParams, currentUser, isGuest, hasHandledOpenDoc]);

  const handleViewDocument = async (doc: DrawingDocumentResolved) => {
    if (!currentUser) {
      setError("Please login to view documents");
      return;
    }
    if (!canAccessDocument(doc, currentUser)) {
      setError("You do not have permission to view this document.");
      return;
    }
    try {
      const fullDoc = await getDocument(doc.id);
      setSelectedDoc(fullDoc);
      setIsViewerOpen(true);
    } catch (err) {
      console.error("Error loading document details:", err);
      setError("Failed to load document details");
    }
  };

  const handleEditDocument = async (doc: DrawingDocumentResolved) => {
    try {
      const fullDoc = await getDocument(doc.id);
      setEditingDocument(fullDoc);
      setFormMode("edit");
      setIsFormOpen(true);
    } catch (err) {
      console.error("Error loading document details:", err);
      setError("Failed to load document details");
    }
  };

  const runAction = async (
    doc: DrawingDocumentResolved,
    action: string,
    fn: () => Promise<DrawingDocumentResolved | void>
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyAction({ id: doc.id, action });
    setActionMessage(null);
    try {
      const updated = await fn();
      if (action === "delete") {
        setSelectedDoc(null);
      } else if (updated && selectedDoc?.id === doc.id) {
        setSelectedDoc(updated);
      }
      await loadDocuments(true);
    } catch (err) {
      setActionMessage(getErrorMessage(err) || "Action failed");
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  };

  const handleDeleteDocument = (doc: DrawingDocumentResolved) => {
    if (!confirm(`Delete the draft "${doc.title}"? This action cannot be undone.`)) return;
    runAction(doc, "delete", () => deleteDocument(doc.id));
  };

  // Called by the viewer's ApprovalPanel after approve/reject/archive/restore
  const handleDocumentChanged = (updated: DrawingDocumentResolved) => {
    setSelectedDoc(updated);
    loadDocuments(true);
  };

  const handleQuickApprove = (doc: DrawingDocumentResolved) =>
    runAction(doc, "approve", () => approveDocument(doc.id));

  const handleQuickReject = (doc: DrawingDocumentResolved) => {
    if (busyRef.current) return;
    const reason = window.prompt(`Reason for rejecting "${doc.title}" (optional):`);
    if (reason === null) return;
    runAction(doc, "reject", () => rejectDocument(doc.id, reason));
  };

  const handleQuickArchive = (doc: DrawingDocumentResolved) => {
    if (busyRef.current) return;
    if (
      !window.confirm(
        `Archive "${doc.title}"? It will be hidden from the public and its share link will stop working.`
      )
    )
      return;
    runAction(doc, "archive", () => archiveDocument(doc.id));
  };

  const handleQuickRestore = (doc: DrawingDocumentResolved) => {
    if (busyRef.current) return;
    if (!window.confirm(`Restore "${doc.title}" to published? It will be public again.`)) return;
    runAction(doc, "restore", () => restoreDocument(doc.id));
  };
  const handleFormSave = async (formData: FormData) => {
    try {
      let savedId: number | null = null;
      if (formMode === "create") {
        const created = await createDocument(formData);
        savedId = created.id;
      } else if (editingDocument) {
        await updateDocument(editingDocument.id, formData);
        savedId = editingDocument.id;
      }
      await loadDocuments(true);
      setIsFormOpen(false);
      setEditingDocument(null);

      // Refresh the selected card's flags (e.g. a rejected draft that was just
      // fixed becomes "pending" again)
      if (savedId !== null && selectedDoc?.id === savedId) {
        try {
          setSelectedDoc(await getDocument(savedId));
        } catch {
          setSelectedDoc(null);
        }
      }
    } catch (err: unknown) {
      console.error("Error saving document:", err);
      throw err;
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const newStatus = await toggleFavorite(id);
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, is_favorite: newStatus } : doc))
      );
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleDownload = async (doc: DrawingDocumentResolved) => {
    if (!currentUser) {
      setError("Please login to download documents");
      return;
    }
    try {
      await downloadDocument(doc);
    } catch (err: unknown) {
      console.error("Error downloading document:", err);
      setError(getErrorMessage(err) || "Failed to download document");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const getFileIcon = (fileType: string): string => {
    switch (fileType) {
      case "pdf":
        return "ti-file-pdf";
      case "image":
        return "ti-image";
      case "dxf":
        return "ti-file-code";
      case "ifc":
        return "ti-building";
      default:
        return "ti-file";
    }
  };

  const getFileTypeDisplay = (fileType: string): string => {
    switch (fileType) {
      case "pdf":
        return "PDF";
      case "dxf":
        return "DXF";
      case "ifc":
        return "IFC";
      case "image":
        return "Image";
      default:
        return "Document";
    }
  };

  // Card chip: rejected drafts get their own colour/label
  const getCardStatus = (doc: DrawingDocumentResolved): { label: string; color: string } => {
    if (doc.review_state === "rejected") return { label: "rejected", color: "#A32D2D" };
    if (doc.review_state === "pending") return { label: "pending review", color: "#E67E22" };
    switch (doc.status) {
      case "published":
        return { label: "published", color: "#0F6E56" };
      case "archived":
        return { label: "archived", color: "#6E6B62" };
      default:
        return { label: doc.status, color: "#E67E22" };
    }
  };

  const clearFilters = () => {
    setSelectedOrgId(undefined);
    setSelectedProjectId(undefined);
    setSelectedDeliverableId(undefined);
    setSearchTerm("");
    setShowPrivateOnly(false);
    setMineOnly(false);
    setCurrentPage(1);
    setSortOrder("newest");
    setSelectedStatus("published");
  };

  const hasActiveFilters =
    selectedOrgId !== undefined ||
    selectedProjectId !== undefined ||
    selectedDeliverableId !== undefined ||
    searchTerm.trim() !== "" ||
    mineOnly ||
    (canFilterByStatus && selectedStatus !== "published");

  if (!currentUser) {
    return (
      <main className={`${display.variable} ${mono.variable} documents-page`}>
        <div className="documents-loading">
          <i className="ti ti-loader" aria-hidden="true" />
          <p>Loading user information...</p>
        </div>
      </main>
    );
  }

  if (isGuest) {
    return (
      <main className={`${display.variable} ${mono.variable} documents-page`}>
        <header className="documents-header">
          <div className="documents-brand">
            <span className="documents-brand-icon">
              <i className="ti ti-file-text" aria-hidden="true" />
            </span>
            <span className="documents-brand-text">Drawings & Documents</span>
          </div>
        </header>
        <GuestAccessGate />
      </main>
    );
  }

  return (
    <main className={`${display.variable} ${mono.variable} documents-page`}>
      <header className="documents-header">
        <div className="documents-brand">
          <span className="documents-brand-icon">
            <i className="ti ti-file-text" aria-hidden="true" />
          </span>
          <span className="documents-brand-text">Drawings & Documents</span>
        </div>
        <nav className="documents-nav">
          <Link href="/main/client" className="documents-nav-link">
            <i className="ti ti-arrow-left" aria-hidden="true" />
            <span>Back to Portal</span>
          </Link>
          <div className="documents-header-actions">
            <button
              className="btn-secondary"
              onClick={() => setShowBulkShare(true)}
              disabled={!membershipsLoaded}
            >
              <i className="ti ti-share" />
              Share
            </button>
            {isAdmin && (
              <button className="btn-secondary" onClick={() => setShowActivityLog(true)}>
                <i className="ti ti-history" />
                Activity
              </button>
            )}
            {canUpload && (
              <button
                className="btn-primary"
                onClick={() => {
                  setFormMode("create");
                  setEditingDocument(null);
                  setIsFormOpen(true);
                }}
              >
                <i className="ti ti-plus" />
                New Document
              </button>
            )}
            {selectedDoc?.permissions?.can_edit && (
              <button className="btn-secondary" disabled={isBusy} onClick={() => handleEditDocument(selectedDoc)}>
                <i className="ti ti-edit" />
                Edit
              </button>
            )}
            {selectedDoc?.permissions?.can_delete && (
              <button className="btn-danger" disabled={isBusy} onClick={() => handleDeleteDocument(selectedDoc)}>
                <i className="ti ti-trash" />
                Delete draft
              </button>
            )}
          </div>
          <span className="documents-role-badge">
            <i className="ti ti-file" aria-hidden="true" />
            {totalCount} Documents
          </span>
        </nav>
      </header>

      <div className="documents-hero">
        <p className="documents-eyebrow">Document Management</p>
        <h1 className="documents-title">Drawings & Documents</h1>
        <p className="documents-sub">
          Browse drawings by organisation, project, and deliverable — or search across all of them.
        </p>
      </div>

      <div className="documents-user-quick">
        <div className="documents-user-avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
        <div className="documents-user-info">
          <div className="documents-user-name">{currentUser.name}</div>
          <div className="documents-user-email">{currentUser.email}</div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {currentUser.hasDrawingPrivateAccess && (
            <span
              className="documents-role-badge"
              style={{ background: "#EEEDFE", color: "#3C3489" }}
            >
              <i className="ti ti-lock" />
              Private Access
            </span>
          )}
          <span
            className="documents-role-badge"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <i className="ti ti-eye" />
            {publicCount} Public
          </span>
          {privateCount > 0 && (
            <span
              className="documents-role-badge"
              style={{ background: "#FAECE7", color: "#712B13" }}
            >
              <i className="ti ti-lock" />
              {privateCount} Private
            </span>
          )}
        </div>
      </div>

      {actionMessage && (
        <div
          className="approval-panel approval-panel-rejected"
          style={{ marginBottom: 16, borderRadius: 4, border: "1px solid #F0C9C9" }}
          role="alert"
        >
          <div className="approval-panel-row">
            <span className="approval-panel-error" style={{ marginTop: 0 }}>
              <i className="ti ti-alert-circle" /> {actionMessage}
            </span>
            <button
              className="approval-btn approval-btn-ghost approval-btn-sm"
              onClick={() => setActionMessage(null)}
            >
              <i className="ti ti-x" /> Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="documents-controls">
        <div className="documents-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by title, tags, project, or deliverable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="documents-search-input"
          />
          {searchTerm && (
            <button
              className="documents-search-clear"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      </div>

      <div className="documents-privacy-filter">
        <button
          className={`documents-privacy-btn ${!showPrivateOnly ? "active" : ""}`}
          onClick={() => setShowPrivateOnly(false)}
        >
          <i className="ti ti-world" />
          All Documents
        </button>
        <button
          className={`documents-privacy-btn ${showPrivateOnly ? "active" : ""}`}
          onClick={() => setShowPrivateOnly(true)}
        >
          <i className="ti ti-lock" />
          Private Only
        </button>
        {canFilterByStatus && (
          <button
            className={`documents-privacy-btn ${mineOnly ? "active" : ""}`}
            onClick={() => setMineOnly((v) => !v)}
          >
            <i className="ti ti-user" />
            My uploads
          </button>
        )}
      </div>

      <div className="documents-filters">
        <div className="documents-filter-group">
          <label className="documents-filter-label">
            <i className="ti ti-building" /> Organisation
          </label>
          <select
            className="documents-filter-select"
            value={selectedOrgId ?? ""}
            onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Organisations</option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="documents-filter-group">
          <label className="documents-filter-label">
            <i className="ti ti-briefcase" /> Project
          </label>
          <select
            className="documents-filter-select"
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={selectedOrgId === undefined || projects.length === 0}
          >
            <option value="">
              {selectedOrgId === undefined ? "Select organisation first" : "All Projects"}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="documents-filter-group">
          <label className="documents-filter-label">
            <i className="ti ti-list-check" /> Deliverable
          </label>
          <select
            className="documents-filter-select"
            value={selectedDeliverableId ?? ""}
            onChange={(e) =>
              setSelectedDeliverableId(e.target.value ? Number(e.target.value) : undefined)
            }
            disabled={deliverables.length === 0}
          >
            <option value="">All Deliverables</option>
            {deliverables.map((deliverable) => (
              <option key={deliverable.id} value={deliverable.id}>
                {deliverable.name}
              </option>
            ))}
          </select>
        </div>
        {canFilterByStatus && (
          <div className="documents-filter-group">
            <label className="documents-filter-label">
              <i className="ti ti-flag" /> Status
            </label>
            <select
              className="documents-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as StatusView)}
            >
              <option value="published">Published</option>
              <option value="pending">Pending review</option>
              <option value="rejected">Rejected</option>
              <option value="draft">All drafts</option>
              <option value="archived">Archived</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        )}

        <div className="documents-filter-group" style={{ marginLeft: "auto" }}>
          <label className="documents-filter-label">
            <i className="ti ti-arrows-sort" /> Sort
          </label>
          <select
            className="documents-filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button className="documents-filter-clear" onClick={clearFilters}>
            <i className="ti ti-x" />
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="documents-loading">
          <i className="ti ti-loader" aria-hidden="true" />
          <p>Loading documents...</p>
        </div>
      ) : error ? (
        <div className="documents-error">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <p>{error}</p>
          <button onClick={() => loadDocuments()} className="documents-retry-btn">
            Retry
          </button>
        </div>
      ) : (
        <>
          {documents.length > 0 ? (
            <>
              <div className="documents-grid">
                {documents.map((doc) => {
                  const displayUrl = getDisplayFileUrl(doc);
                  const cardStatus = getCardStatus(doc);
                  const perms = doc.permissions;
                  return (
                    <div
                      key={doc.id}
                      className={`documents-card ${doc.is_private ? "documents-card-private" : ""} ${selectedDoc?.id === doc.id ? "documents-card-selected" : ""
                        }`}
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <div className="documents-card-thumbnail">
                        {doc.file_type === "pdf" ? (
                          <PdfThumbnail fileUrl={getFullFileUrl(doc.file_url)} />
                        ) : (
                          <>
                            {displayUrl ? (
                              <div className="documents-thumbnail-image-wrapper">
                                <Image
                                  src={displayUrl}
                                  alt={doc.title}
                                  fill
                                  className="documents-thumbnail-image"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  unoptimized={displayUrl.startsWith("data:")}
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    const parent = target.parentElement;
                                    if (parent) {
                                      const placeholder = parent.parentElement?.querySelector(
                                        ".documents-thumbnail-placeholder"
                                      );
                                      if (placeholder) {
                                        target.style.display = "none";
                                        placeholder.classList.remove("documents-thumbnail-hidden");
                                      }
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="documents-thumbnail-placeholder">
                                <i className={`ti ${getFileIcon(doc.file_type)}`} />
                              </div>
                            )}
                            <div className="documents-thumbnail-placeholder documents-thumbnail-hidden">
                              <i className={`ti ${getFileIcon(doc.file_type)}`} />
                            </div>
                          </>
                        )}
                        <div
                          className="documents-card-status"
                          style={{ background: cardStatus.color }}
                        >
                          {cardStatus.label}
                        </div>
                        {doc.is_private && (
                          <div className="documents-card-privacy-badge">
                            <i className="ti ti-lock" />
                          </div>
                        )}
                        <button
                          className="documents-card-favorite"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(doc.id);
                          }}
                          aria-label={doc.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <i className={`ti ${doc.is_favorite ? "ti-star-filled" : "ti-star"}`} />
                        </button>
                        <div className="documents-card-file-type">
                          {getFileTypeDisplay(doc.file_type)}
                        </div>
                      </div>

                      <div className="documents-card-content">
                        <div className="documents-card-breadcrumb">
                          {doc.organisation_name} <i className="ti ti-chevron-right" />{" "}
                          {doc.project_name} <i className="ti ti-chevron-right" />{" "}
                          {doc.deliverable_name}
                        </div>
                        <h3 className="documents-card-title">
                          {doc.title}
                          {doc.is_private && (
                            <span className="documents-card-private-label">
                              <i className="ti ti-lock" /> Private
                            </span>
                          )}
                        </h3>

                        {doc.review_state === "rejected" && (
                          <div className="documents-card-rejection">
                            <strong>Rejected</strong>
                            {doc.rejected_by_name ? ` by ${doc.rejected_by_name}` : ""}
                            {doc.rejection_reason ? ` — ${doc.rejection_reason}` : ""}
                          </div>
                        )}

                        <p className="documents-card-description">{doc.description}</p>

                        <div className="documents-card-meta">
                          <span className="documents-card-meta-item">
                            <i className="ti ti-tag" />
                            {doc.category}
                          </span>
                          <span className="documents-card-meta-item">
                            <i className="ti ti-calendar" />
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </span>
                          <span className="documents-card-meta-item">
                            <i className="ti ti-user" />
                            {doc.uploaded_by_name}
                          </span>
                          <span className="documents-card-meta-item">
                            <i className="ti ti-file" />
                            {getFileTypeDisplay(doc.file_type)}
                          </span>
                        </div>

                        <div className="documents-card-tags">
                          {doc.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="documents-card-tag">
                              #{tag}
                            </span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className="documents-card-tag-more">
                              +{doc.tags.length - 3} more
                            </span>
                          )}
                        </div>

                        {perms &&
                          (perms.can_approve ||
                            perms.can_reject ||
                            perms.can_edit ||
                            perms.can_delete ||
                            perms.can_archive ||
                            perms.can_restore) && (
                            <div className="documents-card-review-actions" aria-busy={isBusy}>
                              {perms.can_approve && (
                                <button
                                  className="approval-btn approval-btn-approve approval-btn-sm"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); handleQuickApprove(doc); }}
                                >
                                  {isBtnBusy(doc, "approve") ? <Spinner /> : <i className="ti ti-check" />}
                                  {isBtnBusy(doc, "approve")
                                    ? "Approving…"
                                    : doc.review_state === "rejected" ? "Re-approve" : "Approve"}
                                </button>
                              )}
                              {perms.can_reject && (
                                <button
                                  className="approval-btn approval-btn-reject approval-btn-sm"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); handleQuickReject(doc); }}
                                >
                                  {isBtnBusy(doc, "reject") ? <Spinner /> : <i className="ti ti-x" />}
                                  {isBtnBusy(doc, "reject") ? "Rejecting…" : "Reject"}
                                </button>
                              )}
                              {perms.can_edit && !(perms.can_approve && doc.status === "draft") && (
                                <button
                                  className="approval-btn approval-btn-sm"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); handleEditDocument(doc); }}
                                >
                                  <i className="ti ti-edit" />
                                  {doc.review_state === "rejected" ? "Edit & resubmit" : "Edit"}
                                </button>
                              )}
                              {perms.can_archive && (
                                <button
                                  className="approval-btn approval-btn-sm"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); handleQuickArchive(doc); }}
                                >
                                  {isBtnBusy(doc, "archive") ? <Spinner /> : <i className="ti ti-archive" />}
                                  {isBtnBusy(doc, "archive") ? "Archiving…" : "Archive"}
                                </button>
                              )}
                              {perms.can_restore && (
                                <button
                                  className="approval-btn approval-btn-sm"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); handleQuickRestore(doc); }}
                                >
                                  {isBtnBusy(doc, "restore") ? <Spinner /> : <i className="ti ti-arrow-back-up" />}
                                  {isBtnBusy(doc, "restore") ? "Restoring…" : "Restore"}
                                </button>
                              )}
                              {perms.can_delete && (
                                <button
                                  className="approval-btn approval-btn-reject approval-btn-sm"
                                  disabled={isBusy}
                                  onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }}
                                >
                                  {isBtnBusy(doc, "delete") ? <Spinner /> : <i className="ti ti-trash" />}
                                  {isBtnBusy(doc, "delete") ? "Deleting…" : "Delete"}
                                </button>
                              )}
                            </div>
                          )}

                        <div className="documents-card-actions">
                          <span className="documents-card-size">
                            <i className="ti ti-database" />
                            {formatFileSize(doc.size)}
                          </span>
                          <div className="documents-card-buttons">
                            <button
                              className="documents-card-btn documents-card-btn-view"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDocument(doc);
                              }}
                              disabled={isBusy || !canAccessDocument(doc, currentUser)}
                            >
                              <i className="ti ti-eye" />
                              View
                            </button>
                            <button
                              className="documents-card-btn documents-card-btn-download"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(doc);
                              }}
                              disabled={isBusy || !canAccessDocument(doc, currentUser)}
                            >
                              <i className="ti ti-download" />
                              Download
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="documents-pagination">
                  <div className="documents-pagination-info">
                    Showing {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                  </div>

                  <div className="documents-pagination-buttons">
                    <button
                      className="documents-pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <i className="ti ti-chevron-left" /> Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        className={`documents-pagination-btn ${page === currentPage ? "active" : ""
                          }`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      className="documents-pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next <i className="ti ti-chevron-right" />
                    </button>
                  </div>

                  <select
                    className="documents-page-size"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                </div>
              )}
            </>
          ) : (
            <div className="documents-empty">
              <i className="ti ti-folder-open" />
              <h3>No documents found</h3>
              <p>
                {searchTerm
                  ? `No documents match your search "${searchTerm}"`
                  : showPrivateOnly
                    ? "No private documents match the selected filters"
                    : "No documents match the selected filters"}
              </p>
              {canUpload && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setFormMode("create");
                    setEditingDocument(null);
                    setIsFormOpen(true);
                  }}
                  style={{ marginTop: "16px" }}
                >
                  <i className="ti ti-plus" />
                  Create your first document
                </button>
              )}
            </div>
          )}
        </>
      )}

      {selectedDoc && (
        <DocumentViewer
          document={selectedDoc}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onFavoriteToggle={handleToggleFavorite}
          onDownload={handleDownload}
          onDocumentChange={handleDocumentChanged}
        />
      )}

      <DocumentForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDocument(null);
        }}
        onSave={handleFormSave}
        document={editingDocument}
        title={formMode === "create" ? "Create New Document" : "Edit Document"}
        submitLabel={formMode === "create" ? "Create Document" : "Update Document"}
      />

      {/* Logged-in only: this whole return branch is unreachable for guests. */}
      <BulkShareModal
        open={showBulkShare}
        onClose={() => setShowBulkShare(false)}
        filters={{
          organisationId: selectedOrgId,
          projectId: selectedProjectId,
          deliverableId: selectedDeliverableId,
          search: searchTerm,
          showPrivate: showPrivateOnly,
          ordering: sortOrder === "newest" ? "-created_at" : "created_at",
          // Only approved (published) drawings can be shared.
          status: "published",
        }}
      />

      {isAdmin && (
        <ActivityLogModal
          open={showActivityLog}
          onClose={() => setShowActivityLog(false)}
          organisations={organisations}
          initialOrganisationId={selectedOrgId}
          focusDocument={selectedDoc ? { id: selectedDoc.id, title: selectedDoc.title } : null}
        />
      )}
    </main>
  );
}