// "use client";

// // salary.tsx — main page
// // Owns the left calendar/date-filter panel and shared filter state.
// // Mounts SalaryCalculator (right panel, top) and SalaryExpenses (below, full-width).

// import { useState, useMemo, useRef, useEffect } from "react";
// import { worklogEntries } from "./data";
// import { T, fmtHours } from "./salary-shared";
// import SalaryCalculator from "./salary-calculator";
// import SalaryExpenses   from "./salary-expenses";
// import {
//   memberRates, projectFees, stageFees, fundAllocations,
//   type MemberRate, type ProjectFee, type StageFee, type FundAllocation,
// } from "@/app/new/data";

// // ─── Constants ────────────────────────────────────────────────────────────────
// const MONTHS = ["January","February","March","April","May","June",
//                 "July","August","September","October","November","December"];
// const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
// function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// function useContainerWidth(ref: React.RefObject<HTMLElement>) {
//   const [w, setW] = useState(9999);
//   useEffect(() => {
//     if (!ref.current) return;
//     const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
//     ro.observe(ref.current);
//     setW(ref.current.getBoundingClientRect().width);
//     return () => ro.disconnect();
//   }, [ref]);
//   return w;
// }

// // ─── Calendar grid ────────────────────────────────────────────────────────────
// function CalGrid({ year, month, activeDates, selDates, onToggle }: {
//   year: number; month: number;
//   activeDates: Set<string>; selDates: Set<string>;
//   onToggle: (d: string) => void;
// }) {
//   const total = getDaysInMonth(year, month);
//   const first = getFirstDay(year, month);
//   const cells: (number | null)[] = [
//     ...Array(first).fill(null),
//     ...Array.from({ length: total }, (_, i) => i + 1),
//   ];
//   return (
//     <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
//       {DAYS.map(d => (
//         <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.t5, fontWeight: 600,
//           letterSpacing: "0.06em", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>
//       ))}
//       {cells.map((day, i) => {
//         if (!day) return <div key={`_${i}`} />;
//         const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
//         const has = activeDates.has(iso), sel = selDates.has(iso);
//         return (
//           <button key={iso} onClick={() => onToggle(iso)} style={{
//             background: sel ? T.ac : "transparent",
//             border: `1px solid ${sel ? T.ac : "transparent"}`,
//             borderRadius: 6, cursor: "pointer",
//             color: sel ? "#fff" : has ? T.t2 : T.t4,
//             fontSize: 11, padding: "6px 0", transition: "all 0.15s", width: "100%",
//             fontFamily: "'DM Sans',sans-serif", fontWeight: sel ? 600 : 400,
//             display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
//           }}
//             onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = T.panel2; }}
//             onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
//           >
//             {day}
//             {has && <span style={{ display: "block", width: 3, height: 3, borderRadius: "50%",
//               background: sel ? "#fff" : T.acText }} />}
//           </button>
//         );
//       })}
//     </div>
//   );
// }

// // ─── Page ─────────────────────────────────────────────────────────────────────
// export default function SalaryPage() {
//   const containerRef = useRef<HTMLDivElement>(null!);
//   const cw       = useContainerWidth(containerRef);
//   const isMobile = cw < 760;

//   // ── Calendar / date-range state ────────────────────────────────────────────
//   const [calYear,  setCalYear]  = useState(2025);
//   const [calMonth, setCalMonth] = useState(2);
//   const [selDates, setSelDates] = useState<Set<string>>(new Set());
//   const [selMonth, setSelMonth] = useState<number | null>(null);
//   const [selYear,  setSelYear]  = useState<number | null>(null);
//   const [dateFrom, setDateFrom] = useState("");
//   const [dateTo,   setDateTo]   = useState("");

//   // ── Editable salary data (owned here, passed to child panels) ─────────────
//   const [rates,  setRates]  = useState<MemberRate[]>(() => memberRates.map(r => ({ ...r })));
//   const [fees,   setFees]   = useState<ProjectFee[]>(() => projectFees.map(f => ({ ...f })));
//   const [stages, setStages] = useState<StageFee[]>(() => stageFees.map(s => ({ ...s })));
//   const [allocs, setAllocs] = useState<FundAllocation[]>(() => fundAllocations.map(a => ({ ...a })));

//   function updateRate(memberId: string, rate: number) {
//     setRates(prev => prev.map(r => r.memberId === memberId ? { ...r, hourlyRate: rate } : r));
//   }
//   function updateAlloc(id: string, pct: number) {
//     setAllocs(prev => prev.map(a => a.id === id ? { ...a, percentage: pct } : a));
//   }

//   // ── Active filters — set when Run Analysis fires in the calculator ─────────
//   // These are passed down to SalaryExpenses to pre-populate its filter dropdowns.
//   const [analysisRan,    setAnalysisRan]    = useState(false);
//   const [activeFilters,  setActiveFilters]  = useState({ memberId: "", orgId: "", projId: "" });

//   function handleAnalysisRun(filters: { memberId: string; orgId: string; projId: string }) {
//     setActiveFilters(filters);
//     setAnalysisRan(true);
//   }

//   // ── Calendar derived ───────────────────────────────────────────────────────
//   const allDates = useMemo(() => new Set(worklogEntries.map(e => e.date)), []);
//   const availableYears = useMemo(() =>
//     Array.from(new Set(worklogEntries.map(e => new Date(e.date).getFullYear()))).sort(), []);

//   // All entries filtered by the calendar/date controls.
//   // Member/project filters are applied inside SalaryCalculator at run-time.
//   const calFilteredEntries = useMemo(() => worklogEntries.filter(e => {
//     const d = new Date(e.date);
//     if (selDates.size > 0 && !selDates.has(e.date))       return false;
//     if (selMonth !== null && d.getMonth()    !== selMonth) return false;
//     if (selYear  !== null && d.getFullYear() !== selYear)  return false;
//     if (dateFrom && e.date < dateFrom)                     return false;
//     if (dateTo   && e.date > dateTo)                       return false;
//     return true;
//   }), [selDates, selMonth, selYear, dateFrom, dateTo]);

//   const calTotalMins = useMemo(() => calFilteredEntries.reduce((s, e) => {
//     const [sh, sm] = e.startTime.split(":").map(Number);
//     const [eh, em] = e.endTime.split(":").map(Number);
//     return s + (eh * 60 + em - (sh * 60 + sm));
//   }, 0), [calFilteredEntries]);

//   function toggleDate(iso: string) {
//     setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
//   }
//   function prevMonth() { calMonth === 0  ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }
//   function nextMonth() { calMonth === 11 ? (setCalMonth(0),  setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }
//   function clearAll()  {
//     setSelDates(new Set()); setSelMonth(null); setSelYear(null);
//     setDateFrom(""); setDateTo("");
//   }

//   const hasCalFilter = selDates.size > 0 || selMonth !== null || selYear !== null || !!dateFrom || !!dateTo;

//   const dateInpStyle: React.CSSProperties = {
//     background: T.panel2, border: `1px solid ${T.panel2B}`,
//     borderRadius: 7, padding: "7px 10px", fontSize: 12, color: T.t2,
//     outline: "none", fontFamily: "'DM Sans',sans-serif",
//     colorScheme: "dark", cursor: "pointer", transition: "border-color 0.15s", flex: 1,
//   };

//   return (
//     <div ref={containerRef} style={{
//       minHeight: "100vh", background: T.bg, color: T.t2,
//       fontFamily: "'DM Sans','Sora',sans-serif",
//       padding: isMobile ? "20px 16px 48px" : "32px 32px 56px",
//     }}>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
//         * { box-sizing: border-box; }
//         ::-webkit-scrollbar { width: 4px; height: 4px; }
//         ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
//         input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
//         select option { background: #1a1d2e; color: #f1f5f9; }
//       `}</style>

//       {/* ── Page header ── */}
//       <div style={{ marginBottom: isMobile ? 18 : 26 }}>
//         <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
//           <div style={{ width: 34, height: 34, borderRadius: 10, background: T.greenBg,
//             border: `1px solid ${T.green}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
//             <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
//               <circle cx={10} cy={10} r={8} stroke={T.green} strokeWidth={1.4}/>
//               <path d="M10 6v1.5m0 5V14m-2.5-5.5h4a1 1 0 0 1 0 2h-3a1 1 0 0 0 0 2H12"
//                 stroke={T.green} strokeWidth={1.4} strokeLinecap="round"/>
//             </svg>
//           </div>
//           <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700,
//             fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em", color: T.t1, margin: 0 }}>
//             Salary Calculator
//           </h1>
//         </div>
//         <p style={{ color: T.t5, fontSize: 13, margin: 0 }}>
//           Select a date period on the left, pick a member, then run the analysis
//         </p>
//       </div>

//       {/* ── Two-column: calendar + calculator ── */}
//       <div style={{ display: "grid",
//         gridTemplateColumns: isMobile ? "1fr" : "268px 1fr",
//         gap: isMobile ? 16 : 20, alignItems: "start",
//         marginBottom: 20 }}>

//         {/* ════ LEFT: Calendar / date filters ════ */}
//         <div style={{ background: T.panel, border: `1px solid ${T.panelB}`,
//           borderRadius: 16, padding: "22px 20px",
//           display: "flex", flexDirection: "column", gap: 16 }}>

//           {/* Month nav */}
//           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//             <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 8, background: T.panel2,
//               border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
//               fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
//             <span style={{ fontSize: 13, fontWeight: 600, color: T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
//             <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 8, background: T.panel2,
//               border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
//               fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
//           </div>

//           <CalGrid year={calYear} month={calMonth}
//             activeDates={allDates} selDates={selDates} onToggle={toggleDate} />

//           {selDates.size > 0 && (
//             <div style={{ textAlign: "center", fontSize: 11, color: T.acText }}>
//               {selDates.size} date{selDates.size > 1 ? "s" : ""} selected &nbsp;
//               <button onClick={() => setSelDates(new Set())}
//                 style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 11 }}>✕</button>
//             </div>
//           )}

//           <div style={{ height: 1, background: T.divider }} />

//           {/* Month pills */}
//           <div>
//             <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//               letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Filter by Month</div>
//             <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
//               {MONTHS.map((m, i) => (
//                 <button key={m} onClick={() => setSelMonth(selMonth === i ? null : i)} style={{
//                   background: selMonth === i ? T.acLight : T.panel2,
//                   border: `1px solid ${selMonth === i ? T.acMid : T.panel2B}`,
//                   borderRadius: 6, color: selMonth === i ? T.acText : T.t4,
//                   fontSize: 10, padding: "5px 0", cursor: "pointer",
//                   textTransform: "uppercase", letterSpacing: "0.04em",
//                   fontWeight: selMonth === i ? 600 : 400, transition: "all 0.15s",
//                 }}>{m.slice(0, 3)}</button>
//               ))}
//             </div>
//           </div>

//           {/* Year pills */}
//           <div>
//             <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//               letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Filter by Year</div>
//             <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
//               {availableYears.map(y => (
//                 <button key={y} onClick={() => setSelYear(selYear === y ? null : y)} style={{
//                   background: selYear === y ? T.acLight : T.panel2,
//                   border: `1px solid ${selYear === y ? T.acMid : T.panel2B}`,
//                   borderRadius: 6, color: selYear === y ? T.acText : T.t4,
//                   fontSize: 10, padding: "5px 10px", cursor: "pointer",
//                   fontWeight: selYear === y ? 600 : 400, transition: "all 0.15s",
//                 }}>{y}</button>
//               ))}
//             </div>
//           </div>

//           {/* Date range */}
//           <div>
//             <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//               letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Date Range</div>
//             <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//               {([
//                 { label: "From", value: dateFrom, set: (v: string) => { setDateFrom(v); if (dateTo && v > dateTo) setDateTo(""); } },
//                 { label: "To",   value: dateTo,   set: (v: string) => setDateTo(v) },
//               ] as const).map(({ label, value, set }) => (
//                 <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                   <span style={{ fontSize: 10.5, color: T.t5, width: 26, flexShrink: 0 }}>{label}</span>
//                   <input type="date" value={value}
//                     min={label === "To" && dateFrom ? dateFrom : undefined}
//                     onChange={e => set(e.target.value)}
//                     style={dateInpStyle}
//                     onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
//                     onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}
//                   />
//                   {value && (
//                     <button onClick={() => set("")} style={{
//                       background: "none", border: "none", color: T.t5,
//                       cursor: "pointer", fontSize: 12, padding: 0, flexShrink: 0 }}>✕</button>
//                   )}
//                 </div>
//               ))}
//               {dateFrom && dateTo && (
//                 <div style={{ fontSize: 10.5, color: T.acText, marginLeft: 34 }}>
//                   {Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1} days
//                 </div>
//               )}
//             </div>
//           </div>

//           <div style={{ height: 1, background: T.divider }} />

//           {/* Period stats */}
//           <div>
//             <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
//               letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Period Stats</div>
//             {[
//               { label: "Sessions",    val: String(calFilteredEntries.length) },
//               { label: "Total Hours", val: fmtHours(calTotalMins) },
//             ].map(({ label, val }) => (
//               <div key={label} style={{ display: "flex", justifyContent: "space-between",
//                 alignItems: "center", marginBottom: 8 }}>
//                 <span style={{ fontSize: 12, color: T.t4 }}>{label}</span>
//                 <span style={{ fontSize: 13, color: T.acText, fontWeight: 600 }}>{val}</span>
//               </div>
//             ))}
//           </div>

//           {hasCalFilter && (
//             <>
//               <div style={{ height: 1, background: T.divider }} />
//               <button onClick={clearAll} style={{
//                 background: "transparent", border: `1px solid ${T.panel2B}`,
//                 borderRadius: 8, padding: "8px 0", fontSize: 12, color: T.t4,
//                 cursor: "pointer", width: "100%", fontFamily: "'DM Sans',sans-serif",
//                 transition: "color 0.15s",
//               }}
//                 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
//                 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
//               >✕ &nbsp;Clear date filters</button>
//             </>
//           )}
//         </div>

//         {/* ════ RIGHT: Salary Calculator ════ */}
//         <SalaryCalculator
//           calFilteredEntries={calFilteredEntries}
//           dateFrom={dateFrom}
//           dateTo={dateTo}
//           rates={rates}
//           fees={fees}
//           stages={stages}
//           allocs={allocs}
//           onRateChange={updateRate}
//           onAllocChange={updateAlloc}
//           onAnalysisRun={handleAnalysisRun}
//         />
//       </div>

//       {/* ════ BELOW: Expenses (full width) ════ */}
//       <SalaryExpenses
//         dateFrom={dateFrom}
//         dateTo={dateTo}
//         inheritedFilters={activeFilters}
//         analysisRan={analysisRan}
//       />
//     </div>
//   );
// }






export default function ExpensePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontFamily: "sans-serif" }}>
      <p>Expenses — coming soon</p>
    </div>
  );
}