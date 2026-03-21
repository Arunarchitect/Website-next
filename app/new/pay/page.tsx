"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  worklogEntries, organisations, projects, members,
  projMap,
  memberRates, projectFees, minutesPerMember,
  type WorklogEntry, type MemberRate, type ProjectFee,
} from "./data";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

function fmtCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
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

const Divider = () => <div style={{ height: 1, background: T.divider }} />;

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#818cf8)",
  "linear-gradient(135deg,#10b981,#34d399)",
  "linear-gradient(135deg,#f59e0b,#fbbf24)",
  "linear-gradient(135deg,#ef4444,#f87171)",
];
function Avatar({ name, size = 32, idx = 0 }: { name: string; size?: number; idx?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700, color: "#fff", letterSpacing: "0.03em",
    }}>{initials}</div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalGrid({ year, month, activeDates, selDates, onToggle }: {
  year: number; month: number;
  activeDates: Set<string>; selDates: Set<string>;
  onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
      {DAYS.map(d => (
        <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.t5, fontWeight: 600,
          letterSpacing: "0.06em", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const has = activeDates.has(iso);
        const sel = selDates.has(iso);
        return (
          <button key={iso} onClick={() => onToggle(iso)} style={{
            background: sel ? T.ac : "transparent",
            border: `1px solid ${sel ? T.ac : "transparent"}`,
            borderRadius: 6, cursor: "pointer",
            color: sel ? "#fff" : has ? T.t2 : T.t4,
            fontSize: 11, padding: "6px 0", textAlign: "center",
            transition: "all 0.15s", width: "100%",
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

// ─── Mode tab button ─────────────────────────────────────────────────────────
function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 0", border: "none", borderRadius: 10,
      background: active ? T.ac : "transparent",
      color: active ? "#fff" : T.t4,
      fontSize: 12.5, fontWeight: active ? 600 : 400,
      cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
      transition: "all 0.18s",
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t2; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t4; }}
    >{children}</button>
  );
}

// ─── Editable number cell ─────────────────────────────────────────────────────
function EditableNum({ value, onChange, prefix = "", suffix = "", min = 0 }: {
  value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; min?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    const n = parseFloat(raw.replace(/,/g, ""));
    if (!isNaN(n) && n >= min) onChange(n);
    else setRaw(String(value));
    setEditing(false);
  }

  if (editing) {
    return (
      <input ref={inputRef} value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setRaw(String(value)); setEditing(false); } }}
        style={{
          width: 90, background: T.panel2, border: `1px solid ${T.acMid}`,
          borderRadius: 6, padding: "3px 7px", fontSize: 12.5, color: T.t1,
          outline: "none", fontFamily: "'DM Sans',sans-serif", textAlign: "right",
        }}
      />
    );
  }
  return (
    <span onClick={() => { setRaw(String(value)); setEditing(true); }}
      title="Click to edit"
      style={{
        fontSize: 12.5, color: T.t1, cursor: "text", padding: "3px 7px",
        borderRadius: 6, border: "1px solid transparent",
        transition: "border-color 0.15s, background 0.15s",
        display: "inline-flex", alignItems: "center", gap: 2,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; (e.currentTarget as HTMLElement).style.background = T.panel2; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {prefix && <span style={{ color: T.t4, fontSize: 11 }}>{prefix}</span>}
      <span style={{ fontWeight: 600 }}>{value.toLocaleString("en-IN")}</span>
      {suffix && <span style={{ color: T.t4, fontSize: 11 }}>{suffix}</span>}
    </span>
  );
}

// ─── Horizontal bar ─────────────────────────────────────────────────────────
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 99,
        background: `linear-gradient(90deg,${color}88,${color})`,
        transition: "width 0.5s cubic-bezier(.16,1,.3,1)",
      }} />
    </div>
  );
}

// ─── Member filter chips (reusable across both panels) ───────────────────────
function MemberFilter({ selected, onChange }: {
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  function toggle(id: string) {
    onChange(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  const allSelected = selected.size === 0;
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
        Members
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {/* All chip */}
        <button
          onClick={() => onChange(new Set())}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 20,
            background: allSelected ? T.acLight : T.panel2,
            border: `1px solid ${allSelected ? T.acMid : T.panel2B}`,
            color: allSelected ? T.acText : T.t4,
            fontSize: 11.5, fontWeight: allSelected ? 600 : 400,
            cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
            transition: "all 0.15s",
          }}>
          All
        </button>
        {members.map((m, i) => {
          const active = selected.has(m.id);
          const grad   = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
          const dotClr = grad.split("#")[1]?.split(",")[0] ? "#" + grad.split("#")[1].split(",")[0] : T.acText;
          return (
            <button key={m.id} onClick={() => toggle(m.id)} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 12px 5px 7px", borderRadius: 20,
              background: active ? T.acLight : T.panel2,
              border: `1px solid ${active ? T.acMid : T.panel2B}`,
              color: active ? T.acText : T.t4,
              fontSize: 11.5, fontWeight: active ? 600 : 400,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.15s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: grad,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 7, fontWeight: 700, color: "#fff",
              }}>
                {m.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
              </div>
              {m.name.split(" ")[0]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hourly Mode ─────────────────────────────────────────────────────────────
function HourlyPanel({
  filteredEntries, rates, onRateChange,
}: {
  filteredEntries: WorklogEntry[];
  rates: MemberRate[];
  onRateChange: (memberId: string, field: "hourlyRate", value: number) => void;
}) {
  const [scopeOrg,     setScopeOrg]     = useState("");
  const [scopeProj,    setScopeProj]    = useState("");
  const [selMembers,   setSelMembers]   = useState<Set<string>>(new Set());

  const scopedEntries = useMemo(() => filteredEntries.filter(e => {
    if (scopeOrg  && e.organisationId !== scopeOrg)  return false;
    if (scopeProj && e.projectId      !== scopeProj) return false;
    return true;
  }), [filteredEntries, scopeOrg, scopeProj]);

  const minsMap = useMemo(() => minutesPerMember(scopedEntries), [scopedEntries]);
  const rateMap = useMemo(() => Object.fromEntries(rates.map(r => [r.memberId, r])), [rates]);

  const rows = useMemo(() => members.map((m, i) => {
    const mins = minsMap[m.id] ?? 0;
    const rate = rateMap[m.id]?.hourlyRate ?? 0;
    const pay  = Math.round((mins / 60) * rate);
    return { m, i, mins, rate, pay };
  }).filter(r => {
    if (selMembers.size > 0 && !selMembers.has(r.m.id)) return false;
    return r.mins > 0 || scopedEntries.length === 0;
  }), [minsMap, rateMap, scopedEntries, selMembers]);

  const totalPay  = rows.reduce((s, r) => s + r.pay, 0);
  const totalMins = rows.reduce((s, r) => s + r.mins, 0);
  const maxPay    = Math.max(...rows.map(r => r.pay), 1);

  const filteredProjs = scopeOrg ? projects.filter(p => p.organisationId === scopeOrg) : projects;

  const sel: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 8, padding: "7px 11px", fontSize: 12, color: T.t2,
    outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
    appearance: "none" as const, flex: 1, minWidth: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Member filter */}
      <MemberFilter selected={selMembers} onChange={setSelMembers} />

      <Divider />

      {/* Scope filters */}
      <div style={{ display: "flex", gap: 10 }}>
        <select value={scopeOrg} onChange={e => { setScopeOrg(e.target.value); setScopeProj(""); }}
          style={sel}>
          <option value="">All Organisations</option>
          {organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={scopeProj} onChange={e => setScopeProj(e.target.value)}
          style={sel}>
          <option value="">All Projects</option>
          {filteredProjs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Total Payout",    val: fmtCurrency(totalPay),   color: T.green },
          { label: "Total Hours",     val: fmtHours(totalMins),      color: T.acText },
          { label: "Sessions",        val: String(scopedEntries.length), color: T.teal },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
            borderRadius: 10, padding: "11px 14px" }}>
            <div style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: "'Sora',sans-serif", marginTop: 3 }}>{val}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Member rows */}
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: T.t6, fontSize: 13 }}>
          No work sessions in the selected period / scope.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(({ m, i, mins, rate, pay }) => (
            <div key={m.id} style={{
              background: T.panel2, border: `1px solid ${T.panel2B}`,
              borderRadius: 12, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={m.name} size={34} idx={i} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: T.t5 }}>{m.role}</div>
                </div>
                {/* Payout */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.green,
                    fontFamily: "'Sora',sans-serif" }}>{fmtCurrency(pay)}</div>
                  <div style={{ fontSize: 10.5, color: T.t5, marginTop: 1 }}>{fmtHours(mins)}</div>
                </div>
              </div>

              {/* Bar */}
              <Bar pct={(pay / maxPay) * 100} color={T.green} />

              {/* Rate editor */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 11.5, color: T.t4 }}>
                <span>Rate / hour</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: T.t5 }}>₹</span>
                  <EditableNum value={rate}
                    onChange={v => onRateChange(m.id, "hourlyRate", v)}
                    min={0} />
                  <span style={{ fontSize: 10.5, color: T.t5 }}>/ hr</span>
                </div>
              </div>

              {/* Breakdown chips */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {scopedEntries.filter(e => e.memberId === m.id).reduce((acc, e) => {
                  const pKey = e.projectId;
                  const existing = acc.find(a => a.projectId === pKey);
                  const [sh, sm] = e.startTime.split(":").map(Number);
                  const [eh, em] = e.endTime.split(":").map(Number);
                  const mins = eh * 60 + em - (sh * 60 + sm);
                  if (existing) existing.mins += mins;
                  else acc.push({ projectId: pKey, mins });
                  return acc;
                }, [] as { projectId: string; mins: number }[]).map(({ projectId, mins }) => {
                  const proj = projMap[projectId];
                  return (
                    <span key={projectId} style={{
                      fontSize: 10.5, padding: "2px 9px", borderRadius: 20, fontWeight: 500,
                      background: `${proj?.color ?? T.t6}1a`,
                      color: proj?.color ?? T.t4,
                      border: `1px solid ${proj?.color ?? T.t6}33`,
                    }}>
                      {proj?.name ?? projectId} · {fmtHours(mins)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Percentage-of-Fee Mode ───────────────────────────────────────────────────
function FeePanel({
  rates, fees, onRateChange, onFeeChange,
}: {
  rates: MemberRate[];
  fees: ProjectFee[];
  onRateChange: (memberId: string, field: "feePercentage", value: number) => void;
  onFeeChange:  (projectId: string, value: number) => void;
}) {
  const [selProj,    setSelProj]    = useState(projects[0]?.id ?? "");
  const [selMembers, setSelMembers] = useState<Set<string>>(new Set());

  const fee     = fees.find(f => f.projectId === selProj)?.totalFee ?? 0;
  const proj    = projMap[selProj];
  const rateMap = Object.fromEntries(rates.map(r => [r.memberId, r]));

  const totalPct = rates.reduce((s, r) => s + r.feePercentage, 0);

  const allRows = members.map((m, i) => {
    const pct = rateMap[m.id]?.feePercentage ?? 0;
    const pay = Math.round(fee * pct / 100);
    return { m, i, pct, pay };
  });

  const rows = allRows.filter(r => selMembers.size === 0 || selMembers.has(r.m.id));

  const totalPay = rows.reduce((s, r) => s + r.pay, 0);
  const maxPay   = Math.max(...rows.map(r => r.pay), 1);

  const pctWarning = Math.abs(totalPct - 100) > 0.01;

  const sel: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 8, padding: "7px 11px", fontSize: 12, color: T.t2,
    outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
    appearance: "none" as const, flex: 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Member filter */}
      <MemberFilter selected={selMembers} onChange={setSelMembers} />

      <Divider />

      {/* Project selector */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <select value={selProj} onChange={e => setSelProj(e.target.value)} style={sel}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {proj && (
          <span style={{ width: 10, height: 10, borderRadius: "50%",
            background: proj.color, flexShrink: 0 }} />
        )}
      </div>

      {/* Fee editor */}
      <div style={{
        background: T.acLight, border: `1px solid ${T.acMid}33`,
        borderRadius: 12, padding: "14px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10.5, color: T.acText, fontWeight: 600,
            letterSpacing: "0.07em", textTransform: "uppercase" }}>Project Fee</div>
          <div style={{ fontSize: 11, color: T.t5, marginTop: 2 }}>
            Total agreed fee for {proj?.name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: T.acText, fontWeight: 700 }}>₹</span>
          <EditableNum value={fee}
            onChange={v => onFeeChange(selProj, v)}
            min={0} />
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Total Payout",   val: fmtCurrency(totalPay), color: T.green  },
          { label: "Total %",        val: `${totalPct.toFixed(1)}%`,
            color: pctWarning ? T.amber : T.green },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
            borderRadius: 10, padding: "11px 14px" }}>
            <div style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: "'Sora',sans-serif", marginTop: 3 }}>{val}</div>
          </div>
        ))}
      </div>

      {pctWarning && (
        <div style={{ fontSize: 11.5, color: T.amber, background: T.amberBg,
          border: `1px solid ${T.amber}33`, borderRadius: 8, padding: "8px 12px" }}>
          ⚠ Percentages sum to {totalPct.toFixed(1)}% — adjust to reach 100%.
        </div>
      )}

      <Divider />

      {/* Member rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ m, i, pct, pay }) => (
          <div key={m.id} style={{
            background: T.panel2, border: `1px solid ${T.panel2B}`,
            borderRadius: 12, padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={m.name} size={34} idx={i} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: T.t5 }}>{m.role}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.green,
                  fontFamily: "'Sora',sans-serif" }}>{fmtCurrency(pay)}</div>
                <div style={{ fontSize: 10.5, color: T.t5, marginTop: 1 }}>{pct}% of fee</div>
              </div>
            </div>

            <Bar pct={(pay / maxPay) * 100} color={AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length].split(",")[1]?.trim().replace(")", "") ?? T.green} />

            {/* % editor */}
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", fontSize: 11.5, color: T.t4 }}>
              <span>Share of fee</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <EditableNum value={pct}
                  onChange={v => onRateChange(m.id, "feePercentage", Math.min(100, v))}
                  suffix="%" min={0} />
                <span style={{ fontSize: 11, color: T.t5 }}>%</span>
              </div>
            </div>
          </div>
        ))}
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
  const cw  = useContainerWidth(containerRef);
  const isMobile = cw < 760;

  // ── Calendar state ─────────────────────────────────────────────────────────
  const [calYear,   setCalYear]   = useState(2025);
  const [calMonth,  setCalMonth]  = useState(2);
  const [selDates,  setSelDates]  = useState<Set<string>>(new Set());
  const [selMonth,  setSelMonth]  = useState<number | null>(null);
  const [selYear,   setSelYear]   = useState<number | null>(null);
  // Date range (from/to) — YYYY-MM-DD strings, empty = no bound
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");

  // ── Editable rates + fees (local state, seeded from data.ts) ───────────────
  const [rates, setRates] = useState<MemberRate[]>(memberRates.map(r => ({ ...r })));
  const [fees,  setFees]  = useState<ProjectFee[]>(projectFees.map(f => ({ ...f })));

  // ── Calc mode ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<CalcMode>("hourly");

  // ── All log dates (for calendar dots) ─────────────────────────────────────
  const allDates = useMemo(() => new Set(worklogEntries.map(e => e.date)), []);
  const availableYears = useMemo(() =>
    Array.from(new Set(worklogEntries.map(e => new Date(e.date).getFullYear()))).sort(), []);

  // ── Filtered entries based on calendar + date-range selections ───────────
  const filteredEntries = useMemo(() => worklogEntries.filter(e => {
    const d = new Date(e.date);
    if (selDates.size > 0 && !selDates.has(e.date)) return false;
    if (selMonth !== null && d.getMonth()    !== selMonth) return false;
    if (selYear  !== null && d.getFullYear() !== selYear)  return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo   && e.date > dateTo)   return false;
    return true;
  }), [selDates, selMonth, selYear, dateFrom, dateTo]);

  // ── Rate / fee mutators ────────────────────────────────────────────────────
  function updateRate(memberId: string, field: "hourlyRate" | "feePercentage", value: number) {
    setRates(prev => prev.map(r => r.memberId === memberId ? { ...r, [field]: value } : r));
  }
  function updateFee(projectId: string, value: number) {
    setFees(prev => prev.map(f => f.projectId === projectId ? { ...f, totalFee: value } : f));
  }

  // ── Calendar helpers ───────────────────────────────────────────────────────
  function toggleDate(iso: string) {
    setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }
  function clearCalendar() { setSelDates(new Set()); setSelMonth(null); setSelYear(null); setDateFrom(""); setDateTo(""); }
  function prevMonth() { calMonth === 0  ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }
  function nextMonth() { calMonth === 11 ? (setCalMonth(0),  setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }

  const hasCalFilter = selDates.size > 0 || selMonth !== null || selYear !== null || !!dateFrom || !!dateTo;

  // ── Session count for stat ─────────────────────────────────────────────────
  const totalMins = useMemo(() => filteredEntries.reduce((s, e) => {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    return s + (eh * 60 + em - (sh * 60 + sm));
  }, 0), [filteredEntries]);

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
        select option { background: #1a1d2e; color: #f1f5f9; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: isMobile ? 18 : 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10,
            background: T.greenBg, border: `1px solid ${T.green}33`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          Compute payouts by hourly rate or as a percentage of project fees
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
        gap: isMobile ? 16 : 20, alignItems: "start",
      }}>

        {/* ════ LEFT: Calendar + filters ════ */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 20px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={prevMonth} style={{
              width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{
              width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
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
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Filter by Month
            </div>
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
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Filter by Year
            </div>
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
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Date Range
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "From", value: dateFrom, onChange: (v: string) => { setDateFrom(v); if (dateTo && v > dateTo) setDateTo(""); } },
                { label: "To",   value: dateTo,   onChange: (v: string) => setDateTo(v) },
              ].map(({ label, value, onChange }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10.5, color: T.t5, width: 26, flexShrink: 0 }}>{label}</span>
                  <input
                    type="date" value={value}
                    min={label === "To" && dateFrom ? dateFrom : undefined}
                    onChange={e => onChange(e.target.value)}
                    style={{
                      flex: 1, background: T.panel2, border: `1px solid ${T.panel2B}`,
                      borderRadius: 7, padding: "6px 9px", fontSize: 11.5, color: value ? T.t2 : T.t5,
                      outline: "none", fontFamily: "'DM Sans',sans-serif", colorScheme: "dark",
                      cursor: "pointer", transition: "border-color 0.15s",
                    }}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
                    onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}
                  />
                  {value && (
                    <button onClick={() => onChange("")} style={{
                      background: "none", border: "none", color: T.t5, cursor: "pointer",
                      fontSize: 12, padding: "0 2px", flexShrink: 0, lineHeight: 1,
                    }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {dateFrom && dateTo && (
              <div style={{ fontSize: 10.5, color: T.acText, marginTop: 6 }}>
                {Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1} days selected
              </div>
            )}
          </div>

          <Divider />

          {/* Period stats */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
              Period Stats
            </div>
            {[
              { label: "Sessions",     val: String(filteredEntries.length) },
              { label: "Total Hours",  val: fmtHours(totalMins) },
              { label: "Members active", val: String(new Set(filteredEntries.map(e => e.memberId)).size) },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.t4 }}>{label}</span>
                <span style={{ fontSize: 13, color: T.acText, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          {hasCalFilter && (
            <>
              <Divider />
              <button onClick={clearCalendar} style={{
                background: "transparent", border: `1px solid ${T.panel2B}`,
                borderRadius: 8, padding: "7px 0", fontSize: 12, color: T.t4,
                cursor: "pointer", width: "100%", fontFamily: "'DM Sans',sans-serif",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
              >✕ &nbsp;Clear date filters</button>
            </>
          )}
        </div>

        {/* ════ RIGHT: Calculator ════ */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 24px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>

          {/* Mode tabs */}
          <div style={{
            display: "flex", background: T.panel2,
            border: `1px solid ${T.panel2B}`, borderRadius: 12, padding: 4, gap: 2,
          }}>
            <ModeTab active={mode === "hourly"} onClick={() => setMode("hourly")}>
              ⏱ Hourly
            </ModeTab>
            <ModeTab active={mode === "fee"} onClick={() => setMode("fee")}>
              % of Fee
            </ModeTab>
          </div>

          {/* Mode description */}
          <div style={{ fontSize: 12, color: T.t5, lineHeight: 1.6 }}>
            {mode === "hourly" && "Payout = hours logged in selected period × member's hourly rate. Rates are editable below."}
            {mode === "fee"    && "Payout = total project fee × member's share percentage. Edit the fee and each member's percentage below."}
          </div>

          <Divider />

          {/* Panel content */}
          {mode === "hourly" && (
            <HourlyPanel
              filteredEntries={filteredEntries}
              rates={rates}
              onRateChange={updateRate}
            />
          )}
          {mode === "fee" && (
            <FeePanel
              rates={rates}
              fees={fees}
              onRateChange={updateRate}
              onFeeChange={updateFee}
            />
          )}
        </div>
      </div>
    </div>
  );
}