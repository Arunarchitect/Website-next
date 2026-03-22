const BASE = process.env.NEXT_PUBLIC_HOST ;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`,
  };
}

export interface DashboardUser {
  id: number;
  name: string;
  email: string;
}

export interface DashboardAssignment {
  id: number;
  name: string;
  deliverable_id: number;
  deliverable_name: string;
  project_name: string;
  org_name: string;
  due_date: string | null;
  start_date: string | null;
}

export interface DashboardQuickAccess {
  id: number;
  deliverable_id: number;
  deliverable_name: string;
  project_name: string;
  org_name: string;
}

export interface DashboardData {
  user: DashboardUser;
  assignments: DashboardAssignment[];
  quick_access: DashboardQuickAccess[];
}

export interface ActiveWorkLog {
  id: number;
  deliverable_id: number;
  deliverable_name: string;
  project_name: string;
  org_name: string;
  start_time: string;
  end_time: string;
  remarks: string;
  finalised: boolean;
}

export interface StartWorkLogResult {
  id: number;
  start_time: string;
  end_time: string;
  finalised: boolean;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`${BASE}/api/v2/dashboard/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchActiveWorkLog(): Promise<ActiveWorkLog | null> {
  const res = await fetch(`${BASE}/api/v2/worklogs/active/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Active worklog fetch failed: ${res.status}`);
  const data = await res.json();
  return data ?? null;
}

export async function startWorkLog(deliverableId: number): Promise<StartWorkLogResult> {
  const res = await fetch(`${BASE}/api/v2/worklogs/start/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ deliverable: deliverableId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Worklog start failed: ${res.status}`);
  }
  return res.json();
}

export async function endWorkLog(id: number, remarks: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/worklogs/${id}/end/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ remarks }),
  });
  if (!res.ok) throw new Error(`Worklog end failed: ${res.status}`);
}

export async function discardWorkLog(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/worklogs/${id}/discard/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Worklog discard failed: ${res.status}`);
}

export async function updateWorkLogEndTime(id: number, endTime: Date): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/worklogs/${id}/update-end/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ end_time: endTime.toISOString() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Update end time failed: ${res.status}`);
  }
}

export async function updateWorkLogRemarks(id: number, remarks: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/worklogs/${id}/update-remarks/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ remarks }),
  });
  if (!res.ok) throw new Error(`Update remarks failed: ${res.status}`);
}