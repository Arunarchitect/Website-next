// app/drawing/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { 
  getDocuments, 
  getDocumentCategories, 
  toggleFavorite,
  downloadDocument 
} from "../drawingApi";
import { getCurrentUser } from "../clientApi";
import { DrawingDocument, DocumentCategory, User } from "./types";
import DocumentViewer from "./components/DocumentViewer";
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
  const [documents, setDocuments] = useState<DrawingDocument[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<DrawingDocument | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [user, categoriesData, documentsData] = await Promise.all([
        getCurrentUser(),
        getDocumentCategories(),
        getDocuments(selectedCategory, searchTerm)
      ]);
      
      setCurrentUser(user);
      setCategories(categoriesData);
      setDocuments(documentsData);
      
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle document view
  const handleViewDocument = (doc: DrawingDocument) => {
    setSelectedDoc(doc);
    setIsViewerOpen(true);
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (id: number) => {
    try {
      const newStatus = await toggleFavorite(id);
      // Update local state
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === id ? { ...doc, is_favorite: newStatus } : doc
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Handle download
  const handleDownload = async (doc: DrawingDocument) => {
    try {
      await downloadDocument(doc);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Get file type icon
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

  // Get status badge color
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

  return (
    <main className={`${display.variable} ${mono.variable} documents-page`}>
      {/* Header */}
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

      {/* Hero */}
      <div className="documents-hero">
        <p className="documents-eyebrow">Document Management</p>
        <h1 className="documents-title">Drawings & Documents</h1>
        <p className="documents-sub">
          Access and manage all project drawings, schematics, and documentation.
        </p>
      </div>

      {/* User Profile Quick View */}
      {currentUser && (
        <div className="documents-user-quick">
          <div className="documents-user-avatar">
            {currentUser.full_name?.[0] || currentUser.email?.[0] || 'U'}
          </div>
          <div className="documents-user-info">
            <span className="documents-user-name">
              {currentUser.full_name || currentUser.email || 'User'}
            </span>
            <span className="documents-user-email">{currentUser.email}</span>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="documents-controls">
        <div className="documents-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search documents by title, description, or tags..."
            value={searchTerm}
            onChange={handleSearch}
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

      {/* Categories */}
      <div className="documents-categories">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`documents-category-btn ${
              selectedCategory === category.id ? 'active' : ''
            }`}
            onClick={() => handleCategorySelect(category.id)}
          >
            <i className={`ti ${category.icon}`} aria-hidden="true" />
            <span>{category.name}</span>
            <span className="documents-category-count">{category.count}</span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="documents-loading">
          <i className="ti ti-loader" aria-hidden="true" />
          <p>Loading documents...</p>
        </div>
      ) : error ? (
        <div className="documents-error">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <p>{error}</p>
          <button onClick={loadData} className="documents-retry-btn">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Document Grid */}
          {documents.length > 0 ? (
            <div className="documents-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="documents-card">
                  <div className="documents-card-thumbnail">
                    {doc.thumbnail_url ? (
                      <img
                        src={doc.thumbnail_url}
                        alt={doc.title}
                        className="documents-thumbnail-image"
                      />
                    ) : (
                      <div className="documents-thumbnail-placeholder">
                        <i className={`ti ${getFileIcon(doc.file_type)}`} />
                      </div>
                    )}
                    <div className="documents-card-status" style={{
                      background: getStatusColor(doc.status),
                    }}>
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
                  : 'No documents available in this category'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Document Viewer Modal */}
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