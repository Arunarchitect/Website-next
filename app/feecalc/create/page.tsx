"use client";
// app/feecalc/create/page.tsx
//
// Authenticated builder: admins/managers pick fee templates, toggle which
// billing types a client sees, optionally attach a lump-sum or a discount
// package, and get back a shareable access_code (?code=QO-XXXXXX on
// /feecalc). Mirrors the visual language of the public /feecalc page.
//
// Two modes, same page:
//   /feecalc/create              → blank form, creates a new QuoteOption
//   /feecalc/create?edit=<id>    → loads an existing QuoteOption and PATCHes it

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { C } from "../feeCalcTypes";
import { fmtCurrency, type FeeTemplateOption } from "../feeCalcApi";
import {
  fetchAdminOrganisations,
  fetchProjectsForOrg,
  fetchFeeTemplatesForOrg,
  fetchDiscountPackagesForOrg,
  createQuoteOption,
  updateQuoteOption,
  fetchMyQuoteOptions,
  fetchQuoteOption,
  type AdminOrganisation,
  type AdminProject,
  type AdminDiscountPackage,
  type AdminQuoteOptionListItem,
  type QuoteOptionPayload,
  type QuoteOptionFlat,
} from "./feeCalcAdminApi";

// ─── Small primitives (self-contained — mirrors app/feecalc/page.tsx style) ───

function Spinner({ color = "#fff" }: { color?: string }) {
  return (
    <svg width={13} height={13} viewBox="0 0 20 20" fill="none" style={{ animation: "qc-spin 0.75s linear infinite" }}>
      <path d="M17 10a7 7 0 1 1-7-7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

function Checkbox({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
        background: checked ? color : "#fff",
        border: `1.5px solid ${checked ? color : "#d1d5db"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.12s",
      }}
    >
      {checked && (
        <svg width={10} height={10} viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, color }: { checked: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 34, height: 18, borderRadius: 99, flexShrink: 0, cursor: "pointer",
        background: checked ? color : "#d1d5db", transition: "background 0.15s", position: "relative",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: checked ? 18 : 3, width: 12, height: 12,
        borderRadius: "50%", background: "#fff", transition: "left 0.15s",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{
      fontSize: 10, fontWeight: 700, color: C.t4, letterSpacing: "0.09em",
      textTransform: "uppercase" as const, display: "block", marginBottom: 5,
    }}>
      {children} {required && <span style={{ color: C.red }}>*</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: C.surface, color: C.t1, fontSize: 14,
  border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "9px 12px",
  outline: "none", fontFamily: "inherit", transition: "border-color 0.1s",
};

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, resize: "vertical" as const, ...props.style }} />;
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${accent ? accent + "40" : C.border}`,
      borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>{children}</div>;
}

// ─── Billing-type option row ───────────────────────────────────────────────────

function BillingOptionRow({
  on, onToggle, color, icon, title, children,
}: {
  on: boolean; onToggle: (v: boolean) => void; color: string; icon: string; title: string; children?: React.ReactNode;
}) {
  return (
    <div style={{
      border: `1.5px solid ${on ? color : C.border}`, borderRadius: 10,
      background: on ? `${color}0c` : "transparent", overflow: "hidden", transition: "all 0.12s",
    }}>
      <div onClick={() => onToggle(!on)} style={{
        padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer",
      }}>
        <Checkbox checked={on} onChange={onToggle} color={color} />
        <span style={{ fontSize: 14, fontWeight: 600, color: on ? color : C.t2 }}>{icon} {title}</span>
      </div>
      {on && children && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px dashed ${color}30`, paddingTop: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Result panel (create or update) ───────────────────────────────────────────

function ResultPanel({
  quote, isEdit, onCreateAnother,
}: {
  quote: QuoteOptionFlat; isEdit: boolean; onCreateAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/feecalc?code=${quote.access_code}` : "";

  return (
    <div style={{
      background: C.greenBg, border: `1.5px solid ${C.greenBd}`, borderRadius: 12,
      padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>
            {isEdit ? "Quote updated" : "Quote created"}
          </div>
          <div style={{ fontSize: 12, color: C.t3 }}>{quote.name}</div>
        </div>
      </div>

      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{
          fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: C.t1, letterSpacing: "0.05em",
        }}>
          {quote.access_code}
        </span>
        <span style={{ flex: 1, fontSize: 11, color: C.t4, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
          }}
          style={{
            flexShrink: 0, background: copied ? C.greenBg : "#e5e7eb", border: "none", borderRadius: 6,
            padding: "6px 12px", fontSize: 11.5, fontWeight: 600, color: copied ? C.green : C.t3, cursor: "pointer",
          }}
        >
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
        <Link href={`/feecalc?code=${quote.access_code}`} target="_blank" style={{
          background: C.amber, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "8px 14px",
          borderRadius: 8, textDecoration: "none",
        }}>
          Open public page →
        </Link>
        <button onClick={onCreateAnother} style={{
          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px",
          fontSize: 12.5, color: C.t3, cursor: "pointer",
        }}>
          {isEdit ? "Back to list" : "Create another"}
        </button>
      </div>
    </div>
  );
}

// ─── Existing quotes list ───────────────────────────────────────────────────────

function QuoteListRow({ q, onToggleActive }: { q: AdminQuoteOptionListItem; onToggleActive: (id: number, active: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/feecalc?code=${q.access_code}` : "";
  const types: string[] = [];
  if (q.show_quantity) types.push("Qty");
  if (q.show_hourly) types.push("Hourly");
  if (q.show_lumpsum) types.push("Lumpsum");

  return (
    <div style={{
      padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
      borderBottom: `1px solid ${C.border}`, opacity: q.is_active ? 1 : 0.55, flexWrap: "wrap" as const,
    }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.t1 }}>{q.name}</span>
          <span style={{
            fontSize: 9.5, fontFamily: "monospace", color: C.t4, background: C.surface,
            border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 6px",
          }}>
            {q.access_code}
          </span>
          {!q.is_active && (
            <span style={{ fontSize: 9.5, color: C.red, fontWeight: 700 }}>INACTIVE</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.t4, marginTop: 3 }}>
          {types.join(" · ") || "No billing type"}
          {q.show_lumpsum && q.lumpsum_amount && ` · ${fmtCurrency(q.lumpsum_amount, q.currency)}`}
          {q.discount_package && ` · Discount: ${q.discount_package.name}`}
        </div>
      </div>
      <Link href={`/feecalc/create?edit=${q.id}`} style={{
        flexShrink: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
        padding: "5px 11px", fontSize: 11, fontWeight: 600, color: C.t3, textDecoration: "none",
      }}>
        Edit
      </Link>
      <button
        onClick={() => { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
        style={{ flexShrink: 0, background: "#e5e7eb", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: C.t3, cursor: "pointer" }}
      >
        {copied ? "✓" : "Copy link"}
      </button>
      <Toggle checked={q.is_active} onChange={(v) => onToggleActive(q.id, v)} color={C.green} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreateQuotePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit") ? Number(searchParams.get("edit")) : null;

  const [authChecked, setAuthChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const [orgs, setOrgs] = useState<AdminOrganisation[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<FeeTemplateOption[]>([]);
  const [packages, setPackages] = useState<AdminDiscountPackage[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectsUnavailable, setProjectsUnavailable] = useState(false);
  const [loadingScoped, setLoadingScoped] = useState(false);

  const [quotes, setQuotes] = useState<AdminQuoteOptionListItem[]>([]);

  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [editError, setEditError] = useState<string | null>(null);
  const prefilledRef = useRef(false);

  // ── form state ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [manualProjectId, setManualProjectId] = useState(""); // fallback if /api/projects/ isn't reachable
  const [isActive, setIsActive] = useState(true);

  const [showQuantity, setShowQuantity] = useState(true);
  const [showHourly, setShowHourly] = useState(false);
  const [showLumpsum, setShowLumpsum] = useState(false);

  const [quantityTemplateId, setQuantityTemplateId] = useState<string>("");
  const [hourlyTemplateId, setHourlyTemplateId] = useState<string>("");
  const [lumpsumAmount, setLumpsumAmount] = useState("");
  const [lumpsumLabel, setLumpsumLabel] = useState("Fixed Professional Fee");
  const [lumpsumNote, setLumpsumNote] = useState("");
  const [discountPackageId, setDiscountPackageId] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteOptionFlat | null>(null);

  // ── auth check ──
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access") : null;
    setHasToken(!!token);
    setAuthChecked(true);
  }, []);

  // ── load orgs this user can admin ──
  useEffect(() => {
    if (!hasToken) return;
    setLoadingOrgs(true);
    fetchAdminOrganisations()
      .then((list) => {
        setOrgs(list);
        if (!editId && list.length === 1) setOrgId(list[0].id);
      })
      .catch((e: unknown) => setPageError(e instanceof Error ? e.message : "Failed to load organisations"))
      .finally(() => setLoadingOrgs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // ── if editing, load the quote first so we know which org it belongs to ──
  useEffect(() => {
    if (!hasToken || !editId) return;
    setLoadingEdit(true);
    fetchQuoteOption(editId)
      .then((q) => {
        setOrgId(q.organisation);
        setName(q.name);
        setDescription(q.description ?? "");
        setIsActive(q.is_active);
        setShowQuantity(q.show_quantity);
        setShowHourly(q.show_hourly);
        setShowLumpsum(q.show_lumpsum);
        setQuantityTemplateId(q.quantity_template ? String(q.quantity_template.id) : "");
        setHourlyTemplateId(q.hourly_template ? String(q.hourly_template.id) : "");
        setLumpsumAmount(q.lumpsum_amount ?? "");
        setLumpsumLabel(q.lumpsum_label || "Fixed Professional Fee");
        setLumpsumNote(q.lumpsum_note ?? "");
        setDiscountPackageId(q.discount_package ? String(q.discount_package.id) : "");
        setProjectId(q.project ? String(q.project) : "");
        setManualProjectId(q.project ? String(q.project) : "");
        prefilledRef.current = true;
      })
      .catch((e: unknown) => setEditError(e instanceof Error ? e.message : "Failed to load quote"))
      .finally(() => setLoadingEdit(false));
    
  }, [hasToken, editId]);

  // ── load templates/packages/projects/quotes scoped to selected org ──
  useEffect(() => {
    if (!orgId) return;
    setLoadingScoped(true);
    setProjectsUnavailable(false);
    Promise.all([
      fetchFeeTemplatesForOrg(orgId),
      fetchDiscountPackagesForOrg(orgId),
      fetchMyQuoteOptions(orgId),
    ])
      .then(([tpls, pkgs, qs]) => {
        setTemplates(tpls);
        setPackages(pkgs);
        setQuotes(qs);
      })
      .catch((e: unknown) => setPageError(e instanceof Error ? e.message : "Failed to load quote data"))
      .finally(() => setLoadingScoped(false));

    fetchProjectsForOrg(orgId)
      .then(setProjects)
      .catch(() => setProjectsUnavailable(true)); // fall back to manual ID input, see render below
  }, [orgId]);

  const qtyTemplates = templates.filter((t) => t.billing_type === "quantity_rate");
  const hourlyTemplates = templates.filter((t) => t.billing_type === "hourly");
  const isEdit = !!editId;

  function resetForm() {
    router.push("/feecalc/create");
    setName("");
    setDescription("");
    setProjectId("");
    setManualProjectId("");
    setIsActive(true);
    setShowQuantity(true);
    setShowHourly(false);
    setShowLumpsum(false);
    setQuantityTemplateId("");
    setHourlyTemplateId("");
    setLumpsumAmount("");
    setLumpsumLabel("Fixed Professional Fee");
    setLumpsumNote("");
    setDiscountPackageId("");
    setSubmitError(null);
    setResult(null);
  }

  function validate(): string | null {
    if (!orgId) return "Select an organisation first.";
    if (!name.trim()) return "Name is required.";
    if (!showQuantity && !showHourly && !showLumpsum) {
      return "Select at least one billing type (Quantity, Hourly, or Lump-sum).";
    }
    if (showQuantity && !quantityTemplateId) return "Pick a Quantity × Rate fee template.";
    if (showHourly && !hourlyTemplateId) return "Pick an Hourly fee template.";
    if (showLumpsum && (!lumpsumAmount || Number(lumpsumAmount) <= 0)) {
      return "Enter a lump-sum amount greater than 0.";
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setSubmitError(err); return; }
    if (!orgId) return;

    const effectiveProjectId = projectsUnavailable ? manualProjectId : projectId;

    setSubmitting(true);
    setSubmitError(null);
    const payload: QuoteOptionPayload = {
      organisation: orgId,
      project: effectiveProjectId.trim() ? Number(effectiveProjectId) : null,
      quantity_template: showQuantity && quantityTemplateId ? Number(quantityTemplateId) : null,
      hourly_template: showHourly && hourlyTemplateId ? Number(hourlyTemplateId) : null,
      show_quantity: showQuantity,
      show_hourly: showHourly,
      show_lumpsum: showLumpsum,
      lumpsum_amount: showLumpsum && lumpsumAmount ? lumpsumAmount : null,
      lumpsum_label: lumpsumLabel || "Fixed Professional Fee",
      lumpsum_note: lumpsumNote.trim() || null,
      discount_package: discountPackageId ? Number(discountPackageId) : null,
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
    };

    try {
      const saved = isEdit ? await updateQuoteOption(editId!, payload) : await createQuoteOption(payload);
      setResult(saved);
      const list = await fetchMyQuoteOptions(orgId);
      setQuotes(list);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : `Failed to ${isEdit ? "update" : "create"} quote.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(id: number, active: boolean) {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: active } : q)));
    try {
      await updateQuoteOption(id, { is_active: active });
    } catch {
      setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: !active } : q)));
    }
  }

  // ── render ──

  if (!authChecked) return null;

  if (!hasToken) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>Sign in required</h2>
        <p style={{ fontSize: 13, color: C.t3, marginBottom: 18 }}>
          You need an admin or manager account to build fee quotes.
        </p>
        <Link href="/login" style={{ background: C.amber, color: "#fff", padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      color: C.t2, fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
      padding: "22px 20px 60px", background: "#f9fafb", minHeight: "100vh",
    }}>
      <style>{`
        @keyframes qc-spin { to { transform: rotate(360deg) } }
        input::placeholder, textarea::placeholder { color: ${C.t4}; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: "-0.02em", margin: 0 }}>
              {isEdit ? "Edit Fee Quote" : "Build a Fee Quote"}
            </h1>
            <p style={{ fontSize: 12.5, color: C.t4, margin: "4px 0 0" }}>
              {isEdit
                ? "Changes save to the same access code — the client's link keeps working."
                : "Configure billing options for a client and get a shareable code."}
            </p>
          </div>
          {isEdit && (
            <Link href="/feecalc/create" style={{ fontSize: 12.5, color: C.t3, textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 13px", background: C.bg }}>
              + New quote
            </Link>
          )}
        </div>

        {pageError && (
          <div style={{ background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, color: C.red }}>
            {pageError}
          </div>
        )}

        {loadingEdit ? (
          <Card><span style={{ fontSize: 13, color: C.t3 }}>Loading quote…</span></Card>
        ) : editError ? (
          <Card accent={C.red}><span style={{ fontSize: 13, color: C.t2 }}>{editError}</span></Card>
        ) : (
          <>
            {/* Org selector — hidden while editing (org is fixed to the quote) unless not yet resolved */}
            {loadingOrgs ? (
              <Card><span style={{ fontSize: 13, color: C.t3 }}>Loading your organisations…</span></Card>
            ) : orgs.length === 0 ? (
              <Card accent={C.red}>
                <span style={{ fontSize: 13, color: C.t2 }}>
                  You&apos;re not an admin or manager on any organisation, so you can&apos;t create quotes.
                </span>
              </Card>
            ) : !isEdit && orgs.length > 1 ? (
              <Card>
                <Label required>Organisation</Label>
                <select
                  value={orgId ?? ""}
                  onChange={(e) => setOrgId(e.target.value ? Number(e.target.value) : null)}
                  style={inputStyle}
                >
                  <option value="">Select organisation…</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Card>
            ) : isEdit && orgId ? (
              <Card>
                <Label>Organisation</Label>
                <div style={{ fontSize: 13.5, color: C.t2, fontWeight: 600 }}>
                  {orgs.find((o) => o.id === orgId)?.name ?? `Organisation #${orgId}`}
                </div>
              </Card>
            ) : null}

            {orgId && (
              <>
                {result && <ResultPanel quote={result} isEdit={isEdit} onCreateAnother={resetForm} />}

                {!result && (
                  <>
                    {loadingScoped && (
                      <Card><span style={{ fontSize: 13, color: C.t3 }}>Loading fee templates &amp; discount packages…</span></Card>
                    )}

                    {/* Basic info */}
                    <Card>
                      <SectionTitle>Basic info</SectionTitle>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <Label required>Quote name</Label>
                          <TextInput
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Residence at Kowdiar — Design Fee"
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <Label>Project</Label>
                            {projectsUnavailable ? (
                              <>
                                <TextInput
                                  type="number"
                                  value={manualProjectId}
                                  onChange={(e) => setManualProjectId(e.target.value)}
                                  placeholder="Project ID"
                                />
                                <div style={{ fontSize: 10, color: C.t4, marginTop: 4 }}>
                                  Couldn&apos;t load the project list — enter its ID directly for now.
                                </div>
                              </>
                            ) : (
                              <select
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                style={inputStyle}
                              >
                                <option value="">No project</option>
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div>
                            <Label>Discount package</Label>
                            <select
                              value={discountPackageId}
                              onChange={(e) => setDiscountPackageId(e.target.value)}
                              style={inputStyle}
                            >
                              <option value="">None</option>
                              {packages.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.activation_code ? `(${p.activation_code})` : "(open)"}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label>Terms &amp; Conditions (shown to client)</Label>
                          <TextArea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Plain text or Markdown — displayed on the public calculator."
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Toggle checked={isActive} onChange={setIsActive} color={C.green} />
                          <span style={{ fontSize: 12.5, color: C.t3 }}>
                            {isActive ? "Active — accessible via its code" : "Inactive — code will not resolve"}
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* Billing types */}
                    <Card>
                      <SectionTitle>Billing types to offer</SectionTitle>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <BillingOptionRow on={showQuantity} onToggle={setShowQuantity} color={C.amber} icon="⬡" title="Quantity × Rate">
                          {qtyTemplates.length === 0 ? (
                            <div style={{ fontSize: 12, color: C.t4 }}>
                              No active Quantity × Rate fee templates found for this organisation.
                            </div>
                          ) : (
                            <select value={quantityTemplateId} onChange={(e) => setQuantityTemplateId(e.target.value)} style={inputStyle}>
                              <option value="">Select fee template…</option>
                              {qtyTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} — {fmtCurrency(t.default_rate_per_unit, t.currency)}/{t.quantity_unit?.symbol ?? "unit"}
                                </option>
                              ))}
                            </select>
                          )}
                        </BillingOptionRow>

                        <BillingOptionRow on={showHourly} onToggle={setShowHourly} color={C.teal} icon="◷" title="Hourly Billing">
                          {hourlyTemplates.length === 0 ? (
                            <div style={{ fontSize: 12, color: C.t4 }}>
                              No active Hourly fee templates found for this organisation.
                            </div>
                          ) : (
                            <select value={hourlyTemplateId} onChange={(e) => setHourlyTemplateId(e.target.value)} style={inputStyle}>
                              <option value="">Select fee template…</option>
                              {hourlyTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} — {fmtCurrency(t.default_hourly_rate, t.currency)}/hr default
                                </option>
                              ))}
                            </select>
                          )}
                        </BillingOptionRow>

                        <BillingOptionRow on={showLumpsum} onToggle={setShowLumpsum} color={C.indigo} icon="◈" title="Lump-sum Quote">
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <div>
                                <Label required>Amount</Label>
                                <TextInput
                                  type="number" min="0" step="any"
                                  value={lumpsumAmount}
                                  onChange={(e) => setLumpsumAmount(e.target.value)}
                                  placeholder="e.g. 850000"
                                />
                              </div>
                              <div>
                                <Label>Label</Label>
                                <TextInput
                                  value={lumpsumLabel}
                                  onChange={(e) => setLumpsumLabel(e.target.value)}
                                  placeholder="Fixed Professional Fee"
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Note (optional)</Label>
                              <TextArea
                                rows={2}
                                value={lumpsumNote}
                                onChange={(e) => setLumpsumNote(e.target.value)}
                                placeholder="Shown below the amount on the public page."
                              />
                            </div>
                          </div>
                        </BillingOptionRow>
                      </div>
                    </Card>

                    {submitError && (
                      <div style={{ background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 9, padding: "10px 14px", fontSize: 12.5, color: C.red }}>
                        {submitError}
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{
                        background: C.amber, border: "none", borderRadius: 10, padding: "12px 18px",
                        color: "#fff", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: submitting ? 0.8 : 1,
                      }}
                    >
                      {submitting
                        ? (<><Spinner /> {isEdit ? "Saving…" : "Creating…"}</>)
                        : isEdit ? "Save changes" : "Create quote & generate code"}
                    </button>
                  </>
                )}

                {/* Existing quotes for this org */}
                {quotes.length > 0 && (
                  <Card>
                    <SectionTitle>Existing quotes in this organisation</SectionTitle>
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden" }}>
                      {quotes.map((q) => (
                        <QuoteListRow key={q.id} q={q} onToggleActive={handleToggleActive} />
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}