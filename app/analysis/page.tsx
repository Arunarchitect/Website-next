"use client";

/**
 * analysis/page.tsx  —  Load-on-Demand Edition
 *
 * Initial load  → Calendar + filters only. Zero data fetched.
 * User picks a date/range + clicks "Run" → fetches only the summary numbers.
 * Each section (Charts, Work Entries, Spends, Revenue) has its own
 * "Load" button — nothing fetches until the user asks for it.
 *
 * Swapping to a real backend:
 *   Replace every simulateFetch(computedValue, ms) with:
 *   const res = await fetch(`/api/analysis/${endpoint}?${params}`);
 *   const data = await res.json();
 */

import { useState, useCallback, useRef } from "react";
import {
  workEntries   as ALL_WORK,
  revenueEntries as ALL_REV,
  personSpends  as ALL_SPENDS,
  personProfiles,
  ALL_PERSONS,
  ALL_PROJECTS,
  ALL_DELIVERABLES,
  filterWorkEntries,
  filterRevenue,
  filterSpends,
  computeEarnings,
  hoursPerPerson,
  hoursPerProject,
  hoursPerDeliverable,
  hoursPerDay,
  formatINR,
  type AnalysisFilter,
  type WorkEntry,
  type PersonSpend,
} from "./analysisData";

// ─────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────
const ACCENT = "#2563eb";
const GREEN  = "#16a34a";
const RED    = "#dc2626";
const AMBER  = "#d97706";
const MUTED  = "#94a3b8";
const SURF   = "#ffffff";
const BG     = "#f1f5f9";
const BORDER = "#e2e8f0";
const TEXT   = "#0f172a";
const TEXT2  = "#64748b";
const BARS   = ["#2563eb","#16a34a","#d97706","#7c3aed","#0891b2","#be185d"];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const PAGE_SIZE   = 25;
function pad(n: number) { return String(n).padStart(2,"0"); }

// ─────────────────────────────────────────────────────────
// Simulated async fetch — swap body for real fetch()
// ─────────────────────────────────────────────────────────
function simulateFetch<T>(value: T, ms: number): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

// ─────────────────────────────────────────────────────────
// Filter builder
// ─────────────────────────────────────────────────────────
function makeFilter(
  gran: "day"|"month"|"year", dateKey: string,
  fromDate: string|null, toDate: string|null,
  person: string|null, projectId: string|null, deliverableId: string|null
): AnalysisFilter {
  return { granularity:gran, dateKey, fromDate, toDate, person, projectId, deliverableId };
}

// ─────────────────────────────────────────────────────────
// Shimmer skeleton
// ─────────────────────────────────────────────────────────
const shimmer: React.CSSProperties = {
  background:"linear-gradient(90deg,#e8edf2 25%,#d4dbe4 50%,#e8edf2 75%)",
  backgroundSize:"200% 100%",
  animation:"shimmer 1.4s infinite",
  borderRadius:8,
};
function Bone({ h=14, w="100%" }: { h?:number; w?:number|string }) {
  return <div style={{ ...shimmer, height:h, width:w, flexShrink:0 }} />;
}
function StatSkeleton() {
  return (
    <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
      <Bone h={9} w="55%" /><Bone h={22} w="70%" />
    </div>
  );
}
function RowSkeleton() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"85px 1fr 1fr 1fr 40px", gap:8, background:BG, borderRadius:8, padding:"10px 12px" }}>
      {[60,100,100,100,30].map((w,i)=><Bone key={i} h={11} w={w}/>)}
    </div>
  );
}
function ChartRowSkeleton({ pct }: { pct:number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
      <Bone h={10} w={90} />
      <div style={{ flex:1, background:"#f1f5f9", borderRadius:99, height:9, overflow:"hidden" }}>
        <div style={{ ...shimmer, height:"100%", width:`${pct}%`, borderRadius:99 }} />
      </div>
      <Bone h={10} w={28} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────
function Stat({ label, value, color=TEXT, sub }: { label:string; value:string; color?:string; sub?:string }) {
  return (
    <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:3 }}>
      <div style={{ fontSize:10, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, color, letterSpacing:"-0.03em" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:MUTED }}>{sub}</div>}
    </div>
  );
}

function LoadBtn({ label, loading, onClick }: { label:string; loading:boolean; onClick:()=>void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 18px", borderRadius:8, border:`1.5px solid ${ACCENT}`, background:loading?BG:ACCENT, color:loading?TEXT2:"#fff", fontSize:13, fontWeight:700, cursor:loading?"default":"pointer", fontFamily:"inherit", transition:"all 0.15s", opacity:loading?0.7:1 }}
    >
      {loading && <span style={{ display:"inline-block", width:12, height:12, borderRadius:"50%", border:"2px solid #fff3", borderTopColor:"#fff", animation:"spin 0.7s linear infinite" }}/>}
      {label}
    </button>
  );
}

function Chip({ label, active, onClick }: { label:string; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ padding:"5px 12px", borderRadius:99, fontSize:12, fontWeight:600, cursor:"pointer", border:`1.5px solid ${active?ACCENT:BORDER}`, background:active?ACCENT:SURF, color:active?"#fff":TEXT2, transition:"all 0.15s", fontFamily:"inherit", touchAction:"manipulation" }}>
      {label}
    </button>
  );
}

function FilterSelect({ label, value, options, onChange, placeholder }:
  { label:string; value:string; options:{value:string;label:string}[]; onChange:(v:string)=>void; placeholder:string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:10, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, border:`1.5px solid ${value?ACCENT:BORDER}`, background:SURF, fontSize:13, color:value?TEXT:TEXT2, fontFamily:"inherit", outline:"none", cursor:"pointer", fontWeight:value?600:400 }}>
        <option value="">{placeholder}</option>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Section card with optional load trigger
function SectionCard({
  title, badge, hint, children, onLoad, loading, loaded,
}: {
  title: string; badge?: string; hint?: string;
  children: React.ReactNode;
  onLoad?: () => void; loading?: boolean; loaded?: boolean;
}) {
  return (
    <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"16px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:loaded||loading?12:0 }}>
        <div>
          <span style={{ fontSize:11, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.07em" }}>{title}</span>
          {badge && <span style={{ fontSize:11, fontWeight:700, color:ACCENT, marginLeft:10 }}>{badge}</span>}
        </div>
        {onLoad && !loaded && (
          <LoadBtn label={loading?`Loading ${title}…`:`Load ${title}`} loading={!!loading} onClick={onLoad}/>
        )}
      </div>
      {!loaded && !loading && hint && (
        <div style={{ fontSize:12, color:MUTED, padding:"18px 0", textAlign:"center" }}>{hint}</div>
      )}
      {children}
    </div>
  );
}

// Bar chart
function BarChart({ data, title, colorIdx=0 }: { data:{label:string;hours:number}[]; title:string; colorIdx?:number }) {
  const max = Math.max(...data.map(d=>d.hours),1);
  return (
    <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"16px 18px" }}>
      <div style={{ fontSize:11, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>{title}</div>
      {data.length===0
        ? <div style={{ fontSize:13, color:MUTED, textAlign:"center", padding:"20px 0" }}>No data</div>
        : data.map((d,i)=>(
          <div key={d.label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ fontSize:11, color:TEXT2, width:110, flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={d.label}>{d.label}</div>
            <div style={{ flex:1, background:"#f1f5f9", borderRadius:99, height:9, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(d.hours/max)*100}%`, background:BARS[(colorIdx+i)%BARS.length], borderRadius:99, transition:"width 0.5s ease", minWidth:d.hours>0?3:0 }} />
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:TEXT, width:34, textAlign:"right", flexShrink:0 }}>{d.hours}h</div>
          </div>
        ))
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────────────
function hasDayData(d: string) {
  return ALL_WORK.some(w=>w.date===d)||ALL_REV.some(r=>r.date===d)||ALL_SPENDS.some(s=>s.date===d);
}
function Calendar({ year, month, selectedDay, onSelectDay, onMonthChange }:
  { year:number; month:number; selectedDay:string|null; onSelectDay:(d:string)=>void; onMonthChange:(y:number,m:number)=>void }) {
  const first=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate();
  const cells:(number|null)[]=[];
  for(let i=0;i<first;i++) cells.push(null);
  for(let d=1;d<=days;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);
  const nav:React.CSSProperties={ width:28,height:28,borderRadius:8,border:`1px solid ${BORDER}`,background:SURF,cursor:"pointer",fontSize:16,color:TEXT2,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center" };
  return (
    <div style={{ background:SURF,border:`1px solid ${BORDER}`,borderRadius:14,padding:"14px 12px",userSelect:"none" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <button onClick={()=>{ let m=month-1,y=year; if(m<0){m=11;y--;} onMonthChange(y,m); }} style={nav}>‹</button>
        <span style={{ fontSize:13,fontWeight:800,color:TEXT,letterSpacing:"-0.02em" }}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={()=>{ let m=month+1,y=year; if(m>11){m=0;y++;} onMonthChange(y,m); }} style={nav}>›</button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:3 }}>
        {DAY_LABELS.map(d=><div key={d} style={{ textAlign:"center",fontSize:9,fontWeight:700,color:MUTED,paddingBottom:3,textTransform:"uppercase" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
        {cells.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const ds=`${year}-${pad(month+1)}-${pad(d)}`;
          const sel=selectedDay===ds, has=hasDayData(ds);
          return(
            <button key={i} onClick={()=>onSelectDay(ds)}
              style={{ width:"100%",aspectRatio:"1",borderRadius:7,border:sel?`2px solid ${ACCENT}`:"1.5px solid transparent",background:sel?ACCENT:"transparent",color:sel?"#fff":TEXT,fontSize:12,fontWeight:sel?700:400,cursor:"pointer",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",touchAction:"manipulation" }}
              onMouseEnter={e=>{ if(!sel)(e.currentTarget as HTMLButtonElement).style.background=BG; }}
              onMouseLeave={e=>{ if(!sel)(e.currentTarget as HTMLButtonElement).style.background="transparent"; }}>
              {d}
              {has&&!sel&&<span style={{ position:"absolute",bottom:3,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:ACCENT }}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Data section components
// ─────────────────────────────────────────────────────────
interface SummaryData {
  totalHours:number; totalRevenue:number; totalSpend:number;
  reimburse:number;  totalPayable:number; teamActive:number;
  earnings: ReturnType<typeof computeEarnings>;
}

function SalaryTable({ data }: { data: ReturnType<typeof computeEarnings> }) {
  if (data.length===0) return <div style={{ fontSize:13,color:MUTED,textAlign:"center",padding:"20px 0" }}>No data</div>;
  const cols="1fr 70px 70px 80px 85px 80px 95px";
  const tGross=data.reduce((s,e)=>s+e.grossEarnings,0);
  const tNet  =data.reduce((s,e)=>s+e.netPayable,0);
  const H=(t:string,right=true)=><div style={{ fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:right?"right":"left" }}>{t}</div>;
  return(
    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
      <div style={{ display:"grid",gridTemplateColumns:cols,gap:8,padding:"0 10px" }}>
        {H("Person",false)}{H("Role",false)}{H("Rate/h")}{H("Hours")}{H("Gross")}{H("Spends")}{H("Net Payable")}
      </div>
      {data.map((s,i)=>(
        <div key={s.person} style={{ display:"grid",gridTemplateColumns:cols,gap:8,alignItems:"center",background:i%2===0?BG:SURF,borderRadius:9,padding:"9px 10px",border:`1px solid ${BORDER}` }}>
          <div><div style={{ fontSize:13,fontWeight:700,color:TEXT }}>{s.person}</div><div style={{ fontSize:10,color:TEXT2 }}>{s.contractType}</div></div>
          <div style={{ fontSize:11,color:TEXT2 }}>{s.role.split(" ")[0]}</div>
          <div style={{ fontSize:12,fontWeight:600,color:TEXT2,textAlign:"right" }}>{formatINR(s.hourlyRate)}</div>
          <div style={{ fontSize:13,fontWeight:700,color:ACCENT,textAlign:"right" }}>{s.hoursWorked}h</div>
          <div style={{ fontSize:13,fontWeight:700,color:TEXT,textAlign:"right" }}>{formatINR(s.grossEarnings)}</div>
          <div style={{ fontSize:12,fontWeight:600,color:AMBER,textAlign:"right" }}>{s.spends>0?formatINR(s.spends):"—"}</div>
          <div style={{ fontSize:13,fontWeight:800,color:GREEN,textAlign:"right" }}>{formatINR(s.netPayable)}</div>
        </div>
      ))}
      <div style={{ display:"grid",gridTemplateColumns:cols,gap:8,alignItems:"center",background:"#eff6ff",borderRadius:9,padding:"9px 10px",border:`1.5px solid ${ACCENT}` }}>
        <div style={{ fontSize:12,fontWeight:800,color:ACCENT }}>TOTAL</div>
        <div/><div/><div/>
        <div style={{ fontSize:13,fontWeight:800,color:ACCENT,textAlign:"right" }}>{formatINR(tGross)}</div>
        <div/>
        <div style={{ fontSize:13,fontWeight:800,color:GREEN,textAlign:"right" }}>{formatINR(tNet)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
export default function AnalysisPage() {

  // ── Calendar / granularity ──
  const [calYear,  setCalYear]  = useState(2025);
  const [calMonth, setCalMonth] = useState(2); // March 2025
  const [selDay,   setSelDay]   = useState<string|null>(null);
  const [gran,     setGran]     = useState<"day"|"month"|"year">("month");

  // ── Filters ──
  const [person,   setPerson]   = useState("");
  const [projId,   setProjId]   = useState("");
  const [delId,    setDelId]    = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");
  const hasRange = !!(fromDate && toDate);

  // Computed date key
  const dateKey = (() => {
    if (gran==="day")   return selDay ?? `${calYear}-${pad(calMonth+1)}-01`;
    if (gran==="month") return `${calYear}-${pad(calMonth+1)}`;
    return `${calYear}`;
  })();

  const periodLabel = hasRange
    ? `${fromDate} → ${toDate}`
    : gran==="day"   ? (selDay ?? dateKey)
    : gran==="month" ? `${MONTH_NAMES[calMonth]} ${calYear}`
    : `${calYear}`;

  const activeFilterLabel = [
    person||null,
    ALL_PROJECTS.find(p=>p.id===projId)?.name||null,
    ALL_DELIVERABLES.find(d=>d.id===delId)?.name||null,
  ].filter(Boolean).join(" · ");

  // Current filter snapshot (only built when user runs a query)
  const filterRef = useRef<AnalysisFilter|null>(null);

  // ── Section states ──
  // Each section is fully independent: idle | loading | loaded
  type SectionState = "idle"|"loading"|"loaded";

  const [sumState,    setSumState]    = useState<SectionState>("idle");
  const [summary,     setSummary]     = useState<SummaryData|null>(null);

  const [chartState,  setChartState]  = useState<SectionState>("idle");
  const [charts,      setCharts]      = useState<{byPerson:{label:string;hours:number}[];byProject:{label:string;hours:number}[];byDeliverable:{label:string;hours:number}[];byDay:{label:string;hours:number}[]}|null>(null);

  const [rowState,    setRowState]    = useState<SectionState>("idle");
  const [workRows,    setWorkRows]    = useState<WorkEntry[]>([]);
  const [rowTotal,    setRowTotal]    = useState(0);
  const [rowPage,     setRowPage]     = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [spendState,  setSpendState]  = useState<SectionState>("idle");
  const [spendRows,   setSpendRows]   = useState<PersonSpend[]>([]);

  const [revState,    setRevState]    = useState<SectionState>("idle");
  const [revRows,     setRevRows]     = useState<ReturnType<typeof filterRevenue>>([]);

  // Reset all sections (called when filter changes before a new "Run")
  const resetSections = useCallback(()=>{
    setSumState("idle");    setSummary(null);
    setChartState("idle");  setCharts(null);
    setRowState("idle");    setWorkRows([]); setRowTotal(0); setRowPage(1);
    setSpendState("idle");  setSpendRows([]);
    setRevState("idle");    setRevRows([]);
  },[]);

  // ── BUILD FILTER & mark dirty when anything changes ──
  // We don't auto-fetch — we just reset so sections show "Run first"
  const buildAndReset = useCallback(()=>{
    const f = makeFilter(gran, dateKey, hasRange?fromDate:null, hasRange?toDate:null, person||null, projId||null, delId||null);
    filterRef.current = f;
    resetSections();
  },[gran, dateKey, hasRange, fromDate, toDate, person, projId, delId, resetSections]);

  // ── Handlers for each section load button ──

  const loadSummary = useCallback(async ()=>{
    if (!filterRef.current) return;
    setSumState("loading");
    const f = filterRef.current;
    const fWork   = filterWorkEntries(ALL_WORK,  f);
    const fSpends = filterSpends(ALL_SPENDS,     f);
    const earnings = computeEarnings(fWork, fSpends);
    const data: SummaryData = {
      totalHours:   fWork.reduce((s,w)=>s+w.hoursWorked,0),
      totalRevenue: filterRevenue(ALL_REV,f).reduce((s,r)=>s+r.amount,0),
      totalSpend:   fSpends.reduce((s,e)=>s+e.amount,0),
      reimburse:    fSpends.filter(s=>s.reimbursed).reduce((s,e)=>s+e.amount,0),
      totalPayable: earnings.reduce((s,e)=>s+e.netPayable,0),
      teamActive:   new Set(fWork.map(w=>w.person)).size,
      earnings,
    };
    await simulateFetch(null, 280); // ← replace with fetch("/api/summary?...")
    setSummary(data);
    setSumState("loaded");
  },[]);

  const loadCharts = useCallback(async ()=>{
    if (!filterRef.current) return;
    setChartState("loading");
    const fWork = filterWorkEntries(ALL_WORK, filterRef.current);
    const data = {
      byPerson:      hoursPerPerson(fWork),
      byProject:     hoursPerProject(fWork),
      byDeliverable: hoursPerDeliverable(fWork),
      byDay:         hoursPerDay(fWork),
    };
    await simulateFetch(null, 500); // ← replace with fetch("/api/charts?...")
    setCharts(data);
    setChartState("loaded");
  },[]);

  const loadRows = useCallback(async (page: number)=>{
    if (!filterRef.current) return;
    if (page===1) setRowState("loading"); else setLoadingMore(true);
    const fWork = filterWorkEntries(ALL_WORK, filterRef.current);
    const slice = fWork.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
    await simulateFetch(null, 350); // ← replace with fetch("/api/entries?page=...")
    setWorkRows(prev => page===1 ? slice : [...prev,...slice]);
    setRowTotal(fWork.length);
    setRowPage(page);
    if (page===1) setRowState("loaded"); else setLoadingMore(false);
  },[]);

  const loadSpends = useCallback(async ()=>{
    if (!filterRef.current) return;
    setSpendState("loading");
    const data = filterSpends(ALL_SPENDS, filterRef.current);
    await simulateFetch(null, 300); // ← replace with fetch("/api/spends?...")
    setSpendRows(data);
    setSpendState("loaded");
  },[]);

  const loadRevenue = useCallback(async ()=>{
    if (!filterRef.current) return;
    setRevState("loading");
    const data = filterRevenue(ALL_REV, filterRef.current);
    await simulateFetch(null, 250); // ← replace with fetch("/api/revenue?...")
    setRevRows(data);
    setRevState("loaded");
  },[]);

  // "Run Analysis" — sets the filter and loads summary immediately
  const runAnalysis = useCallback(()=>{
    const f = makeFilter(gran, dateKey, hasRange?fromDate:null, hasRange?toDate:null, person||null, projId||null, delId||null);
    filterRef.current = f;
    resetSections();
    // Auto-load summary (lightest query) right away
    setTimeout(()=> loadSummary(), 0);
  },[gran, dateKey, hasRange, fromDate, toDate, person, projId, delId, resetSections, loadSummary]);

  const hasMore = workRows.length < rowTotal;
  const anyLoaded = sumState==="loaded"||chartState==="loaded"||rowState==="loaded"||spendState==="loaded"||revState==="loaded";
  const nothingRun = !filterRef.current && sumState==="idle";

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin    { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ minHeight:"100vh", background:BG, fontFamily:"'DM Sans','Helvetica Neue',Arial,sans-serif", color:TEXT }}>

        {/* ── Top bar ── */}
        <div style={{ background:SURF, borderBottom:`1px solid ${BORDER}`, padding:"13px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:900, letterSpacing:"-0.04em" }}>Analysis</h1>
            <div style={{ fontSize:11, color:TEXT2, marginTop:2 }}>Select a period · apply filters · run</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {(["day","month","year"] as const).map(g=>(
              <Chip key={g} label={g[0].toUpperCase()+g.slice(1)} active={gran===g&&!hasRange}
                onClick={()=>{ setGran(g); if(g!=="day")setSelDay(null); setFromDate(""); setToDate(""); buildAndReset(); }}/>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", maxWidth:1300, margin:"0 auto", padding:"20px 24px", gap:0 }}>

          {/* ══ LEFT: Calendar + filters (always rendered, zero API cost) ══ */}
          <div style={{ paddingRight:20, display:"flex", flexDirection:"column", gap:12 }}>

            <Calendar year={calYear} month={calMonth}
              selectedDay={gran==="day"&&!hasRange?selDay:null}
              onSelectDay={d=>{ setSelDay(d); setGran("day"); setFromDate(""); setToDate(""); buildAndReset(); }}
              onMonthChange={(y,m)=>{ setCalYear(y); setCalMonth(m); buildAndReset(); }}/>

            {/* Year nav */}
            <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"10px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Year</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={()=>{ setCalYear(y=>y-1); buildAndReset(); }} style={{ width:28,height:28,borderRadius:8,border:`1px solid ${BORDER}`,background:SURF,cursor:"pointer",fontSize:16,color:TEXT2,fontFamily:"inherit" }}>‹</button>
                <div style={{ flex:1, textAlign:"center", fontWeight:800, fontSize:15 }}>{calYear}</div>
                <button onClick={()=>{ setCalYear(y=>y+1); buildAndReset(); }} style={{ width:28,height:28,borderRadius:8,border:`1px solid ${BORDER}`,background:SURF,cursor:"pointer",fontSize:16,color:TEXT2,fontFamily:"inherit" }}>›</button>
              </div>
            </div>

            {/* Date range */}
            <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.07em" }}>Date Range</div>
              <div>
                <label style={{ fontSize:10, color:TEXT2, fontWeight:600, display:"block", marginBottom:3 }}>FROM</label>
                <input type="date" value={fromDate} onChange={e=>{ setFromDate(e.target.value); buildAndReset(); }} style={{ padding:"7px 10px",borderRadius:8,border:`1.5px solid ${BORDER}`,fontSize:12,fontFamily:"inherit",outline:"none",color:TEXT,background:SURF,width:"100%",boxSizing:"border-box" as any }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:TEXT2, fontWeight:600, display:"block", marginBottom:3 }}>TO</label>
                <input type="date" value={toDate} onChange={e=>{ setToDate(e.target.value); buildAndReset(); }} style={{ padding:"7px 10px",borderRadius:8,border:`1.5px solid ${BORDER}`,fontSize:12,fontFamily:"inherit",outline:"none",color:TEXT,background:SURF,width:"100%",boxSizing:"border-box" as any }}/>
              </div>
              {(fromDate||toDate)&&(
                <button onClick={()=>{ setFromDate(""); setToDate(""); buildAndReset(); }} style={{ padding:"6px 0",borderRadius:8,border:`1px solid ${BORDER}`,background:"#fef2f2",color:RED,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>✕ Clear range</button>
              )}
            </div>

            {/* Filters */}
            <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px", display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.07em" }}>Filters</div>
              <FilterSelect label="Person"      value={person} placeholder="All people"       options={ALL_PERSONS.map(p=>({value:p,label:p}))} onChange={v=>{ setPerson(v); buildAndReset(); }}/>
              <FilterSelect label="Project"     value={projId} placeholder="All projects"     options={ALL_PROJECTS.map(p=>({value:p.id,label:p.name}))} onChange={v=>{ setProjId(v); buildAndReset(); }}/>
              <FilterSelect label="Deliverable" value={delId}  placeholder="All deliverables" options={ALL_DELIVERABLES.map(d=>({value:d.id,label:d.name}))} onChange={v=>{ setDelId(v); buildAndReset(); }}/>
              {(person||projId||delId)&&(
                <button onClick={()=>{ setPerson(""); setProjId(""); setDelId(""); buildAndReset(); }} style={{ padding:"7px 0",borderRadius:8,border:`1px solid ${BORDER}`,background:"#fef2f2",color:RED,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>✕ Clear filters</button>
              )}
            </div>

            {/* Hourly rates reference — static, always visible */}
            <div style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:TEXT2, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Hourly Rates</div>
              {personProfiles.map((p,i)=>(
                <div key={p.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:i<personProfiles.length-1?`1px solid ${BORDER}`:"none" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:TEXT }}>{p.name}</div>
                    <div style={{ fontSize:10, color:TEXT2 }}>{p.role} · {p.contractType}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:ACCENT }}>{formatINR(p.hourlyRate)}/h</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ RIGHT: Results ══ */}
          <div style={{ display:"flex", flexDirection:"column", gap:14, minWidth:0 }}>

            {/* Period heading + RUN button */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.04em" }}>{periodLabel}</div>
                {activeFilterLabel && <div style={{ fontSize:12, color:ACCENT, fontWeight:700, marginTop:2 }}>{activeFilterLabel}</div>}
              </div>
              <button onClick={runAnalysis} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:ACCENT, color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", letterSpacing:"-0.01em", boxShadow:"0 2px 8px rgba(37,99,235,0.35)", transition:"opacity 0.15s" }}
                onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.opacity="0.88"}
                onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.opacity="1"}>
                ▶ Run Analysis
              </button>
            </div>

            {/* Nothing run yet */}
            {nothingRun && (
              <div style={{ background:SURF, border:`1.5px dashed ${BORDER}`, borderRadius:14, padding:"48px 20px", textAlign:"center" }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT2 }}>Select a period and click <span style={{ color:ACCENT }}>Run Analysis</span></div>
                <div style={{ fontSize:12, color:MUTED, marginTop:6 }}>Only the data you request will be loaded</div>
              </div>
            )}

            {/* ── Summary stat cards ── */}
            {(sumState!=="idle") && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(115px,1fr))", gap:10 }}>
                {sumState==="loading"
                  ? <>{[0,1,2,3,4,5,6].map(i=><StatSkeleton key={i}/>)}</>
                  : summary ? (<>
                      <Stat label="Hours"          value={`${summary.totalHours}h`}                                  color={ACCENT}/>
                      <Stat label="Revenue"        value={formatINR(summary.totalRevenue)}                           color={GREEN}/>
                      <Stat label="Total Spends"   value={formatINR(summary.totalSpend)}                             color={AMBER}/>
                      <Stat label="Reimbursable"   value={formatINR(summary.reimburse)}                              color={AMBER} sub="company owes"/>
                      <Stat label="Salary Payable" value={formatINR(summary.totalPayable)}                           color={RED}/>
                      <Stat label="Net (Rev−Pay)"  value={formatINR(summary.totalRevenue-summary.totalPayable)}      color={summary.totalRevenue>=summary.totalPayable?GREEN:RED}/>
                      <Stat label="Team Active"    value={`${summary.teamActive}`}/>
                    </>) : null
                }
              </div>
            )}

            {/* ── Salary table (piggybacks on summary data) ── */}
            {sumState==="loaded" && summary && (
              <SectionCard title="Salary & Earnings" badge={`Net payable ${formatINR(summary.totalPayable)}`}>
                <SalaryTable data={summary.earnings}/>
              </SectionCard>
            )}
            {sumState==="loading" && (
              <SectionCard title="Salary & Earnings">
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[0,1,2,3].map(i=><RowSkeleton key={i}/>)}
                </div>
              </SectionCard>
            )}

            {/* ── Charts — independent load button ── */}
            {(anyLoaded || chartState!=="idle") && (
              <SectionCard
                title="Charts"
                hint="Click Load Charts to visualise hours breakdown"
                onLoad={loadCharts}
                loading={chartState==="loading"}
                loaded={chartState==="loaded"}
              >
                {chartState==="loading" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    {[85,70,55,40].map((p,i)=>(
                      <div key={i} style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:12, padding:"16px 18px" }}>
                        <Bone h={10} w="50%" /><div style={{ height:12 }}/>
                        {[p,p*0.8,p*0.6,p*0.45].map((pct,j)=><ChartRowSkeleton key={j} pct={pct}/>)}
                      </div>
                    ))}
                  </div>
                )}
                {chartState==="loaded" && charts && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    {!person  && <BarChart data={charts.byPerson}      title="Hours · By Person"      colorIdx={0}/>}
                    {!projId  && <BarChart data={charts.byProject}     title="Hours · By Project"     colorIdx={1}/>}
                    <BarChart             data={charts.byDeliverable}   title="Hours · By Deliverable" colorIdx={2}/>
                    {gran!=="day" && charts.byDay.length>0 && (
                      <BarChart data={charts.byDay.map(d=>({label:d.label.slice(5),hours:d.hours}))} title="Daily Trend" colorIdx={3}/>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Work Entries — independent load button, paginated ── */}
            {(anyLoaded || rowState!=="idle") && (
              <SectionCard
                title="Work Entries"
                badge={rowState==="loaded"?`${rowTotal} entries`:undefined}
                hint="Click Load Work Entries to see individual logs"
                onLoad={()=>loadRows(1)}
                loading={rowState==="loading"}
                loaded={rowState==="loaded"}
              >
                {rowState==="loading" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[0,1,2,3,4].map(i=><RowSkeleton key={i}/>)}
                  </div>
                )}
                {rowState==="loaded" && (<>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {workRows.map(w=>(
                      <div key={w.id} style={{ display:"grid", gridTemplateColumns:"85px 1fr 1fr 1fr 40px", gap:8, alignItems:"center", background:BG, borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                        <div style={{ color:TEXT2 }}>{w.date}</div>
                        <div style={{ fontWeight:700, color:TEXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.person}</div>
                        <div style={{ color:TEXT2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.projectName}</div>
                        <div style={{ color:TEXT2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.deliverableName}</div>
                        <div style={{ color:ACCENT, fontWeight:700, textAlign:"right" }}>{w.hoursWorked}h</div>
                      </div>
                    ))}
                  </div>
                  {loadingMore && <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}><RowSkeleton/><RowSkeleton/></div>}
                  {hasMore && !loadingMore && (
                    <button onClick={()=>loadRows(rowPage+1)} style={{ marginTop:10, width:"100%", padding:"8px 0", borderRadius:8, border:`1.5px solid ${BORDER}`, background:SURF, color:ACCENT, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      Load more ({rowTotal - workRows.length} remaining)
                    </button>
                  )}
                </>)}
              </SectionCard>
            )}

            {/* ── Person Spends — independent load ── */}
            {(anyLoaded || spendState!=="idle") && (
              <SectionCard
                title="Person Spends"
                badge={spendState==="loaded"?`${spendRows.length} entries`:undefined}
                hint="Click Load Spends to see per-person expenditure"
                onLoad={loadSpends}
                loading={spendState==="loading"}
                loaded={spendState==="loaded"}
              >
                {spendState==="loading" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[0,1,2,3].map(i=><RowSkeleton key={i}/>)}
                  </div>
                )}
                {spendState==="loaded" && (
                  spendRows.length===0
                    ? <div style={{ fontSize:13, color:MUTED, textAlign:"center", padding:"16px 0" }}>No spends in this period</div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {spendRows.map(s=>(
                          <div key={s.id} style={{ display:"grid", gridTemplateColumns:"85px 95px 1fr 1fr 80px 80px", gap:8, alignItems:"center", background:BG, borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                            <div style={{ color:TEXT2 }}>{s.date}</div>
                            <div style={{ fontWeight:700, color:TEXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.person.split(" ")[0]}</div>
                            <div style={{ color:TEXT2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.projectName}</div>
                            <div style={{ color:TEXT2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.description}</div>
                            <div style={{ textAlign:"right", fontWeight:700, color:s.reimbursed?GREEN:AMBER }}>{formatINR(s.amount)}</div>
                            <span style={{ fontSize:10, fontWeight:700, borderRadius:4, padding:"2px 7px", background:s.reimbursed?"#dcfce7":"#fef9c3", color:s.reimbursed?GREEN:AMBER, textAlign:"center" }}>
                              {s.reimbursed?"Reimburse":"Own Cost"}
                            </span>
                          </div>
                        ))}
                      </div>
                )}
              </SectionCard>
            )}

            {/* ── Revenue — independent load ── */}
            {(anyLoaded || revState!=="idle") && (
              <SectionCard
                title="Revenue"
                badge={revState==="loaded"?`${revRows.length} entries · ${formatINR(summary?.totalRevenue??0)}`:undefined}
                hint="Click Load Revenue to see payment records"
                onLoad={loadRevenue}
                loading={revState==="loading"}
                loaded={revState==="loaded"}
              >
                {revState==="loading" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[0,1].map(i=><RowSkeleton key={i}/>)}
                  </div>
                )}
                {revState==="loaded" && (
                  revRows.length===0
                    ? <div style={{ fontSize:13, color:MUTED, textAlign:"center", padding:"16px 0" }}>No revenue in this period</div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {revRows.map(r=>(
                          <div key={r.id} style={{ display:"flex", alignItems:"center", gap:8, background:BG, borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                            <div style={{ color:TEXT2, flexShrink:0, width:82 }}>{r.date}</div>
                            <div style={{ flex:1, color:TEXT, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.projectName} · {r.from}</div>
                            <div style={{ fontSize:10, color:"#fff", background:GREEN, borderRadius:4, padding:"2px 7px", fontWeight:700, flexShrink:0 }}>{r.type}</div>
                            <div style={{ fontWeight:800, color:GREEN, flexShrink:0 }}>{formatINR(r.amount)}</div>
                          </div>
                        ))}
                      </div>
                )}
              </SectionCard>
            )}

          </div>
        </div>
      </div>
    </>
  );
}