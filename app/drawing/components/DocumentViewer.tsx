// app/drawing/components/DocumentViewer.tsx
"use client";

import { useEffect, useState } from "react";
import { DrawingDocument } from "../../types";

interface DocumentViewerProps {
  document: DrawingDocument;
  isOpen: boolean;
  onClose: () => void;
  onFavoriteToggle: (id: number) => void;
  onDownload: (doc: DrawingDocument) => void;
}

export default function DocumentViewer({
  document,
  isOpen,
  onClose,
  onFavoriteToggle,
  onDownload
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
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

  const isPDF = document.file_type === 'pdf';
  const isImage = document.file_type === 'image';

  return (
    <div className="document-viewer-overlay" onClick={onClose}>
      <div 
        className="document-viewer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="document-viewer-header">
          <div className="document-viewer-title-section">
            <h2 className="document-viewer-title">{document.title}</h2>
            <span className="document-viewer-version">v{document.version}</span>
          </div>
          <div className="document-viewer-controls">
            <button
              className="document-viewer-btn"
              onClick={() => onFavoriteToggle(document.id)}
              aria-label={document.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <i className={`ti ${document.is_favorite ? 'ti-star-filled' : 'ti-star'}`} />
            </button>
            <button
              className="document-viewer-btn"
              onClick={() => onDownload(document)}
              aria-label="Download document"
            >
              <i className="ti ti-download" />
            </button>
            <button
              className="document-viewer-btn document-viewer-close"
              onClick={onClose}
              aria-label="Close viewer"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="document-viewer-content">
          {isLoading && (
            <div className="document-viewer-loading">
              <i className="ti ti-loader" />
              <p>Loading document...</p>
            </div>
          )}
          
          {isImage && (
            <div className="document-viewer-image-wrapper">
              <img
                src={document.file_url}
                alt={document.title}
                className="document-viewer-image"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            </div>
          )}
          
          {isPDF && (
            <div className="document-viewer-pdf-wrapper">
              <iframe
                src={`${document.file_url}#toolbar=1`}
                className="document-viewer-pdf"
                title={document.title}
                onLoad={() => setIsLoading(false)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="document-viewer-footer">
          <div className="document-viewer-footer-left">
            <span className="document-viewer-meta">
              <i className="ti ti-user" />
              {document.uploaded_by}
            </span>
            <span className="document-viewer-meta">
              <i className="ti ti-calendar" />
              {new Date(document.uploaded_at).toLocaleString()}
            </span>
            <span className="document-viewer-meta">
              <i className="ti ti-folder" />
              {document.category}
            </span>
          </div>
          <div className="document-viewer-footer-right">
            <span className="document-viewer-meta">
              <i className="ti ti-tag" />
              {document.tags.map((tag, idx) => (
                <span key={idx} className="document-viewer-tag">#{tag}</span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}