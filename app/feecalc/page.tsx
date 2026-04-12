"use client";
// app/feecalc/page.tsx
//
// Discounts are now fully data-driven from DiscountRule rows.
// No hardcoded opensource/returning_client fields anywhere.
// The client sees whatever rules the consultant has defined in their DiscountPackage.

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fmtCurrency,
  quantityLabel,
  quantityPlaceholder,
  type FeeTemplateOption,
  type MemberBillingRateItem,
} from "./feeCalcApi";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  surface:  "#080b14",
  card:     "#0d1120",
  cardB:    "rgba(255,255,255,0.06)",
  hover:    "rgba(255,255,255,0.03)",
  divider:  "rgba(255,255,255,0.07)",
  t1:       "#eef2ff",
  t2:       "#c0cce8",
  t3:       "#7a8aaa",
  t4:       "#3e4d68",
  t5:       "#222d44",
  amber:    "#f5a623",
  amberL:   "rgba(245,166,35,0.08)",
  amberM:   "rgba(245,166,35,0.30)",
  teal:     "#2dd4bf",
  tealL:    "rgba(45,212,191,0.08)",
  tealM:    "rgba(45,212,191,0.30)",
  green:    "#34d399",
  greenL:   "rgba(52,211,153,0.08)",
  greenM:   "rgba(52,211,153,0.28)",
  purple:   "#a78bfa",
  purpleL:  "rgba(167,139,250,0.08)",
  purpleM:  "rgba(167,139,250,0.28)",
  red:      "#f87171",
};

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches DiscountRule model
interface DiscountRule {
  id: number;
  label: string;
  description: string | null;
  condition_type: "toggle" | "opensource" | "optout_per_item";
  discount_pct: string;        // e.g. "5.00"
  max_optout_items: number;    // 0 = unlimited
  order: number;
  is_active: boolean;
}

interface DiscountPackage {
  id: number;
  name: string;
  description: string | null;
  max_total_discount_pct: string;
  rules: DiscountRule[];
}

interface QuoteOption {
  id: number;
  name: string;
  description: string | null;
  billing_mode: "quantity_only" | "hourly_only" | "both";
  quantity_template: FeeTemplateOption | null;
  hourly_template: FeeTemplateOption | null;
  discount_package: DiscountPackage | null;
  currency: string;
}

interface DeliverableItem {
  id: number;
  name: string;
  is_mandatory: boolean;
  order: number;
  opted_out?: boolean;
}

interface StageItem {
  order: number;
  stage_name: string;
  fee_percentage: string | number;
  instalment_amount?: string | number;
  payment_terms_days: number;
  deliverables: DeliverableItem[];
}

interface QuantityResult {
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

interface HourlyResult {
  template_id: number;
  template_name: string;
  default_hourly_rate: string;
  note: string;
  consultant_rates: MemberBillingRateItem[];
  stages: StageItem[];
}

interface DiscountBreakdownLine {
  rule_id: number | null;
  label: string;
  pct: string | null;
  type: string;
}

interface QuotePreviewResult {
  quote_option_id: number;
  quote_name: string;
  billing_mode: string;
  discount_pct: string;
  discount_breakdown: DiscountBreakdownLine[];
  opted_out_ids: number[];
  currency: string;
  quantity_result: QuantityResult | null;
  hourly_result: HourlyResult | null;
}

type ActiveMode = "quantity" | "hourly" | "both";

// ─── Auth ─────────────────────────────────────────────────────────────────────
const BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_HOST ?? "") : "";
function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? (localStorage.getItem("access") ?? "") : "";
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

// ─── Local fee compute ────────────────────────────────────────────────────────
function computeQtyLocal(
  tpl: FeeTemplateOption,
  qty: number,
  discPct: number,
  optedOutIds: Set<number>,
): QuantityResult | null {
  if (!qty || qty <= 0) return null;
  const rate    = Number(tpl.default_rate_per_unit ?? 0);
  const base    = qty * rate;
  const discAmt = (base * discPct) / 100;
  const final   = base - discAmt;
  return {
    template_id:   tpl.id,
    template_name: tpl.name,
    quantity:      qty,
    quantity_unit: tpl.quantity_unit?.symbol ?? null,
    rate,
    base_fee:      r2(base),
    discount_pct:  discPct,
    discount_amt:  r2(discAmt),
    final_fee:     r2(final),
    stages: tpl.template_stages.map((ts) => ({
      order:              ts.order,
      stage_name:         ts.fee_stage.name,
      fee_percentage:     ts.fee_percentage,
      instalment_amount:  r2((final * Number(ts.fee_percentage)) / 100),
      payment_terms_days: ts.payment_terms_days,
      deliverables: (ts.deliverable_templates ?? [])
        .slice().sort((a, b) => a.order - b.order)
        .map((dt) => ({
          id: dt.id, name: dt.name,
          is_mandatory: dt.is_mandatory, order: dt.order,
          opted_out: !dt.is_mandatory && optedOutIds.has(dt.id),
        })),
    })),
  };
}

// Compute local discount total from rule selections (mirrors backend logic)
function computeLocalDiscPct(
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
      const cap   = rule.max_optout_items > 0 ? rule.max_optout_items : optedOutCount;
      const count = Math.min(optedOutCount, cap);
      if (count > 0) total += Number(rule.discount_pct) * count;
    }
  }
  return Math.min(total, Number(pkg.max_total_discount_pct));
}

const r2  = (n: number) => Math.round(n * 100) / 100;
const nv  = (v: string | number | null | undefined) => Number(v ?? 0);

// ─── Primitives ───────────────────────────────────────────────────────────────

function Spinner({ color }: { color: string }) {
  return (
    <svg width={13} height={13} viewBox="0 0 20 20" fill="none"
      style={{ animation: "fc-spin 0.75s linear infinite", flexShrink: 0 }}>
      <path d="M17 10a7 7 0 1 1-7-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

function Dot({ color }: { color: string }) {
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9.5, fontWeight: 700, color: C.t4,
      letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 7 }}>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, color }: {
  checked: boolean; onChange: (v: boolean) => void; color: string;
}) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 34, height: 18, borderRadius: 99, flexShrink: 0, cursor: "pointer",
      background: checked ? color : C.t5, transition: "background 0.15s", position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 3, left: checked ? 18 : 3,
        width: 12, height: 12, borderRadius: "50%", background: C.t1,
        transition: "left 0.15s",
      }} />
    </div>
  );
}

function Checkbox({ checked, onChange, color }: {
  checked: boolean; onChange: (v: boolean) => void; color: string;
}) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
      background: checked ? color : "transparent",
      border: `1.5px solid ${checked ? color : C.t5}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.12s",
    }}>
      {checked && (
        <svg width={9} height={9} viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke={C.card} strokeWidth={1.6}
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Rule colour ──────────────────────────────────────────────────────────────
// Rotate through a palette so each rule gets a distinct colour.
const RULE_COLORS = [C.green, C.teal, C.purple, C.amber, "#f472b6", "#60a5fa"];
function ruleColor(idx: number) { return RULE_COLORS[idx % RULE_COLORS.length]; }
function ruleColorL(idx: number) {
  const map: Record<string, string> = {
    [C.green]:   C.greenL,
    [C.teal]:    C.tealL,
    [C.purple]:  C.purpleL,
    [C.amber]:   C.amberL,
  };
  const c = ruleColor(idx);
  return map[c] ?? "rgba(255,255,255,0.05)";
}
function ruleColorM(idx: number) {
  const map: Record<string, string> = {
    [C.green]:  C.greenM,
    [C.teal]:   C.tealM,
    [C.purple]: C.purpleM,
    [C.amber]:  C.amberM,
  };
  const c = ruleColor(idx);
  return map[c] ?? "rgba(255,255,255,0.15)";
}

// ─── Deliverable list ─────────────────────────────────────────────────────────

function DeliverableList({ items, accent, onToggleOptOut, optOutEnabled }: {
  items: DeliverableItem[];
  accent: string;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  optOutEnabled?: boolean;
}) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  if (!sorted.length) return null;
  return (
    <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px dashed ${C.divider}`,
      display: "flex", flexDirection: "column", gap: 5 }}>
      <SectionLabel>Deliverables</SectionLabel>
      {sorted.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {d.is_mandatory ? (
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <circle cx={5} cy={5} r={4} stroke={accent} strokeWidth={1.2} />
              <circle cx={5} cy={5} r={1.8} fill={accent} />
            </svg>
          ) : optOutEnabled && onToggleOptOut ? (
            <Checkbox checked={!!d.opted_out} onChange={(v) => onToggleOptOut(d.id, v)} color={C.amber} />
          ) : (
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <circle cx={5} cy={5} r={4} stroke={C.t5} strokeWidth={1.2} strokeDasharray="2 1.5" />
            </svg>
          )}
          <span style={{
            fontSize: 12,
            color: d.opted_out ? C.t5 : d.is_mandatory ? C.t2 : C.t3,
            textDecoration: d.opted_out ? "line-through" : "none",
          }}>
            {d.name}
          </span>
          {!d.is_mandatory && !d.opted_out && (
            <span style={{ fontSize: 9, color: C.t5, fontStyle: "italic" }}>optional</span>
          )}
          {d.opted_out && (
            <span style={{ fontSize: 9, color: C.amber, fontStyle: "italic" }}>opted out</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stage row ────────────────────────────────────────────────────────────────

function StageRow({ stage, currency, accent, idx, total, showAmount,
  onToggleOptOut, optOutEnabled }: {
  stage: StageItem; currency: string; accent: string;
  idx: number; total: number; showAmount: boolean;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  optOutEnabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const pct    = nv(stage.fee_percentage);
  const amt    = nv(stage.instalment_amount ?? 0);
  const hasDel = stage.deliverables.length > 0;

  return (
    <div style={{ borderBottom: idx < total - 1 ? `1px solid ${C.divider}` : "none",
      animation: `fc-fadeUp 0.15s ease ${idx * 0.04}s both` }}>
      <div onClick={() => hasDel && setOpen((o) => !o)}
        style={{ padding: "12px 17px", display: "flex", alignItems: "flex-start", gap: 11,
          cursor: hasDel ? "pointer" : "default" }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          background: `${accent}14`, border: `1.5px solid ${accent}38`,
          color: accent, fontSize: 10.5, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Mono', monospace" }}>
          {stage.order}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: 8, flexWrap: "wrap" as const }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{stage.stage_name}</span>
              {hasDel && (
                <span style={{ fontSize: 9.5, color: C.t5, marginLeft: 6 }}>
                  {open ? "▲" : "▼"} {stage.deliverables.length} deliverable
                  {stage.deliverables.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {showAmount && (
                <div style={{ fontSize: 14.5, fontWeight: 700, color: accent,
                  fontFamily: "'DM Mono', monospace", lineHeight: 1.2 }}>
                  {fmtCurrency(amt, currency)}
                </div>
              )}
              <div style={{ fontSize: 10, color: C.t4, marginTop: showAmount ? 2 : 0 }}>
                {pct}% · Net {stage.payment_terms_days}d
              </div>
            </div>
          </div>
          <div style={{ height: 2, background: C.divider, borderRadius: 99, marginTop: 7, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`,
              background: `linear-gradient(90deg, ${accent}44, ${accent})`,
              borderRadius: 99, transition: "width 0.5s cubic-bezier(.22,1,.36,1)" }} />
          </div>
          {hasDel && open && (
            <DeliverableList items={stage.deliverables} accent={accent}
              onToggleOptOut={onToggleOptOut} optOutEnabled={optOutEnabled} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DISCOUNT PANEL — data-driven from DiscountRule rows ─────────────────────

function DiscountPanel({
  pkg,
  appliedRuleIds, onToggleRule,
  optedOutIds,
  totalDiscountPct,
  serverBreakdown,
}: {
  pkg: DiscountPackage;
  appliedRuleIds: Set<number>;
  onToggleRule: (id: number, on: boolean) => void;
  optedOutIds: Set<number>;
  totalDiscountPct: number;
  serverBreakdown: DiscountBreakdownLine[];
}) {
  const activeRules = pkg.rules.filter((r) => r.is_active).sort((a, b) => a.order - b.order);
  // Separate optout_per_item rules (rendered differently — no toggle, count-driven)
  const toggleRules  = activeRules.filter((r) => r.condition_type !== "optout_per_item");
  const optoutRules  = activeRules.filter((r) => r.condition_type === "optout_per_item");
  const hasOptout    = optoutRules.length > 0;

  if (!activeRules.length) return null;

  // Use server breakdown when available, fallback to local
  const breakdown: DiscountBreakdownLine[] = serverBreakdown.length > 0
    ? serverBreakdown.filter((l) => l.type !== "cap")
    : activeRules
        .filter((r) => {
          if (r.condition_type === "optout_per_item") return optedOutIds.size > 0;
          return appliedRuleIds.has(r.id);
        })
        .map((r) => {
          if (r.condition_type === "optout_per_item") {
            const cap   = r.max_optout_items > 0 ? r.max_optout_items : optedOutIds.size;
            const count = Math.min(optedOutIds.size, cap);
            return {
              rule_id: r.id,
              label:   `${r.label} × ${count}`,
              pct:     (Number(r.discount_pct) * count).toFixed(2),
              type:    "optout_per_item",
            };
          }
          return { rule_id: r.id, label: r.label, pct: r.discount_pct, type: r.condition_type };
        });

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
      borderRadius: 13, overflow: "hidden", animation: "fc-fadeUp 0.18s ease both" }}>

      {/* Header */}
      <div style={{ padding: "11px 17px", borderBottom: `1px solid ${C.divider}`,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.purple }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t3,
            letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
            {pkg.name}
          </span>
        </div>
        {totalDiscountPct > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.purple,
            fontFamily: "'DM Mono', monospace" }}>
            −{totalDiscountPct.toFixed(1)}% total
          </span>
        )}
      </div>

      <div style={{ padding: "13px 17px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Toggle / opensource rules */}
        {toggleRules.map((rule, idx) => {
          const on    = appliedRuleIds.has(rule.id);
          const color = ruleColor(idx);
          const colorL = ruleColorL(idx);
          const colorM = ruleColorM(idx);
          return (
            <div key={rule.id} style={{ display: "flex", alignItems: "flex-start", gap: 12,
              paddingTop: idx > 0 ? 10 : 0,
              borderTop: idx > 0 ? `1px solid ${C.divider}` : "none" }}>
              <Toggle checked={on} onChange={(v) => onToggleRule(rule.id, v)} color={color} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: on ? C.t1 : C.t2 }}>
                    {rule.label}
                  </span>
                  <span style={{ fontSize: 10, background: colorL, color,
                    border: `1px solid ${colorM}`, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                    −{rule.discount_pct}%
                  </span>
                </div>
                {rule.description && (
                  <div style={{ fontSize: 11, color: C.t4, marginTop: 2, lineHeight: 1.5 }}>
                    {rule.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Optout-per-item rules — shown as informational, checkboxes live in stage rows */}
        {hasOptout && (
          <div style={{ paddingTop: toggleRules.length > 0 ? 10 : 0,
            borderTop: toggleRules.length > 0 ? `1px solid ${C.divider}` : "none" }}>
            {optoutRules.map((rule, idx) => (
              <div key={rule.id} style={{ marginBottom: idx < optoutRules.length - 1 ? 8 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: C.t2 }}>{rule.label}</span>
                  <span style={{ fontSize: 10, background: C.amberL, color: C.amber,
                    border: `1px solid ${C.amberM}`, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                    −{rule.discount_pct}% each
                    {rule.max_optout_items > 0 && ` (max ${rule.max_optout_items})`}
                  </span>
                </div>
                {rule.description && (
                  <div style={{ fontSize: 11, color: C.t4, marginTop: 2, lineHeight: 1.5 }}>
                    {rule.description}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.t4, marginTop: 4, lineHeight: 1.5 }}>
                  Untick optional deliverables in the payment schedule below to apply this discount.
                  {optedOutIds.size > 0 && (
                    <span style={{ color: C.amber, marginLeft: 5 }}>
                      {optedOutIds.size} opted out · −{(Number(rule.discount_pct) * Math.min(
                        optedOutIds.size,
                        rule.max_optout_items > 0 ? rule.max_optout_items : optedOutIds.size
                      )).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live discount summary */}
        {breakdown.length > 0 && (
          <div style={{ marginTop: 2, padding: "10px 13px",
            background: "rgba(167,139,250,0.05)", border: `1px solid ${C.purpleM}`, borderRadius: 9 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: C.purple,
              letterSpacing: "0.09em", textTransform: "uppercase" as const, marginBottom: 7 }}>
              Discount summary
            </div>
            {breakdown.map((line, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between",
                fontSize: 11.5, color: C.t3, marginBottom: 3 }}>
                <span>{line.label}</span>
                {line.pct !== null && (
                  <span style={{ fontFamily: "'DM Mono', monospace", color: C.purple }}>
                    −{line.pct}%
                  </span>
                )}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.divider}`, marginTop: 5, paddingTop: 5,
              display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ color: C.t2 }}>Total discount</span>
              <span style={{ color: C.purple, fontFamily: "'DM Mono', monospace" }}>
                −{totalDiscountPct.toFixed(1)}%
              </span>
            </div>
            {nv(pkg.max_total_discount_pct) > 0 && (
              <div style={{ fontSize: 10, color: C.t5, marginTop: 4 }}>
                Cap: max {pkg.max_total_discount_pct}% combined
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── QUANTITY result panel ────────────────────────────────────────────────────

function QuantityResult({ result, syncing, currency, onToggleOptOut, optOutEnabled }: {
  result: QuantityResult; syncing: boolean; currency: string;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  optOutEnabled?: boolean;
}) {
  const hasDiscount   = nv(result.discount_pct) > 0;
  const totalDel      = result.stages.reduce((s, st) => s + st.deliverables.length, 0);
  const optedOutCount = result.stages.reduce((s, st) => s + st.deliverables.filter((d) => d.opted_out).length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, animation: "fc-fadeUp 0.20s ease both" }}>
      {/* Hero */}
      <div style={{ background: C.amberL, border: `1.5px solid ${C.amberM}`,
        borderRadius: 14, padding: "20px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.amber, letterSpacing: "0.12em",
          textTransform: "uppercase" as const, marginBottom: 5, opacity: 0.8 }}>
          Total Professional Fee
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: C.amber,
          letterSpacing: "-0.03em", fontFamily: "'DM Mono', monospace",
          lineHeight: 1.1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {fmtCurrency(result.final_fee, currency)}
          {syncing && <Spinner color={C.amber} />}
        </div>
        {hasDiscount && (
          <div style={{ marginTop: 7, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.t4, textDecoration: "line-through" }}>
              {fmtCurrency(result.base_fee, currency)}
            </span>
            <span style={{ fontSize: 10.5, background: C.greenL, color: C.green,
              border: `1px solid ${C.greenM}`, borderRadius: 4, padding: "2px 7px" }}>
              −{nv(result.discount_pct).toFixed(1)}% off
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
        {[
          { label: "Quantity", val: `${Number(result.quantity).toLocaleString("en-IN")}${result.quantity_unit ? " " + result.quantity_unit : ""}`, color: C.t2 },
          { label: "Rate / unit", val: fmtCurrency(result.rate, currency), color: C.amber },
          { label: "Base fee", val: fmtCurrency(result.base_fee, currency), color: hasDiscount ? C.t3 : C.t2 },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.cardB}`,
            borderRadius: 9, padding: "9px 11px" }}>
            <div style={{ fontSize: 9, color: C.t5, letterSpacing: "0.09em",
              textTransform: "uppercase" as const, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'DM Mono', monospace" }}>
              {val ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Payment schedule */}
      {result.stages.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
          borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: "10px 17px", borderBottom: `1px solid ${C.divider}`,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Dot color={C.amber} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t3,
                letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
                Payment Schedule
              </span>
              <span style={{ fontSize: 10, color: C.t5 }}>{result.stages.length} stages</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {optedOutCount > 0 && (
                <span style={{ fontSize: 10, color: C.amber }}>{optedOutCount} opted out</span>
              )}
              {totalDel > 0 && (
                <span style={{ fontSize: 10, color: C.t4 }}>
                  {totalDel} deliverable{totalDel !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {result.stages.map((st, i) => (
            <StageRow key={i} idx={i} total={result.stages.length}
              stage={st} currency={currency} accent={C.amber} showAmount
              onToggleOptOut={onToggleOptOut} optOutEnabled={optOutEnabled} />
          ))}
          <div style={{ padding: "10px 17px", borderTop: `1px solid ${C.divider}`,
            background: "rgba(255,255,255,0.012)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Total</span>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: C.amber,
              fontFamily: "'DM Mono', monospace" }}>
              {fmtCurrency(result.final_fee, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HOURLY view ──────────────────────────────────────────────────────────────

function HourlyView({ result, tpl, optOutEnabled, onToggleOptOut }: {
  result?: HourlyResult; tpl: FeeTemplateOption;
  optOutEnabled?: boolean; onToggleOptOut?: (id: number, optOut: boolean) => void;
}) {
  const data = result ?? {
    template_id:         tpl.id,
    template_name:       tpl.name,
    default_hourly_rate: tpl.default_hourly_rate ?? "0",
    note:                "Final fee depends on actual hours logged.",
    consultant_rates:    (tpl.member_billing_rates ?? []).filter((r) => r.is_active && !r.project),
    stages: tpl.template_stages.map((ts) => ({
      order: ts.order, stage_name: ts.fee_stage.name,
      fee_percentage: ts.fee_percentage, payment_terms_days: ts.payment_terms_days,
      deliverables: (ts.deliverable_templates ?? []).slice()
        .sort((a, b) => a.order - b.order)
        .map((dt) => ({ id: dt.id, name: dt.name, is_mandatory: dt.is_mandatory, order: dt.order })),
    })),
  };
  const currency = tpl.currency;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, animation: "fc-fadeUp 0.20s ease both" }}>
      {/* Banner */}
      <div style={{ background: C.tealL, border: `1.5px solid ${C.tealM}`,
        borderRadius: 14, padding: "15px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: "rgba(45,212,191,0.10)", border: `1.5px solid ${C.tealM}`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <circle cx={12} cy={12} r={9} stroke={C.teal} strokeWidth={1.6} />
            <path d="M12 7v5l3.5 3.5" stroke={C.teal} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{data.template_name}</div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.65 }}>{data.note}</div>
          {Number(data.default_hourly_rate) > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.teal }}>
              ◎ Blended rate {fmtCurrency(data.default_hourly_rate, currency)}/hr
            </div>
          )}
        </div>
      </div>

      {/* Stages */}
      {data.stages.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: "10px 17px", borderBottom: `1px solid ${C.divider}`,
            display: "flex", alignItems: "center", gap: 7 }}>
            <Dot color={C.teal} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t3,
              letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
              Project stages &amp; deliverables
            </span>
          </div>
          {data.stages.map((st, i) => (
            <StageRow key={i} idx={i} total={data.stages.length}
              stage={st} currency={currency} accent={C.teal} showAmount={false}
              onToggleOptOut={onToggleOptOut} optOutEnabled={optOutEnabled} />
          ))}
        </div>
      )}

      {/* Consultant rates */}
      <div style={{ background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 13, overflow: "hidden" }}>
        <div style={{ padding: "11px 17px", borderBottom: `1px solid ${C.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Dot color={C.teal} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t3,
              letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
              Consultant billing rates
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.t4 }}>{currency} / hr</span>
        </div>
        {Number(data.default_hourly_rate) > 0 && (
          <div style={{ padding: "13px 17px",
            borderBottom: data.consultant_rates.length > 0 ? `1px solid ${C.divider}` : "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(45,212,191,0.025)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>Blended rate</div>
              <div style={{ fontSize: 10.5, color: C.t4, marginTop: 2 }}>
                Default — applies when no per-consultant rate is set
              </div>
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.teal,
              fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" as const }}>
              {fmtCurrency(data.default_hourly_rate, currency)}
              <span style={{ fontSize: 11, color: C.t3, fontWeight: 400 }}>/hr</span>
            </div>
          </div>
        )}
        {data.consultant_rates.map((r, i) => {
          const initials = (r.user_display ?? "?").split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
          return (
            <div key={r.id} style={{ padding: "12px 17px",
              borderBottom: i < data.consultant_rates.length - 1 ? `1px solid ${C.divider}` : "none",
              display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                background: C.tealL, border: `1.5px solid ${C.tealM}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: C.teal, fontFamily: "'DM Mono', monospace" }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{r.user_display}</div>
                <div style={{ fontSize: 10.5, color: C.t4, marginTop: 2 }}>
                  From {r.effective_from}{r.effective_to ? ` · until ${r.effective_to}` : " · ongoing"}
                </div>
                {r.remarks && (
                  <div style={{ fontSize: 10.5, color: C.t4, marginTop: 1, fontStyle: "italic" }}>{r.remarks}</div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.teal,
                  fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" as const }}>
                  {fmtCurrency(r.rate_per_hour, r.currency ?? currency)}
                  <span style={{ fontSize: 11, color: C.t3, fontWeight: 400 }}>/hr</span>
                </div>
              </div>
            </div>
          );
        })}
        {data.consultant_rates.length === 0 && Number(data.default_hourly_rate) > 0 && (
          <div style={{ padding: "12px 17px", textAlign: "center", fontSize: 11.5, color: C.t4 }}>
            No per-consultant rates set — blended rate applies to all team members.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODE TOGGLE ──────────────────────────────────────────────────────────────

function ModeToggle({ activeMode, setActiveMode }: {
  activeMode: ActiveMode; setActiveMode: (m: ActiveMode) => void;
}) {
  const opts: { value: ActiveMode; label: string; color: string }[] = [
    { value: "quantity", label: "Quantity Fee", color: C.amber  },
    { value: "hourly",   label: "Hourly",       color: C.teal   },
    { value: "both",     label: "Show Both",    color: C.purple },
  ];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
      borderRadius: 13, padding: "13px 15px", animation: "fc-fadeUp 0.15s ease both" }}>
      <SectionLabel>Which billing model would you like to explore?</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {opts.map(({ value, label, color }) => {
          const sel = activeMode === value;
          return (
            <button key={value} onClick={() => setActiveMode(value)} style={{
              cursor: "pointer", outline: "none",
              background: sel ? `${color}12` : "transparent",
              border: `1.5px solid ${sel ? color : C.t5}`,
              borderRadius: 9, padding: "10px 8px", textAlign: "center", transition: "all 0.12s",
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: sel ? color : C.t3 }}>{label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── QUANTITY INPUT ───────────────────────────────────────────────────────────

function QuantityInputPanel({ tpl, quantity, setQuantity, syncing, serverOk, serverError }: {
  tpl: FeeTemplateOption; quantity: string; setQuantity: (v: string) => void;
  syncing: boolean; serverOk: boolean; serverError: string | null;
}) {
  const [qFocus, setQFocus] = useState(false);
  const quantityReady = !!quantity && Number(quantity) > 0;
  const hint = tpl.default_rate_per_unit
    ? `Rate: ${fmtCurrency(tpl.default_rate_per_unit, tpl.currency)} per ${tpl.quantity_unit?.symbol ?? "unit"}`
    : "";

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
      borderRadius: 13, overflow: "hidden", animation: "fc-fadeUp 0.15s ease both" }}>
      <div style={{ padding: "12px 15px", borderBottom: `1px solid ${C.divider}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{tpl.name}</div>
          {tpl.description && (
            <div style={{ fontSize: 11, color: C.t4, marginTop: 1 }}>{tpl.description}</div>
          )}
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 700, flexShrink: 0,
          letterSpacing: "0.07em", textTransform: "uppercase" as const,
          padding: "3px 9px", borderRadius: 5,
          background: C.amberL, color: C.amber, border: `1px solid ${C.amberM}` }}>
          ⬡ Qty × Rate
        </span>
      </div>
      <div style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 9.5, fontWeight: 700, color: C.t4,
            letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
            {quantityLabel(tpl)} <span style={{ color: C.red }}>*</span>
          </label>
          <input
            type="number" value={quantity} min="0" step="any"
            placeholder={quantityPlaceholder(tpl)}
            onChange={(e) => setQuantity(e.target.value)}
            onFocus={() => setQFocus(true)} onBlur={() => setQFocus(false)}
            style={{ background: C.surface, color: C.t1, fontSize: 15,
              border: `1.5px solid ${qFocus ? C.amberM : C.divider}`,
              borderRadius: 8, padding: "10px 13px", outline: "none",
              fontFamily: "'DM Mono', monospace", transition: "border-color 0.1s", width: "100%" }}
          />
          {hint && <div style={{ fontSize: 10.5, color: C.t4 }}>{hint}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.t4 }}>
          {!quantityReady ? (
            <><Dot color={C.t5} /><span>Enter a value to calculate</span></>
          ) : syncing ? (
            <><Spinner color={C.amber} /><span style={{ color: C.t3 }}>Syncing…</span></>
          ) : serverError ? (
            <><Dot color={C.red} /><span style={{ color: C.red }}>{serverError} — local estimate</span></>
          ) : serverOk ? (
            <><Dot color={C.green} /><span style={{ color: C.green }}>Confirmed</span></>
          ) : (
            <><Dot color={C.t5} /><span>Estimating…</span></>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeeCalculatorPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw] = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 680;

  const [quotes,    setQuotes]    = useState<QuoteOption[]>([]);
  const [loadingQ,  setLoadingQ]  = useState(true);
  const [qError,    setQError]    = useState<string | null>(null);
  const [selectedQ, setSelectedQ] = useState<QuoteOption | null>(null);
  const [activeMode, setActiveMode] = useState<ActiveMode>("quantity");
  const [quantity,   setQuantity]   = useState("");

  // Discount state — now just a Set of DiscountRule PKs + opted-out deliverable PKs
  const [appliedRuleIds, setAppliedRuleIds] = useState<Set<number>>(new Set());
  const [optedOutIds,    setOptedOutIds]    = useState<Set<number>>(new Set());

  const [localQtyResult, setLocalQtyResult] = useState<QuantityResult | null>(null);
  const [serverResult,   setServerResult]   = useState<QuotePreviewResult | null>(null);
  const [syncing,        setSyncing]        = useState(false);
  const [serverError,    setServerError]    = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/feecalc/quote-options/?active=true`, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setQuotes(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((e: Error) => setQError(e.message))
      .finally(() => setLoadingQ(false));
  }, []);

  const totalDiscPct = useCallback((): number => {
    if (!selectedQ) return 0;
    return computeLocalDiscPct(
      selectedQ.discount_package, appliedRuleIds, optedOutIds.size
    );
  }, [selectedQ, appliedRuleIds, optedOutIds]);

  // Instant local calc
  useEffect(() => {
    if (!selectedQ?.quantity_template) { setLocalQtyResult(null); return; }
    const tpl  = selectedQ.quantity_template;
    const qty  = Number(quantity);
    const disc = totalDiscPct();
    setLocalQtyResult(computeQtyLocal(tpl, qty, disc, optedOutIds));
  }, [selectedQ, quantity, appliedRuleIds, optedOutIds, totalDiscPct]);

  // Debounced server sync
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedQ) { setServerResult(null); setSyncing(false); return; }
    const needsQty = selectedQ.billing_mode !== "hourly_only";
    if (needsQty && (!quantity || Number(quantity) <= 0)) {
      setServerResult(null); setSyncing(false); return;
    }
    setSyncing(true); setServerError(null);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const body = {
          quote_option_id:           selectedQ.id,
          quantity:                  needsQty ? quantity : "0",
          applied_rule_ids:          [...appliedRuleIds],
          opted_out_deliverable_ids: [...optedOutIds],
          currency:                  selectedQ.currency ?? "INR",
        };
        const res = await fetch(`${BASE}/api/feecalc/quote-preview/`, {
          method: "POST", headers: authHeaders(), body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
        }
        setServerResult(await res.json());
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : "Sync failed");
      } finally {
        setSyncing(false);
      }
    }, 600);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [selectedQ, quantity, appliedRuleIds, optedOutIds]);

  const handleSelectQuote = (q: QuoteOption) => {
    setSelectedQ(q);
    setQuantity(""); setAppliedRuleIds(new Set()); setOptedOutIds(new Set());
    setLocalQtyResult(null); setServerResult(null); setServerError(null);
    if (q.billing_mode === "hourly_only") setActiveMode("hourly");
    else setActiveMode("quantity");
  };

  const handleToggleRule = useCallback((id: number, on: boolean) => {
    setAppliedRuleIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleToggleOptOut = useCallback((id: number, optOut: boolean) => {
    setOptedOutIds((prev) => {
      const next = new Set(prev);
      if (optOut) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const qtyResult: QuantityResult | null = serverResult?.quantity_result ?? localQtyResult;
  const hourlyResult: HourlyResult | undefined = serverResult?.hourly_result ?? undefined;
  const discPct    = totalDiscPct();
  const currency   = selectedQ?.currency ?? "INR";
  const serverBD   = serverResult?.discount_breakdown ?? [];

  // Does any active rule in the package use optout_per_item?
  const optOutEnabled = !!(selectedQ?.discount_package?.rules.some(
    (r) => r.is_active && r.condition_type === "optout_per_item"
  ));

  const showQuantity = selectedQ && (
    selectedQ.billing_mode === "quantity_only" ||
    (selectedQ.billing_mode === "both" && (activeMode === "quantity" || activeMode === "both"))
  );
  const showHourly = selectedQ && (
    selectedQ.billing_mode === "hourly_only" ||
    (selectedQ.billing_mode === "both" && (activeMode === "hourly" || activeMode === "both"))
  );

  return (
    <div ref={containerRef} className="fc-root" style={{
      color: C.t2, fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      padding: isMobile ? "16px 12px 60px" : "22px 20px 50px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500;600&display=swap');
        .fc-root *{box-sizing:border-box;}
        .fc-root input[type=number]{-moz-appearance:textfield;}
        .fc-root input[type=number]::-webkit-inner-spin-button,
        .fc-root input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        .fc-root input::placeholder{color:${C.t5};}
        @keyframes fc-spin{to{transform:rotate(360deg)}}
        @keyframes fc-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes fc-pulse{0%,100%{opacity:.25}50%{opacity:.55}}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 14 : 20, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: C.amberL, border: `1.5px solid ${C.amberM}`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke={C.amber} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: isMobile ? 18 : 21, fontWeight: 800, color: C.t1,
            letterSpacing: "-0.04em", lineHeight: 1.1, margin: 0 }}>
            Fee Calculator
          </h2>
          <p style={{ fontSize: 11, color: C.t4, margin: "2px 0 0" }}>
            Select a package · apply your discounts · see the fee breakdown
          </p>
        </div>
      </div>

      <div style={{ display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
        gap: 12, alignItems: "start" }}>

        {/* LEFT — package list */}
        <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
          borderRadius: 13, overflow: "hidden",
          ...(isMobile ? {} : { position: "sticky", top: 20,
            maxHeight: "calc(100vh - 80px)", overflowY: "auto" }) }}>
          <div style={{ padding: "11px 13px 9px", borderBottom: `1px solid ${C.divider}` }}>
            <SectionLabel>Available Packages</SectionLabel>
          </div>

          {loadingQ && (
            <div style={{ padding: "11px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
              {[72, 60, 68].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 9,
                  background: "rgba(255,255,255,0.035)", animation: "fc-pulse 1.4s ease infinite" }} />
              ))}
            </div>
          )}
          {qError && <div style={{ padding: 12, color: C.red, fontSize: 12 }}>⚠ {qError}</div>}
          {!loadingQ && !qError && quotes.length === 0 && (
            <div style={{ padding: "28px 14px", textAlign: "center", fontSize: 12, color: C.t4 }}>
              No quote packages available. Ask your consultant to set one up.
            </div>
          )}

          {!loadingQ && quotes.map((q) => {
            const sel        = selectedQ?.id === q.id;
            const modeColor  = q.billing_mode === "hourly_only" ? C.teal
              : q.billing_mode === "both" ? C.purple : C.amber;
            const modeColorL = q.billing_mode === "hourly_only" ? C.tealL
              : q.billing_mode === "both" ? C.purpleL : C.amberL;
            const modeColorM = q.billing_mode === "hourly_only" ? C.tealM
              : q.billing_mode === "both" ? C.purpleM : C.amberM;
            const modeLabel  = q.billing_mode === "hourly_only" ? "Hourly"
              : q.billing_mode === "both" ? "Qty + Hourly" : "Qty × Rate";

            // Discount badges from the actual package rules
            const activeRules = q.discount_package?.rules.filter((r) => r.is_active) ?? [];

            return (
              <button key={q.id} onClick={() => handleSelectQuote(q)} style={{
                width: "100%", textAlign: "left", cursor: "pointer", outline: "none",
                background: sel ? modeColorL : "transparent",
                border: "none", borderBottom: `1px solid ${C.divider}`,
                padding: "12px 13px", transition: "background 0.12s", position: "relative",
              }}>
                {sel && (
                  <div style={{ position: "absolute", top: 0, left: 0, width: 3,
                    height: "100%", background: modeColor }} />
                )}
                <div style={{ display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", gap: 7, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600,
                    color: sel ? C.t1 : C.t2, lineHeight: 1.3, flex: 1 }}>
                    {q.name}
                  </span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, flexShrink: 0,
                    letterSpacing: "0.07em", textTransform: "uppercase" as const,
                    padding: "2px 6px", borderRadius: 4,
                    background: modeColorL, color: modeColor, border: `1px solid ${modeColorM}` }}>
                    {modeLabel}
                  </span>
                </div>
                {q.description && (
                  <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.4, marginBottom: 5 }}>
                    {q.description}
                  </div>
                )}
                {/* Dynamic discount badges from DiscountRule rows */}
                {activeRules.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                    {activeRules.slice(0, 4).map((r, idx) => (
                      <span key={r.id} style={{ fontSize: 9, color: ruleColor(idx),
                        background: ruleColorL(idx), border: `1px solid ${ruleColorM(idx)}`,
                        borderRadius: 3, padding: "1px 5px" }}>
                        {r.condition_type === "optout_per_item"
                          ? `−${r.discount_pct}% ea`
                          : `−${r.discount_pct}%`}
                      </span>
                    ))}
                    {activeRules.length > 4 && (
                      <span style={{ fontSize: 9, color: C.t4 }}>+{activeRules.length - 4} more</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {!selectedQ && (
            <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
              borderRadius: 13, padding: "48px 24px", textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <svg width={42} height={42} viewBox="0 0 24 24" fill="none"
                stroke={C.t4} strokeWidth={1} style={{ opacity: 0.25 }}>
                <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M14 3h7m0 0v7m0-7L9 15" />
              </svg>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.t2 }}>Select a package</div>
              <div style={{ fontSize: 12, color: C.t4, maxWidth: 280, lineHeight: 1.6 }}>
                Choose a fee package from the left panel to see billing options and available discounts.
              </div>
            </div>
          )}

          {selectedQ && (
            <>
              {selectedQ.billing_mode === "both" && (
                <ModeToggle activeMode={activeMode} setActiveMode={setActiveMode} />
              )}

              {/* Discount panel — renders only if package has rules */}
              {selectedQ.discount_package && (
                <DiscountPanel
                  pkg={selectedQ.discount_package}
                  appliedRuleIds={appliedRuleIds}
                  onToggleRule={handleToggleRule}
                  optedOutIds={optedOutIds}
                  totalDiscountPct={discPct}
                  serverBreakdown={serverBD}
                />
              )}

              {showQuantity && selectedQ.quantity_template && (
                <>
                  <QuantityInputPanel
                    tpl={selectedQ.quantity_template}
                    quantity={quantity} setQuantity={setQuantity}
                    syncing={syncing} serverOk={!!serverResult?.quantity_result}
                    serverError={serverError}
                  />
                  {qtyResult && (
                    <QuantityResult
                      result={qtyResult} syncing={syncing && !serverResult}
                      currency={currency}
                      onToggleOptOut={handleToggleOptOut} optOutEnabled={optOutEnabled}
                    />
                  )}
                </>
              )}

              {showHourly && selectedQ.hourly_template && (
                <>
                  {selectedQ.billing_mode === "both" && activeMode === "both" && (
                    <div style={{ padding: "8px 0 2px" }}>
                      <div style={{ height: 1, background: C.divider }} />
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: C.t5,
                        letterSpacing: "0.1em", textTransform: "uppercase" as const,
                        textAlign: "center", marginTop: 8 }}>Hourly Option</div>
                    </div>
                  )}
                  <HourlyView result={hourlyResult} tpl={selectedQ.hourly_template}
                    optOutEnabled={optOutEnabled} onToggleOptOut={handleToggleOptOut} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}