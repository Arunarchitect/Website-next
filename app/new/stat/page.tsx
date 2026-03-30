/* eslint-disable react-hooks/exhaustive-deps */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchOrganisations,
  fetchProjectsByOrg,
  fetchDeliverablesByProject,
  fetchUsersByOrg,
  fetchSalaryReport,
  type SalaryReport,
  type SalaryReportEmployee,
  type OrganisationOption,
  type ProjectOption,
  type DeliverableOption,
  type UserOption,
} from "@/app/new/salaryApi";

type PercentageDetail = NonNullable<
  SalaryReportEmployee["percentage_details"]
>[number];

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026, 2027];

function fmtINR(n: number) {
  return (
    "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#07080f",
  panel: "rgba(255,255,255,0.028)",
  panelB: "rgba(255,255,255,0.065)",
  panel2: "rgba(255,255,255,0.038)",
  panel2B: "rgba(255,255,255,0.08)",
  divider: "rgba(255,255,255,0.05)",
  t1: "#f0f4ff",
  t2: "#d8e0f0",
  t3: "#8a9ab8",
  t4: "#55657e",
  t5: "#39475a",
  t6: "#1f2733",
  ac: "#4c7cf3",
  acGlow: "rgba(76,124,243,0.15)",
  acLight: "rgba(76,124,243,0.1)",
  acMid: "rgba(76,124,243,0.45)",
  acText: "#7ba4ff",
  green: "#1ec99a",
  greenBg: "rgba(30,201,154,0.09)",
  red: "#f0686a",
  redBg: "rgba(240,104,106,0.09)",
  purple: "#9b79f5",
  purpleBg: "rgba(155,121,245,0.09)",
  blue: "#4c7cf3",
  blueBg: "rgba(76,124,243,0.09)",
  orange: "#f5a623",
  orangeBg: "rgba(245,166,35,0.09)",
};

// ─── Small components ─────────────────────────────────────────────────────────
const Divider = () => <div style={{ height: 1, background: T.divider }} />;

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: T.t5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
        {required && <span style={{ color: T.red }}> *</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          backgroundColor: disabled ? "rgba(255,255,255,0.02)" : T.panel2,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2339475a'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "calc(100% - 10px) center",
          border: `1px solid ${T.panel2B}`,
          borderRadius: 7,
          padding: "8px 32px 8px 10px",
          fontSize: 13,
          color: disabled ? T.t5 : T.t2,
          outline: "none",
          fontFamily: "'DM Sans',sans-serif",
          cursor: disabled ? "not-allowed" : "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          transition: "border-color 0.12s",
          minHeight: 44,
        }}
      >
        {children}
      </select>
    </div>
  );
}

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (d: string) => void;
  onEndChange: (d: string) => void;
  onClear: () => void;
}) {
  const hasDateRange = startDate || endDate;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: T.t5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Date Range
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          style={{
            flex: 1,
            background: T.panel2,
            border: `1px solid ${T.panel2B}`,
            borderRadius: 7,
            padding: "8px 10px",
            fontSize: 12,
            color: T.t2,
            outline: "none",
            fontFamily: "'DM Sans',sans-serif",
            minHeight: 40,
            colorScheme: "dark",
          }}
        />
        <span style={{ color: T.t5, fontSize: 12 }}>→</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          style={{
            flex: 1,
            background: T.panel2,
            border: `1px solid ${T.panel2B}`,
            borderRadius: 7,
            padding: "8px 10px",
            fontSize: 12,
            color: T.t2,
            outline: "none",
            fontFamily: "'DM Sans',sans-serif",
            minHeight: 40,
            colorScheme: "dark",
          }}
        />
        {hasDateRange && (
          <button
            onClick={onClear}
            style={{
              background: T.panel2,
              border: `1px solid ${T.panel2B}`,
              borderRadius: 7,
              padding: "8px 12px",
              fontSize: 12,
              color: T.red,
              cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
              whiteSpace: "nowrap",
              minHeight: 40,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>
      {hasDateRange && (
        <div style={{ fontSize: 10, color: T.acText, marginTop: 6 }}>
          {startDate && endDate
            ? `${startDate} → ${endDate}`
            : startDate
              ? `From ${startDate}`
              : `Until ${endDate}`}
        </div>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(" ")
    .map((w: string) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: T.acLight,
        border: `1px solid ${T.acMid}`,
        color: T.acText,
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {initials}
    </div>
  );
}

function Shimmer({ w, h = 14 }: { w: number | string; h?: number }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: 4,
        background: "rgba(255,255,255,0.06)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

function StatCard({
  label,
  value,
  color,
  loading,
  subtitle,
}: {
  label: string;
  value: string;
  color: string;
  loading?: boolean;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 130px",
        padding: "14px 16px",
        background: T.panel2,
        border: `1px solid ${T.panel2B}`,
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 11, color: T.t4, marginBottom: 6 }}>{label}</div>
      {loading ? (
        <Shimmer w={80} h={20} />
      ) : (
        <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      )}
      {subtitle && (
        <div style={{ fontSize: 10, color: T.t5, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  setView,
}: {
  view: "hourly" | "percentage";
  setView: (v: "hourly" | "percentage") => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: T.panel2,
        border: `1px solid ${T.panel2B}`,
        borderRadius: 10,
        padding: 2,
      }}
    >
      {(["hourly", "percentage"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            background: view === v ? T.ac : "transparent",
            color: view === v ? "#fff" : T.t4,
            border: "none",
            cursor: "pointer",
            transition: "all 0.12s",
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {v === "hourly" ? "💰 Hourly" : "📊 % Share"}
        </button>
      ))}
    </div>
  );
}

// ─── All-projects toggle ──────────────────────────────────────────────────────
function AllProjectsToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={
        enabled
          ? "Currently including ALL projects — click to revert to hourly-only"
          : "Currently hourly projects only — click to include % share projects in hourly calc"
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 13px",
        borderRadius: 9,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "'DM Sans',sans-serif",
        transition: "all 0.15s",
        border: `1px solid ${enabled ? T.green + "60" : T.divider}`,
        background: enabled ? T.greenBg : T.panel,
        color: enabled ? T.green : T.t4,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          width: 28,
          height: 16,
          borderRadius: 99,
          background: enabled ? T.green : T.t6,
          padding: "0 2px",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
            transform: enabled ? "translateX(12px)" : "translateX(0)",
            transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
            display: "block",
          }}
        />
      </span>
      All projects
    </button>
  );
}

// ─── Billing type badge ───────────────────────────────────────────────────────
function BillingBadge({ type }: { type: "hourly" | "percentage_share" }) {
  const isHourly = type === "hourly";
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: 4,
        background: isHourly ? T.blueBg : T.purpleBg,
        color: isHourly ? T.blue : T.purple,
        border: `1px solid ${isHourly ? T.acMid : "rgba(155,121,245,0.35)"}`,
      }}
    >
      {isHourly ? "💰 Hourly" : "📊 % Share"}
    </span>
  );
}

// ─── Employee card (mobile) ───────────────────────────────────────────────────
function EmployeeCard({
  emp,
  view,
  selectedProject,
  includeAllProjects,
}: {
  emp: SalaryReportEmployee;
  view: "hourly" | "percentage";
  selectedProject?: number | null;
  includeAllProjects?: boolean;
}) {
  const hourly = emp.hourly_amount ?? 0;
  const pct = emp.percentage_amount ?? 0;
  const showPct = view === "percentage" && !!selectedProject && pct > 0;

  const displayAmount = view === "hourly" ? hourly : showPct ? pct : 0;
  const displayColor = view === "hourly" ? T.blue : showPct ? T.purple : T.t5;
  const displayLabel =
    view === "hourly"
      ? "Hourly Salary"
      : showPct
        ? "% Share"
        : selectedProject
          ? "No % data"
          : "Select a project";

  return (
    <div
      style={{
        background: T.panel2,
        border: `1px solid ${T.panel2B}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "fadeUp 0.18s ease both",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={emp.user.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.t2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {emp.user.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: T.t5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {emp.user.email}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: T.t5, marginBottom: 2 }}>
            {displayLabel}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: displayColor }}>
            {displayAmount > 0 ? fmtINR(displayAmount) : "—"}
          </div>
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}
      >
        {[
          {
            label: "Hours",
            val: `${emp.total_hours.toFixed(1)} h`,
            color: T.t2,
            bg: T.blueBg,
          },
          {
            label: "Hourly",
            val: hourly > 0 ? fmtINR(hourly) : "—",
            color: T.blue,
            bg: T.blueBg,
          },
          {
            label: "% Share",
            val: pct > 0 ? fmtINR(pct) : "—",
            color: pct > 0 ? T.purple : T.t5,
            bg: T.purpleBg,
          },
        ].map(({ label, val, color, bg }) => (
          <div
            key={label}
            style={{ background: bg, borderRadius: 8, padding: "8px 10px" }}
          >
            <div
              style={{
                fontSize: 9,
                color: T.t5,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color }}>{val}</div>
          </div>
        ))}
      </div>

      {view === "hourly" && !selectedProject && emp.billing_note && (
        <div
          style={{
            fontSize: 10,
            fontStyle: "italic",
            color: includeAllProjects ? T.green : T.t5,
          }}
        >
          {includeAllProjects ? "✅" : "ℹ"} {emp.billing_note}
        </div>
      )}

      {view === "percentage" &&
        showPct &&
        emp.percentage_details &&
        emp.percentage_details.length > 0 && (
          <div
            style={{
              borderTop: `1px solid ${T.divider}`,
              paddingTop: 7,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {emp.percentage_details.map((d: PercentageDetail, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: T.t4,
                }}
              >
                <span>
                  {d.share_type_display} · {d.percentage}% of{" "}
                  {fmtINR(d.revenue_base)} ({d.scope_name})
                </span>
                <span
                  style={{ color: T.purple, fontWeight: 600, marginLeft: 8 }}
                >
                  {fmtINR(d.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, color: T.t5 }}>
          {emp.work_logs_count} log{emp.work_logs_count !== 1 ? "s" : ""}
        </span>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 20,
            background: T.acLight,
            color: T.acText,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {emp.work_logs_count} logs
        </span>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: `1px solid ${T.divider}` }}>
          <td style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  animation: "pulse 1.4s ease-in-out infinite",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <Shimmer w={120} />
                <Shimmer w={90} h={11} />
              </div>
            </div>
          </td>
          {[60, 80, 50].map((w, j) => (
            <td key={j} style={{ padding: "14px 18px", textAlign: "right" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Shimmer w={w} />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.22s",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          width: "min(88vw, 320px)",
          background: "#0d0f1c",
          borderRight: `1px solid ${T.panelB}`,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.26s cubic-bezier(0.32,0,0.25,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 16px 12px",
            borderBottom: `1px solid ${T.divider}`,
            position: "sticky",
            top: 0,
            background: "#0d0f1c",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: T.t3,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Filters
          </span>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: T.panel2,
              border: `1px solid ${T.panel2B}`,
              color: T.t4,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ─── Sidebar props type ───────────────────────────────────────────────────────
interface SidebarProps {
  organisations: OrganisationOption[];
  selectedOrg: number | null;
  setSelectedOrg: (v: number | null) => void;
  selectedYear: number | null;
  setSelectedYear: (v: number | null) => void;
  selectedMonth: number | null;
  setSelectedMonth: (v: number | null) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  clearDateRange: () => void;
  projects: ProjectOption[];
  selectedProject: number | null;
  setSelectedProject: (v: number | null) => void;
  loadingProjects: boolean;
  deliverables: DeliverableOption[];
  selectedDeliverable: number | null;
  setSelectedDeliverable: (v: number | null) => void;
  loadingDeliverables: boolean;
  users: UserOption[];
  selectedUser: number | null;
  setSelectedUser: (v: number | null) => void;
  loadingUsers: boolean;
  activeFilterCount: number;
  onClearAll: () => void;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  organisations,
  selectedOrg,
  setSelectedOrg,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  clearDateRange,
  projects,
  selectedProject,
  setSelectedProject,
  loadingProjects,
  deliverables,
  selectedDeliverable,
  setSelectedDeliverable,
  loadingDeliverables,
  users,
  selectedUser,
  setSelectedUser,
  loadingUsers,
  activeFilterCount,
  onClearAll,
}: SidebarProps) {
  const isDateRangeActive = !!(startDate || endDate);

  const hourlyProjectCount = projects.filter(
    (p) => p.billing_type === "hourly",
  ).length;
  const pctShareProjectCount = projects.filter(
    (p) => p.billing_type === "percentage_share",
  ).length;

  return (
    <>
      <div style={{ padding: "16px 14px 12px" }}>
        <SelectField
          label="Organisation"
          required
          value={selectedOrg ? String(selectedOrg) : ""}
          onChange={(v) => setSelectedOrg(v ? Number(v) : null)}
        >
          <option value="">Select organisation</option>
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      </div>

      <Divider />

      <div style={{ padding: "12px 14px" }}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onClear={clearDateRange}
        />
      </div>

      <Divider />

      <div
        style={{
          padding: "12px 14px 8px",
          opacity: isDateRangeActive ? 0.45 : 1,
          pointerEvents: isDateRangeActive ? "none" : "auto",
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: T.t5,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Year &amp; Month
          {isDateRangeActive && (
            <span style={{ fontSize: 9, color: T.orange, fontWeight: 400 }}>
              (disabled — date range active)
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {AVAILABLE_YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(selectedYear === y ? null : y)}
              style={{
                flex: "1 1 0",
                minHeight: 40,
                background: selectedYear === y ? T.acLight : "transparent",
                border: `1px solid ${selectedYear === y ? T.acMid : T.divider}`,
                borderRadius: 6,
                color: selectedYear === y ? T.acText : T.t5,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: selectedYear === y ? 700 : 400,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {y}
            </button>
          ))}
        </div>

        {selectedYear !== null && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 6,
            }}
          >
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
                style={{
                  background: selectedMonth === i ? T.acLight : "transparent",
                  border: `1px solid ${selectedMonth === i ? T.acMid : T.divider}`,
                  borderRadius: 6,
                  color: selectedMonth === i ? T.acText : T.t5,
                  fontSize: 11,
                  padding: "9px 4px",
                  cursor: "pointer",
                  fontWeight: selectedMonth === i ? 600 : 400,
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        )}

        {selectedYear === null && (
          <p
            style={{
              fontSize: 11,
              color: T.t6,
              fontStyle: "italic",
              margin: 0,
            }}
          >
            Select a year to enable month filter
          </p>
        )}
      </div>

      <Divider />

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: T.t5,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
          }}
        >
          Filters <span style={{ color: T.t6 }}>(optional)</span>
        </div>

        <div>
          <SelectField
            label="Project"
            value={selectedProject ? String(selectedProject) : ""}
            onChange={(v) => setSelectedProject(v ? Number(v) : null)}
            disabled={!selectedOrg || loadingProjects}
          >
            <option value="">
              {loadingProjects ? "Loading…" : "All projects"}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.billing_type === "percentage_share" ? "📊 " : "💰 "}
                {p.name}
              </option>
            ))}
          </SelectField>
          {projects.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {hourlyProjectCount > 0 && (
                <span style={{ fontSize: 10, color: T.t5 }}>
                  💰 Hourly ({hourlyProjectCount})
                </span>
              )}
              {pctShareProjectCount > 0 && (
                <span style={{ fontSize: 10, color: T.t5 }}>
                  📊 % Share ({pctShareProjectCount})
                </span>
              )}
            </div>
          )}
        </div>

        <SelectField
          label="Deliverable"
          value={selectedDeliverable ? String(selectedDeliverable) : ""}
          onChange={(v) => setSelectedDeliverable(v ? Number(v) : null)}
          disabled={!selectedProject || loadingDeliverables}
        >
          <option value="">
            {loadingDeliverables ? "Loading…" : "All deliverables"}
          </option>
          {deliverables.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="User"
          value={selectedUser ? String(selectedUser) : ""}
          onChange={(v) => setSelectedUser(v ? Number(v) : null)}
          disabled={!selectedOrg || loadingUsers}
        >
          <option value="">{loadingUsers ? "Loading…" : "All users"}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </SelectField>
      </div>

      {activeFilterCount > 0 && (
        <>
          <Divider />
          <div style={{ padding: "12px 14px 20px", display: "flex", gap: 8 }}>
            {isDateRangeActive && (
              <button
                onClick={clearDateRange}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: `1px solid ${T.orange}40`,
                  borderRadius: 7,
                  padding: "10px 0",
                  fontSize: 11,
                  color: T.orange,
                  cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                📅 Clear Dates
              </button>
            )}
            <button
              onClick={onClearAll}
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid ${T.divider}`,
                borderRadius: 7,
                padding: "10px 0",
                fontSize: 11,
                color: T.t5,
                cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              ✕ Clear All
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SalaryReportPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw] = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 740;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<"hourly" | "percentage">("hourly");

  const [includeAllProjects, setIncludeAllProjects] = useState(false);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [report, setReport] = useState<SalaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedDeliverable, setSelectedDeliverable] = useState<number | null>(
    null,
  );
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  // ── Load organisations ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchOrganisations()
      .then(setOrganisations)
      .catch((e) => console.error("orgs:", e));
  }, []);

  // ── Load projects when org changes ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedOrg) {
      setProjects([]);
      setSelectedProject(null);
      return;
    }
    setLoadingProjects(true);
    fetchProjectsByOrg(selectedOrg)
      .then((d) => {
        setProjects(d);
        setSelectedProject(null);
        setSelectedDeliverable(null);
        setDeliverables([]);
      })
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoadingProjects(false));
  }, [selectedOrg]);

  // ── Load deliverables when project changes ─────────────────────────────────
  useEffect(() => {
    if (!selectedProject) {
      setDeliverables([]);
      setSelectedDeliverable(null);
      return;
    }
    setLoadingDeliverables(true);
    fetchDeliverablesByProject(selectedProject)
      .then((d) => {
        setDeliverables(d);
        setSelectedDeliverable(null);
      })
      .catch(() => setError("Failed to load deliverables"))
      .finally(() => setLoadingDeliverables(false));
  }, [selectedProject]);

  // ── Load users when org changes ────────────────────────────────────────────
  // Fixed: Properly handle the promise and set users state
  useEffect(() => {
    setSelectedUser(null);
    if (!selectedOrg) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    fetchUsersByOrg()
      .then((fetchedUsers) => {
        setUsers(fetchedUsers);
      })
      .catch((err) => {
        console.error("Failed to load users:", err);
        setUsers([]);
      })
      .finally(() => setLoadingUsers(false));
  }, [selectedOrg]);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!selectedOrg) {
      setError("Please select an organisation");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSalaryReport({
        from: startDate || undefined,
        to: endDate || undefined,
        year:
          !startDate && !endDate && selectedYear !== null
            ? selectedYear
            : undefined,
        month:
          !startDate &&
          !endDate &&
          selectedYear !== null &&
          selectedMonth !== null
            ? selectedMonth + 1
            : undefined,
        organisation_id: selectedOrg,
        project_id: selectedProject || undefined,
        deliverable_id: selectedDeliverable || undefined,
        user_id: selectedUser || undefined,
        view_all: true,
        include_all_projects: includeAllProjects && !selectedProject,
      });
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [
    selectedYear,
    selectedMonth,
    selectedOrg,
    selectedProject,
    selectedDeliverable,
    selectedUser,
    startDate,
    endDate,
    includeAllProjects,
  ]);

  // ── Debounced auto-fetch ───────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedOrg) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchReport, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchReport]);

  const clearAllFilters = () => {
    setSelectedOrg(null);
    setSelectedProject(null);
    setSelectedDeliverable(null);
    setSelectedUser(null);
    setSelectedYear(null);
    setSelectedMonth(null);
    setStartDate("");
    setEndDate("");
    setIncludeAllProjects(false);
    setDrawerOpen(false);
    setReport(null);
  };

  const activeFilterCount = [
    !!selectedOrg,
    !!selectedProject,
    !!selectedDeliverable,
    !!selectedUser,
    !!startDate,
    !!endDate,
    selectedYear !== null,
    selectedMonth !== null,
  ].filter(Boolean).length;

  const selectedOrgName = organisations.find((o) => o.id === selectedOrg)?.name;
  const selectedProjectName = projects.find(
    (p) => p.id === selectedProject,
  )?.name;
  const selectedProjectType = projects.find(
    (p) => p.id === selectedProject,
  )?.billing_type;

  const showAllProjectsToggle =
    view === "hourly" && !selectedProject && !!selectedOrg;

  // ── Period display ─────────────────────────────────────────────────────────
  const getPeriodDisplay = () => {
    if (startDate && endDate) return `${startDate} → ${endDate}`;
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Until ${endDate}`;
    if (selectedYear !== null && selectedMonth !== null)
      return `${MONTHS[selectedMonth]} ${selectedYear}`;
    if (selectedYear !== null) return `Full year ${selectedYear}`;
    return "All time (no date filter)";
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  let totalAmount = 0,
    totalLabel = "",
    totalColor = T.t4,
    subtitle = "";
  if (view === "hourly") {
    totalAmount = report?.total_hourly_amount ?? 0;
    totalLabel =
      includeAllProjects && !selectedProject
        ? "Total Hourly Salary (all projects)"
        : "Total Hourly Salary";
    totalColor = includeAllProjects && !selectedProject ? T.green : T.blue;
    subtitle = selectedProject
      ? `${report?.total_employees || 0} employees — ${selectedProjectName}`
      : includeAllProjects
        ? `${report?.total_employees || 0} employees × all projects`
        : `${report?.total_employees || 0} employees × hourly projects only`;
  } else {
    if (selectedProject) {
      totalAmount = report?.total_percentage_amount ?? 0;
      totalLabel = `Total % Share — ${selectedProjectName || "Project"}`;
      totalColor = T.purple;
      subtitle = "Revenue × share %";
    } else {
      totalLabel = "Select a project";
      totalColor = T.t5;
      subtitle = "% share requires project selection";
    }
  }

  // ── Footer note ────────────────────────────────────────────────────────────
  const footerNote = (() => {
    if (view === "hourly") {
      if (selectedProject) {
        return selectedProjectType === "percentage_share"
          ? `💰 Showing hours for ${selectedProjectName} (📊 % share project — no hourly rate applies)`
          : `💰 Hourly = work logs × hourly rate (${selectedProjectName})`;
      }
      if (includeAllProjects) {
        return "✅ All projects included — hours from % share projects counted in hourly total";
      }
      return "💰 Hourly projects only — 📊 percentage-share projects excluded from this total";
    }
    if (selectedProject) {
      return `📊 % Share = revenue from ${selectedProjectName} × share %`;
    }
    return "📌 Select a project to enable % share view";
  })();

  const sidebarProps: SidebarProps = {
    organisations,
    selectedOrg,
    setSelectedOrg,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    clearDateRange,
    projects,
    selectedProject,
    setSelectedProject,
    loadingProjects,
    deliverables,
    selectedDeliverable,
    setSelectedDeliverable,
    loadingDeliverables,
    users,
    selectedUser,
    setSelectedUser,
    loadingUsers,
    activeFilterCount,
    onClearAll: clearAllFilters,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.t2,
        fontFamily: "'DM Sans','Sora',sans-serif",
        padding: isMobile ? "16px 12px 80px" : "28px 24px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=Sora:wght@600;700&display=swap');
        *{box-sizing:border-box;margin:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(76,124,243,0.25);border-radius:99px;}
        select option{background:#0d0f1c;color:#d8e0f0;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5);cursor:pointer;}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .trow:hover{background:rgba(255,255,255,0.022)!important;}
        button,select,input{touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
      `}</style>

      {isMobile && (
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Sidebar {...sidebarProps} />
        </MobileDrawer>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              flexShrink: 0,
              background: `linear-gradient(135deg, ${T.acLight}, ${T.acGlow})`,
              border: `1px solid ${T.acMid}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={19} height={19} viewBox="0 0 20 20" fill="none">
              <path
                d="M3 10h14M3 6h14M3 14h8"
                stroke={T.acText}
                strokeWidth={1.7}
                strokeLinecap="round"
              />
              <circle
                cx={15}
                cy={14}
                r={3}
                stroke={T.acText}
                strokeWidth={1.5}
              />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontSize: isMobile ? 17 : 22,
                fontWeight: 700,
                fontFamily: "'Sora',sans-serif",
                letterSpacing: "-0.03em",
                color: T.t1,
                lineHeight: 1.2,
              }}
            >
              Salary Report
            </h1>
            <p style={{ color: T.t5, fontSize: 12, marginTop: 2 }}>
              {selectedOrgName ? `${selectedOrgName} · ` : ""}
              {getPeriodDisplay()}
              {selectedProjectName &&
                view === "percentage" &&
                ` · ${selectedProjectName}`}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ViewToggle view={view} setView={setView} />

          {showAllProjectsToggle && (
            <AllProjectsToggle
              enabled={includeAllProjects}
              onToggle={() => setIncludeAllProjects((v) => !v)}
            />
          )}

          {isMobile && (
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: T.panel,
                border: `1px solid ${T.panelB}`,
                borderRadius: 9,
                padding: "10px 14px",
                color: T.t3,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                position: "relative",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <svg width={14} height={14} viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 5h14M6 10h8M9 15h2"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    background: T.ac,
                    color: "#fff",
                    width: 17,
                    height: 17,
                    borderRadius: "50%",
                    fontSize: 9,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px solid ${T.bg}`,
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Layout ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "290px 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        {!isMobile && (
          <div
            style={{
              background: T.panel,
              border: `1px solid ${T.panelB}`,
              borderRadius: 14,
              overflow: "hidden",
              position: "sticky",
              top: 20,
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
            }}
          >
            <Sidebar {...sidebarProps} />
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            minWidth: 0,
          }}
        >
          {!selectedOrg && !loading && (
            <div
              style={{
                padding: "52px 20px",
                textAlign: "center",
                background: T.panel,
                borderRadius: 14,
                border: `1px solid ${T.panelB}`,
              }}
            >
              <svg
                width={46}
                height={46}
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.t5}
                strokeWidth={1}
              >
                <rect x={3} y={3} width={18} height={18} rx={2} />
                <path d="M3 9h18M9 21v-12" />
              </svg>
              <p style={{ marginTop: 14, color: T.t4, fontSize: 13 }}>
                Select an organisation to view the salary report
              </p>
            </div>
          )}

          {view === "hourly" &&
            selectedOrg &&
            !selectedProject &&
            !includeAllProjects && (
              <div
                style={{
                  padding: "10px 16px",
                  color: T.t4,
                  fontSize: 12,
                  background: T.panel2,
                  borderRadius: 10,
                  border: `1px solid ${T.divider}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>💰</span>
                <span>
                  Showing{" "}
                  <strong style={{ color: T.blue }}>
                    hourly projects only
                  </strong>
                  . Toggle <em>All projects</em> above to include % share
                  projects in the hourly total.
                </span>
              </div>
            )}

          {view === "hourly" &&
            selectedOrg &&
            !selectedProject &&
            includeAllProjects && (
              <div
                style={{
                  padding: "10px 16px",
                  color: T.green,
                  fontSize: 12,
                  background: T.greenBg,
                  borderRadius: 10,
                  border: `1px solid ${T.green}30`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>✅</span>
                <span>
                  <strong>All projects included</strong> — hours from % share
                  projects are counted in the hourly salary total.
                </span>
              </div>
            )}

          {view === "percentage" && selectedOrg && !selectedProject && (
            <div
              style={{
                padding: "12px 16px",
                color: T.orange,
                fontSize: 13,
                background: T.orangeBg,
                borderRadius: 10,
                border: `1px solid ${T.orange}30`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span>⚠️</span>
              <span>
                Select a specific project to view percentage share calculations
              </span>
            </div>
          )}

          {view === "percentage" &&
            selectedProject &&
            selectedProjectType === "hourly" && (
              <div
                style={{
                  padding: "12px 16px",
                  color: T.blue,
                  fontSize: 13,
                  background: T.blueBg,
                  borderRadius: 10,
                  border: `1px solid ${T.acMid}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>ℹ️</span>
                <span>
                  <strong>{selectedProjectName}</strong> is a 💰 hourly project.
                  Switch to the Hourly view to see earnings, or select a 📊 %
                  share project.
                </span>
              </div>
            )}

          {error && (
            <div
              style={{
                padding: "11px 16px",
                color: T.red,
                fontSize: 13,
                background: T.redBg,
                borderRadius: 10,
                border: `1px solid ${T.red}30`,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {selectedOrg && (
            <div
              style={{
                background: T.panel,
                border: `1px solid ${T.panelB}`,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: isMobile ? "14px" : "18px 22px",
                  background: `linear-gradient(135deg, ${T.panel2}, transparent)`,
                  borderBottom: `1px solid ${T.divider}`,
                }}
              >
                {selectedProject && selectedProjectType && (
                  <div style={{ marginBottom: 10 }}>
                    <BillingBadge
                      type={
                        selectedProjectType as "hourly" | "percentage_share"
                      }
                    />
                    <span style={{ fontSize: 11, color: T.t5, marginLeft: 8 }}>
                      {selectedProjectName}
                    </span>
                  </div>
                )}

                {!selectedProject &&
                  includeAllProjects &&
                  view === "hourly" && (
                    <div style={{ marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: T.greenBg,
                          color: T.green,
                          border: `1px solid ${T.green}40`,
                        }}
                      >
                        ✅ All projects override
                      </span>
                    </div>
                  )}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <StatCard
                    loading={loading}
                    label={totalLabel}
                    value={totalAmount > 0 ? fmtINR(totalAmount) : "₹0"}
                    color={totalColor}
                    subtitle={subtitle}
                  />
                  <StatCard
                    loading={loading}
                    label="Employees"
                    value={String(report?.total_employees ?? 0)}
                    color={T.acText}
                  />
                  {view === "percentage" &&
                    selectedProject &&
                    report?.total_hourly_amount !== undefined && (
                      <StatCard
                        loading={loading}
                        label="Hourly (reference)"
                        value={
                          report.total_hourly_amount > 0
                            ? fmtINR(report.total_hourly_amount)
                            : "₹0"
                        }
                        color={T.blue}
                        subtitle="from hourly projects"
                      />
                    )}
                </div>
                {report && !loading && (
                  <div style={{ fontSize: 11, color: T.t5 }}>
                    Period: {report.report_period.start_date} –{" "}
                    {report.report_period.end_date}
                  </div>
                )}
              </div>

              {isMobile ? (
                <div
                  style={{
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                  }}
                >
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          background: T.panel2,
                          border: `1px solid ${T.panel2B}`,
                          borderRadius: 12,
                          padding: 14,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: "rgba(255,255,255,0.06)",
                              animation: "pulse 1.4s ease-in-out infinite",
                            }}
                          />
                          <div
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              gap: 5,
                            }}
                          >
                            <Shimmer w={140} />
                            <Shimmer w={100} h={11} />
                          </div>
                          <Shimmer w={60} h={20} />
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 7,
                          }}
                        >
                          {[1, 2, 3].map((j) => (
                            <div
                              key={j}
                              style={{
                                background: T.blueBg,
                                borderRadius: 8,
                                padding: "8px 10px",
                              }}
                            >
                              <Shimmer w={30} h={9} />
                              <div style={{ marginTop: 5 }}>
                                <Shimmer w={50} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : report?.employees.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: T.t5,
                        fontSize: 13,
                      }}
                    >
                      No salary data found for the selected filters
                    </div>
                  ) : (
                    report?.employees.map((emp) => (
                      <EmployeeCard
                        key={emp.user.id}
                        emp={emp}
                        view={view}
                        selectedProject={selectedProject}
                        includeAllProjects={includeAllProjects}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: 580,
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.divider}` }}>
                        <th
                          style={{
                            padding: "12px 18px",
                            textAlign: "left",
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: T.t4,
                          }}
                        >
                          Employee
                        </th>
                        <th
                          style={{
                            padding: "12px 18px",
                            textAlign: "right",
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: T.t4,
                          }}
                        >
                          Hours
                        </th>
                        <th
                          style={{
                            padding: "12px 18px",
                            textAlign: "right",
                            fontSize: 10.5,
                            fontWeight: 700,
                            color:
                              view === "hourly"
                                ? includeAllProjects && !selectedProject
                                  ? T.green
                                  : T.blue
                                : T.purple,
                          }}
                        >
                          {view === "hourly"
                            ? "Hourly Salary"
                            : `% Share${selectedProject && selectedProjectName ? ` (${selectedProjectName})` : ""}`}
                        </th>
                        {view === "percentage" && (
                          <th
                            style={{
                              padding: "12px 18px",
                              textAlign: "right",
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: T.blue,
                            }}
                          >
                            Hourly ref.
                          </th>
                        )}
                        <th
                          style={{
                            padding: "12px 18px",
                            textAlign: "center",
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: T.t4,
                          }}
                        >
                          Logs
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <TableSkeleton />
                      ) : report?.employees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={view === "percentage" ? 5 : 4}
                            style={{
                              padding: "52px 20px",
                              textAlign: "center",
                              color: T.t6,
                              fontSize: 13,
                            }}
                          >
                            No salary data found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        report?.employees.map((emp, idx) => {
                          const hourly = emp.hourly_amount ?? 0;
                          const pct = emp.percentage_amount ?? 0;
                          const showPct =
                            view === "percentage" &&
                            !!selectedProject &&
                            pct > 0;
                          const mainVal =
                            view === "hourly" ? hourly : showPct ? pct : 0;
                          const mainColor =
                            view === "hourly"
                              ? includeAllProjects && !selectedProject
                                ? T.green
                                : T.blue
                              : showPct
                                ? T.purple
                                : T.t5;

                          return (
                            <tr
                              key={emp.user.id}
                              className="trow"
                              style={{
                                borderBottom: `1px solid ${T.divider}`,
                                animation: `fadeUp 0.18s ease ${idx * 0.02}s both`,
                              }}
                            >
                              <td style={{ padding: "13px 18px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <Avatar name={emp.user.name} />
                                  <div>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: T.t2,
                                      }}
                                    >
                                      {emp.user.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: T.t5 }}>
                                      {emp.user.email}
                                    </div>
                                    {!selectedProject &&
                                      emp.billing_note &&
                                      view === "hourly" && (
                                        <div
                                          style={{
                                            fontSize: 9,
                                            marginTop: 2,
                                            fontStyle: "italic",
                                            color: includeAllProjects
                                              ? T.green
                                              : T.t6,
                                          }}
                                        >
                                          {includeAllProjects
                                            ? "✅ all projects included"
                                            : "% share projects excluded"}
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "13px 18px",
                                  textAlign: "right",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: T.t2,
                                  }}
                                >
                                  {emp.total_hours.toFixed(1)} hrs
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "13px 18px",
                                  textAlign: "right",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: mainColor,
                                  }}
                                >
                                  {mainVal > 0 ? fmtINR(mainVal) : "—"}
                                </span>
                                {view === "percentage" &&
                                  showPct &&
                                  emp.percentage_details &&
                                  emp.percentage_details.length > 0 && (
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: T.t5,
                                        marginTop: 2,
                                      }}
                                    >
                                      {emp.percentage_details
                                        .map(
                                          (d: PercentageDetail) =>
                                            `${d.percentage}% of ${fmtINR(d.revenue_base)}`,
                                        )
                                        .join(", ")}
                                    </div>
                                  )}
                                {view === "percentage" && !selectedProject && (
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: T.t6,
                                      marginTop: 2,
                                    }}
                                  >
                                    select project
                                  </div>
                                )}
                              </td>
                              {view === "percentage" && (
                                <td
                                  style={{
                                    padding: "13px 18px",
                                    textAlign: "right",
                                  }}
                                >
                                  <span style={{ fontSize: 12, color: T.blue }}>
                                    {hourly > 0 ? fmtINR(hourly) : "—"}
                                  </span>
                                </td>
                              )}
                              <td
                                style={{
                                  padding: "13px 18px",
                                  textAlign: "center",
                                }}
                              >
                                <span
                                  style={{
                                    padding: "3px 10px",
                                    borderRadius: 20,
                                    background: T.acLight,
                                    color: T.acText,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  {emp.work_logs_count}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div
                style={{
                  padding: "11px 18px",
                  borderTop: `1px solid ${T.divider}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color:
                      includeAllProjects &&
                      !selectedProject &&
                      view === "hourly"
                        ? T.green
                        : T.t5,
                  }}
                >
                  {footerNote}
                </div>
                <button
                  onClick={fetchReport}
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    background: "transparent",
                    border: `1px solid ${T.divider}`,
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 12,
                    color: loading ? T.t6 : T.t4,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.5 : 1,
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  <svg
                    width={13}
                    height={13}
                    viewBox="0 0 20 20"
                    fill="none"
                    style={{
                      animation: loading ? "spin 0.9s linear infinite" : "none",
                    }}
                  >
                    <path
                      d="M17 10a7 7 0 1 1-7-7M10 3v4h4"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                  {loading ? "Loading…" : "Refresh"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
