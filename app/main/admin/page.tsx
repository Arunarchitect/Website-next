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
  getDashboardStats,
} from "./adminApi";
import { tools, quickLinks } from "./constants";
import {  Organisation, User, DashboardStats } from "./types";
import { fetchAreacalcRole } from "@/lib/resolveUserDestination";

// NOTE: adjust this import path to wherever meetingApi.ts actually lives —
// this is a placeholder based on the file you shared separately.
import { getUpcomingMeetings } from "@/app/meeting/meetingApi";
import type { Meeting } from "@/app/meeting/meetingTypes";

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

export default function MainAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

  // --- Upcoming meetings count ----------------------------------------------
  const [upcomingMeetingsCount, setUpcomingMeetingsCount] = useState(0);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  // --- Areacalc role (controls visibility of areacalc-related links) -------
  const [areacalcRole, setAreacalcRole] = useState<string | null>(null);
  const canAccessAreacalc = areacalcRole === "admin" || areacalcRole === "member";

  // Fetch user info on mount
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  // Fetch areacalc role on mount
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;
    fetchAreacalcRole(token).then(setAreacalcRole);
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
        console.error("Error fetching organisations:", err);
        setError("Failed to load organisations");
      } finally {
        setLoadingOrganisations(false);
      }
    };
    fetchOrganisations();
  }, []);

  // Fetch issue stats when organisation changes.
  useEffect(() => {
    if (selectedOrganisation === null && organisations.length > 0) {
      setSelectedOrganisation(organisations[0].id);
      return;
    }

    const fetchIssueStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const stats = await getDashboardStats(selectedOrganisation ?? undefined);
        setIssueStats(stats);
      } catch (err) {
        console.error("Error fetching issue stats:", err);
        setError("Failed to load issues");
      } finally {
        setLoading(false);
      }
    };

    if (!loadingOrganisations) {
      fetchIssueStats();
    }
  }, [selectedOrganisation, organisations, loadingOrganisations]);

  // Fetch upcoming meetings count, scoped to the selected organisation.
  useEffect(() => {
    if (loadingOrganisations) return;

    const fetchMeetingsCount = async () => {
      try {
        setLoadingMeetings(true);
        const meetings: Meeting[] = await getUpcomingMeetings(7);
        const scoped = selectedOrganisation
          ? meetings.filter((m) => m.organisationId === selectedOrganisation)
          : meetings;
        setUpcomingMeetingsCount(scoped.length);
      } catch (err) {
        console.error("Error fetching upcoming meetings:", err);
        setUpcomingMeetingsCount(0);
      } finally {
        setLoadingMeetings(false);
      }
    };

    fetchMeetingsCount();
  }, [selectedOrganisation, loadingOrganisations]);

  const getDisplayName = (): string => {
    if (!currentUser) return "Guest";
    return currentUser.full_name || currentUser.email || "User";
  };

  const getInitials = (): string => {
    if (!currentUser) return "?";
    const name = currentUser.full_name || currentUser.email || "User";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const hasOpenIssues = issueStats.open > 0;

  const visibleTools = tools.filter(
    (tool) => tool.key !== "areacalc" || canAccessAreacalc
  );
  const visibleQuickLinks = quickLinks.filter(
    (link) => link.href !== "/tools/areacalc" || canAccessAreacalc
  );

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
          <Link href="/new/dash/dashadmin" className="admin-nav-link active">
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
            <span>Dashboard</span>
          </Link>
          {canAccessAreacalc && (
            <Link href="/tools/areacalc" className="admin-nav-link">
              <i className="ti ti-ruler-measure" aria-hidden="true" />
              <span>Areacalc</span>
            </Link>
          )}
          <Link href="/issues" className="admin-nav-link">
            <i className="ti ti-bug" aria-hidden="true" />
            <span>Issues</span>
          </Link>
          <Link href="/product" className="admin-nav-link">
            <i className="ti ti-package" aria-hidden="true" />
            <span>Products</span>
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
          <i className="ti ti-building" style={{ color: "var(--slate)" }} />
          <label htmlFor="organisation-select">Organisation:</label>
          <select
            id="organisation-select"
            value={selectedOrganisation || ""}
            onChange={(e) => setSelectedOrganisation(Number(e.target.value))}
          >
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <span className="org-count">
            {organisations.length} organisation{organisations.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {loadingOrganisations ? (
        <div className="loading-text">Loading organisations…</div>
      ) : organisations.length === 0 ? (
        <div className="no-issues">
          <i className="ti ti-building" />
          <p>You are not a member of any organisation.</p>
          <p style={{ fontSize: "13px", marginTop: "4px", color: "var(--slate)" }}>
            Please contact an administrator to be added to an organisation.
          </p>
        </div>
      ) : (
        <>
          {/* Overview: Open / Resolved issue counts + Upcoming Meetings */}
          <div className="dash-overview">
            <div className="dash-overview-left">
              <Link
                href="/issues"
                className={`dash-stat-card ${hasOpenIssues ? "stat-card-open-issues" : ""}`}
              >
                <i className="ti ti-alert-circle stat-icon" aria-hidden="true" />
                <div>
                  <p className="stat-label">Open Issues</p>
                  <p className="stat-value">{loading ? "—" : issueStats.open}</p>
                </div>
              </Link>

              <Link href="/issues" className="dash-stat-card stat-card-resolved-issues">
                <i className="ti ti-check stat-icon" aria-hidden="true" />
                <div>
                  <p className="stat-label">Resolved Issues</p>
                  <p className="stat-value">{loading ? "—" : issueStats.resolved}</p>
                </div>
              </Link>
            </div>

            <Link
              href="/meeting"
              className={`dash-meetings-card ${
                upcomingMeetingsCount > 0 ? "dash-meetings-card-active" : ""
              }`}
            >
              <i className="ti ti-calendar-event stat-icon" aria-hidden="true" />
              <div>
                <p className="stat-label">Upcoming Meetings</p>
                <p className="stat-value">{loadingMeetings ? "—" : upcomingMeetingsCount}</p>
              </div>
            </Link>
          </div>

          {error && (
            <div className="error-text">
              {error}
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}

          {/* Tools */}
          <p className="section-label">Applications</p>
          <div className="tools-grid">
            {visibleTools.map((tool) => (
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
            {visibleQuickLinks.map((link) => (
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