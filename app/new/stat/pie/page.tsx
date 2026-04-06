
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
import { GROUPS, GROUP_MAP, type GroupKey, type GroupDef } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];

// ─── Auto-categorisation keywords ────────────────────────────────────────────
const TECHNICAL_KEYWORDS = [
  "salary","salaries","wage","wages","payroll","project","developer","engineer",
  "engineering","freelance","contractor","dev","software","hosting","server",
  "cloud","infrastructure","license","subscription","tool","tools",
];
const OVERHEAD_KEYWORDS = [
  "food","dining","restaurant","travel","transport","cab","taxi","hotel",
  "accommodation","rent","utilities","electricity","water","internet","office",
  "supply","supplies","miscellaneous","misc","entertainment","insurance",
  "maintenance","cleaning","stationary","stationery","courier","printing",
];

function autoGroup(cat: string): GroupKey | null {
  const l = cat.toLowerCase();
  if (TECHNICAL_KEYWORDS.some((k) => l.includes(k))) return "technical";
  if (OVERHEAD_KEYWORDS.some((k) => l.includes(k))) return "overheads";
  return null;
}

const LS_KEY = "expense_category_group_map_v3";

function loadGroupMap(): Record<string, GroupKey> {
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function saveGroupMap(m: Record<string, GroupKey>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(m));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function fmtINR(n: number) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function fmtDateDisplay(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  bg:      "#07080f",
  panel:   "rgba(255,255,255,0.028)",
  panelB:  "rgba(255,255,255,0.065)",
  panel2:  "rgba(255,255,255,0.038)",
  panel2B: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.05)",
  t1: "#f0f4ff", t2: "#d8e0f0", t3: "#8a9ab8",
  t4: "#55657e", t5: "#39475a", t6: "#1f2733",
  ac:      "#4c7cf3",
  acLight: "rgba(76,124,243,0.1)",
  acMid:   "rgba(76,124,243,0.45)",
  acText:  "#7ba4ff",
  green:   "#1ec99a", greenBg: "rgba(30,201,154,0.09)",
  red:     "#f0686a", redBg:   "rgba(240,104,106,0.09)",
  amber:   "#fb923c", amberBg: "rgba(251,146,60,0.09)",
};

const Divider = () => <div style={{ height: 1, background: T.divider, flexShrink: 0 }} />;

// ─── FSel ─────────────────────────────────────────────────────────────────────
function FSel({ label, value, onChange, disabled, children }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        style={{ width: "100%", background: disabled ? "rgba(255,255,255,0.02)" : T.panel2, border: `1px solid ${T.panel2B}`, borderRadius: 7, padding: "8px 32px 8px 10px", fontSize: 12, color: disabled ? T.t5 : T.t2, outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: disabled ? "not-allowed" : "pointer", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2339475a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "calc(100% - 10px) center", minHeight: 40 }}>
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
        style={{ width: "100%", background: T.panel2, border: `1px solid ${value ? T.acMid : T.panel2B}`, borderRadius: 7, padding: "7px 6px", fontSize: 11, color: value ? T.t2 : T.t5, outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", colorScheme: "dark", minHeight: 36, boxSizing: "border-box" }} />
    </div>
  );
}

// ─── Calendar ────────────────────────────────────────────────────────────────
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
        const sel = selDates.has(iso), has = activeDates.has(iso), isToday = iso === today;
        const inRange = !!(rangeFrom && rangeTo && iso >= rangeFrom && iso <= rangeTo);
        const isEdge  = (rangeFrom && iso === rangeFrom) || (rangeTo && iso === rangeTo);
        return (
          <button key={iso} onClick={() => onToggle(iso)}
            style={{ background: sel || isEdge ? T.ac : inRange ? T.acLight : "transparent", border: `1.5px solid ${sel || isEdge ? T.ac : isToday ? T.acMid : "transparent"}`, borderRadius: 6, cursor: "pointer", color: sel || isEdge ? "#fff" : inRange ? T.acText : has ? T.t2 : T.t5, fontSize: 11, padding: "5px 0", width: "100%", fontFamily: "'DM Sans',sans-serif", fontWeight: sel || isEdge ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
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

// ─── Sub-slice type ───────────────────────────────────────────────────────────
interface SubSlice {
  label:        string;
  value:        number;
  color:        string;
  groupKey:     GroupKey;
  pctOfRevenue: number;
  idealPct:     number;
  isBalance:    boolean;
}

// ─── Donut ────────────────────────────────────────────────────────────────────
function DonutChart({
  subSlices, revenue, totalExpenses, balance, hoveredGroup, onHoverGroup,
}: {
  subSlices:     SubSlice[];
  revenue:       number;
  totalExpenses: number;
  balance:       number;
  hoveredGroup:  GroupKey | null;
  onHoverGroup:  (g: GroupKey | null) => void;
}) {
  const SIZE = 260, cx = 130, cy = 130, OR = 102, IR = 62;

  function buildArc(
    startA: number, endA: number,
    outerR: number, innerR: number,
    expandDir?: number,
    expandAmt = 0,
  ) {
    const ox = expandDir !== undefined ? cx + expandAmt * Math.cos(expandDir) : cx;
    const oy = expandDir !== undefined ? cy + expandAmt * Math.sin(expandDir) : cy;
    const ro = outerR + expandAmt;
    const ri = innerR;
    const sx = ox + ro * Math.cos(startA), sy = oy + ro * Math.sin(startA);
    const ex = ox + ro * Math.cos(endA),   ey = oy + ro * Math.sin(endA);
    const eix = ox + ri * Math.cos(endA),  eiy = oy + ri * Math.sin(endA);
    const six = ox + ri * Math.cos(startA), siy = oy + ri * Math.sin(startA);
    const large = (endA - startA) > Math.PI ? 1 : 0;
    return `M${sx} ${sy} A${ro} ${ro} 0 ${large} 1 ${ex} ${ey} L${eix} ${eiy} A${ri} ${ri} 0 ${large} 0 ${six} ${siy}Z`;
  }

  const GRO = OR + 16, GRI = OR + 11;
  const ghosts: Array<{ d: string; color: string }> = [];
  let gc = -Math.PI / 2;
  GROUPS.forEach((g) => {
    const angle = (g.idealPct / 100) * 2 * Math.PI, gap = 0.022;
    const a0 = gc + gap / 2, a1 = gc + angle - gap / 2;
    if (a1 - a0 > 0.01) { ghosts.push({ d: buildArc(a0, a1, GRO, GRI), color: g.color }); }
    gc += angle;
  });

  interface Arc { d: string; color: string; idx: number; groupKey: GroupKey; isBalance: boolean; }
  const arcs: Arc[] = [];
  let cum = -Math.PI / 2;

  subSlices.forEach((sl, i) => {
    const angle = revenue > 0 ? (sl.value / revenue) * 2 * Math.PI : 0;
    if (angle < 0.002) { cum += angle; return; }
    const isHovGroup = hoveredGroup === sl.groupKey;
    const mid = cum + angle / 2;
    const d = buildArc(
      cum, cum + angle, OR, IR,
      isHovGroup ? mid : undefined,
      isHovGroup ? (sl.isBalance ? 4 : 7) : 0,
    );
    cum += angle;
    arcs.push({ d, color: sl.color, idx: i, groupKey: sl.groupKey, isBalance: sl.isBalance });
  });

  const hovGroupDef    = hoveredGroup ? GROUP_MAP[hoveredGroup] : null;
  const hovGroupSlices = hoveredGroup ? subSlices.filter((s) => s.groupKey === hoveredGroup) : [];
  const hovGroupTotal  = hovGroupSlices.reduce((s, sl) => s + sl.value, 0);
  const hovGroupPct    = revenue > 0 ? (hovGroupTotal / revenue) * 100 : 0;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: "visible" }}>
      <defs>
        <filter id="gh2"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gg2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {ghosts.map((g, i) => (
        <path key={`g${i}`} d={g.d} fill={g.color} opacity={0.15} stroke={T.bg} strokeWidth={1} />
      ))}

      {arcs.map((arc) => {
        const isActive = hoveredGroup === null || arc.groupKey === hoveredGroup;
        return (
          <path
            key={arc.idx}
            d={arc.d}
            fill={arc.color}
            opacity={isActive ? 1 : 0.18}
            filter={isActive && hoveredGroup !== null ? (arc.isBalance ? "url(#gg2)" : "url(#gh2)") : undefined}
            stroke={T.bg}
            strokeWidth={2}
            style={{ transition: "opacity 0.15s", cursor: "pointer" }}
            onMouseEnter={() => onHoverGroup(arc.groupKey)}
            onMouseLeave={() => onHoverGroup(null)}
            onTouchStart={() => onHoverGroup(hoveredGroup === arc.groupKey ? null : arc.groupKey)}
          />
        );
      })}

      {hovGroupDef ? (
        <>
          <text x={cx} y={cy - 20} textAnchor="middle" fill={hovGroupDef.color} fontSize={20} fontWeight={800} fontFamily="'Sora',sans-serif">{hovGroupPct.toFixed(1)}%</text>
          <text x={cx} y={cy - 4}  textAnchor="middle" fill={T.t4} fontSize={8} fontWeight={700} fontFamily="'DM Sans',sans-serif" letterSpacing="1.2">OF REVENUE</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill={T.t3} fontSize={11} fontFamily="'DM Sans',sans-serif">{fmtINR(hovGroupTotal)}</text>
          <text x={cx} y={cy + 27} textAnchor="middle" fill={T.t5} fontSize={8.5} fontFamily="'DM Sans',sans-serif">{hovGroupDef.label}</text>
          <text x={cx} y={cy + 41} textAnchor="middle"
            fill={hovGroupPct <= hovGroupDef.idealPct ? T.green : T.red}
            fontSize={8.5} fontWeight={700} fontFamily="'DM Sans',sans-serif">
            {hovGroupPct <= hovGroupDef.idealPct ? "▼ under" : "▲ over"} {Math.abs(hovGroupPct - hovGroupDef.idealPct).toFixed(1)}% vs 33%
          </text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 10} textAnchor="middle" fill={T.t2} fontSize={14} fontWeight={700} fontFamily="'Sora',sans-serif">{fmtINR(totalExpenses)}</text>
          <text x={cx} y={cy + 8}  textAnchor="middle" fill={T.t5} fontSize={8} fontWeight={700} fontFamily="'DM Sans',sans-serif" letterSpacing="1">EXPENSES</text>
          <text x={cx} y={cy + 24} textAnchor="middle" fill={balance >= 0 ? T.green : T.red} fontSize={10} fontWeight={700} fontFamily="'DM Sans',sans-serif">
            {balance >= 0 ? "+" : "−"}{fmtINR(Math.abs(balance))} net
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Group Column ─────────────────────────────────────────────────────────────
function GroupColumn({
  group, categories, groupMap, assignedTotal, balanceAmount,
  revenue, onAssign, onRemove, isHovered, onHover,
}: {
  group:         GroupDef;
  categories:    string[];
  groupMap:      Record<string, GroupKey>;
  assignedTotal: number;
  balanceAmount: number;
  revenue:       number;
  onAssign:  (cat: string, grp: GroupKey) => void;
  onRemove:  (cat: string) => void;
  isHovered: boolean;
  onHover:   (v: boolean) => void;
}) {
  const assignedCats  = categories.filter((c) => groupMap[c] === group.key);
  const availableCats = categories.filter((c) => !groupMap[c]);

  const displayTotal = group.key === "investors"
    ? assignedTotal + Math.max(0, balanceAmount)
    : assignedTotal;

  const pctRev = revenue > 0 ? (displayTotal / revenue) * 100 : 0;
  const delta  = pctRev - group.idealPct;
  const over   = delta > 0;

  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        flex: 1, minWidth: 0,
        background: isHovered ? group.dimColor : T.panel,
        border: `1px solid ${isHovered ? group.color + "45" : T.panelB}`,
        borderRadius: 12, padding: "13px 13px 11px",
        display: "flex", flexDirection: "column", gap: 9,
        transition: "all 0.18s", cursor: "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: group.color, flexShrink: 0, boxShadow: `0 0 7px ${group.color}55` }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.t1, flex: 1, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: group.color, fontFamily: "'Sora',sans-serif", flexShrink: 0 }}>{fmtINR(displayTotal)}</span>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: group.color, background: group.color + "18", border: `1px solid ${group.color}28`, borderRadius: 20, padding: "2px 6px", whiteSpace: "nowrap" }}>
          {pctRev.toFixed(1)}% of rev
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: over ? T.red : T.green, background: over ? T.redBg : T.greenBg, border: `1px solid ${over ? T.red : T.green}28`, borderRadius: 20, padding: "2px 6px", whiteSpace: "nowrap" }}>
          {over ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs 33%
        </span>
      </div>

      <div style={{ position: "relative", height: 5, borderRadius: 99, background: "rgba(255,255,255,0.05)" }}>
        <div style={{ position: "absolute", left: `${Math.min(98, group.idealPct)}%`, top: -2, bottom: -2, width: 2, background: group.color + "65", borderRadius: 99, zIndex: 1 }} />
        <div style={{ height: "100%", borderRadius: 99, background: over ? `linear-gradient(90deg,${group.color},${T.red})` : group.color, width: `${Math.min(100, pctRev)}%`, transition: "width 0.6s cubic-bezier(0.34,1.2,0.64,1)", boxShadow: `0 0 5px ${group.color}45` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: -5 }}>
        <span style={{ fontSize: 7.5, color: T.t5 }}>{pctRev.toFixed(1)}% actual</span>
        <span style={{ fontSize: 7.5, color: group.color + "65" }}>33.3% ideal</span>
      </div>

      {group.key === "investors" && balanceAmount > 0 && (
        <div style={{ fontSize: 9, color: T.green, background: T.greenBg, border: `1px solid ${T.green}25`, borderRadius: 6, padding: "4px 8px", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
          Net balance {fmtINR(balanceAmount)} auto-included
        </div>
      )}
      {group.key === "investors" && balanceAmount < 0 && (
        <div style={{ fontSize: 9, color: T.red, background: T.redBg, border: `1px solid ${T.red}25`, borderRadius: 6, padding: "4px 8px" }}>
          Negative balance — no investor share
        </div>
      )}

      {assignedCats.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {assignedCats.map((cat, ci) => {
            const shade = group.shades[ci % group.shades.length];
            return (
              <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, color: shade, background: shade + "20", border: `1px solid ${shade}35`, borderRadius: 20, padding: "2px 7px 2px 8px" }}>
                {cat}
                <button onClick={() => onRemove(cat)} style={{ background: "none", border: "none", color: shade, cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1, opacity: 0.6, display: "flex", alignItems: "center", marginLeft: 1 }} title="Remove">×</button>
              </span>
            );
          })}
        </div>
      )}

      {availableCats.length > 0 ? (
        <select
          value=""
          onChange={(e) => { if (e.target.value) { onAssign(e.target.value, group.key); } }}
          style={{ background: T.bg, border: `1px dashed ${group.color}38`, borderRadius: 7, padding: "5px 24px 5px 9px", fontSize: 10, color: T.t4, outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: "pointer", appearance: "none", WebkitAppearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2339475a'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "calc(100% - 7px) center", transition: "border-color 0.15s" }}
        >
          <option value="">+ Add category…</option>
          {availableCats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : assignedCats.length === 0 && group.key !== "investors" ? (
        <div style={{ fontSize: 9.5, color: T.t6, fontStyle: "italic", textAlign: "center", padding: "3px 0" }}>No categories yet</div>
      ) : null}
    </div>
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
  const isMobile = cw < 700;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [groupMap, setGroupMap] = useState<Record<string, GroupKey>>({});
  useEffect(() => { setGroupMap(loadGroupMap()); }, []);

  const assignCategory = useCallback((cat: string, grp: GroupKey) => {
    setGroupMap((prev) => {
      const next = { ...prev, [cat]: grp };
      saveGroupMap(next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((cat: string) => {
    setGroupMap((prev) => {
      const next = { ...prev };
      delete next[cat];
      saveGroupMap(next);
      return next;
    });
  }, []);

  const [orgs, setOrgs]         = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  useEffect(() => { fetchOrganisations().then(setOrgs).catch(console.error); }, []);

  const [selectedOrg, setSelectedOrg]         = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  useEffect(() => {
    if (selectedOrg) { fetchProjectsByOrg(selectedOrg).then(setProjects).catch(console.error); }
    else { setProjects([]); setSelectedProject(null); }
  }, [selectedOrg]);

  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates]       = useState<Set<string>>(new Set());
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth]       = useState<number | null>(null);
  const [selYear, setSelYear]         = useState<number>(new Date().getFullYear());
  const [rangeFrom, setRangeFrom]     = useState("");
  const [rangeTo, setRangeTo]         = useState("");
  const [filterMode, setFilterMode]   = useState<"calendar"|"month"|"range"|"none">("none");

  const handleRangeFrom = useCallback((v: string) => {
    setRangeFrom(v);
    if (v) { setFilterMode("range"); setSelDates(new Set()); setSelMonth(null); }
    else if (!rangeTo) { setFilterMode("none"); }
  }, [rangeTo]);

  const handleRangeTo = useCallback((v: string) => {
    setRangeTo(v);
    if (v) { setFilterMode("range"); setSelDates(new Set()); setSelMonth(null); }
    else if (!rangeFrom) { setFilterMode("none"); }
  }, [rangeFrom]);

  const [data, setData]       = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const { dateFrom, dateTo } = useMemo(() => {
    if (filterMode === "range") { return { dateFrom: rangeFrom, dateTo: rangeTo }; }
    if (filterMode === "calendar" && selDates.size > 0) {
      const s = Array.from(selDates).sort();
      return { dateFrom: s[0], dateTo: s[s.length - 1] };
    }
    return { dateFrom: "", dateTo: "" };
  }, [filterMode, rangeFrom, rangeTo, selDates]);

  const fetchData = useCallback(() => {
    setLoading(true); setError(null);
    const p: BalanceSheetParams = {
      organisation_id: selectedOrg ?? undefined,
      project_id:      selectedProject ?? undefined,
      view_all:        true,
    };
    if (filterMode === "range")         { if (rangeFrom) { p.from = rangeFrom; } if (rangeTo) { p.to = rangeTo; } }
    else if (filterMode === "month")    { p.year = selYear; p.month = selMonth !== null ? selMonth + 1 : undefined; }
    else if (filterMode === "calendar") { if (dateFrom) { p.from = dateFrom; } if (dateTo) { p.to = dateTo; } }
    else                                { p.year = selYear; }
    fetchBalanceSheet(p)
      .then((d) => {
        setData(d);
        const dates = new Set<string>([
          ...(d.revenues ?? []).map((r) => r.date),
          ...(d.expenses ?? []).map((e: ExpenseRow) => e.date),
        ]);
        setActiveDates(dates);
        const currentMap = loadGroupMap();
        let changed = false;
        const seen = new Set<string>();
        (d.expenses ?? []).forEach((e: ExpenseRow) => {
          const label = e.category_label || e.category || "";
          if (!label || seen.has(label)) { return; }
          seen.add(label);
          if (!currentMap[label]) {
            const g = autoGroup(label);
            if (g) { currentMap[label] = g; changed = true; }
          }
        });
        if (changed) { saveGroupMap(currentMap); setGroupMap({ ...currentMap }); }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterMode, selYear, selMonth, rangeFrom, rangeTo, selectedOrg, selectedProject, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const revenues      = useMemo(() => data?.revenues ?? [], [data]);
  const expenses      = useMemo(() => data?.expenses ?? [], [data]);
  const totalRevenue  = revenues.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const balance       = totalRevenue - totalExpenses;

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    expenses.forEach((e) => { const l = e.category_label || e.category || ""; if (l) { seen.add(l); } });
    return Array.from(seen).sort();
  }, [expenses]);

  const groupTotals = useMemo(() => {
    const totals: Record<GroupKey, number> = { investors: 0, overheads: 0, technical: 0 };
    expenses.forEach((e) => {
      const l = e.category_label || e.category || "";
      const g = groupMap[l];
      if (g) { totals[g] += e.amount; }
    });
    return totals;
  }, [expenses, groupMap]);

  const unassignedTotal = useMemo(() =>
    expenses.reduce((s, e) => {
      const l = e.category_label || e.category || "";
      return s + (groupMap[l] ? 0 : e.amount);
    }, 0),
  [expenses, groupMap]);

  const subSlices = useMemo((): SubSlice[] => {
    const result: SubSlice[] = [];
    GROUPS.forEach((g) => {
      const cats = uniqueCategories.filter((c) => groupMap[c] === g.key);
      cats.forEach((cat, ci) => {
        const amt = expenses
          .filter((e) => (e.category_label || e.category || "") === cat)
          .reduce((s, e) => s + e.amount, 0);
        if (amt <= 0) { return; }
        result.push({
          label: cat, value: amt, color: g.shades[ci % g.shades.length],
          groupKey: g.key, pctOfRevenue: totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0,
          idealPct: g.idealPct, isBalance: false,
        });
      });
      if (g.key === "investors" && balance > 0) {
        result.push({
          label: "Net Balance", value: balance, color: g.shades[cats.length % g.shades.length],
          groupKey: "investors", pctOfRevenue: totalRevenue > 0 ? (balance / totalRevenue) * 100 : 0,
          idealPct: 0, isBalance: true,
        });
      }
    });
    return result;
  }, [expenses, groupMap, uniqueCategories, balance, totalRevenue]);

  const [hoveredGroup, setHoveredGroup] = useState<GroupKey | null>(null);

  const clearAll = () => {
    setSelDates(new Set()); setSelMonth(null); setRangeFrom(""); setRangeTo("");
    setFilterMode("none"); setSelectedOrg(null); setSelectedProject(null);
  };
  const clearDateFilters = () => {
    setSelDates(new Set()); setSelMonth(null); setRangeFrom(""); setRangeTo(""); setFilterMode("none");
  };
  const toggleDate = (iso: string) => {
    setFilterMode("calendar"); setRangeFrom(""); setRangeTo(""); setSelMonth(null);
    setSelDates((p) => {
      const n = new Set(p);
      if (n.has(iso)) { n.delete(iso); } else { n.add(iso); }
      if (n.size === 0) { setFilterMode("none"); }
      return n;
    });
  };
  const selectMonth = (idx: number) => {
    if (selMonth === idx && filterMode === "month") { setSelMonth(null); setFilterMode("none"); }
    else { setSelMonth(idx); setFilterMode("month"); setSelDates(new Set()); setRangeFrom(""); setRangeTo(""); }
  };
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else { setCalMonth(m => m - 1); } };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else { setCalMonth(m => m + 1); } };

  const hasFilter         = filterMode !== "none" || !!selectedOrg || !!selectedProject;
  const activeFilterCount = [filterMode !== "none", !!selectedOrg, !!selectedProject].filter(Boolean).length;

  const rangeLabelShort = useMemo(() => {
    if (filterMode !== "range") { return ""; }
    if (rangeFrom && rangeTo) { return `${fmtDateDisplay(rangeFrom)} – ${fmtDateDisplay(rangeTo)}`; }
    if (rangeFrom) { return `From ${fmtDateDisplay(rangeFrom)}`; }
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
          <DateInput label="To"   value={filterMode === "range" ? rangeTo   : ""} onChange={handleRangeTo}   min={filterMode === "range" && rangeFrom ? rangeFrom : undefined} />
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
        <CalGrid year={calYear} month={calMonth}
          selDates={filterMode === "calendar" ? selDates : new Set()}
          activeDates={activeDates}
          rangeFrom={filterMode === "range" ? rangeFrom : ""}
          rangeTo={filterMode === "range" ? rangeTo : ""}
          onToggle={toggleDate}
        />
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
            return (
              <button key={m} onClick={() => selectMonth(i)} style={{ background: active ? T.acLight : "transparent", border: `1px solid ${active ? T.acMid : T.divider}`, borderRadius: 5, color: active ? T.acText : T.t5, fontSize: 10, padding: "6px 0", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: active ? 700 : 400, minHeight: 32, opacity: dimmed ? 0.4 : 1 }}>{m.slice(0, 3)}</button>
            );
          })}
        </div>
      </div>
      <div style={{ padding: "0 14px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t5, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: 8 }}>Year</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {AVAILABLE_YEARS.map((y) => {
            const active = selYear === y && (filterMode === "month" || filterMode === "none");
            return (
              <button key={y} onClick={() => setSelYear(y)} style={{ flex: "1 1 0", background: active ? T.acLight : "transparent", border: `1px solid ${active ? T.acMid : T.divider}`, borderRadius: 5, color: active ? T.acText : T.t5, fontSize: 10, padding: "6px 0", cursor: "pointer", fontWeight: active ? 700 : 400, minHeight: 32, opacity: filterMode === "range" || filterMode === "calendar" ? 0.4 : 1 }}>{y}</button>
            );
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
            <button
              onClick={() => { clearAll(); setDrawerOpen(false); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.red; (e.currentTarget as HTMLElement).style.borderColor = T.red + "40"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = T.t5; (e.currentTarget as HTMLElement).style.borderColor = T.divider; }}
              style={{ width: "100%", background: "transparent", border: `1px solid ${T.divider}`, borderRadius: 7, padding: "8px 0", fontSize: 11, color: T.t5, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", minHeight: 38 }}>
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(76,124,243,0.25);border-radius:99px;}
        select option{background:#0d0f1c;color:#d8e0f0;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5) sepia(1) saturate(2) hue-rotate(180deg);cursor:pointer;opacity:0.7;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        button{touch-action:manipulation;}
        html{-webkit-text-size-adjust:100%;}
      `}</style>

      {isMobile && <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}><SidebarContent /></MobileDrawer>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: `linear-gradient(135deg,${T.redBg},rgba(240,104,106,0.04))`, border: `1px solid ${T.red}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <circle cx={12} cy={12} r={9} stroke={T.red} strokeWidth={1.5} />
              <path d="M12 12 L12 3" stroke={T.red} strokeWidth={1.5} strokeLinecap="round" />
              <path d="M12 12 L18 15" stroke={T.amber} strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 16 : 21, fontWeight: 700, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em", color: T.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Revenue vs Expenses</h1>
            {!isMobile && <p style={{ color: T.t5, fontSize: 11.5, marginTop: 1 }}>Assign categories to groups · each targeting 33.3% of revenue · balance → investors</p>}
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
              { label: "Revenue",     val: fmtINR(totalRevenue),  color: T.green },
              { label: "Expenses",    val: fmtINR(totalExpenses), color: T.red   },
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
            { label: "Revenue",  val: fmtINR(totalRevenue),  color: T.green },
            { label: "Expenses", val: fmtINR(totalExpenses), color: T.red   },
            { label: "Net",      val: (balance >= 0 ? "+" : "−") + fmtINR(Math.abs(balance)), color: balance >= 0 ? T.green : T.red },
          ].map((s) => (
            <div key={s.label} style={{ background: T.panel, border: `1px solid ${T.panelB}`, borderRadius: 10, padding: "9px 10px" }}>
              <div style={{ fontSize: 8.5, color: T.t5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</div>
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
          {error && (
            <div style={{ padding: "11px 16px", color: T.red, fontSize: 12.5, background: T.redBg, borderRadius: 10, border: `1px solid ${T.red}30` }}>⚠ {error}</div>
          )}
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
                <div style={{ marginBottom: 18, padding: "12px 16px", borderRadius: 10, background: T.greenBg, border: `1px solid ${T.green}20`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.green, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Total Revenue</div>
                    <div style={{ fontSize: 10.5, color: T.t4 }}>
                      Expenses consume{" "}
                      <span style={{ color: T.red, fontWeight: 700 }}>{totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%</span>
                      {" "}· Balance retains{" "}
                      <span style={{ color: balance >= 0 ? T.green : T.red, fontWeight: 700 }}>{totalRevenue > 0 ? Math.abs((balance / totalRevenue) * 100).toFixed(1) : 0}%</span>
                      {" "}· Flows to investors
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.green, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em" }}>{fmtINR(totalRevenue)}</div>
                </div>

                {unassignedTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: T.amberBg, border: `1px solid ${T.amber}30`, fontSize: 11, color: T.amber, marginBottom: 18 }}>
                    <svg width={13} height={13} viewBox="0 0 20 20" fill="none"><path d="M10 2l8 16H2L10 2z" stroke={T.amber} strokeWidth={1.5} strokeLinejoin="round"/><path d="M10 8v4M10 14.5v.5" stroke={T.amber} strokeWidth={1.5} strokeLinecap="round"/></svg>
                    <span><strong>{fmtINR(unassignedTotal)}</strong> unassigned — assign categories using the dropdowns below.</span>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "center" : "flex-start", gap: isMobile ? 20 : 28, marginBottom: 20 }}>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <DonutChart
                      subSlices={subSlices}
                      revenue={totalRevenue}
                      totalExpenses={totalExpenses}
                      balance={balance}
                      hoveredGroup={hoveredGroup}
                      onHoverGroup={setHoveredGroup}
                    />
                    <div style={{ display: "flex", gap: 12, fontSize: 9.5, color: T.t4, flexWrap: "wrap", justifyContent: "center" }}>
                      {GROUPS.map((g) => (
                        <span key={g.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: g.color, display: "inline-block" }} />
                          {g.label}
                        </span>
                      ))}
                      {balance > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: GROUPS[0].shades[2], display: "inline-block", opacity: 0.7 }} />
                          Balance → Investors
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 8, color: T.t5, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 14, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)", display: "inline-block" }} />
                      Outer ring = 33.3% ideal target · shades = sub-categories
                    </div>
                  </div>

                  {!isMobile && (
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 4 }}>
                      <div style={{ padding: "14px 18px", borderRadius: 10, background: balance >= 0 ? T.greenBg : T.redBg, border: `1px solid ${balance >= 0 ? T.green : T.red}22`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Net Balance → Investors</div>
                          <div style={{ fontSize: 10.5, color: T.t4 }}>Revenue − All Expenses · auto-included in Investors Share</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: balance >= 0 ? T.green : T.red, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em" }}>
                            {balance >= 0 ? "+" : "−"}{fmtINR(Math.abs(balance))}
                          </div>
                          <div style={{ fontSize: 10.5, color: balance >= 0 ? T.green : T.red, fontWeight: 600 }}>
                            {totalRevenue > 0 ? Math.abs((balance / totalRevenue) * 100).toFixed(1) : 0}% of revenue
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, animation: "fadeUp 0.3s ease both" }}>
                  {GROUPS.map((g) => (
                    <GroupColumn
                      key={g.key}
                      group={g}
                      categories={uniqueCategories}
                      groupMap={groupMap}
                      assignedTotal={groupTotals[g.key]}
                      balanceAmount={g.key === "investors" ? balance : 0}
                      revenue={totalRevenue}
                      onAssign={assignCategory}
                      onRemove={removeCategory}
                      isHovered={hoveredGroup === g.key}
                      onHover={(v) => setHoveredGroup(v ? g.key : null)}
                    />
                  ))}
                </div>

                {isMobile && (
                  <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: balance >= 0 ? T.greenBg : T.redBg, border: `1px solid ${balance >= 0 ? T.green : T.red}22`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.t5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 1 }}>Net Balance → Investors</div>
                      <div style={{ fontSize: 10.5, color: T.t4 }}>Auto-included in Investors Share</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: balance >= 0 ? T.green : T.red, fontFamily: "'Sora',sans-serif" }}>
                        {balance >= 0 ? "+" : "−"}{fmtINR(Math.abs(balance))}
                      </div>
                      <div style={{ fontSize: 10, color: balance >= 0 ? T.green : T.red, fontWeight: 600 }}>
                        {totalRevenue > 0 ? Math.abs((balance / totalRevenue) * 100).toFixed(1) : 0}% of revenue
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
