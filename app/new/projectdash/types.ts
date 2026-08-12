// types.ts
// Shared TypeScript types for the Projects feature.

// ---------------------------------------------------------------------------
// Core enums
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

export type FeeCalcStatus = "draft" | "confirmed" | "invoicing" | "completed" | "cancelled";

export type DetailTab = "overview" | "deliverables" | "financials";

// ---------------------------------------------------------------------------
// Simple option types
// ---------------------------------------------------------------------------

export interface OrganisationOption {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Projectmoney types (from projectmoney/serializers.py)
// ---------------------------------------------------------------------------

export interface FeeStage {
  id: number;
  stage_name: string;
  order: number;
  stage_percentage: number; // Decimal -> number
  stage_fee: number; // auto-computed
  payment_status: PaymentStatus;
  payment_status_display: string;
  invoice_number: string | null;
  invoice_date: string | null; // "YYYY-MM-DD"
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
  collection_percentage: number; // 0-100
  stages_collected_count: number;
  stages_total_count: number;
  stages: FeeStage[];
}

export interface ManualHoursEntry {
  id: number;
  user_display: string;
  start_date: string; // "YYYY-MM-DD"
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

// ---------------------------------------------------------------------------
// Feecalc types (from feecalc/models.py - ProjectFeeCalculation)
// ---------------------------------------------------------------------------

/** Summary of the quote-derived fee calculation for a project, if one exists. */
export interface FeeCalcSummary {
  id: number;
  status: FeeCalcStatus;
  status_display: string;
  currency: string;
  final_fee: number; // total fee to be collected
  total_paid: number; // revenue collected so far
  total_outstanding: number; // yet to be collected
  completion_percentage: number; // 0-100
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
  feecalc: FeeCalcSummary | null; // quote-derived fee calc, from feecalc app
  billing_cost: {
    total: number | null;
    breakdown: BillingBreakdownItem[];
  };
  revenue_collected: number;
  comparison: {
    billing_cost: number;
    revenue_collected: number;
    difference: number; // positive = profitable
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