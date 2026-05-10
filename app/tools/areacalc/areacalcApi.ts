// areacalcApi.ts

const HOST = process.env.NEXT_PUBLIC_HOST;
const BASE = `${HOST}/api/areacalc`;

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

// ── Fetch Helpers ─────────────────────────────────────────────

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

export const fetchCountries = () =>
  get<ApiCountry[]>(`${BASE}/geography/countries/`);

export const fetchStates = (countryId: number) =>
  get<ApiState[]>(`${BASE}/geography/states/?country=${countryId}`);

export const fetchPlaces = (stateId: number) =>
  get<ApiPlace[]>(`${BASE}/geography/places/?state=${stateId}`);

export const fetchRateLookup = (placeId: number, category?: string) =>
  get<ApiRateLookup>(
    `${BASE}/rates/lookup/?place_id=${placeId}${category ? `&category=${category}` : ""}`,
  );

export const fetchSpaceTemplates = () =>
  get<ApiSpaceTemplate[]>(`${BASE}/templates/spaces/`);

export const fetchProjectTemplates = () =>
  get<ApiProjectTemplate[]>(`${BASE}/templates/projects/`);

// ── Transformers: API → Frontend Types ────────────────────────

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