"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

interface Tool {
  key: string;
  href: string;
  icon: string;
  label: string;
  description: string;
  tag: string;
  tagColor: "teal" | "purple";
  external: boolean;
}

interface Stat {
  label: string;
  value: string;
  icon: string;
}

interface QuickLink {
  label: string;
  href: string;
  icon: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  project: string;
  raisedBy: string;
  role: "Client" | "Architect" | "Project Manager" | "Team Member";
  priority: "High" | "Medium" | "Low";
  timestamp: string;
}

const tools: Tool[] = [
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

const stats: Stat[] = [
  { label: "Apps connected", value: "2", icon: "ti-apps" },
  { label: "Your role", value: "Admin", icon: "ti-shield-check" },
  { label: "Access level", value: "Full", icon: "ti-key" },
];

const quickLinks: QuickLink[] = [
  { label: "Survey rates", href: "/tools/areacalc/survey", icon: "ti-clipboard-data" },
  { label: "Space templates", href: "/tools/areacalc", icon: "ti-template" },
  { label: "Team members", href: "/new/dash/dashadmin", icon: "ti-users" },
  { label: "Projects", href: "/new/dash/dashadmin", icon: "ti-briefcase" },
];

const issues: Issue[] = [
  {
    id: "ISS-001",
    title: "Incorrect area calculation for Lot 42B",
    description: "The survey data shows 1,245 sqm but calculations are returning 1,180 sqm. Needs immediate verification.",
    project: "Riverside Estate",
    raisedBy: "Sarah Chen",
    role: "Architect",
    priority: "High",
    timestamp: "2026-07-08T09:30:00",
  },
  {
    id: "ISS-002",
    title: "Missing documentation for Phase 3 deliverables",
    description: "Client requires updated floor plans and structural drawings before next week's review.",
    project: "Harbour View Tower",
    raisedBy: "James Okafor",
    role: "Client",
    priority: "High",
    timestamp: "2026-07-08T08:15:00",
  },
  {
    id: "ISS-003",
    title: "Space template mismatch for conference rooms",
    description: "The standard template doesn't match the actual measurements taken on site. Adjust dimensions.",
    project: "Tech Hub Campus",
    raisedBy: "Maria Rodriguez",
    role: "Project Manager",
    priority: "Medium",
    timestamp: "2026-07-07T16:45:00",
  },
  {
    id: "ISS-004",
    title: "Team member access permissions need updating",
    description: "New team members don't have proper access to project files and survey data.",
    project: "Riverside Estate",
    raisedBy: "David Kim",
    role: "Team Member",
    priority: "Low",
    timestamp: "2026-07-07T14:20:00",
  },
  {
    id: "ISS-005",
    title: "Survey boundary dispute with adjacent lot",
    description: "Neighbor claims our survey markers are 2 meters into their property. Need to review original documentation.",
    project: "Harbour View Tower",
    raisedBy: "Sarah Chen",
    role: "Architect",
    priority: "High",
    timestamp: "2026-07-07T11:00:00",
  },
];

export default function MainAdminPage() {
  const router = useRouter();

  const getPriorityColor = (priority: Issue["priority"]) => {
    switch (priority) {
      case "High":
        return "#D43E3E";
      case "Medium":
        return "#E8A838";
      case "Low":
        return "#4A8B6B";
      default:
        return "var(--slate)";
    }
  };

  const getRoleColor = (role: Issue["role"]) => {
    switch (role) {
      case "Client":
        return "#2C5F8A";
      case "Architect":
        return "#6B4C8A";
      case "Project Manager":
        return "#2A7A6B";
      case "Team Member":
        return "#8A7A4A";
      default:
        return "var(--slate)";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <main className={`${display.variable} ${mono.variable} admin-page`}>
      <style jsx>{`
        .admin-page {
          --paper: #F7F5EF;
          --ink: #1E1E1A;
          --blue: #2C5F8A;
          --blue-deep: #17324A;
          --slate: #6E6B62;
          --line: #DFDACB;
          --teal-bg: #E1F5EE;
          --teal-text: #0F6E56;
          --purple-bg: #EEEDFE;
          --purple-text: #3C3489;

          max-width: 1120px;
          margin: 0 auto;
          padding: 2px 24px 10px;
          background: var(--paper);
          color: var(--ink);
          font-family: var(--font-display), system-ui, -apple-system, sans-serif;
          min-height: 100vh;
        }

        /* --- Header --- */
        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid var(--line);
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .admin-brand-icon {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          background: var(--blue-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--paper);
          font-size: 16px;
        }

        .admin-brand-text {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 18px;
          letter-spacing: -0.01em;
        }

        .admin-nav {
          display: flex;
          gap: 6px;
        }

        .admin-nav-link {
          font-size: 13px;
          color: var(--slate);
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid var(--line);
          transition: border-color 0.18s ease, background 0.18s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .admin-nav-link:hover {
          border-color: var(--blue);
          background: rgba(44, 95, 138, 0.05);
        }

        /* --- Hero --- */
        .admin-hero {
          margin-bottom: 32px;
        }

        .admin-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--blue);
          text-transform: uppercase;
          margin: 0 0 2px;
        }

        .admin-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: clamp(2rem, 4vw, 2.6rem);
          letter-spacing: -0.02em;
          margin: 0 0 2px;
          line-height: 1.2;
        }

        .admin-sub {
          font-size: 15px;
          color: var(--slate);
          margin: 0;
          line-height: 1.55;
        }

        /* --- Stats Row --- */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: border-color 0.18s ease;
        }

        .stat-card:hover {
          border-color: var(--blue);
        }

        .stat-icon {
          font-size: 20px;
          color: var(--slate);
          width: 20px;
          text-align: center;
        }

        .stat-label {
          font-size: 11px;
          color: var(--slate);
          margin: 0 0 2px;
          font-family: var(--font-mono), monospace;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .stat-value {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 18px;
          margin: 0;
          color: var(--ink);
        }

        /* --- Section Label --- */
        .section-label {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          color: var(--blue);
          text-transform: uppercase;
          margin: 0 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .section-label-link {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--slate);
          text-decoration: none;
          padding: 4px 12px;
          border: 1px solid var(--line);
          border-radius: 4px;
          transition: border-color 0.18s ease, background 0.18s ease;
        }

        .section-label-link:hover {
          border-color: var(--blue);
          background: rgba(44, 95, 138, 0.05);
          color: var(--blue);
        }

        /* --- Issues Grid --- */
        .issues-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 32px;
        }

        .issue-card {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
        }

        .issue-card:hover {
          border-color: var(--blue);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(23, 50, 74, 0.08);
        }

        .issue-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }

        .issue-priority-badge {
          width: 4px;
          min-height: 40px;
          border-radius: 2px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .issue-content {
          min-width: 0;
          flex: 1;
        }

        .issue-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }

        .issue-id {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--slate);
          letter-spacing: 0.04em;
        }

        .issue-title {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 15px;
          margin: 0;
        }

        .issue-description {
          font-size: 13px;
          color: var(--slate);
          margin: 0 0 6px;
          line-height: 1.5;
        }

        .issue-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .issue-meta-item {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--slate);
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .issue-meta-item i {
          font-size: 13px;
        }

        .issue-role-badge {
          padding: 2px 8px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: #ffffff;
        }

        .issue-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .issue-timestamp {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--slate);
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .issue-arrow {
          color: var(--slate);
          font-size: 16px;
          transition: transform 0.18s ease;
        }

        .issue-card:hover .issue-arrow {
          transform: translateX(4px);
          color: var(--blue);
        }

        /* --- Tools Grid --- */
        .tools-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 32px;
        }

        .tool-card {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        }

        .tool-card:hover {
          border-color: var(--blue);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(23, 50, 74, 0.08);
        }

        .tool-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .tool-icon-wrapper {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 4px;
          border: 1px solid var(--line);
          background: var(--paper);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tool-icon-wrapper i {
          font-size: 20px;
          color: var(--ink);
        }

        .tool-info {
          min-width: 0;
        }

        .tool-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
          flex-wrap: wrap;
        }

        .tool-label {
          font-family: var(--font-display), sans-serif;
          font-weight: 500;
          font-size: 16px;
        }

        .tool-tag {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 2px;
          font-weight: 500;
          font-family: var(--font-mono), monospace;
          letter-spacing: 0.04em;
        }

        .tool-tag-teal {
          background: var(--teal-bg);
          color: var(--teal-text);
        }

        .tool-tag-purple {
          background: var(--purple-bg);
          color: var(--purple-text);
        }

        .tool-description {
          font-size: 13px;
          color: var(--slate);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tool-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .tool-btn {
          height: 34px;
          border-radius: 4px;
          border: 1px solid var(--line);
          background: transparent;
          color: var(--slate);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.04em;
          text-decoration: none;
        }

        .tool-btn:hover {
          border-color: var(--blue);
          background: rgba(44, 95, 138, 0.05);
          color: var(--blue);
        }

        .tool-btn-icon {
          width: 34px;
          padding: 0;
        }

        .tool-btn-go {
          padding: 0 16px;
          gap: 4px;
          color: var(--ink);
        }

        .tool-btn-go i {
          font-size: 13px;
        }

        /* --- Quick Links --- */
        .quick-links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
        }

        .quick-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 4px;
          border: 1px solid var(--line);
          background: #ffffff;
          color: var(--ink);
          font-size: 13px;
          text-decoration: none;
          transition: border-color 0.18s ease, background 0.18s ease;
        }

        .quick-link:hover {
          border-color: var(--blue);
          background: rgba(44, 95, 138, 0.05);
        }

        .quick-link i {
          font-size: 15px;
          color: var(--slate);
        }

        /* --- Responsive --- */
        @media (max-width: 780px) {
          .admin-page {
            padding: 2px 16px 10px;
          }

          .admin-header {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .admin-nav {
            flex-wrap: wrap;
          }

          .issue-card {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 16px 18px;
          }

          .issue-right {
            justify-content: flex-end;
          }

          .tool-card {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 16px 18px;
          }

          .tool-left {
            flex: 1;
          }

          .tool-actions {
            justify-content: flex-end;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .quick-links-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 480px) {
          .admin-page {
            padding: 2px 12px 10px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .quick-links-grid {
            grid-template-columns: 1fr;
          }

          .tool-description {
            white-space: normal;
          }

          .admin-nav-link span {
            display: none;
          }

          .tool-actions {
            justify-content: stretch;
          }

          .tool-btn-go {
            flex: 1;
            justify-content: center;
          }

          .issue-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .issue-right {
            justify-content: flex-start;
          }
        }

        @media (max-width: 400px) {
          .tool-card {
            padding: 14px 16px;
          }

          .tool-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .tool-label {
            font-size: 15px;
          }

          .issue-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>

      {/* Header */}
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-brand-icon">
            <i className="ti ti-command" aria-hidden="true" />
          </span>
          <span className="admin-brand-text">Admin Hub</span>
        </div>
        <nav className="admin-nav">
          <Link href="/new/dash/dashadmin" className="admin-nav-link">
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
            <span>Dashboard</span>
          </Link>
          <Link href="/tools/areacalc" className="admin-nav-link">
            <i className="ti ti-ruler-measure" aria-hidden="true" />
            <span>Areacalc</span>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <div className="admin-hero">
        <p className="admin-eyebrow">Admin Hub</p>
        <h1 className="admin-title">Welcome back</h1>
        <p className="admin-sub">You have full admin access across all connected applications.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <i className={`ti ${stat.icon} stat-icon`} aria-hidden="true" />
            <div>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Issues Section */}
      <div className="section-label">
        <span>Issues</span>
        <Link href="/issues/page" className="section-label-link">
          View all →
        </Link>
      </div>
      <div className="issues-grid">
        {issues.slice(0, 3).map((issue) => (
          <Link key={issue.id} href="/issues/page" className="issue-card">
            <div className="issue-left">
              <div
                className="issue-priority-badge"
                style={{ background: getPriorityColor(issue.priority) }}
              />
              <div className="issue-content">
                <div className="issue-header">
                  <span className="issue-id">{issue.id}</span>
                  <h3 className="issue-title">{issue.title}</h3>
                </div>
                <p className="issue-description">{issue.description}</p>
                <div className="issue-meta">
                  <span className="issue-meta-item">
                    <i className="ti ti-folder" aria-hidden="true" />
                    {issue.project}
                  </span>
                  <span className="issue-meta-item">
                    <i className="ti ti-user" aria-hidden="true" />
                    {issue.raisedBy}
                  </span>
                  <span
                    className="issue-role-badge"
                    style={{ background: getRoleColor(issue.role) }}
                  >
                    {issue.role}
                  </span>
                  <span
                    className="issue-meta-item"
                    style={{
                      color: getPriorityColor(issue.priority),
                      fontWeight: 500,
                    }}
                  >
                    <i className="ti ti-flag" aria-hidden="true" />
                    {issue.priority}
                  </span>
                </div>
              </div>
            </div>
            <div className="issue-right">
              <span className="issue-timestamp">{formatTimestamp(issue.timestamp)}</span>
              <i className="ti ti-chevron-right issue-arrow" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>

      {/* Tools */}
      <p className="section-label">Applications</p>
      <div className="tools-grid">
        {tools.map((tool) => (
          <div key={tool.key} className="tool-card">
            <div className="tool-left">
              <div className="tool-icon-wrapper">
                <i className={`ti ${tool.icon}`} aria-hidden="true" />
              </div>
              <div className="tool-info">
                <div className="tool-header">
                  <span className="tool-label">{tool.label}</span>
                  <span className={`tool-tag tool-tag-${tool.tagColor}`}>{tool.tag}</span>
                </div>
                <p className="tool-description">{tool.description}</p>
              </div>
            </div>
            <div className="tool-actions">
              <a
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="tool-btn tool-btn-icon"
                aria-label={`Open ${tool.label} in new tab`}
                title="Open in new tab"
              >
                <i className="ti ti-external-link" aria-hidden="true" />
              </a>
              <button
                onClick={() => router.push(tool.href)}
                className="tool-btn tool-btn-go"
              >
                Go
                <i className="ti ti-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <p className="section-label">Quick links</p>
      <div className="quick-links-grid">
        {quickLinks.map((link) => (
          <Link key={link.label} href={link.href} className="quick-link">
            <i className={`ti ${link.icon}`} aria-hidden="true" />
            {link.label}
          </Link>
        ))}
      </div>
    </main>
  );
}