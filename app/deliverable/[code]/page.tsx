// app/deliverable/[code]/page.tsx (create this if it doesn't exist)
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDeliverableGuestDocuments } from "@/app/drawing/guestApi";
import { DrawingDocumentResolved } from "@/app/drawing/types";
import GuestDocumentGrid from "@/app/drawing/components/GuestDocumentGrid";
import "@/app/drawing/styles.css";

export default function DeliverableGuestPage() {
  const { code } = useParams<{ code: string }>();
  const [documents, setDocuments] = useState<DrawingDocumentResolved[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getDeliverableGuestDocuments(code)
      .then(setDocuments)
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <main className="documents-page"><p>Loading shared drawings...</p></main>;
  if (error) return <main className="documents-page"><p>{error}</p></main>;
  
  // For deliverable-level access, we already know the deliverable
  // But we can still show a heading with deliverable info
  const deliverableName = documents.length > 0 ? documents[0].deliverable_name : 'Deliverable';
  
  return (
    <main className="documents-page">
      <GuestDocumentGrid 
        documents={documents} 
        heading={`${deliverableName} Drawings`} 
      />
    </main>
  );
}