"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { getIssues } from "@/app/issues/issueApi";
import { Issue, isBimIssue } from "@/app/issues/issueTypes";

const display = Space_Grotesk({ 
  subsets: ["latin"], 
  weight: ["500", "700"], 
  variable: "--font-display" 
});
const mono = IBM_Plex_Mono({ 
  subsets: ["latin"], 
  weight: ["400", "500"], 
  variable: "--font-mono" 
});

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

export default function MainAdminPage() {
  const router = useRouter();
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueStats, setIssueStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    highPriority: 0,
  });

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        setLoading(true);
        setError(null);
        const allIssues = await getIssues();
        
        // Sort by created date (newest first)
        const sorted = [...allIssues].sort((a, b) => 
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        
        // Get only the 5 most recent issues
        setRecentIssues(sorted.slice(0, 5));
        
        // Calculate stats
        setIssueStats({
          open: allIssues.filter(i => i.status === "Open").length,
          inProgress: allIssues.filter(i => i.status === "In Progress").length,
          resolved: allIssues.filter(i => i.status === "Resolved").length,
          highPriority: allIssues.filter(i => i.priority === "High").length,
        });
      } catch (err) {
        console.error('Error fetching issues:', err);
        setError('Failed to load issues');
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);

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

  const getStatusColor = (status: Issue["status"]) => {
    switch (status) {
      case "Open":
        return "#D43E3E";
      case "In Progress":
        return "#E8A838";
      case "Resolved":
        return "#4A8B6B";
      case "Closed":
        return "#6B7280";
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

  // Add stat cards for issues
  const issueStatsCards: Stat[] = [
    { label: "Open Issues", value: String(issueStats.open), icon: "ti-alert-circle" },
    { label: "In Progress", value: String(issueStats.inProgress), icon: "ti-loader" },
    { label: "Resolved", value: String(issueStats.resolved), icon: "ti-check" },
    { label: "High Priority", value: String(issueStats.highPriority), icon: "ti-flag" },
  ];

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

        /* --- Loading / Error --- */
        .loading-text, .error-text {
          padding: 16px;
          text-align: center;
          color: var(--slate);
          font-size: 14px;
        }

        .error-text {
          color: #D43E3E;
        }

        .error-text button {
          margin-left: 12px;
          padding: 4px 12px;
          border: 1px solid #D43E3E;
          border-radius: 4px;
          background: transparent;
          color: #D43E3E;
          cursor: pointer;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
        }

        .error-text button:hover {
          background: #D43E3E10;
        }

        /* --- No Issues --- */
        .no-issues {
          padding: 24px;
          text-align: center;
          color: var(--slate);
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 4px;
        }

        .no-issues i {
          font-size: 32px;
          display: block;
          margin-bottom: 8px;
          color: var(--line);
        }

        .no-issues p {
          margin: 0;
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
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
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

        .issue-domain-badge {
          padding: 2px 8px;
          border-radius: 2px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: #ffffff;
        }

        .issue-domain-bim {
          background: var(--blue);
        }

        .issue-domain-design {
          background: var(--purple-text);
        }

        .issue-status-badge {
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
          <Link href="/issues/page" className="admin-nav-link">
            <i className="ti ti-bug" aria-hidden="true" />
            <span>Issues</span>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <div className="admin-hero">
        <p className="admin-eyebrow">Admin Hub</p>
        <h1 className="admin-title">Welcome back</h1>
        <p className="admin-sub">You have full admin access across all connected applications.</p>
      </div>

      {/* Stats - includes issue stats */}
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
        {issueStatsCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <i className={`ti ${stat.icon} stat-icon`} aria-hidden="true" />
            <div>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Issues Section - shows recent issues */}
      <div className="section-label">
        <span>Recent Issues</span>
        <Link href="/issues/page" className="section-label-link">
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="loading-text">Loading issues…</div>
      ) : error ? (
        <div className="error-text">
          {error}
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : recentIssues.length === 0 ? (
        <div className="no-issues">
          <i className="ti ti-check" />
          <p>No issues found. Everything is clean!</p>
        </div>
      ) : (
        <div className="issues-grid">
          {recentIssues.map((issue) => (
            <Link key={issue.id} href="/issues/page" className="issue-card">
              <div className="issue-left">
                <div
                  className="issue-priority-badge"
                  style={{ background: getPriorityColor(issue.priority) }}
                />
                <div className="issue-content">
                  <div className="issue-header">
                    <span className="issue-id">#{issue.id}</span>
                    <h3 className="issue-title">{issue.title}</h3>
                    <span className={`issue-domain-badge issue-domain-${issue.domain}`}>
                      {isBimIssue(issue) ? 'BCF' : 'Design'}
                    </span>
                  </div>
                  <p className="issue-description">{issue.description}</p>
                  <div className="issue-meta">
                    <span className="issue-meta-item">
                      <i className="ti ti-user" aria-hidden="true" />
                      {issue.reportedBy}
                    </span>
                    {issue.assignedTo && (
                      <span className="issue-meta-item">
                        <i className="ti ti-user-check" aria-hidden="true" />
                        {issue.assignedTo}
                      </span>
                    )}
                    <span
                      className="issue-status-badge"
                      style={{ background: getStatusColor(issue.status) }}
                    >
                      {issue.status}
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
                    {isBimIssue(issue) && (
                      <span className="issue-meta-item">
                        <i className="ti ti-tag" aria-hidden="true" />
                        {issue.topicType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="issue-right">
                <span className="issue-timestamp">{formatTimestamp(issue.created)}</span>
                <i className="ti ti-chevron-right issue-arrow" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}

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