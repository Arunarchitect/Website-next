// app/main/client/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./styles.css";
import { getCurrentUser, getAreacalcRole } from "./clientApi";
import { clientSections } from "./constants";
import { User } from "./types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [user, role] = await Promise.all([
          getCurrentUser(),
          getAreacalcRole(),
        ]);
        setCurrentUser(user);
        setAreacalcRole(role);
        console.log('👤 Client user:', user?.email);
        console.log('📐 Areacalc role:', role);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  // Get user's display name
  const getDisplayName = (): string => {
    if (!currentUser) return 'Guest';
    return currentUser.full_name || currentUser.email || 'Client';
  };

  // Get user's initials for avatar
  const getInitials = (): string => {
    if (!currentUser) return '?';
    const name = currentUser.full_name || currentUser.email || 'Client';
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

  // ✅ Filter sections based on Areacalc role
  const visibleSections = clientSections.filter((section) => {
    // If section requires Areacalc, check if user has a role
    if (section.requiresAreacalc) {
      return areacalcRole !== null && areacalcRole !== 'anonymous';
    }
    return true; // Always show sections that don't require Areacalc
  });

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
              <span className="user-role-badge" style={{ 
                marginLeft: '8px',
                background: '#E1F5EE',
                color: '#0F6E56',
              }}>
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
          {/* Section Label */}
          <p className="section-label">Available Tools & Resources</p>

          {/* Client Sections */}
          <div className="client-sections-grid">
            {visibleSections.length > 0 ? (
              visibleSections.map((section) => (
                <div key={section.href + section.label} className="client-section-card">
                  <div className="client-section-icon-wrapper">
                    <i className={`ti ${section.icon}`} aria-hidden="true" />
                  </div>
                  <div className="client-section-info">
                    <p className="client-section-label">{section.label}</p>
                    <p className="client-section-description">{section.description}</p>
                    {section.requiresAreacalc && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 8px',
                        borderRadius: '2px',
                        background: '#E1F5EE',
                        color: '#0F6E56',
                        fontFamily: 'var(--font-mono), monospace',
                        letterSpacing: '0.04em',
                        display: 'inline-block',
                        marginTop: '4px',
                      }}>
                        <i className="ti ti-lock-open" style={{ fontSize: '10px', marginRight: '4px' }} />
                        Access granted
                      </span>
                    )}
                  </div>
                  <div className="client-section-actions">
                    <a
                      href={section.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-section-btn client-section-btn-icon"
                      aria-label={`Open ${section.label} in new tab`}
                      title="Open in new tab"
                    >
                      <i className="ti ti-external-link" aria-hidden="true" />
                    </a>
                    <Link href={section.href} className="client-section-btn client-section-btn-go">
                      {section.cta}
                      <i className="ti ti-arrow-right" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: 'var(--slate)',
                background: '#ffffff',
                border: '1px solid var(--line)',
                borderRadius: '4px',
              }}>
                <i className="ti ti-info-circle" style={{ fontSize: '32px', display: 'block', marginBottom: '8px', color: 'var(--line)' }} />
                <p>No tools available at the moment.</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Contact your organisation admin for access.</p>
              </div>
            )}
          </div>

          {/* Access Note */}
          <div className="client-access-note">
            <i className="ti ti-info-circle" aria-hidden="true" />
            <span>
              You have client-level access. Some features may be restricted.
              Contact your project manager if you need additional permissions.
            </span>
          </div>
        </>
      )}
    </main>
  );
}