"use client";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  fetchOrganisations,
  fetchProjects,
  fetchRevenues,
  addRevenue,
  type Organisation,
  type Project,
  type RevenueEntry,
} from "@/app/new/revenueAdd";

// ─── Constants ────────────────────────────────────────────────────────────────
const REVENUE_SOURCES = [
  { value: "fees", label: "Fees" },
  { value: "advance_fees", label: "Advance Fees" },
  { value: "commissions", label: "Commissions" },
  { value: "other", label: "Other" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const AVAILABLE_YEARS = [2022, 2023, 2024, 2025, 2026];

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDay(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}
function fmtINR(n: number) {
  // Handle NaN, null, undefined cases
  if (isNaN(n) || n === null || n === undefined || !isFinite(n)) {
    return "₹0";
  }
  return "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
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
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function CalGrid({
  year, month, selDates, activeDates, onToggle,
}: {
  year: number; month: number;
  selDates: Set<string>; activeDates: Set<string>;
  onToggle: (d: string) => void;
}) {
  const total = getDaysInMonth(year, month);
  const first = getFirstDay(year, month);
  const cells: (number | null)[] = [
    ...Array(first).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
      {DAYS.map((d) => (
        <div key={d} style={{ textAlign: "center", fontSize: 9, color: T.t5,
          fontWeight: 700, letterSpacing: "0.08em", paddingBottom: 5, textTransform: "uppercase" }}>
          {d}
        </div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`_${i}`} />;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const sel = selDates.has(iso);
        const has = activeDates.has(iso);
        return (
          <button key={iso} onClick={() => onToggle(iso)} style={{
            background: sel ? T.ac : "transparent",
            border: `1.5px solid ${sel ? T.ac : "transparent"}`,
            borderRadius: 6, cursor: "pointer",
            color: sel ? "#fff" : has ? T.t2 : T.t5,
            fontSize: 11, padding: "5px 0", width: "100%",
            fontFamily: "'DM Sans',sans-serif", fontWeight: sel ? 700 : 400,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            {day}
            {has && (
              <span style={{ width: 3, height: 3, borderRadius: "50%",
                background: sel ? "#fff" : T.acText, opacity: 0.8 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const safePct = isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 99, background: color,
        width: `${safePct}%`, transition: "width 0.5s" }} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: T.divider }} />;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: T.t4,
      letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AddRevenuePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Data
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [revenues, setRevenues] = useState<RevenueEntry[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingRevenues, setLoadingRevenues] = useState(false);

  // Calendar / filter state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selDates, setSelDates] = useState<Set<string>>(new Set());
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [selMonth, setSelMonth] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number>(new Date().getFullYear());

  // Form state — all in one object, kept in sync with onChange handlers
  const [formData, setFormData] = useState({
    amount: "" as string | number,
    source: "fees",
    date: format(new Date(), "yyyy-MM-dd"),
    organisation_id: null as number | null,
    project_id: null as number | null,
    remarks: "",
  });

  // ─── Derived date range ──────────────────────────────────────────────────
  const { dateFrom, dateTo } = useMemo(() => {
    if (selDates.size > 0) {
      const sorted = Array.from(selDates).sort();
      return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
    }
    if (selMonth !== null) {
      const m = String(selMonth + 1).padStart(2, "0");
      const lastDay = getDaysInMonth(selYear, selMonth);
      return { dateFrom: `${selYear}-${m}-01`, dateTo: `${selYear}-${m}-${lastDay}` };
    }
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = getDaysInMonth(now.getFullYear(), now.getMonth());
    return {
      dateFrom: `${now.getFullYear()}-${m}-01`,
      dateTo: `${now.getFullYear()}-${m}-${lastDay}`,
    };
  }, [selDates, selMonth, selYear]);

  // ─── Fetch organisations on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingOrgs(true);
      try {
        const data = await fetchOrganisations();
        if (cancelled) return;
        setOrganisations(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, organisation_id: data[0].id }));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching organisations:", err);
          setError("Failed to load organisations. Please refresh the page.");
        }
      } finally {
        if (!cancelled) setLoadingOrgs(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Fetch projects when org changes ─────────────────────────────────────
  useEffect(() => {
    if (!formData.organisation_id) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingProjects(true);
      try {
        const data = await fetchProjects(formData.organisation_id!);
        if (!cancelled) setProjects(data);
      } catch (err) {
        if (!cancelled) console.error("Error fetching projects:", err);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [formData.organisation_id]);

  // ─── Fetch revenues when filters change ──────────────────────────────────
  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    let cancelled = false;
    const load = async () => {
      setLoadingRevenues(true);
      try {
        const data = await fetchRevenues({
          from: dateFrom,
          to: dateTo,
          organisation_id: formData.organisation_id ?? undefined,
          project_id: formData.project_id ?? undefined,
        });
        if (cancelled) return;
        setRevenues(data);
        setActiveDates(new Set(data.map((r) => r.date)));
      } catch (err) {
        if (!cancelled) console.error("Error fetching revenues:", err);
      } finally {
        if (!cancelled) setLoadingRevenues(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, formData.organisation_id, formData.project_id]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = revenues.reduce((sum, r) => sum + (r.amount || 0), 0);
    const bySource: Record<string, number> = {};
    revenues.forEach((r) => {
      const sourceName = r.source_display || r.source || "Other";
      bySource[sourceName] = (bySource[sourceName] || 0) + (r.amount || 0);
    });
    const sourceList = Object.entries(bySource)
      .map(([source, total]) => ({ source, total: total || 0 }))
      .sort((a, b) => b.total - a.total);
    return { 
      total_revenue: total || 0, 
      revenue_by_source: sourceList, 
      total_count: revenues.length || 0 
    };
  }, [revenues]);

  // ─── Form handlers ────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount"
        ? value === "" ? "" : parseFloat(value)
        : name === "project_id"
        ? value === "" ? null : Number(value)
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const amountNum = Number(formData.amount);
    if (!formData.amount || isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount greater than zero.");
      setLoading(false);
      return;
    }
    if (!formData.source) {
      setError("Please select a revenue source.");
      setLoading(false);
      return;
    }
    if (!formData.date) {
      setError("Please select a date.");
      setLoading(false);
      return;
    }
    if (!formData.organisation_id) {
      setError("Please select an organisation.");
      setLoading(false);
      return;
    }

    try {
      await addRevenue({
        amount: amountNum,
        source: formData.source,
        date: formData.date,
        organisation: formData.organisation_id,
        project: formData.project_id,
        remarks: formData.remarks,
      });

      setSuccess(true);
      setFormData((prev) => ({ ...prev, amount: "", source: "fees", remarks: "" }));

      // Refresh revenue list
      const refreshed = await fetchRevenues({
        from: dateFrom,
        to: dateTo,
        organisation_id: formData.organisation_id ?? undefined,
        project_id: formData.project_id ?? undefined,
      });
      setRevenues(refreshed);
      setActiveDates(new Set(refreshed.map((r) => r.date)));

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error adding revenue:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Calendar helpers ─────────────────────────────────────────────────────
  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }
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
  function clearDateFilters() { setSelDates(new Set()); setSelMonth(null); }

  const hasDateFilter = selDates.size > 0 || selMonth !== null;

  // ─── Shared input style ───────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px",
    background: T.panel2, border: `1px solid ${T.panel2B}`,
    borderRadius: 8, fontSize: 14, color: T.t2,
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.t2,
      fontFamily: "'DM Sans','Sora',sans-serif", padding: "28px 24px 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Sora:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${T.ac}!important;box-shadow:0 0 0 2px ${T.acGlow};}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(76,124,243,0.25);border-radius:99px;}
        select option{background:#0d0f1c;color:#d8e0f0;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.6);}
      `}</style>

      <div style={{
        display: "grid", gridTemplateColumns: "300px 1fr", gap: 20,
        alignItems: "start", maxWidth: 1400, margin: "0 auto",
      }}>

        {/* ── LEFT: Calendar + Filters ──────────────────────────────────── */}
        <div style={{
          background: T.panel, border: `1px solid ${T.panelB}`,
          borderRadius: 14, overflow: "hidden", position: "sticky",
          top: 20, maxHeight: "calc(100vh - 40px)", overflowY: "auto",
        }}>

          {/* Calendar navigation */}
          <div style={{ padding: "16px 14px 14px" }}>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={prevMonth} style={{
                width: 30, height: 30, borderRadius: 6,
                background: T.panel2, border: `1px solid ${T.panel2B}`,
                color: T.t4, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>‹</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.t2 }}>
                  {MONTHS[calMonth]}
                </div>
                <div style={{ fontSize: 10, color: T.t5, marginTop: 1 }}>{calYear}</div>
              </div>
              <button onClick={nextMonth} style={{
                width: 30, height: 30, borderRadius: 6,
                background: T.panel2, border: `1px solid ${T.panel2B}`,
                color: T.t4, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>›</button>
            </div>

            <CalGrid year={calYear} month={calMonth}
              selDates={selDates} activeDates={activeDates} onToggle={toggleDate} />

            {selDates.size > 0 && (
              <div style={{
                marginTop: 8, display: "flex", alignItems: "center",
                justifyContent: "space-between", background: T.acLight,
                borderRadius: 6, padding: "5px 9px",
              }}>
                <span style={{ fontSize: 10.5, color: T.acText, fontWeight: 600 }}>
                  {selDates.size} date{selDates.size > 1 ? "s" : ""} selected
                </span>
                <button onClick={() => setSelDates(new Set())} style={{
                  background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 14,
                }}>✕</button>
              </div>
            )}
          </div>

          <Divider />

          {/* Quick Month */}
          <div style={{ padding: "12px 14px" }}>
            <Label>Quick Month</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3 }}>
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => setSelMonth(selMonth === i ? null : i)} style={{
                  background: selMonth === i ? T.acLight : "transparent",
                  border: `1px solid ${selMonth === i ? T.acMid : T.divider}`,
                  borderRadius: 5, color: selMonth === i ? T.acText : T.t5,
                  fontSize: 10, padding: "6px 0", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  fontWeight: selMonth === i ? 700 : 400,
                }}>
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div style={{ padding: "0 14px 12px" }}>
            <Label>Year</Label>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {AVAILABLE_YEARS.map((y) => (
                <button key={y} onClick={() => setSelYear(y)} style={{
                  flex: "1 1 0",
                  background: selYear === y ? T.acLight : "transparent",
                  border: `1px solid ${selYear === y ? T.acMid : T.divider}`,
                  borderRadius: 5, color: selYear === y ? T.acText : T.t5,
                  fontSize: 10, padding: "6px 0", cursor: "pointer",
                  fontWeight: selYear === y ? 700 : 400,
                }}>{y}</button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Organisation filter */}
          <div style={{ padding: "12px 14px" }}>
            <Label>Organisation</Label>
            {loadingOrgs ? (
              <div style={{ padding: "8px 12px", background: T.panel2,
                borderRadius: 6, fontSize: 12, color: T.t5 }}>Loading…</div>
            ) : (
              <select
                value={formData.organisation_id ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    organisation_id: e.target.value ? Number(e.target.value) : null,
                    project_id: null,   // reset project when org changes
                  }))
                }
                style={{ ...inputStyle, padding: "8px 10px", fontSize: 12 }}
              >
                <option value="">All organisations</option>
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Project filter */}
          <div style={{ padding: "0 14px 12px" }}>
            <Label>Project</Label>
            {loadingProjects ? (
              <div style={{ padding: "8px 12px", background: T.panel2,
                borderRadius: 6, fontSize: 12, color: T.t5 }}>Loading…</div>
            ) : (
              <select
                value={formData.project_id ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    project_id: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                disabled={!formData.organisation_id}
                style={{
                  ...inputStyle, padding: "8px 10px", fontSize: 12,
                  background: !formData.organisation_id ? "rgba(255,255,255,0.02)" : T.panel2,
                  color: !formData.organisation_id ? T.t5 : T.t2,
                  cursor: !formData.organisation_id ? "not-allowed" : "pointer",
                }}
              >
                <option value="">All projects</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
            )}
          </div>

          <Divider />

          {/* Revenue summary */}
          {!loadingRevenues && (
            <div style={{ padding: "12px 14px" }}>
              <Label>Revenue Summary</Label>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: T.greenBg,
              }}>
                <span style={{ fontSize: 11, color: T.t4 }}>Total Revenue</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.green }}>
                  {fmtINR(stats.total_revenue)}
                </span>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: T.t4 }}>Entries: {stats.total_count}</span>
              </div>
              {stats.revenue_by_source.map((item) => (
                <div key={item.source} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, color: T.t4 }}>{item.source}</span>
                    <span style={{ fontSize: 10.5, color: T.green, fontWeight: 600 }}>
                      {fmtINR(item.total)}
                    </span>
                  </div>
                  <ProgressBar
                    pct={stats.total_revenue > 0 ? (item.total / stats.total_revenue) * 100 : 0}
                    color={T.green}
                  />
                </div>
              ))}
              {stats.revenue_by_source.length === 0 && (
                <div style={{ fontSize: 11, color: T.t5, textAlign: "center", padding: "8px 0" }}>
                  No revenue data for selected period
                </div>
              )}
            </div>
          )}

          {hasDateFilter && (
            <div style={{ padding: "10px 14px 20px" }}>
              <button onClick={clearDateFilters} style={{
                width: "100%", background: "transparent",
                border: `1px solid ${T.divider}`, borderRadius: 7,
                padding: "8px 0", fontSize: 11, color: T.t5, cursor: "pointer",
              }}>✕ Clear date filters</button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Form ───────────────────────────────────────────────── */}
        <div>
          {/* Header */}
          <div style={{
            background: T.panel, border: `1px solid ${T.panelB}`,
            borderRadius: 14, padding: "20px 24px", marginBottom: 20,
          }}>
            <h1 style={{
              fontSize: 20, fontWeight: 700, fontFamily: "'Sora',sans-serif",
              letterSpacing: "-0.035em", color: T.t1, marginBottom: 8,
            }}>Add Revenue</h1>
            <p style={{ color: T.t5, fontSize: 12 }}>
              Record new revenue received by your organisation
            </p>
          </div>

          {/* Active date range display */}
          <div style={{
            background: T.panel, border: `1px solid ${T.panelB}`,
            borderRadius: 14, padding: "12px 16px", marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, color: T.t4, marginBottom: 4 }}>
              {selDates.size > 0 ? "Selected Dates"
                : selMonth !== null ? "Selected Month"
                : "Current Month"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.t2 }}>
              {dateFrom} → {dateTo}
            </div>
          </div>

          {/* Success banner */}
          {success && (
            <div style={{
              marginBottom: 20, padding: "12px 16px",
              background: T.greenBg, border: `1px solid ${T.green}30`,
              borderRadius: 8, color: T.green, fontSize: 13,
            }}>✓ Revenue added successfully!</div>
          )}

          {/* Error banner */}
          {error && (
            <div style={{
              marginBottom: 20, padding: "12px 16px",
              background: T.redBg, border: `1px solid ${T.red}30`,
              borderRadius: 8, color: T.red, fontSize: 13,
            }}>⚠ {error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{
            background: T.panel, border: `1px solid ${T.panelB}`,
            borderRadius: 14, padding: 24,
          }}>

            {/* Amount */}
            <div style={{ marginBottom: 20 }}>
              <Label>Amount *</Label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)", color: T.t4, fontSize: 14,
                }}>₹</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  required
                  style={{ ...inputStyle, paddingLeft: 28 }}
                />
              </div>
            </div>

            {/* Source */}
            <div style={{ marginBottom: 20 }}>
              <Label>Revenue Source *</Label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                required
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {REVENUE_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div style={{ marginBottom: 20 }}>
              <Label>Date *</Label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>

            {/* Organisation (display only — controlled via sidebar) */}
            <div style={{ marginBottom: 20 }}>
              <Label>Organisation *</Label>
              <div style={{
                ...inputStyle,
                color: formData.organisation_id ? T.t2 : T.t5,
                background: "rgba(255,255,255,0.02)",
              }}>
                {organisations.find((o) => o.id === formData.organisation_id)?.name
                  || (loadingOrgs ? "Loading…" : "Select an organisation in the sidebar")}
              </div>
            </div>

            {/* Project (optional) — name="project_id" wired through handleChange */}
            <div style={{ marginBottom: 20 }}>
              <Label>Project (Optional)</Label>
              <select
                name="project_id"
                value={formData.project_id ?? ""}
                onChange={handleChange}
                disabled={!formData.organisation_id || loadingProjects}
                style={{
                  ...inputStyle, cursor: "pointer",
                  opacity: !formData.organisation_id ? 0.5 : 1,
                }}
              >
                <option value="">No project</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
            </div>

            {/* Remarks */}
            <div style={{ marginBottom: 24 }}>
              <Label>Remarks (Optional)</Label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                placeholder="Add any additional notes…"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !formData.organisation_id}
              style={{
                width: "100%", padding: "13px",
                background: loading || !formData.organisation_id ? T.t5 : T.ac,
                border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: "#fff",
                cursor: loading || !formData.organisation_id ? "not-allowed" : "pointer",
                opacity: loading || !formData.organisation_id ? 0.55 : 1,
                transition: "opacity 0.2s, background 0.2s",
              }}
            >
              {loading ? "Adding…" : "Add Revenue"}
            </button>
          </form>

          {/* Revenue list for the selected period */}
          {revenues.length > 0 && (
            <div style={{
              marginTop: 20, background: T.panel,
              border: `1px solid ${T.panelB}`, borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.divider}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.t4,
                  textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Entries in period
                </span>
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {revenues.map((r) => (
                  <div key={r.id} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "10px 20px",
                    borderBottom: `1px solid ${T.divider}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: T.t2, fontWeight: 500 }}>
                        {r.source_display}
                        {r.project_name && (
                          <span style={{ marginLeft: 6, fontSize: 11,
                            color: T.acText, fontWeight: 400 }}>
                            · {r.project_name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.t5, marginTop: 2 }}>
                        {r.date} · {r.organisation_name}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.green }}>
                      {fmtINR(r.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingRevenues && (
            <div style={{
              marginTop: 20, padding: "20px", textAlign: "center",
              background: T.panel, border: `1px solid ${T.panelB}`,
              borderRadius: 14, fontSize: 13, color: T.t5,
            }}>
              Loading revenue data…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}