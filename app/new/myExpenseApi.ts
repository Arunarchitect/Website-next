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

// ─── Shared types (re-exported for convenience) ───────────────────────────────

export interface ExpenseProjectOption {
  id:              number;
  name:            string;
  organisation_id: number;
}

export interface ExpenseCategoryOption {
  value: string;
  label: string;
}

export interface ExpenseMeta {
  organisations: { id: number; name: string }[];
  projects:      ExpenseProjectOption[];
  members:       { id: number; name: string }[];
  categories:    ExpenseCategoryOption[];
}

// ─── Row ──────────────────────────────────────────────────────────────────────

export interface MyExpenseRow {
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

// ─── Summary + paginated result ───────────────────────────────────────────────

export interface MyExpenseSummary {
  total:       number;
  reimbursed:  number;
  pending:     number;
  by_category: Record<string, number>;
}

export interface MyExpenseResult {
  count:   number;
  page:    number;
  pages:   number;
  summary: MyExpenseSummary;
  results: MyExpenseRow[];
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface MyExpenseFilterParams {
  project_id?: number | string;
  category?:   string;
  reimbursed?: "true" | "false" | "all";
  from?:       string;
  to?:         string;
  page?:       number;
}

export interface MyExpensePayload {
  project_id:  number | string;
  amount:      number | string;
  category:    string;
  date:        string;
  remarks?:    string;
  reimbursed?: boolean;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchMyExpenses(
  params: MyExpenseFilterParams = {},
): Promise<MyExpenseResult> {
  const qs = new URLSearchParams();
  if (params.project_id)                                qs.set("project_id", String(params.project_id));
  if (params.category)                                  qs.set("category",   params.category);
  if (params.reimbursed && params.reimbursed !== "all") qs.set("reimbursed", params.reimbursed);
  if (params.from)                                      qs.set("from",       params.from);
  if (params.to)                                        qs.set("to",         params.to);
  if (params.page)                                      qs.set("page",       String(params.page));

  const res = await fetch(`${BASE}/api/v2/expenses/mine/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to load expenses: ${res.status}`);
  return res.json() as Promise<MyExpenseResult>;
}

export async function createMyExpense(payload: MyExpensePayload): Promise<MyExpenseRow> {
  const res = await fetch(`${BASE}/api/v2/expenses/mine/`, {
    method:  "POST",
    headers: authHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("Create failed"), { detail: err });
  }
  return res.json() as Promise<MyExpenseRow>;
}

export async function updateMyExpense(
  id: number,
  payload: Partial<MyExpensePayload>,
): Promise<MyExpenseRow> {
  const res = await fetch(`${BASE}/api/v2/expenses/mine/${id}/`, {
    method:  "PUT",
    headers: authHeaders(),
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("Update failed"), { detail: err });
  }
  return res.json() as Promise<MyExpenseRow>;
}

export async function deleteMyExpense(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v2/expenses/mine/${id}/`, {
    method:  "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("Delete failed"), { detail: err });
  }
}

export async function fetchExpenseMeta(): Promise<ExpenseMeta> {
  const res = await fetch(`${BASE}/api/v2/expenses/meta/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Meta fetch failed: ${res.status}`);
  return res.json() as Promise<ExpenseMeta>;
}