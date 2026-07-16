// app/drawing/components/DocumentViewer.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { DrawingDocumentResolved } from "../types";
import { getFullFileUrl } from "../drawingApi";

// Point react-pdf's worker at a CDN build matching the installed version.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  document: DrawingDocumentResolved;
  isOpen: boolean;
  onClose: () => void;
  onFavoriteToggle: (id: number) => void;
  onDownload: (doc: DrawingDocumentResolved) => void;
  guestMode?: boolean;
}

export default function DocumentViewer({
  document: doc,
  isOpen,
  onClose,
  onFavoriteToggle,
  onDownload,
  guestMode = false,
}: DocumentViewerProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // PDF rendering state — all pages render in a continuous scroll,
  // matching the scroll behavior of the native <object> viewer.
  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const isPDF = doc.file_type === 'pdf';
  const isImage = doc.file_type === 'image';
  const isDXF = doc.file_type === 'dxf';

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorDetail(null);
    setBlobUrl(null);
    setNumPages(0);

    if (!isPDF && !isImage) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    const sourceUrl = getFullFileUrl(doc.file_url);

    fetch(sourceUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded ${res.status} ${res.statusText}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error fetching document for preview:', err);
        setErrorDetail(err?.message || 'Unknown error');
        setHasError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, doc.file_url, isPDF, isImage]);

  // Track available width for the PDF page so it scales to fit on mobile
  useEffect(() => {
    if (!isPDF || !isOpen) return;
    const el = document.querySelector('.document-viewer-pdf-wrapper');
    if (!el) return;

    const update = () => setContainerWidth(el.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPDF, isOpen, blobUrl]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const renderDXFContent = () => (
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
            {(isPDF || isDXF) && (
              <a
                className="document-viewer-btn document-viewer-btn-labeled"
                href={getFullFileUrl(doc.file_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ti ti-external-link" />
                Open in new tab & download
              </a>
            )}
            <button
              className="document-viewer-btn document-viewer-btn-labeled document-viewer-close"
              onClick={onClose}
            >
              <i className="ti ti-x" />
              Close
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
              <p>Couldn&apos;t load a preview of this file.</p>
              {errorDetail && <p className="document-viewer-error-hint">{errorDetail}</p>}
              <a
                href={getFullFileUrl(doc.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="documents-retry-btn"
              >
                Open file in new tab instead
              </a>
            </div>
          )}

          {isDXF && !hasError && renderDXFContent()}

          {isImage && !hasError && !isLoading && blobUrl && (
            <div className="document-viewer-image-wrapper">
              <Image
                src={blobUrl}
                alt={doc.title}
                className="document-viewer-image"
                fill
                unoptimized
                style={{ objectFit: 'contain' }}
                onError={() => {
                  setHasError(true);
                  setErrorDetail('Fetched the file but the browser could not render it as an image.');
                }}
              />
            </div>
          )}

          {isPDF && !hasError && !isLoading && blobUrl && (
            <div
              className="document-viewer-pdf-wrapper"
              style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Document
                file={blobUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={(err) => {
                  console.error('react-pdf load error:', err);
                  setHasError(true);
                  setErrorDetail('This PDF could not be rendered.');
                }}
                loading={
                  <div className="document-viewer-loading">
                    <i className="ti ti-loader" />
                    <p>Rendering PDF...</p>
                  </div>
                }
              >
                {/* Render every page stacked vertically so the whole document
                    scrolls continuously, like the native browser PDF viewer. */}
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div
                    key={pageNum}
                    className="document-viewer-pdf-page"
                    style={{ marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={containerWidth > 0 ? containerWidth : undefined}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  </div>
                ))}
              </Document>
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