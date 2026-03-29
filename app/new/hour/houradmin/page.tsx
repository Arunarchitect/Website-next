/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  fetchMeta, fetchMemberWorkLogs, fetchAssignments,
  fetchDeliverablesByProject, createAssignment, editAssignment, deleteAssignment,
  currentWeekRange,
  type MemberWorkLogEntry, type WorkLogPage, type MetaData,
  type AssignmentEntry, type MemberOption, type DeliverableOption,
} from "@/app/new/manager_api";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function pad(n: number) { return String(n).padStart(2, "0"); }
function monthRange(year: number, month: number) {
  return {
    from: `${year}-${pad(month+1)}-01`,
    to:   `${year}-${pad(month+1)}-${pad(new Date(year, month+1, 0).getDate())}`,
  };
}
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

const T = {
  bg:"#0f1117", panel:"rgba(255,255,255,0.025)", panelB:"rgba(255,255,255,0.07)",
  panel2:"rgba(255,255,255,0.04)", panel2B:"rgba(255,255,255,0.1)",
  divider:"rgba(255,255,255,0.06)",
  t1:"#f8fafc", t2:"#f1f5f9", t3:"#94a3b8", t4:"#64748b", t5:"#475569", t6:"#334155",
  ac:"#6366f1", acLight:"rgba(99,102,241,0.12)", acMid:"rgba(99,102,241,0.55)", acText:"#818cf8",
  green:"#10b981", greenBg:"rgba(16,185,129,0.12)",
  amber:"#f59e0b", amberBg:"rgba(245,158,11,0.12)",
  red:"#ef4444", redBg:"rgba(239,68,68,0.12)",
};
const Divider = () => <div style={{ height:1, background:T.divider }} />;

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ loading }: { loading: boolean }) {
  const [pct, setPct]         = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (loading) {
      setVisible(true); setPct(0); let c = 0;
      ref.current = setInterval(() => {
        c += Math.random() * 18;
        if (c >= 90) { c = 90; clearInterval(ref.current!); }
        setPct(c);
      }, 120);
    } else {
      clearInterval(ref.current!); setPct(100);
      const t = setTimeout(() => { setVisible(false); setPct(0); }, 350);
      return () => clearTimeout(t);
    }
    return () => clearInterval(ref.current!);
  }, [loading]);
  if (!visible) return null;
  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:9999, height:3 }}>
      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${T.ac},#a78bfa)`, transition:pct===100?"width 0.2s,opacity 0.3s":"width 0.12s", opacity:pct===100?0:1, borderRadius:"0 2px 2px 0", boxShadow:`0 0 8px ${T.ac}` }} />
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalGrid({ year, month, activeDates, selDates, onToggle }: {
  year:number; month:number; activeDates:Set<string>; selDates:Set<string>; onToggle:(d:string)=>void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number|null)[] = [...Array(first).fill(null), ...Array.from({length:total},(_,i)=>i+1)];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
      {DAYS.map(d => <div key={d} style={{ textAlign:"center", fontSize:9, color:T.t5, fontWeight:600, letterSpacing:"0.06em", padding:"4px 0", textTransform:"uppercase" }}>{d}</div>)}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${pad(month+1)}-${pad(day)}`;
        const has = activeDates.has(iso), sel = selDates.has(iso);
        return (
          <button key={iso} onClick={() => onToggle(iso)}
            style={{ background:sel?T.ac:"transparent", border:`1px solid ${sel?T.ac:"transparent"}`, borderRadius:6, cursor:"pointer", color:sel?"#fff":has?T.t2:T.t4, fontSize:11, padding:"6px 0", width:"100%", fontFamily:"'DM Sans',sans-serif", fontWeight:sel?600:400, display:"flex", flexDirection:"column", alignItems:"center", gap:1, transition:"all 0.15s" }}
            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = T.panel2; }}
            onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            {day}
            {has && <span style={{ display:"block", width:3, height:3, borderRadius:"50%", background:sel?"#fff":T.acText }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel, message = "Delete this entry?" }: {
  onConfirm:()=>void; onCancel:()=>void; message?: string;
}) {
  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:199 }} onClick={onCancel} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:200, background:"#1a1d2e", border:`1px solid ${T.panel2B}`, borderRadius:14, padding:"24px", boxShadow:"0 12px 40px rgba(0,0,0,0.7)", minWidth:260, maxWidth:"90vw" }}>
        <p style={{ margin:"0 0 6px", fontSize:14, fontWeight:600, color:T.t2 }}>{message}</p>
        <p style={{ margin:"0 0 18px", fontSize:12, color:T.t4 }}>This action cannot be undone.</p>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onCancel}  style={{ flex:1, padding:"9px 0", fontSize:13, borderRadius:8, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t3, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:"9px 0", fontSize:13, borderRadius:8, background:T.red, border:"none", color:"#fff", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Yes, delete</button>
        </div>
      </div>
    </>
  );
}

// ─── Cascading filter bar ─────────────────────────────────────────────────────
interface CascadeFilters {
  org_id:         number;
  member_id:      number;
  project_id:     number;
  deliverable_id: number;
  date_from:      string;
  date_to:        string;
}

function CascadeFilterBar({ meta, filters, onChange, deliverableOptions, delivLoading, onApplyDateRange }: {
  meta: MetaData;
  filters: CascadeFilters;
  onChange: (f: Partial<CascadeFilters>) => void;
  deliverableOptions: DeliverableOption[];
  delivLoading: boolean;
  onApplyDateRange: () => void;
}) {
  const sel: React.CSSProperties = {
    background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:7,
    padding:"7px 10px", fontSize:12, color:T.t2, outline:"none", cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif", appearance:"none" as const, width:"100%",
    transition:"border-color 0.15s",
  };
  const inp: React.CSSProperties = {
    ...sel, cursor:"text", colorScheme:"dark" as any,
  };

  const visibleMembers = meta.members;
  const visibleProjects = filters.org_id
    ? meta.projects.filter(p => p.organisation_id === filters.org_id)
    : meta.projects;
  const visibleDelivs = deliverableOptions;

  const hasDateFilter = !!(filters.date_from || filters.date_to);

  return (
    <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ fontSize:11, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase" }}>Filters</div>

      {/* ── Date range row ── */}
      <div>
        <div style={{ fontSize:10, color:T.t5, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600 }}>Date Range</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div>
            <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>From</div>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => onChange({ date_from: e.target.value })}
              style={inp}
            />
          </div>
          <div>
            <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>To</div>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => onChange({ date_to: e.target.value })}
              style={inp}
            />
          </div>
        </div>
        <div style={{ display:"flex", gap:6, marginTop:8 }}>
          <button
            onClick={onApplyDateRange}
            disabled={!filters.date_from && !filters.date_to}
            style={{
              flex:1, padding:"7px 0", borderRadius:7, border:"none",
              background: (filters.date_from || filters.date_to) ? T.ac : T.panel2B,
              color: (filters.date_from || filters.date_to) ? "#fff" : T.t5,
              fontSize:12, fontWeight:600, cursor: (filters.date_from || filters.date_to) ? "pointer" : "default",
              fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s",
            }}
          >
            Apply Date Range
          </button>
          {hasDateFilter && (
            <button
              onClick={() => { onChange({ date_from:"", date_to:"" }); onApplyDateRange(); }}
              style={{
                padding:"7px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`,
                background:"transparent", color:T.red, fontSize:12,
                cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick presets */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:6 }}>
          {[
            { label:"This week", fn: () => {
              const { from, to } = currentWeekRange();
              onChange({ date_from: from, date_to: to });
            }},
            { label:"This month", fn: () => {
              const now = new Date();
              const { from, to } = (() => {
                const y = now.getFullYear(), m = now.getMonth();
                return { from: `${y}-${pad(m+1)}-01`, to: `${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}` };
              })();
              onChange({ date_from: from, date_to: to });
            }},
            { label:"Last month", fn: () => {
              const now = new Date();
              const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const y = d.getFullYear(), m = d.getMonth();
              onChange({ date_from: `${y}-${pad(m+1)}-01`, date_to: `${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}` });
            }},
          ].map(({ label, fn }) => (
            <button key={label} onClick={() => { fn(); setTimeout(onApplyDateRange, 0); }}
              style={{ padding:"4px 9px", borderRadius:5, border:`1px solid ${T.panel2B}`, background:T.panel2, color:T.t4, fontSize:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.acText; (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Cascade selects ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:8 }}>
        {/* Org */}
        <div>
          <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Organisation</div>
          <select value={filters.org_id} onChange={e => onChange({ org_id:Number(e.target.value), member_id:0, project_id:0, deliverable_id:0 })} style={sel}>
            <option value={0}>All</option>
            {meta.organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        {/* Member */}
        <div>
          <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Member</div>
          <select value={filters.member_id} onChange={e => onChange({ member_id:Number(e.target.value) })} style={sel}>
            <option value={0}>All</option>
            {visibleMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {/* Project */}
        <div>
          <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Project</div>
          <select value={filters.project_id} onChange={e => onChange({ project_id:Number(e.target.value), deliverable_id:0 })} style={sel}>
            <option value={0}>All</option>
            {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {/* Deliverable */}
        <div>
          <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Deliverable</div>
          {delivLoading ? (
            <div style={{ fontSize:11, color:T.t5, padding:"8px 0" }}>Loading…</div>
          ) : (
            <select value={filters.deliverable_id} onChange={e => onChange({ deliverable_id:Number(e.target.value) })} style={sel}>
              <option value={0}>All</option>
              {visibleDelivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {(filters.org_id || filters.member_id || filters.project_id || filters.deliverable_id || filters.date_from || filters.date_to) ? (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {filters.date_from && (
            <Chip label={`From: ${filters.date_from}`} onRemove={() => { onChange({ date_from:"" }); onApplyDateRange(); }} />
          )}
          {filters.date_to && (
            <Chip label={`To: ${filters.date_to}`} onRemove={() => { onChange({ date_to:"" }); onApplyDateRange(); }} />
          )}
          {filters.org_id > 0 && (
            <Chip label={meta.organisations.find(o => o.id===filters.org_id)?.name ?? ""} onRemove={() => onChange({org_id:0,member_id:0,project_id:0,deliverable_id:0})} />
          )}
          {filters.member_id > 0 && (
            <Chip label={meta.members.find(m => m.id===filters.member_id)?.name ?? ""} onRemove={() => onChange({member_id:0})} />
          )}
          {filters.project_id > 0 && (
            <Chip label={meta.projects.find(p => p.id===filters.project_id)?.name ?? ""} onRemove={() => onChange({project_id:0,deliverable_id:0})} />
          )}
          {filters.deliverable_id > 0 && (
            <Chip label={visibleDelivs.find(d => d.id===filters.deliverable_id)?.name ?? ""} onRemove={() => onChange({deliverable_id:0})} />
          )}
          <button onClick={() => { onChange({org_id:0,member_id:0,project_id:0,deliverable_id:0,date_from:"",date_to:""}); onApplyDateRange(); }}
            style={{ fontSize:11, color:T.red, background:"none", border:"none", cursor:"pointer", padding:"2px 6px" }}>
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:20, background:T.acLight, border:`1px solid ${T.acMid}`, fontSize:11, color:T.acText }}>
      {label}
      <button onClick={onRemove} style={{ background:"none", border:"none", color:T.acText, cursor:"pointer", padding:0, lineHeight:1, fontSize:12 }}>✕</button>
    </span>
  );
}

// ─── Worklog view card (read-only) ────────────────────────────────────────────
function WorklogViewCard({ row }: { row: MemberWorkLogEntry }) {
  return (
    <div style={{ background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:12, padding:"12px 14px" }}>
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.t2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.deliverable_name}</div>
        <div style={{ fontSize:11, color:T.t5, marginTop:2 }}>{row.organisation_name} · {row.project_name}</div>
      </div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:10, color:T.t5, marginBottom:2, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start</div>
          <div style={{ fontSize:12, color:T.t2, fontVariantNumeric:"tabular-nums" }}>{row.start_date_fmt} {row.start_time_fmt}</div>
        </div>
        <div>
          <div style={{ fontSize:10, color:T.t5, marginBottom:2, textTransform:"uppercase", letterSpacing:"0.05em" }}>End</div>
          <div style={{ fontSize:12, color:T.t2, fontVariantNumeric:"tabular-nums" }}>
            {row.end_date_fmt ? `${row.end_date_fmt} ${row.end_time_fmt}` : "—"}
          </div>
        </div>
        {row.remarks && (
          <div style={{ flex:1, minWidth:80 }}>
            <div style={{ fontSize:10, color:T.t5, marginBottom:2, textTransform:"uppercase", letterSpacing:"0.05em" }}>Remarks</div>
            <div style={{ fontSize:12, color:T.t3 }}>{row.remarks}</div>
          </div>
        )}
        <div style={{ marginLeft:"auto", fontSize:11, color:T.t5, flexShrink:0 }}>{row.employee_name}</div>
      </div>
    </div>
  );
}

// ─── Assignment card (editable) ───────────────────────────────────────────────
function AssignmentCard({ assignment, meta, onSave, onDelete }: {
  assignment: AssignmentEntry; meta: MetaData;
  onSave: (id: number, data: AssignmentEntry) => void;
  onDelete: (id: number) => void;
}) {
  const [editing,       setEditing]       = useState(false);
  const [draft,         setDraft]         = useState({ ...assignment });
  const [saving,        setSaving]        = useState(false);
  const [flash,         setFlash]         = useState(false);
  const [showDel,       setShowDel]       = useState(false);
  const [deliverables,  setDeliverables]  = useState<DeliverableOption[]>([]);
  const [loadingDelivs, setLoadingDelivs] = useState(false);
  const [error,         setError]         = useState("");

  function patch(p: Partial<typeof draft>) { setDraft(d => ({...d, ...p})); }
  function cancelEdit() { setDraft({...assignment}); setEditing(false); setError(""); }

  async function handleProjectChange(projId: number) {
    patch({ project_id:projId, deliverable_id:0 });
    setLoadingDelivs(true);
    try { setDeliverables(await fetchDeliverablesByProject(projId)); }
    finally { setLoadingDelivs(false); }
  }

  async function startEdit() {
    setEditing(true);
    setLoadingDelivs(true);
    try { setDeliverables(await fetchDeliverablesByProject(assignment.project_id)); }
    finally { setLoadingDelivs(false); }
  }

  async function save() {
    if (!draft.name.trim()) { setError("Task name is required."); return; }
    setSaving(true); setError("");
    try {
      const updated = await editAssignment(assignment.id, {
        name:        draft.name,
        deliverable: draft.deliverable_id,
        assigned_to: draft.assigned_to_id,
        start_date:  draft.start_date || null,
        due_date:    draft.due_date || null,
      });
      onSave(assignment.id, updated);
      setEditing(false); setFlash(true);
      setTimeout(() => setFlash(false), 900);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const inp: React.CSSProperties = { background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:6, padding:"7px 10px", fontSize:12, color:T.t2, width:"100%", outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" };
  const sel: React.CSSProperties = { ...inp, cursor:"pointer", appearance:"none" as const };
  const bg     = flash ? "rgba(16,185,129,0.08)" : editing ? "rgba(99,102,241,0.06)" : T.panel2;
  const border = flash ? `1px solid ${T.green}` : editing ? `1px solid ${T.acMid}` : `1px solid ${T.panel2B}`;

  return (
    <>
      {showDel && <DeleteModal message="Delete this assignment?" onConfirm={() => { setShowDel(false); deleteAssignment(assignment.id).then(() => onDelete(assignment.id)).catch(e => setError(e.message)); }} onCancel={() => setShowDel(false)} />}
      <div style={{ background:bg, border, borderRadius:12, padding:"12px 14px", transition:"all 0.15s" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:editing?10:0 }}>
          <div style={{ display:"flex", gap:4, flexShrink:0, paddingTop:2 }}>
            {editing ? (
              <>
                <button onClick={save} disabled={saving} title="Save"
                  style={{ width:30, height:30, borderRadius:8, border:"none", background:T.greenBg, color:T.green, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width={13} height={13} viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button onClick={cancelEdit} title="Cancel"
                  style={{ width:30, height:30, borderRadius:8, border:"none", background:T.panel2B, color:T.t4, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width={11} height={11} viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/></svg>
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit} title="Edit"
                  style={{ width:30, height:30, borderRadius:8, border:"none", background:"transparent", color:T.t5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.acLight; (e.currentTarget as HTMLElement).style.color = T.acText; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.t5; }}>
                  <svg width={12} height={12} viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"/></svg>
                </button>
                <button onClick={() => setShowDel(true)} title="Delete"
                  style={{ width:30, height:30, borderRadius:8, border:"none", background:"transparent", color:T.t5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.redBg; (e.currentTarget as HTMLElement).style.color = T.red; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.t5; }}>
                  <svg width={13} height={13} viewBox="0 0 14 14" fill="none">
                    <path d="M2 4h10M5 4V2.5h4V4M5.5 4v7M8.5 4v7M3 4l.5 7.5a1 1 0 001 .5h5a1 1 0 001-.5L11 4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </>
            )}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            {editing ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div>
                  <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Task Name</div>
                  <input value={draft.name} onChange={e => patch({name:e.target.value})} style={inp} placeholder="Task name…" />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  <div>
                    <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Organisation</div>
                    <select value={draft.organisation_id} onChange={e => patch({organisation_id:Number(e.target.value)})} style={sel}>
                      {meta.organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Project</div>
                    <select value={draft.project_id} onChange={e => handleProjectChange(Number(e.target.value))} style={sel}>
                      {meta.projects.filter(p => p.organisation_id === draft.organisation_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Deliverable</div>
                  {loadingDelivs
                    ? <div style={{ fontSize:11, color:T.t5 }}>Loading…</div>
                    : <select value={deliverables.some(d => d.id === draft.deliverable_id) ? draft.deliverable_id : ""} onChange={e => patch({deliverable_id:Number(e.target.value)})} style={sel}>
                        {!deliverables.some(d => d.id === draft.deliverable_id) && <option value="">— select —</option>}
                        {deliverables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                  }
                </div>
                <div>
                  <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Assigned To</div>
                  <select value={draft.assigned_to_id} onChange={e => patch({assigned_to_id:Number(e.target.value)})} style={sel}>
                    {meta.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  <div>
                    <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start Date</div>
                    <input type="date" value={draft.start_date??""} onChange={e => patch({start_date:e.target.value})} style={{...inp, colorScheme:"dark"}} />
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Due Date</div>
                    <input type="date" value={draft.due_date??""} onChange={e => patch({due_date:e.target.value})} style={{...inp, colorScheme:"dark"}} />
                  </div>
                </div>
                {error && <div style={{ fontSize:11, color:T.red }}>⚠ {error}</div>}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.t2 }}>{assignment.name}</div>
                <div style={{ fontSize:11, color:T.t5 }}>{assignment.organisation_name} · {assignment.project_name} · {assignment.deliverable_name}</div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:4 }}>
                  <div>
                    <span style={{ fontSize:10, color:T.t5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Assigned to: </span>
                    <span style={{ fontSize:12, color:T.acText, fontWeight:500 }}>{assignment.assigned_to_name}</span>
                  </div>
                  {assignment.start_date && (
                    <div>
                      <span style={{ fontSize:10, color:T.t5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start: </span>
                      <span style={{ fontSize:12, color:T.t3 }}>{assignment.start_date}</span>
                    </div>
                  )}
                  {assignment.due_date && (
                    <div>
                      <span style={{ fontSize:10, color:T.t5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Due: </span>
                      <span style={{ fontSize:12, color:T.amber, fontWeight:500 }}>{assignment.due_date}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Add assignment form ──────────────────────────────────────────────────────
function AddAssignmentForm({ meta, selectedMemberId, onAdd }: {
  meta: MetaData; selectedMemberId: number; onAdd: (a: AssignmentEntry) => void;
}) {
  const [open,          setOpen]          = useState(false);
  const [draft,         setDraft]         = useState({ name:"", organisation_id:meta.organisations[0]?.id??0, project_id:0, deliverable_id:0, assigned_to:selectedMemberId, start_date:"", due_date:"" });
  const [saving,        setSaving]        = useState(false);
  const [deliverables,  setDeliverables]  = useState<DeliverableOption[]>([]);
  const [loadingDelivs, setLoadingDelivs] = useState(false);
  const [error,         setError]         = useState("");

  useEffect(() => { setDraft(d => ({...d, assigned_to:selectedMemberId})); }, [selectedMemberId]);

  function patch(p: Partial<typeof draft>) { setDraft(d => ({...d, ...p})); }

  async function handleProjectChange(projId: number) {
    patch({ project_id:projId, deliverable_id:0 });
    setLoadingDelivs(true);
    try { setDeliverables(await fetchDeliverablesByProject(projId)); }
    finally { setLoadingDelivs(false); }
  }

  async function handleAdd() {
    if (!draft.name.trim() || !draft.deliverable_id || !draft.assigned_to) {
      setError("Name, deliverable and assigned member are required."); return;
    }
    setSaving(true); setError("");
    try {
      const created = await createAssignment({
        name:        draft.name,
        deliverable: draft.deliverable_id,
        assigned_to: draft.assigned_to,
        start_date:  draft.start_date || undefined,
        due_date:    draft.due_date || undefined,
      });
      onAdd(created);
      setDraft({ name:"", organisation_id:meta.organisations[0]?.id??0, project_id:0, deliverable_id:0, assigned_to:selectedMemberId, start_date:"", due_date:"" });
      setDeliverables([]); setOpen(false);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const filteredProjects = meta.projects.filter(p => p.organisation_id === draft.organisation_id);
  const inp: React.CSSProperties = { background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:7, padding:"8px 10px", fontSize:12, color:T.t2, width:"100%", outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" };
  const sel: React.CSSProperties = { ...inp, cursor:"pointer", appearance:"none" as const };

  return (
    <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:14, overflow:"hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%", padding:"13px 16px", background:"transparent", border:"none", color:T.acText, fontSize:13, fontWeight:600, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:8, fontFamily:"'DM Sans',sans-serif" }}>
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/></svg>
        Assign Task
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" style={{ marginLeft:"auto", transform:open?"rotate(180deg)":"none", transition:"transform 0.2s" }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          <div>
            <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Task Name</div>
            <input value={draft.name} onChange={e => patch({name:e.target.value})} placeholder="Task name…" style={inp} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Organisation</div>
              <select value={draft.organisation_id} onChange={e => patch({organisation_id:Number(e.target.value),project_id:0,deliverable_id:0})} style={sel}>
                <option value={0}>— select —</option>
                {meta.organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Project</div>
              <select value={draft.project_id} onChange={e => handleProjectChange(Number(e.target.value))} style={sel}>
                <option value={0}>— select —</option>
                {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Deliverable</div>
            {loadingDelivs
              ? <div style={{ fontSize:12, color:T.t5 }}>Loading…</div>
              : <select value={draft.deliverable_id} onChange={e => patch({deliverable_id:Number(e.target.value)})} style={sel}>
                  <option value={0}>— select —</option>
                  {deliverables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            }
          </div>
          <div>
            <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Assign To</div>
            <select value={draft.assigned_to} onChange={e => patch({assigned_to:Number(e.target.value)})} style={sel}>
              <option value={0}>— select member —</option>
              {meta.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start Date</div>
              <input type="date" value={draft.start_date} onChange={e => patch({start_date:e.target.value})} style={{...inp, colorScheme:"dark"}} />
            </div>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Due Date</div>
              <input type="date" value={draft.due_date} onChange={e => patch({due_date:e.target.value})} style={{...inp, colorScheme:"dark"}} />
            </div>
          </div>
          {error && <div style={{ fontSize:12, color:T.red, padding:"6px 10px", background:T.redBg, borderRadius:7 }}>⚠ {error}</div>}
          <button onClick={handleAdd} disabled={saving}
            style={{ padding:"10px 0", borderRadius:9, border:"none", background:T.ac, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", opacity:saving?0.6:1 }}>
            {saving ? "Saving…" : "Create Assignment"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ManagerPage() {
  const w        = useWindowWidth();
  const isMobile = w < 700;
  const today    = new Date();

  // ── Calendar ──────────────────────────────────────────────────────────────
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number|null>(null);
  const [selYear,  setSelYear]  = useState<number|null>(null);

  // ── Shared cascade filters (including date range) ─────────────────────────
  const [filters, setFilters] = useState<CascadeFilters>({
    org_id:0, member_id:0, project_id:0, deliverable_id:0,
    date_from:"", date_to:"",
  });
  const [filterDelivs,    setFilterDelivs]    = useState<DeliverableOption[]>([]);
  const [filterDelivLoad, setFilterDelivLoad] = useState(false);

  function updateFilters(partial: Partial<CascadeFilters>) {
    setFilters(prev => ({ ...prev, ...partial }));
  }

  // Load deliverables when project filter changes
  useEffect(() => {
    if (!filters.project_id) { setFilterDelivs([]); return; }
    setFilterDelivLoad(true);
    fetchDeliverablesByProject(filters.project_id)
      .then(setFilterDelivs)
      .finally(() => setFilterDelivLoad(false));
  }, [filters.project_id]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [meta,          setMeta]          = useState<MetaData>({organisations:[],projects:[],members:[]});
  const [rows,          setRows]          = useState<MemberWorkLogEntry[]>([]);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalCount,    setTotalCount]    = useState(0);
  const [currentPage,   setCurrentPage]  = useState(1);
  const [assignments,   setAssignments]  = useState<AssignmentEntry[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [rowsLoading,   setRowsLoading]  = useState(false);
  const [assignLoading, setAssignLoading]= useState(false);
  const [error,         setError]        = useState<string|null>(null);

  const dateRangeRef = useRef<{from?:string;to?:string}>({});

  async function loadRows(params:{from?:string;to?:string;page?:number;member_id?:number}) {
    dateRangeRef.current = {from:params.from, to:params.to};
    setRowsLoading(true);
    try {
      const data = await fetchMemberWorkLogs(params);
      setRows(data.results); setTotalPages(data.pages);
      setTotalCount(data.count); setCurrentPage(data.page);
    } catch(e:any) { setError(e.message); }
    finally { setRowsLoading(false); }
  }

  async function loadAssignments(memberId?: number) {
    setAssignLoading(true);
    try { setAssignments(await fetchAssignments(memberId)); }
    catch(e:any) { setError(e.message); }
    finally { setAssignLoading(false); }
  }

  // Initial load — default to current week
  useEffect(() => {
    const {from, to} = currentWeekRange();
    // Pre-fill filter date inputs to match initial load
    setFilters(f => ({ ...f, date_from: from, date_to: to }));
    Promise.all([fetchMeta(), fetchMemberWorkLogs({from, to, page:1}), fetchAssignments()])
      .then(([m, worklogs, assigns]) => {
        setMeta(m);
        setRows(worklogs.results); setTotalPages(worklogs.pages);
        setTotalCount(worklogs.count); setCurrentPage(1);
        setAssignments(assigns);
        dateRangeRef.current = {from, to};
        setLoading(false);
      }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // ── Date range resolution (priority: date filter > calendar > default week) ─
  // Returns the effective from/to for a load call
  function resolveRange(overrideFrom?: string, overrideTo?: string): {from:string;to:string} {
    const f = overrideFrom ?? filters.date_from;
    const t = overrideTo   ?? filters.date_to;

    // 1. Explicit date range filter wins
    if (f || t) return { from: f || "", to: t || "" };

    // 2. Calendar date selections
    if (selDates.size > 0) {
      const s = Array.from(selDates).sort();
      return { from: s[0], to: s[s.length-1] };
    }

    // 3. Calendar month/year selection
    if (selMonth !== null || selYear !== null) {
      const year  = selYear  ?? today.getFullYear();
      const month = selMonth ?? today.getMonth();
      return monthRange(year, month);
    }

    // 4. Default: current week
    return currentWeekRange();
  }

  // Called when user clicks "Apply Date Range" button
  function applyDateRange() {
    // Clear calendar selections so date range takes over
    setSelDates(new Set()); setSelMonth(null); setSelYear(null);
    const { from, to } = resolveRange(filters.date_from, filters.date_to);
    loadRows({ from, to, page:1, member_id: filters.member_id || undefined });
  }

  // Refetch worklogs when calendar selections change (calendar still works independently)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    // Only react to calendar changes when no explicit date range filter is active
    if (filters.date_from || filters.date_to) return;
    const { from, to } = resolveRange();
    loadRows({ from, to, page:1, member_id: filters.member_id || undefined });
  }, [selDates, selMonth, selYear]);

  // Refetch when member filter changes
  useEffect(() => {
    if (isFirstRender.current) return;
    const { from, to } = resolveRange();
    loadRows({ from, to, page:1, member_id: filters.member_id || undefined });
    loadAssignments(filters.member_id || undefined);
  }, [filters.member_id]);

  function goToPage(p:number) {
    const { from, to } = resolveRange();
    loadRows({ from, to, page:p, member_id: filters.member_id || undefined });
  }

  const activeDates  = useMemo(() => new Set(rows.map(r => r.end_date_fmt ?? r.start_date_fmt).filter(Boolean) as string[]), [rows]);
  const totalMinutes = useMemo(() => rows.reduce((s,r) => {
    if (!r.start_time || !r.end_time) return s;
    return s + Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000);
  }, 0), [rows]);
  const availableYears = useMemo(() => Array.from(new Set(rows.map(r => new Date(r.start_time).getFullYear()))).sort(), [rows]);
  const hasCalFilter   = selDates.size > 0 || selMonth !== null || selYear !== null;
  const hasDateFilter  = !!(filters.date_from || filters.date_to);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredRows = useMemo(() => rows.filter(r => {
    if (filters.org_id         && r.organisation_id !== filters.org_id)         return false;
    if (filters.project_id     && r.project_id      !== filters.project_id)     return false;
    if (filters.deliverable_id && r.deliverable      !== filters.deliverable_id) return false;
    return true;
  }), [rows, filters]);

  const filteredAssignments = useMemo(() => assignments.filter(a => {
    if (filters.org_id         && a.organisation_id  !== filters.org_id)         return false;
    if (filters.member_id      && a.assigned_to_id   !== filters.member_id)      return false;
    if (filters.project_id     && a.project_id       !== filters.project_id)     return false;
    if (filters.deliverable_id && a.deliverable_id   !== filters.deliverable_id) return false;
    return true;
  }), [assignments, filters]);

  function saveAssignment(id:number, data:AssignmentEntry) { setAssignments(p => p.map(a => a.id===id ? data : a)); }
  function deleteAssignmentLocal(id:number) { setAssignments(p => p.filter(a => a.id!==id)); }
  function addAssignment(a:AssignmentEntry) { setAssignments(p => [a, ...p]); }

  function toggleDate(iso:string) {
    // Clear date range filter when using calendar
    if (filters.date_from || filters.date_to) {
      updateFilters({ date_from:"", date_to:"" });
    }
    setSelDates(p => { const n=new Set(p); n.has(iso)?n.delete(iso):n.add(iso); return n; });
  }
  function prevMonth() {
    const m=calMonth===0?11:calMonth-1, y=calMonth===0?calYear-1:calYear;
    setCalMonth(m); setCalYear(y); setSelMonth(m); setSelYear(y); setSelDates(new Set());
    updateFilters({ date_from:"", date_to:"" });
  }
  function nextMonth() {
    const m=calMonth===11?0:calMonth+1, y=calMonth===11?calYear+1:calYear;
    setCalMonth(m); setCalYear(y); setSelMonth(m); setSelYear(y); setSelDates(new Set());
    updateFilters({ date_from:"", date_to:"" });
  }
  function clearCal() { setSelDates(new Set()); setSelMonth(null); setSelYear(null); }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:220, height:3, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, animation:"initload 1.2s ease-in-out infinite alternate" }} />
      </div>
      <span style={{ fontSize:12, color:T.t5 }}>Loading manager view…</span>
      <style>{`@keyframes initload{from{width:15%;margin-left:0}to{width:60%;margin-left:35%}}`}</style>
    </div>
  );
  if (error) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", color:T.red, fontFamily:"'DM Sans',sans-serif" }}>{error}</div>
  );

  // ── Calendar panel ────────────────────────────────────────────────────────
  const CalendarPanel = (
    <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:16, padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={prevMonth} style={{ width:28, height:28, borderRadius:7, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t4, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
        <span style={{ fontSize:12, fontWeight:600, color:T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
        <button onClick={nextMonth} style={{ width:28, height:28, borderRadius:7, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t4, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>

      {/* Dim calendar when date range filter is active */}
      <div style={{ opacity: hasDateFilter ? 0.4 : 1, pointerEvents: hasDateFilter ? "none" : "auto", transition:"opacity 0.2s" }}>
        <CalGrid year={calYear} month={calMonth} activeDates={activeDates} selDates={selDates} onToggle={toggleDate} />
      </div>

      {hasDateFilter && (
        <div style={{ textAlign:"center", fontSize:11, color:T.acText, padding:"4px 8px", background:T.acLight, borderRadius:6 }}>
          Date range filter active
        </div>
      )}

      {selDates.size > 0 && !hasDateFilter && (
        <div style={{ textAlign:"center", fontSize:11, color:T.acText }}>
          {selDates.size} date{selDates.size>1?"s":""} selected &nbsp;
          <button onClick={() => setSelDates(new Set())} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:11 }}>✕</button>
        </div>
      )}
      <Divider />
      <div>
        <div style={{ fontSize:10, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Month</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3, opacity: hasDateFilter ? 0.4 : 1, pointerEvents: hasDateFilter ? "none" : "auto" }}>
          {MONTHS.map((m,i) => (
            <button key={m} onClick={() => { const n=selMonth===i?null:i; setSelMonth(n); if(n!==null){setCalMonth(n);setSelDates(new Set());updateFilters({date_from:"",date_to:""}); } }}
              style={{ background:selMonth===i?T.acLight:T.panel2, border:`1px solid ${selMonth===i?T.acMid:T.panel2B}`, borderRadius:5, color:selMonth===i?T.acText:T.t4, fontSize:9, padding:"4px 0", cursor:"pointer", textTransform:"uppercase", fontWeight:selMonth===i?600:400, transition:"all 0.15s" }}>
              {m.slice(0,3)}
            </button>
          ))}
        </div>
      </div>
      {availableYears.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Year</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", opacity: hasDateFilter ? 0.4 : 1, pointerEvents: hasDateFilter ? "none" : "auto" }}>
            {availableYears.map(y => (
              <button key={y} onClick={() => { const n=selYear===y?null:y; setSelYear(n); if(n!==null){setCalYear(n);setSelDates(new Set());updateFilters({date_from:"",date_to:""});} }}
                style={{ background:selYear===y?T.acLight:T.panel2, border:`1px solid ${selYear===y?T.acMid:T.panel2B}`, borderRadius:5, color:selYear===y?T.acText:T.t4, fontSize:9, padding:"4px 8px", cursor:"pointer", fontWeight:selYear===y?600:400, transition:"all 0.15s" }}>
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
      <Divider />
      {[
        {label:"Worklogs",    val:`${filteredRows.length}/${totalCount}`},
        {label:"Hours",       val:`${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`},
        {label:"Assignments", val:String(filteredAssignments.length)},
      ].map(({label,val}) => (
        <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.t4 }}>{label}</span>
          <span style={{ fontSize:12, color:T.acText, fontWeight:600 }}>{val}</span>
        </div>
      ))}
      {(hasCalFilter || hasDateFilter) && (
        <>
          <Divider />
          <button onClick={() => { clearCal(); updateFilters({date_from:"",date_to:""}); applyDateRange(); }}
            style={{ background:"transparent", border:`1px solid ${T.panel2B}`, borderRadius:7, padding:"6px 0", fontSize:11, color:T.t4, cursor:"pointer", width:"100%" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}>
            ✕ &nbsp;Clear all date filters
          </button>
        </>
      )}
    </div>
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const PaginationControls = totalPages > 1 ? (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, paddingTop:4, flexWrap:"wrap" }}>
      <button onClick={() => goToPage(currentPage-1)} disabled={currentPage===1}
        style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`, background:T.panel2, color:currentPage===1?T.t6:T.t3, cursor:currentPage===1?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>‹ Prev</button>
      {Array.from({length:totalPages},(_,i)=>i+1)
        .filter(p => p===1||p===totalPages||Math.abs(p-currentPage)<=1)
        .reduce<(number|"…")[]>((acc,p,i,arr) => {
          if (i>0&&(p as number)-(arr[i-1] as number)>1) acc.push("…");
          acc.push(p); return acc;
        },[])
        .map((p,i) => p==="…"
          ? <span key={`e${i}`} style={{ color:T.t5, fontSize:12 }}>…</span>
          : <button key={p} onClick={() => goToPage(p as number)}
              style={{ width:32, height:32, borderRadius:7, border:`1px solid ${currentPage===p?T.acMid:T.panel2B}`, background:currentPage===p?T.acLight:T.panel2, color:currentPage===p?T.acText:T.t3, cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif", fontWeight:currentPage===p?600:400 }}>
              {p}
            </button>
        )}
      <button onClick={() => goToPage(currentPage+1)} disabled={currentPage===totalPages}
        style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`, background:T.panel2, color:currentPage===totalPages?T.t6:T.t3, cursor:currentPage===totalPages?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>Next ›</button>
    </div>
  ) : null;

  // ── Right panel ───────────────────────────────────────────────────────────
  // Active range label for display
  const activeRangeLabel = (() => {
    if (filters.date_from && filters.date_to) return `${filters.date_from} → ${filters.date_to}`;
    if (filters.date_from) return `From ${filters.date_from}`;
    if (filters.date_to)   return `Until ${filters.date_to}`;
    if (selDates.size > 0) {
      const s = Array.from(selDates).sort();
      return selDates.size === 1 ? s[0] : `${s[0]} → ${s[s.length-1]}`;
    }
    if (selMonth !== null) return `${MONTHS[selMonth]}${selYear ? " "+selYear:""}`;
    return "This week";
  })();

  const RightPanel = (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      <CascadeFilterBar
        meta={meta}
        filters={filters}
        onChange={updateFilters}
        deliverableOptions={filterDelivs}
        delivLoading={filterDelivLoad}
        onApplyDateRange={applyDateRange}
      />

      {/* ── Worklogs ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.t2 }}>
            Worklogs
            {filters.member_id > 0 && (
              <span style={{ fontSize:11, color:T.t5, marginLeft:8, fontWeight:400 }}>
                — {meta.members.find(m => m.id===filters.member_id)?.name}
              </span>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:10, color:T.t5, background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:5, padding:"3px 8px" }}>
              📅 {activeRangeLabel}
            </span>
            <span style={{ fontSize:11, color:T.t5 }}>
              {filteredRows.length}{totalCount > rows.length ? `/${totalCount}` : ""} entries
            </span>
          </div>
        </div>

        {rowsLoading ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"32px 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ height:3, width:120, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, animation:"pulse 1s ease-in-out infinite alternate" }} />
            </div>
            <style>{`@keyframes pulse{from{width:20%;margin-left:0}to{width:60%;margin-left:30%}}`}</style>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"40px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:T.t6 }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}><circle cx={12} cy={12} r={10}/><path d="M12 6v6l4 2"/></svg>
            <span style={{ fontSize:13 }}>No worklogs for this selection</span>
          </div>
        ) : filteredRows.map(row => <WorklogViewCard key={row.id} row={row} />)}

        {PaginationControls}
      </div>

      {/* ── Assignments ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.t2 }}>
            Assignments
            {filters.member_id > 0 && (
              <span style={{ fontSize:11, color:T.t5, marginLeft:8, fontWeight:400 }}>
                — {meta.members.find(m => m.id===filters.member_id)?.name}
              </span>
            )}
          </div>
          <span style={{ fontSize:11, color:T.t5 }}>{filteredAssignments.length} entries</span>
        </div>

        <AddAssignmentForm meta={meta} selectedMemberId={filters.member_id} onAdd={addAssignment} />

        {assignLoading ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"24px 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ height:3, width:120, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, animation:"pulse 1s ease-in-out infinite alternate" }} />
            </div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"32px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:T.t6 }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}><rect x={3} y={3} width={18} height={18} rx={3}/><path d="M9 9h6M9 13h4"/></svg>
            <span style={{ fontSize:13 }}>No assignments for this selection</span>
          </div>
        ) : filteredAssignments.map(a => (
          <AssignmentCard key={a.id} assignment={a} meta={meta} onSave={saveAssignment} onDelete={deleteAssignmentLocal} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      <ProgressBar loading={rowsLoading || assignLoading} />
      <div style={{ minHeight:"100vh", background:T.bg, color:T.t2, fontFamily:"'DM Sans','Sora',sans-serif", padding:isMobile?"14px 12px 48px":"28px 28px 56px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
          *{box-sizing:border-box;}
          ::-webkit-scrollbar{width:4px;height:4px}
          ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px}
          input[type=date]::-webkit-calendar-picker-indicator,
          input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer}
          select option{background:#1a1d2e;color:#f1f5f9}
          select{max-width:100%;}
          input,select{font-size:12px !important;}
          @media(max-width:700px){input,select{font-size:16px !important;}}
        `}</style>

        <div style={{ marginBottom:isMobile?14:22 }}>
          <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, fontFamily:"'Sora',sans-serif", letterSpacing:"-0.03em", color:T.t1, margin:0 }}>Manager View</h1>
          <p style={{ color:T.t5, fontSize:12, margin:"3px 0 0" }}>View member worklogs · manage assignments</p>
        </div>

        {isMobile ? (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {CalendarPanel}
            {RightPanel}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:20, alignItems:"start" }}>
            {CalendarPanel}
            {RightPanel}
          </div>
        )}
      </div>
    </>
  );
}