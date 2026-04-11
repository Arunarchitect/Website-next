"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchDashboard,
  fetchActiveWorkLog,
  startWorkLog,
  endWorkLog,
  discardWorkLog,
  updateWorkLogEndTime,
  updateWorkLogRemarks,
  submitAssignment,
  type DashboardAssignment,
  type DashboardQuickAccess,
  type DashboardData,
} from "@/app/new/api";
import { useGetMyMembershipsQuery } from "@/redux/features/membershipApiSlice";

async function checkIsUser(): Promise<boolean> {
  const token = localStorage.getItem("access");
  return !!token;
}

function fmt24(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function fmtTimeInput(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fmtDateInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateTimeInputs(dateVal: string, timeVal: string): Date | null {
  if (!dateVal || !timeVal) return null;
  const [yyyy, mo, dd] = dateVal.split("-").map(Number);
  const [hh, min] = timeVal.split(":").map(Number);
  if ([yyyy, mo, dd, hh, min].some((n) => isNaN(n))) return null;
  const d = new Date(yyyy, mo - 1, dd, hh, min, 0, 0);
  return isNaN(d.getTime()) ? null : d;
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
    const handleResize = () => setW(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return w;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:   { bg: "#F5F5F5", text: "#888",    dot: "#CCC",    label: "Pending"   },
  submitted: { bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B", label: "Submitted" },
  approved:  { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E", label: "Approved"  },
  rejected:  { bg: "#FFF1F2", text: "#BE123C", dot: "#F43F5E", label: "Rejected"  },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 99,
        background: cfg.bg,
        color: cfg.text,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ── Timer entry type ──────────────────────────────────────────────────────────

interface TimerEntry {
  id: string;
  deliverableId: number;
  assignmentId?: number;
  assignmentName?: string;
  assignmentStatus?: string;
  rejectionReason?: string | null;
  rejectionCount?: number;
  orgName: string;
  projectName: string;
  deliverableName: string;
  dueDate?: string;
  elapsed: number;
  sessionStart: Date | null;
  sessionEnd: Date | null;
  endDateInput: string;
  endTimeInput: string;
  endError: string;
  remarks: string;
  remarksSaved: boolean;
  isQuick?: boolean;
}

function makeEntryFromAssignment(a: DashboardAssignment): TimerEntry {
  return {
    id: `a-${a.id}`,
    deliverableId: a.deliverable_id,
    assignmentId: a.id,
    assignmentName: a.name,
    assignmentStatus: a.status,
    rejectionReason: a.rejection_reason,
    rejectionCount: a.rejection_count,
    orgName: a.org_name,
    projectName: a.project_name,
    deliverableName: a.deliverable_name,
    dueDate: a.due_date ?? undefined,
    elapsed: 0,
    sessionStart: null,
    sessionEnd: null,
    endDateInput: "",
    endTimeInput: "",
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
    endDateInput: "",
    endTimeInput: "",
    endError: "",
    remarks: "",
    remarksSaved: false,
    isQuick: true,
  };
}

// ── Live worker type ──────────────────────────────────────────────────────────

interface LiveWorker {
  user_id: number;
  user_name: string;
  org_name: string;
  org_id: number;
  role: string;
  is_active: boolean;
  current: {
    worklog_id: number;
    deliverable_id: number;
    deliverable_name: string;
    project_id: number;
    project_name: string;
    org_name: string;
    start_time: string;
    end_time: string | null;
    elapsed_seconds: number | null;
    remarks: string;
  } | null;
  last: {
    worklog_id: number;
    deliverable_name: string;
    project_name: string;
    org_name: string;
    start_time: string;
    end_time: string | null;
    elapsed_seconds: null;
    remarks: string;
  } | null;
}

// ── Live Bar component ────────────────────────────────────────────────────────
// Shows active workers inline at top; inactive workers collapsed behind a toggle

function LiveBar() {
  const [workers, setWorkers] = useState<LiveWorker[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [liveTick, setLiveTick] = useState(0);

  useEffect(() => {
    const load = () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("access") ?? "" : "";
      const base = process.env.NEXT_PUBLIC_HOST ?? "";
      fetch(`${base}/api/v2/manager/worklogs/live/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: LiveWorker[]) => setWorkers(data))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // Tick every second to update elapsed displays
  useEffect(() => {
    const id = setInterval(() => setLiveTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const active   = workers.filter((w) => w.is_active);
  const inactive = workers.filter((w) => !w.is_active);

  if (workers.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ── Active workers — always visible ── */}
      {active.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: inactive.length > 0 ? 10 : 0 }}>
          {active.map((w) => {
            const baseElapsed = w.current?.elapsed_seconds ?? 0;
            const elapsed = baseElapsed + liveTick;
            return (
              <div
                key={w.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 13px",
                  borderRadius: 9,
                  background: "#FFF9F9",
                  border: "1px solid #FFD6D6",
                  flexShrink: 0,
                }}
              >
                {/* Green pulse dot */}
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22C55E",
                    flexShrink: 0,
                    boxShadow: "0 0 0 2.5px #BBF7D0",
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                  {w.user_name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#999",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {w.current?.deliverable_name} · {w.current?.project_name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: "#E53935",
                    marginLeft: 2,
                    flexShrink: 0,
                  }}
                >
                  {formatElapsed(elapsed)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Inactive workers — collapsed by default ── */}
      {inactive.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              fontSize: 11,
              color: "#BBBBBB",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 0",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
              userSelect: "none",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 0.15s",
                transform: expanded ? "rotate(90deg)" : "none",
                fontSize: 9,
              }}
            >
              ▶
            </span>
            {inactive.length} team member{inactive.length !== 1 ? "s" : ""} not currently working
          </button>

          {expanded && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {inactive.map((w) => (
                <div
                  key={w.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "5px 11px",
                    borderRadius: 8,
                    background: "#F7F7F7",
                    border: "1px solid #EEEEEE",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#D1D5DB",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>
                    {w.user_name}
                  </span>
                  {w.last && (
                    <span style={{ fontSize: 11, color: "#BBBBBB" }}>
                      last: {w.last.deliverable_name} · {w.last.project_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onDiscard,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "28px 28px 22px",
          maxWidth: 360,
          width: "90%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          fontFamily: "inherit",
        }}
      >
        <div style={{ fontSize: 14, color: "#222", lineHeight: 1.65, marginBottom: 22 }}>
          {message}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel}  style={ghostBtn}>Cancel</button>
          <button onClick={onDiscard} style={outlineBtn("#F43F5E")}>Discard</button>
          <button onClick={onConfirm} style={solidBtn("#1a1a1a")}>Record & Continue</button>
        </div>
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #E5E5E5",
  background: "#FAFAFA",
  color: "#555",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

function outlineBtn(color: string): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function solidBtn(bg: string): React.CSSProperties {
  return {
    padding: "8px 18px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

const TickIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <polyline
      points="1,6 4.5,9.5 11,2.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PinIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
    <path
      d="M8.5 1.5L10.5 3.5L7 5.5V9L5 11V7L1.5 5L3.5 3Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

const SubmitIcon = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path
      d="M2 7h10M8 3l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
    <line x1="7" y1="4" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="7" cy="9.5" r="0.7" fill="currentColor" />
  </svg>
);

function ModelflickMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#E53935" opacity="0.9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#E53935" opacity="0.4" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#E53935" opacity="0.4" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#E53935" opacity="0.9" />
    </svg>
  );
}

// ── Nav button ────────────────────────────────────────────────────────────────

function NavButton({ label, href }: { label: string; href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "11px 10px",
        borderRadius: 9,
        background: hovered ? "#F5F5F5" : "#FAFAFA",
        border: `1px solid ${hovered ? "#D5D5D5" : "#E8E8E8"}`,
        color: "#333",
        fontSize: 12,
        fontWeight: 600,
        textDecoration: "none",
        transition: "all 0.12s",
        textAlign: "center",
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </a>
  );
}

// ── Running controls ──────────────────────────────────────────────────────────

interface RunningControlsProps {
  entry: TimerEntry;
  nearEnd: boolean;
  onEndDateChange: (id: string, v: string) => void;
  onEndTimeChange: (id: string, v: string) => void;
  onRemarksChange: (id: string, v: string) => void;
  onRemarksSave:   (id: string) => void;
}

function RunningControls({
  entry,
  nearEnd,
  onEndDateChange,
  onEndTimeChange,
  onRemarksChange,
  onRemarksSave,
}: RunningControlsProps) {
  const accent     = nearEnd ? "#C2410C" : "#E53935";
  const bg         = nearEnd ? "#FFF7ED" : "#FFF5F5";
  const borderTop  = nearEnd ? "#FED7AA" : "#FFE4E4";
  const inputBdr   = entry.endError ? "#F43F5E" : nearEnd ? "#FB923C" : "#FFBBBB";
  const inputBg    = entry.endError ? "#FFF1F2" : bg;
  const inputColor = entry.endError ? "#BE123C" : accent;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px 10px",
        borderTop: `1px solid ${borderTop}`,
        background: bg,
      }}
    >
      {/* Start */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>Start</span>
        <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: accent, fontWeight: 600 }}>
          {entry.sessionStart ? fmt24(entry.sessionStart) : "—"}
        </span>
      </div>

      <div style={{ width: 1, height: 14, background: "#E0E0E0", flexShrink: 0 }} />

      {/* End date + time */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>End</span>
        <input
          type="date"
          value={entry.endDateInput}
          onChange={(e) => onEndDateChange(entry.id, e.target.value)}
          style={{
            fontSize: 12,
            border: `1px solid ${inputBdr}`,
            borderRadius: 5,
            padding: "2px 6px",
            background: inputBg,
            color: inputColor,
            fontWeight: 600,
            outline: "none",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        />
        <input
          type="time"
          value={entry.endTimeInput}
          onChange={(e) => onEndTimeChange(entry.id, e.target.value)}
          style={{
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            border: `1px solid ${inputBdr}`,
            borderRadius: 5,
            padding: "2px 6px",
            background: inputBg,
            color: inputColor,
            fontWeight: 600,
            outline: "none",
            textAlign: "center",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Remarks */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <input
          type="text"
          value={entry.remarks}
          onChange={(e) => onRemarksChange(entry.id, e.target.value)}
          placeholder="Add a note…"
          style={{
            fontSize: 12,
            border: "1px solid #E5E5E5",
            borderRadius: 6,
            padding: "4px 8px",
            background: "#fff",
            color: "#333",
            outline: "none",
            width: 150,
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={() => onRemarksSave(entry.id)}
          title="Save note"
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            flexShrink: 0,
            border: `1px solid ${entry.remarksSaved ? "#22C55E" : "#E0E0E0"}`,
            background: entry.remarksSaved ? "#F0FDF4" : "#fff",
            color: entry.remarksSaved ? "#15803D" : "#AAAAAA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s",
            padding: 0,
          }}
        >
          <TickIcon />
        </button>
      </div>
    </div>
  );
}

// ── Assignment card ───────────────────────────────────────────────────────────

interface AssignmentCardProps {
  entry: TimerEntry;
  isRunning: boolean;
  liveSeconds: number;
  onPlay:           (id: string) => void;
  onStop:           (id: string) => void;
  onEndDateChange:  (id: string, v: string) => void;
  onEndTimeChange:  (id: string, v: string) => void;
  onRemarksChange:  (id: string, v: string) => void;
  onRemarksSave:    (id: string) => void;
  onSubmit?:        (assignmentId: number) => void;
  onResubmit?:      (assignmentId: number) => void;
}

function AssignmentCard({
  entry,
  isRunning,
  liveSeconds,
  onPlay,
  onStop,
  onEndDateChange,
  onEndTimeChange,
  onRemarksChange,
  onRemarksSave,
  onSubmit,
  onResubmit,
}: AssignmentCardProps) {
  const nearEnd      = isRunning && entry.sessionEnd != null && entry.sessionEnd.getTime() - Date.now() < 5 * 60 * 1000;
  const isRejected   = entry.assignmentStatus === "rejected";
  const isPending    = entry.assignmentStatus === "pending";
  const isSubmitted  = entry.assignmentStatus === "submitted";
  const timerDisabled = isSubmitted && !isRunning;
  const canSubmit    = entry.assignmentId != null && (isPending || isRejected) && !isRunning;
  const canResubmit  = entry.assignmentId != null && isRejected && !isRunning;

  const borderColor = isRunning
    ? nearEnd ? "#FB923C" : "#E53935"
    : isRejected  ? "#FCA5A5"
    : isSubmitted ? "#FDE68A"
    : "#E8E8E8";

  const cardBg = isRunning
    ? nearEnd ? "#FFFAF5" : "#FFF9F9"
    : isRejected  ? "#FFF9F9"
    : isSubmitted ? "#FFFDF0"
    : "#FAFAFA";

  return (
    <div
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${borderColor}`,
        background: cardBg,
        transition: "border-color 0.2s, background 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        {/* Timer button */}
        <button
          onClick={() => {
            if (timerDisabled) return;
            if (isRunning) onStop(entry.id);
            else onPlay(entry.id);
          }}
          title={
            timerDisabled
              ? "Cannot record — assignment is submitted"
              : isRunning ? "Stop timer" : "Start timer"
          }
          disabled={timerDisabled}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            border: `2px solid ${timerDisabled ? "#DDD" : isRunning ? "#E53935" : "#AAAAAA"}`,
            background: timerDisabled ? "#F5F5F5" : isRunning ? "#E53935" : "transparent",
            color: timerDisabled ? "#CCC" : isRunning ? "#fff" : "#666",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: timerDisabled ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            padding: 0,
          }}
        >
          {isRunning ? <StopIcon /> : <PlayIcon />}
        </button>

        {/* Elapsed */}
        <div
          style={{
            width: 68,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
            color: isRunning ? "#E53935" : "#BBBBBB",
            letterSpacing: "0.03em",
          }}
        >
          {formatElapsed(liveSeconds)}
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.assignmentName ?? entry.deliverableName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#999",
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.orgName} · {entry.projectName}
            {entry.dueDate ? ` · Due ${entry.dueDate}` : ""}
          </div>
          {timerDisabled && (
            <div style={{ fontSize: 10, color: "#B45309", marginTop: 2, fontWeight: 600 }}>
              Recording disabled — awaiting review
            </div>
          )}
        </div>

        {/* Status */}
        {entry.assignmentStatus && <StatusPill status={entry.assignmentStatus} />}

        {/* Submit / Re-submit */}
        {(canSubmit || canResubmit) && (
          <button
            onClick={() => {
              if (canResubmit) onResubmit?.(entry.assignmentId!);
              else onSubmit?.(entry.assignmentId!);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 7,
              flexShrink: 0,
              background: canResubmit ? "#FFFBEB" : "#F0F9FF",
              border: `1px solid ${canResubmit ? "#F59E0B" : "#38BDF8"}`,
              color: canResubmit ? "#B45309" : "#0369A1",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <SubmitIcon />
            {canResubmit ? "Re-submit" : "Submit"}
          </button>
        )}
      </div>

      {/* Running controls */}
      {isRunning && (
        <RunningControls
          entry={entry}
          nearEnd={nearEnd}
          onEndDateChange={onEndDateChange}
          onEndTimeChange={onEndTimeChange}
          onRemarksChange={onRemarksChange}
          onRemarksSave={onRemarksSave}
        />
      )}

      {/* End error */}
      {entry.endError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "#FFF1F2",
            borderTop: "1px solid #FCA5A5",
            fontSize: 11,
            color: "#BE123C",
          }}
        >
          <AlertIcon /> {entry.endError}
        </div>
      )}

      {/* Rejection reason */}
      {isRejected && entry.rejectionReason && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "8px 12px",
            borderTop: "1px solid #FCA5A5",
            background: "#FFF1F2",
          }}
        >
          <div style={{ marginTop: 1, color: "#F43F5E", flexShrink: 0 }}>
            <AlertIcon />
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#BE123C" }}>
              Rejected{(entry.rejectionCount ?? 0) > 1 ? ` (×${entry.rejectionCount})` : ""}:
            </span>{" "}
            <span style={{ fontSize: 11, color: "#9F1239" }}>{entry.rejectionReason}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick row ─────────────────────────────────────────────────────────────────

function QuickRow({
  entry,
  isRunning,
  liveSeconds,
  onPlay,
  onStop,
  onEndDateChange,
  onEndTimeChange,
  onRemarksChange,
  onRemarksSave,
}: AssignmentCardProps) {
  const nearEnd = isRunning && entry.sessionEnd != null && entry.sessionEnd.getTime() - Date.now() < 5 * 60 * 1000;

  return (
    <div
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${isRunning ? (nearEnd ? "#FB923C" : "#FFBBBB") : "#E8E8E8"}`,
        background: isRunning ? (nearEnd ? "#FFFAF5" : "#FFF9F9") : "#FAFAFA",
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <button
          onClick={() => (isRunning ? onStop(entry.id) : onPlay(entry.id))}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            border: `2px solid ${isRunning ? "#E53935" : "#AAAAAA"}`,
            background: isRunning ? "#E53935" : "transparent",
            color: isRunning ? "#fff" : "#666",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.15s",
            padding: 0,
          }}
        >
          {isRunning ? <StopIcon /> : <PlayIcon />}
        </button>

        <div
          style={{
            width: 68,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            fontSize: 13,
            fontWeight: 700,
            textAlign: "center",
            color: isRunning ? "#E53935" : "#BBBBBB",
          }}
        >
          {formatElapsed(liveSeconds)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#111",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.deliverableName}
          </div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            {entry.orgName} · {entry.projectName}
          </div>
        </div>
      </div>

      {isRunning && (
        <RunningControls
          entry={entry}
          nearEnd={nearEnd}
          onEndDateChange={onEndDateChange}
          onEndTimeChange={onEndTimeChange}
          onRemarksChange={onRemarksChange}
          onRemarksSave={onRemarksSave}
        />
      )}

      {entry.endError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "#FFF1F2",
            borderTop: "1px solid #FCA5A5",
            fontSize: 11,
            color: "#BE123C",
          }}
        >
          <AlertIcon /> {entry.endError}
        </div>
      )}
    </div>
  );
}

// ── Approved card ─────────────────────────────────────────────────────────────

function ApprovedCard({ assignment }: { assignment: DashboardAssignment }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: "#F0FDF4",
        border: "1px solid #BBF7D0",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          background: "#DCFCE7",
          border: "1.5px solid #22C55E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polyline
            points="1,6 4.5,9.5 11,2.5"
            stroke="#15803D"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#14532D",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {assignment.name}
        </div>
        <div style={{ fontSize: 11, color: "#4ADE80", marginTop: 2 }}>
          {assignment.org_name} · {assignment.project_name} · {assignment.deliverable_name}
        </div>
      </div>
      {assignment.due_date && (
        <span style={{ fontSize: 11, color: "#6EE7B7", flexShrink: 0 }}>Due {assignment.due_date}</span>
      )}
      {assignment.reviewed_by_name && (
        <span style={{ fontSize: 11, color: "#15803D", fontWeight: 600, flexShrink: 0 }}>
          ✓ {assignment.reviewed_by_name}
        </span>
      )}
      <StatusPill status="approved" />
    </div>
  );
}

// ── Misc UI ───────────────────────────────────────────────────────────────────

function SectionHeader({ label, count, accent }: { label: string; count?: number; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#999",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 99,
            background: accent ? `${accent}18` : "#F3F4F6",
            color: accent ?? "#999",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #EFEFEF", margin: "24px 0" }} />;
}

function FullScreenMessage({ message, color = "#999" }: { message: string; color?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        color,
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashAdminPage() {
  const isMobile = useWindowWidth() < 640;
  const router   = useRouter();

  const [authChecked, setAuthChecked] = useState(false);

  const {
    data: memberships = [],
    isLoading: isMembershipLoading,
    isFetching: isMembershipFetching,
  } = useGetMyMembershipsQuery();

  useEffect(() => {
    if (isMembershipLoading || isMembershipFetching) return;
    const isAdmin = memberships.some((m) => m.role === "admin");
    if (!isAdmin) router.replace("/new/dash/dashnormal");
  }, [memberships, isMembershipLoading, isMembershipFetching, router]);

  const isAdmin = memberships.some((m) => m.role === "admin");

  useEffect(() => {
    checkIsUser().then((ok) => {
      if (!ok) router.replace("/login");
      else setAuthChecked(true);
    });
  }, [router]);

  const [dashboard, setDashboard]   = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!authChecked) return;
    fetchDashboard()
      .then(setDashboard)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authChecked]);

  const [entries, setEntries]       = useState<Record<string, TimerEntry>>({});
  const [runningId, setRunningId]   = useState<string | null>(null);
  const startRef                    = useRef<number | null>(null);
  const worklogIdRef                = useRef<number | null>(null);
  const endDebounceRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tick, setTick]             = useState(0);
  const [pending, setPending]       = useState<{ action: "stop" | "switch"; nextId?: string } | null>(null);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [approvedAssignments, setApprovedAssignments] = useState<DashboardAssignment[]>([]);

  // Keep a stable ref to entries so async callbacks can read latest value
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // Keep a stable ref to runningId for the timeout callback
  const runningIdRef = useRef(runningId);
  useEffect(() => { runningIdRef.current = runningId; }, [runningId]);

  useEffect(() => {
    if (!dashboard) return;
    const active  = dashboard.assignments.filter((a) => a.status !== "approved");
    const approved = dashboard.assignments.filter((a) => a.status === "approved");
    const list: TimerEntry[] = [
      ...active.map(makeEntryFromAssignment),
      ...dashboard.quick_access.map(makeEntryFromQuickAccess),
    ];
    setEntries(Object.fromEntries(list.map((e) => [e.id, e])));
    setApprovedAssignments(approved);
  }, [dashboard]);

  // Restore active worklog on load
  useEffect(() => {
    if (!dashboard) return;
    fetchActiveWorkLog()
      .then((active) => {
        if (!active || active.finalised) return;
        const sessionStart = new Date(active.start_time);
        const sessionEnd   = new Date(active.end_time);
        const now          = Date.now();
        if (sessionEnd.getTime() <= now) return;
        const matchA  = dashboard.assignments.find(
          (a) => a.deliverable_id === active.deliverable_id && a.status !== "approved"
        );
        const matchQ  = dashboard.quick_access.find((q) => q.deliverable_id === active.deliverable_id);
        const entryId = matchA ? `a-${matchA.id}` : matchQ ? `q-${matchQ.id}` : null;
        if (!entryId) return;
        const elapsed = Math.floor((now - sessionStart.getTime()) / 1000);
        worklogIdRef.current = active.id;
        startRef.current     = sessionStart.getTime();
        setTick(elapsed);
        setRunningId(entryId);
        setEntries((prev) => ({
          ...prev,
          [entryId]: {
            ...prev[entryId],
            sessionStart,
            sessionEnd,
            endDateInput: fmtDateInput(sessionEnd),
            endTimeInput: fmtTimeInput(sessionEnd),
            endError: "",
            remarks: active.remarks,
            remarksSaved: false,
          },
        }));
      })
      .catch(() => {});
  }, [dashboard]);

  // Tick every second while running
  useEffect(() => {
    if (!runningId) return;
    const interval = setInterval(
      () => setTick(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, [runningId]);

  // ── Auto-finalise when sessionEnd is reached ─────────────────────────────
  // FIX: call endWorkLog so finalised=True is saved to backend on timer expiry
  useEffect(() => {
    if (!runningId) return;
    const end = entries[runningId]?.sessionEnd;
    if (!end) return;
    const rem = end.getTime() - Date.now();

    const finaliseAndClear = async () => {
      const wlId        = worklogIdRef.current;
      const currentId   = runningIdRef.current;
      const currentEntry = entriesRef.current[currentId ?? ""];

      // Persist finalised=True to backend
      if (wlId) {
        try {
          await endWorkLog(wlId, currentEntry?.remarks ?? "");
        } catch {
          // best-effort — timer expired so we still clear UI
        }
      }

      worklogIdRef.current = null;
      startRef.current     = null;
      setTick(0);
      setRunningId(null);

      if (currentId) {
        setEntries((prev) => {
          const cur = prev[currentId];
          if (!cur) return prev;
          return {
            ...prev,
            [currentId]: {
              ...cur,
              sessionStart:  null,
              sessionEnd:    null,
              endDateInput:  "",
              endTimeInput:  "",
              endError:      "",
              remarks:       "",
              remarksSaved:  false,
            },
          };
        });
      }
    };

    if (rem <= 0) { finaliseAndClear(); return; }
    const timeout = setTimeout(finaliseAndClear, rem);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningId, entries[runningId ?? ""]?.sessionEnd?.getTime()]);

  // Debounced end-time update
  const scheduleEndUpdate = useCallback(
    (id: string, dateVal: string, timeVal: string) => {
      const parsed = parseDateTimeInputs(dateVal, timeVal);
      if (!parsed) return;
      const now = new Date();
      if (parsed <= now) {
        setEntries((prev) => ({
          ...prev,
          [id]: { ...prev[id], endError: "End date/time must be in the future." },
        }));
        return;
      }
      setEntries((prev) => ({
        ...prev,
        [id]: { ...prev[id], endError: "", sessionEnd: parsed },
      }));
      if (endDebounceRef.current) clearTimeout(endDebounceRef.current);
      endDebounceRef.current = setTimeout(async () => {
        if (!worklogIdRef.current) return;
        try {
          await updateWorkLogEndTime(worklogIdRef.current, parsed);
        } catch (e: unknown) {
          setEntries((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              endError: e instanceof Error ? e.message : "Error updating end time",
            },
          }));
        }
      }, 1500);
    },
    []
  );

  const handleEndDateChange = useCallback(
    (id: string, v: string) => {
      setEntries((prev) => {
        const cur     = prev[id];
        const updated = { ...cur, endDateInput: v };
        scheduleEndUpdate(id, v, cur.endTimeInput);
        return { ...prev, [id]: updated };
      });
    },
    [scheduleEndUpdate]
  );

  const handleEndTimeChange = useCallback(
    (id: string, v: string) => {
      setEntries((prev) => {
        const cur     = prev[id];
        const updated = { ...cur, endTimeInput: v };
        scheduleEndUpdate(id, cur.endDateInput, v);
        return { ...prev, [id]: updated };
      });
    },
    [scheduleEndUpdate]
  );

  const handleRemarksChange = useCallback((id: string, v: string) => {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], remarks: v, remarksSaved: false } }));
  }, []);

  const handleRemarksSave = useCallback(
    async (id: string) => {
      if (!worklogIdRef.current) return;
      const entry = entriesRef.current[id];
      try {
        await updateWorkLogRemarks(worklogIdRef.current, entry.remarks ?? "");
        setEntries((prev) => ({ ...prev, [id]: { ...prev[id], remarksSaved: true } }));
      } catch (e: unknown) {
        setSaveError(`Failed to save note: ${e instanceof Error ? e.message : "unknown"}`);
      }
    },
    []
  );

  const commitStart = useCallback(async (id: string) => {
    const entry = entriesRef.current[id];
    if (!entry) return;
    try {
      const result       = await startWorkLog(entry.deliverableId);
      const sessionStart = new Date(result.start_time);
      const sessionEnd   = new Date(result.end_time);
      worklogIdRef.current = result.id;
      startRef.current     = sessionStart.getTime();
      setTick(0);
      setRunningId(id);
      setEntries((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          sessionStart,
          sessionEnd,
          endDateInput: fmtDateInput(sessionEnd),
          endTimeInput: fmtTimeInput(sessionEnd),
          endError:     "",
          remarks:      "",
          remarksSaved: false,
        },
      }));
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to start");
    }
  }, []);

  // FIX: commitStop calls endWorkLog which sets finalised=True on backend
  const commitStop = useCallback(async (id: string) => {
    if (!worklogIdRef.current) return;
    const entry = entriesRef.current[id];
    try {
      await endWorkLog(worklogIdRef.current, entry.remarks ?? "");
      setSaveError(null);
    } catch (e: unknown) {
      setSaveError(`Failed to save: ${e instanceof Error ? e.message : "unknown"}`);
    }
    worklogIdRef.current = null;
    setEntries((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        elapsed:      0,
        sessionStart: null,
        sessionEnd:   null,
        endDateInput: "",
        endTimeInput: "",
        endError:     "",
        remarks:      "",
        remarksSaved: false,
      },
    }));
    startRef.current = null;
    setTick(0);
    setRunningId(null);
  }, []);

  const discardCurrent = useCallback(async () => {
    const currentId = runningIdRef.current;
    if (!currentId) return;
    if (worklogIdRef.current) {
      try {
        await discardWorkLog(worklogIdRef.current);
      } catch (e: unknown) {
        setSaveError(`Failed to discard: ${e instanceof Error ? e.message : "unknown"}`);
      }
      worklogIdRef.current = null;
    }
    setEntries((prev) => ({
      ...prev,
      [currentId]: {
        ...prev[currentId],
        sessionStart: null,
        sessionEnd:   null,
        endDateInput: "",
        endTimeInput: "",
        endError:     "",
        remarks:      "",
        remarksSaved: false,
      },
    }));
    startRef.current = null;
    setTick(0);
    setRunningId(null);
  }, []);

  // FIX: handlePlay uses runningId from state correctly
  const handlePlay = useCallback(
    (id: string) => {
      if (!runningId) {
        commitStart(id);
        return;
      }
      if (runningId === id) return; // already running this one
      setPending({ action: "switch", nextId: id });
    },
    [runningId, commitStart]
  );

  // FIX: handleStop now accepts the id and guards against wrong id
  const handleStop = useCallback(
    (id: string) => {
      if (id !== runningId) return;
      setPending({ action: "stop" });
    },
    [runningId]
  );

  const handleSubmit = useCallback(async (assignmentId: number) => {
    try {
      const updated = await submitAssignment(assignmentId);
      const entryId = `a-${assignmentId}`;
      setEntries((prev) => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          assignmentStatus: updated.status,
          rejectionReason:  updated.rejection_reason,
        },
      }));
      setSaveError(null);
    } catch (e: unknown) {
      setSaveError(`Submit failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }, []);

  const handleResubmit = useCallback(async (assignmentId: number) => {
    try {
      const updated = await submitAssignment(assignmentId);
      const entryId = `a-${assignmentId}`;
      setEntries((prev) => ({
        ...prev,
        [entryId]: {
          ...prev[entryId],
          assignmentStatus: updated.status,
          rejectionReason:  updated.rejection_reason,
          rejectionCount:   updated.rejection_count,
        },
      }));
      setSaveError(null);
    } catch (e: unknown) {
      setSaveError(`Re-submit failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }, []);

  const handleConfirm = async () => {
    if (!pending || !runningId) return;
    await commitStop(runningId);
    if (pending.action === "switch" && pending.nextId) await commitStart(pending.nextId);
    setPending(null);
  };

  const handleDiscard = async () => {
    if (!pending) return;
    const nextId = pending.action === "switch" ? pending.nextId : undefined;
    await discardCurrent();
    if (nextId) await commitStart(nextId);
    setPending(null);
  };

  const activeAssignmentIds = dashboard?.assignments.filter((a) => a.status !== "approved").map((a) => `a-${a.id}`) ?? [];
  const assignedEntries     = activeAssignmentIds.map((id) => entries[id]).filter(Boolean) as TimerEntry[];
  const quickEntries        = (dashboard?.quick_access ?? []).map((q) => entries[`q-${q.id}`]).filter(Boolean) as TimerEntry[];
  const liveSeconds         = (id: string) => (entries[id]?.elapsed ?? 0) + (runningId === id ? tick : 0);

  const userName = dashboard?.user.name ?? "";
  const [first, ...rest] = userName.split(" ");

  const sharedRowProps = {
    onPlay:          handlePlay,
    onStop:          handleStop,
    onEndDateChange: handleEndDateChange,
    onEndTimeChange: handleEndTimeChange,
    onRemarksChange: handleRemarksChange,
    onRemarksSave:   handleRemarksSave,
  };

  if (!authChecked || isMembershipLoading || isMembershipFetching) {
    return <FullScreenMessage message="Checking access…" />;
  }
  if (!isAdmin)  return null;
  if (loading)   return <FullScreenMessage message="Loading dashboard…" />;
  if (error)     return <FullScreenMessage message={error} color="#E53935" />;

  return (
    <>
      {pending && (
        <ConfirmDialog
          message={
            pending.action === "stop"
              ? "Save this work session?"
              : "You have a session running — save it before switching?"
          }
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          onCancel={() => setPending(null)}
        />
      )}

      <div
        style={{
          minHeight: "100vh",
          background: "#F7F7F7",
          fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: isMobile ? "16px 8px" : "48px 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #E8E8E8",
            borderRadius: isMobile ? 14 : 18,
            padding: isMobile ? "20px 14px" : "38px 42px",
            width: "100%",
            maxWidth: 1200,
            boxShadow: "0 2px 24px rgba(0,0,0,0.05)",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 300, color: "#111", lineHeight: 1.3 }}>
                Welcome back, <span style={{ fontWeight: 700 }}>{first}</span>
                {rest.length > 0 && <span style={{ fontWeight: 300 }}> {rest.join(" ")}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#AAAAAA", marginTop: 3 }}>
                {new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#FFF5F5",
                border: "1px solid #FFD6D6",
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              <ModelflickMark />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#E53935",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                }}
              >
                Modelflick
              </span>
            </div>
          </div>

          {/* ── Live bar: active workers shown, inactive collapsed ── */}
          <LiveBar />

          {/* Save error */}
          {saveError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: "#FFF1F2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 18,
                fontSize: 12,
                color: "#BE123C",
              }}
            >
              <AlertIcon /> {saveError}
            </div>
          )}

          {/* Two-column layout */}
          <div style={{ display: "flex", gap: 24, flexDirection: isMobile ? "column" : "row" }}>
            {/* Left column */}
            <div style={{ flex: 2, minWidth: 0 }}>
              {/* Assignments */}
              <SectionHeader label="My Assignments" count={assignedEntries.length} accent="#6366F1" />
              {assignedEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: "#CCC", padding: "12px 0" }}>No assignments yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {assignedEntries.map((e) => (
                    <AssignmentCard
                      key={e.id}
                      entry={e}
                      isRunning={runningId === e.id}
                      liveSeconds={liveSeconds(e.id)}
                      onSubmit={handleSubmit}
                      onResubmit={handleResubmit}
                      {...sharedRowProps}
                    />
                  ))}
                </div>
              )}

              <Divider />

              {/* Quick access */}
              <SectionHeader label="Quick Access" count={quickEntries.length} accent="#E53935" />
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, marginTop: -6 }}>
                <span style={{ color: "#E53935", opacity: 0.7 }}>
                  <PinIcon />
                </span>
                <span style={{ fontSize: 11, color: "#BBBBBB" }}>Pinned deliverables</span>
              </div>
              {quickEntries.length === 0 ? (
                <div style={{ fontSize: 13, color: "#CCC", padding: "12px 0" }}>No pinned deliverables.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {quickEntries.map((e) => (
                    <QuickRow
                      key={e.id}
                      entry={e}
                      isRunning={runningId === e.id}
                      liveSeconds={liveSeconds(e.id)}
                      {...sharedRowProps}
                    />
                  ))}
                </div>
              )}

              {/* Approved */}
              {approvedAssignments.length > 0 && (
                <>
                  <Divider />
                  <SectionHeader label="Approved Assignments" count={approvedAssignments.length} accent="#22C55E" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {approvedAssignments.map((a) => (
                      <ApprovedCard key={a.id} assignment={a} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right column */}
            <div style={{ flex: 1, minWidth: 0 }} />
          </div>

          <Divider />

          {/* Navigation */}
          <SectionHeader label="Navigate" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: 7,
            }}
          >
            <NavButton label="My Worklogs"       href="/new/hour/hournormal"  />
            <NavButton label="Worklog Overview"   href="/new/hour/houradmin"   />
            <NavButton label="Company Finance"    href="/new/stat/numbers"     />
            <NavButton label="Finance Pie"        href="/new/stat/pie"         />
            <NavButton label="Add Expense"        href="/new/exp/expnormal"    />
            <NavButton label="Expenses"           href="/new/exp/expadmin"     />
            <NavButton label="Salary Calc"        href="/new/pay"              />
            <NavButton label="Add Revenue"        href="/new/revenue"          />
            <NavButton label="Project Info"       href="/new/projectdash"      />
            <NavButton label="Leaves"             href="/new/leave"            />
          </div>
        </div>
      </div>
    </>
  );
}