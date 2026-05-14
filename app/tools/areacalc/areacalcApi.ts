// areacalcApi.ts

const HOST = process.env.NEXT_PUBLIC_HOST;
const BASE = `${HOST}/api/areacalc`;

// ── Auth Helpers ──────────────────────────────────────────────

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ── API Response Types (match Django serializers) ─────────────

export interface ApiCountry {
  id: number;
  name: string;
  code: string;
}

export interface ApiState {
  id: number;
  name: string;
  code: string;
  country: number;
  country_name: string;
}

export interface ApiRateStatus {
  source: string;
  sample_count: number;
  label: string;
}

export interface ApiPlace {
  id: number;
  name: string;
  state: number;
  state_name: string;
  country_name: string;
  fallback_rate_per_sqft: string | null;
  effective_rate: number | null;
  rate_status: ApiRateStatus;
}

export interface ApiRateLookup {
  place_id: number;
  category: string | null;
  place_name: string;
  state_name: string;
  country_name: string;
  effective_rate: number | null;
  rate_status: ApiRateStatus;
}

export interface ApiSubSpace {
  id: number;
  sub_id: string;
  name: string;
  default_l: string;
  default_b: string;
  description: string;
  sort_order: number;
}

export interface ApiSpaceTemplate {
  id: number;
  template_id: string;
  name: string;
  category: string;
  default_l: string;
  default_b: string;
  icon: string;
  description: string;
  sort_order: number;
  sub_spaces: ApiSubSpace[];
}

export interface ApiSubId {
  id: number;
  sub_space_template: number;
  sub_id: string;
  sub_name: string;
}

export interface ApiProjectSpace {
  id: number;
  space_template: number;
  space_template_id: string;
  space_name: string;
  floor: number;
  override_l: string | null;
  override_b: string | null;
  effective_l: string;
  effective_b: string;
  sort_order: number;
  sub_ids: ApiSubId[];
}

export interface ApiProjectTemplate {
  id: number;
  template_id: string;
  label: string;
  description: string;
  icon: string;
  sort_order: number;
  spaces: ApiProjectSpace[];
}

export interface ApiMyRole {
  authenticated: boolean;
  role: "anonymous" | "user" | "customer" | "member" | "admin";
  can_save_custom_templates: boolean;
}

export interface ApiCustomProjectTemplate {
  id: number;
  owner: string;
  label: string;
  description: string;
  icon: string;
  data: {
    projectName?: string;
    clientName?: string;
    unit?: string;
    wall?: number;
    circ?: number;
    spaces?: unknown[];
  };
  source_project_template: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Admin write payload types ─────────────────────────────────

export interface SubSpaceWritePayload {
  id?: number;
  sub_id: string;
  name: string;
  default_l: number;
  default_b: number;
  description?: string;
  sort_order?: number;
}

export interface SpaceTemplateWritePayload {
  template_id: string;
  name: string;
  category: string;
  default_l: number;
  default_b: number;
  icon?: string;
  description?: string;
  sort_order?: number;
  sub_spaces?: SubSpaceWritePayload[];
}

export interface ProjectSpaceWritePayload {
  id?: number;
  space_template: number;
  floor: number;
  override_l?: number | null;
  override_b?: number | null;
  sort_order?: number;
  sub_ids?: number[];
}

export interface ProjectTemplateWritePayload {
  template_id: string;
  label: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  spaces?: ProjectSpaceWritePayload[];
}

// ── Fetch Helpers ─────────────────────────────────────────────

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET failed (${res.status}) ${url}\n${text}`);
  }
  return res.json();
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST failed (${res.status}) ${url}\n${text}`);
  }
  return res.json();
}

async function put<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT failed (${res.status}) ${url}\n${text}`);
  }
  return res.json();
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH failed (${res.status}) ${url}\n${text}`);
  }
  return res.json();
}

async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE failed (${res.status}) ${url}\n${text}`);
  }
}

// ── Geography ─────────────────────────────────────────────────

export const fetchCountries = () =>
  get<ApiCountry[]>(`${BASE}/geography/countries/`);

export const fetchStates = (countryId: number) =>
  get<ApiState[]>(`${BASE}/geography/states/?country=${countryId}`);

export const fetchPlaces = (stateId: number) =>
  get<ApiPlace[]>(`${BASE}/geography/places/?state=${stateId}`);

// ── Rate lookup ───────────────────────────────────────────────

export const fetchRateLookup = (placeId: number, category?: string) =>
  get<ApiRateLookup>(
    `${BASE}/rates/lookup/?place_id=${placeId}${category ? `&category=${category}` : ""}`,
  );

// ── Templates (read) ──────────────────────────────────────────

export const fetchSpaceTemplates = () =>
  get<ApiSpaceTemplate[]>(`${BASE}/templates/spaces/`);

export const fetchProjectTemplates = () =>
  get<ApiProjectTemplate[]>(`${BASE}/templates/projects/`);

// ── User / role ───────────────────────────────────────────────

export const fetchMyRole = () =>
  get<ApiMyRole>(`${BASE}/me/role/`);

// ── Custom project templates ──────────────────────────────────

export const fetchCustomProjectTemplates = () =>
  get<ApiCustomProjectTemplate[]>(`${BASE}/templates/custom-projects/`);

export const saveCustomProjectTemplate = (payload: {
  label: string;
  description?: string;
  icon?: string;
  data: unknown;
  source_project_template?: number | null;
}) => post<ApiCustomProjectTemplate>(`${BASE}/templates/custom-projects/`, payload);

export const updateCustomProjectTemplate = (
  id: number,
  payload: Partial<{
    label: string;
    description: string;
    icon: string;
    data: unknown;
    is_active: boolean;
  }>,
) => patch<ApiCustomProjectTemplate>(`${BASE}/templates/custom-projects/${id}/`, payload);

// ── Admin: Space Templates (write) ───────────────────────────

export const createSpaceTemplate = (payload: SpaceTemplateWritePayload) =>
  post<ApiSpaceTemplate>(`${BASE}/templates/spaces/`, payload);

export const updateSpaceTemplate = (id: number, payload: SpaceTemplateWritePayload) =>
  put<ApiSpaceTemplate>(`${BASE}/templates/spaces/${id}/`, payload);

export const deleteSpaceTemplate = (id: number) =>
  del(`${BASE}/templates/spaces/${id}/`);

// ── Admin: Project Templates (write) ─────────────────────────

export const createProjectTemplate = (payload: ProjectTemplateWritePayload) =>
  post<ApiProjectTemplate>(`${BASE}/templates/projects/`, payload);

export const updateProjectTemplate = (id: number, payload: ProjectTemplateWritePayload) =>
  put<ApiProjectTemplate>(`${BASE}/templates/projects/${id}/`, payload);

export const deleteProjectTemplate = (id: number) =>
  del(`${BASE}/templates/projects/${id}/`);

// ── Transformers: API → Frontend Types ───────────────────────

import type {
  SpaceTemplate,
  SubSpaceTemplate,
  ProjectTemplate,
  CategoryKey,
} from "./areadata";

export function toSpaceTemplate(api: ApiSpaceTemplate): SpaceTemplate {
  return {
    id: api.template_id,
    name: api.name,
    category: api.category as CategoryKey,
    L: parseFloat(api.default_l),
    B: parseFloat(api.default_b),
    icon: api.icon || "📐",
    description: api.description,
    subSpaces: api.sub_spaces.map(
      (s): SubSpaceTemplate => ({
        id: s.sub_id,
        name: s.name,
        L: parseFloat(s.default_l),
        B: parseFloat(s.default_b),
        description: s.description,
      }),
    ),
  };
}

export function toProjectTemplate(api: ApiProjectTemplate): ProjectTemplate {
  return {
    id: api.template_id,
    label: api.label,
    description: api.description,
    icon: api.icon || "🏗️",
    spaces: api.spaces.map((s) => ({
      templateId: s.space_template_id,
      floor: s.floor,
      L: parseFloat(s.effective_l),
      B: parseFloat(s.effective_b),
      subIds: s.sub_ids.map((sub) => sub.sub_id),
    })),
  };
}