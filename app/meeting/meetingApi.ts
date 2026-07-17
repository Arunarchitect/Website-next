/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Meeting,
  MeetingStatus,
  MeetingPriority,
  MeetingType,
  MeetingAttendee,
  MeetingComment,
  LinkedIssue,
  getMeetingStatusColor,
  getMeetingPriorityColor,
} from "./meetingTypes";

// ---------------------------------------------------------------------------
// API CONFIGURATION
// ---------------------------------------------------------------------------

const BASE = process.env.NEXT_PUBLIC_HOST || "http://localhost:8000";
const API_URL = `${BASE}/api`;

function getToken(): string {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("access") ?? "";
  return token;
}

function authHeaders() {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Current user (decoded from the JWT access token)
// ---------------------------------------------------------------------------
// This is a best-effort decode of the SimpleJWT access token payload —
// it does NOT verify the signature (that's the backend's job), it just
// reads the claims already sitting in localStorage so the UI knows
// "which attendee row is me" for RSVP controls.
//
// If your token doesn't carry `user_id` / `email` claims under these
// exact names, adjust the field names below.

export interface CurrentUser {
  id: number | null;
  email: string | null;
}

export function getCurrentUser(): CurrentUser {
  if (typeof window === "undefined") return { id: null, email: null };
  const token = localStorage.getItem("access");
  if (!token) return { id: null, email: null };

  try {
    const payloadB64 = token.split(".")[1];
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    return {
      id: payload.user_id ?? payload.id ?? null,
      email: payload.email ?? null,
    };
  } catch {
    return { id: null, email: null };
  }
}

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const errorData = await response.json();
      console.error("❌ Error response data:", errorData);
      if (errorData.detail) {
        errorMessage = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === "object") {
        errorMessage = Object.values(errorData).flat().join(", ");
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Helper Functions - Convert Backend to Frontend Types
// ---------------------------------------------------------------------------

function convertBackendMeeting(data: any): Meeting {
  const statusMap: Record<string, MeetingStatus> = {
    "scheduled": "Scheduled",
    "ongoing": "Ongoing",
    "completed": "Completed",
    "cancelled": "Cancelled",
  };

  const priorityMap: Record<string, MeetingPriority> = {
    "high": "High",
    "medium": "Medium",
    "low": "Low",
  };

  const typeMap: Record<string, MeetingType> = {
    "internal": "Internal",
    "client": "Client",
    "review": "Review",
    "planning": "Planning",
    "standup": "Standup",
    "other": "Other",
  };

  const attendees: MeetingAttendee[] = (data.attendees || []).map((att: any) => {
    const user = att.user || att;
    return {
      id: att.id || user?.id,
      userId: user?.id,
      name: user?.full_name || user?.email || "Unknown",
      email: user?.email,
      avatar: user?.full_name?.[0] || user?.email?.[0] || "?",
      response: att.response || "pending",
    };
  });

  const comments: MeetingComment[] = (data.comments || []).map((c: any) => ({
    id: String(c.id),
    author: c.author?.full_name || c.author?.email || "Unknown",
    text: c.text,
    timestamp: c.timestamp,
  }));

  const linkedIssues: LinkedIssue[] = (data.linked_issues || []).map((issue: any) => ({
    id: issue.id,
    title: issue.title,
    domain: issue.domain === "bim" ? "bim" : "design",
    status: issue.status_display || issue.status || "Open",
    priority: issue.priority_display || issue.priority || "Medium",
    topicType: issue.topic_type,
    bcfGuid: issue.bcf_guid,
  }));

  return {
    id: data.id,
    title: data.title || "Untitled Meeting",
    description: data.description || "",
    type: typeMap[data.type] || "Other",
    status: statusMap[data.status] || "Scheduled",
    priority: priorityMap[data.priority] || "Medium",
    startTime: data.start_time,
    endTime: data.end_time,
    location: data.location || "Virtual",
    isOnline: data.is_online || false,
    meetingLink: data.meeting_link || undefined,
    organizer: data.organizer?.full_name || data.organizer?.email || "Unknown",
    organizerId: data.organizer?.id || null,
    attendees: attendees,
    agenda: data.agenda || [],
    notes: data.notes || undefined,
    created: data.created,
    updated: data.updated,
    comments: comments,
    projectId: data.project,
    deliverable: data.deliverable || null,
    tags: data.tags || [],
    linkedIssues: linkedIssues,
    linkedIssueIds: linkedIssues.map(i => i.id),
    canManage: !!data.can_manage,
    organisationId: data.organisation_id ?? null,
  };
}

function convertToBackendPayload(meeting: Partial<Meeting> | any): any {
  const statusMap: Record<string, string> = {
    "Scheduled": "scheduled",
    "Ongoing": "ongoing",
    "Completed": "completed",
    "Cancelled": "cancelled",
  };

  const priorityMap: Record<string, string> = {
    "High": "high",
    "Medium": "medium",
    "Low": "low",
  };

  const typeMap: Record<string, string> = {
    "Internal": "internal",
    "Client": "client",
    "Review": "review",
    "Planning": "planning",
    "Standup": "standup",
    "Other": "other",
  };

  const payload: any = {};

  if (meeting.title !== undefined) payload.title = meeting.title;
  if (meeting.description !== undefined) payload.description = meeting.description;
  if (meeting.type !== undefined) payload.type = typeMap[meeting.type] || "other";
  if (meeting.status !== undefined) payload.status = statusMap[meeting.status] || "scheduled";
  if (meeting.priority !== undefined) payload.priority = priorityMap[meeting.priority] || "medium";
  if (meeting.startTime !== undefined) payload.start_time = meeting.startTime;
  if (meeting.endTime !== undefined) payload.end_time = meeting.endTime;
  if (meeting.location !== undefined) payload.location = meeting.location;
  if (meeting.isOnline !== undefined) payload.is_online = meeting.isOnline;
  if (meeting.meetingLink !== undefined) payload.meeting_link = meeting.meetingLink;
  if (meeting.notes !== undefined) payload.notes = meeting.notes;
  if (meeting.project !== undefined) payload.project = meeting.project;
  if (meeting.projectId !== undefined) payload.project = meeting.projectId;
  if (meeting.deliverable !== undefined) payload.deliverable = meeting.deliverable;
  if (meeting.tags !== undefined) payload.tags = meeting.tags;
  if (meeting.agenda !== undefined) payload.agenda = meeting.agenda;

  if (meeting.organizerId !== undefined && meeting.organizerId !== null) {
    payload.organizer_id = meeting.organizerId;
  }

  if (meeting.attendee_ids !== undefined) {
    payload.attendee_ids = meeting.attendee_ids;
  } else if (meeting.attendees !== undefined && Array.isArray(meeting.attendees)) {
    payload.attendee_ids = meeting.attendees.map((a: any) =>
      typeof a === 'number' ? a : a.id
    ).filter(Boolean);
  }

  if (meeting.linked_issue_ids !== undefined) {
    payload.linked_issue_ids = meeting.linked_issue_ids;
  } else if (meeting.linkedIssueIds !== undefined) {
    payload.linked_issue_ids = meeting.linkedIssueIds;
  } else if (meeting.linkedIssues !== undefined && Array.isArray(meeting.linkedIssues)) {
    payload.linked_issue_ids = meeting.linkedIssues.map((i: any) =>
      typeof i === 'number' ? i : i.id
    ).filter(Boolean);
  }

  if (meeting.recurrence_frequency !== undefined) {
    payload.recurrence_frequency = meeting.recurrence_frequency;
  }
  if (meeting.recurrence_interval !== undefined) {
    payload.recurrence_interval = meeting.recurrence_interval;
  }
  if (meeting.recurrence_end_date !== undefined) {
    payload.recurrence_end_date = meeting.recurrence_end_date;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// API FUNCTIONS
// ---------------------------------------------------------------------------

const MEETINGS_BASE = `${API_URL}/meetings/meetings`;

export async function getMeetings(params?: {
  project?: number;
  status?: MeetingStatus;
  type?: MeetingType;
  startDate?: string;
  endDate?: string;
}): Promise<Meeting[]> {
  const url = new URL(`${MEETINGS_BASE}/`);

  if (params?.project) url.searchParams.append("project", String(params.project));
  if (params?.status) url.searchParams.append("status", params.status.toLowerCase());
  if (params?.type) url.searchParams.append("type", params.type.toLowerCase());
  if (params?.startDate) url.searchParams.append("start_time__gte", params.startDate);
  if (params?.endDate) url.searchParams.append("start_time__lte", params.endDate);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);

  let results = data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.results)) {
      results = data.results;
    } else if (Array.isArray(data)) {
      results = data;
    } else {
      results = [];
    }
  }

  if (!Array.isArray(results)) {
    return [];
  }

  return results.map(convertBackendMeeting);
}

export async function getMeeting(id: string | number): Promise<Meeting | undefined> {
  const response = await fetch(`${MEETINGS_BASE}/${id}/`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (response.status === 404) {
    return undefined;
  }

  const data = await handleResponse<any>(response);
  return convertBackendMeeting(data);
}

export async function createMeeting(input: any): Promise<Meeting> {
  const payload = convertToBackendPayload(input);

  const response = await fetch(`${MEETINGS_BASE}/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await handleResponse<any>(response);
  return convertBackendMeeting(data);
}

export async function updateMeeting(
  id: string | number,
  patch: Partial<Meeting>
): Promise<Meeting | undefined> {
  const payload = convertToBackendPayload(patch);

  const response = await fetch(`${MEETINGS_BASE}/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (response.status === 404) {
    return undefined;
  }

  const data = await handleResponse<any>(response);
  return convertBackendMeeting(data);
}

export async function deleteMeeting(id: string | number): Promise<void> {
  const response = await fetch(`${MEETINGS_BASE}/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (response.status === 404) {
    return;
  }

  await handleResponse(response);
}

export async function addMeetingComment(
  id: string | number,
  author: string,
  text: string
): Promise<Meeting | undefined> {
  const response = await fetch(`${MEETINGS_BASE}/${id}/add_comment/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text }),
  });

  if (response.status === 404) {
    return undefined;
  }

  await handleResponse(response);
  return getMeeting(id);
}

export async function getMeetingComments(id: string | number): Promise<MeetingComment[]> {
  const response = await fetch(`${MEETINGS_BASE}/${id}/comments/`, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any[]>(response);
  return data.map((c: any) => ({
    id: String(c.id),
    author: c.author?.full_name || c.author?.email || "Unknown",
    text: c.text,
    timestamp: c.timestamp,
  }));
}

export async function addMeetingAttendee(
  id: string | number,
  userId: number,
  response: string = "pending"
): Promise<void> {
  const resp = await fetch(`${MEETINGS_BASE}/${id}/add_attendee/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId, response }),
  });

  await handleResponse(resp);
}

export async function removeMeetingAttendee(
  id: string | number,
  userId: number
): Promise<void> {
  const resp = await fetch(`${MEETINGS_BASE}/${id}/remove_attendee/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });

  await handleResponse(resp);
}

export async function updateAttendeeResponse(
  id: string | number,
  userId: number,
  response: string
): Promise<void> {
  const resp = await fetch(`${MEETINGS_BASE}/${id}/update_attendee_response/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId, response }),
  });

  await handleResponse(resp);
}

export async function linkIssueToMeeting(
  meetingId: string | number,
  issueId: string | number
): Promise<void> {
  const response = await fetch(`${MEETINGS_BASE}/${meetingId}/link_issue/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ issue_id: issueId }),
  });

  await handleResponse(response);
}

export async function unlinkIssueFromMeeting(
  meetingId: string | number,
  issueId: string | number
): Promise<void> {
  const response = await fetch(`${MEETINGS_BASE}/${meetingId}/unlink_issue/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ issue_id: issueId }),
  });

  await handleResponse(response);
}

export async function getLinkedIssues(meetingId: string | number): Promise<LinkedIssue[]> {
  const response = await fetch(`${MEETINGS_BASE}/${meetingId}/linked_issues/`, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any[]>(response);
  return data.map((issue: any) => ({
    id: issue.id,
    title: issue.title,
    domain: issue.domain === "bim" ? "bim" : "design",
    status: issue.status_display || issue.status || "Open",
    priority: issue.priority_display || issue.priority || "Medium",
    topicType: issue.topic_type,
    bcfGuid: issue.bcf_guid,
  }));
}

export async function getUpcomingMeetings(days: number = 7): Promise<Meeting[]> {
  const url = new URL(`${MEETINGS_BASE}/upcoming/`);
  url.searchParams.append("days", String(days));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);
  const results = data.results || data;

  if (Array.isArray(results)) {
    return results.map(convertBackendMeeting);
  }
  return [];
}

export async function getTodaysMeetings(): Promise<Meeting[]> {
  const response = await fetch(`${MEETINGS_BASE}/today/`, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);
  const results = data.results || data;

  if (Array.isArray(results)) {
    return results.map(convertBackendMeeting);
  }
  return [];
}

export async function getMyMeetings(): Promise<Meeting[]> {
  const response = await fetch(`${MEETINGS_BASE}/my_meetings/`, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);
  const results = data.results || data;

  if (Array.isArray(results)) {
    return results.map(convertBackendMeeting);
  }
  return [];
}

/**
 * Meetings where the current user has a pending RSVP.
 */
export async function getMyPendingInvites(): Promise<Meeting[]> {
  const response = await fetch(`${MEETINGS_BASE}/my_pending_invites/`, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);
  const results = data.results || data;

  if (Array.isArray(results)) {
    return results.map(convertBackendMeeting);
  }
  return [];
}

export async function getMeetingsByDate(date: string): Promise<Meeting[]> {
  const url = new URL(`${MEETINGS_BASE}/`);
  url.searchParams.append("start_time__date", date);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);
  const results = data.results || data;

  if (Array.isArray(results)) {
    return results.map(convertBackendMeeting);
  }
  return [];
}

export async function getAvailableIssues(projectId?: number): Promise<LinkedIssue[]> {
  const url = new URL(`${API_URL}/issues/issues/`);
  if (projectId) {
    url.searchParams.append("project", String(projectId));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await handleResponse<any>(response);
  const results = data.results || data;

  if (Array.isArray(results)) {
    return results.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      domain: issue.domain === "bim" ? "bim" : "design",
      status: issue.status_display || issue.status || "Open",
      priority: issue.priority_display || issue.priority || "Medium",
      topicType: issue.topic_type,
      bcfGuid: issue.bcf_guid,
    }));
  }
  return [];
}

// ---------------------------------------------------------------------------
// DISPLAY HELPERS
// ---------------------------------------------------------------------------

export const getStatusColor = getMeetingStatusColor;
export const getPriorityColor = getMeetingPriorityColor;

// ---------------------------------------------------------------------------
// EXPORT DEFAULTS
// ---------------------------------------------------------------------------

const meetingApi = {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  addMeetingComment,
  getMeetingComments,
  addMeetingAttendee,
  removeMeetingAttendee,
  updateAttendeeResponse,
  linkIssueToMeeting,
  unlinkIssueFromMeeting,
  getLinkedIssues,
  getUpcomingMeetings,
  getTodaysMeetings,
  getMyMeetings,
  getMyPendingInvites,
  getMeetingsByDate,
  getAvailableIssues,
  getCurrentUser,
  getStatusColor,
  getPriorityColor,
};

export default meetingApi;