/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = process.env.NEXT_PUBLIC_HOST;

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

export interface WorkLogEntry {
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

// Update the WorkLogPage interface
export interface WorkLogPage {
  count:   number;
  page:    number;
  pages:   number;
  total_minutes: number;  // ← ADD THIS
  results: WorkLogEntry[];
}



export interface OrgOption     { id: number; name: string; }
export interface ProjectOption { id: number; name: string; organisation_id: number; }
export interface DeliverableOption {
  id: number; name: string; status: string;
  project_id: number; organisation_id: number;
  project_name: string; org_name: string;
  stage: string; stage_display: string;
}

export interface MetaData {
  organisations: OrgOption[];
  projects:      ProjectOption[];
  members:       { id: number; name: string }[];
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function mapWorklog(w: any): WorkLogEntry {
  const st = w.start_time ? new Date(w.start_time) : null;
  const et = w.end_time   ? new Date(w.end_time)   : null;
  return {
    ...w,
    deliverable:    w.deliverable_id,
    start_time_fmt: st ? `${pad(st.getHours())}:${pad(st.getMinutes())}` : "",
    start_date_fmt: st ? `${st.getFullYear()}-${pad(st.getMonth()+1)}-${pad(st.getDate())}` : "",
    end_time_fmt:   et ? `${pad(et.getHours())}:${pad(et.getMinutes())}` : null,
    end_date_fmt:   et ? `${et.getFullYear()}-${pad(et.getMonth()+1)}-${pad(et.getDate())}` : null,
  };
}

function mapDeliverable(d: any): DeliverableOption {
  return {
    id: d.id, name: d.name, status: d.status,
    project_id: d.project_id, organisation_id: d.organisation_id,
    stage: d.stage, stage_display: d.stage_display ?? `Stage ${d.stage}`,
    project_name: d.project_name ?? "", org_name: d.org_name ?? "",
  };
}

export function currentWeekRange(): { from: string; to: string } {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now); mon.setDate(now.getDate() + diff);
  const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt  = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  return { from: fmt(mon), to: fmt(sun) };
}

// Update fetchMyWorkLogs function
export async function fetchMyWorkLogs(params?: {
  from?: string; to?: string; page?: number;
}): Promise<WorkLogPage> {
  const url = new URL(`${BASE}/api/v2/hour/worklogs/`);
  if (params?.from) url.searchParams.set("from",  params.from);
  if (params?.to)   url.searchParams.set("to",    params.to);
  if (params?.page) url.searchParams.set("page",  String(params.page));
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch worklogs failed: ${res.status}`);
  const data = await res.json();
  return { 
    count: data.count, 
    page: data.page, 
    pages: data.pages, 
    total_minutes: data.total_minutes ?? 0,  // ← ADD THIS
    results: data.results.map(mapWorklog) 
  };
}

/**
 * Fetches the distinct dates (YYYY-MM-DD) that have finalised worklogs
 * within the given date range. Hits a lightweight backend endpoint that
 * returns only dates — no pagination, no heavy serialisation.
 */
export async function fetchWorkLogDates(params?: {
  from?: string; to?: string;
}): Promise<string[]> {
  const url = new URL(`${BASE}/api/v2/hour/worklogs/dates/`);
  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to)   url.searchParams.set("to",   params.to);
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch worklog dates failed: ${res.status}`);
  return res.json();
}

export async function fetchMeta(): Promise<MetaData> {
  const res = await fetch(`${BASE}/api/v2/hour/meta/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch meta failed: ${res.status}`);
  return res.json();
}

export async function fetchDeliverablesByProject(projectId?: number): Promise<DeliverableOption[]> {
  const url = new URL(`${BASE}/api/v2/hour/deliverables/`);
  if (projectId) url.searchParams.set("project_id", String(projectId));
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch deliverables failed: ${res.status}`);
  return (await res.json()).map(mapDeliverable);
}

export async function fetchInitialDeliverables(lastWorklog: WorkLogEntry | null): Promise<DeliverableOption[]> {
  return fetchDeliverablesByProject(lastWorklog?.project_id ?? undefined);
}

export async function createWorkLog(payload: {
  deliverable: number;
  start_time:  string;
  end_time?:   string;
  remarks?:    string;
}): Promise<WorkLogEntry> {
  const res = await fetch(`${BASE}/api/v2/hour/worklogs/`, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Create worklog failed: ${res.status}`);
  }
  return mapWorklog(await res.json());
}

export async function editWorkLog(id: number, payload: {
  start_time?: string; end_time?: string; remarks?: string; deliverable?: number;
}): Promise<WorkLogEntry> {
  const res = await fetch(`${BASE}/api/v2/hour/worklogs/${id}/`, {
    method: "PATCH", headers: authHeaders(), body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Edit worklog failed: ${res.status}`);
  }
  return mapWorklog(await res.json());
}

export async function deleteWorkLog(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/hour/worklogs/${id}/`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`Delete worklog failed: ${res.status}`);
}

export async function pinDeliverable(deliverableId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/hour/quick-access/`, {
    method: "POST", headers: authHeaders(), body: JSON.stringify({ deliverable_id: deliverableId }),
  });
  if (!res.ok) throw new Error(`Pin failed: ${res.status}`);
}

export async function unpinDeliverable(deliverableId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/hour/quick-access/${deliverableId}/`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`Unpin failed: ${res.status}`);
}

export async function fetchMyPinnedIds(): Promise<number[]> {
  const res = await fetch(`${BASE}/api/v2/me/quick-access/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Fetch pins failed: ${res.status}`);
  const data = await res.json();
  return data.map((q: { deliverable_id: number }) => q.deliverable_id);
}