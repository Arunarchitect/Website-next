/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST;
const API_URL = `${API_BASE_URL}/api`;

export type Role = "client" | "architect";
export type MembershipRole = "admin" | "manager" | "member" | "client";

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "IfcSanitaryTerminal", label: "Sanitary Terminal" },
  { id: "IfcFurnishingElement", label: "Furnishing Element" },
  { id: "IfcFlowTerminal", label: "Flow Terminal" },
  { id: "IfcLightFixture", label: "Lighting Fixture" },
  { id: "IfcOther", label: "Other" },
];

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

export interface ProductItem {
  id: string;
  category: string;
  item: string;
  manufacturer: string;
  model_label: string;
  product_link?: string;
  product_image?: string | null;
  thumbnail_url?: string | null;
  base_price?: string | null;
  currency?: string | null;
  effective_price?: string | null;
  status?: "pending" | "approved" | "rejected";
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
  proposed_by: Role;
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
  item: string;
  manufacturer: string;
  model_label: string;
  base_price?: string;
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

export const formatPrice = (item: ProductItem): string | null => {
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

export const getPriceInfo = (item: ProductItem): PriceInfo => {
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
  opts?: { search?: string; page?: number }
): Promise<PaginatedResult<ProductItem>> {
  const params: any = { project: projectId, page_size: CATALOG_PAGE_SIZE };
  if (category) params.category = category;
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
  note?: string
): Promise<Assignment> {
  const res = await apiClient.post('/product/assignments/', {
    project: projectId,
    space: spaceId,
    product: productId,
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
  fd.append('item', input.item);
  fd.append('manufacturer', input.manufacturer);
  fd.append('model_label', input.model_label);
  if (input.base_price) fd.append('base_price', input.base_price);
  if (input.currency) fd.append('currency', input.currency);
  if (input.product_link) fd.append('product_link', input.product_link);
  if (input.product_image) fd.append('product_image', input.product_image);
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
  if (input.item !== undefined) fd.append('item', input.item);
  if (input.manufacturer !== undefined) fd.append('manufacturer', input.manufacturer);
  if (input.model_label !== undefined) fd.append('model_label', input.model_label);
  if (input.base_price !== undefined) fd.append('base_price', input.base_price);
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