// ---------------------------------------------------------------------------
// Shared meeting model
// ---------------------------------------------------------------------------

export type MeetingStatus = "Scheduled" | "Ongoing" | "Completed" | "Cancelled";
export type MeetingPriority = "High" | "Medium" | "Low";
export type MeetingType = "Internal" | "Client" | "Review" | "Planning" | "Standup" | "Other";

// ---------------------------------------------------------------------------
// Meeting Attendee
// ---------------------------------------------------------------------------

export interface MeetingAttendee {
  id: string | number;
  userId?: number;        // NEW — the underlying user's id, for "is this me?" checks
  name: string;
  email?: string;
  avatar?: string;
  response?: "accepted" | "declined" | "pending" | "tentative";
}

// ---------------------------------------------------------------------------
// Meeting Comment
// ---------------------------------------------------------------------------

export interface MeetingComment {
  id: string;
  author: string;
  text: string;
  timestamp: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Linked Issue (simplified version for display)
// ---------------------------------------------------------------------------

export interface LinkedIssue {
  id: string | number;
  title: string;
  domain: "bim" | "design";
  status: string;
  priority: string;
  topicType?: string;
  bcfGuid?: string;
}

// ---------------------------------------------------------------------------
// Meeting
// ---------------------------------------------------------------------------

export interface Meeting {
  id: string | number;
  title: string;
  description: string;
  type: MeetingType;
  status: MeetingStatus;
  priority: MeetingPriority;
  startTime: string; // ISO 8601 datetime
  endTime: string; // ISO 8601 datetime
  location: string;
  isOnline: boolean;
  meetingLink?: string;
  organizer: string;
  organizerId: number | null;
  attendees: MeetingAttendee[];
  agenda: string[];
  notes?: string;
  created: string;
  updated?: string;
  comments: MeetingComment[];
  projectId?: number;
  deliverable?: number | null;
  recurrence?: {
    frequency: "daily" | "weekly" | "biweekly" | "monthly";
    interval: number;
    endDate?: string;
  };
  tags?: string[];
  linkedIssues?: LinkedIssue[]; // Issues to be discussed in this meeting
  linkedIssueIds?: (string | number)[]; // For API payload
  canManage?: boolean;        // NEW
  organisationId?: number | null;  // NEW
}

// ---------------------------------------------------------------------------
// API Request/Response Types
// ---------------------------------------------------------------------------

export interface MeetingListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Meeting[];
}

export interface MeetingCreatePayload {
  title: string;
  description?: string;
  type: MeetingType;
  priority?: MeetingPriority;
  start_time: string;
  end_time: string;
  location?: string;
  is_online?: boolean;
  meeting_link?: string;
  organizer_id?: number;
  attendee_ids?: number[];
  agenda?: string[];
  project?: number;
  deliverable?: number | null;
  tags?: string[];
  recurrence?: {
    frequency: "daily" | "weekly" | "biweekly" | "monthly";
    interval: number;
    end_date?: string;
  };
  linked_issue_ids?: (string | number)[];
}

export interface MeetingUpdatePayload extends Partial<MeetingCreatePayload> {
  status?: MeetingStatus;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MEETING_STATUS_OPTIONS: MeetingStatus[] = ["Scheduled", "Ongoing", "Completed", "Cancelled"];
export const MEETING_PRIORITY_OPTIONS: MeetingPriority[] = ["High", "Medium", "Low"];
export const MEETING_TYPE_OPTIONS: MeetingType[] = ["Internal", "Client", "Review", "Planning", "Standup", "Other"];

// ---------------------------------------------------------------------------
// Display Helpers
// ---------------------------------------------------------------------------

export const getMeetingStatusColor = (status: MeetingStatus): string => {
  const colors: Record<MeetingStatus, string> = {
    "Scheduled": "#3B82F6", // Blue
    "Ongoing": "#E8A838", // Yellow
    "Completed": "#4A8B6B", // Green
    "Cancelled": "#6B7280", // Gray
  };
  return colors[status] || "#6B7280";
};

export const getMeetingPriorityColor = (priority: MeetingPriority): string => {
  const colors: Record<MeetingPriority, string> = {
    "High": "#D43E3E",
    "Medium": "#E8A838",
    "Low": "#4A8B6B",
  };
  return colors[priority] || "#6B7280";
};

export const getMeetingTypeLabel = (type: MeetingType): string => {
  return type;
};

export const getMeetingTypeIcon = (type: MeetingType): string => {
  const icons: Record<MeetingType, string> = {
    "Internal": "ti-users",
    "Client": "ti-user-check",
    "Review": "ti-zoom-code",
    "Planning": "ti-calendar-stats",
    "Standup": "ti-urgent",
    "Other": "ti-dots",
  };
  return icons[type] || "ti-calendar-event";
};