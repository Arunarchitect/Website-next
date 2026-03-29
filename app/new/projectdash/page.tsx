"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchProjects, 
  fetchProjectDetail, 
  fetchProjectOrganisations,
  debugProjects,
  formatINR, 
  formatDate, 
  DELIVERABLE_STATUS_COLOR, 
  STAGE_LABEL,
  type ProjectRow, 
  type ProjectDetail, 
  type DeliverableRow,
  type OrganisationOption, 
  type ProjectStage, 
  type DeliverableStatus,
  type ProjectListParams,
} from "@/app/new/projectApi";

// ─── CSS injected once ────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @keyframes shimmer {
    0%   { background-position: 200% 0 }
    100% { background-position: -200% 0 }
  }
  .shimmer {
    background: linear-gradient(90deg, #ececec 25%, #f8f8f8 50%, #ececec 75%);
    background-size: 200% 100%;
    animation: shimmer 1.3s infinite;
    border-radius: 5px;
  }
  * { box-sizing: border-box; }
  
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`;

// ─── Shimmer block ─────────────────────────────────────────────────────────────

function Sh({ w, h, r }: { w: number | string; h: number; r?: number }) {
  return (
    <div
      className="shimmer"
      style={{ width: w, height: h, borderRadius: r ?? 5, flexShrink: 0 }}
    />
  );
}

function SkeletonListItem() {
  return (
    <div style={{ 
      padding: "12px 14px", 
      borderRadius: 9, 
      border: "1.5px solid #f0f0f0", 
      background: "#fafafa", 
      display: "flex", 
      flexDirection: "column", 
      gap: 8 
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Sh w={150} h={13} />
        <Sh w={66} h={20} r={99} />
      </div>
      <Sh w={110} h={10} />
      <div style={{ display: "flex", gap: 10 }}>
        <Sh w={55} h={9} /><Sh w={40} h={9} /><Sh w={50} h={9} />
      </div>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Sh w={220} h={22} /><Sh w={130} h={12} />
        </div>
        <Sh w={80} h={26} r={99} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 10 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ background: "#fafafa", border: "1px solid #ebebeb", borderRadius: 10, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 7 }}>
            <Sh w={44} h={9} /><Sh w={70} h={20} />
          </div>
        ))}
      </div>
      <Sh w="100%" h={5} r={99} />
      <div style={{ borderTop: "1px solid #f0f0f0" }} />
      {[0,1,2,3,4,5].map(i => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 55px", gap: 8, background: "#fafafa", border: "1px solid #ebebeb", borderRadius: 8, padding: "9px 10px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Sh w={160} h={12} /><Sh w={80} h={9} />
          </div>
          <Sh w={70} h={10} /><Sh w={60} h={18} r={4} /><Sh w={30} h={12} />
        </div>
      ))}
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusPill({ label, completed }: { label: string; completed: boolean }) {
  return (
    <span style={{
      display: "inline-flex", 
      alignItems: "center", 
      gap: 5,
      background: completed ? "#e8f5e9" : "#e3f2fd",
      color: completed ? "#2e7d32" : "#1565c0",
      borderRadius: 99, 
      padding: "3px 10px",
      fontSize: 11, 
      fontWeight: 700, 
      whiteSpace: "nowrap",
    }}>
      <span style={{ 
        width: 6, 
        height: 6, 
        borderRadius: "50%", 
        background: completed ? "#43a047" : "#1976d2", 
        flexShrink: 0 
      }} />
      {label}
    </span>
  );
}

function DelivBadge({ status, label }: { status: DeliverableStatus; label: string }) {
  const c = DELIVERABLE_STATUS_COLOR[status];
  return (
    <span style={{ 
      background: c.bg, 
      color: c.text, 
      borderRadius: 4, 
      padding: "2px 8px", 
      fontSize: 10, 
      fontWeight: 700, 
      whiteSpace: "nowrap" 
    }}>
      {label}
    </span>
  );
}

function StageBadge({ stage }: { stage: ProjectStage }) {
  return (
    <span style={{ 
      background: "#f0f4ff", 
      color: "#3949ab", 
      borderRadius: 4, 
      padding: "2px 8px", 
      fontSize: 10, 
      fontWeight: 700, 
      whiteSpace: "nowrap" 
    }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "#fafafa", 
      border: "1px solid #ebebeb", 
      borderRadius: 10,
      padding: "12px 14px", 
      display: "flex", 
      flexDirection: "column", 
      gap: 2,
      borderTop: color ? `3px solid ${color}` : undefined,
    }}>
      <div style={{ 
        fontSize: 10, 
        color: "#aaa", 
        fontWeight: 700, 
        letterSpacing: "0.07em", 
        textTransform: "uppercase" 
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: 18, 
        fontWeight: 800, 
        color: "#111", 
        letterSpacing: "-0.02em" 
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#bbb" }}>{sub}</div>}
    </div>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>
          Deliverable Progress
        </span>
        <span style={{ fontSize: 11, color: "#333", fontWeight: 700 }}>
          {done}/{total} · {pct}%
        </span>
      </div>
      <div style={{ height: 5, background: "#eee", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", 
          width: `${pct}%`,
          background: pct === 100 ? "#43a047" : "#1976d2",
          borderRadius: 99, 
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Meta row ─────────────────────────────────────────────────────────────────

function Meta({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
      <span style={{ fontSize: 14, width: 20, flexShrink: 0, marginTop: 1 }}>
        {icon}
      </span>
      <div>
        <div style={{ 
          fontSize: 10, 
          color: "#bbb", 
          fontWeight: 700, 
          letterSpacing: "0.06em", 
          textTransform: "uppercase", 
          marginBottom: 1 
        }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#222", fontWeight: 500 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Deliverables table ───────────────────────────────────────────────────────

function DeliverablesTable({ rows }: { rows: DeliverableRow[] }) {
  if (!rows.length)
    return <div style={{ fontSize: 12, color: "#bbb", padding: "12px 0" }}>
      No deliverables.
    </div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 90px 80px 55px", 
        gap: 8, 
        padding: "0 10px" 
      }}>
        {["Deliverable", "Assigned", "Status", "Hours"].map(h => (
          <span key={h} style={{ 
            fontSize: 10, 
            fontWeight: 700, 
            color: "#ccc", 
            letterSpacing: "0.06em", 
            textTransform: "uppercase" 
          }}>
            {h}
          </span>
        ))}
      </div>
      {rows.map(d => (
        <div key={d.id} style={{
          display: "grid", 
          gridTemplateColumns: "1fr 90px 80px 55px", 
          gap: 8, 
          alignItems: "center",
          background: d.is_completed ? "#f9fef9" : "#fafafa",
          border: `1px solid ${d.is_completed ? "#c8e6c9" : "#ebebeb"}`,
          borderRadius: 8, 
          padding: "9px 10px",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>
              {d.name}
            </div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 1 }}>
              {d.stage_name}
              {d.end_date ? ` · Due ${formatDate(d.end_date)}` : ""}
            </div>
          </div>
          <div style={{ 
            fontSize: 11, 
            color: "#666", 
            overflow: "hidden", 
            textOverflow: "ellipsis", 
            whiteSpace: "nowrap" 
          }}>
            {d.assigned_to_display}
          </div>
          <DelivBadge status={d.status} label={d.status_display} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#444" }}>
            {d.hours_logged > 0 ? `${d.hours_logged}h` : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ detail }: { detail: ProjectDetail }) {
  const net = (detail.total_revenue || 0) - (detail.total_expenses || 0);
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ 
          display: "flex", 
          alignItems: "flex-start", 
          justifyContent: "space-between", 
          gap: 12, 
          flexWrap: "wrap" 
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: 20, 
              fontWeight: 800, 
              color: "#111", 
              letterSpacing: "-0.03em" 
            }}>
              {detail.name}
            </h2>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>
              {detail.organisation_name} · {detail.project_type}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <StageBadge stage={detail.current_stage} />
            <StatusPill label={detail.status_display} completed={detail.is_completed} />
          </div>
        </div>
        {detail.description && (
          <p style={{ 
            margin: "10px 0 0", 
            fontSize: 13, 
            color: "#666", 
            lineHeight: 1.65 
          }}>
            {detail.description}
          </p>
        )}
      </div>

      {/* Stats */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit,minmax(95px,1fr))", 
        gap: 10 
      }}>
        <Stat label="Revenue"  value={formatINR(detail.total_revenue)}  color="#1976d2" />
        <Stat label="Expenses" value={formatINR(detail.total_expenses)} color="#e53935" />
        <Stat label="Net"      value={formatINR(net)} color={net >= 0 ? "#43a047" : "#e53935"} />
        <Stat label="Hours"    value={`${detail.total_hours || 0}h`} sub="logged" />
        <Stat label="Done"     value={`${detail.delivered_count}/${detail.deliverable_count}`} sub="deliverables" />
      </div>

      <ProgressBar done={detail.delivered_count} total={detail.deliverable_count} />

      <div style={{ borderTop: "1px solid #f0f0f0" }} />

      {/* Client + Timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ 
            fontSize: 10, 
            fontWeight: 700, 
            color: "#ccc", 
            letterSpacing: "0.07em", 
            textTransform: "uppercase" 
          }}>
            Client
          </div>
          <Meta icon="👤" label="Name" value={detail.client_name} />
          <Meta icon="📍" label="Location" value={detail.location} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ 
            fontSize: 10, 
            fontWeight: 700, 
            color: "#ccc", 
            letterSpacing: "0.07em", 
            textTransform: "uppercase" 
          }}>
            Timeline
          </div>
          <Meta icon="📅" label="Start" value={formatDate(detail.start_date)} />
          <Meta icon="🏁" label="End"   value={formatDate(detail.end_date)} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f0f0f0" }} />

      {/* Deliverables */}
      <div>
        <div style={{ 
          fontSize: 10, 
          fontWeight: 700, 
          color: "#ccc", 
          letterSpacing: "0.07em", 
          textTransform: "uppercase", 
          marginBottom: 12 
        }}>
          Deliverables ({detail.deliverables?.length || 0})
        </div>
        <DeliverablesTable rows={detail.deliverables || []} />
      </div>
    </div>
  );
}

// ─── List item ────────────────────────────────────────────────────────────────

function ListItem({ 
  project, 
  selected, 
  onClick 
}: { 
  project: ProjectRow; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px", 
        borderRadius: 9, 
        cursor: "pointer",
        background: selected ? "#f0f4ff" : "#fff",
        border: `1.5px solid ${selected ? "#1976d2" : "#ebebeb"}`,
        transition: "border-color 0.12s, background 0.12s",
        display: "flex", 
        flexDirection: "column", 
        gap: 5,
      }}
      onMouseEnter={e => { 
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#c5d8f8";
          (e.currentTarget as HTMLDivElement).style.background = "#fafbff";
        }
      }}
      onMouseLeave={e => { 
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#ebebeb";
          (e.currentTarget as HTMLDivElement).style.background = "#fff";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          color: "#111", 
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          whiteSpace: "nowrap" 
        }}>
          {project.name}
        </span>
        <StatusPill label={project.status_display} completed={project.is_completed} />
      </div>
      <div style={{ fontSize: 11, color: "#888" }}>
        {project.client_name} · {project.location}
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#bbb", flexWrap: "wrap" }}>
        <span>{project.organisation_name}</span>
        <span>{project.deliverable_count} deliv.</span>
        <span style={{ color: project.total_revenue > 0 ? "#1976d2" : "#bbb" }}>
          {formatINR(project.total_revenue)}
        </span>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface Filters { 
  q: string; 
  org_id: string; 
  is_completed: string; 
  stage: string;
}

const SEL: React.CSSProperties = {
  border: "1.5px solid #e0e0e0", 
  borderRadius: 8, 
  padding: "8px 10px",
  fontSize: 13, 
  color: "#333", 
  background: "#fff",
  outline: "none", 
  fontFamily: "inherit", 
  cursor: "pointer", 
  minWidth: 0,
  transition: "border-color 0.12s",
};

function FilterBar({ 
  filters, 
  orgs, 
  onChange 
}: { 
  filters: Filters; 
  orgs: OrganisationOption[]; 
  onChange: (f: Filters) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Filters>) => onChange({ ...filters, ...p });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
      {/* Search */}
      <div
        style={{ 
          display: "flex", 
          alignItems: "center", 
          flex: "1 1 200px", 
          background: "#fff", 
          border: "1.5px solid #e0e0e0", 
          borderRadius: 8, 
          padding: "8px 12px", 
          gap: 8, 
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)", 
          cursor: "text",
          transition: "border-color 0.12s",
        }}
        onClick={() => ref.current?.focus()}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "#bbb" }}>
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          value={filters.q}
          onChange={e => set({ q: e.target.value })}
          placeholder="Search name, client, location…"
          style={{ 
            flex: 1, 
            border: "none", 
            outline: "none", 
            background: "transparent", 
            fontSize: 13, 
            color: "#222", 
            fontFamily: "inherit" 
          }}
        />
        {filters.q && (
          <button 
            onClick={e => { 
              e.stopPropagation(); 
              set({ q: "" }); 
            }} 
            style={{ 
              border: "none", 
              background: "none", 
              cursor: "pointer", 
              color: "#bbb", 
              fontSize: 17, 
              lineHeight: 1, 
              padding: 0 
            }}
          >
            ×
          </button>
        )}
      </div>

      <select 
        value={filters.org_id} 
        onChange={e => set({ org_id: e.target.value })} 
        style={SEL}
      >
        <option value="">All Orgs</option>
        {orgs.map(o => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
      </select>

      <select 
        value={filters.stage} 
        onChange={e => set({ stage: e.target.value })} 
        style={SEL}
      >
        <option value="">All Stages</option>
        {(["1","2","3","4","5"] as ProjectStage[]).map(s => (
          <option key={s} value={s}>{STAGE_LABEL[s]}</option>
        ))}
      </select>

      <select 
        value={filters.is_completed} 
        onChange={e => set({ is_completed: e.target.value })} 
        style={SEL}
      >
        <option value="">All Status</option>
        <option value="false">Active</option>
        <option value="true">Completed</option>
      </select>
    </div>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

function Empty({ msg, icon = "📂" }: { msg: string; icon?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#aaa" }}>{msg}</div>
    </div>
  );
}

// ─── Error Message ────────────────────────────────────────────────────────────

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ 
      background: "#fce4ec", 
      color: "#b71c1c", 
      borderRadius: 8, 
      padding: "12px 16px", 
      fontSize: 13, 
      marginBottom: 12,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <span>⚠️ {message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: "transparent",
            border: "1px solid #b71c1c",
            borderRadius: 4,
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 12,
            color: "#b71c1c",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const isDesktop = width >= 1024;

  const [filters, setFilters] = useState<Filters>({ 
    q: "", 
    org_id: "", 
    is_completed: "", 
    stage: "" 
  });
  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Load orgs once
  useEffect(() => {
    fetchProjectOrganisations()
      .then(setOrgs)
      .catch(err => {
        console.error("Failed to load orgs:", err);
      });
  }, []);

  // Debounced list load
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFilters = useRef<Filters>(filters);

  const loadList = useCallback(async (f: Filters) => {
    setListLoading(true);
    setListError(null);
    
    const params: ProjectListParams = {};
    if (f.org_id) params.org_id = Number(f.org_id);
    if (f.is_completed) params.is_completed = f.is_completed as "true" | "false";
    if (f.stage) params.stage = f.stage as ProjectStage;
    if (f.q) params.q = f.q;

    try {
      const data = await fetchProjects(params);
      setProjects(data);
      
      // Keep selection if still present
      setSelectedId(prev => {
        if (prev && data.find(p => p.id === prev)) return prev;
        return null;
      });
    } catch (err: any) {
      console.error("Failed to load projects:", err);
      setListError(err.message || "Failed to load projects.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const prev = prevFilters.current;
    prevFilters.current = filters;
    const delay = filters.q !== prev.q && filters.q.length > 0 ? 350 : 0;
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadList(filters), delay);
    
    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current); 
    };
  }, [filters, loadList]);

  // Load detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    
    fetchProjectDetail(selectedId)
      .then(setDetail)
      .catch((err: any) => {
        console.error("Failed to load project details:", err);
        setDetailError(err.message || "Could not load project details");
        setDetail(null);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setDetailError(null);
    if (!isDesktop) setShowDetail(true);
  };

  const handleFilterChange = (f: Filters) => {
    setFilters(f);
    if (!isDesktop) setShowDetail(false);
  };

  const handleRetryList = () => {
    loadList(filters);
  };

  const handleRetryDetail = () => {
    if (selectedId) {
      setDetailLoading(true);
      setDetailError(null);
      fetchProjectDetail(selectedId)
        .then(setDetail)
        .catch((err: any) => {
          setDetailError(err.message || "Could not load project details");
          setDetail(null);
        })
        .finally(() => setDetailLoading(false));
    }
  };

  const handleDebug = async () => {
    try {
      const result = await debugProjects();
      console.log("Debug result:", result);
      setDebugInfo(result);
      setShowDebug(true);
    } catch (err: any) {
      setDebugInfo({ error: err.message });
      setShowDebug(true);
    }
  };

  const pad = isDesktop ? "36px 28px" : width < 640 ? "12px 10px" : "22px 16px";

  const listPane = (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {listLoading ? (
        Array.from({ length: 7 }).map((_, i) => <SkeletonListItem key={i} />)
      ) : projects.length === 0 ? (
        <Empty msg="No projects found" icon="📭" />
      ) : (
        projects.map(p => (
          <ListItem
            key={p.id}
            project={p}
            selected={selectedId === p.id}
            onClick={() => handleSelect(p.id)}
          />
        ))
      )}
    </div>
  );

  const detailPane = (
    <div style={{
      background: "#fff", 
      border: "1px solid #e8e8e8", 
      borderRadius: 14,
      padding: isDesktop ? "22px 24px" : "18px 16px",
      boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
      minHeight: isDesktop ? 480 : undefined,
    }}>
      {!selectedId ? (
        <Empty msg="Select a project to view details" icon="👆" />
      ) : detailLoading ? (
        <SkeletonDetail />
      ) : detailError ? (
        <ErrorMessage message={detailError} onRetry={handleRetryDetail} />
      ) : detail ? (
        <DetailPanel detail={detail} />
      ) : (
        <Empty msg="Could not load project details" icon="⚠️" />
      )}
    </div>
  );

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ 
        minHeight: "100vh", 
        background: "#f7f8fa", 
        fontFamily: "'DM Sans','Helvetica Neue',Arial,sans-serif", 
        padding: pad 
      }}>
        {/* Header */}
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: width < 640 ? 18 : 22, 
              fontWeight: 800, 
              color: "#111", 
              letterSpacing: "-0.03em" 
            }}>
              Projects
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#bbb" }}>
              {listLoading 
                ? "Loading projects..." 
                : `${projects.length} project${projects.length !== 1 ? "s" : ""} · select one to view details`}
            </p>
          </div>
          <button
            onClick={handleDebug}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              background: "#f0f0f0",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🐛 Debug
          </button>
        </div>

        <FilterBar filters={filters} orgs={orgs} onChange={handleFilterChange} />

        {listError && (
          <ErrorMessage message={listError} onRetry={handleRetryList} />
        )}

        {/* Debug Panel */}
        {showDebug && debugInfo && (
          <div style={{
            background: "#f9f9f9",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "11px",
            fontFamily: "monospace",
            overflow: "auto",
            maxHeight: "300px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <strong>🔍 Debug Info</strong>
              <button
                onClick={() => setShowDebug(false)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        {/* Desktop Layout */}
        {isDesktop && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, alignItems: "start" }}>
            {listPane}
            {detailPane}
          </div>
        )}

        {/* Mobile / Tablet Layout */}
        {!isDesktop && (
          showDetail && selectedId ? (
            <>
              <button
                onClick={() => { 
                  setShowDetail(false);
                  setDetailError(null);
                }}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 5, 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer", 
                  color: "#1976d2", 
                  fontSize: 13, 
                  fontWeight: 600, 
                  padding: "0 0 14px", 
                  fontFamily: "inherit" 
                }}
              >
                ← Back to results
              </button>
              {detailPane}
            </>
          ) : listPane
        )}
      </div>
    </>
  );
}