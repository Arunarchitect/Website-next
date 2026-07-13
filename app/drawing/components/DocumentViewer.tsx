// app/drawing/components/DocumentViewer.tsx
"use client";

import { useEffect, useState } from "react";
import { DrawingDocumentResolved } from "../types";
import { getFullFileUrl } from "../drawingApi";

interface DocumentViewerProps {
  document: DrawingDocumentResolved;
  isOpen: boolean;
  onClose: () => void;
  onFavoriteToggle: (id: number) => void;
  onDownload: (doc: DrawingDocumentResolved) => void;
}

export default function DocumentViewer({
  document: doc,
  isOpen,
  onClose,
  onFavoriteToggle,
  onDownload,
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [doc.id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isPDF = doc.file_type === 'pdf';
  const isImage = doc.file_type === 'image';
  const isDXF = doc.file_type === 'dxf';

  // For DXF files, we'll show a download prompt since browsers can't render them natively
  const renderDXFContent = () => {
    return (
      <div className="document-viewer-dxf-wrapper">
        <div className="document-viewer-dxf-content">
          <i className="ti ti-file-code" />
          <h3>DXF File</h3>
          <p>This is a CAD drawing file (DXF format).</p>
          <p className="document-viewer-dxf-hint">
            Download and open with CAD software like AutoCAD, DraftSight, or LibreCAD.
          </p>
          <button
            className="documents-card-btn documents-card-btn-view"
            onClick={() => onDownload(doc)}
            style={{ marginTop: '12px' }}
          >
            <i className="ti ti-download" />
            Download DXF File
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="document-viewer-overlay" onClick={onClose}>
      <div className="document-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="document-viewer-header">
          <div className="document-viewer-title-section">
            <h2 className="document-viewer-title">{doc.title}</h2>
            <span className="document-viewer-version">v{doc.version}</span>
            {doc.is_private && (
              <span className="document-viewer-privacy-badge">
                <i className="ti ti-lock" /> Private
              </span>
            )}
            <span className="document-viewer-file-type-badge">
              {doc.file_type.toUpperCase()}
            </span>
          </div>
          <div className="document-viewer-controls">
            <button className="document-viewer-btn" onClick={() => onFavoriteToggle(doc.id)} aria-label={doc.is_favorite ? 'Remove from favorites' : 'Add to favorites'}>
              <i className={`ti ${doc.is_favorite ? 'ti-star-filled' : 'ti-star'}`} />
            </button>
            <button className="document-viewer-btn" onClick={() => onDownload(doc)} aria-label="Download document">
              <i className="ti ti-download" />
            </button>
            {isPDF || isDXF ? (
              <a 
                className="document-viewer-btn" 
                href={getFullFileUrl(doc.file_url)} 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="Open in new tab"
              >
                <i className="ti ti-external-link" />
              </a>
            ) : null}
            <button className="document-viewer-btn document-viewer-close" onClick={onClose} aria-label="Close viewer">
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        {doc.description && (
          <div className="document-viewer-description">
            <p>{doc.description}</p>
          </div>
        )}

        <div className="document-viewer-content">
          {isLoading && !hasError && (
            <div className="document-viewer-loading">
              <i className="ti ti-loader" />
              <p>Loading document...</p>
            </div>
          )}

          {hasError && (
            <div className="document-viewer-loading document-viewer-error-state">
              <i className="ti ti-alert-triangle" />
              <p>Couldn&apos;t load this file.</p>
              <p className="document-viewer-error-path">{getFullFileUrl(doc.file_url)}</p>
              <p className="document-viewer-error-hint">
                Check the file exists at <code>{getFullFileUrl(doc.file_url)}</code>
              </p>
            </div>
          )}

          {isDXF && !hasError && renderDXFContent()}

          {isImage && !hasError && (
            <div className="document-viewer-image-wrapper">
              <img
                src={getFullFileUrl(doc.file_url)}
                alt={doc.title}
                className="document-viewer-image"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
                style={{ display: isLoading ? 'none' : 'block' }}
              />
            </div>
          )}

          {isPDF && !hasError && (
            <div className="document-viewer-pdf-wrapper">
              <object 
                data={`${getFullFileUrl(doc.file_url)}#toolbar=1`} 
                type="application/pdf" 
                className="document-viewer-pdf" 
                onLoad={() => setIsLoading(false)}
              >
                <div className="document-viewer-loading document-viewer-error-state">
                  <i className="ti ti-file-pdf" />
                  <p>Your browser can&apos;t preview PDFs inline.</p>
                  <a 
                    href={getFullFileUrl(doc.file_url)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="documents-retry-btn"
                  >
                    Open PDF in new tab
                  </a>
                </div>
              </object>
            </div>
          )}
        </div>

        <div className="document-viewer-footer">
          <div className="document-viewer-footer-left">
            <span className="document-viewer-meta">
              <i className="ti ti-building" />
              {doc.organisation_name}
            </span>
            <span className="document-viewer-meta">
              <i className="ti ti-briefcase" />
              {doc.project_name}
            </span>
            <span className="document-viewer-meta">
              <i className="ti ti-list-check" />
              {doc.deliverable_name}
            </span>
            <span className="document-viewer-meta">
              <i className="ti ti-user" />
              {doc.uploaded_by_name}
            </span>
            <span className="document-viewer-meta">
              <i className="ti ti-calendar" />
              {new Date(doc.uploaded_at).toLocaleString()}
            </span>
          </div>
          <div className="document-viewer-footer-right">
            <span className="document-viewer-meta">
              <i className="ti ti-tag" />
              {doc.tags.map((tag, idx) => (
                <span key={idx} className="document-viewer-tag">
                  #{tag}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}