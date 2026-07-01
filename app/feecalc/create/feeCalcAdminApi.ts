// app/feecalc/feeCalcAdminApi.ts
//
// Authenticated (consultant/admin) API helpers for building & managing
// Quote Options. Kept separate from feeCalcApi.ts, which is the public
// (no-auth) calculator surface — this file is only ever used behind a login.

import type { FeeTemplateOption } from "../feeCalcApi";
import type { DiscountPackage } from "../feeCalcTypes";

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

// ─────────────────────────────────────────────────────────────────────────────
// Organisation membership — which orgs can this user admin quotes for?
// ─────────────────────────────────────────────────────────────────────────────
//
// NOTE: this reads /api/my-memberships/ (same endpoint useLogin.ts already
// calls). The exact shape of OrganisationMembership from
// @/redux/features/membershipApiSlice wasn't available while writing this,
// so extractOrgId/extractOrgName below are written defensively to handle
// either `organisation: number` or `organisation: {id, name}`. If your real
// membership shape differs, this is the only spot you should need to touch.

export interface AdminOrganisation {
  id: number;
  name: string;
}

interface RawMembership {
  id: number;
  role: "admin" | "manager" | "member" | "client" | string;
  organisation: number | { id: number; name?: string };
  organisation_name?: string;
}

function extractOrgId(m: RawMembership): number {
  return typeof m.organisation === "number" ? m.organisation : m.organisation.id;
}

function extractOrgName(m: RawMembership): string | undefined {
  if (typeof m.organisation === "object" && m.organisation?.name) return m.organisation.name;
  return m.organisation_name;
}

export async function fetchAdminOrganisations(): Promise<AdminOrganisation[]> {
  const res = await fetch(`${BASE}/api/my-memberships/`, { headers: authHeaders() });
  const data = await handle<RawMembership[]>(res);
  const seen = new Map<number, AdminOrganisation>();
  for (const m of data) {
    if (m.role !== "admin" && m.role !== "manager") continue;
    const id = extractOrgId(m);
    if (!seen.has(id)) {
      seen.set(id, { id, name: extractOrgName(m) ?? `Organisation #${id}` });
    }
  }
  return [...seen.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects (scoped to one organisation)
// ─────────────────────────────────────────────────────────────────────────────
//
// GUESS: assumed endpoint is /api/projects/?organisation=<id>, matching the
// query-param convention used everywhere else in this file (fee-templates,
// discount-packages, quote-options). I don't have project/views.py or urls.py
// so this is unverified — if it 404s, fetchProjectsForOrg throws and the
// create page falls back to a plain "Project ID" number input so nothing
// breaks. Point this at the right URL once you confirm it, and the dropdown
// will start working automatically.

export interface AdminProject {
  id: number;
  name: string;
}

export async function fetchProjectsForOrg(organisationId: number): Promise<AdminProject[]> {
  const qs = new URLSearchParams({ organisation: String(organisationId) });
  const res = await fetch(`${BASE}/api/projects/?${qs}`, { headers: authHeaders() });
  return handle<AdminProject[]>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee templates & discount packages (scoped to one organisation)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchFeeTemplatesForOrg(organisationId: number): Promise<FeeTemplateOption[]> {
  const qs = new URLSearchParams({ active: "true", organisation: String(organisationId) });
  const res = await fetch(`${BASE}/api/feecalc/fee-templates/?${qs}`, { headers: authHeaders() });
  return handle<FeeTemplateOption[]>(res);
}

export interface AdminDiscountPackage extends DiscountPackage {
  activation_code: string;
}

export async function fetchDiscountPackagesForOrg(
  organisationId: number,
): Promise<AdminDiscountPackage[]> {
  const qs = new URLSearchParams({ active: "true", organisation: String(organisationId) });
  const res = await fetch(`${BASE}/api/feecalc/discount-packages/?${qs}`, {
    headers: authHeaders(),
  });
  return handle<AdminDiscountPackage[]>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote Options — create / update / list
// ─────────────────────────────────────────────────────────────────────────────

export interface QuoteOptionPayload {
  organisation: number;
  project?: number | null;
  quantity_template?: number | null;
  hourly_template?: number | null;
  show_quantity: boolean;
  show_hourly: boolean;
  show_lumpsum: boolean;
  lumpsum_amount?: string | null;
  lumpsum_label?: string;
  lumpsum_note?: string | null;
  discount_package?: number | null;
  name: string;
  description?: string | null;
  is_active: boolean;
}

// Shape returned by POST/PATCH — QuoteOptionSerializer (the *write*
// serializer) is flat: FKs come back as bare ids, not nested objects.
export interface QuoteOptionFlat {
  id: number;
  organisation: number;
  project: number | null;
  quantity_template: number | null;
  hourly_template: number | null;
  show_quantity: boolean;
  show_hourly: boolean;
  show_lumpsum: boolean;
  lumpsum_amount: string | null;
  lumpsum_label: string;
  lumpsum_note: string | null;
  discount_package: number | null;
  access_code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

// Shape returned by GET list/retrieve — QuoteOptionReadSerializer nests
// templates/discount package and adds a derived `currency`.
export interface AdminQuoteOptionListItem {
  id: number;
  name: string;
  description: string | null;
  access_code: string;
  is_active: boolean;
  show_quantity: boolean;
  show_hourly: boolean;
  show_lumpsum: boolean;
  lumpsum_amount: string | null;
  currency: string;
  quantity_template: { id: number; name: string } | null;
  hourly_template: { id: number; name: string } | null;
  discount_package: { id: number; name: string } | null;
}

export async function createQuoteOption(payload: QuoteOptionPayload): Promise<QuoteOptionFlat> {
  const res = await fetch(`${BASE}/api/feecalc/quote-options/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handle<QuoteOptionFlat>(res);
}

export async function updateQuoteOption(
  id: number,
  payload: Partial<QuoteOptionPayload>,
): Promise<QuoteOptionFlat> {
  const res = await fetch(`${BASE}/api/feecalc/quote-options/${id}/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handle<QuoteOptionFlat>(res);
}

export async function fetchMyQuoteOptions(
  organisationId: number,
): Promise<AdminQuoteOptionListItem[]> {
  const qs = new URLSearchParams({ organisation: String(organisationId) });
  const res = await fetch(`${BASE}/api/feecalc/quote-options/?${qs}`, {
    headers: authHeaders(),
  });
  return handle<AdminQuoteOptionListItem[]>(res);
}

// Single-quote retrieve, for the edit flow. QuoteOptionReadSerializer nests
// quantity_template/hourly_template/discount_package but leaves
// `organisation` and `project` as plain FK ids (only the fields explicitly
// overridden in QuoteOptionReadSerializer get nested).
export interface AdminQuoteOptionDetail {
  id: number;
  organisation: number;
  project: number | null;
  quantity_template: { id: number; name: string } | null;
  hourly_template: { id: number; name: string } | null;
  show_quantity: boolean;
  show_hourly: boolean;
  show_lumpsum: boolean;
  lumpsum_amount: string | null;
  lumpsum_label: string;
  lumpsum_note: string | null;
  discount_package: { id: number; name: string } | null;
  access_code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  currency: string;
}

export async function fetchQuoteOption(id: number): Promise<AdminQuoteOptionDetail> {
  const res = await fetch(`${BASE}/api/feecalc/quote-options/${id}/`, {
    headers: authHeaders(),
  });
  return handle<AdminQuoteOptionDetail>(res);
}