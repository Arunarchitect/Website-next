// app/bills/billsApi.ts
// All backend calls for the bills UI live here.

const BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_HOST ?? "") : "";

// ── Auth ────────────────────────────────────────────────────────────────────
function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") || localStorage.getItem("access_token") ||
    localStorage.getItem("token") || sessionStorage.getItem("access") || "";
}
function hdr(json = true): Record<string, string> {
  const t = token();
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

let refreshing: Promise<string | null> | null = null;
function refreshAccess(): Promise<string | null> {
  const r = typeof window !== "undefined" ? localStorage.getItem("refresh") : null;
  if (!r) return Promise.resolve(null);
  refreshing ??= fetch(`${BASE}/api/jwt/refresh/`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: r }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((d) => { if (d?.access) { localStorage.setItem("access", d.access); return d.access as string; } return null; })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

// fetch with the bearer token; on a 401 it refreshes the token once and retries
async function authFetch(path: string, init: RequestInit = {}, json = true): Promise<Response> {
  const send = () => fetch(`${BASE}${path}`, { ...init, headers: { ...hdr(json), ...(init.headers ?? {}) } });
  let res = await send();
  if (res.status === 401 && (await refreshAccess())) res = await send();
  return res;
}

async function fail(res: Response): Promise<never> {
  const err: Record<string, unknown> = await res.json().catch(() => ({}));
  const detail =
    (err.detail as string | undefined) ??
    Object.entries(err).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ");
  throw new Error(detail || `HTTP ${res.status}`);
}
export async function call<T>(path: string, init: RequestInit = {}, json = true): Promise<T> {
  const res = await authFetch(path, init, json);
  if (!res.ok) return fail(res);
  if (res.status === 204) return undefined as T;
  return res.json();
}
// DRF may return a plain list or a paginated {results: []}
export const list = <T,>(d: T[] | { results: T[] }): T[] => (Array.isArray(d) ? d : d.results ?? []);

async function blob(path: string): Promise<Blob> {
  const res = await authFetch(path, {}, false);
  if (!res.ok) return fail(res);
  return res.blob();
}
export async function openBlob(path: string, filename?: string) {
  const b = await blob(path);
  const url = URL.createObjectURL(b);
  if (filename) {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  } else {
    window.open(url, "_blank");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface Project { id: number; name: string }
export interface Instalment {
  id: number;
  fee_calculation?: number;
  stage_name_snapshot?: string;
  stage_name?: string; name?: string; label?: string;     // whichever the serializer sends
  amount: string | number;
  invoiced_amount?: string | number;
  paid_amount?: string | number;
  status?: string;
  due_date?: string | null;
}
export interface FeeCalc { id: number; name?: string; currency?: string; instalments: Instalment[] }
export interface BillPayment {
  id: number;
  amount: string | number;
  paid_on: string;            // YYYY-MM-DD
  method: string;
  reference: string;
  remarks?: string | null;
}
export interface Bill {
  id: number;
  number?: string; bill_number?: string;
  instalment: number;
  amount: string | number;
  status: string;                                         // draft | issued | cancelled
  payment_status?: string;                                // unpaid | partial | paid
  paid_amount?: string | number;
  balance?: string | number;
  visible_to_client?: boolean;
  issue_date?: string | null;
  currency?: string;
  payments?: BillPayment[];
}
export interface BillTemplate { id: number; name: string; is_active?: boolean }
export interface Member {
  id: number; role: string;
  user_email?: string; email?: string; user?: { email?: string; username?: string } | number;
  project?: number | null; project_name?: string | null;
}
export interface MyBill extends Bill { project_name?: string }

// ── Projects & fee calculations ────────────────────────────────────────────
export const fetchOrgProjects = (orgId: number) =>
  call<Project[] | { results: Project[] }>(`/api/organisations/${orgId}/projects/`).then(list);

// Calculations for a project; if the serializer doesn't nest instalments,
// they are loaded from /instalments/ instead.
export async function fetchProjectFeeCalcs(projectId: number): Promise<FeeCalc[]> {
  const calcs = await call<FeeCalc[] | { results: FeeCalc[] }>(
    `/api/feecalc/project-calculations/?project=${projectId}`).then(list);
  return Promise.all(calcs.map(async (c) => {
    if (c.instalments?.length) return c;
    try {
      const all = await call<Instalment[] | { results: Instalment[] }>(
        `/api/feecalc/instalments/?fee_calculation=${c.id}`).then(list);
      return { ...c, instalments: all.filter((i) => i.fee_calculation === undefined || i.fee_calculation === c.id) };
    } catch {
      return { ...c, instalments: c.instalments ?? [] };
    }
  }));
}

// ── Bills ──────────────────────────────────────────────────────────────────
export const fetchBills = (instalmentId: number) =>
  call<Bill[] | { results: Bill[] }>(`/api/feecalc/bills/?instalment=${instalmentId}`).then(list);

export const createBill = (fd: FormData) => call<Bill>(`/api/feecalc/bills/`, { method: "POST", body: fd }, false);
export const issueBill = (id: number) => call<Bill>(`/api/feecalc/bills/${id}/issue/`, { method: "POST" });
export const cancelBill = (id: number) => call<Bill>(`/api/feecalc/bills/${id}/cancel/`, { method: "POST" });
export const deleteBill = (id: number) => call<void>(`/api/feecalc/bills/${id}/`, { method: "DELETE" });
export const recordPayment = (id: number, body: { amount: string; paid_on?: string; method?: string; reference?: string; remarks?: string }) =>
  call<unknown>(`/api/feecalc/bills/${id}/record-payment/`, { method: "POST", body: JSON.stringify(body) });
export const updatePayment = (billId: number, paymentId: number, body: { paid_on?: string; method?: string; reference?: string }) =>
  call<unknown>(`/api/feecalc/bills/${billId}/payments/${paymentId}/`, { method: "PATCH", body: JSON.stringify(body) });
export const downloadBill = (id: number, name: string) => openBlob(`/api/feecalc/bills/${id}/download/`, `${name}.pdf`);
export const fetchMyBills = () =>
  call<MyBill[] | { results: MyBill[] }>(`/api/feecalc/my-bills/`).then(list);

// ── Templates ──────────────────────────────────────────────────────────────
export const fetchTemplates = (orgId: number) =>
  call<BillTemplate[] | { results: BillTemplate[] }>(`/api/feecalc/bill-templates/?organisation=${orgId}`).then(list);
export const uploadTemplate = (fd: FormData) =>
  call<BillTemplate>(`/api/feecalc/bill-templates/`, { method: "POST", body: fd }, false);
export const deleteTemplate = (id: number) => call<void>(`/api/feecalc/bill-templates/${id}/`, { method: "DELETE" });
export const previewTemplate = (id: number) => openBlob(`/api/feecalc/bill-templates/${id}/preview/`);
export const fetchTokens = () => call<unknown>(`/api/feecalc/bill-templates/tokens/`);

// ── Members (org-wide admins only) ─────────────────────────────────────────
export const fetchMembers = (orgId: number) =>
  call<Member[] | { results: Member[] }>(`/api/org-admin/${orgId}/members/`).then(list);
export const addMember = (orgId: number, body: { email: string; role: string }) =>
  call<Member>(`/api/org-admin/${orgId}/members/`, { method: "POST", body: JSON.stringify(body) });
export const updateMember = (id: number, body: { role?: string; project?: number | null }) =>
  call<Member>(`/api/org-admin/members/${id}/`, { method: "PATCH", body: JSON.stringify(body) });
export const removeMember = (id: number) => call<void>(`/api/org-admin/members/${id}/`, { method: "DELETE" });