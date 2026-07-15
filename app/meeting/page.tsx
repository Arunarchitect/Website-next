"use client";

import { useEffect, useState } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./meetings.css";
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getAvailableIssues,
} from "./meetingApi";
import {
  Meeting,
  MeetingStatus,
  MeetingPriority,
  MeetingType,
  LinkedIssue,
  getMeetingTypeIcon,
  getMeetingTypeLabel,
  MEETING_STATUS_OPTIONS,
  MEETING_PRIORITY_OPTIONS,
  MEETING_TYPE_OPTIONS,
} from "./meetingTypes";

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

const CURRENT_USER = "You";

// ---------------------------------------------------------------------------
// Shape of the payload built by NewMeetingForm and handed to createMeeting().
// Mirrors exactly what handleSubmit constructs below.
// ---------------------------------------------------------------------------

interface NewMeetingInput {
  title: string;
  description: string;
  type: MeetingType;
  priority: MeetingPriority;
  startTime: string;
  endTime: string;
  location: string;
  isOnline: boolean;
  meetingLink?: string;
  agenda: string[];
  project: number;
}

// Narrow an unknown error into a readable message without resorting to `any`.
function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// Helper to format date for display
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Helper to get the date string in local timezone (YYYY-MM-DD)
const getLocalDateStr = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to check if two dates are the same day (in local timezone)
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

// Helper to get days in month
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// Helper to get first day of month
const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewMeetingForm, setShowNewMeetingForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const data = await getMeetings();
      setMeetings(data);
    } catch (err: unknown) {
      console.error('Refresh error:', err);
      setError('Failed to load meetings. Please try again.');
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const todayStr = getLocalDateStr(today);

  // Get meetings for selected date
  const selectedDateStr = getLocalDateStr(selectedDate);
  const meetingsOnSelectedDate = meetings.filter(m => {
    const mDate = new Date(m.startTime);
    return getLocalDateStr(mDate) === selectedDateStr;
  });

  // TODAY'S meetings
  const todaysMeetings = meetings.filter(m => {
    const mDate = new Date(m.startTime);
    return isSameDay(mDate, today) && m.status !== "Cancelled";
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // UPCOMING meetings (next 7 days, excluding today)
  const upcomingMeetings = meetings.filter(m => {
    const mDate = new Date(m.startTime);
    const diffDays = Math.ceil((mDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7 && m.status !== "Cancelled";
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Check if a date has meetings
  const hasMeetingOnDate = (date: number) => {
    const checkDate = new Date(currentYear, currentMonth, date);
    const dateStr = getLocalDateStr(checkDate);
    return meetings.some(m => {
      const mDate = new Date(m.startTime);
      return getLocalDateStr(mDate) === dateStr && m.status !== "Cancelled";
    });
  };

  // Check if date is today
  const isToday = (date: number) => {
    const checkDate = new Date(currentYear, currentMonth, date);
    return getLocalDateStr(checkDate) === todayStr;
  };

  // Render calendar
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const hasMeeting = hasMeetingOnDate(day);
      const isTodayDate = isToday(day);
      const isSelected = day === selectedDate.getDate() && 
                        currentMonth === selectedDate.getMonth() && 
                        currentYear === selectedDate.getFullYear();

      days.push(
        <div 
          key={day}
          className={`calendar-day ${hasMeeting ? 'has-meeting' : ''} ${isTodayDate ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => {
            const newDate = new Date(currentYear, currentMonth, day);
            setSelectedDate(newDate);
          }}
        >
          <span>{day}</span>
          {hasMeeting && <span className="meeting-dot"></span>}
        </div>
      );
    }

    return days;
  };

  const changeMonth = (delta: number) => {
    const newMonth = currentMonth + delta;
    if (newMonth > 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else if (newMonth < 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(newMonth);
    }
  };

  return (
    <main className={`${display.variable} ${mono.variable} meetings-page`}>
      <header className="meetings-header">
        <div className="meetings-brand">
          <span className="meetings-brand-icon">
            <i className="ti ti-calendar-event" />
          </span>
          <span className="meetings-brand-text">Meetings</span>
        </div>
        <div className="meetings-header-actions">
          <button className="btn-primary" onClick={() => setShowNewMeetingForm((v) => !v)}>
            <i className="ti ti-plus" />
            New Meeting
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="hero-eyebrow">Schedule</p>
        <h1 className="hero-title">Meetings</h1>
        <p className="hero-subtitle">
          Manage your team meetings, client syncs, and reviews. View your schedule at a glance
          and track meeting outcomes.
        </p>
      </section>

      {error && (
        <div className="error-banner">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showNewMeetingForm && (
        <NewMeetingForm
          onCancel={() => setShowNewMeetingForm(false)}
          onCreate={async (input) => {
            try {
              setError(null);
              await createMeeting(input);
              await refresh();
              setShowNewMeetingForm(false);
            } catch (err: unknown) {
              console.error('Create error:', err);
              setError(getErrorMessage(err, 'Failed to create meeting. Please try again.'));
            }
          }}
        />
      )}

      <div className="meetings-layout">
        <div className="meetings-left">
          {/* TODAY'S MEETINGS */}
          <section className="upcoming-section">
            <div className="section-title">
              <span>Today ({todaysMeetings.length})</span>
              <span className="today-date">{formatDate(todayStr)}</span>
            </div>
            {todaysMeetings.length === 0 ? (
              <p className="empty-message">No meetings scheduled for today</p>
            ) : (
              <div className="upcoming-list">
                {todaysMeetings.map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="upcoming-item"
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <div className="upcoming-time">
                      <span className="upcoming-time-text">{formatTime(meeting.startTime)}</span>
                      <span className="upcoming-time-end">- {formatTime(meeting.endTime)}</span>
                    </div>
                    <div className="upcoming-info">
                      <h4>{meeting.title}</h4>
                      <div className="upcoming-meta">
                        <span className={`meeting-type-badge type-${meeting.type.toLowerCase()}`}>
                          <i className={`ti ${getMeetingTypeIcon(meeting.type)}`} />
                          {getMeetingTypeLabel(meeting.type)}
                        </span>
                        <span className="meeting-location">
                          <i className="ti ti-map-pin" />
                          {meeting.location}
                        </span>
                        {meeting.linkedIssues && meeting.linkedIssues.length > 0 && (
                          <span className="linked-issues-indicator">
                            <i className="ti ti-link" />
                            {meeting.linkedIssues.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* UPCOMING MEETINGS */}
          <section className="upcoming-section">
            <div className="section-title">
              <span>Upcoming ({upcomingMeetings.length})</span>
              <span>Next 7 days</span>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className="empty-message">No upcoming meetings in the next 7 days</p>
            ) : (
              <div className="upcoming-list">
                {upcomingMeetings.slice(0, 5).map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className="upcoming-item"
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <div className="upcoming-time">
                      <span className="upcoming-date">{formatDate(meeting.startTime)}</span>
                      <span className="upcoming-time-text">{formatTime(meeting.startTime)}</span>
                    </div>
                    <div className="upcoming-info">
                      <h4>{meeting.title}</h4>
                      <div className="upcoming-meta">
                        <span className={`meeting-type-badge type-${meeting.type.toLowerCase()}`}>
                          <i className={`ti ${getMeetingTypeIcon(meeting.type)}`} />
                          {getMeetingTypeLabel(meeting.type)}
                        </span>
                        {meeting.linkedIssues && meeting.linkedIssues.length > 0 && (
                          <span className="linked-issues-indicator">
                            <i className="ti ti-link" />
                            {meeting.linkedIssues.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* CALENDAR */}
          <section className="calendar-section">
            <div className="calendar-header">
              <button className="calendar-nav" onClick={() => changeMonth(-1)}>
                <i className="ti ti-chevron-left" />
              </button>
              <h3>
                {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <button className="calendar-nav" onClick={() => changeMonth(1)}>
                <i className="ti ti-chevron-right" />
              </button>
            </div>
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>
            <div className="calendar-grid">
              {renderCalendar()}
            </div>
            <div className="calendar-legend">
              <span className="legend-item">
                <span className="legend-dot"></span>
                Meeting scheduled
              </span>
              <span className="legend-item">
                <span className="legend-dot today-dot"></span>
                Today
              </span>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="meetings-right">
          <section className="day-meetings-section">
            <div className="section-title">
              <span>
                {formatDate(selectedDateStr)}
                {selectedDate.toISOString().split('T')[0] === todayStr && ' (Today)'}
              </span>
              <span className="meeting-count">{meetingsOnSelectedDate.length} meetings</span>
            </div>

            {loading ? (
              <p className="empty-message">Loading meetings...</p>
            ) : meetingsOnSelectedDate.length === 0 ? (
              <p className="empty-message">No meetings on this day</p>
            ) : (
              <div className="day-meetings-list">
                {meetingsOnSelectedDate.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onSelect={() => setSelectedMeeting(meeting)}
                    onUpdate={async (patch) => {
                      try {
                        await updateMeeting(meeting.id, patch);
                        await refresh();
                      } catch (err) {
                        console.error('Update error:', err);
                      }
                    }}
                    onDelete={async () => {
                      if (confirm('Delete this meeting?')) {
                        try {
                          await deleteMeeting(meeting.id);
                          await refresh();
                        } catch (err) {
                          console.error('Delete error:', err);
                        }
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Meeting Detail Modal */}
      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          onUpdate={async (patch) => {
            try {
              await updateMeeting(selectedMeeting.id, patch);
              await refresh();
              setSelectedMeeting({ ...selectedMeeting, ...patch });
            } catch (err) {
              console.error('Update error:', err);
            }
          }}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Meeting Card Component
// ---------------------------------------------------------------------------

function MeetingCard({
  meeting,
  onSelect,
  onUpdate,
  onDelete,
}: {
  meeting: Meeting;
  onSelect: () => void;
  onUpdate: (patch: Partial<Meeting>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    title: meeting.title,
    status: meeting.status,
    priority: meeting.priority,
    notes: meeting.notes || "",
  });

  const handleSave = async () => {
    await onUpdate({
      title: form.title,
      status: form.status,
      priority: form.priority,
      notes: form.notes,
    });
    setIsEditing(false);
  };

  return (
    <div className="meeting-card">
      <div className="meeting-card-left">
        <div className="meeting-time-block">
          <span className="meeting-time-start">{formatTime(meeting.startTime)}</span>
          <span className="meeting-time-end">- {formatTime(meeting.endTime)}</span>
        </div>
      </div>

      <div className="meeting-card-content">
        <div className="meeting-card-header">
          {isEditing ? (
            <input
              className="field-input title-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          ) : (
            <h4 className="meeting-title" onClick={onSelect}>{meeting.title}</h4>
          )}
          <span className={`meeting-status-badge status-${meeting.status.toLowerCase()}`}>
            {meeting.status}
          </span>
        </div>

        {isEditing ? (
          <>
            <div className="form-row small">
              <select
                className="field-select small"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MeetingStatus }))}
              >
                {MEETING_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="field-select small"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as MeetingPriority }))}
              >
                {MEETING_PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <textarea
              className="field-input small"
              placeholder="Notes..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </>
        ) : (
          <div className="meeting-card-meta">
            <span className="meta-item">
              <i className="ti ti-clock" />
              {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
            </span>
            <span className="meta-item">
              <i className="ti ti-map-pin" />
              {meeting.location}
            </span>
            <span className={`priority-badge priority-${meeting.priority.toLowerCase()}`}>
              <i className="ti ti-flag" />
              {meeting.priority}
            </span>
            {meeting.linkedIssues && meeting.linkedIssues.length > 0 && (
              <span className="linked-issues-indicator">
                <i className="ti ti-link" />
                {meeting.linkedIssues.length} issue{meeting.linkedIssues.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        <div className="meeting-card-footer">
          <div className="meeting-attendees">
            {meeting.attendees.slice(0, 3).map((att, i) => (
              <span key={i} className="attendee-avatar" title={att.name}>
                {att.avatar || att.name[0]}
              </span>
            ))}
            {meeting.attendees.length > 3 && (
              <span className="attendee-more">+{meeting.attendees.length - 3}</span>
            )}
          </div>
          <div className="meeting-card-actions">
            {isEditing ? (
              <>
                <button className="btn-outline small" onClick={() => setIsEditing(false)}>Cancel</button>
                <button className="btn-primary small" onClick={handleSave}>Save</button>
              </>
            ) : (
              <>
                <button className="btn-outline small" onClick={() => setIsEditing(true)}>
                  <i className="ti ti-edit" /> Edit
                </button>
                <button className="btn-outline small danger" onClick={onDelete}>
                  <i className="ti ti-trash" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting Detail Modal
// ---------------------------------------------------------------------------

function MeetingDetailModal({
  meeting,
  onClose,
  onUpdate,
}: {
  meeting: Meeting;
  onClose: () => void;
  onUpdate: (patch: Partial<Meeting>) => Promise<void>;
}) {
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [isEditingIssues, setIsEditingIssues] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<(string | number)[]>(
    meeting.linkedIssueIds || []
  );
  const [availableIssues, setAvailableIssues] = useState<LinkedIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Load available issues for linking
  useEffect(() => {
    const loadIssues = async () => {
      setLoadingIssues(true);
      try {
        const issues = await getAvailableIssues(meeting.projectId);
        setAvailableIssues(issues);
      } catch (err) {
        console.error('Error loading issues:', err);
      } finally {
        setLoadingIssues(false);
      }
    };
    if (isEditingIssues) {
      loadIssues();
    }
  }, [isEditingIssues, meeting.projectId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      const currentNotes = meeting.notes || "";
      const updatedNotes = currentNotes 
        ? `${currentNotes}\n\n${CURRENT_USER}: ${newComment.trim()} (${new Date().toLocaleString()})`
        : `${CURRENT_USER}: ${newComment.trim()} (${new Date().toLocaleString()})`;
      await onUpdate({ notes: updatedNotes });
      setNewComment("");
    } catch (err) {
      console.error('Add comment error:', err);
    } finally {
      setAddingComment(false);
    }
  };

  const handleSaveIssues = async () => {
    try {
      await onUpdate({ 
        linkedIssueIds: selectedIssueIds,
      });
      setIsEditingIssues(false);
    } catch (err) {
      console.error('Error saving issues:', err);
    }
  };

  const toggleIssueSelection = (issueId: string | number) => {
    setSelectedIssueIds(prev => 
      prev.includes(issueId) 
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  const getIssueDomainIcon = (domain: string) => {
    return domain === "bim" ? "ti-file-barcode" : "ti-pencil";
  };

  const getIssueStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Open": "#D43E3E",
      "In Progress": "#E8A838",
      "Resolved": "#4A8B6B",
      "Closed": "#6B7280",
    };
    return colors[status] || "#6B7280";
  };

  const getIssuePriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      "High": "#D43E3E",
      "Medium": "#E8A838",
      "Low": "#4A8B6B",
    };
    return colors[priority] || "#6B7280";
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="modal-header">
          <h2>{meeting.title}</h2>
          <span className={`meeting-status-badge status-${meeting.status.toLowerCase()}`}>
            {meeting.status}
          </span>
        </div>

        <div className="modal-body">
          <div className="modal-details-grid">
            <div className="detail-item">
              <i className="ti ti-calendar" />
              <span>{formatDate(meeting.startTime)}</span>
            </div>
            <div className="detail-item">
              <i className="ti ti-clock" />
              <span>{formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}</span>
            </div>
            <div className="detail-item">
              <i className="ti ti-map-pin" />
              <span>{meeting.location} {meeting.isOnline && '(Virtual)'}</span>
            </div>
            {meeting.meetingLink && (
              <div className="detail-item">
                <i className="ti ti-link" />
                <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                  Join Meeting
                </a>
              </div>
            )}
            <div className="detail-item">
              <i className="ti ti-user" />
              <span>Organizer: {meeting.organizer}</span>
            </div>
            <div className="detail-item full-width">
              <i className="ti ti-flag" />
              <span className={`priority-badge priority-${meeting.priority.toLowerCase()}`}>
                {meeting.priority} Priority
              </span>
            </div>
          </div>

          {meeting.description && (
            <div className="modal-section">
              <h4>Description</h4>
              <p>{meeting.description}</p>
            </div>
          )}

          {/* LINKED ISSUES SECTION */}
          <div className="modal-section linked-issues-section">
            <div className="section-header">
              <h4>
                <i className="ti ti-link" />
                Linked Issues ({meeting.linkedIssues?.length || 0})
              </h4>
              <button 
                className="btn-outline small"
                onClick={() => setIsEditingIssues(!isEditingIssues)}
              >
                <i className={`ti ${isEditingIssues ? 'ti-close' : 'ti-edit'}`} />
                {isEditingIssues ? 'Cancel' : 'Manage'}
              </button>
            </div>

            {isEditingIssues ? (
              <div className="issue-selector">
                {loadingIssues ? (
                  <p className="empty-message">Loading issues...</p>
                ) : availableIssues.length === 0 ? (
                  <p className="empty-message">No issues available to link</p>
                ) : (
                  <div className="issue-selector-list">
                    {availableIssues.map((issue) => (
                      <label key={issue.id} className="issue-selector-item">
                        <input
                          type="checkbox"
                          checked={selectedIssueIds.includes(issue.id)}
                          onChange={() => toggleIssueSelection(issue.id)}
                        />
                        <span className={`domain-badge domain-${issue.domain}`}>
                          <i className={`ti ${getIssueDomainIcon(issue.domain)}`} />
                          {issue.domain}
                        </span>
                        <span className="issue-title">{issue.title}</span>
                        <span 
                          className="issue-status-dot"
                          style={{ background: getIssueStatusColor(issue.status) }}
                        />
                        <span className="issue-priority-dot">
                          <i 
                            className="ti ti-flag" 
                            style={{ color: getIssuePriorityColor(issue.priority) }}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="issue-selector-actions">
                  <button 
                    className="btn-primary small"
                    onClick={handleSaveIssues}
                    disabled={loadingIssues}
                  >
                    <i className="ti ti-check" /> Save
                  </button>
                  <button 
                    className="btn-outline small"
                    onClick={() => {
                      setIsEditingIssues(false);
                      setSelectedIssueIds(meeting.linkedIssueIds || []);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="linked-issues-list">
                {meeting.linkedIssues && meeting.linkedIssues.length > 0 ? (
                  meeting.linkedIssues.map((issue) => (
                    <div key={issue.id} className="linked-issue-item">
                      <span className={`domain-badge domain-${issue.domain}`}>
                        <i className={`ti ${getIssueDomainIcon(issue.domain)}`} />
                        {issue.domain}
                      </span>
                      <span className="issue-title">{issue.title}</span>
                      <span 
                        className="issue-status-dot"
                        style={{ background: getIssueStatusColor(issue.status) }}
                      />
                      <span className="issue-priority-dot">
                        <i 
                          className="ti ti-flag" 
                          style={{ color: getIssuePriorityColor(issue.priority) }}
                        />
                      </span>
                      {issue.topicType && (
                        <span className="issue-topic-type">{issue.topicType}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="empty-message">No issues linked to this meeting</p>
                )}
              </div>
            )}
          </div>

          {meeting.agenda && meeting.agenda.length > 0 && (
            <div className="modal-section">
              <h4>Agenda</h4>
              <ul className="agenda-list">
                {meeting.agenda.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="modal-section">
            <h4>Attendees ({meeting.attendees.length})</h4>
            <div className="attendees-list">
              {meeting.attendees.map((att) => (
                <div key={att.id} className="attendee-item">
                  <span className="attendee-avatar medium">{att.avatar || att.name[0]}</span>
                  <span className="attendee-name">{att.name}</span>
                  <span className={`attendee-response response-${att.response}`}>
                    {att.response}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-section">
            <h4>Notes & Comments</h4>
            {meeting.notes ? (
              <div className="notes-content">
                {meeting.notes.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="empty-message">No notes yet</p>
            )}
            
            <div className="comment-input-area">
              <textarea
                className="field-input"
                placeholder="Add a comment or note..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <button 
                className="btn-primary" 
                onClick={handleAddComment}
                disabled={addingComment || !newComment.trim()}
              >
                {addingComment ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          </div>

          {meeting.tags && meeting.tags.length > 0 && (
            <div className="modal-section">
              <h4>Tags</h4>
              <div className="tags-list">
                {meeting.tags.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Meeting Form
// ---------------------------------------------------------------------------

function NewMeetingForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: NewMeetingInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<MeetingType>("Internal");
  const [priority, setPriority] = useState<MeetingPriority>("Medium");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [agenda, setAgenda] = useState("");
  const [projectId, setProjectId] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      
      if (!title.trim()) {
        setError('Title is required');
        return;
      }
      
      if (!startTime || !endTime) {
        setError('Start and end time are required');
        return;
      }
      
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (end <= start) {
        setError('End time must be after start time');
        return;
      }

      const input: NewMeetingInput = {
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        startTime,
        endTime,
        location: location.trim() || (isOnline ? "Virtual" : "TBD"),
        isOnline,
        meetingLink: meetingLink.trim() || undefined,
        agenda: agenda.split('\n').filter(item => item.trim()),
        project: projectId,
      };
      
      await onCreate(input);
    } catch (err: unknown) {
      console.error('Submit error:', err);
      setError(getErrorMessage(err, 'Failed to create meeting. Please try again.'));
    }
  };

  // Set default times
  useEffect(() => {
    if (!startTime) {
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      
      const roundTo30 = (date: Date) => {
        const minutes = date.getMinutes();
        const rounded = Math.ceil(minutes / 30) * 30;
        date.setMinutes(rounded);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
      };
      
      setStartTime(roundTo30(inOneHour).toISOString().slice(0, 16));
      setEndTime(roundTo30(inTwoHours).toISOString().slice(0, 16));
    }
  }, [startTime]);

  return (
    <section className="new-meeting-form">
      {error && (
        <div className="error-banner small">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="form-row">
        <div className="form-field">
          <label>Title *</label>
          <input
            className="field-input"
            placeholder="Meeting title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Type</label>
          <select
            className="field-select"
            value={type}
            onChange={(e) => setType(e.target.value as MeetingType)}
          >
            {MEETING_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Priority</label>
          <select
            className="field-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as MeetingPriority)}
          >
            {MEETING_PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Project ID</label>
          <input
            className="field-input"
            type="number"
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Start Time *</label>
          <input
            className="field-input"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>End Time *</label>
          <input
            className="field-input"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Location</label>
          <input
            className="field-input"
            placeholder="e.g. Conference Room A"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Virtual Meeting</label>
          <div className="toggle-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
              />
              <span>Is online meeting</span>
            </label>
          </div>
        </div>
      </div>

      {isOnline && (
        <div className="form-field">
          <label>Meeting Link</label>
          <input
            className="field-input"
            placeholder="https://meet.google.com/..."
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
        </div>
      )}

      <div className="form-field">
        <label>Description</label>
        <textarea
          className="field-input"
          rows={3}
          placeholder="Meeting description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>Agenda (one item per line)</label>
        <textarea
          className="field-input"
          rows={4}
          placeholder="Item 1&#10;Item 2&#10;Item 3"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSubmit}>
          <i className="ti ti-plus" /> Create Meeting
        </button>
      </div>
    </section>
  );
}