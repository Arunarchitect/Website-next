"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  projectDetails,
  searchProjects,
  formatINR,
  formatDate,
  STATUS_COLOR,
  DELIVERABLE_STATUS_COLOR,
  type ProjectDetail,
  type ProjectStatus,
  type DeliverableStatus,
} from "./projectDashData";

// ---------------------------------------------------------------------------
// Responsive hook
// ---------------------------------------------------------------------------
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: ProjectStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: c.bg,
        color: c.text,
        borderRadius: 99,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function DeliverableBadge({ status }: { status: DeliverableStatus }) {
  const c = DELIVERABLE_STATUS_COLOR[status];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: "nowrap",
        letterSpacing: "0.03em",
      }}
    >
      {status}
    </span>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        background: "#f0f0f0",
        color: "#555",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

function MetaRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ fontSize: 15, width: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "#999", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 1 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#222", fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #ebebeb",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div style={{ fontSize: 10, color: "#999", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa" }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar for deliverable completion
// ---------------------------------------------------------------------------
function ProgressBar({ project }: { project: ProjectDetail }) {
  const total = project.deliverables.length;
  const done  = project.deliverables.filter((d) => d.status === "Done").length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#777", fontWeight: 600 }}>Deliverable Progress</span>
        <span style={{ fontSize: 11, color: "#333", fontWeight: 700 }}>{done}/{total} done · {pct}%</span>
      </div>
      <div style={{ height: 6, background: "#eee", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: pct === 100 ? "#43a047" : "#1976d2",
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------
function SearchBar({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "#fff",
        border: "1.5px solid #ddd",
        borderRadius: 10,
        padding: "10px 14px",
        gap: 10,
        transition: "border-color 0.15s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Search icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "#999" }}>
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search projects by name, client, location, status or tag…"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 14,
          color: "#222",
          fontFamily: "inherit",
        }}
        autoFocus
      />
      {value && (
        <button
          onClick={onClear}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#aaa",
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project list item
// ---------------------------------------------------------------------------
function ProjectListItem({
  project,
  selected,
  onClick,
}: {
  project: ProjectDetail;
  selected: boolean;
  onClick: () => void;
}) {
  const totalHours = project.deliverables.reduce((s, d) => s + d.hoursLogged, 0);
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 9,
        cursor: "pointer",
        background: selected ? "#f0f4ff" : "#fff",
        border: `1.5px solid ${selected ? "#1976d2" : "#ebebeb"}`,
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = "#c5d8f8";
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = "#ebebeb";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </span>
        <StatusBadge status={project.status} />
      </div>
      <div style={{ fontSize: 11, color: "#888" }}>
        {project.client.location} · {project.organisation}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#aaa", marginTop: 2 }}>
        <span>{project.deliverables.length} deliverables</span>
        <span>{totalHours}h logged</span>
        <span>{formatINR(project.revenue)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project detail panel
// ---------------------------------------------------------------------------
function ProjectDetailPanel({ project }: { project: ProjectDetail }) {
  const totalHours = project.deliverables.reduce((s, d) => s + d.hoursLogged, 0);
  const doneCount  = project.deliverables.filter((d) => d.status === "Done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.03em" }}>
              {project.name}
            </h2>
            <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{project.organisation}</div>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555", lineHeight: 1.6 }}>
          {project.description}
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {project.tags.map((t) => <Tag key={t} label={t} />)}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <StatCard label="Revenue"    value={formatINR(project.revenue)} />
        <StatCard label="Hours"      value={`${totalHours}h`}           sub="total logged" />
        <StatCard label="Team"       value={`${project.teamMembers.length}`} sub="members" />
        <StatCard label="Delivered"  value={`${doneCount}/${project.deliverables.length}`} sub="deliverables" />
      </div>

      {/* Progress */}
      <ProgressBar project={project} />

      {/* Divider */}
      <div style={{ borderTop: "1px solid #f0f0f0" }} />

      {/* Client + Timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", letterSpacing: "0.07em", textTransform: "uppercase" }}>Client</div>
          <MetaRow icon="👤" label="Name"     value={project.client.name} />
          <MetaRow icon="📍" label="Location" value={project.client.location} />
          <MetaRow icon="✉️" label="Contact"  value={project.client.contact} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", letterSpacing: "0.07em", textTransform: "uppercase" }}>Timeline</div>
          <MetaRow icon="📅" label="Start"    value={formatDate(project.startDate)} />
          <MetaRow icon="🏁" label="End"      value={formatDate(project.endDate)} />
          <MetaRow icon="👥" label="Team"     value={project.teamMembers.join(", ")} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #f0f0f0" }} />

      {/* Deliverables table */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
          Deliverables
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 120px 80px 70px",
              gap: 8,
              padding: "0 10px",
            }}
          >
            {["Deliverable", "Assigned To", "Status", "Hours"].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#bbb", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {h}
              </span>
            ))}
          </div>

          {project.deliverables.map((d) => (
            <div
              key={d.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 80px 70px",
                gap: 8,
                alignItems: "center",
                background: "#fafafa",
                border: "1px solid #ebebeb",
                borderRadius: 8,
                padding: "9px 10px",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>Due {formatDate(d.dueDate)}</div>
              </div>
              <div style={{ fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.assignedTo}
              </div>
              <div>
                <DeliverableBadge status={d.status} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>
                {d.hoursLogged > 0 ? `${d.hoursLogged}h` : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ query }: { query: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#bbb" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#999" }}>
        {query ? `No projects matching "${query}"` : "Select a project to see details"}
      </div>
      {query && (
        <div style={{ fontSize: 12, color: "#bbb", marginTop: 6 }}>
          Try searching by client name, location, or tag
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ProjectDashPage() {
  const width     = useWindowWidth();
  const isMobile  = width < 640;
  const isTablet  = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState<ProjectDetail | null>(projectDetails[0]);
  // On mobile show detail panel only when a project is tapped
  const [showDetail, setShowDetail] = useState(false);

  const results = useMemo(() => searchProjects(query), [query]);

  // Keep selection valid when query changes
  useEffect(() => {
    if (selected && !results.find((r) => r.id === selected.id)) {
      setSelected(results[0] ?? null);
    }
  }, [results, selected]);

  const handleSelect = (p: ProjectDetail) => {
    setSelected(p);
    if (!isDesktop) setShowDetail(true);
  };

  const outerPad = isMobile ? "12px 10px" : isTablet ? "24px 18px" : "40px 28px";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
        padding: outerPad,
        boxSizing: "border-box",
      }}
    >
      {/* Page title */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#111", letterSpacing: "-0.03em" }}>
          Projects
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#aaa" }}>
          {projectDetails.length} projects · select one to view details
        </p>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <SearchBar
          value={query}
          onChange={(v) => { setQuery(v); if (!isDesktop) setShowDetail(false); }}
          onClear={() => { setQuery(""); if (!isDesktop) setShowDetail(false); }}
        />
      </div>

      {/* ── Desktop: side-by-side ── */}
      {isDesktop && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.length === 0 ? (
              <EmptyState query={query} />
            ) : (
              results.map((p) => (
                <ProjectListItem
                  key={p.id}
                  project={p}
                  selected={selected?.id === p.id}
                  onClick={() => handleSelect(p)}
                />
              ))
            )}
          </div>

          {/* Detail */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e8e8e8",
              borderRadius: 14,
              padding: "24px 26px",
              boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
              minHeight: 500,
            }}
          >
            {selected ? <ProjectDetailPanel project={selected} /> : <EmptyState query={query} />}
          </div>
        </div>
      )}

      {/* ── Mobile / Tablet: list or detail ── */}
      {!isDesktop && (
        <div>
          {showDetail && selected ? (
            <>
              {/* Back button */}
              <button
                onClick={() => setShowDetail(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#1976d2",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "0 0 14px",
                  fontFamily: "inherit",
                  touchAction: "manipulation",
                }}
              >
                ← Back to results
              </button>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e8e8e8",
                  borderRadius: 12,
                  padding: "18px 16px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                }}
              >
                <ProjectDetailPanel project={selected} />
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.length === 0 ? (
                <EmptyState query={query} />
              ) : (
                results.map((p) => (
                  <ProjectListItem
                    key={p.id}
                    project={p}
                    selected={false}
                    onClick={() => handleSelect(p)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}