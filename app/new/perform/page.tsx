"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ORGANISATIONS,
  MEMBERS,
  projectsByOrg,
  deliverablesByProject,
  deliverablesByProjects,
  membersByOrg,
  projectName,
  deliverableName,
  maxOrgSkills,
  rawAvgSkillScore,
  weightedSkillScore,
  coverageFactor,
  assignmentEfficiency,
  type Member,
  type RemarkLevel,
} from "./data";

// ─── Design tokens ───────────────────────────────────────────────────────────

const REMARK_CFG: Record<RemarkLevel, { color: string; bg: string }> = {
  Excellent:           { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  Good:                { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  Average:             { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  "Needs Improvement": { color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
};

const STATUS_COLOR: Record<string, string> = {
  Completed:    "#10b981",
  "In Progress":"#3b82f6",
  Overdue:      "#ef4444",
};

// ─── Hook: responsive container width ────────────────────────────────────────

function useContainerWidth(ref: React.RefObject<HTMLElement>) {
  const [width, setWidth] = useState(9999);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    setWidth(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// ─── Ring SVG ────────────────────────────────────────────────────────────────

function Ring({ value, size = 52, stroke = 5, color = "#6366f1" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(value/100)*c} ${c}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.7s ease" }} />
    </svg>
  );
}

// ─── Searchable Dropdown ─────────────────────────────────────────────────────

interface DropdownOption { label: string; value: string; }

function SearchDropdown({
  options, value, onChange, placeholder, disabled, fullWidth,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  const selectedLabel = options.find(o => o.value === value)?.label ?? "";

  return (
    <div ref={ref} style={{ position: "relative", flex: fullWidth ? 1 : undefined, minWidth: 0 }}>
      <div onClick={() => !disabled && setOpen(p => !p)} style={{
        display: "flex", alignItems: "center", gap: 8,
        background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${open ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 10, padding: "9px 13px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13, color: value ? "#f1f5f9" : "#64748b",
        transition: "border-color 0.2s",
        width: fullWidth ? "100%" : undefined,
      }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel || placeholder}
        </span>
        <svg width={11} height={11} viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s", flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke={disabled ? "#334155" : "#64748b"} strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 200,
          background: "#1a1d2e", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#f1f5f9", fontSize: 13 }} />
          </div>
          <div onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
            style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer",
              color: !value ? "#818cf8" : "#94a3b8",
              background: !value ? "rgba(99,102,241,0.08)" : "transparent" }}>
            All
          </div>
          {filtered.map(opt => (
            <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); setQuery(""); }}
              style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer",
                color: value === opt.value ? "#818cf8" : "#94a3b8",
                background: value === opt.value ? "rgba(99,102,241,0.08)" : "transparent",
                transition: "background 0.1s" }}
              onMouseEnter={e => { if (value !== opt.value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (value !== opt.value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >{opt.label}</div>
          ))}
          {filtered.length === 0 && <div style={{ padding: "12px 14px", color: "#334155", fontSize: 13 }}>No results</div>}
        </div>
      )}
    </div>
  );
}

// ─── Skill row ───────────────────────────────────────────────────────────────

function SkillRow({ skill }: { skill: Member["skills"][0] }) {
  const cfg = REMARK_CFG[skill.remark];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: "#cbd5e1" }}>{skill.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            color: cfg.color, background: cfg.bg, whiteSpace: "nowrap" }}>{skill.remark}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#f1f5f9", minWidth: 30, textAlign: "right" }}>
            {skill.score}%
          </span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", width: `${skill.score}%`, borderRadius: 99,
          background: `linear-gradient(90deg, ${cfg.color}88, ${cfg.color})`,
          transition: "width 0.65s cubic-bezier(.16,1,.3,1)" }} />
      </div>
    </div>
  );
}

// ─── Assignment card ─────────────────────────────────────────────────────────

function AssignmentCard({ a }: { a: Member["assignments"][0] }) {
  const due      = new Date(a.dueAt);
  const done     = a.completedAt ? new Date(a.completedAt) : null;
  const assigned = new Date(a.assignedAt);
  const windowMs = due.getTime() - assigned.getTime();
  const actualMs = done ? done.getTime() - assigned.getTime() : null;
  const efficiency = actualMs !== null
    ? Math.max(0, Math.min(100, Math.round((2 - actualMs / windowMs) * 50))) : null;
  const color       = STATUS_COLOR[a.status] ?? "#94a3b8";
  const daysAllowed = Math.ceil(windowMs / 86400000);
  const daysTaken   = done ? Math.ceil((done.getTime() - assigned.getTime()) / 86400000) : null;
  const pName       = projectName(a.projectId);
  const dName       = deliverableName(a.deliverableId);

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "14px 15px", display: "flex", flexDirection: "column", gap: 10,
      transition: "background 0.2s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.055)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.4 }}>{a.title}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
          whiteSpace: "nowrap", color, background: `${color}1a` }}>{a.status}</span>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 11.5, color: "#64748b", flexWrap: "wrap" }}>
        <span>{pName} · <span style={{ color: "#475569" }}>{dName}</span></span>
        <span>Due: <span style={{ color: "#94a3b8" }}>{due.toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</span></span>
        <span>Allotted: <span style={{ color: "#94a3b8" }}>{daysAllowed}d</span></span>
        {daysTaken !== null && (
          <span>Taken: <span style={{ color: daysTaken > daysAllowed ? "#ef4444" : "#10b981" }}>{daysTaken}d</span></span>
        )}
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "#64748b" }}>
          <span>Time Efficiency</span>
          <span style={{ color: efficiency !== null ? color : "#334155" }}>
            {efficiency !== null ? `${efficiency}%` : "Pending"}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)" }}>
          {efficiency !== null && (
            <div style={{ height: "100%", width: `${efficiency}%`, borderRadius: 99,
              background: `linear-gradient(90deg, ${color}77, ${color})`, transition: "width 0.6s ease" }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Score card ───────────────────────────────────────────────────────────────

function ScoreCard({ label, value, color, subLabel }: {
  label: string; value: number; color: string; subLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 16px", background: `${color}0d`, border: `1px solid ${color}22`, borderRadius: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", fontFamily: "'Sora',sans-serif", lineHeight: 1.2, marginTop: 2 }}>
          {value}<span style={{ fontSize: 15, fontWeight: 400, color: `${color}cc` }}>%</span>
        </div>
        {subLabel && <div style={{ fontSize: 10.5, color: "#475569", marginTop: 3, lineHeight: 1.4 }}>{subLabel}</div>}
      </div>
      <div style={{ position: "relative", width: 52, height: 52, marginLeft: 12 }}>
        <Ring value={value} size={52} stroke={5} color={color} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 10, fontWeight: 700, color: `${color}cc` }}>{value}%</div>
      </div>
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

const Divider = () => <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />;

// ─── Filter label ─────────────────────────────────────────────────────────────

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, color: "#475569", fontWeight: 600,
      letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap", alignSelf: "center" }}>
      {children}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  // ── Filter state (cascade: org → project → deliverable → member)
  const [orgId,       setOrgId]       = useState("");
  const [projectId,   setProjectId]   = useState("");
  const [delivId,     setDelivId]     = useState("");
  const [memberId,    setMemberId]    = useState("");

  const containerRef = useRef<HTMLDivElement>(null!);
  const containerWidth = useContainerWidth(containerRef);
  const isMobile = containerWidth < 720;

  // ── Derived option lists (each narrows based on parent selection) ──────────

  const orgOptions = ORGANISATIONS.map(o => ({ label: o.name, value: o.id }));

  const projectOptions = useMemo(() => {
    const list = orgId ? projectsByOrg(orgId) : [];
    return list.map(p => ({ label: p.name, value: p.id }));
  }, [orgId]);

  const delivOptions = useMemo(() => {
    if (!orgId) return [];
    const projects = projectId ? [projectId] : projectsByOrg(orgId).map(p => p.id);
    return deliverablesByProjects(projects).map(d => ({ label: d.name, value: d.id }));
  }, [orgId, projectId]);

  const memberOptions = useMemo(() => {
    if (!orgId) return [];
    return membersByOrg(orgId).map(m => ({ label: m.name, value: m.id }));
  }, [orgId]);

  // ── Cascade reset helpers ─────────────────────────────────────────────────

  function handleOrgChange(id: string) {
    setOrgId(id);
    setProjectId(""); setDelivId(""); setMemberId("");
  }
  function handleProjectChange(id: string) {
    setProjectId(id);
    // reset deliverable if it no longer belongs to the new project
    if (id && delivId) {
      const valid = deliverablesByProject(id).some(d => d.id === delivId);
      if (!valid) setDelivId("");
    }
  }

  // ── Selected member ────────────────────────────────────────────────────────
  const member = MEMBERS.find(m => m.id === memberId);

  // ── Filtered assignments (project + deliverable filters applied) ───────────
  const filteredAssignments = useMemo(() => {
    if (!member) return [];
    return member.assignments.filter(a => {
      if (projectId && a.projectId     !== projectId) return false;
      if (delivId   && a.deliverableId !== delivId)   return false;
      return true;
    });
  }, [member, projectId, delivId]);

  // ── Scores ────────────────────────────────────────────────────────────────
  const rawAvg    = member ? rawAvgSkillScore(member)   : 0;
  const skillAvg  = member ? weightedSkillScore(member) : 0;
  const coverage  = member ? coverageFactor(member)     : 0;
  const maxSkills = orgId  ? maxOrgSkills(orgId)        : 1;
  const taskEffic = assignmentEfficiency(filteredAssignments);

  const anyFilter = orgId || projectId || delivId || memberId;

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh", background: "#0f1117", color: "#f1f5f9",
      fontFamily: "'DM Sans','Sora',sans-serif",
      padding: isMobile ? "20px 16px 48px" : "32px 32px 56px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: isMobile ? 18 : 26 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, fontFamily: "'Sora',sans-serif",
          letterSpacing: "-0.03em", color: "#f8fafc", margin: 0 }}>Performance</h1>
        <p style={{ color: "#475569", fontSize: 13, margin: "4px 0 0" }}>
          Member performance — skills, scores &amp; assignment efficiency
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 10 : 0,
        marginBottom: isMobile ? 18 : 24,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, padding: isMobile ? "14px 14px" : "12px 18px",
        alignItems: isMobile ? "stretch" : "center",
        flexWrap: isMobile ? undefined : "wrap",
        rowGap: 10,
      }}>

        {/* ── Row 1: Org + Project ── */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 10 : 0, flex: 1, alignItems: isMobile ? "stretch" : "center", flexWrap: "wrap" }}>

          {/* Org */}
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 6 : 10,
            padding: isMobile ? 0 : "0 14px 0 0",
            borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
            <FilterLabel>Organisation</FilterLabel>
            <SearchDropdown options={orgOptions} value={orgId} onChange={handleOrgChange}
              placeholder="Select Org" fullWidth={isMobile} />
          </div>

          {/* Project */}
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 6 : 10,
            padding: isMobile ? 0 : "0 14px",
            borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
            <FilterLabel>Project</FilterLabel>
            <SearchDropdown options={projectOptions} value={projectId}
              onChange={handleProjectChange} placeholder="All Projects"
              disabled={!orgId} fullWidth={isMobile} />
          </div>

          {/* Deliverable */}
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 6 : 10,
            padding: isMobile ? 0 : "0 14px",
            borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)" }}>
            <FilterLabel>Deliverable</FilterLabel>
            <SearchDropdown options={delivOptions} value={delivId}
              onChange={setDelivId} placeholder="All Deliverables"
              disabled={!orgId} fullWidth={isMobile} />
          </div>

          {/* Member */}
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 6 : 10,
            padding: isMobile ? 0 : "0 0 0 14px" }}>
            <FilterLabel>Member</FilterLabel>
            <SearchDropdown options={memberOptions} value={memberId}
              onChange={setMemberId} placeholder="Select Member"
              disabled={!orgId} fullWidth={isMobile} />
          </div>
        </div>

        {/* Reset */}
        {anyFilter && (
          <button onClick={() => { setOrgId(""); setProjectId(""); setDelivId(""); setMemberId(""); }}
            style={{
              alignSelf: isMobile ? "flex-start" : undefined,
              marginLeft: isMobile ? 0 : 14,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              padding: "7px 14px", fontSize: 12, color: "#64748b",
              cursor: "pointer", transition: "color 0.2s, border-color 0.2s", flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#f1f5f9"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.25)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748b"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
          >Reset</button>
        )}
      </div>

      {/* ── Empty states ── */}
      {!orgId && (
        <EmptyState icon="org" text="Select an organisation to get started" />
      )}
      {orgId && !memberId && (
        <EmptyState icon="member" text="Select a member to view their performance" />
      )}

      {/* ── Main content ── */}
      {member && (
        <div style={{ display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "340px 1fr",
          gap: isMobile ? 16 : 20, alignItems: "start" }}>

          {/* ══ LEFT: Skills ══ */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 20px",
            display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Member info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg,#6366f1,#818cf8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{member.avatar}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{member.name}</div>
                <div style={{ fontSize: 12, color: "#475569" }}>{member.role}</div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 2 }}>
                  {ORGANISATIONS.find(o => o.id === member.orgId)?.name}
                </div>
              </div>
            </div>

            <Divider />

            {/* Skill count badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" }}>Skill Assessment</span>
              <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20,
                background: "rgba(99,102,241,0.12)", color: "#818cf8", fontWeight: 600 }}>
                {member.skills.length} skills
              </span>
            </div>

            {/* Skills list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12,
              maxHeight: isMobile ? undefined : 300,
              overflowY: isMobile ? undefined : "auto",
              paddingRight: isMobile ? 0 : 4 }}>
              {member.skills.map(sk => <SkillRow key={sk.name} skill={sk} />)}
            </div>

            <Divider />

            {/* Score breakdown */}
            <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.13)",
              borderRadius: 10, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#475569",
                letterSpacing: "0.07em", textTransform: "uppercase" }}>Score Calculation</span>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                <span>Raw average <span style={{ color: "#475569" }}>
                  ({member.skills.reduce((s,sk)=>s+sk.score,0)} ÷ {member.skills.length})
                </span></span>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>{rawAvg}%</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                <span>Coverage <span style={{ color: "#475569" }}>
                  ({member.skills.length}/{maxSkills} org max)
                </span></span>
                <span style={{ fontWeight: 600,
                  color: coverage >= 0.8 ? "#10b981" : coverage >= 0.5 ? "#f59e0b" : "#ef4444" }}>
                  {Math.round(coverage * 100)}%
                </span>
              </div>

              <Divider />

              <div style={{ fontSize: 11, color: "#475569" }}>
                Weighted = {rawAvg}% × {Math.round(coverage*100)}%
                = <span style={{ color: "#818cf8", fontWeight: 700 }}>{skillAvg}%</span>
              </div>

              {/* Pip bar */}
              <div>
                <div style={{ fontSize: 10.5, color: "#334155", marginBottom: 4 }}>
                  Skill coverage ({member.skills.length}/{maxSkills})
                </div>
                <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", display: "flex", overflow: "hidden" }}>
                  {Array.from({ length: maxSkills }).map((_, i) => (
                    <div key={i} style={{ flex: 1, marginRight: i < maxSkills - 1 ? 2 : 0,
                      borderRadius: 99, transition: "background 0.3s",
                      background: i < member.skills.length ? "#6366f1" : "rgba(255,255,255,0.04)" }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Score cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr", gap: 12 }}>
              <ScoreCard label="Weighted Score" value={skillAvg} color="#6366f1"
                subLabel={`${rawAvg}% raw × ${Math.round(coverage*100)}% coverage`} />
              <ScoreCard label="Task Efficiency" value={taskEffic} color="#10b981"
                subLabel={`${filteredAssignments.length} assignment${filteredAssignments.length !== 1 ? "s" : ""}`} />
            </div>
          </div>

          {/* ══ RIGHT: Assignments ══ */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 20px",
            display: "flex", flexDirection: "column", gap: 16 }}>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" }}>Assignments</div>
              <div style={{ fontSize: 12.5, color: "#334155", marginTop: 2 }}>
                {filteredAssignments.length} of {member.assignments.length} tasks shown
              </div>
            </div>

            <Divider />

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {([
                { label: "Completed",   color: "#10b981", filter: (a: Member["assignments"][0]) => a.status === "Completed"    },
                { label: "In Progress", color: "#3b82f6", filter: (a: Member["assignments"][0]) => a.status === "In Progress"  },
                { label: "Overdue",     color: "#ef4444", filter: (a: Member["assignments"][0]) => a.status === "Overdue"      },
              ]).map(({ label, color, filter }) => (
                <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
                  borderRadius: 10, padding: isMobile ? "10px 10px" : "10px 14px" }}>
                  <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color, fontFamily: "'Sora',sans-serif" }}>
                    {filteredAssignments.filter(filter).length}
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: "#475569", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10,
              maxHeight: isMobile ? undefined : 520,
              overflowY: isMobile ? undefined : "auto",
              paddingRight: isMobile ? 0 : 4 }}>
              {filteredAssignments.length > 0
                ? filteredAssignments.map(a => <AssignmentCard key={a.id} a={a} />)
                : <div style={{ textAlign: "center", padding: "48px 0", color: "#334155", fontSize: 13 }}>
                    No assignments match the selected filters.
                  </div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state helper ───────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: "org" | "member"; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 260, gap: 12,
      border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, color: "#334155" }}>
      {icon === "org" ? (
        <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.2}>
          <rect x={3} y={3} width={7} height={7} rx={1}/><rect x={14} y={3} width={7} height={7} rx={1}/>
          <rect x={3} y={14} width={7} height={7} rx={1}/><rect x={14} y={14} width={7} height={7} rx={1}/>
        </svg>
      ) : (
        <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.2}>
          <circle cx={12} cy={8} r={4}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      )}
      <span style={{ fontSize: 13.5 }}>{text}</span>
    </div>
  );
}