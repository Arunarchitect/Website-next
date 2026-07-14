// app/drawing/components/GuestDocumentGrid.tsx
"use client";

import { useState } from "react";
import { DrawingDocumentResolved } from "../types";
import { getFullFileUrl, getDisplayFileUrl } from "../drawingApi";
import { guestDownload } from "../guestApi";
import DocumentViewer from "./DocumentViewer";
import PdfThumbnail from "./PdfThumbnail";

const getFileTypeDisplay = (t: string) =>
  ({ pdf: 'PDF', dxf: 'DXF', ifc: 'IFC', image: 'Image' } as Record<string, string>)[t] || 'Document';

const formatFileSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

export default function GuestDocumentGrid({
  documents, heading,
}: { documents: DrawingDocumentResolved[]; heading: string }) {
  const [selectedDoc, setSelectedDoc] = useState<DrawingDocumentResolved | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  if (documents.length === 0) {
    return (
      <div className="documents-empty">
        <i className="ti ti-folder-open" />
        <h3>No documents available</h3>
        <p>There are no published drawings to show for this link.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="documents-title">{heading}</h1>
      <div className="documents-grid">
        {documents.map((doc) => {
          const displayUrl = getDisplayFileUrl(doc);
          return (
            <div key={doc.id} className="documents-card" onClick={() => { setSelectedDoc(doc); setIsViewerOpen(true); }}>
              <div className="documents-card-thumbnail">
                {doc.file_type === 'pdf' ? (
                  <PdfThumbnail fileUrl={getFullFileUrl(doc.file_url)} />
                ) : displayUrl ? (
                  <img src={displayUrl} alt={doc.title} className="documents-thumbnail-image" />
                ) : (
                  <div className="documents-thumbnail-placeholder"><i className="ti ti-file" /></div>
                )}
                <div className="documents-card-file-type">{getFileTypeDisplay(doc.file_type)}</div>
              </div>
              <div className="documents-card-content">
                <div className="documents-card-breadcrumb">
                  {doc.organisation_name} <i className="ti ti-chevron-right" /> {doc.project_name}{" "}
                  <i className="ti ti-chevron-right" /> {doc.deliverable_name}
                </div>
                <h3 className="documents-card-title">{doc.title}</h3>
                <p className="documents-card-description">{doc.description}</p>
                <div className="documents-card-actions">
                  <span className="documents-card-size"><i className="ti ti-database" />{formatFileSize(doc.size)}</span>
                  <button
                    className="documents-card-btn documents-card-btn-download"
                    onClick={(e) => { e.stopPropagation(); guestDownload(doc); }}
                  >
                    <i className="ti ti-download" /> Download
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedDoc && (
        <DocumentViewer
          document={selectedDoc}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onFavoriteToggle={() => {}}
          onDownload={guestDownload}
          guestMode
        />
      )}
    </>
  );
}