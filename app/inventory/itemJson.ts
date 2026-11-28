import {
  ACTIONS,
  CONDITIONS,
  STATUSES,
  UNITS,
  type Category,
  type Item,
  type Location,
  type Project,
} from "./inventoryApi";

/** One item as it appears in the JSON (shared by Copy JSON and Copy for AI). */
const itemRow = (i: Item) => ({
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
});

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
    items: items.map(itemRow),
  };
  return JSON.stringify(payload, null, 2);
}

// ── Copy for AI ───────────────────────────────────────────────────────────

const BULK_CAP = 500; // the server accepts at most 500 items per paste

const AI_ITEM_INSTRUCTIONS = [
  "You are editing the inventory of a household or organisation. 'items' lists everything it currently owns. Do what 'request' asks, then reply with ONE JSON object only (no commentary, no markdown fences).",
  "Reply with {\"format\": \"modelflick-inventory\", \"version\": 1, \"project\": <same project id>, \"items\": [...]}. Put in 'items' ONLY the items you add or change. Items you leave out are never deleted or changed.",
  "CHANGE an existing item: include its 'code' exactly as given, plus ONLY the fields that change. Never change or invent a code.",
  "ADD a new item: NO 'code'. Always include 'name', 'unit', 'qty_have' and 'status'. Other fields are optional.",
  "BEFORE adding, search 'items' for the same thing (same name, any variant or brand). If it already exists, change that item (use its code) instead of adding a duplicate. Only add a second row if it is genuinely a different variant, size, brand or colour.",
  "'unit' must be EXACTLY one of allowed.unit. 'status', 'condition' and 'action' must be EXACTLY one of allowed.status, allowed.condition (empty string = not rated) and allowed.action. Do not convert units by changing the unit.",
  "'qty_have' (quantity owned), 'qty_needed' (quantity required) and 'rate' (price for ONE unit in rupees, or null) are numbers, 0 or more.",
  "'color' is \"#RRGGBB\" (for example \"#FF0000\") or an empty string. Never a colour name.",
  "'category', 'subcategory' and 'location' are names. Reuse the names in 'existing.categories' and 'existing.locations' EXACTLY (spelling and case) so no near-duplicate is created. A new name is created automatically, so only use one when nothing existing fits. A subcategory needs a category.",
  "'custodians' is a list of names taken EXACTLY from allowed.custodians. An empty list means unassigned. Never invent a person.",
  "'purchase_date' and 'warranty_until' are \"YYYY-MM-DD\" or null. The warranty cannot end before the purchase date.",
  "Do not include 'cost', 'gap', 'id', 'seq' or any other field not listed here. Leave 'request', 'instructions', 'allowed' and 'existing' out of your reply.",
];

/** Inventory + instructions for an AI. The reply pastes straight into Paste JSON. */
export function inventoryForAiJson(
  items: Item[],
  project: Project,
  categories: Category[],
  locations: Location[],
): { json: string; count: number; truncated: boolean } {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const listed = sorted.slice(0, BULK_CAP);
  const payload = {
    format: "modelflick-inventory",
    version: 1,
    project: project.id,
    project_name: project.name,
    request: "Edit the inventory as described here: <<WRITE YOUR CHANGE HERE>>",
    instructions: AI_ITEM_INSTRUCTIONS,
    allowed: {
      status: STATUSES.map((s) => s.value),
      condition: ["", ...CONDITIONS.map((c) => c.value)],
      unit: UNITS.map((u) => u.value),
      action: ACTIONS.map((a) => a.value),
      custodians: project.members.map((m) => m.name),
    },
    existing: {
      categories: categories.map((c) => ({
        name: c.name,
        subcategories: c.subcategories.map((s) => s.name),
      })),
      locations: locations.map((l) => l.name),
    },
    itemsNote:
      sorted.length > listed.length
        ? `Only the first ${listed.length} of ${sorted.length} items are listed (A to Z).`
        : `All ${sorted.length} items are listed.`,
    items: listed.map(itemRow),
  };
  return {
    json: JSON.stringify(payload, null, 2),
    count: listed.length,
    truncated: sorted.length > listed.length,
  };
}

// ── Paste ─────────────────────────────────────────────────────────────────

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