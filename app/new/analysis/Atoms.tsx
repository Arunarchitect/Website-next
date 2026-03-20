// analysis/Atoms.tsx

import React from "react";
import { ACCENT, BG, BORDER, MUTED, SURF, TEXT, TEXT2 } from "./tokens";
import { LoadBtn } from "./LoadBtn";

// ── Stat card ────────────────────────────────────────────
export function Stat({
  label, value, color = TEXT, sub,
}: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED }}>{sub}</div>}
    </div>
  );
}

// ── Chip toggle ──────────────────────────────────────────
export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${active ? ACCENT : BORDER}`, background: active ? ACCENT : SURF, color: active ? "#fff" : TEXT2, transition: "all 0.15s", fontFamily: "inherit", touchAction: "manipulation" }}
    >
      {label}
    </button>
  );
}

// ── Section card ─────────────────────────────────────────
export function SectionCard({
  title, badge, hint, children, onLoad, loading, loaded,
}: {
  title: string; badge?: string; hint?: string;
  children: React.ReactNode;
  onLoad?: () => void; loading?: boolean; loaded?: boolean;
}) {
  return (
    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: loaded || loading ? 12 : 0 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
          {badge && <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginLeft: 10 }}>{badge}</span>}
        </div>
        {onLoad && !loaded && (
          <LoadBtn label={loading ? `Loading ${title}…` : `Load ${title}`} loading={!!loading} onClick={onLoad} />
        )}
      </div>
      {!loaded && !loading && hint && (
        <div style={{ fontSize: 12, color: MUTED, padding: "18px 0", textAlign: "center" }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

// ── Field label (used inside forms) ─────────────────────
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
      {children}
    </div>
  );
}

// ── Metric card (result display) ─────────────────────────
export function MetricCard({
  label, value, sub, color = TEXT,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: BG, borderRadius: 10, padding: "12px 14px", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
