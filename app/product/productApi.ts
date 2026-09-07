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

// Backend already returns entries sorted (active projects first); grouping
// preserves that order since a Map keeps first-seen insertion order.
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

export const getImageSource = (path?: string | null): string => {
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
  role: Role
): Promise<Assignment> {
  const res = await apiClient.post('/product/assignments/', {
    project: projectId,
    space: spaceId,
    product: productId,
    proposed_by: role,
    client_confirmed: role === 'client',
    architect_confirmed: role === 'architect',
  });
  return res.data;
}

export async function confirmAssignment(id: number, role: Role): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/confirm/`, { role });
  return res.data;
}

// Hard delete. Server-side (CanModifyAssignment) only allows this for the
// original proposer or an org admin — everyone else gets a 403 and should
// call declineAssignment instead.
export async function removeAssignment(id: number): Promise<void> {
  await apiClient.delete(`/product/assignments/${id}/`);
}

// Soft "no" from the party that did NOT propose the assignment — flips
// declined/declined_by/declined_at instead of deleting the row. `note` is
// an optional short explanation, visible to both sides afterwards.
export async function declineAssignment(id: number, note?: string): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/decline/`, {
    note: note?.trim() || undefined,
  });
  return res.data;
}

// Reverses a decline. Server-side (CanModifyAssignment) only allows this
// for the UI role that actually declined the assignment — stays available
// until the original proposer permanently removes it via removeAssignment.
export async function undeclineAssignment(id: number): Promise<Assignment> {
  const res = await apiClient.post(`/product/assignments/${id}/undecline/`);
  return res.data;
}

// ── Product suggestion (client proposes a new catalog product) ──────────
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

// Withdraw a product from the catalog. Server-side (CanDeleteProduct) only
// allows this for an org admin (any status) or for the original suggester
// while the product is still pending — once an org admin approves it, the
// client can no longer remove it themselves.
export async function deleteProductSuggestion(id: string): Promise<void> {
  await apiClient.delete(`/product/products/${id}/`);
}

// ── Space management (create/edit/delete spaces for a project) ──────────
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