// app/new/leave/api/leaveApi.ts

const BASE = process.env.NEXT_PUBLIC_HOST;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders(): Record<string, string> {
  return { 
    "Content-Type": "application/json", 
    Authorization: `Bearer ${getToken()}` 
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PublicHoliday {
  id: number;
  name: string;
  date: string;
  is_recurring: boolean;
  remarks: string | null;
}

export interface DayBreakdown {
  date: string;
  type: "leave" | "holiday";
  holiday_name: string | null;
}

export interface LeaveRequest {
  id: number;
  leave_type: string;
  leave_type_display: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  user_reason: string | null;
  status: "pending" | "approved" | "auto_approved" | "rejected" | "cancelled";
  status_display: string;
  submitted_at: string;
  actioned_at: string | null;
  day_breakdown: DayBreakdown[];
  approvals: LeaveApprovalEntry[];
  user?: { id: number; email: string; full_name: string };
  is_org_leave: boolean;
}

export interface LeaveApprovalEntry {
  id: number;
  action: "approved" | "rejected";
  action_display: string;
  admin_remark: string | null;
  actioned_at: string;
  actioned_by_info: { id: number; email: string; full_name: string } | null;
}

export interface LeavePolicy {
  id: number;
  leave_type: string;
  leave_type_display: string;
  notice_days_required: number;
  requires_reason: boolean;
  default_annual_days: number;
}

export interface LeaveBalance {
  leave_type: string;
  leave_type_display: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
  pending_days: number;
}

export interface OrgMember {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

export interface MeData {
  id: number;
  name: string;
  email: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchMe(): Promise<MeData> {
  const res = await fetch(`${BASE}/api/v2/me/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Auth failed");
  return res.json();
}

export async function fetchMyLeaveRequests(year: number): Promise<LeaveRequest[]> {
  const res = await fetch(`${BASE}/api/v2/leave/my-requests/?year=${year}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch leave requests");
  return res.json();
}

export async function fetchAdminLeaveRequests(year: number, userId?: number): Promise<LeaveRequest[]> {
  const params = new URLSearchParams({ year: String(year) });
  if (userId) params.set("user", String(userId));
  const res = await fetch(`${BASE}/api/v2/leave/admin/requests/?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch admin leave requests");
  return res.json();
}

export async function fetchOrgMembers(): Promise<OrgMember[]> {
  try {
    const res = await fetch(`${BASE}/api/v2/manager/members/`, { 
      headers: authHeaders() 
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch members: ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching members:', error);
    return [];
  }
}

export async function fetchPublicHolidays(year: number): Promise<PublicHoliday[]> {
  const res = await fetch(`${BASE}/api/v2/leave/holidays/?year=${year}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch holidays");
  return res.json();
}

export async function fetchLeaveMeta(): Promise<LeavePolicy[]> {
  const res = await fetch(`${BASE}/api/v2/leave/meta/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch leave meta");
  return res.json();
}

export async function fetchLeaveBalance(year: number, userId?: number): Promise<LeaveBalance[]> {
  const params = new URLSearchParams({ year: String(year) });
  if (userId) params.set("user", String(userId));
  const res = await fetch(`${BASE}/api/v2/leave/balance/?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch balance");
  return res.json();
}

export async function submitLeaveRequest(data: {
  leave_type: string;
  start_date: string;
  end_date: string;
  user_reason: string;
}): Promise<LeaveRequest> {
  const res = await fetch(`${BASE}/api/v2/leave/my-requests/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(Object.values(err).flat().join(" ") || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function cancelLeaveRequest(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/leave/my-requests/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to cancel");
}

// Add this function to your leaveApi.ts file

export async function deletePublicHoliday(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/leave/holidays/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete holiday");
}


export async function actionLeaveRequest(
  id: number,
  action: "approved" | "rejected",
  admin_remark: string,
): Promise<LeaveRequest> {
  const res = await fetch(`${BASE}/api/v2/leave/admin/requests/${id}/action/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action, admin_remark }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(Object.values(err).flat().join(" ") || `Action failed: ${res.status}`);
  }
  return res.json();
}

export async function addPublicHoliday(data: {
  organisation: number;
  name: string;
  date: string;
  is_recurring: boolean;
  remarks: string;
}): Promise<PublicHoliday> {
  const res = await fetch(`${BASE}/api/v2/leave/holidays/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(Object.values(err).flat().join(" ") || "Failed to add holiday");
  }
  return res.json();
}