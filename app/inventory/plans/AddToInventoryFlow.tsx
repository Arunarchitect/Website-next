"use client";

/* app/inventory/plans/AddToInventoryFlow.tsx
 * Step 1: confirm. Step 2: the normal item form (category, location, color…),
 * prefilled from the bought line. When saved, the line moves to Taking. */
import { useRef, useState } from "react";
import ItemForm from "../ItemForm";
import {
  fmtQty,
  getApiErrorMessage,
  listCategories,
  listLocations,
  unitShort,
  type Category,
  type Item,
  type Location,
  type Project,
} from "../inventoryApi";
import { createItemWithNames, field, ghostBtn, linkItem, primaryBtn, type PlanLine } from "../planApi";
import { Modal } from "./PlanDialogs";

export default function AddToInventoryFlow({
  line,
  parent,
  editableProjects,
  onDone,
  onClose,
}: {
  line: PlanLine;
  parent: PlanLine | null; // the Taking line this one tops up (shortfall lines only)
  editableProjects: Project[];
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const canIncrease =
    !!parent && parent.item !== null && editableProjects.some((p) => p.id === parent.item_project);

  const [mode, setMode] = useState<"increase" | "new">(canIncrease ? "increase" : "new");
  const [step, setStep] = useState<"confirm" | "form">("confirm");
  const [projectId, setProjectId] = useState<number>(
    editableProjects.find((p) => p.id === parent?.item_project)?.id ?? editableProjects[0]?.id
  );
  const [data, setData] = useState<{ locations: Location[]; categories: Category[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const created = useRef<Item | null>(null); // survives a failed link, so a retry never duplicates the item

  const project = editableProjects.find((p) => p.id === projectId);
  const u = unitShort(line.unit);
  const qtyText = `${fmtQty(line.qty)}${u ? ` ${u}` : ""}`;

  async function next() {
    setBusy(true);
    setErr("");
    try {
      if (mode === "increase") {
        await linkItem(line.id, { increase_stock: true });
        onDone(`Stock of ${parent!.name} increased by ${qtyText}.`);
        return;
      }
      const [locations, categories] = await Promise.all([listLocations(projectId), listCategories(projectId)]);
      setData({ locations, categories });
      setStep("form");
    } catch (e) {
      setErr(getApiErrorMessage(e, "Couldn’t continue."));
    } finally {
      setBusy(false);
    }
  }

  if (step === "form" && data && project) {
    return (
      <ItemForm
        item={null}
        projectId={project.id}
        members={project.members}
        locations={data.locations}
        categories={data.categories}
        prefill={{ name: line.name, unit: line.unit, qty_have: line.qty, rate: line.est_rate }}
        title="Add to inventory"
        submitLabel="Add to inventory"
        onSave={async (values, names) => {
          if (!created.current) {
            created.current = await createItemWithNames(values, names, data.locations, data.categories);
          }
          await linkItem(line.id, { item: created.current.id });
          onDone(`${created.current.name} added to inventory as ${created.current.code}. It is now in Taking.`);
        }}
        onClose={onClose}
      />
    );
  }

  const have = parent?.item_qty_have != null ? Number(parent.item_qty_have) : 0;

  return (
    <Modal title="Add to inventory?" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          <span className="font-medium text-slate-900">
            {line.name} × {qtyText}
          </span>{" "}
          will be saved in your inventory and move to the Taking list.
        </p>

        {canIncrease && parent && (
          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" checked={mode === "increase"} onChange={() => setMode("increase")} />
              <span>
                Add to the stock of {parent.name} ({parent.item_code}): {fmtQty(have)} → {fmtQty(have + Number(line.qty))}
                {u && ` ${u}`}
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" checked={mode === "new"} onChange={() => setMode("new")} />
              <span>Save as a separate new item</span>
            </label>
          </div>
        )}

        {mode === "new" && editableProjects.length > 1 && (
          <label className="block">
            <span className="mb-1 block">Inventory</span>
            <select className={`${field} w-full`} value={projectId} onChange={(e) => setProjectId(Number(e.target.value))}>
              {editableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.organisation_name ? `${p.organisation_name} · ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className="text-xs text-slate-500">
          Rented, borrowed or temporary? Choose Cancel. It stays in the To buy list as bought.
        </p>

        {err && (
          <p role="alert" className="text-rose-700">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={next} disabled={busy} className={primaryBtn}>
            {busy ? "Working…" : mode === "increase" ? "Add to inventory" : "Continue"}
          </button>
        </div>
      </div>
    </Modal>
  );
}