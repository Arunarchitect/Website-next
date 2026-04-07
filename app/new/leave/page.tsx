/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGetMyMembershipsQuery } from "@/redux/features/membershipApiSlice";

import {
  fetchMe,
  fetchMyLeaveRequests,
  fetchAdminLeaveRequests,
  fetchOrgMembers,
  fetchPublicHolidays,
  fetchLeaveMeta,
  fetchLeaveBalance,
  submitLeaveRequest,
  cancelLeaveRequest,
  actionLeaveRequest,
  addPublicHoliday,
  deletePublicHoliday,
  type LeaveRequest,
  type LeavePolicy,
  type LeaveBalance,
  type OrgMember,
  type MeData,
  type PublicHoliday,
} from "./api/leaveApi";

import {
  MONTHS,
  DAYS,
  LEAVE_COLORS,
  toYMD,
  getDaysInMonth,
  fmtDate,
  fmtDateDisplay,
  getUserDisplayName,
  getInitials,
  getAvatarBg,
  getAvatarFg,
  buildLeaveMap,
} from "./utils/leaveUtils";

// ── Icons ─────────────────────────────────────────────────────────────────────

const ChevLeft = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <polyline points="1.5,6.5 5,10 11.5,2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
    <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="7" cy="9.5" r="0.65" fill="currentColor" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2 7h12" stroke="currentColor" strokeWidth="1.1" />
    <path d="M5 2v2M11 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M11 3.5a2 2 0 0 1 0 3M13.5 12c0-1.5-1-2.8-2.5-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M1.5 5.5h11" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M2 4h10M5 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4M11 4v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 7v3M8.5 7v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// ── Shared Components ─────────────────────────────────────────────────────────

function StatusPill({ status, label }: { status: string; label?: string }) {
  const cfg = LEAVE_COLORS[status] ?? LEAVE_COLORS.cancelled;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 99,
        background: cfg.bg,
        color: cfg.text,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {label ?? status.replace("_", " ")}
    </span>
  );
}

function Toast({ toast }: { toast: { msg: string; type: "ok" | "err" } }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: toast.type === "ok" ? "#EAF3DE" : "#FCEBEB",
        border: `1px solid ${toast.type === "ok" ? "#97C459" : "#F09595"}`,
        color: toast.type === "ok" ? "#27500A" : "#791F1F",
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 13,
        fontWeight: 500,
        zIndex: 999,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      }}
    >
      {toast.msg}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "#FCEBEB",
        border: "1px solid #F09595",
        borderRadius: 7,
        padding: "8px 12px",
        fontSize: 12,
        color: "#791F1F",
      }}
    >
      <AlertIcon /> {msg}
    </div>
  );
}

// ── Date Leave Details Modal ──────────────────────────────────────────────────

interface DateLeaveDetailsModalProps {
  date: string;
  leaves: LeaveRequest[];
  onClose: () => void;
  onViewUser?: (user: OrgMember) => void;
  isAdmin: boolean;
}

function DateLeaveDetailsModal({
  date,
  leaves,
  onClose,
  onViewUser,
  isAdmin,
}: DateLeaveDetailsModalProps) {
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredLeaves =
    selectedType === "all"
      ? leaves
      : leaves.filter((l) => l.status === selectedType);

  const statusCounts = leaves.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 500,
          maxHeight: "80vh",
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#111" }}>
              {fmtDateDisplay(date)}
            </h3>
            <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
              {leaves.length} leave request(s)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedType("all")}
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              background: selectedType === "all" ? "#1a1a1a" : "#F0F0F0",
              color: selectedType === "all" ? "#fff" : "#666",
              border: "none",
              cursor: "pointer",
            }}
          >
            All ({leaves.length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setSelectedType(status)}
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                background:
                  selectedType === status
                    ? LEAVE_COLORS[status]?.bg ?? "#F0F0F0"
                    : "#F0F0F0",
                color:
                  selectedType === status
                    ? LEAVE_COLORS[status]?.text ?? "#666"
                    : "#666",
                border: "none",
                cursor: "pointer",
              }}
            >
              {status} ({count})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredLeaves.map((leave) => (
            <div
              key={leave.id}
              style={{
                padding: 12,
                borderRadius: 10,
                background: LEAVE_COLORS[leave.status]?.bg || "#FAFAFA",
                border: `1px solid ${LEAVE_COLORS[leave.status]?.dot || "#E0E0E0"}20`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: getAvatarBg(
                      leave.user?.full_name || "",
                      leave.user?.email || ""
                    ),
                    color: getAvatarFg(
                      leave.user?.full_name || "",
                      leave.user?.email || ""
                    ),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(leave.user?.full_name || "", leave.user?.email || "")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
                    {getUserDisplayName(leave.user)}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    {leave.leave_type_display}
                  </div>
                </div>
                <StatusPill status={leave.status} />
              </div>
              {leave.user_reason && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#888",
                    fontStyle: "italic",
                    marginBottom: 8,
                    paddingLeft: 42,
                  }}
                >
                   `&apos;`{leave.user_reason} `&apos;`
                </div>
              )}
              {isAdmin && onViewUser && leave.user && (
                <button
                  onClick={() => {
                    onViewUser({
                      id: leave.user!.id,
                      email: leave.user!.email,
                      full_name: leave.user!.full_name,
                      role: 'member',
                    });
                    onClose();
                  }}
                  style={{
                    marginLeft: 42,
                    marginTop: 4,
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #E0E0E0",
                    background: "#fff",
                    fontSize: 11,
                    cursor: "pointer",
                    color: "#666",
                  }}
                >
                  View user&apos;s leave
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Holiday Detail Modal (for delete) ─────────────────────────────────────────

interface HolidayDetailModalProps {
  holiday: PublicHoliday;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  deleting: boolean;
}

function HolidayDetailModal({ holiday, onClose, onDelete, deleting }: HolidayDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 400,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#111" }}>
            Holiday Details
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              background: "#FAECE7",
              padding: "12px",
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#993C1D" }}>
              {holiday.name}
            </div>
            <div style={{ fontSize: 12, color: "#993C1D", marginTop: 4 }}>
              {fmtDateDisplay(holiday.date)}
              {holiday.is_recurring && " (Recurring annually)"}
            </div>
          </div>

          {holiday.remarks && (
            <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
              <strong>Notes:</strong> {holiday.remarks}
            </div>
          )}
        </div>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 9,
              border: "1px solid #F09595",
              background: "#FCEBEB",
              color: "#791F1F",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <TrashIcon /> Delete Holiday
          </button>
        ) : (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 9,
                border: "1px solid #E0E0E0",
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: "#666",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(holiday.id)}
              disabled={deleting}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 9,
                border: "none",
                background: deleting ? "#888" : "#791F1F",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bulk Holiday Modal ────────────────────────────────────────────────────────

interface BulkHolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (holidays: Array<{ name: string; date: string; is_recurring: boolean; remarks: string }>) => Promise<void>;
  submitting: boolean;
  existingHolidayDates: Set<string>;
}

function BulkHolidayModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  existingHolidayDates,
}: BulkHolidayModalProps) {
  const now = new Date();
  const [mode, setMode] = useState<"single" | "range" | "multiple">("single");
  const [holidayName, setHolidayName] = useState("");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(now.getMonth());
  const [isRecurring, setIsRecurring] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setMode("single");
    setHolidayName("");
    setSingleDate("");
    setStartDate("");
    setEndDate("");
    setSelectedDates([]);
    setPickerYear(now.getFullYear());
    setPickerMonth(now.getMonth());
    setIsRecurring(false);
    setRemarks("");
    setError("");
  };

  const generateDateRange = (s: string, e: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(s);
    const end = new Date(e);
    while (cur <= end) {
      dates.push(toYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const handleSubmit = async () => {
    setError("");
    if (!holidayName.trim()) {
      setError("Holiday name is required");
      return;
    }

    let datesToSubmit: string[] = [];
    if (mode === "single") {
      if (!singleDate) {
        setError("Please select a date");
        return;
      }
      if (existingHolidayDates.has(singleDate)) {
        setError("A holiday already exists on this date");
        return;
      }
      datesToSubmit = [singleDate];
    } else if (mode === "range") {
      if (!startDate || !endDate) {
        setError("Please select start and end dates");
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        setError("End date must be after start date");
        return;
      }
      datesToSubmit = generateDateRange(startDate, endDate);
      
      // Check for existing holidays
      const existingDates = datesToSubmit.filter((d) => existingHolidayDates.has(d));
      if (existingDates.length > 0) {
        setError(
          `The following dates already have holidays: ${existingDates.join(', ')}`
        );
        return;
      }
    } else {
      if (selectedDates.length === 0) {
        setError("Please select at least one date");
        return;
      }
      
      // Check for existing holidays
      const existingDates = selectedDates.filter((d) => existingHolidayDates.has(d));
      if (existingDates.length > 0) {
        setError(
          `The following dates already have holidays: ${existingDates.join(", ")}`
        );
        return;
      }
      datesToSubmit = [...selectedDates];
    }

    // Remove duplicates within the same batch
    datesToSubmit = [...new Set(datesToSubmit)];

    const holidays = datesToSubmit.map((date) => ({
      name: holidayName.trim(),
      date,
      is_recurring: mode === "single" ? isRecurring : false,
      remarks: remarks.trim(),
    }));

    await onSubmit(holidays);
    onClose();
    resetForm();
  };

  const toggleDate = (ymd: string) => {
    if (existingHolidayDates.has(ymd)) return;
    setSelectedDates((prev) =>
      prev.includes(ymd) ? prev.filter((d) => d !== ymd) : [...prev, ymd]
    );
  };

  const prevPickerMonth = () => {
    if (pickerMonth === 0) {
      setPickerMonth(11);
      setPickerYear((y) => y - 1);
    } else {
      setPickerMonth((m) => m - 1);
    }
  };

  const nextPickerMonth = () => {
    if (pickerMonth === 11) {
      setPickerMonth(0);
      setPickerYear((y) => y + 1);
    } else {
      setPickerMonth((m) => m + 1);
    }
  };

  const todayYMD = toYMD(now);
  const pickerDays = getDaysInMonth(pickerYear, pickerMonth);
  const pickerFirstDow = new Date(pickerYear, pickerMonth, 1).getDay();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 500,
          maxHeight: "85vh",
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#111" }}>
            Add Public Holidays
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(
            [
              { value: "single", label: "Single Date" },
              { value: "range", label: "Date Range" },
              { value: "multiple", label: "Multiple Dates" },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              onClick={() => {
                setMode(m.value);
                setError("");
              }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                background: mode === m.value ? "#1a1a1a" : "#F0F0F0",
                color: mode === m.value ? "#fff" : "#666",
                border: "none",
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Holiday name */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              display: "block",
              marginBottom: 5,
            }}
          >
            Holiday Name *
          </label>
          <input
            type="text"
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            placeholder="e.g., Christmas, New Year, Diwali…"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #E0E0E0",
              fontSize: 13,
              background: "#FAFAFA",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Single mode */}
        {mode === "single" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#555",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Date *
              </label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #E0E0E0",
                  fontSize: 13,
                  background: "#FAFAFA",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {singleDate && existingHolidayDates.has(singleDate) && (
                <div style={{ fontSize: 11, color: "#E24B4A", marginTop: 4 }}>
                  ⚠️ A holiday already exists on this date
                </div>
              )}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#444",
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Repeats every year (recurring)
            </label>
          </>
        )}

        {/* Range mode */}
        {mode === "range" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#555",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #E0E0E0",
                  fontSize: 13,
                  background: "#FAFAFA",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#555",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #E0E0E0",
                  fontSize: 13,
                  background: "#FAFAFA",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </>
        )}

        {/* Multiple mode — navigable calendar */}
        {mode === "multiple" && (
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#555",
                display: "block",
                marginBottom: 5,
              }}
            >
              Select Dates *
            </label>
            <div style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 12 }}>
              {/* Month nav */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <button
                  onClick={prevPickerMonth}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 8px",
                    color: "#444",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ‹
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                  {MONTHS[pickerMonth]} {pickerYear}
                </span>
                <button
                  onClick={nextPickerMonth}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 8px",
                    color: "#444",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ›
                </button>
              </div>
              {/* Day headers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      textAlign: "center",
                      color: "#999",
                      fontWeight: 600,
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {Array.from({ length: pickerFirstDow }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {pickerDays.map((date) => {
                  const ymd = toYMD(date);
                  const isSelected = selectedDates.includes(ymd);
                  const isToday = ymd === todayYMD;
                  const hasExistingHoliday = existingHolidayDates.has(ymd);
                  const isDisabled = hasExistingHoliday;

                  return (
                    <button
                      key={ymd}
                      onClick={() => toggleDate(ymd)}
                      disabled={isDisabled}
                      style={{
                        padding: "6px 2px",
                        textAlign: "center",
                        fontSize: 12,
                        borderRadius: 4,
                        background: isSelected
                          ? "#1a1a1a"
                          : hasExistingHoliday
                          ? "#FCEBEB"
                          : "#FAFAFA",
                        color: isSelected
                          ? "#fff"
                          : hasExistingHoliday
                          ? "#791F1F"
                          : "#333",
                        border:
                          isToday && !isSelected
                            ? "1.5px solid #1a1a1a"
                            : "1px solid #E0E0E0",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.6 : 1,
                        textDecoration: hasExistingHoliday ? "line-through" : "none",
                      }}
                      title={
                        hasExistingHoliday ? "Holiday already exists on this date" : ""
                      }
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedDates.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>
                Selected: {selectedDates.length} date(s)
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              display: "block",
              marginBottom: 5,
            }}
          >
            Notes (optional)
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Additional notes…"
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #E0E0E0",
              fontSize: 13,
              background: "#FAFAFA",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: 12 }}>
            <ErrorBanner msg={error} />
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: 11,
              borderRadius: 9,
              border: "1px solid #E0E0E0",
              background: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "#666",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              flex: 2,
              padding: 11,
              borderRadius: 9,
              border: "none",
              background: submitting ? "#888" : "#1a1a1a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting
              ? "Adding..."
              : mode === "single"
              ? "Add Holiday"
              : mode === "range"
              ? "Add Holidays"
              : `Add ${selectedDates.length} Holiday${selectedDates.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approve Modal ─────────────────────────────────────────────────────────────

interface ApproveModalProps {
  leave: LeaveRequest;
  form: { action: "approved" | "rejected"; admin_remark: string };
  error: string;
  submitting: boolean;
  onChange: (f: { action: "approved" | "rejected"; admin_remark: string }) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function ApproveModal({
  leave,
  form,
  error,
  submitting,
  onChange,
  onSubmit,
  onClose,
}: ApproveModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 900,
        padding: "0 16px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "22px 20px",
          width: "100%",
          maxWidth: 420,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
            Action on request
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
          >
            <CloseIcon />
          </button>
        </div>
        <div
          style={{
            background: "#F7F7F7",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 14,
            fontSize: 12,
            color: "#555",
          }}
        >
          <span style={{ fontWeight: 600, color: "#111" }}>
            {getUserDisplayName(leave.user)}
          </span>
          <span style={{ marginLeft: 8 }}>
            {leave.leave_type_display} · {fmtDate(leave.start_date)}
            {leave.start_date !== leave.end_date
              ? ` → ${fmtDate(leave.end_date)}`
              : ""}{" "}
            · {leave.duration_days}d
          </span>
          {leave.user_reason && (
            <div style={{ marginTop: 4, fontStyle: "italic", color: "#888" }}>
              &ldquo;{leave.user_reason}&rdquo;
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["approved", "rejected"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ ...form, action: a })}
              style={{
                flex: 1,
                padding: 9,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                border:
                  form.action === a
                    ? `2px solid ${a === "approved" ? "#639922" : "#E24B4A"}`
                    : "1px solid #E0E0E0",
                background:
                  form.action === a
                    ? a === "approved"
                      ? "#EAF3DE"
                      : "#FCEBEB"
                    : "#FAFAFA",
                color:
                  form.action === a
                    ? a === "approved"
                      ? "#27500A"
                      : "#791F1F"
                    : "#666",
              }}
            >
              {a === "approved" ? "Approve" : "Reject"}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#555",
              display: "block",
              marginBottom: 5,
            }}
          >
            Remark {form.action === "rejected" && <span style={{ color: "#E24B4A" }}>*</span>}
          </label>
          <textarea
            value={form.admin_remark}
            onChange={(e) => onChange({ ...form, admin_remark: e.target.value })}
            placeholder={
              form.action === "rejected"
                ? "Required — reason for rejection…"
                : "Optional remark…"
            }
            rows={3}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "1px solid #E0E0E0",
              fontSize: 13,
              background: "#FAFAFA",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>
        {error && (
          <div style={{ marginBottom: 10 }}>
            <ErrorBanner msg={error} />
          </div>
        )}
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            width: "100%",
            padding: 11,
            borderRadius: 9,
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            background: submitting
              ? "#888"
              : form.action === "approved"
              ? "#27500A"
              : "#791F1F",
            color: "#fff",
          }}
        >
          {submitting
            ? "Saving…"
            : form.action === "approved"
            ? "Approve request"
            : "Reject request"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaveCalendarPage() {
  const router = useRouter();
  const now = new Date();

  const [me, setMe] = useState<MeData | null>(null);
  const [authChecked, setAuth] = useState(false);

  const {
    data: memberships = [],
    isLoading: isMembershipLoading,
    isFetching: isMembershipFetching,
  } = useGetMyMembershipsQuery();
  const isAdmin = memberships.some((m) => m.role === "admin" || m.role === "manager");

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      router.replace("/login");
      return;
    }
    fetchMe()
      .then((u) => {
        setMe(u);
        setAuth(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const [viewMode, setViewMode] = useState<"my" | "team" | "user">("my");
  const [selectedUser, setSelectedUser] = useState<OrgMember | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [adminLeaves, setAdminLeaves] = useState<LeaveRequest[]>([]);
  const [userLeaves, setUserLeaves] = useState<LeaveRequest[]>([]);
  const [userBalance, setUserBalance] = useState<LeaveBalance[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [balance, setBalance] = useState<LeaveBalance[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const [showApply, setShowApply] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState<LeaveRequest | null>(null);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [showBulkHolidayForm, setShowBulkHolidayForm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [showDateDetails, setShowDateDetails] = useState<{
    date: string;
    leaves: LeaveRequest[];
  } | null>(null);
  const [showDayOptions, setShowDayOptions] = useState(false);
  const [dayClickDate, setDayClickDate] = useState("");
  const [selectedHoliday, setSelectedHoliday] = useState<PublicHoliday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState(false);

  const [applyForm, setApplyForm] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    user_reason: "",
  });
  const [applyError, setApplyError] = useState("");
  const [approveForm, setApproveForm] = useState<{
    action: "approved" | "rejected";
    admin_remark: string;
  }>({ action: "approved", admin_remark: "" });
  const [approveError, setApproveError] = useState("");
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    is_recurring: false,
    remarks: "",
  });
  const [holidayError, setHolidayError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getCurrentLeaves = useCallback(() => {
    if (viewMode === "team" && isAdmin) {
      return adminLeaves.filter((l) => l.status !== "cancelled");
    }
    if (viewMode === "user" && selectedUser) {
      return userLeaves;
    }
    return myLeaves;
  }, [viewMode, isAdmin, adminLeaves, userLeaves, myLeaves, selectedUser]);

  const loadData = useCallback(async () => {
    if (!authChecked) return;
    setLoading(true);
    setError(null);
    try {
      const [hols, pol, bal, leaves] = await Promise.all([
        fetchPublicHolidays(year),
        fetchLeaveMeta(),
        fetchLeaveBalance(year),
        fetchMyLeaveRequests(year),
      ]);
      setHolidays(hols);
      setPolicies(pol);
      setBalance(bal);
      setMyLeaves(leaves);
      if (isAdmin) {
        const [all, members] = await Promise.all([
          fetchAdminLeaveRequests(year),
          fetchOrgMembers(),
        ]);
        setAdminLeaves(all);
        if (members.length === 0) {
          const seen = new Map<number, OrgMember>();
          all.forEach((lr) => {
            if (lr.user && !seen.has(lr.user.id)) {
              seen.set(lr.user.id, {
                id: lr.user.id,
                email: lr.user.email,
                full_name: lr.user.full_name,
                role: "member",
              });
            }
          });
          setOrgMembers(Array.from(seen.values()));
        } else {
          setOrgMembers(members);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [authChecked, year, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadUserData = useCallback(
    async (user: OrgMember) => {
      try {
        const [leaves, bal] = await Promise.all([
          fetchAdminLeaveRequests(year, user.id),
          fetchLeaveBalance(year, user.id),
        ]);
        setUserLeaves(leaves);
        setUserBalance(bal);
      } catch {
        showToast("Failed to load user data", "err");
      }
    },
    [year]
  );

  const handleSelectUser = (member: OrgMember) => {
    setSelectedUser(member);
    setViewMode("user");
    loadUserData(member);
  };

  const handleBackToTeam = () => {
    setSelectedUser(null);
    setViewMode("team");
  };

  const holidayMap = useMemo(() => {
    const map = new Map<string, PublicHoliday>();
    holidays.forEach((h) => {
      if (h.is_recurring) {
        map.set(`${year}-${h.date.slice(5)}`, h);
      } else {
        map.set(h.date, h);
      }
    });
    return map;
  }, [holidays, year]);

  const existingHolidayDates = useMemo(() => {
    return new Set(holidays.map((h) => h.date));
  }, [holidays]);

  const currentLeavesList = useMemo(() => getCurrentLeaves(), [getCurrentLeaves]);
  const leaveMap = useMemo(() => buildLeaveMap(currentLeavesList), [currentLeavesList]);

  const dateToLeavesMap = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    currentLeavesList.forEach((leave) => {
      if (leave.status === "cancelled") return;
      let breakdown = leave.day_breakdown;
      if (!breakdown || breakdown.length === 0) {
        breakdown = [];
        const cur = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        while (cur <= end) {
          breakdown.push({ date: toYMD(cur), type: "leave", holiday_name: null });
          cur.setDate(cur.getDate() + 1);
        }
      }
      breakdown.forEach((d) => {
        if (d.type === "leave") {
          const existing = map.get(d.date) || [];
          map.set(d.date, [...existing, leave]);
        }
      });
    });
    return map;
  }, [currentLeavesList]);

  const pendingAdminLeaves = isAdmin
    ? adminLeaves.filter((l) => l.status === "pending" && !l.is_org_leave)
    : [];
  const filteredPendingLeaves = pendingAdminLeaves.filter((leave) => {
    if (!memberSearch) return true;
    return getUserDisplayName(leave.user)
      .toLowerCase()
      .includes(memberSearch.toLowerCase());
  });

  const requestsNotInMonth = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return currentLeavesList
      .filter((lr) => new Date(lr.end_date) < start || new Date(lr.start_date) > end)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [currentLeavesList, year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const days = getDaysInMonth(year, month);
  const firstDow = new Date(year, month, 1).getDay();
  const todayStr = toYMD(now);

  const handleApplySubmit = async () => {
    setApplyError("");
    if (!applyForm.leave_type) {
      setApplyError("Please select a leave type.");
      return;
    }
    if (!applyForm.start_date || !applyForm.end_date) {
      setApplyError("Please select dates.");
      return;
    }
    const pol = policies.find((p) => p.leave_type === applyForm.leave_type);
    if (pol?.requires_reason && !applyForm.user_reason.trim()) {
      setApplyError("A reason is required for this leave type.");
      return;
    }
    setSubmitting(true);
    try {
      await submitLeaveRequest(applyForm);
      setShowApply(false);
      setApplyForm({ leave_type: "", start_date: "", end_date: "", user_reason: "" });
      await loadData();
      showToast("Leave request submitted");
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this leave request?")) return;
    setSubmitting(true);
    try {
      await cancelLeaveRequest(id);
      await loadData();
      if (selectedUser) await loadUserData(selectedUser);
      showToast("Request cancelled");
      setSelectedLeave(null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to cancel", "err");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSubmit = async () => {
    setApproveError("");
    if (!showApproveModal) return;
    if (approveForm.action === "rejected" && !approveForm.admin_remark.trim()) {
      setApproveError("Please provide a reason for rejection.");
      return;
    }
    setSubmitting(true);
    try {
      await actionLeaveRequest(
        showApproveModal.id,
        approveForm.action,
        approveForm.admin_remark
      );
      setShowApproveModal(null);
      setApproveForm({ action: "approved", admin_remark: "" });
      await loadData();
      if (selectedUser) await loadUserData(selectedUser);
      showToast(`Request ${approveForm.action}`);
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : "Failed to process");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSingleHoliday = async () => {
    setHolidayError("");
    if (!holidayForm.name.trim()) {
      setHolidayError("Holiday name is required.");
      return;
    }
    if (!holidayForm.date) {
      setHolidayError("Date is required.");
      return;
    }
    setSubmitting(true);
    try {
      await addPublicHoliday({
        organisation: memberships[0]?.organisation,
        name: holidayForm.name,
        date: holidayForm.date,
        is_recurring: holidayForm.is_recurring,
        remarks: holidayForm.remarks,
      });
      setShowHolidayForm(false);
      setHolidayForm({ name: "", date: "", is_recurring: false, remarks: "" });
      await loadData();
      showToast("Holiday added");
    } catch (e: unknown) {
      setHolidayError(e instanceof Error ? e.message : "Failed to add holiday");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkHolidays = async (
    bulkHolidays: Array<{ name: string; date: string; is_recurring: boolean; remarks: string }>
  ) => {
    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    const failedDates: string[] = [];

    try {
      for (const h of bulkHolidays) {
        try {
          await addPublicHoliday({
            organisation: memberships[0]?.organisation,
            name: h.name,
            date: h.date,
            is_recurring: h.is_recurring,
            remarks: h.remarks,
          });
          successCount++;
        } catch (err: unknown) {
          failCount++;
          failedDates.push(h.date);
          console.error(`Failed to add holiday for ${h.date}:`, err);
        }
      }

      await loadData();

      if (successCount > 0 && failCount === 0) {
        showToast(`${successCount} holiday(s) added successfully`);
        setShowBulkHolidayForm(false);
      } else if (successCount > 0 && failCount > 0) {
        showToast(
          `${successCount} added, ${failCount} failed (already exist): ${failedDates.join(', ')}`,
          "err"
        );
      } else {
        showToast(`Failed to add holidays. Dates already exist: ${failedDates.join(", ")}`, "err");
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to add holidays", "err");
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    setDeletingHoliday(true);
    try {
      await deletePublicHoliday(id);
      await loadData();
      showToast("Holiday deleted successfully");
      setSelectedHoliday(null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to delete holiday", "err");
    } finally {
      setDeletingHoliday(false);
    }
  };

  const openApprove = (leave: LeaveRequest, action: "approved" | "rejected") => {
    setApproveForm({ action, admin_remark: "" });
    setApproveError("");
    setShowApproveModal(leave);
  };

  const handleDateClick = (ymd: string) => {
    const leavesOnDate = dateToLeavesMap.get(ymd) || [];
    const holidayOnDate = holidayMap.get(ymd);
    
    if (holidayOnDate) {
      setSelectedHoliday(holidayOnDate);
    } else if (leavesOnDate.length > 0) {
      setShowDateDetails({ date: ymd, leaves: leavesOnDate });
    } else {
      setDayClickDate(ymd);
      setShowDayOptions(true);
    }
  };

  if (!authChecked || isMembershipLoading || isMembershipFetching) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Checking access…
      </div>
    );
  }
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading calendar…
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#E24B4A",
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <>
      {toast && <Toast toast={toast} />}

      <div style={{ minHeight: "100vh", background: "#F5F5F5", padding: "20px 16px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
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
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#111", margin: 0 }}>
                Leave Calendar
              </h1>
              <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>{me?.email}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowApply(true)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 9,
                  border: "none",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <PlusIcon /> Apply for leave
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowBulkHolidayForm(true)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 9,
                    border: "1px solid #E0E0E0",
                    background: "#fff",
                    color: "#444",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CalendarIcon /> Add Holidays
                </button>
              )}
            </div>
          </div>

          {/* View tabs */}
          {isAdmin && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 20,
                borderBottom: "1px solid #E0E0E0",
                paddingBottom: 10,
              }}
            >
              <button
                onClick={() => {
                  setViewMode("my");
                  setSelectedUser(null);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  background: viewMode === "my" ? "#1a1a1a" : "transparent",
                  color: viewMode === "my" ? "#fff" : "#666",
                  cursor: "pointer",
                }}
              >
                My Leaves
              </button>
              <button
                onClick={() => {
                  setViewMode("team");
                  setSelectedUser(null);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  background: viewMode === "team" ? "#1a1a1a" : "transparent",
                  color: viewMode === "team" ? "#fff" : "#666",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <UsersIcon /> Team Requests
              </button>
            </div>
          )}

          {/* User view header */}
          {viewMode === "user" && selectedUser && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button
                onClick={handleBackToTeam}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #E0E0E0",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#666",
                }}
              >
                <BackIcon /> Back
              </button>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                  {getUserDisplayName(selectedUser)}
                </h2>
                <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                  {selectedUser.email}
                </p>
              </div>
            </div>
          )}

          {/* Calendar */}
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #E8E8E8",
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #F0F0F0",
              }}
            >
              <button
                onClick={prevMonth}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  color: "#666",
                }}
              >
                <ChevLeft />
              </button>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>
                {MONTHS[month]} {year}
              </div>
              <button
                onClick={nextMonth}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  color: "#666",
                }}
              >
                <ChevRight />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                background: "#FAFAFA",
                borderBottom: "1px solid #F0F0F0",
              }}
            >
              {DAYS.map((d, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 6px",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#999",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {Array.from({ length: firstDow }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  style={{
                    padding: "10px 6px",
                    background: "#FAFAFA",
                    minHeight: 80,
                    borderBottom: "1px solid #F0F0F0",
                    borderRight: "1px solid #F0F0F0",
                  }}
                />
              ))}
              {days.map((date) => {
                const ymd = toYMD(date);
                const isToday = ymd === todayStr;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const holiday = holidayMap.get(ymd);
                const leaveData = leaveMap.get(ymd);
                const leavesOnDate = dateToLeavesMap.get(ymd) || [];
                return (
                  <div
                    key={ymd}
                    onClick={() => handleDateClick(ymd)}
                    style={{
                      padding: "8px 6px",
                      minHeight: 80,
                      borderBottom: "1px solid #F0F0F0",
                      borderRight: "1px solid #F0F0F0",
                      cursor: "pointer",
                      background: isToday ? "#EAF3DE" : isWeekend ? "#FAFAFA" : "#fff",
                      transition: "background 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isToday) e.currentTarget.style.background = "#F5F5F5";
                    }}
                    onMouseLeave={(e) => {
                      if (!isToday)
                        e.currentTarget.style.background = isWeekend ? "#FAFAFA" : "#fff";
                    }}
                  >
                    <div
                      style={{
                        fontWeight: isToday ? 700 : 400,
                        fontSize: 13,
                        color: holiday ? "#993C1D" : isWeekend ? "#999" : "#333",
                      }}
                    >
                      {date.getDate()}
                    </div>
                    {holiday && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#993C1D",
                          background: "#FAECE7",
                          padding: "2px 4px",
                          borderRadius: 4,
                          marginTop: 4,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        🎉 {holiday.name}
                      </div>
                    )}
                    {leaveData && leaveData.colors.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          marginTop: holiday ? 2 : 4,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {leaveData.colors.slice(0, 3).map((c, idx) => (
                          <div
                            key={idx}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: c,
                            }}
                            title={`${leavesOnDate.length} leave request(s)`}
                          />
                        ))}
                        {leaveData.colors.length > 3 && (
                          <span style={{ fontSize: 9, color: "#888" }}>
                            +{leaveData.colors.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {leavesOnDate.length > 0 && (
                      <div style={{ fontSize: 9, color: "#888", marginTop: 2 }}>
                        {leavesOnDate.length} request{leavesOnDate.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Other requests */}
          {requestsNotInMonth.length > 0 && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #E8E8E8",
                padding: "16px 20px",
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0", color: "#555" }}>
                Other requests ({requestsNotInMonth.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {requestsNotInMonth.map((lr) => (
                  <div
                    key={lr.id}
                    onClick={() => setSelectedLeave(lr)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "#FAFAFA",
                      borderRadius: 8,
                      border: "1px solid #F0F0F0",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                        {lr.leave_type_display}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {fmtDate(lr.start_date)} → {fmtDate(lr.end_date)} · {lr.duration_days}d
                      </div>
                    </div>
                    <StatusPill status={lr.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team pending */}
          {isAdmin && viewMode === "team" && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #E8E8E8",
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#555" }}>
                  Pending requests ({filteredPendingLeaves.length})
                </h3>
                <input
                  type="text"
                  placeholder="Search by user name…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #E0E0E0",
                    fontSize: 12,
                    width: 200,
                    outline: "none",
                  }}
                />
              </div>
              {filteredPendingLeaves.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#999", fontSize: 13 }}>
                  No pending leave requests
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredPendingLeaves.map((leave) => (
                    <div
                      key={leave.id}
                      style={{
                        background: "#FAFAFA",
                        borderRadius: 10,
                        border: "1px solid #F0F0F0",
                        padding: 14,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: getAvatarBg(
                              leave.user?.full_name || "",
                              leave.user?.email || ""
                            ),
                            color: getAvatarFg(
                              leave.user?.full_name || "",
                              leave.user?.email || ""
                            ),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(leave.user?.full_name || "", leave.user?.email || "")}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
                            {getUserDisplayName(leave.user)}
                          </div>
                          <div style={{ fontSize: 11, color: "#888" }}>
                            {leave.leave_type_display}
                          </div>
                        </div>
                        <StatusPill status={leave.status} />
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                        📅 {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)} ·{" "}
                        {leave.duration_days} day(s)
                      </div>
                      {leave.user_reason && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#888",
                            fontStyle: "italic",
                            marginBottom: 12,
                            padding: "6px 10px",
                            background: "#fff",
                            borderRadius: 6,
                          }}
                        >
                          `&quot;`{leave.user_reason}`&quot;`
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => openApprove(leave, "approved")}
                          style={{
                            flex: 1,
                            padding: 8,
                            borderRadius: 6,
                            border: "1px solid #97C459",
                            background: "#EAF3DE",
                            color: "#27500A",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                          }}
                        >
                          <CheckIcon /> Approve
                        </button>
                        <button
                          onClick={() => openApprove(leave, "rejected")}
                          style={{
                            flex: 1,
                            padding: 8,
                            borderRadius: 6,
                            border: "1px solid #F09595",
                            background: "#FCEBEB",
                            color: "#791F1F",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                          }}
                        >
                          <CloseIcon /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Balance */}
          {(viewMode === "my" || viewMode === "user") && (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #E8E8E8",
                padding: "16px 20px",
                marginTop: 24,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px 0", color: "#555" }}>
                Leave Balance — {year}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(viewMode === "user" ? userBalance : balance).map((b) => (
                  <div
                    key={b.leave_type}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #F0F0F0",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>
                        {b.leave_type_display}
                      </div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        Total: {b.total_days} days
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: b.remaining_days > 0 ? "#27500A" : "#791F1F",
                        }}
                      >
                        {b.remaining_days} days left
                      </div>
                      <div style={{ fontSize: 10, color: "#999" }}>
                        Used: {b.used_days} · Pending: {b.pending_days}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Apply modal */}
      {showApply && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 900,
            padding: "0 16px",
          }}
          onClick={() => setShowApply(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "22px 20px",
              width: "100%",
              maxWidth: 480,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Apply for leave</span>
              <button
                onClick={() => setShowApply(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Leave type
                </label>
                <select
                  value={applyForm.leave_type}
                  onChange={(e) => setApplyForm((f) => ({ ...f, leave_type: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">Select type</option>
                  {policies.map((p) => (
                    <option key={p.leave_type} value={p.leave_type}>
                      {p.leave_type_display}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Start date
                </label>
                <input
                  type="date"
                  value={applyForm.start_date}
                  onChange={(e) => setApplyForm((f) => ({ ...f, start_date: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  End date
                </label>
                <input
                  type="date"
                  value={applyForm.end_date}
                  onChange={(e) => setApplyForm((f) => ({ ...f, end_date: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Reason{" "}
                  {policies.find((p) => p.leave_type === applyForm.leave_type)?.requires_reason && (
                    <span style={{ color: "#E24B4A" }}>*</span>
                  )}
                </label>
                <textarea
                  value={applyForm.user_reason}
                  onChange={(e) => setApplyForm((f) => ({ ...f, user_reason: e.target.value }))}
                  placeholder={
                    policies.find((p) => p.leave_type === applyForm.leave_type)?.requires_reason
                      ? "Required for this leave type…"
                      : "Optional…"
                  }
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              {applyError && <ErrorBanner msg={applyError} />}
              <button
                onClick={handleApplySubmit}
                disabled={submitting}
                style={{
                  padding: 11,
                  borderRadius: 9,
                  border: "none",
                  background: submitting ? "#888" : "#1a1a1a",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave detail modal */}
      {selectedLeave && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 900,
          }}
          onClick={() => setSelectedLeave(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "16px 16px 0 0",
              padding: "22px 20px 32px",
              width: "100%",
              maxWidth: 520,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                {selectedLeave.leave_type_display}
              </span>
              <button
                onClick={() => setSelectedLeave(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#888" }}>Dates</span>
                <span style={{ color: "#111", fontWeight: 500 }}>
                  {fmtDate(selectedLeave.start_date)} → {fmtDate(selectedLeave.end_date)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#888" }}>Duration</span>
                <span style={{ color: "#111", fontWeight: 500 }}>
                  {selectedLeave.duration_days} day(s)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#888" }}>Status</span>
                <StatusPill status={selectedLeave.status} label={selectedLeave.status_display} />
              </div>
              {selectedLeave.user_reason && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 10 }}>
                  <span style={{ color: "#888", flexShrink: 0 }}>Reason</span>
                  <span style={{ color: "#111", textAlign: "right" }}>
                    {selectedLeave.user_reason}
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
              {selectedLeave.day_breakdown?.map((d) => {
                const isHol = d.type === "holiday";
                return (
                  <div
                    key={d.date}
                    title={isHol ? d.holiday_name ?? "Holiday" : "Leave day"}
                    style={{
                      padding: "3px 7px",
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: 500,
                      background: isHol ? "#FAECE7" : "#EAF3DE",
                      color: isHol ? "#993C1D" : "#27500A",
                      border: `1px solid ${isHol ? "#F0997B" : "#97C459"}`,
                    }}
                  >
                    {new Date(d.date).getDate()}
                    {isHol ? " H" : ""}
                  </div>
                );
              })}
            </div>
            {selectedLeave.approvals.length > 0 && (
              <div style={{ borderTop: "1px solid #F0F0F0", paddingTop: 10, marginBottom: 12 }}>
                {selectedLeave.approvals.map((a) => (
                  <div key={a.id} style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: a.action === "approved" ? "#27500A" : "#791F1F",
                      }}
                    >
                      {a.action_display}
                    </span>
                    {a.actioned_by_info && (
                      <span style={{ color: "#888" }}> by {a.actioned_by_info.full_name}</span>
                    )}
                    {a.admin_remark && (
                      <span style={{ fontStyle: "italic", color: "#888" }}>
                        {" "}
                        — &ldquo;{a.admin_remark}&rdquo;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {selectedLeave.status === "pending" && isAdmin && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setSelectedLeave(null);
                    openApprove(selectedLeave, "approved");
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #97C459",
                    background: "#EAF3DE",
                    color: "#27500A",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <CheckIcon /> Approve
                </button>
                <button
                  onClick={() => {
                    setSelectedLeave(null);
                    openApprove(selectedLeave, "rejected");
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #F09595",
                    background: "#FCEBEB",
                    color: "#791F1F",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <CloseIcon /> Reject
                </button>
              </div>
            )}
            {selectedLeave.status === "pending" && !isAdmin && (
              <button
                onClick={() => handleCancel(selectedLeave.id)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 9,
                  border: "1px solid #F09595",
                  background: "#FCEBEB",
                  color: "#791F1F",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel request
              </button>
            )}
          </div>
        </div>
      )}

      {/* Approve/reject modal */}
      {showApproveModal && (
        <ApproveModal
          leave={showApproveModal}
          form={approveForm}
          error={approveError}
          submitting={submitting}
          onChange={setApproveForm}
          onSubmit={handleApproveSubmit}
          onClose={() => {
            setShowApproveModal(null);
            setApproveError("");
          }}
        />
      )}

      {/* Bulk holiday modal */}
      <BulkHolidayModal
        isOpen={showBulkHolidayForm}
        onClose={() => setShowBulkHolidayForm(false)}
        onSubmit={handleBulkHolidays}
        submitting={submitting}
        existingHolidayDates={existingHolidayDates}
      />

      {/* Date leave details modal */}
      {showDateDetails && (
        <DateLeaveDetailsModal
          date={showDateDetails.date}
          leaves={showDateDetails.leaves}
          onClose={() => setShowDateDetails(null)}
          onViewUser={handleSelectUser}
          isAdmin={isAdmin}
        />
      )}

      {/* Holiday detail modal (for delete) */}
      {selectedHoliday && (
        <HolidayDetailModal
          holiday={selectedHoliday}
          onClose={() => setSelectedHoliday(null)}
          onDelete={handleDeleteHoliday}
          deleting={deletingHoliday}
        />
      )}

      {/* Day options modal */}
      {showDayOptions && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 900,
          }}
          onClick={() => setShowDayOptions(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "16px 16px 0 0",
              padding: "22px 20px 32px",
              width: "100%",
              maxWidth: 520,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                {dayClickDate ? fmtDateDisplay(dayClickDate) : ""}
              </span>
              <button
                onClick={() => setShowDayOptions(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => {
                  setShowDayOptions(false);
                  setApplyForm((f) => ({ ...f, start_date: dayClickDate, end_date: dayClickDate }));
                  setApplyError("");
                  setShowApply(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "13px 14px",
                  borderRadius: 10,
                  border: "1px solid #E0E0E0",
                  background: "#FAFAFA",
                  color: "#111",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <CalIcon /> Apply for leave on this day
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setShowDayOptions(false);
                    setHolidayForm((f) => ({ ...f, date: dayClickDate }));
                    setHolidayError("");
                    setShowHolidayForm(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "13px 14px",
                    borderRadius: 10,
                    border: "1px solid #E0E0E0",
                    background: "#FAFAFA",
                    color: "#111",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <PlusIcon /> Mark as public holiday
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single holiday modal */}
      {showHolidayForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 900,
            padding: "0 16px",
          }}
          onClick={() => setShowHolidayForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "22px 20px",
              width: "100%",
              maxWidth: 400,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                Add public holiday
              </span>
              <button
                onClick={() => setShowHolidayForm(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Onam, Christmas Day…"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#444",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={holidayForm.is_recurring}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                Repeats every year (recurring)
              </label>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#555",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={holidayForm.remarks}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional note…"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #E0E0E0",
                    fontSize: 13,
                    background: "#FAFAFA",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {holidayError && <ErrorBanner msg={holidayError} />}
              <button
                onClick={handleAddSingleHoliday}
                disabled={submitting}
                style={{
                  padding: 11,
                  borderRadius: 9,
                  border: "none",
                  background: submitting ? "#888" : "#1a1a1a",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                {submitting ? "Adding…" : "Add holiday"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}