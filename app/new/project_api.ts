// project_api.ts
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

// ---------------------------------------------------------------------------
// Types — derived from Django models & serializers
// ---------------------------------------------------------------------------

export type ProjectStage = "1" | "2" | "3" | "4" | "5";
export type DeliverableStatus =
  | "not_started"
  | "ongoing"
  | "ready"
  | "passed"
  | "failed"
  | "discrepancy";
export type BillingType = "hourly" | "percentage_share";

export interface OrganisationOption {
  id: number;
  name: string;
}

/** Shape returned by ProjectListView (annotated queryset) */
export interface ProjectListItem {
  id: number;
  name: string;
  description: string | null;
  location: string;
  client_name: string;
  organisation_id: number;
  organisation_name: string;
  project_type: string;
  billing_type: BillingType;
  current_stage: ProjectStage;
  is_completed: boolean;
  start_date: string | null; // "YYYY-MM-DD"
  end_date: string | null;
  // Annotated aggregates
  agg_deliverable_count: number;
  agg_delivered_count: number;
  agg_revenue: number;
  agg_expenses: number;
  agg_hours_seconds: number; // raw seconds — divide by 3600 for hours
}

export interface DeliverableDetail {
  id: number;
  name: string;
  stage: ProjectStage;
  status: DeliverableStatus;
  remarks: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean;
  assigned_to_display: string; // comma-separated names from active assignments
  hours_logged: number; // total hours from finished worklogs
}

/** Shape returned by ProjectDetailView */
export interface ProjectDetail {
  id: number;
  name: string;
  description: string | null;
  location: string;
  client_name: string;
  organisation_id: number;
  organisation_name: string;
  project_type: string;
  billing_type: BillingType;
  current_stage: ProjectStage;
  is_completed: boolean;
  start_date: string | null;
  end_date: string | null;
  deliverables: DeliverableDetail[];
  // Context-injected by the view
  total_hours: number;
  total_revenue: number;
  total_expenses: number;
  delivered_count: number;
  deliverable_count: number;
}

// ---------------------------------------------------------------------------
// Filter params for ProjectListView
// ---------------------------------------------------------------------------

export interface ProjectListParams {
  org_id?: number;
  is_completed?: boolean;
  stage?: ProjectStage;
  q?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/v2/projects/organisations/ — organisations that have projects */
export async function fetchProjectOrganisations(): Promise<OrganisationOption[]> {
  const res = await fetch(`${BASE}/api/v2/projects/organisations/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Project organisations failed: ${res.status}`);
  return res.json();
}

/** GET /api/v2/organisations/ — all organisations the current user belongs to */
export async function fetchMyOrganisations(): Promise<OrganisationOption[]> {
  const res = await fetch(`${BASE}/api/v2/organisations/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`My organisations failed: ${res.status}`);
  return res.json();
}

/** GET /api/v2/projects/ — filterable project list */
export async function fetchProjects(
  params: ProjectListParams = {}
): Promise<ProjectListItem[]> {
  const url = new URL(`${BASE}/api/v2/projects/`);

  if (params.org_id !== undefined)
    url.searchParams.set("org_id", String(params.org_id));

  if (params.is_completed !== undefined)
    url.searchParams.set("is_completed", params.is_completed ? "true" : "false");

  if (params.stage !== undefined)
    url.searchParams.set("stage", params.stage);

  if (params.q !== undefined && params.q.trim())
    url.searchParams.set("q", params.q.trim());

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`Projects list failed: ${res.status}`);
  return res.json();
}

/** GET /api/v2/projects/<pk>/ — full project detail with deliverables */
export async function fetchProjectDetail(pk: number): Promise<ProjectDetail> {
  const res = await fetch(`${BASE}/api/v2/projects/${pk}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Project detail failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Convenience helpers (mirrors manager_api patterns)
// ---------------------------------------------------------------------------

/** Total hours from a ProjectListItem (converts seconds → hours) */
export function hoursFromListItem(project: ProjectListItem): number {
  return Math.round((project.agg_hours_seconds / 3600) * 10) / 10;
}

/** Profit = revenue − expenses */
export function netProfit(project: ProjectListItem | ProjectDetail): number {
  const revenue =
    "agg_revenue" in project ? project.agg_revenue : project.total_revenue;
  const expenses =
    "agg_expenses" in project ? project.agg_expenses : project.total_expenses;
  return revenue - expenses;
}

/** Stage label map */
export const STAGE_LABEL: Record<ProjectStage, string> = {
  "1": "Stage 1",
  "2": "Stage 2",
  "3": "Stage 3",
  "4": "Stage 4",
  "5": "Stage 5",
};

/** Deliverable status label map */
export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  not_started: "Not Started",
  ongoing: "Ongoing",
  ready: "Ready for Validation",
  passed: "Passed Validation",
  failed: "Failed Validation",
  discrepancy: "Site Discrepancy",
};