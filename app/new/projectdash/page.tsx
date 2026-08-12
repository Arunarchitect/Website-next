"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchProjects,
  fetchProjectDetail,
  fetchProjectOrganisations,
  hoursFromListItem,
  STAGE_LABEL,
  STAGE_COLOR,
  DELIVERABLE_STATUS_LABEL,
  DELIVERABLE_STATUS_COLOR,
  PAYMENT_STATUS_COLOR,
} from "@/app/new/project_api";
import { formatMoney, formatDate, formatHours } from "@/app/new/projectdash/utils";
import type {
  ProjectListItem,
  ProjectDetail,
  ProjectListParams,
  OrganisationOption,
  ProjectFinancials,
  FeeStage,
  FeeCalcSummary,
  DetailTab,
} from "@/app/new/projectdash/types";
import styles from "@/app/new/projectdash/project.module.css";

// ─── Badge ─────────────────────────────────────────────────────────────────

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className={styles.badge} style={{ background: bg, color: text }}>
      {label}
    </span>
  );
}

// ─── Stat chip ───────────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className={styles.statChip}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ pct, label, sublabel, color }: {
  pct: number; label: string; sublabel?: string; color?: string;
}) {
  const fill = color ?? (pct >= 100
    ? "linear-gradient(90deg,#43a047,#66bb6a)"
    : "linear-gradient(90deg,#1565c0,#42a5f5)");
  return (
    <div>
      <div className={styles.progressHeadRow}>
        <span className={styles.progressLabel}>{label}</span>
        <span className={styles.progressValue}>{sublabel ?? `${pct}%`}</span>
      </div>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: fill }}
        />
      </div>
    </div>
  );
}

function progressColor(pct: number): string {
  if (pct >= 100) return "linear-gradient(90deg,#43a047,#66bb6a)";
  if (pct >= 50) return "linear-gradient(90deg,#f57f17,#ffca28)";
  return "linear-gradient(90deg,#e53935,#ef9a9a)";
}

// ─── Deliverable row ───────────────────────────────────────────────────────

function DeliverableRow({ d }: { d: ProjectDetail["deliverables"][0] }) {
  const s = DELIVERABLE_STATUS_COLOR[d.status];
  return (
    <div className={styles.deliverableRow}>
      <div>
        <p className={styles.deliverableName}>{d.name}</p>
        <p className={styles.deliverableDue}>Due {formatDate(d.end_date)}</p>
      </div>
      <span className={styles.deliverableAssignee}>{d.assigned_to_display}</span>
      <Badge label={DELIVERABLE_STATUS_LABEL[d.status]} bg={s.bg} text={s.text} />
      <span className={styles.deliverableHours}>
        {d.hours_logged > 0 ? formatHours(d.hours_logged) : "—"}
      </span>
    </div>
  );
}

// ─── Fee stage row ─────────────────────────────────────────────────────────

function FeeStageRow({ stage, currency }: { stage: FeeStage; currency: string }) {
  const col = PAYMENT_STATUS_COLOR[stage.payment_status];
  return (
    <div className={styles.feeStageRow}>
      <span className={styles.stageBubble}>{stage.order}</span>

      <div>
        <p className={styles.stageName}>{stage.stage_name}</p>
        <p className={styles.stageMeta}>
          {stage.stage_percentage}% of net fee
          {stage.invoice_number ? ` · Inv ${stage.invoice_number}` : ""}
          {stage.due_date ? ` · Due ${formatDate(stage.due_date)}` : ""}
        </p>
      </div>

      <span className={styles.feeStageBadge}>
        <Badge label={stage.payment_status_display} bg={col.bg} text={col.text} />
      </span>

      <div className={`${styles.stageAmountBlock} ${styles.feeStageAmountBlock ?? ""}`}>
        <p className={styles.stageAmount}>{formatMoney(stage.stage_fee, currency)}</p>
        {stage.collected_amount !== null && stage.payment_status === "collected" && (
          <p className={styles.stageCollectedDate}>✓ {formatDate(stage.collected_date)}</p>
        )}
      </div>
    </div>
  );
}

// ─── Fee calc panel (quote-derived fee, from feecalc app) ──────────────────

function FeeCalcPanel({ f }: { f: FeeCalcSummary }) {
  return (
    <div>
      <div className={styles.sectionHeadRow}>
        <p className={styles.sectionHeading} style={{ margin: 0 }}>Fee Collection (Quote)</p>
        <Badge
          label={f.status_display}
          bg={f.status === "completed" ? "#e8f5e9" : f.status === "cancelled" ? "#fce4ec" : "#f0f4ff"}
          text={f.status === "completed" ? "#2e7d32" : f.status === "cancelled" ? "#c62828" : "#1565c0"}
        />
      </div>

      <div className={styles.statGrid} style={{ marginBottom: 12 }}>
        <Stat label="Total Fee" value={formatMoney(f.final_fee, f.currency)} />
        <Stat label="Collected" value={formatMoney(f.total_paid, f.currency)} accent="#2e7d32" />
        <Stat
          label="Outstanding"
          value={formatMoney(f.total_outstanding, f.currency)}
          accent={f.total_outstanding > 0 ? "#e65100" : "#2e7d32"}
        />
      </div>

      <ProgressBar
        pct={f.completion_percentage}
        label="Collected"
        sublabel={`${formatMoney(f.total_paid, f.currency)} / ${formatMoney(f.final_fee, f.currency)} (${f.completion_percentage}%)`}
        color={progressColor(f.completion_percentage)}
      />
    </div>
  );
}

// ─── Financials panel ────────────────────────────────────────────────────

function FinancialsPanel({ f }: { f: ProjectFinancials }) {
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [billingExpanded, setBillingExpanded] = useState(false);

  return (
    <div className={styles.tabPanel}>
      {/* Hours */}
      <div>
        <p className={styles.sectionHeading}>Hours</p>
        <div className={styles.statGrid} style={{ marginBottom: 12 }}>
          <Stat label="Worklog" value={formatHours(f.hours.worklog_hours)} sub="from timesheets" />
          <Stat label="Manual" value={formatHours(f.hours.manual_hours)} sub="legacy entries" />
          <Stat label="Combined" value={formatHours(f.hours.combined_hours)} sub="total" accent="#1565c0" />
        </div>

        {f.hours.manual_entries.length > 0 && (
          <div>
            <button
              className={styles.accordionBtn}
              onClick={() => setHoursExpanded((v) => !v)}
              aria-expanded={hoursExpanded}
            >
              <svg
                className={`${styles.chevron} ${hoursExpanded ? styles.chevronOpen : ""}`}
                width="10" height="10" viewBox="0 0 10 10"
              >
                <path d="M3 2l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f.hours.manual_entries.length} manual {f.hours.manual_entries.length === 1 ? "entry" : "entries"}
            </button>

            {hoursExpanded && (
              <div className={styles.manualEntryList}>
                {f.hours.manual_entries.map((e) => (
                  <div key={e.id} className={styles.manualEntryRow}>
                    <div>
                      <span className={styles.manualEntryUser}>{e.user_display}</span>
                      {e.remarks && <span className={styles.manualEntryRemark}>{e.remarks}</span>}
                    </div>
                    <span className={styles.manualEntryDate}>
                      {formatDate(e.start_date)}
                      {e.end_date && e.end_date !== e.start_date ? ` – ${formatDate(e.end_date)}` : ""}
                    </span>
                    <span className={styles.manualEntryHours}>{formatHours(Number(e.hours))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Quote-derived fee (feecalc) */}
      {f.feecalc && (
        <>
          <FeeCalcPanel f={f.feecalc} />
          <div className={styles.divider} />
        </>
      )}

      {/* Fee setup (projectmoney) */}
      {f.fee_setup ? (
        <div>
          <div className={styles.sectionHeadRow}>
            <p className={styles.sectionHeading} style={{ margin: 0 }}>Fee Collection</p>
            <Badge
              label={f.fee_setup.status_display}
              bg={f.fee_setup.status === "completed" ? "#e8f5e9" : f.fee_setup.status === "cancelled" ? "#fce4ec" : "#f0f4ff"}
              text={f.fee_setup.status === "completed" ? "#2e7d32" : f.fee_setup.status === "cancelled" ? "#c62828" : "#1565c0"}
            />
          </div>

          <div className={styles.statGrid} style={{ marginBottom: 12 }}>
            <Stat label="Gross Fee" value={formatMoney(Number(f.fee_setup.gross_fee), f.fee_setup.currency)} />
            {Number(f.fee_setup.discount_amount) > 0 && (
              <Stat label="Discount" value={`– ${formatMoney(Number(f.fee_setup.discount_amount), f.fee_setup.currency)}`} accent="#c62828" />
            )}
            {Number(f.fee_setup.tax_amount) > 0 && (
              <Stat label="Tax" value={`+ ${formatMoney(Number(f.fee_setup.tax_amount), f.fee_setup.currency)}`} accent="#e65100" />
            )}
            <Stat label="Net Fee" value={formatMoney(Number(f.fee_setup.net_fee), f.fee_setup.currency)} accent="#1565c0" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <ProgressBar
              pct={f.fee_setup.collection_percentage}
              label="Collection"
              sublabel={`${formatMoney(f.fee_setup.total_collected, f.fee_setup.currency)} / ${formatMoney(Number(f.fee_setup.net_fee), f.fee_setup.currency)} (${f.fee_setup.collection_percentage}%)`}
              color={progressColor(f.fee_setup.collection_percentage)}
            />
          </div>

          {f.fee_setup.total_outstanding > 0 && (
            <div className={styles.outstandingCallout} style={{ marginBottom: 12 }}>
              <span className={styles.outstandingLabel}>Outstanding</span>
              <span className={styles.outstandingValue}>
                {formatMoney(Number(f.fee_setup.total_outstanding), f.fee_setup.currency)}
              </span>
            </div>
          )}

          {f.fee_setup.stages.length > 0 && (
            <div>
              <div className={styles.sectionHeadRow} style={{ marginBottom: 8 }}>
                <span className={styles.statLabel} style={{ color: "#ccc" }}>Stages</span>
                <span className={styles.progressValue} style={{ color: "#bbb" }}>
                  {f.fee_setup.stages_collected_count} / {f.fee_setup.stages_total_count} collected
                </span>
              </div>
              <div className={styles.feeStageList}>
                {f.fee_setup.stages.map((s) => (
                  <FeeStageRow key={s.id} stage={s} currency={f.fee_setup!.currency} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.noticeBox}>
          <p className={styles.noticeText}>No fee setup configured for this project</p>
        </div>
      )}

      {/* Billing cost vs revenue */}
      {f.comparison && (
        <>
          <div className={styles.divider} />
          <div>
            <p className={styles.sectionHeading}>Cost vs Revenue</p>
            <div className={styles.statGrid} style={{ marginBottom: 12 }}>
              <Stat
                label="Billing Cost"
                value={formatMoney(f.comparison.billing_cost, f.fee_setup?.currency ?? f.feecalc?.currency ?? "INR")}
                sub="hours × rate"
                accent="#e65100"
              />
              <Stat
                label="Revenue"
                value={formatMoney(f.comparison.revenue_collected, f.fee_setup?.currency ?? f.feecalc?.currency ?? "INR")}
                sub="collected"
                accent="#1565c0"
              />
              <Stat
                label="Difference"
                value={`${f.comparison.difference >= 0 ? "+" : ""}${formatMoney(f.comparison.difference, f.fee_setup?.currency ?? f.feecalc?.currency ?? "INR")}`}
                sub={f.comparison.margin_pct !== null ? `${f.comparison.margin_pct}% margin` : undefined}
                accent={f.comparison.difference >= 0 ? "#2e7d32" : "#c62828"}
              />
            </div>

            {f.billing_cost.breakdown.length > 0 && (
              <div>
                <button
                  className={styles.accordionBtn}
                  onClick={() => setBillingExpanded((v) => !v)}
                  aria-expanded={billingExpanded}
                >
                  <svg
                    className={`${styles.chevron} ${billingExpanded ? styles.chevronOpen : ""}`}
                    width="10" height="10" viewBox="0 0 10 10"
                  >
                    <path d="M3 2l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Per-member breakdown
                </button>

                {billingExpanded && (
                  <>
                    <div className={styles.billingHeaderRow}>
                      <span className={styles.billingHeaderCell}>Member</span>
                      <span className={`${styles.billingHeaderCell} ${styles.billingHeaderCellRight}`}>Hours</span>
                      <span className={`${styles.billingHeaderCell} ${styles.billingHeaderCellRight}`}>Rate</span>
                      <span className={`${styles.billingHeaderCell} ${styles.billingHeaderCellRight}`}>Cost</span>
                    </div>
                    <div className={styles.billingList}>
                      {f.billing_cost.breakdown.map((b, i) => (
                        <div key={i} className={styles.billingRow}>
                          <span className={styles.billingCellName}>{b.user}</span>
                          <span className={styles.billingCellHours}>{b.hours}h</span>
                          <span className={styles.billingCellRate}>
                            {b.rate !== null ? formatMoney(b.rate, b.currency) + "/h" : "—"}
                          </span>
                          <span
                            className={styles.billingCellCost}
                            style={{ color: b.cost !== null ? "#333" : "#ccc" }}
                          >
                            {b.cost !== null ? formatMoney(b.cost, b.currency) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────

function TabBar({ active, onChange, hasFinancials }: {
  active: DetailTab; onChange: (t: DetailTab) => void; hasFinancials: boolean;
}) {
  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "deliverables", label: "Deliverables" },
    ...(hasFinancials ? [{ key: "financials" as DetailTab, label: "Financials" }] : []),
  ];

  return (
    <div className={styles.tabBar}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`${styles.tabBtn} ${active === t.key ? styles.tabBtnActive : ""}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: ProjectDetail }) {
  const profit = project.total_revenue - project.total_expenses;
  const pct = project.deliverable_count === 0
    ? 0
    : Math.round((project.delivered_count / project.deliverable_count) * 100);

  return (
    <div className={styles.tabPanel}>
      <div className={styles.statGrid}>
        <Stat label="Revenue" value={formatMoney(project.total_revenue, "INR")} />
        <Stat label="Expenses" value={formatMoney(project.total_expenses, "INR")} />
        <Stat label="Profit" value={formatMoney(profit, "INR")} accent={profit >= 0 ? "#2e7d32" : "#c62828"} />
        <Stat label="Hours" value={formatHours(project.total_hours)} sub="worklog only" />
        <Stat label="Done" value={`${project.delivered_count}/${project.deliverable_count}`} />
      </div>

      <ProgressBar pct={pct} label="Deliverable Progress" />

      <div className={styles.infoColumns}>
        {[
          {
            heading: "Client",
            rows: [
              { label: "Name", value: project.client_name },
              { label: "Location", value: project.location },
              { label: "Type", value: project.project_type },
            ],
          },
          {
            heading: "Timeline",
            rows: [
              { label: "Start", value: formatDate(project.start_date) },
              { label: "End", value: formatDate(project.end_date) },
              { label: "Billing", value: project.billing_type === "hourly" ? "Hourly" : "Percentage Share" },
            ],
          },
        ].map((col) => (
          <div key={col.heading}>
            <p className={styles.sectionHeading}>{col.heading}</p>
            <div className={styles.infoRows}>
              {col.rows.map((r) => (
                <div key={r.label}>
                  <p className={styles.infoLabel}>{r.label}</p>
                  <p className={styles.infoValue}>{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {project.description && (
        <>
          <div className={styles.divider} />
          <div>
            <p className={styles.sectionHeading}>Description</p>
            <p className={styles.description}>{project.description}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Deliverables tab ──────────────────────────────────────────────────────

function DeliverablesTab({ project }: { project: ProjectDetail }) {
  return (
    <div className={styles.deliverableList}>
      {project.deliverables.length === 0 ? (
        <p className={styles.emptyRow}>No deliverables yet</p>
      ) : (
        project.deliverables.map((d) => <DeliverableRow key={d.id} d={d} />)
      )}
    </div>
  );
}

// ─── Full detail panel ─────────────────────────────────────────────────────

function DetailPanel({ project }: { project: ProjectDetail }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const stageCol = STAGE_COLOR[project.current_stage];

  return (
    <div className={styles.tabPanel}>
      <div>
        <div className={styles.detailHeaderRow}>
          <div>
            <h2 className={styles.detailName}>{project.name}</h2>
            <p className={styles.detailSub}>{project.organisation_name} · {project.location}</p>
          </div>
          <div className={styles.badgeRow}>
            <Badge label={STAGE_LABEL[project.current_stage]} bg={stageCol.bg} text={stageCol.text} />
            {project.is_completed && <Badge label="✓ Completed" bg="#e8f5e9" text="#2e7d32" />}
          </div>
        </div>
      </div>

      <TabBar active={tab} onChange={setTab} hasFinancials={project.financials !== null} />

      {tab === "overview" && <OverviewTab project={project} />}
      {tab === "deliverables" && <DeliverablesTab project={project} />}
      {tab === "financials" && project.financials && <FinancialsPanel f={project.financials} />}
    </div>
  );
}

// ─── Project card ──────────────────────────────────────────────────────────

function ProjectCard({ project, selected, onClick }: {
  project: ProjectListItem; selected: boolean; onClick: () => void;
}) {
  const hours = hoursFromListItem(project);
  const stageCol = STAGE_COLOR[project.current_stage];
  return (
    <button
      onClick={onClick}
      className={`${styles.projectCard} ${selected ? styles.projectCardSelected : ""}`}
    >
      <div className={styles.cardTopRow}>
        <span className={styles.cardName}>{project.name}</span>
        <span
          className={styles.badge}
          style={{ background: stageCol.bg, color: stageCol.text }}
        >
          {project.is_completed ? "✓ Done" : STAGE_LABEL[project.current_stage]}
        </span>
      </div>
      <p className={styles.cardMeta}>{project.client_name} · {project.location}</p>
      <div className={styles.cardStats}>
        <span>{project.agg_deliverable_count} deliverables</span>
        <span>{formatHours(hours)}</span>
        <span>{formatMoney(project.agg_revenue, "INR")}</span>
      </div>
    </button>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────

function FilterBar({ orgs, params, onChange }: {
  orgs: OrganisationOption[]; params: ProjectListParams;
  onChange: (p: ProjectListParams) => void;
}) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.searchBox}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          className={styles.searchInput}
          value={params.q ?? ""}
          onChange={(e) => onChange({ ...params, q: e.target.value })}
          placeholder="Search projects…"
        />
        {params.q && (
          <button className={styles.clearBtn} onClick={() => onChange({ ...params, q: "" })} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <select
        className={styles.select}
        value={params.org_id ?? ""}
        onChange={(e) => onChange({ ...params, org_id: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">All Orgs</option>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>

      <select
        className={styles.select}
        value={params.stage ?? ""}
        onChange={(e) => onChange({ ...params, stage: (e.target.value || undefined) as ProjectListParams["stage"] })}
      >
        <option value="">All Stages</option>
        {(["1", "2", "3", "4", "5"] as const).map((s) => (
          <option key={s} value={s}>{STAGE_LABEL[s]}</option>
        ))}
      </select>

      <select
        className={styles.select}
        value={params.is_completed === undefined ? "" : params.is_completed ? "true" : "false"}
        onChange={(e) => onChange({ ...params, is_completed: e.target.value === "" ? undefined : e.target.value === "true" })}
      >
        <option value="">All Status</option>
        <option value="false">In Progress</option>
        <option value="true">Completed</option>
      </select>
    </div>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w?: string; h?: string }) {
  return <div className={styles.skeleton} style={{ width: w ?? "100%", height: h ?? "14px" }} />;
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <Skeleton h="14px" w="75%" />
          <Skeleton h="10px" w="50%" />
          <Skeleton h="10px" w="60%" />
        </div>
      ))}
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className={styles.skeletonDetailCard}>
      <Skeleton h="22px" w="55%" />
      <Skeleton h="12px" w="35%" />
      <div className={styles.skeletonStatsRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonStat}>
            <Skeleton h="10px" w="50%" />
            <Skeleton h="20px" w="70%" />
          </div>
        ))}
      </div>
      <Skeleton h="6px" />
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h="44px" />)}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

const MOBILE_BREAKPOINT = 768;

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<OrganisationOption[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [params, setParams] = useState<ProjectListParams>({});
  const [debouncedParams, setDebouncedParams] = useState<ProjectListParams>({});
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track viewport width via matchMedia so layout logic never reads
  // window.innerWidth mid-render (which caused mismatched/broken mobile UI).
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    fetchProjectOrganisations().then(setOrgs).catch(() => {});
  }, []);

  const handleParamChange = (p: ProjectListParams) => {
    setParams(p);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedParams(p), 320);
  };

  const selectProject = useCallback((id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    fetchProjectDetail(id)
      .then((d) => { setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    fetchProjects(debouncedParams)
      .then((data) => {
        if (cancelled) return;
        setProjects(data);
        setListLoading(false);
        if (data.length > 0 && !selectedId && !isMobile) {
          selectProject(data[0].id);
        }
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setListError(e.message);
        setListLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedParams]);

  const handleCardClick = (id: number) => {
    selectProject(id);
    if (isMobile) setMobileDetailOpen(true);
    setTimeout(() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const handleBack = () => setMobileDetailOpen(false);

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.subtitle}>{projects.length} results</p>
        </div>
        <div className={styles.filterSlot}>
          <FilterBar orgs={orgs} params={params} onChange={handleParamChange} />
        </div>
      </header>

      {/* Body */}
      <div className={`${styles.body} ${isMobile && mobileDetailOpen ? styles.mobileDetailOpen : ""}`}>
        {/* List */}
        <aside className={styles.sidebar}>
          {listError && <div className={styles.errorBox}>{listError}</div>}

          {listLoading ? (
            <ListSkeleton />
          ) : projects.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔍</div>
              <p className={styles.emptyText}>No projects found</p>
            </div>
          ) : (
            projects.map((p, i) => (
              <div key={p.id} className={styles.cardEnter} style={{ animationDelay: `${i * 30}ms` }}>
                <ProjectCard project={p} selected={selectedId === p.id} onClick={() => handleCardClick(p.id)} />
              </div>
            ))
          )}
        </aside>

        {/* Detail */}
        <main ref={mainRef} className={styles.main}>
          {isMobile && mobileDetailOpen && (
            <button onClick={handleBack} className={styles.mobileBackBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back to projects
            </button>
          )}

          {detailLoading ? (
            <DetailSkeleton />
          ) : detail ? (
            <div className={`${styles.detailCard} ${styles.detailEnter}`}>
              <DetailPanel project={detail} />
            </div>
          ) : (
            <div className={styles.detailPlaceholder}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.4 }}>
                <rect x="6" y="6" width="36" height="36" rx="8" stroke="#bbb" strokeWidth="2" />
                <line x1="14" y1="18" x2="34" y2="18" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="24" x2="28" y2="24" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
                <line x1="14" y1="30" x2="24" y2="30" stroke="#bbb" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className={styles.detailPlaceholderText}>Select a project to view details</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}