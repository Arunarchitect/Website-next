"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { entries, projects, deliverables, members, organisation } from "./data";

// ─── helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function fmt(n: number) {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

// ─── Ring ─────────────────────────────────────────────────────────────────────
function Ring({ value, size = 52, stroke = 5, color = "#6366f1" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.7s ease" }} />
    </svg>
  );
}

// ─── CSS tokens + responsive rules ────────────────────────────────────────────
const STYLE_TAG = `
  .oa-wrap {
    --oa-text: #111827;
    --oa-muted: #6b7280;
    --oa-faint: #9ca3af;
    --oa-surface: #ffffff;
    --oa-surface2: #f3f4f6;
    --oa-border: #e5e7eb;
    --oa-hover: #f9fafb;
    --oa-accent: #6366f1;
    --oa-accent-bg: rgba(99,102,241,0.08);
    --oa-accent-border: rgba(99,102,241,0.3);
  }
  @media (prefers-color-scheme: dark) {
    .oa-wrap {
      --oa-text: #f1f5f9;
      --oa-muted: #94a3b8;
      --oa-faint: #64748b;
      --oa-surface: rgba(255,255,255,0.04);
      --oa-surface2: rgba(255,255,255,0.07);
      --oa-border: rgba(255,255,255,0.1);
      --oa-hover: rgba(255,255,255,0.06);
      --oa-accent: #818cf8;
      --oa-accent-bg: rgba(99,102,241,0.15);
      --oa-accent-border: rgba(99,102,241,0.4);
    }
  }
  .oa-wrap * { box-sizing: border-box; }

  .oa-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
    align-items: start;
  }
  @media (max-width: 768px) {
    .oa-layout { grid-template-columns: 1fr; gap: 16px; }
    .oa-wrap { padding: 16px 14px 40px !important; }
  }

  .oa-filters-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  @media (max-width: 640px) {
    .oa-filters-grid { grid-template-columns: 1fr; gap: 12px; }
  }

  .oa-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  @media (max-width: 500px) {
    .oa-stats-grid { grid-template-columns: 1fr; gap: 10px; }
  }

  .oa-run-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
  }
  @media (max-width: 500px) {
    .oa-run-bar { flex-direction: column; align-items: stretch; }
    .oa-run-bar-btns { display: flex; gap: 10px; }
    .oa-btn-run { flex: 1; text-align: center; }
    .oa-btn-ghost { flex: 1; text-align: center; }
  }

  .oa-month-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 16px;
  }

  .oa-ring-row {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 18px;
  }
  @media (max-width: 420px) {
    .oa-ring-row .oa-ring-badge { display: none; }
  }

  .oa-legend {
    display: flex;
    gap: 14px;
    margin-top: 8px;
    font-size: 12px;
    flex-wrap: wrap;
  }

  .oa-org-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--oa-accent-bg);
    border: 1px solid var(--oa-accent-border);
    border-radius: 20px;
    padding: 4px 12px 4px 6px;
    margin-bottom: 10px;
  }
  .oa-org-logo {
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--oa-accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #fff; letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .oa-org-name {
    font-size: 12px; font-weight: 600;
    color: var(--oa-accent);
    letter-spacing: 0.01em;
  }

  /* date range inputs */
  .oa-date-input {
    width: 100%;
    background: var(--oa-surface2);
    border: 1px solid var(--oa-border);
    border-radius: 8px;
    padding: 8px 10px;
    color: var(--oa-text);
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
    cursor: pointer;
  }
  .oa-date-input:focus, .oa-date-input:hover { border-color: var(--oa-accent-border); }
  .oa-date-input::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }

  /* entries table */
  .oa-entries-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .oa-entries-table th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    color: var(--oa-faint);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 0 10px 10px;
    border-bottom: 1px solid var(--oa-border);
    white-space: nowrap;
  }
  .oa-entries-table td {
    padding: 9px 10px;
    border-bottom: 1px solid var(--oa-border);
    color: var(--oa-text);
    vertical-align: middle;
  }
  .oa-entries-table tr:last-child td { border-bottom: none; }
  .oa-entries-table tr:hover td { background: var(--oa-hover); }
  .oa-entries-table .td-rev { color: #059669; font-weight: 600; }
  .oa-entries-table .td-spnd { color: #dc2626; font-weight: 600; }
  .oa-entries-table .td-profit-pos { color: #4f46e5; font-weight: 600; }
  .oa-entries-table .td-profit-neg { color: #dc2626; font-weight: 600; }

  .oa-proj-dot {
    display: inline-block;
    width: 7px; height: 7px; border-radius: 50%;
    margin-right: 5px; flex-shrink: 0;
    vertical-align: middle;
  }

  .oa-table-wrap {
    overflow-x: auto;
    overflow-y: auto;
    max-height: 380px;
    border-radius: 0 0 12px 12px;
  }

  .oa-table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--oa-border);
    gap: 10px;
    flex-wrap: wrap;
  }

  .oa-sort-btn {
    background: var(--oa-surface2);
    border: 1px solid var(--oa-border);
    border-radius: 7px;
    color: var(--oa-muted);
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex; align-items: center; gap: 4px;
  }
  .oa-sort-btn:hover { border-color: var(--oa-accent-border); color: var(--oa-text); }
  .oa-sort-btn.active { background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent); }

  /* shared elements */
  .oa-cal-day { background: transparent; border: 1px solid transparent; color: var(--oa-text); font-size: 12px; padding: 7px 0; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.15s; width: 100%; opacity: 0.7; }
  .oa-cal-day:hover { background: var(--oa-surface2); opacity: 1; }
  .oa-cal-day.on { background: #6366f1 !important; border-color: #6366f1 !important; color: #fff !important; opacity: 1; font-weight: 600; }
  .oa-cal-day.in-range { background: var(--oa-accent-bg) !important; border-color: var(--oa-accent-border) !important; opacity: 1; }
  .oa-cal-day.range-start, .oa-cal-day.range-end { background: #6366f1 !important; border-color: #6366f1 !important; color: #fff !important; opacity: 1; font-weight: 600; }

  .oa-nav-btn { background: var(--oa-surface2); border: 1px solid var(--oa-border); color: var(--oa-text); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; flex-shrink: 0; }
  .oa-nav-btn:hover { background: var(--oa-hover); }

  .oa-pill { background: var(--oa-surface2); border: 1px solid var(--oa-border); color: var(--oa-muted); font-size: 11px; padding: 6px 0; border-radius: 8px; cursor: pointer; transition: all 0.15s; width: 100%; }
  .oa-pill:hover { color: var(--oa-text); border-color: var(--oa-accent-border); }
  .oa-pill.on { background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent); font-weight: 600; }

  .oa-year-pill { background: var(--oa-surface2); border: 1px solid var(--oa-border); color: var(--oa-muted); font-size: 11px; padding: 6px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
  .oa-year-pill:hover { color: var(--oa-text); border-color: var(--oa-accent-border); }
  .oa-year-pill.on { background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent); font-weight: 600; }

  .oa-dd-trigger { width: 100%; display: flex; align-items: center; gap: 8px; background: var(--oa-surface2); border: 1px solid var(--oa-border); border-radius: 10px; padding: 10px 14px; color: var(--oa-text); font-size: 13px; cursor: pointer; transition: border-color 0.2s; text-align: left; }
  .oa-dd-trigger:hover, .oa-dd-trigger.open, .oa-dd-trigger.selected { border-color: var(--oa-accent-border); }

  .oa-dd-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 60; background: var(--oa-surface); border: 1px solid var(--oa-border); border-radius: 10px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
  .oa-dd-input { width: 100%; background: transparent; border: none; outline: none; color: var(--oa-text); font-size: 13px; }
  .oa-dd-item { width: 100%; display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: var(--oa-text); font-size: 13px; padding: 10px 14px; cursor: pointer; text-align: left; transition: background 0.1s; }
  .oa-dd-item:hover { background: var(--oa-hover); }
  .oa-dd-item.active { background: var(--oa-accent-bg); color: var(--oa-accent); }
  .oa-dd-clear { width: 100%; padding: 10px 14px; font-size: 13px; cursor: pointer; color: #ef4444; background: transparent; border: none; text-align: left; border-bottom: 1px solid var(--oa-border); }
  .oa-dd-clear:hover { background: rgba(239,68,68,0.06); }

  .oa-btn-run { background: #6366f1; border: none; color: #fff; font-size: 13px; font-weight: 600; padding: 10px 22px; border-radius: 10px; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
  .oa-btn-run:hover { background: #4f46e5; }
  .oa-btn-ghost { background: transparent; border: 1px solid var(--oa-border); color: var(--oa-muted); font-size: 13px; padding: 10px 16px; border-radius: 10px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .oa-btn-ghost:hover { border-color: var(--oa-accent-border); color: var(--oa-text); }

  .oa-panel { background: var(--oa-surface); border: 1px solid var(--oa-border); border-radius: 16px; padding: 22px 20px; }
  @media (max-width: 400px) { .oa-panel { padding: 16px 14px; border-radius: 12px; } }

  .oa-label { font-size: 11px; font-weight: 600; color: var(--oa-faint); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
  .oa-divider { height: 1px; background: var(--oa-border); margin: 18px 0; }

  .oa-stat { border-radius: 12px; padding: 14px 16px; }
  .oa-stat-rev  { background: rgba(16,185,129,0.08);  border: 1px solid rgba(16,185,129,0.2);  }
  .oa-stat-spnd { background: rgba(239,68,68,0.08);   border: 1px solid rgba(239,68,68,0.2);   }
  .oa-stat-pft  { background: rgba(99,102,241,0.08);  border: 1px solid rgba(99,102,241,0.2);  }
  .oa-empty { border-radius: 12px; padding: 48px 24px; text-align: center; background: var(--oa-surface2); border: 1px solid var(--oa-border); }

  .oa-filter-tag {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border);
    color: var(--oa-accent); font-size: 11px; font-weight: 500;
    border-radius: 20px; padding: 3px 8px 3px 10px;
  }
  .oa-filter-tag button {
    background: none; border: none; color: var(--oa-accent); cursor: pointer;
    font-size: 12px; padding: 0; line-height: 1; opacity: 0.7;
  }
  .oa-filter-tag button:hover { opacity: 1; }
`;

// ─── SearchDropdown ────────────────────────────────────────────────────────────
function SearchDropdown({ label, placeholder, items, selectedId, onSelect, dot }: {
  label: string; placeholder: string;
  items: { id: string; name: string }[];
  selectedId: string | null; onSelect: (id: string | null) => void;
  dot?: string;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef<HTMLDivElement>(null);
  const selectedItem      = items.find(i => i.id === selectedId);
  const filtered          = query ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase())) : items;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(id: string) { onSelect(selectedId === id ? null : id); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <p className="oa-label" style={{ margin: "0 0 6px" }}>{label}</p>
      <button
        type="button"
        className={`oa-dd-trigger${open ? " open" : ""}${selectedId ? " selected" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedItem ? (
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
              {selectedItem.name}
            </span>
          ) : (
            <span style={{ opacity: 0.45 }}>{placeholder}</span>
          )}
        </span>
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s", flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="oa-dd-menu">
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--oa-border)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ opacity: 0.4, color: "var(--oa-text)" }}>⌕</span>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search…" className="oa-dd-input" />
          </div>
          {selectedId && (
            <button className="oa-dd-clear" onClick={() => { onSelect(null); setOpen(false); setQuery(""); }}>
              ✕ &nbsp;Clear selection
            </button>
          )}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0
              ? <div style={{ padding: "12px 14px", opacity: 0.4, fontSize: 13, color: "var(--oa-text)" }}>No results</div>
              : filtered.map(item => (
                <button key={item.id} className={`oa-dd-item${item.id === selectedId ? " active" : ""}`} onClick={() => pick(item.id)}>
                  {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
                  <span style={{ flex: 1 }}>{item.name}</span>
                  {item.id === selectedId && <span style={{ fontSize: 11, color: "var(--oa-accent)" }}>✓</span>}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CalendarMonth ─────────────────────────────────────────────────────────────
function CalendarMonth({ year, month, selectedDates, onToggleDate, rangeStart, rangeEnd }: {
  year: number; month: number;
  selectedDates: Set<string>; onToggleDate: (d: string) => void;
  rangeStart?: string | null; rangeEnd?: string | null;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)] as (number | null)[];

  function getClass(iso: string) {
    if (rangeStart && rangeEnd) {
      if (iso === rangeStart) return "range-start";
      if (iso === rangeEnd)   return "range-end";
      if (iso > rangeStart && iso < rangeEnd) return "in-range";
    }
    if (selectedDates.has(iso)) return "on";
    return "";
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
      {DAYS.map(d => (
        <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--oa-faint)", fontWeight: 600, padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const cls = getClass(iso);
        return (
          <button key={iso} className={`oa-cal-day${cls ? ` ${cls}` : ""}`} onClick={() => onToggleDate(iso)}>
            {day}
          </button>
        );
      })}
    </div>
  );
}

// ─── Entries Table ──────────────────────────────────────────────────────────────
type SortKey = "date" | "revenue" | "spend" | "profit";
type SortDir = "asc" | "desc";

function EntriesTable({ filteredEntries }: { filteredEntries: typeof entries }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage]       = useState(0);
  const PAGE_SIZE = 12;

  const projectMap    = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), []);
  const delivMap      = useMemo(() => Object.fromEntries(deliverables.map(d => [d.id, d])), []);
  const memberMap     = useMemo(() => Object.fromEntries(members.map(m => [m.id, m])), []);

  const sorted = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "date")    { av = a.date.localeCompare(b.date) > 0 ? 1 : -1; bv = 0; return sortDir === "asc" ? av : -av; }
      if (sortKey === "revenue") { av = a.revenue; bv = b.revenue; }
      else if (sortKey === "spend")  { av = a.spend;   bv = b.spend;   }
      else                           { av = a.revenue - a.spend; bv = b.revenue - b.spend; }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [filteredEntries, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged      = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="oa-panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="oa-table-header">
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--oa-text)" }}>
            Entries
          </span>
          <span style={{ fontSize: 12, color: "var(--oa-muted)", marginLeft: 8 }}>
            {filteredEntries.length} record{filteredEntries.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["date","revenue","spend","profit"] as SortKey[]).map(k => (
            <button key={k} className={`oa-sort-btn${sortKey === k ? " active" : ""}`} onClick={() => toggleSort(k)}>
              {k.charAt(0).toUpperCase() + k.slice(1)}{arrow(k)}
            </button>
          ))}
        </div>
      </div>

      <div className="oa-table-wrap">
        <table className="oa-entries-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Deliverable</th>
              <th>Member</th>
              <th style={{ textAlign: "right" }}>Revenue</th>
              <th style={{ textAlign: "right" }}>Spend</th>
              <th style={{ textAlign: "right" }}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(e => {
              const proj   = projectMap[e.projectId];
              const deliv  = delivMap[e.deliverableId];
              const member = memberMap[e.memberId];
              const profit = e.revenue - e.spend;
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--oa-muted)", fontSize: 11 }}>
                    {fmtDate(e.date)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="oa-proj-dot" style={{ background: proj?.color }} />
                    <span style={{ fontSize: 12 }}>{proj?.name ?? e.projectId}</span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--oa-muted)", whiteSpace: "nowrap" }}>
                    {deliv?.name ?? e.deliverableId}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: "var(--oa-accent-bg)", border: "1px solid var(--oa-accent-border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 8, fontWeight: 700, color: "var(--oa-accent)", flexShrink: 0,
                      }}>
                        {member?.avatar ?? "?"}
                      </div>
                      <span style={{ fontSize: 12 }}>{member?.name ?? e.memberId}</span>
                    </div>
                  </td>
                  <td className="td-rev" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmt(e.revenue)}</td>
                  <td className="td-spnd" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmt(e.spend)}</td>
                  <td className={profit >= 0 ? "td-profit-pos" : "td-profit-neg"} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {profit >= 0 ? "+" : ""}{fmt(profit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--oa-border)" }}>
          <span style={{ fontSize: 12, color: "var(--oa-muted)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="oa-nav-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ opacity: page === 0 ? 0.4 : 1 }}>‹</button>
            <button className="oa-nav-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ opacity: page === totalPages - 1 ? 0.4 : 1 }}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function OrgPage() {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // individual date picking
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // month / year filters
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear,  setSelectedYear]  = useState<number | null>(null);

  // date range
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd,   setRangeEnd]   = useState<string>("");

  // dropdowns
  const [projectId,     setProjectId]     = useState<string | null>(null);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [memberId,      setMemberId]      = useState<string | null>(null);

  const [result, setResult] = useState<{
    revenue: number; spend: number; profit: number; count: number;
    filteredEntries: typeof entries;
  } | null>(null);
  const [ran, setRan] = useState(false);

  function prevMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }
  function nextMonth() { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }

  function toggleDate(iso: string) {
    // In date range mode, clicking a date clears range & picks individual
    if (rangeStart || rangeEnd) { setRangeStart(""); setRangeEnd(""); }
    setSelectedDates(prev => { const n = new Set(prev); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }

  function handleSetProject(id: string | null) { setProjectId(id); setDeliverableId(null); }

  const scopedDeliverables = useMemo(() =>
    projectId ? deliverables.filter(d => d.projectId === projectId) : deliverables, [projectId]);
  const projectColorMap = useMemo(() =>
    Object.fromEntries(projects.map(p => [p.id, p.color])), []);
  const availableYears = useMemo(() =>
    Array.from(new Set(entries.map(e => new Date(e.date).getFullYear()))).sort(), []);

  const hasDateRange = rangeStart !== "" || rangeEnd !== "";
  const hasFilters   = selectedDates.size > 0 || selectedMonth !== null || selectedYear !== null
    || !!projectId || !!deliverableId || !!memberId || hasDateRange;

  function clearAll() {
    setSelectedDates(new Set()); setSelectedMonth(null); setSelectedYear(null);
    setProjectId(null); setDeliverableId(null); setMemberId(null);
    setRangeStart(""); setRangeEnd("");
    setResult(null); setRan(false);
  }

  function runAnalysis() {
    let f = entries;

    // priority: date range > individual dates > month/year pills
    if (rangeStart && rangeEnd) {
      const s = rangeStart < rangeEnd ? rangeStart : rangeEnd;
      const e2 = rangeStart < rangeEnd ? rangeEnd : rangeStart;
      f = f.filter(e => e.date >= s && e.date <= e2);
    } else if (rangeStart) {
      f = f.filter(e => e.date >= rangeStart);
    } else if (rangeEnd) {
      f = f.filter(e => e.date <= rangeEnd);
    } else if (selectedDates.size > 0) {
      f = f.filter(e => selectedDates.has(e.date));
    } else {
      if (selectedYear  !== null) f = f.filter(e => new Date(e.date).getFullYear() === selectedYear);
      if (selectedMonth !== null) f = f.filter(e => new Date(e.date).getMonth()    === selectedMonth);
    }

    if (projectId)     f = f.filter(e => e.projectId     === projectId);
    if (deliverableId) f = f.filter(e => e.deliverableId === deliverableId);
    if (memberId)      f = f.filter(e => e.memberId       === memberId);

    const revenue = f.reduce((s, e) => s + e.revenue, 0);
    const spend   = f.reduce((s, e) => s + e.spend,   0);
    setResult({ revenue, spend, profit: revenue - spend, count: f.length, filteredEntries: f });
    setRan(true);
  }

  const margin    = result?.revenue ? (result.profit / result.revenue) * 100 : 0;
  const costRatio = result?.revenue ? (result.spend  / result.revenue) * 100 : 0;
  const revShare  = result ? (result.revenue / (result.revenue + result.spend + 1)) * 100 : 0;

  // active filter tags for display
  const activeFilterTags: { label: string; clear: () => void }[] = [];
  if (hasDateRange) {
    const label = rangeStart && rangeEnd
      ? `${fmtDate(rangeStart)} → ${fmtDate(rangeEnd)}`
      : rangeStart ? `From ${fmtDate(rangeStart)}` : `Until ${fmtDate(rangeEnd)}`;
    activeFilterTags.push({ label, clear: () => { setRangeStart(""); setRangeEnd(""); } });
  }
  if (selectedDates.size > 0) activeFilterTags.push({ label: `${selectedDates.size} dates`, clear: () => setSelectedDates(new Set()) });
  if (selectedMonth !== null) activeFilterTags.push({ label: MONTHS[selectedMonth], clear: () => setSelectedMonth(null) });
  if (selectedYear  !== null) activeFilterTags.push({ label: String(selectedYear), clear: () => setSelectedYear(null) });
  if (projectId)     activeFilterTags.push({ label: projects.find(p => p.id === projectId)?.name ?? projectId, clear: () => handleSetProject(null) });
  if (deliverableId) activeFilterTags.push({ label: deliverables.find(d => d.id === deliverableId)?.name ?? deliverableId, clear: () => setDeliverableId(null) });
  if (memberId)      activeFilterTags.push({ label: members.find(m => m.id === memberId)?.name ?? memberId, clear: () => setMemberId(null) });

  return (
    <div className="oa-wrap" style={{ padding: "32px 32px 48px", display: "flex", flexDirection: "column", gap: 24, color: "var(--oa-text)" }}>
      <style>{STYLE_TAG}</style>

      {/* ── Header ── */}
      <div>
        <div className="oa-org-badge">
          <div className="oa-org-logo">{organisation.logo}</div>
          <span className="oa-org-name">{organisation.name}</span>
          <span style={{ fontSize: 11, color: "var(--oa-faint)", marginLeft: 2 }}>· {organisation.industry}</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--oa-text)", margin: 0, lineHeight: 1.2 }}>
          Analytics
          <span style={{ fontWeight: 400, color: "var(--oa-muted)", fontSize: 20, marginLeft: 10 }}>
            — {organisation.name}
          </span>
        </h1>
        <p style={{ color: "var(--oa-muted)", fontSize: 14, margin: "5px 0 0" }}>
          Select dates &amp; filters, then run analysis to see revenue &amp; spend
        </p>
      </div>

      <div className="oa-layout">

        {/* ── LEFT: Calendar + filters ── */}
        <div className="oa-panel">

          {/* Calendar nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button className="oa-nav-btn" onClick={prevMonth}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--oa-text)" }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button className="oa-nav-btn" onClick={nextMonth}>›</button>
          </div>

          <CalendarMonth
            year={calYear} month={calMonth}
            selectedDates={selectedDates} onToggleDate={toggleDate}
            rangeStart={rangeStart || null} rangeEnd={rangeEnd || null}
          />

          {selectedDates.size > 0 && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "var(--oa-accent)" }}>
              {selectedDates.size} date{selectedDates.size > 1 ? "s" : ""} selected &nbsp;
              <button onClick={() => setSelectedDates(new Set())}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: 0 }}>
                ✕ clear
              </button>
            </div>
          )}

          <div className="oa-divider" />

          {/* ── Date Range filter ── */}
          <p className="oa-label">Date Range</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--oa-faint)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>From</div>
              <input
                type="date"
                className="oa-date-input"
                value={rangeStart}
                onChange={e => {
                  setRangeStart(e.target.value);
                  if (e.target.value) setSelectedDates(new Set()); // clear individual picks when range set
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--oa-faint)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>To</div>
              <input
                type="date"
                className="oa-date-input"
                value={rangeEnd}
                onChange={e => {
                  setRangeEnd(e.target.value);
                  if (e.target.value) setSelectedDates(new Set());
                }}
              />
            </div>
          </div>
          {hasDateRange && (
            <button onClick={() => { setRangeStart(""); setRangeEnd(""); }}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, padding: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
              ✕ Clear date range
            </button>
          )}

          <div className="oa-divider" />

          {/* Month pills */}
          <p className="oa-label">Month</p>
          <div className="oa-month-grid">
            {MONTHS.map((m, i) => (
              <button key={m} className={`oa-pill${selectedMonth === i ? " on" : ""}`}
                onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}>
                {m.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Year pills */}
          <p className="oa-label">Year</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {availableYears.map(y => (
              <button key={y} className={`oa-year-pill${selectedYear === y ? " on" : ""}`}
                onClick={() => setSelectedYear(selectedYear === y ? null : y)}>
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Run bar */}
          <div className="oa-panel oa-run-bar">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oa-text)", marginBottom: activeFilterTags.length ? 6 : 0 }}>
                {hasFilters ? "Filters active" : "No filters selected"}
              </div>
              {activeFilterTags.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {activeFilterTags.map(tag => (
                    <span key={tag.label} className="oa-filter-tag">
                      {tag.label}
                      <button onClick={tag.clear}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              {!hasFilters && (
                <div style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 2 }}>Will analyse all data</div>
              )}
            </div>
            <div className="oa-run-bar-btns" style={{ display: "flex", gap: 10 }}>
              {hasFilters && <button className="oa-btn-ghost" onClick={clearAll}>Clear all</button>}
              <button className="oa-btn-run" onClick={runAnalysis}>▶ Run Analysis</button>
            </div>
          </div>

          {/* Dropdowns */}
          <div className="oa-panel oa-filters-grid">
            <SearchDropdown
              label="Project" placeholder="All projects" items={projects}
              selectedId={projectId} onSelect={handleSetProject}
              dot={projectId ? projectColorMap[projectId] : undefined}
            />
            <SearchDropdown
              label={projectId ? "Deliverable (scoped)" : "Deliverable"}
              placeholder="All deliverables" items={scopedDeliverables}
              selectedId={deliverableId} onSelect={setDeliverableId}
            />
            <SearchDropdown
              label="Member" placeholder="All members" items={members}
              selectedId={memberId} onSelect={setMemberId}
            />
          </div>

          {/* Results */}
          {ran && result ? (
            <>
              {/* Stat cards */}
              <div className="oa-stats-grid">
                <div className="oa-stat oa-stat-rev">
                  <div className="oa-label" style={{ marginBottom: 6 }}>Revenue</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#059669", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                    {fmt(result.revenue)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 4 }}>{result.count} records</div>
                </div>
                <div className="oa-stat oa-stat-spnd">
                  <div className="oa-label" style={{ marginBottom: 6 }}>Spend</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#dc2626", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                    {fmt(result.spend)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 4 }}>{result.count} records</div>
                </div>
                <div className="oa-stat oa-stat-pft">
                  <div className="oa-label" style={{ marginBottom: 6 }}>Profit</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#4f46e5", letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                    {fmt(result.profit)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 4 }}>
                    {result.revenue > 0 ? `${margin.toFixed(1)}% margin` : "—"}
                  </div>
                </div>
              </div>

              {/* Rev vs Spend bar */}
              <div className="oa-panel">
                <div className="oa-ring-row">
                  <div className="oa-ring-badge" style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                    <Ring value={Math.round(revShare)} size={52} stroke={5} color="#10b981" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#059669" }}>REV</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oa-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Revenue vs Spend
                      </span>
                      <span style={{ fontSize: 12, color: "var(--oa-muted)" }}>
                        {costRatio.toFixed(1)}% cost ratio
                      </span>
                    </div>
                    <div style={{ height: 10, borderRadius: 99, background: "var(--oa-surface2)", overflow: "hidden", display: "flex" }}>
                      {(() => {
                        const total = result.revenue + result.spend;
                        const rPct  = total ? (result.revenue / total) * 100 : 50;
                        return (
                          <>
                            <div style={{ width: `${rPct}%`, background: "linear-gradient(90deg,#34d39988,#10b981)", height: "100%", borderRadius: "99px 0 0 99px", transition: "width 0.6s ease" }} />
                            <div style={{ flex: 1, background: "linear-gradient(90deg,#f8717188,#ef4444)", height: "100%", borderRadius: "0 99px 99px 0" }} />
                          </>
                        );
                      })()}
                    </div>
                    <div className="oa-legend">
                      <span style={{ color: "#059669", fontWeight: 500 }}>● Revenue</span>
                      <span style={{ color: "#dc2626", fontWeight: 500 }}>● Spend</span>
                      <span style={{ color: "#4f46e5", fontWeight: 500 }}>● Margin {margin.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="oa-ring-badge" style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
                    <Ring value={Math.max(0, Math.round(margin))} size={52} stroke={5} color="#6366f1" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#4f46e5" }}>MGN</div>
                  </div>
                </div>
              </div>

              {/* Entries table — replaces avg cards */}
              {result.filteredEntries.length > 0 && (
                <EntriesTable filteredEntries={result.filteredEntries} />
              )}
            </>
          ) : ran ? (
            <div className="oa-empty">
              <div style={{ fontSize: 13, color: "var(--oa-muted)" }}>No records match the selected filters.</div>
            </div>
          ) : (
            <div className="oa-empty">
              <div style={{ fontSize: 32, marginBottom: 10, color: "var(--oa-faint)" }}>◎</div>
              <div style={{ fontSize: 13, color: "var(--oa-muted)" }}>
                Apply filters and click <strong style={{ color: "var(--oa-accent)" }}>Run Analysis</strong> to see results.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}