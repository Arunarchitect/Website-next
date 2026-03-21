"use client";

// salary-expenses.tsx
// Expense listing section — sits below the salary calculator.
// Inherits member/org/project from the calculator's last Run Analysis.
// List is hidden until the calculator's Run Analysis has been triggered at least once.

import { useState, useMemo, useEffect } from "react";
import {
  members, projects, organisations, projMap, memberMap,
  expenses as allExpenses,
  type Expense,
} from "./data";
import {
  T, CATEGORY_META, fmtINR, fmtDate, selStyle,
  Divider, FieldLabel, Avatar, Bar,
} from "./salary-shared";

// ─── Category badge ───────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? { label: category, color: T.t5, icon: "•" };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
      background: `${meta.color}1a`, color: meta.color,
      border: `1px solid ${meta.color}33`, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ fontSize: 11 }}>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function ReimburseTag({ reimbursed }: { reimbursed: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      letterSpacing: "0.05em",
      background: reimbursed ? T.greenBg : T.amberBg,
      color:      reimbursed ? T.green   : T.amber,
      border: `1px solid ${reimbursed ? T.green : T.amber}33`,
      whiteSpace: "nowrap",
    }}>
      {reimbursed ? "Reimbursed" : "Pending"}
    </span>
  );
}

// ─── Expense table row ────────────────────────────────────────────────────────
function ExpenseRow({ expense, onToggle }: {
  expense: Expense;
  onToggle: (id: string) => void;
}) {
  const [hovered, setHov] = useState(false);
  const proj   = projMap[expense.projectId];
  const member = memberMap[expense.memberId];
  const memIdx = members.findIndex(m => m.id === expense.memberId);

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: `1px solid ${T.divider}`,
        background: hovered ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Date */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle",
        fontSize: 12.5, color: T.t3, whiteSpace: "nowrap" }}>
        {fmtDate(expense.date)}
      </td>

      {/* Member */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Avatar name={member?.name ?? "?"} size={24} idx={memIdx >= 0 ? memIdx : 0} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: T.t2, fontWeight: 500,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
              {member?.name ?? "—"}
            </div>
            <div style={{ fontSize: 10.5, color: T.t5 }}>{member?.role ?? ""}</div>
          </div>
        </div>
      </td>

      {/* Category */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle" }}>
        <CategoryBadge category={expense.category} />
      </td>

      {/* Project */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: proj?.color ?? T.t6, display: "inline-block" }} />
          <span style={{ fontSize: 12.5, color: T.t2, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>
            {proj?.name ?? "—"}
          </span>
        </div>
      </td>

      {/* Remarks */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle",
        fontSize: 12, color: T.t5, maxWidth: 180 }}>
        <span style={{ display: "block", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {expense.remarks || <span style={{ color: T.t6 }}>—</span>}
        </span>
      </td>

      {/* Amount */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle", textAlign: "right",
        fontSize: 13, fontWeight: 700, color: T.t1, whiteSpace: "nowrap" }}>
        {fmtINR(expense.amount)}
      </td>

      {/* Status */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle" }}>
        <ReimburseTag reimbursed={expense.reimbursed} />
      </td>

      {/* Toggle reimbursed button */}
      <td style={{ padding: "10px 13px", verticalAlign: "middle", textAlign: "center" }}>
        <button
          onClick={() => onToggle(expense.id)}
          title={expense.reimbursed ? "Mark as pending" : "Mark as reimbursed"}
          style={{
            width: 28, height: 28, borderRadius: 7, border: "none", cursor: "pointer",
            background: expense.reimbursed ? T.redBg : T.greenBg,
            color:      expense.reimbursed ? T.red   : T.green,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
        >
          {expense.reimbursed
            ? <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
              </svg>
            : <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
          }
        </button>
      </td>
    </tr>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SalaryExpensesProps {
  dateFrom: string;
  dateTo:   string;
  // Inherited from the calculator's last successful Run Analysis.
  // Pre-populates filters; user can still override them inside this section.
  inheritedFilters: { memberId: string; orgId: string; projId: string };
  // Whether Run Analysis has ever been triggered. List is hidden until true.
  analysisRan: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SalaryExpenses({
  dateFrom, dateTo, inheritedFilters, analysisRan,
}: SalaryExpensesProps) {

  // Local editable copy of expenses so toggling reimbursed status is in-memory
  const [expenseList, setExpenseList] = useState<Expense[]>(() =>
    allExpenses.map(e => ({ ...e }))
  );

  // ── Filter state — seeded from inheritedFilters, user can override ─────────
  const [selOrgId,    setSelOrgId]    = useState(inheritedFilters.orgId);
  const [selMemberId, setSelMemberId] = useState(inheritedFilters.memberId);
  const [selProjId,   setSelProjId]   = useState(inheritedFilters.projId);
  const [selCategory, setSelCategory] = useState("");
  const [selStatus,   setSelStatus]   = useState<"" | "reimbursed" | "pending">("");

  // When the calculator fires a new Run Analysis, sync the inherited filters in
  useEffect(() => {
    setSelOrgId(inheritedFilters.orgId);
    setSelMemberId(inheritedFilters.memberId);
    setSelProjId(inheritedFilters.projId);
  }, [inheritedFilters.orgId, inheritedFilters.memberId, inheritedFilters.projId]);

  // ── Derived option lists ───────────────────────────────────────────────────
  const projOptions = selOrgId ? projects.filter(p => p.organisationId === selOrgId) : projects;
  const memOptions  = selOrgId
    ? members.filter(m => allExpenses.some(e => e.memberId === m.id && e.organisationId === selOrgId))
    : members;

  // ── Filtered expenses ──────────────────────────────────────────────────────
  const filtered = useMemo(() => expenseList.filter(e => {
    if (selMemberId && e.memberId       !== selMemberId) return false;
    if (selOrgId    && e.organisationId !== selOrgId)    return false;
    if (selProjId   && e.projectId      !== selProjId)   return false;
    if (selCategory && e.category       !== selCategory) return false;
    if (selStatus === "reimbursed" && !e.reimbursed)     return false;
    if (selStatus === "pending"    &&  e.reimbursed)     return false;
    if (dateFrom && e.date < dateFrom)                   return false;
    if (dateTo   && e.date > dateTo)                     return false;
    return true;
  }), [expenseList, selMemberId, selOrgId, selProjId, selCategory, selStatus, dateFrom, dateTo]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalAmount   = filtered.reduce((s, e) => s + e.amount, 0);
  const reimbursedAmt = filtered.filter(e =>  e.reimbursed).reduce((s, e) => s + e.amount, 0);
  const pendingAmt    = filtered.filter(e => !e.reimbursed).reduce((s, e) => s + e.amount, 0);

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const maxCatAmt = Math.max(...catBreakdown.map(([, v]) => v), 1);

  function toggleReimbursed(id: string) {
    setExpenseList(prev => prev.map(e => e.id === id ? { ...e, reimbursed: !e.reimbursed } : e));
  }

  function clearFilters() {
    setSelOrgId(""); setSelMemberId(""); setSelProjId("");
    setSelCategory(""); setSelStatus("");
  }

  const hasFilters = selOrgId || selMemberId || selProjId || selCategory || selStatus;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.panelB}`,
      borderRadius: 16, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Section header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: T.purpleBg, border: `1px solid ${T.purple}33`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={16} height={16} viewBox="0 0 20 20" fill="none">
              <rect x={2} y={4} width={16} height={13} rx={2} stroke={T.purple} strokeWidth={1.4}/>
              <path d="M2 8h16" stroke={T.purple} strokeWidth={1.4}/>
              <path d="M6 12h3M6 14.5h2" stroke={T.purple} strokeWidth={1.4} strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.t1 }}>Expenses</div>
            <div style={{ fontSize: 11.5, color: T.t5, marginTop: 2 }}>
              Reimbursable &amp; reimbursed expenses
              {!analysisRan && (
                <span style={{ color: T.amber, marginLeft: 6 }}>
                  — run the analysis above to load
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Inherited filter chips — show which context is active */}
        {analysisRan && (inheritedFilters.memberId || inheritedFilters.projId) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {inheritedFilters.memberId && (() => {
              const m = memberMap[inheritedFilters.memberId];
              const idx = members.findIndex(x => x.id === inheritedFilters.memberId);
              return m ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                  background: T.acLight, border: `1px solid ${T.acMid}44`,
                  borderRadius: 20, padding: "4px 10px 4px 6px", fontSize: 11.5, color: T.acText }}>
                  <Avatar name={m.name} size={18} idx={idx} />
                  {m.name.split(" ")[0]}
                </div>
              ) : null;
            })()}
            {inheritedFilters.projId && (() => {
              const p = projMap[inheritedFilters.projId];
              return p ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6,
                  background: `${p.color}18`, border: `1px solid ${p.color}44`,
                  borderRadius: 20, padding: "4px 10px 4px 8px", fontSize: 11.5, color: p.color }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, display: "inline-block" }} />
                  {p.name}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* ── Not yet run — placeholder ── */}
      {!analysisRan ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: 160, gap: 12,
          border: `1px dashed ${T.divider}`, borderRadius: 12, color: T.t6 }}>
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1}>
            <rect x={3} y={4} width={18} height={16} rx={2}/>
            <path d="M8 2v4M16 2v4M3 10h18M8 14h4M8 17h6"/>
          </svg>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, marginBottom: 3 }}>Expense list not loaded</div>
            <div style={{ fontSize: 11.5 }}>
              Select a member in the calculator above and hit Run Analysis
            </div>
          </div>
        </div>
      ) : (
        <>
          <Divider />

          {/* ── Filters ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <FieldLabel>Organisation</FieldLabel>
                <select value={selOrgId}
                  onChange={e => { setSelOrgId(e.target.value); setSelProjId(""); setSelMemberId(""); }}
                  style={selStyle()}>
                  <option value="">All Orgs</option>
                  {organisations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Member</FieldLabel>
                <select value={selMemberId} onChange={e => setSelMemberId(e.target.value)} style={selStyle()}>
                  <option value="">All Members</option>
                  {memOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Project</FieldLabel>
                <select value={selProjId} onChange={e => setSelProjId(e.target.value)} style={selStyle()}>
                  <option value="">All Projects</option>
                  {projOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <FieldLabel>Category</FieldLabel>
                <select value={selCategory} onChange={e => setSelCategory(e.target.value)} style={selStyle()}>
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select value={selStatus} onChange={e => setSelStatus(e.target.value as "" | "reimbursed" | "pending")}
                  style={selStyle()}>
                  <option value="">All</option>
                  <option value="reimbursed">Reimbursed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {hasFilters && (
                <button onClick={clearFilters} style={{
                  padding: "9px 16px", borderRadius: 8, border: `1px solid ${T.panel2B}`,
                  background: "transparent", color: T.t4, fontSize: 12.5,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                  whiteSpace: "nowrap", alignSelf: "flex-end", transition: "color 0.15s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; }}
                >✕ Clear</button>
              )}
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Total",      val: fmtINR(totalAmount),     color: T.acText },
              { label: "Reimbursed", val: fmtINR(reimbursedAmt),   color: T.green  },
              { label: "Pending",    val: fmtINR(pendingAmt),       color: T.amber  },
              { label: "Entries",    val: String(filtered.length),  color: T.teal   },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: `${color}0d`, border: `1px solid ${color}22`,
                borderRadius: 10, padding: "11px 13px" }}>
                <div style={{ fontSize: 9.5, color, fontWeight: 600,
                  letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.t1,
                  fontFamily: "'Sora',sans-serif", marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* ── Category breakdown bars ── */}
          {catBreakdown.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
                letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
                By Category
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {catBreakdown.map(([cat, amt]) => {
                  const meta = CATEGORY_META[cat] ?? { label: cat, color: T.t5, icon: "•" };
                  return (
                    <div key={cat}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 13 }}>{meta.icon}</span>
                          <span style={{ fontSize: 12.5, color: T.t2 }}>{meta.label}</span>
                          <span style={{ fontSize: 11, color: T.t6 }}>
                            {filtered.filter(e => e.category === cat).length} entries
                          </span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{fmtINR(amt)}</span>
                      </div>
                      <Bar pct={(amt / maxCatAmt) * 100} color={meta.color} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Divider />

          {/* ── Expense table ── */}
          {filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", minHeight: 120, gap: 10, color: T.t6,
              border: `1px dashed ${T.divider}`, borderRadius: 12 }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={T.t6} strokeWidth={1.2}>
                <rect x={3} y={4} width={18} height={16} rx={2}/>
                <path d="M8 2v4M16 2v4M3 10h18M8 14h4M8 17h6"/>
              </svg>
              <span style={{ fontSize: 13 }}>No expenses match the current filters</span>
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: `1px solid ${T.panel2B}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)",
                      borderBottom: `1px solid ${T.panel2B}` }}>
                      {[
                        { label: "Date",     w: 110 },
                        { label: "Member",   w: 160 },
                        { label: "Category", w: 130 },
                        { label: "Project",  w: 150 },
                        { label: "Remarks",  w: 170 },
                        { label: "Amount",   w: 110, right: true },
                        { label: "Status",   w: 120 },
                        { label: "",         w: 52  },
                      ].map(({ label, w, right }) => (
                        <th key={label + w} style={{ width: w, padding: "10px 13px",
                          textAlign: right ? "right" : "left" }}>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: T.t5,
                            letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <ExpenseRow key={e.id} expense={e} onToggle={toggleReimbursed} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `1px solid ${T.panel2B}`,
                      background: "rgba(255,255,255,0.02)" }}>
                      <td colSpan={5} style={{ padding: "10px 13px",
                        fontSize: 11.5, color: T.t5, fontWeight: 600 }}>
                        {filtered.length} entries
                        {(dateFrom || dateTo) && (
                          <span style={{ marginLeft: 6, fontWeight: 400 }}>
                            · {dateFrom || "—"} to {dateTo || "—"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 13px", textAlign: "right",
                        fontSize: 14, fontWeight: 700, color: T.t1 }}>
                        {fmtINR(totalAmount)}
                      </td>
                      <td colSpan={2} style={{ padding: "10px 13px", fontSize: 11.5 }}>
                        <span style={{ color: T.green }}>{fmtINR(reimbursedAmt)} ✓</span>
                        <span style={{ marginLeft: 10, color: T.amber }}>{fmtINR(pendingAmt)} pending</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}