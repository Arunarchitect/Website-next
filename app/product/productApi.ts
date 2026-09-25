/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST;
const API_URL = `${API_BASE_URL}/api`;

export type Role = "client" | "architect";
export type MembershipRole = "admin" | "manager" | "member" | "client";

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "IfcSanitaryTerminal", label: "Sanitary Terminal" },
  { id: "IfcFlowTerminal", label: "Flow Terminal" },
  { id: "IfcElectricAppliance", label: "Electric Appliance" },
  { id: "IfcFurnishingElement", label: "Furnishing Element" },
  { id: "IfcLightFixture", label: "Lighting Fixture" },
  { id: "IfcDoor", label: "Door" },
  { id: "IfcWindow", label: "Window" },
  { id: "IfcOther", label: "Other" },
];

// Mirrors Product.IFC_PREDEFINED_TYPES on the backend — code -> label,
// scoped per IFC category. Keep these two in sync.
export const IFC_PREDEFINED_TYPES: Record<string, { code: string; label: string }[]> = {
  IfcSanitaryTerminal: [
    { code: "WASHHANDBASIN", label: "Wash Basin" },
    { code: "SINK", label: "Sink" },
    { code: "BATH", label: "Bathtub" },
    { code: "SHOWER", label: "Shower" },
    { code: "BIDET", label: "Bidet" },
    { code: "TOILETPAN", label: "Toilet (WC Pan)" },
    { code: "URINAL", label: "Urinal" },
    { code: "CISTERN", label: "Cistern" },
    { code: "WCSEAT", label: "WC Seat" },
  ],
  IfcFlowTerminal: [
    { code: "TAP", label: "Tap / Faucet" },
    { code: "SHOWERHEAD", label: "Shower Head" },
    { code: "DIFFUSER", label: "AC Diffuser" },
    { code: "GRILLE", label: "Grille" },
    { code: "SPRINKLER", label: "Sprinkler" },
    { code: "FLOORDRAIN", label: "Floor Drain" },
    { code: "ROOFDRAIN", label: "Roof Drain" },
  ],
  IfcElectricAppliance: [
    { code: "REFRIGERATOR", label: "Refrigerator" },
    { code: "FRIDGE_FREEZER", label: "Fridge-Freezer" },
    { code: "FREEZER", label: "Freezer" },
    { code: "WASHINGMACHINE", label: "Washing Machine" },
    { code: "TUMBLEDRYER", label: "Tumble Dryer" },
    { code: "DISHWASHER", label: "Dishwasher" },
    { code: "MICROWAVE", label: "Microwave" },
    { code: "ELECTRICCOOKER", label: "Electric Cooker" },
    { code: "STOVE", label: "Stove" },
    { code: "ELECTRICHEATER", label: "Electric Heater" },
    { code: "WATERHEATER", label: "Water Heater / Geyser" },
    { code: "WATERCOOLER", label: "Water Cooler" },
    { code: "TV", label: "Television" },
    { code: "HANDDRYER", label: "Hand Dryer" },
  ],
  IfcFurnishingElement: [
    { code: "BED", label: "Bed" },
    { code: "SOFA", label: "Sofa" },
    { code: "WARDROBE", label: "Wardrobe" },
    { code: "KITCHENCABINET", label: "Kitchen Cabinet" },
    { code: "VANITYUNIT", label: "Vanity Unit" },
    { code: "DININGTABLE", label: "Dining Table" },
    { code: "CHAIR", label: "Chair" },
    { code: "DESK", label: "Desk" },
  ],
  IfcLightFixture: [
    { code: "DOWNLIGHT", label: "Downlight" },
    { code: "PENDANT", label: "Pendant Light" },
    { code: "WALLLIGHT", label: "Wall Light" },
    { code: "TRACKLIGHT", label: "Track Light" },
    { code: "CHANDELIER", label: "Chandelier" },
  ],
  IfcDoor: [
    { code: "DOOR", label: "Door" },
    { code: "GATE", label: "Gate" },
    { code: "TRAPDOOR", label: "Trap Door" },
  ],
  IfcWindow: [
    { code: "WINDOW", label: "Window" },
    { code: "SKYLIGHT", label: "Skylight" },
    { code: "LIGHTDOME", label: "Light Dome" },
  ],
  IfcOther: [],
};

export function getPredefinedTypeLabel(category: string, code?: string | null): string {
  if (!code) return "";
  return IFC_PREDEFINED_TYPES[category]?.find((t) => t.code === code)?.label || code;
}

/** e.g. "Wash Basin (Sanitary Terminal)" — falls back to just the category
 * label if no predefined type is set. */
export function getDisplayName(category: string, predefinedType?: string | null): string {
  const catLabel = CATEGORIES.find((c) => c.id === category)?.label || category;
  const typeLabel = getPredefinedTypeLabel(category, predefinedType);
  return typeLabel ? `${typeLabel} (${catLabel})` : catLabel;
}

export interface MyContextEntry {
  organisation: { id: number; name: string };
  project: { id: number; name: string };
  role: MembershipRole;
  has_assignments: boolean;
  assignment_count: number;
}

export interface OrganisationGroup {
  id: number;
  name: string;
  projects: { id: number; name: string; role: MembershipRole; has_assignments: boolean; assignment_count: number }[];
}

export interface Space {
  id: number;
  project: number;
  name: string;
  required_categories: string[];
}

export interface OrganisationProductNote {
  id: number;
  organisation: number;
  organisation_name: string;
  note: string;
  updated_by_name: string | null;
  updated_at: string;
}

// A size/option of a Product (e.g. a water tank's "1000L"). Every priced/
// imaged field here is already resolved server-side (falls back to the
// parent Product when the variant doesn't set its own) — never fall back
// again on the frontend, just use these values directly.
export interface ProductVariant {
  id: number;
  product: string;
  label: string;
  sort_value?: string | null;
  sku?: string;
  base_price?: string | null;
  currency?: string | null;
  cost_price?: string | null;
  variant_image?: string | null;
  variant_thumbnail?: string | null;
  thumbnail_url?: string | null;
  effective_price?: string | null;
  effective_currency?: string | null;
  has_distinct_geometry?: boolean;
  is_default: boolean;
}

// Shared shape for anything the price helpers can price — a ProductItem
// and a ProductVariant both satisfy this structurally, so getPriceInfo/
// formatPrice work on either without needing separate variant-flavoured
// copies of the same logic.
export interface PricedFields {
  base_price?: string | null;
  currency?: string | null;
  effective_price?: string | null;
}

export interface ProductItem {
  id: string;
  category: string;
  // IFC PredefinedType code, scoped to `category` — e.g. WASHHANDBASIN,
  // SINK, DISHWASHER. See IFC_PREDEFINED_TYPES above.
  predefined_type?: string | null;
  predefined_type_label?: string;
  display_name?: string;
  item: string;
  manufacturer: string;
  model_label: string;
  product_link?: string;
  product_image?: string | null;
  thumbnail_url?: string | null;
  base_price?: string | null;
  cost_price?: string | null; 
  currency?: string | null;
  effective_price?: string | null;
  status?: "pending" | "approved" | "rejected";
  // Whether this product has size/option variants — if true, the frontend
  // should have the proposer pick one (from `variants`) before proposing.
  has_variants?: boolean;
  variants?: ProductVariant[];
  // The viewing organisation's own catalog note on this product (from the
  // catalog/assignment endpoints, scoped to one org). Null if none set, or
  // if the response wasn't scoped to a single organisation.
  organisation_note?: OrganisationProductNote | null;
  // Every org note on this product, only populated by the admin/manage
  // catalog endpoint (an admin may administer more than one org).
  organisation_notes?: OrganisationProductNote[];
}

export interface Assignment {
  id: number;
  project: number;
  space: number;
  product: string;
  product_detail: ProductItem;
  variant: number | null;
  variant_detail?: ProductVariant | null;
  proposed_by: Role;
  // The specific user who proposed this — distinct from `proposed_by`'s
  // role bucket. Used to scope removal to "this specific person, or an
  // admin" rather than "anyone on the architect/client side".
  proposed_by_user?: number | null;
  proposer_note: string | null;
  client_confirmed: boolean;
  architect_confirmed: boolean;
  created_at: string;
  declined: boolean;
  declined_by: Role | null;
  declined_at: string | null;
  declined_note: string | null;
}

export interface ProductSuggestionInput {
  space: string;
  category: string;
  predefined_type?: string;
  item: string;
  manufacturer: string;
  model_label: string;
  base_price?: string;
  cost_price?: string; 
  currency?: string;
  product_link?: string;
  product_image?: File | null;
  organisation: number;
}

export const CATALOG_PAGE_SIZE = 12;

export interface PaginatedResult<T> {
  items: T[];
  count: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function roleToUiRole(role: MembershipRole): Role {
  return role === 'client' ? 'client' : 'architect';
}

export function groupByOrganisation(entries: MyContextEntry[]): OrganisationGroup[] {
  const map = new Map<number, OrganisationGroup>();
  for (const e of entries) {
    if (!map.has(e.organisation.id)) {
      map.set(e.organisation.id, { id: e.organisation.id, name: e.organisation.name, projects: [] });
    }
    map.get(e.organisation.id)!.projects.push({
      id: e.project.id,
      name: e.project.name,
      role: e.role,
      has_assignments: e.has_assignments,
      assignment_count: e.assignment_count,
    });
  }
  return Array.from(map.values());
}

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('access') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access') ||
    null
  );
};

export const getImageSource = (
  item?: { product_image?: string | null; thumbnail_url?: string | null } | null,
  opts?: { preferThumbnail?: boolean }
): string => {
  const preferThumbnail = opts?.preferThumbnail ?? false;
  const path = preferThumbnail
    ? item?.thumbnail_url || item?.product_image
    : item?.product_image || item?.thumbnail_url;

  if (!path) return '/images/test.jpg';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE_URL || 'http://localhost:8000';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Image source for a variant, falling back to the product's own image if
 * the variant doesn't have a distinct one (thumbnail_url already resolves
 * that server-side, this just gets it into getImageSource's expected shape). */
export const getVariantImageSource = (
  variant: ProductVariant,
  opts?: { preferThumbnail?: boolean }
): string =>
  getImageSource(
    { product_image: variant.variant_image ?? null, thumbnail_url: variant.thumbnail_url ?? null },
    opts
  );

export const formatPrice = (item: PricedFields): string | null => {
  const value = item.effective_price ?? item.base_price;
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return `${item.currency || 'INR'} ${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export interface PriceInfo {
  currency: string;
  effective: number | null;
  base: number | null;
  differs: boolean;
  diffPct: number | null;
}

export const getPriceInfo = (item: PricedFields): PriceInfo => {
  const currency = item.currency || 'INR';

  const baseRaw = item.base_price;
  const effectiveRaw = item.effective_price ?? item.base_price;

  const base =
    baseRaw !== null && baseRaw !== undefined && baseRaw !== '' ? Number(baseRaw) : null;
  const effective =
    effectiveRaw !== null && effectiveRaw !== undefined && effectiveRaw !== ''
      ? Number(effectiveRaw)
      : null;

  const validBase = base !== null && !Number.isNaN(base);
  const validEffective = effective !== null && !Number.isNaN(effective);

  const differs = validBase && validEffective && base !== effective;
  const diffPct =
    differs && validBase && base !== 0 ? ((effective! - base!) / base!) * 100 : null;

  return {
    currency,
    effective: validEffective ? (effective as number) : null,
    base: validBase ? (base as number) : null,
    differs: !!differs,
    diffPct,
  };
};

function redirectToLogin() {
  if (typeof window === 'undefined') return;

  const current = window.location.pathname + window.location.search;
  const shouldAttachNext = current && current !== '/' && !current.startsWith('/auth/login');

  const target = shouldAttachNext
    ? `/auth/login?next=${encodeURIComponent(current)}`
    : '/auth/login';

  if (window.location.pathname + window.location.search !== target) {
    window.location.href = target;
  }
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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

export async function getMyProductContext(): Promise<MyContextEntry[]> {
  const res = await apiClient.get('/product/my-context/');
  return unwrapList<MyContextEntry>(res.data);
}

export async function getSpaces(projectId: number): Promise<Space[]> {
  const res = await apiClient.get('/product/spaces/', { params: { project: projectId } });
  return unwrapList<Space>(res.data);
}

export async function getProductsByCategory(
  category: string,
  projectId: number,
  opts?: { search?: string; page?: number; predefinedType?: string }
): Promise<PaginatedResult<ProductItem>> {
  const params: any = { project: projectId, page_size: CATALOG_PAGE_SIZE };
  if (category) params.category = category;
  if (opts?.predefinedType) params.predefined_type = opts.predefinedType;
  if (opts?.search) params.search = opts.search;
  if (opts?.page) params.page = opts.page;

  const res = await apiClient.get('/product/products/catalog/', { params });
  const data = res.data;

  if (Array.isArray(data)) {
    return { items: data, count: data.length, hasNext: false, hasPrevious: false };
  }

  return {
    items: unwrapList<ProductItem>(data),
    count: data.count ?? 0,
    hasNext: !!data.next,
    hasPrevious: !!data.previous,
  };
}

export async function getAssignments(projectId: number, spaceId?: number): Promise<Assignment[]> {
  const params: any = { project: projectId };
  if (spaceId) params.space = spaceId;
  const res = await apiClient.get('/product/assignments/', { params });
  return unwrapList<Assignment>(res.data);
}

export async function proposeAssignment(
  projectId: number,
  spaceId: number,
  productId: string,
  role: Role,
  note?: string,
  variantId?: number | null
): Promise<Assignment> {
  const res = await apiClient.post('/product/assignments/', {
    project: projectId,
    space: spaceId,
    product: productId,
    variant: variantId ?? undefined,
    proposed_by: role,
    proposer_note: note?.trim() || undefined,
    client_confirmed: role === 'client',
    architect_confirmed: role === 'architect',
  });
  return res.data;
}

export async function confirmAssignment(id: number, role: Role): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/confirm/`, { role });
  return res.data;
}

export async function removeAssignment(id: number): Promise<void> {
  await apiClient.delete(`/product/assignments/${id}/`);
}

export async function declineAssignment(id: number, note?: string): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/decline/`, {
    note: note?.trim() || undefined,
  });
  return res.data;
}

export async function undeclineAssignment(id: number): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/undecline/`);
  return res.data;
}

export async function editAssignmentNote(id: number, note: string): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/edit_note/`, {
    note: note.trim() || undefined,
  });
  return res.data;
}

export async function suggestProduct(input: ProductSuggestionInput): Promise<ProductItem> {
  const fd = new FormData();
  fd.append('space', input.space);
  fd.append('category', input.category);
  if (input.predefined_type) fd.append('predefined_type', input.predefined_type);
  fd.append('item', input.item);
  fd.append('manufacturer', input.manufacturer);
  fd.append('model_label', input.model_label);
  if (input.base_price) fd.append('base_price', input.base_price);
  if (input.currency) fd.append('currency', input.currency);
  if (input.product_link) fd.append('product_link', input.product_link);
  if (input.product_image) fd.append('product_image', input.product_image);
  if (input.cost_price) fd.append('cost_price', input.cost_price);   // NEW
  fd.append('organisation', String(input.organisation));

  const res = await apiClient.post('/product/products/suggest/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function updateProductSuggestion(
  id: string,
  input: Partial<Omit<ProductSuggestionInput, 'space' | 'organisation'>>
): Promise<ProductItem> {
  const fd = new FormData();
  if (input.category !== undefined) fd.append('category', input.category);
  if (input.predefined_type !== undefined) fd.append('predefined_type', input.predefined_type);
  if (input.item !== undefined) fd.append('item', input.item);
  if (input.manufacturer !== undefined) fd.append('manufacturer', input.manufacturer);
  if (input.model_label !== undefined) fd.append('model_label', input.model_label);
  if (input.base_price !== undefined) fd.append('base_price', input.base_price);
  if (input.cost_price !== undefined) fd.append('cost_price', input.cost_price); 
  if (input.currency !== undefined) fd.append('currency', input.currency);
  if (input.product_link !== undefined) fd.append('product_link', input.product_link);
  if (input.product_image) fd.append('product_image', input.product_image);

  const res = await apiClient.patch(`/product/products/${id}/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteProductSuggestion(id: string): Promise<void> {
  await apiClient.delete(`/product/products/${id}/`);
}

export async function createSpace(
  projectId: number,
  name: string,
  required_categories: string[]
): Promise<Space> {
  const res = await apiClient.post('/product/spaces/', {
    project: projectId,
    name,
    required_categories,
  });
  return res.data;
}

export async function updateSpace(
  id: number,
  data: Partial<Pick<Space, 'name' | 'required_categories'>>
): Promise<Space> {
  const res = await apiClient.patch(`/product/spaces/${id}/`, data);
  return res.data;
}

export async function deleteSpace(id: number): Promise<void> {
  await apiClient.delete(`/product/spaces/${id}/`);
}

// ── Organisation catalog notes (per-org, admin-only) ─────────────────────
export interface SetOrganisationNoteResponse {
  organisation_note: OrganisationProductNote | null;
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { detail?: string } | undefined;
    if (data && typeof data.detail === 'string') return data.detail;
    if (typeof err.message === 'string' && err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Set (or clear, by passing an empty string) the calling organisation's own
 * catalog note on a product. Backend enforces that the caller is an admin
 * of `organisationId` — passing an org you don't admin gets a 403.
 */
export async function setOrganisationNote(
  productId: string,
  organisationId: number,
  note: string
): Promise<OrganisationProductNote | null> {
  try {
    const res = await apiClient.post<SetOrganisationNoteResponse>(
      `/product/products/${productId}/organisation_note/`,
      { organisation: organisationId, note }
    );
    return res.data?.organisation_note ?? null;
  } catch (err: unknown) {
    throw new Error(getApiErrorMessage(err, "Couldn't save the organisation note."));
  }
}