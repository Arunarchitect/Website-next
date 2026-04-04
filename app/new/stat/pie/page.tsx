"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  fetchOrganisations,
  fetchProjectsByOrg,
  fetchBalanceSheet,
  type BalanceSheetResponse,
  type BalanceSheetParams,
  type OrganisationOption,
  type ProjectOption,
  type ExpenseRow,
} from "@/app/new/revenueExpenseApi";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];

const TECHNICAL_SALARY_KEYWORDS = [
  "salary", "salaries", "wage", "wages", "payroll",
  "project share", "project_share", "staff", "stipend", "compensation",
];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function fmtINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtDateDisplay(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#07080f",
  panel: "rgba(255,255,255,0.028)",
  panelB: "rgba(255,255,255,0.065)",
  panel2: "rgba(255,255,255,0.038)",
  panel2B: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.05)",
  t1: "#f0f4ff",
  t2: "#d8e0f0",
  t3: "#8a9ab8",
  t4: "#55657e",
  t5: "#39475a",
  t6: "#1f2733",
  ac: "#4c7cf3",
  acGlow: "rgba(76,124,243,0.15)",
  acLight: "rgba(76,124,243,0.1)",
  acMid: "rgba(76,124,243,0.45)",
  acText: "#7ba4ff",
  green: "#1ec99a",
  greenBg: "rgba(30,201,154,0.09)",
  red: "#f0686a",
  redBg: "rgba(240,104,106,0.09)",
  amber: "#f5a623",
  amberBg: "rgba(245,166,35,0.09)",
};

// Two distinct colours for the two groups
const GROUP_COLORS: Record<string, string> = {
  "Technical Salary": "#9b79f5", // purple
  "Overhead Costs":   "#f5a623", // amber
};

const Divider = () => <div style={{ height: 1, background: T.divider }} />;

// ─── FSel ─────────────────────────────────────────────────────────────────────
function FSel({ label, value, onChange, disabled, children }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        style={{ width: "100%", background: disabled ? "rgba(255,255,255,0.02)" : T.panel2, border: `1px solid ${T.panel2B}`, borderRadius: 7, padding: "8px 32px 8px 10px", fontSize: 12, color: disabled ? T.t5 : T.t2, outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: disabled ? "not-allowed" : "pointer", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2339475a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "calc(100% - 10px) center", transition: "all 0.12s", minHeight: 40 }}>
        {children}
      </select>
    </div>
  );
}

// ─── DateInput ────────────────────────────────────────────────────────────────
function DateInput({ label, value, onChange, min, max }: {
  label: string; value: string; onChange: (v: string) => void; min?: string; max?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} min={min} max={max}
        style={{ width: "100%", background: T.panel2, border: `1px solid ${value ? T.acMid : T.panel2B}`, borderRadius: 7, padding: "7px 6px", fontSize: 11, color: value ? T.t2 : T.t5, outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", colorScheme: "dark", minHeight: 36, transition: "border-color 0.15s", boxSizing: "border-box" }} />
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────
function CalGrid({ year, month, selDates, activeDates, rangeFrom, rangeTo, onToggle }: {
  year: number; month: number; selDates: Set<string>; activeDates: Set<string>;
  rangeFrom: string; rangeTo: string; onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
      {DAYS.map((d) => (
        <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.t5, fontWeight: 700, letterSpacing: "0.08em", paddingBottom: 5, textTransform: "uppercase" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const sel = selDates.has(iso);
        const has = activeDates.has(iso);
        const isToday = iso === today;
        const inRange = !!(rangeFrom && rangeTo && iso >= rangeFrom && iso <= rangeTo);
        const isEdge = (rangeFrom && iso === rangeFrom) || (rangeTo && iso === rangeTo);
        return (
          <button key={iso} onClick={() => onToggle(iso)}
            style={{ background: sel || isEdge ? T.ac : inRange ? T.acLight : "transparent", border: `1.5px solid ${sel || isEdge ? T.ac : isToday ? T.acMid : "transparent"}`, borderRadius: 6, cursor: "pointer", color: sel || isEdge ? "#fff" : inRange ? T.acText : has ? T.t2 : T.t5, fontSize: 11, padding: "5px 0", width: "100%", fontFamily: "'DM Sans',sans-serif", fontWeight: sel || isEdge ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all 0.12s" }}>
            {day}
            {has && <span style={{ width: 3, height: 3, borderRadius: "50%", background: sel ? "#fff" : T.acText, opacity: 0.8 }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────
function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s" }} />
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50, width: "min(85vw,300px)", background: "#0d0f1c", borderRight: `1px solid ${T.panelB}`, overflowY: "auto", WebkitOverflowScrolling: "touch", transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.28s cubic-bezier(0.32,0,0.25,1)", boxShadow: open ? "8px 0 40px rgba(0,0,0,0.6)" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 14px 12px", borderBottom: `1px solid ${T.divider}`, position: "sticky", top: 0, background: "#0d0f1c", zIndex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.t3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Filters &amp; Calendar</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, background: T.panel2, border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
interface Slice { label: string; value: number; pctOfExpenses: number; pctOfRevenue: number; color: string; }

function DonutChart({ slices, revenue, totalExpenses, balance, hoveredIdx, onHover }: {
  slices: Slice[]; revenue: number; totalExpenses: number; balance: number;
  hoveredIdx: number | null; onHover: (i: number | null) => void;
}) {
  const SIZE = 280, cx = 140, cy = 140, OR = 112, IR = 68;
  let cum = -Math.PI / 2;

  const expenseArcFraction = revenue > 0 ? Math.min(1, totalExpenses / revenue) : 0;
  const balanceArcFraction = revenue > 0 ? Math.max(0, balance / revenue) : 0;

  interface ArcEntry { d: string; color: string; idx: number; isBalance?: boolean; }
  const arcs: ArcEntry[] = [];

  slices.forEach((slice, i) => {
    const angle = (slice.pctOfExpenses / 100) * expenseArcFraction * 2 * Math.PI;
    if (angle < 0.002) { cum += angle; return; }
    const hov = hoveredIdx === i;
    const expand = hov ? 8 : 0;
    const mid = cum + angle / 2;
    const ox = cx + expand * Math.cos(mid), oy = cy + expand * Math.sin(mid);
    const ro = OR + expand, ri = IR - (hov ? 2 : 0);
    const sx = ox + ro * Math.cos(cum), sy = oy + ro * Math.sin(cum);
    cum += angle;
    const ex = ox + ro * Math.cos(cum), ey = oy + ro * Math.sin(cum);
    const eix = ox + ri * Math.cos(cum), eiy = oy + ri * Math.sin(cum);
    const six = ox + ri * Math.cos(cum - angle), siy = oy + ri * Math.sin(cum - angle);
    const large = angle > Math.PI ? 1 : 0;
    arcs.push({ d: `M${sx} ${sy} A${ro} ${ro} 0 ${large} 1 ${ex} ${ey} L${eix} ${eiy} A${ri} ${ri} 0 ${large} 0 ${six} ${siy}Z`, color: slice.color, idx: i });
  });

  // Balance wedge (green)
  if (balanceArcFraction > 0.001) {
    const angle = balanceArcFraction * 2 * Math.PI;
    const sx = cx + OR * Math.cos(cum), sy = cy + OR * Math.sin(cum);
    const end = cum + angle;
    const ex = cx + OR * Math.cos(end), ey = cy + OR * Math.sin(end);
    const eix = cx + IR * Math.cos(end), eiy = cy + IR * Math.sin(end);
    const six = cx + IR * Math.cos(cum), siy = cy + IR * Math.sin(cum);
    const large = angle > Math.PI ? 1 : 0;
    arcs.push({ d: `M${sx} ${sy} A${OR} ${OR} 0 ${large} 1 ${ex} ${ey} L${eix} ${eiy} A${IR} ${IR} 0 ${large} 0 ${six} ${siy}Z`, color: T.green, idx: -1, isBalance: true });
  }

  const hov = hoveredIdx !== null && hoveredIdx >= 0 ? slices[hoveredIdx] : null;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: "visible" }}>
      <defs>
        <filter id="gh"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gg"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color}
          opacity={hoveredIdx !== null && !arc.isBalance && arc.idx !== hoveredIdx ? 0.3 : 1}
          filter={arc.isBalance ? "url(#gg)" : hoveredIdx === arc.idx ? "url(#gh)" : undefined}
          stroke={T.bg} strokeWidth={2.5}
          style={{ transition: "opacity 0.18s", cursor: arc.isBalance ? "default" : "pointer" }}
          onMouseEnter={() => !arc.isBalance && onHover(arc.idx)}
          onMouseLeave={() => onHover(null)}
          onTouchStart={() => !arc.isBalance && onHover(hoveredIdx === arc.idx ? null : arc.idx)}
        />
      ))}

      {/* Center label */}
      {hov ? (
        <>
          <text x={cx} y={cy - 18} textAnchor="middle" fill={hov.color} fontSize={22} fontWeight={800} fontFamily="'Sora',sans-serif">{hov.pctOfRevenue.toFixed(1)}%</text>
          <text x={cx} y={cy + 2} textAnchor="middle" fill={T.t4} fontSize={9} fontWeight={700} fontFamily="'DM Sans',sans-serif" letterSpacing="1.2">OF REVENUE</text>
          <text x={cx} y={cy + 19} textAnchor="middle" fill={T.t3} fontSize={12} fontWeight={600} fontFamily="'DM Sans',sans-serif">{fmtINR(hov.value)}</text>
          <text x={cx} y={cy + 35} textAnchor="middle" fill={T.t5} fontSize={9.5} fontFamily="'DM Sans',sans-serif">{hov.label.length > 15 ? hov.label.slice(0,14)+"…" : hov.label}</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 12} textAnchor="middle" fill={T.t2} fontSize={15} fontWeight={700} fontFamily="'Sora',sans-serif">{fmtINR(totalExpenses)}</text>
          <text x={cx} y={cy + 7} textAnchor="middle" fill={T.t5} fontSize={8.5} fontWeight={700} fontFamily="'DM Sans',sans-serif" letterSpacing="1">EXPENSES</text>
          <text x={cx} y={cy + 24} textAnchor="middle" fill={balance >= 0 ? T.green : T.red} fontSize={11} fontWeight={700} fontFamily="'DM Sans',sans-serif">
            {balance >= 0 ? "+" : "−"}{fmtINR(Math.abs(balance))} net
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExpensesChartPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw] = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 760;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => { fetchOrganisations().then(setOrgs).catch(console.error); }, []);

  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  useEffect(() => {
    if (selectedOrg) fetchProjectsByOrg(selectedOrg).then(setProjects).catch(console.error);
    else { setProjects([]); setSelectedProject(null); }
  }, [selectedOrg]);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number>(new Date().getFullYear());
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [filterMode, setFilterMode] = useState<"calendar" | "month" | "range" | "none">("none");

  const handleRangeFrom = useCallback((v: string) => {
    setRangeFrom(v);
    if (v) { setFilterMode("range"); setSelDates(new Set()); setSelMonth(null); }
    else if (!rangeTo) setFilterMode("none");
  }, [rangeTo]);

  const handleRangeTo = useCallback((v: string) => {
    setRangeTo(v);
    if (v) { setFilterMode("range"); setSelDates(new Set()); setSelMonth(null); }
    else if (!rangeFrom) setFilterMode("none");
  }, [rangeFrom]);

  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { dateFrom, dateTo } = useMemo(() => {
    if (filterMode === "range") return { dateFrom: rangeFrom, dateTo: rangeTo };
    if (filterMode === "calendar" && selDates.size > 0) {
      const sorted = Array.from(selDates).sort();
      return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
    }
    return { dateFrom: "", dateTo: "" };
  }, [filterMode, rangeFrom, rangeTo, selDates]);

  const fetchData = useCallback(() => {
    setLoading(true); setError(null);
    const params: BalanceSheetParams = { organisation_id: selectedOrg ?? undefined, project_id: selectedProject ?? undefined, view_all: true };
    if (filterMode === "range") { if (rangeFrom) params.from = rangeFrom; if (rangeTo) params.to = rangeTo; }
    else if (filterMode === "month") { params.year = selYear; params.month = selMonth !== null ? selMonth + 1 : undefined; }
    else if (filterMode === "calendar") { if (dateFrom) params.from = dateFrom; if (dateTo) params.to = dateTo; }
    else { params.year = selYear; }
    fetchBalanceSheet(params)
      .then((d) => {
        setData(d);
        const dates = new Set<string>([...(d.revenues ?? []).map((r) => r.date), ...(d.expenses ?? []).map((e: ExpenseRow) => e.date)]);
        setActiveDates(dates);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterMode, selYear, selMonth, rangeFrom, rangeTo, selectedOrg, selectedProject, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const revenues = useMemo(() => data?.revenues ?? [], [data]);
  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalRevenue - totalExpenses;

  // ─── Grouped slices: Technical Salary + Overhead Costs ───────────────────
  const slices: Slice[] = useMemo(() => {
    let techSalaryTotal = 0;
    let overheadTotal = 0;

    expenses.forEach((e) => {
      const key = (e.category_label || e.category || "").toLowerCase();
      const isSalary = TECHNICAL_SALARY_KEYWORDS.some((kw) => key.includes(kw));
      if (isSalary) techSalaryTotal += e.amount;
      else overheadTotal += e.amount;
    });

    const total = techSalaryTotal + overheadTotal;

    const groups: Array<{ label: string; value: number }> = [];
    if (techSalaryTotal > 0) groups.push({ label: "Technical Salary", value: techSalaryTotal });
    if (overheadTotal > 0)   groups.push({ label: "Overhead Costs",   value: overheadTotal });

    return groups.map(({ label, value }) => ({
      label,
      value,
      color: GROUP_COLORS[label] ?? "#4c7cf3",
      pctOfExpenses: total > 0 ? (value / total) * 100 : 0,
      pctOfRevenue:  totalRevenue > 0 ? (value / totalRevenue) * 100 : 0,
    }));
  }, [expenses, totalRevenue]);

  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  function clearAll() { setSelDates(new Set()); setSelMonth(null); setRangeFrom(""); setRangeTo(""); setFilterMode("none"); setSelectedOrg(null); setSelectedProject(null); }
  function clearDateFilters() { setSelDates(new Set()); setSelMonth(null); setRangeFrom(""); setRangeTo(""); setFilterMode("none"); }
  function toggleDate(iso: string) {
    setFilterMode("calendar"); setRangeFrom(""); setRangeTo(""); setSelMonth(null);
    setSelDates((p) => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); if (n.size === 0) setFilterMode("none"); return n; });
  }
  function selectMonth(idx: number) {
    if (selMonth === idx && filterMode === "month") { setSelMonth(null); setFilterMode("none"); }
    else { setSelMonth(idx); setFilterMode("month"); setSelDates(new Set()); setRangeFrom(""); setRangeTo(""); }
  }
  function prevMonth() { calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }
  function nextMonth() { calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }

  const hasFilter = filterMode !== "none" || !!selectedOrg || !!selectedProject;
  const activeFilterCount = [filterMode !== "none", !!selectedOrg, !!selectedProject].filter(Boolean).length;
  const rangeLabelShort = useMemo(() => {
    if (filterMode !== "range") return "";
    if (rangeFrom && rangeTo) return `${fmtDateDisplay(rangeFrom)} – ${fmtDateDisplay(rangeTo)}`;
    if (rangeFrom) return `From ${fmtDateDisplay(rangeFrom)}`;
    return `Until ${fmtDateDisplay(rangeTo)}`;
  }, [filterMode, rangeFrom, rangeTo]);

  const SidebarContent = () => (
    <>
      <div style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase" }}>Date Range</div>
          {filterMode === "range" && (rangeFrom || rangeTo) && (
            <button onClick={clearDateFilters} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 11, padding: "1px 4px" }}>✕ Clear</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <DateInput label="From" value={filterMode === "range" ? rangeFrom : ""} onChange={handleRangeFrom} max={filterMode === "range" && rangeTo ? rangeTo : undefined} />
          <DateInput label="To" value={filterMode === "range" ? rangeTo : ""} onChange={handleRangeTo} min={filterMode === "range" && rangeFrom ? rangeFrom : undefined} />
        </div>
        {filterMode === "range" && (rangeFrom || rangeTo) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.acLight, borderRadius: 6, padding: "5px 9px", border: `1px solid ${T.acMid}` }}>
            <span style={{ fontSize: 10, color: T.acText, fontWeight: 600, flex: 1 }}>📅 {rangeLabelShort}</span>
          </div>
        )}
      </div>
      <Divider />

      <div style={{ padding: "14px 14px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 6, background: T.panel2, border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.t2 }}>{MONTHS[calMonth]}</div>
            <div style={{ fontSize: 10, color: T.t5, marginTop: 1 }}>{calYear}</div>
          </div>
          <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 6, background: T.panel2, border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>›</button>
        </div>
        <CalGrid year={calYear} month={calMonth} selDates={filterMode === "calendar" ? selDates : new Set()} activeDates={activeDates} rangeFrom={filterMode === "range" ? rangeFrom : ""} rangeTo={filterMode === "range" ? rangeTo : ""} onToggle={toggleDate} />
        {filterMode === "calendar" && selDates.size > 0 && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.acLight, borderRadius: 6, padding: "5px 9px" }}>
            <span style={{ fontSize: 10.5, color: T.acText, fontWeight: 600 }}>{selDates.size} date{selDates.size > 1 ? "s" : ""} selected</span>
            <button onClick={clearDateFilters} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>✕</button>
          </div>
        )}
      </div>
      <Divider />

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 8 }}>Quick Month</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3 }}>
          {MONTHS.map((m, i) => {
            const active = filterMode === "month" && selMonth === i;
            const dimmed = filterMode === "range" || filterMode === "calendar";
            return <button key={m} onClick={() => selectMonth(i)} style={{ background: active ? T.acLight : "transparent", border: `1px solid ${active ? T.acMid : T.divider}`, borderRadius: 5, color: active ? T.acText : T.t5, fontSize: 10, padding: "6px 0", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: active ? 700 : 400, minHeight: 32, opacity: dimmed ? 0.4 : 1, transition: "opacity 0.15s" }}>{m.slice(0, 3)}</button>;
          })}
        </div>
      </div>

      <div style={{ padding: "0 14px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 8 }}>Year</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {AVAILABLE_YEARS.map((y) => {
            const active = selYear === y && (filterMode === "month" || filterMode === "none");
            return <button key={y} onClick={() => setSelYear(y)} style={{ flex: "1 1 0", background: active ? T.acLight : "transparent", border: `1px solid ${active ? T.acMid : T.divider}`, borderRadius: 5, color: active ? T.acText : T.t5, fontSize: 10, padding: "6px 0", cursor: "pointer", fontWeight: active ? 700 : 400, minHeight: 32, opacity: filterMode === "range" || filterMode === "calendar" ? 0.4 : 1, transition: "opacity 0.15s" }}>{y}</button>;
          })}
        </div>
      </div>
      <Divider />

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase" }}>Filters</div>
        <FSel label="Organisation" value={selectedOrg ? String(selectedOrg) : ""} onChange={(v) => { setSelectedOrg(v ? Number(v) : null); setSelectedProject(null); }}>
          <option value="">All organisations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </FSel>
        <FSel label="Project" value={selectedProject ? String(selectedProject) : ""} onChange={(v) => setSelectedProject(v ? Number(v) : null)} disabled={!selectedOrg}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FSel>
      </div>

      {hasFilter && (
        <>
          <Divider />
          <div style={{ padding: "10px 14px 20px" }}>
            <button onClick={() => { clearAll(); setDrawerOpen(false); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.red; (e.currentTarget as HTMLElement).style.borderColor = T.red + "40"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.t5; (e.currentTarget as HTMLElement).style.borderColor = T.divider; }}
              style={{ width: "100%", background: "transparent", border: `1px solid ${T.divider}`, borderRadius: 7, padding: "8px 0", fontSize: 11, color: T.t5, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", minHeight: 38, transition: "all 0.12s" }}>
              ✕ &nbsp;Clear all filters
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div ref={containerRef} style={{ minHeight: "100vh", background: T.bg, color: T.t2, fontFamily: "'DM Sans','Sora',sans-serif", padding: isMobile ? "env(safe-area-inset-top,18px) env(safe-area-inset-right,12px) env(safe-area-inset-bottom,80px) env(safe-area-inset-left,12px)" : "28px 24px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Sora:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(76,124,243,0.25);border-radius:99px;}
        select option{background:#0d0f1c;color:#d8e0f0;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5) sepia(1) saturate(2) hue-rotate(180deg);cursor:pointer;opacity:0.7;}
        @keyframes pulse{0%,100%{opacity:.35}50%{opacity:.75}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        button{touch-action:manipulation;}
        html{-webkit-text-size-adjust:100%;}
      `}</style>

      {isMobile && <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}><SidebarContent /></MobileDrawer>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: `linear-gradient(135deg,${T.redBg},rgba(240,104,106,0.04))`, border: `1px solid ${T.red}28`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 18px rgba(240,104,106,0.08)` }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <circle cx={12} cy={12} r={9} stroke={T.red} strokeWidth={1.5} />
              <path d="M12 12 L12 3" stroke={T.red} strokeWidth={1.5} strokeLinecap="round" />
              <path d="M12 12 L18 15" stroke={T.amber} strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 16 : 21, fontWeight: 700, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em", color: T.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Revenue vs Expenses</h1>
            {!isMobile && <p style={{ color: T.t5, fontSize: 11.5, marginTop: 1 }}>Technical salary · overhead costs as % of revenue</p>}
          </div>
        </div>

        {isMobile ? (
          <button onClick={() => setDrawerOpen(true)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 8, padding: "7px 12px", color: T.t3, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", position: "relative" }}>
            <svg width={14} height={14} viewBox="0 0 20 20" fill="none"><path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" /></svg>
            Filters
            {activeFilterCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: T.ac, color: "#fff", width: 16, height: 16, borderRadius: "50%", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${T.bg}` }}>{activeFilterCount}</span>}
          </button>
        ) : data && (
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Revenue", val: fmtINR(totalRevenue), color: T.green },
              { label: "Expenses", val: fmtINR(totalExpenses), color: T.red },
              { label: "Net Balance", val: (balance >= 0 ? "+" : "−") + fmtINR(Math.abs(balance)), color: balance >= 0 ? T.green : T.red },
            ].map((s) => (
              <div key={s.label} style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: T.t5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isMobile && data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 12 }}>
          {[
            { label: "Revenue", val: fmtINR(totalRevenue), color: T.green },
            { label: "Expenses", val: fmtINR(totalExpenses), color: T.red },
            { label: "Net", val: (balance >= 0 ? "+" : "−") + fmtINR(Math.abs(balance)), color: balance >= 0 ? T.green : T.red },
          ].map((s) => (
            <div key={s.label} style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 10, padding: "9px 10px" }}>
              <div style={{ fontSize: 8.5, color: T.t5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "260px 1fr", gap: 14, alignItems: "start" }}>

        {!isMobile && (
          <div style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", position: "sticky", top: 20, maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
            <SidebarContent />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {error && <div style={{ padding: "11px 16px", color: T.red, fontSize: 12.5, background: T.redBg, borderRadius: 10, border: `1px solid ${T.red}30` }}>⚠ {error}</div>}

          {filterMode !== "none" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, background: T.acLight, border: `1px solid ${T.acMid}`, fontSize: 11, color: T.acText }}>
              <svg width={12} height={12} viewBox="0 0 20 20" fill="none"><rect x={2} y={3} width={16} height={16} rx={3} stroke={T.acText} strokeWidth={1.5} /><path d="M2 8h16M6 1v4M14 1v4" stroke={T.acText} strokeWidth={1.5} strokeLinecap="round" /></svg>
              <span>
                {filterMode === "range" && <>{dateFrom && dateTo ? `${fmtDateDisplay(dateFrom)} – ${fmtDateDisplay(dateTo)}` : dateFrom ? `From ${fmtDateDisplay(dateFrom)}` : `Until ${fmtDateDisplay(dateTo)}`}</>}
                {filterMode === "month" && selMonth !== null && <>{MONTHS[selMonth]} {selYear}</>}
                {filterMode === "calendar" && selDates.size > 0 && <>{selDates.size} date{selDates.size > 1 ? "s" : ""} selected</>}
              </span>
              <button onClick={clearDateFilters} style={{ marginLeft: "auto", background: "none", border: "none", color: T.acText, cursor: "pointer", fontSize: 13, opacity: 0.7, padding: "2px 4px" }}>✕</button>
            </div>
          )}

          {/* Main chart card */}
          <div style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 14, overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${T.red}30`, borderTopColor: T.red, animation: "spin 0.9s linear infinite" }} />
                <span style={{ fontSize: 12, color: T.t5 }}>Loading…</span>
              </div>
            ) : !data || totalRevenue === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 280, gap: 10, color: T.t6 }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1}><circle cx={12} cy={12} r={9} /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
                <span style={{ fontSize: 13 }}>No data for this period</span>
              </div>
            ) : (
              <div style={{ padding: isMobile ? "16px 12px" : "24px 28px" }}>

                {/* Revenue header strip */}
                <div style={{ marginBottom: 22, padding: "12px 16px", borderRadius: 10, background: T.greenBg, border: `1px solid ${T.green}20`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Total Revenue</div>
                    <div style={{ fontSize: 10.5, color: T.t4 }}>
                      Expenses consume{" "}
                      <span style={{ color: T.red, fontWeight: 700 }}>{totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%</span>
                      {" "}· Balance retains{" "}
                      <span style={{ color: balance >= 0 ? T.green : T.red, fontWeight: 700 }}>{totalRevenue > 0 ? Math.abs((balance / totalRevenue) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.green, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em" }}>{fmtINR(totalRevenue)}</div>
                </div>

                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "center" : "flex-start", gap: isMobile ? 24 : 36 }}>

                  {/* Donut */}
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <DonutChart slices={slices} revenue={totalRevenue} totalExpenses={totalExpenses} balance={balance} hoveredIdx={hoveredSlice} onHover={setHoveredSlice} />
                    <div style={{ display: "flex", gap: 16, fontSize: 10.5, color: T.t4, flexWrap: "wrap", justifyContent: "center" }}>
                      {slices.map((s) => (
                        <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
                          {s.label}
                        </span>
                      ))}
                      {balance > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: T.green, display: "inline-block" }} />
                          Balance retained
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Group breakdown */}
                  <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, animation: "fadeUp 0.3s ease both" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: T.t5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 2 }}>
                      Breakdown by cost group
                    </div>

                    {slices.length === 0 ? (
                      <div style={{ color: T.t6, fontSize: 12, padding: "20px 0", textAlign: "center" }}>No expenses recorded</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {slices.map((slice, i) => (
                          <div key={slice.label}
                            onMouseEnter={() => setHoveredSlice(i)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            style={{ padding: "9px 10px", borderRadius: 8, cursor: "default", opacity: hoveredSlice !== null && hoveredSlice !== i ? 0.42 : 1, transition: "all 0.18s", background: hoveredSlice === i ? slice.color + "0e" : "transparent", border: `1px solid ${hoveredSlice === i ? slice.color + "28" : "transparent"}` }}
                          >
                            {/* Top row: swatch · label · amount */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                              <span style={{ width: 9, height: 9, borderRadius: 2, background: slice.color, flexShrink: 0, boxShadow: hoveredSlice === i ? `0 0 8px ${slice.color}90` : "none", transition: "box-shadow 0.18s" }} />
                              <span style={{ flex: 1, fontSize: 12, color: hoveredSlice === i ? T.t1 : T.t2, fontWeight: hoveredSlice === i ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.15s" }}>{slice.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: slice.color, flexShrink: 0 }}>{fmtINR(slice.value)}</span>
                            </div>

                            {/* % pills */}
                            <div style={{ display: "flex", gap: 5, paddingLeft: 17, flexWrap: "wrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 20, background: slice.color + "18", border: `1px solid ${slice.color}28`, fontSize: 10, fontWeight: 700, color: slice.color, whiteSpace: "nowrap" }}>
                                {slice.pctOfExpenses.toFixed(1)}% of expenses
                              </span>
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${T.divider}`, fontSize: 10, fontWeight: 600, color: T.t4, whiteSpace: "nowrap" }}>
                                {slice.pctOfRevenue.toFixed(1)}% of revenue
                              </span>
                            </div>

                            {/* Bar proportional to revenue */}
                            <div style={{ marginTop: 6, paddingLeft: 17 }}>
                              <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 99, background: slice.color, width: `${Math.min(100, slice.pctOfRevenue)}%`, transition: "width 0.6s cubic-bezier(0.34,1.2,0.64,1)", boxShadow: `0 0 5px ${slice.color}50` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Net balance footer */}
                    <div style={{ marginTop: 12, padding: "11px 14px", borderRadius: 9, background: balance >= 0 ? T.greenBg : T.redBg, border: `1px solid ${balance >= 0 ? T.green : T.red}22`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 1 }}>Net Balance</div>
                        <div style={{ fontSize: 10.5, color: T.t4 }}>Revenue − All Expenses</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: balance >= 0 ? T.green : T.red, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em" }}>
                          {balance >= 0 ? "+" : "−"}{fmtINR(Math.abs(balance))}
                        </div>
                        <div style={{ fontSize: 10.5, color: balance >= 0 ? T.green : T.red, fontWeight: 600 }}>
                          {totalRevenue > 0 ? Math.abs((balance / totalRevenue) * 100).toFixed(1) : 0}% of revenue
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}