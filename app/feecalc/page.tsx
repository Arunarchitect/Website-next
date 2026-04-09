"use client";
// app/feecalc/page.tsx

import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchFeeTemplates,
  fetchTemplatePreview,
  fmtCurrency,
  billingTypeIcon,
  quantityLabel,
  quantityPlaceholder,
  type FeeTemplateOption,
  type FeePreviewResult,
} from "./feeCalcApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#060810",
  surface:  "#0c0e1a",
  card:     "#10131f",
  cardB:    "rgba(255,255,255,0.055)",
  hover:    "rgba(255,255,255,0.032)",
  divider:  "rgba(255,255,255,0.06)",
  t1:       "#eef2ff",
  t2:       "#c8d0e8",
  t3:       "#7a87a8",
  t4:       "#3f4d68",
  t5:       "#242d44",
  ac:       "#5b7fff",
  acLight:  "rgba(91,127,255,0.1)",
  acMid:    "rgba(91,127,255,0.4)",
  acText:   "#91afff",
  gold:     "#e4b44a",
  goldBg:   "rgba(228,180,74,0.1)",
  goldMid:  "rgba(228,180,74,0.35)",
  green:    "#32d988",
  greenBg:  "rgba(50,217,136,0.08)",
  greenMid: "rgba(50,217,136,0.3)",
  teal:     "#38c8d4",
  tealBg:   "rgba(56,200,212,0.08)",
  tealMid:  "rgba(56,200,212,0.35)",
  red:      "#f06878",
  redBg:    "rgba(240,104,120,0.08)",
};

const BILLING_PALETTE: Record<string, { color: string; bg: string; mid: string; label: string }> = {
  quantity_rate: { color: C.ac,   bg: C.acLight, mid: C.acMid,  label: "Qty \u00d7 Rate" },
  percentage:    { color: C.gold, bg: C.goldBg,  mid: C.goldMid,label: "% of Value"       },
  hourly:        { color: C.teal, bg: C.tealBg,  mid: C.tealMid,label: "Hourly"           },
};

// ── Local instant calculation — mirrors backend compute_fee exactly ────────────
function computeLocal(
  template: FeeTemplateOption,
  quantity: number,
  discountPct: number,
): { baseFee: number; discountAmt: number; finalFee: number } | null {
  if (!quantity || quantity <= 0) return null;
  let baseFee = 0;
  if (template.billing_type === "quantity_rate") {
    baseFee = quantity * Number(template.default_rate_per_unit ?? 0);
  } else if (template.billing_type === "percentage") {
    baseFee = (quantity * Number(template.default_percentage ?? 0)) / 100;
  } else {
    baseFee = quantity * Number(template.default_hourly_rate ?? 0);
  }
  const discountAmt = (baseFee * discountPct) / 100;
  return { baseFee, discountAmt, finalFee: baseFee - discountAmt };
}

function r2(x: number) { return Math.round(x * 100) / 100; }
const nv = (v: string | number | null | undefined) => Number(v ?? 0);

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({ type, small }: { type: string; small?: boolean }) {
  const p = BILLING_PALETTE[type] ?? BILLING_PALETTE.hourly;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
      fontSize: small ? 9 : 10.5, fontWeight: 700, letterSpacing: "0.07em",
      textTransform: "uppercase" as const, padding: small ? "2px 7px" : "3px 9px",
      borderRadius: 5, background: p.bg, color: p.color, border: `1px solid ${p.mid}`,
    }}>
      {billingTypeIcon(type)} {p.label}
    </span>
  );
}

function FieldInput({
  label, value, onChange, placeholder, hint, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: C.t4, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </label>
      <input
        type="number" value={value} min="0" step="any"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: C.surface, border: `1.5px solid ${focused ? C.acMid : C.divider}`,
          borderRadius: 9, padding: "11px 14px", fontSize: 15, color: C.t1,
          outline: "none", fontFamily: "'DM Mono', monospace",
          transition: "border-color 0.12s", width: "100%",
        }}
      />
      {hint && <div style={{ fontSize: 10.5, color: C.t4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <svg width={14} height={14} viewBox="0 0 20 20" fill="none"
      style={{ animation: "fc-spin 0.8s linear infinite", flexShrink: 0 }}>
      <path d="M17 10a7 7 0 1 1-7-7" stroke={C.acText} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function EmptySlate({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ opacity: 0.22 }}>{icon}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.t2 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: C.t4, maxWidth: 300, lineHeight: 1.6 }}>{sub}</div>}
    </div>
  );
}

function RateChip({ template }: { template: FeeTemplateOption }) {
  if (template.billing_type === "quantity_rate" && template.default_rate_per_unit)
    return <span style={{ fontSize: 11, color: C.t3 }}>{fmtCurrency(template.default_rate_per_unit, template.currency)} / {template.quantity_unit?.symbol ?? "unit"}</span>;
  if (template.billing_type === "percentage" && template.default_percentage)
    return <span style={{ fontSize: 11, color: C.t3 }}>{template.default_percentage}%</span>;
  if (template.billing_type === "hourly" && template.default_hourly_rate)
    return <span style={{ fontSize: 11, color: C.t3 }}>{fmtCurrency(template.default_hourly_rate, template.currency)} / hr</span>;
  return null;
}

function TemplateCard({ template, selected, onClick }: {
  template: FeeTemplateOption; selected: boolean; onClick: () => void;
}) {
  const p = BILLING_PALETTE[template.billing_type] ?? BILLING_PALETTE.hourly;
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", textAlign: "left", cursor: "pointer",
        background: selected ? `linear-gradient(135deg, ${p.bg}, rgba(255,255,255,0.015))` : hov ? C.hover : C.card,
        border: `1.5px solid ${selected ? p.mid : hov ? C.t5 : C.cardB}`,
        borderRadius: 12, padding: "13px 15px", transition: "all 0.13s",
        outline: "none", position: "relative", overflow: "hidden",
      }}
    >
      {selected && <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: p.color, borderRadius: "3px 0 0 3px" }} />}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? C.t1 : C.t2, lineHeight: 1.3, flex: 1 }}>{template.name}</div>
        <Pill type={template.billing_type} small />
      </div>
      {template.description && (
        <div style={{ fontSize: 11, color: C.t4, lineHeight: 1.4, marginBottom: 7 }}>{template.description}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <RateChip template={template} />
        <span style={{ fontSize: 10, color: C.t5 }}>{template.stage_count} stage{template.stage_count !== 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}

// ── Deliverable list ──────────────────────────────────────────────────────────
function DeliverableList({ items }: {
  items: { id: number; name: string; is_mandatory: boolean; order: number }[];
}) {
  if (!items.length) return null;
  const mandatory = items.filter((d) => d.is_mandatory).sort((a, b) => a.order - b.order);
  const optional  = items.filter((d) => !d.is_mandatory).sort((a, b) => a.order - b.order);
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.divider}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.t5, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
        Deliverables
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {mandatory.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <circle cx={6} cy={6} r={5} stroke={C.acText} strokeWidth={1.2} />
              <circle cx={6} cy={6} r={2.5} fill={C.acText} />
            </svg>
            <span style={{ fontSize: 12, color: C.t2 }}>{d.name}</span>
          </div>
        ))}
        {optional.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <circle cx={6} cy={6} r={5} stroke={C.t5} strokeWidth={1.2} strokeDasharray="2 1.5" />
            </svg>
            <span style={{ fontSize: 12, color: C.t4 }}>{d.name}</span>
            <span style={{ fontSize: 9, color: C.t5, fontStyle: "italic" }}>optional</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stage row — click to expand deliverables ──────────────────────────────────
function StageRow({ stage, currency, color, index, total }: {
  stage: FeePreviewResult["stages"][0]; currency: string;
  color: string; index: number; total: number;
}) {
  const [open, setOpen] = useState(true); // default open so deliverables visible
  const pct = nv(stage.fee_percentage);
  const amt = nv(stage.instalment_amount);
  const hasDel = stage.deliverables.length > 0;

  return (
    <div style={{ borderBottom: index < total - 1 ? `1px solid ${C.divider}` : "none", animation: `fc-fadeUp 0.17s ease ${index * 0.04}s both` }}>
      <div
        onClick={() => hasDel && setOpen((o) => !o)}
        style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 13, cursor: hasDel ? "pointer" : "default" }}
      >
        {/* Bubble */}
        <div style={{
          width: 29, height: 29, borderRadius: "50%", flexShrink: 0,
          background: `${color}18`, border: `1.5px solid ${color}44`,
          color, fontSize: 11, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Mono', monospace",
        }}>
          {stage.order}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header line */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" as const }}>
            <div>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.t2 }}>{stage.stage_name}</span>
              {hasDel && (
                <span style={{ fontSize: 10, color: C.t5, marginLeft: 7 }}>
                  {open ? "▲" : "▼"} {stage.deliverables.length} deliverable{stage.deliverables.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>
                {fmtCurrency(amt, currency)}
              </div>
              <div style={{ fontSize: 10, color: C.t4 }}>{pct}% · Net {stage.payment_terms_days}d</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: C.divider, borderRadius: 99, marginTop: 9, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}77, ${color})`, borderRadius: 99, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
          </div>

          {/* Deliverables */}
          {hasDel && open && <DeliverableList items={stage.deliverables} />}
        </div>
      </div>
    </div>
  );
}

// ── Full result panel ─────────────────────────────────────────────────────────
function FeeResult({ result, syncing }: { result: FeePreviewResult; syncing: boolean }) {
  const p = BILLING_PALETTE[result.billing_type] ?? BILLING_PALETTE.hourly;
  const hasDiscount = nv(result.discount_percentage) > 0;
  const totalDel = result.stages.reduce((s, st) => s + st.deliverables.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13, animation: "fc-fadeUp 0.22s ease both" }}>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${p.bg}, rgba(255,255,255,0.01))`,
        border: `1.5px solid ${p.mid}`, borderRadius: 15,
        padding: "22px 24px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% -10%, ${p.bg} 0%, transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: p.color, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 6, opacity: 0.72 }}>
            {billingTypeIcon(result.billing_type)} Total Professional Fee
          </div>
          <div style={{
            fontSize: 38, fontWeight: 800, color: p.color, letterSpacing: "-0.03em", lineHeight: 1.1,
            fontFamily: "'DM Mono', monospace",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            {fmtCurrency(result.final_fee, result.currency)}
            {syncing && <Spinner />}
          </div>
          {hasDiscount && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: C.t4, textDecoration: "line-through" }}>{fmtCurrency(result.base_fee, result.currency)}</span>
              <span style={{ fontSize: 10.5, background: C.greenBg, color: C.green, border: `1px solid ${C.greenMid}`, borderRadius: 4, padding: "2px 7px" }}>
                −{result.discount_percentage}% off
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { label: "Quantity", val: `${Number(result.quantity).toLocaleString("en-IN")}${result.quantity_unit ? " " + result.quantity_unit : ""}`, color: C.t2 },
          { label: "Rate",     val: result.billing_type === "percentage" ? `${result.rate}%` : fmtCurrency(result.rate, result.currency), color: p.color },
          { label: "Base Fee", val: fmtCurrency(result.base_fee, result.currency), color: hasDiscount ? C.t3 : C.t2 },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: C.t5, letterSpacing: "0.09em", textTransform: "uppercase" as const, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'DM Mono', monospace" }}>{val ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Stages */}
      {result.stages.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t3, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
                Payment Schedule
              </span>
              <span style={{ fontSize: 10, color: C.t5 }}>{result.stages.length} stages</span>
            </div>
            {totalDel > 0 && (
              <span style={{ fontSize: 10, color: C.t4 }}>
                {totalDel} deliverable{totalDel !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {result.stages.map((stage, i) => (
            <StageRow key={i} stage={stage} currency={result.currency} color={p.color} index={i} total={result.stages.length} />
          ))}

          <div style={{ padding: "11px 18px", background: "rgba(255,255,255,0.016)", borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.t3 }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: p.color, fontFamily: "'DM Mono', monospace" }}>
              {fmtCurrency(result.final_fee, result.currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const isMobile = cw < 720;

  const [templates, setTemplates]   = useState<FeeTemplateOption[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [tplError, setTplError]     = useState<string | null>(null);
  const [selected, setSelected]     = useState<FeeTemplateOption | null>(null);
  const [quantity, setQuantity]     = useState("");
  const [discount, setDiscount]     = useState("0");

  // Two-layer result: local (0ms) + server (600ms debounce, authoritative)
  const [localResult,  setLocalResult]  = useState<FeePreviewResult | null>(null);
  const [serverResult, setServerResult] = useState<FeePreviewResult | null>(null);
  const [syncing,      setSyncing]      = useState(false);
  const [serverError,  setServerError]  = useState<string | null>(null);

  // Show server result when ready; otherwise show local immediately
  const displayResult = serverResult ?? localResult;

  useEffect(() => {
    fetchFeeTemplates()
      .then(setTemplates)
      .catch((e: Error) => setTplError(e.message))
      .finally(() => setLoadingTpl(false));
  }, []);

  // Instant local calculation on every keystroke
  useEffect(() => {
    if (!selected) { setLocalResult(null); return; }
    const qty  = Number(quantity);
    const disc = Number(discount || "0");
    const calc = computeLocal(selected, qty, disc);
    if (!calc) { setLocalResult(null); return; }
    const { baseFee, discountAmt, finalFee } = calc;

    setLocalResult({
      template_id: selected.id, template_name: selected.name,
      billing_type: selected.billing_type, billing_type_display: selected.billing_type,
      quantity: qty, quantity_unit: selected.quantity_unit?.symbol ?? null,
      rate: selected.billing_type === "quantity_rate" ? selected.default_rate_per_unit
            : selected.billing_type === "percentage"  ? selected.default_percentage
            : selected.default_hourly_rate,
      currency: selected.currency,
      base_fee:            r2(baseFee),
      discount_percentage: disc,
      discount_amount:     r2(discountAmt),
      final_fee:           r2(finalFee),
      stages: selected.template_stages.map((ts) => ({
        order:              ts.order,
        stage_name:         ts.fee_stage.name,
        fee_percentage:     ts.fee_percentage,
        instalment_amount:  r2((finalFee * Number(ts.fee_percentage)) / 100),
        payment_terms_days: ts.payment_terms_days,
        deliverables:       ts.deliverable_templates
          .sort((a, b) => a.order - b.order)
          .map((dt) => ({ id: dt.id, name: dt.name, is_mandatory: dt.is_mandatory, order: dt.order })),
      })),
    });
  }, [selected, quantity, discount]);

  // Debounced server sync at 600ms
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selected || !quantity || Number(quantity) <= 0) {
      setServerResult(null); setSyncing(false); return;
    }
    setSyncing(true); setServerError(null);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetchTemplatePreview(selected.id, quantity, discount || "0", selected.currency);
        setServerResult(res);
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : "Server sync failed");
      } finally {
        setSyncing(false);
      }
    }, 600);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [selected, quantity, discount]);

  const handleSelect = (tpl: FeeTemplateOption) => {
    setSelected(tpl); setQuantity(""); setDiscount("0");
    setLocalResult(null); setServerResult(null); setServerError(null);
  };

  const grouped = useMemo(() =>
    templates.reduce<Record<string, FeeTemplateOption[]>>((acc, t) => {
      (acc[t.billing_type] ??= []).push(t); return acc;
    }, {}),
  [templates]);
  const billingOrder = ["quantity_rate", "percentage", "hourly"] as const;
  const quantityReady = !!selected && !!quantity && Number(quantity) > 0;

  return (
    // Scoped wrapper — no global style leakage, no height override
    <div ref={containerRef} className="fc-root" style={{ color: C.t2, fontFamily: "'DM Sans', 'Outfit', sans-serif", padding: isMobile ? "18px 14px 60px" : "26px 22px 50px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&family=DM+Mono:wght@400;500;600&family=Outfit:wght@700;800&display=swap');
        .fc-root *{box-sizing:border-box;}
        .fc-root input[type=number]{-moz-appearance:textfield;}
        .fc-root input[type=number]::-webkit-inner-spin-button,
        .fc-root input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        .fc-root input::placeholder{color:${C.t5};}
        .fc-root button{font-family:'DM Sans','Outfit',sans-serif;}
        @keyframes fc-spin{to{transform:rotate(360deg)}}
        @keyframes fc-fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes fc-pulse{0%,100%{opacity:.27}50%{opacity:.6}}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 22, display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: C.acLight, border: `1.5px solid ${C.acMid}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={C.acText} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: C.t1, letterSpacing: "-0.04em", lineHeight: 1.1, margin: 0 }}>
            Fee Calculator
          </h2>
          <p style={{ fontSize: 11.5, color: C.t4, marginTop: 1 }}>
            Select a service type · enter project details · get instant fee breakdown
          </p>
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "278px 1fr", gap: 15, alignItems: "start" }}>

        {/* Left — template list */}
        <div style={{
          background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 13, overflow: "hidden",
          ...(isMobile ? {} : { position: "sticky", top: 20, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }),
        }}>
          <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.t4, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Service Types</div>
          </div>

          {loadingTpl && (
            <div style={{ padding: "14px 11px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[80, 66, 73].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 10, background: "rgba(255,255,255,0.04)", animation: "fc-pulse 1.4s ease infinite" }} />
              ))}
            </div>
          )}
          {tplError && <div style={{ padding: "12px", color: C.red, fontSize: 12 }}>⚠ {tplError}</div>}
          {!loadingTpl && !tplError && templates.length === 0 && (
            <EmptySlate icon={<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth={1.2}><rect x={3} y={3} width={18} height={18} rx={2} /><path d="M8 10h8M8 14h5" /></svg>} title="No templates found" sub="Ask your admin to set up fee templates." />
          )}
          {!loadingTpl && templates.length > 0 && (
            <div style={{ padding: "10px 9px", display: "flex", flexDirection: "column", gap: 12 }}>
              {billingOrder.filter((bt) => grouped[bt]?.length).map((bt) => (
                <div key={bt}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: C.t5, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 5, paddingLeft: 3 }}>
                    {BILLING_PALETTE[bt].label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {grouped[bt].map((tpl) => (
                      <TemplateCard key={tpl.id} template={tpl} selected={selected?.id === tpl.id} onClick={() => handleSelect(tpl)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — inputs + result */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {!selected && (
            <div style={{ background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 13 }}>
              <EmptySlate
                icon={<svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth={1}><path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M14 3h7m0 0v7m0-7L9 15" /></svg>}
                title="Select a service type"
                sub="Choose a fee template from the left panel to get started."
              />
            </div>
          )}

          {selected && (
            <div style={{ background: C.card, border: `1px solid ${C.cardB}`, borderRadius: 13, overflow: "hidden", animation: "fc-fadeUp 0.17s ease both" }}>
              <div style={{ padding: "13px 17px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{selected.name}</div>
                  {selected.description && <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>{selected.description}</div>}
                </div>
                <Pill type={selected.billing_type} />
              </div>

              <div style={{ padding: "16px 17px", display: "flex", flexDirection: "column", gap: 15 }}>
                <FieldInput
                  label={quantityLabel(selected)} value={quantity} onChange={setQuantity}
                  placeholder={quantityPlaceholder(selected)} required
                  hint={
                    selected.billing_type === "quantity_rate"
                      ? `Rate: ${fmtCurrency(selected.default_rate_per_unit, selected.currency)} per ${selected.quantity_unit?.symbol ?? "unit"}`
                      : selected.billing_type === "percentage"
                      ? `Fee rate: ${selected.default_percentage}% of entered value`
                      : `Rate: ${fmtCurrency(selected.default_hourly_rate, selected.currency)} per hour`
                  }
                />
                <FieldInput label="Discount (%)" value={discount} onChange={setDiscount} placeholder="0" hint="Optional discount on the base fee." />

                {/* Status indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.t4 }}>
                  {!quantityReady
                    ? <><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.t5 }} /><span>Enter a quantity to calculate</span></>
                    : syncing && !serverResult
                    ? <><Spinner /><span style={{ color: C.t3 }}>Calculating…</span></>
                    : serverError
                    ? <><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.red }} /><span style={{ color: C.red }}>{serverError} — showing local estimate</span></>
                    : <><div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} /><span style={{ color: C.green }}>{serverResult ? "Confirmed" : "Estimating…"}</span></>
                  }
                </div>
              </div>
            </div>
          )}

          {displayResult && (
            <FeeResult result={displayResult} syncing={syncing && !serverResult} />
          )}
        </div>
      </div>
    </div>
  );
}