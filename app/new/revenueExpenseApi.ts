// app/new/revenueExpenseApi.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

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

export interface RevenueRow {
  id: number;
  user: number;
  user_email: string;
  amount: number;
  source: string;
  source_display: string;
  date: string;
  remarks: string;
  organisation_id?: number;
  organisation_name?: string;
  project_id?: number;
  project_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreditRow {
  id: number;
  user: number;
  user_email: string;
  amount: number;
  category: string;
  category_display: string;
  date: string;
  remarks: string;
  is_repaid: boolean;
  repayment_date: string | null;
  organisation_id?: number;
  organisation_name?: string;
  project_id?: number;
  project_name?: string;
  created_at: string;
  updated_at: string;
  status_display: string;
}

export interface ExpenseRow {
  id: number;
  date: string;
  amount: number;
  category: string;
  category_label: string;
  remarks: string;
  reimbursed: boolean;
  created_at: string;
  user_id: number;
  user_name: string;
  project_id: number;
  project_name: string;
  organisation_id: number;
  organisation_name: string;
}

export interface OrganisationOption {
  id: number;
  name: string;
}

export interface ProjectOption {
  id: number;
  name: string;
  organisation_id: number;
}

export interface BalanceSheetSummary {
  total_revenue: number;
  total_expenses: number;
  net_balance: number;
  revenue_by_source: Array<{ source: string; total: number }>;
  expenses_by_category: Array<{ category: string; total: number }>;
  monthly_summary: Array<{
    month: string;
    revenue: number;
    expenses: number;
    net: number;
  }>;
}

// In app/new/revenueExpenseApi.ts

export interface BalanceSheetResponse {
  summary: BalanceSheetSummary;
  revenues: RevenueRow[];
  expenses: ExpenseRow[];
  credits?: CreditRow[];
  meta?: {  // ← Add this meta property
    users_in_org?: Array<{ id: number; name: string; role: string }>;
    [key: string]: any; // For any other meta fields
  };
}

export interface BalanceSheetParams {
  from?: string;
  to?: string;
  year?: number;
  month?: number;
  organisation_id?: number;
  project_id?: number;
}

// Add to revenueExpenseApi.ts

export interface BalanceSheetParams {
  from?: string;
  to?: string;
  year?: number;
  month?: number;
  organisation_id?: number;
  project_id?: number;
  user_id?: number;  // ← New: filter by specific user
  view_all?: boolean; // ← New: view all users in org
}



// ─── API Calls ─────────────────────────────────────────────────────────────

export async function fetchOrganisations(): Promise<OrganisationOption[]> {
  const res = await fetch(`${BASE}/api/v2/organisations/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch organisations: ${res.status}`);
  return res.json();
}

export async function fetchProjectsByOrg(orgId: number): Promise<ProjectOption[]> {
  const res = await fetch(`${BASE}/api/v2/projects/?organisation_id=${orgId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
}

export async function fetchBalanceSheet(params: BalanceSheetParams): Promise<BalanceSheetResponse> {
  const qs = new URLSearchParams();
  
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.year) qs.set("year", String(params.year));
  if (params.month !== undefined) qs.set("month", String(params.month));
  if (params.organisation_id) qs.set("organisation_id", String(params.organisation_id));
  if (params.project_id) qs.set("project_id", String(params.project_id));
  if (params.user_id) qs.set("user_id", String(params.user_id));
  if (params.view_all) qs.set("view_all", "true");
  
  const res = await fetch(`${BASE}/api/v2/finance/balance-sheet/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch balance sheet: ${res.status}`);
  return res.json();
}

export async function fetchUserRevenues(params: BalanceSheetParams): Promise<RevenueRow[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.organisation_id) qs.set("organisation_id", String(params.organisation_id));
  if (params.project_id) qs.set("project_id", String(params.project_id));
  
  const res = await fetch(`${BASE}/api/v2/revenues/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch revenues: ${res.status}`);
  return res.json();
}

export async function fetchUserExpenses(params: BalanceSheetParams): Promise<ExpenseRow[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.organisation_id) qs.set("org_id", String(params.organisation_id));
  if (params.project_id) qs.set("project_id", String(params.project_id));
  
  const res = await fetch(`${BASE}/api/v2/expenses/mine/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch expenses: ${res.status}`);
  return res.json();
}