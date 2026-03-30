"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchDashboard,
  fetchActiveWorkLog,
  startWorkLog,
  endWorkLog,
  discardWorkLog,
  updateWorkLogEndTime,
  updateWorkLogRemarks,
  type DashboardAssignment,
  type DashboardQuickAccess,
  type DashboardData,
} from "@/app/new/api";

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function fmtDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fmtDateTimeLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function useWindowWidth(): number {
  const [w, setW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimerEntry {
  id: string;
  deliverableId: number;
  /** Only present for assigned rows */
  taskName?: string;
  orgName: string;
  projectName: string;
  deliverableName: string;
  dueDate?: string;
  elapsed: number;
  sessionStart: Date | null;
  sessionEnd: Date | null;
  endInput: string;
  endError: string;
  remarks: string;
  remarksSaved: boolean;
}

function makeEntryFromAssignment(a: DashboardAssignment): TimerEntry {
  return {
    id: `a-${a.id}`,
    deliverableId: a.deliverable_id,
    taskName: a.name,
    orgName: a.org_name,
    projectName: a.project_name,
    deliverableName: a.deliverable_name,
    dueDate: a.due_date ?? undefined,
    elapsed: 0,
    sessionStart: null,
    sessionEnd: null,
    endInput: "",
    endError: "",
    remarks: "",
    remarksSaved: false,
  };
}

function makeEntryFromQuickAccess(q: DashboardQuickAccess): TimerEntry {
  return {
    id: `q-${q.id}`,
    deliverableId: q.deliverable_id,
    orgName: q.org_name,
    projectName: q.project_name,
    deliverableName: q.deliverable_name,
    elapsed: 0,
    sessionStart: null,
    sessionEnd: null,
    endInput: "",
    endError: "",
    remarks: "",
    remarksSaved: false,
  };
}

// ---------------------------------------------------------------------------
// Shared button style
// ---------------------------------------------------------------------------
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "12px", padding: "28px 28px 20px", maxWidth: 340, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif" }}
      >
        <div style={{ fontSize: "14px", color: "#111", lineHeight: 1.6, marginBottom: "20px" }}>{message}</div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnStyle("#f3f3f3", "#333")}>Cancel</button>
          <button onClick={onDiscard} style={btnStyle("#fff3f0", "#e53935")}>Discard</button>
          <button onClick={onConfirm} style={btnStyle("#e53935", "#fff")}>Record</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text popup — click truncated text to see full
// ---------------------------------------------------------------------------

function TextPopup({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        onClick={() => setOpen(true)}
        title={text}
        style={{ cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", ...style }}
      >
        {text}
      </span>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "10px", padding: "20px 24px", maxWidth: 360, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "#222", lineHeight: 1.6 }}
          >
            {text}
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button onClick={() => setOpen(false)} style={btnStyle("#f3f3f3", "#333")}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const PlayIcon = () => (
  <svg width="9" height="11" viewBox="0 0 10 12" fill="none">
    <polygon points="0,0 10,6 0,12" fill="currentColor" />
  </svg>
);
const StopIcon = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
    <rect width="10" height="10" rx="2" fill="currentColor" />
  </svg>
);
const PinIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <path d="M8.5 1.5L10.5 3.5L7 5.5V9L5 11V7L1.5 5L3.5 3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const TickIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <polyline points="1,6 4.5,9.5 11,2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function WorklogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ModelflickMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.85" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.45" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.45" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#e53935" opacity="0.85" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NavButton — uses <a> so right-click "Open in new tab" works natively
// ---------------------------------------------------------------------------
function NavButton({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "16px 10px",
        background: hovered ? "#f2f2f2" : "#fafafa",
        border: `1px solid ${hovered ? "#d0d0d0" : "#e4e4e4"}`,
        borderRadius: "10px",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
        textDecoration: "none",
        color: "#222",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ color: "#555" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#333", letterSpacing: "0.02em", textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------
function SectionLabel({ label, sub }: { label: string; sub?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#888", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
      {sub}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── DESKTOP TABLE ──
// ---------------------------------------------------------------------------

interface DesktopRowProps {
  entry: TimerEntry;
  isRunning: boolean;
  liveSeconds: number;
  showDue?: boolean;
  showTask?: boolean;
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
  onEndChange: (id: string, v: string) => void;
  onRemarksChange: (id: string, v: string) => void;
  onRemarksSave: (id: string) => void;
}

function DesktopTableHeader({ showDue, showTask }: { showDue?: boolean; showTask?: boolean }) {
  const th = (label: string, w: number, align: React.CSSProperties["textAlign"] = "left") => (
    <div key={label} style={{ width: w, flexShrink: 0, fontSize: "10px", fontWeight: 700, color: "#aaa", letterSpacing: "0.07em", textTransform: "uppercase", textAlign: align, paddingBottom: "6px" }}>
      {label}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2, paddingRight: 2 }}>
      <div style={{ width: 34, flexShrink: 0 }} />
      {th("Elapsed", 68, "center")}
      {th("Org", 88)}
      {th("Project", 100)}
      {showTask && th("Task", 110)}
      {th("Deliverable", 120)}
      {showDue && th("Due", 72, "center")}
      {th("Start", 82, "center")}
      {th("End", 148, "center")}
      {th("Remarks", 150)}
      <div style={{ width: 28, flexShrink: 0 }} />
    </div>
  );
}

function DesktopRow({
  entry, isRunning, liveSeconds, showDue, showTask,
  onPlay, onStop, onEndChange, onRemarksChange, onRemarksSave,
}: DesktopRowProps) {
  const nearEnd = isRunning && entry.sessionEnd && entry.sessionEnd.getTime() - Date.now() < 5 * 60 * 1000;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: isRunning ? "#fff8f8" : "#f7f7f7",
          border: `1px solid ${nearEnd ? "#ff8a65" : isRunning ? "#ffbbbb" : "#eaeaea"}`,
          borderRadius: entry.endError ? "8px 8px 0 0" : "8px",
          padding: "8px 8px",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        {/* Play/Stop */}
        <button
          onClick={() => isRunning ? onStop(entry.id) : onPlay(entry.id)}
          style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${isRunning ? "#e53935" : "#444"}`, background: isRunning ? "#e53935" : "transparent", color: isRunning ? "#fff" : "#444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, transition: "all 0.15s", touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          {isRunning ? <StopIcon /> : <PlayIcon />}
        </button>

        {/* Elapsed */}
        <div style={{ width: 68, flexShrink: 0, fontSize: "12px", fontVariantNumeric: "tabular-nums", color: isRunning ? "#e53935" : "#444", fontWeight: isRunning ? 600 : 400, textAlign: "center" }}>
          {formatElapsed(liveSeconds)}
        </div>

        {/* Org */}
        <div style={{ width: 88, flexShrink: 0, overflow: "hidden" }}>
          <TextPopup text={entry.orgName} style={{ fontSize: "12px", color: "#888" }} />
        </div>

        {/* Project */}
        <div style={{ width: 100, flexShrink: 0, overflow: "hidden" }}>
          <TextPopup text={entry.projectName} style={{ fontSize: "12px", color: "#222", fontWeight: 500 }} />
        </div>

        {/* Task (assigned only) */}
        {showTask && (
          <div style={{ width: 110, flexShrink: 0, overflow: "hidden" }}>
            <TextPopup text={entry.taskName ?? "—"} style={{ fontSize: "12px", color: "#555", fontStyle: "italic" }} />
          </div>
        )}

        {/* Deliverable */}
        <div style={{ width: 120, flexShrink: 0, overflow: "hidden" }}>
          <TextPopup text={entry.deliverableName} style={{ fontSize: "12px", color: "#555" }} />
        </div>

        {/* Due */}
        {showDue && (
          <div style={{ width: 72, flexShrink: 0, fontSize: "12px", color: "#888", textAlign: "center", whiteSpace: "nowrap" }}>
            {entry.dueDate ?? "—"}
          </div>
        )}

        {/* Start — two lines */}
        <div style={{ width: 82, flexShrink: 0, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {entry.sessionStart ? (
            <>
              <div style={{ fontSize: "10px", color: isRunning ? "#e53935" : "#bbb", lineHeight: 1.3 }}>{fmtDate(entry.sessionStart)}</div>
              <div style={{ fontSize: "12px", color: isRunning ? "#e53935" : "#bbb", fontWeight: isRunning ? 700 : 400, lineHeight: 1.3 }}>{fmtTime(entry.sessionStart)}</div>
            </>
          ) : (
            <span style={{ fontSize: "12px", color: "#bbb" }}>—</span>
          )}
        </div>

        {/* End — datetime-local */}
        <div style={{ width: 148, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          {isRunning ? (
            <input
              type="datetime-local"
              value={entry.endInput}
              onChange={(e) => onEndChange(entry.id, e.target.value)}
              style={{ width: "100%", fontSize: "11px", fontVariantNumeric: "tabular-nums", border: `1px solid ${entry.endError ? "#e53935" : nearEnd ? "#ff8a65" : "#ffbbbb"}`, borderRadius: "5px", padding: "3px 5px", background: entry.endError ? "#fff0f0" : nearEnd ? "#fff3f0" : "#fff8f8", color: entry.endError ? "#e53935" : nearEnd ? "#e64a19" : "#e53935", fontWeight: 600, outline: "none", cursor: "pointer", boxSizing: "border-box" }}
            />
          ) : (
            <span style={{ fontSize: "12px", color: "#bbb" }}>—</span>
          )}
        </div>

        {/* Remarks */}
        <input
          type="text"
          value={entry.remarks}
          onChange={(e) => onRemarksChange(entry.id, e.target.value)}
          placeholder={isRunning ? "Add note…" : ""}
          disabled={!isRunning}
          style={{ width: 150, flexShrink: 0, fontSize: "12px", border: `1px solid ${isRunning ? "#e0e0e0" : "transparent"}`, borderRadius: "5px", padding: "4px 6px", background: isRunning ? "#fff" : "transparent", color: "#555", outline: "none", cursor: isRunning ? "text" : "default", boxSizing: "border-box" }}
        />

        {/* Tick */}
        <div style={{ width: 28, flexShrink: 0 }}>
          {isRunning && (
            <button
              onClick={() => onRemarksSave(entry.id)}
              title="Save remarks"
              style={{ width: 26, height: 26, borderRadius: "5px", border: `1px solid ${entry.remarksSaved ? "#43a047" : "#e0e0e0"}`, background: entry.remarksSaved ? "#e8f5e9" : "#fff", color: entry.remarksSaved ? "#43a047" : "#aaa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", padding: 0 }}
            >
              <TickIcon />
            </button>
          )}
        </div>
      </div>

      {entry.endError && (
        <div style={{ background: "#fff0f0", border: "1px solid #ffbbbb", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "4px 10px", fontSize: "11px", color: "#e53935" }}>
          ⚠ {entry.endError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ── MOBILE CARD ──
// ---------------------------------------------------------------------------

interface MobileCardProps {
  entry: TimerEntry;
  isRunning: boolean;
  liveSeconds: number;
  showTask?: boolean;
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
  onEndChange: (id: string, v: string) => void;
  onRemarksChange: (id: string, v: string) => void;
  onRemarksSave: (id: string) => void;
}

function MobileCard({
  entry, isRunning, liveSeconds, showTask,
  onPlay, onStop, onEndChange, onRemarksChange, onRemarksSave,
}: MobileCardProps) {
  const nearEnd = isRunning && entry.sessionEnd && entry.sessionEnd.getTime() - Date.now() < 5 * 60 * 1000;

  const labelStyle: React.CSSProperties = { fontSize: "10px", fontWeight: 700, color: "#aaa", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: "13px", color: "#333", fontWeight: 400 };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          background: isRunning ? "#fff8f8" : "#f7f7f7",
          border: `1px solid ${nearEnd ? "#ff8a65" : isRunning ? "#ffbbbb" : "#eaeaea"}`,
          borderRadius: entry.endError ? "10px 10px 0 0" : "10px",
          padding: "12px 12px 10px",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        {/* Top row: play + elapsed + meta */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Play/Stop */}
          <button
            onClick={() => isRunning ? onStop(entry.id) : onPlay(entry.id)}
            style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${isRunning ? "#e53935" : "#444"}`, background: isRunning ? "#e53935" : "transparent", color: isRunning ? "#fff" : "#444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0, marginTop: 2, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
          >
            {isRunning ? <StopIcon /> : <PlayIcon />}
          </button>

          {/* Meta block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Org · Project */}
            <div style={{ fontSize: "11px", color: "#999", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {entry.orgName} · {entry.projectName}
            </div>
            {/* Task (assigned) */}
            {showTask && entry.taskName && (
              <div style={{ fontSize: "12px", color: "#555", fontStyle: "italic", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {entry.taskName}
              </div>
            )}
            {/* Deliverable */}
            <div style={{ fontSize: "13px", color: "#111", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {entry.deliverableName}
            </div>
          </div>

          {/* Elapsed */}
          <div style={{ fontSize: "14px", fontVariantNumeric: "tabular-nums", color: isRunning ? "#e53935" : "#999", fontWeight: isRunning ? 700 : 400, flexShrink: 0, paddingTop: 6 }}>
            {formatElapsed(liveSeconds)}
          </div>
        </div>

        {/* Running details */}
        {isRunning && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Start + End row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div style={labelStyle}>Start</div>
                {entry.sessionStart ? (
                  <>
                    <div style={{ ...valueStyle, fontSize: "11px", color: "#e53935", lineHeight: 1.3 }}>{fmtDate(entry.sessionStart)}</div>
                    <div style={{ fontSize: "13px", color: "#e53935", fontWeight: 700, lineHeight: 1.3 }}>{fmtTime(entry.sessionStart)}</div>
                  </>
                ) : (
                  <div style={valueStyle}>—</div>
                )}
              </div>
              <div>
                <div style={labelStyle}>End</div>
                <input
                  type="datetime-local"
                  value={entry.endInput}
                  onChange={(e) => onEndChange(entry.id, e.target.value)}
                  style={{ width: "100%", fontSize: "11px", border: `1px solid ${entry.endError ? "#e53935" : nearEnd ? "#ff8a65" : "#ffbbbb"}`, borderRadius: "6px", padding: "4px 6px", background: entry.endError ? "#fff0f0" : nearEnd ? "#fff3f0" : "#fff8f8", color: entry.endError ? "#e53935" : nearEnd ? "#e64a19" : "#e53935", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Remarks row */}
            <div>
              <div style={labelStyle}>Remarks</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={entry.remarks}
                  onChange={(e) => onRemarksChange(entry.id, e.target.value)}
                  placeholder="Add note…"
                  style={{ flex: 1, fontSize: "13px", border: "1px solid #e0e0e0", borderRadius: "6px", padding: "5px 8px", background: "#fff", color: "#555", outline: "none", boxSizing: "border-box" }}
                />
                <button
                  onClick={() => onRemarksSave(entry.id)}
                  title="Save remarks"
                  style={{ width: 32, height: 32, borderRadius: "6px", border: `1px solid ${entry.remarksSaved ? "#43a047" : "#e0e0e0"}`, background: entry.remarksSaved ? "#e8f5e9" : "#fff", color: entry.remarksSaved ? "#43a047" : "#aaa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}
                >
                  <TickIcon />
                </button>
              </div>
            </div>

            {/* Due (if present) */}
            {entry.dueDate && (
              <div>
                <div style={labelStyle}>Due</div>
                <div style={valueStyle}>{entry.dueDate}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {entry.endError && (
        <div style={{ background: "#fff0f0", border: "1px solid #ffbbbb", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "5px 12px", fontSize: "11px", color: "#e53935" }}>
          ⚠ {entry.endError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending action type
// ---------------------------------------------------------------------------
interface PendingAction {
  action: "stop" | "switch";
  nextId?: string;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const isMobile = useWindowWidth() < 700;


  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const [entries, setEntries] = useState<Record<string, TimerEntry>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const startRef = useRef<number | null>(null);
  const worklogIdRef = useRef<number | null>(null);
  const endTimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Build entries
  useEffect(() => {
    if (!dashboard) return;
    const list: TimerEntry[] = [
      ...dashboard.assignments.map(makeEntryFromAssignment),
      ...dashboard.quick_access.map(makeEntryFromQuickAccess),
    ];
    setEntries(Object.fromEntries(list.map((e) => [e.id, e])));
  }, [dashboard]);

  // Restore active session
  useEffect(() => {
    if (!dashboard) return;
    fetchActiveWorkLog()
      .then((active) => {
        if (!active || active.finalised) return;
        const sessionStart = new Date(active.start_time);
        const sessionEnd = new Date(active.end_time);
        const now = Date.now();
        if (sessionEnd.getTime() <= now) return;

        const matchA = dashboard.assignments.find((a) => a.deliverable_id === active.deliverable_id);
        const matchQ = dashboard.quick_access.find((q) => q.deliverable_id === active.deliverable_id);
        const entryId = matchA ? `a-${matchA.id}` : matchQ ? `q-${matchQ.id}` : null;
        if (!entryId) return;

        worklogIdRef.current = active.id;
        startRef.current = sessionStart.getTime();
        setTick(Math.floor((now - sessionStart.getTime()) / 1000));
        setRunningId(entryId);
        setEntries((prev) => ({
          ...prev,
          [entryId]: { ...prev[entryId], sessionStart, sessionEnd, endInput: fmtDateTimeLocal(sessionEnd), endError: "", remarks: active.remarks, remarksSaved: false },
        }));
      })
      .catch(() => {});
  }, [dashboard]);

  // Tick
  useEffect(() => {
    if (!runningId) return;
    const iv = setInterval(() => setTick(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [runningId]);

  // Auto-clear at sessionEnd
  useEffect(() => {
    if (!runningId) return;
    const end = entries[runningId]?.sessionEnd;
    if (!end) return;
    const rem = end.getTime() - Date.now();
    const clearUI = () => {
      setEntries((prev) => ({ ...prev, [runningId]: { ...prev[runningId], sessionStart: null, sessionEnd: null, endInput: "", endError: "", remarks: "", remarksSaved: false } }));
      worklogIdRef.current = null; startRef.current = null; setTick(0); setRunningId(null);
    };
    if (rem <= 0) { clearUI(); return; }
    const t = setTimeout(clearUI, rem);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningId, entries[runningId ?? ""]?.sessionEnd?.getTime()]);

  // Timer actions
  const commitStart = useCallback(async (id: string) => {
    const entry = entries[id];
    if (!entry) return;
    try {
      const result = await startWorkLog(entry.deliverableId);
      const sessionStart = new Date(result.start_time);
      const sessionEnd = new Date(result.end_time);
      worklogIdRef.current = result.id;
      startRef.current = sessionStart.getTime();
      setTick(0); setRunningId(id);
      setEntries((prev) => ({ ...prev, [id]: { ...prev[id], sessionStart, sessionEnd, endInput: fmtDateTimeLocal(sessionEnd), endError: "", remarks: "", remarksSaved: false } }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to start worklog");
    }
  }, [entries]);

  const commitStop = useCallback(async (id: string) => {
    if (!worklogIdRef.current) return;
    const entry = entries[id];
    try {
      await endWorkLog(worklogIdRef.current, entry.remarks ?? "");
      setSaveError(null);
    } catch (e) {
      setSaveError(`Failed to save worklog: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    worklogIdRef.current = null;
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], elapsed: 0, sessionStart: null, sessionEnd: null, endInput: "", endError: "", remarks: "", remarksSaved: false } }));
    startRef.current = null; setTick(0); setRunningId(null);
  }, [entries]);

  const discardCurrent = useCallback(async () => {
    if (!runningId) return;
    if (worklogIdRef.current) {
      try { await discardWorkLog(worklogIdRef.current); }
      catch (e) { setSaveError(`Failed to discard: ${e instanceof Error ? e.message : "unknown error"}`); }
      worklogIdRef.current = null;
    }
    setEntries((prev) => ({ ...prev, [runningId]: { ...prev[runningId], sessionStart: null, sessionEnd: null, endInput: "", endError: "", remarks: "", remarksSaved: false } }));
    startRef.current = null; setTick(0); setRunningId(null);
  }, [runningId]);

  const handlePlay = useCallback((id: string) => {
    if (!runningId) { void commitStart(id); return; }
    if (runningId === id) return;
    setPending({ action: "switch", nextId: id });
  }, [runningId, commitStart]);

  const handleStop = useCallback(() => { setPending({ action: "stop" }); }, []);

  const handleEndChange = useCallback((id: string, v: string) => {
    const parsed = parseDateTimeLocal(v);
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], endInput: v } }));
    if (!parsed || !worklogIdRef.current) return;
    if (parsed <= new Date()) {
      setEntries((prev) => ({ ...prev, [id]: { ...prev[id], endInput: v, endError: "End time must be in the future." } }));
      return;
    }
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], endInput: v, endError: "", sessionEnd: parsed } }));
    if (endTimeDebounceRef.current) clearTimeout(endTimeDebounceRef.current);
    endTimeDebounceRef.current = setTimeout(() => {
      if (!worklogIdRef.current) return;
      updateWorkLogEndTime(worklogIdRef.current, parsed).catch((e: Error) => {
        setEntries((prev) => ({ ...prev, [id]: { ...prev[id], endError: e.message } }));
      });
    }, 1500);
  }, []);

  const handleRemarksChange = useCallback((id: string, v: string) => {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], remarks: v, remarksSaved: false } }));
  }, []);

  const handleRemarksSave = useCallback(async (id: string) => {
    if (!worklogIdRef.current) return;
    const entry = entries[id];
    try {
      await updateWorkLogRemarks(worklogIdRef.current, entry.remarks ?? "");
      setEntries((prev) => ({ ...prev, [id]: { ...prev[id], remarksSaved: true } }));
    } catch (e) {
      setSaveError(`Failed to save remarks: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }, [entries]);

  const handleConfirm = async () => {
    if (!pending || !runningId) return;
    await commitStop(runningId);
    if (pending.action === "switch" && pending.nextId) await commitStart(pending.nextId);
    setPending(null);
  };

  const handleDiscard = async () => {
    if (!pending || !runningId) return;
    const nextId = pending.action === "switch" ? pending.nextId : undefined;
    await discardCurrent();
    if (nextId) await commitStart(nextId);
    setPending(null);
  };

  const handleCancel = () => setPending(null);

  // Derived
  const assignedEntries = (dashboard?.assignments ?? [])
    .map((a) => entries[`a-${a.id}`])
    .filter((e): e is TimerEntry => Boolean(e));

  const quickEntries = (dashboard?.quick_access ?? [])
    .map((q) => entries[`q-${q.id}`])
    .filter((e): e is TimerEntry => Boolean(e));

  const liveSeconds = (id: string) => (entries[id]?.elapsed ?? 0) + (runningId === id ? tick : 0);

  const userName = dashboard?.user.name ?? "";
  const [first, ...rest] = userName.split(" ");

  const dialogMessage = pending?.action === "stop"
    ? "Record this work session?"
    : "You have a session running. Record it before switching?";

  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#888" }}>
        Loading…
      </div>
    );

  if (error)
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: "#e53935" }}>
        {error}
      </div>
    );

  // ── Desktop table section
  const renderDesktopSection = (list: TimerEntry[], showDue?: boolean, showTask?: boolean) => {
    // min width: 34+6+68+6+88+6+100+6 + (110+6 if task) + 120+6 + (72+6 if due) + 82+6 + 148+6 + 150+6 + 28 = ~870 base, +116 task, +78 due
    const minW = 870 + (showTask ? 116 : 0) + (showDue ? 78 : 0);
    return (
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: minW }}>
          <DesktopTableHeader showDue={showDue} showTask={showTask} />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {list.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#bbb", padding: "12px 4px" }}>None</div>
            ) : (
              list.map((e) => (
                <DesktopRow
                  key={e.id}
                  entry={e}
                  isRunning={runningId === e.id}
                  liveSeconds={liveSeconds(e.id)}
                  showDue={showDue}
                  showTask={showTask}
                  onPlay={handlePlay}
                  onStop={handleStop}
                  onEndChange={handleEndChange}
                  onRemarksChange={handleRemarksChange}
                  onRemarksSave={handleRemarksSave}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Mobile card section
  const renderMobileSection = (list: TimerEntry[], showTask?: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#bbb", padding: "8px 0" }}>None</div>
      ) : (
        list.map((e) => (
          <MobileCard
            key={e.id}
            entry={e}
            isRunning={runningId === e.id}
            liveSeconds={liveSeconds(e.id)}
            showTask={showTask}
            onPlay={handlePlay}
            onStop={handleStop}
            onEndChange={handleEndChange}
            onRemarksChange={handleRemarksChange}
            onRemarksSave={handleRemarksSave}
          />
        ))
      )}
    </div>
  );

  return (
    <>
      {pending && (
        <ConfirmDialog
          message={dialogMessage}
          onConfirm={() => void handleConfirm()}
          onDiscard={() => void handleDiscard()}
          onCancel={handleCancel}
        />
      )}

      <div
        style={{
          minHeight: "100vh",
          background: "#fafafa",
          fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: isMobile ? "12px 8px" : "32px 16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e4e4e4",
            borderRadius: isMobile ? "12px" : "16px",
            padding: isMobile ? "18px 12px" : "32px 32px",
            width: "100%",
            maxWidth: "1200px",
            boxShadow: "0 2px 20px 0 rgba(0,0,0,0.06)",
            boxSizing: "border-box",
          }}
        >
          {/* Greeting */}
          <div style={{ fontSize: isMobile ? "17px" : "21px", fontWeight: 400, color: "#111", marginBottom: 4, lineHeight: 1.4 }}>
            Welcome, <span style={{ fontWeight: 700 }}>{first} {rest.join(" ")}</span>!
          </div>

          {/* Banner */}
          <div
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "#fdf5f5", border: "1px solid #fde0e0", borderRadius: "10px",
              padding: isMobile ? "12px" : "14px 16px", marginTop: 14, marginBottom: 24,
            }}
          >
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

          {/* Save error toast */}
          {saveError && (
            <div style={{ background: "#fff3f0", border: "1px solid #ffccbc", borderRadius: "8px", padding: "10px 14px", marginBottom: 16, fontSize: "12px", color: "#e53935" }}>
              ⚠ {saveError}
            </div>
          )}

          {/* Assigned Deliverables */}
          <SectionLabel label="Assigned Deliverables" />
          {isMobile
            ? renderMobileSection(assignedEntries, true)
            : renderDesktopSection(assignedEntries, true, true)}

          <div style={{ borderTop: "1px solid #ebebeb", margin: "20px 0" }} />

          {/* Quick Access */}
          <SectionLabel
            label="Quick Access"
            sub={
              <span style={{ fontSize: "10px", color: "#e53935", opacity: 0.8, display: "flex", alignItems: "center", gap: 3 }}>
                <PinIcon /> pinned
              </span>
            }
          />
          {isMobile
            ? renderMobileSection(quickEntries, false)
            : renderDesktopSection(quickEntries, false, false)}

          <div style={{ borderTop: "1px solid #ebebeb", margin: "20px 0" }} />

          {/* Nav */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <NavButton
              icon={<WorklogIcon />}
              label="Detailed Worklog"
              href="/new/hour/hournormal"
            />
          </div>
        </div>
      </div>
    </>
  );
}