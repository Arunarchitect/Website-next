/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  fetchMyWorkLogs, fetchMeta, fetchMyPinnedIds,
  fetchDeliverablesByProject, fetchInitialDeliverables,
  fetchWorkLogDates,
  createWorkLog, editWorkLog, deleteWorkLog,
  pinDeliverable, unpinDeliverable, currentWeekRange,
  type WorkLogEntry, type WorkLogPage, type MetaData,
  type DeliverableOption, type OrgOption, type ProjectOption,
} from "@/app/new/worklog_api";

import WorklogPDFButton from "@/app/new/hour/hournormal/WorklogPDFReport";

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
  red:"#ef4444", redBg:"rgba(239,68,68,0.12)",
  pin:"#f59e0b", pinBg:"rgba(245,158,11,0.12)",
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
      {DAYS.map(d => (
        <div key={d} style={{ textAlign:"center", fontSize:9, color:T.t5, fontWeight:600, letterSpacing:"0.06em", padding:"4px 0", textTransform:"uppercase" }}>{d}</div>
      ))}
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
function DeleteModal({ onConfirm, onCancel }: { onConfirm:()=>void; onCancel:()=>void }) {
  return (
    <>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:199 }} onClick={onCancel} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:200, background:"#1a1d2e", border:`1px solid ${T.panel2B}`, borderRadius:14, padding:"24px", boxShadow:"0 12px 40px rgba(0,0,0,0.7)", minWidth:260, maxWidth:"90vw" }}>
        <p style={{ margin:"0 0 6px", fontSize:14, fontWeight:600, color:T.t2 }}>Delete this entry?</p>
        <p style={{ margin:"0 0 18px", fontSize:12, color:T.t4 }}>This action cannot be undone.</p>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onCancel}  style={{ flex:1, padding:"9px 0", fontSize:13, borderRadius:8, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t3, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1, padding:"9px 0", fontSize:13, borderRadius:8, background:T.red, border:"none", color:"#fff", fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Yes, delete</button>
        </div>
      </div>
    </>
  );
}

// ─── Worklog card ─────────────────────────────────────────────────────────────
function WorklogCard({ row, meta, deliverables, onSave, onDelete }: {
  row:WorkLogEntry; meta:MetaData; deliverables:DeliverableOption[];
  onSave:(id:number,data:WorkLogEntry)=>void; onDelete:(id:number)=>void;
}) {
  const [editing,       setEditing]       = useState(false);
  const [draft,         setDraft]         = useState({...row});
  const [saving,        setSaving]        = useState(false);
  const [flash,         setFlash]         = useState(false);
  const [showDel,       setShowDel]       = useState(false);
  const [rowDelivs,     setRowDelivs]     = useState<DeliverableOption[]>(deliverables.filter(d => d.project_id === row.project_id));
  const [loadingDelivs, setLoadingDelivs] = useState(false);
  const [error,         setError]         = useState("");

  function patch(p: Partial<typeof draft>) { setDraft(d => ({...d, ...p})); }

  async function handleProjectChange(projId: number) {
    patch({ project_id:projId, deliverable:0 });
    setLoadingDelivs(true);
    try { setRowDelivs(await fetchDeliverablesByProject(projId)); }
    finally { setLoadingDelivs(false); }
  }

  function cancelEdit() { setDraft({...row}); setEditing(false); setError(""); }

  async function save() {
    const st = new Date(`${draft.start_date_fmt}T${draft.start_time_fmt}`);
    const et = draft.end_time_fmt ? new Date(`${draft.end_date_fmt}T${draft.end_time_fmt}`) : null;
    if (et && et <= st) { setError("End time must be after start time."); return; }
    setSaving(true); setError("");
    try {
      const updated = await editWorkLog(row.id, {
        deliverable: draft.deliverable,
        start_time:  `${draft.start_date_fmt}T${draft.start_time_fmt}:00`,
        end_time:    et ? `${draft.end_date_fmt}T${draft.end_time_fmt}:00` : undefined,
        remarks:     draft.remarks ?? "",
      });
      onSave(row.id, updated);
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
      {showDel && <DeleteModal onConfirm={() => { setShowDel(false); deleteWorkLog(row.id).then(() => onDelete(row.id)).catch(e => setError(e.message)); }} onCancel={() => setShowDel(false)} />}
      <div style={{ background:bg, border, borderRadius:12, padding:"12px 14px", transition:"all 0.15s" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:10 }}>
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
                <button onClick={() => setEditing(true)} title="Edit"
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
                    : <select value={rowDelivs.some(d => d.id === draft.deliverable) ? draft.deliverable : ""} onChange={e => patch({deliverable:Number(e.target.value)})} style={sel}>
                        {!rowDelivs.some(d => d.id === draft.deliverable) && <option value="">— select —</option>}
                        {rowDelivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                  }
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:13, fontWeight:600, color:T.t2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.deliverable_name}</div>
                <div style={{ fontSize:11, color:T.t5, marginTop:2 }}>{row.organisation_name} · {row.project_name}</div>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              <div>
                <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start Date</div>
                <input type="date" value={draft.start_date_fmt} onChange={e => patch({start_date_fmt:e.target.value})} style={{...inp, colorScheme:"dark"}} />
              </div>
              <div>
                <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start Time</div>
                <input type="time" value={draft.start_time_fmt} onChange={e => patch({start_time_fmt:e.target.value})} style={{...inp, colorScheme:"dark"}} />
              </div>
              <div>
                <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>End Date</div>
                <input type="date" value={draft.end_date_fmt??""} onChange={e => patch({end_date_fmt:e.target.value})} style={{...inp, colorScheme:"dark"}} />
              </div>
              <div>
                <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>End Time</div>
                <input type="time" value={draft.end_time_fmt??""} onChange={e => patch({end_time_fmt:e.target.value})} style={{...inp, colorScheme:"dark"}} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Remarks</div>
              <input value={draft.remarks??""} onChange={e => patch({remarks:e.target.value})} placeholder="Add note…" style={inp} />
            </div>
            {error && <div style={{ fontSize:11, color:T.red }}>⚠ {error}</div>}
          </div>
        ) : (
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
            <div style={{ marginLeft:"auto", fontSize:11, color:T.t5 }}>{row.employee_name}</div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Add worklog form ─────────────────────────────────────────────────────────
function AddWorklogForm({ meta, initialDeliverables, onAdd }: {
  meta:MetaData; initialDeliverables:DeliverableOption[]; onAdd:(w:WorkLogEntry)=>void;
}) {
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const [open,   setOpen]   = useState(false);
  const [draft,  setDraft]  = useState({ start_date:todayStr, start_time:"", end_date:todayStr, end_time:"", organisation_id:meta.organisations[0]?.id??0, project_id:0, deliverable:0, remarks:"" });
  const [saving,        setSaving]        = useState(false);
  const [deliverables,  setDeliverables]  = useState<DeliverableOption[]>(initialDeliverables);
  const [loadingDelivs, setLoadingDelivs] = useState(false);
  const [error,         setError]         = useState("");

  function patch(p: Partial<typeof draft>) { setDraft(d => ({...d, ...p})); }

  async function handleProjectChange(projId: number) {
    patch({ project_id:projId, deliverable:0 });
    setLoadingDelivs(true);
    try { setDeliverables(await fetchDeliverablesByProject(projId)); }
    finally { setLoadingDelivs(false); }
  }

  async function handleAdd() {
    if (!draft.deliverable || !draft.start_time) { setError("Please select a deliverable and start time."); return; }
    if (draft.end_time) {
      const st = new Date(`${draft.start_date}T${draft.start_time}`);
      const et = new Date(`${draft.end_date}T${draft.end_time}`);
      if (et <= st) { setError("End time must be after start time."); return; }
    }
    setSaving(true); setError("");
    try {
      const created = await createWorkLog({
        deliverable: draft.deliverable,
        start_time:  `${draft.start_date}T${draft.start_time}:00`,
        end_time:    draft.end_time ? `${draft.end_date}T${draft.end_time}:00` : undefined,
        remarks:     draft.remarks || undefined,
      });
      onAdd(created);
      setDraft({ start_date:todayStr, start_time:"", end_date:todayStr, end_time:"", organisation_id:meta.organisations[0]?.id??0, project_id:0, deliverable:0, remarks:"" });
      setDeliverables(initialDeliverables);
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
        Add Worklog
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" style={{ marginLeft:"auto", transform:open?"rotate(180deg)":"none", transition:"transform 0.2s" }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Organisation</div>
              <select value={draft.organisation_id} onChange={e => patch({organisation_id:Number(e.target.value),project_id:0,deliverable:0})} style={sel}>
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
              : <select value={draft.deliverable} onChange={e => patch({deliverable:Number(e.target.value)})} style={sel}>
                  <option value={0}>— select —</option>
                  {deliverables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            }
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start Date</div>
              <input type="date" value={draft.start_date} onChange={e => patch({start_date:e.target.value})} style={{...inp, colorScheme:"dark"}} />
            </div>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Start Time</div>
              <input type="time" value={draft.start_time} onChange={e => patch({start_time:e.target.value})} style={{...inp, colorScheme:"dark"}} />
            </div>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>End Date</div>
              <input type="date" value={draft.end_date} onChange={e => patch({end_date:e.target.value})} style={{...inp, colorScheme:"dark"}} />
            </div>
            <div>
              <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>End Time</div>
              <input type="time" value={draft.end_time} onChange={e => patch({end_time:e.target.value})} style={{...inp, colorScheme:"dark"}} />
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:T.t5, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Remarks</div>
            <input value={draft.remarks} onChange={e => patch({remarks:e.target.value})} placeholder="Optional…" style={inp} />
          </div>
          {error && <div style={{ fontSize:12, color:T.red, padding:"6px 10px", background:T.redBg, borderRadius:7 }}>⚠ {error}</div>}
          <button onClick={handleAdd} disabled={saving}
            style={{ padding:"10px 0", borderRadius:9, border:"none", background:T.ac, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", opacity:saving?0.6:1, marginTop:2 }}>
            {saving ? "Saving…" : "Add Worklog"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pin section with paginated deliverable list ──────────────────────────────
const PIN_PAGE_SIZE = 10;

function PinDeliverableSection({ meta, pinnedIds, onToggle }: {
  meta:MetaData; pinnedIds:Set<number>; onToggle:(id:number)=>void;
}) {
  const [selOrg,       setSelOrg]       = useState(0);
  const [selProj,      setSelProj]      = useState(0);
  const [deliverables, setDeliverables] = useState<DeliverableOption[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState("");

  async function handleOrgChange(orgId: number) {
    setSelOrg(orgId); setSelProj(0); setDeliverables([]); setPage(1); setSearch("");
    if (!orgId) { setLoaded(false); return; }
    setLoading(true);
    try { setDeliverables(await fetchDeliverablesByProject()); }
    finally { setLoading(false); setLoaded(true); }
  }

  async function handleProjChange(projId: number) {
    setSelProj(projId); setPage(1); setSearch(""); setLoading(true);
    try { setDeliverables(await fetchDeliverablesByProject(projId || undefined)); }
    finally { setLoading(false); setLoaded(true); }
  }

  const filteredProjects = selOrg ? meta.projects.filter(p => p.organisation_id === selOrg) : meta.projects;

  const filteredDelivs = useMemo(() => {
    let list = selOrg
      ? deliverables.filter(d => {
          const p = meta.projects.find(p => p.id === d.project_id);
          return (!selOrg || p?.organisation_id === selOrg) && (!selProj || d.project_id === selProj);
        })
      : [];
    if (search.trim()) {
      list = list.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [deliverables, selOrg, selProj, search, meta.projects]);

  const totalPages  = Math.max(1, Math.ceil(filteredDelivs.length / PIN_PAGE_SIZE));
  const pagedDelivs = filteredDelivs.slice((page-1)*PIN_PAGE_SIZE, page*PIN_PAGE_SIZE);

  const sel: React.CSSProperties = {
    background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:8,
    padding:"8px 10px", fontSize:12, color:T.t2, outline:"none", cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif", appearance:"none" as const, width:"100%",
    transition:"border-color 0.2s",
  };
  const inp: React.CSSProperties = {
    background:T.panel2, border:`1px solid ${T.panel2B}`, borderRadius:8,
    padding:"8px 10px", fontSize:12, color:T.t2, outline:"none",
    fontFamily:"'DM Sans',sans-serif", width:"100%", boxSizing:"border-box" as const,
  };

  return (
    <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:16, padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:T.t2, marginBottom:2 }}>Pin Deliverables to Quick Access</div>
        <div style={{ fontSize:11.5, color:T.t5 }}>Select an organisation to browse and pin deliverables.</div>
      </div>
      <Divider />
      <div style={{ display:"grid", gridTemplateColumns:selOrg ? "1fr 1fr" : "1fr", gap:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Organisation</div>
          <select value={selOrg} onChange={e => handleOrgChange(Number(e.target.value))} style={sel}>
            <option value={0}>— select org —</option>
            {meta.organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        {selOrg > 0 && (
          <div>
            <div style={{ fontSize:10, fontWeight:600, color:T.t5, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>Project</div>
            <select value={selProj} onChange={e => handleProjChange(Number(e.target.value))} style={sel}>
              <option value={0}>All projects</option>
              {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>
      {loading && (
        <div style={{ height:3, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, borderRadius:2, animation:"pulse 1s ease-in-out infinite alternate" }} />
          <style>{`@keyframes pulse{from{width:20%;margin-left:0}to{width:60%;margin-left:30%}}`}</style>
        </div>
      )}
      {!selOrg && (
        <div style={{ fontSize:12, color:T.t6 }}>Select an organisation to see deliverables.</div>
      )}
      {selOrg > 0 && !loading && loaded && (
        <>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search deliverables…" style={inp} />
          {filteredDelivs.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
              <span style={{ fontSize:11, color:T.t5 }}>
                {filteredDelivs.length} deliverable{filteredDelivs.length !== 1 ? "s" : ""}
                {totalPages > 1 && ` · page ${page} of ${totalPages}`}
              </span>
              {totalPages > 1 && (
                <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                    style={{ width:26, height:26, borderRadius:6, border:`1px solid ${T.panel2B}`, background:T.panel2, color:page===1?T.t6:T.t3, cursor:page===1?"default":"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
                  {Array.from({length:totalPages},(_,i)=>i+1)
                    .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1)
                    .reduce<(number|"…")[]>((acc,p,i,arr) => {
                      if (i>0 && (p as number)-(arr[i-1] as number)>1) acc.push("…");
                      acc.push(p); return acc;
                    },[])
                    .map((p,i) => p==="…"
                      ? <span key={`e${i}`} style={{ fontSize:11, color:T.t5, padding:"0 2px" }}>…</span>
                      : <button key={p} onClick={() => setPage(p as number)}
                          style={{ width:26, height:26, borderRadius:6, border:`1px solid ${page===p?T.acMid:T.panel2B}`, background:page===p?T.acLight:T.panel2, color:page===p?T.acText:T.t3, cursor:"pointer", fontSize:11, fontWeight:page===p?600:400 }}>
                          {p}
                        </button>
                    )
                  }
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                    style={{ width:26, height:26, borderRadius:6, border:`1px solid ${T.panel2B}`, background:T.panel2, color:page===totalPages?T.t6:T.t3, cursor:page===totalPages?"default":"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {pagedDelivs.length === 0 && (
              <div style={{ fontSize:12, color:T.t6, padding:"8px 0" }}>
                {search ? "No deliverables match your search." : "No deliverables found."}
              </div>
            )}
            {pagedDelivs.map(d => {
              const pinned = pinnedIds.has(d.id);
              return (
                <div key={d.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, background:pinned?T.pinBg:T.panel2, border:`1px solid ${pinned?"rgba(245,158,11,0.3)":T.panel2B}`, transition:"all 0.15s", flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:T.t2, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                    <div style={{ fontSize:10, color:T.t5, marginTop:2 }}>{d.org_name} · {d.project_name} · Stage {d.stage}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                    <span style={{ fontSize:10, padding:"2px 6px", borderRadius:20, fontWeight:600, background:d.status==="ongoing"?T.greenBg:T.panel2B, color:d.status==="ongoing"?T.green:T.t5, textTransform:"uppercase" }}>
                      {d.status?.replace("_"," ") ?? "—"}
                    </span>
                    <button onClick={() => onToggle(d.id)}
                      style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, border:"none", background:pinned?"rgba(245,158,11,0.2)":T.panel2B, color:pinned?T.pin:T.t4, fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.15s", whiteSpace:"nowrap" }}
                      onMouseEnter={e => { if (!pinned) { (e.currentTarget as HTMLElement).style.background = T.pinBg; (e.currentTarget as HTMLElement).style.color = T.pin; } }}
                      onMouseLeave={e => { if (!pinned) { (e.currentTarget as HTMLElement).style.background = T.panel2B; (e.currentTarget as HTMLElement).style.color = T.t4; } }}>
                      <svg width={10} height={10} viewBox="0 0 14 14" fill={pinned?"currentColor":"none"} stroke="currentColor" strokeWidth={1.5}><path d="M9.5 1.5L12 4 8 6.5V10L6 12V8L2 5.5 4 3Z" strokeLinejoin="round"/></svg>
                      {pinned ? "Pinned" : "Pin"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div style={{ display:"flex", gap:4, alignItems:"center", justifyContent:"center", paddingTop:4 }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`, background:T.panel2, color:page===1?T.t6:T.t3, cursor:page===1?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>‹ Prev</button>
              <span style={{ fontSize:12, color:T.t5 }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`, background:T.panel2, color:page===totalPages?T.t6:T.t3, cursor:page===totalPages?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>Next ›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// ─── Page ─────────────────────────────────────────────────────────────────────
// DROP-IN REPLACEMENT for `export default function WorklogPage() { ... }`
// in your original file. Everything above it (T, CalGrid, DeleteModal,
// WorklogCard, AddWorklogForm, PinDeliverableSection, etc.) is unchanged —
// keep those as-is and just swap this function in.

export default function WorklogPage() {
  const w        = useWindowWidth();
  const isMobile = w < 700;
  const today    = new Date();

  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number|null>(null);
  const [selYear,  setSelYear]  = useState<number|null>(null);

  const [rows,                setRows]                = useState<WorkLogEntry[]>([]);
  const [totalPages,          setTotalPages]          = useState(1);
  const [totalCount,          setTotalCount]          = useState(0);
  const [currentPage,         setCurrentPage]         = useState(1);
  const [meta,                setMeta]                = useState<MetaData>({organisations:[],projects:[],members:[]});
  const [initialDeliverables, setInitialDeliverables] = useState<DeliverableOption[]>([]);
  const [pinnedIds,           setPinnedIds]           = useState<Set<number>>(new Set());
  const [loading,             setLoading]             = useState(true);
  const [rowsLoading,         setRowsLoading]         = useState(false);
  const [error,               setError]               = useState<string|null>(null);

  const [allActiveDates, setAllActiveDates] = useState<Set<string>>(new Set());
  const [datesLoading,   setDatesLoading]   = useState(false);

  // 🔧 FIX: total hours for the current filter must be summed across ALL
  // pages in that range — not just the 10 rows currently shown. `rows` is
  // paginated (page_size ~10), so summing only `rows` undercounts whenever
  // a filtered range has more than one page of entries. This mirrors the
  // same "fetch every page and sum" approach the PDF export already uses.
  const [rangeMinutes,        setRangeMinutes]        = useState(0);
  const [rangeMinutesLoading, setRangeMinutesLoading] = useState(false);

  const dateRangeRef = useRef<{from?:string;to?:string}>({});

  async function loadActiveDates(params: {from?:string; to?:string}) {
    setDatesLoading(true);
    try {
      const dates = await fetchWorkLogDates(params);
      setAllActiveDates(new Set(dates));
    } catch {
      // non-fatal
    } finally {
      setDatesLoading(false);
    }
  }

  // 🔧 FIX: paginate through every page of the filtered range and sum
  // durations, instead of relying on whatever page happens to be loaded
  // into `rows`. Same page-walking pattern as fetchAllLogs() in the PDF
  // button — keeps the two numbers in sync.
  async function loadRangeMinutes(params: {from?:string; to?:string}) {
    setRangeMinutesLoading(true);
    try {
      let total = 0;
      let page = 1;
      while (true) {
        const data = await fetchMyWorkLogs({ ...params, page });
        total += data.results.reduce((s, r) => {
          if (!r.start_time || !r.end_time) return s;
          return s + Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000);
        }, 0);
        if (page >= data.pages) break;
        page++;
      }
      setRangeMinutes(total);
    } catch {
      // non-fatal; keep previous value rather than showing 0
    } finally {
      setRangeMinutesLoading(false);
    }
  }

  async function loadRows(params: {from?:string; to?:string; page?:number}) {
    dateRangeRef.current = {from:params.from, to:params.to};
    setRowsLoading(true);
    try {
      const data = await fetchMyWorkLogs(params);
      setRows(data.results); setTotalPages(data.pages);
      setTotalCount(data.count); setCurrentPage(data.page);
    } catch(e:any) { setError(e.message); }
    finally { setRowsLoading(false); }
  }

  async function loadAll(params: {from?:string; to?:string; page?:number}) {
    loadActiveDates({from:params.from, to:params.to});
    loadRangeMinutes({from:params.from, to:params.to});
    await loadRows(params);
  }

  useEffect(() => {
    const {from, to} = currentWeekRange();
    Promise.all([
      fetchMyWorkLogs({from, to, page:1}),
      fetchWorkLogDates({from, to}),
      fetchMeta(),
      fetchMyPinnedIds(),
    ]).then(async ([data, dates, m, pins]) => {
      setRows(data.results); setTotalPages(data.pages);
      setTotalCount(data.count); setCurrentPage(1);
      setAllActiveDates(new Set(dates));
      setLoading(false);
      dateRangeRef.current = {from, to};
      setInitialDeliverables(await fetchInitialDeliverables(data.results[0] ?? null));
      setMeta(m); setPinnedIds(new Set(pins));
      // 🔧 FIX: seed the range total for the initial "current week" view too,
      // not just on subsequent filter changes.
      loadRangeMinutes({from, to});
    }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    let from: string, to: string;
    if (selDates.size > 0) {
      const s = Array.from(selDates).sort(); from = s[0]; to = s[s.length-1];
    } else {
      const year  = selYear  ?? today.getFullYear();
      const month = selMonth ?? today.getMonth();
      ({from, to} = monthRange(year, month));
    }
    loadAll({from, to, page:1});
  }, [selDates, selMonth, selYear]);

  function goToPage(p: number) { loadRows({...dateRangeRef.current, page:p}); }

  const availableYears = useMemo(() =>
    Array.from(new Set(rows.map(r => new Date(r.start_time).getFullYear()))).sort()
  , [rows]);

  const hasFilter = selDates.size > 0 || selMonth !== null || selYear !== null;

  function saveRow(id: number, data: WorkLogEntry) {
    setRows(p => p.map(r => r.id===id ? data : r));
    // 🔧 FIX: an edit can change a row's duration — refresh the range total
    // so it doesn't drift out of sync with what's actually saved.
    loadRangeMinutes(dateRangeRef.current);
  }
  function deleteRow(id: number) {
    setRows(p => p.filter(r => r.id!==id));
    setTotalCount(c => c-1);
    loadRangeMinutes(dateRangeRef.current);
  }
  function addRow(w: WorkLogEntry) {
    setRows(p => [w, ...p.slice(0,9)]);
    setTotalCount(c => c+1);
    loadRangeMinutes(dateRangeRef.current);
  }

  async function togglePin(deliverableId: number) {
    const pinned = pinnedIds.has(deliverableId);
    try {
      if (pinned) { await unpinDeliverable(deliverableId); setPinnedIds(p => { const n=new Set(p); n.delete(deliverableId); return n; }); }
      else        { await pinDeliverable(deliverableId);   setPinnedIds(p => new Set([...p, deliverableId])); }
    } catch(e:any) { alert(e.message); }
  }

  function toggleDate(iso: string) { setSelDates(p => { const n=new Set(p); n.has(iso)?n.delete(iso):n.add(iso); return n; }); }

  function prevMonth() {
    const m = calMonth===0 ? 11 : calMonth-1;
    const y = calMonth===0 ? calYear-1 : calYear;
    setCalMonth(m); setCalYear(y); setSelMonth(m); setSelYear(y); setSelDates(new Set());
  }
  function nextMonth() {
    const m = calMonth===11 ? 0 : calMonth+1;
    const y = calMonth===11 ? calYear+1 : calYear;
    setCalMonth(m); setCalYear(y); setSelMonth(m); setSelYear(y); setSelDates(new Set());
  }
  function clearAll() { setSelDates(new Set()); setSelMonth(null); setSelYear(null); }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:220, height:3, background:T.panel2B, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", background:`linear-gradient(90deg,${T.ac},#a78bfa)`, animation:"initload 1.2s ease-in-out infinite alternate" }} />
      </div>
      <span style={{ fontSize:12, color:T.t5 }}>Loading worklogs…</span>
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
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:12, fontWeight:600, color:T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
          {datesLoading && (
            <span style={{ width:12, height:12, borderRadius:"50%", border:`2px solid ${T.acMid}`, borderTopColor:"transparent", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
          )}
        </div>
        <button onClick={nextMonth} style={{ width:28, height:28, borderRadius:7, background:T.panel2, border:`1px solid ${T.panel2B}`, color:T.t4, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
      </div>
      <CalGrid
        year={calYear}
        month={calMonth}
        activeDates={allActiveDates}
        selDates={selDates}
        onToggle={toggleDate}
      />
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
        {label:"Entries", val:`${rows.length}/${totalCount}`},
        // 🔧 FIX: use rangeMinutes (full-range fetch) instead of the old
        // rows-only totalMinutes. Shows a small loading hint while it refreshes.
        {label:"Hours",   val: rangeMinutesLoading ? "…" : `${Math.floor(rangeMinutes/60)}h ${rangeMinutes%60}m`},
        {label:"Pinned",  val:String(pinnedIds.size)},
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Worklog list ──────────────────────────────────────────────────────────
  const WorklogList = (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {rows.length === 0 ? (
        <div style={{ background:T.panel, border:`1px solid ${T.panelB}`, borderRadius:12, padding:"40px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, color:T.t6 }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}><circle cx={12} cy={12} r={10}/><path d="M12 6v6l4 2"/></svg>
          <span style={{ fontSize:13 }}>No entries for this selection</span>
        </div>
      ) : rows.map(row => (
        <WorklogCard key={row.id} row={row} meta={meta} deliverables={initialDeliverables} onSave={saveRow} onDelete={deleteRow} />
      ))}
    </div>
  );

  // ── Pagination ────────────────────────────────────────────────────────────
  const PaginationControls = totalPages > 1 ? (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, paddingTop:4, flexWrap:"wrap" }}>
      <button onClick={() => goToPage(currentPage-1)} disabled={currentPage===1}
        style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`, background:T.panel2, color:currentPage===1?T.t6:T.t3, cursor:currentPage===1?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
        ‹ Prev
      </button>
      {Array.from({length:totalPages},(_,i)=>i+1)
        .filter(p => p===1 || p===totalPages || Math.abs(p-currentPage)<=1)
        .reduce<(number|"…")[]>((acc,p,i,arr) => {
          if (i>0 && (p as number)-(arr[i-1] as number)>1) acc.push("…");
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
        style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${T.panel2B}`, background:T.panel2, color:currentPage===totalPages?T.t6:T.t3, cursor:currentPage===totalPages?"default":"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>
        Next ›
      </button>
    </div>
  ) : null;

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <ProgressBar loading={rowsLoading} />
      <div style={{ minHeight:"100vh", background:T.bg, color:T.t2, fontFamily:"'DM Sans','Sora',sans-serif", padding:isMobile?"14px 12px 48px":"28px 28px 56px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
          *{box-sizing:border-box;}
          ::-webkit-scrollbar{width:4px;height:4px}
          ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px}
          input[type=date]::-webkit-calendar-picker-indicator,
          input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer}
          select option{background:#1a1d2e;color:#f1f5f9}
          select{max-width:100%;overflow:hidden;text-overflow:ellipsis;}
          input,select{font-size:12px !important;}
          @media(max-width:700px){
            input,select{font-size:16px !important;}
          }
        `}</style>

        {/* ── Page header with PDF button ── */}
        <div style={{ marginBottom:isMobile?14:22, display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <h1 style={{ fontSize:isMobile?20:24, fontWeight:700, fontFamily:"'Sora',sans-serif", letterSpacing:"-0.03em", color:T.t1, margin:0 }}>Worklog</h1>
            <p style={{ color:T.t5, fontSize:12, margin:"3px 0 0" }}>Current week · {totalCount} total entries</p>
          </div>
          <WorklogPDFButton
            workLogs={rows}
            totalMinutes={rangeMinutes}
            dateFrom={dateRangeRef.current.from}
            dateTo={dateRangeRef.current.to}
          />
        </div>

        {isMobile ? (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {CalendarPanel}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <AddWorklogForm meta={meta} initialDeliverables={initialDeliverables} onAdd={addRow} />
              {WorklogList}
              {PaginationControls}
            </div>
            <PinDeliverableSection meta={meta} pinnedIds={pinnedIds} onToggle={togglePin} />
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:20, alignItems:"start", marginBottom:20 }}>
              {CalendarPanel}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <AddWorklogForm meta={meta} initialDeliverables={initialDeliverables} onAdd={addRow} />
                {WorklogList}
                {PaginationControls}
              </div>
            </div>
            <PinDeliverableSection meta={meta} pinnedIds={pinnedIds} onToggle={togglePin} />
          </>
        )}
      </div>
    </>
  );
}