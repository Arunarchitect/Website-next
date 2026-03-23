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

// ─── Meta types ───────────────────────────────────────────────────────────────

export interface ExpenseOrgOption {
  id:   number;
  name: string;
}

export interface ExpenseProjectOption {
  id:              number;
  name:            string;
  organisation_id: number;
}

export interface ExpenseMemberOption {
  id:   number;
  name: string;
}

export interface ExpenseCategoryOption {
  value: string;
  label: string;
}

export interface ExpenseMeta {
  organisations: ExpenseOrgOption[];
  projects:      ExpenseProjectOption[];
  members:       ExpenseMemberOption[];
  categories:    ExpenseCategoryOption[];
}

// ─── Expense row ──────────────────────────────────────────────────────────────

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

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface ExpenseSummary {
  total:       number;
  reimbursed:  number;
  pending:     number;
  by_category: Record<string, number>;
}

// ─── Paginated result ─────────────────────────────────────────────────────────

export interface ExpenseMonitorResult {
  count:   number;
  page:    number;
  pages:   number;
  summary: ExpenseSummary;
  results: ExpenseRow[];
}

// ─── Filter params ────────────────────────────────────────────────────────────

export interface ExpenseMonitorParams {
  org_id?:     number | string;
  project_id?: number | string;
  member_id?:  number | string;
  category?:   string;
  reimbursed?: "true" | "false" | "all";
  from?:       string;   // YYYY-MM-DD
  to?:         string;   // YYYY-MM-DD
  page?:       number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchExpenseMeta(): Promise<ExpenseMeta> {
  const res = await fetch(`${BASE}/api/v2/expenses/meta/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Expense meta fetch failed: ${res.status}`);
  return res.json() as Promise<ExpenseMeta>;
}

export async function fetchExpenseMonitor(
  params: ExpenseMonitorParams = {},
): Promise<ExpenseMonitorResult> {
  const qs = new URLSearchParams();

  if (params.org_id)                                    qs.set("org_id",     String(params.org_id));
  if (params.project_id)                                qs.set("project_id", String(params.project_id));
  if (params.member_id)                                 qs.set("member_id",  String(params.member_id));
  if (params.category)                                  qs.set("category",   params.category);
  if (params.reimbursed && params.reimbursed !== "all") qs.set("reimbursed", params.reimbursed);
  if (params.from)                                      qs.set("from",       params.from);
  if (params.to)                                        qs.set("to",         params.to);
  if (params.page)                                      qs.set("page",       String(params.page));

  const res = await fetch(`${BASE}/api/v2/expenses/monitor/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Expense monitor fetch failed: ${res.status}`);
  return res.json() as Promise<ExpenseMonitorResult>;
}