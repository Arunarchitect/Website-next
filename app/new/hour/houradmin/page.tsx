"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  fetchMeta, fetchMemberWorkLogs, fetchAssignments,
  fetchDeliverablesByProject, createAssignment, editAssignment, deleteAssignment,
  currentWeekRange,
  type MemberWorkLogEntry, type WorkLogPage, type MetaData,
  type AssignmentEntry, type MemberOption, type DeliverableOption,
} from "@/app/new/manager_api";

// ─── Constants ────────────────────────────────────────────────────────────────
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

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  assignment: AssignmentEntry;
  meta: MetaData;
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
    // Load deliverables for current project
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
          {/* Action buttons LEFT */}
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
  meta: MetaData;
  selectedMemberId: number;
  onAdd: (a: AssignmentEntry) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [draft,  setDraft]  = useState({ name:"", organisation_id:meta.organisations[0]?.id??0, project_id:0, deliverable_id:0, assigned_to:selectedMemberId, start_date:"", due_date:"" });
  const [saving,        setSaving]        = useState(false);
  const [deliverables,  setDeliverables]  = useState<DeliverableOption[]>([]);
  const [loadingDelivs, setLoadingDelivs] = useState(false);
  const [error,         setError]         = useState("");

  // sync assigned_to when selectedMember changes
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
      setDeliverables([]);
      setOpen(false);
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

// ─── Member selector ──────────────────────────────────────────────────────────
function MemberSelector({ members, selectedId, onSelect }: {
  members: MemberOption[]; selectedId: number; onSelect: (id: number) => void;
}) {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      <button onClick={() => onSelect(0)}
        style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${selectedId===0?T.acMid:T.panel2B}`, background:selectedId===0?T.acLight:"transparent", color:selectedId===0?T.acText:T.t4, fontSize:12, fontWeight:selectedId===0?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s" }}>
        All Members
      </button>
      {members.map(m => (
        <button key={m.id} onClick={() => onSelect(m.id)}
          style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${selectedId===m.id?T.acMid:T.panel2B}`, background:selectedId===m.id?T.acLight:"transparent", color:selectedId===m.id?T.acText:T.t4, fontSize:12, fontWeight:selectedId===m.id?600:400, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s" }}>
          {m.name}
        </button>
      ))}
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

  // ── Data ──────────────────────────────────────────────────────────────────
  const [meta,           setMeta]           = useState<MetaData>({organisations:[],projects:[],members:[]});
  const [selectedMember, setSelectedMember] = useState(0);
  const [rows,           setRows]           = useState<MemberWorkLogEntry[]>([]);
  const [totalPages,     setTotalPages]     = useState(1);
  const [totalCount,     setTotalCount]     = useState(0);
  const [currentPage,    setCurrentPage]    = useState(1);
  const [assignments,    setAssignments]    = useState<AssignmentEntry[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [rowsLoading,    setRowsLoading]    = useState(false);
  const [assignLoading,  setAssignLoading]  = useState(false);
  const [error,          setError]          = useState<string|null>(null);

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

  async function loadAssignments(memberId: number) {
    setAssignLoading(true);
    try { setAssignments(await fetchAssignments(memberId || undefined)); }
    catch(e:any) { setError(e.message); }
    finally { setAssignLoading(false); }
  }

  // Initial load
  useEffect(() => {
    const {from, to} = currentWeekRange();
    Promise.all([
      fetchMeta(),
      fetchMemberWorkLogs({from, to, page:1}),
      fetchAssignments(),
    ]).then(([m, worklogs, assigns]) => {
      setMeta(m);
      setRows(worklogs.results); setTotalPages(worklogs.pages);
      setTotalCount(worklogs.count); setCurrentPage(1);
      setAssignments(assigns);
      dateRangeRef.current = {from, to};
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Re-fetch when member or date filter changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    let from:string, to:string;
    if (selDates.size > 0) {
      const s = Array.from(selDates).sort(); from = s[0]; to = s[s.length-1];
    } else {
      const year = selYear ?? today.getFullYear(), month = selMonth ?? today.getMonth();
      ({from, to} = monthRange(year, month));
    }
    loadRows({from, to, page:1, member_id:selectedMember||undefined});
  }, [selDates, selMonth, selYear, selectedMember]);

  // Re-fetch assignments when member changes
  useEffect(() => {
    if (isFirstRender.current) return;
    loadAssignments(selectedMember);
  }, [selectedMember]);

  function goToPage(p:number) { loadRows({...dateRangeRef.current, page:p, member_id:selectedMember||undefined}); }

  const activeDates  = useMemo(() => new Set(rows.map(r => r.end_date_fmt ?? r.start_date_fmt).filter(Boolean) as string[]), [rows]);
  const totalMinutes = useMemo(() => rows.reduce((s,r) => {
    if (!r.start_time || !r.end_time) return s;
    return s + Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000);
  }, 0), [rows]);
  const availableYears = useMemo(() => Array.from(new Set(rows.map(r => new Date(r.start_time).getFullYear()))).sort(), [rows]);
  const hasFilter = selDates.size > 0 || selMonth !== null || selYear !== null;

  function saveAssignment(id:number, data:AssignmentEntry) { setAssignments(p => p.map(a => a.id===id ? data : a)); }
  function deleteAssignmentLocal(id:number) { setAssignments(p => p.filter(a => a.id!==id)); }
  function addAssignment(a:AssignmentEntry) { setAssignments(p => [a, ...p]); }

  function toggleDate(iso:string) { setSelDates(p => { const n=new Set(p); n.has(iso)?n.delete(iso):n.add(iso); return n; }); }
  function prevMonth() {
    const m=calMonth===0?11:calMonth-1, y=calMonth===0?calYear-1:calYear;
    setCalMonth(m); setCalYear(y); setSelMonth(m); setSelYear(y); setSelDates(new Set());
  }
  function nextMonth() {
    const m=calMonth===11?0:calMonth+1, y=calMonth===11?calYear+1:calYear;
    setCalMonth(m); setCalYear(y); setSelMonth(m); setSelYear(y); setSelDates(new Set());
  }
  function clearAll() { setSelDates(new Set()); setSelMonth(null); setSelYear(null); }

  // Filtered assignments for selected member
  const filteredAssignments = useMemo(() =>
    selectedMember ? assignments.filter(a => a.assigned_to_id === selectedMember) : assignments,
  [assignments, selectedMember]);

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

  // ── Shared calendar panel ─────────────────────────────────────────────────
  const CalendarPanel = (
    <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:16, padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={prevMonth} style={{ width:28, height:28, borderRadius:7, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t4, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
        <span style={{ fontSize:12, fontWeight:600, color:T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
        <button onClick={nextMonth} style={{ width:28, height:28, borderRadius:7, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t4, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>
      <CalGrid year={calYear} month={calMonth} activeDates={activeDates} selDates={selDates} onToggle={toggleDate} />
      {selDates.size > 0 && (
        <div style={{ textAlign:"center", fontSize:11, color:T.acText }}>
          {selDates.size} date{selDates.size>1?"s":""} selected &nbsp;
          <button onClick={() => setSelDates(new Set())} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:11 }}>✕</button>
        </div>
      )}
      <Divider />
      <div>
        <div style={{ fontSize:10, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Month</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3 }}>
          {MONTHS.map((m,i) => (
            <button key={m} onClick={() => { const n=selMonth===i?null:i; setSelMonth(n); if(n!==null){setCalMonth(n);setSelDates(new Set());} }}
              style={{ background:selMonth===i?T.acLight:T.panel2, border:`1px solid ${selMonth===i?T.acMid:T.panel2B}`, borderRadius:5, color:selMonth===i?T.acText:T.t4, fontSize:9, padding:"4px 0", cursor:"pointer", textTransform:"uppercase", fontWeight:selMonth===i?600:400, transition:"all 0.15s" }}>
              {m.slice(0,3)}
            </button>
          ))}
        </div>
      </div>
      {availableYears.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Year</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {availableYears.map(y => (
              <button key={y} onClick={() => { const n=selYear===y?null:y; setSelYear(n); if(n!==null){setCalYear(n);setSelDates(new Set());} }}
                style={{ background:selYear===y?T.acLight:T.panel2, border:`1px solid ${selYear===y?T.acMid:T.panel2B}`, borderRadius:5, color:selYear===y?T.acText:T.t4, fontSize:9, padding:"4px 8px", cursor:"pointer", fontWeight:selYear===y?600:400, transition:"all 0.15s" }}>
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
      <Divider />
      {[
        {label:"Entries",    val:`${rows.length}/${totalCount}`},
        {label:"Hours",      val:`${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`},
        {label:"Assignments",val:String(filteredAssignments.length)},
      ].map(({label,val}) => (
        <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:T.t4 }}>{label}</span>
          <span style={{ fontSize:12, color:T.acText, fontWeight:600 }}>{val}</span>
        </div>
      ))}
      {hasFilter && (
        <>
          <Divider />
          <button onClick={clearAll}
            style={{ background:"transparent", border:`1px solid ${T.panel2B}`, borderRadius:7, padding:"6px 0", fontSize:11, color:T.t4, cursor:"pointer", width:"100%" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}>
            ✕ &nbsp;Clear filters
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

  // ── Right panel content ───────────────────────────────────────────────────
  const RightPanel = (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Member selector */}
      <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:14, padding:"14px 16px" }}>
        <div style={{ fontSize:11, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>Filter by Member</div>
        <MemberSelector members={meta.members} selectedId={selectedMember} onSelect={id => { setSelectedMember(id); }} />
      </div>

      {/* Worklogs section */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.t2 }}>
            Worklogs
            {selectedMember > 0 && (
              <span style={{ fontSize:11, color:T.t5, marginLeft:8, fontWeight:400 }}>
                — {meta.members.find(m => m.id===selectedMember)?.name}
              </span>
            )}
          </div>
          <span style={{ fontSize:11, color:T.t5 }}>{totalCount} total</span>
        </div>

        {rowsLoading ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"32px 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ height:3, width:120, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, animation:"pulse 1s ease-in-out infinite alternate" }} />
            </div>
            <style>{`@keyframes pulse{from{width:20%;margin-left:0}to{width:60%;margin-left:30%}}`}</style>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"40px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:T.t6 }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}><circle cx={12} cy={12} r={10}/><path d="M12 6v6l4 2"/></svg>
            <span style={{ fontSize:13 }}>No worklogs for this selection</span>
          </div>
        ) : rows.map(row => <WorklogViewCard key={row.id} row={row} />)}

        {PaginationControls}
      </div>

      {/* Assignments section */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ fontSize:13, fontWeight:600, color:T.t2 }}>
          Assignments
          {selectedMember > 0 && (
            <span style={{ fontSize:11, color:T.t5, marginLeft:8, fontWeight:400 }}>
              — {meta.members.find(m => m.id===selectedMember)?.name}
            </span>
          )}
        </div>

        <AddAssignmentForm
          meta={meta}
          selectedMemberId={selectedMember}
          onAdd={addAssignment}
        />

        {assignLoading ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"24px 16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ height:3, width:120, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, animation:"pulse 1s ease-in-out infinite alternate" }} />
            </div>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"32px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:T.t6 }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}><rect x={3} y={3} width={18} height={18} rx={3}/><path d="M9 9h6M9 13h4"/></svg>
            <span style={{ fontSize:13 }}>No assignments yet</span>
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