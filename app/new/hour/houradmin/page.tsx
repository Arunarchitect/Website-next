"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  worklogEntries, organisations, projects, deliverables, members,
  projMap, delivMap, orgMap, memberMap,
  assignments as initialAssignments,
  currentUser,
  type WorklogEntry,
  type Assignment,
} from "./data";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }

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

// ─── Delete confirm popover ───────────────────────────────────────────────────
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
      <p style={{ margin: "0 0 3px", fontSize: 12.5, fontWeight: 600, color: T.t2 }}>Delete this entry?</p>
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

// ─── Worklog row ──────────────────────────────────────────────────────────────
function WorklogRow({ row, onSave, onDelete }: {
  row: WorklogEntry;
  onSave: (id: string, data: WorklogEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft]     = useState<WorklogEntry>({ ...row });
  const [dirty, setDirty]     = useState(false);
  const [flash, setFlash]     = useState(false);
  const [hovered, setHov]     = useState(false);
  const [showDel, setShowDel] = useState(false);

  function patch(p: Partial<WorklogEntry>) { setDraft(d => ({ ...d, ...p })); setDirty(true); }

  function save() {
    onSave(row.id, draft);
    setDirty(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  }

  const scopedDelivs = deliverables.filter(d => d.projectId === draft.projectId);
  const delivValid   = scopedDelivs.some(d => d.id === draft.deliverableId);
  const proj         = projMap[draft.projectId];

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
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderBottom: `1px solid ${T.divider}`, transition: "background 0.15s", background: rowBg }}>

      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input type="date" value={draft.date} onChange={e => patch({ date: e.target.value })}
          style={{ ...inputStyle, minWidth: 108, colorScheme: "dark" }} onFocus={focusOn} onBlur={focusOff} />
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <select value={draft.organisationId} onChange={e => patch({ organisationId: e.target.value })}
          style={selectStyle} onFocus={focusOn} onBlur={focusOff}>
          {organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: proj?.color ?? T.t6, flexShrink: 0 }} />
          <select value={draft.projectId} onChange={e => patch({ projectId: e.target.value, deliverableId: "" })}
            style={selectStyle} onFocus={focusOn} onBlur={focusOff}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <select value={delivValid ? draft.deliverableId : ""} onChange={e => patch({ deliverableId: e.target.value })}
          style={selectStyle} onFocus={focusOn} onBlur={focusOff}>
          {!delivValid && <option value="">— select —</option>}
          {scopedDelivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <select value={draft.memberId} onChange={e => patch({ memberId: e.target.value })}
          style={selectStyle} onFocus={focusOn} onBlur={focusOff}>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input type="time" value={draft.startTime} onChange={e => patch({ startTime: e.target.value })}
          style={{ ...inputStyle, colorScheme: "dark" }} onFocus={focusOn} onBlur={focusOff} />
      </td>
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <input type="time" value={draft.endTime} onChange={e => patch({ endTime: e.target.value })}
          style={{ ...inputStyle, colorScheme: "dark" }} onFocus={focusOn} onBlur={focusOff} />
      </td>
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
            {showDel && <DeleteConfirm onConfirm={() => { setShowDel(false); onDelete(row.id); }} onCancel={() => setShowDel(false)} />}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Sort header cell ─────────────────────────────────────────────────────────
type SortField = "date" | "org" | "project" | "deliverable" | "member" | "startTime" | "endTime";
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

// ─── Column filter inputs interface ──────────────────────────────────────────
interface ColFilters {
  date: string; org: string; project: string;
  deliverable: string; member: string; startTime: string; endTime: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN: Assign Deliverables Section
// ═══════════════════════════════════════════════════════════════════════════════

// Inline-editable row for an existing assignment
function AssignmentRow({ row, onSave, onDelete }: {
  row: Assignment;
  onSave:   (id: string, data: Assignment) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft]     = useState<Assignment>({ ...row });
  const [dirty, setDirty]     = useState(false);
  const [flash, setFlash]     = useState(false);
  const [hovered, setHov]     = useState(false);
  const [showDel, setShowDel] = useState(false);

  function patch(p: Partial<Assignment>) { setDraft(d => ({ ...d, ...p })); setDirty(true); }
  function save() {
    onSave(row.id, draft);
    setDirty(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
  }

  const deliv  = delivMap[draft.deliverableId];
  const proj   = deliv ? projMap[deliv.projectId] : null;
  const member = memberMap[draft.memberId];

  const dueOk  = !!draft.dueDate && draft.dueDate >= draft.startDate;
  const canSave = dirty && !!draft.startDate && dueOk;

  const rowBg = flash ? "rgba(16,185,129,0.06)" : dirty ? "rgba(245,158,11,0.03)" : hovered ? T.rowHov : "transparent";
  const cell: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle", borderBottom: `1px solid ${T.divider}` };
  const inp: React.CSSProperties  = {
    background: "transparent", border: "1px solid transparent",
    borderRadius: 6, padding: "4px 7px", fontSize: 12, color: T.t2,
    width: "100%", outline: "none", fontFamily: "'DM Sans',sans-serif",
    transition: "border-color 0.15s, background 0.15s",
  };
  const focusOn  = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = T.acMid; e.currentTarget.style.background = T.panel2; };
  const focusOff = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; };

  // Duration in days
  const duration = draft.startDate && draft.dueDate && draft.dueDate >= draft.startDate
    ? Math.ceil((new Date(draft.dueDate).getTime() - new Date(draft.startDate).getTime()) / 86400000) + 1
    : null;

  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: rowBg, transition: "background 0.15s" }}>

      {/* Deliverable (read-only display) */}
      <td style={cell}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%",
            background: proj?.color ?? T.t6, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: T.t2, fontWeight: 500,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
              {deliv?.name ?? <span style={{ color: T.t6 }}>—</span>}
            </div>
            <div style={{ fontSize: 10.5, color: T.t5, marginTop: 1 }}>{proj?.name ?? "—"}</div>
          </div>
        </div>
      </td>

      {/* Member (editable select) */}
      <td style={cell}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#6366f1,#818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>
            {member?.name.split(" ").map(w => w[0]).join("").slice(0, 2) ?? "?"}
          </div>
          <select value={draft.memberId} onChange={e => patch({ memberId: e.target.value })}
            style={{ ...inp, cursor: "pointer", appearance: "none" as const, flex: 1 }}
            onFocus={focusOn} onBlur={focusOff}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </td>

      {/* Start date */}
      <td style={cell}>
        <input type="date" value={draft.startDate}
          onChange={e => patch({ startDate: e.target.value })}
          style={{ ...inp, colorScheme: "dark", minWidth: 120 }}
          onFocus={focusOn} onBlur={focusOff} />
      </td>

      {/* Due date */}
      <td style={cell}>
        <input type="date" value={draft.dueDate}
          onChange={e => patch({ dueDate: e.target.value })}
          style={{ ...inp, colorScheme: "dark", minWidth: 120,
            borderColor: dirty && !dueOk ? `${T.red}88` : "transparent" }}
          onFocus={focusOn} onBlur={focusOff} />
      </td>

      {/* Duration badge */}
      <td style={{ ...cell, textAlign: "center" }}>
        {duration !== null
          ? <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px",
              borderRadius: 20, background: T.acLight, color: T.acText }}>{duration}d</span>
          : <span style={{ color: T.t6, fontSize: 11 }}>—</span>}
      </td>

      {/* Actions */}
      <td style={{ ...cell, width: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={save} title="Save changes" disabled={!canSave} style={{
            width: 28, height: 28, borderRadius: 7, border: "none",
            background: canSave ? T.greenBg : "transparent", color: T.green,
            cursor: canSave ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: canSave ? 1 : 0, transform: canSave ? "scale(1)" : "scale(0.6)",
            transition: "opacity 0.2s, transform 0.2s", pointerEvents: canSave ? "auto" : "none",
          }}>
            <svg width={13} height={13} viewBox="0 0 14 14" fill="none">
              <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDel(true)} title="Remove assignment" style={{
              width: 28, height: 28, borderRadius: 7, border: "none",
              background: showDel ? T.redBg : "transparent",
              color: showDel ? T.red : T.t5, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
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

// ─── New assignment form ──────────────────────────────────────────────────────
function NewAssignmentRow({ onAdd }: { onAdd: (a: Omit<Assignment, "id">) => void }) {
  const [selOrg,    setSelOrg]   = useState("");
  const [selProj,   setSelProj]  = useState("");
  const [selDeliv,  setSelDeliv] = useState("");
  const [selMem,    setSelMem]   = useState("");
  const [startDate, setStart]    = useState("");
  const [dueDate,   setDue]      = useState("");
  const [flash,     setFlash]    = useState(false);

  const filteredProjs  = selOrg  ? projects.filter(p => p.organisationId === selOrg)    : projects;
  const filteredDelivs = selProj ? deliverables.filter(d => d.projectId === selProj)    : deliverables;

  const canAdd = selDeliv && selMem && startDate && dueDate && dueDate >= startDate;

  function handleAdd() {
    if (!canAdd) return;
    onAdd({ deliverableId: selDeliv, memberId: selMem, startDate, dueDate });
    setSelOrg(""); setSelProj(""); setSelDeliv(""); setSelMem(""); setStart(""); setDue("");
    setFlash(true);
    setTimeout(() => setFlash(false), 800);
  }

  const sel: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: T.t2,
    outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
    appearance: "none" as const, width: "100%", transition: "border-color 0.2s",
  };
  const inp: React.CSSProperties = { ...sel, cursor: "text" };
  const focus = (e: React.FocusEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; };
  const blur  = (e: React.FocusEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; };
  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: T.t5,
    letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, display: "block",
  };

  const dueDateError = dueDate && startDate && dueDate < startDate;

  return (
    <div style={{
      background: flash ? "rgba(16,185,129,0.05)" : T.panel2,
      border: `1px solid ${flash ? T.green + "44" : T.panel2B}`,
      borderRadius: 14, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 14,
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.t5,
        letterSpacing: "0.07em", textTransform: "uppercase" }}>New Assignment</div>

      {/* Row 1: Org → Project → Deliverable */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={label}>Organisation</label>
          <select value={selOrg} onChange={e => { setSelOrg(e.target.value); setSelProj(""); setSelDeliv(""); }}
            style={sel} onFocus={focus} onBlur={blur}>
            <option value="">All orgs</option>
            {organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Project</label>
          <select value={selProj} onChange={e => { setSelProj(e.target.value); setSelDeliv(""); }}
            style={sel} onFocus={focus} onBlur={blur}>
            <option value="">All projects</option>
            {filteredProjs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Deliverable <span style={{ color: T.red }}>*</span></label>
          <select value={selDeliv} onChange={e => setSelDeliv(e.target.value)}
            style={{ ...sel, borderColor: !selDeliv && (startDate || selMem) ? `${T.amber}88` : T.panel2B }}
            onFocus={focus} onBlur={blur}>
            <option value="">Select deliverable</option>
            {filteredDelivs.map(d => {
              const p = projMap[d.projectId];
              return <option key={d.id} value={d.id}>{d.name}{p ? ` — ${p.name}` : ""}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Row 2: Member + Dates + Add button */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={label}>Assign to <span style={{ color: T.red }}>*</span></label>
          <select value={selMem} onChange={e => setSelMem(e.target.value)}
            style={{ ...sel, borderColor: !selMem && (startDate || selDeliv) ? `${T.amber}88` : T.panel2B }}
            onFocus={focus} onBlur={blur}>
            <option value="">Select member</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Start date <span style={{ color: T.red }}>*</span></label>
          <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
            style={{ ...inp, colorScheme: "dark" }} onFocus={focus} onBlur={blur} />
        </div>
        <div>
          <label style={label}>Due date <span style={{ color: T.red }}>*</span></label>
          <input type="date" value={dueDate} onChange={e => setDue(e.target.value)}
            style={{ ...inp, colorScheme: "dark",
              borderColor: dueDateError ? `${T.red}88` : T.panel2B }}
            onFocus={focus} onBlur={blur} />
          {dueDateError && (
            <div style={{ fontSize: 10.5, color: T.red, marginTop: 4 }}>Due must be after start</div>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          style={{
            height: 40, padding: "0 20px", borderRadius: 9, border: "none",
            background: canAdd ? T.ac : T.panel2B,
            color: canAdd ? "#fff" : T.t6,
            fontSize: 13, fontWeight: 600,
            cursor: canAdd ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans',sans-serif",
            display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseEnter={e => { if (canAdd) (e.currentTarget as HTMLElement).style.background = "#4f46e5"; }}
          onMouseLeave={e => { if (canAdd) (e.currentTarget as HTMLElement).style.background = T.ac; }}
        >
          <svg width={13} height={13} viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
          </svg>
          Assign
        </button>
      </div>
    </div>
  );
}

// ─── Admin Assign Deliverables Section ────────────────────────────────────────
function AssignDeliverablesSection({
  adminAssignments, onAdd, onSave, onDelete,
}: {
  adminAssignments: Assignment[];
  onAdd:    (a: Omit<Assignment, "id">) => void;
  onSave:   (id: string, data: Assignment) => void;
  onDelete: (id: string) => void;
}) {
  const [filterMem,   setFilterMem]   = useState("");
  const [filterDeliv, setFilterDeliv] = useState("");
  const [filterProj,  setFilterProj]  = useState("");

  const filtered = useMemo(() => adminAssignments.filter(a => {
    if (filterMem && a.memberId !== filterMem) return false;
    if (filterDeliv && a.deliverableId !== filterDeliv) return false;
    if (filterProj) {
      const d = delivMap[a.deliverableId];
      if (d?.projectId !== filterProj) return false;
    }
    return true;
  }), [adminAssignments, filterMem, filterDeliv, filterProj]);

  // Per-member assignment count for the workload chips
  const memberCount = useMemo(() => {
    const map: Record<string, number> = {};
    adminAssignments.forEach(a => { map[a.memberId] = (map[a.memberId] ?? 0) + 1; });
    return map;
  }, [adminAssignments]);

  const hasFilter = filterMem || filterDeliv || filterProj;

  const selStyle: React.CSSProperties = {
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 8, padding: "7px 11px", fontSize: 12, color: T.t2,
    outline: "none", cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
    appearance: "none" as const, flex: 1, minWidth: 0, transition: "border-color 0.2s",
  };

  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.panelB}`,
      borderRadius: 16, padding: "22px 24px",
      display: "flex", flexDirection: "column", gap: 20,
    }}>

      {/* ── Header row ── */}
      <div style={{ display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Icon */}
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: T.acLight, border: `1px solid ${T.acMid}44`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 18 18" fill="none">
              <rect x={1.5} y={1.5} width={6} height={6} rx={1.5} stroke={T.acText} strokeWidth={1.3}/>
              <rect x={10.5} y={1.5} width={6} height={6} rx={1.5} stroke={T.acText} strokeWidth={1.3}/>
              <rect x={1.5} y={10.5} width={6} height={6} rx={1.5} stroke={T.acText} strokeWidth={1.3}/>
              <path d="M10.5 13.5h6M13.5 10.5v6" stroke={T.acText} strokeWidth={1.3} strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, lineHeight: 1.2 }}>
              Assign Deliverables
            </div>
            <div style={{ fontSize: 11.5, color: T.t5, marginTop: 2 }}>
              Admin · Assign work to team members and set deadlines
            </div>
          </div>
        </div>

        {/* Workload chips — one per member showing count */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {members.map(m => {
            const count = memberCount[m.id] ?? 0;
            const countColor = count === 0 ? T.t6 : count >= 3 ? T.amber : T.green;
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.panel2, border: `1px solid ${T.panel2B}`,
                borderRadius: 20, padding: "5px 12px 5px 7px", cursor: "pointer",
                transition: "border-color 0.15s",
              }}
                onClick={() => setFilterMem(filterMem === m.id ? "" : m.id)}
                title={`Filter by ${m.name}`}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: filterMem === m.id ? T.acLight : T.panel2,
                  border: `1px solid ${filterMem === m.id ? T.acMid : T.panel2B}`,
                  borderRadius: 20, padding: "5px 12px 5px 7px", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: "50%",
                  background: "linear-gradient(135deg,#6366f1,#818cf8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {m.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <span style={{ fontSize: 11.5, color: filterMem === m.id ? T.acText : T.t3, whiteSpace: "nowrap" }}>
                  {m.name.split(" ")[0]}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: countColor, minWidth: 10 }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ── New assignment form ── */}
      <NewAssignmentRow onAdd={onAdd} />

      <Divider />

      {/* ── Existing assignments list ── */}
      <div>
        {/* Sub-header + filters */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.t5,
            letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            Existing Assignments
            <span style={{ marginLeft: 8, fontWeight: 400, color: T.t6, fontSize: 11 }}>
              ({filtered.length}{hasFilter ? ` of ${adminAssignments.length}` : ""})
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1,
            justifyContent: "flex-end", maxWidth: 580 }}>
            <select value={filterProj} onChange={e => setFilterProj(e.target.value)}
              style={{ ...selStyle, maxWidth: 160 }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
              onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}>
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterDeliv} onChange={e => setFilterDeliv(e.target.value)}
              style={{ ...selStyle, maxWidth: 180 }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
              onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}>
              <option value="">All deliverables</option>
              {deliverables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterMem} onChange={e => setFilterMem(e.target.value)}
              style={{ ...selStyle, maxWidth: 160 }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = T.acMid; }}
              onBlur={e  => { (e.currentTarget as HTMLElement).style.borderColor = T.panel2B; }}>
              <option value="">All members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {hasFilter && (
              <button
                onClick={() => { setFilterMem(""); setFilterDeliv(""); setFilterProj(""); }}
                style={{ padding: "7px 12px", borderRadius: 8,
                  border: `1px solid ${T.panel2B}`, background: "transparent",
                  color: T.t4, fontSize: 11.5, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minHeight: 140, gap: 10, color: T.t6,
            border: `1px dashed ${T.divider}`, borderRadius: 12 }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
              <rect x={3} y={4} width={18} height={16} rx={2}/>
              <path d="M8 2v4M16 2v4M3 10h18M8 14h4M8 17h6"/>
            </svg>
            <span style={{ fontSize: 13 }}>No assignments match the current filters</span>
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: `1px solid ${T.panel2B}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${T.panel2B}` }}>
                    {[
                      { label: "Deliverable / Project", w: 220 },
                      { label: "Assigned to",           w: 200 },
                      { label: "Start date",            w: 140 },
                      { label: "Due date",              w: 140 },
                      { label: "Duration",              w: 90  },
                      { label: "Actions",               w: 72  },
                    ].map(({ label, w }) => (
                      <th key={label} style={{ width: w, padding: "10px 12px", textAlign: "left" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
                          letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <AssignmentRow key={a.id} row={a} onSave={onSave} onDelete={onDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorklogPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const cw = useContainerWidth(containerRef);
  const isMobile = cw < 720;

  // Calendar state
  const [calYear,  setCalYear]  = useState(2025);
  const [calMonth, setCalMonth] = useState(2);
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear,  setSelYear]  = useState<number | null>(null);

  // Worklog rows
  const [rows, setRows] = useState<WorklogEntry[]>(worklogEntries);

  // Admin assignments (local mutable state seeded from data.ts)
  const [adminAssignments, setAdminAssignments] = useState<Assignment[]>(initialAssignments);

  // Column filters
  const [filters, setFilters] = useState<ColFilters>({
    date: "", org: "", project: "", deliverable: "", member: "", startTime: "", endTime: "",
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
      if (filters.date        && !r.date.includes(filters.date)) return false;
      if (filters.org         && r.organisationId !== filters.org) return false;
      if (filters.project     && r.projectId !== filters.project) return false;
      if (filters.deliverable) {
        const n = delivMap[r.deliverableId]?.name ?? "";
        if (!n.toLowerCase().includes(filters.deliverable.toLowerCase())) return false;
      }
      if (filters.member    && r.memberId !== filters.member) return false;
      if (filters.startTime && !r.startTime.startsWith(filters.startTime)) return false;
      if (filters.endTime   && !r.endTime.startsWith(filters.endTime)) return false;
      return true;
    });
    list.sort((a, b) => {
      let av = "", bv = "";
      switch (sortField) {
        case "date":        av = a.date; bv = b.date; break;
        case "org":         av = orgMap[a.organisationId]?.name ?? ""; bv = orgMap[b.organisationId]?.name ?? ""; break;
        case "project":     av = projMap[a.projectId]?.name ?? ""; bv = projMap[b.projectId]?.name ?? ""; break;
        case "deliverable": av = delivMap[a.deliverableId]?.name ?? ""; bv = delivMap[b.deliverableId]?.name ?? ""; break;
        case "member":      av = memberMap[a.memberId]?.name ?? ""; bv = memberMap[b.memberId]?.name ?? ""; break;
        case "startTime":   av = a.startTime; bv = b.startTime; break;
        case "endTime":     av = a.endTime; bv = b.endTime; break;
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [calFiltered, filters, sortField, sortDir]);

  function handleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  }
  function saveRow(id: string, data: WorklogEntry)  { setRows(prev => prev.map(r => r.id === id ? data : r)); }
  function deleteRow(id: string)                     { setRows(prev => prev.filter(r => r.id !== id)); }

  // Assignment CRUD
  function addAssignment(a: Omit<Assignment, "id">) {
    setAdminAssignments(prev => [...prev, { ...a, id: `asgn-${Date.now()}` }]);
  }
  function saveAssignment(id: string, data: Assignment) {
    setAdminAssignments(prev => prev.map(a => a.id === id ? data : a));
  }
  function deleteAssignment(id: string) {
    setAdminAssignments(prev => prev.filter(a => a.id !== id));
  }

  function toggleDate(iso: string) {
    setSelDates(p => { const n = new Set(p); n.has(iso) ? n.delete(iso) : n.add(iso); return n; });
  }
  function clearAll() {
    setSelDates(new Set()); setSelMonth(null); setSelYear(null);
    setFilters({ date: "", org: "", project: "", deliverable: "", member: "", startTime: "", endTime: "" });
  }
  function prevMonth() { calMonth === 0 ? (setCalMonth(11), setCalYear(y => y - 1)) : setCalMonth(m => m - 1); }
  function nextMonth() { calMonth === 11 ? (setCalMonth(0),  setCalYear(y => y + 1)) : setCalMonth(m => m + 1); }

  const availableYears = useMemo(() =>
    Array.from(new Set(rows.map(r => new Date(r.date).getFullYear()))).sort(), [rows]);

  const totalMinutes = useMemo(() => displayRows.reduce((s, r) => {
    const [sh, sm] = r.startTime.split(":").map(Number);
    const [eh, em] = r.endTime.split(":").map(Number);
    return s + (eh * 60 + em - (sh * 60 + sm));
  }, 0), [displayRows]);

  const hasFilter = selDates.size > 0 || selMonth !== null || selYear !== null ||
    Object.values(filters).some(v => v !== "");

  const orgOpts  = organisations.map(o => ({ label: o.name, value: o.id }));
  const projOpts = projects.map(p      => ({ label: p.name, value: p.id }));
  const memOpts  = members.map(m       => ({ label: m.name, value: m.id }));

  const fi: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.divider}`, borderRadius: 6,
    padding: "5px 8px", fontSize: 11, color: T.t2,
    outline: "none", fontFamily: "'DM Sans',sans-serif",
  };

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
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=time]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
        select option { background: #1a1d2e; color: #f1f5f9; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: isMobile ? 18 : 26 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700,
          fontFamily: "'Sora',sans-serif", letterSpacing: "-0.03em", color: T.t1, margin: 0 }}>
          Worklog
        </h1>
        <p style={{ color: T.t5, fontSize: 13, margin: "4px 0 0" }}>Session tracker &amp; time log</p>
      </div>

      {/* Two-column layout: calendar left, table right */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
        gap: isMobile ? 16 : 20, alignItems: "start",
        marginBottom: 20,
      }}>

        {/* ── LEFT: Calendar ── */}
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
            <span style={{ fontSize: 13, fontWeight: 600, color: T.t2 }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{
              width: 30, height: 30, borderRadius: 8, background: T.panel2,
              border: `1px solid ${T.panel2B}`, color: T.t4, cursor: "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
            }}>›</button>
          </div>

          <CalGrid year={calYear} month={calMonth} activeDates={activeDates} selDates={selDates} onToggle={toggleDate} />

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
              { label: "Entries",      val: String(displayRows.length) },
              { label: "Total Hours",  val: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` },
              { label: "Assignments",  val: String(adminAssignments.length) },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.t4 }}>{label}</span>
                <span style={{ fontSize: 13, color: T.acText, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
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

        {/* ── RIGHT: Worklog Table ── */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 16, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${T.panel2B}` }}>
                  <ThCell field="date"        w={122} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Date</ThCell>
                  <ThCell field="org"         w={148} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Organisation</ThCell>
                  <ThCell field="project"     w={148} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Project</ThCell>
                  <ThCell field="deliverable" w={155} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Deliverable</ThCell>
                  <ThCell field="member"      w={138} sortField={sortField} sortDir={sortDir} onSort={handleSort}>Member</ThCell>
                  <ThCell field="startTime"   w={88}  sortField={sortField} sortDir={sortDir} onSort={handleSort}>Start</ThCell>
                  <ThCell field="endTime"     w={88}  sortField={sortField} sortDir={sortDir} onSort={handleSort}>End</ThCell>
                  <th style={{ width: 72, padding: "10px 10px 5px" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
                      letterSpacing: "0.07em", textTransform: "uppercase" }}>Actions</span>
                  </th>
                </tr>
                {/* Column filter sub-row */}
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${T.divider}` }}>
                  {([
                    <input key="d"  style={fi} placeholder="YYYY-MM" value={filters.date}         onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} />,
                    <select key="o" style={fi} value={filters.org}     onChange={e => setFilters(f => ({ ...f, org: e.target.value }))}>
                      <option value="">All</option>{orgOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>,
                    <select key="p" style={fi} value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}>
                      <option value="">All</option>{projOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>,
                    <input key="dv" style={fi} placeholder="Search…"  value={filters.deliverable} onChange={e => setFilters(f => ({ ...f, deliverable: e.target.value }))} />,
                    <select key="m" style={fi} value={filters.member}  onChange={e => setFilters(f => ({ ...f, member: e.target.value }))}>
                      <option value="">All</option>{memOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>,
                    <input key="st" style={fi} placeholder="HH" value={filters.startTime} onChange={e => setFilters(f => ({ ...f, startTime: e.target.value }))} />,
                    <input key="et" style={fi} placeholder="HH" value={filters.endTime}   onChange={e => setFilters(f => ({ ...f, endTime: e.target.value }))} />,
                    <div key="act" />,
                  ] as React.ReactNode[]).map((el, i) => (
                    <td key={i} style={{ padding: "5px 8px" }}>{el}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", minHeight: 200, gap: 10, color: T.t6 }}>
                      <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
                        <circle cx={12} cy={12} r={10}/><path d="M12 6v6l4 2"/>
                      </svg>
                      <span style={{ fontSize: 13.5 }}>No entries for this selection</span>
                    </div>
                  </td></tr>
                ) : displayRows.map(row => (
                  <WorklogRow key={row.id} row={row} onSave={saveRow} onDelete={deleteRow} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Admin: Assign Deliverables (full-width below the two-column layout) ── */}
      <AssignDeliverablesSection
        adminAssignments={adminAssignments}
        onAdd={addAssignment}
        onSave={saveAssignment}
        onDelete={deleteAssignment}
      />
    </div>
  );
}