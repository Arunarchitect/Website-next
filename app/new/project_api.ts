// project_api.ts
import type {
  OrganisationOption,
  ProjectStage,
  DeliverableStatus,
  PaymentStatus,
  ProjectListItem,
  ProjectDetail,
  ProjectListParams,
} from "@/app/new/projectdash/types";

// Re-export every type from ./types so existing imports like
// `import { ProjectListItem, FeeSetup } from "@/app/new/project_api"`
// (written against the old single-file version) keep working unchanged.
export type {
  ProjectStage,
  DeliverableStatus,
  BillingType,
  PaymentStatus,
  FeeSetupStatus,
  FeeCalcStatus,
  DetailTab,
  OrganisationOption,
  FeeStage,
  FeeSetup,
  ManualHoursEntry,
  BillingBreakdownItem,
  FeeCalcSummary,
  ProjectFinancials,
  ProjectListItem,
  DeliverableDetail,
  ProjectDetail,
  ProjectListParams,
} from "@/app/new/projectdash/types";

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
  if (params.org_id !== undefined) url.searchParams.set("org_id", String(params.org_id));
  if (params.is_completed !== undefined)
    url.searchParams.set("is_completed", params.is_completed ? "true" : "false");
  if (params.stage !== undefined) url.searchParams.set("stage", params.stage);
  if (params.q !== undefined && params.q.trim()) url.searchParams.set("q", params.q.trim());
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
// Domain helpers
// ---------------------------------------------------------------------------

export function hoursFromListItem(project: ProjectListItem): number {
  return Math.round((project.agg_hours_seconds / 3600) * 100) / 100;
}

export function netProfit(project: ProjectListItem | ProjectDetail): number {
  const revenue = "agg_revenue" in project ? project.agg_revenue : project.total_revenue;
  const expenses = "agg_expenses" in project ? project.agg_expenses : project.total_expenses;
  return revenue - expenses;
}

// ---------------------------------------------------------------------------
// Labels & colors
// ---------------------------------------------------------------------------

export const STAGE_LABEL: Record<ProjectStage, string> = {
  "1": "Stage 1",
  "2": "Stage 2",
  "3": "Stage 3",
  "4": "Stage 4",
  "5": "Stage 5",
};

export const STAGE_COLOR: Record<ProjectStage, { bg: string; text: string }> = {
  "1": { bg: "#e8f4ff", text: "#1565c0" },
  "2": { bg: "#fff3e0", text: "#e65100" },
  "3": { bg: "#f3e5f5", text: "#6a1b9a" },
  "4": { bg: "#e8f5e9", text: "#2e7d32" },
  "5": { bg: "#fce4ec", text: "#880e4f" },
};

export const DELIVERABLE_STATUS_LABEL: Record<DeliverableStatus, string> = {
  not_started: "Not Started",
  ongoing: "Ongoing",
  ready: "Ready for Validation",
  passed: "Passed Validation",
  failed: "Failed Validation",
  discrepancy: "Site Discrepancy",
};

export const DELIVERABLE_STATUS_COLOR: Record<DeliverableStatus, { bg: string; text: string }> = {
  not_started: { bg: "#f0f0f0", text: "#888888" },
  ongoing: { bg: "#e3f2fd", text: "#1565c0" },
  ready: { bg: "#fff8e1", text: "#f57f17" },
  passed: { bg: "#e8f5e9", text: "#2e7d32" },
  failed: { bg: "#fce4ec", text: "#c62828" },
  discrepancy: { bg: "#fff3e0", text: "#bf360c" },
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, { bg: string; text: string }> = {
  pending: { bg: "#f0f0f0", text: "#888888" },
  invoiced: { bg: "#e3f2fd", text: "#1565c0" },
  collected: { bg: "#e8f5e9", text: "#2e7d32" },
  overdue: { bg: "#fce4ec", text: "#c62828" },
  waived: { bg: "#f3e5f5", text: "#6a1b9a" },
};