// app/projectfee/projectfeeApi.ts
//
// Org + project selection reuses project_api.ts (fetchMyOrganisations,
// fetchProjects) unchanged — those are the verified /api/v2/ endpoints.
//
// All MONEY data (fee collected / due now / outstanding) comes exclusively
// from the feecalc app's ProjectFeeCalculation + FeeInstalment endpoints.
// Deliberately does NOT use ProjectListItem.agg_revenue / agg_expenses,
// ProjectDetail.financials, ProjectDetail.total_revenue, or
// Project.billing_type — those belong to project/projectmoney, not feecalc,
// and per feecalc's own README (§7/§8) they are not synced with feecalc's
// ledger, so mixing them in here would show the wrong numbers.

import {
  fetchMyOrganisations,
  fetchProjects,
  type OrganisationOption,
  type ProjectListItem,
} from "@/app/new/project_api";
import { fmtCurrency, fetchFeeTemplate, type FeeTemplateOption } from "../feecalc/feeCalcApi";

export { fetchMyOrganisations, fetchProjects };
export type { OrganisationOption, ProjectListItem };
export { fmtCurrency, fetchFeeTemplate };
export type { FeeTemplateOption };

const BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_HOST ?? "") : "";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? (localStorage.getItem("access") ?? "") : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err: Record<string, unknown> = await res.json().catch(() => ({}));
    const detail =
      (err.detail as string | undefined) ??
      Object.entries(err)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join(" · ");
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Types (mirrors feecalc/serializers.py exactly) ───────────────────────────

export type FeeCalcStatus = "draft" | "confirmed" | "invoicing" | "completed" | "cancelled";

export type InstalmentStatus =
  | "pending"
  | "partially_invoiced"
  | "invoiced"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "waived";

export interface FeeInstalmentPayment {
  id: number;
  fee_instalment: number;
  amount: string;
  paid_at: string;
  remarks: string | null;
  created_at: string;
}

export interface FeeCalculationLine {
  id: number;
  fee_instalment: number;
  user: number;
  user_display: string;
  work_log: number | null;
  hours_logged: string;
  billing_rate: string;
  line_amount: string;
  currency: string;
  description: string | null;
  log_date: string | null;
}

export interface FeeInstalment {
  id: number;
  fee_calculation: number;
  fee_template_stage: number;
  stage_name_snapshot: string;
  stage_order_snapshot: number;
  fee_percentage: string;
  amount: string;
  currency: string;
  status: InstalmentStatus;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  invoiced_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  uninvoiced_amount: string;
  paid_percentage: number;
  invoiced_percentage: number;
  remarks: string | null;
  calculation_lines: FeeCalculationLine[];
  payments: FeeInstalmentPayment[];
}

export interface GeneratedDeliverable {
  id: number;
  fee_calculation: number;
  deliverable: number;
  deliverable_name: string;
  deliverable_status: string;
  deliverable_template: number | null;
  fee_instalment: number | null;
  stage_name: string | null;
  is_auto_generated: boolean;
}

/** ProjectFeeCalculationReadSerializer — one per project (OneToOne). */
export interface ProjectFeeCalculation {
  id: number;
  project: number;
  fee_template: number;
  quantity: string;
  discount_percentage: string;
  currency: string;
  notes: string | null;
  base_fee: string;
  discount_amount: string;
  final_fee: string;
  quantity_unit_snapshot: string;
  rate_snapshot: string | null;
  status: FeeCalcStatus;
  confirmed_at: string | null;
  confirmed_by: number | null;
  instalments: FeeInstalment[];
  generated_deliverables: GeneratedDeliverable[];
  total_paid: string;
  total_outstanding: string;
  completion_percentage: number;
  /** This is FeeTemplate.billing_type (quantity_rate/percentage/hourly) — a
   *  feecalc field, not the unrelated Project.billing_type. */
  billing_type: string;
  billing_type_display: string;
}

// ─── API calls ──────────────────────────────────────────────────────────────

/**
 * Fetch the fee calculation(s) confirmed for a project. In practice this is
 * 0 or 1 result (ProjectFeeCalculation is OneToOne with Project), returned
 * as an array to match the DRF list endpoint shape.
 */
export async function fetchProjectFeeCalculations(
  projectId: number,
): Promise<ProjectFeeCalculation[]> {
  const qs = new URLSearchParams({ project: String(projectId) });
  const res = await fetch(`${BASE}/api/feecalc/project-calculations/?${qs}`, {
    headers: authHeaders(),
  });
  return handle<ProjectFeeCalculation[]>(res);
}

/** GET /api/feecalc/project-calculations/<id>/ — single calc, deep read. */
export async function fetchProjectFeeCalculation(id: number): Promise<ProjectFeeCalculation> {
  const res = await fetch(`${BASE}/api/feecalc/project-calculations/${id}/`, {
    headers: authHeaders(),
  });
  return handle<ProjectFeeCalculation>(res);
}

// ─── Domain helpers (derived purely from feecalc data) ─────────────────────

export interface FeeCollectionSummary {
  currency: string;
  totalFee: number;
  totalCollected: number;
  totalOutstanding: number;
  /** Already invoiced to the client but not (fully) paid — incl. overdue. */
  dueNow: number;
  /** Subset of dueNow that is past its due_date. */
  overdue: number;
  /** Not yet invoiced — outstanding but not currently due. */
  notYetInvoiced: number;
  waived: number;
  completionPct: number;
}

export function summariseFeeCalc(calc: ProjectFeeCalculation): FeeCollectionSummary {
  let dueNow = 0;
  let overdue = 0;
  let notYetInvoiced = 0;
  let waived = 0;

  for (const inst of calc.instalments) {
    const outstanding = Number(inst.outstanding_amount);
    switch (inst.status) {
      case "pending":
        notYetInvoiced += outstanding;
        break;
      case "partially_invoiced":
      case "invoiced":
      case "partially_paid":
        dueNow += outstanding;
        break;
      case "overdue":
        dueNow += outstanding;
        overdue += outstanding;
        break;
      case "waived":
        waived += outstanding;
        break;
      case "paid":
      default:
        break;
    }
  }

  return {
    currency: calc.currency,
    totalFee: Number(calc.final_fee),
    totalCollected: Number(calc.total_paid),
    totalOutstanding: Number(calc.total_outstanding),
    dueNow,
    overdue,
    notYetInvoiced,
    waived,
    completionPct: calc.completion_percentage,
  };
}

/** The earliest unsettled instalment (by stage order) — the "pay this next" stage. */
export function nextPayableInstalment(calc: ProjectFeeCalculation): FeeInstalment | null {
  const unsettled = calc.instalments
    .filter((i) => i.status !== "paid" && i.status !== "waived")
    .sort((a, b) => a.stage_order_snapshot - b.stage_order_snapshot);
  return unsettled[0] ?? null;
}

// ─── Labels & colors ────────────────────────────────────────────────────────

export const FEECALC_STATUS_LABEL: Record<FeeCalcStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  invoicing: "Invoicing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FEECALC_STATUS_COLOR: Record<FeeCalcStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: "#f0f0f0", text: "#888888", border: "#d1d5db" },
  confirmed: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9" },
  invoicing: { bg: "#fff8e1", text: "#f57f17", border: "#ffe082" },
  completed: { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  cancelled: { bg: "#fce4ec", text: "#c62828", border: "#ef9a9a" },
};

export const INSTALMENT_STATUS_LABEL: Record<InstalmentStatus, string> = {
  pending: "Not Yet Invoiced",
  partially_invoiced: "Partially Invoiced",
  invoiced: "Invoiced — Awaiting Payment",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
};

export const INSTALMENT_STATUS_COLOR: Record<
  InstalmentStatus,
  { bg: string; text: string; border: string }
> = {
  pending: { bg: "#f0f0f0", text: "#888888", border: "#d1d5db" },
  partially_invoiced: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9" },
  invoiced: { bg: "#e3f2fd", text: "#1565c0", border: "#64b5f6" },
  partially_paid: { bg: "#fff8e1", text: "#f57f17", border: "#ffe082" },
  paid: { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  overdue: { bg: "#fce4ec", text: "#c62828", border: "#ef9a9a" },
  waived: { bg: "#f3e5f5", text: "#6a1b9a", border: "#ce93d8" },
};