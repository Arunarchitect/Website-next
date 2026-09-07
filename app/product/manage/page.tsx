"use client";

import "./page.css";
import { Fragment, useEffect, useRef, useState } from "react";
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
} from "./productAdminApi";
import { CATEGORIES } from "../productApi";

const EMPTY_FORM: ProductFormValues = {
  space: "",
  category: CATEGORIES[0].id,
  item: "",
  manufacturer: "",
  model_label: "",
  base_price: "",
  currency: "INR",
  cost_price: "",
  product_link: "",
  product_image: null,
};

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

// Shape of the error payloads our API returns on failure. Kept loose
// (all optional) since different endpoints surface different fields.
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

// ─── Styled file chooser ───────────────────────────────────────────────
// Wraps a hidden native <input type="file"> with a nicer pill button +
// filename/thumbnail preview. Also listens for paste (Ctrl+V) so a file
// copied from the OS file explorer, or an image copied from anywhere,
// can be dropped in without opening the browse dialog.
type FileChooserProps = {
  id: string;
  accept: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
  file?: File | null;
  existingPreviewUrl?: string | null;
  placeholder: string;
  hint?: string;
  variant?: "image" | "file";
};

function FileChooser({
  id,
  accept,
  disabled,
  onFileSelected,
  file,
  existingPreviewUrl,
  placeholder,
  hint = "or paste with Ctrl+V",
  variant = "file",
}: FileChooserProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "image" || !file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, variant]);

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const pasted = item.getAsFile();
        if (pasted) {
          onFileSelected(pasted);
          e.preventDefault();
          break;
        }
      }
    }
  }

  const previewSrc = variant === "image" ? objectUrl || existingPreviewUrl || null : null;

  return (
    <div
      className={`pm-file-chooser${focused ? " pm-file-chooser-focused" : ""}${
        disabled ? " pm-file-chooser-disabled" : ""
      }`}
      tabIndex={disabled ? -1 : 0}
      onPaste={handlePaste}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {variant === "image" && (
        <div className="pm-file-thumb-wrap">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="" className="pm-file-thumb" />
          ) : (
            <span className="pm-file-thumb-placeholder">No image</span>
          )}
        </div>
      )}
      <div className="pm-file-chooser-main">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="pm-file-button"
        >
          {placeholder}
        </button>
        <span className="pm-file-name">{file ? file.name : "No file chosen"}</span>
        <span className="pm-file-hint">{hint}</span>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="pm-file-input-hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onFileSelected(selected);
          e.target.value = "";
        }}
      />
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<"details" | "pricing">("details");
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Orgs/projects the logged-in user actually administers — populates the
  // pricing dropdowns below, AND is used to hide any pricing row that
  // belongs to an organisation/project the user does not administer. Those
  // rows are neither shown nor editable to a non-admin viewer.
  const [adminScope, setAdminScope] = useState<AdminScope>(EMPTY_ADMIN_SCOPE);
  const [scopeLoading, setScopeLoading] = useState(true);

  // Project pricing modal — editingId set means "editing this existing row"
  // rather than creating a new one.
  const [projectPricingModal, setProjectPricingModal] = useState<{ productId: string; editingId?: number } | null>(
    null
  );
  const [projectPricingForm, setProjectPricingForm] = useState<ProjectPricingFormState>(EMPTY_PROJECT_PRICING_FORM);
  const [projectPricingError, setProjectPricingError] = useState("");

  // Organisation pricing modal — same edit/create split as above.
  const [orgPricingModal, setOrgPricingModal] = useState<{ productId: string; editingId?: number } | null>(null);
  const [orgPricingForm, setOrgPricingForm] = useState<OrgPricingFormState>(EMPTY_ORG_PRICING_FORM);
  const [orgPricingError, setOrgPricingError] = useState("");

  // ─── Click-guard ──────────────────────────────────────────────────────
  // Every button that triggers a network call is keyed by a unique string
  // (e.g. `delete-pp-14`, `save-28a6...`). While that key is "busy" the
  // button that owns it is disabled, so a slow request or an impatient
  // double-click can never fire the same action twice, and unrelated
  // buttons stay usable. runExclusive() is the single choke point: it
  // ignores a call if the key is already running, and always clears the
  // key in a `finally` so a thrown/rejected request can't leave a button
  // stuck disabled forever.
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

  function startEdit(p: AdminProduct) {
    setEditingId(p.id);
    setEditingProduct(p);
    setActiveTab("details");
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
    setActiveTab("details");
    setForm(EMPTY_FORM);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingProduct(null);
    setActiveTab("details");
    setForm(EMPTY_FORM);
  }

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

  // ─── Project pricing (dropdown modal, scoped to admin's own orgs) ────
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

  // ─── Organisation pricing (dropdown modal, scoped to admin's own orgs) ─
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
    const value = orgPricingForm.mode === "percentage" ? orgPricingForm.discount_percentage : orgPricingForm.discounted_price;
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
          getErrorMessage(err, editingPricingId ? "Couldn't save organisation pricing." : "Couldn't add organisation pricing.")
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

  async function handleApprove(id: string) {
    await runExclusive(`approve-${id}`, async () => {
      try {
        await approveProduct(id);
        await refreshPending();
        if (view === "catalog") await refresh();
      } catch (err: unknown) {
        alert(getErrorMessage(err, "Couldn't approve this product."));
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
        alert(getErrorMessage(err, "Couldn't reject this product."));
      }
    });
  }

  const inputBase = "w-full border border-[#DCE0D8] rounded-lg px-3 py-2 text-sm";

  // Shared row-action buttons, used by both the desktop table and mobile cards.
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
          onClick={() => handleDelete(p.id)}
          disabled={isBusy(deleteKey)}
          className="text-xs text-red-600 underline disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isBusy(deleteKey) ? "Deleting…" : "Delete"}
        </button>
      </>
    );
  }

  // Shared expanded-details panel (discount tiers + IFC model), used by
  // both the desktop table row and the mobile card.
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
                  <span key={t.id} className="text-xs bg-white border border-[#DCE0D8] rounded-full px-3 py-1 flex items-center gap-2">
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
              <a href={getImageSource(p.ifc_model.file)} target="_blank" className="text-[#2F6E62] underline">
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
                    <div key={p.id} className="flex items-start gap-4 px-4 sm:px-5 py-4 flex-wrap sm:flex-nowrap">
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
              <div className="border border-[#DCE0D8] bg-white rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-medium">{editingId === "new" ? "New product" : "Edit product"}</h2>

                <div className="flex gap-2 border-b border-[#EDEFEA] overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`text-sm px-3 py-2 border-b-2 -mb-px whitespace-nowrap ${
                      activeTab === "details" ? "border-[#2F6E62] text-[#2F6E62] font-medium" : "border-transparent text-[#6B7570]"
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab("pricing")}
                    disabled={editingId === "new"}
                    title={editingId === "new" ? "Save the product first" : undefined}
                    className={`text-sm px-3 py-2 border-b-2 -mb-px whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                      activeTab === "pricing" ? "border-[#2F6E62] text-[#2F6E62] font-medium" : "border-transparent text-[#6B7570]"
                    }`}
                  >
                    Project / Org pricing
                  </button>
                </div>

                {activeTab === "details" && (() => {
                  const saveKey = editingId === "new" ? "save-product-new" : `save-product-${editingId}`;
                  const saving = isBusy(saveKey);
                  return (
                    <>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1 text-sm">
                          Space (IfcSpace name/GUID)
                          <input
                            value={form.space}
                            onChange={(e) => setForm({ ...form, space: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Category
                          <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Item
                          <input
                            value={form.item}
                            onChange={(e) => setForm({ ...form, item: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Manufacturer
                          <input
                            value={form.manufacturer}
                            onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Model
                          <input
                            value={form.model_label}
                            onChange={(e) => setForm({ ...form, model_label: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Base price
                          <input
                            type="number"
                            value={form.base_price}
                            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Currency
                          <select
                            value={form.currency}
                            onChange={(e) => setForm({ ...form, currency: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          >
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Cost price
                          <input
                            type="number"
                            value={form.cost_price}
                            onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          Product link
                          <input
                            value={form.product_link}
                            onChange={(e) => setForm({ ...form, product_link: e.target.value })}
                            className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                          />
                        </label>
                        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
                          <span>Product image</span>
                          <FileChooser
                            id="product-image-input"
                            accept="image/*"
                            variant="image"
                            placeholder="Choose image"
                            hint="or paste with Ctrl+V"
                            file={form.product_image}
                            existingPreviewUrl={editingProduct ? getImageSource(editingProduct.product_image) : null}
                            onFileSelected={(file) => setForm({ ...form, product_image: file })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  );
                })()}

                {activeTab === "pricing" && editingProduct && (() => {
                  // Only show pricing rows for orgs/projects this user
                  // actually administers — rows belonging to other
                  // organisations are hidden entirely, not just locked.
                  const visibleProjectPricing = editingProduct.project_pricing_rules.filter((pp) =>
                    adminScope.projects.some((proj) => proj.id === pp.project)
                  );
                  const visibleOrgPricing = editingProduct.organisation_pricing_rules.filter((op) =>
                    adminScope.organisations.some((org) => org.id === op.organisation)
                  );
                  const hiddenProjectCount = editingProduct.project_pricing_rules.length - visibleProjectPricing.length;
                  const hiddenOrgCount = editingProduct.organisation_pricing_rules.length - visibleOrgPricing.length;

                  return (
                    <div className="space-y-6">
                      {!scopeLoading && adminScope.organisations.length === 0 && (
                        <div className="pm-scope-warning">
                          You don&apos;t administer any organisation yet, so there&apos;s nothing to attach project or
                          organisation pricing to.
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Project pricing overrides</span>
                          <button
                            onClick={() => openProjectPricingModal(editingProduct.id)}
                            disabled={adminScope.projects.length === 0}
                            className="text-xs text-[#2F6E62] underline disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + Add
                          </button>
                        </div>
                        {visibleProjectPricing.length === 0 ? (
                          <p className="text-xs text-[#8A938E]">
                            None — base_price applies unless overridden here.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {visibleProjectPricing.map((pp: ProjectPricing) => {
                              const projectMeta = adminScope.projects.find((proj) => proj.id === pp.project);
                              const editKey = `edit-pp-${pp.id}`;
                              const deleteKey = `delete-pp-${pp.id}`;
                              const rowBusy = isBusy(editKey) || isBusy(deleteKey);
                              return (
                                <div key={pp.id} className="pm-rule-chip">
                                  <span>
                                    {projectMeta ? projectMeta.name : `Project #${pp.project}`} —{" "}
                                    {pp.discounted_price ? `fixed ${pp.discounted_price}` : `${pp.discount_percentage}% off`}
                                    {pp.notes ? ` · ${pp.notes}` : ""}
                                  </span>
                                  <span className="pm-rule-actions">
                                    <button
                                      onClick={() => openProjectPricingModal(editingProduct.id, pp)}
                                      disabled={rowBusy}
                                      className="text-[#2F6E62] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProjectPricing(pp.id)}
                                      disabled={rowBusy}
                                      className="text-red-500 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {isBusy(deleteKey) ? "Removing…" : "Remove"}
                                    </button>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hiddenProjectCount > 0 && (
                          <p className="text-[11px] text-[#8A938E] mt-1">
                            {hiddenProjectCount} more rule{hiddenProjectCount > 1 ? "s" : ""} exist for projects you
                            don&apos;t administer and aren&apos;t shown here.
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Organisation pricing overrides</span>
                          <button
                            onClick={() => openOrgPricingModal(editingProduct.id)}
                            disabled={adminScope.organisations.length === 0}
                            className="text-xs text-[#2F6E62] underline disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + Add
                          </button>
                        </div>
                        {visibleOrgPricing.length === 0 ? (
                          <p className="text-xs text-[#8A938E]">None.</p>
                        ) : (
                          <div className="space-y-2">
                            {visibleOrgPricing.map((op: OrganisationPricing) => {
                              const orgMeta = adminScope.organisations.find((o) => o.id === op.organisation);
                              const editKey = `edit-op-${op.id}`;
                              const deleteKey = `delete-op-${op.id}`;
                              const rowBusy = isBusy(editKey) || isBusy(deleteKey);
                              return (
                                <div key={op.id} className="pm-rule-chip">
                                  <span>
                                    {orgMeta ? orgMeta.name : `Org #${op.organisation}`} —{" "}
                                    {op.discounted_price ? `fixed ${op.discounted_price}` : `${op.discount_percentage}% off`}
                                    {!op.is_active && " (inactive)"}
                                  </span>
                                  <span className="pm-rule-actions">
                                    <button
                                      onClick={() => openOrgPricingModal(editingProduct.id, op)}
                                      disabled={rowBusy}
                                      className="text-[#2F6E62] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteOrgPricing(op.id)}
                                      disabled={rowBusy}
                                      className="text-red-500 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {isBusy(deleteKey) ? "Removing…" : "Remove"}
                                    </button>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hiddenOrgCount > 0 && (
                          <p className="text-[11px] text-[#8A938E] mt-1">
                            {hiddenOrgCount} more rule{hiddenOrgCount > 1 ? "s" : ""} exist for organisations you
                            don&apos;t administer and aren&apos;t shown here.
                          </p>
                        )}
                      </div>

                      <button onClick={cancelEdit} className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5">
                        Close
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="bg-white border border-[#DCE0D8] rounded-2xl overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-sm text-[#6B7570]">Loading…</div>
              ) : products.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#6B7570]">No products found.</div>
              ) : (
                <>
                  {/* ─── Desktop table (>=768px) ─── */}
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
                                <img src={getImageSource(p.product_image)} alt={p.item} className="w-10 h-10 rounded-lg object-cover" />
                              </td>
                              <td className="px-4 py-3">{p.item}</td>
                              <td className="px-4 py-3">{p.manufacturer} — {p.model_label}</td>
                              <td className="px-4 py-3 text-xs">{p.category}</td>
                              <td className="px-4 py-3">
                                <span className={statusBadgeClass(p.status)}>{p.status}</span>
                              </td>
                              <td className="px-4 py-3">{p.base_price ? `${p.currency} ${p.base_price}` : "—"}</td>
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

                  {/* ─── Mobile cards (<768px) ─── */}
                  <div className="pm-card-list">
                    {products.map((p) => (
                      <div key={p.id} className="pm-card">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getImageSource(p.product_image)} alt={p.item} className="pm-card-thumb" />
                        <div className="pm-card-body">
                          <div className="pm-card-title-row">
                            <span className="font-medium">{p.item}</span>
                            <span className={statusBadgeClass(p.status)}>{p.status}</span>
                          </div>
                          <p className="pm-card-meta">{p.manufacturer} — {p.model_label} · {p.category}</p>
                          <p className="pm-card-meta">{p.base_price ? `${p.currency} ${p.base_price}` : "No price set"}</p>
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

      {/* ─── Add / Edit Project Pricing modal ─── */}
      {projectPricingModal && (() => {
        const isEdit = !!projectPricingModal.editingId;
        const submitKey = isEdit ? `edit-pp-${projectPricingModal.editingId}` : `add-pp-${projectPricingModal.productId}`;
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
                  onChange={(e) => setProjectPricingForm({ ...projectPricingForm, project: e.target.value })}
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
                    onChange={(e) => setProjectPricingForm({ ...projectPricingForm, discount_percentage: e.target.value })}
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
                    onChange={(e) => setProjectPricingForm({ ...projectPricingForm, discounted_price: e.target.value })}
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
                  onChange={(e) => setProjectPricingForm({ ...projectPricingForm, notes: e.target.value })}
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

      {/* ─── Add / Edit Organisation Pricing modal ─── */}
      {orgPricingModal && (() => {
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
                  onChange={(e) => setOrgPricingForm({ ...orgPricingForm, organisation: e.target.value })}
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
              <p className="text-xs text-gray-400 -mt-2 mb-3">Only organisations you administer are listed.</p>

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
                    onChange={(e) => setOrgPricingForm({ ...orgPricingForm, discount_percentage: e.target.value })}
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
                    onChange={(e) => setOrgPricingForm({ ...orgPricingForm, discounted_price: e.target.value })}
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