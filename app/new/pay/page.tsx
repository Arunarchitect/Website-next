"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  worklogEntries, organisations, projects, members,
  projMap, orgMap,
  memberRates, projectFees, stageFees, fundAllocations, minutesPerMember,
  type WorklogEntry, type MemberRate, type StageFee, type FundAllocation,
} from "./data";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function fmtINR(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
function fmtHours(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function useContainerWidth(ref: React.RefObject<HTMLElement>) {
  const [w, setW] = useState(9999);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#0f1117",
  panel:   "rgba(255,255,255,0.025)",
  panelB:  "rgba(255,255,255,0.07)",
  panel2:  "rgba(255,255,255,0.04)",
  panel2B: "rgba(255,255,255,0.1)",
  divider: "rgba(255,255,255,0.06)",
  t1: "#f8fafc", t2: "#f1f5f9", t3: "#94a3b8",
  t4: "#64748b", t5: "#475569", t6: "#334155",
  ac:      "#6366f1",
  acLight: "rgba(99,102,241,0.12)",
  acMid:   "rgba(99,102,241,0.55)",
  acText:  "#818cf8",
  green:   "#10b981", greenBg: "rgba(16,185,129,0.12)",
  red:     "#ef4444", redBg:   "rgba(239,68,68,0.12)",
  amber:   "#f59e0b", amberBg: "rgba(245,158,11,0.12)",
  teal:    "#06b6d4", tealBg:  "rgba(6,182,212,0.12)",
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#818cf8)",
  "linear-gradient(135deg,#10b981,#34d399)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#ef4444,#f87171)",
];

const Divider = () => <div style={{ height: 1, background: T.divider }} />;

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, idx = 0 }: { name: string; size?: number; idx?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: "#fff", letterSpacing: "0.03em",
    }}>
      {name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────
function CalGrid({ year, month, activeDates, selDates, onToggle }: {
  year: number; month: number;
  activeDates: Set<string>; selDates: Set<string>;
  onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
      {DAYS.map(d => (
        <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.t5, fontWeight: 600,
          letterSpacing: "0.06em", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const has = activeDates.has(iso), sel = selDates.has(iso);
        return (
          <button key={iso} onClick={() => onToggle(iso)} style={{
            background: sel ? T.ac : "transparent",
            border: `1px solid ${sel ? T.ac : "transparent"}`,
            borderRadius: 6, cursor: "pointer",
            color: sel ? "#fff" : has ? T.t2 : T.t4,
            fontSize: 11, padding: "6px 0", transition: "all 0.15s", width: "100%",
            fontFamily: "'DM Sans',sans-serif", fontWeight: sel ? 600 : 400,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          }}
            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = T.panel2; }}
            onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {day}
            {has && <span style={{ display: "block", width: 3, height: 3, borderRadius: "50%",
              background: sel ? "#fff" : T.acText }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Editable number ──────────────────────────────────────────────────────────
function EditableNum({ value, onChange, min = 0, max }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  function commit() {
    const n = parseFloat(raw.replace(/,/g, ""));
    if (!isNaN(n) && n >= min && (max === undefined || n <= max)) onChange(n);
    else setRaw(String(value));
    setEditing(false);
  }
  if (editing) return (
    <input ref={ref} value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setRaw(String(value)); setEditing(false); }
      }}
      style={{ width: 100, background: T.panel2, border: `1px solid ${T.acMid}`, borderRadius: 6,
        padding: "4px 8px", fontSize: 13, color: T.t1, outline: "none",
        fontFamily: "'DM Sans',sans-serif", textAlign: "right" }}
    />
  );
  return (
    <span onClick={() => { setRaw(String(value)); setEditing(true); }} title="Click to edit"
      style={{ fontSize: 13, color: T.t1, cursor: "text", padding: "4px 8px",
        borderRadius: 6, border: "1px solid transparent", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; (e.currentTarget as HTMLElement).style.background = T.panel2; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ fontWeight: 600 }}>{value.toLocaleString("en-IN")}</span>
    </span>
  );
}

// ─── Mode tab ─────────────────────────────────────────────────────────────────
function ModeTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "11px 0", border: "none", borderRadius: 10,
      background: active ? T.ac : "transparent",
      color: active ? "#fff" : T.t4,
      fontSize: 12.5, fontWeight: active ? 600 : 400,
      cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.18s",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t2; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t4; }}
    >
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function Bar({ pct, color, height = 5 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, borderRadius: 99,
        background: `linear-gradient(90deg,${color}88,${color})`,
        transition: "width 0.55s cubic-bezier(.16,1,.3,1)" }} />
    </div>
  );
}

// ─── Select style helper ──────────────────────────────────────────────────────
const selStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: T.panel2, border: `1px solid ${T.panel2B}`,
  borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: T.t2,
  outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
  appearance: "none" as const, width: "100%", transition: "border-color 0.15s",
  ...extra,
});

// ─── Label ────────────────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
      letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
      {children}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOURLY RESULT CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface HourlyResult {
  memberId: string;
  memberName: string;
  memberRole: string;
  memberIdx: number;
  hourlyRate: number;
  totalMins: number;
  totalPay: number;
  orgName: string;
  projectBreakdown: { projectId: string; name: string; color: string; mins: number; pay: number }[];
  sessionCount: number;
  dateFrom: string;
  dateTo: string;
}

function HourlyResultCard({ result, onRateChange }: {
  result: HourlyResult;
  onRateChange: (memberId: string, rate: number) => void;
}) {
  const maxPay = Math.max(...result.projectBreakdown.map(p => p.pay), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Member identity strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 14,
        background: T.greenBg, border: `1px solid ${T.green}33`,
        borderRadius: 14, padding: "16px 18px" }}>
        <Avatar name={result.memberName} size={48} idx={result.memberIdx} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>{result.memberName}</div>
          <div style={{ fontSize: 12, color: T.t5, marginTop: 2 }}>{result.memberRole} · {result.orgName}</div>
          <div style={{ fontSize: 11, color: T.t6, marginTop: 3 }}>
            {result.dateFrom && result.dateTo
              ? `${result.dateFrom} → ${result.dateTo}`
              : result.dateFrom ? `From ${result.dateFrom}` : result.dateTo ? `Until ${result.dateTo}` : "All time"}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: T.green, fontWeight: 600,
            letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Total Salary</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: T.green,
            fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{fmtINR(result.totalPay)}</div>
          <div style={{ fontSize: 11.5, color: T.t5, marginTop: 4 }}>{fmtHours(result.totalMins)}</div>
        </div>
      </div>

      {/* Key stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Hours logged",  val: fmtHours(result.totalMins), color: T.acText },
          { label: "Sessions",      val: String(result.sessionCount), color: T.teal   },
          { label: "Hourly rate",   val: fmtINR(result.hourlyRate),   color: T.amber  },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
            borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 9.5, color, fontWeight: 600,
              letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.t1,
              fontFamily: "'Sora',sans-serif", marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Rate editor */}
      <div style={{ background: T.panel2, border: `1px solid ${T.panel2B}`,
        borderRadius: 12, padding: "13px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.t5,
            letterSpacing: "0.07em", textTransform: "uppercase" }}>Hourly Rate</div>
          <div style={{ fontSize: 11, color: T.t6, marginTop: 2 }}>Click the value to edit</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: T.t4 }}>₹</span>
          <EditableNum value={result.hourlyRate}
            onChange={v => onRateChange(result.memberId, v)} min={0} />
          <span style={{ fontSize: 12, color: T.t5 }}>/ hr</span>
        </div>
      </div>

      {/* Project breakdown */}
      {result.projectBreakdown.length > 0 && (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
            letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
            By Project
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.projectBreakdown.map(p => (
              <div key={p.projectId}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%",
                      background: p.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 12.5, color: T.t2 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: T.t5 }}>{fmtHours(p.mins)}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{fmtINR(p.pay)}</span>
                </div>
                <Bar pct={(p.pay / maxPay) * 100} color={p.color} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEE RESULT CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface FeeResult {
  memberId: string;
  memberName: string;
  memberRole: string;
  memberIdx: number;
  orgName: string;
  projectName: string;
  projectColor: string;
  stageLabel: string;
  baseAmount: number;
  memberAlloc: FundAllocation | null;
  memberPay: number;
  otherAllocTotal: number;   // sum of all non-member allocations
  otherMemberTotal: number;  // sum of other member allocations
  allAllocs: FundAllocation[];
}

function FeeResultCard({ result, onAllocChange }: {
  result: FeeResult;
  onAllocChange: (id: string, pct: number) => void;
}) {
  const [showOthers, setShowOthers] = useState(false);

  const totalPct    = result.allAllocs.reduce((s, a) => s + a.percentage, 0);
  const pctWarn     = Math.abs(totalPct - 100) > 0.01;
  const memberPct   = result.memberAlloc?.percentage ?? 0;

  // Stacked bar: member slice first (highlighted), then others
  const nonMemberAllocs = result.allAllocs.filter(a => a.memberId !== result.memberId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Member identity strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 14,
        background: T.greenBg, border: `1px solid ${T.green}33`,
        borderRadius: 14, padding: "16px 18px" }}>
        <Avatar name={result.memberName} size={48} idx={result.memberIdx} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>{result.memberName}</div>
          <div style={{ fontSize: 12, color: T.t5, marginTop: 2 }}>{result.memberRole} · {result.orgName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%",
              background: result.projectColor, display: "inline-block" }} />
            <span style={{ fontSize: 11.5, color: T.t4 }}>{result.projectName}</span>
            <span style={{ fontSize: 11, color: T.t6 }}>· {result.stageLabel}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: T.green, fontWeight: 600,
            letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>Member Share</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: T.green,
            fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>
            {result.memberAlloc ? fmtINR(result.memberPay) : "—"}
          </div>
          {result.memberAlloc && (
            <div style={{ fontSize: 11.5, color: T.t5, marginTop: 4 }}>{memberPct}% of {fmtINR(result.baseAmount)}</div>
          )}
        </div>
      </div>

      {/* No allocation warning */}
      {!result.memberAlloc && (
        <div style={{ fontSize: 12.5, color: T.amber, background: T.amberBg,
          border: `1px solid ${T.amber}33`, borderRadius: 10, padding: "10px 14px" }}>
          ⚠ No fee allocation found for {result.memberName} in this project. Add one in data.ts.
        </div>
      )}

      {pctWarn && (
        <div style={{ fontSize: 12, color: T.amber, background: T.amberBg,
          border: `1px solid ${T.amber}33`, borderRadius: 10, padding: "10px 14px" }}>
          ⚠ Total allocations sum to {totalPct.toFixed(1)}% — adjust until they reach 100%.
        </div>
      )}

      {/* Key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Base amount",    val: fmtINR(result.baseAmount),   color: T.acText },
          { label: "Member share",   val: `${memberPct}%`,             color: T.green  },
          { label: "Other expenses", val: fmtINR(result.otherAllocTotal + result.otherMemberTotal), color: T.teal },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
            borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 9.5, color, fontWeight: 600,
              letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.t1,
              fontFamily: "'Sora',sans-serif", marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Member allocation editor */}
      {result.memberAlloc && (
        <div style={{ background: T.panel2, border: `1px solid ${T.panel2B}`,
          borderRadius: 12, padding: "13px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.t5,
              letterSpacing: "0.07em", textTransform: "uppercase" }}>Allocation Percentage</div>
            <div style={{ fontSize: 11, color: T.t6, marginTop: 2 }}>Click the value to edit</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <EditableNum value={memberPct}
              onChange={v => result.memberAlloc && onAllocChange(result.memberAlloc.id, Math.min(100, v))}
              min={0} max={100} />
            <span style={{ fontSize: 12, color: T.t5 }}>%</span>
          </div>
        </div>
      )}

      {/* Visual distribution bar — member highlighted */}
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
          letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
          Fee Distribution
        </div>
        {/* Stacked bar */}
        <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", gap: 1 }}>
          {result.allAllocs.map((a, idx) => {
            const isThisMember = a.memberId === result.memberId;
            return (
              <div key={a.id}
                title={`${a.label}: ${a.percentage}%`}
                style={{
                  flex: a.percentage,
                  background: isThisMember ? T.green : (a.color ?? "#475569"),
                  minWidth: a.percentage > 0 ? 2 : 0,
                  transition: "flex 0.4s",
                  // ring on member slice
                  outline: isThisMember ? `2px solid ${T.green}` : "none",
                  outlineOffset: isThisMember ? 1 : 0,
                }}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          {result.allAllocs.map((a) => {
            const isThisMember = a.memberId === result.memberId;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: isThisMember ? T.green : (a.color ?? T.t5),
                  display: "inline-block" }} />
                <span style={{ color: isThisMember ? T.t2 : T.t5,
                  fontWeight: isThisMember ? 600 : 400 }}>{a.label}</span>
                <span style={{ color: isThisMember ? T.green : T.t6,
                  fontWeight: isThisMember ? 700 : 400 }}>{a.percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Other allocations toggle */}
      <div style={{ background: T.panel2, border: `1px solid ${T.panel2B}`,
        borderRadius: 12, overflow: "hidden" }}>
        <button onClick={() => setShowOthers(p => !p)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "none", border: "none",
          cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.t3 }}>
            Other Expenses &amp; Allocations
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: T.t5 }}>
              {fmtINR(result.otherAllocTotal + result.otherMemberTotal)} total
            </span>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none"
              style={{ transform: showOthers ? "rotate(180deg)" : "none", transition: "0.15s" }}>
              <path d="M2 4l4 4 4-4" stroke={T.t5} strokeWidth={1.5} strokeLinecap="round"/>
            </svg>
          </div>
        </button>

        {showOthers && (
          <div style={{ borderTop: `1px solid ${T.divider}`, padding: "12px 16px",
            display: "flex", flexDirection: "column", gap: 8 }}>
            {nonMemberAllocs.map(a => {
              const amt = (result.baseAmount * a.percentage) / 100;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%",
                      background: a.color ?? T.t5, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 12.5, color: T.t3 }}>{a.label}</span>
                    <span style={{ fontSize: 11, color: T.t6 }}>{a.percentage}%</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.t4 }}>{fmtINR(amt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

type CalcMode = "hourly" | "fee";

export default function SalaryPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const cw       = useContainerWidth(containerRef);
  const isMobile = cw < 760;

  // ── Calendar state ─────────────────────────────────────────────────────────
  const [calYear,  setCalYear]  = useState(2025);
  const [calMonth, setCalMonth] = useState(2);
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear,  setSelYear]  = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  // ── Mode ───────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<CalcMode>("hourly");

  // ── Filter state (shared across modes) ────────────────────────────────────
  const [selMemberId, setSelMemberId] = useState("");
  const [selOrgId,    setSelOrgId]    = useState("");
  const [selProjId,   setSelProjId]   = useState("");  // optional in hourly, required in fee
  const [selStage,    setSelStage]    = useState<"all" | string>("all"); // fee mode stage scope

  // ── Editable rates / allocations ──────────────────────────────────────────
  const [rates,  setRates]  = useState(() => memberRates.map(r => ({ ...r })));
  const [fees,   setFees]   = useState(() => projectFees.map(f => ({ ...f })));
  const [stages, setStages] = useState(() => stageFees.map(s => ({ ...s })));
  const [allocs, setAllocs] = useState(() => fundAllocations.map(a => ({ ...a })));

  // ── Analysis result (null = not yet run) ─────────────────────────────────
  const [hourlyResult, setHourlyResult] = useState<HourlyResult | null>(null);
  const [feeResult,    setFeeResult]    = useState<FeeResult    | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const allDates      = useMemo(() => new Set(worklogEntries.map(e => e.date)), []);
  const availableYears = useMemo(() =>
    Array.from(new Set(worklogEntries.map(e => new Date(e.date).getFullYear()))).sort(), []);

  // Entries filtered by calendar/date-range only (member/project filters applied at analysis time)
  const calFilteredEntries = useMemo(() => worklogEntries.filter(e => {
    const d = new Date(e.date);
    if (selDates.size > 0 && !selDates.has(e.date))       return false;
    if (selMonth !== null && d.getMonth()    !== selMonth) return false;
    if (selYear  !== null && d.getFullYear() !== selYear)  return false;
    if (dateFrom && e.date < dateFrom)                     return false;
    if (dateTo   && e.date > dateTo)                       return false;
    return true;
  }), [selDates, selMonth, selYear, dateFrom, dateTo]);

  const calTotalMins = useMemo(() => calFilteredEntries.reduce((s, e) => {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    return s + (eh * 60 + em - (sh * 60 + sm));
  }, 0), [calFilteredEntries]);

  function toggleDate(iso: string) {
    setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }
  function prevMonth() { calMonth === 0  ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }
  function nextMonth() { calMonth === 11 ? (setCalMonth(0),  setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }

  // ── Derived option lists ───────────────────────────────────────────────────
  const orgOptions  = organisations;
  const projOptions = selOrgId ? projects.filter(p => p.organisationId === selOrgId) : projects;
  const memOptions  = selOrgId ? members.filter(m =>
    // In a real app members have orgId; we use worklog entries as proxy
    worklogEntries.some(e => e.memberId === m.id && e.organisationId === selOrgId)
  ) : members;
  const projStages  = stages.filter(s => s.projectId === selProjId).sort((a, b) => +a.stage - +b.stage);

  // ── Clear everything ───────────────────────────────────────────────────────
  function clearAll() {
    setSelDates(new Set()); setSelMonth(null); setSelYear(null);
    setDateFrom(""); setDateTo("");
    setSelMemberId(""); setSelOrgId(""); setSelProjId(""); setSelStage("all");
    setHourlyResult(null); setFeeResult(null); setAnalysisError("");
  }

  const hasAnyFilter = selDates.size > 0 || selMonth !== null || selYear !== null
    || !!dateFrom || !!dateTo || !!selMemberId || !!selOrgId || !!selProjId;

  // ── Run Analysis ──────────────────────────────────────────────────────────
  function runAnalysis() {
    setAnalysisError("");
    setHourlyResult(null);
    setFeeResult(null);

    if (!selMemberId) { setAnalysisError("Please select a member."); return; }

    const member    = members.find(m => m.id === selMemberId);
    const memberIdx = members.findIndex(m => m.id === selMemberId);
    if (!member) { setAnalysisError("Member not found."); return; }

    const orgName = selOrgId ? (orgMap[selOrgId]?.name ?? "All Orgs") : "All Orgs";

    if (mode === "hourly") {
      // Filter entries for this member + optional org/project
      const entries = calFilteredEntries.filter(e => {
        if (e.memberId !== selMemberId)              return false;
        if (selOrgId  && e.organisationId !== selOrgId)  return false;
        if (selProjId && e.projectId      !== selProjId) return false;
        return true;
      });

      const rateObj     = rates.find(r => r.memberId === selMemberId);
      const hourlyRate  = rateObj?.hourlyRate ?? 0;
      const minsMap     = minutesPerMember(entries);
      const totalMins   = minsMap[selMemberId] ?? 0;
      const totalPay    = Math.round((totalMins / 60) * hourlyRate);

      // Per-project breakdown
      const projBreakdown = Object.entries(
        entries.reduce((acc, e) => {
          const [sh, sm] = e.startTime.split(":").map(Number);
          const [eh, em] = e.endTime.split(":").map(Number);
          acc[e.projectId] = (acc[e.projectId] ?? 0) + (eh * 60 + em - (sh * 60 + sm));
          return acc;
        }, {} as Record<string, number>)
      ).map(([pid, mins]) => {
        const proj = projMap[pid];
        return {
          projectId: pid,
          name:  proj?.name  ?? pid,
          color: proj?.color ?? T.t6,
          mins,
          pay: Math.round((mins / 60) * hourlyRate),
        };
      }).sort((a, b) => b.pay - a.pay);

      setHourlyResult({
        memberId: selMemberId, memberName: member.name, memberRole: member.role,
        memberIdx, hourlyRate, totalMins, totalPay, orgName,
        projectBreakdown: projBreakdown,
        sessionCount: entries.length,
        dateFrom, dateTo,
      });

    } else {
      // Fee mode — project is mandatory
      if (!selProjId) { setAnalysisError("Please select a project for % of Fee analysis."); return; }

      const proj       = projMap[selProjId];
      const feeObj     = fees.find(f => f.projectId === selProjId);
      const projFeeAmt = feeObj?.totalFee ?? 0;

      const baseAmount = selStage === "all"
        ? projFeeAmt
        : (stages.find(s => s.projectId === selProjId && s.stage === selStage)?.fee ?? 0);

      const stageLabel = selStage === "all"
        ? "All Stages"
        : `Stage ${selStage} — ${stages.find(s => s.projectId === selProjId && s.stage === selStage)?.label ?? ""}`;

      const projAllocs = allocs.filter(a => a.projectId === selProjId);
      const memberAlloc = projAllocs.find(a => a.memberId === selMemberId) ?? null;
      const memberPay   = memberAlloc ? Math.round(baseAmount * memberAlloc.percentage / 100) : 0;

      // Other fund (non-member) allocations total
      const otherAllocTotal = projAllocs
        .filter(a => !a.memberId)
        .reduce((s, a) => s + Math.round(baseAmount * a.percentage / 100), 0);

      // Other member allocations total
      const otherMemberTotal = projAllocs
        .filter(a => a.memberId && a.memberId !== selMemberId)
        .reduce((s, a) => s + Math.round(baseAmount * a.percentage / 100), 0);

      setFeeResult({
        memberId: selMemberId, memberName: member.name, memberRole: member.role,
        memberIdx, orgName,
        projectName:  proj?.name  ?? selProjId,
        projectColor: proj?.color ?? T.ac,
        stageLabel, baseAmount,
        memberAlloc, memberPay,
        otherAllocTotal, otherMemberTotal,
        allAllocs: projAllocs,
      });
    }
  }

  // ── Rate / alloc mutators ─────────────────────────────────────────────────
  function updateRate(memberId: string, rate: number) {
    setRates(prev => prev.map(r => r.memberId === memberId ? { ...r, hourlyRate: rate } : r));
    // Keep live result in sync
    if (hourlyResult && hourlyResult.memberId === memberId) {
      setHourlyResult(prev => {
        if (!prev) return prev;
        const totalPay = Math.round((prev.totalMins / 60) * rate);
        return {
          ...prev, hourlyRate: rate, totalPay,
          projectBreakdown: prev.projectBreakdown.map(p => ({
            ...p, pay: Math.round((p.mins / 60) * rate),
          })),
        };
      });
    }
  }
  function updateAlloc(id: string, pct: number) {
    setAllocs(prev => prev.map(a => a.id === id ? { ...a, percentage: pct } : a));
    // Keep live result in sync
    if (feeResult) {
      setFeeResult(prev => {
        if (!prev) return prev;
        const updatedAllocs = prev.allAllocs.map(a => a.id === id ? { ...a, percentage: pct } : a);
        const memberAlloc   = updatedAllocs.find(a => a.memberId === prev.memberId) ?? null;
        const memberPay     = memberAlloc ? Math.round(prev.baseAmount * memberAlloc.percentage / 100) : 0;
        const otherAllocTotal = updatedAllocs.filter(a => !a.memberId)
          .reduce((s, a) => s + Math.round(prev.baseAmount * a.percentage / 100), 0);
        const otherMemberTotal = updatedAllocs.filter(a => a.memberId && a.memberId !== prev.memberId)
          .reduce((s, a) => s + Math.round(prev.baseAmount * a.percentage / 100), 0);
        return { ...prev, memberAlloc, memberPay, otherAllocTotal, otherMemberTotal, allAllocs: updatedAllocs };
      });
    }
  }

  // ── shared input style ────────────────────────────────────────────────────
  const dateInpStyle: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 7, padding: "7px 10px", fontSize: 12, color: T.t2,
    outline: "none", fontFamily: "'DM Sans',sans-serif",
    colorScheme: "dark", cursor: "pointer", transition: "border-color 0.15s", flex: 1,
  };

  const hasCalFilter = selDates.size > 0 || selMonth !== null || selYear !== null || !!dateFrom || !!dateTo;
  const canRun = !!selMemberId && (mode === "hourly" || !!selProjId);

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh", background: T.bg, color: T.t2,
      fontFamily: "'DM Sans','Sora',sans-serif",
      padding: isMobile ? "20px 16px 48px" : "32px 32px 56px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        select option { background: #1a1d2e; color: #f1f5f9; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: isMobile ? 18 : 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.greenBg,
            border: `1px solid ${T.green}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
              <circle cx={10} cy={10} r={8} stroke={T.green} strokeWidth={1.4}/>
              <path d="M10 6v1.5m0 5V14m-2.5-5.5h4a1 1 0 0 1 0 2h-3a1 1 0 0 0 0 2H12"
                stroke={T.green} strokeWidth={1.4} strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700,
            fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em", color: T.t1, margin: 0 }}>
            Salary Calculator
          </h1>
        </div>
        <p style={{ color: T.t5, fontSize: 13, margin: 0 }}>
          Select a member, apply date &amp; project filters, then run the analysis
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "268px 1fr",
        gap: isMobile ? 16 : 20, alignItems: "start" }}>

        {/* ════ LEFT: Calendar / date filters ════ */}
        <div style={{ background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, padding: "22px 20px",
          display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>

          <CalGrid year={calYear} month={calMonth}
            activeDates={allDates} selDates={selDates} onToggle={toggleDate} />

          {selDates.size > 0 && (
            <div style={{ textAlign: "center", fontSize: 11, color: T.acText }}>
              {selDates.size} date{selDates.size > 1 ? "s" : ""} selected &nbsp;
              <button onClick={() => setSelDates(new Set())}
                style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
          )}

          <Divider />

          {/* Month pills */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Filter by Month</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setSelMonth(selMonth === i ? null : i)} style={{
                  background: selMonth === i ? T.acLight : T.panel2,
                  border: `1px solid ${selMonth === i ? T.acMid : T.panel2B}`,
                  borderRadius: 6, color: selMonth === i ? T.acText : T.t4,
                  fontSize: 10, padding: "5px 0", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontWeight: selMonth === i ? 600 : 400, transition: "all 0.15s",
                }}>{m.slice(0, 3)}</button>
              ))}
            </div>
          </div>

          {/* Year pills */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Filter by Year</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {availableYears.map(y => (
                <button key={y} onClick={() => setSelYear(selYear === y ? null : y)} style={{
                  background: selYear === y ? T.acLight : T.panel2,
                  border: `1px solid ${selYear === y ? T.acMid : T.panel2B}`,
                  borderRadius: 6, color: selYear === y ? T.acText : T.t4,
                  fontSize: 10, padding: "5px 10px", cursor: "pointer",
                  fontWeight: selYear === y ? 600 : 400, transition: "all 0.15s",
                }}>{y}</button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Date Range</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {([
                { label: "From", value: dateFrom, set: (v: string) => { setDateFrom(v); if (dateTo && v > dateTo) setDateTo(""); } },
                { label: "To",   value: dateTo,   set: (v: string) => setDateTo(v) },
              ] as const).map(({ label, value, set }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10.5, color: T.t5, width: 26, flexShrink: 0 }}>{label}</span>
                  <input type="date" value={value}
                    min={label === "To" && dateFrom ? dateFrom : undefined}
                    onChange={e => set(e.target.value)}
                    style={dateInpStyle}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
                    onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}
                  />
                  {value && (
                    <button onClick={() => set("")} style={{
                      background: "none", border: "none", color: T.t5,
                      cursor: "pointer", fontSize: 12, padding: 0, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
              {dateFrom && dateTo && (
                <div style={{ fontSize: 10.5, color: T.acText, marginLeft: 34 }}>
                  {Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1} days
                </div>
              )}
            </div>
          </div>

          <Divider />

          {/* Period stats */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Period Stats</div>
            {[
              { label: "Sessions",    val: String(calFilteredEntries.length) },
              { label: "Total Hours", val: fmtHours(calTotalMins) },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.t4 }}>{label}</span>
                <span style={{ fontSize: 13, color: T.acText, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Clear filters button */}
          {hasAnyFilter && (
            <>
              <Divider />
              <button onClick={clearAll} style={{
                background: "transparent", border: `1px solid ${T.panel2B}`,
                borderRadius: 8, padding: "8px 0", fontSize: 12, color: T.t4,
                cursor: "pointer", width: "100%", fontFamily: "'DM Sans',sans-serif",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
              >✕ &nbsp;Clear all filters</button>
            </>
          )}
        </div>

        {/* ════ RIGHT: Calculator ════ */}
        <div style={{ background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, padding: "22px 24px",
          display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Mode tabs */}
          <div style={{ display: "flex", background: T.panel2,
            border: `1px solid ${T.panel2B}`, borderRadius: 12, padding: 4, gap: 2 }}>
            <ModeTab active={mode === "hourly"} onClick={() => { setMode("hourly"); setHourlyResult(null); setFeeResult(null); setAnalysisError(""); }}
              icon="⏱" label="Hourly" />
            <ModeTab active={mode === "fee"}    onClick={() => { setMode("fee");    setHourlyResult(null); setFeeResult(null); setAnalysisError(""); }}
              icon="%" label="% of Fee" />
          </div>

          {/* ── Filter fields ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Row 1: Org + Member */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Organisation</FieldLabel>
                <select value={selOrgId}
                  onChange={e => { setSelOrgId(e.target.value); setSelProjId(""); setSelMemberId(""); }}
                  style={selStyle()}>
                  <option value="">All Organisations</option>
                  {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Member</FieldLabel>
                <select value={selMemberId} onChange={e => setSelMemberId(e.target.value)} style={selStyle()}>
                  <option value="">Select member</option>
                  {memOptions.map((m, i) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: Project (optional in hourly, required in fee) */}
            <div style={{ display: "grid",
              gridTemplateColumns: mode === "fee" ? "1fr 1fr" : "1fr", gap: 12 }}>
              <div>
                <FieldLabel required={mode === "fee"}>Project</FieldLabel>
                <select value={selProjId}
                  onChange={e => { setSelProjId(e.target.value); setSelStage("all"); }}
                  style={selStyle()}>
                  <option value="">{mode === "fee" ? "Select project" : "All Projects"}</option>
                  {projOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Stage scope — only in fee mode when project is selected */}
              {mode === "fee" && selProjId && (
                <div>
                  <FieldLabel>Stage scope</FieldLabel>
                  <select value={selStage} onChange={e => setSelStage(e.target.value)} style={selStyle()}>
                    <option value="all">All Stages (total fee)</option>
                    {projStages.map(sf => (
                      <option key={sf.stage} value={sf.stage}>
                        Stage {sf.stage} — {sf.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Mode description */}
            <div style={{ fontSize: 11.5, color: T.t5, lineHeight: 1.6,
              background: T.panel2, borderRadius: 8, padding: "10px 13px" }}>
              {mode === "hourly"
                ? "Calculates salary from hours logged × hourly rate. Filtered by date range and optionally by organisation and project."
                : "Calculates salary as a % of project (or stage) fee. Project is required. Other fund allocations are shown as context."}
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={runAnalysis} disabled={!canRun} style={{
              flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
              background: canRun ? T.ac : T.panel2B,
              color: canRun ? "#fff" : T.t6,
              fontSize: 14, fontWeight: 600,
              cursor: canRun ? "pointer" : "not-allowed",
              fontFamily: "'DM Sans',sans-serif",
              transition: "background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
              onMouseEnter={e => { if (canRun) (e.currentTarget as HTMLElement).style.background = "#4f46e5"; }}
              onMouseLeave={e => { if (canRun) (e.currentTarget as HTMLElement).style.background = T.ac; }}
            >
              <svg width={15} height={15} viewBox="0 0 16 16" fill="none">
                <path d="M3 8a5 5 0 1 0 10 0A5 5 0 0 0 3 8Z" stroke="currentColor" strokeWidth={1.4}/>
                <path d="M6.5 6.5l3 1.5-3 1.5V6.5Z" fill="currentColor"/>
              </svg>
              Run Analysis
            </button>
            {(hourlyResult || feeResult || analysisError) && (
              <button onClick={() => { setHourlyResult(null); setFeeResult(null); setAnalysisError(""); }}
                style={{
                  padding: "12px 18px", borderRadius: 10, border: `1px solid ${T.panel2B}`,
                  background: "transparent", color: T.t4, fontSize: 13,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
              >Clear Result</button>
            )}
          </div>

          {/* ── Error ── */}
          {analysisError && (
            <div style={{ fontSize: 13, color: T.red, background: T.redBg,
              border: `1px solid ${T.red}33`, borderRadius: 10, padding: "11px 14px" }}>
              {analysisError}
            </div>
          )}

          {/* ── Empty state ── */}
          {!hourlyResult && !feeResult && !analysisError && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", minHeight: 240, gap: 12,
              border: `1px dashed ${T.divider}`, borderRadius: 14, color: T.t6 }}>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1}>
                <circle cx={11} cy={11} r={7}/>
                <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                <path d="M11 8v6M8 11h6" strokeLinecap="round"/>
              </svg>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13.5, marginBottom: 4 }}>No analysis run yet</div>
                <div style={{ fontSize: 12, color: T.t6 }}>
                  Select a member{mode === "fee" ? " and project" : ""}, apply any filters, then hit Run Analysis
                </div>
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {hourlyResult && (
            <>
              <Divider />
              <HourlyResultCard result={hourlyResult} onRateChange={updateRate} />
            </>
          )}
          {feeResult && (
            <>
              <Divider />
              <FeeResultCard result={feeResult} onAllocChange={updateAlloc} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}