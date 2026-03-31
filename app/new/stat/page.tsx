/* eslint-disable @typescript-eslint/no-explicit-any */

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
  type CreditRow,
  type RevenueRow,
  type ExpenseRow,
} from "@/app/new/revenueExpenseApi";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDay(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}
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
  purple: "#9b79f5",
  purpleBg: "rgba(155,121,245,0.09)",
  teal: "#2ec4b6",
};

const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalGrid({
  year,
  month,
  selDates,
  activeDates,
  rangeFrom,
  rangeTo,
  onToggle,
}: {
  year: number;
  month: number;
  selDates: Set<string>;
  activeDates: Set<string>;
  rangeFrom: string;
  rangeTo: string;
  onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
      {DAYS.map((d) => (
        <div
          key={d}
          style={{
            textAlign: "center",
            fontSize: 9,
            color: T.t5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            paddingBottom: 5,
            textTransform: "uppercase",
          }}
        >
          {d}
        </div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const sel = selDates.has(iso);
        const has = activeDates.has(iso);
        const isToday = iso === today;
        const inRange = rangeFrom && rangeTo && iso >= rangeFrom && iso <= rangeTo;
        const isRangeStart = rangeFrom && iso === rangeFrom;
        const isRangeEnd = rangeTo && iso === rangeTo;

        return (
          <button
            key={iso}
            onClick={() => onToggle(iso)}
            style={{
              background: sel
                ? T.ac
                : isRangeStart || isRangeEnd
                ? T.ac
                : inRange
                ? T.acLight
                : "transparent",
              border: `1.5px solid ${sel || isRangeStart || isRangeEnd ? T.ac : isToday ? T.acMid : "transparent"}`,
              borderRadius: 6,
              cursor: "pointer",
              color: sel || isRangeStart || isRangeEnd ? "#fff" : inRange ? T.acText : has ? T.t2 : T.t5,
              fontSize: 11,
              padding: "5px 0",
              width: "100%",
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: sel || isRangeStart || isRangeEnd ? 700 : 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              transition: "all 0.12s",
              boxShadow: sel ? `0 2px 8px ${T.acGlow}` : "none",
            }}
          >
            {day}
            {has && (
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: sel ? "#fff" : T.acText,
                  opacity: 0.8,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
const Divider = () => <div style={{ height: 1, background: T.divider }} />;

function FSel({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: T.t5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          background: disabled ? "rgba(255,255,255,0.02)" : T.panel2,
          border: `1px solid ${T.panel2B}`,
          borderRadius: 7,
          padding: "8px 32px 8px 10px",
          fontSize: 12,
          color: disabled ? T.t5 : T.t2,
          outline: "none",
          fontFamily: "'DM Sans',sans-serif",
          cursor: disabled ? "not-allowed" : "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2339475a'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "calc(100% - 10px) center",
          transition: "all 0.12s",
          minHeight: 40,
        }}
      >
        {children}
      </select>
    </div>
  );
}

// ─── FIXED: minWidth:0 + overflow:hidden on wrapper so "To" picker never overflows
function DateInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: T.t5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        style={{
          width: "100%",
          minWidth: 0,
          background: T.panel2,
          border: `1px solid ${value ? T.acMid : T.panel2B}`,
          borderRadius: 7,
          padding: "7px 6px",
          fontSize: 11,
          color: value ? T.t2 : T.t5,
          outline: "none",
          fontFamily: "'DM Sans',sans-serif",
          cursor: "pointer",
          colorScheme: "dark",
          minHeight: 36,
          transition: "border-color 0.15s",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function CatBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px 2px 6px",
        borderRadius: 5,
        background: color + "18",
        border: `1px solid ${color}30`,
        fontSize: 10.5,
        fontWeight: 600,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function RepaidBadge({ repaid, date }: { repaid: boolean; date?: string | null }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 5,
        background: repaid ? T.greenBg : T.amberBg,
        border: `1px solid ${repaid ? T.green + "30" : T.amber + "30"}`,
        color: repaid ? T.green : T.amber,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}
    >
      {repaid ? `✓ Repaid${date ? ` · ${date}` : ""}` : "Outstanding"}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(" ")
    .map((w: string) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: T.acLight,
        border: `1px solid ${T.acMid}`,
        color: T.acText,
        fontSize: 8,
        fontWeight: 700,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          borderRadius: 99,
          background: color,
          width: `${Math.min(100, pct)}%`,
          transition: "width 0.5s",
          boxShadow: `0 0 6px ${color}60`,
        }}
      />
    </div>
  );
}

function TableSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: `1px solid ${T.divider}` }}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} style={{ padding: "10px 12px" }}>
              <div
                style={{
                  height: 11,
                  width: [90, 120, 100, 80, 110][j % 5],
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.05)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function DetailTable({
  accentColor,
  accentBg,
  icon,
  title,
  count,
  headers,
  loading,
  empty,
  children,
}: {
  accentColor: string;
  accentBg: string;
  icon: string;
  title: string;
  count?: number;
  headers: { label: string; right?: boolean }[];
  loading: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${T.panel2B}`, overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${T.divider}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: accentBg,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: accentColor, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {title}
        </span>
        {count !== undefined && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: T.t4 }}>
            {count} {count === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
              {headers.map((h) => (
                <th
                  key={h.label}
                  style={{
                    padding: "8px 12px",
                    textAlign: h.right ? "right" : "left",
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.t5,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <TableSkeleton cols={headers.length} /> : children}
            {!loading && count === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ padding: "32px 16px", textAlign: "center", color: T.t6, fontSize: 12 }}>
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────
function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s",
        }}
      />
      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
          width: "min(85vw, 300px)",
          background: "#0d0f1c",
          borderRight: `1px solid ${T.panelB}`,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.28s cubic-bezier(0.32,0,0.25,1)",
          boxShadow: open ? "8px 0 40px rgba(0,0,0,0.6)" : "none",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 14px 12px",
            borderBottom: `1px solid ${T.divider}`,
            position: "sticky", top: 0, background: "#0d0f1c", zIndex: 1,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: T.t3, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Filters & Calendar
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: T.panel2, border: `1px solid ${T.panel2B}`,
              color: T.t4, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RevenueExpensePage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw] = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 780;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => {
    fetchOrganisations().then(setOrgs).catch(console.error);
  }, []);

  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [usersInOrg, setUsersInOrg] = useState<Array<{ id: number; name: string; role: string }>>([]);

  useEffect(() => {
    if (selectedOrg) {
      fetchProjectsByOrg(selectedOrg).then(setProjects).catch(console.error);
    } else {
      setProjects([]);
      setSelectedProject(null);
    }
  }, [selectedOrg]);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number>(new Date().getFullYear());

  // ─── Date Range state ──────────────────────────────────────────────────────
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  // Track which filter mode is active: "calendar" | "month" | "range" | "none"
  const [filterMode, setFilterMode] = useState<"calendar" | "month" | "range" | "none">("none");

  // When range inputs change, switch mode to "range"
  const handleRangeFrom = useCallback((v: string) => {
    setRangeFrom(v);
    if (v) {
      setFilterMode("range");
      setSelDates(new Set());
      setSelMonth(null);
    } else if (!rangeTo) {
      setFilterMode("none");
    }
  }, [rangeTo]);

  const handleRangeTo = useCallback((v: string) => {
    setRangeTo(v);
    if (v) {
      setFilterMode("range");
      setSelDates(new Set());
      setSelMonth(null);
    } else if (!rangeFrom) {
      setFilterMode("none");
    }
  }, [rangeFrom]);

  const [tab, setTab] = useState<"summary" | "details">("summary");

  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute effective dateFrom / dateTo for display banners and calendar-mode API calls only.
  // filterMode === "month" uses year+month params directly (not from/to).
  const { dateFrom, dateTo } = useMemo(() => {
    if (filterMode === "range") {
      return { dateFrom: rangeFrom, dateTo: rangeTo };
    }
    if (filterMode === "calendar" && selDates.size > 0) {
      const sorted = Array.from(selDates).sort();
      return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
    }
    return { dateFrom: "", dateTo: "" };
  }, [filterMode, rangeFrom, rangeTo, selDates]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);

    // Build params based on active filter mode — modes are mutually exclusive
    const params: BalanceSheetParams = {
      organisation_id: selectedOrg || undefined,
      project_id: selectedProject || undefined,
      user_id: selectedUser || undefined,
      view_all: true,
    };

    if (filterMode === "range") {
      // Date range: only send from/to, no year/month
      if (rangeFrom) params.from = rangeFrom;
      if (rangeTo) params.to = rangeTo;
    } else if (filterMode === "month") {
      // Quick month: send year + month, no from/to
      params.year = selYear;
      params.month = selMonth !== null ? selMonth + 1 : undefined; // backend expects 1-12
    } else if (filterMode === "calendar") {
      // Specific calendar dates: send from/to derived from selected dates, no year/month
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
    } else {
      // No date filter: send only year (default view)
      params.year = selYear;
    }

    fetchBalanceSheet(params)
      .then((d) => {
        setData(d);
        setUsersInOrg((d as any).meta?.users_in_org || []);
        const dates = new Set<string>([
          ...(d.revenues || []).map((r: RevenueRow) => r.date),
          ...(d.expenses || []).map((e: ExpenseRow) => e.date),
          ...(d.credits || []).map((c: CreditRow) => c.date),
        ]);
        setActiveDates(dates);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterMode, selYear, selMonth, rangeFrom, rangeTo, selectedOrg, selectedProject, selectedUser, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const revenues = useMemo(() => data?.revenues || [], [data?.revenues]);
  const credits = useMemo(() => data?.credits || [], [data?.credits]);
  const expenses = useMemo(() => data?.expenses || [], [data?.expenses]);

  const totalCredit = credits.reduce((s, c) => s + c.amount, 0);
  const outstandingCredit = credits.filter((c) => !c.is_repaid).reduce((s, c) => s + c.amount, 0);
  const repaidCredit = credits.filter((c) => c.is_repaid).reduce((s, c) => s + c.amount, 0);
  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const nonReimbursedExpenses = expenses.filter((e) => !e.reimbursed).reduce((s, e) => s + e.amount, 0);
  const balanceWithoutCredit = totalRevenue - totalExpenses;
  const balanceWithCredit = totalRevenue - nonReimbursedExpenses + outstandingCredit;

  const userBalance = useMemo(() => {
    if (!selectedUser || !data) return null;
    const userRevenues = revenues.filter((r) => r.user === selectedUser);
    const userTotalRevenue = userRevenues.reduce((s, r) => s + r.amount, 0);
    const userExpenses = expenses.filter((e) => e.user_id === selectedUser);
    const userNonReimbursedExpenses = userExpenses.filter((e) => !e.reimbursed).reduce((s, e) => s + e.amount, 0);
    const userReimbursedExpenses = userExpenses.filter((e) => e.reimbursed).reduce((s, e) => s + e.amount, 0);
    const userCredits = credits.filter((c) => c.user === selectedUser);
    const userTotalCredits = userCredits.reduce((s, c) => s + c.amount, 0);
    const userOutstandingCredits = userCredits.filter((c) => !c.is_repaid).reduce((s, c) => s + c.amount, 0);
    const balance = userTotalRevenue + userTotalCredits - userNonReimbursedExpenses;
    return {
      balance,
      isPositive: balance >= 0,
      userTotalRevenue,
      userTotalCredits,
      userOutstandingCredits,
      userNonReimbursedExpenses,
      userReimbursedExpenses,
      owesToCompany: balance > 0,
      companyOwesUser: balance < 0,
    };
  }, [selectedUser, data, revenues, expenses, credits]);

  const creditByCat = useMemo(() => {
    const map: Record<string, number> = {};
    credits.forEach((c) => { map[c.category_display] = (map[c.category_display] ?? 0) + c.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [credits]);

  const revenueByUser = useMemo(() => {
    const map: Record<number, { name: string; amount: number }> = {};
    revenues.forEach((r) => {
      const userName = (r as any).user_name || (r as any).user_email || `User ${r.user}`;
      if (!map[r.user]) map[r.user] = { name: userName, amount: 0 };
      map[r.user].amount += r.amount;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [revenues]);

  const TABS: { key: "summary" | "details"; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "details", label: "Detailed View" },
  ];

  function clearAll() {
    setSelDates(new Set());
    setSelMonth(null);
    setRangeFrom("");
    setRangeTo("");
    setFilterMode("none");
    setSelectedOrg(null);
    setSelectedProject(null);
    setSelectedUser(null);
  }

  function clearDateFilters() {
    setSelDates(new Set());
    setSelMonth(null);
    setRangeFrom("");
    setRangeTo("");
    setFilterMode("none");
  }

  const hasFilter =
    filterMode !== "none" ||
    !!selectedOrg ||
    !!selectedProject ||
    !!selectedUser;

  function toggleDate(iso: string) {
    setFilterMode("calendar");
    setRangeFrom("");
    setRangeTo("");
    setSelMonth(null);
    setSelDates((p) => {
      const n = new Set(p);
      if (n.has(iso)) { n.delete(iso); } else { n.add(iso); }
      if (n.size === 0) setFilterMode("none");
      return n;
    });
  }

  function selectMonth(idx: number) {
    if (selMonth === idx && filterMode === "month") {
      setSelMonth(null);
      setFilterMode("none");
    } else {
      setSelMonth(idx);
      setFilterMode("month");
      setSelDates(new Set());
      setRangeFrom("");
      setRangeTo("");
    }
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  const activeFilterCount = [
    filterMode !== "none",
    !!selectedOrg,
    !!selectedProject,
    !!selectedUser,
  ].filter(Boolean).length;

  // ─── Date range label for display ──────────────────────────────────────────
  const rangeLabelShort = useMemo(() => {
    if (filterMode === "range") {
      if (rangeFrom && rangeTo) return `${fmtDateDisplay(rangeFrom)} – ${fmtDateDisplay(rangeTo)}`;
      if (rangeFrom) return `From ${fmtDateDisplay(rangeFrom)}`;
      if (rangeTo) return `Until ${fmtDateDisplay(rangeTo)}`;
    }
    return "";
  }, [filterMode, rangeFrom, rangeTo]);

  const SidebarContent = () => (
    <>
      {/* ─── Date Range Picker ─────────────────────────────────── */}
      <div style={{ padding: "14px 14px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase" }}>
            Date Range
          </div>
          {filterMode === "range" && (rangeFrom || rangeTo) && (
            <button
              onClick={clearDateFilters}
              style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 11, padding: "1px 4px" }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* ─── FIXED: overflow:hidden prevents "To" picker from escaping ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, overflow: "hidden" }}>
          <DateInput
            label="From"
            value={filterMode === "range" ? rangeFrom : ""}
            onChange={handleRangeFrom}
            max={filterMode === "range" && rangeTo ? rangeTo : undefined}
          />
          <DateInput
            label="To"
            value={filterMode === "range" ? rangeTo : ""}
            onChange={handleRangeTo}
            min={filterMode === "range" && rangeFrom ? rangeFrom : undefined}
          />
        </div>

        {filterMode === "range" && (rangeFrom || rangeTo) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: T.acLight,
              borderRadius: 6,
              padding: "5px 9px",
              border: `1px solid ${T.acMid}`,
            }}
          >
            <span style={{ fontSize: 10, color: T.acText, fontWeight: 600, flex: 1 }}>
              📅 {rangeLabelShort}
            </span>
          </div>
        )}
      </div>

      <Divider />

      {/* ─── Calendar ─────────────────────────────────────────── */}
      <div style={{ padding: "14px 14px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <button
            onClick={prevMonth}
            style={{
              width: 30, height: 30, borderRadius: 6,
              background: T.panel2, border: `1px solid ${T.panel2B}`,
              color: T.t4, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}
          >
            ‹
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.t2 }}>{MONTHS[calMonth]}</div>
            <div style={{ fontSize: 10, color: T.t5, marginTop: 1 }}>{calYear}</div>
          </div>
          <button
            onClick={nextMonth}
            style={{
              width: 30, height: 30, borderRadius: 6,
              background: T.panel2, border: `1px solid ${T.panel2B}`,
              color: T.t4, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}
          >
            ›
          </button>
        </div>

        <CalGrid
          year={calYear}
          month={calMonth}
          selDates={filterMode === "calendar" ? selDates : new Set<string>()}
          activeDates={activeDates}
          rangeFrom={filterMode === "range" ? rangeFrom : ""}
          rangeTo={filterMode === "range" ? rangeTo : ""}
          onToggle={toggleDate}
        />

        {filterMode === "calendar" && selDates.size > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: T.acLight,
              borderRadius: 6,
              padding: "5px 9px",
            }}
          >
            <span style={{ fontSize: 10.5, color: T.acText, fontWeight: 600 }}>
              {selDates.size} date{selDates.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={clearDateFilters}
              style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 14, padding: "2px 4px" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <Divider />

      {/* ─── Quick Month ───────────────────────────────────────── */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 8 }}>
          Quick Month
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3 }}>
          {MONTHS.map((m, i) => {
            const monthActive = filterMode === "month" && selMonth === i;
            const dimmed = filterMode === "range" || filterMode === "calendar";
            return (
              <button
                key={m}
                onClick={() => selectMonth(i)}
                style={{
                  background: monthActive ? T.acLight : "transparent",
                  border: `1px solid ${monthActive ? T.acMid : T.divider}`,
                  borderRadius: 5,
                  color: monthActive ? T.acText : T.t5,
                  fontSize: 10,
                  padding: "6px 0",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: monthActive ? 700 : 400,
                  minHeight: 32,
                  opacity: dimmed ? 0.4 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Year ─────────────────────────────────────────────── */}
      <div style={{ padding: "0 14px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 8 }}>
          Year
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {AVAILABLE_YEARS.map((y) => {
            const yearActive = selYear === y && (filterMode === "month" || filterMode === "none");
            return (
              <button
                key={y}
                onClick={() => setSelYear(y)}
                style={{
                  flex: "1 1 0",
                  background: yearActive ? T.acLight : "transparent",
                  border: `1px solid ${yearActive ? T.acMid : T.divider}`,
                  borderRadius: 5,
                  color: yearActive ? T.acText : T.t5,
                  fontSize: 10,
                  padding: "6px 0",
                  cursor: "pointer",
                  fontWeight: yearActive ? 700 : 400,
                  minHeight: 32,
                  opacity: filterMode === "range" || filterMode === "calendar" ? 0.4 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ─── Filters ──────────────────────────────────────────── */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase" }}>
          Filters
        </div>

        <FSel
          label="Organisation"
          value={selectedOrg ? String(selectedOrg) : ""}
          onChange={(v) => {
            setSelectedOrg(v ? Number(v) : null);
            setSelectedProject(null);
            setSelectedUser(null);
          }}
        >
          <option value="">All organisations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </FSel>

        <FSel
          label="Project"
          value={selectedProject ? String(selectedProject) : ""}
          onChange={(v) => setSelectedProject(v ? Number(v) : null)}
          disabled={!selectedOrg}
        >
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FSel>

        <FSel
          label="User"
          value={selectedUser ? String(selectedUser) : ""}
          onChange={(v) => setSelectedUser(v ? Number(v) : null)}
          disabled={!selectedOrg}
        >
          <option value="">All users</option>
          {usersInOrg.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </FSel>
      </div>

      {/* ─── Overview ─────────────────────────────────────────── */}
      {data && (
        <>
          <Divider />
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 10 }}>
              Overview
            </div>

            {[
              { label: "Revenue", val: totalRevenue, color: T.green, signed: false },
              { label: "Expenses", val: totalExpenses, color: T.red, signed: false },
              { label: "Credits", val: totalCredit, color: T.purple, signed: false },
              { label: "Outstanding Credits", val: outstandingCredit, color: T.amber, signed: false },
              { label: "Non-Reimbursed Expenses", val: nonReimbursedExpenses, color: T.red, signed: false },
              { label: "Net (with Credit)", val: balanceWithCredit, color: balanceWithCredit >= 0 ? T.green : T.red, signed: true },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 5, padding: "5px 8px", borderRadius: 6, background: s.color + "0d",
                }}
              >
                <span style={{ fontSize: 11, color: T.t4 }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                  {s.signed ? (s.val >= 0 ? "+" : "−") : ""}{fmtINR(Math.abs(s.val))}
                </span>
              </div>
            ))}

            {selectedUser && userBalance && (
              <div
                style={{
                  marginTop: 12, padding: "10px 12px", borderRadius: 8,
                  background: userBalance.isPositive ? T.greenBg : T.redBg,
                  border: `1px solid ${userBalance.isPositive ? T.green + "30" : T.red + "30"}`,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  User Balance Analysis
                </div>
                {[
                  { label: "Revenue Collected:", val: userBalance.userTotalRevenue, color: T.green },
                  { label: "Credits Taken:", val: userBalance.userTotalCredits, color: T.purple },
                  { label: "Non-Reimbursed Expenses:", val: userBalance.userNonReimbursedExpenses, color: T.red },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, color: T.t4 }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: row.color }}>{fmtINR(row.val)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 4, borderTop: `1px solid ${T.divider}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.t3 }}>Net Balance:</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: userBalance.isPositive ? T.green : T.red }}>
                    {userBalance.isPositive ? "+" : "−"}{fmtINR(Math.abs(userBalance.balance))}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: userBalance.isPositive ? T.green : T.red, fontWeight: 600, textAlign: "center", marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.divider}` }}>
                  {userBalance.owesToCompany
                    ? `💰 User owes company ${fmtINR(userBalance.balance)}`
                    : userBalance.companyOwesUser
                    ? `💸 Company owes user ${fmtINR(Math.abs(userBalance.balance))}`
                    : "✅ Balanced"}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
                Balance Comparison
              </div>
              {[
                { label: "Without Credit (P&L):", val: balanceWithoutCredit },
                { label: "With Credit (Asset):", val: balanceWithCredit },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, color: T.t4 }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: row.val >= 0 ? T.green : T.red }}>
                    {row.val >= 0 ? "+" : "−"}{fmtINR(Math.abs(row.val))}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <ProgressBar pct={totalExpenses > 0 ? (nonReimbursedExpenses / totalExpenses) * 100 : 0} color={T.amber} />
                <div style={{ fontSize: 8, color: T.t6, marginTop: 4, textAlign: "center" }}>
                  {totalExpenses > 0 ? ((nonReimbursedExpenses / totalExpenses) * 100).toFixed(0) : 0}% of expenses not reimbursed
                </div>
              </div>
            </div>

            {(data.summary?.revenue_by_source?.length ?? 0) > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
                  Revenue by Source
                </div>
                {data.summary.revenue_by_source.map((item: { source: string; total: number }) => (
                  <div key={item.source} style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10.5, color: T.t4 }}>{item.source}</span>
                      <span style={{ fontSize: 10.5, color: T.green, fontWeight: 600 }}>{fmtINR(item.total)}</span>
                    </div>
                    <ProgressBar pct={totalRevenue > 0 ? (item.total / totalRevenue) * 100 : 0} color={T.green} />
                  </div>
                ))}
              </div>
            )}

            {revenueByUser.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
                  Top Contributors
                </div>
                {revenueByUser.slice(0, 3).map((user) => (
                  <div key={user.name} style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10.5, color: T.t4 }}>{user.name}</span>
                      <span style={{ fontSize: 10.5, color: T.green, fontWeight: 600 }}>{fmtINR(user.amount)}</span>
                    </div>
                    <ProgressBar pct={totalRevenue > 0 ? (user.amount / totalRevenue) * 100 : 0} color={T.green} />
                  </div>
                ))}
              </div>
            )}

            {(data.summary?.expenses_by_category?.length ?? 0) > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
                  Expenses by Category
                </div>
                {data.summary.expenses_by_category.map((item: { category: string; total: number }) => (
                  <div key={item.category} style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10.5, color: T.t4 }}>{item.category}</span>
                      <span style={{ fontSize: 10.5, color: T.red, fontWeight: 600 }}>{fmtINR(item.total)}</span>
                    </div>
                    <ProgressBar pct={totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0} color={T.red} />
                  </div>
                ))}
              </div>
            )}

            {creditByCat.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
                  Credits by Category
                </div>
                {creditByCat.map(([cat, val]) => (
                  <div key={cat} style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 10.5, color: T.t4 }}>{cat}</span>
                      <span style={{ fontSize: 10.5, color: T.purple, fontWeight: 600 }}>{fmtINR(val)}</span>
                    </div>
                    <ProgressBar pct={totalCredit > 0 ? (val / totalCredit) * 100 : 0} color={T.purple} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {hasFilter && (
        <>
          <Divider />
          <div style={{ padding: "10px 14px 20px" }}>
            <button
              onClick={() => { clearAll(); setDrawerOpen(false); }}
              style={{
                width: "100%",
                background: "transparent",
                border: `1px solid ${T.divider}`,
                borderRadius: 7,
                padding: "8px 0",
                fontSize: 11,
                color: T.t5,
                cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
                transition: "all 0.12s",
                minHeight: 38,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = T.red;
                (e.currentTarget as HTMLElement).style.borderColor = T.red + "40";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = T.t5;
                (e.currentTarget as HTMLElement).style.borderColor = T.divider;
              }}
            >
              ✕ &nbsp;Clear all filters
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.t2,
        fontFamily: "'DM Sans','Sora',sans-serif",
        padding: isMobile
          ? "env(safe-area-inset-top, 18px) env(safe-area-inset-right, 12px) env(safe-area-inset-bottom, 80px) env(safe-area-inset-left, 12px)"
          : "28px 24px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Sora:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(76,124,243,0.25);border-radius:99px;}
        select option{background:#0d0f1c;color:#d8e0f0;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5) sepia(1) saturate(2) hue-rotate(180deg);cursor:pointer;opacity:0.7;}
        input[type="date"]::-webkit-calendar-picker-indicator:hover{opacity:1;}
        @keyframes pulse{0%,100%{opacity:.35}50%{opacity:.75}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        .trow{transition:background 0.1s;}
        .trow:hover{background:rgba(255,255,255,0.025)!important;}
        button { touch-action: manipulation; }
        html { -webkit-text-size-adjust: 100%; }
      `}</style>

      {isMobile && (
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <SidebarContent />
        </MobileDrawer>
      )}

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34, height: 34, flexShrink: 0, borderRadius: 9,
              background: `linear-gradient(135deg, ${T.acLight}, ${T.acGlow})`,
              border: `1px solid ${T.acMid}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 20px ${T.acGlow}`,
            }}
          >
            <svg width={15} height={15} viewBox="0 0 20 20" fill="none">
              <path d="M3 10h14M3 6h14M3 14h8" stroke={T.acText} strokeWidth={1.7} strokeLinecap="round" />
              <circle cx={15} cy={14} r={3} stroke={T.acText} strokeWidth={1.5} />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: isMobile ? 16 : 21,
                fontWeight: 700,
                fontFamily: "'Sora',sans-serif",
                letterSpacing: "-0.035em",
                color: T.t1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Revenue & Expense
            </h1>
            {!isMobile && <p style={{ color: T.t5, fontSize: 11.5, marginTop: 1 }}>Financial balance sheet · all users</p>}
          </div>
        </div>

        {isMobile ? (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
              background: T.panel, border: `1px solid ${T.panelB}`,
              borderRadius: 8, padding: "7px 12px",
              color: T.t3, fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", position: "relative",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  position: "absolute", top: -5, right: -5,
                  background: T.ac, color: "#fff",
                  width: 16, height: 16, borderRadius: "50%",
                  fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${T.bg}`,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        ) : (
          data && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {[
                { label: "Revenue", val: fmtINR(totalRevenue), color: T.green },
                { label: "Expenses", val: fmtINR(totalExpenses), color: T.red },
                { label: "Credits", val: fmtINR(totalCredit), color: T.purple },
                { label: "Net", val: (balanceWithCredit >= 0 ? "+" : "−") + fmtINR(Math.abs(balanceWithCredit)), color: balanceWithCredit >= 0 ? T.green : T.red },
              ].map((s) => (
                <div key={s.label} style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: T.t5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.val}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ─── Mobile summary cards ──────────────────────────────────────────── */}
      {isMobile && data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Revenue", val: fmtINR(totalRevenue), color: T.green },
            { label: "Expenses", val: fmtINR(totalExpenses), color: T.red },
            { label: "Credits", val: fmtINR(totalCredit), color: T.purple },
            { label: "Net (incl. Credit)", val: (balanceWithCredit >= 0 ? "+" : "−") + fmtINR(Math.abs(balanceWithCredit)), color: balanceWithCredit >= 0 ? T.green : T.red },
          ].map((s) => (
            <div key={s.label} style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: T.t5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "260px 1fr", gap: 14, alignItems: "start" }}>
        {/* ─── Desktop Sidebar ─────────────────────────────────────────────── */}
        {!isMobile && (
          <div
            style={{
              background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 14,
              overflow: "hidden", display: "flex", flexDirection: "column",
              position: "sticky", top: 20,
              maxHeight: "calc(100vh - 40px)", overflowY: "auto",
            }}
          >
            <SidebarContent />
          </div>
        )}

        {/* ─── Main content ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {error && (
            <div style={{ padding: "11px 16px", color: T.red, fontSize: 12.5, background: T.redBg, borderRadius: 10, border: `1px solid ${T.red}30`, wordBreak: "break-word" }}>
              ⚠ {error}
            </div>
          )}

          {/* ─── Active filter chips (mobile) ─────────────────────────────── */}
          {isMobile && hasFilter && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {filterMode === "range" && (rangeFrom || rangeTo) && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: T.acLight, border: `1px solid ${T.acMid}`,
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 11, color: T.acText, fontWeight: 600,
                  }}
                >
                  📅 {rangeLabelShort}
                  <button onClick={clearDateFilters} style={{ background: "none", border: "none", color: T.acText, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {filterMode === "month" && selMonth !== null && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: T.acLight, border: `1px solid ${T.acMid}`,
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 11, color: T.acText, fontWeight: 600,
                  }}
                >
                  {MONTHS[selMonth]} {selYear}
                  <button onClick={clearDateFilters} style={{ background: "none", border: "none", color: T.acText, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {filterMode === "calendar" && selDates.size > 0 && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: T.acLight, border: `1px solid ${T.acMid}`,
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 11, color: T.acText, fontWeight: 600,
                  }}
                >
                  {selDates.size} date{selDates.size > 1 ? "s" : ""}
                  <button onClick={clearDateFilters} style={{ background: "none", border: "none", color: T.acText, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {selectedOrg && orgs.find((o) => o.id === selectedOrg) && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: T.acLight, border: `1px solid ${T.acMid}`,
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 11, color: T.acText, fontWeight: 600,
                  }}
                >
                  {orgs.find((o) => o.id === selectedOrg)?.name}
                  <button
                    onClick={() => { setSelectedOrg(null); setSelectedProject(null); setSelectedUser(null); }}
                    style={{ background: "none", border: "none", color: T.acText, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}
                  >✕</button>
                </span>
              )}
              <button
                onClick={clearAll}
                style={{ background: "none", border: `1px solid ${T.red}40`, borderRadius: 20, padding: "3px 10px", fontSize: 11, color: T.red, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* ─── Tab panel ──────────────────────────────────────────────────── */}
          <div style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${T.divider}`, padding: "10px 14px 0", gap: 4 }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: isMobile ? 1 : "none",
                    padding: isMobile ? "9px 8px" : "7px 16px",
                    borderRadius: "7px 7px 0 0",
                    border: `1px solid ${tab === t.key ? T.panelB : "transparent"}`,
                    borderBottom: tab === t.key ? `1px solid ${T.bg}` : "1px solid transparent",
                    background: tab === t.key ? T.panel2 : "transparent",
                    color: tab === t.key ? T.t2 : T.t5,
                    fontSize: isMobile ? 12 : 11.5,
                    fontWeight: tab === t.key ? 600 : 400,
                    cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif",
                    marginBottom: -1,
                    transition: "all 0.12s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Summary tab ─────────────────────────────────────────────── */}
            {tab === "summary" && (
              <div style={{ padding: isMobile ? 12 : 14, display: "flex", flexDirection: "column", gap: 14 }}>
                {loading ? (
                  <>
                    {[72, 80, 200].map((h) => (
                      <div key={h} style={{ height: h, borderRadius: 10, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    ))}
                  </>
                ) : !data ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 10, color: T.t6 }}>
                    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
                      <rect x={2} y={5} width={20} height={14} rx={2} />
                      <path d="M2 10h20" />
                    </svg>
                    <span style={{ fontSize: 13 }}>No data available</span>
                  </div>
                ) : (
                  <>
                    {/* Active filter banner */}
                    {(filterMode !== "none") && (
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 14px", borderRadius: 8,
                          background: T.acLight, border: `1px solid ${T.acMid}`,
                          fontSize: 11.5, color: T.acText, fontWeight: 500,
                        }}
                      >
                        <svg width={13} height={13} viewBox="0 0 20 20" fill="none">
                          <rect x={2} y={3} width={16} height={16} rx={3} stroke={T.acText} strokeWidth={1.5} />
                          <path d="M2 8h16M6 1v4M14 1v4" stroke={T.acText} strokeWidth={1.5} strokeLinecap="round" />
                        </svg>
                        <span>
                          {filterMode === "range" && (
                            <>
                              Showing data
                              {dateFrom && dateTo
                                ? ` from ${fmtDateDisplay(dateFrom)} to ${fmtDateDisplay(dateTo)}`
                                : dateFrom
                                ? ` from ${fmtDateDisplay(dateFrom)}`
                                : ` until ${fmtDateDisplay(dateTo)}`}
                            </>
                          )}
                          {filterMode === "month" && selMonth !== null && (
                            <>Showing {MONTHS[selMonth]} {selYear}</>
                          )}
                          {filterMode === "calendar" && selDates.size > 0 && (
                            <>
                              {selDates.size === 1
                                ? `Showing ${fmtDateDisplay(Array.from(selDates)[0])}`
                                : `Showing ${selDates.size} selected dates (${fmtDateDisplay(dateFrom)} – ${fmtDateDisplay(dateTo)})`}
                            </>
                          )}
                        </span>
                        <button
                          onClick={clearDateFilters}
                          style={{ marginLeft: "auto", background: "none", border: "none", color: T.acText, cursor: "pointer", fontSize: 13, opacity: 0.7, padding: "2px 4px" }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 16px", borderRadius: 10,
                        background: balanceWithCredit >= 0 ? T.greenBg : T.redBg,
                        border: `1px solid ${balanceWithCredit >= 0 ? T.green + "30" : T.red + "30"}`,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                          background: balanceWithCredit >= 0 ? T.green + "20" : T.red + "20",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        }}
                      >
                        {balanceWithCredit >= 0 ? "↑" : "↓"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: T.t4, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                          Net Balance (with Credit)
                        </div>
                        <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: balanceWithCredit >= 0 ? T.green : T.red, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em" }}>
                          {balanceWithCredit >= 0 ? "+" : "−"}{fmtINR(Math.abs(balanceWithCredit))}
                        </div>
                      </div>
                      {outstandingCredit > 0 && (
                        <div
                          style={{
                            background: T.purpleBg, border: `1px solid ${T.purple}30`,
                            borderRadius: 8, padding: "6px 12px",
                            textAlign: isMobile ? "left" : "right",
                            width: isMobile ? "100%" : "auto",
                          }}
                        >
                          <div style={{ fontSize: 9, color: T.t5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
                            Outstanding Credit
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>{fmtINR(outstandingCredit)}</div>
                        </div>
                      )}
                    </div>

                    {credits.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                        {[
                          { label: "Total Credit", val: totalCredit, color: T.purple },
                          { label: "Outstanding", val: outstandingCredit, color: T.amber },
                          { label: "Repaid", val: repaidCredit, color: T.green },
                        ].map((s) => (
                          <div key={s.label} style={{ padding: isMobile ? "8px 10px" : "10px 12px", borderRadius: 8, background: s.color + "0d", border: `1px solid ${s.color}20` }}>
                            <div style={{ fontSize: isMobile ? 8 : 9, color: T.t5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{fmtINR(s.val)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(data.summary?.monthly_summary?.length ?? 0) > 0 && (
                      <div style={{ background: T.panel2, borderRadius: 10, border: `1px solid ${T.panel2B}`, overflow: "hidden" }}>
                        <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${T.divider}`, fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase" }}>
                          Monthly Breakdown
                        </div>
                        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
                                {["Month", "Revenue", "Expenses", "Net"].map((h, i) => (
                                  <th key={h} style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "right", fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {data.summary.monthly_summary.map((item: { month: string; revenue: number; expenses: number; net: number }, idx: number) => (
                                <tr key={idx} className="trow" style={{ borderBottom: `1px solid ${T.divider}` }}>
                                  <td style={{ padding: "9px 12px", fontSize: 12, color: T.t2, whiteSpace: "nowrap" }}>{item.month}</td>
                                  <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", color: T.green, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtINR(item.revenue)}</td>
                                  <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", color: T.red, whiteSpace: "nowrap" }}>{fmtINR(item.expenses)}</td>
                                  <td style={{ padding: "9px 12px", fontSize: 12, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: item.net >= 0 ? T.green : T.red }}>
                                    {item.net >= 0 ? "+" : "−"}{fmtINR(Math.abs(item.net))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ─── Details tab ─────────────────────────────────────────────── */}
            {tab === "details" && (
              <div style={{ padding: isMobile ? 10 : 14, display: "flex", flexDirection: "column", gap: 14 }}>
                <DetailTable
                  accentColor={T.green} accentBg={T.greenBg} icon="↑" title="Revenue"
                  count={revenues.length}
                  headers={[{ label: "Date" }, { label: "User" }, { label: "Source" }, { label: "Amount", right: true }, { label: "Remarks" }]}
                  loading={loading} empty="No revenue entries"
                >
                  {revenues.map((r: RevenueRow, idx: number) => {
                    const userName = (r as any).user_name || (r as any).user_email || `User ${r.user}`;
                    return (
                      <tr key={r.id} className="trow" style={{ borderBottom: `1px solid ${T.divider}`, animation: `fadeUp 0.18s ease ${idx * 0.015}s both` }}>
                        <td style={{ padding: "9px 12px", fontSize: 11.5, color: T.t4, whiteSpace: "nowrap" }}>{r.date}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Avatar name={userName} />
                            <span style={{ fontSize: 11.5, color: T.t2, whiteSpace: "nowrap" }}>{userName}</span>
                          </div>
                        </td>
                        <td style={{ padding: "9px 12px" }}><CatBadge label={r.source_display} color={T.green} /></td>
                        <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.green }}>{fmtINR(r.amount)}</span>
                        </td>
                        <td style={{ padding: "9px 12px", maxWidth: 140 }}>
                          <span style={{ fontSize: 11, color: T.t4, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.remarks || <span style={{ color: T.t6 }}>—</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </DetailTable>

                <DetailTable
                  accentColor={T.red} accentBg={T.redBg} icon="↓" title="Expenses"
                  count={expenses.length}
                  headers={[{ label: "Date" }, { label: "User" }, { label: "Category" }, { label: "Amount", right: true }, { label: "Reimb." }, { label: "Remarks" }]}
                  loading={loading} empty="No expense entries"
                >
                  {expenses.map((e: ExpenseRow, idx: number) => (
                    <tr key={e.id} className="trow" style={{ borderBottom: `1px solid ${T.divider}`, animation: `fadeUp 0.18s ease ${idx * 0.015}s both` }}>
                      <td style={{ padding: "9px 12px", fontSize: 11.5, color: T.t4, whiteSpace: "nowrap" }}>{e.date}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Avatar name={e.user_name || "?"} />
                          <span style={{ fontSize: 11.5, color: T.t2, whiteSpace: "nowrap" }}>{e.user_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "9px 12px" }}><CatBadge label={e.category_label} color={T.red} /></td>
                      <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.red }}>{fmtINR(e.amount)}</span>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        {e.reimbursed
                          ? <span style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>✓</span>
                          : <span style={{ fontSize: 10, color: T.amber, fontWeight: 700 }}>✗</span>
                        }
                      </td>
                      <td style={{ padding: "9px 12px", maxWidth: 130 }}>
                        <span style={{ fontSize: 11, color: T.t4, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.remarks || <span style={{ color: T.t6 }}>—</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </DetailTable>

                <DetailTable
                  accentColor={T.purple} accentBg={T.purpleBg} icon="⟳" title="Credits Taken"
                  count={credits.length}
                  headers={[{ label: "Date" }, { label: "User" }, { label: "Category" }, { label: "Amount", right: true }, { label: "Status" }, { label: "Remarks" }]}
                  loading={loading} empty="No credit entries"
                >
                  {credits.map((c: CreditRow, idx: number) => (
                    <tr key={c.id} className="trow" style={{ borderBottom: `1px solid ${T.divider}`, animation: `fadeUp 0.18s ease ${idx * 0.015}s both` }}>
                      <td style={{ padding: "9px 12px", fontSize: 11.5, color: T.t4, whiteSpace: "nowrap" }}>{c.date}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Avatar name={c.user_email || "?"} />
                          <span style={{ fontSize: 11.5, color: T.t2, whiteSpace: "nowrap" }}>{c.user_email}</span>
                        </div>
                      </td>
                      <td style={{ padding: "9px 12px" }}><CatBadge label={c.category_display} color={T.purple} /></td>
                      <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>{fmtINR(c.amount)}</span>
                      </td>
                      <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                        <RepaidBadge repaid={c.is_repaid} date={c.repayment_date ?? undefined} />
                      </td>
                      <td style={{ padding: "9px 12px", maxWidth: 130 }}>
                        <span style={{ fontSize: 11, color: T.t4, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.remarks || <span style={{ color: T.t6 }}>—</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </DetailTable>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}