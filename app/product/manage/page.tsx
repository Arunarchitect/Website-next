"use client";

import "./page.css";
import { Fragment, useEffect, useState } from "react";
import {
  AdminProduct,
  ProductFormValues,
  DiscountTier,
  ProjectPricing,
  OrganisationPricing,
  AdminScope,
  getImageSource,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addDiscountTier,
  deleteDiscountTier,
  uploadIfcModel,
  deleteIfcModel,
  addProjectPricing,
  updateProjectPricing,
  deleteProjectPricing,
  addOrganisationPricing,
  updateOrganisationPricing,
  deleteOrganisationPricing,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  getAdminScope,
  setOrganisationNote,
  getApiErrorMessage,
} from "./productAdminApi";
import ProductEditPanel, {
  FileChooser,
  EMPTY_FORM,
  inputBase,
} from "./ProductEditPanel";

const EMPTY_ADMIN_SCOPE: AdminScope = { organisations: [], projects: [] };

type PricingMode = "percentage" | "fixed";

type ProjectPricingFormState = {
  project: string;
  mode: PricingMode;
  discount_percentage: string;
  discounted_price: string;
  notes: string;
};

const EMPTY_PROJECT_PRICING_FORM: ProjectPricingFormState = {
  project: "",
  mode: "percentage",
  discount_percentage: "",
  discounted_price: "",
  notes: "",
};

type OrgPricingFormState = {
  organisation: string;
  mode: PricingMode;
  discount_percentage: string;
  discounted_price: string;
};

const EMPTY_ORG_PRICING_FORM: OrgPricingFormState = {
  organisation: "",
  mode: "percentage",
  discount_percentage: "",
  discounted_price: "",
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

function isApiError(err: unknown): err is ApiError {
  return typeof err === "object" && err !== null && "response" in err;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) {
    return err.response?.data?.detail || fallback;
  }
  return fallback;
}

function statusBadgeClass(status: AdminProduct["status"]) {
  if (status === "approved") return "pm-badge pm-badge-approved";
  if (status === "rejected") return "pm-badge pm-badge-rejected";
  return "pm-badge pm-badge-pending";
}

export default function ProductManagePage() {
  const [view, setView] = useState<"catalog" | "pending">("catalog");

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [pending, setPending] = useState<AdminProduct[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [adminScope, setAdminScope] = useState<AdminScope>(EMPTY_ADMIN_SCOPE);
  const [scopeLoading, setScopeLoading] = useState(true);

  const [projectPricingModal, setProjectPricingModal] = useState<{ productId: string; editingId?: number } | null>(
    null
  );
  const [projectPricingForm, setProjectPricingForm] = useState<ProjectPricingFormState>(EMPTY_PROJECT_PRICING_FORM);
  const [projectPricingError, setProjectPricingError] = useState("");

  const [orgPricingModal, setOrgPricingModal] = useState<{ productId: string; editingId?: number } | null>(null);
  const [orgPricingForm, setOrgPricingForm] = useState<OrgPricingFormState>(EMPTY_ORG_PRICING_FORM);
  const [orgPricingError, setOrgPricingError] = useState("");

  const [orgNoteOrgId, setOrgNoteOrgId] = useState<string>("");
  const [orgNoteText, setOrgNoteText] = useState<string>("");
  const [orgNoteError, setOrgNoteError] = useState<string>("");
  const [orgNoteSaved, setOrgNoteSaved] = useState<string>("");

  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  function isBusy(key: string) {
    return busyKeys.has(key);
  }

  async function runExclusive(key: string, fn: () => Promise<void>) {
    if (busyKeys.has(key)) return;
    setBusyKeys((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function refresh() {
    setLoading(true);
    const data = await getAdminProducts(search || undefined);
    setProducts(data);
    if (editingId && editingId !== "new") {
      setEditingProduct(data.find((p) => p.id === editingId) ?? null);
    }
    setLoading(false);
  }

  async function refreshPending() {
    setLoadingPending(true);
    const data = await getPendingProducts();
    setPending(data);
    setLoadingPending(false);
  }

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (view === "pending") refreshPending();
  }, [view]);

  useEffect(() => {
    (async () => {
      setScopeLoading(true);
      try {
        const scope = await getAdminScope();
        setAdminScope(scope);
      } catch {
        setAdminScope(EMPTY_ADMIN_SCOPE);
      } finally {
        setScopeLoading(false);
      }
    })();
  }, []);

  // ─── Edit panel open/close ───────────────────────────────────────────

  function startEdit(p: AdminProduct) {
    setEditingId(p.id);
    setEditingProduct(p);
    setForm({
      space: p.space,
      category: p.category,
      item: p.item,
      manufacturer: p.manufacturer,
      model_label: p.model_label,
      base_price: p.base_price ?? "",
      currency: p.currency ?? "INR",
      cost_price: p.cost_price ?? "",
      product_link: p.product_link ?? "",
      product_image: null,
    });
  }

  function startNew() {
    setEditingId("new");
    setEditingProduct(null);
    setForm(EMPTY_FORM);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setOrgNoteOrgId("");
    setOrgNoteText("");
    setOrgNoteError("");
    setOrgNoteSaved("");
  }

  function openOrgNoteTabFor(p: AdminProduct) {
    const visibleNotes =
      p.organisation_notes?.filter((n) =>
        adminScope.organisations.some((o) => o.id === n.organisation)
      ) ?? [];
    const first = visibleNotes[0] ?? null;
    const fallbackOrg = adminScope.organisations[0]?.id ?? null;
    const selectedOrgId = first ? first.organisation : fallbackOrg;
    setOrgNoteOrgId(selectedOrgId ? String(selectedOrgId) : "");
    setOrgNoteText(first?.note ?? "");
    setOrgNoteError("");
    setOrgNoteSaved("");
  }

  // ─── Product save / delete ───────────────────────────────────────────

  async function handleSave() {
    const key = editingId === "new" ? "save-product-new" : `save-product-${editingId}`;
    await runExclusive(key, async () => {
      if (editingId === "new") {
        await createProduct(form);
        cancelEdit();
      } else if (editingId) {
        await updateProduct(editingId, form);
      }
      await refresh();
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product permanently?")) return;
    await runExclusive(`delete-product-${id}`, async () => {
      await deleteProduct(id);
      await refresh();
    });
  }

  // ─── Discount tiers / IFC ────────────────────────────────────────────

  async function handleAddTier(productId: string) {
    const tier_name = prompt("Tier name (e.g. Bulk 10+)");
    if (!tier_name) return;
    const min_quantity = Number(prompt("Min quantity") || "0");
    const max_quantity = Number(prompt("Max quantity") || "0");
    const discount_percentage = prompt("Discount %") || "0";
    await runExclusive(`add-tier-${productId}`, async () => {
      await addDiscountTier(productId, { tier_name, min_quantity, max_quantity, discount_percentage });
      await refresh();
    });
  }

  async function handleDeleteTier(tierId: number) {
    await runExclusive(`delete-tier-${tierId}`, async () => {
      await deleteDiscountTier(tierId);
      await refresh();
    });
  }

  async function handleUploadIfc(productId: string, file: File) {
    await runExclusive(`upload-ifc-${productId}`, async () => {
      await uploadIfcModel(productId, file);
      await refresh();
    });
  }

  async function handleDeleteIfc(ifcId: number) {
    await runExclusive(`delete-ifc-${ifcId}`, async () => {
      await deleteIfcModel(ifcId);
      await refresh();
    });
  }

  // ─── Project pricing ─────────────────────────────────────────────────

  function openProjectPricingModal(productId: string, existing?: ProjectPricing) {
    if (existing) {
      setProjectPricingForm({
        project: String(existing.project),
        mode: existing.discounted_price ? "fixed" : "percentage",
        discount_percentage: existing.discount_percentage ?? "",
        discounted_price: existing.discounted_price ?? "",
        notes: existing.notes ?? "",
      });
      setProjectPricingModal({ productId, editingId: existing.id });
    } else {
      setProjectPricingForm(EMPTY_PROJECT_PRICING_FORM);
      setProjectPricingModal({ productId });
    }
    setProjectPricingError("");
  }

  function closeProjectPricingModal() {
    setProjectPricingModal(null);
    setProjectPricingError("");
  }

  async function submitProjectPricing() {
    if (!projectPricingModal) return;
    if (!projectPricingForm.project) {
      setProjectPricingError("Choose a project.");
      return;
    }
    const value =
      projectPricingForm.mode === "percentage"
        ? projectPricingForm.discount_percentage
        : projectPricingForm.discounted_price;
    if (!value) {
      setProjectPricingError(
        projectPricingForm.mode === "percentage" ? "Enter a discount %." : "Enter a fixed price."
      );
      return;
    }

    const { productId, editingId: editingPricingId } = projectPricingModal;
    const key = editingPricingId ? `edit-pp-${editingPricingId}` : `add-pp-${productId}`;

    await runExclusive(key, async () => {
      setProjectPricingError("");
      try {
        const projectId = Number(projectPricingForm.project);
        const payload = {
          discount_percentage: projectPricingForm.mode === "percentage" ? projectPricingForm.discount_percentage : null,
          discounted_price: projectPricingForm.mode === "fixed" ? projectPricingForm.discounted_price : null,
          notes: projectPricingForm.notes || null,
        };
        if (editingPricingId) {
          await updateProjectPricing(editingPricingId, projectId, payload);
        } else {
          await addProjectPricing(productId, projectId, payload);
        }
        closeProjectPricingModal();
        await refresh();
      } catch (err: unknown) {
        setProjectPricingError(
          getErrorMessage(err, editingPricingId ? "Couldn't save project pricing." : "Couldn't add project pricing.")
        );
      }
    });
  }

  async function handleDeleteProjectPricing(id: number) {
    await runExclusive(`delete-pp-${id}`, async () => {
      await deleteProjectPricing(id);
      await refresh();
    });
  }

  // ─── Organisation pricing ────────────────────────────────────────────

  function openOrgPricingModal(productId: string, existing?: OrganisationPricing) {
    if (existing) {
      setOrgPricingForm({
        organisation: String(existing.organisation),
        mode: existing.discounted_price ? "fixed" : "percentage",
        discount_percentage: existing.discount_percentage ?? "",
        discounted_price: existing.discounted_price ?? "",
      });
      setOrgPricingModal({ productId, editingId: existing.id });
    } else {
      setOrgPricingForm(EMPTY_ORG_PRICING_FORM);
      setOrgPricingModal({ productId });
    }
    setOrgPricingError("");
  }

  function closeOrgPricingModal() {
    setOrgPricingModal(null);
    setOrgPricingError("");
  }

  async function submitOrgPricing() {
    if (!orgPricingModal) return;
    if (!orgPricingForm.organisation) {
      setOrgPricingError("Choose an organisation.");
      return;
    }
    const value =
      orgPricingForm.mode === "percentage" ? orgPricingForm.discount_percentage : orgPricingForm.discounted_price;
    if (!value) {
      setOrgPricingError(orgPricingForm.mode === "percentage" ? "Enter a discount %." : "Enter a fixed price.");
      return;
    }

    const { productId, editingId: editingPricingId } = orgPricingModal;
    const key = editingPricingId ? `edit-op-${editingPricingId}` : `add-op-${productId}`;

    await runExclusive(key, async () => {
      setOrgPricingError("");
      try {
        const organisationId = Number(orgPricingForm.organisation);
        const payload = {
          discount_percentage: orgPricingForm.mode === "percentage" ? orgPricingForm.discount_percentage : null,
          discounted_price: orgPricingForm.mode === "fixed" ? orgPricingForm.discounted_price : null,
        };
        if (editingPricingId) {
          await updateOrganisationPricing(editingPricingId, organisationId, payload);
        } else {
          await addOrganisationPricing(productId, organisationId, payload);
        }
        closeOrgPricingModal();
        await refresh();
      } catch (err: unknown) {
        setOrgPricingError(
          getErrorMessage(
            err,
            editingPricingId ? "Couldn't save organisation pricing." : "Couldn't add organisation pricing."
          )
        );
      }
    });
  }

  async function handleDeleteOrgPricing(id: number) {
    await runExclusive(`delete-op-${id}`, async () => {
      await deleteOrganisationPricing(id);
      await refresh();
    });
  }

  // ─── Organisation catalog notes ──────────────────────────────────────

  async function submitOrgNote() {
    if (!editingProduct) return;
    if (!orgNoteOrgId) {
      setOrgNoteError("Choose an organisation.");
      return;
    }
    const key = `org-note-${editingProduct.id}-${orgNoteOrgId}`;
    await runExclusive(key, async () => {
      setOrgNoteError("");
      setOrgNoteSaved("");
      try {
        await setOrganisationNote(editingProduct.id, Number(orgNoteOrgId), orgNoteText);
        setOrgNoteSaved(orgNoteText.trim() ? "Note saved." : "Note cleared.");
        await refresh();
      } catch (err: unknown) {
        setOrgNoteError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't save the organisation note."
        );
      }
    });
  }

  // ─── Pending review ──────────────────────────────────────────────────

  async function handleApprove(id: string) {
    await runExclusive(`approve-${id}`, async () => {
      try {
        await approveProduct(id);
        await refreshPending();
        if (view === "catalog") await refresh();
      } catch (err: unknown) {
        alert(getApiErrorMessage(err, "Couldn't approve this product."));
      }
    });
  }

  async function handleReject(id: string) {
    const rejection_reason = prompt("Reason for rejecting this suggestion:");
    if (!rejection_reason) return;
    await runExclusive(`reject-${id}`, async () => {
      try {
        await rejectProduct(id, rejection_reason);
        await refreshPending();
        if (view === "catalog") await refresh();
      } catch (err: unknown) {
        alert(getApiErrorMessage(err, "Couldn't reject this product."));
      }
    });
  }

  // ─── Row components ──────────────────────────────────────────────────

  function ProductRowActions({ p }: { p: AdminProduct }) {
    const deleteKey = `delete-product-${p.id}`;
    return (
      <>
        <button
          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
          className="text-xs text-[#2F6E62] underline"
        >
          {expandedId === p.id ? "Hide" : "Details"}
        </button>
        <button onClick={() => startEdit(p)} className="text-xs text-[#2F6E62] underline">
          Edit
        </button>
        <button
          onClick={() => {
            startEdit(p);
            openOrgNoteTabFor(p);
          }}
          className="text-xs text-[#2F6E62] underline"
        >
          Org note
        </button>
        <button
          onClick={() => handleDelete(p.id)}
          disabled={isBusy(deleteKey)}
          className="text-xs text-red-600 underline disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBusy(deleteKey) ? "Deleting…" : "Delete"}
        </button>
      </>
    );
  }

  function ProductDetailsPanel({ p }: { p: AdminProduct }) {
    const addTierKey = `add-tier-${p.id}`;
    const uploadIfcKey = `upload-ifc-${p.id}`;
    return (
      <>
        {p.status === "rejected" && p.rejection_reason && (
          <p className="text-xs text-red-600">Rejected: {p.rejection_reason}</p>
        )}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#4B5650]">Discount tiers</span>
            <button
              onClick={() => handleAddTier(p.id)}
              disabled={isBusy(addTierKey)}
              className="text-xs text-[#2F6E62] underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBusy(addTierKey) ? "Adding…" : "+ Add tier"}
            </button>
          </div>
          {p.discount_tiers.length === 0 ? (
            <p className="text-xs text-[#8A938E]">None</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.discount_tiers.map((t: DiscountTier) => {
                const deleteKey = `delete-tier-${t.id}`;
                return (
                  <span
                    key={t.id}
                    className="text-xs bg-white border border-[#DCE0D8] rounded-full px-3 py-1 flex items-center gap-2"
                  >
                    {t.tier_name} ({t.min_quantity}-{t.max_quantity}: {t.discount_percentage}%)
                    <button
                      onClick={() => handleDeleteTier(t.id)}
                      disabled={isBusy(deleteKey)}
                      className="text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isBusy(deleteKey) ? "…" : "×"}
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-medium text-[#4B5650]">IFC model file</span>
          {p.ifc_model ? (
            <div className="text-xs mt-1 flex items-center gap-3 flex-wrap">
              <a
                href={getImageSource(p.ifc_model.file)}
                target="_blank"
                className="text-[#2F6E62] underline"
              >
                {p.ifc_model.file_name}
              </a>
              <span className="text-[#8A938E]">{p.ifc_model.file_size_mb} MB</span>
              <button
                onClick={() => handleDeleteIfc(p.ifc_model!.id)}
                disabled={isBusy(`delete-ifc-${p.ifc_model!.id}`)}
                className="text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isBusy(`delete-ifc-${p.ifc_model!.id}`) ? "Removing…" : "Remove"}
              </button>
            </div>
          ) : (
            <div className="mt-1">
              <FileChooser
                id={`ifc-input-${p.id}`}
                accept=".ifc,.ifczip,.ifcxml"
                disabled={isBusy(uploadIfcKey)}
                placeholder={isBusy(uploadIfcKey) ? "Uploading…" : "Choose IFC file"}
                hint="or paste with Ctrl+V"
                variant="file"
                onFileSelected={(file) => handleUploadIfc(p.id, file)}
              />
            </div>
          )}
        </div>
      </>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="pm-page min-h-screen bg-[#F5F6F3] text-[#1C2521] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-[#6B7570]">Modelflick</p>
            <h1 className="text-xl sm:text-2xl font-semibold">Product management</h1>
          </div>
          <div className="pm-header-actions">
            <div className="flex bg-white border border-[#DCE0D8] rounded-full p-1">
              <button
                onClick={() => setView("catalog")}
                className={`text-sm px-4 py-1.5 rounded-full transition-colors ${
                  view === "catalog" ? "bg-[#1C2521] text-white" : "text-[#6B7570]"
                }`}
              >
                Catalog
              </button>
              <button
                onClick={() => setView("pending")}
                className={`text-sm px-4 py-1.5 rounded-full transition-colors relative ${
                  view === "pending" ? "bg-[#1C2521] text-white" : "text-[#6B7570]"
                }`}
              >
                Pending suggestions
                {pending.length > 0 && (
                  <span className="ml-2 text-[10px] bg-[#B8802F] text-white rounded-full px-1.5 py-0.5">
                    {pending.length}
                  </span>
                )}
              </button>
            </div>
            {view === "catalog" && (
              <button
                onClick={startNew}
                className="bg-[#1C2521] text-white text-sm rounded-full px-5 py-2.5"
              >
                + Add product
              </button>
            )}
          </div>
        </header>

        {view === "pending" ? (
          <div className="bg-white border border-[#DCE0D8] rounded-2xl overflow-hidden">
            {loadingPending ? (
              <div className="p-10 text-center text-sm text-[#6B7570]">Loading…</div>
            ) : pending.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#6B7570]">
                No pending suggestions from your organisation&apos;s clients right now.
              </div>
            ) : (
              <div className="divide-y divide-[#EDEFEA]">
                {pending.map((p) => {
                  const approveKey = `approve-${p.id}`;
                  const rejectKey = `reject-${p.id}`;
                  const anyBusy = isBusy(approveKey) || isBusy(rejectKey);
                  return (
                    <div
                      key={p.id}
                      className="flex items-start gap-4 px-4 sm:px-5 py-4 flex-wrap sm:flex-nowrap"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageSource(p.product_image)}
                        alt={p.item}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{p.item}</span>
                          <span className={statusBadgeClass(p.status)}>{p.status}</span>
                        </div>
                        <p className="text-sm text-[#6B7570]">
                          {p.manufacturer} — {p.model_label} · {p.category}
                        </p>
                        <p className="text-xs text-[#8A938E] mt-0.5">
                          Space: {p.space}
                          {p.base_price ? ` · ${p.currency} ${p.base_price}` : ""}
                        </p>
                        {p.product_link && (
                          <a href={p.product_link} target="_blank" className="text-xs text-[#2F6E62] underline">
                            Product link
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => handleApprove(p.id)}
                          disabled={anyBusy}
                          className="text-xs bg-[#2F6E62] text-white rounded-full px-4 py-2 disabled:opacity-50 flex-1 sm:flex-none"
                        >
                          {isBusy(approveKey) ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleReject(p.id)}
                          disabled={anyBusy}
                          className="text-xs border border-red-200 text-red-600 rounded-full px-4 py-2 disabled:opacity-50 flex-1 sm:flex-none"
                        >
                          {isBusy(rejectKey) ? "…" : "Reject"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search manufacturer, item, model…"
              className="w-full max-w-md px-4 py-2 rounded-full border border-[#DCE0D8] bg-white text-sm"
            />

            {editingId && (
              <ProductEditPanel
                editingId={editingId}
                editingProduct={editingProduct}
                form={form}
                setForm={setForm}
                adminScope={adminScope}
                scopeLoading={scopeLoading}
                isBusy={isBusy}
                onCancel={cancelEdit}
                onSave={handleSave}
                onOpenProjectPricing={openProjectPricingModal}
                onOpenOrgPricing={openOrgPricingModal}
                onDeleteProjectPricing={handleDeleteProjectPricing}
                onDeleteOrgPricing={handleDeleteOrgPricing}
                orgNoteOrgId={orgNoteOrgId}
                setOrgNoteOrgId={setOrgNoteOrgId}
                orgNoteText={orgNoteText}
                setOrgNoteText={setOrgNoteText}
                orgNoteError={orgNoteError}
                orgNoteSaved={orgNoteSaved}
                onSubmitOrgNote={submitOrgNote}
              />
            )}

            <div className="bg-white border border-[#DCE0D8] rounded-2xl overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-sm text-[#6B7570]">Loading…</div>
              ) : products.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#6B7570]">No products found.</div>
              ) : (
                <>
                  <div className="pm-table-wrap overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5F6F3] text-left text-[#6B7570]">
                        <tr>
                          <th className="px-4 py-3"></th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Manufacturer / Model</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Price</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <Fragment key={p.id}>
                            <tr className="border-t border-[#EDEFEA]">
                              <td className="px-4 py-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getImageSource(p.product_image)}
                                  alt={p.item}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              </td>
                              <td className="px-4 py-3">{p.item}</td>
                              <td className="px-4 py-3">
                                {p.manufacturer} — {p.model_label}
                              </td>
                              <td className="px-4 py-3 text-xs">{p.category}</td>
                              <td className="px-4 py-3">
                                <span className={statusBadgeClass(p.status)}>{p.status}</span>
                              </td>
                              <td className="px-4 py-3">
                                {p.base_price ? `${p.currency} ${p.base_price}` : "—"}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                                <ProductRowActions p={p} />
                              </td>
                            </tr>
                            {expandedId === p.id && (
                              <tr className="bg-[#F9FAF8] border-t border-[#EDEFEA]">
                                <td colSpan={7} className="px-6 py-4 space-y-4">
                                  <ProductDetailsPanel p={p} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pm-card-list">
                    {products.map((p) => (
                      <div key={p.id} className="pm-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getImageSource(p.product_image)}
                          alt={p.item}
                          className="pm-card-thumb"
                        />
                        <div className="pm-card-body">
                          <div className="pm-card-title-row">
                            <span className="font-medium">{p.item}</span>
                            <span className={statusBadgeClass(p.status)}>{p.status}</span>
                          </div>
                          <p className="pm-card-meta">
                            {p.manufacturer} — {p.model_label} · {p.category}
                          </p>
                          <p className="pm-card-meta">
                            {p.base_price ? `${p.currency} ${p.base_price}` : "No price set"}
                          </p>
                          <div className="pm-card-actions">
                            <ProductRowActions p={p} />
                          </div>
                          {expandedId === p.id && (
                            <div className="pm-card-details">
                              <ProductDetailsPanel p={p} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {projectPricingModal &&
        (() => {
          const isEdit = !!projectPricingModal.editingId;
          const submitKey = isEdit
            ? `edit-pp-${projectPricingModal.editingId}`
            : `add-pp-${projectPricingModal.productId}`;
          const submitting = isBusy(submitKey);
          return (
            <div
              className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={submitting ? undefined : closeProjectPricingModal}
            >
              <div
                className="pm-modal-scroll bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">
                  {isEdit ? "Edit project pricing" : "Add project pricing"}
                </h3>

                {projectPricingError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">
                    {projectPricingError}
                  </div>
                )}

                <label className="flex flex-col gap-1 text-sm mb-3">
                  Project
                  <select
                    value={projectPricingForm.project}
                    onChange={(e) =>
                      setProjectPricingForm({ ...projectPricingForm, project: e.target.value })
                    }
                    disabled={submitting}
                    className={inputBase}
                  >
                    <option value="">Select a project…</option>
                    {adminScope.projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.organisation_name})
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-gray-400 -mt-2 mb-3">
                  Only projects under organisations you administer are listed.
                </p>

                <div className="pm-segmented mb-3">
                  <button
                    type="button"
                    data-active={projectPricingForm.mode === "percentage"}
                    disabled={submitting}
                    onClick={() => setProjectPricingForm({ ...projectPricingForm, mode: "percentage" })}
                  >
                    Discount %
                  </button>
                  <button
                    type="button"
                    data-active={projectPricingForm.mode === "fixed"}
                    disabled={submitting}
                    onClick={() => setProjectPricingForm({ ...projectPricingForm, mode: "fixed" })}
                  >
                    Fixed price
                  </button>
                </div>

                {projectPricingForm.mode === "percentage" ? (
                  <label className="flex flex-col gap-1 text-sm mb-3">
                    Discount percentage
                    <input
                      type="number"
                      value={projectPricingForm.discount_percentage}
                      onChange={(e) =>
                        setProjectPricingForm({ ...projectPricingForm, discount_percentage: e.target.value })
                      }
                      disabled={submitting}
                      className={inputBase}
                      placeholder="e.g. 10"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-sm mb-3">
                    Fixed discounted price
                    <input
                      type="number"
                      value={projectPricingForm.discounted_price}
                      onChange={(e) =>
                        setProjectPricingForm({ ...projectPricingForm, discounted_price: e.target.value })
                      }
                      disabled={submitting}
                      className={inputBase}
                      placeholder="e.g. 9500"
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1 text-sm mb-4">
                  Notes (optional)
                  <input
                    value={projectPricingForm.notes}
                    onChange={(e) =>
                      setProjectPricingForm({ ...projectPricingForm, notes: e.target.value })
                    }
                    disabled={submitting}
                    className={inputBase}
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeProjectPricingModal}
                    disabled={submitting}
                    className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitProjectPricing}
                    disabled={submitting}
                    className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : isEdit ? "Save changes" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {orgPricingModal &&
        (() => {
          const isEdit = !!orgPricingModal.editingId;
          const submitKey = isEdit ? `edit-op-${orgPricingModal.editingId}` : `add-op-${orgPricingModal.productId}`;
          const submitting = isBusy(submitKey);
          return (
            <div
              className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
              onClick={submitting ? undefined : closeOrgPricingModal}
            >
              <div
                className="pm-modal-scroll bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">
                  {isEdit ? "Edit organisation pricing" : "Add organisation pricing"}
                </h3>

                {orgPricingError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">
                    {orgPricingError}
                  </div>
                )}

                <label className="flex flex-col gap-1 text-sm mb-3">
                  Organisation
                  <select
                    value={orgPricingForm.organisation}
                    onChange={(e) =>
                      setOrgPricingForm({ ...orgPricingForm, organisation: e.target.value })
                    }
                    disabled={submitting}
                    className={inputBase}
                  >
                    <option value="">Select an organisation…</option>
                    {adminScope.organisations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-gray-400 -mt-2 mb-3">
                  Only organisations you administer are listed.
                </p>

                <div className="pm-segmented mb-3">
                  <button
                    type="button"
                    data-active={orgPricingForm.mode === "percentage"}
                    disabled={submitting}
                    onClick={() => setOrgPricingForm({ ...orgPricingForm, mode: "percentage" })}
                  >
                    Discount %
                  </button>
                  <button
                    type="button"
                    data-active={orgPricingForm.mode === "fixed"}
                    disabled={submitting}
                    onClick={() => setOrgPricingForm({ ...orgPricingForm, mode: "fixed" })}
                  >
                    Fixed price
                  </button>
                </div>

                {orgPricingForm.mode === "percentage" ? (
                  <label className="flex flex-col gap-1 text-sm mb-4">
                    Discount percentage
                    <input
                      type="number"
                      value={orgPricingForm.discount_percentage}
                      onChange={(e) =>
                        setOrgPricingForm({ ...orgPricingForm, discount_percentage: e.target.value })
                      }
                      disabled={submitting}
                      className={inputBase}
                      placeholder="e.g. 10"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-sm mb-4">
                    Fixed discounted price
                    <input
                      type="number"
                      value={orgPricingForm.discounted_price}
                      onChange={(e) =>
                        setOrgPricingForm({ ...orgPricingForm, discounted_price: e.target.value })
                      }
                      disabled={submitting}
                      className={inputBase}
                      placeholder="e.g. 9500"
                    />
                  </label>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeOrgPricingModal}
                    disabled={submitting}
                    className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitOrgPricing}
                    disabled={submitting}
                    className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : isEdit ? "Save changes" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}