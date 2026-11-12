"use client";

import {
  getAssignments,
  getProductsByCategory,
} from "@/app/product/productApi";
import type { AddonAssignment } from "./estimateAddon";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { spaceGrotesk as display, ibmPlexMono as mono } from "@/lib/fonts";
import {
  getAuthToken,
  getOrganisations,
  getProjects,
  getMyMemberships,
  getEstimates,
  getEstimate,
  createEstimate,
  updateEstimate,
  setEstimateStatus,
  deleteEstimate,
  downloadEstimateCsv,
} from "./estimateApi";
import {
  Estimate,
  EstimateDetail,
  EstimateKind,
  EstimateStatus,
  Organisation,
  Project,
  QuantityAdjust,
  QuantityConfig,
  RawMembership,
} from "./types";
import EstimateTree, { formatINR } from "./components/EstimateTree";
import QuantityTable, { fmtNum } from "./components/QuantityTable";
import EstimateForm from "./components/EstimateForm";
import "./styles.css";
import "./quantity.css";

// Keep in sync with MANAGE_ROLES in estimate/access.py (UI gating only).
const MANAGE_ROLES = ["admin", "manager"];

type StatusFilter = EstimateStatus | "all";
type KindFilter = EstimateKind | "all";

const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

const finalOf = (cfg: QuantityConfig | null | undefined) =>
  cfg?.final ? cfg.columns?.find((c) => c.key === cfg.final) : undefined;

const statusActions = (
  s: EstimateStatus,
): { label: string; to: EstimateStatus; icon: string; confirm?: string }[] => {
  if (s === "draft")
    return [
      {
        label: "Publish",
        to: "published",
        icon: "ti-world-upload",
        confirm:
          "Publish this estimate? Project clients will be able to see it.",
      },
    ];
  if (s === "published")
    return [
      { label: "Unpublish", to: "draft", icon: "ti-eye-off" },
      {
        label: "Archive",
        to: "archived",
        icon: "ti-archive",
        confirm: "Archive this estimate? It will be hidden from clients.",
      },
    ];
  return [{ label: "Restore to draft", to: "draft", icon: "ti-arrow-back-up" }];
};

export default function EstimatePage() {
  const [auth, setAuth] = useState<"checking" | "guest" | "user">("checking");
  const [ready, setReady] = useState(false);

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [memberships, setMemberships] = useState<RawMembership[]>([]);

  const [orgId, setOrgId] = useState<number | undefined>();
  const [projectId, setProjectId] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [active, setActive] = useState<EstimateDetail | null>(null);

  // all estimates of the open estimate's project (for the "+ Add" picker, ignores list filters)
  const [siblings, setSiblings] = useState<Estimate[]>([]);
  useEffect(() => {
    if (!active) {
      setSiblings([]);
      return;
    }
    let cancelled = false;
    getEstimates({ projectId: active.project_id })
      .then((d) => !cancelled && setSiblings(d))
      .catch(() => !cancelled && setSiblings([]));
    return () => {
      cancelled = true;
    };
  }, [active?.id, active?.project_id]);

  const [viewerLoading, setViewerLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);

  const [busy, setBusy] = useState<{ id: number; action: string } | null>(null);
  const busyRef = useRef(false);
  const isBusy = busy !== null;

  // ── auth + lookups ────────────────────────────────────────────────────
  useEffect(() => {
    if (!getAuthToken()) {
      setAuth("guest");
      return;
    }
    setAuth("user");
    (async () => {
      try {
        const [m, o] = await Promise.all([
          getMyMemberships(),
          getOrganisations(),
        ]);
        setMemberships(m);
        setOrganisations(o);
      } catch {
        setError("Failed to load your organisations");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const manageOrgIds = useMemo(
    () =>
      new Set(
        memberships
          .filter(
            (m) =>
              MANAGE_ROLES.includes(m.role) &&
              (m.project === null || m.project === undefined),
          )
          .map((m) => m.organisation),
      ),
    [memberships],
  );
  const canManage = manageOrgIds.size > 0;
  const manageableOrgs = useMemo(
    () => organisations.filter((o) => manageOrgIds.has(o.id)),
    [organisations, manageOrgIds],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setProjectId(undefined);
    if (auth !== "user" || orgId === undefined) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    getProjects(orgId)
      .then((d) => !cancelled && setProjects(d))
      .catch(() => !cancelled && setError("Failed to load projects"));
    return () => {
      cancelled = true;
    };
  }, [orgId, auth]);

  // ── list ──────────────────────────────────────────────────────────────
  const load = useCallback(
    async (silent = false) => {
      if (auth !== "user") return;
      try {
        if (!silent) setLoading(true);
        setError(null);
        const data = await getEstimates({
          organisationId: orgId,
          projectId,
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        setEstimates(data);
      } catch (e) {
        setError(msg(e));
      } finally {
        setLoading(false);
      }
    },
    [auth, orgId, projectId, debouncedSearch, statusFilter],
  );

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // kind filter is applied client-side (list is not paginated)
  const visible = useMemo(
    () =>
      kindFilter === "all"
        ? estimates
        : estimates.filter((e) => (e.kind ?? "estimate") === kindFilter),
    [estimates, kindFilter],
  );

  // ── viewer ────────────────────────────────────────────────────────────
  const openEstimate = async (est: Estimate) => {
    try {
      setViewerLoading(true);
      setActionMessage(null);
      setActive(await getEstimate(est.id));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setActionMessage(msg(e));
    } finally {
      setViewerLoading(false);
    }
  };

  // ── actions ───────────────────────────────────────────────────────────
  const runAction = async (
    est: Estimate,
    action: string,
    fn: () => Promise<EstimateDetail | void>,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy({ id: est.id, action });
    setActionMessage(null);
    try {
      const updated = await fn();
      if (action === "delete") {
        if (active?.id === est.id) setActive(null);
      } else if (updated && active?.id === est.id) {
        setActive(updated);
      }
      await load(true);
    } catch (e) {
      setActionMessage(msg(e));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleStatus = (
    est: Estimate,
    to: EstimateStatus,
    confirmText?: string,
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;
    runAction(est, `status-${to}`, () => setEstimateStatus(est.id, to));
  };

  const handleDelete = (est: Estimate) => {
    if (
      !window.confirm(
        `Delete "${est.title}"? The CSV file is removed permanently.`,
      )
    )
      return;
    runAction(est, "delete", () => deleteEstimate(est.id));
  };

  const handleDownload = (est: Estimate) =>
    runAction(est, "download", () => downloadEstimateCsv(est));

  const handleFormSave = async (formData: FormData) => {
    let saved: EstimateDetail;
    if (editing) saved = await updateEstimate(editing.id, formData);
    else saved = await createEstimate(formData);
    if (active?.id === saved.id) setActive(saved);
    setFormOpen(false);
    setEditing(null);
    await load(true);
  };

  // Saves merged rows + wastage by re-sending the config; the server rebuilds from the stored CSV.
  const handleSaveAdjust = async (adjust: QuantityAdjust) => {
    if (!active) return;
    const fd = new FormData();
    fd.append("project_id", String(active.project_id));
    fd.append("kind", "quantity");
    fd.append("title", active.title);
    fd.append("description", active.description || "");
    fd.append("status", active.status);
    fd.append("config", JSON.stringify({ ...(active.config ?? {}), adjust }));
    const saved = await updateEstimate(active.id, fd);
    setActive(saved);
    await load(true);
  };

  const loadProductAssignments = async (
    pid: number,
  ): Promise<AddonAssignment[]> => {
    const [list, catalog] = await Promise.all([
      getAssignments(pid),
      getProductsByCategory("", pid),
    ]);
    const idx = new Map(catalog.items.map((p) => [p.id, p]));
    return list.map((a) => ({
      ...a,
      product_detail: idx.get(a.product_detail.id) ?? a.product_detail,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (est: Estimate) => {
    setEditing(est);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setOrgId(undefined);
    setProjectId(undefined);
    setStatusFilter("all");
    setKindFilter("all");
    setSearch("");
  };
  const hasFilters =
    orgId !== undefined ||
    projectId !== undefined ||
    statusFilter !== "all" ||
    kindFilter !== "all" ||
    search !== "";

  const btnBusy = (est: Estimate, a: string) =>
    busy?.id === est.id && busy.action === a;

  const renderActions = (est: Estimate) => {
    const p = est.permissions;
    if (!p.can_edit && !p.can_delete && !p.can_change_status && !p.can_download)
      return null;
    return (
      <div className="est-actions" onClick={(e) => e.stopPropagation()}>
        {p.can_change_status &&
          statusActions(est.status).map((a) => (
            <button
              key={a.to}
              className={`est-btn est-btn-sm ${a.to === "published" ? "est-btn-primary" : ""}`}
              disabled={isBusy}
              onClick={() => handleStatus(est, a.to, a.confirm)}
            >
              <i className={`ti ${a.icon}`} />{" "}
              {btnBusy(est, `status-${a.to}`) ? "…" : a.label}
            </button>
          ))}
        {p.can_edit && (
          <button
            className="est-btn est-btn-sm"
            disabled={isBusy}
            onClick={() => openEdit(est)}
          >
            <i className="ti ti-edit" />{" "}
            {est.kind === "quantity"
              ? "Edit / Columns / Replace CSV"
              : "Edit / Replace CSV"}
          </button>
        )}
        {p.can_download && (
          <button
            className="est-btn est-btn-sm"
            disabled={isBusy}
            onClick={() => handleDownload(est)}
          >
            <i className="ti ti-download" />{" "}
            {btnBusy(est, "download") ? "…" : "CSV"}
          </button>
        )}
        {p.can_delete && (
          <button
            className="est-btn est-btn-sm est-btn-danger"
            disabled={isBusy}
            onClick={() => handleDelete(est)}
          >
            <i className="ti ti-trash" />{" "}
            {btnBusy(est, "delete") ? "…" : "Delete"}
          </button>
        )}
      </div>
    );
  };

  const shell = `${display.variable} ${mono.variable} est-page`;
  const activeFinal =
    active && active.kind === "quantity" ? finalOf(active.config) : undefined;

  if (auth === "checking") {
    return (
      <main className={shell}>
        <div className="est-state">
          <i className="ti ti-loader" />
          <p>Loading…</p>
        </div>
      </main>
    );
  }

  if (auth === "guest") {
    return (
      <main className={shell}>
        <div className="est-state">
          <i className="ti ti-lock" />
          <h3>Login required</h3>
          <p>Please log in to view project estimates.</p>
          <Link
            className="est-btn est-btn-primary"
            href="/login?redirect=/estimate"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={shell}>
      <header className="est-header">
        <div className="est-brand">
          <span className="est-brand-icon">
            <i className="ti ti-calculator" />
          </span>
          <span>Estimates &amp; Quantities</span>
        </div>
        <div className="est-header-right">
          <Link href="/main/client" className="est-link">
            <i className="ti ti-arrow-left" /> <span>Back to Portal</span>
          </Link>
          {canManage && !active && (
            <button className="est-btn est-btn-primary" onClick={openCreate}>
              <i className="ti ti-plus" /> New upload
            </button>
          )}
        </div>
      </header>

      {actionMessage && (
        <div className="est-alert" role="alert">
          <i className="ti ti-alert-circle" /> <span>{actionMessage}</span>
          <button
            className="est-icon-btn"
            onClick={() => setActionMessage(null)}
            aria-label="Dismiss"
          >
            <i className="ti ti-x" />
          </button>
        </div>
      )}

      {/* ───────── VIEWER ───────── */}
      {active ? (
        <section className="est-viewer">
          <button className="est-back" onClick={() => setActive(null)}>
            <i className="ti ti-arrow-left" /> All estimates
          </button>

          <div className="est-viewer-head">
            <div className="est-viewer-info">
              <span className={`est-status est-status-${active.status}`}>
                {active.status}
              </span>{" "}
              {active.kind === "quantity" && (
                <span className="est-kind">Quantities</span>
              )}
              <h1>{active.title}</h1>
              <p className="est-viewer-sub">
                <i className="ti ti-briefcase" /> {active.project_name} ·{" "}
                {active.organisation_name}
              </p>
              {active.description && (
                <p className="est-viewer-desc">{active.description}</p>
              )}
              <p className="est-viewer-meta">
                {active.item_count} rows · updated{" "}
                {new Date(active.updated_at).toLocaleDateString()} ·{" "}
                {active.uploaded_by_name}
              </p>
            </div>
            {active.kind === "quantity" ? (
              activeFinal && (
                <div className="est-viewer-total">
                  <span>Total {activeFinal.label}</span>
                  <strong>
                    {fmtNum(active.total_amount, active.config?.decimals ?? 2)}
                    {activeFinal.unit ? ` ${activeFinal.unit}` : ""}
                  </strong>
                </div>
              )
            ) : (
              <div className="est-viewer-total">
                <span>Total estimate</span>
                <strong>₹ {formatINR(active.total_amount)}</strong>
              </div>
            )}
          </div>

          {renderActions(active)}

          {active.kind === "quantity" && active.quantity_data ? (
            <QuantityTable
              key={`${active.id}-${active.updated_at}`}
              data={active.quantity_data}
              title={active.title}
              adjust={active.config?.adjust}
              onSave={
                active.permissions.can_edit ? handleSaveAdjust : undefined
              }
              meta={{
                title: active.title,
                projectName: active.project_name,
                organisationName: active.organisation_name,
                status: active.status,
                updatedAt: active.updated_at,
              }}
            />
          ) : (
            <EstimateTree
              key={`${active.id}-${active.updated_at}`}
              items={active.items}
              total={active.total_amount}
              
              meta={{
                title: active.title,
                projectName: active.project_name,
                organisationName: active.organisation_name,
                status: active.status,
                updatedAt: active.updated_at,
              }}
              projectId={active.project_id}
              currentId={active.id}
              candidates={siblings}
              loadAssignments={loadProductAssignments}
            />
          )}
        </section>
      ) : (
        <>
          {/* ───────── FILTERS ───────── */}
          <div className="est-hero">
            <p className="est-eyebrow">Cost estimates &amp; quantities</p>
            <h1>Project estimates</h1>
            <p className="est-sub">
              Open an item to browse every quantity, rate and total.
            </p>
          </div>

          <div className="est-filters">
            <div className="est-search">
              <i className="ti ti-search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or project…"
              />
              {search && (
                <button
                  className="est-icon-btn"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <i className="ti ti-x" />
                </button>
              )}
            </div>

            <select
              value={orgId ?? ""}
              onChange={(e) =>
                setOrgId(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">All organisations</option>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            <select
              value={projectId ?? ""}
              onChange={(e) =>
                setProjectId(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              disabled={orgId === undefined || projects.length === 0}
            >
              <option value="">
                {orgId === undefined
                  ? "Select organisation first"
                  : "All projects"}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            >
              <option value="all">Estimates &amp; quantities</option>
              <option value="estimate">Estimates only</option>
              <option value="quantity">Quantities only</option>
            </select>

            {canManage && (
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            )}

            {hasFilters && (
              <button className="est-btn est-btn-sm" onClick={clearFilters}>
                <i className="ti ti-x" /> Clear
              </button>
            )}
          </div>

          {/* ───────── LIST ───────── */}
          {loading || viewerLoading ? (
            <div className="est-state">
              <i className="ti ti-loader" />
              <p>Loading…</p>
            </div>
          ) : error ? (
            <div className="est-state">
              <i className="ti ti-alert-circle" />
              <p>{error}</p>
              <button className="est-btn" onClick={() => load()}>
                Retry
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="est-state">
              <i className="ti ti-folder-open" />
              <h3>Nothing found</h3>
              <p>
                {hasFilters
                  ? "Nothing matches the selected filters."
                  : "Nothing has been shared yet."}
              </p>
              {canManage && (
                <button
                  className="est-btn est-btn-primary"
                  onClick={openCreate}
                >
                  <i className="ti ti-plus" /> Upload the first CSV
                </button>
              )}
            </div>
          ) : (
            <div className="est-grid">
              {visible.map((est) => {
                const isQty = est.kind === "quantity";
                const fc = isQty ? finalOf(est.config) : undefined;
                return (
                  <article
                    key={est.id}
                    className="est-card"
                    onClick={() => openEstimate(est)}
                  >
                    <div className="est-card-top">
                      <span>
                        <span className={`est-status est-status-${est.status}`}>
                          {est.status}
                        </span>{" "}
                        {isQty && <span className="est-kind">Quantities</span>}
                      </span>
                      <span className="est-card-org">
                        {est.organisation_name}
                      </span>
                    </div>
                    <h3 className="est-card-title">{est.title}</h3>
                    <p className="est-card-project">
                      <i className="ti ti-briefcase" /> {est.project_name}
                    </p>
                    {est.description && (
                      <p className="est-card-desc">{est.description}</p>
                    )}
                    {isQty ? (
                      fc && (
                        <div className="est-card-total">
                          <span>{fc.label}</span>
                          <strong>
                            {fmtNum(
                              est.total_amount,
                              est.config?.decimals ?? 2,
                            )}
                            {fc.unit ? ` ${fc.unit}` : ""}
                          </strong>
                        </div>
                      )
                    ) : (
                      <div className="est-card-total">
                        <span>Total</span>
                        <strong>₹ {formatINR(est.total_amount)}</strong>
                      </div>
                    )}
                    <p className="est-card-meta">
                      {est.item_count} rows ·{" "}
                      {new Date(est.updated_at).toLocaleDateString()}
                    </p>
                    {renderActions(est)}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <EstimateForm
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleFormSave}
        estimate={editing}
        organisations={manageableOrgs}
      />
    </main>
  );
}
