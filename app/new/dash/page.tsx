"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  currentUser,
  organisations,
  projects as allProjects,
  worklogSessions,
  assignedSessions,
  quickAccessSessions,
  sessionToElapsed,
  getProject,
  getDeliverable,
  type WorkSession,
} from "./dashboardData";

// ---------------------------------------------------------------------------
// Runtime timer entry (what the component works with)
// ---------------------------------------------------------------------------
interface TimerEntry {
  id: string;
  projectName: string;
  deliverableName: string;
  /** accumulated seconds (from past sessions + in-app stop events) */
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Seed TimerEntry list from WorkSession data
// ---------------------------------------------------------------------------
function seedEntries(sessions: WorkSession[]): TimerEntry[] {
  return sessions.map((s) => ({
    id: s.id,
    projectName:     getProject(s.projectId)?.name     ?? s.projectId,
    deliverableName: getDeliverable(s.deliverableId)?.name ?? s.deliverableId,
    elapsed: sessionToElapsed(s),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ---------------------------------------------------------------------------
// Responsive hook
// ---------------------------------------------------------------------------
function useWindowWidth() {
  const [width, setWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function PlayIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0 }}>
      <polygon points="0,0 10,6 0,12" fill="currentColor" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
      <rect width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pill
// ---------------------------------------------------------------------------
function Pill({ label }: { label: string }) {
  return (
    <div
      style={{
        background: "#f2f2f2",
        border: "1px solid #e4e4e4",
        borderRadius: "6px",
        padding: "10px 14px",
        fontSize: "13px",
        color: "#333",
        cursor: "pointer",
        transition: "background 0.15s",
        textAlign: "center",
        minHeight: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#e8e8e8")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#f2f2f2")}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimerRow
// ---------------------------------------------------------------------------
interface TimerRowProps {
  entry: TimerEntry;
  isRunning: boolean;
  liveSeconds: number;
  compact: boolean;
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
}

function TimerRow({ entry, isRunning, liveSeconds, compact, onPlay, onStop }: TimerRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? "6px" : "10px",
        background: isRunning ? "#fff8f8" : "#f7f7f7",
        border: `1px solid ${isRunning ? "#ffbbbb" : "#eaeaea"}`,
        borderRadius: "7px",
        padding: compact ? "9px 10px" : "10px 14px",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Project badge */}
      <span
        style={{
          fontSize: "11px",
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: "5px",
          padding: "3px 8px",
          color: "#555",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: compact ? 65 : 110,
          flexShrink: 1,
        }}
        title={entry.projectName}
      >
        {entry.projectName}
      </span>

      {/* Deliverable badge */}
      <span
        style={{
          fontSize: "11px",
          background: "#fff",
          border: "1px solid #e0e0e0",
          borderRadius: "5px",
          padding: "3px 8px",
          color: "#555",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: compact ? 75 : 130,
          flexShrink: 1,
        }}
        title={entry.deliverableName}
      >
        {entry.deliverableName}
      </span>

      <div style={{ flex: 1 }} />

      {/* Elapsed time */}
      <span
        style={{
          fontSize: "12px",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          flexShrink: 0,
          color: isRunning ? "#e53935" : "#333",
          fontWeight: isRunning ? 600 : 400,
          minWidth: 58,
          textAlign: "right",
          transition: "color 0.2s",
        }}
      >
        {formatTime(liveSeconds)}
      </span>

      {/* Play / Stop button */}
      <button
        onClick={() => (isRunning ? onStop(entry.id) : onPlay(entry.id))}
        aria-label={isRunning ? "Stop timer" : "Start timer"}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: `2px solid ${isRunning ? "#e53935" : "#444"}`,
          background: isRunning ? "#e53935" : "transparent",
          color: isRunning ? "#fff" : "#444",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          padding: 0,
        }}
      >
        {isRunning ? <StopIcon /> : <PlayIcon />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#222", marginBottom: "7px", letterSpacing: "0.02em" }}>
        {title}
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e4e4e4",
          borderRadius: "10px",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column header
// ---------------------------------------------------------------------------
const colHeader: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#777",
  textAlign: "center",
  marginBottom: "8px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const width = useWindowWidth();
  const isMobile  = width < 640;
  const isTablet  = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  // ---- Derive recent lists ----
  const recentOrgs     = organisations.slice(0, 3).map((o) => o.name);
  const recentProjects = allProjects.slice(0, 3).map((p) => p.name);

  // ---- Timer state ----
  const [entries, setEntries] = useState<Record<string, TimerEntry>>(() => {
    const all = [
      ...seedEntries(worklogSessions),
      ...seedEntries(assignedSessions),
      ...seedEntries(quickAccessSessions),
    ];
    return Object.fromEntries(all.map((e) => [e.id, e]));
  });

  const [runningId, setRunningId]   = useState<string | null>(null);
  const startRef                    = useRef<number | null>(null);
  const [tick, setTick]             = useState(0);

  // Tick every second while a timer is running
  useEffect(() => {
    if (!runningId) return;
    const iv = setInterval(() => {
      setTick(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [runningId]);

  const handlePlay = useCallback((id: string) => {
    // Save elapsed for the currently running timer before switching
    if (runningId && startRef.current !== null) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      setEntries((prev) => ({
        ...prev,
        [runningId]: { ...prev[runningId], elapsed: prev[runningId].elapsed + secs },
      }));
    }
    startRef.current = Date.now();
    setTick(0);
    setRunningId(id);
  }, [runningId]);

  const handleStop = useCallback((id: string) => {
    if (runningId !== id || startRef.current === null) return;
    const secs = Math.floor((Date.now() - startRef.current) / 1000);
    setEntries((prev) => ({
      ...prev,
      [id]: { ...prev[id], elapsed: prev[id].elapsed + secs },
    }));
    startRef.current = null;
    setTick(0);
    setRunningId(null);
  }, [runningId]);

  const liveSeconds = (id: string) =>
    (entries[id]?.elapsed ?? 0) + (runningId === id ? tick : 0);

  const renderRows = (sessions: WorkSession[]) =>
    sessions.map((s) => (
      <TimerRow
        key={s.id}
        entry={entries[s.id]}
        isRunning={runningId === s.id}
        liveSeconds={liveSeconds(s.id)}
        compact={isMobile}
        onPlay={handlePlay}
        onStop={handleStop}
      />
    ));

  // ---- Layout values ----
  const outerPad  = isMobile ? "14px 10px"  : isTablet ? "28px 20px"  : "48px 24px";
  const cardPad   = isMobile ? "18px 14px"  : isTablet ? "26px 26px"  : "34px 38px";
  const greetSize = isMobile ? "17px"        : isTablet ? "20px"        : "22px";
  const innerGap  = isMobile ? "10px"        : "16px";

  const [firstName, ...rest] = currentUser.name.split(" ");
  const lastName = rest.join(" ");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: outerPad,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e4e4e4",
          borderRadius: isMobile ? "12px" : "16px",
          padding: cardPad,
          width: "100%",
          maxWidth: "900px",
          boxShadow: "0 2px 20px 0 rgba(0,0,0,0.06)",
          boxSizing: "border-box",
        }}
      >
        {/* ── Greeting ── */}
        <div
          style={{
            fontSize: greetSize,
            fontWeight: 400,
            color: "#111",
            marginBottom: isMobile ? "18px" : "30px",
            lineHeight: 1.4,
          }}
        >
          Hi,{" "}
          <span style={{ fontWeight: 700 }}>{firstName} {lastName}</span>,{" "}
          <span
            style={{
              textDecoration: "underline",
              textDecorationColor: "#e53935",
              textUnderlineOffset: "4px",
              textDecorationThickness: "2px",
            }}
          >
            welcome aboard.
          </span>
        </div>

        {/* ── Two-column grid (stacks on mobile/tablet) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
            gap: isDesktop ? "40px" : "20px",
            // On desktop the left column is a flex column so Skills pins to bottom
            alignItems: "stretch",
          }}
        >
          {/* ════ LEFT PANEL ════ */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? "16px" : "24px",
            }}
          >
            {/* Recent Orgs + Recent Projects */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: innerGap,
              }}
            >
              <div>
                <div style={colHeader}>Recent Organisations</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentOrgs.map((o) => <Pill key={o} label={o} />)}
                </div>
              </div>
              <div>
                <div style={colHeader}>Recent Projects</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {recentProjects.map((p) => <Pill key={p} label={p} />)}
                </div>
              </div>
            </div>

            {/* Spacer — pushes Skills to the absolute bottom on desktop */}
            {isDesktop && <div style={{ flex: 1 }} />}

            {/* ── Skills & Score — always LAST in left panel ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: innerGap,
              }}
            >
              <div>
                <div style={colHeader}>Skills</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {currentUser.skills.map((s) => <Pill key={s.name} label={s.name} />)}
                </div>
              </div>
              <div>
                <div style={colHeader}>Score</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {currentUser.skills.map((s) => (
                    <Pill key={s.name + "-score"} label={s.score} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ════ RIGHT PANEL ════ */}
          <div>
            <SectionCard title="Worklog">
              {renderRows(worklogSessions)}
            </SectionCard>

            <SectionCard title="Assigned">
              {renderRows(assignedSessions)}
            </SectionCard>

            <SectionCard title="Quick Access">
              {renderRows(quickAccessSessions)}
              {/* Add-row button */}
              <button
                style={{
                  width: 34,
                  height: 34,
                  border: "2px solid #bbb",
                  borderRadius: "6px",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  color: "#666",
                  padding: 0,
                  marginTop: "2px",
                  transition: "border-color 0.15s, color 0.15s",
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#222";
                  (e.currentTarget as HTMLButtonElement).style.color = "#222";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#bbb";
                  (e.currentTarget as HTMLButtonElement).style.color = "#666";
                }}
                aria-label="Add quick access"
              >
                +
              </button>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}