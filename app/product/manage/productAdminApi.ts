/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST;
const API_URL = `${API_BASE_URL}/api`;

export type ProductStatus = 'pending' | 'approved' | 'rejected';

export interface DiscountTier {
  id: number;
  product: string;
  variant: number | null;
  tier_name: string;
  min_quantity: number;
  max_quantity: number;
  discount_percentage: string;
}

export interface IFCModel {
  id: number;
  product: string | null;
  variant: number | null;
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
  variant: number | null;
  project: number;
  discounted_price: string | null;
  discount_percentage: string | null;
  notes: string | null;
}

export interface OrganisationPricing {
  id: number;
  product: string;
  variant: number | null;
  organisation: number;
  discounted_price: string | null;
  discount_percentage: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
}

export interface OrganisationProductNote {
  id: number;
  organisation: number;
  organisation_name: string;
  note: string;
  updated_by_name: string | null;
  updated_at: string;
}

export interface ProductVariant {
  id: number;
  product: string;
  label: string;
  sort_value: string | null;
  sku: string;
  base_price: string | null;
  currency: string | null;
  cost_price: string | null;
  variant_image: string | null;
  variant_thumbnail: string | null;
  is_default: boolean;
  effective_price?: string | null;
  effective_currency?: string | null;
  thumbnail_url?: string | null;
  has_distinct_geometry?: boolean;
  ifc_model: IFCModel | null;
  created_at: string;
  updated_at: string;
}

export interface VariantFormValues {
  label: string;
  sort_value?: string;
  sku?: string;
  base_price?: string;
  currency?: string;
  cost_price?: string;
  variant_image?: File | null;
  is_default?: boolean;
}

export interface AdminProduct {
  id: string;
  space: string;
  category: string;
  predefined_type: string | null;
  predefined_type_label?: string;
  display_name?: string;
  item: string;
  manufacturer: string;
  model_label: string;
  base_price: string | null;
  currency: string | null;
  cost_price: string | null;
  product_link: string | null;
  product_image: string | null;
  variants: ProductVariant[];
  has_variants?: boolean;
  discount_tiers: DiscountTier[];
  ifc_model: IFCModel | null;
  project_pricing_rules: ProjectPricing[];
  organisation_pricing_rules: OrganisationPricing[];
  organisation_notes?: OrganisationProductNote[];
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
  predefined_type?: string;
  item: string;
  manufacturer: string;
  model_label: string;
  base_price?: string;
  currency?: string;
  cost_price?: string;
  product_link?: string;
  product_image?: File | null;
}

export interface AdminOrganisation {
  id: number;
  name: string;
}

export interface AdminProject {
  id: number;
  name: string;
  organisation: number;
  organisation_name: string;
}

export interface AdminScope {
  organisations: AdminOrganisation[];
  projects: AdminProject[];
}

/** Where a file/pricing rule attaches: the whole product, or one variant.
 * Exactly one of the two should be set. */
export type OwnerTarget = { productId?: string; variantId?: number };

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
  if (values.predefined_type) fd.append('predefined_type', values.predefined_type);
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

// ── Variants ──────────────────────────────────────────────────────────
function buildVariantFormData(values: Partial<VariantFormValues>, productId?: string): FormData {
  const fd = new FormData();
  if (productId) fd.append('product', productId);
  if (values.label !== undefined) fd.append('label', values.label);
  if (values.sort_value) fd.append('sort_value', values.sort_value);
  if (values.sku !== undefined) fd.append('sku', values.sku);
  if (values.base_price) fd.append('base_price', values.base_price);
  if (values.currency) fd.append('currency', values.currency);
  if (values.cost_price) fd.append('cost_price', values.cost_price);
  if (values.variant_image) fd.append('variant_image', values.variant_image);
  if (values.is_default !== undefined) fd.append('is_default', String(values.is_default));
  return fd;
}

export async function createVariant(productId: string, values: VariantFormValues): Promise<ProductVariant> {
  const fd = buildVariantFormData(values, productId);
  const res = await apiClient.post('/product/variants/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function updateVariant(id: number, values: Partial<VariantFormValues>): Promise<ProductVariant> {
  const fd = buildVariantFormData(values);
  const res = await apiClient.patch(`/product/variants/${id}/`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deleteVariant(id: number): Promise<void> {
  await apiClient.delete(`/product/variants/${id}/`);
}

// ── Discount tiers ───────────────────────────────────────────────────
export async function addDiscountTier(
  target: OwnerTarget,
  tier: Omit<DiscountTier, 'id' | 'product' | 'variant'>
): Promise<DiscountTier> {
  const res = await apiClient.post('/product/discount-tiers/', {
    ...tier,
    product: target.productId ?? null,
    variant: target.variantId ?? null,
  });
  return res.data;
}
export async function deleteDiscountTier(id: number): Promise<void> {
  await apiClient.delete(`/product/discount-tiers/${id}/`);
}

// ── IFC model file ───────────────────────────────────────────────────
// Exactly one of target.productId / target.variantId should be set —
// product-owned = the shared/default geometry; variant-owned = that
// variant's own geometry, overriding the inherited one just for it.
export async function uploadIfcModel(
  target: OwnerTarget,
  file: File,
  schemaVersion?: string
): Promise<IFCModel> {
  const fd = new FormData();
  if (target.productId) fd.append('product', target.productId);
  if (target.variantId) fd.append('variant', String(target.variantId));
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

// ── Project / Organisation pricing overrides ─────────────────────────
// variantId omitted (or null) = a product-wide rule that applies to
// every variant; set it to scope the rule to one variant only.
export async function addProjectPricing(
  productId: string,
  projectId: number,
  data: Partial<Pick<ProjectPricing, 'discounted_price' | 'discount_percentage' | 'notes'>>,
  variantId?: number
): Promise<ProjectPricing> {
  const res = await apiClient.post('/product/project-pricing/', {
    ...data,
    product: productId,
    project: projectId,
    variant: variantId ?? null,
  });
  return res.data;
}

export async function updateProjectPricing(
  id: number,
  projectId: number,
  data: Partial<Pick<ProjectPricing, 'discounted_price' | 'discount_percentage' | 'notes'>>,
  variantId?: number
): Promise<ProjectPricing> {
  const res = await apiClient.patch(`/product/project-pricing/${id}/`, {
    ...data,
    project: projectId,
    variant: variantId ?? null,
  });
  return res.data;
}

export async function deleteProjectPricing(id: number): Promise<void> {
  await apiClient.delete(`/product/project-pricing/${id}/`);
}

export async function addOrganisationPricing(
  productId: string,
  organisationId: number,
  data: Partial<Pick<OrganisationPricing, 'discounted_price' | 'discount_percentage'>>,
  variantId?: number
): Promise<OrganisationPricing> {
  const res = await apiClient.post('/product/organisation-pricing/', {
    ...data,
    product: productId,
    organisation: organisationId,
    variant: variantId ?? null,
  });
  return res.data;
}

export async function updateOrganisationPricing(
  id: number,
  organisationId: number,
  data: Partial<Pick<OrganisationPricing, 'discounted_price' | 'discount_percentage'>>,
  variantId?: number
): Promise<OrganisationPricing> {
  const res = await apiClient.patch(`/product/organisation-pricing/${id}/`, {
    ...data,
    organisation: organisationId,
    variant: variantId ?? null,
  });
  return res.data;
}

export async function deleteOrganisationPricing(id: number): Promise<void> {
  await apiClient.delete(`/product/organisation-pricing/${id}/`);
}

// ── Review workflow ───────────────────────────────────────────────────
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

// ── Admin scope ────────────────────────────────────────────────────────
export async function getAdminScope(): Promise<AdminScope> {
  const res = await apiClient.get('/product/admin-scope/');
  return res.data;
}

// ── Organisation catalog notes ────────────────────────────────────────
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