"use client";

import { useEffect, useState } from "react";
import { fetchMyRole, canAccessSurvey, AreacalcRole } from "./roleapi";
import {
  fetchCountries,
  fetchStates,
  fetchPlaces,
  createCountry,
  createState,
  createPlace,
  submitSurveyEntry,
  Country,
  State,
  Place,
  SourceType,
  ProjectCategory,
  FinishLevel,
  SurveyRateEntryPayload,
} from "./surveyapi";

// ─── Static option maps ───────────────────────────────────────

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  architect: "Architect",
  contractor: "Contractor",
  engineer: "Engineer",
  client: "Client",
  completed_project: "Completed Project",
  other: "Other",
};

const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  residence: "Residence",
  school: "Education / School",
  commercial: "Commercial",
  healthcare: "Healthcare",
  hospitality: "Hospitality",
};

const FINISH_LEVEL_LABELS: Record<FinishLevel, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  luxury: "Luxury",
  unknown: "Unknown",
};

// Common country codes for phone prefix helper
const COMMON_COUNTRY_CODES = [
  { code: "+91", label: "+91 (India)" },
  { code: "+1", label: "+1 (US/Canada)" },
  { code: "+44", label: "+44 (UK)" },
  { code: "+971", label: "+971 (UAE)" },
  { code: "+65", label: "+65 (Singapore)" },
  { code: "+49", label: "+49 (Germany)" },
  { code: "+61", label: "+61 (Australia)" },
  { code: "+33", label: "+33 (France)" },
];

// ─── Form state ───────────────────────────────────────────────

interface FormState {
  countryId: string;
  stateId: string;
  placeId: string;
  source_name: string;
  source_type: SourceType | "";
  contact_email: string;
  contact_phone_country_code: string;
  contact_phone: string;
  project_category: ProjectCategory | "";
  rate_per_sqft: string;
  finish_level: FinishLevel;
  location_note: string;
  surveyed_on: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  countryId: "",
  stateId: "",
  placeId: "",
  source_name: "",
  source_type: "",
  contact_email: "",
  contact_phone_country_code: "+91",
  contact_phone: "",
  project_category: "",
  rate_per_sqft: "",
  finish_level: "unknown",
  location_note: "",
  surveyed_on: "",
  notes: "",
};

// ─── Inline "add new" modal state ────────────────────────────

type AddGeoMode = "country" | "state" | "place" | null;

interface AddGeoState {
  mode: AddGeoMode;
  name: string;
  code: string; // for country/state
  loading: boolean;
  error: string | null;
}

const EMPTY_ADD_GEO: AddGeoState = {
  mode: null,
  name: "",
  code: "",
  loading: false,
  error: null,
};

// ─── Access denied screen ─────────────────────────────────────

function AccessDenied({ role }: { role: AreacalcRole }) {
  const isAnonymous = role === "anonymous";
  return (
    <div className="min-h-screen bg-[#f5f2ec] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto mb-6">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="#a8a29e" strokeWidth="1.5" />
            <path
              d="M8 8.5C8 6.843 9.343 5.5 11 5.5s3 1.343 3 3v1.5H8V8.5z"
              stroke="#a8a29e"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <rect x="7" y="10" width="8" height="6.5" rx="1" stroke="#a8a29e" strokeWidth="1.5" />
            <circle cx="11" cy="13.25" r="0.75" fill="#a8a29e" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-stone-800 mb-2 tracking-tight">
          {isAnonymous ? "Sign in required" : "Access restricted"}
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          {isAnonymous
            ? "You need to sign in to access the survey tool."
            : "Survey data entry is only available to members and admins."}
        </p>
        {!isAnonymous && (
          <p className="text-xs text-stone-400 mt-2">
            Your current role:{" "}
            <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
              {role}
            </span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-2">
          {isAnonymous && (
            <a
              href="/auth/login?next=/tools/areacalc/survey"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
            >
              Sign in
            </a>
          )}
          <a
            href="/tools/areacalc"
            className="inline-flex items-center justify-center gap-2 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
          >
            Back to areacalc
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#f5f2ec] flex items-center justify-center">
      <div className="flex items-center gap-3 text-stone-400">
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="#d6d3d1" strokeWidth="1.5" strokeDasharray="22 10" />
        </svg>
        <span className="text-sm">Checking access…</span>
      </div>
    </div>
  );
}

// ─── Inline "Add new geography" modal ────────────────────────

function AddGeoModal({
  geo,
  onChange,
  onSubmit,
  onClose,
  parentLabel,
}: {
  geo: AddGeoState;
  onChange: (patch: Partial<AddGeoState>) => void;
  onSubmit: () => void;
  onClose: () => void;
  parentLabel?: string;
}) {
  const needsCode = geo.mode === "country" || geo.mode === "state";
  const title =
    geo.mode === "country"
      ? "Add new country"
      : geo.mode === "state"
      ? `Add new state / province${parentLabel ? ` in ${parentLabel}` : ""}`
      : `Add new place / city${parentLabel ? ` in ${parentLabel}` : ""}`;

  const codePlaceholder =
    geo.mode === "country" ? "e.g. IN, US, DE" : "e.g. KL, CA, BY (optional)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl w-full max-w-sm p-6">
        <h3 className="text-sm font-semibold text-stone-800 mb-4">{title}</h3>

        {geo.error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            {geo.error}
          </p>
        )}

        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-600">
              Name <span className="text-indigo-500">*</span>
            </label>
            <input
              type="text"
              value={geo.name}
              onChange={(e) => onChange({ name: e.target.value, error: null })}
              placeholder={
                geo.mode === "country"
                  ? "e.g. India"
                  : geo.mode === "state"
                  ? "e.g. Kerala"
                  : "e.g. Kollam"
              }
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {needsCode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">
                Code{geo.mode === "country" ? <span className="text-indigo-500"> *</span> : " (optional)"}
              </label>
              <input
                type="text"
                value={geo.code}
                onChange={(e) => onChange({ code: e.target.value, error: null })}
                placeholder={codePlaceholder}
                maxLength={20}
                className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={geo.loading || !geo.name.trim()}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            {geo.loading ? (
              <>
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="white" strokeWidth="1.5" strokeDasharray="16 8" />
                </svg>
                Saving…
              </>
            ) : (
              "Add"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function SurveyPage() {
  // Role gate
  const [roleChecked, setRoleChecked] = useState(false);
  const [role, setRole] = useState<AreacalcRole>("anonymous");
  const [allowed, setAllowed] = useState(false);

  // Form
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Geography
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  // Add-geography modal
  const [addGeo, setAddGeo] = useState<AddGeoState>(EMPTY_ADD_GEO);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: check role ────────────────────────────────────────
  useEffect(() => {
    fetchMyRole()
      .then((data) => {
        setRole(data.role);
        const ok = canAccessSurvey(data.role);
        setAllowed(ok);
        if (ok) {
          setLoadingGeo(true);
          fetchCountries()
            .then(setCountries)
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoadingGeo(false));
        }
      })
      .catch(() => {
        setRole("anonymous");
        setAllowed(false);
      })
      .finally(() => setRoleChecked(true));
  }, []);

  // ── Step 2: states cascade ────────────────────────────────────
  useEffect(() => {
    if (!form.countryId) {
      setStates([]);
      setPlaces([]);
      return;
    }
    fetchStates(Number(form.countryId))
      .then(setStates)
      .catch((e: Error) => setError(e.message));
    setForm((f) => ({ ...f, stateId: "", placeId: "" }));
    setPlaces([]);
  }, [form.countryId]);

  // ── Step 3: places cascade ────────────────────────────────────
  useEffect(() => {
    if (!form.stateId) {
      setPlaces([]);
      return;
    }
    fetchPlaces(Number(form.stateId))
      .then(setPlaces)
      .catch((e: Error) => setError(e.message));
    setForm((f) => ({ ...f, placeId: "" }));
  }, [form.stateId]);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
    setSuccess(false);
  }

  // ── Geo modal helpers ─────────────────────────────────────────
  function openAddGeo(mode: AddGeoMode) {
    setAddGeo({ ...EMPTY_ADD_GEO, mode });
  }

  function closeAddGeo() {
    setAddGeo(EMPTY_ADD_GEO);
  }

  function patchAddGeo(patch: Partial<AddGeoState>) {
    setAddGeo((g) => ({ ...g, ...patch }));
  }

  async function submitAddGeo() {
    if (!addGeo.mode || !addGeo.name.trim()) return;
    patchAddGeo({ loading: true, error: null });
    try {
      if (addGeo.mode === "country") {
        if (!addGeo.code.trim()) {
          patchAddGeo({ loading: false, error: "Country code is required (e.g. IN, US)." });
          return;
        }
        const created = await createCountry(addGeo.name.trim(), addGeo.code.trim());
        setCountries((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        setForm((f) => ({ ...f, countryId: String(created.id), stateId: "", placeId: "" }));
        setStates([]);
        setPlaces([]);
        closeAddGeo();
      } else if (addGeo.mode === "state") {
        if (!form.countryId) {
          patchAddGeo({ loading: false, error: "Please select a country first." });
          return;
        }
        const created = await createState(
          addGeo.name.trim(),
          addGeo.code.trim(),
          Number(form.countryId)
        );
        setStates((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        setForm((f) => ({ ...f, stateId: String(created.id), placeId: "" }));
        setPlaces([]);
        closeAddGeo();
      } else if (addGeo.mode === "place") {
        if (!form.stateId) {
          patchAddGeo({ loading: false, error: "Please select a state first." });
          return;
        }
        const created = await createPlace(addGeo.name.trim(), Number(form.stateId));
        setPlaces((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        setForm((f) => ({ ...f, placeId: String(created.id) }));
        closeAddGeo();
      }
    } catch (e) {
      patchAddGeo({ loading: false, error: (e as Error).message });
    }
  }

  // ── Form submit ───────────────────────────────────────────────
  async function handleSubmit() {
    if (!allowed) return;

    setError(null);
    setSuccess(false);

    if (!form.placeId) return setError("Please select a place.");
    if (!form.source_type) return setError("Please select a source type.");
    if (!form.project_category) return setError("Please select a project category.");
    const rate = parseFloat(form.rate_per_sqft);
    if (isNaN(rate) || rate < 1) return setError("Rate must be at least ₹1.");

    // Basic email validation if provided
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      return setError("Please enter a valid email address.");
    }

    const payload: SurveyRateEntryPayload = {
      place: Number(form.placeId),
      source_name: form.source_name || undefined,
      source_type: form.source_type as SourceType,
      contact_email: form.contact_email || undefined,
      contact_phone_country_code: form.contact_phone
        ? form.contact_phone_country_code
        : undefined,
      contact_phone: form.contact_phone || undefined,
      project_category: form.project_category as ProjectCategory,
      rate_per_sqft: rate,
      finish_level: form.finish_level,
      location_note: form.location_note || undefined,
      surveyed_on: form.surveyed_on || null,
      notes: form.notes || undefined,
    };

    setSubmitting(true);
    try {
      await submitSurveyEntry(payload);
      setSuccess(true);
      setForm(EMPTY_FORM);
      setStates([]);
      setPlaces([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPlace = places.find((p) => String(p.id) === form.placeId);
  const selectedCountry = countries.find((c) => String(c.id) === form.countryId);
  const selectedState = states.find((s) => String(s.id) === form.stateId);

  // ── Guards ───────────────────────────────────────────────────
  if (!roleChecked) return <LoadingScreen />;
  if (!allowed) return <AccessDenied role={role} />;

  // ── Form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f2ec] font-[family-name:var(--font-geist-sans)]">

      {/* Add Geo Modal */}
      {addGeo.mode && (
        <AddGeoModal
          geo={addGeo}
          onChange={patchAddGeo}
          onSubmit={submitAddGeo}
          onClose={closeAddGeo}
          parentLabel={
            addGeo.mode === "state"
              ? selectedCountry?.name
              : addGeo.mode === "place"
              ? selectedState?.name
              : undefined
          }
        />
      )}

      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-indigo-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 13L6 9M6 9L8 11L14 3"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 tracking-tight">
                Construction Rate Survey
              </h1>
              <p className="text-xs text-stone-400">areacalc · Modelflick</p>
            </div>
          </div>
          <span
            className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${
              role === "admin"
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {role}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-stone-800 mb-2 tracking-tight">
            Submit a Rate Entry
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Share construction cost data for a location. Entries are reviewed before being used in
            rate calculations.
          </p>
        </div>

        {success && (
          <div className="mb-8 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-4">
            <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#059669" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-800">Entry submitted successfully.</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                It will be reviewed before inclusion in rate averages.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-8 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-5 py-4">
            <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5" />
              <path d="M8 5v3M8 10.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-8">

          {/* 01 — Location */}
          <Section label="Location" index="01">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Country */}
              <Field label="Country">
                <div className="flex gap-1.5">
                  <SelectInput
                    value={form.countryId}
                    onChange={(v) => set("countryId", v)}
                    disabled={loadingGeo}
                    placeholder={loadingGeo ? "Loading…" : "Select country"}
                  >
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectInput>
                  <AddButton
                    onClick={() => openAddGeo("country")}
                    title="Add new country"
                  />
                </div>
              </Field>

              {/* State */}
              <Field label="State / Province">
                <div className="flex gap-1.5">
                  <SelectInput
                    value={form.stateId}
                    onChange={(v) => set("stateId", v)}
                    disabled={!form.countryId || states.length === 0}
                    placeholder="Select state"
                  >
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </SelectInput>
                  <AddButton
                    onClick={() => openAddGeo("state")}
                    disabled={!form.countryId}
                    title="Add new state"
                  />
                </div>
              </Field>

              {/* Place */}
              <Field label="Place / City">
                <div className="flex gap-1.5">
                  <SelectInput
                    value={form.placeId}
                    onChange={(v) => set("placeId", v)}
                    disabled={!form.stateId || places.length === 0}
                    placeholder="Select place"
                  >
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </SelectInput>
                  <AddButton
                    onClick={() => openAddGeo("place")}
                    disabled={!form.stateId}
                    title="Add new place"
                  />
                </div>
              </Field>
            </div>

            {selectedPlace && (
              <div className="mt-4 flex items-center gap-2 text-xs text-stone-500 bg-stone-100 rounded-md px-4 py-3">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="#78716c" strokeWidth="1.2" />
                  <path d="M6 5v4M6 3.5v.5" stroke="#78716c" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span>
                  Current rate for{" "}
                  <strong className="text-stone-700">{selectedPlace.name}</strong>:{" "}
                  {selectedPlace.effective_rate !== null ? (
                    <strong className="text-stone-700">₹{selectedPlace.effective_rate}/sqft</strong>
                  ) : (
                    <em>no data yet</em>
                  )}{" "}
                  · {selectedPlace.rate_status.label}
                </span>
              </div>
            )}

            <div className="mt-4">
              <Field label="Location Note" hint="Optional — e.g. 'urban area', 'suburban plot'">
                <TextInput
                  value={form.location_note}
                  onChange={(v) => set("location_note", v)}
                  placeholder="e.g. Kollam urban area"
                />
              </Field>
            </div>
          </Section>

          {/* 02 — Source */}
          <Section label="Source" index="02">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Source Type" required>
                <SelectInput
                  value={form.source_type}
                  onChange={(v) => set("source_type", v)}
                  placeholder="Select type"
                >
                  {(Object.entries(SOURCE_TYPE_LABELS) as [SourceType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Source Name" hint="Architect / contractor / office name">
                <TextInput
                  value={form.source_name}
                  onChange={(v) => set("source_name", v)}
                  placeholder="e.g. XYZ Architects"
                />
              </Field>
            </div>

            {/* Contact details */}
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500 mb-3">
                Contact Details <span className="font-normal text-stone-400">(optional — for follow-up verification)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email">
                  <TextInput
                    type="email"
                    value={form.contact_email}
                    onChange={(v) => set("contact_email", v)}
                    placeholder="e.g. architect@example.com"
                  />
                </Field>
                <Field label="Phone">
                  <div className="flex gap-2">
                    {/* Country code select */}
                    <select
                      value={form.contact_phone_country_code}
                      onChange={(e) => set("contact_phone_country_code", e.target.value)}
                      className="rounded-md border border-stone-200 bg-white px-2 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-[6.5rem] shrink-0 appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23a8a29e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 6px center",
                        paddingRight: "1.5rem",
                      }}
                    >
                      {COMMON_COUNTRY_CODES.map(({ code, label }) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                      {/* Allow manual entry too */}
                      {!COMMON_COUNTRY_CODES.some(c => c.code === form.contact_phone_country_code) &&
                        form.contact_phone_country_code && (
                          <option value={form.contact_phone_country_code}>
                            {form.contact_phone_country_code}
                          </option>
                        )}
                    </select>
                    <TextInput
                      type="tel"
                      value={form.contact_phone}
                      onChange={(v) => set("contact_phone", v)}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </Section>

          {/* 03 — Rate Details */}
          <Section label="Rate Details" index="03">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Project Category" required>
                <SelectInput
                  value={form.project_category}
                  onChange={(v) => set("project_category", v)}
                  placeholder="Select category"
                >
                  {(Object.entries(CATEGORY_LABELS) as [ProjectCategory, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Rate per sqft (₹)" required>
                <TextInput
                  type="number"
                  value={form.rate_per_sqft}
                  onChange={(v) => set("rate_per_sqft", v)}
                  placeholder="e.g. 2000"
                  min={1}
                />
              </Field>
              <Field label="Finish Level">
                <SelectInput
                  value={form.finish_level}
                  onChange={(v) => set("finish_level", v)}
                  placeholder="Select finish"
                >
                  {(Object.entries(FINISH_LEVEL_LABELS) as [FinishLevel, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Date Surveyed" hint="Leave blank if unknown">
                <TextInput
                  type="date"
                  value={form.surveyed_on}
                  onChange={(v) => set("surveyed_on", v)}
                />
              </Field>
            </div>
          </Section>

          {/* 04 — Notes */}
          <Section label="Additional Notes" index="04">
            <Field label="Notes" hint="Any context useful for reviewers">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
                placeholder="Any additional details about this rate…"
                className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </Field>
          </Section>

          {/* Submit */}
          <div className="pt-2 flex items-center gap-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded-md transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" strokeDasharray="20 10" />
                  </svg>
                  Submitting…
                </>
              ) : (
                <>
                  Submit Entry
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
            <p className="text-xs text-stone-400">Entries are pending review before publication.</p>
          </div>

        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function Section({
  label,
  index,
  children,
}: {
  label: string;
  index: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
        <span className="text-[10px] font-mono text-stone-300">{index}</span>
        <h3 className="text-sm font-semibold text-stone-700 tracking-tight">{label}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-stone-600 flex items-center gap-1">
        {label}
        {required && <span className="text-indigo-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  disabled,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23a8a29e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: "2rem",
      }}
    >
      <option value="" disabled>{placeholder}</option>
      {children}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    />
  );
}

/** Small "+" button beside geography dropdowns */
function AddButton({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="shrink-0 w-9 h-[2.625rem] flex items-center justify-center rounded-md border border-stone-200 bg-white text-stone-400 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}