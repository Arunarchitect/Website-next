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
  const params: any = { category, project: projectId };
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

export async function removeAssignment(id: number): Promise<void> {
  await apiClient.delete(`/product/assignments/${id}/`);
}