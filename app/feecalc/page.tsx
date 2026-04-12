"use client";
// app/feecalc/page.tsx
//
// Client sees TWO options:
//   1. Quantity-wise fee  (billing_type = "quantity_rate")
//   2. Hourly billing     (billing_type = "hourly")
//
// "percentage" templates are admin-only and never shown here.
// For hourly: only the per-hour consultant rates are shown — no fee inputs.

import { useState, useEffect, useRef } from "react";
import {
  fetchTemplatePreview,
  fmtCurrency,
  quantityLabel,
  quantityPlaceholder,
  type FeeTemplateOption,
  type FeePreviewResult,
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
  // Quantity mode — amber/gold
  amber:    "#f5a623",
  amberL:   "rgba(245,166,35,0.08)",
  amberM:   "rgba(245,166,35,0.30)",
  amberD:   "#c07d0e",
  // Hourly mode — teal
  teal:     "#2dd4bf",
  tealL:    "rgba(45,212,191,0.08)",
  tealM:    "rgba(45,212,191,0.30)",
  // Accents
  green:    "#34d399",
  greenL:   "rgba(52,211,153,0.08)",
  greenM:   "rgba(52,211,153,0.28)",
  red:      "#f87171",
  blue:     "#6080ff",
};

type Mode = "quantity_rate" | "hourly" | null;

// ─── Local instant fee calc ───────────────────────────────────────────────────
function computeLocal(tpl: FeeTemplateOption, qty: number, discPct: number) {
  if (!qty || qty <= 0) return null;
  let base = 0;
  if (tpl.billing_type === "quantity_rate")
    base = qty * Number(tpl.default_rate_per_unit ?? 0);
  else
    base = qty * Number(tpl.default_hourly_rate ?? 0);
  const disc = (base * discPct) / 100;
  return { base, disc, final: base - disc };
}

const nv = (v: string | number | null | undefined) => Number(v ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── Tiny primitives ──────────────────────────────────────────────────────────

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

// ─── Mode selection landing ───────────────────────────────────────────────────

function ModeLanding({ onSelect, hasQty, hasHourly, loading }: {
  onSelect: (m: Mode) => void;
  hasQty: boolean;
  hasHourly: boolean;
  loading: boolean;
}) {
  const [hovQ, setHovQ] = useState(false);
  const [hovH, setHovH] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 0 20px", gap: 28 }}>

      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase" as const, color: C.t4, marginBottom: 10 }}>
          Fee Calculator
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.t1,
          letterSpacing: "-0.04em", lineHeight: 1.15, margin: "0 0 10px" }}>
          How is this project billed?
        </h1>
        <p style={{ fontSize: 13, color: C.t3, lineHeight: 1.7, margin: 0 }}>
          Choose the billing model that applies to this engagement.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 16, width: "100%", maxWidth: 560 }}>

        {/* Quantity card */}
        {(() => {
          const active = !loading && hasQty;
          return (
            <button
              onClick={() => active && onSelect("quantity_rate")}
              onMouseEnter={() => active && setHovQ(true)}
              onMouseLeave={() => setHovQ(false)}
              style={{
                cursor: active ? "pointer" : "default",
                outline: "none", textAlign: "left",
                background: hovQ ? C.amberL : C.card,
                border: `1.5px solid ${hovQ ? C.amberM : C.cardB}`,
                borderRadius: 16, padding: "22px 20px",
                transition: "all 0.15s ease",
                transform: hovQ ? "translateY(-2px)" : "none",
                boxShadow: hovQ ? `0 8px 32px rgba(245,166,35,0.12)` : "none",
                opacity: loading ? 0.5 : !hasQty ? 0.38 : 1,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14,
                background: C.amberL, border: `1.5px solid ${C.amberM}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <rect x={3} y={3} width={7} height={7} rx={1.5} stroke={C.amber} strokeWidth={1.6} />
                  <rect x={14} y={3} width={7} height={7} rx={1.5} stroke={C.amber} strokeWidth={1.6} />
                  <rect x={3} y={14} width={7} height={7} rx={1.5} stroke={C.amber} strokeWidth={1.6} />
                  <rect x={14} y={14} width={7} height={7} rx={1.5} stroke={C.amber} strokeWidth={1.6} />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 6 }}>
                Quantity-wise Fee
              </div>
              <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
                Fixed rate per measurable unit — sqm, floors, spans, or any quantity.
              </div>
              <div style={{ marginTop: 14, fontSize: 10.5, fontWeight: 600,
                color: active ? C.amber : C.t5 }}>
                {loading ? "Loading…" : !hasQty ? "No templates configured" : "Select →"}
              </div>
            </button>
          );
        })()}

        {/* Hourly card */}
        {(() => {
          const active = !loading && hasHourly;
          return (
            <button
              onClick={() => active && onSelect("hourly")}
              onMouseEnter={() => active && setHovH(true)}
              onMouseLeave={() => setHovH(false)}
              style={{
                cursor: active ? "pointer" : "default",
                outline: "none", textAlign: "left",
                background: hovH ? C.tealL : C.card,
                border: `1.5px solid ${hovH ? C.tealM : C.cardB}`,
                borderRadius: 16, padding: "22px 20px",
                transition: "all 0.15s ease",
                transform: hovH ? "translateY(-2px)" : "none",
                boxShadow: hovH ? `0 8px 32px rgba(45,212,191,0.10)` : "none",
                opacity: loading ? 0.5 : !hasHourly ? 0.38 : 1,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 14,
                background: C.tealL, border: `1.5px solid ${C.tealM}`,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <circle cx={12} cy={12} r={9} stroke={C.teal} strokeWidth={1.6} />
                  <path d="M12 7v5l3.5 3.5" stroke={C.teal} strokeWidth={1.6}
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 6 }}>
                Hourly Billing
              </div>
              <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
                Billed based on hours logged by each consultant. Fee is finalised
                after project completion.
              </div>
              <div style={{ marginTop: 14, fontSize: 10.5, fontWeight: 600,
                color: active ? C.teal : C.t5 }}>
                {loading ? "Loading…" : !hasHourly ? "No templates configured" : "Select →"}
              </div>
            </button>
          );
        })()}
      </div>

      {/* Admin hint if either mode is missing templates */}
      {!loading && (!hasQty || !hasHourly) && (
        <div style={{ fontSize: 11.5, color: C.t4, textAlign: "center" }}>
          Greyed options have no active templates —{" "}
          <span style={{ color: C.t3 }}>ask your admin to add them.</span>
        </div>
      )}
    </div>
  );
}

// ─── Template picker (after mode chosen) ─────────────────────────────────────

function TemplatePicker({ templates, selected, onSelect, mode }: {
  templates: FeeTemplateOption[];
  selected: FeeTemplateOption | null;
  onSelect: (t: FeeTemplateOption) => void;
  mode: Mode;
}) {
  const accent = mode === "hourly" ? C.teal : C.amber;
  const accentL = mode === "hourly" ? C.tealL : C.amberL;
  const accentM = mode === "hourly" ? C.tealM : C.amberM;

  if (!templates.length) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center",
        fontSize: 12, color: C.t4 }}>
        No templates configured for this billing type. Ask your admin.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <SectionLabel>Choose a service template</SectionLabel>
      {templates.map((tpl) => {
        const sel = selected?.id === tpl.id;
        return (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            style={{
              width: "100%", textAlign: "left", cursor: "pointer", outline: "none",
              background: sel ? accentL : C.card,
              border: `1.5px solid ${sel ? accentM : C.cardB}`,
              borderRadius: 11, padding: "12px 14px",
              transition: "all 0.12s",
              position: "relative", overflow: "hidden",
            }}
          >
            {sel && (
              <div style={{ position: "absolute", top: 0, left: 0,
                width: 3, height: "100%",
                background: accent, borderRadius: "3px 0 0 3px" }} />
            )}
            <div style={{ fontSize: 13.5, fontWeight: 600,
              color: sel ? C.t1 : C.t2, marginBottom: tpl.description ? 3 : 0 }}>
              {tpl.name}
            </div>
            {tpl.description && (
              <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.4 }}>
                {tpl.description}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 10.5, color: C.t4 }}>
              {mode === "quantity_rate" && tpl.default_rate_per_unit &&
                `${fmtCurrency(tpl.default_rate_per_unit, tpl.currency)} / ${tpl.quantity_unit?.symbol ?? "unit"}`}
              {mode === "hourly" && tpl.default_hourly_rate &&
                `Blended ${fmtCurrency(tpl.default_hourly_rate, tpl.currency)}/hr`}
              <span style={{ marginLeft: 8, color: C.t5 }}>
                · {tpl.stage_count} stage{tpl.stage_count !== 1 ? "s" : ""}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Deliverables list ────────────────────────────────────────────────────────

function DeliverableList({ items, accent }: {
  items: { id: number; name: string; is_mandatory: boolean; order: number }[];
  accent: string;
}) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  if (!sorted.length) return null;
  return (
    <div style={{ marginTop: 9, paddingTop: 9,
      borderTop: `1px dashed ${C.divider}`,
      display: "flex", flexDirection: "column", gap: 5 }}>
      <SectionLabel>Deliverables</SectionLabel>
      {sorted.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {d.is_mandatory ? (
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <circle cx={5} cy={5} r={4} stroke={accent} strokeWidth={1.2} />
              <circle cx={5} cy={5} r={1.8} fill={accent} />
            </svg>
          ) : (
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
              <circle cx={5} cy={5} r={4} stroke={C.t5} strokeWidth={1.2} strokeDasharray="2 1.5" />
            </svg>
          )}
          <span style={{ fontSize: 12, color: d.is_mandatory ? C.t2 : C.t4 }}>{d.name}</span>
          {!d.is_mandatory && (
            <span style={{ fontSize: 9, color: C.t5, fontStyle: "italic" }}>optional</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stage row ────────────────────────────────────────────────────────────────

function StageRow({ stage, currency, accent, idx, total, showAmount }: {
  stage: {
    order: number; stage_name: string;
    fee_percentage: string | number; instalment_amount: string | number;
    payment_terms_days: number;
    deliverables: { id: number; name: string; is_mandatory: boolean; order: number }[];
  };
  currency: string; accent: string;
  idx: number; total: number; showAmount: boolean;
}) {
  const [open, setOpen] = useState(true);
  const pct = nv(stage.fee_percentage);
  const amt = nv(stage.instalment_amount);
  const hasDel = stage.deliverables.length > 0;

  return (
    <div style={{ borderBottom: idx < total - 1 ? `1px solid ${C.divider}` : "none",
      animation: `fc-fadeUp 0.15s ease ${idx * 0.04}s both` }}>
      <div
        onClick={() => hasDel && setOpen((o) => !o)}
        style={{ padding: "12px 17px", display: "flex",
          alignItems: "flex-start", gap: 11,
          cursor: hasDel ? "pointer" : "default" }}
      >
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
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>
                {stage.stage_name}
              </span>
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
          <div style={{ height: 2, background: C.divider, borderRadius: 99,
            marginTop: 7, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`,
              background: `linear-gradient(90deg, ${accent}44, ${accent})`,
              borderRadius: 99, transition: "width 0.5s cubic-bezier(.22,1,.36,1)" }} />
          </div>
          {hasDel && open && (
            <DeliverableList items={stage.deliverables} accent={accent} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── QUANTITY result panel ────────────────────────────────────────────────────

function QuantityResult({ result, syncing }: {
  result: FeePreviewResult; syncing: boolean;
}) {
  const hasDiscount = nv(result.discount_percentage) > 0;
  const totalDel = result.stages.reduce((s, st) => s + st.deliverables.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11,
      animation: "fc-fadeUp 0.20s ease both" }}>

      {/* Hero */}
      <div style={{ background: C.amberL, border: `1.5px solid ${C.amberM}`,
        borderRadius: 14, padding: "20px 22px", textAlign: "center" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.amber,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          marginBottom: 5, opacity: 0.8 }}>
          Total Professional Fee
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: C.amber,
          letterSpacing: "-0.03em", fontFamily: "'DM Mono', monospace",
          lineHeight: 1.1, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 10 }}>
          {fmtCurrency(result.final_fee, result.currency)}
          {syncing && <Spinner color={C.amber} />}
        </div>
        {hasDiscount && (
          <div style={{ marginTop: 7, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.t4, textDecoration: "line-through" }}>
              {fmtCurrency(result.base_fee, result.currency)}
            </span>
            <span style={{ fontSize: 10.5, background: C.greenL, color: C.green,
              border: `1px solid ${C.greenM}`, borderRadius: 4, padding: "2px 7px" }}>
              −{result.discount_percentage}% off
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
        {[
          { label: "Quantity", val: `${Number(result.quantity).toLocaleString("en-IN")}${result.quantity_unit ? " " + result.quantity_unit : ""}`, color: C.t2 },
          { label: "Rate / unit", val: fmtCurrency(result.rate, result.currency), color: C.amber },
          { label: "Base fee", val: fmtCurrency(result.base_fee, result.currency), color: hasDiscount ? C.t3 : C.t2 },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.cardB}`,
            borderRadius: 9, padding: "9px 11px" }}>
            <div style={{ fontSize: 9, color: C.t5, letterSpacing: "0.09em",
              textTransform: "uppercase" as const, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color,
              fontFamily: "'DM Mono', monospace" }}>{val ?? "—"}</div>
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
              <span style={{ fontSize: 10, color: C.t5 }}>
                {result.stages.length} stages
              </span>
            </div>
            {totalDel > 0 && (
              <span style={{ fontSize: 10, color: C.t4 }}>
                {totalDel} deliverable{totalDel !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {result.stages.map((st, i) => (
            <StageRow key={i} idx={i} total={result.stages.length}
              stage={st} currency={result.currency}
              accent={C.amber} showAmount />
          ))}
          <div style={{ padding: "10px 17px", borderTop: `1px solid ${C.divider}`,
            background: "rgba(255,255,255,0.012)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Total</span>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: C.amber,
              fontFamily: "'DM Mono', monospace" }}>
              {fmtCurrency(result.final_fee, result.currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUANTITY input panel ─────────────────────────────────────────────────────

function QuantityInputPanel({ tpl, quantity, setQuantity, discount, setDiscount,
  syncing, serverOk, serverError }: {
  tpl: FeeTemplateOption;
  quantity: string; setQuantity: (v: string) => void;
  discount: string; setDiscount: (v: string) => void;
  syncing: boolean; serverOk: boolean; serverError: string | null;
}) {
  const [qFocus, setQFocus] = useState(false);
  const [dFocus, setDFocus] = useState(false);
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

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 9.5, fontWeight: 700, color: C.t4,
            letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
            Discount (%)
          </label>
          <input
            type="number" value={discount} min="0" max="100" step="any"
            placeholder="0"
            onChange={(e) => setDiscount(e.target.value)}
            onFocus={() => setDFocus(true)} onBlur={() => setDFocus(false)}
            style={{ background: C.surface, color: C.t1, fontSize: 15,
              border: `1.5px solid ${dFocus ? C.amberM : C.divider}`,
              borderRadius: 8, padding: "10px 13px", outline: "none",
              fontFamily: "'DM Mono', monospace", transition: "border-color 0.1s", width: "100%" }}
          />
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

// ─── HOURLY view — only consultant rates, no inputs ───────────────────────────

function HourlyView({ tpl }: { tpl: FeeTemplateOption }) {
  const activeRates: MemberBillingRateItem[] = (tpl.member_billing_rates ?? [])
    .filter((r) => r.is_active && r.project === null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11,
      animation: "fc-fadeUp 0.20s ease both" }}>

      {/* Info banner */}
      <div style={{ background: C.tealL, border: `1.5px solid ${C.tealM}`,
        borderRadius: 14, padding: "15px 18px",
        display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: "rgba(45,212,191,0.10)", border: `1.5px solid ${C.tealM}`,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <circle cx={12} cy={12} r={9} stroke={C.teal} strokeWidth={1.6} />
            <path d="M12 7v5l3.5 3.5" stroke={C.teal} strokeWidth={1.6}
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
            {tpl.name}
          </div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.65 }}>
            Hourly billing — the final fee is confirmed after project completion
            based on actual hours logged by each consultant.
          </div>
          {tpl.default_hourly_rate && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.teal }}>
              ◎ Blended rate {fmtCurrency(tpl.default_hourly_rate, tpl.currency)}/hr
            </div>
          )}
        </div>
      </div>

      {/* Consultant rates — the ONLY thing shown for hourly */}
      <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
        borderRadius: 13, overflow: "hidden" }}>
        <div style={{ padding: "11px 17px", borderBottom: `1px solid ${C.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Dot color={C.teal} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t3,
              letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
              Consultant Billing Rates
            </span>
          </div>
          <span style={{ fontSize: 10, color: C.t4 }}>{tpl.currency} / hr</span>
        </div>

        {/* Blended / default */}
        {tpl.default_hourly_rate && (
          <div style={{ padding: "13px 17px",
            borderBottom: activeRates.length > 0 ? `1px solid ${C.divider}` : "none",
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
              {fmtCurrency(tpl.default_hourly_rate, tpl.currency)}
              <span style={{ fontSize: 11, color: C.t3, fontWeight: 400 }}>/hr</span>
            </div>
          </div>
        )}

        {/* Per-consultant rows */}
        {activeRates.length > 0 ? (
          activeRates.map((r, i) => {
            const initials = (r.user_display ?? "?")
              .split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
            return (
              <div key={r.id} style={{ padding: "12px 17px",
                borderBottom: i < activeRates.length - 1 ? `1px solid ${C.divider}` : "none",
                display: "flex", alignItems: "center", gap: 12,
                animation: `fc-fadeUp 0.14s ease ${i * 0.04}s both` }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: C.tealL, border: `1.5px solid ${C.tealM}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: C.teal,
                  fontFamily: "'DM Mono', monospace" }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>
                    {r.user_display}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.t4, marginTop: 2 }}>
                    From {r.effective_from}
                    {r.effective_to ? ` · until ${r.effective_to}` : " · ongoing"}
                  </div>
                  {r.remarks && (
                    <div style={{ fontSize: 10.5, color: C.t4, marginTop: 1, fontStyle: "italic" }}>
                      {r.remarks}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.teal,
                    fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" as const }}>
                    {fmtCurrency(r.rate_per_hour, r.currency ?? tpl.currency)}
                    <span style={{ fontSize: 11, color: C.t3, fontWeight: 400 }}>/hr</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          !tpl.default_hourly_rate && (
            <div style={{ padding: "24px 17px", textAlign: "center",
              fontSize: 12, color: C.t4 }}>
              No consultant rates configured yet — contact your admin.
            </div>
          )
        )}

        {activeRates.length === 0 && tpl.default_hourly_rate && (
          <div style={{ padding: "12px 17px", textAlign: "center",
            fontSize: 11.5, color: C.t4 }}>
            No per-consultant rates set — blended rate applies to all team members.
          </div>
        )}
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

  const [mode, setMode] = useState<Mode>(null);

  const [allTemplates,  setAllTemplates]  = useState<FeeTemplateOption[]>([]);
  const [modeTemplates, setModeTemplates] = useState<FeeTemplateOption[]>([]);
  const [loadingTpl,    setLoadingTpl]    = useState(true);
  const [tplError,      setTplError]      = useState<string | null>(null);

  const [selected,   setSelected]   = useState<FeeTemplateOption | null>(null);
  const [quantity,   setQuantity]   = useState("");
  const [discount,   setDiscount]   = useState("0");

  const [localResult,  setLocalResult]  = useState<FeePreviewResult | null>(null);
  const [serverResult, setServerResult] = useState<FeePreviewResult | null>(null);
  const [syncing,      setSyncing]      = useState(false);
  const [serverError,  setServerError]  = useState<string | null>(null);

  const displayResult = serverResult ?? localResult;

  // Load ALL active templates once on mount — derive per-mode lists from this
  useEffect(() => {
    const BASE = typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_HOST ?? "") : "";
    const token = typeof window !== "undefined"
      ? (localStorage.getItem("access") ?? "") : "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${BASE}/api/feecalc/fee-templates/?active=true`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const all: FeeTemplateOption[] = Array.isArray(data)
          ? data : (data.results ?? []);
        setAllTemplates(all);
      })
      .catch((e: Error) => setTplError(e.message))
      .finally(() => setLoadingTpl(false));
  }, []);

  // Re-filter whenever mode changes
  useEffect(() => {
    if (!mode) { setModeTemplates([]); return; }
    setModeTemplates(allTemplates.filter((t) => t.billing_type === mode));
  }, [mode, allTemplates]);

  // Instant local calc (quantity_rate only)
  useEffect(() => {
    if (!selected || selected.billing_type !== "quantity_rate") {
      setLocalResult(null); return;
    }
    const qty  = Number(quantity);
    const disc = Number(discount || "0");
    const calc = computeLocal(selected, qty, disc);
    if (!calc) { setLocalResult(null); return; }
    const { base, disc: discAmt, final } = calc;
    setLocalResult({
      template_id:          selected.id,
      template_name:        selected.name,
      billing_type:         selected.billing_type,
      billing_type_display: selected.billing_type,
      quantity: qty,
      quantity_unit: selected.quantity_unit?.symbol ?? null,
      rate: selected.default_rate_per_unit,
      currency: selected.currency,
      base_fee: r2(base),
      discount_percentage: disc,
      discount_amount: r2(discAmt),
      final_fee: r2(final),
      stages: selected.template_stages.map((ts) => ({
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
          })),
      })),
    });
  }, [selected, quantity, discount]);

  // Debounced server sync (quantity_rate only)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selected || selected.billing_type !== "quantity_rate"
      || !quantity || Number(quantity) <= 0) {
      setServerResult(null); setSyncing(false); return;
    }
    setSyncing(true); setServerError(null);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetchTemplatePreview(
          selected.id, quantity, discount || "0", selected.currency
        );
        setServerResult(res);
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : "Sync failed");
      } finally {
        setSyncing(false);
      }
    }, 600);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [selected, quantity, discount]);

  const handleModeSelect = (m: Mode) => {
    setMode(m);
    setModeTemplates([]);
    setSelected(null); setQuantity(""); setDiscount("0");
    setLocalResult(null); setServerResult(null); setServerError(null);
    setTplError(null);
  };

  const handleTemplateSelect = (tpl: FeeTemplateOption) => {
    setSelected(tpl); setQuantity(""); setDiscount("0");
    setLocalResult(null); setServerResult(null); setServerError(null);
  };

  return (
    <div ref={containerRef} className="fc-root" style={{
      color: C.t2,
      fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      padding: isMobile ? "16px 12px 60px" : "22px 20px 50px",
      minHeight: "100vh",
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

      {/* ── Step 1: Mode selection ── */}
      {!mode && (
        <ModeLanding
          onSelect={handleModeSelect}
          hasQty={allTemplates.some((t) => t.billing_type === "quantity_rate")}
          hasHourly={allTemplates.some((t) => t.billing_type === "hourly")}
          loading={loadingTpl}
        />
      )}

      {/* ── Step 2 onwards: Mode chosen ── */}
      {mode && (
        <>
          {/* Breadcrumb / back */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => handleModeSelect(null)}
              style={{ cursor: "pointer", background: "none", border: "none",
                padding: 0, display: "flex", alignItems: "center", gap: 6,
                color: C.t4, fontSize: 11.5, fontWeight: 600,
                transition: "color 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.t2)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.t4)}
            >
              ← Back
            </button>
            <span style={{ color: C.t5, fontSize: 11 }}>·</span>
            <span style={{ fontSize: 11, color: C.t4 }}>
              {mode === "quantity_rate" ? "Quantity-wise Fee" : "Hourly Billing"}
            </span>
            {selected && (
              <>
                <span style={{ color: C.t5, fontSize: 11 }}>·</span>
                <span style={{ fontSize: 11, color: mode === "hourly" ? C.teal : C.amber }}>
                  {selected.name}
                </span>
              </>
            )}
          </div>

          {/* Loading skeleton */}
          {loadingTpl && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[72, 58, 66].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 11,
                  background: "rgba(255,255,255,0.035)",
                  animation: "fc-pulse 1.4s ease infinite" }} />
              ))}
            </div>
          )}

          {tplError && (
            <div style={{ padding: 12, color: C.red, fontSize: 12 }}>
              ⚠ {tplError}
            </div>
          )}


          {/* Main layout */}
          {!loadingTpl && !tplError && (
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
              gap: 12, alignItems: "start",
            }}>
              {/* LEFT: template picker */}
              <div style={{
                background: C.card, border: `1px solid ${C.cardB}`,
                borderRadius: 13, padding: "12px 10px",
                ...(isMobile ? {} : {
                  position: "sticky", top: 20,
                  maxHeight: "calc(100vh - 80px)", overflowY: "auto",
                }),
              }}>
                <TemplatePicker
                  templates={modeTemplates}
                  selected={selected}
                  onSelect={handleTemplateSelect}
                  mode={mode}
                />
              </div>

              {/* RIGHT: content */}
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>

                {/* Nothing selected yet */}
                {!selected && (
                  <div style={{ background: C.card, border: `1px solid ${C.cardB}`,
                    borderRadius: 13, padding: "48px 24px", textAlign: "center",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 11 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10,
                      background: mode === "hourly" ? C.tealL : C.amberL,
                      border: `1px solid ${mode === "hourly" ? C.tealM : C.amberM}`,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {mode === "hourly" ? (
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <circle cx={12} cy={12} r={9} stroke={C.teal} strokeWidth={1.6} />
                          <path d="M12 7v5l3.5 3.5" stroke={C.teal} strokeWidth={1.6}
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <rect x={3} y={3} width={7} height={7} rx={1.5}
                            stroke={C.amber} strokeWidth={1.6} />
                          <rect x={14} y={3} width={7} height={7} rx={1.5}
                            stroke={C.amber} strokeWidth={1.6} />
                          <rect x={3} y={14} width={7} height={7} rx={1.5}
                            stroke={C.amber} strokeWidth={1.6} />
                          <rect x={14} y={14} width={7} height={7} rx={1.5}
                            stroke={C.amber} strokeWidth={1.6} />
                        </svg>
                      )}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.t2 }}>
                      Select a template
                    </div>
                    <div style={{ fontSize: 12, color: C.t4, maxWidth: 260, lineHeight: 1.6 }}>
                      Choose a service template from the left panel to continue.
                    </div>
                  </div>
                )}

                {/* Hourly selected → only show rates */}
                {selected && mode === "hourly" && (
                  <HourlyView tpl={selected} />
                )}

                {/* Quantity selected → input + live result */}
                {selected && mode === "quantity_rate" && (
                  <>
                    <QuantityInputPanel
                      tpl={selected}
                      quantity={quantity}   setQuantity={setQuantity}
                      discount={discount}   setDiscount={setDiscount}
                      syncing={syncing}
                      serverOk={!!serverResult}
                      serverError={serverError}
                    />
                    {displayResult && (
                      <QuantityResult
                        result={displayResult}
                        syncing={syncing && !serverResult}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}