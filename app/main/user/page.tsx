// app/main/user/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./styles.css";

import {
  getCurrentUser,
  getOrganisationMemberships,
  getOrganisationRole,
  getAreacalcRole,
  getUserDisplayName,
  getUserInitials,
  getGreeting,
  getRoleDisplayName,
} from "./userApi";
import { userTiles, areacalcDisplayConfig } from "./constants";
import { User, OrganisationMembership } from "./types";

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

export default function MainUserPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<OrganisationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [areacalcRole, setAreacalcRole] = useState<string | null>(null);
  const [hasAreacalc, setHasAreacalc] = useState(false);
  const [hasOrganisation, setHasOrganisation] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        const [userData, membershipsData, orgRole, areacalc] = await Promise.all([
          getCurrentUser(),
          getOrganisationMemberships(),
          getOrganisationRole(),
          getAreacalcRole(),
        ]);

        setUser(userData);
        setMemberships(membershipsData);
        setUserRole(orgRole);
        setAreacalcRole(areacalc);
        setHasAreacalc(areacalc !== null && areacalc !== 'anonymous');
        setHasOrganisation(orgRole !== null);

        console.log('✅ [UserPage] User data loaded:', {
          email: userData?.email,
          orgRole: orgRole,
          areacalcRole: areacalc,
          hasOrganisation: orgRole !== null,
          hasAreacalc: areacalc !== null && areacalc !== 'anonymous',
        });

        setLoading(false);
      } catch (error) {
        console.error('❌ [UserPage] Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // ✅ Filter tiles based on Areacalc access AND organisation access
  const visibleTiles = userTiles.filter((tile) => {
    // If tile requires Areacalc, check if user has Areacalc access
    if (tile.requiresAreacalc) {
      return hasAreacalc;
    }
    
    // If tile requires organisation, check if user has organisation role
    if (tile.requiresOrganisation) {
      return hasOrganisation;
    }
    
    return true;
  });

  // Get role badge class
  const getRoleBadgeClass = (role: string | null): string => {
    const classMap: { [key: string]: string } = {
      'admin': 'user-role-badge-admin',
      'manager': 'user-role-badge-manager',
      'member': 'user-role-badge-member',
      'client': 'user-role-badge-client',
      'no_organisation': 'user-role-badge-no_organisation',
    };
    return classMap[role || ''] || 'user-role-badge-no_organisation';
  };

  return (
    <main className={`${display.variable} ${mono.variable} user-page`}>
      {/* Header */}
      <header className="user-header">
        <div className="user-brand">
          <span className="user-brand-icon">
            <i className="ti ti-home" aria-hidden="true" />
          </span>
          <span className="user-brand-text">My Space</span>
          {user && (
            <span className="user-email-badge">{user.email}</span>
          )}
          {userRole && (
            <span className={`user-role-badge ${getRoleBadgeClass(userRole)}`}>
              {userRole}
            </span>
          )}
          {/* ✅ Show "No Access" badge only if no org AND no Areacalc */}
          {!userRole && !hasAreacalc && (
            <span className="user-role-badge user-role-badge-no_organisation">
              No Access
            </span>
          )}
        </div>
        <nav className="user-nav">
          {/* ✅ Dashboard - only if has organisation */}
          {hasOrganisation && (
            <Link href="/new/dash/dashnormal" className="user-nav-link">
              <i className="ti ti-layout-dashboard" aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
          )}
          {/* ✅ Areacalc - only if has Areacalc access */}
          {hasAreacalc && (
            <Link href="/tools/areacalc" className="user-nav-link">
              <i className="ti ti-ruler-measure" aria-hidden="true" />
              <span>Areacalc</span>
            </Link>
          )}
          {/* ✅ Issues - only if has organisation OR Areacalc access */}
          {(hasOrganisation || hasAreacalc) && (
            <Link href="/issues" className="user-nav-link">
              <i className="ti ti-bug" aria-hidden="true" />
              <span>Issues</span>
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <div className="user-hero">
        <p className="user-eyebrow">Home</p>
        <h1 className="user-title">
          {loading ? 'Loading...' : user ? `Welcome${user.full_name ? `, ${user.full_name}` : ''}` : 'Welcome'}
        </h1>
        <p className="user-sub">
          {loading ? 'Loading your profile...' : 
           user ? `You are logged in as ${user.email}` : 
           'Access your tools and project overview from here.'}
        </p>
        {userRole && (
          <p className="user-role-text">
            Role: <span>{getRoleDisplayName(userRole)}</span>
            {areacalcRole && areacalcRole !== 'anonymous' && (
              <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--slate)' }}>
                | Areacalc: <span style={{ fontWeight: 500, color: 'var(--teal-text)' }}>
                  {areacalcDisplayConfig[areacalcRole as keyof typeof areacalcDisplayConfig]?.label || areacalcRole}
                </span>
              </span>
            )}
          </p>
        )}
        {/* ✅ Show "No Access" message only if no org AND no Areacalc */}
        {!userRole && !hasAreacalc && (
          <p className="user-role-text">
            <span style={{ color: '#6B7280' }}>
              <i className="ti ti-info-circle" style={{ marginRight: '6px' }} />
              You don&apos;t have any active roles. Please contact your administrator.
            </span>
          </p>
        )}
        {/* ✅ Show Areacalc only message if no org but has Areacalc */}
        {!userRole && hasAreacalc && (
          <p className="user-role-text">
            <span style={{ color: '#0F6E56' }}>
              <i className="ti ti-calculator" style={{ marginRight: '6px' }} />
              Areacalc Access: <span style={{ fontWeight: 500 }}>
                {areacalcDisplayConfig[areacalcRole as keyof typeof areacalcDisplayConfig]?.label || areacalcRole}
              </span>
            </span>
          </p>
        )}
      </div>

      {/* User Profile */}
      {!loading && user && (
        <div className="user-profile">
          <div className="user-avatar">{getUserInitials(user)}</div>
          <div className="user-info">
            <p className="user-greeting">{getGreeting()} 👋</p>
            <h2 className="user-name">{getUserDisplayName(user)}</h2>
            <p className="user-email">
              <i className="ti ti-mail" />
              {user.email}
            </p>
            <div className="user-badges">
              {/* ✅ Organisation badge - only if has organisation */}
              {userRole && (
                <span className={`user-badge ${userRole === 'client' ? 'user-badge-client' : 'user-badge-org'}`}>
                  <i className="ti ti-building" />
                  {getRoleDisplayName(userRole)}
                </span>
              )}
              {/* ✅ Areacalc badge - only if has Areacalc access */}
              {hasAreacalc && (
                <span className="user-badge user-badge-areacalc">
                  <i className="ti ti-calculator" />
                  Areacalc: {areacalcDisplayConfig[areacalcRole as keyof typeof areacalcDisplayConfig]?.label || areacalcRole}
                </span>
              )}
              {/* ✅ No Access badge - only if no org AND no Areacalc */}
              {!userRole && !hasAreacalc && (
                <span className="user-badge" style={{ background: '#F0F0F0', color: '#6B7280' }}>
                  <i className="ti ti-lock" />
                  No Access
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-text">Loading your workspace…</div>
      ) : (
        <>
          {/* Section Label - Only show if there are tiles */}
          {visibleTiles.length > 0 && (
            <p className="section-label">Available Tools</p>
          )}

          {/* Tiles */}
          <div className="tiles-grid">
            {visibleTiles.length > 0 ? (
              visibleTiles.map((tile) => (
                <div key={tile.href} className="tile-card">
                  <div className="tile-left">
                    <div className="tile-icon-wrapper">
                      <i className={`ti ${tile.icon}`} aria-hidden="true" />
                    </div>
                    <div className="tile-info">
                      <div className="tile-header">
                        <span className="tile-label">{tile.label}</span>
                        <span className={`tile-tag ${tile.requiresAreacalc ? 'tile-tag-areacalc' : ''}`}>
                          {tile.tag}
                        </span>
                      </div>
                      <p className="tile-description">{tile.description}</p>
                      {tile.requiresAreacalc && hasAreacalc && (
                        <span className="tile-access-badge">
                          <i className="ti ti-lock-open" />
                          Access granted
                        </span>
                      )}
                      {tile.requiresAreacalc && !hasAreacalc && (
                        <span className="tile-access-badge tile-access-badge-locked">
                          <i className="ti ti-lock" />
                          No access
                        </span>
                      )}
                      {tile.requiresOrganisation && hasOrganisation && (
                        <span className="tile-access-badge">
                          <i className="ti ti-lock-open" />
                          Organisation access
                        </span>
                      )}
                      {tile.requiresOrganisation && !hasOrganisation && (
                        <span className="tile-access-badge tile-access-badge-locked">
                          <i className="ti ti-lock" />
                          No organisation
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="tile-actions">
                    <a
                      href={tile.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tile-btn tile-btn-icon"
                      aria-label={`Open ${tile.label} in new tab`}
                      title="Open in new tab"
                    >
                      <i className="ti ti-external-link" aria-hidden="true" />
                    </a>
                    <button
                      onClick={() => router.push(tile.href)}
                      className={`tile-btn tile-btn-go ${(tile.requiresAreacalc && !hasAreacalc) || (tile.requiresOrganisation && !hasOrganisation) ? 'tile-btn-disabled' : ''}`}
                      disabled={(tile.requiresAreacalc && !hasAreacalc) || (tile.requiresOrganisation && !hasOrganisation)}
                    >
                      Go <i className="ti ti-arrow-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="ti ti-info-circle" />
                <p>No tools available at the moment.</p>
                <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--slate)' }}>
                  {!userRole && !hasAreacalc ? (
                    <>You don&apos;t have any active roles. Please contact your administrator for access.</>
                  ) : (
                    <>Contact your organisation admin for access.</>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Debug Info - Only in development */}
          {process.env.NODE_ENV === 'development' && user && (
            <div className="debug-info">
              <details>
                <summary>🔧 Debug Info</summary>
                <pre>
                  {JSON.stringify({
                    user: {
                      id: user.id,
                      email: user.email,
                      full_name: user.full_name || user.username,
                    },
                    memberships: memberships.map(m => ({
                      organisation: m.organisation_name || m.organisation,
                      role: m.role,
                    })),
                    userRole: userRole,
                    areacalcRole: areacalcRole,
                    hasOrganisation: hasOrganisation,
                    hasAreacalc: hasAreacalc,
                    tokenExists: !!localStorage.getItem('access'),
                  }, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Help Strip - Different message based on access */}
          <div className="help-strip">
            <i className="ti ti-info-circle" aria-hidden="true" />
            {!userRole && !hasAreacalc ? (
              <>You don&apos;t have any active roles. Please contact your administrator to get access.</>
            ) : (
              <>Need more access? Contact your organisation admin to update your role.</>
            )}
          </div>
        </>
      )}
    </main>
  );
}