'use client';

import React, { useEffect, useState } from 'react';
import {
  fetchClientDashboard,
  fetchAllIssues,
  ClientDashboardData,
  ClientProjectSummary,
  BCFIssue,
} from '@/app/client/clientApi';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  color?: string;
}

function StatCard({ label, value, subtext, icon, trend, color }: StatCardProps) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIconWrapper}>{icon}</div>
      <div style={styles.statContent}>
        <div style={styles.statLabel}>{label}</div>
        <div
          style={{
            ...styles.statValue,
            color: color || '#1e293b',
          }}
        >
          {value}
          {trend && (
            <span style={{ fontSize: '14px', marginLeft: '6px' }}>
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
        </div>
        {subtext && <div style={styles.statSubtext}>{subtext}</div>}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ClientProjectSummary;
  issues: BCFIssue[];
  onViewIssues: (projectId: number) => void;
}

function ProjectCard({ project, issues, onViewIssues }: ProjectCardProps) {
  const criticalCount = issues.filter((i) => i.priority === 'critical').length;
  const openCount = issues.filter(
    (i) => i.status === 'open' || i.status === 'in_progress'
  ).length;

  const stageColors: Record<string, string> = {
    '1': '#e0e7ff',
    '2': '#cffafe',
    '3': '#dcfce7',
    '4': '#fef3c7',
    '5': '#fce7f3',
  };

  return (
    <div style={styles.projectCard}>
      {/* Project header */}
      <div style={styles.projectHeader}>
        <div>
          <h3 style={styles.projectName}>{project.project.name}</h3>
          <p style={styles.projectLocation}>{project.project.location}</p>
        </div>
        <span
          style={{
            ...styles.stageBadge,
            backgroundColor:
              stageColors[project.project.current_stage] || '#f1f5f9',
          }}
        >
          {project.current_stage_label}
        </span>
      </div>

      {/* Progress bar for payment */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Payment Progress</span>
          <span style={styles.percentageText}>
            {project.payment_percentage}%
          </span>
        </div>
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${project.payment_percentage}%`,
              backgroundColor:
                project.payment_percentage >= 80
                  ? '#16a34a'
                  : project.payment_percentage >= 50
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          />
        </div>
        <div style={styles.feeBreakdown}>
          <div style={styles.feeItem}>
            <span style={styles.feeLabel}>Total Fees</span>
            <span style={styles.feeValue}>
              ₹{project.total_fees.toLocaleString()}
            </span>
          </div>
          <div style={styles.feeItem}>
            <span style={styles.feeLabel}>Paid</span>
            <span style={{ ...styles.feeValue, color: '#16a34a' }}>
              ₹{project.fees_paid.toLocaleString()}
            </span>
          </div>
          <div style={styles.feeItem}>
            <span style={styles.feeLabel}>Pending</span>
            <span style={{ ...styles.feeValue, color: '#dc2626' }}>
              ₹{project.fees_pending.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Issues summary */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>BIM Model Issues</span>
          <button
            style={styles.viewButton}
            onClick={() => onViewIssues(project.project.id)}
          >
            View All →
          </button>
        </div>
        <div style={styles.issuesGrid}>
          <div style={styles.issueStat}>
            <div style={styles.issueCount}>{issues.length}</div>
            <div style={styles.issueLabel}>Total</div>
          </div>
          <div style={styles.issueStat}>
            <div style={{ ...styles.issueCount, color: '#dc2626' }}>
              {criticalCount}
            </div>
            <div style={styles.issueLabel}>Critical</div>
          </div>
          <div style={styles.issueStat}>
            <div style={{ ...styles.issueCount, color: '#f59e0b' }}>
              {openCount}
            </div>
            <div style={styles.issueLabel}>Open</div>
          </div>
        </div>

        {/* Recent issues preview */}
        {issues.slice(0, 2).map((issue) => (
          <div key={issue.id} style={styles.issuePreview}>
            <div style={styles.issuePreviewHeader}>
              <span
                style={{
                  ...styles.priorityBadge,
                  backgroundColor:
                    issue.priority === 'critical'
                      ? '#fecaca'
                      : issue.priority === 'high'
                      ? '#fed7aa'
                      : '#e0e7ff',
                  color:
                    issue.priority === 'critical'
                      ? '#991b1b'
                      : issue.priority === 'high'
                      ? '#9a3412'
                      : '#3730a3',
                }}
              >
                {issue.priority}
              </span>
              <span
                style={{
                  ...styles.statusBadge,
                  backgroundColor:
                    issue.status === 'open'
                      ? '#fecaca'
                      : issue.status === 'in_progress'
                      ? '#bfdbfe'
                      : '#dcfce7',
                }}
              >
                {issue.status.replace('_', ' ')}
              </span>
            </div>
            <div style={styles.issueTitle}>{issue.title}</div>
            <div style={styles.issueMeta}>
              <span>{issue.location_in_model}</span>
              <span>Due: {issue.due_date || 'N/A'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Next milestone */}
      {project.next_milestone && (
        <div style={styles.milestone}>
          <span style={styles.milestoneIcon}>📅</span>
          <span style={styles.milestoneText}>{project.next_milestone}</span>
        </div>
      )}
    </div>
  );
}

interface IssuesModalProps {
  projectName: string;
  issues: BCFIssue[];
  onClose: () => void;
}

function IssuesModal({ projectName, issues, onClose }: IssuesModalProps) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3>Issues - {projectName}</h3>
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={styles.modalBody}>
          {issues.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
              No issues reported yet.
            </p>
          ) : (
            issues.map((issue) => (
              <div key={issue.id} style={styles.issueDetail}>
                <div style={styles.issueDetailHeader}>
                  <span
                    style={{
                      ...styles.priorityBadge,
                      backgroundColor:
                        issue.priority === 'critical'
                          ? '#fecaca'
                          : issue.priority === 'high'
                          ? '#fed7aa'
                          : '#e0e7ff',
                    }}
                  >
                    {issue.priority}
                  </span>
                  <span style={styles.issueType}>{issue.type}</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor:
                        issue.status === 'open'
                          ? '#fecaca'
                          : issue.status === 'in_progress'
                          ? '#bfdbfe'
                          : '#dcfce7',
                    }}
                  >
                    {issue.status.replace('_', ' ')}
                  </span>
                </div>
                <h4 style={styles.issueDetailTitle}>{issue.title}</h4>
                <p style={styles.issueDescription}>{issue.description}</p>
                <div style={styles.issueDetailMeta}>
                  <span>📍 {issue.location_in_model}</span>
                  <span>👤 {issue.assigned_to}</span>
                  <span>💬 {issue.comments_count} comments</span>
                  <span>📅 Due: {issue.due_date || 'N/A'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<ClientDashboardData | null>(null);
  const [allIssues, setAllIssues] = useState<Record<number, BCFIssue[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [dashboardData, issuesData] = await Promise.all([
          fetchClientDashboard(),
          fetchAllIssues(),
        ]);
        setDashboard(dashboardData);
        setAllIssues(issuesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrapper}>
          <div style={styles.spinner} />
          <p style={{ color: '#64748b', marginTop: '16px' }}>
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------
  if (error || !dashboard) {
    return (
      <div style={styles.container}>
        <div style={styles.errorWrapper}>
          <div style={styles.errorIcon}>⚠️</div>
          <h2 style={{ color: '#991b1b', marginTop: '12px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#64748b' }}>{error || 'Unable to load data'}</p>
          <button
            style={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Selected project for issues modal
  // ---------------------------------------------------------------------------
  const selectedProject = dashboard.projects.find(
    (p) => p.project.id === selectedProjectId
  );

  // ---------------------------------------------------------------------------
  // Render Dashboard
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.container}>
      {/* Welcome banner */}
      <div style={styles.welcomeBanner}>
        <div>
          <h1 style={styles.welcomeTitle}>
            Welcome back, {dashboard.client_name}
          </h1>
          <p style={styles.welcomeSubtext}>
            {dashboard.client_organisation} •{' '}
            {dashboard.total_projects} Active Project
            {dashboard.total_projects !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={styles.lastUpdated}>
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Summary stats */}
      <div style={styles.statsGrid}>
        <StatCard
          label="Active Projects"
          value={dashboard.total_projects}
          icon={<span style={styles.icon}>📁</span>}
          subtext="In progress"
        />
        <StatCard
          label="Total Paid"
          value={`₹${dashboard.total_paid_amount.toLocaleString()}`}
          icon={<span style={styles.icon}>✅</span>}
          color="#16a34a"
          trend="up"
        />
        <StatCard
          label="Outstanding"
          value={`₹${dashboard.total_outstanding_amount.toLocaleString()}`}
          icon={<span style={styles.icon}>⏳</span>}
          color="#dc2626"
          subtext={`${(100 - dashboard.overall_payment_percentage).toFixed(1)}% pending`}
        />
        <StatCard
          label="Open Issues"
          value={dashboard.total_open_issues}
          icon={<span style={styles.icon}>🔍</span>}
          color={dashboard.total_open_issues > 5 ? '#dc2626' : '#1e293b'}
          subtext="Across all projects"
        />
      </div>

      {/* Overall payment progress */}
      <div style={styles.overallProgress}>
        <div style={styles.overallProgressHeader}>
          <span>Overall Payment Progress</span>
          <span style={styles.percentageText}>
            {dashboard.overall_payment_percentage.toFixed(1)}%
          </span>
        </div>
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${dashboard.overall_payment_percentage}%`,
              backgroundColor:
                dashboard.overall_payment_percentage >= 80
                  ? '#16a34a'
                  : dashboard.overall_payment_percentage >= 50
                  ? '#f59e0b'
                  : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Project cards */}
      <div style={styles.projectsSection}>
        <h2 style={styles.sectionHeading}>Your Projects</h2>
        <div style={styles.projectsGrid}>
          {dashboard.projects.map((project) => (
            <ProjectCard
              key={project.project.id}
              project={project}
              issues={allIssues[project.project.id] || []}
              onViewIssues={setSelectedProjectId}
            />
          ))}
        </div>
      </div>

      {/* Issues Modal */}
      {selectedProject && selectedProjectId && (
        <IssuesModal
          projectName={selectedProject.project.name}
          issues={allIssues[selectedProjectId] || []}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '24px 20px 60px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#1e293b',
  },

  // Loading & Error
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  errorIcon: { fontSize: '48px' },
  retryButton: {
    marginTop: '16px',
    padding: '10px 24px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },

  // Welcome banner
  welcomeBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  welcomeTitle: {
    fontSize: '26px',
    fontWeight: 700,
    margin: 0,
    color: '#0f172a',
  },
  welcomeSubtext: {
    margin: '4px 0 0',
    color: '#64748b',
    fontSize: '14px',
  },
  lastUpdated: {
    fontSize: '12px',
    color: '#94a3b8',
    paddingTop: '6px',
  },

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  statIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: '22px' },
  statContent: { flex: 1 },
  statLabel: { fontSize: '13px', color: '#64748b', fontWeight: 500 },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    marginTop: '2px',
  },
  statSubtext: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },

  // Overall progress
  overallProgress: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  overallProgressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '8px',
  },

  // Projects section
  projectsSection: { marginTop: '8px' },
  sectionHeading: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '16px',
    color: '#0f172a',
  },
  projectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: '20px',
  },

  // Project card
  projectCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.2s',
  },
  projectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    gap: '12px',
  },
  projectName: {
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    color: '#0f172a',
  },
  projectLocation: {
    margin: '2px 0 0',
    fontSize: '13px',
    color: '#64748b',
  },
  stageBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // Section
  section: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f1f5f9',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#334155' },
  percentageText: { fontSize: '14px', fontWeight: 700, color: '#1e293b' },
  viewButton: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },

  // Progress bar
  progressBarBg: {
    width: '100%',
    height: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },

  // Fee breakdown
  feeBreakdown: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  feeItem: { textAlign: 'center' },
  feeLabel: { fontSize: '11px', color: '#94a3b8', display: 'block' },
  feeValue: { fontSize: '14px', fontWeight: 600, display: 'block' },

  // Issues
  issuesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '10px',
  },
  issueStat: {
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '8px',
  },
  issueCount: { fontSize: '18px', fontWeight: 700 },
  issueLabel: { fontSize: '11px', color: '#64748b' },

  // Issue preview
  issuePreview: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '8px',
  },
  issuePreviewHeader: {
    display: 'flex',
    gap: '6px',
    marginBottom: '4px',
  },
  priorityBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  issueTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '4px',
  },
  issueMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#94a3b8',
  },

  // Milestone
  milestone: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#fefce8',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
  },
  milestoneIcon: { fontSize: '16px' },
  milestoneText: { color: '#854d0e', fontWeight: 500 },

  // Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#64748b',
  },
  modalBody: {
    padding: '16px 24px',
    overflowY: 'auto',
    flex: 1,
  },

  // Issue detail (in modal)
  issueDetail: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '12px',
  },
  issueDetailHeader: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center',
  },
  issueType: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  issueDetailTitle: {
    fontSize: '15px',
    fontWeight: 600,
    margin: '0 0 6px',
    color: '#1e293b',
  },
  issueDescription: {
    fontSize: '13px',
    color: '#475569',
    margin: '0 0 10px',
    lineHeight: 1.5,
  },
  issueDetailMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    fontSize: '12px',
    color: '#64748b',
  },
};

// Add keyframe animation for spinner (in Next.js, add this to global CSS or use styled-jsx)
// @keyframes spin { to { transform: rotate(360deg); } }