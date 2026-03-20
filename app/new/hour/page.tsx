"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  entries, assignedEntries, quickEntries,
  projects, deliverables, members, organisation,
  type WorklogEntry, type AssignedEntry, type QuickEntry,
} from "./data";

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => String(n).padStart(2, "0")).join(":");
}

// ─── lookup maps (derived once) ───────────────────────────────────────────────

const projMap  = Object.fromEntries(projects.map(p => [p.id, p]));
const delivMap = Object.fromEntries(deliverables.map(d => [d.id, d]));

function pName(id: string) { return projMap[id]?.name  ?? id; }
function dName(id: string) { return delivMap[id]?.name ?? id; }
function pColor(id: string){ return projMap[id]?.color ?? "#6366f1"; }

// ─── Timer state per row ──────────────────────────────────────────────────────

interface TimerState {
  seconds: number;
  running: boolean;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');

  .ow { --t:#111827; --mu:#6b7280; --fa:#9ca3af; --su:#fff; --s2:#f3f4f6;
        --bo:#e5e7eb; --hv:#f9fafb; --ac:#6366f1; --ab:rgba(99,102,241,.08);
        --ad:rgba(99,102,241,.28); font-family:'DM Sans',sans-serif; }
  @media(prefers-color-scheme:dark){
    .ow { --t:#f1f5f9; --mu:#94a3b8; --fa:#64748b; --su:rgba(255,255,255,.04);
          --s2:rgba(255,255,255,.07); --bo:rgba(255,255,255,.1);
          --hv:rgba(255,255,255,.06); --ac:#818cf8;
          --ab:rgba(99,102,241,.15); --ad:rgba(99,102,241,.38); }
  }
  .ow * { box-sizing:border-box; }

  /* layout */
  .ow-layout { display:grid; grid-template-columns:300px 1fr; gap:20px; align-items:start; }
  @media(max-width:768px){ .ow-layout{grid-template-columns:1fr;gap:14px;}
    .ow{padding:16px 14px 40px !important;} }

  /* panel */
  .ow-panel { background:var(--su); border:1px solid var(--bo); border-radius:16px; padding:22px 20px; }
  @media(max-width:400px){ .ow-panel{padding:16px 13px;border-radius:12px;} }

  /* calendar */
  .ow-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
  .ow-day { background:transparent; border:1px solid transparent; color:var(--t);
    font-size:12px; padding:7px 0; border-radius:8px; cursor:pointer;
    text-align:center; transition:all .15s; width:100%; opacity:.65; }
  .ow-day:hover { background:var(--s2); opacity:1; }
  .ow-day.sel { background:#6366f1!important; border-color:#6366f1!important;
    color:#fff!important; opacity:1; font-weight:600; }
  .ow-nav { background:var(--s2); border:1px solid var(--bo); color:var(--t);
    width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:16px;
    display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
  .ow-nav:hover { background:var(--hv); }

  /* month/year pills */
  .ow-mth-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-bottom:14px; }
  .ow-pill { background:var(--s2); border:1px solid var(--bo); color:var(--mu);
    font-size:11px; padding:6px 0; border-radius:8px; cursor:pointer;
    transition:all .15s; width:100%; font-family:'DM Sans',sans-serif; }
  .ow-pill:hover { color:var(--t); border-color:var(--ad); }
  .ow-pill.on { background:var(--ab); border-color:var(--ad); color:var(--ac); font-weight:600; }
  .ow-ypill { background:var(--s2); border:1px solid var(--bo); color:var(--mu);
    font-size:11px; padding:6px 12px; border-radius:8px; cursor:pointer;
    transition:all .15s; font-family:'DM Sans',sans-serif; }
  .ow-ypill:hover { color:var(--t); border-color:var(--ad); }
  .ow-ypill.on { background:var(--ab); border-color:var(--ad); color:var(--ac); font-weight:600; }

  /* shared */
  .ow-label { font-size:11px; font-weight:600; color:var(--fa);
    letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px; }
  .ow-divider { height:1px; background:var(--bo); margin:16px 0; }

  /* org badge */
  .ow-badge { display:inline-flex; align-items:center; gap:8px;
    background:var(--ab); border:1px solid var(--ad); border-radius:20px;
    padding:4px 12px 4px 6px; margin-bottom:10px; }
  .ow-badge-logo { width:22px; height:22px; border-radius:50%; background:var(--ac);
    display:flex; align-items:center; justify-content:center;
    font-size:9px; font-weight:700; color:#fff; flex-shrink:0; }

  /* section header */
  .ow-sec-hd { font-size:13px; font-weight:700; color:var(--t); margin:0 0 10px; }

  /* timer row */
  .ow-row { display:flex; align-items:center; gap:9px; padding:11px 13px;
    border-radius:12px; background:var(--s2); border:1px solid var(--bo);
    transition:border-color .2s, box-shadow .2s; }
  .ow-row.live { border-color:var(--ad); box-shadow:0 0 0 3px var(--ab); }

  /* chip */
  .ow-chip { display:inline-flex; align-items:center; font-size:11.5px;
    padding:3px 9px; border-radius:6px; background:var(--su);
    border:1px solid var(--bo); color:var(--t); font-weight:500;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px; flex-shrink:0; }
  .ow-chip.accent { background:var(--ab); border-color:var(--ad); color:var(--ac); }

  /* time display */
  .ow-time { font-family:'DM Mono',monospace; font-size:14.5px; font-weight:500;
    color:var(--t); letter-spacing:.04em; min-width:78px; text-align:right; flex-shrink:0; }
  .ow-time.live { color:var(--ac); }

  /* play button */
  .ow-play { width:34px; height:34px; border-radius:50%;
    border:2px solid var(--bo); background:var(--su); color:var(--mu);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; flex-shrink:0; transition:all .18s; }
  .ow-play:hover { border-color:var(--ac); color:var(--ac); background:var(--ab); transform:scale(1.06); }
  .ow-play.live { border-color:var(--ac); color:var(--ac); background:var(--ab); }

  /* delete btn */
  .ow-del { width:26px; height:26px; border-radius:6px; border:none;
    background:transparent; color:var(--fa); cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition:all .15s; flex-shrink:0; }
  .ow-del:hover { background:rgba(239,68,68,.1); color:#ef4444; }

  /* add form */
  .ow-add-btn { display:flex; align-items:center; gap:8px; padding:10px 14px;
    border-radius:10px; border:1.5px dashed var(--bo); background:transparent;
    color:var(--mu); font-size:13px; cursor:pointer; transition:all .15s;
    width:100%; font-family:'DM Sans',sans-serif; }
  .ow-add-btn:hover { border-color:var(--ad); color:var(--ac); background:var(--ab); }

  /* dropdown */
  .ow-dd-wrap { position:relative; }
  .ow-dd-trig { width:100%; display:flex; align-items:center; gap:8px;
    background:var(--s2); border:1px solid var(--bo); border-radius:10px;
    padding:10px 13px; color:var(--t); font-size:13px; cursor:pointer;
    transition:border-color .2s; text-align:left; font-family:'DM Sans',sans-serif; }
  .ow-dd-trig:hover,.ow-dd-trig.open,.ow-dd-trig.picked { border-color:var(--ad); }
  .ow-dd-menu { position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:80;
    background:var(--su); border:1px solid var(--bo); border-radius:10px;
    overflow:hidden; box-shadow:0 12px 32px rgba(0,0,0,.14); }
  .ow-dd-inp { width:100%; background:transparent; border:none; outline:none;
    color:var(--t); font-size:13px; font-family:'DM Sans',sans-serif; }
  .ow-dd-item { width:100%; display:flex; align-items:center; gap:8px;
    background:transparent; border:none; color:var(--t); font-size:13px;
    padding:10px 14px; cursor:pointer; text-align:left;
    transition:background .1s; font-family:'DM Sans',sans-serif; }
  .ow-dd-item:hover { background:var(--hv); }
  .ow-dd-item.hi { background:var(--ab); color:var(--ac); }

  /* total bar */
  .ow-total { display:flex; align-items:center; justify-content:space-between;
    padding:10px 14px; border-radius:10px; background:var(--ab);
    border:1px solid var(--ad); margin-top:12px; }

  /* status badge */
  .ow-status { font-size:10px; font-weight:600; padding:2px 7px;
    border-radius:20px; white-space:nowrap; flex-shrink:0; }

  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
`;

// ─── Small Dropdown ───────────────────────────────────────────────────────────

function Dropdown({ label, placeholder, items, value, onChange, disabled }: {
  label?: string;
  placeholder: string;
  items: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen]   = useState(false);
  const [q,    setQ]      = useState("");
  const ref               = useRef<HTMLDivElement>(null);
  const sel               = items.find(i => i.id === value);
  const filtered          = q ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())) : items;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="ow-dd-wrap" ref={ref}>
      {label && <p className="ow-label" style={{ margin:"0 0 6px" }}>{label}</p>}
      <button type="button"
        className={`ow-dd-trig${open?" open":""}${value?" picked":""}`}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        style={{ opacity: disabled ? .45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {sel ? sel.name : <span style={{ opacity:.45 }}>{placeholder}</span>}
        </span>
        <svg width={11} height={11} viewBox="0 0 12 12" fill="none"
          style={{ transform:open?"rotate(180deg)":"none", transition:".2s", flexShrink:0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeOpacity={.5} strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="ow-dd-menu">
          <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--bo)", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ opacity:.4 }}>⌕</span>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="ow-dd-inp"/>
          </div>
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {filtered.length === 0
              ? <div style={{ padding:"12px 14px", opacity:.4, fontSize:13 }}>No results</div>
              : filtered.map(item => (
                  <button key={item.id}
                    className={`ow-dd-item${item.id === value?" hi":""}`}
                    onClick={() => { onChange(item.id); setOpen(false); setQ(""); }}>
                    <span style={{ flex:1 }}>{item.name}</span>
                    {item.id === value && <span style={{ fontSize:11, color:"var(--ac)" }}>✓</span>}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function CalendarMonth({ year, month, sel, onToggle }: {
  year: number; month: number; sel: Set<string>; onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)] as (number|null)[];
  return (
    <div className="ow-cal-grid">
      {DAYS.map(d => (
        <div key={d} style={{ textAlign:"center", fontSize:10, color:"var(--fa)", fontWeight:600,
          padding:"4px 0", textTransform:"uppercase", letterSpacing:".04em" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`}/>;
        const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        return (
          <button key={iso} className={`ow-day${sel.has(iso)?" sel":""}`} onClick={() => onToggle(iso)}>
            {day}
          </button>
        );
      })}
    </div>
  );
}

// ─── Play / Pause button ──────────────────────────────────────────────────────

function PlayBtn({ running, onClick }: { running: boolean; onClick: () => void }) {
  return (
    <button className={`ow-play${running?" live":""}`} onClick={onClick} title={running ? "Pause" : "Start"}>
      {running ? (
        // Pause
        <svg width={13} height={13} viewBox="0 0 13 13" fill="none">
          <rect x={2.5} y={1.5} width={3} height={10} rx={1} fill="currentColor"/>
          <rect x={7.5} y={1.5} width={3} height={10} rx={1} fill="currentColor"/>
        </svg>
      ) : (
        // Play
        <svg width={13} height={13} viewBox="0 0 13 13" fill="none">
          <path d="M3 1.5l8 5-8 5V1.5z" fill="currentColor"/>
        </svg>
      )}
    </button>
  );
}

// ─── Generic timer row ────────────────────────────────────────────────────────

function TimerRow({
  id, projectId, deliverableId, label,
  timer, onToggle, onRemove,
  statusBadge,
}: {
  id: string;
  projectId: string;
  deliverableId: string;
  label?: string;
  timer: TimerState;
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  statusBadge?: { text: string; color: string; bg: string };
}) {
  return (
    <div className={`ow-row${timer.running?" live":""}`}>
      {/* Project chip */}
      <span className="ow-chip" title={pName(projectId)}>{pName(projectId)}</span>

      {/* Deliverable chip */}
      <span className="ow-chip accent" title={dName(deliverableId)}>
        {label ?? dName(deliverableId)}
      </span>

      {/* Status badge (for assigned) */}
      {statusBadge && (
        <span className="ow-status"
          style={{ color: statusBadge.color, background: statusBadge.bg }}>
          {statusBadge.text}
        </span>
      )}

      <div style={{ flex:1 }}/>

      {/* Timer */}
      <span className={`ow-time${timer.running?" live":""}`}>{fmtTime(timer.seconds)}</span>

      {/* Play/pause */}
      <PlayBtn running={timer.running} onClick={() => onToggle(id)}/>

      {/* Remove (only for user-added rows) */}
      {onRemove && !timer.running && (
        <button className="ow-del" onClick={() => onRemove(id)} title="Remove">
          <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Add-new form (bottom of page) ────────────────────────────────────────────
// Adds a new deliverable to the Quick Access section so it appears permanently.

function AddForm({ onAdd }: { onAdd: (pId: string, dId: string, label: string) => void }) {
  const [open,  setOpen]  = useState(false);
  const [proj,  setProj]  = useState("");
  const [deliv, setDeliv] = useState("");
  const [label, setLabel] = useState("");

  const scopedDelivs = proj
    ? deliverables.filter(d => d.projectId === proj)
    : [];

  function handleAdd() {
    if (!proj || !deliv) return;
    onAdd(proj, deliv, label.trim() || "");
    setProj(""); setDeliv(""); setLabel(""); setOpen(false);
  }

  return (
    <div style={{ borderTop:"1px solid var(--bo)", paddingTop:20, marginTop:4 }}>
      {!open ? (
        <button className="ow-add-btn" onClick={() => setOpen(true)}>
          {/* big + circle */}
          <span style={{
            width:28, height:28, borderRadius:"50%",
            background:"var(--ab)", border:"1.5px solid var(--ad)",
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0, color:"var(--ac)",
          }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
            </svg>
          </span>
          <span style={{ fontSize:13, color:"var(--mu)" }}>
            Add deliverable to <strong style={{ color:"var(--ac)" }}>Quick Access</strong>
          </span>
        </button>
      ) : (
        <div style={{ background:"var(--s2)", border:"1px solid var(--ad)",
          borderRadius:14, padding:"16px 16px 14px", display:"flex", flexDirection:"column", gap:12 }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p className="ow-label" style={{ margin:0 }}>Add to Quick Access</p>
            <button onClick={() => { setOpen(false); setProj(""); setDeliv(""); setLabel(""); }}
              style={{ background:"transparent", border:"none", cursor:"pointer",
                color:"var(--fa)", padding:4, display:"flex", alignItems:"center" }}>
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Dropdown label="Project" placeholder="Select project"
              items={projects} value={proj}
              onChange={v => { setProj(v); setDeliv(""); }}/>
            <Dropdown label="Deliverable" placeholder="Select deliverable"
              items={scopedDelivs} value={deliv} onChange={setDeliv}
              disabled={!proj}/>
          </div>

          {/* Optional friendly label */}
          <div>
            <p className="ow-label" style={{ margin:"0 0 6px" }}>Label <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optional)</span></p>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Daily standup, Code review…"
              style={{
                width:"100%", background:"var(--su)", border:"1px solid var(--bo)",
                borderRadius:10, padding:"9px 13px", fontSize:13, color:"var(--t)",
                outline:"none", fontFamily:"'DM Sans',sans-serif",
                transition:"border-color .2s",
              }}
              onFocus={e  => (e.currentTarget.style.borderColor = "rgba(99,102,241,.5)")}
              onBlur={e   => (e.currentTarget.style.borderColor = "var(--bo)")}
            />
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={handleAdd} disabled={!proj || !deliv}
              style={{
                background: proj && deliv ? "#6366f1" : "var(--s2)",
                border:"none", borderRadius:9, padding:"9px 20px", fontSize:13,
                color: proj && deliv ? "#fff" : "var(--fa)",
                cursor: proj && deliv ? "pointer" : "not-allowed",
                fontWeight:600, transition:"all .15s", fontFamily:"'DM Sans',sans-serif",
              }}>
              Add to Quick Access
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <h3 className="ow-sec-hd" style={{ margin:0 }}>{title}</h3>
        <span style={{
          fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20,
          background:"var(--ab)", border:"1px solid var(--ad)", color:"var(--ac)",
        }}>{count}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const today = new Date();

  // ── Calendar state
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear,  setSelYear]  = useState<number | null>(null);

  // ── Timer states: keyed by entry id
  // Pre-populate with all worklog / assigned / quick entries at 0s, paused
  const [timers, setTimers] = useState<Record<string, TimerState>>(() => {
    const init: Record<string, TimerState> = {};
    // Recent worklog rows (deduplicated to latest per project+deliverable)
    const seen = new Set<string>();
    [...entries].reverse().forEach(e => {
      const key = `${e.projectId}__${e.deliverableId}`;
      if (!seen.has(key)) {
        seen.add(key);
        init[e.id] = { seconds: 0, running: false };
      }
    });
    assignedEntries.forEach(e => { init[e.id] = { seconds: e.loggedSeconds, running: false }; });
    quickEntries.forEach(e    => { init[e.id] = { seconds: e.loggedSeconds, running: false }; });
    return init;
  });

  // ── User-added quick-access rows
  const [customRows, setCustomRows] = useState<{ id: string; projectId: string; deliverableId: string; label: string }[]>([]);

  // ── Tick — every second increment all running timers
  useEffect(() => {
    const iv = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (next[id].running) { next[id] = { ...next[id], seconds: next[id].seconds + 1 }; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  function toggle(id: string) {
    setTimers(prev => ({
      ...prev,
      [id]: { ...prev[id], running: !prev[id].running },
    }));
  }

  function removeCustom(id: string) {
    setCustomRows(r => r.filter(x => x.id !== id));
    setTimers(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function addCustom(projectId: string, deliverableId: string, label: string) {
    const id = `custom-${Date.now()}`;
    setCustomRows(r => [...r, { id, projectId, deliverableId, label }]);
    setTimers(prev => ({ ...prev, [id]: { seconds: 0, running: false } }));
  }

  // ── Derived rows for "Worklog" section
  // = deduplicated recent entries (latest session per project+deliverable combo)
  const recentRows = useMemo(() => {
    const seen = new Set<string>();
    const rows: WorklogEntry[] = [];
    [...entries].reverse().forEach(e => {
      const key = `${e.projectId}__${e.deliverableId}`;
      if (!seen.has(key)) { seen.add(key); rows.push(e); }
    });
    return rows;
  }, []);

  // ── Available years for calendar pills
  const availableYears = useMemo(() =>
    Array.from(new Set(entries.map(e => new Date(e.date).getFullYear()))).sort(), []);

  // ── Total logged this session
  const totalSecs    = Object.values(timers).reduce((s, t) => s + t.seconds, 0);
  const runningCount = Object.values(timers).filter(t => t.running).length;

  function prevMonth() { calMonth===0 ? (setCalMonth(11), setCalYear(y=>y-1)) : setCalMonth(m=>m-1); }
  function nextMonth() { calMonth===11? (setCalMonth(0),  setCalYear(y=>y+1)) : setCalMonth(m=>m+1); }
  function toggleDate(iso: string) {
    setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }

  // Status badge helper for assigned rows
  function assignedBadge(status: AssignedEntry["status"]) {
    if (status === "Overdue")    return { text:"Overdue",    color:"#dc2626", bg:"rgba(239,68,68,.1)"  };
    if (status === "Completed")  return { text:"Completed",  color:"#059669", bg:"rgba(16,185,129,.1)" };
    return                              { text:"In Progress",color:"#0369a1", bg:"rgba(14,165,233,.1)" };
  }

  return (
    <div className="ow" style={{ padding:"32px 32px 52px", display:"flex", flexDirection:"column", gap:24, color:"var(--t)" }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div>
        <div className="ow-badge">
          <div className="ow-badge-logo">{organisation.logo}</div>
          <span style={{ fontSize:12, fontWeight:600, color:"var(--ac)" }}>{organisation.name}</span>
          <span style={{ fontSize:11, color:"var(--fa)", marginLeft:2 }}>· {organisation.industry}</span>
        </div>
        <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:"-.02em", color:"var(--t)", margin:0, lineHeight:1.2 }}>
          Worklog
          <span style={{ fontWeight:400, color:"var(--mu)", fontSize:20, marginLeft:10 }}>
            — {organisation.name}
          </span>
        </h1>
        <p style={{ color:"var(--mu)", fontSize:14, margin:"5px 0 0" }}>
          Press ▶ to start a timer, ❙❙ to pause. Add new entries at the bottom.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="ow-layout">

        {/* ── LEFT: Calendar ── */}
        <div className="ow-panel">
          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <button className="ow-nav" onClick={prevMonth}>‹</button>
            <span style={{ fontSize:14, fontWeight:600 }}>{MONTHS[calMonth]} {calYear}</span>
            <button className="ow-nav" onClick={nextMonth}>›</button>
          </div>

          <CalendarMonth year={calYear} month={calMonth} sel={selDates} onToggle={toggleDate}/>

          {selDates.size > 0 && (
            <div style={{ marginTop:10, textAlign:"center", fontSize:12, color:"var(--ac)" }}>
              {selDates.size} date{selDates.size>1?"s":""} selected &nbsp;
              <button onClick={() => setSelDates(new Set())}
                style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:12, padding:0 }}>
                ✕ clear
              </button>
            </div>
          )}

          <div className="ow-divider"/>

          <p className="ow-label">Month</p>
          <div className="ow-mth-grid">
            {MONTHS.map((m,i) => (
              <button key={m} className={`ow-pill${selMonth===i?" on":""}`}
                onClick={() => setSelMonth(selMonth===i ? null : i)}>
                {m.slice(0,3)}
              </button>
            ))}
          </div>

          <p className="ow-label">Year</p>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {availableYears.map(y => (
              <button key={y} className={`ow-ypill${selYear===y?" on":""}`}
                onClick={() => setSelYear(selYear===y ? null : y)}>
                {y}
              </button>
            ))}
          </div>

          {/* Session total */}
          {totalSecs > 0 && (
            <>
              <div className="ow-divider"/>
              <div style={{ textAlign:"center" }}>
                <p className="ow-label" style={{ marginBottom:6 }}>Session total</p>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:500,
                  color:"var(--ac)", letterSpacing:".04em" }}>
                  {fmtTime(totalSecs)}
                </div>
                {runningCount > 0 && (
                  <div style={{ fontSize:11, color:"#10b981", marginTop:4, display:"flex",
                    alignItems:"center", justifyContent:"center", gap:5 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:"#10b981",
                      display:"inline-block", animation:"blink 1s infinite" }}/>
                    {runningCount} timer{runningCount>1?"s":""} running
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Three sections ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* ══ WORKLOG — recent history, deduplicated ══ */}
          <div className="ow-panel" style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Section title="Worklog" count={recentRows.length}>
              {recentRows.map(e => (
                <TimerRow key={e.id} id={e.id}
                  projectId={e.projectId} deliverableId={e.deliverableId}
                  timer={timers[e.id] ?? { seconds:0, running:false }}
                  onToggle={toggle}/>
              ))}
            </Section>

            {recentRows.length > 0 && (
              <div className="ow-total">
                <span style={{ fontSize:12, fontWeight:600, color:"var(--ac)" }}>Worklog total</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:600, color:"var(--ac)" }}>
                  {fmtTime(recentRows.reduce((s,e) => s + (timers[e.id]?.seconds ?? 0), 0))}
                </span>
              </div>
            )}
          </div>

          {/* ══ ASSIGNED — tasks pushed to this member ══ */}
          <div className="ow-panel" style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Section title="Assigned" count={assignedEntries.length}>
              {assignedEntries.map(e => (
                <TimerRow key={e.id} id={e.id}
                  projectId={e.projectId} deliverableId={e.deliverableId}
                  label={e.title}
                  timer={timers[e.id] ?? { seconds:0, running:false }}
                  onToggle={toggle}
                  statusBadge={assignedBadge(e.status)}/>
              ))}
            </Section>
          </div>

          {/* ══ QUICK ACCESS — pinned + user-added entries ══ */}
          <div className="ow-panel" style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Section title="Quick Access" count={quickEntries.length + customRows.length}>
              {quickEntries.map(e => (
                <TimerRow key={e.id} id={e.id}
                  projectId={e.projectId} deliverableId={e.deliverableId}
                  label={e.label}
                  timer={timers[e.id] ?? { seconds:0, running:false }}
                  onToggle={toggle}/>
              ))}
              {/* User-added entries appear here */}
              {customRows.map(r => (
                <TimerRow key={r.id} id={r.id}
                  projectId={r.projectId} deliverableId={r.deliverableId}
                  label={r.label || undefined}
                  timer={timers[r.id] ?? { seconds:0, running:false }}
                  onToggle={toggle} onRemove={removeCustom}/>
              ))}
            </Section>
          </div>

          {/* ══ ADD NEW — bottom ══ */}
          <AddForm onAdd={addCustom}/>

        </div>
      </div>
    </div>
  );
}