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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getProjectGuestDocuments(code)
      .then(setDocuments)
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <main className="documents-page"><p>Loading shared drawings...</p></main>;
  if (error) return <main className="documents-page"><p>{error}</p></main>;
  return <main className="documents-page"><GuestDocumentGrid documents={documents} heading="Shared Project Drawings" /></main>;
}