"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  fetchExpenseMeta,
  fetchExpenseMonitor,
  type ExpenseOrgOption      as OrgOption,
  type ExpenseProjectOption  as ProjectOption,
  type ExpenseMemberOption   as MemberOption,
  type ExpenseCategoryOption as CatOption,
  type ExpenseRow,
  type ExpenseMonitorResult  as PageResult,
  type ExpenseSummary        as Summary,
} from "@/app/new/expenseApi";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#0b0e18",
  panel:   "rgba(255,255,255,0.022)",
  panelB:  "rgba(255,255,255,0.07)",
  panel2:  "rgba(255,255,255,0.04)",
  panel2B: "rgba(255,255,255,0.09)",
  rowHov:  "rgba(255,255,255,0.035)",
  divider: "rgba(255,255,255,0.055)",
  t1: "#f0f4ff", t2: "#e2e8f0", t3: "#94a3b8",
  t4: "#64748b", t5: "#475569", t6: "#2d3748",
  ac:      "#4f8ef7",
  acLight: "rgba(79,142,247,0.12)",
  acMid:   "rgba(79,142,247,0.5)",
  acText:  "#7eb3ff",
  green:   "#22d3a5", greenBg: "rgba(34,211,165,0.1)",
  red:     "#f87171", redBg:   "rgba(248,113,113,0.1)",
  amber:   "#fbbf24", amberBg: "rgba(251,191,36,0.1)",
  purple:  "#a78bfa",
  teal:    "#2dd4bf",
};

const CAT_COLORS: Record<string, string> = {
  travel:        T.ac,
  food:          T.green,
  accommodation: T.amber,
  stationery:    T.purple,
  salary:        T.teal,
  others:        T.t3,
};

function catColor(c: string) { return CAT_COLORS[c] ?? T.t3; }

const Divider = () => <div style={{ height: 1, background: T.divider, margin: "4px 0" }} />;

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
          }}>
            {day}
            {has && (
              <span style={{ display: "block", width: 3, height: 3, borderRadius: "50%",
                background: sel ? "#fff" : T.acText }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────
function CategoryBadge({ category, label }: { category: string; label: string }) {
  const color = catColor(category);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 20,
      background: color + "22", border: `1px solid ${color}44`,
      fontSize: 10.5, fontWeight: 600, color,
      textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ─── Reimbursed badge ─────────────────────────────────────────────────────────
function ReimbursedBadge({ reimbursed }: { reimbursed: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
      background: reimbursed ? T.greenBg : T.amberBg,
      color: reimbursed ? T.green : T.amber,
      fontSize: 10.5, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {reimbursed ? "Paid" : "Pending"}
    </span>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────
type SortField = "date" | "user" | "project" | "org" | "category" | "amount" | "reimbursed";
type SortDir   = "asc" | "desc";

function ThCell({ field, children, sortField, sortDir, onSort, w }: {
  field: SortField; children: React.ReactNode; w?: number;
  sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th style={{ width: w, padding: 0, whiteSpace: "nowrap" }}>
      <div onClick={() => onSort(field)} style={{
        display: "flex", alignItems: "center", gap: 4, padding: "10px 12px 6px",
        fontSize: 10.5, fontWeight: 600, color: active ? T.acText : T.t5,
        letterSpacing: "0.07em", textTransform: "uppercase",
        cursor: "pointer", userSelect: "none", transition: "color 0.15s",
      }}>
        {children}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.3 }}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </div>
    </th>
  );
}

// ─── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
      {[120, 140, 140, 110, 90, 110, 80, 90].map((w, i) => (
        <td key={i} style={{ padding: "10px 12px" }}>
          <div style={{
            height: 13, width: w, borderRadius: 6,
            background: "rgba(255,255,255,0.06)",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 12px", borderRadius: 10,
      background: T.panel2, border: `1px solid ${T.panel2B}`,
      marginBottom: 6,
    }}>
      <span style={{ fontSize: 11.5, color: T.t4 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExpenseMonitorPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw]  = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 760;

  // ── Meta ──────────────────────────────────────────────────────────────────
  const [orgs,     setOrgs]     = useState<OrgOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members,  setMembers]  = useState<MemberOption[]>([]);
  const [cats,     setCats]     = useState<CatOption[]>([]);

  useEffect(() => {
    fetchExpenseMeta().then(d => {
      setOrgs(d.organisations);
      setProjects(d.projects);
      setMembers(d.members);
      setCats(d.categories);
    }).catch(console.error);
  }, []);

  // ── Calendar state ────────────────────────────────────────────────────────
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear,  setSelYear]  = useState<number | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterOrg,        setFilterOrg]       = useState("");
  const [filterProject,    setFilterProject]    = useState("");
  const [filterMember,     setFilterMember]     = useState("");
  const [filterCategory,   setFilterCategory]   = useState("");
  const [filterReimbursed, setFilterReimbursed] = useState("all");

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Active dates for calendar dots ────────────────────────────────────────
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());

  // Build date range from calendar selection
  const { dateFrom, dateTo } = useMemo(() => {
    if (selDates.size > 0) {
      const sorted = Array.from(selDates).sort();
      return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
    }
    if (selMonth !== null) {
      const y = selYear ?? calYear;
      const m = String(selMonth + 1).padStart(2, "0");
      const lastDay = getDaysInMonth(y, selMonth);
      return { dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-${lastDay}` };
    }
    if (selYear !== null) {
      return { dateFrom: `${selYear}-01-01`, dateTo: `${selYear}-12-31` };
    }
    return { dateFrom: "", dateTo: "" };
  }, [selDates, selMonth, selYear, calYear]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchExpenseMonitor({
      org_id:     filterOrg      || undefined,
      project_id: filterProject  || undefined,
      member_id:  filterMember   || undefined,
      category:   filterCategory || undefined,
      reimbursed: (filterReimbursed as "true" | "false" | "all"),
      from:       dateFrom || undefined,
      to:         dateTo   || undefined,
      page,
    })
      .then(d => {
        setData(d);
        setActiveDates(new Set(d.results.map((r: ExpenseRow) => r.date)));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterOrg, filterProject, filterMember, filterCategory, filterReimbursed, dateFrom, dateTo, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [
    filterOrg, filterProject, filterMember, filterCategory, filterReimbursed, dateFrom, dateTo,
  ]);

  // ── Sort rows client-side (within loaded page) ────────────────────────────
  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.results];
    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "date":       av = a.date;              bv = b.date;              break;
        case "user":       av = a.user_name;         bv = b.user_name;         break;
        case "project":    av = a.project_name;      bv = b.project_name;      break;
        case "org":        av = a.organisation_name; bv = b.organisation_name; break;
        case "category":   av = a.category;          bv = b.category;          break;
        case "amount":     av = a.amount;            bv = b.amount;            break;
        case "reimbursed": av = String(a.reimbursed); bv = String(b.reimbursed); break;
      }
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [data, sortField, sortDir]);

  function handleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────
  function toggleDate(iso: string) {
    setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }
  function prevMonth() {
    calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1);
  }
  function nextMonth() {
    calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1);
  }

  function clearAll() {
    setSelDates(new Set()); setSelMonth(null); setSelYear(null);
    setFilterOrg(""); setFilterProject(""); setFilterMember("");
    setFilterCategory(""); setFilterReimbursed("all");
  }

  const availableYears = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
  }, []);

  // Projects filtered by selected org
  const filteredProjects = useMemo(() =>
    filterOrg ? projects.filter(p => p.organisation_id === Number(filterOrg)) : projects,
    [projects, filterOrg],
  );

  const hasFilter = selDates.size > 0 || selMonth !== null || selYear !== null ||
    filterOrg || filterProject || filterMember || filterCategory || filterReimbursed !== "all";

  const summary: Summary | undefined = data?.summary;

  // ── Select style ──────────────────────────────────────────────────────────
  const sel: React.CSSProperties = {
    width: "100%", background: T.panel2,
    border: `1px solid ${T.panel2B}`, borderRadius: 7,
    padding: "6px 9px", fontSize: 11.5, color: T.t2,
    outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
    appearance: "none",
  };

  const totalPages = data?.pages ?? 1;

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh", background: T.bg, color: T.t2,
      fontFamily: "'DM Sans','Sora',sans-serif",
      padding: isMobile ? "20px 14px 56px" : "32px 28px 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        select option { background: #131623; color: #e2e8f0; }
        .tbl-wrap::-webkit-scrollbar { height: 5px; }
        .tbl-wrap::-webkit-scrollbar-thumb { background: rgba(79,142,247,0.3); border-radius: 99px; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: isMobile ? 18 : 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: T.acLight, border: `1px solid ${T.acMid}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={18} height={18} viewBox="0 0 20 20" fill="none">
              <path d="M2 6h16M2 10h10M2 14h6" stroke={T.acText} strokeWidth={1.8} strokeLinecap="round"/>
              <rect x={12} y={10} width={7} height={7} rx={2} stroke={T.acText} strokeWidth={1.5}/>
            </svg>
          </div>
          <div>
            <h1 style={{
              fontSize: isMobile ? 20 : 24, fontWeight: 700,
              fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em",
              color: T.t1, margin: 0,
            }}>Expense Monitor</h1>
            <p style={{ color: T.t5, fontSize: 12.5, margin: 0 }}>
              View &amp; analyse team expenditure across projects
            </p>
          </div>
        </div>
      </div>

      {/* ── Layout ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "256px 1fr",
        gap: 16, alignItems: "start",
      }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, padding: "18px 16px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>

          {/* Calendar nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={prevMonth} style={{
              width: 28, height: 28, borderRadius: 7, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.t2 }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} style={{
              width: 28, height: 28, borderRadius: 7, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
          </div>

          <CalGrid
            year={calYear} month={calMonth}
            activeDates={activeDates} selDates={selDates} onToggle={toggleDate}
          />

          {selDates.size > 0 && (
            <div style={{ textAlign: "center", fontSize: 11, color: T.acText }}>
              {selDates.size} date{selDates.size > 1 ? "s" : ""} selected &nbsp;
              <button
                onClick={() => setSelDates(new Set())}
                style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 11 }}
              >✕</button>
            </div>
          )}

          <Divider />

          {/* Filters */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 8 }}>Filters</div>

            <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 3 }}>Organisation</label>
            <select style={{ ...sel, marginBottom: 8 }} value={filterOrg}
              onChange={e => { setFilterOrg(e.target.value); setFilterProject(""); }}>
              <option value="">All organisations</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>

            <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 3 }}>Project</label>
            <select style={{ ...sel, marginBottom: 8 }} value={filterProject}
              onChange={e => setFilterProject(e.target.value)}>
              <option value="">All projects</option>
              {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 3 }}>Member</label>
            <select style={{ ...sel, marginBottom: 8 }} value={filterMember}
              onChange={e => setFilterMember(e.target.value)}>
              <option value="">All members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 3 }}>Category</label>
            <select style={{ ...sel, marginBottom: 8 }} value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 3 }}>Status</label>
            <select style={sel} value={filterReimbursed}
              onChange={e => setFilterReimbursed(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="true">Reimbursed</option>
              <option value="false">Pending</option>
            </select>
          </div>

          <Divider />

          {/* Month pills */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 8 }}>Month</div>
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
            <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 8 }}>Year</div>
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

          <Divider />

          {/* Summary stats */}
          {summary && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em",
                textTransform: "uppercase", marginBottom: 10 }}>Summary</div>
              <StatCard label="Entries"    value={String(data?.count ?? 0)} color={T.acText} />
              <StatCard label="Total"      value={fmtINR(summary.total)}    color={T.t2} />
              <StatCard label="Reimbursed" value={fmtINR(summary.reimbursed)} color={T.green} />
              <StatCard label="Pending"    value={fmtINR(summary.pending)}  color={T.amber} />
            </div>
          )}

          {/* Category breakdown */}
          {summary && Object.keys(summary.by_category).length > 0 && (
            <>
              <Divider />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em",
                  textTransform: "uppercase", marginBottom: 10 }}>By Category</div>
                {cats.map(cat => {
                  const val = summary.by_category[cat.value] ?? 0;
                  if (!val) return null;
                  const pct = summary.total > 0 ? val / summary.total : 0;
                  const color = catColor(cat.value);
                  return (
                    <div key={cat.value} style={{ marginBottom: 9 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: T.t4 }}>{cat.label}</span>
                        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{fmtINR(val)}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 99, background: T.panel2B }}>
                        <div style={{ height: "100%", borderRadius: 99, background: color,
                          width: `${pct * 100}%`, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {hasFilter && (
            <>
              <Divider />
              <button
                onClick={clearAll}
                style={{
                  background: "transparent", border: `1px solid ${T.panel2B}`,
                  borderRadius: 8, padding: "7px 0", fontSize: 12, color: T.t4,
                  cursor: "pointer", width: "100%", transition: "color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
              >
                ✕ &nbsp;Clear all filters
              </button>
            </>
          )}
        </div>

        {/* ── RIGHT: Table ── */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, overflow: "hidden",
        }}>
          {error && (
            <div style={{ padding: "16px 20px", color: T.red, fontSize: 13,
              background: T.redBg, borderBottom: `1px solid ${T.divider}` }}>
              ⚠ {error}
            </div>
          )}

          <div className="tbl-wrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: `1px solid ${T.panel2B}` }}>
                  <ThCell field="date"       w={112} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Date</ThCell>
                  <ThCell field="user"       w={140} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Member</ThCell>
                  <ThCell field="org"        w={130} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Org</ThCell>
                  <ThCell field="project"    w={140} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Project</ThCell>
                  <ThCell field="category"   w={120} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Category</ThCell>
                  <ThCell field="amount"     w={100} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Amount</ThCell>
                  <th style={{ padding: 0, whiteSpace: "nowrap" }}>
                    <div style={{ padding: "10px 12px 6px", fontSize: 10.5, fontWeight: 600,
                      color: T.t5, letterSpacing: "0.07em", textTransform: "uppercase" }}>Remarks</div>
                  </th>
                  <ThCell field="reimbursed" w={90} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Status</ThCell>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : sortedRows.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", minHeight: 220, gap: 12, color: T.t6 }}>
                      <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
                        <rect x={2} y={5} width={20} height={14} rx={2}/>
                        <path d="M2 10h20"/>
                      </svg>
                      <span style={{ fontSize: 13.5 }}>No expenses for this selection</span>
                    </div>
                  </td></tr>
                ) : (
                  sortedRows.map(row => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: `1px solid ${T.divider}`,
                        transition: "background 0.12s",
                        animation: "fadeIn 0.2s ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.rowHov; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "9px 12px", fontSize: 12, color: T.t3, whiteSpace: "nowrap" }}>
                        {row.date}
                      </td>

                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: T.acLight, color: T.acText,
                            fontSize: 9, fontWeight: 700, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {row.user_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, color: T.t2, whiteSpace: "nowrap" }}>{row.user_name}</span>
                        </div>
                      </td>

                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ fontSize: 11.5, color: T.t4, whiteSpace: "nowrap" }}>
                          {row.organisation_name}
                        </span>
                      </td>

                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ fontSize: 12, color: T.t2, whiteSpace: "nowrap" }}>
                          {row.project_name}
                        </span>
                      </td>

                      <td style={{ padding: "9px 12px" }}>
                        <CategoryBadge category={row.category} label={row.category_label} />
                      </td>

                      <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>
                          {fmtINR(row.amount)}
                        </span>
                      </td>

                      <td style={{ padding: "9px 12px", maxWidth: 180 }}>
                        <span style={{
                          fontSize: 11.5, color: T.t4,
                          display: "block", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {row.remarks || <span style={{ color: T.t6 }}>—</span>}
                        </span>
                      </td>

                      <td style={{ padding: "9px 12px", textAlign: "center" }}>
                        <ReimbursedBadge reimbursed={row.reimbursed} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {data && data.count > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderTop: `1px solid ${T.divider}`,
              background: "rgba(255,255,255,0.012)", flexWrap: "wrap", gap: 8,
            }}>
              <span style={{ fontSize: 11.5, color: T.t5, whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ color: T.t3, fontWeight: 600 }}>
                  {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)}
                </span>
                {" "}of{" "}
                <span style={{ color: T.t3, fontWeight: 600 }}>{data.count}</span> expenses
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.panel2B}`,
                    background: page === 1 ? "transparent" : T.panel2,
                    color: page === 1 ? T.t6 : T.t4,
                    cursor: page === 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}
                >‹</button>

                {(() => {
                  const pages: (number | "…")[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (page > 3) pages.push("…");
                    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                    if (page < totalPages - 2) pages.push("…");
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} style={{ width: 30, textAlign: "center", fontSize: 12, color: T.t5 }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p as number)} style={{
                        width: 30, height: 30, borderRadius: 8, border: "none",
                        background: page === p ? T.ac : T.panel2,
                        color: page === p ? "#fff" : T.t4,
                        fontWeight: page === p ? 700 : 400,
                        cursor: "pointer", fontSize: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'DM Sans',sans-serif",
                      }}>{p}</button>
                    ),
                  );
                })()}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.panel2B}`,
                    background: page === totalPages ? "transparent" : T.panel2,
                    color: page === totalPages ? T.t6 : T.t4,
                    cursor: page === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}
                >›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}