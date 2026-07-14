// app/proj/[code]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProjectGuestDocuments } from "@/app/drawing/guestApi";
import { DrawingDocumentResolved } from "@/app/drawing/types";
import GuestDocumentGrid from "@/app/drawing/components/GuestDocumentGrid";
import "@/app/drawing/styles.css";

export default function ProjectGuestPage() {
  const { code } = useParams<{ code: string }>();
  const [documents, setDocuments] = useState<DrawingDocumentResolved[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DrawingDocumentResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number | null>(null);
  
  // Get unique deliverables from documents
  const getUniqueDeliverables = (docs: DrawingDocumentResolved[]) => {
    const deliverableMap = new Map<number, { id: number; name: string }>();
    docs.forEach(doc => {
      if (!deliverableMap.has(doc.deliverable_id)) {
        deliverableMap.set(doc.deliverable_id, {
          id: doc.deliverable_id,
          name: doc.deliverable_name,
        });
      }
    });
    return Array.from(deliverableMap.values());
  };

  useEffect(() => {
    if (!code) return;
    
    getProjectGuestDocuments(code)
      .then((docs) => {
        setDocuments(docs);
        setFilteredDocuments(docs);
        // Reset deliverable filter when new docs load
        setSelectedDeliverableId(null);
      })
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [code]);

  // Filter documents when deliverable selection changes
  useEffect(() => {
    if (selectedDeliverableId === null) {
      setFilteredDocuments(documents);
    } else {
      setFilteredDocuments(documents.filter(doc => doc.deliverable_id === selectedDeliverableId));
    }
  }, [selectedDeliverableId, documents]);

  if (loading) return <main className="documents-page"><p>Loading shared drawings...</p></main>;
  if (error) return <main className="documents-page"><p>{error}</p></main>;

  const deliverables = getUniqueDeliverables(documents);

  return (
    <main className="documents-page">
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <h1 className="documents-title">Shared Project Drawings</h1>
        
        {/* Deliverable Filter */}
        {deliverables.length > 1 && (
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
                {deliverables.map((deliverable) => {
                  const count = documents.filter(d => d.deliverable_id === deliverable.id).length;
                  return (
                    <option key={deliverable.id} value={deliverable.id}>
                      {deliverable.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
            
            {/* Show current filter status */}
            {selectedDeliverableId !== null && (
              <button
                className="documents-filter-clear"
                onClick={() => setSelectedDeliverableId(null)}
                style={{ marginLeft: '8px' }}
              >
                <i className="ti ti-x" />
                Clear filter
              </button>
            )}
          </div>
        )}

        <GuestDocumentGrid 
          documents={filteredDocuments} 
          heading={`Showing ${filteredDocuments.length} drawing${filteredDocuments.length !== 1 ? 's' : ''}`}
        />
      </div>
    </main>
  );
}