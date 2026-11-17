/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";

// Same client setup as productApi.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_HOST;
const API_URL = `${API_BASE_URL}/api`;

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access") ||
    null
  );
};

function redirectToLogin() {
  if (typeof window === "undefined") return;

  const current = window.location.pathname + window.location.search;
  const shouldAttachNext = current && current !== "/" && !current.startsWith("/auth/login");

  const target = shouldAttachNext
    ? `/auth/login?next=${encodeURIComponent(current)}`
    : "/auth/login";

  if (window.location.pathname + window.location.search !== target) {
    window.location.href = target;
  }
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

function unwrapList<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// ── Choices (keep in sync with inventory/models.py) ─────────────────────
// Categories are NOT here — they are per-project data (Category/SubCategory).
export const STATUSES = [
  { value: "IN_USE", label: "In use" },
  { value: "SPARE", label: "Spare" },
  { value: "STORED", label: "Stored" },
  { value: "DISPOSED", label: "Disposed / given away" },
] as const;

export const CONDITIONS = [
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
  { value: "BROKEN", label: "Broken" },
] as const;

export const ACTIONS = [
  { value: "NONE", label: "OK" },
  { value: "REPAIR", label: "Repair" },
  { value: "REPLACE", label: "Replace" },
  { value: "BUY_MORE", label: "Buy more" },
  { value: "DISPOSE", label: "Dispose" },
] as const;

// `short` is what is printed next to numbers. Count prints nothing.
export const UNITS = [
  { value: "COUNT", label: "Count (nos)", short: "" },
  { value: "G", label: "Gram (g)", short: "g" },
  { value: "KG", label: "Kilogram (kg)", short: "kg" },
  { value: "MM", label: "Millimetre (mm)", short: "mm" },
  { value: "CM", label: "Centimetre (cm)", short: "cm" },
  { value: "M", label: "Metre (m)", short: "m" },
  { value: "M2", label: "Square metre (m²)", short: "m²" },
  { value: "M3", label: "Cubic metre (m³)", short: "m³" },
  { value: "ML", label: "Millilitre (ml)", short: "ml" },
  { value: "L", label: "Litre (L)", short: "L" },
] as const;

export type Status = (typeof STATUSES)[number]["value"];
export type Condition = (typeof CONDITIONS)[number]["value"] | "";
export type ActionValue = (typeof ACTIONS)[number]["value"];
export type Unit = (typeof UNITS)[number]["value"];

// ── Types ───────────────────────────────────────────────────────────────
export interface Member {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  organisation_id: number;
  organisation_name: string;
  can_edit: boolean;
  members: Member[];
}

export interface Location {
  id: number;
  project: number;
  name: string;
  item_count?: number;
}

export interface SubCategory {
  id: number;
  category: number;
  name: string;
  item_count?: number;
}

export interface Category {
  id: number;
  project: number;
  name: string;
  item_count?: number;
  subcategories: SubCategory[];
}

export interface Item {
  id: number;
  project: number;
  seq: number;
  code: string;
  name: string;
  variant: string;
  color: string; // "#RRGGBB" or "" (not set)
  category: number | null;
  category_name: string;
  subcategory: number | null;
  subcategory_name: string;
  location: number | null;
  location_name: string;
  custodians: number[];
  custodian_details: Member[];
  status: Status;
  condition: Condition;
  unit: Unit;
  qty_have: string; // decimals arrive as strings from DRF, e.g. "2.500"
  qty_needed: string;
  gap: string; // read-only, max(needed - have, 0)
  rate: string | null; // per unit; DRF sends decimals as strings
  cost: string | null; // rate × qty_have, read-only
  action: ActionValue;
  brand: string;
  purchase_date: string | null;
  warranty_until: string | null;
  remarks: string;
}

// Quantities may be sent as numbers or strings; DRF accepts both.
export type ItemInput = Omit<
  Item,
  | "id" | "seq" | "code" | "gap" | "cost"
  | "category_name" | "subcategory_name" | "location_name" | "custodian_details"
  | "qty_have" | "qty_needed"
> & {
  qty_have: number | string;
  qty_needed: number | string;
};

export interface ImportResult {
  created: number;
  skipped: number;
  categories_created: number;
  subcategories_created: number;
  unmatched_custodians: string[];
}

export interface BulkRowResult {
  index: number;
  code: string;
  name: string;
  status: "create" | "update" | "unchanged" | "error";
  errors: string[];
  warnings: string[];
  changes: string[];
}

export interface BulkResult {
  ok: boolean;
  dry_run: boolean;
  applied: boolean;
  summary: { create: number; update: number; unchanged: number; error: number };
  rows: BulkRowResult[];
}

// ── Calls ───────────────────────────────────────────────────────────────
export async function listMyProjects(): Promise<Project[]> {
  const res = await apiClient.get("/inventory/my-projects/");
  return unwrapList<Project>(res.data);
}

export async function listItems(project: number): Promise<Item[]> {
  const res = await apiClient.get("/inventory/items/", { params: { project } });
  return unwrapList<Item>(res.data);
}

export async function createItem(data: ItemInput): Promise<Item> {
  return (await apiClient.post("/inventory/items/", data)).data;
}

export async function updateItem(id: number, data: Partial<ItemInput>): Promise<Item> {
  return (await apiClient.patch(`/inventory/items/${id}/`, data)).data;
}

export async function deleteItem(id: number): Promise<void> {
  await apiClient.delete(`/inventory/items/${id}/`);
}

export async function listLocations(project: number): Promise<Location[]> {
  const res = await apiClient.get("/inventory/locations/", { params: { project } });
  return unwrapList<Location>(res.data);
}

export async function createLocation(project: number, name: string): Promise<Location> {
  return (await apiClient.post("/inventory/locations/", { project, name })).data;
}

export async function listCategories(project: number): Promise<Category[]> {
  const res = await apiClient.get("/inventory/categories/", { params: { project } });
  return unwrapList<Category>(res.data);
}

export async function createCategory(project: number, name: string): Promise<Category> {
  return (await apiClient.post("/inventory/categories/", { project, name })).data;
}

export async function updateCategory(id: number, name: string): Promise<Category> {
  return (await apiClient.patch(`/inventory/categories/${id}/`, { name })).data;
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/inventory/categories/${id}/`);
}

export async function createSubCategory(category: number, name: string): Promise<SubCategory> {
  return (await apiClient.post("/inventory/subcategories/", { category, name })).data;
}

export async function updateSubCategory(id: number, name: string): Promise<SubCategory> {
  return (await apiClient.patch(`/inventory/subcategories/${id}/`, { name })).data;
}

export async function deleteSubCategory(id: number): Promise<void> {
  await apiClient.delete(`/inventory/subcategories/${id}/`);
}

export async function importRows(
  project: number,
  rows: Record<string, string>[]
): Promise<ImportResult> {
  return (await apiClient.post("/inventory/items/import/", { project, rows })).data;
}

/** Validates (dryRun = true) or applies (dryRun = false) a list of items as one transaction. */
export async function bulkItems(
  project: number,
  items: unknown[],
  dryRun: boolean
): Promise<BulkResult> {
  return (
    await apiClient.post("/inventory/items/bulk/", { project, items, dry_run: dryRun })
  ).data;
}

// ── Helpers ─────────────────────────────────────────────────────────────
export const labelOf = (list: readonly { value: string; label: string }[], value: string) =>
  list.find((o) => o.value === value)?.label ?? value;

/** Short unit text for display: "kg", "m²"; "" for count. */
export const unitShort = (unit: string) =>
  UNITS.find((u) => u.value === unit)?.short ?? "";

/** Unit text for table columns: "kg", "m²", and "nos" for count. */
export const unitText = (unit: string) => unitShort(unit) || "nos";

/** "2.500" -> "2.5", "3.000" -> "3". Blank -> "—". */
export const fmtQty = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === ""
    ? "—"
    : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 });

/** Formats an amount in rupees, e.g. "20000.00" -> "₹20,000". Blank -> "—". */
export const money = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === ""
    ? "—"
    : `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Turns an axios/DRF error into a readable string. Shows `detail` when
 * present, otherwise every field error ("name: This field is required."). */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as unknown;
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (typeof d.detail === "string") return d.detail;
      const parts = Object.entries(d).map(
        ([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(" ") : String(msg)}`
      );
      if (parts.length) return parts.join(" | ");
    }
    if (typeof err.message === "string" && err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}