"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./styles.css";
import { getCurrentUser, getAreacalcRole, getClientProjects } from "./clientApi";
import { User, ClientProject } from "./types";

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

export default function DashClientPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [areacalcRole, setAreacalcRole] = useState<string | null>(null);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [user, role, projectList] = await Promise.all([
          getCurrentUser(),
          getAreacalcRole(),
          getClientProjects(),
        ]);
        setCurrentUser(user);
        setAreacalcRole(role);
        setProjects(projectList);
        console.log('👤 Client user:', user?.email);
        console.log('📐 Areacalc role:', role);
        console.log('📁 Client projects:', projectList.length);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const getDisplayName = (): string => {
    if (!currentUser) return 'Guest';
    return currentUser.full_name || currentUser.email || 'Client';
  };

  const getInitials = (): string => {
    if (!currentUser) return '?';
    const name = currentUser.full_name || currentUser.email || 'Client';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <main className={`${display.variable} ${mono.variable} client-page`}>
      {/* Header */}
      <header className="client-header">
        <div className="client-brand">
          <span className="client-brand-icon">
            <i className="ti ti-user" aria-hidden="true" />
          </span>
          <span className="client-brand-text">Client Portal</span>
        </div>
        <nav className="client-nav">
          <Link href="/new/dash/dashnormal" className="client-nav-link">
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
            <span>Dashboard</span>
          </Link>
          {areacalcRole && areacalcRole !== 'anonymous' && (
            <Link href="/tools/areacalc" className="client-nav-link">
              <i className="ti ti-ruler-measure" aria-hidden="true" />
              <span>Areacalc</span>
            </Link>
          )}
          <Link href="/issues" className="client-nav-link">
            <i className="ti ti-bug" aria-hidden="true" />
            <span>Issues</span>
          </Link>
          <span className="client-role-badge">
            <i className="ti ti-shield" aria-hidden="true" />
            Client
          </span>
        </nav>
      </header>

      {/* Hero */}
      <div className="client-hero">
        <p className="client-eyebrow">Client Portal</p>
        <h1 className="client-title">Your workspace</h1>
        <p className="client-sub">
          Access your project updates and available tools below.
        </p>
      </div>

      {/* User Profile */}
      {!loading && currentUser && (
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
              <i className="ti ti-shield" />
              Client Access
            </span>
            {areacalcRole && areacalcRole !== 'anonymous' && (
              <span className="user-role-badge-areacalc">
                <i className="ti ti-calculator" />
                Areacalc: {areacalcRole}
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-text">Loading your workspace…</div>
      ) : (
        <>
          {/* Projects */}
          <p className="section-label">My Projects</p>
          <div className="client-projects-grid">
            {projects.length > 0 ? (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/new/projectdash/${project.id}`}
                  className="client-project-card"
                >
                  <div className="client-project-info">
                    <p className="client-project-name">{project.name}</p>
                    <p className="client-project-meta">
                      {project.location} · {project.project_type}
                    </p>
                    <span className="client-project-status">
                      {project.status_display}
                    </span>
                  </div>
                  <i className="ti ti-arrow-right" aria-hidden="true" />
                </Link>
              ))
            ) : (
              <div className="client-empty-state">
                <i className="ti ti-folder-off" aria-hidden="true" />
                <p>No projects assigned to you yet.</p>
                <p>Contact your organisation admin for access.</p>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}