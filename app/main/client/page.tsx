// app/main/client/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./styles.css";
import { getCurrentUser, getAreacalcRole } from "./clientApi";
import { User } from "./types";
import { checkClientAccess } from "./clientAccess";

// Fonts (--font-display, --font-mono) are provided by app/main/layout.tsx

export default function DashClientPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [areacalcRole, setAreacalcRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard: only users who are a Client of at least one organisation may stay.
  useEffect(() => {
    const verify = async () => {
      const result = await checkClientAccess();
      if (!result.allowed) {
        console.log("[client page] not a client -> redirecting to", result.redirectTo);
        router.replace(result.redirectTo);
      } else {
        setAuthorized(true);
      }
      setAuthChecked(true);
    };
    verify();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
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
  }, [authorized]);

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

  // Nothing from the portal renders until access is verified.
  if (!authChecked || !authorized) {
    return (
      <main className="client-page">
        <div className="loading-text">
          {authChecked ? "Redirecting…" : "Checking access…"}
        </div>
      </main>
    );
  }

  return (
    <main className="client-page">
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Product Selection */}
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

            {/* Drawing */}
            <Link href="/drawing" className="client-product-card">
              <div className="client-section-icon-wrapper">
                <i className="ti ti-pencil" aria-hidden="true" />
              </div>
              <div className="client-section-info">
                <p className="client-section-label">Drawing</p>
                <p className="client-section-description">
                  View and access the drawings for your projects.
                </p>
              </div>
              <span className="client-product-btn-go">
                Go
                <i className="ti ti-arrow-right" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}