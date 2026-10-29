// app/drawing/[code]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGuestDrawing, guestDownload } from "../guestApi";
import { DrawingDocumentResolved } from "../types";
import DocumentViewer from "../components/DocumentViewer";
import "../styles.css";

export default function GuestDrawingPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DrawingDocumentResolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    getGuestDrawing(code)
      .then((resolvedDoc) => {
        setDoc(resolvedDoc);
        // DXF has no in-browser preview, so start the download immediately.
        if (resolvedDoc.file_type === "dxf") {
          guestDownload(resolvedDoc);
        }
      })
      .catch(() => setError("This link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [code]);

  // Go back if there is a page to go back to, otherwise to the drawings home
  const handleClose = () => {
    if (window.history.length > 1) router.back();
    else router.push("/drawing");
  };

  if (loading) return <main className="documents-page"><p>Loading...</p></main>;
  if (error || !doc) return <main className="documents-page"><p>{error || "Drawing not found."}</p></main>;

  if (doc.file_type === "dxf") {
    return (
      <main className="documents-page">
        <div className="documents-empty">
          <i className="ti ti-file-type-xml" />
          <h3>{doc.title}</h3>
          <p>DXF files can&apos;t be previewed in the browser. Your download should have started automatically.</p>
          <button
            className="documents-retry-btn"
            onClick={() => guestDownload(doc)}
            style={{ marginTop: "12px" }}
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
        onClose={handleClose}
        onFavoriteToggle={() => {}}
        onDownload={guestDownload}
        guestMode
      />
    </main>
  );
}