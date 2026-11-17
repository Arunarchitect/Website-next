"use client";

import { useEffect, useState } from "react";
import {
  ACTIONS, CONDITIONS, STATUSES, UNITS,
  fmtQty, getApiErrorMessage, money, unitShort,
  type Category, type Item, type ItemInput, type Location, type Member,
} from "./inventoryApi";
import ColorField from "./ColorField";

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
  color: "",
  category: null,
  subcategory: null,
  location: null,
  custodians: [],
  status: "IN_USE",
  condition: "",
  unit: "COUNT",
  qty_have: "1",
  qty_needed: "0",
  rate: null,
  action: "NONE",
  brand: "",
  purchase_date: null,
  warranty_until: null,
  remarks: "",
});

const fromItem = (i: Item): ItemInput => ({
  project: i.project,
  name: i.name,
  variant: i.variant,
  color: i.color,
  category: i.category,
  subcategory: i.subcategory,
  location: i.location,
  custodians: i.custodians,
  status: i.status,
  condition: i.condition,
  unit: i.unit,
  qty_have: i.qty_have,
  qty_needed: i.qty_needed,
  rate: i.rate,
  action: i.action,
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

/** Number input with the unit printed inside the right edge. */
function QtyInput({
  value,
  unit,
  onChange,
}: {
  value: number | string;
  unit: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        className={`${input} ${unit ? "pr-10" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-500">
          {unit}
        </span>
      )}
    </div>
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

  const have = Number(f.qty_have) || 0;
  const need = Number(f.qty_needed) || 0;
  const u = unitShort(f.unit);
  const gap = Math.max(need - have, 0);
  const cost = f.rate !== null && f.rate !== "" ? Number(f.rate) * have : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Item name is required.");
    if (have < 0 || need < 0) return setErr("Quantities cannot be negative.");
    setSaving(true);
    setErr("");
    try {
      await onSave(
        {
          ...f,
          name: f.name.trim(),
          qty_have: f.qty_have === "" ? 0 : f.qty_have,
          qty_needed: f.qty_needed === "" ? 0 : f.qty_needed,
        },
        {
          location: locationName,
          category: categoryName,
          subcategory: subcategoryName,
        },
      );
      onClose();
    } catch (ex) {
      setErr(getApiErrorMessage(ex, "Couldn’t save the item."));
      setSaving(false);
    }
  }

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

          <div className="text-sm text-slate-700">
            <span className="mb-1 block">Color</span>
            <ColorField value={f.color} onChange={(v) => set("color", v)} />
          </div>
          <Field label="Brand">
            <input className={input} value={f.brand} onChange={(e) => set("brand", e.target.value)} />
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

          <Field label="Location" wide>
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

          <Field label="Unit (applies to quantities and rate)" wide>
            <select className={input} value={f.unit} onChange={(e) => set("unit", e.target.value as ItemInput["unit"])}>
              {UNITS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </Field>

          <div className="text-sm text-slate-700">
            <span className="mb-1 block">Quantity we have</span>
            <QtyInput value={f.qty_have} unit={u} onChange={(v) => set("qty_have", v)} />
          </div>
          <div className="text-sm text-slate-700">
            <span className="mb-1 block">Quantity we need</span>
            <QtyInput value={f.qty_needed} unit={u} onChange={(v) => set("qty_needed", v)} />
            {gap > 0 && (
              <span className="mt-1 block text-xs text-amber-700">
                Short by {fmtQty(gap)}{u && ` ${u}`}
              </span>
            )}
          </div>

          <Field label={`Rate (₹ per ${u || "unit"})`}>
            <input
              type="number"
              inputMode="decimal"
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

          <Field label="Action" wide>
            <select className={input} value={f.action} onChange={(e) => set("action", e.target.value as ItemInput["action"])}>
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </Field>

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