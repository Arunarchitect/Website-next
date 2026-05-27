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

// ── API Response Types ────────────────────────────────────────

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

export interface ApiSurveyFinishBreakdown {
  finish_level: string;
  finish_label: string;
  avg_rate: number;
  sample_count: number;
}

export interface ApiSurveyCategoryBreakdown {
  category: string;
  category_label: string;
  avg_rate: number;
  sample_count: number;
  finish_breakdown: ApiSurveyFinishBreakdown[];
}

export interface ApiRateLookup {
  place_id: number;
  category: string | null;
  place_name: string;
  state_name: string;
  country_name: string;
  effective_rate: number | null;
  rate_status: ApiRateStatus;
  survey_breakdown: ApiSurveyCategoryBreakdown[];
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
  sub_ids: ApiSubId[] | null | undefined;
}

export interface ApiProjectTemplate {
  id: number;
  template_id: string;
  label: string;
  description: string;
  icon: string;
  sort_order: number;
  spaces: ApiProjectSpace[] | null | undefined;
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
    countryId?: number | null;
    stateId?: number | null;
    placeId?: number | null;
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

export const fetchRateLookup = (
  placeId: number,
  category?: string,
  finishLevel?: string,
  occupancyType?: string,
) => {
  const params = new URLSearchParams({ place_id: String(placeId) });
  if (category) params.set("category", category);
  if (finishLevel && finishLevel !== "unknown") params.set("finish_level", finishLevel);
  if (occupancyType && occupancyType !== "unknown") params.set("occupancy_type", occupancyType);
  return get<ApiRateLookup>(`${BASE}/rates/lookup/?${params}`);
};

export async function fetchAreaRate(options: {
  countryId: number;
  stateId?: number | null;
  placeId?: number | null;
  category?: string;
  finishLevel?: string;
  occupancyType?: string;
}): Promise<number | null> {
  const { countryId, stateId, placeId, category, finishLevel, occupancyType } = options;
  const params = new URLSearchParams({ country: String(countryId) });
  if (stateId)  params.set("state",  String(stateId));
  if (placeId)  params.set("place",  String(placeId));
  if (category) params.set("category", category);
  if (finishLevel   && finishLevel   !== "unknown") params.set("finish_level",   finishLevel);
  if (occupancyType && occupancyType !== "unknown") params.set("occupancy_type", occupancyType);
  try {
    const data = await get<{ average_rate: number | null; scope: string }>(
      `${BASE}/rates/average/?${params}`,
    );
    return data.average_rate;
  } catch {
    return null;
  }
}

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

// ── General (public) project template — member/admin only ─────

export const saveGeneralProjectTemplate = (payload: ProjectTemplateWritePayload) =>
  post<ApiProjectTemplate>(`${BASE}/templates/projects/`, payload);

// ── Admin: Space Templates ────────────────────────────────────

export const createSpaceTemplate = (payload: SpaceTemplateWritePayload) =>
  post<ApiSpaceTemplate>(`${BASE}/templates/spaces/`, payload);

export const updateSpaceTemplate = (id: number, payload: SpaceTemplateWritePayload) =>
  put<ApiSpaceTemplate>(`${BASE}/templates/spaces/${id}/`, payload);

export const deleteSpaceTemplate = (id: number) =>
  del(`${BASE}/templates/spaces/${id}/`);

// ── Admin: Project Templates ──────────────────────────────────

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
    dbId: api.id,           // numeric DB pk — used by saveGeneralProjectTemplate
    name: api.name,
    category: api.category as CategoryKey,
    L: parseFloat(api.default_l),
    B: parseFloat(api.default_b),
    icon: api.icon || "📐",
    description: api.description,
    subSpaces: (api.sub_spaces ?? []).map(
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
    spaces: (api.spaces ?? []).map((s) => ({
      templateId: s.space_template_id,
      floor: s.floor,
      L: parseFloat(s.effective_l),
      B: parseFloat(s.effective_b),
      // ✅ FIX: s.sub_ids may be null/undefined from the API — guard with ?? []
      subIds: (s.sub_ids ?? []).map((sub) => sub.sub_id),
    })),
  };
}