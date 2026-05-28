"use client";

import Link from "next/link";

const sections = [
  {
    icon: "ti-briefcase",
    label: "My Projects",
    description: "View projects shared with you by your organisation.",
    href: "/new/dash/dashnormal",
    cta: "View projects",
  },
  {
    icon: "ti-file-description",
    label: "Deliverables",
    description: "Track the status of deliverables assigned or visible to you.",
    href: "/new/dash/dashnormal",
    cta: "View deliverables",
  },
  {
    icon: "ti-ruler-measure",
    label: "Area Calculator",
    description: "Use the area and cost estimation tool.",
    href: "/tools/areacalc",
    cta: "Open tool",
  },
];

export default function DashClientPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)" }}>

      {/* Header */}
      <header style={{
        background: "var(--color-background-primary)",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        padding: "0 2rem",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            width: "28px", height: "28px", borderRadius: "6px",
            background: "#712B13",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-user" style={{ color: "#FAECE7", fontSize: "15px" }} aria-hidden="true" />
          </span>
          <span style={{ fontWeight: 500, fontSize: "15px", letterSpacing: "-0.01em" }}>
            Client Portal
          </span>
        </div>
        <span style={{
          fontSize: "11px",
          padding: "3px 10px",
          borderRadius: "var(--border-radius-md)",
          background: "#FAECE7",
          color: "#712B13",
          fontWeight: 500,
        }}>
          Client access
        </span>
      </header>

      <main style={{ maxWidth: "640px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

        {/* Hero */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
            Client portal
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 500, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Your workspace
          </h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Access your project updates, deliverables, and tools below.
          </p>
        </div>

        {/* Section cards */}
        <div style={{ display: "grid", gap: "10px" }}>
          {sections.map((s) => (
            <div key={s.href + s.label} style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}>
              {/* Icon */}
              <div style={{
                width: "40px", height: "40px", flexShrink: 0,
                borderRadius: "var(--border-radius-md)",
                border: "0.5px solid var(--color-border-tertiary)",
                background: "var(--color-background-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`ti ${s.icon}`} style={{ fontSize: "19px" }} aria-hidden="true" />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 500, fontSize: "15px", margin: "0 0 3px" }}>{s.label}</p>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}>{s.description}</p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "34px", height: "34px",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                  }}
                  aria-label={`Open ${s.label} in new tab`}
                >
                  <i className="ti ti-external-link" style={{ fontSize: "15px" }} aria-hidden="true" />
                </a>
                <Link href={s.href} style={{
                  height: "34px", padding: "0 14px",
                  borderRadius: "var(--border-radius-md)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  color: "var(--color-text-primary)",
                  textDecoration: "none",
                  fontSize: "13px", fontWeight: 500,
                  display: "flex", alignItems: "center", gap: "5px",
                  background: "var(--color-background-primary)",
                }}>
                  {s.cta} <i className="ti ti-arrow-right" style={{ fontSize: "13px" }} aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Access note */}
        <div style={{
          marginTop: "2rem",
          padding: "14px 18px",
          borderRadius: "var(--border-radius-md)",
          background: "#FAECE7",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          fontSize: "13px",
          color: "#712B13",
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }} aria-hidden="true" />
          <span>
            You have client-level access. Some features may be restricted.
            Contact your project manager if you need additional permissions.
          </span>
        </div>

      </main>
    </div>
  );
}