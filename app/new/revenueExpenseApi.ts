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
  id:                number;
  user:              number;
  user_email:        string;
  amount:            number;
  source:            string;
  source_display:    string;
  date:              string;
  remarks:           string;
  organisation_id?:  number;
  organisation_name?: string;
  project_id?:       number;
  project_name?:     string;
  created_at:        string;
  updated_at:        string;
}

export interface CreditRow {
  id:                number;
  user:              number;
  user_email:        string;
  amount:            number;
  category:          string;
  category_display:  string;
  date:              string;
  remarks:           string;
  is_repaid:         boolean;
  repayment_date:    string | null;
  organisation_id?:  number;
  organisation_name?: string;
  project_id?:       number;
  project_name?:     string;
  created_at:        string;
  updated_at:        string;
  status_display:    string;
}

export interface ExpenseRow {
  id:                number;
  date:              string;
  amount:            number;
  category:          string;
  category_label:    string;
  remarks:           string;
  reimbursed:        boolean;
  created_at:        string;
  user_id:           number;
  user_name:         string;
  project_id:        number;
  project_name:      string;
  organisation_id:   number;
  organisation_name: string;
}

export interface OrganisationOption {
  id:   number;
  name: string;
}

export interface ProjectOption {
  id:              number;
  name:            string;
  organisation_id: number;
}

export interface BalanceSheetSummary {
  total_revenue:        number;
  total_expenses:       number;
  net_balance:          number;
  revenue_by_source:    Array<{ source: string; total: number }>;
  expenses_by_category: Array<{ category: string; total: number }>;
  monthly_summary:      Array<{
    month:    string;
    revenue:  number;
    expenses: number;
    net:      number;
  }>;
}

export interface BalanceSheetResponse {
  summary:   BalanceSheetSummary;
  revenues:  RevenueRow[];
  expenses:  ExpenseRow[];
  credits?:  CreditRow[];
  meta?: {
    users_in_org?: Array<{ id: number; name: string; role: string }>;
    [key: string]: any;
  };
}

export interface BalanceSheetParams {
  from?:            string;
  to?:              string;
  year?:            number;
  month?:           number;
  organisation_id?: number;
  project_id?:      number;
  user_id?:         number;
  view_all?:        boolean;
}

// ─── Tax Types ──────────────────────────────────────────────────────────────

export interface TaxRule {
  id:                number;
  name:              string;
  tax_type:          string;
  tax_type_display:  string;
  percentage:        number;
  organisation:      number;
  organisation_name: string;
  project:           number | null;
  project_name:      string | null;
  applies_to:        "revenue" | "expense" | "both";
  applies_to_display: string;
  scope:             "organisation" | "project";
  is_active:         boolean;
  effective_from:    string;
  effective_to:      string | null;
  remarks:           string | null;
  created_at:        string;
  updated_at:        string;
}

export interface FetchTaxParams {
  organisation_id?: number;
  project_id?:      number;
  org_only?:        boolean;
  is_active?:       boolean;
}

// ─── Tax resolution (frontend-only, no extra API call per revenue row) ───────
//
// Call fetchTaxRules({ organisation_id }) once per org load.
// Then use getEffectiveTaxes() per revenue row to resolve which rules apply.
//
// Resolution rule:
//   project-level tax of type X overrides org-level tax of the same type X.
//   If no project-level rule exists for a type, the org-level rule is used.

export function getEffectiveTaxes(
  taxes:       TaxRule[],
  projectId:   number | null,
  revenueDate: string,           // "YYYY-MM-DD"
): TaxRule[] {
  const active = taxes.filter((t) => {
    if (!t.is_active) return false;
    if (t.applies_to === "expense") return false; // skip expense-only taxes
    if (t.effective_from > revenueDate) return false;
    if (t.effective_to && t.effective_to < revenueDate) return false;
    return true;
  });

  const projectRules    = projectId ? active.filter((t) => t.project === projectId) : [];
  const overriddenTypes = new Set(projectRules.map((t) => t.tax_type));
  const orgRules        = active.filter((t) => t.project === null && !overriddenTypes.has(t.tax_type));

  return [...projectRules, ...orgRules];
}

export function computeTaxForRevenues(
  revenues: RevenueRow[],
  taxes:    TaxRule[],
): { totalTax: number; byName: Record<string, number> } {
  const byName: Record<string, number> = {};
  let totalTax = 0;

  for (const rev of revenues) {
    const effective = getEffectiveTaxes(taxes, rev.project_id ?? null, rev.date);
    for (const t of effective) {
      const amt = (rev.amount * t.percentage) / 100;
      byName[t.name] = (byName[t.name] ?? 0) + amt;
      totalTax += amt;
    }
  }

  return {
    totalTax: Math.round(totalTax * 100) / 100,
    byName:   Object.fromEntries(
      Object.entries(byName).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
  };
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

export async function fetchBalanceSheet(
  params: BalanceSheetParams,
): Promise<BalanceSheetResponse> {
  const qs = new URLSearchParams();
  if (params.from)            qs.set("from",            params.from);
  if (params.to)              qs.set("to",              params.to);
  if (params.year)            qs.set("year",            String(params.year));
  if (params.month !== undefined) qs.set("month",       String(params.month));
  if (params.organisation_id) qs.set("organisation_id", String(params.organisation_id));
  if (params.project_id)      qs.set("project_id",      String(params.project_id));
  if (params.user_id)         qs.set("user_id",         String(params.user_id));
  if (params.view_all)        qs.set("view_all",        "true");

  const res = await fetch(`${BASE}/api/v2/finance/balance-sheet/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch balance sheet: ${res.status}`);
  return res.json();
}

export async function fetchTaxRules(
  params: FetchTaxParams = {},
): Promise<TaxRule[]> {
  const qs = new URLSearchParams();
  if (params.organisation_id)         qs.set("organisation_id", String(params.organisation_id));
  if (params.project_id)              qs.set("project_id",      String(params.project_id));
  if (params.org_only)                qs.set("org_only",        "true");
  if (params.is_active !== undefined) qs.set("is_active",       String(params.is_active));

  const res = await fetch(`${BASE}/api/v2/taxes/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch tax rules: ${res.status}`);
  return res.json();
}

export async function createTaxRule(data: Partial<TaxRule>): Promise<TaxRule> {
  const res = await fetch(`${BASE}/api/v2/taxes/`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create tax rule: ${res.status}`);
  return res.json();
}

export async function updateTaxRule(
  id:   number,
  data: Partial<TaxRule>,
): Promise<TaxRule> {
  const res = await fetch(`${BASE}/api/v2/taxes/${id}/`, {
    method:  "PATCH",
    headers: authHeaders(),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update tax rule: ${res.status}`);
  return res.json();
}

export async function deleteTaxRule(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/taxes/${id}/`, {
    method:  "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete tax rule: ${res.status}`);
}

export async function fetchUserRevenues(
  params: BalanceSheetParams,
): Promise<RevenueRow[]> {
  const qs = new URLSearchParams();
  if (params.from)            qs.set("from",            params.from);
  if (params.to)              qs.set("to",              params.to);
  if (params.organisation_id) qs.set("organisation_id", String(params.organisation_id));
  if (params.project_id)      qs.set("project_id",      String(params.project_id));

  const res = await fetch(`${BASE}/api/v2/revenues/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch revenues: ${res.status}`);
  return res.json();
}

export async function fetchUserExpenses(
  params: BalanceSheetParams,
): Promise<ExpenseRow[]> {
  const qs = new URLSearchParams();
  if (params.from)            qs.set("from",     params.from);
  if (params.to)              qs.set("to",       params.to);
  if (params.organisation_id) qs.set("org_id",   String(params.organisation_id));
  if (params.project_id)      qs.set("project_id", String(params.project_id));

  const res = await fetch(`${BASE}/api/v2/expenses/mine/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch expenses: ${res.status}`);
  return res.json();
}