"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchProjects,
  fetchProjectDetail,
  fetchProjectOrganisations,
  hoursFromListItem,
  STAGE_LABEL,
  DELIVERABLE_STATUS_LABEL,
  type ProjectListItem,
  type ProjectDetail,
  type ProjectListParams,
  type OrganisationOption,
  type ProjectStage,
  type DeliverableStatus,
} from "@/app/new/project_api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function stageColor(stage: ProjectStage): string {
  const map: Record<ProjectStage, string> = {
    "1": "#e8f4ff",
    "2": "#fff3e0",
    "3": "#f3e5f5",
    "4": "#e8f5e9",
    "5": "#fce4ec",
  };
  return map[stage] ?? "#f5f5f5";
}

function stageTextColor(stage: ProjectStage): string {
  const map: Record<ProjectStage, string> = {
    "1": "#1565c0",
    "2": "#e65100",
    "3": "#6a1b9a",
    "4": "#2e7d32",
    "5": "#880e4f",
  };
  return map[stage] ?? "#555";
}

const DELIVERABLE_STATUS_STYLE: Record<
  DeliverableStatus,
  { bg: string; text: string }
> = {
  not_started: { bg: "#f0f0f0", text: "#888" },
  ongoing: { bg: "#e3f2fd", text: "#1565c0" },
  ready: { bg: "#fff8e1", text: "#f57f17" },
  passed: { bg: "#e8f5e9", text: "#2e7d32" },
  failed: { bg: "#fce4ec", text: "#c62828" },
  discrepancy: { bg: "#fff3e0", text: "#bf360c" },
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ w, h, r = 6 }: { w?: string; h?: string; r?: number }) {
  return (
    <div
      style={{
        width: w ?? "100%",
        height: h ?? "14px",
        borderRadius: r,
        background: "linear-gradient(90deg,#ececec 25%,#f8f8f8 50%,#ececec 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ─── Stat chip ───────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "12px 16px",
        background: "#fafafa",
        border: "1px solid #efefef",
        borderRadius: 12,
        minWidth: 100,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#bbb",
          fontFamily: "var(--font-mono)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 19,
          fontWeight: 800,
          color: "#111",
          letterSpacing: "-0.03em",
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Deliverable row ─────────────────────────────────────────────────────────

function DeliverableRow({ d }: { d: ProjectDetail["deliverables"][0] }) {
  const s = DELIVERABLE_STATUS_STYLE[d.status];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: 10,
        background: "#fafafa",
        border: "1px solid #efefef",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "#f4f4f4")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "#fafafa")
      }
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "#111",
            fontFamily: "var(--font-body)",
          }}
        >
          {d.name}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#bbb" }}>
          Due {formatDate(d.end_date)}
        </p>
      </div>
      <span
        style={{
          fontSize: 11,
          color: "#666",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "none",
        }}
        className="assigned-to"
      >
        {d.assigned_to_display}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: s.bg,
          color: s.text,
          borderRadius: 6,
          padding: "3px 9px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          width: "fit-content",
          fontFamily: "var(--font-mono)",
        }}
      >
        {DELIVERABLE_STATUS_LABEL[d.status]}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#444",
          textAlign: "right",
          fontFamily: "var(--font-mono)",
        }}
      >
        {d.hours_logged > 0 ? `${d.hours_logged}h` : "—"}
      </span>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ project }: { project: ProjectDetail }) {
  const profit = project.total_revenue - project.total_expenses;
  const pct =
    project.deliverable_count === 0
      ? 0
      : Math.round((project.delivered_count / project.deliverable_count) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(18px, 5vw, 22px)",
                fontWeight: 900,
                color: "#0a0a0a",
                letterSpacing: "-0.04em",
                fontFamily: "var(--font-display)",
                lineHeight: 1.1,
              }}
            >
              {project.name}
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "clamp(11px, 3vw, 12px)",
                color: "#999",
                fontFamily: "var(--font-body)",
              }}
            >
              {project.organisation_name} · {project.location}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                background: stageColor(project.current_stage),
                color: stageTextColor(project.current_stage),
                borderRadius: 8,
                padding: "4px 12px",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
              }}
            >
              {STAGE_LABEL[project.current_stage]}
            </span>
            {project.is_completed && (
              <span
                style={{
                  background: "#e8f5e9",
                  color: "#2e7d32",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                ✓ Completed
              </span>
            )}
          </div>
        </div>
        {project.description && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(12px, 3.5vw, 13px)",
              color: "#555",
              lineHeight: 1.65,
              fontFamily: "var(--font-body)",
            }}
          >
            {project.description}
          </p>
        )}
      </div>

      {/* Stats row - responsive grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 8,
        }}
      >
        <Stat label="Revenue" value={formatINR(project.total_revenue)} />
        <Stat label="Expenses" value={formatINR(project.total_expenses)} />
        <Stat label="Profit" value={formatINR(profit)} />
        <Stat label="Hours" value={`${project.total_hours}h`} />
        <Stat
          label="Done"
          value={`${project.delivered_count}/${project.deliverable_count}`}
        />
      </div>

      {/* Progress bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#bbb",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono)",
            }}
          >
            Deliverable Progress
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#333",
              fontFamily: "var(--font-mono)",
            }}
          >
            {pct}%
          </span>
        </div>
        <div
          style={{
            height: 5,
            background: "#ededed",
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background:
                pct === 100
                  ? "linear-gradient(90deg,#43a047,#66bb6a)"
                  : "linear-gradient(90deg,#1565c0,#42a5f5)",
              borderRadius: 99,
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Client + Timeline - responsive */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
          paddingTop: 4,
          borderTop: "1px solid #f0f0f0",
        }}
      >
        {[
          {
            heading: "Client",
            rows: [
              { label: "Name", value: project.client_name },
              { label: "Location", value: project.location },
              { label: "Type", value: project.project_type },
            ],
          },
          {
            heading: "Timeline",
            rows: [
              { label: "Start", value: formatDate(project.start_date) },
              { label: "End", value: formatDate(project.end_date) },
              {
                label: "Billing",
                value:
                  project.billing_type === "hourly"
                    ? "Hourly"
                    : "Percentage Share",
              },
            ],
          },
        ].map((col) => (
          <div key={col.heading}>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#ccc",
                fontFamily: "var(--font-mono)",
              }}
            >
              {col.heading}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {col.rows.map((r) => (
                <div key={r.label}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: "#bbb",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {r.label}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "clamp(12px, 3.5vw, 13px)",
                      fontWeight: 600,
                      color: "#222",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {r.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Deliverables - responsive table */}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 4 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#ccc",
              fontFamily: "var(--font-mono)",
            }}
          >
            Deliverables
          </p>
          {/* column headers - hide on mobile */}
          <div
            style={{
              display: "none",
              gridTemplateColumns: "1fr 130px 160px 60px",
              gap: 10,
              width: "100%",
              marginLeft: 14,
            }}
            className="deliverable-headers"
          >
            {["Task", "Assigned To", "Status", "Hours"].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#ccc",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono)",
                  textAlign: h === "Hours" ? "right" : "left",
                }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {project.deliverables.length === 0 ? (
            <p style={{ fontSize: 13, color: "#bbb", textAlign: "center", padding: "24px 0" }}>
              No deliverables yet
            </p>
          ) : (
            project.deliverables.map((d) => (
              <DeliverableRow key={d.id} d={d} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Project list card ───────────────────────────────────────────────────────

function ProjectCard({
  project,
  selected,
  onClick,
}: {
  project: ProjectListItem;
  selected: boolean;
  onClick: () => void;
}) {
  const hours = hoursFromListItem(project);
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "13px 15px",
        borderRadius: 12,
        cursor: "pointer",
        border: `1.5px solid ${selected ? "#1565c0" : "#ebebeb"}`,
        background: selected ? "#f0f4ff" : "#fff",
        transition: "all 0.15s",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        if (!selected)
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#c5d5f5";
      }}
      onMouseLeave={(e) => {
        if (!selected)
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#ebebeb";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: "clamp(12px, 4vw, 13px)",
            fontWeight: 700,
            color: "#0a0a0a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            background: stageColor(project.current_stage),
            color: stageTextColor(project.current_stage),
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 9,
            fontWeight: 700,
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            flexShrink: 0,
          }}
        >
          {project.is_completed
            ? "✓ Done"
            : STAGE_LABEL[project.current_stage]}
        </span>
      </div>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "clamp(10px, 3vw, 11px)",
          color: "#999",
          fontFamily: "var(--font-body)",
        }}
      >
        {project.client_name} · {project.location}
      </p>
      <div
        style={{
          display: "flex",
          gap: 14,
          fontSize: "clamp(10px, 3vw, 11px)",
          color: "#bbb",
          fontFamily: "var(--font-mono)",
          flexWrap: "wrap",
        }}
      >
        <span>{project.agg_deliverable_count} deliverables</span>
        <span>{hours}h</span>
        <span>{formatINR(project.agg_revenue)}</span>
      </div>
    </button>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  orgs,
  params,
  onChange,
}: {
  orgs: OrganisationOption[];
  params: ProjectListParams;
  onChange: (p: ProjectListParams) => void;
}) {
  const inputStyle: React.CSSProperties = {
    border: "1.5px solid #e4e4e4",
    borderRadius: 9,
    padding: "8px 12px",
    fontSize: 13,
    color: "#222",
    background: "#fff",
    outline: "none",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    appearance: "none" as React.CSSProperties["appearance"],
    WebkitAppearance: "none",
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "1 1 200px",
          border: "1.5px solid #e4e4e4",
          borderRadius: 9,
          padding: "8px 12px",
          background: "#fff",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          style={{ color: "#bbb", flexShrink: 0 }}
        >
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line
            x1="10.5"
            y1="10.5"
            x2="14"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={params.q ?? ""}
          onChange={(e) => onChange({ ...params, q: e.target.value })}
          placeholder="Search projects…"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: "#222",
            fontFamily: "var(--font-body)",
            width: "100%",
          }}
        />
        {params.q && (
          <button
            onClick={() => onChange({ ...params, q: "" })}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "#bbb",
              fontSize: 17,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Org filter */}
      <select
        value={params.org_id ?? ""}
        onChange={(e) =>
          onChange({
            ...params,
            org_id: e.target.value ? Number(e.target.value) : undefined,
          })
        }
        style={{ ...inputStyle, flex: "1 1 140px", minWidth: "120px" }}
      >
        <option value="">All Orgs</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      {/* Stage filter */}
      <select
        value={params.stage ?? ""}
        onChange={(e) =>
          onChange({
            ...params,
            stage: (e.target.value || undefined) as ProjectStage | undefined,
          })
        }
        style={{ ...inputStyle, flex: "1 1 100px", minWidth: "100px" }}
      >
        <option value="">All Stages</option>
        {(["1", "2", "3", "4", "5"] as ProjectStage[]).map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </select>

      {/* Completion filter */}
      <select
        value={
          params.is_completed === undefined
            ? ""
            : params.is_completed
            ? "true"
            : "false"
        }
        onChange={(e) =>
          onChange({
            ...params,
            is_completed:
              e.target.value === "" ? undefined : e.target.value === "true",
          })
        }
        style={{ ...inputStyle, flex: "1 1 110px", minWidth: "110px" }}
      >
        <option value="">All Status</option>
        <option value="false">In Progress</option>
        <option value="true">Completed</option>
      </select>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [params, setParams] = useState<ProjectListParams>({});
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [showMobileList, setShowMobileList] = useState(true);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedParams, setDebouncedParams] = useState<ProjectListParams>({});

  useEffect(() => {
    fetchProjectOrganisations().then(setOrgs).catch(() => {});
  }, []);

  const handleParamChange = (p: ProjectListParams) => {
    setParams(p);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedParams(p), 320);
  };

  useEffect(() => {
    setListLoading(true);
    setListError(null);
    fetchProjects(debouncedParams)
      .then((data) => {
        setProjects(data);
        setListLoading(false);
        // Auto-select first if nothing selected and on desktop
        if (data.length > 0 && !selectedId && window.innerWidth > 768) {
          selectProject(data[0].id);
        }
      })
      .catch((e: Error) => {
        setListError(e.message);
        setListLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedParams]);

  const selectProject = useCallback((id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    fetchProjectDetail(id)
      .then((d) => {
        setDetail(d);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  }, []);

  const handleCardClick = (id: number) => {
    selectProject(id);
    // On mobile, switch to detail view
    if (window.innerWidth <= 768) {
      setShowMobileList(false);
      setShowMobileDetail(true);
    }
    setTimeout(() => detailRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const handleBackToList = () => {
    setShowMobileList(true);
    setShowMobileDetail(false);
  };

  // Add resize handler for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setShowMobileList(true);
        setShowMobileDetail(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700;800;900&family=Lato:wght@400;500;600&family=JetBrains+Mono:wght@500;600;700&display=swap');

        :root {
          --font-display: 'Bricolage Grotesque', sans-serif;
          --font-body: 'Lato', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }

        * { box-sizing: border-box; }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .project-card-enter {
          animation: fadeIn 0.2s ease forwards;
        }
        .detail-enter {
          animation: fadeIn 0.25s ease forwards;
        }
        .mobile-detail-enter {
          animation: slideIn 0.3s ease forwards;
        }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 99px; }

        /* Responsive styles */
        @media (max-width: 768px) {
          .deliverable-headers {
            display: none !important;
          }
          .assigned-to {
            display: none !important;
          }
        }

        @media (min-width: 769px) {
          .mobile-back-button {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#f5f6f8",
          fontFamily: "var(--font-body)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Top bar ── */}
        <header
          style={{
            padding: "clamp(12px, 4vw, 18px) clamp(16px, 5vw, 28px) clamp(10px, 3vw, 14px)",
            background: "#fff",
            borderBottom: "1px solid #efefef",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "0 0 auto" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(18px, 6vw, 20px)",
                fontWeight: 900,
                color: "#0a0a0a",
                letterSpacing: "-0.04em",
                fontFamily: "var(--font-display)",
              }}
            >
              Projects
            </h1>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "clamp(10px, 3vw, 11px)",
                color: "#bbb",
                fontFamily: "var(--font-mono)",
              }}
            >
              {projects.length} results
            </p>
          </div>

          <div style={{ flex: 1, minWidth: "clamp(200px, 80%, 280px)" }}>
            <FilterBar orgs={orgs} params={params} onChange={handleParamChange} />
          </div>
        </header>

        {/* ── Body ── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "clamp(280px, 28%, 340px) 1fr",
            overflow: "hidden",
            height: "calc(100vh - 75px)",
            position: "relative",
          }}
          className="main-grid"
        >
          {/* List column - hidden on mobile when detail is shown */}
          <aside
            style={{
              borderRight: "1px solid #efefef",
              background: "#fff",
              overflowY: "auto",
              padding: "14px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              ...(window.innerWidth <= 768 && !showMobileList
                ? { display: "none" }
                : {}),
            }}
          >
            {listError && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "#fce4ec",
                  borderRadius: 10,
                  color: "#c62828",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {listError}
              </div>
            )}

            {listLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    padding: "13px 15px",
                    border: "1.5px solid #efefef",
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <Skeleton h="14px" w="75%" />
                  <Skeleton h="10px" w="50%" />
                  <Skeleton h="10px" w="60%" />
                </div>
              ))
            ) : projects.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#ccc",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                <p style={{ margin: 0, fontSize: 13, fontFamily: "var(--font-body)" }}>
                  No projects found
                </p>
              </div>
            ) : (
              projects.map((p, i) => (
                <div
                  key={p.id}
                  className="project-card-enter"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <ProjectCard
                    project={p}
                    selected={selectedId === p.id}
                    onClick={() => handleCardClick(p.id)}
                  />
                </div>
              ))
            )}
          </aside>

          {/* Detail column - full width on mobile when shown */}
          <main
            ref={detailRef}
            style={{
              overflowY: "auto",
              padding: "clamp(16px, 4vw, 24px) clamp(16px, 5vw, 28px)",
              background: "#f5f6f8",
              ...(window.innerWidth <= 768 && showMobileDetail
                ? { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, background: "#f5f6f8" }
                : {}),
            }}
          >
            {/* Mobile back button */}
            {window.innerWidth <= 768 && showMobileDetail && (
              <button
                onClick={handleBackToList}
                className="mobile-back-button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "white",
                  border: "1px solid #efefef",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 16,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1565c0",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back to projects
              </button>
            )}

            {detailLoading ? (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "clamp(20px, 5vw, 28px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  border: "1px solid #efefef",
                }}
              >
                <Skeleton h="22px" w="55%" />
                <Skeleton h="12px" w="35%" />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        flex: "1 1 120px",
                        padding: "14px",
                        border: "1px solid #efefef",
                        borderRadius: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <Skeleton h="10px" w="50%" />
                      <Skeleton h="20px" w="70%" />
                    </div>
                  ))}
                </div>
                <Skeleton h="5px" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} h="44px" r={10} />
                ))}
              </div>
            ) : detail ? (
              <div
                className={window.innerWidth <= 768 ? "mobile-detail-enter" : "detail-enter"}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: "clamp(20px, 5vw, 28px)",
                  border: "1px solid #efefef",
                  boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
                }}
              >
                <DetailPanel project={detail} />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#ccc",
                  gap: 10,
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  style={{ opacity: 0.4 }}
                >
                  <rect
                    x="6"
                    y="6"
                    width="36"
                    height="36"
                    rx="8"
                    stroke="#bbb"
                    strokeWidth="2"
                  />
                  <line x1="14" y1="18" x2="34" y2="18" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
                  <line x1="14" y1="24" x2="28" y2="24" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
                  <line x1="14" y1="30" x2="24" y2="30" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontFamily: "var(--font-body)",
                    color: "#bbb",
                  }}
                >
                  Select a project to view details
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}