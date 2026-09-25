// app/drawing/components/ShareLinkModal.tsx
"use client";

import { useState } from "react";
import { createGuestLink, revokeGuestLink, buildGuestLinkUrl } from "../drawingApi";

interface ShareLinkModalProps {
  documentId: number;
  documentTitle: string;
  initialCode: string | null;
  onClose: () => void;
  onCodeChange: (code: string | null) => void;
}

export default function ShareLinkModal({
  documentId,
  documentTitle,
  initialCode,
  onClose,
  onCodeChange,
}: ShareLinkModalProps) {
  const [code, setCode] = useState<string | null>(initialCode);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = code ? buildGuestLinkUrl(code) : "";

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createGuestLink(documentId);
      setCode(result.guest_access_code);
      onCodeChange(result.guest_access_code);
    } catch (err) {
      console.error("Error creating guest link:", err);
      setError("Failed to create link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Revoke this link? Anyone holding it will lose access immediately.")) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await revokeGuestLink(documentId);
      setCode(null);
      onCodeChange(null);
    } catch (err) {
      console.error("Error revoking guest link:", err);
      setError("Failed to revoke link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div
      className="document-viewer-overlay"
      onClick={onClose}
      style={{ zIndex: 1100 }}
    >
      <div
        className="document-form-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px", padding: "24px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "4px",
          }}
        >
          <h3 style={{ margin: 0 }}>Share this drawing</h3>
          <button className="document-form-close" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "13px", margin: "0 0 16px" }}>
          {documentTitle}
        </p>

        <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
          Anyone with this link can view (and download, for non-DXF files)
          this one drawing — no login required. They won&apos;t see anything
          else in the project.
        </p>

        {error && (
          <div className="document-form-error" style={{ marginBottom: "12px" }}>
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}

        {code ? (
          <>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="form-input"
                style={{ flex: 1 }}
              />
              <button className="btn-secondary" onClick={handleCopy} disabled={loading}>
                <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button className="btn-danger" onClick={handleRevoke} disabled={loading}>
              <i className="ti ti-link-off" />
              {loading ? "Revoking..." : "Revoke link"}
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            <i className="ti ti-link" />
            {loading ? "Creating..." : "Create shareable link"}
          </button>
        )}
      </div>
    </div>
  );
}