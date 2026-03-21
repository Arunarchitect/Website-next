"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  expenses as initialExpenses,
  projects,
  members,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  type Expense,
  type ExpenseCategory,
} from "./data";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function useContainerWidth(ref: React.RefObject<HTMLElement>) {
  const [w, setW] = useState(9999);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#0f1117",
  panel:   "rgba(255,255,255,0.025)",
  panelB:  "rgba(255,255,255,0.07)",
  panel2:  "rgba(255,255,255,0.04)",
  panel2B: "rgba(255,255,255,0.1)",
  rowHov:  "rgba(255,255,255,0.04)",
  divider: "rgba(255,255,255,0.06)",
  t1: "#f8fafc", t2: "#f1f5f9", t3: "#94a3b8",
  t4: "#64748b", t5: "#475569", t6: "#334155",
  ac:      "#6366f1",
  acLight: "rgba(99,102,241,0.12)",
  acMid:   "rgba(99,102,241,0.55)",
  acText:  "#818cf8",
  green:   "#10b981", greenBg: "rgba(16,185,129,0.12)",
  red:     "#ef4444", redBg:   "rgba(239,68,68,0.12)",
  amber:   "#f59e0b", amberBg: "rgba(245,158,11,0.12)",
};

const projMap   = Object.fromEntries(projects.map(p => [p.id, p]));
const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

const Divider = () => <div style={{ height: 1, background: T.divider }} />;

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalGrid({ year, month, activeDates, selDates, onToggle }: {
  year: number; month: number;
  activeDates: Set<string>; selDates: Set<string>;
  onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
      {DAYS.map(d => (
        <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.t5, fontWeight: 600,
          letterSpacing: "0.06em", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const has = activeDates.has(iso);
        const sel = selDates.has(iso);
        return (
          <button key={iso} onClick={() => onToggle(iso)} style={{
            background: sel ? T.ac : "transparent",
            border: `1px solid ${sel ? T.ac : "transparent"}`,
            borderRadius: 6, cursor: "pointer",
            color: sel ? "#fff" : has ? T.t2 : T.t4,
            fontSize: 11, padding: "6px 0", textAlign: "center",
            transition: "all 0.15s", width: "100%",
            fontFamily: "'DM Sans',sans-serif", fontWeight: sel ? 600 : 400,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          }}
            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = T.panel2; }}
            onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {day}
            {has && <span style={{ display: "block", width: 3, height: 3, borderRadius: "50%",
              background: sel ? "#fff" : T.acText }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onCancel(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onCancel]);

  return (
    <div ref={ref} style={{
      position: "absolute", top: "50%", right: "calc(100% + 8px)",
      transform: "translateY(-50%)", zIndex: 100,
      background: "#1a1d2e", border: `1px solid ${T.panel2B}`,
      borderRadius: 12, padding: "14px 16px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.7)", minWidth: 210, whiteSpace: "nowrap",
    }}>
      <div style={{ position: "absolute", right: -6, top: "50%",
        transform: "translateY(-50%) rotate(45deg)", width: 10, height: 10,
        background: "#1a1d2e", borderTop: `1px solid ${T.panel2B}`, borderRight: `1px solid ${T.panel2B}` }} />
      <p style={{ margin: "0 0 3px", fontSize: 12.5, fontWeight: 600, color: T.t2 }}>Delete this expense?</p>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: T.t4 }}>This action cannot be undone.</p>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "6px 0", fontSize: 11.5, borderRadius: 7,
          background: T.panel2, border: `1px solid ${T.panel2B}`, color: T.t3, cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: "6px 0", fontSize: 11.5, borderRadius: 7,
          background: T.red, border: "none", color: "#fff", fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans',sans-serif" }}>Yes, delete</button>
      </div>
    </div>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const color = EXPENSE_CATEGORY_COLORS[category];
  const label = EXPENSE_CATEGORY_LABELS[category];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 20,
      background: color + "20", border: `1px solid ${color}40`,
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
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      background: reimbursed ? T.greenBg : T.amberBg,
      color: reimbursed ? T.green : T.amber,
      fontSize: 10.5, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {reimbursed ? "Paid" : "Pending"}
    </span>
  );
}

// ─── Expense row ──────────────────────────────────────────────────────────────
function ExpenseRow({ row, onSave, onDelete }: {
  row: Expense;
  onSave: (id: string, data: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft]     = useState<Expense>({ ...row });
  const [dirty, setDirty]     = useState(false);
  const [flash, setFlash]     = useState(false);
  const [hovered, setHov]     = useState(false);
  const [showDel, setShowDel] = useState(false);

  function patch(p: Partial<Expense>) { setDraft(d => ({ ...d, ...p })); setDirty(true); }

  function save() {
    onSave(row.id, draft);
    setDirty(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  }

  const proj   = projMap[draft.projectId];
  const member = memberMap[draft.userId];

  const inputStyle: React.CSSProperties = {
    background: "transparent", border: "1px solid transparent",
    borderRadius: 6, padding: "4px 6px", fontSize: 12, color: T.t2,
    width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "none" as const };
  const focusOn  = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = T.acMid; e.currentTarget.style.background = T.panel2; };
  const focusOff = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; };

  const rowBg = flash ? "rgba(16,185,129,0.08)" : dirty ? "rgba(245,158,11,0.04)" : hovered ? T.rowHov : "transparent";

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ borderBottom: `1px solid ${T.divider}`, transition: "background 0.15s", background: rowBg }}
    >
      {/* Date */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })}
          style={{ ...inputStyle, minWidth: 108, colorScheme: "dark" }} onFocus={focusOn} onBlur={focusOff} />
      </td>

      {/* Member */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: T.acLight,
            color: T.acText, fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {member?.avatar ?? "??"}
          </div>
          <select value={draft.userId} onChange={e => patch({ userId: e.target.value })}
            style={selectStyle} onFocus={focusOn} onBlur={focusOff}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </td>

      {/* Project */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: proj?.color ?? T.t6, flexShrink: 0 }} />
          <select value={draft.projectId} onChange={e => patch({ projectId: e.target.value })}
            style={selectStyle} onFocus={focusOn} onBlur={focusOff}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </td>

      {/* Category */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <select
          value={draft.category}
          onChange={e => patch({ category: e.target.value as ExpenseCategory })}
          style={{
            ...selectStyle,
            color: EXPENSE_CATEGORY_COLORS[draft.category],
            fontWeight: 600,
          }}
          onFocus={focusOn} onBlur={focusOff}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </td>

      {/* Amount */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: T.t5, flexShrink: 0 }}>₹</span>
          <input
            type="number"
            value={draft.amount}
            onChange={e => patch({ amount: Number(e.target.value) })}
            style={{ ...inputStyle, minWidth: 80, textAlign: "right" }}
            onFocus={focusOn} onBlur={focusOff}
          />
        </div>
      </td>

      {/* Remarks */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input
          value={draft.remarks ?? ""}
          onChange={e => patch({ remarks: e.target.value })}
          placeholder="—"
          style={{ ...inputStyle, minWidth: 120 }}
          onFocus={focusOn} onBlur={focusOff}
        />
      </td>

      {/* Reimbursed */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center" }}>
        <button
          onClick={() => patch({ reimbursed: !draft.reimbursed })}
          title="Toggle reimbursed"
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            display: "inline-flex", alignItems: "center",
          }}
        >
          <ReimbursedBadge reimbursed={draft.reimbursed} />
        </button>
      </td>

      {/* Save + Delete */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={save} title="Save" style={{
            width: 28, height: 28, borderRadius: 7, border: "none",
            background: dirty ? T.greenBg : "transparent", color: T.green,
            cursor: dirty ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: dirty ? 1 : 0, transform: dirty ? "scale(1)" : "scale(0.6)",
            transition: "opacity 0.2s, transform 0.2s", pointerEvents: dirty ? "auto" : "none", flexShrink: 0,
          }}>
            <svg width={13} height={13} viewBox="0 0 14 14" fill="none">
              <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDel(true)} title="Delete" style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: showDel ? T.redBg : "transparent",
              color: showDel ? T.red : T.t5, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", flexShrink: 0,
            }}
              onMouseEnter={e => { if (!showDel) { (e.currentTarget as HTMLElement).style.background = T.redBg; (e.currentTarget as HTMLElement).style.color = T.red; }}}
              onMouseLeave={e => { if (!showDel) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.t5; }}}
            >
              <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
              </svg>
            </button>
            {showDel && (
              <DeleteConfirm
                onConfirm={() => { setShowDel(false); onDelete(row.id); }}
                onCancel={() => setShowDel(false)}
              />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── New expense inline row ───────────────────────────────────────────────────
function NewExpenseRow({ onAdd, onCancel }: {
  onAdd: (exp: Expense) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<Omit<Expense, "id" | "createdAt">>({
    date: today,
    userId: members[0]?.id ?? "",
    projectId: projects[0]?.id ?? "",
    amount: 0,
    category: "others",
    remarks: "",
    reimbursed: false,
  });

  function patch(p: Partial<typeof draft>) { setDraft(d => ({ ...d, ...p })); }

  function handleAdd() {
    if (!draft.date || !draft.userId || !draft.projectId || draft.amount <= 0) return;
    const now = new Date().toISOString();
    onAdd({
      ...draft,
      id: `exp_new_${Date.now()}`,
      createdAt: now,
    } as Expense);
  }

  const proj   = projMap[draft.projectId];
  const member = memberMap[draft.userId];

  const inputStyle: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.acMid}`,
    borderRadius: 6, padding: "5px 7px", fontSize: 12, color: T.t2,
    width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "none" as const };

  return (
    <tr style={{ borderBottom: `1px solid ${T.divider}`, background: "rgba(99,102,241,0.04)" }}>
      {/* Date */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })}
          style={{ ...inputStyle, minWidth: 108, colorScheme: "dark" }} />
      </td>

      {/* Member */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: T.acLight,
            color: T.acText, fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {member?.avatar ?? "??"}
          </div>
          <select value={draft.userId} onChange={e => patch({ userId: e.target.value })} style={selectStyle}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </td>

      {/* Project */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: proj?.color ?? T.t6, flexShrink: 0 }} />
          <select value={draft.projectId} onChange={e => patch({ projectId: e.target.value })} style={selectStyle}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </td>

      {/* Category */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <select
          value={draft.category}
          onChange={e => patch({ category: e.target.value as ExpenseCategory })}
          style={{ ...selectStyle, color: EXPENSE_CATEGORY_COLORS[draft.category], fontWeight: 600 }}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </td>

      {/* Amount */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: T.t5, flexShrink: 0 }}>₹</span>
          <input
            type="number"
            value={draft.amount || ""}
            placeholder="0"
            onChange={e => patch({ amount: Number(e.target.value) })}
            style={{ ...inputStyle, minWidth: 80, textAlign: "right" }}
          />
        </div>
      </td>

      {/* Remarks */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input
          value={draft.remarks ?? ""}
          onChange={e => patch({ remarks: e.target.value })}
          placeholder="Optional note…"
          style={inputStyle}
        />
      </td>

      {/* Reimbursed */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center" }}>
        <button
          onClick={() => patch({ reimbursed: !draft.reimbursed })}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex" }}
        >
          <ReimbursedBadge reimbursed={draft.reimbursed} />
        </button>
      </td>

      {/* Add + Cancel */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={handleAdd}
            title="Add expense"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: T.greenBg, color: T.green, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <svg width={13} height={13} viewBox="0 0 14 14" fill="none">
              <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={onCancel}
            title="Cancel"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: T.redBg, color: T.red, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Sort header cell ─────────────────────────────────────────────────────────
type SortField = "date" | "member" | "project" | "category" | "amount" | "reimbursed";
type SortDir   = "asc" | "desc";

function ThCell({ field, w, children, sortField, sortDir, onSort }: {
  field: SortField; w: number; children: React.ReactNode;
  sortField: SortField; sortDir: SortDir; onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th style={{ width: w, padding: 0 }}>
      <div onClick={() => onSort(field)} style={{
        display: "flex", alignItems: "center", gap: 5, padding: "10px 10px 5px",
        fontSize: 10.5, fontWeight: 600, color: active ? T.acText : T.t5,
        letterSpacing: "0.07em", textTransform: "uppercase",
        cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", transition: "color 0.15s",
      }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t3; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t5; }}
      >
        {children}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.3, color: active ? T.acText : T.t3 }}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </div>
    </th>
  );
}

// ─── Column filter types ──────────────────────────────────────────────────────
interface ColFilters {
  date: string;
  member: string;
  project: string;
  category: string;
  reimbursed: string; // "all" | "true" | "false"
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExpensePage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const cw = useContainerWidth(containerRef);
  const isMobile = cw < 720;

  // Calendar
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear,  setSelYear]  = useState<number | null>(null);

  // Rows
  const [rows, setRows] = useState<Expense[]>(initialExpenses);

  // New row
  const [showNew, setShowNew] = useState(false);

  // Column filters
  const [filters, setFilters] = useState<ColFilters>({
    date: "", member: "", project: "", category: "", reimbursed: "all",
  });

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  const activeDates = useMemo(() => new Set(rows.map(r => r.date)), [rows]);

  const calFiltered = useMemo(() => rows.filter(r => {
    const d = new Date(r.date);
    if (selDates.size > 0 && !selDates.has(r.date)) return false;
    if (selMonth !== null && d.getMonth() !== selMonth) return false;
    if (selYear  !== null && d.getFullYear() !== selYear) return false;
    return true;
  }), [rows, selDates, selMonth, selYear]);

  const displayRows = useMemo(() => {
    const list = calFiltered.filter(r => {
      if (filters.date    && !r.date.includes(filters.date)) return false;
      if (filters.member  && r.userId !== filters.member) return false;
      if (filters.project && r.projectId !== filters.project) return false;
      if (filters.category && r.category !== filters.category) return false;
      if (filters.reimbursed === "true"  && !r.reimbursed) return false;
      if (filters.reimbursed === "false" && r.reimbursed)  return false;
      return true;
    });
    list.sort((a, b) => {
      let av: string | number = "", bv: string | number = "";
      switch (sortField) {
        case "date":        av = a.date; bv = b.date; break;
        case "member":      av = memberMap[a.userId]?.name ?? ""; bv = memberMap[b.userId]?.name ?? ""; break;
        case "project":     av = projMap[a.projectId]?.name ?? ""; bv = projMap[b.projectId]?.name ?? ""; break;
        case "category":    av = a.category; bv = b.category; break;
        case "amount":      av = a.amount; bv = b.amount; break;
        case "reimbursed":  av = String(a.reimbursed); bv = String(b.reimbursed); break;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return list;
  }, [calFiltered, filters, sortField, sortDir]);

  // ─── Pagination ───────────────────────────────────────────────────────────────
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever filters/sort/calendar selection changes
  useEffect(() => { setCurrentPage(1); }, [displayRows]);

  const totalPages  = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pageRows    = displayRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  }

  function saveRow(id: string, data: Expense) {
    setRows(prev => prev.map(r => r.id === id ? data : r));
  }
  function deleteRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function addRow(exp: Expense) {
    setRows(prev => [exp, ...prev]);
    setShowNew(false);
  }

  function toggleDate(iso: string) {
    setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }
  function clearAll() {
    setSelDates(new Set()); setSelMonth(null); setSelYear(null);
    setFilters({ date: "", member: "", project: "", category: "", reimbursed: "all" });
  }
  function prevMonth() { calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }
  function nextMonth() { calMonth === 11 ? (setCalMonth(0), setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }

  const availableYears = useMemo(() =>
    Array.from(new Set(rows.map(r => new Date(r.date).getFullYear()))).sort(), [rows]);

  // Summary stats
  const totalAmount    = useMemo(() => displayRows.reduce((s, r) => s + r.amount, 0), [displayRows]);
  const pendingAmount  = useMemo(() => displayRows.filter(r => !r.reimbursed).reduce((s, r) => s + r.amount, 0), [displayRows]);
  const reimbursedAmt  = useMemo(() => displayRows.filter(r => r.reimbursed).reduce((s, r) => s + r.amount, 0), [displayRows]);

  const hasFilter = selDates.size > 0 || selMonth !== null || selYear !== null ||
    Object.entries(filters).some(([k, v]) => k === "reimbursed" ? v !== "all" : v !== "");

  const fi: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.divider}`, borderRadius: 6,
    padding: "5px 8px", fontSize: 11, color: T.t2,
    outline: "none", fontFamily: "'DM Sans',sans-serif",
  };

  const memberOpts  = members.map(m  => ({ label: m.name,                       value: m.id }));
  const projectOpts = projects.map(p => ({ label: p.name,                       value: p.id }));
  const catOpts     = CATEGORIES.map(c => ({ label: EXPENSE_CATEGORY_LABELS[c], value: c   }));

  return (
    <div ref={containerRef} style={{
      minHeight: "100vh", background: T.bg, color: T.t2,
      fontFamily: "'DM Sans','Sora',sans-serif",
      padding: isMobile ? "20px 16px 48px" : "32px 32px 56px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Sora:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 0.3; }
        select option { background: #1a1d2e; color: #f1f5f9; }
        .table-scroll::-webkit-scrollbar { height: 6px; }
        .table-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 99px; }
        .table-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
        .table-scroll::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,0.5); }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 18 : 26 }}>
        <h1 style={{
          fontSize: isMobile ? 22 : 26, fontWeight: 700,
          fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em", color: T.t1, margin: 0,
        }}>
          Expenses
        </h1>
        <p style={{ color: T.t5, fontSize: 13, margin: "4px 0 0" }}>
          Track, review &amp; manage team expenditure
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
        gap: isMobile ? 16 : 20, alignItems: "start",
      }}>

        {/* ── LEFT: Calendar panel ── */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 20px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={prevMonth} style={{
              width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
            }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.t2 }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} style={{
              width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
          </div>

          <CalGrid
            year={calYear} month={calMonth}
            activeDates={activeDates} selDates={selDates} onToggle={toggleDate}
          />

          {selDates.size > 0 && (
            <div style={{ textAlign: "center", fontSize: 11, color: T.acText }}>
              {selDates.size} date{selDates.size > 1 ? "s" : ""} selected &nbsp;
              <button onClick={() => setSelDates(new Set())}
                style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
          )}

          <Divider />

          {/* Month pills */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5, letterSpacing: "0.07em",
              textTransform: "uppercase", marginBottom: 8 }}>Filter by Month</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setSelMonth(selMonth === i ? null : i)} style={{
                  background: selMonth === i ? T.acLight : T.panel2,
                  border: `1px solid ${selMonth === i ? T.acMid : T.panel2B}`,
                  borderRadius: 6, color: selMonth === i ? T.acText : T.t4,
                  fontSize: 10, padding: "5px 0", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontWeight: selMonth === i ? 600 : 400, transition: "all 0.15s",
                }}>{m.slice(0, 3)}</button>
              ))}
            </div>
          </div>

          {/* Year pills */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5, letterSpacing: "0.07em",
              textTransform: "uppercase", marginBottom: 8 }}>Filter by Year</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {availableYears.map(y => (
                <button key={y} onClick={() => setSelYear(selYear === y ? null : y)} style={{
                  background: selYear === y ? T.acLight : T.panel2,
                  border: `1px solid ${selYear === y ? T.acMid : T.panel2B}`,
                  borderRadius: 6, color: selYear === y ? T.acText : T.t4,
                  fontSize: 10, padding: "5px 10px", cursor: "pointer",
                  fontWeight: selYear === y ? 600 : 400, transition: "all 0.15s",
                }}>{y}</button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Stats */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5, letterSpacing: "0.07em",
              textTransform: "uppercase", marginBottom: 10 }}>Current View</div>
            {[
              { label: "Entries",     val: String(displayRows.length),  color: T.acText },
              { label: "Total",       val: fmtINR(totalAmount),          color: T.t2    },
              { label: "Reimbursed",  val: fmtINR(reimbursedAmt),        color: T.green },
              { label: "Pending",     val: fmtINR(pendingAmount),         color: T.amber },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.t4 }}>{label}</span>
                <span style={{ fontSize: 13, color, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <Divider />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5, letterSpacing: "0.07em",
              textTransform: "uppercase", marginBottom: 10 }}>By Category</div>
            {CATEGORIES.map(cat => {
              const catTotal = displayRows.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
              if (catTotal === 0) return null;
              const pct = totalAmount > 0 ? catTotal / totalAmount : 0;
              const color = EXPENSE_CATEGORY_COLORS[cat];
              return (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: T.t4 }}>{EXPENSE_CATEGORY_LABELS[cat]}</span>
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>{fmtINR(catTotal)}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: T.panel2B }}>
                    <div style={{ height: "100%", borderRadius: 99, background: color,
                      width: `${pct * 100}%`, transition: "width 0.4s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {hasFilter && (
            <>
              <Divider />
              <button onClick={clearAll} style={{
                background: "transparent", border: `1px solid ${T.panel2B}`,
                borderRadius: 8, padding: "7px 0", fontSize: 12, color: T.t4,
                cursor: "pointer", width: "100%",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
              >✕ &nbsp;Clear all filters</button>
            </>
          )}
        </div>

        {/* ── RIGHT: Table ── */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, overflow: "hidden",
        }}>
          <div className="table-scroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${T.panel2B}` }}>
                  <ThCell field="date"        w={122} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Date</ThCell>
                  <ThCell field="member"      w={148} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Member</ThCell>
                  <ThCell field="project"     w={148} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Project</ThCell>
                  <ThCell field="category"    w={128} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Category</ThCell>
                  <ThCell field="amount"      w={110} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Amount</ThCell>

                  {/* Remarks — not sortable */}
                  <th style={{ padding: 0 }}>
                    <div style={{ padding: "10px 10px 5px", fontSize: 10.5, fontWeight: 600,
                      color: T.t5, letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      Remarks
                    </div>
                  </th>

                  <ThCell field="reimbursed"  w={100} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Status</ThCell>

                  {/* Actions header with + button */}
                  <th style={{ width: 80, padding: 0 }}>
                    <div style={{ padding: "10px 10px 5px", display: "flex",
                      alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
                        letterSpacing: "0.07em", textTransform: "uppercase" }}>Actions</span>
                      <button
                        onClick={() => setShowNew(v => !v)}
                        title="Add new expense"
                        style={{
                          width: 22, height: 22, borderRadius: 6, border: "none",
                          background: showNew ? T.acLight : T.panel2B,
                          color: showNew ? T.acText : T.t4,
                          cursor: "pointer", display: "flex", alignItems: "center",
                          justifyContent: "center", transition: "all 0.15s", flexShrink: 0,
                        }}
                        onMouseEnter={e => {
                          if (!showNew) {
                            (e.currentTarget as HTMLElement).style.background = T.acLight;
                            (e.currentTarget as HTMLElement).style.color = T.acText;
                          }
                        }}
                        onMouseLeave={e => {
                          if (!showNew) {
                            (e.currentTarget as HTMLElement).style.background = T.panel2B;
                            (e.currentTarget as HTMLElement).style.color = T.t4;
                          }
                        }}
                      >
                        <svg width={11} height={11} viewBox="0 0 12 12" fill="none">
                          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </th>
                </tr>

                {/* Column filter sub-row */}
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${T.divider}` }}>
                  {/* date */}
                  <td style={{ padding: "5px 8px" }}>
                    <input style={fi} placeholder="YYYY-MM" value={filters.date}
                      onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} />
                  </td>
                  {/* member */}
                  <td style={{ padding: "5px 8px" }}>
                    <select style={fi} value={filters.member}
                      onChange={e => setFilters(f => ({ ...f, member: e.target.value }))}>
                      <option value="">All</option>
                      {memberOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  {/* project */}
                  <td style={{ padding: "5px 8px" }}>
                    <select style={fi} value={filters.project}
                      onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}>
                      <option value="">All</option>
                      {projectOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  {/* category */}
                  <td style={{ padding: "5px 8px" }}>
                    <select style={fi} value={filters.category}
                      onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
                      <option value="">All</option>
                      {catOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  {/* amount — no filter */}
                  <td style={{ padding: "5px 8px" }}><div /></td>
                  {/* remarks — no filter */}
                  <td style={{ padding: "5px 8px" }}><div /></td>
                  {/* reimbursed */}
                  <td style={{ padding: "5px 8px" }}>
                    <select style={fi} value={filters.reimbursed}
                      onChange={e => setFilters(f => ({ ...f, reimbursed: e.target.value }))}>
                      <option value="all">All</option>
                      <option value="true">Paid</option>
                      <option value="false">Pending</option>
                    </select>
                  </td>
                  <td style={{ padding: "5px 8px" }}><div /></td>
                </tr>
              </thead>

              <tbody>
                {/* New expense row — always at the top when visible */}
                {showNew && (
                  <NewExpenseRow
                    onAdd={addRow}
                    onCancel={() => setShowNew(false)}
                  />
                )}

                {displayRows.length === 0 && !showNew ? (
                  <tr><td colSpan={8}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", minHeight: 200, gap: 10, color: T.t6 }}>
                      <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
                        <rect x={2} y={5} width={20} height={14} rx={2}/>
                        <path d="M2 10h20"/>
                      </svg>
                      <span style={{ fontSize: 13.5 }}>No expenses for this selection</span>
                    </div>
                  </td></tr>
                ) : (
                  pageRows.map(row => (
                    <ExpenseRow key={row.id} row={row} onSave={saveRow} onDelete={deleteRow} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination bar ── */}
          {displayRows.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: `1px solid ${T.divider}`,
              background: "rgba(255,255,255,0.015)",
              flexWrap: "wrap", gap: 8,
            }}>
              {/* Left: entry count info */}
              <span style={{ fontSize: 11.5, color: T.t5, whiteSpace: "nowrap" }}>
                Showing{" "}
                <span style={{ color: T.t3, fontWeight: 600 }}>
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, displayRows.length)}
                </span>
                {" "}of{" "}
                <span style={{ color: T.t3, fontWeight: 600 }}>{displayRows.length}</span>
                {" "}expenses
              </span>

              {/* Right: page controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {/* Prev */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: currentPage === 1 ? "transparent" : T.panel2,
                    border: `1px solid ${currentPage === 1 ? T.divider : T.panel2B}`,
                    color: currentPage === 1 ? T.t6 : T.t4,
                    cursor: currentPage === 1 ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, transition: "all 0.15s",
                  }}
                >‹</button>

                {/* Page number pills */}
                {(() => {
                  const pages: (number | "…")[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("…");
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push("…");
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} style={{ width: 30, textAlign: "center",
                        fontSize: 12, color: T.t5 }}>…</span>
                    ) : (
                      <button key={p} onClick={() => setCurrentPage(p as number)} style={{
                        width: 30, height: 30, borderRadius: 8, border: "none",
                        background: currentPage === p ? T.ac : T.panel2,
                        color: currentPage === p ? "#fff" : T.t4,
                        fontWeight: currentPage === p ? 700 : 400,
                        cursor: "pointer", fontSize: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s", fontFamily: "'DM Sans',sans-serif",
                      }}>
                        {p}
                      </button>
                    )
                  );
                })()}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: currentPage === totalPages ? "transparent" : T.panel2,
                    border: `1px solid ${currentPage === totalPages ? T.divider : T.panel2B}`,
                    color: currentPage === totalPages ? T.t6 : T.t4,
                    cursor: currentPage === totalPages ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, transition: "all 0.15s",
                  }}
                >›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}