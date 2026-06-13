/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";
// app/feecalc/page.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  fmtCurrency,
  quantityLabel,
  quantityPlaceholder,
  fetchPublicQuote,
  unlockDiscount,
  publicPreview,
  type FeeTemplateOption,
  type MemberBillingRateItem,
} from "./feeCalcApi";
import {
  C,
  r2,
  nv,
  normaliseRole,
  computeQtyLocal,
  computeLocalDiscPct,
  type DiscountRule,
  type DiscountPackage,
  type QuoteOption,
  type DeliverableItem,
  type StageItem,
  type QuantityResult,
  type HourlyResult,
  type DiscountBreakdownLine,
  type QuotePreviewResult,
  type ActiveTypes,
} from "./feeCalcTypes";
import { generateProposalPdf } from "./feeCalcPdf";

// ─── Skeleton Components ──────────────────────────────────────────────────────

function SkeletonBlock({
  height = 16,
  width = "100%",
  radius = 6,
}: {
  height?: number;
  width?: string | number;
  radius?: number;
}) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: radius,
        background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
        backgroundSize: "400% 100%",
        animation: "fc-shimmer 1.4s ease infinite",
        flexShrink: 0,
      }}
    />
  );
}

function QuantityResultSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div
        style={{
          background: C.amberBg,
          border: `1.5px solid ${C.amberBd}`,
          borderRadius: 12,
          padding: "22px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <SkeletonBlock height={10} width="38%" radius={4} />
        <SkeletonBlock height={38} width="55%" radius={8} />
        <SkeletonBlock height={9} width="44%" radius={4} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 9,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <SkeletonBlock height={8} width="50%" radius={3} />
            <SkeletonBlock height={14} width="72%" radius={4} />
          </div>
        ))}
      </div>

      <div
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "11px 18px",
            borderBottom: `1px solid ${C.border}`,
            background: C.surface,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <SkeletonBlock height={8} width={8} radius={4} />
          <SkeletonBlock height={9} width="28%" radius={4} />
        </div>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              padding: "14px 18px",
              borderBottom: i === 0 ? `1px solid ${C.border}` : "none",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <SkeletonBlock height={28} width={28} radius={14} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <SkeletonBlock height={11} width="40%" radius={4} />
              <SkeletonBlock height={6} width="55%" radius={3} />
              <SkeletonBlock height={5} width="30%" radius={3} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
              <SkeletonBlock height={16} width={70} radius={4} />
              <SkeletonBlock height={8} width={50} radius={3} />
            </div>
          </div>
        ))}
        <div
          style={{
            padding: "11px 18px",
            borderTop: `1px solid ${C.border}`,
            background: C.amberBg,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <SkeletonBlock height={9} width="12%" radius={3} />
          <SkeletonBlock height={14} width="22%" radius={4} />
        </div>
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Spinner({ color = C.amber }: { color?: string }) {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 20 20"
      fill="none"
      style={{ animation: "fc-spin 0.75s linear infinite", flexShrink: 0 }}
    >
      <path d="M17 10a7 7 0 1 1-7-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.t4,
        letterSpacing: "0.09em",
        textTransform: "uppercase" as const,
        marginBottom: 7,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 34,
        height: 18,
        borderRadius: 99,
        flexShrink: 0,
        cursor: "pointer",
        background: checked ? color : "#d1d5db",
        transition: "background 0.15s",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 18 : 3,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        flexShrink: 0,
        cursor: "pointer",
        background: checked ? color : "#fff",
        border: `1.5px solid ${checked ? color : "#d1d5db"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.12s",
      }}
    >
      {checked && (
        <svg width={9} height={9} viewBox="0 0 9 9" fill="none">
          <path
            d="M1.5 4.5L3.5 6.5L7.5 2.5"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

// ─── Code Entry Panel ─────────────────────────────────────────────────────────

function CodeEntryPanel({
  codeInput,
  setCodeInput,
  onLoad,
  loading,
  error,
}: {
  codeInput: string;
  setCodeInput: (v: string) => void;
  onLoad: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div
      style={{
        maxWidth: 440,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        animation: "fc-fadeUp 0.25s ease both",
      }}
    >
      <div style={{ textAlign: "center", paddingTop: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🧮</div>
        <h3 style={{ fontSize: 19, fontWeight: 700, color: C.t1, margin: "0 0 6px" }}>
          Enter your quote code
        </h3>
        <p style={{ fontSize: 13, color: C.t3, lineHeight: 1.65, margin: 0 }}>
          Your consultant has shared a short code with you.
          <br />
          Enter it below to view your personalised fee proposal.
        </p>
      </div>
      <div
        style={{
          background: C.bg,
          border: `1.5px solid ${focus ? C.amber : C.border}`,
          borderRadius: 12,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          transition: "border-color 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", gap: 9 }}>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(e) => e.key === "Enter" && onLoad()}
            placeholder="QO-A3K9F2"
            maxLength={20}
            autoFocus
            style={{
              flex: 1,
              background: C.surface,
              color: C.t1,
              fontSize: 17,
              fontFamily: "monospace",
              fontWeight: 600,
              border: `1.5px solid ${focus ? C.amberBd : C.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              outline: "none",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              transition: "border-color 0.12s",
            }}
          />
          <button
            onClick={onLoad}
            disabled={loading || !codeInput.trim()}
            style={{
              background: codeInput.trim() ? C.amber : "#e5e7eb",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              color: codeInput.trim() ? "#fff" : C.t4,
              fontSize: 13,
              fontWeight: 600,
              cursor: codeInput.trim() ? "pointer" : "default",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 7,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? (
              <>
                <Spinner color="#fff" /> Loading…
              </>
            ) : (
              "Open →"
            )}
          </button>
        </div>
        {error && (
          <div
            style={{
              background: C.redBg,
              border: `1px solid ${C.redBd}`,
              borderRadius: 8,
              padding: "9px 13px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: C.red }}>{error}</span>
          </div>
        )}
      </div>
      <p style={{ textAlign: "center", fontSize: 11, color: C.t4, margin: 0 }}>
        Don&apos;t have a code? Contact your consultant.
      </p>
    </div>
  );
}

// ─── Billing Type Selector ────────────────────────────────────────────────────

function BillingTypeSelector({
  quote,
  activeTypes,
  setActiveTypes,
}: {
  quote: QuoteOption;
  activeTypes: ActiveTypes;
  setActiveTypes: (v: ActiveTypes) => void;
}) {
  const available = [
    quote.show_quantity && { key: "quantity" as const, label: "Quantity Fee", color: C.amber, icon: "⬡" },
    quote.show_hourly && { key: "hourly" as const, label: "Hourly Billing", color: C.teal, icon: "◷" },
    quote.show_lumpsum && { key: "lumpsum" as const, label: "Lump-sum Quote", color: C.indigo, icon: "◈" },
  ].filter(Boolean) as { key: keyof ActiveTypes; label: string; color: string; icon: string }[];

  if (available.length <= 1) return null;
  const activeCount = available.filter((o) => activeTypes[o.key]).length;

  function toggle(key: keyof ActiveTypes) {
    const newVal = !activeTypes[key];
    if (!newVal && activeCount === 1) return;
    setActiveTypes({ ...activeTypes, [key]: newVal });
  }

  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "13px 15px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <SectionLabel>Choose billing model(s) to explore</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {available.map(({ key, label, color, icon }) => {
          const on = activeTypes[key];
          const isLast = on && activeCount === 1;
          return (
            <div
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 9,
                cursor: isLast ? "default" : "pointer",
                background: on ? `${color}12` : "transparent",
                border: `1.5px solid ${on ? color : C.borderMd}`,
                transition: "all 0.12s",
                opacity: isLast ? 0.7 : 1,
              }}
            >
              <Checkbox checked={on} onChange={() => toggle(key)} color={color} />
              <span style={{ fontSize: 14, fontWeight: 600, color: on ? color : C.t3 }}>
                {icon} {label}
              </span>
              {isLast && (
                <span style={{ marginLeft: "auto", fontSize: 9.5, color: C.t4, fontStyle: "italic" }}>
                  at least one required
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Deliverable List ─────────────────────────────────────────────────────────

function DeliverableList({
  items,
  accent,
  onToggleOptOut,
  optOutEnabled,
}: {
  items: DeliverableItem[];
  accent: string;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  optOutEnabled?: boolean;
}) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  if (!sorted.length) return null;
  return (
    <div
      style={{
        marginTop: 9,
        paddingTop: 9,
        borderTop: `1px dashed ${C.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
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
              <circle
                cx={5}
                cy={5}
                r={4}
                stroke={C.borderMd}
                strokeWidth={1.2}
                strokeDasharray="2 1.5"
              />
            </svg>
          )}
          <span
            style={{
              fontSize: 12,
              color: d.opted_out ? C.t4 : d.is_mandatory ? C.t2 : C.t3,
              textDecoration: d.opted_out ? "line-through" : "none",
            }}
          >
            {d.name}
          </span>
          {!d.is_mandatory && !d.opted_out && (
            <span style={{ fontSize: 9, color: C.t4, fontStyle: "italic" }}>optional</span>
          )}
          {d.opted_out && (
            <span style={{ fontSize: 9, color: C.amber, fontStyle: "italic" }}>opted out</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stage Row ────────────────────────────────────────────────────────────────

function StageRow({
  stage,
  displayOrder,
  currency,
  accent,
  idx,
  total,
  showAmount,
  onToggleOptOut,
  optOutEnabled,
}: {
  stage: StageItem;
  displayOrder: number;
  currency: string;
  accent: string;
  idx: number;
  total: number;
  showAmount: boolean;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  optOutEnabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const pct = nv(stage.fee_percentage);
  const amt = nv(stage.instalment_amount ?? 0);
  const hasDel = stage.deliverables.length > 0;

  return (
    <div style={{ borderBottom: idx < total - 1 ? `1px solid ${C.border}` : "none" }}>
      <div
        onClick={() => hasDel && setOpen((o) => !o)}
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: hasDel ? "pointer" : "default",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            flexShrink: 0,
            background: `${accent}15`,
            border: `1.5px solid ${accent}40`,
            color: accent,
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {displayOrder}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap" as const,
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{stage.stage_name}</span>
              {hasDel && (
                <span style={{ fontSize: 9.5, color: C.t4, marginLeft: 6 }}>
                  {open ? "▲" : "▼"} {stage.deliverables.length} deliverable
                  {stage.deliverables.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {showAmount && (
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: accent,
                    fontFamily: "monospace",
                    lineHeight: 1.2,
                  }}
                >
                  {fmtCurrency(amt, currency)}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: C.t4, marginTop: showAmount ? 2 : 0 }}>
                {pct}% · Net {stage.payment_terms_days}d
              </div>
            </div>
          </div>
          <div
            style={{
              height: 3,
              background: C.border,
              borderRadius: 99,
              marginTop: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: accent,
                borderRadius: 99,
              }}
            />
          </div>
          {hasDel && open && (
            <DeliverableList
              items={stage.deliverables}
              accent={accent}
              onToggleOptOut={onToggleOptOut}
              optOutEnabled={optOutEnabled}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Discount Panel ───────────────────────────────────────────────────────────

function DiscountPanel({
  pkg,
  appliedRuleIds,
  onToggleRule,
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
  const toggleRules = activeRules.filter((r) => r.condition_type !== "optout_per_item");
  const optoutRules = activeRules.filter((r) => r.condition_type === "optout_per_item");
  if (!activeRules.length) return null;

  const breakdown: DiscountBreakdownLine[] =
    serverBreakdown.length > 0
      ? serverBreakdown.filter((l) => l.type !== "cap")
      : activeRules
          .filter((r) => {
            if (r.condition_type === "optout_per_item") return optedOutIds.size > 0;
            return appliedRuleIds.has(r.id);
          })
          .map((r) => {
            if (r.condition_type === "optout_per_item") {
              const cap = r.max_optout_items > 0 ? r.max_optout_items : optedOutIds.size;
              const count = Math.min(optedOutIds.size, cap);
              return {
                rule_id: r.id,
                label: `${r.label} × ${count}`,
                pct: (Number(r.discount_pct) * count).toFixed(2),
                type: "optout_per_item",
              };
            }
            return { rule_id: r.id, label: r.label, pct: r.discount_pct, type: r.condition_type };
          });

  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.purpleBd}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          padding: "12px 18px",
          borderBottom: `1px solid ${C.border}`,
          background: C.purpleBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke={C.purple}
              strokeWidth={1.8}
            />
          </svg>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.purple,
              letterSpacing: "0.07em",
              textTransform: "uppercase" as const,
            }}
          >
            {pkg.name}
          </span>
          <span
            style={{
              fontSize: 9.5,
              color: C.purple,
              background: C.purpleBg,
              border: `1px solid ${C.purpleBd}`,
              borderRadius: 4,
              padding: "1px 6px",
              fontWeight: 700,
            }}
          >
            UNLOCKED
          </span>
        </div>
        {totalDiscountPct > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: C.purple, fontFamily: "monospace" }}>
            −{totalDiscountPct.toFixed(1)}% total
          </span>
        )}
      </div>

      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {toggleRules.map((rule, idx) => {
          const colors = [C.green, C.teal, C.purple, C.amber];
          const color = colors[idx % colors.length];
          const on = appliedRuleIds.has(rule.id);
          return (
            <div
              key={rule.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                paddingTop: idx > 0 ? 10 : 0,
                borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
              }}
            >
              <Toggle checked={on} onChange={(v) => onToggleRule(rule.id, v)} color={color} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: on ? C.t1 : C.t2 }}>
                    {rule.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      background: `${color}15`,
                      color,
                      border: `1px solid ${color}40`,
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontWeight: 700,
                    }}
                  >
                    −{rule.discount_pct}%
                  </span>
                </div>
                {rule.description && (
                  <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2, lineHeight: 1.5 }}>
                    {rule.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {optoutRules.map((rule, idx) => (
          <div
            key={rule.id}
            style={{
              paddingTop: toggleRules.length + idx > 0 ? 10 : 0,
              borderTop: toggleRules.length + idx > 0 ? `1px solid ${C.border}` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{rule.label}</span>
              <span
                style={{
                  fontSize: 10,
                  background: C.amberBg,
                  color: C.amber,
                  border: `1px solid ${C.amberBd}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                  fontWeight: 700,
                }}
              >
                −{rule.discount_pct}% each
                {rule.max_optout_items > 0 && ` (max ${rule.max_optout_items})`}
              </span>
            </div>
            {rule.description && (
              <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2, lineHeight: 1.5 }}>
                {rule.description}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: C.t3, marginTop: 4, lineHeight: 1.5 }}>
              Untick optional deliverables below to apply this discount.
              {optedOutIds.size > 0 && (
                <span style={{ color: C.amber, marginLeft: 5 }}>
                  {optedOutIds.size} opted out · −
                  {(
                    Number(rule.discount_pct) *
                    Math.min(
                      optedOutIds.size,
                      rule.max_optout_items > 0 ? rule.max_optout_items : optedOutIds.size,
                    )
                  ).toFixed(1)}
                  %
                </span>
              )}
            </div>
          </div>
        ))}

        {breakdown.length > 0 && (
          <div
            style={{
              marginTop: 2,
              padding: "10px 14px",
              background: C.purpleBg,
              border: `1px solid ${C.purpleBd}`,
              borderRadius: 9,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: C.purple,
                letterSpacing: "0.09em",
                textTransform: "uppercase" as const,
                marginBottom: 7,
              }}
            >
              Discount summary
            </div>
            {breakdown.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: C.t3,
                  marginBottom: 3,
                }}
              >
                <span>{line.label}</span>
                {line.pct !== null && (
                  <span style={{ fontFamily: "monospace", color: C.purple }}>−{line.pct}%</span>
                )}
              </div>
            ))}
            <div
              style={{
                borderTop: `1px solid ${C.border}`,
                marginTop: 5,
                paddingTop: 5,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span style={{ color: C.t2 }}>Total discount</span>
              <span style={{ color: C.purple, fontFamily: "monospace" }}>
                −{totalDiscountPct.toFixed(1)}%
              </span>
            </div>
            {nv(pkg.max_total_discount_pct) > 0 && (
              <div style={{ fontSize: 10.5, color: C.t4, marginTop: 4 }}>
                Cap: max {pkg.max_total_discount_pct}% combined
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quantity Result View ─────────────────────────────────────────────────────

function QuantityResultView({
  result,
  currency,
  onToggleOptOut,
  optOutEnabled,
}: {
  result: QuantityResult;
  currency: string;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  optOutEnabled?: boolean;
}) {
  const hasDiscount = nv(result.discount_pct) > 0;
  const totalDel = result.stages.reduce((s, st) => s + st.deliverables.length, 0);
  const optedOut = result.stages.reduce(
    (s, st) => s + st.deliverables.filter((d) => d.opted_out).length,
    0,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, animation: "fc-fadeUp 0.2s ease both" }}>
      <div
        style={{
          background: C.amberBg,
          border: `1.5px solid ${C.amberBd}`,
          borderRadius: 12,
          padding: "22px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.amber,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            marginBottom: 5,
          }}
        >
          Total Professional Fee
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: C.amber,
            fontFamily: "monospace",
            lineHeight: 1.1,
          }}
        >
          {fmtCurrency(result.final_fee, currency)}
        </div>
        {hasDiscount && (
          <div
            style={{
              marginTop: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, color: C.t4, textDecoration: "line-through" }}>
              {fmtCurrency(result.base_fee, currency)}
            </span>
            <span
              style={{
                fontSize: 11,
                background: C.greenBg,
                color: C.green,
                border: `1px solid ${C.greenBd}`,
                borderRadius: 4,
                padding: "2px 8px",
                fontWeight: 600,
              }}
            >
              −{nv(result.discount_pct).toFixed(1)}% off
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[
          {
            label: "Quantity",
            val: `${Number(result.quantity).toLocaleString("en-IN")}${result.quantity_unit ? " " + result.quantity_unit : ""}`,
            color: C.t2,
          },
          { label: "Rate / unit", val: fmtCurrency(result.rate, currency), color: C.amber },
          {
            label: "Base fee",
            val: fmtCurrency(result.base_fee, currency),
            color: hasDiscount ? C.t3 : C.t2,
          },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 9,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                color: C.t4,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                marginBottom: 4,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color,
                fontFamily: "monospace",
              }}
            >
              {val ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {result.stages.length > 0 && (
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              padding: "11px 18px",
              borderBottom: `1px solid ${C.border}`,
              background: C.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Dot color={C.amber} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: C.t3,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase" as const,
                }}
              >
                Payment Schedule
              </span>
              <span style={{ fontSize: 10, color: C.t4 }}>{result.stages.length} stages</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {optedOut > 0 && (
                <span style={{ fontSize: 10, color: C.amber }}>{optedOut} opted out</span>
              )}
              {totalDel > 0 && (
                <span style={{ fontSize: 10, color: C.t4 }}>
                  {totalDel} deliverable{totalDel !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {result.stages.map((st, i) => (
            <StageRow
              key={i}
              idx={i}
              displayOrder={i + 1}
              total={result.stages.length}
              stage={st}
              currency={currency}
              accent={C.amber}
              showAmount
              onToggleOptOut={onToggleOptOut}
              optOutEnabled={optOutEnabled}
            />
          ))}
          <div
            style={{
              padding: "11px 18px",
              borderTop: `1px solid ${C.border}`,
              background: C.amberBg,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: C.t3 }}>Total</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.amber, fontFamily: "monospace" }}>
              {fmtCurrency(result.final_fee, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hourly View ──────────────────────────────────────────────────────────────

function HourlyView({
  result,
  tpl,
  optOutEnabled,
  onToggleOptOut,
  discPct,
}: {
  result?: HourlyResult;
  tpl: FeeTemplateOption;
  optOutEnabled?: boolean;
  onToggleOptOut?: (id: number, optOut: boolean) => void;
  discPct: number;
}) {
  const data = result ?? {
    template_id: tpl.id,
    template_name: tpl.name,
    default_hourly_rate: tpl.default_hourly_rate ?? "0",
    note: "Final fee depends on actual hours logged.",
    consultant_rates: (tpl.member_billing_rates ?? []).filter((r) => r.is_active && !r.project),
    stages: tpl.template_stages.map((ts) => ({
      order: ts.order,
      stage_name: ts.fee_stage.name,
      fee_percentage: ts.fee_percentage,
      payment_terms_days: ts.payment_terms_days,
      deliverables: (ts.deliverable_templates ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((dt) => ({
          id: dt.id,
          name: dt.name,
          is_mandatory: dt.is_mandatory,
          order: dt.order,
        })),
    })),
  };
  const currency = tpl.currency;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {/* Template info card */}
      <div
        style={{
          background: C.tealBg,
          border: `1.5px solid ${C.tealBd}`,
          borderRadius: 12,
          padding: "15px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            flexShrink: 0,
            background: `${C.teal}15`,
            border: `1.5px solid ${C.tealBd}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <circle cx={12} cy={12} r={9} stroke={C.teal} strokeWidth={1.6} />
            <path
              d="M12 7v5l3.5 3.5"
              stroke={C.teal}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 3 }}>
            {data.template_name}
          </div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.65 }}>{data.note}</div>
        </div>
      </div>

      {/* Stages */}
      {data.stages.length > 0 && (
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              padding: "11px 18px",
              borderBottom: `1px solid ${C.border}`,
              background: C.surface,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Dot color={C.teal} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: C.t3,
                letterSpacing: "0.07em",
                textTransform: "uppercase" as const,
              }}
            >
              Project stages &amp; deliverables
            </span>
          </div>
          {data.stages.map((st, i) => (
            <StageRow
              key={i}
              idx={i}
              displayOrder={i + 1}
              total={data.stages.length}
              stage={st}
              currency={currency}
              accent={C.teal}
              showAmount={false}
              onToggleOptOut={onToggleOptOut}
              optOutEnabled={optOutEnabled}
            />
          ))}
        </div>
      )}

      {/* Consultant rates */}
      {data.consultant_rates.length > 0 && (
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              borderBottom: `1px solid ${C.border}`,
              background: C.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Dot color={C.teal} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: C.t3,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase" as const,
                }}
              >
                Consultant billing rates
              </span>
            </div>
            <span style={{ fontSize: 10.5, color: C.t4 }}>{currency} / hr</span>
          </div>
          {data.consultant_rates.map((r: MemberBillingRateItem, i) => {
            const role = normaliseRole(r.role);

            // Avatar initials from role words, or null to show generic icon
            const avatarContent = role
              ? role
                  .split(" ")
                  .map((w: string) => w[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : null;

            const baseRate = Number(r.rate_per_hour);
            const discountedRate =
              discPct > 0
                ? Math.round(baseRate * (1 - discPct / 100) * 100) / 100
                : null;

            return (
              <div
                key={r.id}
                style={{
                  padding: "13px 18px",
                  borderBottom: i < data.consultant_rates.length - 1 ? `1px solid ${C.border}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: C.tealBg,
                    border: `1.5px solid ${C.tealBd}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: avatarContent ? 11 : 14,
                    fontWeight: 700,
                    color: C.teal,
                  }}
                >
                  {avatarContent ?? (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <circle cx={12} cy={8} r={4} stroke={C.teal} strokeWidth={1.6} />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={C.teal} strokeWidth={1.6} strokeLinecap="round" />
                    </svg>
                  )}
                </div>

                {/* Role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {role ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{role}</div>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t4, fontStyle: "italic" }}>
                      No role assigned
                    </div>
                  )}
                  {r.remarks && (
                    <div style={{ fontSize: 10.5, color: C.t4, marginTop: 1, fontStyle: "italic" }}>
                      {r.remarks}
                    </div>
                  )}
                </div>

                {/* Rate display */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {discountedRate !== null ? (
                    <>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.t4,
                          textDecoration: "line-through",
                          fontFamily: "monospace",
                          lineHeight: 1.3,
                        }}
                      >
                        {fmtCurrency(baseRate, r.currency ?? currency)}/hr
                      </div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: C.teal,
                          fontFamily: "monospace",
                          whiteSpace: "nowrap" as const,
                          lineHeight: 1.2,
                        }}
                      >
                        {fmtCurrency(discountedRate, r.currency ?? currency)}
                        <span style={{ fontSize: 11, color: C.t3, fontWeight: 400 }}>/hr</span>
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: C.teal,
                        fontFamily: "monospace",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {fmtCurrency(baseRate, r.currency ?? currency)}
                      <span style={{ fontSize: 11, color: C.t3, fontWeight: 400 }}>/hr</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Lump-sum View ────────────────────────────────────────────────────────────

function LumpsumView({
  quote,
  discPct,
  currency,
}: {
  quote: QuoteOption;
  discPct: number;
  currency: string;
}) {
  const base = nv(quote.lumpsum_amount);
  const discAmt = r2((base * discPct) / 100);
  const final = r2(base - discAmt);
  const label = quote.lumpsum_label || "Fixed Professional Fee";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div
        style={{
          background: C.indigoBg,
          border: `1.5px solid ${C.indigoBd}`,
          borderRadius: 12,
          padding: "24px 20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.indigo,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: C.indigo,
            fontFamily: "monospace",
            lineHeight: 1.1,
          }}
        >
          {fmtCurrency(final, currency)}
        </div>
        {discPct > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, color: C.t4, textDecoration: "line-through" }}>
              {fmtCurrency(base, currency)}
            </span>
            <span
              style={{
                fontSize: 11,
                background: C.greenBg,
                color: C.green,
                border: `1px solid ${C.greenBd}`,
                borderRadius: 4,
                padding: "2px 8px",
                fontWeight: 600,
              }}
            >
              −{discPct.toFixed(1)}% off
            </span>
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
          This is a fixed all-inclusive fee for the scope of work described.
        </div>
      </div>

      {discPct > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[
            { label: "Base fee", val: fmtCurrency(base, currency), color: C.t3 },
            { label: "Discount", val: `−${fmtCurrency(discAmt, currency)}`, color: C.green },
            { label: "Final fee", val: fmtCurrency(final, currency), color: C.indigo },
          ].map(({ label: l, val, color }) => (
            <div
              key={l}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 9,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  color: C.t4,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  marginBottom: 4,
                }}
              >
                {l}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color, fontFamily: "monospace" }}>
                {val}
              </div>
            </div>
          ))}
        </div>
      )}

      {quote.lumpsum_note && (
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 11,
            padding: "13px 16px",
          }}
        >
          <SectionLabel>Note</SectionLabel>
          <p style={{ fontSize: 13, color: C.t3, lineHeight: 1.7, margin: 0 }}>
            {quote.lumpsum_note}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Terms Panel ──────────────────────────────────────────────────────────────

function TermsPanel({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          borderBottom: open ? `1px solid ${C.border}` : "none",
          background: C.surface,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke={C.t3}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <path
              d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
              stroke={C.t3}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.t3,
              letterSpacing: "0.07em",
              textTransform: "uppercase" as const,
            }}
          >
            Terms &amp; Conditions
          </span>
        </div>
        <span style={{ fontSize: 11, color: C.t4 }}>{open ? "▲ Hide" : "▼ Show"}</span>
      </div>
      {open && (
        <div style={{ padding: "15px 18px" }}>
          <p
            style={{
              fontSize: 13,
              color: C.t3,
              lineHeight: 1.8,
              margin: 0,
              whiteSpace: "pre-wrap" as const,
            }}
          >
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Discount Unlock Panel ────────────────────────────────────────────────────

function DiscountUnlockPanel({
  quoteCode,
  prefillCode,
  hasOpenPackage,
  onUnlockedWithCode,
}: {
  quoteCode: string;
  prefillCode?: string;
  hasOpenPackage: boolean;
  onUnlockedWithCode: (pkg: DiscountPackage, code: string) => void;
}) {
  const [code, setCode] = useState(prefillCode ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (hasOpenPackage) {
      handleUnlock("");
      return;
    }
    if (prefillCode && prefillCode.trim().length > 3) handleUnlock(prefillCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUnlock(overrideCode?: string) {
    const c = (overrideCode ?? code).trim().toUpperCase();
    if (!hasOpenPackage && !c) return;
    setLoading(true);
    setError(null);
    try {
      const pkg = await unlockDiscount(quoteCode, c);
      onUnlockedWithCode(pkg, c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  if (hasOpenPackage) {
    return loading ? (
      <div
        style={{
          background: C.greenBg,
          border: `1px solid ${C.greenBd}`,
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Spinner color={C.green} />
        <span style={{ fontSize: 13, color: C.green }}>Checking available discounts…</span>
      </div>
    ) : null;
  }

  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.purpleBd}`,
        borderRadius: 12,
        padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <rect x={3} y={11} width={18} height={11} rx={2} stroke={C.purple} strokeWidth={1.8} />
          <path
            d="M7 11V7a5 5 0 0 1 10 0v4"
            stroke={C.purple}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>Have a discount code?</span>
      </div>
      <p style={{ fontSize: 12, color: C.t3, margin: "0 0 12px", lineHeight: 1.6 }}>
        Your consultant may have shared a separate discount code to unlock applicable discounts.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          placeholder="DP-X7M2P1"
          maxLength={20}
          style={{
            flex: 1,
            background: C.surface,
            color: C.t1,
            fontSize: 14,
            fontFamily: "monospace",
            fontWeight: 600,
            border: `1.5px solid ${focus ? C.purpleBd : C.border}`,
            borderRadius: 8,
            padding: "9px 12px",
            outline: "none",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            transition: "border-color 0.12s",
          }}
        />
        <button
          onClick={() => handleUnlock()}
          disabled={loading || !code.trim()}
          style={{
            background: code.trim() ? C.purple : "#e5e7eb",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            color: code.trim() ? "#fff" : C.t4,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: code.trim() ? "pointer" : "default",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {loading ? <Spinner color="#fff" /> : "Unlock"}
        </button>
      </div>
      {error && (
        <div
          style={{
            marginTop: 9,
            fontSize: 12,
            color: C.red,
            background: C.redBg,
            border: `1px solid ${C.redBd}`,
            borderRadius: 7,
            padding: "7px 12px",
          }}
        >
          {error}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 10.5, color: C.t4 }}>
        No discount code? You can skip this and proceed with the standard fee.
      </div>
    </div>
  );
}

// ─── Quantity Input Panel ─────────────────────────────────────────────────────

function QuantityInputPanel({
  tpl,
  quantity,
  setQuantity,
}: {
  tpl: FeeTemplateOption;
  quantity: string;
  setQuantity: (v: string) => void;
}) {
  const [qFocus, setQFocus] = useState(false);
  const hint = tpl.default_rate_per_unit
    ? `Rate: ${fmtCurrency(tpl.default_rate_per_unit, tpl.currency)} per ${tpl.quantity_unit?.symbol ?? "unit"}`
    : "";

  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          padding: "13px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{tpl.name}</div>
          {tpl.description && (
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 2 }}>{tpl.description}</div>
          )}
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            flexShrink: 0,
            letterSpacing: "0.07em",
            textTransform: "uppercase" as const,
            padding: "3px 9px",
            borderRadius: 5,
            background: C.amberBg,
            color: C.amber,
            border: `1px solid ${C.amberBd}`,
          }}
        >
          ⬡ Qty × Rate
        </span>
      </div>
      <div style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 13 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t4,
              letterSpacing: "0.09em",
              textTransform: "uppercase" as const,
            }}
          >
            {quantityLabel(tpl)} <span style={{ color: C.red }}>*</span>
          </label>
          <input
            type="number"
            value={quantity}
            min="0"
            step="any"
            placeholder={quantityPlaceholder(tpl)}
            onChange={(e) => setQuantity(e.target.value)}
            onFocus={() => setQFocus(true)}
            onBlur={() => setQFocus(false)}
            style={{
              background: C.surface,
              color: C.t1,
              fontSize: 16,
              border: `1.5px solid ${qFocus ? C.amber : C.border}`,
              borderRadius: 8,
              padding: "10px 13px",
              outline: "none",
              fontFamily: "monospace",
              transition: "border-color 0.1s",
              width: "100%",
            }}
          />
          {hint && <div style={{ fontSize: 11, color: C.t4 }}>{hint}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0 2px" }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.t4,
          letterSpacing: "0.09em",
          textTransform: "uppercase" as const,
          whiteSpace: "nowrap" as const,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

// ─── Share Bar ────────────────────────────────────────────────────────────────

function ShareBar({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/feecalc?code=${code}` : "";
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        padding: "9px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <path
          d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
          stroke={C.t4}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <path
          d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
          stroke={C.t4}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          flex: 1,
          fontSize: 10.5,
          color: C.t4,
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {url}
      </span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
        style={{
          flexShrink: 0,
          background: copied ? C.greenBg : "#e5e7eb",
          border: "none",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 10.5,
          fontWeight: 600,
          color: copied ? C.green : C.t3,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        {copied ? "✓ Copied" : "Copy link"}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeeCalculatorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw] = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 640;

  const urlCode = searchParams.get("code")?.toUpperCase() ?? "";
  const urlDCode = searchParams.get("dcode")?.toUpperCase() ?? "";

  const [codeInput, setCodeInput] = useState(urlCode);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [quote, setQuote] = useState<QuoteOption | null>(null);
  const [activeTypes, setActiveTypes] = useState<ActiveTypes>({
    quantity: false,
    hourly: false,
    lumpsum: false,
  });
  const [quantity, setQuantity] = useState("");

  const [unlockedPkg, setUnlockedPkg] = useState<DiscountPackage | null>(null);
  const [appliedRuleIds, setAppliedRuleIds] = useState<Set<number>>(new Set());
  const [optedOutIds, setOptedOutIds] = useState<Set<number>>(new Set());

  const [localQtyResult, setLocalQtyResult] = useState<QuantityResult | null>(null);
  const [serverResult, setServerResult] = useState<QuotePreviewResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (urlCode) loadQuote(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuote(code?: string) {
    const c = (code ?? codeInput).trim().toUpperCase();
    if (!c) return;
    setLoadingQuote(true);
    setQuoteError(null);
    try {
      const q = await fetchPublicQuote(c);
      setQuote(q);
      setCodeInput(c);
      setQuantity("");
      setAppliedRuleIds(new Set());
      setOptedOutIds(new Set());
      setLocalQtyResult(null);
      setServerResult(null);
      setServerError(null);
      setUnlockedPkg(q.discount_package);
      setActiveTypes({ quantity: q.show_quantity, hourly: q.show_hourly, lumpsum: q.show_lumpsum });
      const params = new URLSearchParams(searchParams.toString());
      params.set("code", c);
      params.delete("dcode");
      router.replace(`/feecalc?${params.toString()}`, { scroll: false });
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Failed to load quote");
    } finally {
      setLoadingQuote(false);
    }
  }

  function handleDiscountUnlockedWithCode(pkg: DiscountPackage, enteredCode: string) {
    setUnlockedPkg(pkg);
    const params = new URLSearchParams(searchParams.toString());
    if (quote?.access_code) params.set("code", quote.access_code);
    if (enteredCode) params.set("dcode", enteredCode);
    router.replace(`/feecalc?${params.toString()}`, { scroll: false });
  }

  const effectivePkg = unlockedPkg;

  // Plain numeric value derived from primitive/serialisable state — safe to use
  // directly as an effect dependency (no unstable function identity).
  const discPct = computeLocalDiscPct(effectivePkg, appliedRuleIds, optedOutIds.size);

  useEffect(() => {
    if (!quote?.quantity_template) {
      setLocalQtyResult(null);
      return;
    }
    const qty = Number(quantity);
    setLocalQtyResult(computeQtyLocal(quote.quantity_template, qty, discPct, optedOutIds));
  }, [quote, quantity, discPct, optedOutIds]);

  // ── Debounced server sync ─────────────────────────────────────────────────
  // NOTE: previously this effect depended on a `useCallback`-wrapped function
  // whose identity changed on every render touching appliedRuleIds/optedOutIds,
  // which retriggered this effect endlessly (infinite "loading" loop). It now
  // depends only on primitive/stable values.
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!quote) {
      setServerResult(null);
      setSyncing(false);
      return;
    }
    const needsQty = activeTypes.quantity;
    if (needsQty && (!quantity || Number(quantity) <= 0)) {
      setServerResult(null);
      setSyncing(false);
      return;
    }
    setSyncing(true);
    setServerError(null);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const result = await publicPreview({
          code: quote.access_code,
          quantity: needsQty ? quantity : "0",
          applied_rule_ids: [...appliedRuleIds],
          opted_out_deliverable_ids: [...optedOutIds],
          currency: quote.currency ?? "INR",
        });
        setServerResult(result);
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : "Sync failed");
      } finally {
        setSyncing(false);
      }
    }, 600);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [quote, quantity, appliedRuleIds, optedOutIds, activeTypes.quantity]);

  const handleToggleRule = useCallback((id: number, on: boolean) => {
    setAppliedRuleIds((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const handleToggleOptOut = useCallback((id: number, optOut: boolean) => {
    setOptedOutIds((prev) => {
      const n = new Set(prev);
      if (optOut) n.add(id);
      else n.delete(id);
      return n;
    });
  }, []);

  const qtyResult: QuantityResult | null =
    serverResult?.quantity_result ?? (serverError ? localQtyResult : null);
  const hourlyResult: HourlyResult | undefined = serverResult?.hourly_result ?? undefined;
  const currency = quote?.currency ?? "INR";
  const serverBD = serverResult?.discount_breakdown ?? [];

  const optOutEnabled = !!(
    effectivePkg?.rules.some((r) => r.is_active && r.condition_type === "optout_per_item")
  );
  const availableCount = quote
    ? [quote.show_quantity, quote.show_hourly, quote.show_lumpsum].filter(Boolean).length
    : 0;

  const packageIsOpen = !!(quote?.discount_package && !quote.discount_package.activation_code);
  const showUnlockPanel = !!(quote && quote.discount_package && !unlockedPkg);

  const quantityReady = !!quantity && Number(quantity) > 0;
  const showQuantitySkeleton = quantityReady && syncing;
  const showQuantityResult = quantityReady && !!qtyResult && !syncing;

  function handleDownloadPDF() {
    if (!quote) return;
    generateProposalPdf({
      quote,
      qtyResult,
      hourlyResult,
      discPct,
      discBreakdown: serverBD,
      effectivePkg,
      currency,
      activeTypes,
    });
  }

  return (
    <div
      ref={containerRef}
      className="fc-root"
      style={{
        color: C.t2,
        fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
        padding: isMobile ? "14px 10px 60px" : "22px 20px 60px",
        background: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <style>{`
        .fc-root * { box-sizing: border-box; }
        .fc-root input[type=number] { -moz-appearance: textfield; }
        .fc-root input[type=number]::-webkit-inner-spin-button,
        .fc-root input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        .fc-root input::placeholder { color: ${C.t4}; }
        @keyframes fc-spin { to { transform: rotate(360deg) } }
        @keyframes fc-fadeUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes fc-shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: isMobile ? 14 : 20,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                flexShrink: 0,
                background: C.amberBg,
                border: `1.5px solid ${C.amberBd}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke={C.amber}
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 700,
                  color: C.t1,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  margin: 0,
                }}
              >
                Fee Calculator
              </h1>
              {quote ? (
                <p style={{ fontSize: 12, color: C.t4, margin: "3px 0 0" }}>
                  {quote.name}
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily: "monospace",
                      fontSize: 10.5,
                      color: C.t4,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: "1px 6px",
                    }}
                  >
                    {quote.access_code}
                  </span>
                </p>
              ) : (
                <p style={{ fontSize: 12, color: C.t4, margin: "3px 0 0" }}>
                  Enter your quote code to get started
                </p>
              )}
            </div>
          </div>

          {quote && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleDownloadPDF}
                style={{
                  background: C.amber,
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                }}
              >
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                {isMobile ? "PDF" : "Download PDF"}
              </button>
              <button
                onClick={() => {
                  setQuote(null);
                  setUnlockedPkg(null);
                  setCodeInput("");
                  setQuantity("");
                  setServerResult(null);
                  router.replace("/feecalc", { scroll: false });
                }}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  color: C.t3,
                  cursor: "pointer",
                }}
              >
                ← Different code
              </button>
            </div>
          )}
        </div>

        {/* Code entry */}
        {!quote && (
          <CodeEntryPanel
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            onLoad={() => loadQuote()}
            loading={loadingQuote}
            error={quoteError}
          />
        )}

        {/* Main content */}
        {quote && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 13,
              animation: "fc-fadeUp 0.2s ease both",
            }}
          >
            <ShareBar code={quote.access_code} />

            {availableCount > 1 && (
              <BillingTypeSelector
                quote={quote}
                activeTypes={activeTypes}
                setActiveTypes={setActiveTypes}
              />
            )}

            {showUnlockPanel && (
              <DiscountUnlockPanel
                quoteCode={quote.access_code}
                prefillCode={urlDCode}
                hasOpenPackage={packageIsOpen}
                onUnlockedWithCode={handleDiscountUnlockedWithCode}
              />
            )}

            {effectivePkg && (
              <DiscountPanel
                pkg={effectivePkg}
                appliedRuleIds={appliedRuleIds}
                onToggleRule={handleToggleRule}
                optedOutIds={optedOutIds}
                totalDiscountPct={discPct}
                serverBreakdown={serverBD}
              />
            )}

            {/* Quantity */}
            {activeTypes.quantity && quote.show_quantity && quote.quantity_template && (
              <>
                {availableCount > 1 && <SectionDivider label="Quantity Fee" />}
                <QuantityInputPanel
                  tpl={quote.quantity_template}
                  quantity={quantity}
                  setQuantity={setQuantity}
                />
                {showQuantitySkeleton && <QuantityResultSkeleton />}
                {showQuantityResult && (
                  <QuantityResultView
                    result={qtyResult!}
                    currency={currency}
                    onToggleOptOut={handleToggleOptOut}
                    optOutEnabled={optOutEnabled}
                  />
                )}
                {serverError && localQtyResult && !syncing && (
                  <QuantityResultView
                    result={localQtyResult}
                    currency={currency}
                    onToggleOptOut={handleToggleOptOut}
                    optOutEnabled={optOutEnabled}
                  />
                )}
              </>
            )}

            {/* Hourly */}
            {activeTypes.hourly && quote.show_hourly && quote.hourly_template && (
              <>
                {availableCount > 1 && <SectionDivider label="Hourly Billing" />}
                <HourlyView
                  result={hourlyResult}
                  tpl={quote.hourly_template}
                  optOutEnabled={optOutEnabled}
                  onToggleOptOut={handleToggleOptOut}
                  discPct={discPct}
                />
              </>
            )}

            {/* Lump-sum */}
            {activeTypes.lumpsum && quote.show_lumpsum && quote.lumpsum_amount && (
              <>
                {availableCount > 1 && <SectionDivider label="Lump-sum Quote" />}
                <LumpsumView quote={quote} discPct={discPct} currency={currency} />
              </>
            )}

            {/* Terms */}
            {quote.description && <TermsPanel text={quote.description} />}

            {/* Footer */}
            <div
              style={{
                paddingTop: 16,
                borderTop: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <p style={{ fontSize: 11, color: C.t4, margin: 0 }}>
                This document is confidential and prepared for the named client only.
              </p>
              <p style={{ fontSize: 11, color: C.t4, margin: 0 }}>
                {new Date().toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}