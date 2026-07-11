// app/issues/page.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./issues.css";
import {
  getIssues,
  updateIssue,
  resolveIssue,
  createIssue,
  removeSnapshot,
  removeAttachment,
  addCommentWithSnapshot,
  addComment,
  deleteComment,
  editComment,
  deleteIssue,
  restoreIssue,
  hardDeleteIssue,
} from "./issueApi";
import {
  Issue,
  IssueStatus,
  IssuePriority,
  IssueDomain,
  BcfTopicType,
  isBimIssue,
} from "./issueTypes";
import { IssueCard } from "./IssueCard";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isUserMatch } from '@/components/utils/userMatching';
import { useAppDispatch } from '@/redux/hooks';
import { setUser } from '@/redux/features/authSlice';

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

const STATUS_OPTIONS: IssueStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTIONS: IssuePriority[] = ["High", "Medium", "Low"];
const TOPIC_TYPE_OPTIONS: BcfTopicType[] = [
  "Clash",
  "Coordinate",
  "Quality",
  "Safety",
  "General",
  "Request",
  "Fault",
];

const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 0 };
const DEFAULT_CAMERA_DIRECTION = { x: 0, y: 0, z: -1 };
const DEFAULT_CAMERA_UP_VECTOR = { x: 0, y: 1, z: 0 };
const DEFAULT_FIELD_OF_VIEW = 60;

// Interfaces for dropdowns
interface OrganisationOption {
  id: number;
  name: string;
}

interface ProjectOption {
  id: number;
  name: string;
  organisation_id: number;
  organisation_name: string;
}

export default function IssuesPage() {
  const dispatch = useAppDispatch();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<"all" | IssueDomain>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentSortOrder, setCommentSortOrder] = useState<"asc" | "desc">("desc");
  const [deletedCount, setDeletedCount] = useState(0); // ✅ New state for deleted count

  // Load user from localStorage into Redux on mount
  useEffect(() => {
    const loadUserFromStorage = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          console.log('✅ Loading user from localStorage into Redux:', userData);
          dispatch(setUser(userData));
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    };
    loadUserFromStorage();
  }, [dispatch]);

  const currentUserData = useCurrentUser();
  
  // Check if user is admin
  const isAdmin = currentUserData?.is_staff || currentUserData?.is_superuser || false;

  const currentUser = {
    email: currentUserData?.email || '',
    fullName: currentUserData?.full_name || currentUserData?.display_name || '',
    username: currentUserData?.username || '',
    displayName: currentUserData?.display_name || currentUserData?.full_name || currentUserData?.email || '',
  };

  const isUserCreator = (reportedBy: string, user: { email: string; fullName: string; username: string; displayName: string }): boolean => {
    return isUserMatch(reportedBy, user);
  };

  const refresh = async () => {
    try {
      setError(null);
      console.log(`🔄 Refreshing issues with include_deleted=${showDeleted}...`);

      // ✅ Step 1: Always fetch ALL issues to get the deleted count
      const allIssues = await getIssues({ include_deleted: true });
      const deleted = allIssues.filter(i => i.is_deleted === true);
      setDeletedCount(deleted.length);
      console.log(`📊 Deleted count: ${deleted.length}`);

      // ✅ Step 2: Fetch issues based on showDeleted state
      const data = await getIssues({ 
        include_deleted: showDeleted
      });
      
      console.log(`✅ Issues fetched: ${data.length} items`);
      data.forEach(issue => {
        const isCreator = isUserCreator(issue.reportedBy, currentUser);
        console.log(`📋 Issue #${issue.id}: "${issue.title}" - is_deleted: ${issue.is_deleted}, isCreator: ${isCreator}`);
      });

      setIssues(data);
      return data;
    } catch (err: any) {
      console.error('Refresh error:', err);
      setError('Failed to load issues. Please try again.');
      throw err;
    }
  };

  // Initial load - only show non-deleted by default
  useEffect(() => {
    console.log('📡 Initial load');
    refresh().finally(() => setLoading(false));
  }, []);

  // Re-fetch when showDeleted changes
  useEffect(() => {
    console.log(`📡 showDeleted changed to: ${showDeleted}, loading: ${loading}`);
    if (!loading) {
      refresh();
    }
  }, [showDeleted, loading]);

  const visibleIssues = issues.filter((issue) => {
    if (domainFilter !== "all" && issue.domain !== domainFilter) return false;
    if (!showDeleted && issue.is_deleted === true) return false;
    return true;
  });

  console.log(
    `🧮 RENDER — showDeleted=${showDeleted}, domainFilter="${domainFilter}", ` +
    `issues.length=${issues.length}, visibleIssues.length=${visibleIssues.length}, deletedCount=${deletedCount}`
  );

  // ✅ Use the separate deletedCount state, not issues.filter
  // const deletedIssuesCount = issues.filter(i => i.is_deleted === true).length; // ← REMOVE THIS

  const openIssues = issues.filter((i) => i.status === "Open" && !i.is_deleted).length;
  const inProgressIssues = issues.filter((i) => i.status === "In Progress" && !i.is_deleted).length;
  const resolvedIssues = issues.filter((i) => i.status === "Resolved" && !i.is_deleted).length;
  const bimIssueCount = issues.filter(i => isBimIssue(i) && !i.is_deleted).length;
  const clashIssues = issues.filter(i => isBimIssue(i) && i.topicType === "Clash" && !i.is_deleted).length;
  const highPriorityIssues = issues.filter((i) => i.priority === "High" && !i.is_deleted).length;

  const assignees = [...new Set(
    issues
      .filter(i => !i.is_deleted)
      .map((i) => i.assignedTo)
      .filter(Boolean)
  )] as string[];

  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm('Are you sure you want to delete this issue? This action can be undone by restoring it.')) {
      return;
    }
    try {
      setError(null);
      await deleteIssue(issueId);
      await refresh();
    } catch (err: any) {
      console.error('Delete issue error:', err);
      setError(err.message || 'Failed to delete issue. Please try again.');
    }
  };

  const handleRestoreIssue = async (issueId: string) => {
    try {
      setError(null);
      await restoreIssue(issueId);
      await refresh();
    } catch (err: any) {
      console.error('Restore issue error:', err);
      setError(err.message || 'Failed to restore issue. Please try again.');
    }
  };

  const handleHardDeleteIssue = async (issueId: string) => {
    if (!confirm('⚠️ PERMANENT DELETE: This will permanently remove this issue from the database. This cannot be undone. Are you sure?')) {
      return;
    }
    const confirmText = prompt('Type "DELETE" to confirm permanent deletion:');
    if (confirmText !== 'DELETE') {
      return;
    }
    try {
      setError(null);
      await hardDeleteIssue(issueId);
      await refresh();
    } catch (err: any) {
      console.error('Hard delete error:', err);
      setError(err.message || 'Failed to permanently delete issue. Please try again.');
    }
  };

  const toggleShowDeleted = () => {
    const next = !showDeleted;
    console.log('🔴 DELETED TOGGLE CLICKED! Current:', showDeleted, '->', next);
    setShowDeleted(next);
    if (next) {
      setDomainFilter("all");
    }
  };

  return (
    <main className={`${display.variable} ${mono.variable} issues-page`}>
      <header className="issues-header">
        <div className="issues-brand">
          <span className="issues-brand-icon">
            <i className="ti ti-bug" />
          </span>
          <span className="issues-brand-text">Issue Tracker</span>
        </div>
        <div className="issues-header-actions">
          <div className="domain-tabs">
            <button
              className={`tab ${domainFilter === "all" ? "active" : ""}`}
              onClick={() => setDomainFilter("all")}
            >
              All
            </button>
            <button
              className={`tab ${domainFilter === "bim" ? "active" : ""}`}
              onClick={() => setDomainFilter("bim")}
            >
              BIM
            </button>
            <button
              className={`tab ${domainFilter === "other" ? "active" : ""}`}
              onClick={() => setDomainFilter("other")}
            >
              Other
            </button>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* ✅ Always show the button if there are deleted issues (using deletedCount) */}
            {deletedCount > 0 && (
              <button
                type="button"
                onClick={toggleShowDeleted}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: `2px solid ${showDeleted ? '#D43E3E' : '#6B7280'}`,
                  backgroundColor: showDeleted ? '#D43E3E' : 'transparent',
                  color: showDeleted ? 'white' : '#6B7280',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'system-ui, sans-serif',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <span style={{ fontSize: '16px' }}>🗑️</span>
                {showDeleted ? 'Hide Deleted' : `Deleted (${deletedCount})`}
              </button>
            )}
            <button className="btn-primary" onClick={() => setShowNewIssueForm((v) => !v)}>
              <i className="ti ti-plus" />
              New Issue
            </button>
          </div>
        </div>
      </header>

      <section className="hero">
        <p className="hero-eyebrow">Development</p>
        <h1 className="hero-title">Issues</h1>
        <p className="hero-subtitle">
          Track bugs, feature requests and ongoing improvements across the application — model
          issues (BCF-compatible) and general design issues, side by side.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showNewIssueForm && (
        <NewIssueForm
          onCancel={() => setShowNewIssueForm(false)}
          onCreate={async (input) => {
            try {
              setError(null);
              await createIssue(input);
              await refresh();
              setShowNewIssueForm(false);
            } catch (err: any) {
              console.error('Create error:', err);
              if (err.response?.data) {
                const errors = Object.values(err.response.data).flat().join('\n');
                setError(`Validation Error: ${errors}`);
              } else {
                setError('Failed to create issue. Please try again.');
              }
            }
          }}
        />
      )}

      <section className="stats-grid">
        <StatCard icon="ti-alert-circle" label="Open" value={openIssues} />
        <StatCard icon="ti-loader" label="In Progress" value={inProgressIssues} />
        <StatCard icon="ti-check" label="Resolved" value={resolvedIssues} />
        <StatCard icon="ti-files" label="BCF Topics" value={bimIssueCount} />
        <StatCard icon="ti-cube" label="Clashes" value={clashIssues} />
        <StatCard icon="ti-flag" label="High Priority" value={highPriorityIssues} />
      </section>

      {assignees.length > 0 && (
        <section className="assignees-section">
          <div className="section-title">
            <span>Assigned To</span>
          </div>
          <div className="assignees-grid">
            {assignees.map((assignee) => (
              <div key={assignee} className="assignee-chip">
                <i className="ti ti-user" />
                {assignee}
                <span className="assignee-count">
                  {issues.filter((i) => i.assignedTo === assignee && !i.is_deleted).length}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title">
          <span>All Issues</span>
          <span className="issue-count">
            {visibleIssues.length} shown
            {deletedCount > 0 && !showDeleted && (
              <span style={{ color: '#D43E3E', marginLeft: '8px' }}>
                ({deletedCount} deleted)
              </span>
            )}
            {showDeleted && (
              <span style={{ color: '#4A8B6B', marginLeft: '8px' }}>
                (showing deleted)
              </span>
            )}
            {isAdmin && (
              <span style={{ color: '#6B7280', marginLeft: '8px', fontSize: '12px' }}>
                (Admin)
              </span>
            )}
          </span>
        </div>

        {loading ? (
          <p className="hero-subtitle">Loading issues…</p>
        ) : visibleIssues.length === 0 ? (
          <p className="hero-subtitle">
            {showDeleted ? 'No deleted issues found.' : 'No issues found. Create a new issue to get started!'}
          </p>
        ) : (
          <div className="issues-grid">
            {visibleIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                commentSortOrder={commentSortOrder}
                onSortChange={() => setCommentSortOrder(commentSortOrder === "desc" ? "asc" : "desc")}
                currentUser={currentUser}
                isUserCreator={isUserCreator}
                onDeleteIssue={handleDeleteIssue}
                onRestoreIssue={issue.is_deleted === true ? handleRestoreIssue : undefined}
                isAdmin={isAdmin}
                onHardDelete={handleHardDeleteIssue}
                onSave={async (patch) => {
                  try {
                    setError(null);
                    await updateIssue(issue.id, patch);
                    await refresh();
                  } catch (err: any) {
                    console.error('Update error:', err);
                    if (err.response?.data) {
                      const errors = Object.values(err.response.data).flat().join('\n');
                      setError(`Validation Error: ${errors}`);
                    } else {
                      setError('Failed to update issue. Please try again.');
                    }
                  }
                }}
                onResolve={async (resolution, snapshotData, snapshotFormat) => {
                  try {
                    setError(null);
                    await resolveIssue(issue.id, resolution, currentUser.email, snapshotData, snapshotFormat);
                    await refresh();
                  } catch (err: any) {
                    console.error('Resolve error:', err);
                    if (err.response?.data) {
                      const errors = Object.values(err.response.data).flat().join('\n');
                      setError(`Validation Error: ${errors}`);
                    } else {
                      setError('Failed to resolve issue. Please try again.');
                    }
                  }
                }}
                onRemoveSnapshot={async () => {
                  try {
                    setError(null);
                    await removeSnapshot(issue.id);
                    await refresh();
                  } catch (err: any) {
                    console.error('Remove snapshot error:', err);
                    setError('Failed to remove screenshot. Please try again.');
                  }
                }}
                onRemoveAttachment={async (index) => {
                  try {
                    setError(null);
                    await removeAttachment(issue.id, index);
                    await refresh();
                  } catch (err: any) {
                    console.error('Remove attachment error:', err);
                    setError('Failed to remove screenshot. Please try again.');
                  }
                }}
                onAddScreenshot={async (snapshotData, snapshotFormat) => {
                  try {
                    setError(null);
                    console.log('📸 Adding screenshot to issue:', issue.id);
                    await addCommentWithSnapshot(
                      issue.id,
                      currentUser.email || currentUser.fullName,
                      "Screenshot added",
                      snapshotData,
                      snapshotFormat
                    );
                    await refresh();
                  } catch (err: any) {
                    console.error('Add screenshot error:', err);
                    setError('Failed to add screenshot. Please try again.');
                  }
                }}
                onAddComment={async (text) => {
                  try {
                    setError(null);
                    console.log('💬 Adding comment to issue:', issue.id);
                    await addComment(issue.id, currentUser.email || currentUser.fullName, text);
                    await refresh();
                  } catch (err: any) {
                    console.error('Add comment error:', err);
                    setError('Failed to add comment. Please try again.');
                  }
                }}
                onDeleteComment={async (commentId) => {
                  try {
                    setError(null);
                    await deleteComment(issue.id, commentId);
                    await refresh();
                  } catch (err: any) {
                    console.error('Delete comment error:', err);
                    setError('Failed to delete comment. Please try again.');
                  }
                }}
                onEditComment={async (commentId, text, snapshotData, snapshotFormat, removeSnapshot) => {
                  try {
                    setError(null);
                    await editComment(issue.id, commentId, text, snapshotData, snapshotFormat, removeSnapshot);
                    await refresh();
                  } catch (err: any) {
                    console.error('Edit comment error:', err);
                    setError('Failed to edit comment. Please try again.');
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="stat-card">
      <i className={`ti ${icon} stat-icon`} />
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );
}

function NewIssueForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [domain, setDomain] = useState<IssueDomain>("bim");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("Medium");
  const [topicType, setTopicType] = useState<BcfTopicType>("General");
  const [category, setCategory] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotFormat, setScreenshotFormat] = useState<"png" | "jpg">("png");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [organisationId, setOrganisationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // State for dropdowns
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectOption[]>([]);
  const [loadingOrganisations, setLoadingOrganisations] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserData = useCurrentUser();

  // Fetch user's organisations on mount
  useEffect(() => {
    const fetchOrganisations = async () => {
      setLoadingOrganisations(true);
      try {
        const token = localStorage.getItem('access');
        if (!token) {
          console.error('No access token found');
          setLoadingOrganisations(false);
          return;
        }

        const response = await fetch('http://localhost:8000/api/my-organisations/', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Organisations fetched:', data);
          setOrganisations(data);
          
          // Auto-select first organisation if available
          if (data.length > 0) {
            setOrganisationId(data[0].id);
          }
        } else {
          console.error('Failed to fetch organisations:', response.status);
          setError('Failed to load organisations.');
        }
      } catch (error) {
        console.error('Error fetching organisations:', error);
        setError('Failed to load organisations.');
      } finally {
        setLoadingOrganisations(false);
      }
    };
    fetchOrganisations();
  }, []);

  // Fetch projects when organisation changes
  useEffect(() => {
    if (!organisationId) {
      setFilteredProjects([]);
      setProjectId(null);
      return;
    }

    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const token = localStorage.getItem('access');
        if (!token) {
          console.error('No access token found');
          setLoadingProjects(false);
          return;
        }

        const response = await fetch(`http://localhost:8000/api/organisations/${organisationId}/projects/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Projects fetched for organisation ${organisationId}:`, data);
          setFilteredProjects(data);
          
          // Auto-select first project if available
          if (data.length > 0) {
            setProjectId(data[0].id);
          } else {
            setProjectId(null);
          }
        } else {
          console.error('Failed to fetch projects:', response.status);
          setFilteredProjects([]);
          setProjectId(null);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        setFilteredProjects([]);
        setProjectId(null);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [organisationId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const format = file.type === 'image/jpeg' ? 'jpg' : 'png';
      setScreenshot(base64);
      setScreenshotFormat(format);
      setPreviewImage(dataUrl);
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    try {
      setError(null);

      if (!title.trim()) {
        setError('Title is required');
        return;
      }

      if (!projectId) {
        setError('Please select a project');
        return;
      }

      const base = {
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        status: "Open" as IssueStatus,
        priority,
        module: module.trim() || (domain === "bim" ? "Modeling" : "General"),
      };

      if (domain === "bim") {
        const bimInput = {
          ...base,
          domain: "bim" as const,
          topicType,
          viewpoint: {
            camera_position: DEFAULT_CAMERA_POSITION,
            camera_direction: DEFAULT_CAMERA_DIRECTION,
            camera_up_vector: DEFAULT_CAMERA_UP_VECTOR,
            field_of_view: DEFAULT_FIELD_OF_VIEW,
            clipping_planes: [],
            ...(screenshot ? {
              snapshot_data: screenshot,
              snapshot_format: screenshotFormat,
            } : {})
          }
        };
        console.log('📤 Creating BIM issue with viewpoint:', bimInput.viewpoint);
        await onCreate(bimInput);
      } else {
        await onCreate({
          ...base,
          domain: "other" as const,
          category: category.trim() || undefined,
          ...(screenshot ? {
            newAttachmentData: screenshot,
            newAttachmentFormat: screenshotFormat,
          } : {})
        });
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      if (err.response?.data) {
        const errors = Object.values(err.response.data).flat().join('\n');
        setError(`Validation Error: ${errors}`);
      } else {
        setError('Failed to create issue. Please try again.');
      }
    }
  };

  return (
    <section className="new-issue-form">
      {error && (
        <div className="error-banner small">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {uploadError && (
        <div className="error-banner small">
          <i className="ti ti-alert-circle" />
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>✕</button>
        </div>
      )}

      <div className="form-row">
        {/* Organisation Dropdown */}
        <div className="form-field">
          <label>Organisation <span style={{ color: '#D43E3E' }}>*</span></label>
          {loadingOrganisations ? (
            <div className="loading-indicator">Loading organisations...</div>
          ) : organisations.length > 0 ? (
            <select
              className="field-select"
              value={organisationId || ''}
              onChange={(e) => setOrganisationId(Number(e.target.value))}
              required
            >
              <option value="">Select an organisation...</option>
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ color: '#D43E3E', fontSize: '14px', padding: '8px' }}>
              You are not a member of any organisation.
            </div>
          )}
        </div>

        {/* Project Dropdown */}
        <div className="form-field">
          <label>Project <span style={{ color: '#D43E3E' }}>*</span></label>
          {loadingProjects ? (
            <div className="loading-indicator">Loading projects...</div>
          ) : organisationId ? (
            <select
              className="field-select"
              value={projectId || ''}
              onChange={(e) => setProjectId(Number(e.target.value))}
              required
              disabled={filteredProjects.length === 0}
            >
              <option value="">Select a project...</option>
              {filteredProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ color: '#6B7280', fontSize: '14px', padding: '8px' }}>
              Please select an organisation first
            </div>
          )}
          {filteredProjects.length === 0 && organisationId && !loadingProjects && (
            <div style={{ color: '#D43E3E', fontSize: '12px', marginTop: '4px' }}>
              No projects available in this organisation.
            </div>
          )}
        </div>

        <div className="form-field">
          <label>Type</label>
          <select className="field-select" value={domain} onChange={(e) => setDomain(e.target.value as IssueDomain)}>
            <option value="bim">BIM (model-linked, BCF)</option>
            <option value="other">Other (general)</option>
          </select>
        </div>

        {domain === "bim" ? (
          <div className="form-field">
            <label>Topic type</label>
            <select
              className="field-select"
              value={topicType}
              onChange={(e) => setTopicType(e.target.value as BcfTopicType)}
            >
              {TOPIC_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-field">
            <label>Category</label>
            <input
              className="field-input"
              placeholder="e.g. Documentation"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        )}
        
        <div className="form-field">
          <label>Priority</label>
          <select
            className="field-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label>Title <span style={{ color: '#D43E3E' }}>*</span></label>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="form-field">
        <label>Description</label>
        <textarea
          className="field-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>Module</label>
        <input
          className="field-input"
          placeholder={domain === "bim" ? "e.g. Modeling" : "e.g. Documentation"}
          value={module}
          onChange={(e) => setModule(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>Screenshot (optional)</label>
        <div className="btn-with-screenshot">
          <button
            className="btn-outline"
            style={{ width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="ti ti-camera" /> Upload screenshot (max 5MB)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
        {previewImage && (
          <div className="screenshot-preview">
            <img src={previewImage} alt="Preview" />
            <button
              className="remove-btn"
              onClick={() => {
                setScreenshot(null);
                setPreviewImage(null);
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button 
          className="btn-primary" 
          onClick={handleSubmit}
          disabled={!projectId || !title.trim() || !organisationId}
        >
          <i className="ti ti-plus" /> Create Issue
        </button>
      </div>
    </section>
  );
}