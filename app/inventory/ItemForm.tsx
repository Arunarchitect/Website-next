"use client";

import { useEffect, useState } from "react";
import {
  ACTIONS, CONDITIONS, STATUSES,
  getApiErrorMessage, money,
  type Category, type Item, type ItemInput, type Location, type Member,
} from "./inventoryApi";

/** Free-text names typed in the form. The page finds or creates the matching
 * location / category / subcategory when saving. */
export interface SaveNames {
  location: string;
  category: string;
  subcategory: string;
}

interface Props {
  item: Item | null;
  projectId: number;
  members: Member[];
  locations: Location[];
  categories: Category[];
  onSave: (values: ItemInput, names: SaveNames) => Promise<void>;
  onClose: () => void;
}

const blank = (project: number): ItemInput => ({
  project,
  name: "",
  variant: "",
  category: null,
  subcategory: null,
  location: null,
  custodians: [],
  status: "IN_USE",
  condition: "",
  qty_have: 1,
  qty_needed: 0,
  rate: null,
  action: "NONE",
  essential: false,
  is_consumable: false,
  brand: "",
  purchase_date: null,
  warranty_until: null,
  remarks: "",
});

const fromItem = (i: Item): ItemInput => ({
  project: i.project,
  name: i.name,
  variant: i.variant,
  category: i.category,
  subcategory: i.subcategory,
  location: i.location,
  custodians: i.custodians,
  status: i.status,
  condition: i.condition,
  qty_have: i.qty_have,
  qty_needed: i.qty_needed,
  rate: i.rate,
  action: i.action,
  essential: i.essential,
  is_consumable: i.is_consumable,
  brand: i.brand,
  purchase_date: i.purchase_date,
  warranty_until: i.warranty_until,
  remarks: i.remarks,
});

const input =
  "w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export default function ItemForm({ item, projectId, members, locations, categories, onSave, onClose }: Props) {
  const [f, setF] = useState<ItemInput>(() => (item ? fromItem(item) : blank(projectId)));
  const [locationName, setLocationName] = useState(item?.location_name ?? "");
  const [categoryName, setCategoryName] = useState(item?.category_name ?? "");
  const [subcategoryName, setSubcategoryName] = useState(item?.subcategory_name ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleCustodian = (id: number) =>
    set("custodians", f.custodians.includes(id) ? f.custodians.filter((c) => c !== id) : [...f.custodians, id]);

  const typedCategory = categories.find((c) => c.name.toLowerCase() === categoryName.trim().toLowerCase());
  const newCategory = categoryName.trim() !== "" && !typedCategory;
  const newSub =
    subcategoryName.trim() !== "" &&
    !typedCategory?.subcategories.some((s) => s.name.toLowerCase() === subcategoryName.trim().toLowerCase());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Item name is required.");
    setSaving(true);
    setErr("");
    try {
      await onSave({ ...f, name: f.name.trim() }, {
        location: locationName,
        category: categoryName,
        subcategory: subcategoryName,
      });
      onClose();
    } catch (ex) {
      setErr(getApiErrorMessage(ex, "Couldn’t save the item."));
      setSaving(false);
    }
  }

  const gap = Math.max(f.qty_needed - f.qty_have, 0);
  const cost = f.rate !== null && f.rate !== "" ? Number(f.rate) * f.qty_have : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <form onSubmit={submit} className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {item ? `Edit item ${item.code}` : "Add item"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item">
            <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </Field>
          <Field label="Variant (size, type)">
            <input className={input} value={f.variant} onChange={(e) => set("variant", e.target.value)} />
          </Field>

          <Field label="Category">
            <input
              className={input}
              list="inv-categories"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Pick one or type a new category"
            />
            <datalist id="inv-categories">
              {categories.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
            {newCategory && <span className="mt-1 block text-xs text-slate-600">New category, created when you save.</span>}
          </Field>
          <Field label="Subcategory">
            <input
              className={input}
              list="inv-subcategories"
              value={subcategoryName}
              onChange={(e) => setSubcategoryName(e.target.value)}
              placeholder={categoryName.trim() ? "Pick one or type a new one" : "Choose a category first"}
              disabled={!categoryName.trim()}
            />
            <datalist id="inv-subcategories">
              {typedCategory?.subcategories.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
            {newSub && <span className="mt-1 block text-xs text-slate-600">New subcategory, created when you save.</span>}
          </Field>

          <Field label="Location">
            <input
              className={input}
              list="inv-locations"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Pick one or type a new place"
            />
            <datalist id="inv-locations">
              {locations.map((l) => <option key={l.id} value={l.name} />)}
            </datalist>
          </Field>
          <Field label="Brand">
            <input className={input} value={f.brand} onChange={(e) => set("brand", e.target.value)} />
          </Field>

          <div className="sm:col-span-2">
            <span className="mb-1 block text-sm text-slate-700">
              Custodians <span className="text-slate-500">(none = unassigned, several = shared)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {members.length === 0 && <span className="text-sm text-slate-500">No people are on this project yet.</span>}
              {members.map((m) => {
                const on = f.custodians.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggleCustodian(m.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                      on ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Status">
            <select className={input} value={f.status} onChange={(e) => set("status", e.target.value as ItemInput["status"])}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Condition">
            <select className={input} value={f.condition} onChange={(e) => set("condition", e.target.value as ItemInput["condition"])}>
              <option value="">Not rated</option>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>

          <Field label="Quantity we have">
            <input type="number" min={0} className={input} value={f.qty_have} onChange={(e) => set("qty_have", Math.max(Number(e.target.value) || 0, 0))} />
          </Field>
          <Field label="Quantity we need">
            <input type="number" min={0} className={input} value={f.qty_needed} onChange={(e) => set("qty_needed", Math.max(Number(e.target.value) || 0, 0))} />
            {gap > 0 && <span className="mt-1 block text-xs text-amber-700">Short by {gap}</span>}
          </Field>

          <Field label="Rate (₹ per unit)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={input}
              value={f.rate ?? ""}
              onChange={(e) => set("rate", e.target.value === "" ? null : e.target.value)}
            />
          </Field>
          <div className="text-sm text-slate-700">
            <span className="mb-1 block">Cost (rate × quantity we have)</span>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-900">
              {money(cost)}
            </div>
          </div>

          <Field label="Action">
            <select className={input} value={f.action} onChange={(e) => set("action", e.target.value as ItemInput["action"])}>
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-5 pb-1.5">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.essential} onChange={(e) => set("essential", e.target.checked)} />
              Essential
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={f.is_consumable} onChange={(e) => set("is_consumable", e.target.checked)} />
              Consumable
            </label>
          </div>

          <Field label="Purchase date">
            <input type="date" className={input} value={f.purchase_date ?? ""} onChange={(e) => set("purchase_date", e.target.value || null)} />
          </Field>
          <Field label="Warranty until">
            <input type="date" className={input} value={f.warranty_until ?? ""} onChange={(e) => set("warranty_until", e.target.value || null)} />
          </Field>

          <Field label="Remarks" wide>
            <textarea className={input} rows={2} value={f.remarks} onChange={(e) => set("remarks", e.target.value)} />
          </Field>
        </div>

        {err && <p role="alert" className="mt-3 text-sm text-rose-700">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-60">
            {saving ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}