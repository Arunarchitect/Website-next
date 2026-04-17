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
// Core types
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
export type PaymentStatus = "pending" | "invoiced" | "collected" | "overdue" | "waived";
export type FeeSetupStatus = "active" | "on_hold" | "completed" | "cancelled";

export interface OrganisationOption {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Projectmoney types  (from projectmoney/serializers.py)
// ---------------------------------------------------------------------------

export interface FeeStage {
  id: number;
  stage_name: string;
  order: number;
  stage_percentage: number;   // Decimal → number
  stage_fee: number;          // auto-computed
  payment_status: PaymentStatus;
  payment_status_display: string;
  invoice_number: string | null;
  invoice_date: string | null;   // "YYYY-MM-DD"
  due_date: string | null;
  collected_date: string | null;
  collected_amount: number | null;
  remarks: string | null;
}

export interface FeeSetup {
  id: number;
  gross_fee: number;
  discount_amount: number;
  tax_amount: number;
  net_fee: number;
  currency: string;
  status: FeeSetupStatus;
  status_display: string;
  notes: string | null;
  total_collected: number;
  total_outstanding: number;
  collection_percentage: number;   // 0–100
  stages_collected_count: number;
  stages_total_count: number;
  stages: FeeStage[];
}

export interface ManualHoursEntry {
  id: number;
  user_display: string;
  start_date: string;       // "YYYY-MM-DD"
  end_date: string | null;
  hours: number;
  remarks: string | null;
}

export interface BillingBreakdownItem {
  user: string;
  hours: number;
  rate: number | null;
  cost: number | null;
  currency: string;
}

/** Shape of `financials` injected by _build_financials() in project_views.py */
export interface ProjectFinancials {
  hours: {
    worklog_hours: number;
    manual_hours: number;
    combined_hours: number;
    manual_entries: ManualHoursEntry[];
  };
  fee_setup: FeeSetup | null;
  billing_cost: {
    total: number | null;
    breakdown: BillingBreakdownItem[];
  };
  revenue_collected: number;
  comparison: {
    billing_cost: number;
    revenue_collected: number;
    difference: number;      // positive = profitable
    margin_pct: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Project types
// ---------------------------------------------------------------------------

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
  start_date: string | null;
  end_date: string | null;
  agg_deliverable_count: number;
  agg_delivered_count: number;
  agg_revenue: number;
  agg_expenses: number;
  agg_hours_seconds: number;
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
  assigned_to_display: string;
  hours_logged: number;
}

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
  total_hours: number;
  total_revenue: number;
  total_expenses: number;
  delivered_count: number;
  deliverable_count: number;
  /** null when projectmoney app not installed or project has no fee setup */
  financials: ProjectFinancials | null;
}

// ---------------------------------------------------------------------------
// Filter params
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

export async function fetchProjectOrganisations(): Promise<OrganisationOption[]> {
  const res = await fetch(`${BASE}/api/v2/projects/organisations/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Project organisations failed: ${res.status}`);
  return res.json();
}

export async function fetchMyOrganisations(): Promise<OrganisationOption[]> {
  const res = await fetch(`${BASE}/api/v2/organisations/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`My organisations failed: ${res.status}`);
  return res.json();
}

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

export async function fetchProjectDetail(pk: number): Promise<ProjectDetail> {
  const res = await fetch(`${BASE}/api/v2/projects/${pk}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Project detail failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function hoursFromListItem(project: ProjectListItem): number {
  return Math.round((project.agg_hours_seconds / 3600) * 10) / 10;
}

export function netProfit(project: ProjectListItem | ProjectDetail): number {
  const revenue =
    "agg_revenue" in project ? project.agg_revenue : project.total_revenue;
  const expenses =
    "agg_expenses" in project ? project.agg_expenses : project.total_expenses;
  return revenue - expenses;
}

export const STAGE_LABEL: Record<ProjectStage, string> = {
  "1": "Stage 1",
  "2": "Stage 2",
  "3": "Stage 3",
  "4": "Stage 4",
  "5": "Stage 5",
};

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  not_started: "Not Started",
  ongoing: "Ongoing",
  ready: "Ready for Validation",
  passed: "Passed Validation",
  failed: "Failed Validation",
  discrepancy: "Site Discrepancy",
};

export const PAYMENT_STATUS_COLOR: Record<
  PaymentStatus,
  { bg: string; text: string }
> = {
  pending:   { bg: "#f0f0f0", text: "#888" },
  invoiced:  { bg: "#e3f2fd", text: "#1565c0" },
  collected: { bg: "#e8f5e9", text: "#2e7d32" },
  overdue:   { bg: "#fce4ec", text: "#c62828" },
  waived:    { bg: "#f3e5f5", text: "#6a1b9a" },
};