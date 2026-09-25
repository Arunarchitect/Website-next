"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdminProduct,
  AdminScope,
  OrganisationPricing,
  ProductFormValues,
  ProductVariant,
  ProjectPricing,
  VariantFormValues,
  getImageSource,
} from "./productAdminApi";
import { CATEGORIES, IFC_PREDEFINED_TYPES } from "../productApi";

// ─── Shared helpers (also used by page.tsx) ─────────────────────────────

export const inputBase = "w-full border border-[#DCE0D8] rounded-lg px-3 py-2 text-sm";

export const EMPTY_FORM: ProductFormValues = {
  space: "",
  category: CATEGORIES[0].id,
  predefined_type: "",
  item: "",
  manufacturer: "",
  model_label: "",
  base_price: "",
  currency: "INR",
  cost_price: "",
  product_link: "",
  product_image: null,
};

export const EMPTY_VARIANT_FORM: VariantFormValues = {
  label: "",
  sort_value: "",
  sku: "",
  base_price: "",
  currency: "",
  cost_price: "",
  variant_image: null,
  is_default: false,
};

// ───────────────────────────────────────────────────────────────────────
//  FileChooser
//
//  Four independent paste paths, so at least one works on any browser
//  or device:
//
//    1. Ctrl+V / Cmd+V          → onPaste on the dotted surface
//    2. Right-click → Paste     → browser's native menu on the surface
//    3. Mobile long-press       → iOS/Android native menu on the surface
//    4. Explicit "Paste" button → navigator.clipboard.read() (HTTPS)
//
//  The surface is a real `contentEditable` box, which is what makes
//  browsers actually offer "Paste" on right-click and long-press. A
//  plain <div> would leave the menu item greyed out.
// ───────────────────────────────────────────────────────────────────────

export type FileChooserProps = {
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

/** Best-effort MIME check for image-like clipboards. */
function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}

/** Pull the first pasteable File out of a DataTransfer. */
function extractFileFromDataTransfer(
  dt: DataTransfer | null | undefined
): File | null {
  if (!dt) return null;

  if (dt.files && dt.files.length > 0) {
    return dt.files[0];
  }

  if (dt.items && dt.items.length > 0) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) return f;
      }
    }
  }

  return null;
}

/** Read the OS clipboard via the async Clipboard API (HTTPS + gesture). */
async function readClipboardFiles(): Promise<File[]> {
  if (typeof navigator === "undefined") return [];
  const nav = navigator as Navigator & {
    clipboard?: { read?: () => Promise<ClipboardItem[]> };
  };
  if (!nav.clipboard || typeof nav.clipboard.read !== "function") return [];

  const items = await nav.clipboard.read();
  const files: File[] = [];
  for (const item of items) {
    for (const mime of item.types) {
      if (!isImageMime(mime)) continue;
      try {
        const blob = await item.getType(mime);
        const ext = (mime.split("/")[1] || "png").split("+")[0];
        const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, {
          type: mime,
        });
        files.push(file);
      } catch {
        // ignore individual item failures, keep trying others
      }
    }
  }
  return files;
}

export function FileChooser({
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
  const pasteSurfaceRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (variant !== "image" || !file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, variant]);

  function clearPasteSurface() {
    const el = pasteSurfaceRef.current;
    if (el) el.innerHTML = "";
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const picked = extractFileFromDataTransfer(e.clipboardData);
    if (picked) {
      e.preventDefault();
      clearPasteSurface();
      setPasteNotice(null);
      onFileSelected(picked);
      return;
    }
    void tryAsyncClipboardRead();
  }

  async function tryAsyncClipboardRead() {
    if (disabled || pasteBusy) return;
    setPasteBusy(true);
    setPasteNotice(null);
    try {
      const files = await readClipboardFiles();
      if (files.length === 0) {
        setPasteNotice(
          "No image found on the clipboard — copy an image first, or use Choose file."
        );
        return;
      }
      clearPasteSurface();
      onFileSelected(files[0]);
    } catch {
      setPasteNotice(
        "Your browser blocked clipboard access. Use Choose file, or paste into the dotted box."
      );
    } finally {
      setPasteBusy(false);
    }
  }

  const previewSrc =
    variant === "image" ? objectUrl || existingPreviewUrl || null : null;
  const showImagePreview = variant === "image";
  const canPaste = !disabled && !pasteBusy;

  return (
    <div
      className={`pm-file-chooser${focused ? " pm-file-chooser-focused" : ""}${
        disabled ? " pm-file-chooser-disabled" : ""
      }`}
    >
      {showImagePreview && (
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
        <div className="pm-file-actions">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="pm-file-button"
          >
            {placeholder}
          </button>

          <button
            type="button"
            disabled={!canPaste}
            onClick={tryAsyncClipboardRead}
            className="pm-file-button pm-file-button-secondary"
            title="Paste from clipboard (image)"
          >
            {pasteBusy ? "Reading…" : "Paste"}
          </button>
        </div>

        <span className="pm-file-name">
          {file ? file.name : "No file chosen"}
        </span>

        <div
          ref={pasteSurfaceRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-label="Paste an image here"
          tabIndex={disabled ? -1 : 0}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={() => {
            const el = pasteSurfaceRef.current;
            if (el && el.textContent && el.textContent.trim().length > 0) {
              el.innerHTML = "";
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          className="pm-paste-surface"
        />

        <span className="pm-file-hint">{hint}</span>

        {pasteNotice && (
          <span className="pm-file-notice" role="status">
            {pasteNotice}
          </span>
        )}
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

// ───────────────────────────────────────────────────────────────────────
//  ProductEditPanel
// ───────────────────────────────────────────────────────────────────────

export type EditTab = "details" | "variants" | "pricing" | "org_note";

interface ProductEditPanelProps {
  editingId: string;
  editingProduct: AdminProduct | null;
  form: ProductFormValues;
  setForm: (next: ProductFormValues) => void;
  adminScope: AdminScope;
  scopeLoading: boolean;

  isBusy: (key: string) => boolean;
  onCancel: () => void;
  onSave: () => void;

  // Variants tab
  onAddVariant: (values: VariantFormValues) => void;
  onUpdateVariant: (id: number, values: Partial<VariantFormValues>) => void;
  onDeleteVariant: (id: number) => void;
  onUploadVariantIfc: (variantId: number, file: File) => void;
  onDeleteVariantIfc: (ifcId: number) => void;

  // Pricing modal openers
  onOpenProjectPricing: (productId: string, existing?: ProjectPricing) => void;
  onOpenOrgPricing: (productId: string, existing?: OrganisationPricing) => void;
  onDeleteProjectPricing: (id: number) => void;
  onDeleteOrgPricing: (id: number) => void;

  // Org-note tab state
  orgNoteOrgId: string;
  setOrgNoteOrgId: (id: string) => void;
  orgNoteText: string;
  setOrgNoteText: (t: string) => void;
  orgNoteError: string;
  orgNoteSaved: string;
  onSubmitOrgNote: () => void;
}

export default function ProductEditPanel({
  editingId,
  editingProduct,
  form,
  setForm,
  adminScope,
  scopeLoading,
  isBusy,
  onCancel,
  onSave,
  onAddVariant,
  onUpdateVariant,
  onDeleteVariant,
  onUploadVariantIfc,
  onDeleteVariantIfc,
  onOpenProjectPricing,
  onOpenOrgPricing,
  onDeleteProjectPricing,
  onDeleteOrgPricing,
  orgNoteOrgId,
  setOrgNoteOrgId,
  orgNoteText,
  setOrgNoteText,
  orgNoteError,
  orgNoteSaved,
  onSubmitOrgNote,
}: ProductEditPanelProps) {
  const [activeTab, setActiveTab] = useState<EditTab>("details");

  const isNew = editingId === "new";
  const saveKey = isNew ? "save-product-new" : `save-product-${editingId}`;
  const saving = isBusy(saveKey);

  const noteSaveKey = `org-note-${editingProduct?.id ?? "none"}-${
    orgNoteOrgId || "none"
  }`;
  const savingNote = isBusy(noteSaveKey);

  const predefinedTypeOptions = IFC_PREDEFINED_TYPES[form.category] ?? [];

  function handleOrgNoteOrgChange(orgId: string) {
    setOrgNoteOrgId(orgId);
    const existing = editingProduct?.organisation_notes?.find(
      (n) => String(n.organisation) === String(orgId)
    );
    setOrgNoteText(existing?.note ?? "");
  }

  return (
    <div className="border border-[#DCE0D8] bg-white rounded-2xl p-4 sm:p-6 space-y-4">
      <h2 className="text-lg font-medium">
        {isNew ? "New product" : "Edit product"}
      </h2>

      <div className="flex gap-2 border-b border-[#EDEFEA] overflow-x-auto">
        <button
          onClick={() => setActiveTab("details")}
          className={`text-sm px-3 py-2 border-b-2 -mb-px whitespace-nowrap ${
            activeTab === "details"
              ? "border-[#2F6E62] text-[#2F6E62] font-medium"
              : "border-transparent text-[#6B7570]"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab("variants")}
          disabled={isNew}
          title={isNew ? "Save the product first" : undefined}
          className={`text-sm px-3 py-2 border-b-2 -mb-px whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === "variants"
              ? "border-[#2F6E62] text-[#2F6E62] font-medium"
              : "border-transparent text-[#6B7570]"
          }`}
        >
          Variants
          {editingProduct && editingProduct.variants.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-[#EDEFEA] text-[#4B5650] rounded-full px-1.5 py-0.5">
              {editingProduct.variants.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("pricing")}
          disabled={isNew}
          title={isNew ? "Save the product first" : undefined}
          className={`text-sm px-3 py-2 border-b-2 -mb-px whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === "pricing"
              ? "border-[#2F6E62] text-[#2F6E62] font-medium"
              : "border-transparent text-[#6B7570]"
          }`}
        >
          Project / Org pricing
        </button>
        <button
          onClick={() => setActiveTab("org_note")}
          disabled={isNew}
          title={isNew ? "Save the product first" : undefined}
          className={`text-sm px-3 py-2 border-b-2 -mb-px whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === "org_note"
              ? "border-[#2F6E62] text-[#2F6E62] font-medium"
              : "border-transparent text-[#6B7570]"
          }`}
        >
          Organisation note
        </button>
      </div>

      {activeTab === "details" && (
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
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value, predefined_type: "" })
                }
                className="border border-[#DCE0D8] rounded-lg px-3 py-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {predefinedTypeOptions.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                Type
                <select
                  value={form.predefined_type ?? ""}
                  onChange={(e) => setForm({ ...form, predefined_type: e.target.value })}
                  className="border border-[#DCE0D8] rounded-lg px-3 py-2"
                >
                  <option value="">Select…</option>
                  {predefinedTypeOptions.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
                onChange={(e) =>
                  setForm({ ...form, manufacturer: e.target.value })
                }
                className="border border-[#DCE0D8] rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Model
              <input
                value={form.model_label}
                onChange={(e) =>
                  setForm({ ...form, model_label: e.target.value })
                }
                className="border border-[#DCE0D8] rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Base price
              <input
                type="number"
                value={form.base_price}
                onChange={(e) =>
                  setForm({ ...form, base_price: e.target.value })
                }
                className="border border-[#DCE0D8] rounded-lg px-3 py-2"
              />
              {editingProduct && editingProduct.variants.length > 0 && (
                <span className="text-[11px] text-[#8A938E]">
                  Only used as a fallback — this product has variants with
                  their own prices under the Variants tab.
                </span>
              )}
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
                onChange={(e) =>
                  setForm({ ...form, cost_price: e.target.value })
                }
                className="border border-[#DCE0D8] rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Product link
              <input
                value={form.product_link}
                onChange={(e) =>
                  setForm({ ...form, product_link: e.target.value })
                }
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
                existingPreviewUrl={
                  editingProduct
                    ? getImageSource(editingProduct.product_image)
                    : null
                }
                onFileSelected={(file) =>
                  setForm({ ...form, product_image: file })
                }
              />
              {editingProduct && editingProduct.variants.length > 0 && (
                <span className="text-[11px] text-[#8A938E]">
                  Every variant without its own image inherits this one.
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSave}
              disabled={saving}
              className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {activeTab === "variants" && editingProduct && (
        <VariantsTab
          product={editingProduct}
          isBusy={isBusy}
          onAddVariant={onAddVariant}
          onUpdateVariant={onUpdateVariant}
          onDeleteVariant={onDeleteVariant}
          onUploadVariantIfc={onUploadVariantIfc}
          onDeleteVariantIfc={onDeleteVariantIfc}
          onClose={onCancel}
        />
      )}

      {activeTab === "pricing" && editingProduct && (
        <PricingTab
          editingProduct={editingProduct}
          adminScope={adminScope}
          scopeLoading={scopeLoading}
          isBusy={isBusy}
          onOpenProjectPricing={onOpenProjectPricing}
          onOpenOrgPricing={onOpenOrgPricing}
          onDeleteProjectPricing={onDeleteProjectPricing}
          onDeleteOrgPricing={onDeleteOrgPricing}
          onClose={onCancel}
        />
      )}

      {activeTab === "org_note" && editingProduct && (
        <OrgNoteTab
          editingProduct={editingProduct}
          adminScope={adminScope}
          scopeLoading={scopeLoading}
          orgNoteOrgId={orgNoteOrgId}
          onOrgChange={handleOrgNoteOrgChange}
          orgNoteText={orgNoteText}
          setOrgNoteText={setOrgNoteText}
          orgNoteError={orgNoteError}
          orgNoteSaved={orgNoteSaved}
          savingNote={savingNote}
          onSubmit={onSubmitOrgNote}
          onClose={onCancel}
        />
      )}
    </div>
  );
}

// ─── Variants tab ────────────────────────────────────────────────────

interface VariantsTabProps {
  product: AdminProduct;
  isBusy: (key: string) => boolean;
  onAddVariant: (values: VariantFormValues) => void;
  onUpdateVariant: (id: number, values: Partial<VariantFormValues>) => void;
  onDeleteVariant: (id: number) => void;
  onUploadVariantIfc: (variantId: number, file: File) => void;
  onDeleteVariantIfc: (ifcId: number) => void;
  onClose: () => void;
}

function VariantsTab({
  product,
  isBusy,
  onAddVariant,
  onUpdateVariant,
  onDeleteVariant,
  onUploadVariantIfc,
  onDeleteVariantIfc,
  onClose,
}: VariantsTabProps) {
  const [formOpenFor, setFormOpenFor] = useState<number | "new" | null>(null);
  const [variantForm, setVariantForm] = useState<VariantFormValues>(EMPTY_VARIANT_FORM);
  const [expandedVariantId, setExpandedVariantId] = useState<number | null>(null);

  function startNewVariant() {
    setVariantForm(EMPTY_VARIANT_FORM);
    setFormOpenFor("new");
  }

  function startEditVariant(v: ProductVariant) {
    setVariantForm({
      label: v.label,
      sort_value: v.sort_value ?? "",
      sku: v.sku ?? "",
      base_price: v.base_price ?? "",
      currency: v.currency ?? "",
      cost_price: v.cost_price ?? "",
      variant_image: null,
      is_default: v.is_default,
    });
    setFormOpenFor(v.id);
  }

  function closeForm() {
    setFormOpenFor(null);
    setVariantForm(EMPTY_VARIANT_FORM);
  }

  function submitVariantForm() {
    if (!variantForm.label.trim()) return;
    if (formOpenFor === "new") {
      onAddVariant(variantForm);
    } else if (typeof formOpenFor === "number") {
      onUpdateVariant(formOpenFor, variantForm);
    }
    closeForm();
  }

  const saveKey =
    formOpenFor === "new" ? "save-variant-new" : `save-variant-${formOpenFor}`;
  const saving = isBusy(saveKey);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#8A938E]">
        Add a variant for each size/option this product comes in (e.g. a
        tank`&apos;`s 1000L / 2000L / 3000L). Leave price/image/currency blank on a
        variant to inherit the product`&apos;`s own — only set them where they
        actually differ.
      </p>

      {product.variants.length === 0 ? (
        <p className="text-xs text-[#8A938E]">
          No variants — this product is sold as a single option.
        </p>
      ) : (
        <div className="space-y-2">
          {product.variants.map((v) => {
            const deleteKey = `delete-variant-${v.id}`;
            const uploadIfcKey = `upload-variant-ifc-${v.id}`;
            const expanded = expandedVariantId === v.id;
            const needsOwnIfc = v.has_distinct_geometry && !v.ifc_model;
            return (
              <div key={v.id} className="pm-variant-card">
                <div className="pm-variant-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageSource(v.thumbnail_url || v.variant_image)}
                    alt={v.label}
                    className="pm-variant-thumb"
                  />
                  <div className="pm-variant-info">
                    <div className="pm-variant-title-row">
                      <span className="font-medium text-sm">{v.label}</span>
                      {v.is_default && (
                        <span className="pm-badge pm-badge-approved">default</span>
                      )}
                      {needsOwnIfc && (
                        <span className="pm-badge pm-badge-pending" title="This variant has its own image, so it needs its own IFC model too">
                          needs IFC model
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7570]">
                      {v.effective_currency || product.currency || "INR"}{" "}
                      {v.effective_price ?? v.base_price ?? product.base_price ?? "—"}
                      {v.sku ? ` · SKU ${v.sku}` : ""}
                    </p>
                  </div>
                  <div className="pm-variant-actions">
                    <button
                      onClick={() =>
                        setExpandedVariantId(expanded ? null : v.id)
                      }
                      className="text-xs text-[#2F6E62] underline"
                    >
                      {expanded ? "Hide" : "IFC model"}
                    </button>
                    <button
                      onClick={() => startEditVariant(v)}
                      className="text-xs text-[#2F6E62] underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteVariant(v.id)}
                      disabled={isBusy(deleteKey)}
                      className="text-xs text-red-600 underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isBusy(deleteKey) ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="pm-variant-ifc">
                    {v.ifc_model ? (
                      <div className="text-xs flex items-center gap-3 flex-wrap">
                        <a
                        
                          href={getImageSource(v.ifc_model.file)}
                          target="_blank"
                          className="text-[#2F6E62] underline"
                        >
                          {v.ifc_model.file_name}
                        </a>
                        <span className="text-[#8A938E]">
                          {v.ifc_model.file_size_mb} MB
                        </span>
                        <button
                          onClick={() => onDeleteIfcAndCollapse(v.ifc_model!.id)}
                          disabled={isBusy(`delete-variant-ifc-${v.ifc_model!.id}`)}
                          className="text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isBusy(`delete-variant-ifc-${v.ifc_model!.id}`)
                            ? "Removing…"
                            : "Remove"}
                        </button>
                      </div>
                    ) : (
                      <FileChooser
                        id={`variant-ifc-input-${v.id}`}
                        accept=".ifc,.ifczip,.ifcxml"
                        disabled={isBusy(uploadIfcKey)}
                        placeholder={
                          isBusy(uploadIfcKey) ? "Uploading…" : "Choose IFC file"
                        }
                        hint="or paste with Ctrl+V"
                        variant="file"
                        onFileSelected={(file) => onUploadVariantIfc(v.id, file)}
                      />
                    )}
                  </div>
                )}
              </div>
            );

            function onDeleteIfcAndCollapse(ifcId: number) {
              onDeleteVariantIfc(ifcId);
            }
          })}
        </div>
      )}

      {formOpenFor === null ? (
        <button
          onClick={startNewVariant}
          className="text-xs text-[#2F6E62] underline"
        >
          + Add variant
        </button>
      ) : (
        <div className="pm-variant-form">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Label
              <input
                value={variantForm.label}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, label: e.target.value })
                }
                placeholder="e.g. 1000L"
                className={inputBase}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Sort value (numeric size, for ordering)
              <input
                type="number"
                value={variantForm.sort_value}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, sort_value: e.target.value })
                }
                placeholder="e.g. 1000"
                className={inputBase}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              SKU
              <input
                value={variantForm.sku}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, sku: e.target.value })
                }
                className={inputBase}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Price (blank = inherit product price)
              <input
                type="number"
                value={variantForm.base_price}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, base_price: e.target.value })
                }
                className={inputBase}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Currency (blank = inherit)
              <select
                value={variantForm.currency}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, currency: e.target.value })
                }
                className={inputBase}
              >
                <option value="">Inherit from product</option>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!variantForm.is_default}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, is_default: e.target.checked })
                }
              />
              Default variant
            </label>
            <div className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span>Image (blank = inherit product image)</span>
              <FileChooser
                id="variant-image-input"
                accept="image/*"
                variant="image"
                placeholder="Choose image"
                hint="only set this if the variant genuinely looks different"
                file={variantForm.variant_image}
                existingPreviewUrl={
                  typeof formOpenFor === "number"
                    ? getImageSource(
                        product.variants.find((v) => v.id === formOpenFor)
                          ?.thumbnail_url ?? null
                      )
                    : null
                }
                onFileSelected={(file) =>
                  setVariantForm({ ...variantForm, variant_image: file })
                }
              />
              <span className="text-[11px] text-[#8A938E]">
                If it looks different, it needs its own IFC model too — a
                different shape can&apos;t reuse the parent&apos;s parametric
                geometry.
              </span>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={submitVariantForm}
              disabled={saving || !variantForm.label.trim()}
              className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : formOpenFor === "new" ? "Add variant" : "Save variant"}
            </button>
            <button
              onClick={closeForm}
              disabled={saving}
              className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5"
      >
        Close
      </button>
    </div>
  );
}

// ─── Pricing tab ────────────────────────────────────────────────────────

interface PricingTabProps {
  editingProduct: AdminProduct;
  adminScope: AdminScope;
  scopeLoading: boolean;
  isBusy: (key: string) => boolean;
  onOpenProjectPricing: (productId: string, existing?: ProjectPricing) => void;
  onOpenOrgPricing: (productId: string, existing?: OrganisationPricing) => void;
  onDeleteProjectPricing: (id: number) => void;
  onDeleteOrgPricing: (id: number) => void;
  onClose: () => void;
}

function variantScopeLabel(variantId: number | null, product: AdminProduct): string {
  if (!variantId) return "Whole product";
  const v = product.variants.find((v) => v.id === variantId);
  return v ? v.label : `Variant #${variantId}`;
}

function PricingTab({
  editingProduct,
  adminScope,
  scopeLoading,
  isBusy,
  onOpenProjectPricing,
  onOpenOrgPricing,
  onDeleteProjectPricing,
  onDeleteOrgPricing,
  onClose,
}: PricingTabProps) {
  const visibleProjectPricing = editingProduct.project_pricing_rules.filter(
    (pp) => adminScope.projects.some((proj) => proj.id === pp.project)
  );
  const visibleOrgPricing = editingProduct.organisation_pricing_rules.filter(
    (op) => adminScope.organisations.some((org) => org.id === op.organisation)
  );
  const hiddenProjectCount =
    editingProduct.project_pricing_rules.length - visibleProjectPricing.length;
  const hiddenOrgCount =
    editingProduct.organisation_pricing_rules.length - visibleOrgPricing.length;

  return (
    <div className="space-y-6">
      {!scopeLoading && adminScope.organisations.length === 0 && (
        <div className="pm-scope-warning">
          You don&apos;t administer any organisation yet, so there&apos;s nothing
          to attach project or organisation pricing to.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Project pricing overrides</span>
          <button
            onClick={() => onOpenProjectPricing(editingProduct.id)}
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
            {visibleProjectPricing.map((pp) => {
              const projectMeta = adminScope.projects.find(
                (proj) => proj.id === pp.project
              );
              const editKey = `edit-pp-${pp.id}`;
              const deleteKey = `delete-pp-${pp.id}`;
              const rowBusy = isBusy(editKey) || isBusy(deleteKey);
              return (
                <div key={pp.id} className="pm-rule-chip">
                  <span>
                    {projectMeta ? projectMeta.name : `Project #${pp.project}`}{" "}
                    · {variantScopeLabel(pp.variant, editingProduct)} —{" "}
                    {pp.discounted_price
                      ? `fixed ${pp.discounted_price}`
                      : `${pp.discount_percentage}% off`}
                    {pp.notes ? ` · ${pp.notes}` : ""}
                  </span>
                  <span className="pm-rule-actions">
                    <button
                      onClick={() => onOpenProjectPricing(editingProduct.id, pp)}
                      disabled={rowBusy}
                      className="text-[#2F6E62] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteProjectPricing(pp.id)}
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
            {hiddenProjectCount} more rule{hiddenProjectCount > 1 ? "s" : ""}{" "}
            exist for projects you don&apos;t administer and aren&apos;t shown
            here.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Organisation pricing overrides
          </span>
          <button
            onClick={() => onOpenOrgPricing(editingProduct.id)}
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
            {visibleOrgPricing.map((op) => {
              const orgMeta = adminScope.organisations.find(
                (o) => o.id === op.organisation
              );
              const editKey = `edit-op-${op.id}`;
              const deleteKey = `delete-op-${op.id}`;
              const rowBusy = isBusy(editKey) || isBusy(deleteKey);
              return (
                <div key={op.id} className="pm-rule-chip">
                  <span>
                    {orgMeta ? orgMeta.name : `Org #${op.organisation}`} ·{" "}
                    {variantScopeLabel(op.variant, editingProduct)} —{" "}
                    {op.discounted_price
                      ? `fixed ${op.discounted_price}`
                      : `${op.discount_percentage}% off`}
                    {!op.is_active && " (inactive)"}
                  </span>
                  <span className="pm-rule-actions">
                    <button
                      onClick={() => onOpenOrgPricing(editingProduct.id, op)}
                      disabled={rowBusy}
                      className="text-[#2F6E62] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteOrgPricing(op.id)}
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
            {hiddenOrgCount} more rule{hiddenOrgCount > 1 ? "s" : ""} exist for
            organisations you don&apos;t administer and aren&apos;t shown here.
          </p>
        )}
      </div>

      <button
        onClick={onClose}
        className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5"
      >
        Close
      </button>
    </div>
  );
}

// ─── Org note tab ──────────────────────────────────────────────────────

interface OrgNoteTabProps {
  editingProduct: AdminProduct;
  adminScope: AdminScope;
  scopeLoading: boolean;
  orgNoteOrgId: string;
  onOrgChange: (orgId: string) => void;
  orgNoteText: string;
  setOrgNoteText: (t: string) => void;
  orgNoteError: string;
  orgNoteSaved: string;
  savingNote: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

function OrgNoteTab({
  editingProduct,
  adminScope,
  scopeLoading,
  orgNoteOrgId,
  onOrgChange,
  orgNoteText,
  setOrgNoteText,
  orgNoteError,
  orgNoteSaved,
  savingNote,
  onSubmit,
  onClose,
}: OrgNoteTabProps) {
  const visibleNotes =
    editingProduct.organisation_notes?.filter((n) =>
      adminScope.organisations.some((o) => o.id === n.organisation)
    ) ?? [];

  return (
    <div className="space-y-4">
      {!scopeLoading && adminScope.organisations.length === 0 && (
        <div className="pm-scope-warning">
          You don&apos;t administer any organisation yet, so there&apos;s nothing
          to attach an organisation note to.
        </div>
      )}

      {visibleNotes.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Existing notes</p>
          <div className="space-y-2">
            {visibleNotes.map((n) => (
              <div key={n.id} className="pm-rule-chip">
                <span>
                  <strong>{n.organisation_name}</strong> — {n.note}
                </span>
                <span className="pm-rule-actions">
                  <button
                    type="button"
                    className="text-[#2F6E62] shrink-0"
                    onClick={() => {
                      onOrgChange(String(n.organisation));
                      setOrgNoteText(n.note);
                    }}
                  >
                    Edit
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">
          {visibleNotes.length > 0 ? "Add / update a note" : "Add a note"}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          Organisation
          <select
            value={orgNoteOrgId}
            onChange={(e) => onOrgChange(e.target.value)}
            disabled={savingNote}
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

        <label className="flex flex-col gap-1 text-sm">
          Note
          <textarea
            value={orgNoteText}
            onChange={(e) => setOrgNoteText(e.target.value)}
            disabled={savingNote || !orgNoteOrgId}
            rows={3}
            placeholder="e.g. We get a 12% trade discount from this manufacturer."
            className={`${inputBase} min-h-[80px]`}
          />
        </label>

        {orgNoteError && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">
            {orgNoteError}
          </div>
        )}
        {orgNoteSaved && (
          <div className="text-sm text-[#2F6E62] bg-[#EAF3EF] border border-[#CFE3DA] p-2.5 rounded-lg">
            {orgNoteSaved}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={savingNote || !orgNoteOrgId}
            className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
          >
            {savingNote
              ? "Saving…"
              : orgNoteText.trim()
              ? "Save note"
              : "Clear note"}
          </button>
        </div>
        <p className="text-[11px] text-[#8A938E]">
          Submitting with an empty note clears the organisation&apos;s existing
          note.
        </p>
      </div>

      <button
        onClick={onClose}
        className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5"
      >
        Close
      </button>
    </div>
  );
}