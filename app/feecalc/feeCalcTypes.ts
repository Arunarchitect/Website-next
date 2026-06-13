// app/feecalc/feeCalcTypes.ts

import type { jsPDF } from "jspdf";
import type { FeeTemplateOption, MemberBillingRateItem } from "./feeCalcApi";

// ─── jsPDF augmentation ───────────────────────────────────────────────────────
export interface JSPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

// ─── Core types ────────────────────────────────────────────────────────────────

export interface DiscountRule {
  id: number;
  label: string;
  description: string | null;
  condition_type: "toggle" | "opensource" | "optout_per_item";
  discount_pct: string;
  max_optout_items: number;
  order: number;
  is_active: boolean;
}

export interface DiscountPackage {
  id: number;
  name: string;
  description: string | null;
  max_total_discount_pct: string;
  rules: DiscountRule[];
  activation_code?: string | null;
}

export interface QuoteOption {
  id: number;
  name: string;
  description: string | null;
  show_quantity: boolean;
  show_hourly: boolean;
  show_lumpsum: boolean;
  quantity_template: FeeTemplateOption | null;
  hourly_template: FeeTemplateOption | null;
  lumpsum_amount: string | null;
  lumpsum_label: string;
  lumpsum_note: string | null;
  discount_package: DiscountPackage | null;
  access_code: string;
  currency: string;
}

export interface DeliverableItem {
  id: number;
  name: string;
  is_mandatory: boolean;
  order: number;
  opted_out?: boolean;
}

export interface StageItem {
  order: number;
  stage_name: string;
  fee_percentage: string | number;
  instalment_amount?: string | number;
  payment_terms_days: number;
  deliverables: DeliverableItem[];
}

export interface QuantityResult {
  template_id: number;
  template_name: string;
  quantity: number | string;
  quantity_unit: string | null;
  rate: string | number;
  base_fee: string | number;
  discount_pct: string | number;
  discount_amt: string | number;
  final_fee: string | number;
  stages: StageItem[];
}

export interface HourlyResult {
  template_id: number;
  template_name: string;
  default_hourly_rate: string;
  note: string;
  consultant_rates: MemberBillingRateItem[];
  stages: StageItem[];
}

export interface DiscountBreakdownLine {
  rule_id: number | null;
  label: string;
  pct: string | null;
  type: string;
}

export interface QuotePreviewResult {
  quote_option_id: number;
  quote_name: string;
  discount_pct: string;
  discount_breakdown: DiscountBreakdownLine[];
  opted_out_ids: number[];
  currency: string;
  quantity_result: QuantityResult | null;
  hourly_result: HourlyResult | undefined;
}

export interface ActiveTypes {
  quantity: boolean;
  hourly: boolean;
  lumpsum: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  bg:       "#ffffff",
  surface:  "#f7f8fa",
  border:   "#e5e7eb",
  borderMd: "#d1d5db",
  t1:       "#111827",
  t2:       "#374151",
  t3:       "#6b7280",
  t4:       "#9ca3af",
  amber:    "#b45309",
  amberBg:  "#fffbeb",
  amberBd:  "#fcd34d",
  teal:     "#0f766e",
  tealBg:   "#f0fdfa",
  tealBd:   "#99f6e4",
  green:    "#15803d",
  greenBg:  "#f0fdf4",
  greenBd:  "#86efac",
  purple:   "#4338ca",
  purpleBg: "#eef2ff",
  purpleBd: "#a5b4fc",
  indigo:   "#4338ca",
  indigoBg: "#eef2ff",
  indigoBd: "#a5b4fc",
  red:      "#dc2626",
  redBg:    "#fef2f2",
  redBd:    "#fca5a5",
};

// ─── Numeric helpers ──────────────────────────────────────────────────────────

export const r2 = (n: number) => Math.round(n * 100) / 100;
export const nv = (v: string | number | null | undefined) => Number(v ?? 0);

// The model stores role as CharField(blank=True, default=""), so empty string
// must be treated the same as null.
export function normaliseRole(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ─── Local fee compute (client-side fallback / optimistic preview) ────────────

export function computeQtyLocal(
  tpl: FeeTemplateOption,
  qty: number,
  discPct: number,
  optedOutIds: Set<number>,
): QuantityResult | null {
  if (!qty || qty <= 0) return null;
  const rate = Number(tpl.default_rate_per_unit ?? 0);
  const base = qty * rate;
  const discAmt = (base * discPct) / 100;
  const final = base - discAmt;
  return {
    template_id: tpl.id,
    template_name: tpl.name,
    quantity: qty,
    quantity_unit: tpl.quantity_unit?.symbol ?? null,
    rate,
    base_fee: r2(base),
    discount_pct: discPct,
    discount_amt: r2(discAmt),
    final_fee: r2(final),
    stages: tpl.template_stages.map((ts) => ({
      order: ts.order,
      stage_name: ts.fee_stage.name,
      fee_percentage: ts.fee_percentage,
      instalment_amount: r2((final * Number(ts.fee_percentage)) / 100),
      payment_terms_days: ts.payment_terms_days,
      deliverables: (ts.deliverable_templates ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((dt) => ({
          id: dt.id,
          name: dt.name,
          is_mandatory: dt.is_mandatory,
          order: dt.order,
          opted_out: !dt.is_mandatory && optedOutIds.has(dt.id),
        })),
    })),
  };
}

export function computeLocalDiscPct(
  pkg: DiscountPackage | null,
  appliedRuleIds: Set<number>,
  optedOutCount: number,
): number {
  if (!pkg) return 0;
  let total = 0;
  for (const rule of pkg.rules) {
    if (!rule.is_active) continue;
    if (rule.condition_type === "toggle" || rule.condition_type === "opensource") {
      if (appliedRuleIds.has(rule.id)) total += Number(rule.discount_pct);
    } else if (rule.condition_type === "optout_per_item") {
      const cap = rule.max_optout_items > 0 ? rule.max_optout_items : optedOutCount;
      const count = Math.min(optedOutCount, cap);
      if (count > 0) total += Number(rule.discount_pct) * count;
    }
  }
  return Math.min(total, Number(pkg.max_total_discount_pct));
}