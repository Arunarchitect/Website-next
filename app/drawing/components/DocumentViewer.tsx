// app/drawing/components/DocumentViewer.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.25;

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
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const pdfWrapperRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Editable zoom percentage input — kept as a local string buffer so
  // typing doesn't fight the displayed zoom on every keystroke.
  const [zoomInputValue, setZoomInputValue] = useState<string>('100');

  const isPDF = doc.file_type === 'pdf';
  const isImage = doc.file_type === 'image';
  const isDXF = doc.file_type === 'dxf';

  // Memoized so these can safely be listed as effect dependencies without
  // causing the wheel/keydown effect to re-subscribe on every render.
  const clampZoom = useCallback(
    (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    []
  );
  const zoomIn = useCallback(
    () => setZoom((z) => clampZoom(+(z + ZOOM_STEP).toFixed(2))),
    [clampZoom]
  );
  const zoomOut = useCallback(
    () => setZoom((z) => clampZoom(+(z - ZOOM_STEP).toFixed(2))),
    [clampZoom]
  );
  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    setZoomInputValue(String(Math.round(zoom * 100)));
  }, [zoom]);

  const commitZoomInput = () => {
    const val = parseInt(zoomInputValue, 10);
    if (!isNaN(val)) {
      setZoom(clampZoom(val / 100));
    } else {
      setZoomInputValue(String(Math.round(zoom * 100)));
    }
  };

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (/^\d{0,3}$/.test(raw)) setZoomInputValue(raw);
  };

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitZoomInput();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handlePrint = () => {
    if (!blobUrl) return;

    // Print via a hidden iframe so we get the browser's native print dialog
    // scoped to just this document, instead of printing the whole page.
    const iframe = window.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.src = blobUrl;

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print failed:', err);
      }
    };

    window.document.body.appendChild(iframe);

    // Clean up the iframe a bit after the print dialog would have been
    // triggered — long enough for the user to interact with it first.
    setTimeout(() => {
      iframe.remove();
    }, 60000);
  };

  const handleFavoriteClick = () => {
    // Guests have no account to persist favorites against, so this control
    // is hidden entirely for them (see guestMode check in the render below).
    onFavoriteToggle(doc.id);
  };

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorDetail(null);
    setBlobUrl(null);
    setNumPages(0);
    setZoom(1);

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

  // Ctrl/Cmd + scroll to zoom, and +/- keys
  useEffect(() => {
    if (!isPDF || !isOpen) return;
    const el = pdfWrapperRef.current;

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut(); }
      else if (e.key === '0') { e.preventDefault(); zoomReset(); }
    };

    el?.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeydown);
    return () => {
      el?.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [isPDF, isOpen, blobUrl, zoomIn, zoomOut, zoomReset]);

  // Drag-to-pan when zoomed in past 100% (only meaningful once content
  // overflows the wrapper, but harmless to wire up regardless of zoom level)
  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = pdfWrapperRef.current;
    if (!el || zoom <= 1) return;
    // Ignore drags starting on interactive elements (links, buttons, text selection in the PDF)
    const target = e.target as HTMLElement;
    if (target.closest('a, button')) return;

    panStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;
    const el = pdfWrapperRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (!el || !panStateRef.current) return;
      const dx = e.clientX - panStateRef.current.startX;
      const dy = e.clientY - panStateRef.current.startY;
      el.scrollLeft = panStateRef.current.scrollLeft - dx;
      el.scrollTop = panStateRef.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
      panStateRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

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
            {!guestMode && (
              <button
                className="document-viewer-btn document-viewer-btn-labeled document-viewer-btn-favorite"
                onClick={handleFavoriteClick}
                title="Toggle favorite"
                aria-label="Toggle favorite"
              >
                <i className="ti ti-star" />
                <span className="document-viewer-btn-label">Favorite</span>
              </button>
            )}
            {isPDF && !hasError && !isLoading && blobUrl && (
              <div className="document-viewer-zoom-controls">
                <button
                  className="document-viewer-btn document-viewer-zoom-glyph"
                  onClick={zoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  title="Zoom out (-)"
                  aria-label="Zoom out"
                >
                  &minus;
                </button>
                <div className="document-viewer-zoom-input-wrapper">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="document-viewer-zoom-input"
                    value={zoomInputValue}
                    onChange={handleZoomInputChange}
                    onKeyDown={handleZoomInputKeyDown}
                    onBlur={commitZoomInput}
                    onFocus={(e) => e.target.select()}
                    title="Type a zoom percentage, press Enter"
                    aria-label="Zoom percentage"
                  />
                  <span className="document-viewer-zoom-suffix">%</span>
                </div>
                <button
                  className="document-viewer-btn document-viewer-zoom-glyph"
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  title="Zoom in (+)"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            )}
            {(isPDF || isImage) && !hasError && !isLoading && blobUrl && (
              <button
                className="document-viewer-btn document-viewer-btn-labeled document-viewer-btn-print"
                onClick={handlePrint}
                title="Print document"
              >
                <i className="ti ti-printer" />
                <span className="document-viewer-btn-label">Print</span>
              </button>
            )}
            {(isPDF || isDXF) && (
              <a
                className="document-viewer-btn document-viewer-btn-labeled document-viewer-btn-open"
                href={getFullFileUrl(doc.file_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ti ti-external-link" />
                <span className="document-viewer-btn-label">Open in new tab &amp; download</span>
              </a>
            )}
            <button
              className="document-viewer-btn document-viewer-btn-labeled document-viewer-close"
              onClick={onClose}
            >
              <i className="ti ti-x" />
              <span className="document-viewer-btn-label">Close</span>
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
              ref={pdfWrapperRef}
              className="document-viewer-pdf-wrapper"
              onMouseDown={handlePanMouseDown}
              style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: zoom > 1 ? 'flex-start' : 'center',
                gap: '12px',
                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
                userSelect: isPanning ? 'none' : 'auto',
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
                      width={containerWidth > 0 ? containerWidth * zoom : undefined}
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