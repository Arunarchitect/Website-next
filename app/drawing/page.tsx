// app/drawing/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  getOrganisations,
  getProjects,
  getDeliverables,
  getDocuments,
  toggleFavorite,
  downloadDocument,
} from "./drawingApi";
import { Organisation, Project, Deliverable, DrawingDocumentResolved } from "./types";
import DocumentViewer from "./components/DocumentViewer";
import PdfThumbnail from "./components/PdfThumbnail";
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

export default function DocumentsPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [documents, setDocuments] = useState<DrawingDocumentResolved[]>([]);

  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedDoc, setSelectedDoc] = useState<DrawingDocumentResolved | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrganisations().then(setOrganisations);
  }, []);

  useEffect(() => {
    getProjects(selectedOrgId).then(setProjects);
    setSelectedProjectId(undefined);
    setSelectedDeliverableId(undefined);
  }, [selectedOrgId]);

  useEffect(() => {
    getDeliverables(selectedProjectId).then(setDeliverables);
    setSelectedDeliverableId(undefined);
  }, [selectedProjectId]);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await getDocuments({
        organisationId: selectedOrgId,
        projectId: selectedProjectId,
        deliverableId: selectedDeliverableId,
        search: searchTerm,
      });
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId, selectedProjectId, selectedDeliverableId, searchTerm]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleViewDocument = (doc: DrawingDocumentResolved) => {
    setSelectedDoc(doc);
    setIsViewerOpen(true);
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      const newStatus = await toggleFavorite(id);
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, is_favorite: newStatus } : doc))
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleDownload = async (doc: DrawingDocumentResolved) => {
    try {
      await downloadDocument(doc);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string): string => {
    switch (fileType) {
      case 'pdf':
        return 'ti-file-pdf';
      case 'image':
        return 'ti-image';
      default:
        return 'ti-file';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'published':
        return '#0F6E56';
      case 'draft':
        return '#E67E22';
      case 'archived':
        return '#6E6B62';
      default:
        return '#6E6B62';
    }
  };

  const clearFilters = () => {
    setSelectedOrgId(undefined);
    setSelectedProjectId(undefined);
    setSelectedDeliverableId(undefined);
    setSearchTerm('');
  };

  const hasActiveFilters =
    selectedOrgId !== undefined ||
    selectedProjectId !== undefined ||
    selectedDeliverableId !== undefined ||
    searchTerm.trim() !== '';

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
          <span className="documents-role-badge">
            <i className="ti ti-file" aria-hidden="true" />
            {documents.length} Documents
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
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <i className="ti ti-x" />
            </button>
          )}
        </div>
      </div>

      <div className="documents-filters">
        <div className="documents-filter-group">
          <label className="documents-filter-label">
            <i className="ti ti-building" /> Organisation
          </label>
          <select
            className="documents-filter-select"
            value={selectedOrgId ?? ''}
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
            value={selectedProjectId ?? ''}
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
            value={selectedDeliverableId ?? ''}
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
            <div className="documents-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="documents-card">
                  <div className="documents-card-thumbnail">
                    {doc.file_type === 'pdf' ? (
                      <PdfThumbnail fileUrl={doc.file_url} />
                    ) : doc.thumbnail_url ? (
                      <>
                        <img
                          src={doc.thumbnail_url}
                          alt={doc.title}
                          className="documents-thumbnail-image"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            const placeholder = e.currentTarget.parentElement?.querySelector(
                              '.documents-thumbnail-placeholder'
                            );
                            placeholder?.classList.remove('documents-thumbnail-hidden');
                          }}
                        />
                        <div className="documents-thumbnail-placeholder documents-thumbnail-hidden">
                          <i className={`ti ${getFileIcon(doc.file_type)}`} />
                        </div>
                      </>
                    ) : (
                      <div className="documents-thumbnail-placeholder">
                        <i className={`ti ${getFileIcon(doc.file_type)}`} />
                      </div>
                    )}
                    <div className="documents-card-status" style={{ background: getStatusColor(doc.status) }}>
                      {doc.status}
                    </div>
                    <button
                      className="documents-card-favorite"
                      onClick={() => handleToggleFavorite(doc.id)}
                      aria-label={doc.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <i className={`ti ${doc.is_favorite ? 'ti-star-filled' : 'ti-star'}`} />
                    </button>
                  </div>

                  <div className="documents-card-content">
                    <div className="documents-card-breadcrumb">
                      {doc.organisation_name} <i className="ti ti-chevron-right" /> {doc.project_name}{" "}
                      <i className="ti ti-chevron-right" /> {doc.deliverable_name}
                    </div>
                    <h3 className="documents-card-title">{doc.title}</h3>
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
                        {doc.uploaded_by}
                      </span>
                    </div>

                    <div className="documents-card-tags">
                      {doc.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="documents-card-tag">
                          #{tag}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="documents-card-tag-more">+{doc.tags.length - 3} more</span>
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
                          onClick={() => handleViewDocument(doc)}
                        >
                          <i className="ti ti-eye" />
                          View
                        </button>
                        <button
                          className="documents-card-btn documents-card-btn-download"
                          onClick={() => handleDownload(doc)}
                        >
                          <i className="ti ti-download" />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="documents-empty">
              <i className="ti ti-folder-open" />
              <h3>No documents found</h3>
              <p>
                {searchTerm
                  ? `No documents match your search "${searchTerm}"`
                  : 'No documents match the selected filters'}
              </p>
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
    </main>
  );
}