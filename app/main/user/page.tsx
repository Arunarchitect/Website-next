"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const tiles = [
  {
    href: "/tools/areacalc",
    icon: "ti-ruler-measure",
    label: "Area Calculator",
    description: "Estimate construction costs by area",
    tag: "Tool",
  },
  {
    href: "/new/dash/dashnormal",
    icon: "ti-layout-dashboard",
    label: "My Dashboard",
    description: "Your projects and assigned deliverables",
    tag: "Dashboard",
  },
];

export default function MainUserPage() {
  const router = useRouter();

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
            background: "#085041",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-home" style={{ color: "#E1F5EE", fontSize: "15px" }} aria-hidden="true" />
          </span>
          <span style={{ fontWeight: 500, fontSize: "15px", letterSpacing: "-0.01em" }}>
            My Space
          </span>
        </div>
        <Link href="/new/dash/dashnormal" style={{
          fontSize: "13px",
          color: "var(--color-text-secondary)",
          textDecoration: "none",
          padding: "5px 12px",
          borderRadius: "var(--border-radius-md)",
          border: "0.5px solid var(--color-border-tertiary)",
        }}>
          <i className="ti ti-layout-dashboard" style={{ marginRight: "6px", fontSize: "14px", verticalAlign: "-2px" }} aria-hidden="true" />
          Dashboard
        </Link>
      </header>

      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

        {/* Hero */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
            Home
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 500, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Welcome
          </h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Access your tools and project overview from here.
          </p>
        </div>

        {/* Tiles */}
        <div style={{ display: "grid", gap: "10px" }}>
          {tiles.map((t) => (
            <div key={t.href} style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                <div style={{
                  width: "40px", height: "40px", flexShrink: 0,
                  borderRadius: "var(--border-radius-md)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  background: "var(--color-background-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${t.icon}`} style={{ fontSize: "19px" }} aria-hidden="true" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <span style={{ fontWeight: 500, fontSize: "15px" }}>{t.label}</span>
                    <span style={{
                      fontSize: "11px", padding: "2px 8px",
                      borderRadius: "var(--border-radius-md)",
                      background: "var(--color-background-secondary)",
                      color: "var(--color-text-secondary)",
                      fontWeight: 500,
                    }}>
                      {t.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}>
                    {t.description}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <a
                  href={t.href}
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
                  aria-label={`Open ${t.label} in new tab`}
                >
                  <i className="ti ti-external-link" style={{ fontSize: "15px" }} aria-hidden="true" />
                </a>
                <button
                  onClick={() => router.push(t.href)}
                  style={{
                    height: "34px", padding: "0 14px",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    background: "var(--color-background-primary)",
                    color: "var(--color-text-primary)",
                    fontSize: "13px", fontWeight: 500,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "5px",
                  }}
                >
                  Go <i className="ti ti-arrow-right" style={{ fontSize: "13px" }} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Help strip */}
        <div style={{
          marginTop: "2rem",
          padding: "14px 18px",
          borderRadius: "var(--border-radius-md)",
          border: "0.5px solid var(--color-border-tertiary)",
          background: "var(--color-background-secondary)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          color: "var(--color-text-secondary)",
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: "16px", flexShrink: 0 }} aria-hidden="true" />
          Need more access? Contact your organisation admin to update your role.
        </div>

      </main>
    </div>
  );
}