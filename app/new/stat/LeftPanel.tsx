// "use client";

// import { useState, useMemo } from "react";
// import { entries, organisation } from "@/app/new/data";
// import { MONTHS, fmtDate, type DateFilter } from "./shared";

// const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
// function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

// // ─── CalendarMonth ─────────────────────────────────────────────────────────────
// function CalendarMonth({
//   year, month, selectedDates, onToggleDate, rangeStart, rangeEnd,
// }: {
//   year: number; month: number;
//   selectedDates: Set<string>; onToggleDate: (d: string) => void;
//   rangeStart: string; rangeEnd: string;
// }) {
//   const total = getDaysInMonth(year, month);
//   const first = getFirstDay(year, month);
//   const cells = [
//     ...Array(first).fill(null),
//     ...Array.from({ length: total }, (_, i) => i + 1),
//   ] as (number | null)[];

//   function cls(iso: string) {
//     if (rangeStart && rangeEnd) {
//       const lo = rangeStart < rangeEnd ? rangeStart : rangeEnd;
//       const hi = rangeStart < rangeEnd ? rangeEnd   : rangeStart;
//       if (iso === lo) return "range-start";
//       if (iso === hi) return "range-end";
//       if (iso > lo && iso < hi) return "in-range";
//     }
//     if (selectedDates.has(iso)) return "on";
//     return "";
//   }

//   return (
//     <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
//       {DAYS.map(d => (
//         <div key={d} style={{
//           textAlign: "center", fontSize: 9, color: "var(--oa-faint)",
//           fontWeight: 700, padding: "4px 0 3px", textTransform: "uppercase",
//           letterSpacing: "0.05em",
//         }}>{d}</div>
//       ))}
//       {cells.map((day, i) => {
//         if (!day) return <div key={`_${i}`} />;
//         const iso = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
//         const c = cls(iso);
//         return (
//           <button key={iso} className={`oa-cal-day${c ? ` ${c}` : ""}`} onClick={() => onToggleDate(iso)}>
//             {day}
//           </button>
//         );
//       })}
//     </div>
//   );
// }

// // ─── LeftPanel ────────────────────────────────────────────────────────────────
// interface LeftPanelProps {
//   filter: DateFilter;
//   onChange: (f: DateFilter) => void;
// }

// export default function LeftPanel({ filter, onChange }: LeftPanelProps) {
//   const today = new Date();
//   const [calYear,  setCalYear]  = useState(today.getFullYear());
//   const [calMonth, setCalMonth] = useState(today.getMonth());

//   const { rangeStart, rangeEnd, selectedDates, selectedMonth, selectedYear } = filter;

//   const availableYears = useMemo(
//     () => Array.from(new Set(entries.map(e => new Date(e.date).getFullYear()))).sort(),
//     [],
//   );

//   function prevMonth() {
//     if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
//     else setCalMonth(m => m - 1);
//   }
//   function nextMonth() {
//     if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
//     else setCalMonth(m => m + 1);
//   }

//   function toggleDate(iso: string) {
//     // Clear range when picking individual dates
//     const newDates = new Set(selectedDates);
//     newDates.has(iso) ? newDates.delete(iso) : newDates.add(iso);
//     onChange({ ...filter, selectedDates: newDates, rangeStart: "", rangeEnd: "" });
//   }

//   function setRange(key: "rangeStart" | "rangeEnd", val: string) {
//     onChange({ ...filter, [key]: val, selectedDates: new Set() });
//   }

//   function toggleMonth(m: number) {
//     onChange({ ...filter, selectedMonth: selectedMonth === m ? null : m });
//   }

//   function toggleYear(y: number) {
//     onChange({ ...filter, selectedYear: selectedYear === y ? null : y });
//   }

//   function clearAll() {
//     onChange({
//       rangeStart: "", rangeEnd: "",
//       selectedDates: new Set(),
//       selectedMonth: null,
//       selectedYear: null,
//     });
//   }

//   const hasAny = rangeStart || rangeEnd || selectedDates.size > 0
//     || selectedMonth !== null || selectedYear !== null;

//   // Active filter tags
//   const tags: { label: string; clear: () => void }[] = [];
//   if (rangeStart || rangeEnd) {
//     const label = rangeStart && rangeEnd
//       ? `${fmtDate(rangeStart)} → ${fmtDate(rangeEnd)}`
//       : rangeStart ? `From ${fmtDate(rangeStart)}` : `Until ${fmtDate(rangeEnd)}`;
//     tags.push({ label, clear: () => onChange({ ...filter, rangeStart: "", rangeEnd: "" }) });
//   }
//   if (selectedDates.size > 0)
//     tags.push({ label: `${selectedDates.size} day${selectedDates.size > 1 ? "s" : ""}`, clear: () => onChange({ ...filter, selectedDates: new Set() }) });
//   if (selectedMonth !== null)
//     tags.push({ label: MONTHS[selectedMonth], clear: () => onChange({ ...filter, selectedMonth: null }) });
//   if (selectedYear !== null)
//     tags.push({ label: String(selectedYear), clear: () => onChange({ ...filter, selectedYear: null }) });

//   return (
//     <aside className="oa-panel" style={{ position: "sticky", top: 24 }}>

//       {/* Org badge */}
//       <div className="oa-org-badge">
//         <div className="oa-org-logo">{organisation.logo}</div>
//         <span className="oa-org-name">{organisation.name}</span>
//         <span style={{ fontSize: 11, color: "var(--oa-faint)", marginLeft: 4 }}>
//           · {organisation.industry}
//         </span>
//       </div>

//       <h2 className="oa-display" style={{
//         fontSize: 22, fontWeight: 400, color: "var(--oa-text)",
//         lineHeight: 1.15, marginBottom: 4,
//       }}>
//         Analytics
//       </h2>
//       <p style={{ fontSize: 12, color: "var(--oa-muted)", marginBottom: 20 }}>
//         Select a date range or specific dates to filter the dashboard.
//       </p>

//       {/* ── Calendar nav ── */}
//       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
//         <button className="oa-nav-btn" onClick={prevMonth}>‹</button>
//         <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oa-text)" }}>
//           {MONTHS[calMonth]} {calYear}
//         </span>
//         <button className="oa-nav-btn" onClick={nextMonth}>›</button>
//       </div>

//       <CalendarMonth
//         year={calYear} month={calMonth}
//         selectedDates={selectedDates} onToggleDate={toggleDate}
//         rangeStart={rangeStart} rangeEnd={rangeEnd}
//       />

//       {selectedDates.size > 0 && (
//         <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "var(--oa-accent)" }}>
//           {selectedDates.size} date{selectedDates.size > 1 ? "s" : ""} selected &nbsp;
//           <button onClick={() => onChange({ ...filter, selectedDates: new Set() })}
//             style={{ background: "none", border: "none", color: "var(--oa-red)", cursor: "pointer", fontSize: 12 }}>
//             ✕ clear
//           </button>
//         </div>
//       )}

//       <div className="oa-divider" />

//       {/* ── Date Range ── */}
//       <span className="oa-label">Date Range</span>
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
//         <div>
//           <div style={{ fontSize: 10, color: "var(--oa-faint)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>From</div>
//           <input type="date" className="oa-date-input" value={rangeStart}
//             onChange={e => setRange("rangeStart", e.target.value)} />
//         </div>
//         <div>
//           <div style={{ fontSize: 10, color: "var(--oa-faint)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>To</div>
//           <input type="date" className="oa-date-input" value={rangeEnd}
//             onChange={e => setRange("rangeEnd", e.target.value)} />
//         </div>
//       </div>
//       {(rangeStart || rangeEnd) && (
//         <button onClick={() => onChange({ ...filter, rangeStart: "", rangeEnd: "" })}
//           style={{ background: "none", border: "none", color: "var(--oa-red)", cursor: "pointer", fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
//           ✕ Clear date range
//         </button>
//       )}

//       <div className="oa-divider" />

//       {/* ── Month pills ── */}
//       <span className="oa-label">Month</span>
//       <div className="oa-month-grid">
//         {MONTHS.map((m, i) => (
//           <button key={m} className={`oa-pill${selectedMonth === i ? " on" : ""}`}
//             onClick={() => toggleMonth(i)}>
//             {m.slice(0, 3)}
//           </button>
//         ))}
//       </div>

//       {/* ── Year pills ── */}
//       <span className="oa-label">Year</span>
//       <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
//         {availableYears.map(y => (
//           <button key={y} className={`oa-year-pill${selectedYear === y ? " on" : ""}`}
//             onClick={() => toggleYear(y)}>
//             {y}
//           </button>
//         ))}
//       </div>

//       {/* ── Active filter summary ── */}
//       {hasAny && (
//         <div style={{
//           background: "var(--oa-accent-bg)", border: "1px solid var(--oa-accent-border)",
//           borderRadius: 12, padding: "12px 14px",
//         }}>
//           <div style={{ fontSize: 11, fontWeight: 700, color: "var(--oa-accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
//             Active Filters
//           </div>
//           <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
//             {tags.map(t => (
//               <span key={t.label} className="oa-filter-tag">
//                 {t.label}
//                 <button onClick={t.clear}>✕</button>
//               </span>
//             ))}
//           </div>
//           <button className="oa-btn-ghost" onClick={clearAll}
//             style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, color: "var(--oa-red)", borderColor: "var(--oa-red-border)" }}>
//             Clear all filters
//           </button>
//         </div>
//       )}
//     </aside>
//   );
// }
