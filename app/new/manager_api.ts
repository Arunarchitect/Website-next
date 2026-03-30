/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = process.env.NEXT_PUBLIC_HOST;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(mon), to: fmt(sun) };
}

export interface MemberWorkLogEntry {
  id: number;
  organisation_id: number;
  organisation_name: string;
  project_id: number;
  project_name: string;
  deliverable: number;
  deliverable_name: string;
  employee_name: string;
  start_time: string;
  start_time_fmt: string;
  start_date_fmt: string;
  end_time: string | null;
  end_time_fmt: string | null;
  end_date_fmt: string | null;
  remarks: string | null;
  finalised: boolean;
}

export interface WorkLogPage {
  count: number;
  page: number;
  pages: number;
  total_minutes: number;
  results: MemberWorkLogEntry[];
}

export interface MemberOption {
  id: number;
  name: string;
}

export interface AssignmentEntry {
  id: number;
  name: string;
  deliverable_id: number;
  deliverable_name: string;
  project_id: number;
  project_name: string;
  organisation_id: number;
  organisation_name: string;
  assigned_to_id: number;
  assigned_to_name: string;
  assigned_by_id: number;
  assigned_by_name: string;
  start_date: string | null;
  due_date: string | null;
}

export interface MetaData {
  organisations: { id: number; name: string }[];
  projects: { id: number; name: string; organisation_id: number }[];
  members: MemberOption[];
}

export interface DeliverableOption {
  id: number;
  name: string;
  status: string;
  project_id: number;
  organisation_id: number;
  project_name: string;
  org_name: string;
  stage: string;
  stage_display: string;
}

function mapWorklog(w: any): MemberWorkLogEntry {
  const st = w.start_time ? new Date(w.start_time) : null;
  const et = w.end_time ? new Date(w.end_time) : null;
  return {
    ...w,
    deliverable: w.deliverable_id,
    start_time_fmt: st ? `${pad(st.getHours())}:${pad(st.getMinutes())}` : "",
    start_date_fmt: st
      ? `${st.getFullYear()}-${pad(st.getMonth() + 1)}-${pad(st.getDate())}`
      : "",
    end_time_fmt: et ? `${pad(et.getHours())}:${pad(et.getMinutes())}` : null,
    end_date_fmt: et
      ? `${et.getFullYear()}-${pad(et.getMonth() + 1)}-${pad(et.getDate())}`
      : null,
  };
}

export async function fetchMeta(): Promise<MetaData> {
  const res = await fetch(`${BASE}/api/v2/hour/meta/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Meta failed: ${res.status}`);
  return res.json();
}

export async function fetchDeliverablesByProject(
  projectId?: number,
): Promise<DeliverableOption[]> {
  const url = new URL(`${BASE}/api/v2/hour/deliverables/`);
  if (projectId) url.searchParams.set("project_id", String(projectId));
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Deliverables failed: ${res.status}`);
  return (await res.json()).map((d: any) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    project_id: d.project_id,
    organisation_id: d.organisation_id,
    stage: d.stage,
    stage_display: d.stage_display ?? `Stage ${d.stage}`,
    project_name: d.project_name ?? "",
    org_name: d.org_name ?? "",
  }));
}

export async function fetchMemberWorkLogs(params: {
  member_id?: number;
  org_id?: number;
  project_id?: number;
  deliverable_id?: number;
  from?: string;
  to?: string;
  page?: number;
}): Promise<WorkLogPage> {
  const url = new URL(`${BASE}/api/v2/manager/worklogs/`);
  if (params.member_id)
    url.searchParams.set("member_id", String(params.member_id));
  if (params.org_id) url.searchParams.set("org_id", String(params.org_id));
  if (params.project_id)
    url.searchParams.set("project_id", String(params.project_id));
  if (params.deliverable_id)
    url.searchParams.set("deliverable_id", String(params.deliverable_id));
  if (params.from) url.searchParams.set("from", params.from);
  if (params.to) url.searchParams.set("to", params.to);
  if (params.page) url.searchParams.set("page", String(params.page));
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Worklogs failed: ${res.status}`);
  const data = await res.json();
  return {
    count: data.count,
    page: data.page,
    pages: data.pages,
    total_minutes: data.total_minutes ?? 0,
    results: data.results.map(mapWorklog),
  };
}

export async function fetchAssignments(
  memberId?: number,
): Promise<AssignmentEntry[]> {
  const url = new URL(`${BASE}/api/v2/manager/assignments/`);
  if (memberId) url.searchParams.set("member_id", String(memberId));
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Assignments failed: ${res.status}`);
  return res.json();
}

export async function createAssignment(payload: {
  name: string;
  deliverable: number;
  assigned_to: number;
  start_date?: string;
  due_date?: string;
}): Promise<AssignmentEntry> {
  const res = await fetch(`${BASE}/api/v2/manager/assignments/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? `Create failed: ${res.status}`);
  }
  return res.json();
}

export async function editAssignment(
  id: number,
  payload: {
    name?: string;
    deliverable?: number;
    assigned_to?: number;
    start_date?: string | null;
    due_date?: string | null;
  },
): Promise<AssignmentEntry> {
  const res = await fetch(`${BASE}/api/v2/manager/assignments/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? `Edit failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteAssignment(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/manager/assignments/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
