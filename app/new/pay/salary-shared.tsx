// "use client";
// // salary-shared.tsx
// // Shared design tokens, types, utility functions, and reusable components
// // imported by salary.tsx, salary-calculator.tsx, and salary-expenses.tsx

// import { useState, useRef, useEffect } from "react";
// import type { FundAllocation } from "./data";

// // ─── Design tokens ────────────────────────────────────────────────────────────

// export const T = {
//   bg:      "#0f1117",
//   panel:   "rgba(255,255,255,0.025)",
//   panelB:  "rgba(255,255,255,0.07)",
//   panel2:  "rgba(255,255,255,0.04)",
//   panel2B: "rgba(255,255,255,0.1)",
//   divider: "rgba(255,255,255,0.06)",
//   t1: "#f8fafc", t2: "#f1f5f9", t3: "#94a3b8",
//   t4: "#64748b", t5: "#475569", t6: "#334155",
//   ac:      "#6366f1",
//   acLight: "rgba(99,102,241,0.12)",
//   acMid:   "rgba(99,102,241,0.55)",
//   acText:  "#818cf8",
//   green:   "#10b981", greenBg: "rgba(16,185,129,0.12)",
//   red:     "#ef4444", redBg:   "rgba(239,68,68,0.12)",
//   amber:   "#f59e0b", amberBg: "rgba(245,158,11,0.12)",
//   teal:    "#06b6d4", tealBg:  "rgba(6,182,212,0.12)",
//   purple:  "#8b5cf6", purpleBg:"rgba(139,92,246,0.12)",
// };

// export const AVATAR_GRADIENTS = [
//   "linear-gradient(135deg,#6366f1,#818cf8)",
//   "linear-gradient(135deg,#10b981,#34d399)",
//   "linear-gradient(135deg,#f59e0b,#fbbf24)",
//   "linear-gradient(135deg,#ef4444,#f87171)",
// ];

// export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
//   travel:        { label: "Travel",         color: "#6366f1", icon: "✈" },
//   food:          { label: "Food",           color: "#f59e0b", icon: "🍽" },
//   accommodation: { label: "Accommodation",  color: "#10b981", icon: "🏨" },
//   stationery:    { label: "Stationery",     color: "#06b6d4", icon: "📋" },
//   others:        { label: "Others",         color: "#94a3b8", icon: "📦" },
// };

// // ─── Formatters ────────────────────────────────────────────────────────────────

// export function fmtINR(n: number) {
//   return "₹" + Math.round(n).toLocaleString("en-IN");
// }
// export function fmtHours(mins: number) {
//   const h = Math.floor(mins / 60), m = mins % 60;
//   return m === 0 ? `${h}h` : `${h}h ${m}m`;
// }
// export function fmtDate(iso: string) {
//   if (!iso) return "—";
//   return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
// }

// // ─── Shared select style ───────────────────────────────────────────────────────

// export const selStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
//   background: T.panel2, border: `1px solid ${T.panel2B}`,
//   borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: T.t2,
//   outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
//   appearance: "none" as const, width: "100%", transition: "border-color 0.15s",
//   ...extra,
// });

// // ─── Shared result interfaces (used by salary-calculator.tsx and salary.tsx) ──

// export interface HourlyResult {
//   memberId: string;
//   memberName: string;
//   memberRole: string;
//   memberIdx: number;
//   hourlyRate: number;
//   totalMins: number;
//   totalPay: number;
//   orgName: string;
//   projectBreakdown: { projectId: string; name: string; color: string; mins: number; pay: number }[];
//   sessionCount: number;
//   dateFrom: string;
//   dateTo: string;
// }

// export interface FeeResult {
//   memberId: string;
//   memberName: string;
//   memberRole: string;
//   memberIdx: number;
//   orgName: string;
//   projectName: string;
//   projectColor: string;
//   stageLabel: string;
//   baseAmount: number;
//   memberAlloc: FundAllocation | null;
//   memberPay: number;
//   otherAllocTotal: number;
//   otherMemberTotal: number;
//   allAllocs: FundAllocation[];
// }

// // ─── Reusable UI primitives ────────────────────────────────────────────────────

// export const Divider = () => (
//   <div style={{ height: 1, background: T.divider }} />
// );

// export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
//   return (
//     <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//       letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
//       {children}
//       {required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
//     </div>
//   );
// }

// export function Avatar({ name, size = 36, idx = 0 }: { name: string; size?: number; idx?: number }) {
//   return (
//     <div style={{
//       width: size, height: size, borderRadius: "50%", flexShrink: 0,
//       background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
//       display: "flex", alignItems: "center", justifyContent: "center",
//       fontSize: size * 0.34, fontWeight: 700, color: "#fff", letterSpacing: "0.03em",
//     }}>
//       {name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
//     </div>
//   );
// }

// export function Bar({ pct, color, height = 5 }: { pct: number; color: string; height?: number }) {
//   return (
//     <div style={{ height, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
//       <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, borderRadius: 99,
//         background: `linear-gradient(90deg,${color}88,${color})`,
//         transition: "width 0.55s cubic-bezier(.16,1,.3,1)" }} />
//     </div>
//   );
// }

// export function EditableNum({ value, onChange, min = 0, max }: {
//   value: number; onChange: (v: number) => void; min?: number; max?: number;
// }) {
//   const [editing, setEditing] = useState(false);
//   const [raw, setRaw] = useState(String(value));
//   const ref = useRef<HTMLInputElement>(null);
//   useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
//   function commit() {
//     const n = parseFloat(raw.replace(/,/g, ""));
//     if (!isNaN(n) && n >= min && (max === undefined || n <= max)) onChange(n);
//     else setRaw(String(value));
//     setEditing(false);
//   }
//   if (editing) return (
//     <input ref={ref} value={raw}
//       onChange={e => setRaw(e.target.value)}
//       onBlur={commit}
//       onKeyDown={e => {
//         if (e.key === "Enter") commit();
//         if (e.key === "Escape") { setRaw(String(value)); setEditing(false); }
//       }}
//       style={{ width: 100, background: T.panel2, border: `1px solid ${T.acMid}`, borderRadius: 6,
//         padding: "4px 8px", fontSize: 13, color: T.t1, outline: "none",
//         fontFamily: "'DM Sans',sans-serif", textAlign: "right" }}
//     />
//   );
//   return (
//     <span onClick={() => { setRaw(String(value)); setEditing(true); }} title="Click to edit"
//       style={{ fontSize: 13, color: T.t1, cursor: "text", padding: "4px 8px",
//         borderRadius: 6, border: "1px solid transparent", display: "inline-flex", alignItems: "center" }}
//       onMouseEnter={e => {
//         (e.currentTarget as HTMLElement).style.borderColor = T.panel2B;
//         (e.currentTarget as HTMLElement).style.background  = T.panel2;
//       }}
//       onMouseLeave={e => {
//         (e.currentTarget as HTMLElement).style.borderColor = "transparent";
//         (e.currentTarget as HTMLElement).style.background  = "transparent";
//       }}
//     >
//       <span style={{ fontWeight: 600 }}>{value.toLocaleString("en-IN")}</span>
//     </span>
//   );
// }

// export function ModeTab({ active, onClick, icon, label }: {
//   active: boolean; onClick: () => void; icon: string; label: string;
// }) {
//   return (
//     <button onClick={onClick} style={{
//       flex: 1, padding: "11px 0", border: "none", borderRadius: 10,
//       background: active ? T.ac : "transparent",
//       color: active ? "#fff" : T.t4,
//       fontSize: 12.5, fontWeight: active ? 600 : 400,
//       cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.18s",
//       display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
//     }}
//       onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t2; }}
//       onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t4; }}
//     >
//       <span>{icon}</span><span>{label}</span>
//     </button>
//   );
// }