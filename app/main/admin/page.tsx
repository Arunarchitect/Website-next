"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const tools = [
  {
    key: "areacalc",
    href: "/tools/areacalc",
    icon: "ti-ruler-measure",
    label: "Area Calculator",
    description: "Survey rates, place management, space templates",
    tag: "Areacalc",
    tagColor: "teal",
    external: false,
  },
  {
    key: "dashadmin",
    href: "/new/dash/dashadmin",
    icon: "ti-layout-dashboard",
    label: "Organisation Dashboard",
    description: "Projects, deliverables, team members, work logs",
    tag: "Org Admin",
    tagColor: "purple",
    external: false,
  },
];

const stats = [
  { label: "Apps connected", value: "2", icon: "ti-apps" },
  { label: "Your role", value: "Admin", icon: "ti-shield-check" },
  { label: "Access level", value: "Full", icon: "ti-key" },
];

export default function MainAdminPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)" }}>

      {/* Top bar */}
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
            background: "#3C3489",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ti ti-command" style={{ color: "#EEEDFE", fontSize: "15px" }} aria-hidden="true" />
          </span>
          <span style={{ fontWeight: 500, fontSize: "15px", letterSpacing: "-0.01em" }}>
            Admin Hub
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/new/dash/dashadmin" style={{
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
          <Link href="/tools/areacalc" style={{
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            padding: "5px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
          }}>
            <i className="ti ti-ruler-measure" style={{ marginRight: "6px", fontSize: "14px", verticalAlign: "-2px" }} aria-hidden="true" />
            Areacalc
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

        {/* Hero */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
            Admin Hub
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 500, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            You have full admin access across all connected applications.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "2rem" }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: "18px", color: "var(--color-text-secondary)" }} aria-hidden="true" />
              <div>
                <p style={{ fontSize: "11px", color: "var(--color-text-tertiary)", margin: "0 0 2px" }}>{s.label}</p>
                <p style={{ fontSize: "16px", fontWeight: 500, margin: 0 }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tool cards */}
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>
          Applications
        </p>
        <div style={{ display: "grid", gap: "10px" }}>
          {tools.map((t) => (
            <div key={t.key} style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}>
              {/* Left */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
                <div style={{
                  width: "42px", height: "42px", flexShrink: 0,
                  borderRadius: "var(--border-radius-md)",
                  border: "0.5px solid var(--color-border-tertiary)",
                  background: "var(--color-background-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`ti ${t.icon}`} style={{ fontSize: "20px", color: "var(--color-text-primary)" }} aria-hidden="true" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <span style={{ fontWeight: 500, fontSize: "15px" }}>{t.label}</span>
                    <span style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "var(--border-radius-md)",
                      background: t.tagColor === "teal" ? "#E1F5EE" : "#EEEDFE",
                      color: t.tagColor === "teal" ? "#0F6E56" : "#3C3489",
                      fontWeight: 500,
                    }}>
                      {t.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.description}
                  </p>
                </div>
              </div>

              {/* Right — two actions */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                {/* Open in new tab */}
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
                    background: "var(--color-background-primary)",
                  }}
                  aria-label={`Open ${t.label} in new tab`}
                >
                  <i className="ti ti-external-link" style={{ fontSize: "15px" }} aria-hidden="true" />
                </a>
                {/* Navigate button */}
                <button
                  onClick={() => router.push(t.href)}
                  style={{
                    height: "34px",
                    padding: "0 14px",
                    borderRadius: "var(--border-radius-md)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    background: "var(--color-background-primary)",
                    color: "var(--color-text-primary)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "5px",
                  }}
                >
                  Go
                  <i className="ti ti-arrow-right" style={{ fontSize: "13px" }} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "2rem", marginBottom: "12px" }}>
          Quick links
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px" }}>
          {[
            { label: "Survey rates", href: "/tools/areacalc/survey", icon: "ti-clipboard-data" },
            { label: "Space templates", href: "/tools/areacalc", icon: "ti-template" },
            { label: "Team members", href: "/new/dash/dashadmin", icon: "ti-users" },
            { label: "Projects", href: "/new/dash/dashadmin", icon: "ti-briefcase" },
          ].map((q) => (
            <Link key={q.label} href={q.href} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 14px",
              borderRadius: "var(--border-radius-md)",
              border: "0.5px solid var(--color-border-tertiary)",
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)",
              fontSize: "13px",
              textDecoration: "none",
              fontWeight: 400,
            }}>
              <i className={`ti ${q.icon}`} style={{ fontSize: "15px", color: "var(--color-text-secondary)" }} aria-hidden="true" />
              {q.label}
            </Link>
          ))}
        </div>

      </main>
    </div>
  );
}