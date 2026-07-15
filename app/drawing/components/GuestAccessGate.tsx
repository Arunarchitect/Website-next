// app/drawing/components/GuestAccessGate.tsx
"use client";

import { useState } from "react";
import GuestDocumentGrid from "./GuestDocumentGrid";
import { resolveGuestAccessCode, getDeliverableGuestDocuments, getProjectGuestDocuments, getGuestDrawing } from "../guestApi";
import { DrawingDocumentResolved } from "../types";

// Define a custom error type
type ApiError = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

export default function GuestAccessGate() {
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DrawingDocumentResolved[] | null>(null);
  const [heading, setHeading] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setError("Please enter an access code.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await resolveGuestAccessCode(accessCode.trim());
      
      let docs: DrawingDocumentResolved[] = [];
      let headingText = "";

      switch (result.type) {
        case 'project':
          docs = await getProjectGuestDocuments(result.code);
          headingText = `Project Documents`;
          break;
        case 'deliverable':
          docs = await getDeliverableGuestDocuments(result.code);
          headingText = `Deliverable Documents`;
          break;
        case 'drawing':
          const drawing = await getGuestDrawing(result.code);
          docs = [drawing];
          headingText = `Drawing`;
          break;
      }

      if (docs.length === 0) {
        setError("No documents found for this access code.");
        return;
      }

      setDocuments(docs);
      setHeading(headingText);
    } catch (err: unknown) {
      // Properly type the error
      const errorMessage = getErrorMessage(err);
      setError(errorMessage || "Invalid access code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract error message
  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
      return err.message;
    }
    
    // Handle axios-like error objects
    if (typeof err === 'object' && err !== null) {
      const apiError = err as ApiError;
      if (apiError.response?.data?.message) {
        return apiError.response.data.message;
      }
      if (apiError.message) {
        return apiError.message;
      }
    }
    
    // Handle string errors
    if (typeof err === 'string') {
      return err;
    }
    
    return "An unexpected error occurred";
  };

  // If documents are loaded, show the grid
  if (documents) {
    return <GuestDocumentGrid documents={documents} heading={heading} />;
  }

  // Otherwise show the access code form
  return (
    <div className="guest-access-container">
      <div className="guest-access-card">
        <div className="guest-access-icon">
          <i className="ti ti-lock-open" />
        </div>
        <h2 className="guest-access-title">Access Shared Drawings</h2>
        <p className="guest-access-description">
          Enter the access code provided to you to view shared drawings and documents.
        </p>

        <form onSubmit={handleSubmit} className="guest-access-form">
          <div className="guest-access-input-group">
            <i className="ti ti-key" />
            <input
              type="text"
              placeholder="Enter access code (e.g., ABC123)"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              className="guest-access-input"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="guest-access-error">
              <i className="ti ti-alert-circle" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="guest-access-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="ti ti-loader" />
                Checking access...
              </>
            ) : (
              <>
                <i className="ti ti-arrow-right" />
                View Documents
              </>
            )}
          </button>
        </form>

        <p className="guest-access-hint">
          The access code is usually shared via email or the project dashboard.
        </p>
      </div>
    </div>
  );
}