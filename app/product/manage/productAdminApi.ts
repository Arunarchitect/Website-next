/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST;
const API_URL = `${API_BASE_URL}/api`;

export type ProductStatus = 'pending' | 'approved' | 'rejected';

export interface DiscountTier {
  id: number;
  product: string;
  tier_name: string;
  min_quantity: number;
  max_quantity: number;
  discount_percentage: string;
}

export interface IFCModel {
  id: number;
  product: string;
  file: string;
  file_name: string;
  file_size_mb: string | null;
  schema_version: string | null;
  download_count: number;
  is_downloadable: boolean;
}

export interface ProjectPricing {
  id: number;
  product: string;
  project: number;
  discounted_price: string | null;
  discount_percentage: string | null;
  notes: string | null;
}

export interface OrganisationPricing {
  id: number;
  product: string;
  organisation: number;
  discounted_price: string | null;
  discount_percentage: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
}

export interface AdminProduct {
  id: string;
  space: string;
  category: string;
  item: string;
  manufacturer: string;
  model_label: string;
  base_price: string | null;
  currency: string | null;
  cost_price: string | null;
  product_link: string | null;
  product_image: string | null;
  discount_tiers: DiscountTier[];
  ifc_model: IFCModel | null;
  project_pricing_rules: ProjectPricing[];
  organisation_pricing_rules: OrganisationPricing[];
  // Review workflow
  status: ProductStatus;
  organisation: number | null;
  organisation_name?: string | null;
  uploaded_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductFormValues {
  space: string;
  category: string;
  item: string;
  manufacturer: string;
  model_label: string;
  base_price?: string;
  currency?: string;
  cost_price?: string;
  product_link?: string;
  product_image?: File | null;
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

const apiClient = axios.create({ baseURL: API_URL, withCredentials: true });

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

function buildFormData(values: ProductFormValues): FormData {
  const fd = new FormData();
  fd.append('space', values.space);
  fd.append('category', values.category);
  fd.append('item', values.item);
  fd.append('manufacturer', values.manufacturer);
  fd.append('model_label', values.model_label);
  if (values.base_price) fd.append('base_price', values.base_price);
  if (values.currency) fd.append('currency', values.currency);
  if (values.cost_price) fd.append('cost_price', values.cost_price);
  if (values.product_link) fd.append('product_link', values.product_link);
  if (values.product_image) fd.append('product_image', values.product_image);
  return fd;
}

export async function getAdminProducts(search?: string): Promise<AdminProduct[]> {
  const res = await apiClient.get('/product/products/admin_list/', { params: search ? { search } : {} });
  return unwrapList<AdminProduct>(res.data);
}

export async function getAdminProduct(id: string): Promise<AdminProduct> {
  const res = await apiClient.get(`/product/products/${id}/`);
  return res.data;
}

export async function createProduct(values: ProductFormValues): Promise<AdminProduct> {
  const fd = buildFormData(values);
  const res = await apiClient.post('/product/products/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function updateProduct(id: string, values: Partial<ProductFormValues>): Promise<AdminProduct> {
  const fd = new FormData();
  Object.entries(values).forEach(([key, val]) => {
    if (val === undefined || val === null) return;
    if (key === 'product_image' && val instanceof File) {
      fd.append('product_image', val);
    } else if (key !== 'product_image') {
      fd.append(key, String(val));
    }
  });
  const res = await apiClient.patch(`/product/products/${id}/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/product/products/${id}/`);
}

// Discount tiers
export async function addDiscountTier(productId: string, tier: Omit<DiscountTier, 'id' | 'product'>): Promise<DiscountTier> {
  const res = await apiClient.post('/product/discount-tiers/', { ...tier, product: productId });
  return res.data;
}
export async function deleteDiscountTier(id: number): Promise<void> {
  await apiClient.delete(`/product/discount-tiers/${id}/`);
}

// IFC model file
export async function uploadIfcModel(productId: string, file: File, schemaVersion?: string): Promise<IFCModel> {
  const fd = new FormData();
  fd.append('product', productId);
  fd.append('file', file);
  if (schemaVersion) fd.append('schema_version', schemaVersion);
  const res = await apiClient.post('/product/ifc-models/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
export async function deleteIfcModel(id: number): Promise<void> {
  await apiClient.delete(`/product/ifc-models/${id}/`);
}

// Project / Organisation pricing overrides
export async function addProjectPricing(
  productId: string,
  projectId: number,
  data: Partial<Pick<ProjectPricing, 'discounted_price' | 'discount_percentage' | 'notes'>>
): Promise<ProjectPricing> {
  const res = await apiClient.post('/product/project-pricing/', { ...data, product: productId, project: projectId });
  return res.data;
}
export async function deleteProjectPricing(id: number): Promise<void> {
  await apiClient.delete(`/product/project-pricing/${id}/`);
}

export async function addOrganisationPricing(
  productId: string,
  organisationId: number,
  data: Partial<Pick<OrganisationPricing, 'discounted_price' | 'discount_percentage'>>
): Promise<OrganisationPricing> {
  const res = await apiClient.post('/product/organisation-pricing/', { ...data, product: productId, organisation: organisationId });
  return res.data;
}
export async function deleteOrganisationPricing(id: number): Promise<void> {
  await apiClient.delete(`/product/organisation-pricing/${id}/`);
}

// ── Review workflow (org admin) ──────────────────────────────────────────
export async function getPendingProducts(): Promise<AdminProduct[]> {
  const res = await apiClient.get('/product/products/pending/');
  return unwrapList<AdminProduct>(res.data);
}

export async function approveProduct(id: string): Promise<AdminProduct> {
  const res = await apiClient.post(`/product/products/${id}/approve/`);
  return res.data;
}

export async function rejectProduct(id: string, rejection_reason: string): Promise<AdminProduct> {
  const res = await apiClient.post(`/product/products/${id}/reject/`, { rejection_reason });
  return res.data;
}