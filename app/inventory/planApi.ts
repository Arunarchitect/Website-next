/* eslint-disable @typescript-eslint/no-explicit-any */
/* app/inventory/planApi.ts */
import {
  apiClient,
  createCategory,
  createItem,
  createLocation,
  createSubCategory,
  type Category,
  type Item,
  type ItemInput,
  type Location,
  type Unit,
} from "./inventoryApi";
import type { SaveNames } from "./ItemForm";

export const KINDS = [
  { value: "TRIP", label: "Trip / tour" },
  { value: "MOVE", label: "Home change" },
  { value: "EVENT", label: "Event" },
  { value: "OTHER", label: "Other" },
] as const;

export const PLAN_STATUSES = [
  { value: "PLANNING", label: "Planning" },
  { value: "ACTIVE", label: "Active" },
  { value: "DONE", label: "Done" },
] as const;

export type PlanKind = (typeof KINDS)[number]["value"];
export type PlanStatus = (typeof PLAN_STATUSES)[number]["value"];

export interface PlanLine {
  id: number;
  plan: number;
  source: "ITEM" | "BUY";
  item: number | null; // null on an ITEM line = the item was deleted
  name: string;
  unit: Unit;
  qty: string;
  est_rate: string | null;
  done: boolean;
  notes: string;
  added_to_inventory: number | null;
  item_code: string | null;
  item_qty_have: string | null;
  item_project: number | null;
  item_project_name: string;
  item_org_id: number | null;
  item_org_name: string;
  item_rate: string | null;
  for_line: number | null; // set on an automatic shortfall line: the Taking line it tops up
  line_cost: string | null;
}

export interface Plan {
  id: number;
  name: string;
  kind: PlanKind;
  start_date: string | null;
  end_date: string | null;
  status: PlanStatus;
  notes: string;
  organisation: number | null;
  organisation_name: string;
  created_at: string;
  total_lines: number;
  done_lines: number;
  est_total: string;
  lines: PlanLine[];
}

export interface PlanInput {
  name: string;
  kind: PlanKind;
  start_date: string | null;
  end_date: string | null;
  organisation: number | null;
  notes?: string;
}

const list = <T,>(d: any): T[] => (Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []);

export const listPlans = async (): Promise<Plan[]> => list<Plan>((await apiClient.get("/inventory/plans/")).data);
export const getPlan = async (id: number): Promise<Plan> => (await apiClient.get(`/inventory/plans/${id}/`)).data;
export const createPlan = async (d: PlanInput): Promise<Plan> => (await apiClient.post("/inventory/plans/", d)).data;
export const updatePlan = async (id: number, d: Partial<PlanInput> & { status?: PlanStatus }): Promise<Plan> =>
  (await apiClient.patch(`/inventory/plans/${id}/`, d)).data;
export const deletePlan = async (id: number): Promise<void> => {
  await apiClient.delete(`/inventory/plans/${id}/`);
};

export const addItemsToPlan = async (id: number, itemIds: number[]): Promise<{ added: number }> =>
  (await apiClient.post(`/inventory/plans/${id}/add-items/`, { item_ids: itemIds })).data;

export const finishPlan = async (
  id: number,
  opts: { add_bought_to_project: number | null; delete_unbought: boolean }
): Promise<{ added_to_inventory: number; removed: number }> =>
  (await apiClient.post(`/inventory/plans/${id}/finish/`, opts)).data;

export const addBuyLine = async (
  plan: number,
  d: { name: string; qty: number | string; unit: Unit; est_rate: number | string | null; for_line?: number }
): Promise<PlanLine> => (await apiClient.post("/inventory/plan-lines/", { plan, ...d })).data;

export const updateLine = async (
  id: number,
  d: Partial<Pick<PlanLine, "done" | "qty" | "est_rate" | "name" | "unit" | "notes">>
): Promise<PlanLine> => (await apiClient.patch(`/inventory/plan-lines/${id}/`, d)).data;

export const deleteLine = async (id: number): Promise<void> => {
  await apiClient.delete(`/inventory/plan-lines/${id}/`);
};

/** After a bought line is added to inventory. Pass the new item's id, or
 * increase_stock for a shortfall line (adds to the original item instead). */
export const linkItem = async (
  id: number,
  body: { item?: number; increase_stock?: boolean }
): Promise<void> => {
  await apiClient.post(`/inventory/plan-lines/${id}/link-item/`, body);
};

/** Creates an inventory item, finding or creating the typed location /
 * category / subcategory first (same rules as the inventory page). */
export async function createItemWithNames(
  values: ItemInput,
  names: SaveNames,
  locations: Location[],
  categories: Category[]
): Promise<Item> {
  const lname = names.location.trim();
  const cname = names.category.trim();
  const sname = names.subcategory.trim();
  if (sname && !cname) throw new Error("Pick a category for the subcategory.");

  let location: number | null = null;
  if (lname) {
    const found = locations.find((l) => l.name.toLowerCase() === lname.toLowerCase());
    location = found ? found.id : (await createLocation(values.project, lname)).id;
  }

  let category: number | null = null;
  let subcategory: number | null = null;
  if (cname) {
    const foundCat = categories.find((c) => c.name.toLowerCase() === cname.toLowerCase());
    category = foundCat ? foundCat.id : (await createCategory(values.project, cname)).id;
    if (sname) {
      const foundSub = foundCat?.subcategories.find((s) => s.name.toLowerCase() === sname.toLowerCase());
      subcategory = foundSub ? foundSub.id : (await createSubCategory(category, sname)).id;
    }
  }
  return createItem({ ...values, location, category, subcategory });
}

// Shared styling (same look as page.tsx)
export const field =
  "rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300";
export const ghostBtn = "rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";
export const primaryBtn = "rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-60";