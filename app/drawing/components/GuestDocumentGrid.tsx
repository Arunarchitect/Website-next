// app/drawing/components/GuestDocumentGrid.tsx
"use client";

import { useState } from "react";
import Image from "next/image"; // Add this import
import { DrawingDocumentResolved } from "../types";
import { getFullFileUrl, getDisplayFileUrl } from "../drawingApi";
import { guestDownload } from "../guestApi";
import DocumentViewer from "./DocumentViewer";
import PdfThumbnail from "./PdfThumbnail";

const getFileTypeDisplay = (t: string) =>
  ({ pdf: 'PDF', dxf: 'DXF', ifc: 'IFC', image: 'Image' } as Record<string, string>)[t] || 'Document';

const formatFileSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// Get unique deliverables from documents
const getUniqueDeliverables = (docs: DrawingDocumentResolved[]) => {
  const deliverableMap = new Map<number, { id: number; name: string; count: number }>();
  docs.forEach(doc => {
    if (!deliverableMap.has(doc.deliverable_id)) {
      deliverableMap.set(doc.deliverable_id, {
        id: doc.deliverable_id,
        name: doc.deliverable_name,
        count: 1,
      });
    } else {
      const existing = deliverableMap.get(doc.deliverable_id)!;
      existing.count += 1;
    }
  });
  return Array.from(deliverableMap.values());
};

interface GuestDocumentGridProps {
  documents: DrawingDocumentResolved[];
  heading: string;
  showDeliverableFilter?: boolean;
}

export default function GuestDocumentGrid({ 
  documents, 
  heading,
  showDeliverableFilter = true,
}: GuestDocumentGridProps) {
  const [selectedDoc, setSelectedDoc] = useState<DrawingDocumentResolved | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number | null>(null);

  const deliverables = getUniqueDeliverables(documents);

  const filteredDocuments = selectedDeliverableId
    ? documents.filter(doc => doc.deliverable_id === selectedDeliverableId)
    : documents;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 className="documents-title" style={{ margin: 0 }}>{heading}</h1>
        <span style={{ color: '#6b7280', fontSize: '14px' }}>
          {filteredDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {showDeliverableFilter && deliverables.length > 1 && (
        <div className="documents-filters" style={{ marginBottom: '24px' }}>
          <div className="documents-filter-group">
            <label className="documents-filter-label">
              <i className="ti ti-list-check" /> Filter by Deliverable
            </label>
            <select
              className="documents-filter-select"
              value={selectedDeliverableId ?? ''}
              onChange={(e) => setSelectedDeliverableId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All Deliverables ({documents.length})</option>
              {deliverables.map((deliverable) => (
                <option key={deliverable.id} value={deliverable.id}>
                  {deliverable.name} ({deliverable.count})
                </option>
              ))}
            </select>
          </div>
          
          {selectedDeliverableId !== null && (
            <button
              className="documents-filter-clear"
              onClick={() => setSelectedDeliverableId(null)}
            >
              <i className="ti ti-x" />
              Clear filter
            </button>
          )}
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="documents-empty">
          <i className="ti ti-folder-open" />
          <h3>No documents in this deliverable</h3>
          <p>Try selecting a different deliverable from the filter above.</p>
          <button
            className="documents-retry-btn"
            onClick={() => setSelectedDeliverableId(null)}
            style={{ marginTop: '12px' }}
          >
            Show all documents
          </button>
        </div>
      ) : (
        <div className="documents-grid">
          {filteredDocuments.map((doc) => {
            const displayUrl = getDisplayFileUrl(doc);
            return (
              <div 
                key={doc.id} 
                className="documents-card" 
                onClick={() => { setSelectedDoc(doc); setIsViewerOpen(true); }}
              >
                <div className="documents-card-thumbnail">
                  {doc.file_type === 'pdf' ? (
                    <PdfThumbnail fileUrl={getFullFileUrl(doc.file_url)} />
                  ) : displayUrl ? (
                    <div className="documents-thumbnail-image-wrapper">
                      <Image
                        src={displayUrl}
                        alt={doc.title}
                        fill
                        className="documents-thumbnail-image"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        unoptimized={displayUrl.startsWith('data:')} // Skip optimization for data URLs
                      />
                    </div>
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
      )}

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