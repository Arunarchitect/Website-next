"use client";
// app/projectfee/page.tsx
//
// Pick your organisation → pick a project → see what's been collected on
// that project's fee and what's due right now.
//
// Org + project pickers reuse project_api.ts as-is (fetchMyOrganisations,
// fetchProjects). All money figures come from the feecalc app's
// ProjectFeeCalculation / FeeInstalment data via projectfeeApi.ts — nothing
// here reads Project.billing_type, Revenue, or projectmoney's FeeSetup.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { C } from "../feecalc/feeCalcTypes";
import {
  fetchMyOrganisations,
  fetchProjects,
  fetchProjectFeeCalculations,
  summariseFeeCalc,
  nextPayableInstalment,
  fmtCurrency,
  FEECALC_STATUS_LABEL,
  FEECALC_STATUS_COLOR,
  INSTALMENT_STATUS_LABEL,
  INSTALMENT_STATUS_COLOR,
  fetchFeeTemplate,
  type OrganisationOption,
  type ProjectListItem,
  type ProjectFeeCalculation,
  type FeeInstalment,
  type FeeTemplateOption,
} from "./projectfeeApi";
import { generateBillPdf } from "./billPdf";

// ─── Small primitives ──────────────────────────────────────────────────────

function Spinner({ color = C.t3 }: { color?: string }) {
  return (
    <svg width={13} height={13} viewBox="0 0 20 20" fill="none" style={{ animation: "pf-spin 0.75s linear infinite" }}>
      <path d="M17 10a7 7 0 1 1-7-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${accent ? accent + "40" : C.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.t4,
        letterSpacing: "0.09em",
        textTransform: "uppercase" as const,
        marginBottom: 7,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: { bg: string; text: string; border: string } }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "3px 9px",
        borderRadius: 5,
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </span>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: C.surface,
  color: C.t1,
  fontSize: 14,
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  outline: "none",
  fontFamily: "inherit",
};

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "13px 15px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 10, color: C.t4, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
        {label}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: C.t4 }}>{sub}</div>}
    </div>
  );
}

// ─── Instalment row ─────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function InstalmentRow({
  inst,
  currency,
  isLast,
  project,
  organisationName,
  calc,
}: {
  inst: FeeInstalment;
  currency: string;
  isLast: boolean;
  project: { name: string; client_name: string; location?: string | null };
  organisationName?: string;
  calc: { currency: string; final_fee: string; billing_type_display: string };
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const color = INSTALMENT_STATUS_COLOR[inst.status];
  const hasPayments = inst.payments.length > 0;

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setDownloading(true);
    try {
      await generateBillPdf({ organisationName, project, calc, instalment: inst });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ borderBottom: isLast ? "none" : `1px solid ${C.border}` }}>
      <div
        onClick={() => hasPayments && setOpen((o) => !o)}
        style={{
          padding: "13px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: hasPayments ? "pointer" : "default",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            flexShrink: 0,
            background: `${C.amber}15`,
            border: `1.5px solid ${C.amberBd}`,
            color: C.amber,
            fontSize: 10.5,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {inst.stage_order_snapshot}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" as const }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{inst.stage_name_snapshot}</span>
                <Badge label={INSTALMENT_STATUS_LABEL[inst.status]} color={color} />
              </div>
              <div style={{ fontSize: 11, color: C.t4, marginTop: 3 }}>
                {inst.fee_percentage}% of total fee
                {inst.due_date && ` · Due ${inst.due_date}`}
                {hasPayments && ` · ${open ? "▲" : "▼"} ${inst.payments.length} payment${inst.payments.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: "monospace" }}>
                {fmtCurrency(inst.amount, currency)}
              </div>
              {Number(inst.outstanding_amount) > 0 ? (
                <div style={{ fontSize: 10.5, color: color.text, marginTop: 2 }}>
                  {fmtCurrency(inst.outstanding_amount, currency)} outstanding
                </div>
              ) : (
                <div style={{ fontSize: 10.5, color: C.green, marginTop: 2 }}>Settled</div>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  marginTop: 7,
                  background: "transparent",
                  border: `1px solid ${C.borderMd}`,
                  borderRadius: 6,
                  padding: "4px 9px",
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: C.t3,
                  cursor: downloading ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {downloading ? <Spinner /> : <DownloadIcon />}
                {downloading ? "Generating…" : "Bill"}
              </button>
            </div>
          </div>

          {open && hasPayments && (
            <div
              style={{
                marginTop: 9,
                paddingTop: 9,
                borderTop: `1px dashed ${C.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {inst.payments.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span style={{ color: C.t3 }}>
                    {new Date(p.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    {p.remarks ? ` — ${p.remarks}` : ""}
                  </span>
                  <span style={{ color: C.green, fontFamily: "monospace", fontWeight: 600 }}>
                    {fmtCurrency(p.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectFeePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<number | null>(
    searchParams.get("org") ? Number(searchParams.get("org")) : null,
  );

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(
    searchParams.get("project") ? Number(searchParams.get("project")) : null,
  );

  const [calc, setCalc] = useState<ProjectFeeCalculation | null>(null);
  const [calcMissing, setCalcMissing] = useState(false);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [template, setTemplate] = useState<FeeTemplateOption | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // ── auth ──
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access") : null;
    setHasToken(!!token);
    setAuthChecked(true);
  }, []);

  // ── organisations ──
  useEffect(() => {
    if (!hasToken) return;
    setLoadingOrgs(true);
    fetchMyOrganisations()
      .then((list) => {
        setOrgs(list);
        if (!orgId && list.length === 1) setOrgId(list[0].id);
      })
      .catch((e: unknown) => setOrgError(e instanceof Error ? e.message : "Failed to load organisations"))
      .finally(() => setLoadingOrgs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // ── projects for selected org ──
  useEffect(() => {
    if (!orgId) {
      setProjects([]);
      return;
    }
    setLoadingProjects(true);
    setProjectError(null);
    fetchProjects({ org_id: orgId })
      .then(setProjects)
      .catch((e: unknown) => setProjectError(e instanceof Error ? e.message : "Failed to load projects"))
      .finally(() => setLoadingProjects(false));
  }, [orgId]);

  // ── fee calculation for selected project ──
  useEffect(() => {
    if (!projectId) {
      setCalc(null);
      setCalcMissing(false);
      return;
    }
    setLoadingCalc(true);
    setCalcError(null);
    setCalcMissing(false);
    fetchProjectFeeCalculations(projectId)
      .then((list) => {
        if (list.length === 0) {
          setCalc(null);
          setCalcMissing(true);
        } else {
          setCalc(list[0]);
        }
      })
      .catch((e: unknown) => setCalcError(e instanceof Error ? e.message : "Failed to load fee calculation"))
      .finally(() => setLoadingCalc(false));
  }, [projectId]);

  // ── the fee template behind this calc — shows planned stages before confirm ──
  useEffect(() => {
    if (!calc) {
      setTemplate(null);
      return;
    }
    setLoadingTemplate(true);
    fetchFeeTemplate(calc.fee_template)
      .then(setTemplate)
      .catch(() => setTemplate(null))
      .finally(() => setLoadingTemplate(false));
  }, [calc]);

  function syncUrl(newOrg: number | null, newProject: number | null) {
    const params = new URLSearchParams();
    if (newOrg) params.set("org", String(newOrg));
    if (newProject) params.set("project", String(newProject));
    router.replace(`/projectfee${params.toString() ? `?${params}` : ""}`, { scroll: false });
  }

  function handleOrgChange(id: number | null) {
    setOrgId(id);
    setProjectId(null);
    setCalc(null);
    setCalcMissing(false);
    syncUrl(id, null);
  }

  function handleProjectChange(id: number | null) {
    setProjectId(id);
    syncUrl(orgId, id);
  }

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const summary = useMemo(() => (calc ? summariseFeeCalc(calc) : null), [calc]);
  const nextInstalment = useMemo(() => (calc ? nextPayableInstalment(calc) : null), [calc]);
  const sortedInstalments = useMemo(
    () => (calc ? [...calc.instalments].sort((a, b) => a.stage_order_snapshot - b.stage_order_snapshot) : []),
    [calc],
  );

  if (!authChecked) return null;

  if (!hasToken) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Sign in required</h2>
        <p style={{ fontSize: 13, color: C.t3, marginBottom: 18 }}>
          Sign in to see fee collection status for your projects.
        </p>
        <Link
          href="/login"
          style={{ background: C.amber, color: "#fff", padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        color: C.t2,
        fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
        padding: "22px 20px 60px",
        background: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <style>{`@keyframes pf-spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: "-0.02em", margin: 0 }}>
            Project Fee Status
          </h1>
          <p style={{ fontSize: 12.5, color: C.t4, margin: "4px 0 0" }}>
            What&apos;s been collected on a project&apos;s fee, and what&apos;s due right now.
          </p>
        </div>

        {/* Org / project pickers */}
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <SectionLabel>Organisation</SectionLabel>
              {loadingOrgs ? (
                <div style={{ fontSize: 13, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>
                  <Spinner /> Loading…
                </div>
              ) : orgError ? (
                <div style={{ fontSize: 12.5, color: C.red }}>{orgError}</div>
              ) : orgs.length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.t4 }}>You&apos;re not a member of any organisation.</div>
              ) : (
                <select
                  id="org-select"
                  name="organisation"
                  value={orgId ?? ""}
                  onChange={(e) => handleOrgChange(e.target.value ? Number(e.target.value) : null)}
                  style={selectStyle}
                >
                  <option value="">Select organisation…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <SectionLabel>Project</SectionLabel>
              {!orgId ? (
                <div style={{ fontSize: 12.5, color: C.t4 }}>Select an organisation first.</div>
              ) : loadingProjects ? (
                <div style={{ fontSize: 13, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>
                  <Spinner /> Loading…
                </div>
              ) : projectError ? (
                <div style={{ fontSize: 12.5, color: C.red }}>{projectError}</div>
              ) : projects.length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.t4 }}>No projects in this organisation.</div>
              ) : (
                <select
                  id="project-select"
                  name="project"
                  value={projectId ?? ""}
                  onChange={(e) => handleProjectChange(e.target.value ? Number(e.target.value) : null)}
                  style={selectStyle}
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.client_name ? ` — ${p.client_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Card>

        {/* Project context strip */}
        {selectedProject && (
          <div style={{ fontSize: 12, color: C.t4, padding: "0 2px" }}>
            {selectedProject.location && `${selectedProject.location} · `}
            {selectedProject.client_name && `Client: ${selectedProject.client_name}`}
          </div>
        )}

        {/* Fee calc content */}
        {projectId && loadingCalc && (
          <Card>
            <div style={{ fontSize: 13, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>
              <Spinner /> Loading fee calculation…
            </div>
          </Card>
        )}

        {projectId && calcError && (
          <Card accent={C.red}>
            <span style={{ fontSize: 13, color: C.t2 }}>{calcError}</span>
          </Card>
        )}

        {projectId && !loadingCalc && calcMissing && (
          <Card>
            <div style={{ textAlign: "center", padding: "18px 6px" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t2, marginBottom: 4 }}>
                No fee calculation for this project yet
              </div>
              <div style={{ fontSize: 12.5, color: C.t4 }}>
                Once a fee is confirmed for this project in Fee Calc, it will show up here.
              </div>
            </div>
          </Card>
        )}

        {calc && summary && (
          <>
            {/* Status + total */}
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap" as const,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>
                    {fmtCurrency(calc.final_fee, calc.currency)} total fee
                  </span>
                  <Badge label={FEECALC_STATUS_LABEL[calc.status]} color={FEECALC_STATUS_COLOR[calc.status]} />
                  <span style={{ fontSize: 11, color: C.t4 }}>{calc.billing_type_display} billing</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.t4, marginTop: 4 }}>
                  {summary.completionPct.toFixed(1)}% collected
                  {nextInstalment && ` · Next: ${nextInstalment.stage_name_snapshot}`}
                </div>
              </div>
              <div style={{ width: 120, height: 6, background: C.border, borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(summary.completionPct, 100)}%`,
                    background: C.green,
                    borderRadius: 99,
                  }}
                />
              </div>
            </div>

            {/* Headline stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <StatCard
                label="Collected so far"
                value={fmtCurrency(summary.totalCollected, summary.currency)}
                color={C.green}
              />
              <StatCard
                label="Due now"
                value={fmtCurrency(summary.dueNow, summary.currency)}
                color={summary.dueNow > 0 ? C.amber : C.t3}
                sub={summary.overdue > 0 ? `Incl. ${fmtCurrency(summary.overdue, summary.currency)} overdue` : "Invoiced, awaiting payment"}
              />
              <StatCard
                label="Not yet invoiced"
                value={fmtCurrency(summary.notYetInvoiced, summary.currency)}
                color={C.t3}
              />
              <StatCard
                label="Total outstanding"
                value={fmtCurrency(summary.totalOutstanding, summary.currency)}
                color={C.t2}
              />
            </div>

            {summary.overdue > 0 && (
              <div
                style={{
                  background: C.redBg,
                  border: `1px solid ${C.redBd}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: C.red,
                  fontWeight: 600,
                }}
              >
                {fmtCurrency(summary.overdue, summary.currency)} is overdue — follow up on invoiced stages past their due date.
              </div>
            )}

            {/* Planned stages (from the fee template) — shown until the calc is confirmed and instalments exist */}
            {sortedInstalments.length === 0 && (
              <Card accent={template && Number(template.total_stage_percentage) !== 100 ? C.red : undefined}>
                <SectionLabel>Planned stages (not confirmed yet)</SectionLabel>
                {loadingTemplate ? (
                  <div style={{ fontSize: 12.5, color: C.t3, display: "flex", alignItems: "center", gap: 8 }}>
                    <Spinner /> Loading template…
                  </div>
                ) : !template ? (
                  <div style={{ fontSize: 12.5, color: C.t4 }}>Couldn&apos;t load the fee template for this calc.</div>
                ) : template.template_stages.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: C.t4 }}>
                    &quot;{template.name}&quot; has no stages defined yet — add stages to it before confirming.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12.5, color: C.t3, marginBottom: 10 }}>
                      &quot;{template.name}&quot; has <strong>{template.template_stages.length}</strong> stage
                      {template.template_stages.length !== 1 ? "s" : ""}, totalling{" "}
                      <strong style={{ color: Number(template.total_stage_percentage) === 100 ? C.green : C.red }}>
                        {template.total_stage_percentage}%
                      </strong>
                      {Number(template.total_stage_percentage) !== 100 && " — must equal 100% before this can be confirmed."}
                    </div>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
                      {template.template_stages
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((ts, i, arr) => (
                          <div
                            key={ts.id}
                            style={{
                              padding: "10px 14px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  flexShrink: 0,
                                  background: `${C.amber}15`,
                                  border: `1.5px solid ${C.amberBd}`,
                                  color: C.amber,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {ts.order}
                              </div>
                              <span style={{ fontSize: 13, color: C.t2 }}>{ts.fee_stage.name}</span>
                            </div>
                            <span style={{ fontSize: 12.5, color: C.t3, fontFamily: "monospace" }}>
                              {ts.fee_percentage}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Instalment schedule */}
            <Card>
              <SectionLabel>Payment schedule</SectionLabel>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
                {sortedInstalments.length === 0 ? (
                  <div style={{ padding: "14px 16px", fontSize: 12.5, color: C.t4 }}>
                    No instalments have been generated for this fee calculation yet — confirm the calc to generate them.
                  </div>
                ) : (
                  sortedInstalments.map((inst, i) => (
                    <InstalmentRow
                      key={inst.id}
                      inst={inst}
                      currency={calc.currency}
                      isLast={i === sortedInstalments.length - 1}
                      project={{
                        name: selectedProject?.name ?? "",
                        client_name: selectedProject?.client_name ?? "",
                        location: selectedProject?.location,
                      }}
                      organisationName={orgs.find((o) => o.id === orgId)?.name}
                      calc={{
                        currency: calc.currency,
                        final_fee: calc.final_fee,
                        billing_type_display: calc.billing_type_display,
                      }}
                    />
                  ))
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}