// app/feecalc/feeCalcApi.ts

import type { QuoteOption, DiscountPackage, QuotePreviewResult } from "./feeCalcTypes";

const BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_HOST ?? "") : "";
const JSON_HEADERS = { "Content-Type": "application/json" };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemberBillingRateItem {
  id: number;
  user: number;
  user_display: string;       // e.g. "Arjun Menon"  — returned by read serializer
  role?: string | null;       // e.g. "Project Head" — designation/role
  rate_per_hour: string;
  currency: string;
  effective_from: string;     // "YYYY-MM-DD"
  effective_to: string | null;
  is_active: boolean;
  project: number | null;     // null = template-wide rate
  remarks: string | null;
}

export interface FeeTemplateOption {
  id: number;
  name: string;
  description: string | null;
  billing_type: "quantity_rate" | "percentage" | "hourly";
  billing_type_display: string;
  quantity_unit: {
    id: number;
    name: string;
    symbol: string;
  } | null;
  default_rate_per_unit: string | null;
  default_percentage: string | null;
  default_hourly_rate: string | null;
  currency: string;
  stage_count: number;
  total_stage_percentage: string;
  template_stages: FeeTemplateStageDetail[];
  // Only populated for hourly templates (nested by read serializer)
  member_billing_rates: MemberBillingRateItem[];
}

export interface FeeTemplateStageDetail {
  id: number;
  order: number;
  fee_percentage: string;
  payment_terms_days: number;
  description: string | null;
  fee_stage: {
    id: number;
    name: string;
    code: string;
    description: string | null;
  };
  deliverable_templates: {
    id: number;
    name: string;
    is_mandatory: boolean;
    order: number;
  }[];
}

export interface FeePreviewStage {
  order: number;
  stage_name: string;
  fee_percentage: string | number;
  instalment_amount: string | number;
  payment_terms_days: number;
  deliverables: {
    id: number;
    name: string;
    is_mandatory: boolean;
    order: number;
  }[];
}

export interface FeePreviewResult {
  template_id: number;
  template_name: string;
  billing_type: string;
  billing_type_display: string;
  quantity: string | number;
  quantity_unit: string | null;
  rate: string | number | null;
  currency: string;
  base_fee: string | number;
  discount_percentage: string | number;
  discount_amount: string | number;
  final_fee: string | number;
  stages: FeePreviewStage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("access") ?? "")
      : "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Authenticated API calls ──────────────────────────────────────────────────

export async function fetchFeeTemplates(
  organisationId?: number,
): Promise<FeeTemplateOption[]> {
  const qs = new URLSearchParams({ active: "true" });
  if (organisationId) qs.set("organisation", String(organisationId));

  const res = await fetch(`${BASE}/api/feecalc/fee-templates/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch fee templates: ${res.status}`);
  return res.json();
}

export async function fetchFeeTemplate(id: number): Promise<FeeTemplateOption> {
  const res = await fetch(`${BASE}/api/feecalc/fee-templates/${id}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch fee template: ${res.status}`);
  return res.json();
}

export async function fetchFeePreview(params: {
  fee_template_id: number;
  quantity: number | string;
  discount_percentage?: number | string;
  currency?: string;
}): Promise<FeePreviewResult> {
  const body = {
    fee_template_id: params.fee_template_id,
    quantity: String(params.quantity),
    discount_percentage: String(params.discount_percentage ?? "0"),
    currency: params.currency ?? "INR",
  };

  const res = await fetch(`${BASE}/api/feecalc/preview/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string }).detail ?? `Preview failed: ${res.status}`,
    );
  }
  return res.json();
}

export async function fetchTemplatePreview(
  templateId: number,
  quantity: number | string,
  discountPercentage: number | string = 0,
  currency = "INR",
): Promise<FeePreviewResult> {
  const qs = new URLSearchParams({
    quantity: String(quantity),
    discount_percentage: String(discountPercentage),
    currency,
  });

  const res = await fetch(
    `${BASE}/api/feecalc/fee-templates/${templateId}/preview/?${qs}`,
    { headers: authHeaders() },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { detail?: string }).detail ?? `Preview failed: ${res.status}`,
    );
  }
  return res.json();
}

// ─── Public (no-auth) API calls ───────────────────────────────────────────────

export async function fetchPublicQuote(code: string): Promise<QuoteOption> {
  const res = await fetch(
    `${BASE}/api/feecalc/public/quote/?code=${encodeURIComponent(code.trim().toUpperCase())}`,
    { headers: JSON_HEADERS },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function unlockDiscount(quoteCode: string, activationCode: string): Promise<DiscountPackage> {
  const res = await fetch(`${BASE}/api/feecalc/public/unlock-discount/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      quote_access_code: quoteCode.trim().toUpperCase(),
      activation_code: activationCode.trim().toUpperCase(),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function publicPreview(payload: {
  code: string;
  quantity: string;
  applied_rule_ids: number[];
  opted_out_deliverable_ids: number[];
  currency: string;
}): Promise<QuotePreviewResult> {
  const res = await fetch(`${BASE}/api/feecalc/public/preview/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function fmtCurrency(
  value: string | number | null | undefined,
  currency = "INR",
): string {
  const n = Number(value ?? 0);
  if (isNaN(n)) return "—";
  if (currency === "INR") {
    return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function billingTypeLabel(type: string): string {
  switch (type) {
    case "quantity_rate": return "Quantity × Rate";
    case "percentage":    return "% of Project Value";
    case "hourly":        return "Hourly";
    default:              return type;
  }
}

export function billingTypeIcon(type: string): string {
  switch (type) {
    case "quantity_rate": return "⬡";
    case "percentage":    return "%";
    case "hourly":        return "◷";
    default:              return "•";
  }
}

export function quantityLabel(template: FeeTemplateOption): string {
  switch (template.billing_type) {
    case "quantity_rate":
      return template.quantity_unit
        ? `Quantity (${template.quantity_unit.symbol})`
        : "Quantity";
    case "percentage":
      return `Project / Contract Value (${template.currency})`;
    case "hourly":
      return "Estimated Hours";
    default:
      return "Quantity";
  }
}

export function quantityPlaceholder(template: FeeTemplateOption): string {
  switch (template.billing_type) {
    case "quantity_rate":
      return template.quantity_unit
        ? `e.g. 450 ${template.quantity_unit.symbol}`
        : "Enter quantity";
    case "percentage":
      return "e.g. 5000000";
    case "hourly":
      return "e.g. 120";
    default:
      return "Enter value";
  }
}