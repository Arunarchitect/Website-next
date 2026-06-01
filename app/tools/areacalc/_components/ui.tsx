"use client";

import { useState } from "react";
import { UNIT_SYSTEMS, fmt, fmtCost, type UnitKey } from "../areadata";

// ─── Spin ─────────────────────────────────────────────────────

export function Spin({ size = 16, color = "#6b7280" }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${color}33`, borderTop: `2px solid ${color}`,
      borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0,
    }} />
  );
}

// ─── InfoBox ──────────────────────────────────────────────────

export function InfoBox({ icon, title, body }: { icon: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <button type="button" onClick={() => setOpen(true)} style={{
        fontSize: 11, width: 16, height: 16, borderRadius: "50%",
        border: "1.5px solid #d1d5db", background: "#f9fafb",
        color: "#6b7280", cursor: "pointer", display: "inline-flex",
        alignItems: "center", justifyContent: "center", fontWeight: 700, marginLeft: 4,
      }}>?</button>
      {open && (
        <span onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <span onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,.2)",
          }}>
            <p style={{ fontSize: 26, margin: "0 0 8px" }}>{icon}</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>{title}</p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.6 }}>{body}</p>
            <button type="button" onClick={() => setOpen(false)} style={{
              width: "100%", padding: "10px", borderRadius: 8, border: "none",
              background: "#f3f4f6", color: "#374151", fontWeight: 700, cursor: "pointer",
            }}>Got it</button>
          </span>
        </span>
      )}
    </span>
  );
}

// ─── RateBadge ────────────────────────────────────────────────

export function RateBadge({ source }: { source: string }) {
  const MAP: Record<string, { label: string; color: string; bg: string }> = {
    survey:                { label: "📍 Local data",  color: "#047857", bg: "#ecfdf5" },
    survey_all_categories: { label: "📊 Area data",   color: "#1d4ed8", bg: "#eff6ff" },
    country_average:       { label: "🌍 Country avg", color: "#6d28d9", bg: "#f5f3ff" },
    fallback:              { label: "📌 Estimated",   color: "#b45309", bg: "#fffbeb" },
    custom:                { label: "✏️ Custom rate",  color: "#be185d", bg: "#fdf2f8" },
  };
  const s = MAP[source] ?? { label: source, color: "#6b7280", bg: "#f9fafb" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
      background: s.bg, color: s.color, display: "inline-block",
    }}>{s.label}</span>
  );
}

// ─── BigOption ────────────────────────────────────────────────

export function BigOption({ selected, onClick, emoji, label, hint, accent = "#f59e0b" }: {
  selected: boolean; onClick: () => void;
  emoji: string; label: string; hint?: string; accent?: string;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      gap: 3, padding: "12px 14px", borderRadius: 12,
      border: `2px solid ${selected ? accent : "#e5e7eb"}`,
      background: selected ? `${accent}14` : "#fff",
      cursor: "pointer", textAlign: "left", flex: "1 1 120px",
      transition: "all .18s",
      boxShadow: selected ? `0 0 0 3px ${accent}33` : "none",
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{label}</span>
      {hint && <span style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>{hint}</span>}
    </button>
  );
}

// ─── StickyBar ────────────────────────────────────────────────

export function StickyBar({ gross, cost, unit, loading }: {
  gross: number; cost: number; unit: UnitKey; loading: boolean;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  if (gross <= 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "#1f2937", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 20, padding: "10px 16px", flexWrap: "wrap",
      boxShadow: "0 -4px 20px rgba(0,0,0,.2)",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9, opacity: .5, textTransform: "uppercase", letterSpacing: .7 }}>Gross Area</p>
        <p style={{ margin: 0, fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "#fcd34d" }}>{fmt(gross, unit)} {aLabel}</p>
      </div>
      <div style={{ width: 1, height: 28, background: "#374151", flexShrink: 0 }} />
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9, opacity: .5, textTransform: "uppercase", letterSpacing: .7 }}>Est. Cost</p>
        <p style={{ margin: 0, fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: "#4ade80" }}>{loading ? "—" : fmtCost(cost)}</p>
      </div>
    </div>
  );
}