"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  fetchMyExpenses,
  fetchExpenseMeta,
  createMyExpense,
  updateMyExpense,
  deleteMyExpense,
  type MyExpenseRow as ExpenseRow,
  type MyExpenseResult as PageResult,
  type MyExpenseSummary as Summary,
  type ExpenseProjectOption as ProjectOption,
  type ExpenseCategoryOption as CatOption,
} from "@/app/new/myExpenseApi";

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
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDay(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}
function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg: "#080b14",
  bgGrad:
    "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,142,247,0.07) 0%, transparent 70%)",
  panel: "rgba(255,255,255,0.025)",
  panelB: "rgba(255,255,255,0.08)",
  panel2: "rgba(255,255,255,0.04)",
  panel2B: "rgba(255,255,255,0.07)",
  rowHov: "rgba(255,255,255,0.03)",
  divider: "rgba(255,255,255,0.05)",
  t1: "#f0f4ff",
  t2: "#e2e8f0",
  t3: "#94a3b8",
  t4: "#64748b",
  t5: "#475569",
  t6: "#2d3748",
  ac: "#4f8ef7",
  acLight: "rgba(79,142,247,0.1)",
  acMid: "rgba(79,142,247,0.4)",
  acText: "#7eb3ff",
  green: "#22d3a5",
  greenBg: "rgba(34,211,165,0.1)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.1)",
  amber: "#fbbf24",
  amberBg: "rgba(251,191,36,0.08)",
  purple: "#a78bfa",
  teal: "#2dd4bf",
  indigo: "#818cf8",
};

const CAT_COLORS: Record<string, string> = {
  travel: T.ac,
  food: T.green,
  accommodation: T.amber,
  stationery: T.purple,
  salary: T.teal,
  projectshare: T.indigo,
  others: T.t3,
};
function catColor(c: string) {
  return CAT_COLORS[c] ?? T.t3;
}

const Divider = () => (
  <div style={{ height: 1, background: T.divider, margin: "4px 0" }} />
);

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalGrid({
  year,
  month,
  activeDates,
  selDates,
  onToggle,
}: {
  year: number;
  month: number;
  activeDates: Set<string>;
  selDates: Set<string>;
  onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}
    >
      {DAYS.map((d) => (
        <div
          key={d}
          style={{
            textAlign: "center",
            fontSize: 9,
            color: T.t5,
            fontWeight: 600,
            letterSpacing: "0.06em",
            padding: "4px 0",
            textTransform: "uppercase",
          }}
        >
          {d}
        </div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const has = activeDates.has(iso);
        const sel = selDates.has(iso);
        return (
          <button
            key={iso}
            onClick={() => onToggle(iso)}
            style={{
              background: sel ? T.ac : "transparent",
              border: `1px solid ${sel ? T.ac : "transparent"}`,
              borderRadius: 6,
              cursor: "pointer",
              color: sel ? "#fff" : has ? T.t2 : T.t4,
              fontSize: 11,
              padding: "6px 0",
              textAlign: "center",
              transition: "all 0.15s",
              width: "100%",
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: sel ? 600 : 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            {day}
            {has && (
              <span
                style={{
                  display: "block",
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: sel ? "#fff" : T.acText,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Shared input / select styles ─────────────────────────────────────────────
const inputStyle = (err?: boolean): React.CSSProperties => ({
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${err ? T.red + "88" : "rgba(255,255,255,0.08)"}`,
  borderRadius: 8,
  padding: "8px 11px",
  fontSize: 12.5,
  color: T.t2,
  outline: "none",
  fontFamily: "'DM Sans',sans-serif",
  transition: "border-color 0.15s, box-shadow 0.15s",
  appearance: "none" as const,
  boxShadow: err ? `0 0 0 3px ${T.red}18` : "none",
});
const selStyle = (err?: boolean): React.CSSProperties => ({
  ...inputStyle(err),
  cursor: "pointer",
});

// ─── Field wrapper (module-level — prevents focus-loss bug) ───────────────────
function Field({
  label,
  children,
  col,
  err,
}: {
  label: string;
  children: React.ReactNode;
  col?: string;
  err?: string;
}) {
  return (
    <div style={{ gridColumn: col }}>
      <label
        style={{
          fontSize: 11,
          color: T.t4,
          display: "block",
          marginBottom: 5,
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
      {err && (
        <span
          style={{
            fontSize: 10.5,
            color: T.red,
            marginTop: 3,
            display: "block",
          }}
        >
          {err}
        </span>
      )}
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────
type SortField = "date" | "project" | "category" | "amount" | "reimbursed";
type SortDir = "asc" | "desc";

function ThCell({
  field,
  children,
  sortField,
  sortDir,
  onSort,
  align = "left",
  w,
}: {
  field: SortField;
  children: React.ReactNode;
  w?: number;
  align?: "left" | "right" | "center";
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th style={{ width: w, padding: 0, whiteSpace: "nowrap" }}>
      <div
        onClick={() => onSort(field)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          justifyContent:
            align === "right"
              ? "flex-end"
              : align === "center"
                ? "center"
                : "flex-start",
          padding: "11px 13px 8px",
          fontSize: 10.5,
          fontWeight: 600,
          color: active ? T.acText : T.t5,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          cursor: "pointer",
          userSelect: "none",
          transition: "color 0.15s",
        }}
      >
        {children}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.3 }}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </div>
    </th>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────
type SaveState = "idle" | "saving" | "success" | "error";

function SaveButton({
  state,
  onClick,
  compact = false,
}: {
  state: SaveState;
  onClick: () => void;
  compact?: boolean;
}) {
  const configs: Record<
    SaveState,
    { bg: string; label: string; icon: React.ReactNode }
  > = {
    idle: {
      bg: T.green,
      label: compact ? "Save" : "Save changes",
      icon: (
        <svg
          width={12}
          height={12}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M2 8l4 4 8-8" />
        </svg>
      ),
    },
    saving: { bg: T.t5, label: "Saving…", icon: <SpinnerIcon /> },
    success: {
      bg: T.green,
      label: "Saved!",
      icon: (
        <svg
          width={12}
          height={12}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M2 8l4 4 8-8" />
        </svg>
      ),
    },
    error: {
      bg: T.red,
      label: "Failed — retry",
      icon: (
        <svg
          width={12}
          height={12}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M8 3v5M8 11v1" />
        </svg>
      ),
    },
  };
  const { bg, label, icon } = configs[state];
  return (
    <button
      onClick={onClick}
      disabled={state === "saving"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: compact ? "6px 14px" : "7px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        border: "none",
        color: state === "saving" ? T.t3 : "#0b0e18",
        cursor: state === "saving" ? "wait" : "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap" as const,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ animation: "spin 0.7s linear infinite" }}
    >
      <circle cx={8} cy={8} r={6} strokeDasharray="20 18" />
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 10,
        background: T.panel2,
        border: `1px solid ${T.panel2B}`,
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: 11.5, color: T.t4 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────
function CategoryBadge({
  category,
  label,
}: {
  category: string;
  label: string;
}) {
  const color = catColor(category);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 20,
        background: color + "20",
        border: `1px solid ${color}40`,
        fontSize: 10.5,
        fontWeight: 600,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

// ─── Reimbursed badge ─────────────────────────────────────────────────────────
function ReimbursedBadge({ reimbursed }: { reimbursed: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 20,
        background: reimbursed ? T.greenBg : T.amberBg,
        color: reimbursed ? T.green : T.amber,
        fontSize: 10.5,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        border: `1px solid ${reimbursed ? T.green + "30" : T.amber + "30"}`,
      }}
    >
      {reimbursed ? "✓ Paid" : "Pending"}
    </span>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────
function IconBtn({
  onClick,
  title,
  color,
  children,
  disabled,
}: {
  onClick: () => void;
  title: string;
  color: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        border: `1px solid ${hov && !disabled ? color + "66" : color + "33"}`,
        background: hov && !disabled ? color + "22" : color + "12",
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s",
        opacity: disabled ? 0.35 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({
  msg,
  type,
  onDone,
}: {
  msg: string;
  type: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 20px",
        borderRadius: 12,
        background: type === "success" ? "#0d1f1a" : "#1f0d0d",
        border: `1px solid ${type === "success" ? T.green + "44" : T.red + "44"}`,
        color: type === "success" ? T.green : T.red,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        animation: "toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        whiteSpace: "nowrap",
      }}
    >
      {type === "success" ? (
        <svg
          width={15}
          height={15}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path d="M2 8l4 4 8-8" />
        </svg>
      ) : (
        <svg
          width={15}
          height={15}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M8 3v5M8 11v1" />
        </svg>
      )}
      {msg}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ msg }: { msg: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 24px",
        gap: 14,
        color: T.t6,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: T.panel2,
          border: `1px solid ${T.panel2B}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.t6}
          strokeWidth={1.4}
        >
          <rect x={2} y={5} width={20} height={14} rx={2} />
          <path d="M2 10h20" />
        </svg>
      </div>
      <span style={{ fontSize: 13.5, color: T.t5 }}>{msg}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "16px 18px",
        background: T.panel2,
        border: `1px solid ${T.panel2B}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {[90, 160, 110].map((w, i) => (
        <div
          key={i}
          style={{
            height: 11,
            width: w,
            borderRadius: 6,
            background: "rgba(255,255,255,0.05)",
            animation: "pulse 1.6s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Add Expense Panel ────────────────────────────────────────────────────────
interface AddFormState {
  project_id: string;
  amount: string;
  category: string;
  date: string;
  remarks: string;
  reimbursed: boolean;
}

function AddExpensePanel({
  projects,
  cats,
  onClose,
  onCreated,
}: {
  projects: ProjectOption[];
  cats: CatOption[];
  onClose: () => void;
  onCreated: (row: ExpenseRow) => void;
}) {
  const [form, setForm] = useState<AddFormState>({
    project_id: "",
    amount: "",
    category: "",
    date: today(),
    remarks: "",
    reimbursed: false,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof AddFormState, string>>
  >({});
  const [saveState, setSaveState] = useState<SaveState>("idle");

  function set(k: keyof AddFormState, v: string | boolean) {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  async function submit() {
    const errs: typeof errors = {};
    if (!form.project_id) errs.project_id = "Required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      errs.amount = "Enter a valid amount > 0";
    if (!form.category) errs.category = "Required";
    if (!form.date) errs.date = "Required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaveState("saving");
    try {
      const row = await createMyExpense({
        project_id: Number(form.project_id),
        amount: Number(form.amount),
        category: form.category,
        date: form.date,
        remarks: form.remarks,
        reimbursed: form.reimbursed,
      });
      setSaveState("success");
      setTimeout(() => {
        onCreated(row);
        onClose();
      }, 600);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(79,142,247,0.04) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1px solid ${T.acMid}`,
        borderRadius: 18,
        padding: "22px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: "0 0 40px rgba(79,142,247,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: T.acLight,
              border: `1px solid ${T.acMid}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke={T.acText}
              strokeWidth={2.2}
            >
              <path d="M8 2v12M2 8h12" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: T.t1,
              fontFamily: "'Sora',sans-serif",
            }}
          >
            New Expense
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: T.panel2,
            border: `1px solid ${T.panel2B}`,
            color: T.t4,
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Project *" col="1/-1" err={errors.project_id}>
          <select
            style={selStyle(!!errors.project_id)}
            value={form.project_id}
            onChange={(e) => set("project_id", e.target.value)}
          >
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount (₹) *" err={errors.amount}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            style={inputStyle(!!errors.amount)}
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Date *" err={errors.date}>
          <input
            type="date"
            style={inputStyle(!!errors.date)}
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Category *" col="1/-1" err={errors.category}>
          <select
            style={selStyle(!!errors.category)}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Select category…</option>
            {cats.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Remarks" col="1/-1">
          <input
            type="text"
            style={inputStyle()}
            value={form.remarks}
            onChange={(e) => set("remarks", e.target.value)}
            placeholder="Optional note…"
          />
        </Field>
        <div
          style={{
            gridColumn: "1/-1",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}
        >
          <input
            type="checkbox"
            id="add-reimb"
            checked={form.reimbursed}
            onChange={(e) => set("reimbursed", e.target.checked)}
            style={{
              width: 15,
              height: 15,
              cursor: "pointer",
              accentColor: T.ac,
            }}
          />
          <label
            htmlFor="add-reimb"
            style={{ fontSize: 12, color: T.t3, cursor: "pointer" }}
          >
            Mark as already reimbursed
          </label>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          paddingTop: 2,
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            fontSize: 12,
            background: "transparent",
            border: `1px solid ${T.panel2B}`,
            color: T.t4,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <SaveButton state={saveState} onClick={submit} />
      </div>
    </div>
  );
}

// ─── Inline edit draft ────────────────────────────────────────────────────────
interface EditDraft {
  project_id: string;
  amount: string;
  category: string;
  date: string;
  remarks: string;
  reimbursed: boolean;
}
function draftFromRow(row: ExpenseRow): EditDraft {
  return {
    project_id: String(row.project_id),
    amount: String(row.amount),
    category: row.category,
    date: row.date,
    remarks: row.remarks,
    reimbursed: row.reimbursed,
  };
}

// ─── Expense Card (mobile) ────────────────────────────────────────────────────
function ExpenseCard({
  row,
  projects,
  cats,
  editingId,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDelete,
}: {
  row: ExpenseRow;
  projects: ProjectOption[];
  cats: CatOption[];
  editingId: number | null;
  onEditStart: (row: ExpenseRow) => void;
  onEditCancel: () => void;
  onEditSave: (id: number, draft: EditDraft) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const isEditing = editingId === row.id;
  const [draft, setDraft] = useState<EditDraft>(draftFromRow(row));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<Partial<EditDraft>>({});

  useEffect(() => {
    if (isEditing) {
      setDraft(draftFromRow(row));
      setSaveState("idle");
    }
  }, [isEditing, row]);

  function setD(k: keyof EditDraft, v: string | boolean) {
    setDraft((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  async function save() {
    const errs: Partial<EditDraft> = {};
    if (
      !draft.amount ||
      isNaN(Number(draft.amount)) ||
      Number(draft.amount) <= 0
    )
      errs.amount = "Valid amount required";
    if (!draft.category) errs.category = "Required";
    if (!draft.date) errs.date = "Required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaveState("saving");
    try {
      await onEditSave(row.id, draft);
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  const locked = row.reimbursed;
  const color = catColor(row.category);

  return (
    <div
      style={{
        borderRadius: 16,
        background: isEditing
          ? "linear-gradient(135deg, rgba(79,142,247,0.06) 0%, rgba(255,255,255,0.025) 100%)"
          : T.panel2,
        border: `1px solid ${isEditing ? T.acMid : T.panel2B}`,
        padding: "15px 16px",
        transition: "all 0.25s",
        animation: "fadeUp 0.2s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {!isEditing && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: color,
            borderRadius: "16px 0 0 16px",
            opacity: 0.7,
          }}
        />
      )}
      {!isEditing ? (
        <div style={{ paddingLeft: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.t1,
                  fontFamily: "'Sora',sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {fmtINR(row.amount)}
              </div>
              <div style={{ fontSize: 11, color: T.t5, marginTop: 2 }}>
                {row.date}
              </div>
            </div>
            <ReimbursedBadge reimbursed={row.reimbursed} />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 10,
            }}
          >
            <CategoryBadge category={row.category} label={row.category_label} />
            <span
              style={{
                fontSize: 11,
                color: T.t4,
                padding: "2px 9px",
                borderRadius: 20,
                background: T.panel,
                border: `1px solid ${T.panel2B}`,
              }}
            >
              {row.project_name}
            </span>
          </div>
          {row.remarks && (
            <p
              style={{
                fontSize: 11.5,
                color: T.t4,
                margin: "0 0 10px",
                lineHeight: 1.5,
              }}
            >
              {row.remarks}
            </p>
          )}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <IconBtn
              onClick={() => onEditStart(row)}
              title={locked ? "Reimbursed — locked" : "Edit"}
              color={T.ac}
              disabled={locked}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" />
              </svg>
            </IconBtn>
            <IconBtn
              onClick={() => onDelete(row.id)}
              title={locked ? "Reimbursed — locked" : "Delete"}
              color={T.red}
              disabled={locked}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9" />
              </svg>
            </IconBtn>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: T.ac,
                animation: "pulse 1.5s infinite",
              }}
            />
            <span style={{ fontSize: 11.5, color: T.acText, fontWeight: 600 }}>
              Editing expense
            </span>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}
          >
            <div>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.t4,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Amount (₹)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                style={inputStyle(!!errors.amount)}
                value={draft.amount}
                onChange={(e) => setD("amount", e.target.value)}
              />
              {errors.amount && (
                <span style={{ fontSize: 10, color: T.red }}>
                  {errors.amount}
                </span>
              )}
            </div>
            <div>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.t4,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Date
              </label>
              <input
                type="date"
                style={inputStyle(!!errors.date)}
                value={draft.date}
                onChange={(e) => setD("date", e.target.value)}
              />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.t4,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Category
              </label>
              <select
                style={selStyle(!!errors.category)}
                value={draft.category}
                onChange={(e) => setD("category", e.target.value)}
              >
                {cats.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.t4,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Project
              </label>
              <select
                style={selStyle()}
                value={draft.project_id}
                onChange={(e) => setD("project_id", e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label
                style={{
                  fontSize: 10.5,
                  color: T.t4,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Remarks
              </label>
              <input
                type="text"
                style={inputStyle()}
                value={draft.remarks}
                onChange={(e) => setD("remarks", e.target.value)}
                placeholder="Optional…"
              />
            </div>
            <div
              style={{
                gridColumn: "1/-1",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                id={`reimb-${row.id}`}
                checked={draft.reimbursed}
                onChange={(e) => setD("reimbursed", e.target.checked)}
                style={{
                  width: 15,
                  height: 15,
                  cursor: "pointer",
                  accentColor: T.ac,
                }}
              />
              <label
                htmlFor={`reimb-${row.id}`}
                style={{ fontSize: 12, color: T.t3, cursor: "pointer" }}
              >
                Mark as reimbursed
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={onEditCancel}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                background: "transparent",
                border: `1px solid ${T.panel2B}`,
                color: T.t4,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <SaveButton state={saveState} onClick={save} compact />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Desktop table row ────────────────────────────────────────────────────────
function TableRow({
  row,
  projects,
  cats,
  editingId,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDelete,
}: {
  row: ExpenseRow;
  projects: ProjectOption[];
  cats: CatOption[];
  editingId: number | null;
  onEditStart: (row: ExpenseRow) => void;
  onEditCancel: () => void;
  onEditSave: (id: number, draft: EditDraft) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const isEditing = editingId === row.id;
  const [draft, setDraft] = useState<EditDraft>(draftFromRow(row));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<Partial<EditDraft>>({});
  const [hov, setHov] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setDraft(draftFromRow(row));
      setSaveState("idle");
    }
  }, [isEditing, row]);

  function setD(k: keyof EditDraft, v: string | boolean) {
    setDraft((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  }

  async function save() {
    const errs: Partial<EditDraft> = {};
    if (
      !draft.amount ||
      isNaN(Number(draft.amount)) ||
      Number(draft.amount) <= 0
    )
      errs.amount = "Valid amount required";
    if (!draft.category) errs.category = "Required";
    if (!draft.date) errs.date = "Required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaveState("saving");
    try {
      await onEditSave(row.id, draft);
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2000);
    }
  }

  const locked = row.reimbursed;
  const td: React.CSSProperties = {
    padding: "10px 13px",
    verticalAlign: "middle",
  };
  const inputSm = (err?: boolean): React.CSSProperties => ({
    ...inputStyle(err),
    padding: "5px 9px",
    fontSize: 12,
  });
  const rowBg = isEditing
    ? "linear-gradient(90deg, rgba(79,142,247,0.06) 0%, rgba(255,255,255,0.015) 100%)"
    : hov
      ? T.rowHov
      : "transparent";

  return (
    <tr
      style={{
        borderBottom: `1px solid ${T.divider}`,
        background: rowBg,
        transition: "background 0.15s",
        animation: "fadeUp 0.2s ease",
      }}
      onMouseEnter={() => {
        if (!isEditing) setHov(true);
      }}
      onMouseLeave={() => setHov(false)}
    >
      {isEditing ? (
        <td style={{ width: 3, padding: 0, background: T.ac }} />
      ) : (
        <td style={{ width: 3, padding: 0 }} />
      )}

      <td style={{ ...td, fontSize: 12, color: T.t3, whiteSpace: "nowrap" }}>
        {isEditing ? (
          <input
            type="date"
            style={inputSm(!!errors.date)}
            value={draft.date}
            onChange={(e) => setD("date", e.target.value)}
          />
        ) : (
          row.date
        )}
      </td>
      <td style={td}>
        {isEditing ? (
          <select
            style={{ ...inputSm(), minWidth: 130 }}
            value={draft.project_id}
            onChange={(e) => setD("project_id", e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 12, color: T.t2, whiteSpace: "nowrap" }}>
            {row.project_name}
          </span>
        )}
      </td>
      <td style={td}>
        {isEditing ? (
          <select
            style={inputSm(!!errors.category)}
            value={draft.category}
            onChange={(e) => setD("category", e.target.value)}
          >
            {cats.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <CategoryBadge category={row.category} label={row.category_label} />
        )}
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        {isEditing ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              style={{
                ...inputSm(!!errors.amount),
                width: 110,
                textAlign: "right",
              }}
              value={draft.amount}
              onChange={(e) => setD("amount", e.target.value)}
            />
            {errors.amount && (
              <span style={{ fontSize: 9.5, color: T.red, marginTop: 2 }}>
                {errors.amount}
              </span>
            )}
          </div>
        ) : (
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: T.t1,
              fontFamily: "'Sora',sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            {fmtINR(row.amount)}
          </span>
        )}
      </td>
      <td style={{ ...td, maxWidth: 160 }}>
        {isEditing ? (
          <input
            type="text"
            style={inputSm()}
            value={draft.remarks}
            onChange={(e) => setD("remarks", e.target.value)}
            placeholder="Optional…"
          />
        ) : (
          <span
            style={{
              fontSize: 11.5,
              color: T.t4,
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.remarks || <span style={{ color: T.t6 }}>—</span>}
          </span>
        )}
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        {isEditing ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <input
              type="checkbox"
              id={`tr-reimb-${row.id}`}
              checked={draft.reimbursed}
              onChange={(e) => setD("reimbursed", e.target.checked)}
              style={{
                width: 14,
                height: 14,
                accentColor: T.ac,
                cursor: "pointer",
              }}
            />
            <label
              htmlFor={`tr-reimb-${row.id}`}
              style={{ fontSize: 11, color: T.t3, cursor: "pointer" }}
            >
              Paid
            </label>
          </div>
        ) : (
          <ReimbursedBadge reimbursed={row.reimbursed} />
        )}
      </td>
      <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
        {isEditing ? (
          <div
            style={{
              display: "flex",
              gap: 6,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <SaveButton state={saveState} onClick={save} compact />
            <button
              onClick={onEditCancel}
              style={{
                padding: "6px 11px",
                borderRadius: 8,
                fontSize: 11.5,
                background: "transparent",
                border: `1px solid ${T.panel2B}`,
                color: T.t4,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            <IconBtn
              onClick={() => onEditStart(row)}
              title={locked ? "Reimbursed — locked" : "Edit"}
              color={T.ac}
              disabled={locked}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" />
              </svg>
            </IconBtn>
            <IconBtn
              onClick={() => onDelete(row.id)}
              title={locked ? "Reimbursed — locked" : "Delete"}
              color={T.red}
              disabled={locked}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9" />
              </svg>
            </IconBtn>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyExpensePage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [cw, setCw] = useState(9999);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width));
    ro.observe(containerRef.current);
    setCw(containerRef.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const isMobile = cw < 760;

  // ── Meta ──────────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [cats, setCats] = useState<CatOption[]>([]);
  useEffect(() => {
    fetchExpenseMeta()
      .then((d) => {
        setProjects(d.projects);
        setCats(d.categories);
      })
      .catch(console.error);
  }, []);

  // ── Calendar state ────────────────────────────────────────────────────────
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterProject, setFilterProject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterReimbursed, setFilterReimbursed] = useState("all");

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Active dates for calendar dots ────────────────────────────────────────
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // ── Build date range from selection ──────────────────────────────────────
  const { dateFrom, dateTo } = useMemo(() => {
    if (selDates.size > 0) {
      const sorted = Array.from(selDates).sort();
      return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
    }
    if (selMonth !== null) {
      const y = selYear ?? calYear;
      const m = String(selMonth + 1).padStart(2, "0");
      const lastDay = getDaysInMonth(y, selMonth);
      return { dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-${lastDay}` };
    }
    if (selYear !== null) {
      return { dateFrom: `${selYear}-01-01`, dateTo: `${selYear}-12-31` };
    }
    return { dateFrom: "", dateTo: "" };
  }, [selDates, selMonth, selYear, calYear]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyExpenses({
      project_id: filterProject || undefined,
      category: filterCategory || undefined,
      reimbursed: filterReimbursed as "true" | "false" | "all",
      from: dateFrom || undefined,
      to: dateTo || undefined,
      page,
    })
      .then((d) => {
        setData(d);
        setActiveDates(new Set(d.results.map((r: ExpenseRow) => r.date)));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterProject, filterCategory, filterReimbursed, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    setPage(1);
  }, [filterProject, filterCategory, filterReimbursed, dateFrom, dateTo]);

  // ── Sort rows client-side (within loaded page) ────────────────────────────
  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.results];
    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortField) {
        case "date":
          av = a.date;
          bv = b.date;
          break;
        case "project":
          av = a.project_name;
          bv = b.project_name;
          break;
        case "category":
          av = a.category;
          bv = b.category;
          break;
        case "amount":
          av = a.amount;
          bv = b.amount;
          break;
        case "reimbursed":
          av = String(a.reimbursed);
          bv = String(b.reimbursed);
          break;
      }
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [data, sortField, sortDir]);

  // ── Calendar helpers ──────────────────────────────────────────────────────
  function toggleDate(iso: string) {
    setSelDates((p) => {
      const n = new Set(p);
      if (n.has(iso)) {
        n.delete(iso);
      } else {
        n.add(iso);
      }
      return n;
    });
  }
  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  }

  function handleSort(f: SortField) {
    if (sortField === f) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(f);
      setSortDir("asc");
    }
  }

  function clearAll() {
    setSelDates(new Set());
    setSelMonth(null);
    setSelYear(null);
    setFilterProject("");
    setFilterCategory("");
    setFilterReimbursed("all");
  }

  const availableYears = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  const hasFilter =
    selDates.size > 0 ||
    selMonth !== null ||
    selYear !== null ||
    filterProject ||
    filterCategory ||
    filterReimbursed !== "all";

  const summary: Summary | undefined = data?.summary;
  const totalPages = data?.pages ?? 1;

  // ── Edit / delete handlers ────────────────────────────────────────────────
  function handleEditStart(row: ExpenseRow) {
    setEditingId(row.id);
    setShowAddForm(false);
  }
  function handleEditCancel() {
    setEditingId(null);
  }

  async function handleEditSave(id: number, draft: EditDraft) {
    try {
      const updated = await updateMyExpense(id, {
        project_id: Number(draft.project_id),
        amount: Number(draft.amount),
        category: draft.category,
        date: draft.date,
        remarks: draft.remarks,
        reimbursed: draft.reimbursed,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              results: prev.results.map((r) => (r.id === id ? updated : r)),
            }
          : prev,
      );
      setEditingId(null);
      setToast({ msg: "Expense updated successfully", type: "success" });
    } catch {
      setEditingId(null);
      setToast({ msg: "Saved — refreshing to confirm", type: "success" });
      fetchData();
    }
  }

  async function handleDeleteConfirm() {
    if (deleteConfirm === null) return;
    try {
      await deleteMyExpense(deleteConfirm);
      setData((prev) =>
        prev
          ? {
              ...prev,
              count: prev.count - 1,
              results: prev.results.filter((r) => r.id !== deleteConfirm),
            }
          : prev,
      );
      setToast({ msg: "Expense deleted", type: "success" });
    } catch (e) {
      setError((e as Error).message);
      setToast({ msg: "Failed to delete", type: "error" });
    } finally {
      setDeleteConfirm(null);
    }
  }

  function handleCreated(row: ExpenseRow) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            count: prev.count + 1,
            results: [row, ...prev.results].slice(0, 20),
          }
        : prev,
    );
    setToast({ msg: "Expense added", type: "success" });
  }

  // ── Left panel select style ───────────────────────────────────────────────
  const sel: React.CSSProperties = {
    width: "100%",
    background: T.panel2,
    border: `1px solid ${T.panel2B}`,
    borderRadius: 7,
    padding: "6px 9px",
    fontSize: 11.5,
    color: T.t2,
    outline: "none",
    fontFamily: "'DM Sans',sans-serif",
    cursor: "pointer",
    appearance: "none",
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: T.bgGrad,
        color: T.t2,
        fontFamily: "'DM Sans','Sora',sans-serif",
        padding: isMobile ? "20px 14px 80px" : "32px 28px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        select option { background: #0f1220; color: #e2e8f0; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.45); cursor: pointer; }
        input:focus, select:focus { border-color: ${T.acMid} !important; box-shadow: 0 0 0 3px ${T.acLight} !important; }
        .tbl-wrap::-webkit-scrollbar { height: 5px; }
        .tbl-wrap::-webkit-scrollbar-thumb { background: rgba(79,142,247,0.3); border-radius: 99px; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(16px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes successPop { 0%{transform:scale(1)} 50%{transform:scale(1.06)} 100%{transform:scale(1)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
      `}</style>

      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteConfirm !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#10141f",
              border: `1px solid ${T.panelB}`,
              borderRadius: 18,
              padding: "26px 28px",
              maxWidth: 360,
              width: "100%",
              animation: "scaleIn 0.18s cubic-bezier(0.34,1.56,0.64,1)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: T.redBg,
                border: `1px solid ${T.red}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 16 16"
                fill="none"
                stroke={T.red}
                strokeWidth={1.8}
              >
                <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.t1,
                marginBottom: 8,
                fontFamily: "'Sora',sans-serif",
              }}
            >
              Delete Expense?
            </div>
            <p
              style={{
                fontSize: 13,
                color: T.t4,
                marginBottom: 22,
                lineHeight: 1.6,
              }}
            >
              This action is permanent and cannot be undone.
            </p>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  background: "transparent",
                  border: `1px solid ${T.panel2B}`,
                  color: T.t4,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: "8px 20px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: T.red,
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: T.acLight,
                border: `1px solid ${T.acMid}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <rect
                  x={2}
                  y={6}
                  width={20}
                  height={13}
                  rx={2.5}
                  stroke={T.acText}
                  strokeWidth={1.6}
                />
                <path
                  d="M2 11h20M6 16h4"
                  stroke={T.acText}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: isMobile ? 20 : 24,
                  fontWeight: 700,
                  fontFamily: "'Sora',sans-serif",
                  letterSpacing: "-0.035em",
                  color: T.t1,
                  margin: 0,
                }}
              >
                My Expenses
              </h1>
              <p style={{ color: T.t5, fontSize: 12, margin: 0, marginTop: 1 }}>
                Track and manage your expenditure
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowAddForm((p) => !p);
              setEditingId(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: 11,
              background: showAddForm ? T.panel2 : T.ac,
              border: `1px solid ${showAddForm ? T.panel2B : "transparent"}`,
              color: showAddForm ? T.t3 : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              {showAddForm ? (
                <path d="M3 3l10 10M13 3L3 13" />
              ) : (
                <path d="M8 2v12M2 8h12" />
              )}
            </svg>
            {!isMobile && (showAddForm ? "Cancel" : "Add Expense")}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ marginBottom: 18, animation: "fadeUp 0.2s ease" }}>
          <AddExpensePanel
            projects={projects}
            cats={cats}
            onClose={() => setShowAddForm(false)}
            onCreated={handleCreated}
          />
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 14,
            background: T.redBg,
            border: `1px solid ${T.red}33`,
            color: T.red,
            fontSize: 13,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx={8} cy={8} r={6} />
            <path d="M8 5v3M8 10v1" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Two-column layout: left panel + right content ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "256px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* ── LEFT PANEL ── */}
        <div
          style={{
            background: T.panel,
            border: `1px solid ${T.panelB}`,
            borderRadius: 16,
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Calendar nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={prevMonth}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: T.panel2,
                border: `1px solid ${T.panel2B}`,
                color: T.t4,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.t2 }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button
              onClick={nextMonth}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: T.panel2,
                border: `1px solid ${T.panel2B}`,
                color: T.t4,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ›
            </button>
          </div>

          <CalGrid
            year={calYear}
            month={calMonth}
            activeDates={activeDates}
            selDates={selDates}
            onToggle={toggleDate}
          />

          {selDates.size > 0 && (
            <div style={{ textAlign: "center", fontSize: 11, color: T.acText }}>
              {selDates.size} date{selDates.size > 1 ? "s" : ""} selected &nbsp;
              <button
                onClick={() => setSelDates(new Set())}
                style={{
                  background: "none",
                  border: "none",
                  color: T.red,
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                ✕
              </button>
            </div>
          )}

          <Divider />

          {/* Filters */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.t5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Filters
            </div>

            <label
              style={{
                fontSize: 11,
                color: T.t4,
                display: "block",
                marginBottom: 3,
              }}
            >
              Project
            </label>
            <select
              style={{ ...sel, marginBottom: 8 }}
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <label
              style={{
                fontSize: 11,
                color: T.t4,
                display: "block",
                marginBottom: 3,
              }}
            >
              Category
            </label>
            <select
              style={{ ...sel, marginBottom: 8 }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {cats.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <label
              style={{
                fontSize: 11,
                color: T.t4,
                display: "block",
                marginBottom: 3,
              }}
            >
              Status
            </label>
            <select
              style={sel}
              value={filterReimbursed}
              onChange={(e) => setFilterReimbursed(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="true">Reimbursed</option>
              <option value="false">Pending</option>
            </select>
          </div>

          <Divider />

          {/* Month pills */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.t5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Month
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 4,
              }}
            >
              {MONTHS.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setSelMonth(selMonth === i ? null : i)}
                  style={{
                    background: selMonth === i ? T.acLight : T.panel2,
                    border: `1px solid ${selMonth === i ? T.acMid : T.panel2B}`,
                    borderRadius: 6,
                    color: selMonth === i ? T.acText : T.t4,
                    fontSize: 10,
                    padding: "5px 0",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontWeight: selMonth === i ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Year pills */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.t5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Year
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setSelYear(selYear === y ? null : y)}
                  style={{
                    background: selYear === y ? T.acLight : T.panel2,
                    border: `1px solid ${selYear === y ? T.acMid : T.panel2B}`,
                    borderRadius: 6,
                    color: selYear === y ? T.acText : T.t4,
                    fontSize: 10,
                    padding: "5px 10px",
                    cursor: "pointer",
                    fontWeight: selYear === y ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Summary stats */}
          {summary && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.t5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Summary
              </div>
              <StatCard
                label="Entries"
                value={String(data?.count ?? 0)}
                color={T.acText}
              />
              <StatCard
                label="Total"
                value={fmtINR(summary.total)}
                color={T.t2}
              />
              <StatCard
                label="Reimbursed"
                value={fmtINR(summary.reimbursed)}
                color={T.green}
              />
              <StatCard
                label="Pending"
                value={fmtINR(summary.pending)}
                color={T.amber}
              />
            </div>
          )}

          {/* Category breakdown */}
          {summary && Object.keys(summary.by_category ?? {}).length > 0 && (
            <>
              <Divider />
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.t5,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  By Category
                </div>
                {cats.map((cat) => {
                  const val =
                    (summary.by_category as Record<string, number>)?.[
                      cat.value
                    ] ?? 0;
                  if (!val) return null;
                  const pct = summary.total > 0 ? val / summary.total : 0;
                  const color = catColor(cat.value);
                  return (
                    <div key={cat.value} style={{ marginBottom: 9 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ fontSize: 11, color: T.t4 }}>
                          {cat.label}
                        </span>
                        <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                          {fmtINR(val)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 3,
                          borderRadius: 99,
                          background: T.panel2B,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 99,
                            background: color,
                            width: `${pct * 100}%`,
                            transition: "width 0.4s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {hasFilter && (
            <>
              <Divider />
              <button
                onClick={clearAll}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.panel2B}`,
                  borderRadius: 8,
                  padding: "7px 0",
                  fontSize: 12,
                  color: T.t4,
                  cursor: "pointer",
                  width: "100%",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = T.t2;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = T.t4;
                }}
              >
                ✕ &nbsp;Clear all filters
              </button>
            </>
          )}
        </div>

        {/* ── RIGHT: Table / Cards ── */}
        <div>
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              ) : (data?.results ?? []).length === 0 ? (
                <EmptyState msg="No expenses found" />
              ) : (
                sortedRows.map((row) => (
                  <ExpenseCard
                    key={row.id}
                    row={row}
                    projects={projects}
                    cats={cats}
                    editingId={editingId}
                    onEditStart={handleEditStart}
                    onEditCancel={handleEditCancel}
                    onEditSave={handleEditSave}
                    onDelete={(id) => setDeleteConfirm(id)}
                  />
                ))
              )}
            </div>
          ) : (
            <div
              style={{
                background: T.panel,
                border: `1px solid ${T.panelB}`,
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div className="tbl-wrap" style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 800,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        borderBottom: `1px solid ${T.panel2B}`,
                      }}
                    >
                      <th style={{ width: 3, padding: 0 }} />
                      <ThCell
                        field="date"
                        w={112}
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      >
                        Date
                      </ThCell>
                      <ThCell
                        field="project"
                        w={150}
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      >
                        Project
                      </ThCell>
                      <ThCell
                        field="category"
                        w={120}
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                      >
                        Category
                      </ThCell>
                      <ThCell
                        field="amount"
                        w={110}
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                        align="right"
                      >
                        Amount
                      </ThCell>
                      <th style={{ padding: 0, whiteSpace: "nowrap" }}>
                        <div
                          style={{
                            padding: "11px 13px 8px",
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: T.t5,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                          }}
                        >
                          Remarks
                        </div>
                      </th>
                      <ThCell
                        field="reimbursed"
                        w={90}
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={handleSort}
                        align="center"
                      >
                        Status
                      </ThCell>
                      <th style={{ padding: 0, whiteSpace: "nowrap" }}>
                        <div
                          style={{
                            padding: "11px 13px 8px",
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: T.t5,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            textAlign: "center",
                          }}
                        >
                          Actions
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: `1px solid ${T.divider}` }}
                        >
                          <td style={{ width: 3 }} />
                          {[100, 140, 110, 80, 140, 80, 70].map((w, j) => (
                            <td key={j} style={{ padding: "11px 13px" }}>
                              <div
                                style={{
                                  height: 11,
                                  width: w,
                                  borderRadius: 6,
                                  background: "rgba(255,255,255,0.05)",
                                  animation: `pulse 1.6s ease-in-out ${j * 0.06}s infinite`,
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : sortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <EmptyState msg="No expenses found" />
                        </td>
                      </tr>
                    ) : (
                      sortedRows.map((row) => (
                        <TableRow
                          key={row.id}
                          row={row}
                          projects={projects}
                          cats={cats}
                          editingId={editingId}
                          onEditStart={handleEditStart}
                          onEditCancel={handleEditCancel}
                          onEditSave={handleEditSave}
                          onDelete={(id) => setDeleteConfirm(id)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.count > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderTop: `1px solid ${T.divider}`,
                    background: "rgba(255,255,255,0.012)",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11.5,
                      color: T.t5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Showing{" "}
                    <span style={{ color: T.t3, fontWeight: 600 }}>
                      {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)}
                    </span>{" "}
                    of{" "}
                    <span style={{ color: T.t3, fontWeight: 600 }}>
                      {data.count}
                    </span>{" "}
                    expenses
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: `1px solid ${T.panel2B}`,
                        background: page === 1 ? "transparent" : T.panel2,
                        color: page === 1 ? T.t6 : T.t4,
                        cursor: page === 1 ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      ‹
                    </button>

                    {(() => {
                      const pages: (number | "…")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (page > 3) pages.push("…");
                        for (
                          let i = Math.max(2, page - 1);
                          i <= Math.min(totalPages - 1, page + 1);
                          i++
                        )
                          pages.push(i);
                        if (page < totalPages - 2) pages.push("…");
                        pages.push(totalPages);
                      }
                      return pages.map((p, i) =>
                        p === "…" ? (
                          <span
                            key={`e${i}`}
                            style={{
                              width: 30,
                              textAlign: "center",
                              fontSize: 12,
                              color: T.t5,
                            }}
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              border: "none",
                              background: page === p ? T.ac : T.panel2,
                              color: page === p ? "#fff" : T.t4,
                              fontWeight: page === p ? 700 : 400,
                              cursor: "pointer",
                              fontSize: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "'DM Sans',sans-serif",
                            }}
                          >
                            {p}
                          </button>
                        ),
                      );
                    })()}

                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: `1px solid ${T.panel2B}`,
                        background:
                          page === totalPages ? "transparent" : T.panel2,
                        color: page === totalPages ? T.t6 : T.t4,
                        cursor: page === totalPages ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile pagination */}
          {isMobile && data && data.count > 20 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 18,
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "9px 22px",
                  borderRadius: 10,
                  border: `1px solid ${T.panel2B}`,
                  background: T.panel2,
                  color: page === 1 ? T.t6 : T.t3,
                  fontSize: 12.5,
                  cursor: page === 1 ? "default" : "pointer",
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: T.t4, alignSelf: "center" }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: "9px 22px",
                  borderRadius: 10,
                  border: `1px solid ${T.panel2B}`,
                  background: T.panel2,
                  color: page === totalPages ? T.t6 : T.t3,
                  fontSize: 12.5,
                  cursor: page === totalPages ? "default" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
