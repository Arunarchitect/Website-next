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

export interface ProductItem {
  id: string;
  category: string;
  item: string;
  manufacturer: string;
  model_label: string;
  product_link?: string;
  product_image?: string | null;
  // Small, pre-resized (server-generated) copy of product_image. Used for
  // the PDF export where download speed on mobile matters far more than
  // pixel-perfect resolution. The full-size product_image remains what the
  // catalog/assigned list UI displays, so on-screen clarity is unaffected.
  thumbnail_url?: string | null;
  base_price?: string | null;
  currency?: string | null;
  effective_price?: string | null;
  status?: "pending" | "approved" | "rejected";
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

/**
 * Resolves a usable image URL for a product.
 *
 * By default (preferThumbnail=false) this favours the full-resolution
 * product_image — used everywhere the person is actually looking at the
 * picture (catalog cards, assigned-list thumbnails), so on-screen clarity
 * is never reduced.
 *
 * Pass { preferThumbnail: true } for contexts where download size matters
 * more than resolution — currently just the PDF export, where a small
 * server-generated thumbnail is plenty legible on paper/screen and loads
 * far faster on mobile networks than the original upload.
 *
 * Either way, falls back to whichever of the two is actually present, so
 * nothing breaks for older rows that don't have a thumbnail yet.
 */
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

/**
 * Structured price comparison for a product: the "final" price the person
 * actually pays (effective_price, falling back to base_price when there's
 * no override) versus the catalog/MRP price (base_price).
 *
 * - `differs` is true only when both values are present and numerically
 *   different — this is what should gate showing the struck-through MRP
 *   and the +/- badge at all.
 * - `diffPct` is signed: positive means the effective price is HIGHER than
 *   MRP (mark it up, "+X%"), negative means it's LOWER ("-X%", a discount).
 *   It's null whenever there's nothing meaningful to compare against
 *   (missing base price, or base price of 0).
 */
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
  search?: string
): Promise<ProductItem[]> {
  const params: any = { project: projectId };
  if (category) params.category = category;
  if (search) params.search = search;
  const res = await apiClient.get('/product/products/catalog/', { params });
  return unwrapList<ProductItem>(res.data);
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