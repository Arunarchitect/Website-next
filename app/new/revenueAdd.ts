// app/new/revenue/revenueAdd.ts

export interface Organisation {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  organisation_id: number;
}

export interface RevenueEntry {
  id: number;
  amount: number;
  source: string;
  source_display: string;
  date: string;
  organisation_id: number;
  organisation_name: string;
  project_id: number | null;
  project_name: string | null;
  remarks: string;
  user: number;
  user_email: string;
  user_name: string;
  created_at: string;
  updated_at: string;
}

export interface RevenueFormData {
  amount: number;
  source: string;
  date: string;
  organisation: number;
  project?: number | null;
  remarks?: string;
}

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Reads NEXT_PUBLIC_HOST from env (e.g. http://localhost:8000 or
// https://api.modelflick.com). Falls back to empty string so relative paths
// still work if the var is missing.
const BASE = process.env.NEXT_PUBLIC_HOST ?? "";

// ─── Auth helpers (aligned with salaryApi.ts) ─────────────────────────────────
function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchOrganisations(): Promise<Organisation[]> {
  // Mounted at /api/my-organisations/ in project_urls.py (no v2 prefix)
  const response = await fetch(`${BASE}/api/my-organisations/`, {
    headers: authHeaders(),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchProjects(
  organisationId?: number
): Promise<Project[]> {
  // Mounted via project_urlpatterns → /api/v2/projects/?org_id=<id>
  let url = `${BASE}/api/v2/projects/`;
  if (organisationId) {
    url += `?org_id=${organisationId}`;
  }
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

export async function fetchRevenues(params: {
  from?: string;
  to?: string;
  organisation_id?: number;
  project_id?: number;
}): Promise<RevenueEntry[]> {
  const urlParams = new URLSearchParams();
  if (params.from) urlParams.append("from", params.from);
  if (params.to) urlParams.append("to", params.to);
  if (params.organisation_id)
    urlParams.append("organisation_id", String(params.organisation_id));
  if (params.project_id)
    urlParams.append("project_id", String(params.project_id));

  const qs = urlParams.toString();
  const url = `${BASE}/api/v2/revenues/${qs ? `?${qs}` : ""}`;
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

export async function addRevenue(
  data: RevenueFormData
): Promise<RevenueEntry> {
  // Validate data before sending
  if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
    throw new Error("Invalid amount. Amount must be greater than zero.");
  }
  if (!data.source) {
    throw new Error("Revenue source is required.");
  }
  if (!data.date) {
    throw new Error("Date is required.");
  }
  if (!data.organisation) {
    throw new Error("Organisation is required.");
  }

  const response = await fetch(`${BASE}/api/v2/revenues/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: Number(data.amount),
      source: data.source,
      date: data.date,
      organisation: data.organisation,
      project: data.project || null,
      remarks: data.remarks || "",
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.detail || `Failed to add revenue: ${response.status}`
    );
  }
  return response.json();
}