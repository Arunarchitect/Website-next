const BASE = process.env.NEXT_PUBLIC_HOST;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ─── Geography ────────────────────────────────────────────────

export interface Country {
  id: number;
  name: string;
  code: string;
}

export interface State {
  id: number;
  name: string;
  code: string;
  country: number;
  country_name: string;
}

export interface Place {
  id: number;
  name: string;
  state: number;
  state_name: string;
  country_name: string;
  country_id: number;
  fallback_rate_per_sqft: string | null;
  effective_rate: number | null;
  rate_status: {
    source: "survey" | "survey_all_categories" | "fallback";
    sample_count: number;
    label: string;
  };
}

// ─── Survey Rate Entries ──────────────────────────────────────

export type SourceType =
  | "architect"
  | "contractor"
  | "engineer"
  | "client"
  | "completed_project"
  | "other";

export type ProjectCategory =
  | "residence"
  | "school"
  | "commercial"
  | "healthcare"
  | "hospitality";

export type FinishLevel = "basic" | "standard" | "premium" | "luxury" | "unknown";

export interface SurveyRateEntry {
  id: number;
  place: number;
  place_name: string;
  state_name: string;
  country_name: string;
  source_name: string;
  source_type: SourceType;
  // contact fields
  contact_email: string;
  contact_phone_country_code: string;
  contact_phone: string;
  project_category: ProjectCategory;
  rate_per_sqft: string;
  finish_level: FinishLevel;
  location_note: string;
  surveyed_on: string | null;
  notes: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveyRateEntryPayload {
  place: number;
  source_name?: string;
  source_type: SourceType;
  // contact fields (all optional)
  contact_email?: string;
  contact_phone_country_code?: string;
  contact_phone?: string;
  project_category: ProjectCategory;
  rate_per_sqft: number;
  finish_level?: FinishLevel;
  location_note?: string;
  surveyed_on?: string | null;
  notes?: string;
}

// ─── Geography API functions ──────────────────────────────────

export async function fetchCountries(): Promise<Country[]> {
  const res = await fetch(`${BASE}/api/areacalc/geography/countries/`);
  if (!res.ok) throw new Error(`Countries fetch failed: ${res.status}`);
  return res.json() as Promise<Country[]>;
}

export async function fetchStates(countryId?: number): Promise<State[]> {
  const url = countryId
    ? `${BASE}/api/areacalc/geography/states/?country=${countryId}`
    : `${BASE}/api/areacalc/geography/states/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`States fetch failed: ${res.status}`);
  return res.json() as Promise<State[]>;
}

export async function fetchPlaces(stateId?: number): Promise<Place[]> {
  const url = stateId
    ? `${BASE}/api/areacalc/geography/places/?state=${stateId}`
    : `${BASE}/api/areacalc/geography/places/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places fetch failed: ${res.status}`);
  return res.json() as Promise<Place[]>;
}

// ─── Geography create (member/admin only) ─────────────────────

export async function createCountry(name: string, code: string): Promise<Country> {
  const res = await fetch(`${BASE}/api/areacalc/geography/countries/create/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string; name?: string[]; code?: string[] };
    throw new Error(
      data.detail ?? data.name?.[0] ?? data.code?.[0] ?? `Country create failed: ${res.status}`
    );
  }
  return res.json() as Promise<Country>;
}

export async function createState(name: string, code: string, countryId: number): Promise<State> {
  const res = await fetch(`${BASE}/api/areacalc/geography/states/create/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, code, country: countryId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string; name?: string[] };
    throw new Error(data.detail ?? data.name?.[0] ?? `State create failed: ${res.status}`);
  }
  return res.json() as Promise<State>;
}

export async function createPlace(name: string, stateId: number): Promise<Place> {
  const res = await fetch(`${BASE}/api/areacalc/geography/places/create/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, state: stateId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string; name?: string[] };
    throw new Error(data.detail ?? data.name?.[0] ?? `Place create failed: ${res.status}`);
  }
  return res.json() as Promise<Place>;
}

// ─── Survey entries ───────────────────────────────────────────

export async function submitSurveyEntry(
  payload: SurveyRateEntryPayload
): Promise<SurveyRateEntry> {
  const res = await fetch(`${BASE}/api/areacalc/rates/survey/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail ?? `Survey submission failed: ${res.status}`);
  }
  return res.json() as Promise<SurveyRateEntry>;
}

export async function fetchSurveyEntries(filters?: {
  place?: number;
  project_category?: ProjectCategory;
  is_approved?: boolean;
}): Promise<SurveyRateEntry[]> {
  const params = new URLSearchParams();
  if (filters?.place) params.set("place", String(filters.place));
  if (filters?.project_category) params.set("project_category", filters.project_category);
  if (filters?.is_approved !== undefined)
    params.set("is_approved", String(filters.is_approved));

  const url = `${BASE}/api/areacalc/rates/survey/${params.toString() ? "?" + params : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Survey entries fetch failed: ${res.status}`);
  return res.json() as Promise<SurveyRateEntry[]>;
}

export async function approveSurveyEntry(
  id: number,
  is_approved: boolean
): Promise<{ id: number; is_approved: boolean }> {
  const res = await fetch(`${BASE}/api/areacalc/rates/survey/${id}/approve/`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ is_approved }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(data.detail ?? `Approve failed: ${res.status}`);
  }
  return res.json() as Promise<{ id: number; is_approved: boolean }>;
}

export async function deleteSurveyEntry(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/areacalc/rates/survey/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}