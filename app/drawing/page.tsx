"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
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
import "./styles.css";

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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const [selectedDoc, setSelectedDoc] = useState<DrawingDocumentResolved | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingDocument, setEditingDocument] = useState<DrawingDocumentResolved | null>(null);

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

  useEffect(() => {
    if (!currentUser || isGuest) return;
    const loadProjects = async () => {
      try {
        const data = await getProjects(selectedOrgId);
        setProjects(data);
      } catch (err) {
        console.error("Error loading projects:", err);
        setError("Failed to load projects");
      }
    };
    loadProjects();
    setSelectedProjectId(undefined);
    setSelectedDeliverableId(undefined);
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
  }, [selectedOrgId, selectedProjectId, selectedDeliverableId, searchTerm, showPrivateOnly, pageSize, sortOrder]);

  const loadDocuments = useCallback(async () => {
    if (!currentUser || isGuest) return;

    try {
      setLoading(true);
      setError(null);

      const data = await getDocuments({
        organisationId: selectedOrgId,
        projectId: selectedProjectId,
        deliverableId: selectedDeliverableId,
        search: searchTerm,
        showPrivate: showPrivateOnly,
        page: currentPage,
        pageSize,
        ordering: sortOrder === "newest" ? "-created_at" : "created_at", 
      });

      setDocuments(data.results);
      setTotalCount(data.count);

      // Optional: exact privacy counts (fetches all; remove if too heavy)
      const all = await getDocuments({
        organisationId: selectedOrgId,
        projectId: selectedProjectId,
        deliverableId: selectedDeliverableId,
        search: searchTerm,
        page: 1,
        pageSize: 1000,
        ordering: sortOrder === "newest" ? "-created_at" : "created_at",  
      });
      const privCount = all.results.filter((d) => d.is_private).length;
      const pubCount = all.results.filter((d) => !d.is_private).length;
      setPrivateCount(privCount);
      setPublicCount(pubCount);
    } catch (err) {
      console.error("Error loading documents:", err);
      setError("Failed to load documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [
    selectedOrgId,
    selectedProjectId,
    selectedDeliverableId,
    searchTerm,
    showPrivateOnly,
    currentPage,
    pageSize,
    currentUser,
    isGuest,
    sortOrder,
  ]);

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

  const handleDeleteDocument = async (doc: DrawingDocumentResolved) => {
    if (!confirm(`Are you sure you want to delete "${doc.title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      setLoading(true);
      await deleteDocument(doc.id);
      await loadDocuments();
      setSelectedDoc(null);
    } catch (err: unknown) {
      console.error("Error deleting document:", err);
      setError(getErrorMessage(err) || "Failed to delete document");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSave = async (formData: FormData) => {
    try {
      if (formMode === "create") {
        await createDocument(formData);
      } else if (editingDocument) {
        await updateDocument(editingDocument.id, formData);
      }
      await loadDocuments();
      setIsFormOpen(false);
      setEditingDocument(null);
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "published":
        return "#0F6E56";
      case "draft":
        return "#E67E22";
      case "archived":
        return "#6E6B62";
      default:
        return "#6E6B62";
    }
  };

  const clearFilters = () => {
    setSelectedOrgId(undefined);
    setSelectedProjectId(undefined);
    setSelectedDeliverableId(undefined);
    setSearchTerm("");
    setShowPrivateOnly(false);
    setCurrentPage(1);
    setSortOrder("newest"); 
  };

  const hasActiveFilters =
    selectedOrgId !== undefined ||
    selectedProjectId !== undefined ||
    selectedDeliverableId !== undefined ||
    searchTerm.trim() !== "";

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
            {selectedDoc && (
              <>
                <button className="btn-secondary" onClick={() => handleEditDocument(selectedDoc)}>
                  <i className="ti ti-edit" />
                  Edit
                </button>
                <button className="btn-danger" onClick={() => handleDeleteDocument(selectedDoc)}>
                  <i className="ti ti-trash" />
                  Delete
                </button>
              </>
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
            disabled={projects.length === 0}
          >
            <option value="">All Projects</option>
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
          <button onClick={loadDocuments} className="documents-retry-btn">
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
                  return (
                    <div
                      key={doc.id}
                      className={`documents-card ${doc.is_private ? "documents-card-private" : ""} ${
                        selectedDoc?.id === doc.id ? "documents-card-selected" : ""
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
                          style={{ background: getStatusColor(doc.status) }}
                        >
                          {doc.status}
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
                              disabled={!canAccessDocument(doc, currentUser)}
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
                              disabled={!canAccessDocument(doc, currentUser)}
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
                        className={`documents-pagination-btn ${
                          page === currentPage ? "active" : ""
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
    </main>
  );
}