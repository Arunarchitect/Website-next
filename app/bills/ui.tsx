// app/bills/ui.tsx
import React from "react";
import { C } from "../feecalc/feeCalcTypes";

export const input: React.CSSProperties = {
  width: "100%", background: C.surface, color: C.t1, fontSize: 14, fontFamily: "inherit",
  border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", outline: "none",
};

export function Card({ children, title, right }: { children: React.ReactNode; title?: string; right?: React.ReactNode }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{title}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

type Kind = "primary" | "ghost" | "danger";
export function Btn({ kind = "ghost", style, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: Kind }) {
  const look: Record<Kind, React.CSSProperties> = {
    primary: { background: C.amber, color: "#fff", border: "none" },
    ghost: { background: C.bg, color: C.t2, border: `1px solid ${C.border}` },
    danger: { background: C.bg, color: C.red, border: `1px solid ${C.redBd}` },
  };
  return (
    <button type="button" {...p} style={{
      borderRadius: 7, padding: "6px 12px", fontSize: 12.5, fontWeight: 600,
      cursor: p.disabled ? "default" : "pointer", opacity: p.disabled ? 0.6 : 1, ...look[kind], ...style,
    }} />
  );
}

export function Msg({ kind = "error", children }: { kind?: "error" | "ok"; children: React.ReactNode }) {
  const e = kind === "error";
  return (
    <div role={e ? "alert" : "status"} style={{
      background: e ? C.redBg : C.greenBg, border: `1px solid ${e ? C.redBd : C.greenBd}`,
      color: e ? C.red : C.green, borderRadius: 9, padding: "9px 13px", fontSize: 12.5,
    }}>{children}</div>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: C.t3, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

export function money(v: string | number | null | undefined, cur = "INR") {
  const n = Number(v ?? 0);
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n); }
  catch { return n.toFixed(2); }
}

export const errText = (e: unknown, fb = "Something went wrong") => (e instanceof Error ? e.message : fb);

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: [C.t3, C.surface], issued: [C.amber, C.amberBg], paid: [C.green, C.greenBg],
    partial: [C.teal, C.tealBg], cancelled: [C.red, C.redBg],
  };
  const [fg, bg] = map[status] ?? [C.t3, C.surface];
  return <span style={{ fontSize: 11, fontWeight: 700, color: fg, background: bg, borderRadius: 5, padding: "2px 8px" }}>{status}</span>;
}

// ─── Loading helpers ─────────────────────────────────────────────────────────

function UiStyles() {
  return (
    <style>{`
      @keyframes uiPulse{0%,100%{opacity:.35}50%{opacity:.85}}
      @keyframes uiSlide{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
    `}</style>
  );
}

/** One pulsing placeholder bar. */
export function Skeleton({ w = "100%", h = 12, r = 5, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return (
    <>
      <UiStyles />
      <div aria-hidden style={{
        width: w, height: h, borderRadius: r, background: C.border,
        animation: "uiPulse 1.4s ease-in-out infinite", flexShrink: 0, ...style,
      }} />
    </>
  );
}

/** Placeholder for a list of rows (title + two buttons), same shape as the real rows. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ borderTop: `1px solid ${C.border}`, padding: "12px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Skeleton w={[170, 130, 200][i % 3]} h={13} />
            <Skeleton w={90} h={11} />
            <span style={{ flex: 1 }} />
            <Skeleton w={52} h={26} r={7} />
            <Skeleton w={78} h={26} r={7} />
          </div>
          <Skeleton w={[60, 45, 70][i % 3] + "%"} h={10} style={{ marginTop: 9 }} />
        </div>
      ))}
    </div>
  );
}

/** Thin indeterminate progress bar. */
export function BarLoader() {
  return (
    <>
      <UiStyles />
      <div style={{ height: 3, overflow: "hidden", background: C.border, borderRadius: 99 }}>
        <div style={{ height: "100%", width: "40%", background: C.amber, borderRadius: 99, animation: "uiSlide 1.1s ease-in-out infinite" }} />
      </div>
    </>
  );
}

/**
 * Wrap anything that runs an action. While `on` is true a translucent layer covers the
 * children and swallows every click, with a progress bar and a label, so nothing can be
 * clicked twice by accident.
 */
export function Busy({ on, label = "Working…", radius = 12, children }: {
  on: boolean; label?: string; radius?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative" }} aria-busy={on}>
      {children}
      {on && (
        <div
          role="status"
          onClickCapture={(e) => e.stopPropagation()}
          style={{
            position: "absolute", inset: 0, zIndex: 20, borderRadius: radius,
            background: "rgba(255,255,255,0.7)", cursor: "progress",
            display: "flex", justifyContent: "center", alignItems: "flex-start",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderRadius: radius, overflow: "hidden" }}>
            <BarLoader />
          </div>
          <div style={{
            position: "sticky", top: "42vh", marginTop: 24, background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 99, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, color: C.t2,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}>
            {label}
          </div>
        </div>
      )}
    </div>
  );
}