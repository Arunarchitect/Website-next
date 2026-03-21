"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  currentUser,
  getMyAssignments,
  getMyQuickAccess,
  getDeliverable,
  getProject,
  getOrganisation,
  type Assignment,
  type QuickAccess,
} from "./dashboardData";

// ---------------------------------------------------------------------------
// Format helpers  (24-hour, date included)
// ---------------------------------------------------------------------------

/** "DD/MM/YYYY HH:MM" */
function fmt24(date: Date): string {
  const dd   = String(date.getDate()).padStart(2, "0");
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh   = String(date.getHours()).padStart(2, "0");
  const min  = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** "HH:MM" for the time input value */
function fmtTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseTimeInput(value: string): Date | null {
  const [h, m] = value.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
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

// ---------------------------------------------------------------------------
// Timer entry
// ---------------------------------------------------------------------------

interface TimerEntry {
  id: string;            // assignment.id or quickAccess.id
  deliverableId: string;
  orgName: string;
  projectName: string;
  deliverableName: string;
  dueDate?: string;      // only for assigned
  elapsed: number;       // accumulated seconds
  sessionStart: Date | null;
  sessionEnd: Date | null;
  endInput: string;
}

function makeEntry(
  id: string,
  deliverableId: string,
  dueDate?: string
): TimerEntry {
  const del  = getDeliverable(deliverableId);
  const proj = del ? getProject(del.projectId) : undefined;
  const org  = del ? getOrganisation(del.organisationId) : undefined;
  return {
    id,
    deliverableId,
    orgName:         org?.name  ?? "—",
    projectName:     proj?.name ?? "—",
    deliverableName: del?.name  ?? deliverableId,
    dueDate,
    elapsed:      0,
    sessionStart: null,
    sessionEnd:   null,
    endInput:     "",
  };
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onDiscard, onCancel }: ConfirmDialogProps) {
  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "28px 28px 20px",
          maxWidth: 340,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: "14px", color: "#111", lineHeight: 1.6, marginBottom: "20px" }}>
          {message}
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnStyle("#f3f3f3", "#333")}>Cancel</button>
          <button onClick={onDiscard} style={btnStyle("#fff3f0", "#e53935")}>Discard</button>
          <button onClick={onConfirm} style={btnStyle("#e53935", "#fff")}>Record</button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "7px 16px",
    borderRadius: "7px",
    border: "none",
    background: bg,
    color,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const PlayIcon  = () => <svg width="9" height="11" viewBox="0 0 10 12" fill="none"><polygon points="0,0 10,6 0,12" fill="currentColor"/></svg>;
const StopIcon  = () => <svg width="9" height="9"  viewBox="0 0 10 10" fill="none"><rect width="10" height="10" rx="2" fill="currentColor"/></svg>;
const PinIcon   = () => <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5L10.5 3.5L7 5.5V9L5 11V7L1.5 5L3.5 3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
function WorklogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="5" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function OrgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="6" y="1" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="12" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="6" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3.5" y1="9" x2="14.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3.5" y1="9" x2="3.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="14.5" y1="9" x2="14.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function ProjectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 5.5C2 4.12 3.12 3 4.5 3H7l1.5 2H13.5C14.88 5 16 6.12 16 7.5V13.5C16 14.88 14.88 16 13.5 16H4.5C3.12 16 2 14.88 2 13.5V5.5Z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function MemberIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 15c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function NavButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: "1 1 0", minWidth: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "8px", padding: "16px 10px",
        background: hovered ? "#f2f2f2" : "#fafafa",
        border: `1px solid ${hovered ? "#d0d0d0" : "#e4e4e4"}`,
        borderRadius: "10px", cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        touchAction: "manipulation", WebkitTapHighlightColor: "transparent", color: "#222",
      }}
    >
      <span style={{ color: "#555" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#333", letterSpacing: "0.02em", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </button>
  );
}

function ModelflickMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.85"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.45"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.45"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.85"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Table header
// ---------------------------------------------------------------------------
function TableHeader({ showDue }: { showDue?: boolean }) {
  const th = (label: string, w: number, align: React.CSSProperties["textAlign"] = "left") => (
    <div key={label} style={{ width: w, flexShrink: 0, fontSize: "10px", fontWeight: 700, color: "#aaa", letterSpacing: "0.07em", textTransform: "uppercase", textAlign: align, paddingBottom: "6px" }}>
      {label}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2, paddingRight: 2 }}>
      {th("Org", 110)}
      {th("Project", 120)}
      {th("Deliverable", 130)}
      {showDue && th("Due", 88, "center")}
      {th("Start", 120, "center")}
      {th("End", 80, "center")}
      {th("Elapsed", 64, "right")}
      <div style={{ width: 34, flexShrink: 0 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timer row
// ---------------------------------------------------------------------------
interface RowProps {
  entry: TimerEntry;
  isRunning: boolean;
  liveSeconds: number;
  showDue?: boolean;
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
  onEndChange: (id: string, v: string) => void;
}

function TimerRow({ entry, isRunning, liveSeconds, showDue, onPlay, onStop, onEndChange }: RowProps) {
  const nearEnd = isRunning && entry.sessionEnd && entry.sessionEnd.getTime() - Date.now() < 5 * 60 * 1000;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: isRunning ? "#fff8f8" : "#f7f7f7",
      border: `1px solid ${nearEnd ? "#ff8a65" : isRunning ? "#ffbbbb" : "#eaeaea"}`,
      borderRadius: "8px", padding: "9px 10px",
      transition: "background 0.2s, border-color 0.2s",
    }}>
      {/* Org */}
      <Cell w={110} style={{ color: "#888" }}>{entry.orgName}</Cell>
      {/* Project */}
      <Cell w={120} style={{ color: "#222", fontWeight: 500 }}>{entry.projectName}</Cell>
      {/* Deliverable */}
      <Cell w={130} style={{ color: "#555" }}>{entry.deliverableName}</Cell>
      {/* Due */}
      {showDue && <Cell w={88} style={{ color: "#888", textAlign: "center" }}>{entry.dueDate ?? "—"}</Cell>}
      {/* Session start */}
      <Cell w={120} style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", color: isRunning ? "#e53935" : "#bbb", fontWeight: isRunning ? 600 : 400 }}>
        {entry.sessionStart ? fmt24(entry.sessionStart) : "—"}
      </Cell>
      {/* Session end — editable time input */}
      <div style={{ width: 80, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        {isRunning ? (
          <input
            type="time"
            value={entry.endInput}
            onChange={(e) => onEndChange(entry.id, e.target.value)}
            style={{
              width: "100%", fontSize: "12px", fontVariantNumeric: "tabular-nums",
              border: `1px solid ${nearEnd ? "#ff8a65" : "#ffbbbb"}`,
              borderRadius: "5px", padding: "2px 4px",
              background: nearEnd ? "#fff3f0" : "#fff8f8",
              color: nearEnd ? "#e64a19" : "#e53935",
              fontWeight: 600, outline: "none", textAlign: "center", cursor: "pointer",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <span style={{ fontSize: "12px", color: "#bbb" }}>—</span>
        )}
      </div>
      {/* Elapsed */}
      <div style={{ width: 64, flexShrink: 0, fontSize: "12px", fontVariantNumeric: "tabular-nums", color: isRunning ? "#e53935" : "#444", fontWeight: isRunning ? 600 : 400, textAlign: "right" }}>
        {formatElapsed(liveSeconds)}
      </div>
      {/* Play / Stop */}
      <button
        onClick={() => isRunning ? onStop(entry.id) : onPlay(entry.id)}
        style={{
          width: 30, height: 30, borderRadius: "50%",
          border: `2px solid ${isRunning ? "#e53935" : "#444"}`,
          background: isRunning ? "#e53935" : "transparent",
          color: isRunning ? "#fff" : "#444",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.15s", padding: 0,
          touchAction: "manipulation", WebkitTapHighlightColor: "transparent",
        }}
      >
        {isRunning ? <StopIcon /> : <PlayIcon />}
      </button>
    </div>
  );
}

function Cell({ w, style, children }: { w: number; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ width: w, flexShrink: 0, fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...style }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------
function SectionLabel({ label, sub }: { label: string; sub?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#888", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      {sub}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const isMobile = useWindowWidth() < 640;
  const router   = useRouter();

  // Build entries once
  const [entries, setEntries] = useState<Record<string, TimerEntry>>(() => {
    const list: TimerEntry[] = [
      ...getMyAssignments().map((a: Assignment) =>
        makeEntry(a.id, a.deliverableId, a.dueDate)
      ),
      ...getMyQuickAccess().map((q: QuickAccess) =>
        makeEntry(q.id, q.deliverableId)
      ),
    ];
    return Object.fromEntries(list.map((e) => [e.id, e]));
  });

  const [runningId, setRunningId]   = useState<string | null>(null);
  const startRef                    = useRef<number | null>(null);
  const [tick, setTick]             = useState(0);

  // Pending action for the confirm dialog
  // action = "stop"  → stop the running timer
  // action = "switch" → stop current and start `nextId`
  const [pending, setPending] = useState<{ action: "stop" | "switch"; nextId?: string } | null>(null);

  // Tick every second while running
  useEffect(() => {
    if (!runningId) return;
    const iv = setInterval(
      () => setTick(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000)),
      1000
    );
    return () => clearInterval(iv);
  }, [runningId]);

  // Auto-stop at session end time
  useEffect(() => {
    if (!runningId) return;
    const end = entries[runningId]?.sessionEnd;
    if (!end) return;
    const rem = end.getTime() - Date.now();
    if (rem <= 0) { commitStop(runningId); return; }
    const t = setTimeout(() => commitStop(runningId), rem);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningId, entries[runningId ?? ""]?.sessionEnd?.getTime()]);

  // ---------------------------------------------------------------------------
  // Core timer actions (no confirm)
  // ---------------------------------------------------------------------------
  const commitStart = useCallback((id: string) => {
    const now     = new Date();
    const autoEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    startRef.current = Date.now();
    setTick(0);
    setRunningId(id);
    setEntries((prev) => ({
      ...prev,
      [id]: { ...prev[id], sessionStart: now, sessionEnd: autoEnd, endInput: fmtTimeInput(autoEnd) },
    }));
  }, []);

  const commitStop = useCallback((id: string) => {
    if (startRef.current === null) return;
    const secs = Math.floor((Date.now() - startRef.current) / 1000);
    setEntries((prev) => ({
      ...prev,
      [id]: { ...prev[id], elapsed: prev[id].elapsed + secs, sessionStart: null, sessionEnd: null, endInput: "" },
    }));
    startRef.current = null;
    setTick(0);
    setRunningId(null);
  }, []);

  const discardCurrent = useCallback(() => {
    if (!runningId) return;
    setEntries((prev) => ({
      ...prev,
      [runningId]: { ...prev[runningId], sessionStart: null, sessionEnd: null, endInput: "" },
    }));
    startRef.current = null;
    setTick(0);
    setRunningId(null);
  }, [runningId]);

  // ---------------------------------------------------------------------------
  // UI handlers — open dialog instead of acting immediately
  // ---------------------------------------------------------------------------
  const handlePlay = useCallback((id: string) => {
    if (!runningId) {
      // Nothing running — start directly, no confirm needed
      commitStart(id);
      return;
    }
    if (runningId === id) return; // already running
    // Ask: record current session, discard it, or cancel?
    setPending({ action: "switch", nextId: id });
  }, [runningId, commitStart]);

  const handleStop = useCallback((id: string) => {
    setPending({ action: "stop" });
  }, []);

  const handleEndChange = useCallback((id: string, v: string) => {
    const parsed = parseTimeInput(v);
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], endInput: v, sessionEnd: parsed } }));
  }, []);

  // ---------------------------------------------------------------------------
  // Dialog resolution
  // ---------------------------------------------------------------------------
  const handleConfirm = () => {
    if (!pending || !runningId) return;
    commitStop(runningId);
    if (pending.action === "switch" && pending.nextId) {
      commitStart(pending.nextId);
    }
    setPending(null);
  };

  const handleDiscard = () => {
    if (!pending || !runningId) return;
    const nextId = pending.action === "switch" ? pending.nextId : undefined;
    discardCurrent();
    if (nextId) commitStart(nextId);
    setPending(null);
  };

  const handleCancel = () => setPending(null);

  // ---------------------------------------------------------------------------
  // Derived display data
  // ---------------------------------------------------------------------------
  const assignedEntries  = getMyAssignments().map((a: Assignment)  => entries[a.id]).filter(Boolean);
  const quickEntries     = getMyQuickAccess().map((q: QuickAccess) => entries[q.id]).filter(Boolean);

  const liveSeconds = (id: string) =>
    (entries[id]?.elapsed ?? 0) + (runningId === id ? tick : 0);

  const [first, ...rest] = currentUser.name.split(" ");

  const dialogMessage =
    pending?.action === "stop"
      ? "Record this work session?"
      : "You have a session running. Record it before switching?";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const renderSection = (list: TimerEntry[], showDue?: boolean) => (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: showDue ? 650 : 560 }}>
        <TableHeader showDue={showDue} />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {list.map((e) => (
            <TimerRow
              key={e.id}
              entry={e}
              isRunning={runningId === e.id}
              liveSeconds={liveSeconds(e.id)}
              showDue={showDue}
              onPlay={handlePlay}
              onStop={handleStop}
              onEndChange={handleEndChange}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {pending && (
        <ConfirmDialog
          message={dialogMessage}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          onCancel={handleCancel}
        />
      )}

      <div style={{
        minHeight: "100vh", background: "#fafafa",
        fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: isMobile ? "14px 6px" : "48px 24px", boxSizing: "border-box",
      }}>
        <div style={{
          background: "#fff", border: "1px solid #e4e4e4",
          borderRadius: isMobile ? "12px" : "16px",
          padding: isMobile ? "20px 12px" : "36px 40px",
          width: "100%", maxWidth: "900px",
          boxShadow: "0 2px 20px 0 rgba(0,0,0,0.06)", boxSizing: "border-box",
        }}>

          {/* Greeting */}
          <div style={{ fontSize: isMobile ? "17px" : "21px", fontWeight: 400, color: "#111", marginBottom: 4, lineHeight: 1.4 }}>
            Welcome, <span style={{ fontWeight: 700 }}>{first} {rest.join(" ")}</span>!
          </div>

          {/* Banner */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            background: "#fdf5f5", border: "1px solid #fde0e0",
            borderRadius: "10px", padding: isMobile ? "12px" : "14px 16px",
            marginTop: 14, marginBottom: 28,
          }}>
            <div style={{ paddingTop: 2 }}><ModelflickMark /></div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#e53935", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                Modelflick
              </div>
              <div style={{ fontSize: isMobile ? "12px" : "13px", color: "#555", lineHeight: 1.65 }}>
                Unified platform for{" "}
                <span style={{ textDecoration: "underline", textDecorationColor: "#e53935", textUnderlineOffset: "3px", textDecorationThickness: "1.5px", color: "#222" }}>
                  architecture planning &amp; project delivery
                </span>.
              </div>
            </div>
          </div>

          {/* Assigned */}
          <SectionLabel label="Assigned Deliverables" />
          {renderSection(assignedEntries, true)}

          <div style={{ borderTop: "1px solid #ebebeb", margin: "24px 0" }} />

          {/* Quick Access */}
          <SectionLabel
            label="Quick Access"
            sub={<span style={{ fontSize: "10px", color: "#e53935", opacity: 0.8, display: "flex", alignItems: "center", gap: 3 }}><PinIcon /> pinned</span>}
          />
          {renderSection(quickEntries)}

          <div style={{ borderTop: "1px solid #ebebeb", margin: "24px 0" }} />

          {/* Nav buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <NavButton icon={<WorklogIcon />} label="Detailed Worklog"  onClick={() => router.push("/new/hour")} />
            <NavButton icon={<OrgIcon />}     label="Organisation Info" onClick={() => router.push("/new/stat")} />
            <NavButton icon={<ProjectIcon />} label="Project Info"      onClick={() => router.push("/new/projectdash")} />
            <NavButton icon={<MemberIcon />}  label="Member Info"       onClick={() => router.push("/new/perform")} />
          </div>

        </div>
      </div>
    </>
  );
}