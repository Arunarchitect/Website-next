// app/new/salaryApi.ts
const BASE = process.env.NEXT_PUBLIC_HOST;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SalaryReportEmployee {
  user: {
    id: number;
    name: string;
    email: string;
  };
  period: {
    start: string;
    end: string;
    year: number;
    month: number;
  };
  total_hours: number;
  hourly_amount: number;
  percentage_amount: number;
  total_amount: number;
  percentage_rate?: number;
  percentage_details?: Array<{
    share_id: number;
    share_type: string;
    share_type_display: string;
    percentage: number;
    scope: string;
    scope_name: string;
    revenue_base: number;
    amount: number;
  }>;
  calculations_count: number;
  work_logs_count: number;
  billing_note?: string;
}

export interface ProjectOption {
  id: number;
  name: string;
  organisation_id: number;
  billing_type: "hourly" | "percentage_share";
}

export interface SalaryReport {
  report_period: {
    year: number;
    month: number;
    start_date: string;
    end_date: string;
  };
  total_employees: number;
  total_salary_amount: number;
  total_hourly_amount: number;
  total_percentage_amount: number;
  employees: SalaryReportEmployee[];
}

export interface OrganisationOption {
  id: number;
  name: string;
}

export interface DeliverableOption {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  organisation_id: number;
  stage: string;
  status: string;
}

export interface UserOption {
  id: number;
  name: string;
  email: string;
}

export interface FetchSalaryReportParams {
  /** Full calendar year, e.g. 2025 */
  year?: number;
  /** 1-indexed month, e.g. 3 for March */
  month?: number;
  organisation_id?: number;
  project_id?: number;
  /** Use this project's revenue for percentage calculations */
  revenue_project_id?: number;
  deliverable_id?: number;
  user_id?: number;
  /** ISO date string YYYY-MM-DD — takes priority over year/month */
  from?: string;
  /** ISO date string YYYY-MM-DD — takes priority over year/month */
  to?: string;
  view_all?: boolean;
  include_all_projects?: boolean;
}

// Add type for revenue items
export interface RevenueItem {
  id: number;
  amount: number;
  source: string;
  source_display: string;
  date: string;
  organisation: number;
  organisation_name?: string;
  project?: number | null;
  project_name?: string | null;
  remarks?: string;
  created_at?: string;
}

export interface ProjectRevenueResponse {
  total: number;
  results?: RevenueItem[];
}

// ─── API Calls ─────────────────────────────────────────────────────────────

export async function fetchOrganisations(): Promise<OrganisationOption[]> {
  const res = await fetch(`${BASE}/api/v2/organisations/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch organisations: ${res.status}`);
  return res.json();
}

export async function fetchProjectsByOrg(
  orgId: number,
): Promise<ProjectOption[]> {
  const res = await fetch(`${BASE}/api/v2/projects/?organisation_id=${orgId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export async function fetchDeliverablesByProject(
  projectId: number,
): Promise<DeliverableOption[]> {
  const res = await fetch(
    `${BASE}/api/v2/hour/deliverables/?project_id=${projectId}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to fetch deliverables: ${res.status}`);
  return res.json();
}

export async function fetchUsersByOrg(orgId: number): Promise<UserOption[]> {
  const response = await fetch(
    `/api/salary/users-by-org/?organisation_id=${orgId}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch users");
  }

  return response.json();
}

export async function fetchSalaryReport(
  params: FetchSalaryReportParams,
): Promise<SalaryReport> {
  const qs = new URLSearchParams();

  const hasDateRange = params.from || params.to;

  if (hasDateRange) {
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
  } else {
    if (params.year != null) qs.set("year", String(params.year));
    if (params.year != null && params.month != null)
      qs.set("month", String(params.month));
  }

  if (params.organisation_id)
    qs.set("organisation_id", String(params.organisation_id));
  if (params.project_id) qs.set("project_id", String(params.project_id));
  if (params.revenue_project_id)
    qs.set("revenue_project_id", String(params.revenue_project_id));
  if (params.deliverable_id)
    qs.set("deliverable_id", String(params.deliverable_id));
  if (params.user_id) qs.set("user_id", String(params.user_id));
  if (params.view_all) qs.set("view_all", "true");
  if (params.include_all_projects) qs.set("include_all_projects", "true");

  const res = await fetch(`${BASE}/api/v2/salary-report/?${qs}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      error.error || `Failed to fetch salary report: ${res.status}`,
    );
  }
  return res.json();
}

// Optional: Fetch project revenue separately if needed
export async function fetchProjectRevenue(
  projectId: number,
  from?: string,
  to?: string,
): Promise<ProjectRevenueResponse> {
  const qs = new URLSearchParams();
  qs.set("project_id", String(projectId));

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const res = await fetch(`${BASE}/api/v2/revenue/?${qs}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch revenue: ${res.status}`);
  }

  const data = await res.json();
  return {
    total: data.total || 0,
    results: data.results || [],
  };
}
