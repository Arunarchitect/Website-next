"use client";

import { useState, FormEvent } from "react";

type VerifyResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; courseTitle: string; holderName?: string; issuedDate?: string }
  | { status: "invalid" }
  | { status: "error" };

export default function CertificateVerifier() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerifyResult>({ status: "idle" });
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setResult({ status: "loading" });
    try {
      // Point this at the real Django endpoint, e.g. /api/certificates/verify/?code=...
      const res = await fetch(`/api/certificates/verify/?code=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setResult({ status: "invalid" });
        return;
      }
      const data = await res.json();
      if (data?.valid) {
        setResult({
          status: "valid",
          courseTitle: data.courseTitle,
          holderName: data.holderName,
          issuedDate: data.issuedDate,
        });
      } else {
        setResult({ status: "invalid" });
      }
    } catch {
      setResult({ status: "error" });
    }
  }

  return (
    <section className="cert-panel">
      <style>{`
        .cert-panel {
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 2px 22px 2px;
          background: #fff;
          position: relative;
          width: 100%;
        }
        .cert-panel::before,
        .cert-panel::after {
          content: "";
          position: absolute;
          width: 14px;
          height: 2px;
          border: 1.5px solid var(--blue);
          opacity: 0.45;
        }
        .cert-panel::before { top: 8px; left: 8px; border-right: none; border-bottom: none; }
        .cert-panel::after { bottom: 8px; right: 8px; border-left: none; border-top: none; }

        .cert-toggle {
          display: none;
          width: 100%;
          align-items: center;
          justify-content: space-between;
          gap: 2px;
          background: none;
          border: none;
          padding: 0;
          font-family: var(--font-mono), monospace;
          font-size: 0.82rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--blue);
          cursor: pointer;
        }
        .cert-chevron {
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .cert-toggle[aria-expanded="true"] .cert-chevron {
          transform: rotate(180deg);
        }
        .cert-collapsible {
          display: grid;
          grid-template-rows: 1fr;
          transition: grid-template-rows 0.22s ease;
        }
        .cert-collapsible-inner {
          overflow: hidden;
        }

        @media (max-width: 780px) {
          .cert-panel { padding: 2px 18px; }
          .cert-toggle { display: flex; }
          .cert-collapsible { grid-template-rows: 0fr; }
          .cert-collapsible.open { grid-template-rows: 1fr; }
          .cert-collapsible-inner { padding-top: 16px; }
        }

        .cert-label {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.12em;
          color: var(--blue);
          margin: 0 0 4px;
        }
        .cert-heading {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 1.02rem;
          margin: 0 0 4px;
        }
        .cert-hint {
          font-size: 0.82rem;
          color: var(--slate);
          margin: 0 0 16px;
          line-height: 1.5;
        }
        .cert-form {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cert-input {
          flex: 1 1 240px;
          font-family: var(--font-mono), monospace;
          font-size: 0.9rem;
          letter-spacing: 0.03em;
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 3px;
          background: var(--paper);
          color: var(--ink);
        }
        .cert-input:focus {
          outline: none;
          border-color: var(--blue);
        }
        .cert-button {
          font-family: var(--font-mono), monospace;
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 10px 20px;
          background: var(--blue);
          color: #fff;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .cert-button:hover { background: var(--blue-deep); }
        .cert-button:disabled { opacity: 0.6; cursor: default; }

        .cert-result { margin-top: 18px; }
        .cert-status-line {
          font-family: var(--font-mono), monospace;
          font-size: 0.82rem;
          color: var(--slate);
        }
        .cert-stamp {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          border: 2px dashed;
          border-radius: 50%;
          width: 108px;
          height: 108px;
          justify-content: center;
          transform: rotate(-6deg);
          font-family: var(--font-display), sans-serif;
        }
        .cert-stamp.valid { border-color: #2f7a4f; color: #2f7a4f; }
        .cert-stamp.invalid { border-color: #b8433a; color: #b8433a; }
        .cert-stamp-word {
          font-weight: 700;
          font-size: 0.95rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .cert-detail {
          font-family: var(--font-mono), monospace;
          font-size: 0.78rem;
          color: var(--slate);
          margin-top: 12px;
          line-height: 1.6;
        }
        .cert-detail strong {
          color: var(--ink);
          font-weight: 500;
        }
      `}</style>

      <button
        type="button"
        className="cert-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Verify certificate</span>
        <svg className="cert-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`cert-collapsible${open ? " open" : ""}`}>
        <div className="cert-collapsible-inner">
          <p className="cert-label">Verify a certificate</p>
          <h2 className="cert-heading">Check a certificate number</h2>
          <p className="cert-hint">Enter the code printed on any certificate issued by Modelflick to confirm it&apos;s genuine.</p>

          <form className="cert-form" onSubmit={handleSubmit}>
            <input
              className="cert-input"
              type="text"
              placeholder="e.g. MF-2024-00231"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Certificate number"
            />
            <button className="cert-button" type="submit" disabled={result.status === "loading"}>
              {result.status === "loading" ? "Checking…" : "Verify"}
            </button>
          </form>

          <div className="cert-result">
            {result.status === "valid" && (
              <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
                <div className="cert-stamp valid">
                  <span className="cert-stamp-word">Verified</span>
                </div>
                <div className="cert-detail">
                  <strong>{result.courseTitle}</strong>
                  {result.holderName && <><br />Issued to {result.holderName}</>}
                  {result.issuedDate && <><br />Issued {result.issuedDate}</>}
                </div>
              </div>
            )}

            {result.status === "invalid" && (
              <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
                <div className="cert-stamp invalid">
                  <span className="cert-stamp-word">Not found</span>
                </div>
                <p className="cert-detail">No certificate matches that number. Check for typos and try again.</p>
              </div>
            )}

            {result.status === "error" && (
              <p className="cert-status-line">Couldn&apos;t reach the verification service. Try again.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}