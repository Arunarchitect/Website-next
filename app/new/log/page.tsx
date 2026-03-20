"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { entries, projects, deliverables, members, organisation } from "./data";

// ─── helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  projectId: string;
  deliverableId: string;
  projectName: string;
  deliverableName: string;
  seconds: number;
  status: "running" | "paused" | "done";
  startedAt: string; // ISO
}

// ─── Ring ─────────────────────────────────────────────────────────────────────
function Ring({ value, size = 52, stroke = 5, color = "#6366f1" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value / 100, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
        strokeOpacity={0.1} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s ease" }} />
    </svg>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const STYLE_TAG = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

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
    font-family: 'DM Sans', sans-serif;
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

  .oa-month-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 16px;
  }

  /* calendar */
  .oa-cal-day { background: transparent; border: 1px solid transparent; color: var(--oa-text); font-size: 12px; padding: 7px 0; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.15s; width: 100%; opacity: 0.7; }
  .oa-cal-day:hover { background: var(--oa-surface2); opacity: 1; }
  .oa-cal-day.on { background: #6366f1 !important; border-color: #6366f1 !important; color: #fff !important; opacity: 1; font-weight: 600; }

  .oa-nav-btn { background: var(--oa-surface2); border: 1px solid var(--oa-border); color: var(--oa-text); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; flex-shrink: 0; }
  .oa-nav-btn:hover { background: var(--oa-hover); }

  .oa-pill { background: var(--oa-surface2); border: 1px solid var(--oa-border); color: var(--oa-muted); font-size: 11px; padding: 6px 0; border-radius: 8px; cursor: pointer; transition: all 0.15s; width: 100%; }
  .oa-pill:hover { color: var(--oa-text); border-color: var(--oa-accent-border); }
  .oa-pill.on { background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent); font-weight: 600; }

  .oa-year-pill { background: var(--oa-surface2); border: 1px solid var(--oa-border); color: var(--oa-muted); font-size: 11px; padding: 6px 12px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
  .oa-year-pill:hover { color: var(--oa-text); border-color: var(--oa-accent-border); }
  .oa-year-pill.on { background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent); font-weight: 600; }

  /* dropdown */
  .oa-dd-trigger { width: 100%; display: flex; align-items: center; gap: 8px; background: var(--oa-surface2); border: 1px solid var(--oa-border); border-radius: 10px; padding: 10px 14px; color: var(--oa-text); font-size: 13px; cursor: pointer; transition: border-color 0.2s; text-align: left; font-family: 'DM Sans', sans-serif; }
  .oa-dd-trigger:hover, .oa-dd-trigger.open, .oa-dd-trigger.selected { border-color: var(--oa-accent-border); }
  .oa-dd-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 60; background: var(--oa-surface); border: 1px solid var(--oa-border); border-radius: 10px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
  .oa-dd-input { width: 100%; background: transparent; border: none; outline: none; color: var(--oa-text); font-size: 13px; font-family: 'DM Sans', sans-serif; }
  .oa-dd-item { width: 100%; display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: var(--oa-text); font-size: 13px; padding: 10px 14px; cursor: pointer; text-align: left; transition: background 0.1s; font-family: 'DM Sans', sans-serif; }
  .oa-dd-item:hover { background: var(--oa-hover); }
  .oa-dd-item.active { background: var(--oa-accent-bg); color: var(--oa-accent); }
  .oa-dd-clear { width: 100%; padding: 10px 14px; font-size: 13px; cursor: pointer; color: #ef4444; background: transparent; border: none; text-align: left; border-bottom: 1px solid var(--oa-border); font-family: 'DM Sans', sans-serif; }
  .oa-dd-clear:hover { background: rgba(239,68,68,0.06); }

  .oa-panel { background: var(--oa-surface); border: 1px solid var(--oa-border); border-radius: 16px; padding: 22px 20px; }
  @media (max-width: 400px) { .oa-panel { padding: 16px 14px; border-radius: 12px; } }

  .oa-label { font-size: 11px; font-weight: 600; color: var(--oa-faint); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
  .oa-divider { height: 1px; background: var(--oa-border); margin: 18px 0; }

  /* org badge */
  .oa-org-badge { display: inline-flex; align-items: center; gap: 8px; background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border); border-radius: 20px; padding: 4px 12px 4px 6px; margin-bottom: 10px; }
  .oa-org-logo { width: 22px; height: 22px; border-radius: 50%; background: var(--oa-accent); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; letter-spacing: 0.02em; flex-shrink: 0; }
  .oa-org-name { font-size: 12px; font-weight: 600; color: var(--oa-accent); letter-spacing: 0.01em; }

  /* worklog rows */
  .oa-log-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--oa-surface2); border: 1px solid var(--oa-border); transition: border-color 0.2s, box-shadow 0.2s; }
  .oa-log-row.running { border-color: var(--oa-accent-border); box-shadow: 0 0 0 3px var(--oa-accent-bg); }

  /* tag chip */
  .oa-chip { display: inline-flex; align-items: center; font-size: 11.5px; padding: 3px 9px; border-radius: 6px; background: var(--oa-surface); border: 1px solid var(--oa-border); color: var(--oa-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }

  /* timer display */
  .oa-timer { font-family: 'DM Mono', monospace; font-size: 15px; font-weight: 500; color: var(--oa-text); letter-spacing: 0.04em; min-width: 80px; text-align: right; flex-shrink: 0; }
  .oa-timer.running { color: var(--oa-accent); }

  /* play/pause button */
  .oa-play-btn { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--oa-border); background: var(--oa-surface); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.18s; color: var(--oa-muted); }
  .oa-play-btn:hover { border-color: var(--oa-accent); color: var(--oa-accent); background: var(--oa-accent-bg); transform: scale(1.05); }
  .oa-play-btn.running { border-color: var(--oa-accent); color: var(--oa-accent); background: var(--oa-accent-bg); }
  .oa-play-btn.done { border-color: #10b981; color: #10b981; background: rgba(16,185,129,0.08); cursor: default; }

  /* add row */
  .oa-add-btn { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; border: 1.5px dashed var(--oa-border); background: transparent; color: var(--oa-muted); font-size: 13px; cursor: pointer; transition: all 0.15s; width: 100%; font-family: 'DM Sans', sans-serif; }
  .oa-add-btn:hover { border-color: var(--oa-accent-border); color: var(--oa-accent); background: var(--oa-accent-bg); }

  /* section header */
  .oa-section-hd { font-size: 13px; font-weight: 600; color: var(--oa-text); margin: 0 0 10px; }

  /* empty state */
  .oa-empty { border-radius: 12px; padding: 48px 24px; text-align: center; background: var(--oa-surface2); border: 1px solid var(--oa-border); }

  /* tab row */
  .oa-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
  .oa-tab { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--oa-border); background: transparent; color: var(--oa-muted); font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .oa-tab:hover { border-color: var(--oa-accent-border); color: var(--oa-text); }
  .oa-tab.active { background: var(--oa-accent-bg); border-color: var(--oa-accent-border); color: var(--oa-accent); font-weight: 600; }

  /* total row */
  .oa-total-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; background: var(--oa-accent-bg); border: 1px solid var(--oa-accent-border); margin-top: 12px; }

  /* delete btn */
  .oa-del-btn { width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: var(--oa-faint); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
  .oa-del-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
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
      <button type="button"
        className={`oa-dd-trigger${open ? " open" : ""}${selectedId ? " selected" : ""}`}
        onClick={() => setOpen(o => !o)}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedItem ? (
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
              {selectedItem.name}
            </span>
          ) : <span style={{ opacity: 0.45 }}>{placeholder}</span>}
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
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" className="oa-dd-input" />
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
function CalendarMonth({ year, month, selectedDates, onToggleDate }: {
  year: number; month: number; selectedDates: Set<string>; onToggleDate: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)] as (number | null)[];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
      {DAYS.map(d => (
        <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--oa-faint)", fontWeight: 600, padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso    = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const active = selectedDates.has(iso);
        return (
          <button key={iso} className={`oa-cal-day${active ? " on" : ""}`} onClick={() => onToggleDate(iso)}>
            {day}
          </button>
        );
      })}
    </div>
  );
}

// ─── TimerRow ──────────────────────────────────────────────────────────────────
function TimerRow({ entry, onToggle, onDelete }: {
  entry: LogEntry;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isRunning = entry.status === "running";
  const isDone    = entry.status === "done";

  return (
    <div className={`oa-log-row${isRunning ? " running" : ""}`}>
      {/* Project chip */}
      <span className="oa-chip" title={entry.projectName}>{entry.projectName}</span>

      {/* Deliverable chip */}
      <span className="oa-chip" style={{ background: "var(--oa-accent-bg)", borderColor: "var(--oa-accent-border)", color: "var(--oa-accent)" }} title={entry.deliverableName}>
        {entry.deliverableName}
      </span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Timer */}
      <span className={`oa-timer${isRunning ? " running" : ""}`}>
        {fmtTime(entry.seconds)}
      </span>

      {/* Play/pause or done */}
      <button
        className={`oa-play-btn${isRunning ? " running" : isDone ? " done" : ""}`}
        onClick={() => !isDone && onToggle(entry.id)}
        title={isDone ? "Logged" : isRunning ? "Pause" : "Start"}
      >
        {isDone ? (
          // Checkmark
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7.5l3 3 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : isRunning ? (
          // Pause icon
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <rect x={3} y={2} width={3} height={10} rx={1} fill="currentColor" />
            <rect x={8} y={2} width={3} height={10} rx={1} fill="currentColor" />
          </svg>
        ) : (
          // Play icon
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <path d="M3.5 2.5l8 4.5-8 4.5V2.5z" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Delete */}
      {!isRunning && (
        <button className="oa-del-btn" onClick={() => onDelete(entry.id)} title="Remove">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── AddLogRow ─────────────────────────────────────────────────────────────────
function AddLogRow({ projectColorMap, onAdd }: {
  projectColorMap: Record<string, string>;
  onAdd: (projectId: string, deliverableId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selProject, setSelProject]     = useState<string | null>(null);
  const [selDeliverable, setSelDeliverable] = useState<string | null>(null);

  const scopedDeliverables = useMemo(() =>
    selProject ? deliverables.filter(d => d.projectId === selProject) : deliverables,
    [selProject]
  );

  function handleProjectChange(id: string | null) {
    setSelProject(id);
    setSelDeliverable(null);
  }

  function handleAdd() {
    if (!selProject || !selDeliverable) return;
    onAdd(selProject, selDeliverable);
    setSelProject(null);
    setSelDeliverable(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="oa-add-btn" onClick={() => setOpen(true)}>
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
        Add deliverable to log
      </button>
    );
  }

  return (
    <div style={{
      padding: "14px", borderRadius: "12px",
      background: "var(--oa-surface2)", border: "1px solid var(--oa-accent-border)",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <SearchDropdown
          label="Project" placeholder="Pick project" items={projects}
          selectedId={selProject} onSelect={handleProjectChange}
          dot={selProject ? projectColorMap[selProject] : undefined}
        />
        <SearchDropdown
          label="Deliverable" placeholder="Pick deliverable" items={scopedDeliverables}
          selectedId={selDeliverable} onSelect={setSelDeliverable}
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => { setOpen(false); setSelProject(null); setSelDeliverable(null); }}
          style={{ background: "transparent", border: "1px solid var(--oa-border)", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, color: "var(--oa-muted)", cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif" }}>
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!selProject || !selDeliverable}
          style={{
            background: selProject && selDeliverable ? "#6366f1" : "var(--oa-surface2)",
            border: "none", borderRadius: 8,
            padding: "7px 16px", fontSize: 12,
            color: selProject && selDeliverable ? "#fff" : "var(--oa-faint)",
            cursor: selProject && selDeliverable ? "pointer" : "not-allowed",
            fontWeight: 600, transition: "all 0.15s",
            fontFamily: "'DM Sans', sans-serif",
          }}>
          Add to log
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function OrgPage() {
  const today = new Date();

  // ── Calendar state ──
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDates,  setSelectedDates]  = useState<Set<string>>(new Set());
  const [selectedMonth,  setSelectedMonth]  = useState<number | null>(null);
  const [selectedYear,   setSelectedYear]   = useState<number | null>(null);

  // ── Filter dropdowns (right panel) ──
  const [projectId,     setProjectId]     = useState<string | null>(null);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [memberId,      setMemberId]      = useState<string | null>(null);

  // ── Worklog state ──
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [activeTab,  setActiveTab]  = useState<"worklog" | "assigned" | "quick">("worklog");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick interval — increment all running entries every second
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setLogEntries(prev => prev.map(e =>
        e.status === "running" ? { ...e, seconds: e.seconds + 1 } : e
      ));
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  function addEntry(projId: string, delivId: string) {
    const proj  = projects.find(p => p.id === projId);
    const deliv = deliverables.find(d => d.id === delivId);
    if (!proj || !deliv) return;
    const entry: LogEntry = {
      id: `log-${Date.now()}`,
      projectId: projId,
      deliverableId: delivId,
      projectName: proj.name,
      deliverableName: deliv.name,
      seconds: 0,
      status: "paused",
      startedAt: new Date().toISOString(),
    };
    setLogEntries(prev => [entry, ...prev]);
  }

  function toggleEntry(id: string) {
    setLogEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      if (e.status === "paused")  return { ...e, status: "running" };
      if (e.status === "running") return { ...e, status: "paused"  };
      return e;
    }));
  }

  function deleteEntry(id: string) {
    setLogEntries(prev => prev.filter(e => e.id !== id));
  }

  function markDone(id: string) {
    setLogEntries(prev => prev.map(e =>
      e.id === id ? { ...e, status: "done" } : e
    ));
  }

  // ── Derived ──
  const projectColorMap = useMemo(() =>
    Object.fromEntries(projects.map(p => [p.id, (p as any).color ?? "#6366f1"])), []);

  const scopedDeliverables = useMemo(() =>
    projectId ? deliverables.filter(d => d.projectId === projectId) : deliverables, [projectId]);

  const availableYears = useMemo(() =>
    Array.from(new Set(entries.map(e => new Date(e.date).getFullYear()))).sort(), []);

  function prevMonth() { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }
  function nextMonth() { if (calMonth === 11) { setCalMonth(0);  setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }

  function toggleDate(iso: string) {
    setSelectedDates(prev => { const n = new Set(prev); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }
  function handleSetProject(id: string | null) { setProjectId(id); setDeliverableId(null); }

  // Total logged time
  const totalLogged = logEntries.reduce((s, e) => s + e.seconds, 0);
  const runningCount = logEntries.filter(e => e.status === "running").length;

  // Tab-filtered entries (for demo, all go to worklog)
  const visibleEntries = logEntries;

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
          Worklog
          <span style={{ fontWeight: 400, color: "var(--oa-muted)", fontSize: 20, marginLeft: 10 }}>
            — {organisation.name}
          </span>
        </h1>
        <p style={{ color: "var(--oa-muted)", fontSize: 14, margin: "5px 0 0" }}>
          Track time against deliverables. Press ▶ to start, ❙❙ to pause.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="oa-layout">

        {/* ── LEFT: Calendar ── */}
        <div className="oa-panel">
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button className="oa-nav-btn" onClick={prevMonth}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--oa-text)" }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button className="oa-nav-btn" onClick={nextMonth}>›</button>
          </div>

          <CalendarMonth year={calYear} month={calMonth} selectedDates={selectedDates} onToggleDate={toggleDate} />

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

          <p className="oa-label">Month</p>
          <div className="oa-month-grid">
            {MONTHS.map((m, i) => (
              <button key={m} className={`oa-pill${selectedMonth === i ? " on" : ""}`}
                onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}>
                {m.slice(0, 3)}
              </button>
            ))}
          </div>

          <p className="oa-label">Year</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {availableYears.map(y => (
              <button key={y} className={`oa-year-pill${selectedYear === y ? " on" : ""}`}
                onClick={() => setSelectedYear(selectedYear === y ? null : y)}>
                {y}
              </button>
            ))}
          </div>

          {/* Summary of logged time for selected dates */}
          {totalLogged > 0 && (
            <>
              <div className="oa-divider" />
              <div style={{ textAlign: "center" }}>
                <div className="oa-label" style={{ marginBottom: 6 }}>Total logged today</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500,
                  color: "var(--oa-accent)", letterSpacing: "0.04em" }}>
                  {fmtTime(totalLogged)}
                </div>
                {runningCount > 0 && (
                  <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
                    ● {runningCount} timer{runningCount > 1 ? "s" : ""} running
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Worklog ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Filter bar */}
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

          {/* Log panel */}
          <div className="oa-panel" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Tabs */}
            <div className="oa-tabs">
              {(["worklog", "assigned", "quick"] as const).map(tab => (
                <button key={tab} className={`oa-tab${activeTab === tab ? " active" : ""}`}
                  onClick={() => setActiveTab(tab)}>
                  {tab === "worklog" ? "Worklog" : tab === "assigned" ? "Assigned" : "Quick Access"}
                  {tab === "worklog" && logEntries.length > 0 && (
                    <span style={{ marginLeft: 6, background: "var(--oa-accent)", color: "#fff",
                      borderRadius: 99, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>
                      {logEntries.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Entries */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibleEntries.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--oa-faint)", fontSize: 13 }}>
                  No entries yet — add a deliverable below to start logging
                </div>
              ) : (
                visibleEntries.map(entry => (
                  <TimerRow key={entry.id} entry={entry} onToggle={toggleEntry} onDelete={deleteEntry} />
                ))
              )}

              {/* Add row */}
              <AddLogRow projectColorMap={projectColorMap} onAdd={addEntry} />
            </div>

            {/* Total row */}
            {logEntries.length > 0 && (
              <div className="oa-total-row">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oa-accent)" }}>
                  Total logged
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {runningCount > 0 && (
                    <span style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981",
                        display: "inline-block", animation: "pulse 1s infinite" }} />
                      {runningCount} running
                    </span>
                  )}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 600,
                    color: "var(--oa-accent)", letterSpacing: "0.04em" }}>
                    {fmtTime(totalLogged)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick stats if entries exist */}
          {logEntries.length > 0 && (
            <div className="oa-panel">
              <p className="oa-label" style={{ marginBottom: 12 }}>Session breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {logEntries.map(entry => {
                  const pct = totalLogged > 0 ? (entry.seconds / totalLogged) * 100 : 0;
                  return (
                    <div key={entry.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: "var(--oa-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
                          {entry.projectName} · {entry.deliverableName}
                        </span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11,
                          color: entry.status === "running" ? "var(--oa-accent)" : "var(--oa-faint)",
                          flexShrink: 0, marginLeft: 8 }}>
                          {fmtTime(entry.seconds)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: "var(--oa-surface2)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, transition: "width 0.5s ease",
                          background: entry.status === "running"
                            ? "linear-gradient(90deg, #818cf8, #6366f1)"
                            : entry.status === "done"
                            ? "linear-gradient(90deg, #34d399, #10b981)"
                            : "var(--oa-border)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}