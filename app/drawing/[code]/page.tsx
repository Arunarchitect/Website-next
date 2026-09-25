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
      .then((resolvedDoc) => {
        setDoc(resolvedDoc);
        // DXF has no in-browser preview — trigger the download immediately,
        // same behavior as clicking a DXF card in GuestDocumentGrid.
        if (resolvedDoc.file_type === 'dxf') {
          guestDownload(resolvedDoc);
        }
      })
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <main className="documents-page"><p>Loading...</p></main>;
  if (error || !doc) return <main className="documents-page"><p>{error || 'Drawing not found.'}</p></main>;

  if (doc.file_type === 'dxf') {
    return (
      <main className="documents-page">
        <div className="documents-empty">
          <i className="ti ti-file-type-xml" />
          <h3>{doc.title}</h3>
          <p>DXF files can`&apos;`t be previewed in the browser. Your download should have started automatically.</p>
          <button
            className="documents-retry-btn"
            onClick={() => guestDownload(doc)}
            style={{ marginTop: '12px' }}
          >
            <i className="ti ti-download" /> Download {doc.title}
          </button>
        </div>
      </main>
    );
  }

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