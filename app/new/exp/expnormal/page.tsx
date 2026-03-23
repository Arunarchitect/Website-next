"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  fetchMyExpenses,
  fetchExpenseMeta,
  createMyExpense,
  updateMyExpense,
  deleteMyExpense,
  type MyExpenseRow    as ExpenseRow,
  type MyExpenseResult as PageResult,
  type MyExpenseSummary as Summary,
  type ExpenseProjectOption as ProjectOption,
  type ExpenseCategoryOption as CatOption,
} from "@/app/new/myExpenseApi";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#0b0e18",
  panel:   "rgba(255,255,255,0.022)",
  panelB:  "rgba(255,255,255,0.07)",
  panel2:  "rgba(255,255,255,0.04)",
  panel2B: "rgba(255,255,255,0.09)",
  rowHov:  "rgba(255,255,255,0.035)",
  editRow: "rgba(79,142,247,0.07)",
  divider: "rgba(255,255,255,0.055)",
  t1: "#f0f4ff", t2: "#e2e8f0", t3: "#94a3b8",
  t4: "#64748b", t5: "#475569", t6: "#2d3748",
  ac:      "#4f8ef7",
  acLight: "rgba(79,142,247,0.12)",
  acMid:   "rgba(79,142,247,0.5)",
  acText:  "#7eb3ff",
  green:   "#22d3a5", greenBg: "rgba(34,211,165,0.1)",
  red:     "#f87171", redBg:   "rgba(248,113,113,0.1)",
  amber:   "#fbbf24", amberBg: "rgba(251,191,36,0.1)",
  purple:  "#a78bfa",
  teal:    "#2dd4bf",
  indigo:  "#818cf8",
};

const CAT_COLORS: Record<string, string> = {
  travel:        T.ac,
  food:          T.green,
  accommodation: T.amber,
  stationery:    T.purple,
  salary:        T.teal,
  projectshare:  T.indigo,
  others:        T.t3,
};
function catColor(c: string) { return CAT_COLORS[c] ?? T.t3; }

const Divider = () => (
  <div style={{ height: 1, background: T.divider, margin: "4px 0" }} />
);

// ─── Shared input / select styles ─────────────────────────────────────────────
const inputStyle = (err?: boolean): React.CSSProperties => ({
  width: "100%", background: T.panel2,
  border: `1px solid ${err ? T.red : T.panel2B}`,
  borderRadius: 7, padding: "7px 10px",
  fontSize: 12, color: T.t2, outline: "none",
  fontFamily: "'DM Sans',sans-serif",
  appearance: "none" as const,
});
const selStyle = (err?: boolean): React.CSSProperties => ({
  ...inputStyle(err), cursor: "pointer",
});

// ─── Category badge ───────────────────────────────────────────────────────────
function CategoryBadge({ category, label }: { category: string; label: string }) {
  const color = catColor(category);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 20,
      background: color + "22", border: `1px solid ${color}44`,
      fontSize: 10.5, fontWeight: 600, color,
      textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ─── Reimbursed badge ─────────────────────────────────────────────────────────
function ReimbursedBadge({ reimbursed }: { reimbursed: boolean }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 20,
      background: reimbursed ? T.greenBg : T.amberBg,
      color: reimbursed ? T.green : T.amber,
      fontSize: 10.5, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {reimbursed ? "Paid" : "Pending"}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 100,
      display: "flex", flexDirection: "column", gap: 2,
      padding: "10px 14px", borderRadius: 12,
      background: T.panel2, border: `1px solid ${T.panel2B}`,
    }}>
      <span style={{ fontSize: 10.5, color: T.t5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ─── Icon buttons ─────────────────────────────────────────────────────────────
function IconBtn({ onClick, title, color, children, disabled }: {
  onClick: () => void; title: string; color: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 30, height: 30, borderRadius: 8,
        border: `1px solid ${color}44`,
        background: color + "18",
        color, cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s", opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", gap: 12, color: T.t6,
    }}>
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
        <rect x={2} y={5} width={20} height={14} rx={2}/>
        <path d="M2 10h20"/>
      </svg>
      <span style={{ fontSize: 13.5 }}>{msg}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 12, padding: "14px 16px",
      background: T.panel2, border: `1px solid ${T.panel2B}`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {[80, 140, 100].map((w, i) => (
        <div key={i} style={{
          height: 12, width: w, borderRadius: 6,
          background: "rgba(255,255,255,0.06)",
          animation: "pulse 1.5s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

// ─── Add Expense Form (modal-like panel) ──────────────────────────────────────
interface AddFormState {
  project_id: string;
  amount:     string;
  category:   string;
  date:       string;
  remarks:    string;
  reimbursed: boolean;
}

function AddExpensePanel({
  projects, cats, onClose, onCreated,
}: {
  projects: ProjectOption[];
  cats:     CatOption[];
  onClose:  () => void;
  onCreated: (row: ExpenseRow) => void;
}) {
  const [form, setForm] = useState<AddFormState>({
    project_id: "", amount: "", category: "", date: today(), remarks: "", reimbursed: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AddFormState, string>>>({});
  const [saving, setSaving] = useState(false);

  function set(k: keyof AddFormState, v: string | boolean) {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  async function submit() {
    const errs: typeof errors = {};
    if (!form.project_id) errs.project_id = "Required";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) errs.amount = "Enter a valid amount > 0";
    if (!form.category)   errs.category   = "Required";
    if (!form.date)       errs.date       = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const row = await createMyExpense({
        project_id: Number(form.project_id),
        amount:     Number(form.amount),
        category:   form.category,
        date:       form.date,
        remarks:    form.remarks,
        reimbursed: form.reimbursed,
      });
      onCreated(row);
      onClose();
    } catch {
      setErrors({ remarks: "Failed to save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.panelB}`,
      borderRadius: 16, padding: "20px 18px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>Add Expense</span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: T.t4,
          cursor: "pointer", fontSize: 18, lineHeight: 1,
        }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Project */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 4 }}>Project *</label>
          <select style={selStyle(!!errors.project_id)} value={form.project_id}
            onChange={e => set("project_id", e.target.value)}>
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.project_id && <span style={{ fontSize: 10.5, color: T.red }}>{errors.project_id}</span>}
        </div>

        {/* Amount */}
        <div>
          <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 4 }}>Amount (₹) *</label>
          <input
            type="number" min="0.01" step="0.01"
            style={inputStyle(!!errors.amount)} value={form.amount}
            onChange={e => set("amount", e.target.value)}
            placeholder="0.00"
          />
          {errors.amount && <span style={{ fontSize: 10.5, color: T.red }}>{errors.amount}</span>}
        </div>

        {/* Date */}
        <div>
          <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 4 }}>Date *</label>
          <input
            type="date" style={inputStyle(!!errors.date)} value={form.date}
            onChange={e => set("date", e.target.value)}
          />
          {errors.date && <span style={{ fontSize: 10.5, color: T.red }}>{errors.date}</span>}
        </div>

        {/* Category */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 4 }}>Category *</label>
          <select style={selStyle(!!errors.category)} value={form.category}
            onChange={e => set("category", e.target.value)}>
            <option value="">Select category…</option>
            {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {errors.category && <span style={{ fontSize: 10.5, color: T.red }}>{errors.category}</span>}
        </div>

        {/* Remarks */}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 11, color: T.t4, display: "block", marginBottom: 4 }}>Remarks</label>
          <input
            type="text" style={inputStyle()} value={form.remarks}
            onChange={e => set("remarks", e.target.value)}
            placeholder="Optional note…"
          />
          {errors.remarks && <span style={{ fontSize: 10.5, color: T.red }}>{errors.remarks}</span>}
        </div>

        {/* Reimbursed toggle */}
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox" id="add-reimb"
            checked={form.reimbursed}
            onChange={e => set("reimbursed", e.target.checked)}
            style={{ width: 15, height: 15, cursor: "pointer", accentColor: T.ac }}
          />
          <label htmlFor="add-reimb" style={{ fontSize: 12, color: T.t3, cursor: "pointer" }}>
            Mark as reimbursed
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{
          padding: "7px 16px", borderRadius: 8, fontSize: 12,
          background: "transparent", border: `1px solid ${T.panel2B}`,
          color: T.t4, cursor: "pointer",
        }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{
          padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: T.ac, border: "none", color: "#fff",
          cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        }}>{saving ? "Saving…" : "Add Expense"}</button>
      </div>
    </div>
  );
}

// ─── Inline edit row state ────────────────────────────────────────────────────
interface EditDraft {
  project_id: string;
  amount:     string;
  category:   string;
  date:       string;
  remarks:    string;
  reimbursed: boolean;
}

function draftFromRow(row: ExpenseRow): EditDraft {
  return {
    project_id: String(row.project_id),
    amount:     String(row.amount),
    category:   row.category,
    date:       row.date,
    remarks:    row.remarks,
    reimbursed: row.reimbursed,
  };
}

// ─── Expense Card (mobile) ────────────────────────────────────────────────────
function ExpenseCard({
  row, projects, cats,
  editingId, onEditStart, onEditCancel, onEditSave, onDelete,
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
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<EditDraft>>({});

  useEffect(() => {
    if (isEditing) setDraft(draftFromRow(row));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  function setD(k: keyof EditDraft, v: string | boolean) {
    setDraft(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  async function save() {
    const errs: Partial<EditDraft> = {};
    if (!draft.amount || isNaN(Number(draft.amount)) || Number(draft.amount) <= 0)
      errs.amount = "Enter a valid amount > 0";
    if (!draft.category) errs.category = "Required";
    if (!draft.date) errs.date = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onEditSave(row.id, draft);
    } finally {
      setSaving(false);
    }
  }

  const locked = row.reimbursed;

  return (
    <div style={{
      borderRadius: 14,
      background: isEditing ? T.editRow : T.panel2,
      border: `1px solid ${isEditing ? T.acMid : T.panel2B}`,
      padding: "14px 16px",
      transition: "all 0.2s",
      animation: "fadeIn 0.2s ease",
    }}>
      {!isEditing ? (
        /* ── View mode ── */
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{fmtINR(row.amount)}</span>
              <span style={{ fontSize: 11.5, color: T.t3 }}>{row.date}</span>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <ReimbursedBadge reimbursed={row.reimbursed} />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            <CategoryBadge category={row.category} label={row.category_label} />
            <span style={{
              fontSize: 11, color: T.t4, padding: "2px 8px",
              borderRadius: 20, background: T.panel, border: `1px solid ${T.panel2B}`,
            }}>{row.project_name}</span>
          </div>

          {row.remarks && (
            <p style={{ fontSize: 11.5, color: T.t4, margin: "0 0 8px", lineHeight: 1.4 }}>
              {row.remarks}
            </p>
          )}

          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <IconBtn
              onClick={() => onEditStart(row)}
              title={locked ? "Reimbursed — cannot edit" : "Edit"}
              color={T.ac}
              disabled={locked}
            >
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z"/>
              </svg>
            </IconBtn>
            <IconBtn
              onClick={() => onDelete(row.id)}
              title={locked ? "Reimbursed — cannot delete" : "Delete"}
              color={T.red}
              disabled={locked}
            >
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9"/>
              </svg>
            </IconBtn>
          </div>
        </div>
      ) : (
        /* ── Edit mode ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {/* Amount */}
            <div>
              <label style={{ fontSize: 10.5, color: T.t4, display: "block", marginBottom: 3 }}>Amount (₹)</label>
              <input
                type="number" min="0.01" step="0.01"
                style={inputStyle(!!errors.amount)} value={draft.amount}
                onChange={e => setD("amount", e.target.value)}
              />
              {errors.amount && <span style={{ fontSize: 10, color: T.red }}>{errors.amount}</span>}
            </div>

            {/* Date */}
            <div>
              <label style={{ fontSize: 10.5, color: T.t4, display: "block", marginBottom: 3 }}>Date</label>
              <input
                type="date" style={inputStyle(!!errors.date)} value={draft.date}
                onChange={e => setD("date", e.target.value)}
              />
              {errors.date && <span style={{ fontSize: 10, color: T.red }}>{errors.date}</span>}
            </div>

            {/* Category */}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 10.5, color: T.t4, display: "block", marginBottom: 3 }}>Category</label>
              <select style={selStyle(!!errors.category)} value={draft.category}
                onChange={e => setD("category", e.target.value)}>
                {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.category && <span style={{ fontSize: 10, color: T.red }}>{errors.category}</span>}
            </div>

            {/* Project */}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 10.5, color: T.t4, display: "block", marginBottom: 3 }}>Project</label>
              <select style={selStyle()} value={draft.project_id}
                onChange={e => setD("project_id", e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Remarks */}
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ fontSize: 10.5, color: T.t4, display: "block", marginBottom: 3 }}>Remarks</label>
              <input
                type="text" style={inputStyle()} value={draft.remarks}
                onChange={e => setD("remarks", e.target.value)}
                placeholder="Optional…"
              />
            </div>

            {/* Reimbursed */}
            <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox" id={`reimb-${row.id}`}
                checked={draft.reimbursed}
                onChange={e => setD("reimbursed", e.target.checked)}
                style={{ width: 15, height: 15, cursor: "pointer", accentColor: T.ac }}
              />
              <label htmlFor={`reimb-${row.id}`} style={{ fontSize: 12, color: T.t3, cursor: "pointer" }}>
                Mark as reimbursed
              </label>
            </div>
          </div>

          {/* Save / Cancel */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onEditCancel} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12,
              background: "transparent", border: `1px solid ${T.panel2B}`,
              color: T.t4, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: T.green, border: "none", color: "#0b0e18",
              cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M2 8l4 4 8-8"/>
              </svg>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Desktop table row ────────────────────────────────────────────────────────
function TableRow({
  row, projects, cats,
  editingId, onEditStart, onEditCancel, onEditSave, onDelete,
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
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<EditDraft>>({});

  useEffect(() => {
    if (isEditing) setDraft(draftFromRow(row));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  function setD(k: keyof EditDraft, v: string | boolean) {
    setDraft(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  async function save() {
    const errs: Partial<EditDraft> = {};
    if (!draft.amount || isNaN(Number(draft.amount)) || Number(draft.amount) <= 0)
      errs.amount = "Valid amount required";
    if (!draft.category) errs.category = "Required";
    if (!draft.date)     errs.date     = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try { await onEditSave(row.id, draft); }
    finally { setSaving(false); }
  }

  const locked = row.reimbursed;
  const tdBase: React.CSSProperties = { padding: "9px 12px", verticalAlign: "middle" };
  const inputCompact = (err?: boolean): React.CSSProperties => ({
    ...inputStyle(err), padding: "5px 8px", fontSize: 11.5,
  });

  return (
    <tr
      style={{
        borderBottom: `1px solid ${T.divider}`,
        background: isEditing ? T.editRow : "transparent",
        transition: "background 0.15s",
        animation: "fadeIn 0.2s ease",
      }}
      onMouseEnter={e => { if (!isEditing) (e.currentTarget as HTMLElement).style.background = T.rowHov; }}
      onMouseLeave={e => { if (!isEditing) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Date */}
      <td style={{ ...tdBase, fontSize: 12, color: T.t3, whiteSpace: "nowrap" }}>
        {isEditing
          ? <input type="date" style={inputCompact(!!errors.date)} value={draft.date}
              onChange={e => setD("date", e.target.value)} />
          : row.date}
      </td>

      {/* Project */}
      <td style={{ ...tdBase }}>
        {isEditing
          ? (
            <select style={{ ...inputCompact(), minWidth: 120 }} value={draft.project_id}
              onChange={e => setD("project_id", e.target.value)}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )
          : <span style={{ fontSize: 12, color: T.t2, whiteSpace: "nowrap" }}>{row.project_name}</span>}
      </td>

      {/* Category */}
      <td style={{ ...tdBase }}>
        {isEditing
          ? (
            <select style={inputCompact(!!errors.category)} value={draft.category}
              onChange={e => setD("category", e.target.value)}>
              {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          )
          : <CategoryBadge category={row.category} label={row.category_label} />}
      </td>

      {/* Amount */}
      <td style={{ ...tdBase, textAlign: "right" }}>
        {isEditing
          ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <input type="number" min="0.01" step="0.01"
                style={{ ...inputCompact(!!errors.amount), width: 100, textAlign: "right" }}
                value={draft.amount} onChange={e => setD("amount", e.target.value)} />
              {errors.amount && <span style={{ fontSize: 9.5, color: T.red }}>{errors.amount}</span>}
            </div>
          )
          : <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, whiteSpace: "nowrap" }}>{fmtINR(row.amount)}</span>}
      </td>

      {/* Remarks */}
      <td style={{ ...tdBase, maxWidth: 160 }}>
        {isEditing
          ? <input type="text" style={inputCompact()} value={draft.remarks}
              onChange={e => setD("remarks", e.target.value)} placeholder="Optional…" />
          : (
            <span style={{ fontSize: 11.5, color: T.t4, display: "block",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.remarks || <span style={{ color: T.t6 }}>—</span>}
            </span>
          )}
      </td>

      {/* Status */}
      <td style={{ ...tdBase, textAlign: "center" }}>
        {isEditing
          ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <input type="checkbox" id={`tr-reimb-${row.id}`}
                checked={draft.reimbursed}
                onChange={e => setD("reimbursed", e.target.checked)}
                style={{ width: 14, height: 14, accentColor: T.ac, cursor: "pointer" }} />
              <label htmlFor={`tr-reimb-${row.id}`}
                style={{ fontSize: 11, color: T.t3, cursor: "pointer" }}>Paid</label>
            </div>
          )
          : <ReimbursedBadge reimbursed={row.reimbursed} />}
      </td>

      {/* Actions */}
      <td style={{ ...tdBase, textAlign: "center", whiteSpace: "nowrap" }}>
        {isEditing ? (
          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            <IconBtn onClick={save} title="Save" color={T.green} disabled={saving}>
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.2}>
                <path d="M2 8l4 4 8-8"/>
              </svg>
            </IconBtn>
            <IconBtn onClick={onEditCancel} title="Cancel" color={T.t4}>
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 3l10 10M13 3L3 13"/>
              </svg>
            </IconBtn>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
            <IconBtn
              onClick={() => onEditStart(row)}
              title={locked ? "Reimbursed — locked" : "Edit"}
              color={T.ac} disabled={locked}
            >
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z"/>
              </svg>
            </IconBtn>
            <IconBtn
              onClick={() => onDelete(row.id)}
              title={locked ? "Reimbursed — locked" : "Delete"}
              color={T.red} disabled={locked}
            >
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9"/>
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
  const isMobile = cw < 680;

  // ── Meta ──────────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [cats,     setCats]     = useState<CatOption[]>([]);
  useEffect(() => {
    fetchExpenseMeta().then(d => {
      setProjects(d.projects);
      setCats(d.categories);
    }).catch(console.error);
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterProject,    setFilterProject]    = useState("");
  const [filterCategory,   setFilterCategory]   = useState("");
  const [filterReimbursed, setFilterReimbursed] = useState("all");
  const [filterMonth,      setFilterMonth]      = useState<number | null>(null);
  const [filterYear,       setFilterYear]       = useState<number | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<PageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── Build date range from month/year filter ───────────────────────────────
  const { dateFrom, dateTo } = useMemo(() => {
    const thisYear = new Date().getFullYear();
    if (filterMonth !== null) {
      const y = filterYear ?? thisYear;
      const m = String(filterMonth + 1).padStart(2, "0");
      const last = getDaysInMonth(y, filterMonth);
      return { dateFrom: `${y}-${m}-01`, dateTo: `${y}-${m}-${last}` };
    }
    if (filterYear !== null) {
      return { dateFrom: `${filterYear}-01-01`, dateTo: `${filterYear}-12-31` };
    }
    return { dateFrom: "", dateTo: "" };
  }, [filterMonth, filterYear]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyExpenses({
      project_id: filterProject  || undefined,
      category:   filterCategory || undefined,
      reimbursed: (filterReimbursed as "true" | "false" | "all"),
      from:       dateFrom || undefined,
      to:         dateTo   || undefined,
      page,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterProject, filterCategory, filterReimbursed, dateFrom, dateTo, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [filterProject, filterCategory, filterReimbursed, dateFrom, dateTo]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleEditStart(row: ExpenseRow) {
    setEditingId(row.id);
    setShowAddForm(false);
  }
  function handleEditCancel() { setEditingId(null); }

  async function handleEditSave(id: number, draft: EditDraft) {
    const updated = await updateMyExpense(id, {
      project_id: Number(draft.project_id),
      amount:     Number(draft.amount),
      category:   draft.category,
      date:       draft.date,
      remarks:    draft.remarks,
      reimbursed: draft.reimbursed,
    });
    setData(prev => prev ? {
      ...prev,
      results: prev.results.map(r => r.id === id ? updated : r),
    } : prev);
    setEditingId(null);
  }

  function handleDeleteRequest(id: number) { setDeleteConfirm(id); }

  async function handleDeleteConfirm() {
    if (deleteConfirm === null) return;
    try {
      await deleteMyExpense(deleteConfirm);
      setData(prev => prev ? {
        ...prev,
        count:   prev.count - 1,
        results: prev.results.filter(r => r.id !== deleteConfirm),
      } : prev);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleteConfirm(null);
    }
  }

  function handleCreated(row: ExpenseRow) {
    // Prepend to current page and refresh count
    setData(prev => prev ? {
      ...prev,
      count:   prev.count + 1,
      results: [row, ...prev.results].slice(0, 20),
    } : prev);
  }

  function clearFilters() {
    setFilterProject(""); setFilterCategory(""); setFilterReimbursed("all");
    setFilterMonth(null); setFilterYear(null);
  }

  const hasFilter = filterProject || filterCategory || filterReimbursed !== "all"
    || filterMonth !== null || filterYear !== null;
  const summary: Summary | undefined = data?.summary;
  const totalPages = data?.pages ?? 1;
  const availableYears = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  const sel2: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 7, padding: "6px 10px",
    fontSize: 11.5, color: T.t2, outline: "none",
    fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
    appearance: "none",
  };

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh", background: T.bg, color: T.t2,
      fontFamily: "'DM Sans','Sora',sans-serif",
      padding: isMobile ? "20px 14px 64px" : "32px 28px 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        select option { background: #131623; color: #e2e8f0; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Delete confirm overlay ── */}
      {deleteConfirm !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "#151929", border: `1px solid ${T.panelB}`,
            borderRadius: 16, padding: "24px 28px",
            maxWidth: 340, width: "100%",
            animation: "scaleIn 0.15s ease",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, marginBottom: 8 }}>Delete Expense</div>
            <p style={{ fontSize: 13, color: T.t4, marginBottom: 20, lineHeight: 1.5 }}>
              Are you sure you want to delete this expense? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12,
                background: "transparent", border: `1px solid ${T.panel2B}`,
                color: T.t4, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handleDeleteConfirm} style={{
                padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.red, border: "none", color: "#fff", cursor: "pointer",
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: T.acLight, border: `1px solid ${T.acMid}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width={18} height={18} viewBox="0 0 20 20" fill="none">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 3v5l3 3" stroke={T.acText} strokeWidth={1.8} strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h1 style={{
                fontSize: isMobile ? 19 : 23, fontWeight: 700,
                fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em",
                color: T.t1, margin: 0,
              }}>My Expenses</h1>
              <p style={{ color: T.t5, fontSize: 12, margin: 0 }}>
                Track and manage your own expenditure
              </p>
            </div>
          </div>

          <button
            onClick={() => { setShowAddForm(p => !p); setEditingId(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10,
              background: T.ac, border: "none", color: "#fff",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              transition: "opacity 0.15s", flexShrink: 0,
            }}
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M8 2v12M2 8h12"/>
            </svg>
            {!isMobile && "Add Expense"}
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {summary && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <StatCard label="Total"      value={fmtINR(summary.total)}      color={T.t2} />
          <StatCard label="Reimbursed" value={fmtINR(summary.reimbursed)} color={T.green} />
          <StatCard label="Pending"    value={fmtINR(summary.pending)}    color={T.amber} />
        </div>
      )}

      {/* ── Add form ── */}
      {showAddForm && (
        <div style={{ marginBottom: 16, animation: "fadeIn 0.2s ease" }}>
          <AddExpensePanel
            projects={projects}
            cats={cats}
            onClose={() => setShowAddForm(false)}
            onCreated={handleCreated}
          />
        </div>
      )}

      {/* ── Filters bar ── */}
      <div style={{
        background: T.panel, border: `1px solid ${T.panelB}`,
        borderRadius: 14, padding: "12px 16px",
        marginBottom: 14,
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
      }}>
        <select style={sel2} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select style={sel2} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All categories</option>
          {cats.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select style={sel2} value={filterReimbursed} onChange={e => setFilterReimbursed(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="true">Reimbursed</option>
          <option value="false">Pending</option>
        </select>

        <select style={sel2} value={filterMonth ?? ""} onChange={e => setFilterMonth(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>

        <select style={sel2} value={filterYear ?? ""} onChange={e => setFilterYear(e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">All years</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {hasFilter && (
          <button onClick={clearFilters} style={{
            background: "transparent", border: `1px solid ${T.panel2B}`,
            borderRadius: 7, padding: "6px 12px",
            fontSize: 11.5, color: T.t4, cursor: "pointer",
          }}>✕ Clear</button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.t5 }}>
          {data ? `${data.count} expense${data.count !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 14,
          background: T.redBg, border: `1px solid ${T.red}44`,
          color: T.red, fontSize: 13,
        }}>⚠ {error}</div>
      )}

      {/* ── Content ── */}
      {isMobile ? (
        /* ── Mobile: cards ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
            : (data?.results ?? []).length === 0
              ? <EmptyState msg="No expenses found" />
              : (data?.results ?? []).map(row => (
                <ExpenseCard
                  key={row.id}
                  row={row}
                  projects={projects}
                  cats={cats}
                  editingId={editingId}
                  onEditStart={handleEditStart}
                  onEditCancel={handleEditCancel}
                  onEditSave={handleEditSave}
                  onDelete={handleDeleteRequest}
                />
              ))}
        </div>
      ) : (
        /* ── Desktop: table ── */
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: `1px solid ${T.panel2B}` }}>
                  {["Date","Project","Category","Amount","Remarks","Status","Actions"].map(h => (
                    <th key={h} style={{
                      padding: "10px 12px 6px", fontSize: 10.5, fontWeight: 600,
                      color: T.t5, letterSpacing: "0.07em", textTransform: "uppercase",
                      textAlign: h === "Amount" ? "right" : h === "Status" || h === "Actions" ? "center" : "left",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.divider}` }}>
                      {[100, 140, 110, 80, 140, 80, 70].map((w, j) => (
                        <td key={j} style={{ padding: "10px 12px" }}>
                          <div style={{
                            height: 12, width: w, borderRadius: 6,
                            background: "rgba(255,255,255,0.06)",
                            animation: "pulse 1.5s ease-in-out infinite",
                          }} />
                        </td>
                      ))}
                    </tr>
                  ))
                  : (data?.results ?? []).length === 0
                    ? (
                      <tr><td colSpan={7}>
                        <EmptyState msg="No expenses found" />
                      </td></tr>
                    )
                    : (data?.results ?? []).map(row => (
                      <TableRow
                        key={row.id}
                        row={row}
                        projects={projects}
                        cats={cats}
                        editingId={editingId}
                        onEditStart={handleEditStart}
                        onEditCancel={handleEditCancel}
                        onEditSave={handleEditSave}
                        onDelete={handleDeleteRequest}
                      />
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.count > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderTop: `1px solid ${T.divider}`,
              background: "rgba(255,255,255,0.012)", flexWrap: "wrap", gap: 8,
            }}>
              <span style={{ fontSize: 11.5, color: T.t5 }}>
                Showing{" "}
                <span style={{ color: T.t3, fontWeight: 600 }}>
                  {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)}
                </span>
                {" "}of <span style={{ color: T.t3, fontWeight: 600 }}>{data.count}</span>
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.panel2B}`,
                    background: page === 1 ? "transparent" : T.panel2,
                    color: page === 1 ? T.t6 : T.t4,
                    cursor: page === 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (arr[i - 1] as number) !== (p as number) - 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === "…"
                    ? <span key={`e${i}`} style={{ width: 30, textAlign: "center", fontSize: 12, color: T.t5, lineHeight: "30px" }}>…</span>
                    : (
                      <button key={p} onClick={() => setPage(p as number)} style={{
                        width: 30, height: 30, borderRadius: 8, border: "none",
                        background: page === p ? T.ac : T.panel2,
                        color: page === p ? "#fff" : T.t4,
                        fontWeight: page === p ? 700 : 400,
                        cursor: "pointer", fontSize: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'DM Sans',sans-serif",
                      }}>{p}</button>
                    ),
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.panel2B}`,
                    background: page === totalPages ? "transparent" : T.panel2,
                    color: page === totalPages ? T.t6 : T.t4,
                    cursor: page === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile pagination */}
      {isMobile && data && data.count > 20 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{
              padding: "8px 20px", borderRadius: 9, border: `1px solid ${T.panel2B}`,
              background: T.panel2, color: page === 1 ? T.t6 : T.t3,
              fontSize: 12, cursor: page === 1 ? "default" : "pointer",
            }}>← Prev</button>
          <span style={{ fontSize: 12, color: T.t4, alignSelf: "center" }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{
              padding: "8px 20px", borderRadius: 9, border: `1px solid ${T.panel2B}`,
              background: T.panel2, color: page === totalPages ? T.t6 : T.t3,
              fontSize: 12, cursor: page === totalPages ? "default" : "pointer",
            }}>Next →</button>
        </div>
      )}
    </div>
  );
}