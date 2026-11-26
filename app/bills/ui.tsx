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
