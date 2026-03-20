"use client";

/**
 * analysis/page.tsx
 *
 * Orchestration only — all UI lives in sub-components.
 *
 * DATE RANGE FIX:
 *   When both fromDate + toDate are set (and fromDate <= toDate), the filter
 *   uses granularity="day" with fromDate/toDate populated. The dateKey is
 *   ignored by filterWorkEntries when a range is present. Granularity chips
 *   and the calendar single-day selection are disabled while a range is active.
 *
 * Swapping to a real backend:
 *   Replace every simulateFetch(data, ms) with:
 *   const res = await fetch(`/api/analysis/${endpoint}?${params}`);
 *   const data = await res.json();
 */

import { useState, useCallback, useRef } from "react";
import {
  workEntries    as ALL_WORK,
  revenueEntries as ALL_REV,
  personSpends   as ALL_SPENDS,
  filterWorkEntries,
  filterRevenue,
  filterSpends,
  computeEarnings,
  hoursPerPerson,
  hoursPerProject,
  hoursPerDeliverable,
  hoursPerDay,
  formatINR,
  type AnalysisFilter,
  type WorkEntry,
  type PersonSpend,
} from "./analysisData";

import { ACCENT, BG, BORDER, MUTED, MONTH_NAMES, PAGE_SIZE, SURF, TEXT, TEXT2, pad, simulateFetch } from "./tokens";
import { LeftPanel }    from "./LeftPanel";
import { Stat }         from "./Atoms";
import { Chip }         from "./Atoms";
import { SectionCard }  from "./Atoms";
import { SalaryCalculator } from "./SalaryCalculator";
import { ChartsPanel, WorkEntriesPanel, SpendsPanel, RevenuePanel } from "./SectionPanels";
import { StatSkeleton, RowSkeleton } from "./Skeletons";
import type { SectionState, SummaryData, ChartsData, Granularity } from "./types";

// ─────────────────────────────────────────────────────────
// Filter builder
// ─────────────────────────────────────────────────────────
function makeFilter(
  gran: Granularity,
  dateKey: string,
  fromDate: string | null,
  toDate: string | null,
): AnalysisFilter {
  // When a valid range is set, pass it through and let analysisData handle it.
  // granularity is set to "day" so the data layer knows to use date comparison.
  const hasRange = !!(fromDate && toDate && fromDate <= toDate);
  return {
    granularity:   hasRange ? "day" : gran,
    dateKey:       hasRange ? fromDate! : dateKey,
    fromDate:      hasRange ? fromDate  : null,
    toDate:        hasRange ? toDate    : null,
    person:        null,
    projectId:     null,
    deliverableId: null,
  };
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
export default function AnalysisPage() {

  // ── Calendar / granularity ──────────────────────────────
  const [calYear,  setCalYear]  = useState(2025);
  const [calMonth, setCalMonth] = useState(2); // March 2025
  const [selDay,   setSelDay]   = useState<string | null>(null);
  const [gran,     setGran]     = useState<Granularity>("month");

  // ── Date range ──────────────────────────────────────────
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  // A range is "active" only when both ends are set AND from <= to
  const rangeActive = !!(fromDate && toDate && fromDate <= toDate);
  const rangeInvalid = !!(fromDate && toDate && fromDate > toDate);

  // Computed dateKey (ignored when range is active)
  const dateKey = (() => {
    if (gran === "day")   return selDay ?? `${calYear}-${pad(calMonth + 1)}-01`;
    if (gran === "month") return `${calYear}-${pad(calMonth + 1)}`;
    return `${calYear}`;
  })();

  // Human-readable period label shown in the heading
  const periodLabel = rangeActive
    ? `${fromDate} → ${toDate}`
    : gran === "day"   ? (selDay ?? dateKey)
    : gran === "month" ? `${MONTH_NAMES[calMonth]} ${calYear}`
    : `${calYear}`;

  // ── Section states ──────────────────────────────────────
  const filterRef = useRef<AnalysisFilter | null>(null);

  const [sumState,    setSumState]    = useState<SectionState>("idle");
  const [summary,     setSummary]     = useState<SummaryData | null>(null);

  const [chartState,  setChartState]  = useState<SectionState>("idle");
  const [charts,      setCharts]      = useState<ChartsData | null>(null);

  const [rowState,    setRowState]    = useState<SectionState>("idle");
  const [workRows,    setWorkRows]    = useState<WorkEntry[]>([]);
  const [rowTotal,    setRowTotal]    = useState(0);
  const [rowPage,     setRowPage]     = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [spendState,  setSpendState]  = useState<SectionState>("idle");
  const [spendRows,   setSpendRows]   = useState<PersonSpend[]>([]);

  const [revState,    setRevState]    = useState<SectionState>("idle");
  const [revRows,     setRevRows]     = useState<ReturnType<typeof filterRevenue>>([]);

  // ── Reset all sections ──────────────────────────────────
  const resetSections = useCallback(() => {
    setSumState("idle");    setSummary(null);
    setChartState("idle");  setCharts(null);
    setRowState("idle");    setWorkRows([]); setRowTotal(0); setRowPage(1);
    setSpendState("idle");  setSpendRows([]);
    setRevState("idle");    setRevRows([]);
  }, []);

  // ── Section loaders ─────────────────────────────────────
  const loadSummary = useCallback(async () => {
    if (!filterRef.current) return;
    setSumState("loading");
    const f       = filterRef.current;
    const fWork   = filterWorkEntries(ALL_WORK,  f);
    const fSpends = filterSpends(ALL_SPENDS, f);
    const earnings = computeEarnings(fWork, fSpends);
    const data: SummaryData = {
      totalHours:    fWork.reduce((s, w) => s + w.hoursWorked, 0),
      totalRevenue:  filterRevenue(ALL_REV, f).reduce((s, r) => s + r.amount, 0),
      totalSpend:    fSpends.reduce((s, e) => s + e.amount, 0),
      totalProjects: new Set(fWork.map(w => w.projectName)).size,
      reimburse:     fSpends.filter(s => s.reimbursed).reduce((s, e) => s + e.amount, 0),
      totalPayable:  earnings.reduce((s, e) => s + e.netPayable, 0),
      teamActive:    new Set(fWork.map(w => w.person)).size,
      earnings,
    };
    await simulateFetch(null, 280); // ← replace with real fetch
    setSummary(data);
    setSumState("loaded");
  }, []);

  const loadCharts = useCallback(async () => {
    if (!filterRef.current) return;
    setChartState("loading");
    const fWork = filterWorkEntries(ALL_WORK, filterRef.current);
    const data: ChartsData = {
      byPerson:      hoursPerPerson(fWork),
      byProject:     hoursPerProject(fWork),
      byDeliverable: hoursPerDeliverable(fWork),
      byDay:         hoursPerDay(fWork),
    };
    await simulateFetch(null, 500);
    setCharts(data);
    setChartState("loaded");
  }, []);

  const loadRows = useCallback(async (page: number) => {
    if (!filterRef.current) return;
    if (page === 1) setRowState("loading"); else setLoadingMore(true);
    const fWork = filterWorkEntries(ALL_WORK, filterRef.current);
    const slice = fWork.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    await simulateFetch(null, 350);
    setWorkRows(prev => page === 1 ? slice : [...prev, ...slice]);
    setRowTotal(fWork.length);
    setRowPage(page);
    if (page === 1) setRowState("loaded"); else setLoadingMore(false);
  }, []);

  const loadSpends = useCallback(async () => {
    if (!filterRef.current) return;
    setSpendState("loading");
    const data = filterSpends(ALL_SPENDS, filterRef.current);
    await simulateFetch(null, 300);
    setSpendRows(data);
    setSpendState("loaded");
  }, []);

  const loadRevenue = useCallback(async () => {
    if (!filterRef.current) return;
    setRevState("loading");
    const data = filterRevenue(ALL_REV, filterRef.current);
    await simulateFetch(null, 250);
    setRevRows(data);
    setRevState("loaded");
  }, []);

  // ── Run Analysis ────────────────────────────────────────
  const runAnalysis = useCallback(() => {
    if (rangeInvalid) return; // guard: don't run with bad range
    filterRef.current = makeFilter(
      gran, dateKey,
      fromDate || null,
      toDate   || null,
    );
    resetSections();
    setTimeout(() => loadSummary(), 0);
  }, [gran, dateKey, fromDate, toDate, rangeInvalid, resetSections, loadSummary]);

  // ── Helpers for LeftPanel callbacks ────────────────────
  function handleSelectDay(d: string) {
    setSelDay(d);
    setGran("day");
    setFromDate("");
    setToDate("");
  }

  function handleMonthChange(y: number, m: number) {
    setCalYear(y);
    setCalMonth(m);
  }

  function handleYearChange(y: number) {
    setCalYear(y);
  }

  function handleFromDate(v: string) {
    setFromDate(v);
    // If user clears "from", also clear "to" to avoid stale half-range
    if (!v) setToDate("");
  }

  function handleToDate(v: string) {
    setToDate(v);
  }

  function handleClearRange() {
    setFromDate("");
    setToDate("");
  }

  // ── Derived display flags ───────────────────────────────
  const anyLoaded  = sumState === "loaded" || chartState === "loaded" || rowState === "loaded" || spendState === "loaded" || revState === "loaded";
  const nothingRun = !filterRef.current && sumState === "idle";

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'DM Sans','Helvetica Neue',Arial,sans-serif", color: TEXT }}>

        {/* ── Top bar ── */}
        <div style={{ background: SURF, borderBottom: `1px solid ${BORDER}`, padding: "13px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em" }}>Analysis</h1>
            <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Select a period · run</div>
          </div>
          {/* Granularity chips — disabled when date range is active */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["day", "month", "year"] as Granularity[]).map(g => (
              <Chip
                key={g}
                label={g[0].toUpperCase() + g.slice(1)}
                active={!rangeActive && gran === g}
                onClick={() => {
                  if (rangeActive) return; // ignore while range is active
                  setGran(g);
                  if (g !== "day") setSelDay(null);
                }}
              />
            ))}
            {rangeActive && (
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, padding: "5px 12px", borderRadius: 99, background: "#eff6ff", border: `1.5px solid ${ACCENT}` }}>
                Custom range
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", maxWidth: 1300, margin: "0 auto", padding: "20px 24px", gap: 0 }}>

          {/* ══ LEFT panel ══ */}
          <LeftPanel
            calYear={calYear}
            calMonth={calMonth}
            gran={gran}
            selDay={selDay}
            fromDate={fromDate}
            toDate={toDate}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
            onSelectDay={handleSelectDay}
            onFromDate={handleFromDate}
            onToDate={handleToDate}
            onClearRange={handleClearRange}
          />

          {/* ══ RIGHT: results ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

            {/* Period heading + Run button */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em" }}>{periodLabel}</div>
              <button
                onClick={runAnalysis}
                disabled={rangeInvalid}
                style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: rangeInvalid ? MUTED : ACCENT, color: "#fff", fontSize: 14, fontWeight: 800, cursor: rangeInvalid ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", boxShadow: rangeInvalid ? "none" : "0 2px 8px rgba(37,99,235,0.35)", transition: "opacity 0.15s" }}
                onMouseEnter={e => { if (!rangeInvalid) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
              >
                ▶ Run Analysis
              </button>
            </div>

            {/* Range invalid warning */}
            {rangeInvalid && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                ⚠ Invalid date range — "From" date must be before "To" date.
              </div>
            )}

            {/* Nothing run yet */}
            {nothingRun && (
              <div style={{ background: SURF, border: `1.5px dashed ${BORDER}`, borderRadius: 14, padding: "48px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT2 }}>
                  Select a period and click <span style={{ color: ACCENT }}>Run Analysis</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Only the data you request will be loaded</div>
              </div>
            )}

            {/* ── Summary stat cards ── */}
            {sumState !== "idle" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {sumState === "loading"
                  ? <>{[0, 1, 2, 3].map(i => <StatSkeleton key={i} />)}</>
                  : summary
                    ? <>
                        <Stat label="Total Hours"    value={`${summary.totalHours}h`}          color={ACCENT} />
                        <Stat label="Projects"       value={`${summary.totalProjects}`}         color={TEXT} />
                        <Stat label="Total Spends"   value={formatINR(summary.totalSpend)}      color="#d97706" />
                        <Stat label="Total Revenue"  value={formatINR(summary.totalRevenue)}    color="#16a34a" />
                      </>
                    : null
                }
              </div>
            )}

            {/* ── Salary Calculator ── */}
            {sumState === "loaded" && summary && (
              <SectionCard title="Salary & Earnings" badge={`Net payable ${formatINR(summary.totalPayable)}`} loaded>
                <SalaryCalculator />
              </SectionCard>
            )}
            {sumState === "loading" && (
              <SectionCard title="Salary & Earnings" loaded>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[0, 1, 2, 3].map(i => <RowSkeleton key={i} />)}
                </div>
              </SectionCard>
            )}

            {/* ── Charts ── */}
            {(anyLoaded || chartState !== "idle") && (
              <ChartsPanel
                state={chartState}
                charts={charts}
                gran={rangeActive ? "day" : gran}
                onLoad={loadCharts}
              />
            )}

            {/* ── Work Entries ── */}
            {(anyLoaded || rowState !== "idle") && (
              <WorkEntriesPanel
                state={rowState}
                rows={workRows}
                total={rowTotal}
                page={rowPage}
                loadingMore={loadingMore}
                onLoad={() => loadRows(1)}
                onLoadMore={() => loadRows(rowPage + 1)}
              />
            )}

            {/* ── Person Spends ── */}
            {(anyLoaded || spendState !== "idle") && (
              <SpendsPanel
                state={spendState}
                rows={spendRows}
                onLoad={loadSpends}
              />
            )}

            {/* ── Revenue ── */}
            {(anyLoaded || revState !== "idle") && (
              <RevenuePanel
                state={revState}
                rows={revRows}
                totalRevenue={summary?.totalRevenue ?? 0}
                onLoad={loadRevenue}
              />
            )}

          </div>
        </div>
      </div>
    </>
  );
}