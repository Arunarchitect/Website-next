import {
  ACTIONS,
  CONDITIONS,
  STATUSES,
  UNITS,
  type Item,
  type Project,
} from "./inventoryApi";

/** JSON for the given items, ready to paste into an AI chat and back. */
export function itemsToJson(items: Item[], project: Project): string {
  const payload = {
    format: "modelflick-inventory",
    version: 1,
    project: project.id,
    project_name: project.name,
    allowed: {
      status: STATUSES.map((s) => s.value),
      condition: ["", ...CONDITIONS.map((c) => c.value)],
      unit: UNITS.map((u) => u.value),
      action: ACTIONS.map((a) => a.value),
      custodians: project.members.map((m) => m.name),
    },
    notes: [
      "Edit the items array, then paste the whole JSON back with Paste JSON and validate it.",
      "code identifies an existing item. Remove code to add a new item. Items you leave out are never deleted.",
      "color is #RRGGBB or an empty string.",
      "category, subcategory and location are names; new names are created. custodians are names from allowed.custodians.",
      "qty_have, qty_needed and rate are numbers. unit applies to both quantities and the rate.",
      "Dates are YYYY-MM-DD or null. cost and gap are calculated and ignored.",
    ],
    items: items.map((i) => ({
      code: i.code,
      name: i.name,
      variant: i.variant,
      color: i.color,
      category: i.category_name,
      subcategory: i.subcategory_name,
      location: i.location_name,
      custodians: i.custodian_details.map((c) => c.name),
      status: i.status,
      condition: i.condition,
      unit: i.unit,
      qty_have: Number(i.qty_have),
      qty_needed: Number(i.qty_needed),
      rate: i.rate === null ? null : Number(i.rate),
      action: i.action,
      brand: i.brand,
      purchase_date: i.purchase_date,
      warranty_until: i.warranty_until,
      remarks: i.remarks,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/** Reads pasted JSON (whole export, or just an items array; ``` fences are
 * stripped). Throws an Error with a readable message when it cannot. */
export function parseItemsJson(text: string, projectId: number): unknown[] {
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1];
  if (!s) throw new Error("Paste the JSON first.");

  let data: unknown;
  try {
    data = JSON.parse(s);
  } catch (e) {
    throw new Error(`Not valid JSON: ${e instanceof Error ? e.message : "parse error"}`);
  }

  let items: unknown;
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.project !== undefined && Number(d.project) !== projectId)
      throw new Error("This JSON is from a different project.");
    items = d.items;
  }
  if (!Array.isArray(items)) throw new Error('Expected an "items" array.');
  if (items.length === 0) throw new Error("The items array is empty.");
  return items;
}

/** Copies text to the clipboard. Returns false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}