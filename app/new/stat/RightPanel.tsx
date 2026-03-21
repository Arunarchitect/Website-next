"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  entries, expenses, projects, deliverables, members,
  EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS,
  type ExpenseCategory,
} from "./data";
import { fmt, fmtDate, applyDateFilter, MONTHS, type DateFilter } from "./shared";

// ─── Reusable SearchDropdown ───────────────────────────────────────────────────
function SearchDropdown({
  label, placeholder, items, selectedId, onSelect, colorDot,
}: {
  label: string; placeholder: string;
  items: { id: string; name: string }[];
  selectedId: string | null; onSelect: (id: string | null) => void;
  colorDot?: string;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef<HTMLDivElement>(null);
  const selected          = items.find(i => i.id === selectedId);
  const filtered          = query
    ? items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(id: string) { onSelect(selectedId === id ? null : id); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {label && <span className="oa-label" style={{ marginBottom: 6 }}>{label}</span>}
      <button
        type="button"
        className={`oa-dd-trigger${open ? " open" : ""}${selectedId ? " selected" : ""}`}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? (
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {colorDot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorDot, flexShrink: 0 }} />}
              {selected.name}
            </span>
          ) : (
            <span style={{ opacity: 0.4 }}>{placeholder}</span>
          )}
        </span>
        <svg width={11} height={11} viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s", flexShrink: 0, opacity: 0.5 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="oa-dd-menu">
          <div style={{ padding: "7px 12px", borderBottom: "1px solid var(--oa-border)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ opacity: 0.35, fontSize: 14, color: "var(--oa-text)" }}>⌕</span>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search…" className="oa-dd-input" />
          </div>
          {selectedId && (
            <button className="oa-dd-clear" onClick={() => { onSelect(null); setOpen(false); setQuery(""); }}>
              ✕ &nbsp;Clear
            </button>
          )}
          <div style={{ maxHeight: 190, overflowY: "auto" }}>
            {filtered.length === 0
              ? <div style={{ padding: "11px 13px", opacity: 0.4, fontSize: 13, color: "var(--oa-text)" }}>No results</div>
              : filtered.map(item => (
                <button key={item.id} className={`oa-dd-item${item.id === selectedId ? " active" : ""}`} onClick={() => pick(item.id)}>
                  {colorDot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorDot, flexShrink: 0 }} />}
                  <span style={{ flex: 1 }}>{item.name}</span>
                  {item.id === selectedId && <span style={{ fontSize: 10, color: "var(--oa-accent)" }}>✓</span>}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ring chart ───────────────────────────────────────────────────────────────
function Ring({ value, size = 48, stroke = 5, color = "var(--oa-accent)" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value, 100) / 100 * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.65s ease" }} />
    </svg>
  );
}

// ─── Member avatar ─────────────────────────────────────────────────────────────
function Avatar({ mId }: { mId: string }) {
  const m = members.find(x => x.id === mId);
  return (
    <div className="oa-avatar">{m?.avatar ?? "?"}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Revenue (org-level only, no person/project filter)
// ─────────────────────────────────────────────────────────────────────────────
function RevenueSection({ dateFilter }: { dateFilter: DateFilter }) {
  const filtered = useMemo(
    () => applyDateFilter(entries, dateFilter),
    [dateFilter],
  );

  const totalRevenue = filtered.reduce((s, e) => s + e.revenue, 0);
  const totalSpend   = filtered.reduce((s, e) => s + e.spend,   0);
  const balance      = totalRevenue - totalSpend;
  const balancePct   = totalRevenue > 0 ? (balance / totalRevenue) * 100 : 0;

  // Revenue by project
  const byProject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filtered) map[e.projectId] = (map[e.projectId] ?? 0) + e.revenue;
    return projects.map(p => ({ ...p, rev: map[p.id] ?? 0 })).filter(p => p.rev > 0)
      .sort((a, b) => b.rev - a.rev);
  }, [filtered]);

  const maxRev = byProject[0]?.rev ?? 1;

  return (
    <section className="oa-panel">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <span className="oa-label">Organisation Revenue</span>
          <h3 className="oa-display" style={{ fontSize: 32, fontWeight: 400, color: "var(--oa-text)", lineHeight: 1 }}>
            {fmt(totalRevenue)}
          </h3>
          <p style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 4 }}>
            {filtered.length} entries · all projects
          </p>
        </div>
        <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
          <Ring value={Math.max(0, balancePct)} size={56} stroke={6} color="var(--oa-green)" />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "var(--oa-green)" }}>
            {balancePct.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div className="oa-stat-card oa-stat-green">
          <span className="oa-label" style={{ marginBottom: 2 }}>Revenue</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--oa-green)" }}>{fmt(totalRevenue)}</span>
        </div>
        <div className="oa-stat-card oa-stat-red">
          <span className="oa-label" style={{ marginBottom: 2 }}>Spend</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--oa-red)" }}>{fmt(totalSpend)}</span>
        </div>
        <div className={`oa-stat-card ${balance >= 0 ? "oa-stat-blue" : "oa-stat-red"}`}>
          <span className="oa-label" style={{ marginBottom: 2 }}>Balance</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: balance >= 0 ? "var(--oa-accent)" : "var(--oa-red)" }}>
            {balance >= 0 ? "+" : ""}{fmt(balance)}
          </span>
        </div>
      </div>

      {/* Revenue by project bars */}
      {byProject.length > 0 && (
        <>
          <span className="oa-label">Revenue by Project</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byProject.map(p => (
              <div key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: "var(--oa-text)" }}>
                    <span className="oa-dot" style={{ background: p.color }} />
                    {p.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: p.color }}>{fmt(p.rev)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: "var(--oa-surface3)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: p.color,
                    width: `${(p.rev / maxRev) * 100}%`,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Spend / Person (only reimbursed expenses count as spend paid out)
// ─────────────────────────────────────────────────────────────────────────────
function SpendSection({
  dateFilter,
  onMemberChange,
}: {
  dateFilter: DateFilter;
  onMemberChange: (id: string | null) => void;
}) {
  const [memberId, setMemberId] = useState<string | null>(null);

  function selectMember(id: string | null) {
    setMemberId(id);
    onMemberChange(id);
  }

  const filteredAll = useMemo(() => applyDateFilter(expenses, dateFilter), [dateFilter]);

  // Only reimbursed expenses count as "paid spend"
  const reimbursed = useMemo(
    () => filteredAll.filter(e => e.reimbursed && (!memberId || e.userId === memberId)),
    [filteredAll, memberId],
  );

  const totalPaid   = reimbursed.reduce((s, e) => s + e.amount, 0);

  // Breakdown by category (reimbursed only)
  const byCat = useMemo(() => {
    const map: Partial<Record<ExpenseCategory, number>> = {};
    for (const e of reimbursed) map[e.category] = (map[e.category] ?? 0) + e.amount;
    return (Object.entries(map) as [ExpenseCategory, number][])
      .sort((a, b) => b[1] - a[1]);
  }, [reimbursed]);

  // Per-member summary (when no member selected)
  const memberSummary = useMemo(() => {
    if (memberId) return null;
    return members.map(m => {
      const mExp = reimbursed.filter(e => e.userId === m.id);
      const total = mExp.reduce((s, e) => s + e.amount, 0);
      const salary = mExp.filter(e => e.category === "salary").reduce((s, e) => s + e.amount, 0);
      const others = total - salary;
      return { ...m, total, salary, others, count: mExp.length };
    }).filter(m => m.total > 0).sort((a, b) => b.total - a.total);
  }, [reimbursed, memberId]);

  // Single-member category breakdown
  const memberDetail = useMemo(() => {
    if (!memberId) return null;
    const m = members.find(x => x.id === memberId)!;
    const mExp = reimbursed.filter(e => e.userId === memberId);
    const total = mExp.reduce((s, e) => s + e.amount, 0);
    const byCatLocal = (Object.entries(
      mExp.reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {} as Record<string, number>)
    ) as [ExpenseCategory, number][]).sort((a, b) => b[1] - a[1]);
    return { member: m, total, byCat: byCatLocal, count: mExp.length };
  }, [reimbursed, memberId]);

  return (
    <section className="oa-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="oa-label">Spend — Reimbursed Amount</span>
          <h3 className="oa-display" style={{ fontSize: 28, fontWeight: 400, color: "var(--oa-text)" }}>
            {fmt(totalPaid)}
            <span style={{ fontSize: 14, color: "var(--oa-muted)", fontFamily: "'DM Sans', sans-serif", fontWeight: 400, marginLeft: 8 }}>
              paid out
            </span>
          </h3>
        </div>
        <div style={{ minWidth: 180 }}>
          <SearchDropdown
            label="Filter by Person"
            placeholder="All members"
            items={members.map(m => ({ id: m.id, name: `${m.name} · ${m.role}` }))}
            selectedId={memberId}
            onSelect={selectMember}
          />
        </div>
      </div>

      {/* Category breakdown pills */}
      {byCat.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {byCat.map(([cat, amt]) => (
            <div key={cat} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: `${EXPENSE_CATEGORY_COLORS[cat]}12`,
              border: `1px solid ${EXPENSE_CATEGORY_COLORS[cat]}35`,
              borderRadius: 10, padding: "6px 12px",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: EXPENSE_CATEGORY_COLORS[cat], flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: EXPENSE_CATEGORY_COLORS[cat] }}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </span>
              <span style={{ fontSize: 11, color: "var(--oa-muted)", marginLeft: 2 }}>{fmt(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Per-member table */}
      {!memberId && memberSummary && memberSummary.length > 0 && (
        <div>
          <span className="oa-label">Members — Reimbursed Breakdown</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {memberSummary.map(m => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 12, background: "var(--oa-surface2)",
                border: "1px solid var(--oa-border)", cursor: "pointer", transition: "all 0.15s",
              }}
                onClick={() => selectMember(m.id)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--oa-accent-border)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--oa-border)")}
              >
                <Avatar mId={m.id} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oa-text)", marginBottom: 2 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--oa-muted)" }}>{m.role}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--oa-red)" }}>{fmt(m.total)}</div>
                  <div style={{ fontSize: 11, color: "var(--oa-muted)", marginTop: 2 }}>
                    Salary {fmt(m.salary)} · Other {fmt(m.others)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single member detail */}
      {memberDetail && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Avatar mId={memberDetail.member.id} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--oa-text)" }}>{memberDetail.member.name}</div>
              <div style={{ fontSize: 11, color: "var(--oa-muted)" }}>{memberDetail.member.role}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--oa-red)" }}>{fmt(memberDetail.total)}</div>
              <div style={{ fontSize: 11, color: "var(--oa-muted)" }}>{memberDetail.count} reimbursed entries</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {memberDetail.byCat.map(([cat, amt]) => {
              const pct = memberDetail.total > 0 ? (amt / memberDetail.total) * 100 : 0;
              return (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="oa-cat-badge" style={{
                      background: `${EXPENSE_CATEGORY_COLORS[cat]}18`,
                      border: `1px solid ${EXPENSE_CATEGORY_COLORS[cat]}40`,
                      color: EXPENSE_CATEGORY_COLORS[cat],
                    }}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oa-text)" }}>
                      {fmt(amt)}
                      <span style={{ fontSize: 11, color: "var(--oa-muted)", marginLeft: 5 }}>
                        {pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: "var(--oa-surface3)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: EXPENSE_CATEGORY_COLORS[cat],
                      width: `${pct}%`, transition: "width 0.55s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reimbursed.length === 0 && (
        <div className="oa-empty">
          <div style={{ fontSize: 13, color: "var(--oa-muted)" }}>No reimbursed expenses in this period.</div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Comparison (Revenue vs Total Expenses, org-level only)
// ─────────────────────────────────────────────────────────────────────────────
function ComparisonSection({ dateFilter }: { dateFilter: DateFilter }) {
  const filteredEntries  = useMemo(() => applyDateFilter(entries,   dateFilter), [dateFilter]);
  const filteredExpenses = useMemo(() => applyDateFilter(expenses,  dateFilter), [dateFilter]);

  const totalRevenue      = filteredEntries.reduce((s, e) => s + e.revenue, 0);
  const totalExpenses     = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const reimbursedTotal   = filteredExpenses.filter(e => e.reimbursed).reduce((s, e) => s + e.amount, 0);
  const pendingTotal      = filteredExpenses.filter(e => !e.reimbursed).reduce((s, e) => s + e.amount, 0);
  const balance           = totalRevenue - totalExpenses;
  const balancePct        = totalRevenue > 0 ? Math.min(100, (balance / totalRevenue) * 100) : 0;
  const expensePct        = totalRevenue > 0 ? Math.min(100, (totalExpenses / totalRevenue) * 100) : 0;

  const revBarPct = totalRevenue + totalExpenses > 0
    ? (totalRevenue / (totalRevenue + totalExpenses)) * 100 : 50;

  // Expense breakdown by category
  const byCat = useMemo(() => {
    const map: Partial<Record<ExpenseCategory, number>> = {};
    for (const e of filteredExpenses) map[e.category] = (map[e.category] ?? 0) + e.amount;
    return (Object.entries(map) as [ExpenseCategory, number][]).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const maxCatAmt = byCat[0]?.[1] ?? 1;

  return (
    <section className="oa-panel">
      <span className="oa-label">Organisation — Revenue vs Expenses</span>

      {/* Big numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
        <div className="oa-stat-card oa-stat-green">
          <span className="oa-label" style={{ marginBottom: 2 }}>Revenue</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--oa-green)" }}>{fmt(totalRevenue)}</span>
        </div>
        <div className="oa-stat-card oa-stat-red">
          <span className="oa-label" style={{ marginBottom: 2 }}>Total Expenses</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--oa-red)" }}>{fmt(totalExpenses)}</span>
          <span style={{ fontSize: 10, color: "var(--oa-muted)", marginTop: 2 }}>{expensePct.toFixed(1)}% of revenue</span>
        </div>
        <div className="oa-stat-card oa-stat-amber">
          <span className="oa-label" style={{ marginBottom: 2 }}>Reimbursed</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--oa-amber)" }}>{fmt(reimbursedTotal)}</span>
        </div>
        <div className="oa-stat-card oa-stat-amber" style={{ opacity: 0.7 }}>
          <span className="oa-label" style={{ marginBottom: 2 }}>Pending</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--oa-amber)" }}>{fmt(pendingTotal)}</span>
        </div>
      </div>

      {/* Balance */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
          <Ring value={Math.max(0, balancePct)} size={52} stroke={5} color={balance >= 0 ? "var(--oa-green)" : "var(--oa-red)"} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: balance >= 0 ? "var(--oa-green)" : "var(--oa-red)" }}>
            BAL
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--oa-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Balance</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: balance >= 0 ? "var(--oa-green)" : "var(--oa-red)" }}>
              {balance >= 0 ? "+" : ""}{fmt(balance)}
            </span>
          </div>
          {/* Stacked bar */}
          <div style={{ height: 10, borderRadius: 99, background: "var(--oa-surface3)", overflow: "hidden", display: "flex" }}>
            <div style={{
              width: `${revBarPct}%`, background: "linear-gradient(90deg, #34d39988, var(--oa-green))",
              height: "100%", borderRadius: "99px 0 0 99px", transition: "width 0.6s ease",
            }} />
            <div style={{
              flex: 1, background: "linear-gradient(90deg, #f8717188, var(--oa-red))",
              height: "100%", borderRadius: "0 99px 99px 0",
            }} />
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11 }}>
            <span style={{ color: "var(--oa-green)", fontWeight: 500 }}>● Revenue</span>
            <span style={{ color: "var(--oa-red)", fontWeight: 500 }}>● Expenses</span>
          </div>
        </div>
      </div>

      {/* Expense by category bars */}
      {byCat.length > 0 && (
        <>
          <span className="oa-label">Expenses by Category</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {byCat.map(([cat, amt]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span className="oa-cat-badge" style={{
                    background: `${EXPENSE_CATEGORY_COLORS[cat]}15`,
                    border: `1px solid ${EXPENSE_CATEGORY_COLORS[cat]}35`,
                    color: EXPENSE_CATEGORY_COLORS[cat],
                  }}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--oa-text)" }}>{fmt(amt)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "var(--oa-surface3)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99, background: EXPENSE_CATEGORY_COLORS[cat],
                    width: `${(amt / maxCatAmt) * 100}%`, transition: "width 0.55s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Expense List (includes salary; person filter inherited + project filter)
// ─────────────────────────────────────────────────────────────────────────────
type ExpSortKey = "date" | "amount";

function ExpenseList({
  dateFilter,
  inheritedMemberId,
}: {
  dateFilter: DateFilter;
  inheritedMemberId: string | null;
}) {
  const [loaded,    setLoaded]    = useState(false);
  const [sortKey,   setSortKey]   = useState<ExpSortKey>("date");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [page,      setPage]      = useState(0);

  // local filters (only active when inherited member is cleared)
  const [localMember,  setLocalMember]  = useState<string | null>(null);
  const [localProject, setLocalProject] = useState<string | null>(null);

  const activeMember = inheritedMemberId ?? localMember;

  const PAGE = 14;

  const projectColorMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p.color])), [],
  );

  const filtered = useMemo(() => {
    let f = applyDateFilter(expenses, dateFilter);
    if (activeMember)  f = f.filter(e => e.userId    === activeMember);
    if (localProject)  f = f.filter(e => e.projectId === localProject);
    return f;
  }, [dateFilter, activeMember, localProject]);

  const sorted = useMemo(() => {
    if (!loaded) return [];
    return [...filtered].sort((a, b) => {
      if (sortKey === "date") {
        const v = a.date.localeCompare(b.date);
        return sortDir === "asc" ? v : -v;
      }
      return sortDir === "asc" ? a.amount - b.amount : b.amount - a.amount;
    });
  }, [filtered, sortKey, sortDir, loaded]);

  const totalPages = Math.ceil(sorted.length / PAGE);
  const paged      = sorted.slice(page * PAGE, (page + 1) * PAGE);

  function toggleSort(k: ExpSortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
    setPage(0);
  }

  const arrow = (k: ExpSortKey) => sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  // Totals for the current filtered set
  const totalAmt       = filtered.reduce((s, e) => s + e.amount, 0);
  const reimbursedAmt  = filtered.filter(e => e.reimbursed).reduce((s, e) => s + e.amount, 0);
  const pendingAmt     = totalAmt - reimbursedAmt;

  // ── Collapsed load button ──
  if (!loaded) {
    return (
      <div className="oa-panel" style={{ padding: 0, overflow: "hidden" }}>
        {/* Filters even when collapsed */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--oa-border)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <span className="oa-label">Expense List</span>
            <p style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 2 }}>
              All expenses including salary · {filtered.length} records
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
            {!inheritedMemberId && (
              <div style={{ minWidth: 160 }}>
                <SearchDropdown label="Person" placeholder="All" items={members.map(m => ({ id: m.id, name: m.name }))}
                  selectedId={localMember} onSelect={id => { setLocalMember(id); }} />
              </div>
            )}
            {inheritedMemberId && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--oa-accent-bg)", border: "1px solid var(--oa-accent-border)", borderRadius: 10, padding: "6px 12px" }}>
                <Avatar mId={inheritedMemberId} />
                <span style={{ fontSize: 12, color: "var(--oa-accent)", fontWeight: 600 }}>
                  {members.find(m => m.id === inheritedMemberId)?.name}
                </span>
                <span style={{ fontSize: 10, color: "var(--oa-muted)", marginLeft: 2 }}>· from Spend filter</span>
              </div>
            )}
            <div style={{ minWidth: 160 }}>
              <SearchDropdown label="Project" placeholder="All projects"
                items={projects}
                selectedId={localProject}
                onSelect={id => { setLocalProject(id); setPage(0); }}
                colorDot={localProject ? projectColorMap[localProject] : undefined}
              />
            </div>
          </div>
        </div>
        <button className="oa-load-bar" style={{ margin: "12px 20px", width: "calc(100% - 40px)", borderRadius: 12 }} onClick={() => setLoaded(true)}>
          <span style={{ fontSize: 18 }}>🧾</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--oa-text)" }}>Load Expense Records</div>
            <div style={{ fontSize: 12, color: "var(--oa-muted)", marginTop: 2 }}>
              {filtered.length} records · {fmt(totalAmt)} total · {fmt(reimbursedAmt)} reimbursed · {fmt(pendingAmt)} pending
            </div>
          </div>
          <span style={{
            background: "var(--oa-accent-bg)", border: "1px solid var(--oa-accent-border)",
            color: "var(--oa-accent)", fontSize: 11, fontWeight: 700,
            padding: "5px 12px", borderRadius: 8, flexShrink: 0,
          }}>Load ↓</span>
        </button>
        <div style={{ height: 12 }} />
      </div>
    );
  }

  return (
    <div className="oa-panel" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header with filters */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--oa-border)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="oa-section-title">Expense Records</span>
            <span style={{ fontSize: 12, color: "var(--oa-muted)" }}>
              {filtered.length} records
            </span>
            <button onClick={() => setLoaded(false)}
              style={{ background: "none", border: "none", color: "var(--oa-faint)", cursor: "pointer", fontSize: 11 }}>
              ✕ collapse
            </button>
          </div>
          {/* Summary badges */}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--oa-text)", background: "var(--oa-surface3)", border: "1px solid var(--oa-border)", borderRadius: 8, padding: "3px 9px" }}>
              Total <strong>{fmt(totalAmt)}</strong>
            </span>
            <span style={{ fontSize: 11, color: "var(--oa-green)", background: "var(--oa-green-bg)", border: "1px solid var(--oa-green-border)", borderRadius: 8, padding: "3px 9px" }}>
              Reimbursed <strong>{fmt(reimbursedAmt)}</strong>
            </span>
            <span style={{ fontSize: 11, color: "var(--oa-amber)", background: "var(--oa-amber-bg)", border: "1px solid var(--oa-amber-border)", borderRadius: 8, padding: "3px 9px" }}>
              Pending <strong>{fmt(pendingAmt)}</strong>
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          {!inheritedMemberId && (
            <div style={{ minWidth: 155 }}>
              <SearchDropdown label="Person" placeholder="All"
                items={members.map(m => ({ id: m.id, name: m.name }))}
                selectedId={localMember}
                onSelect={id => { setLocalMember(id); setPage(0); }}
              />
            </div>
          )}
          {inheritedMemberId && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--oa-accent-bg)", border: "1px solid var(--oa-accent-border)", borderRadius: 10, padding: "6px 12px", alignSelf: "flex-end" }}>
              <Avatar mId={inheritedMemberId} />
              <div>
                <div style={{ fontSize: 12, color: "var(--oa-accent)", fontWeight: 600 }}>
                  {members.find(m => m.id === inheritedMemberId)?.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--oa-muted)" }}>from Spend section</div>
              </div>
            </div>
          )}
          <div style={{ minWidth: 155 }}>
            <SearchDropdown
              label="Project"
              placeholder="All projects"
              items={projects}
              selectedId={localProject}
              onSelect={id => { setLocalProject(id); setPage(0); }}
              colorDot={localProject ? projectColorMap[localProject] : undefined}
            />
          </div>
          <div style={{ display: "flex", gap: 5, alignSelf: "flex-end" }}>
            {(["date","amount"] as ExpSortKey[]).map(k => (
              <button key={k} className={`oa-sort-btn${sortKey === k ? " active" : ""}`} onClick={() => toggleSort(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}{arrow(k)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="oa-table-wrap">
        <table className="oa-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Person</th>
              <th>Project</th>
              <th>Category</th>
              <th>Remarks</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(exp => {
              const proj   = projects.find(p => p.id === exp.projectId);
              return (
                <tr key={exp.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--oa-muted)", fontSize: 11 }}>
                    {fmtDate(exp.date)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar mId={exp.userId} />
                      <span style={{ fontSize: 12 }}>
                        {members.find(m => m.id === exp.userId)?.name ?? exp.userId}
                      </span>
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="oa-dot" style={{ background: proj?.color }} />
                    <span style={{ fontSize: 12 }}>{proj?.name ?? exp.projectId}</span>
                  </td>
                  <td>
                    <span className="oa-cat-badge" style={{
                      background: `${EXPENSE_CATEGORY_COLORS[exp.category]}15`,
                      border: `1px solid ${EXPENSE_CATEGORY_COLORS[exp.category]}38`,
                      color: EXPENSE_CATEGORY_COLORS[exp.category],
                    }}>
                      {EXPENSE_CATEGORY_LABELS[exp.category]}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--oa-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {exp.remarks ?? "—"}
                  </td>
                  <td>
                    <span className={exp.reimbursed ? "oa-badge-yes" : "oa-badge-no"}>
                      {exp.reimbursed ? "Reimbursed" : "Pending"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--oa-red)", whiteSpace: "nowrap" }}>
                    {fmt(exp.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div style={{ padding: "28px 20px", textAlign: "center", fontSize: 13, color: "var(--oa-muted)" }}>
          No expense records match the current filters.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="oa-pagination">
          <span style={{ fontSize: 12, color: "var(--oa-muted)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="oa-nav-btn" onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0} style={{ opacity: page === 0 ? 0.35 : 1 }}>‹</button>
            <button className="oa-nav-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1} style={{ opacity: page === totalPages - 1 ? 0.35 : 1 }}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RightPanel — composes all 4 sections
// ─────────────────────────────────────────────────────────────────────────────
interface RightPanelProps {
  dateFilter: DateFilter;
}

export default function RightPanel({ dateFilter }: RightPanelProps) {
  // Person selected in Spend section flows down to Expense list
  const [spendMemberId, setSpendMemberId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── 1. Revenue — org only ── */}
      <RevenueSection dateFilter={dateFilter} />

      {/* ── 2. Spend by person ── */}
      <SpendSection dateFilter={dateFilter} onMemberChange={setSpendMemberId} />

      {/* ── 3. Comparison — org only ── */}
      <ComparisonSection dateFilter={dateFilter} />

      {/* ── 4. Expense list ── */}
      <ExpenseList dateFilter={dateFilter} inheritedMemberId={spendMemberId} />

    </div>
  );
}
