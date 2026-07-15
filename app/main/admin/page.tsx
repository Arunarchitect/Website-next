// app/new/dash/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./styles.css";

import {
  getCurrentUser,
  getUserOrganisations,
  getIssuesByOrganisation,
  formatTimestamp,
  getPriorityColor,
  getStatusColor,
} from "./adminApi";
import { tools, quickLinks, issueStatsConfig } from "./constants";
import { DashboardIssue, Organisation, User, DashboardStats } from "./types";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

// Helper to normalize status
const normalizeStatus = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed',
  };
  return statusMap[status?.toLowerCase?.()] || status;
};

// Helper to normalize priority
const normalizePriority = (priority: string): string => {
  const priorityMap: { [key: string]: string } = {
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
  };
  return priorityMap[priority?.toLowerCase?.()] || priority;
};

// Calculate stats from issues
const calculateStats = (issues: DashboardIssue[]): DashboardStats => {
  return {
    open: issues.filter(i => normalizeStatus(i.status) === 'Open').length,
    inProgress: issues.filter(i => normalizeStatus(i.status) === 'In Progress').length,
    resolved: issues.filter(i => normalizeStatus(i.status) === 'Resolved').length,
    highPriority: issues.filter(i => normalizePriority(i.priority) === 'High').length,
    total: issues.length,
  };
};

export default function MainAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [recentIssues, setRecentIssues] = useState<DashboardIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [selectedOrganisation, setSelectedOrganisation] = useState<number | null>(null);
  const [issueStats, setIssueStats] = useState<DashboardStats>({
    open: 0,
    inProgress: 0,
    resolved: 0,
    highPriority: 0,
    total: 0,
  });
  const [loadingOrganisations, setLoadingOrganisations] = useState(true);

  // Fetch user info on mount
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  // Fetch user's organisations on mount
  useEffect(() => {
    const fetchOrganisations = async () => {
      try {
        setLoadingOrganisations(true);
        const orgs = await getUserOrganisations();
        setOrganisations(orgs);
        
        if (orgs.length > 0) {
          setSelectedOrganisation(orgs[0].id);
        }
      } catch (err) {
        console.error('Error fetching organisations:', err);
        setError('Failed to load organisations');
      } finally {
        setLoadingOrganisations(false);
      }
    };
    fetchOrganisations();
  }, []);

  // Fetch issues when organisation changes
  useEffect(() => {
    if (selectedOrganisation === null && organisations.length > 0) {
      setSelectedOrganisation(organisations[0].id);
      return;
    }

    const fetchIssues = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let allIssues: DashboardIssue[] = [];
        
        if (selectedOrganisation) {
          allIssues = await getIssuesByOrganisation(selectedOrganisation);
        }
        
        // Sort by created date (newest first)
        const sorted = [...allIssues].sort(
          (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        
        // Get only the 5 most recent issues
        setRecentIssues(sorted.slice(0, 5));
        
        // Calculate stats with normalized values
        setIssueStats(calculateStats(allIssues));
        
      } catch (err) {
        console.error('Error fetching issues:', err);
        setError('Failed to load issues');
      } finally {
        setLoading(false);
      }
    };

    if (!loadingOrganisations) {
      fetchIssues();
    }
  }, [selectedOrganisation, organisations, loadingOrganisations]);

  const isBimIssue = (issue: DashboardIssue): boolean => {
    return issue.domain === 'bim';
  };

  // Get user's display name
  const getDisplayName = (): string => {
    if (!currentUser) return 'Guest';
    return currentUser.full_name || currentUser.email || 'User';
  };

  // Get user's initials for avatar
  const getInitials = (): string => {
    if (!currentUser) return '?';
    const name = currentUser.full_name || currentUser.email || 'User';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Check if there are any open issues
  const hasOpenIssues = issueStats.open > 0;

  return (
    <main className={`${display.variable} ${mono.variable} admin-page`}>
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
          <Link href="/issues" className="admin-nav-link">
            <i className="ti ti-bug" aria-hidden="true" />
            <span>Issues</span>
          </Link>
        </nav>
      </header>

      {/* User Profile Section */}
      {currentUser && (
        <div className="user-profile">
          <div className="user-avatar">{getInitials()}</div>
          <div className="user-info">
            <p className="user-greeting">{getGreeting()} 👋</p>
            <h2 className="user-name">{getDisplayName()}</h2>
            <p className="user-email">
              <i className="ti ti-mail" />
              {currentUser.email}
            </p>
            <span className="user-role-badge">
              <i className="ti ti-shield-check" />
              Admin
            </span>
          </div>
        </div>
      )}

      {/* Organisation Selector */}
      {organisations.length > 0 && (
        <div className="organisation-selector">
          <i className="ti ti-building" style={{ color: 'var(--slate)' }} />
          <label htmlFor="organisation-select">Organisation:</label>
          <select
            id="organisation-select"
            value={selectedOrganisation || ''}
            onChange={(e) => setSelectedOrganisation(Number(e.target.value))}
          >
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <span className="org-count">
            {organisations.length} organisation{organisations.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {loadingOrganisations ? (
        <div className="loading-text">Loading organisations…</div>
      ) : organisations.length === 0 ? (
        <div className="no-issues">
          <i className="ti ti-building" />
          <p>You are not a member of any organisation.</p>
          <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--slate)' }}>
            Please contact an administrator to be added to an organisation.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid">
            {issueStatsConfig.map((stat) => {
              const value = stat.label === 'Open Issues' ? issueStats.open :
                           stat.label === 'In Progress' ? issueStats.inProgress :
                           stat.label === 'Resolved' ? issueStats.resolved :
                           issueStats.highPriority;
              
              // Check if this is the Open Issues stat card
              const isOpenIssuesCard = stat.label === 'Open Issues';
              
              return (
                <div 
                  key={stat.label} 
                  className={`stat-card ${isOpenIssuesCard && hasOpenIssues ? 'stat-card-open-issues' : ''}`}
                >
                  <i className={`ti ${stat.icon} stat-icon`} aria-hidden="true" />
                  <div>
                    <p className="stat-label">{stat.label}</p>
                    <p className="stat-value">{value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Issues Section */}
          <div className="section-label">
            <span>Recent Issues</span>
            <Link href="/issues" className="section-label-link">
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
              <p>No issues found in this organisation. Everything is clean!</p>
            </div>
          ) : (
            <div className="issues-grid">
              {recentIssues.map((issue) => (
                <Link key={issue.id} href="/issues" className="issue-card">
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
                        {issue.organisation && (
                          <span className="organisation-badge">
                            <i className="ti ti-building" style={{ marginRight: '4px' }} />
                            {issue.organisation}
                          </span>
                        )}
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
                          {normalizeStatus(issue.status)}
                        </span>
                        <span
                          className="issue-meta-item"
                          style={{
                            color: getPriorityColor(issue.priority),
                            fontWeight: 500,
                          }}
                        >
                          <i className="ti ti-flag" aria-hidden="true" />
                          {normalizePriority(issue.priority)}
                        </span>
                        {isBimIssue(issue) && issue.topicType && (
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
        </>
      )}
    </main>
  );
}