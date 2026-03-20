// analysis/SalaryCalculator.tsx

import React, { useState } from "react";
import {
  workEntries as ALL_WORK,
  personSpends as ALL_SPENDS,
  personProfiles,
  ALL_PERSONS,
  ALL_PROJECTS,
  filterWorkEntries,
  filterSpends,
  formatINR,
  type AnalysisFilter,
} from "./analysisData";
import { ACCENT, AMBER, BORDER, GREEN, MUTED, RED, SURF, TEXT, TEXT2, MONTHS_FULL, pad } from "./tokens";
import { FieldLabel, MetricCard } from "./Atoms";
import type { CalcMode, CalcResult } from "./types";

// ── Mode button ──────────────────────────────────────────
function CalcModeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, padding: "7px 6px", border: `1.5px solid ${active ? ACCENT : BORDER}`, borderRadius: 8, background: active ? ACCENT : SURF, color: active ? "#fff" : TEXT2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
    >
      {label}
    </button>
  );
}

// ── Result panel ─────────────────────────────────────────
function CalcResultPanel({ r }: { r: CalcResult }) {
  const margin = r.grossEarnings - r.netPayable;
  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>{r.person}</div>
          <div style={{ fontSize: 12, color: TEXT2 }}>{r.role} · {r.contractType} · {r.periodLabel}</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: "#dcfce7", borderRadius: 6, padding: "3px 10px" }}>
          {formatINR(r.hourlyRate)}/h
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        <MetricCard label="Hours worked"   value={`${r.hoursWorked}h`}         color={ACCENT} />
        <MetricCard label="Gross earnings" value={formatINR(r.grossEarnings)}  color={TEXT} />
        <MetricCard label="Net payable"    value={formatINR(r.netPayable)}      color={GREEN} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MetricCard
          label="Spends included"
          value={r.spends > 0 ? formatINR(r.spends) : "None"}
          color={r.spends > 0 ? AMBER : MUTED}
          sub={r.spends > 0 ? `Reimburse ${formatINR(r.reimburseAmt)} · Own ${formatINR(r.ownCostAmt)}` : undefined}
        />
        <MetricCard
          label="Company margin"
          value={formatINR(margin)}
          color={margin >= 0 ? GREEN : RED}
          sub="Gross − net payable"
        />
      </div>

      {r.projectPct !== undefined && (
        <div style={{ background: "#f1f5f9", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Project share · {r.projectName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${r.projectPct}%`, background: ACCENT, borderRadius: 99, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{r.projectPct}%</div>
          </div>
          <div style={{ fontSize: 11, color: TEXT2, marginTop: 4 }}>{r.hoursWorked}h attributed from project total</div>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────
export function SalaryCalculator() {
  const [person,     setPerson]     = useState("");
  const [mode,       setMode]       = useState<CalcMode>("monthly");
  const [month,      setMonth]      = useState(new Date().getMonth());
  const [calcYear,   setCalcYear]   = useState(new Date().getFullYear());
  const [dayDate,    setDayDate]    = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [yearOnly,   setYearOnly]   = useState(new Date().getFullYear());
  const [projectId,  setProjectId]  = useState("");
  const [projectPct, setProjectPct] = useState(40);
  const [inclRe,     setInclRe]     = useState(true);
  const [inclOwn,    setInclOwn]    = useState(true);
  const [result,     setResult]     = useState<CalcResult | null>(null);
  const [error,      setError]      = useState("");

  const selStyle: React.CSSProperties = {
    padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
    background: SURF, fontSize: 13, color: TEXT, fontFamily: "inherit",
    outline: "none", cursor: "pointer", width: "100%",
  };

  function reset() { setResult(null); setError(""); }

  function calculate() {
    setError("");
    if (!person) { setError("Please select a person."); return; }
    const profile = personProfiles.find(p => p.name === person);
    if (!profile) { setError("Profile not found."); return; }

    let filter: AnalysisFilter;
    let periodLabel = "";
    let projName: string | undefined;
    let projPctUsed: number | undefined;

    if (mode === "monthly") {
      filter = { granularity: "month", dateKey: `${calcYear}-${pad(month + 1)}`, fromDate: null, toDate: null, person, projectId: projectId || null, deliverableId: null };
      periodLabel = `${MONTHS_FULL[month]} ${calcYear}`;
    } else if (mode === "daily") {
      filter = { granularity: "day", dateKey: dayDate, fromDate: null, toDate: null, person, projectId: projectId || null, deliverableId: null };
      periodLabel = dayDate;
    } else if (mode === "yearly") {
      filter = { granularity: "year", dateKey: `${yearOnly}`, fromDate: null, toDate: null, person, projectId: projectId || null, deliverableId: null };
      periodLabel = `Year ${yearOnly}`;
    } else {
      filter = { granularity: "year", dateKey: `${yearOnly}`, fromDate: null, toDate: null, person, projectId: projectId || null, deliverableId: null };
      projName    = ALL_PROJECTS.find(p => p.id === projectId)?.name ?? "All projects";
      projPctUsed = projectPct;
      periodLabel = `${projectPct}% of ${projName}`;
    }

    const fWork   = filterWorkEntries(ALL_WORK,  filter);
    const fSpends = filterSpends(ALL_SPENDS, filter);

    let hours = fWork.reduce((s, w) => s + w.hoursWorked, 0);
    if (mode === "project") hours = Math.round(hours * (projectPct / 100));

    const reimburseAmt = inclRe  ? fSpends.filter(s =>  s.reimbursed).reduce((s, e) => s + e.amount, 0) : 0;
    const ownCostAmt   = inclOwn ? fSpends.filter(s => !s.reimbursed).reduce((s, e) => s + e.amount, 0) : 0;

    setResult({
      person,
      periodLabel,
      hoursWorked:   hours,
      hourlyRate:    profile.hourlyRate,
      grossEarnings: hours * profile.hourlyRate,
      spends:        reimburseAmt + ownCostAmt,
      reimburseAmt,
      ownCostAmt,
      netPayable:    hours * profile.hourlyRate + reimburseAmt + ownCostAmt,
      contractType:  profile.contractType,
      role:          profile.role,
      projectPct:    projPctUsed,
      projectName:   projName,
    });
  }

  return (
    <div>
      {/* Person */}
      <FieldLabel>Person</FieldLabel>
      <select
        value={person}
        onChange={e => { setPerson(e.target.value); reset(); }}
        style={{ ...selStyle, border: `1.5px solid ${person ? ACCENT : BORDER}`, marginBottom: 14 }}
      >
        <option value="">— Select person —</option>
        {ALL_PERSONS.map(p => {
          const pr = personProfiles.find(x => x.name === p);
          return <option key={p} value={p}>{p}{pr ? ` · ${formatINR(pr.hourlyRate)}/h` : ""}</option>;
        })}
      </select>

      {/* Mode */}
      <FieldLabel>Period type</FieldLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["monthly", "daily", "yearly", "project"] as CalcMode[]).map(m => (
          <CalcModeBtn
            key={m}
            label={m === "project" ? "% Project" : m[0].toUpperCase() + m.slice(1)}
            active={mode === m}
            onClick={() => { setMode(m); reset(); }}
          />
        ))}
      </div>

      {/* Period-specific inputs */}
      {mode === "monthly" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <FieldLabel>Month</FieldLabel>
            <select value={month} onChange={e => { setMonth(+e.target.value); reset(); }} style={selStyle}>
              {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Year</FieldLabel>
            <select value={calcYear} onChange={e => { setCalcYear(+e.target.value); reset(); }} style={selStyle}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {mode === "daily" && (
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Date</FieldLabel>
          <input type="date" value={dayDate} onChange={e => { setDayDate(e.target.value); reset(); }}
            style={{ ...selStyle, display: "block" }} />
        </div>
      )}

      {mode === "yearly" && (
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Year</FieldLabel>
          <select value={yearOnly} onChange={e => { setYearOnly(+e.target.value); reset(); }} style={selStyle}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {mode === "project" && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <FieldLabel>Project</FieldLabel>
            <select value={projectId} onChange={e => { setProjectId(e.target.value); reset(); }} style={selStyle}>
              <option value="">All projects</option>
              {ALL_PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Their share of project hours</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="range" min={0} max={100} step={1} value={projectPct}
                onChange={e => { setProjectPct(+e.target.value); reset(); }}
                style={{ flex: 1, accentColor: ACCENT }} />
              <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, minWidth: 38, textAlign: "right" }}>{projectPct}%</div>
            </div>
            <div style={{ background: "#e2e8f0", borderRadius: 99, height: 6, overflow: "hidden", marginTop: 4 }}>
              <div style={{ height: "100%", width: `${projectPct}%`, background: ACCENT, borderRadius: 99, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>
      )}

      {/* Spends */}
      <FieldLabel>Include spends</FieldLabel>
      <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: TEXT }}>
          <input type="checkbox" checked={inclRe} onChange={e => { setInclRe(e.target.checked); reset(); }} style={{ width: 15, height: 15, accentColor: ACCENT, cursor: "pointer" }} />
          Reimbursable
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: TEXT }}>
          <input type="checkbox" checked={inclOwn} onChange={e => { setInclOwn(e.target.checked); reset(); }} style={{ width: 15, height: 15, accentColor: ACCENT, cursor: "pointer" }} />
          Own cost
        </label>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: RED, marginBottom: 10, background: "#fef2f2", padding: "8px 12px", borderRadius: 8, border: `1px solid #fecaca` }}>
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={calculate}
        style={{ width: "100%", padding: "11px 0", borderRadius: 9, border: "none", background: ACCENT, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", boxShadow: "0 2px 8px rgba(37,99,235,0.3)", transition: "opacity 0.15s" }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
      >
        ▶ Calculate
      </button>

      {result && <CalcResultPanel r={result} />}
    </div>
  );
}
