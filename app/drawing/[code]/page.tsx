// app/drawing/[code]/page.tsx  (coexists fine with app/drawing/page.tsx)
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getGuestDrawing, guestDownload } from "../guestApi";
import { DrawingDocumentResolved } from "../types";
import DocumentViewer from "../components/DocumentViewer";
import "../styles.css";

export default function GuestDrawingPage() {
  const { code } = useParams<{ code: string }>();
  const [doc, setDoc] = useState<DrawingDocumentResolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getGuestDrawing(code)
      .then(setDoc)
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <main className="documents-page"><p>Loading...</p></main>;
  if (error || !doc) return <main className="documents-page"><p>{error || 'Drawing not found.'}</p></main>;

  return (
    <main className="documents-page">
      <DocumentViewer
        document={doc}
        isOpen={true}
        onClose={() => {}}
        onFavoriteToggle={() => {}}
        onDownload={guestDownload}
        guestMode
      />
    </main>
  );
}