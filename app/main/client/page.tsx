"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./styles.css";
import { getCurrentUser, getAreacalcRole } from "./clientApi";
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
          {areacalcRole && areacalcRole !== 'anonymous' && (
            <Link href="/tools/areacalc" className="client-nav-link">
              <i className="ti ti-ruler-measure" aria-hidden="true" />
              <span>Areacalc</span>
            </Link>
          )}
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
          <p className="section-label">Get Started</p>
          <Link href="/product" className="client-product-card">
            <div className="client-section-icon-wrapper">
              <i className="ti ti-shopping-bag" aria-hidden="true" />
            </div>
            <div className="client-section-info">
              <p className="client-section-label">Product Selection</p>
              <p className="client-section-description">
                Browse and choose the products available to your account.
              </p>
            </div>
            <span className="client-product-btn-go">
              Go
              <i className="ti ti-arrow-right" aria-hidden="true" />
            </span>
          </Link>
        </>
      )}
    </main>
  );
}