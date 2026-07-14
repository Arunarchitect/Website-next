// app/drawing/components/GuestAccessGate.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveGuestAccessCode } from "../guestApi";

export default function GuestAccessGate() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await resolveGuestAccessCode(code);
      if (result.type === 'project') router.push(`/proj/${result.code}`);
      else if (result.type === 'deliverable') router.push(`/deliverable/${result.code}`);
      else router.push(`/drawing/${result.code}`);
    } catch (err: any) {
      setError(err.message || 'Failed to verify access code.');
      setLoading(false);
    }
  };

  return (
    <div className="documents-guest-gate">
      <div className="documents-guest-gate-card">
        <i className="ti ti-key" aria-hidden="true" />
        <h2>Enter your access code</h2>
        <p>
          If someone shared drawings with you, paste the access code or link
          code below to view them. No login required.
        </p>
        <form onSubmit={handleSubmit} className="documents-guest-gate-form">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            className="documents-guest-gate-input"
            autoFocus
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !code.trim()}>
            {loading ? (
              <>
                <i className="ti ti-loader" /> Checking...
              </>
            ) : (
              <>
                <i className="ti ti-arrow-right" /> View Drawings
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="documents-guest-gate-error">
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}
        <p className="documents-guest-gate-footer">
          Have an account? <a href="/login">Log in</a> instead.
        </p>
      </div>
    </div>
  );
}