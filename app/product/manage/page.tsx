"use client";

import { Fragment, useEffect, useState } from "react";
import {
  AdminProduct,
  ProductFormValues,
  DiscountTier,
  ProjectPricing,
  OrganisationPricing,
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
  deleteProjectPricing,
  addOrganisationPricing,
  deleteOrganisationPricing,
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

export default function ProductManagePage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "pricing">("details");
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const data = await getAdminProducts(search || undefined);
    setProducts(data);
    if (editingId && editingId !== "new") {
      setEditingProduct(data.find((p) => p.id === editingId) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(refresh, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
    setSaving(true);
    try {
      if (editingId === "new") {
        await createProduct(form);
        cancelEdit();
      } else if (editingId) {
        await updateProduct(editingId, form);
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product permanently?")) return;
    await deleteProduct(id);
    await refresh();
  }

  async function handleAddTier(productId: string) {
    const tier_name = prompt("Tier name (e.g. Bulk 10+)");
    if (!tier_name) return;
    const min_quantity = Number(prompt("Min quantity") || "0");
    const max_quantity = Number(prompt("Max quantity") || "0");
    const discount_percentage = prompt("Discount %") || "0";
    await addDiscountTier(productId, { tier_name, min_quantity, max_quantity, discount_percentage });
    await refresh();
  }

  async function handleDeleteTier(tierId: number) {
    await deleteDiscountTier(tierId);
    await refresh();
  }

  async function handleUploadIfc(productId: string, file: File) {
    await uploadIfcModel(productId, file);
    await refresh();
  }

  async function handleDeleteIfc(ifcId: number) {
    await deleteIfcModel(ifcId);
    await refresh();
  }

  async function handleAddProjectPricing(productId: string) {
    const projectId = Number(prompt("Project ID") || "0");
    if (!projectId) return;
    const discount_percentage = prompt("Discount % (leave blank to set a fixed price instead)") || "";
    const discounted_price = discount_percentage ? "" : prompt("Fixed discounted price") || "";
    const notes = prompt("Notes (optional)") || "";
    await addProjectPricing(productId ? productId.toString() : productId, projectId, {
      discount_percentage: discount_percentage || null,
      discounted_price: discounted_price || null,
      notes: notes || null,
    });
    await refresh();
  }

  async function handleDeleteProjectPricing(id: number) {
    await deleteProjectPricing(id);
    await refresh();
  }

  async function handleAddOrgPricing(productId: string) {
    const organisationId = Number(prompt("Organisation ID") || "0");
    if (!organisationId) return;
    const discount_percentage = prompt("Discount % (leave blank to set a fixed price instead)") || "";
    const discounted_price = discount_percentage ? "" : prompt("Fixed discounted price") || "";
    await addOrganisationPricing(productId, organisationId, {
      discount_percentage: discount_percentage || null,
      discounted_price: discounted_price || null,
    });
    await refresh();
  }

  async function handleDeleteOrgPricing(id: number) {
    await deleteOrganisationPricing(id);
    await refresh();
  }

  return (
    <div className="min-h-screen bg-[#F5F6F3] text-[#1C2521] px-6 sm:px-10 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#6B7570]">Modelflick</p>
            <h1 className="text-2xl font-semibold">Product management</h1>
          </div>
          <button
            onClick={startNew}
            className="bg-[#1C2521] text-white text-sm rounded-full px-5 py-2.5"
          >
            + Add product
          </button>
        </header>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search manufacturer, item, model…"
          className="w-full max-w-md px-4 py-2 rounded-full border border-[#DCE0D8] bg-white text-sm"
        />

        {editingId && (
          <div className="border border-[#DCE0D8] bg-white rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-medium">{editingId === "new" ? "New product" : "Edit product"}</h2>

            <div className="flex gap-2 border-b border-[#EDEFEA]">
              <button
                onClick={() => setActiveTab("details")}
                className={`text-sm px-3 py-2 border-b-2 -mb-px ${
                  activeTab === "details" ? "border-[#2F6E62] text-[#2F6E62] font-medium" : "border-transparent text-[#6B7570]"
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab("pricing")}
                disabled={editingId === "new"}
                title={editingId === "new" ? "Save the product first" : undefined}
                className={`text-sm px-3 py-2 border-b-2 -mb-px disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeTab === "pricing" ? "border-[#2F6E62] text-[#2F6E62] font-medium" : "border-transparent text-[#6B7570]"
                }`}
              >
                Project / Org pricing
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
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Product image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setForm({ ...form, product_image: e.target.files?.[0] ?? null })}
                      className="text-sm"
                    />
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#2F6E62] text-white text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={cancelEdit} className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5">
                    Cancel
                  </button>
                </div>
              </>
            )}

            {activeTab === "pricing" && editingProduct && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Project pricing overrides</span>
                    <button onClick={() => handleAddProjectPricing(editingProduct.id)} className="text-xs text-[#2F6E62] underline">
                      + Add
                    </button>
                  </div>
                  {editingProduct.project_pricing_rules.length === 0 ? (
                    <p className="text-xs text-[#8A938E]">None — base_price applies unless overridden here.</p>
                  ) : (
                    <div className="space-y-2">
                      {editingProduct.project_pricing_rules.map((pp: ProjectPricing) => (
                        <div key={pp.id} className="flex items-center justify-between text-xs bg-[#F5F6F3] border border-[#DCE0D8] rounded-lg px-3 py-2">
                          <span>
                            Project #{pp.project} — {pp.discounted_price ? `fixed ${pp.discounted_price}` : `${pp.discount_percentage}% off`}
                            {pp.notes ? ` · ${pp.notes}` : ""}
                          </span>
                          <button onClick={() => handleDeleteProjectPricing(pp.id)} className="text-red-500">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Organisation pricing overrides</span>
                    <button onClick={() => handleAddOrgPricing(editingProduct.id)} className="text-xs text-[#2F6E62] underline">
                      + Add
                    </button>
                  </div>
                  {editingProduct.organisation_pricing_rules.length === 0 ? (
                    <p className="text-xs text-[#8A938E]">None.</p>
                  ) : (
                    <div className="space-y-2">
                      {editingProduct.organisation_pricing_rules.map((op: OrganisationPricing) => (
                        <div key={op.id} className="flex items-center justify-between text-xs bg-[#F5F6F3] border border-[#DCE0D8] rounded-lg px-3 py-2">
                          <span>
                            Org #{op.organisation} — {op.discounted_price ? `fixed ${op.discounted_price}` : `${op.discount_percentage}% off`}
                            {!op.is_active && " (inactive)"}
                          </span>
                          <button onClick={() => handleDeleteOrgPricing(op.id)} className="text-red-500">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={cancelEdit} className="border border-[#DCE0D8] text-sm rounded-full px-5 py-2.5">
                  Close
                </button>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-[#DCE0D8] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#6B7570]">Loading…</div>
          ) : products.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#6B7570]">No products found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#F5F6F3] text-left text-[#6B7570]">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Manufacturer / Model</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-t border-[#EDEFEA]">
                      <td className="px-4 py-3">
                        <img src={getImageSource(p.product_image)} alt={p.item} className="w-10 h-10 rounded-lg object-cover" />
                      </td>
                      <td className="px-4 py-3">{p.item}</td>
                      <td className="px-4 py-3">{p.manufacturer} — {p.model_label}</td>
                      <td className="px-4 py-3 text-xs">{p.category}</td>
                      <td className="px-4 py-3">{p.base_price ? `${p.currency} ${p.base_price}` : "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          className="text-xs text-[#2F6E62] underline mr-3"
                        >
                          {expandedId === p.id ? "Hide" : "Details"}
                        </button>
                        <button onClick={() => startEdit(p)} className="text-xs text-[#2F6E62] underline mr-3">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr className="bg-[#F9FAF8] border-t border-[#EDEFEA]">
                        <td colSpan={6} className="px-6 py-4 space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-[#4B5650]">Discount tiers</span>
                              <button onClick={() => handleAddTier(p.id)} className="text-xs text-[#2F6E62] underline">
                                + Add tier
                              </button>
                            </div>
                            {p.discount_tiers.length === 0 ? (
                              <p className="text-xs text-[#8A938E]">None</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {p.discount_tiers.map((t: DiscountTier) => (
                                  <span key={t.id} className="text-xs bg-white border border-[#DCE0D8] rounded-full px-3 py-1 flex items-center gap-2">
                                    {t.tier_name} ({t.min_quantity}-{t.max_quantity}: {t.discount_percentage}%)
                                    <button onClick={() => handleDeleteTier(t.id)} className="text-red-500">×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <span className="text-xs font-medium text-[#4B5650]">IFC model file</span>
                            {p.ifc_model ? (
                              <div className="text-xs mt-1 flex items-center gap-3">
                                <a href={getImageSource(p.ifc_model.file)} target="_blank" className="text-[#2F6E62] underline">
                                  {p.ifc_model.file_name}
                                </a>
                                <span className="text-[#8A938E]">{p.ifc_model.file_size_mb} MB</span>
                                <button onClick={() => handleDeleteIfc(p.ifc_model!.id)} className="text-red-500">Remove</button>
                              </div>
                            ) : (
                              <input
                                type="file"
                                accept=".ifc,.ifczip,.ifcxml"
                                className="text-xs mt-1"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadIfc(p.id, file);
                                }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}