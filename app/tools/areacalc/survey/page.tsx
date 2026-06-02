"use client";

import { useEffect, useState, useCallback } from "react";
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
  OccupancyType,
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

const OCCUPANCY_TYPE_LABELS: Record<OccupancyType, string> = {
  residential: "Home / Villa",
  commercial: "Shop / Office",
  institutional: "School / Hospital",
  industrial: "Warehouse / Factory",
  mixed: "Mixed Use",
};

const FINISH_LEVEL_LABELS: Record<FinishLevel, string> = {
  basic: "Basic",
  medium: "Medium",
  premium: "Premium",
};

const COMMON_COUNTRY_CODES = [
  { code: "+91",  label: "+91 (India)" },
  { code: "+1",   label: "+1 (US/Canada)" },
  { code: "+44",  label: "+44 (UK)" },
  { code: "+971", label: "+971 (UAE)" },
  { code: "+65",  label: "+65 (Singapore)" },
  { code: "+49",  label: "+49 (Germany)" },
  { code: "+61",  label: "+61 (Australia)" },
  { code: "+33",  label: "+33 (France)" },
];

// ─── Types ────────────────────────────────────────────────────

interface RateRow {
  id: string;
  finish_level: FinishLevel;
  rate_per_sqft: string;
}

interface LocationBlock {
  id: string;
  countryId: string;
  stateId: string;
  placeId: string;
  location_note: string;
  occupancy_type: OccupancyType | "";
  surveyed_on: string;
  notes: string;
  states: State[];
  places: Place[];
  rows: RateRow[];
}

interface SourceForm {
  source_name: string;
  source_type: SourceType | "";
  contact_email: string;
  contact_phone_country_code: string;
  contact_phone: string;
}

const EMPTY_SOURCE: SourceForm = {
  source_name: "",
  source_type: "",
  contact_email: "",
  contact_phone_country_code: "+91",
  contact_phone: "",
};

function makeRow(): RateRow {
  return { id: crypto.randomUUID(), finish_level: "medium", rate_per_sqft: "" };
}

function makeLocation(): LocationBlock {
  return {
    id: crypto.randomUUID(),
    countryId: "", stateId: "", placeId: "",
    location_note: "",
    occupancy_type: "",
    surveyed_on: "",
    notes: "",
    states: [], places: [],
    rows: [makeRow()],
  };
}

// ─── Add-geography modal ──────────────────────────────────────

type AddGeoMode = "country" | "state" | "place" | null;

interface AddGeoState {
  mode: AddGeoMode;
  locationBlockId: string | null;
  name: string;
  code: string;
  loading: boolean;
  error: string | null;
}

const EMPTY_ADD_GEO: AddGeoState = {
  mode: null, locationBlockId: null,
  name: "", code: "", loading: false, error: null,
};

interface SubmitResult {
  total: number; succeeded: number; failed: number; errors: string[];
}

// ─── Guards ───────────────────────────────────────────────────

function AccessDenied({ role }: { role: AreacalcRole }) {
  const isAnonymous = role === "anonymous";
  return (
    <div className="min-h-screen bg-[#f5f2ec] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto mb-6">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="#a8a29e" strokeWidth="1.5" />
            <path d="M8 8.5C8 6.843 9.343 5.5 11 5.5s3 1.343 3 3v1.5H8V8.5z" stroke="#a8a29e" strokeWidth="1.5" strokeLinejoin="round" />
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
            <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">{role}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-2">
          {isAnonymous && (
            <a href="/auth/login?next=/tools/areacalc/survey" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors">
              Sign in
            </a>
          )}
          <a href="/tools/areacalc" className="inline-flex items-center justify-center gap-2 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium px-5 py-2.5 rounded-md transition-colors">
            Back to areacalc
          </a>
        </div>
      </div>
    </div>
  );
}
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

// ─── Add Geo Modal ────────────────────────────────────────────

function AddGeoModal({
  geo, onChange, onSubmit, onClose, parentLabel,
}: {
  geo: AddGeoState;
  onChange: (p: Partial<AddGeoState>) => void;
  onSubmit: () => void;
  onClose: () => void;
  parentLabel?: string;
}) {
  const needsCode = geo.mode === "country" || geo.mode === "state";
  const title =
    geo.mode === "country" ? "Add new country"
    : geo.mode === "state" ? `Add new state / province${parentLabel ? ` in ${parentLabel}` : ""}`
    : `Add new place / city${parentLabel ? ` in ${parentLabel}` : ""}`;

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
                geo.mode === "country" ? "e.g. India"
                : geo.mode === "state" ? "e.g. Kerala"
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
                placeholder={geo.mode === "country" ? "e.g. IN, US" : "e.g. KL, CA (optional)"}
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
            ) : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rate rows table ──────────────────────────────────────────

function RateRowsTable({
  rows, onAdd, onUpdate, onRemove,
}: {
  rows: RateRow[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<RateRow>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-x-2 mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Finish Level</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">Rate (₹/sqft)</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1.75rem] gap-x-2 items-center">
            <select
              value={row.finish_level}
              onChange={(e) => onUpdate(row.id, { finish_level: e.target.value as FinishLevel })}
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-2.5 py-[7px] text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5L5 6.5L8 3.5' stroke='%23a8a29e' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 7px center",
                paddingRight: "1.6rem",
              }}
            >
              {(Object.entries(FINISH_LEVEL_LABELS) as [FinishLevel, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              type="number"
              value={row.rate_per_sqft}
              onChange={(e) => onUpdate(row.id, { rate_per_sqft: e.target.value })}
              placeholder="e.g. 2000"
              min={1}
              className="w-full rounded-md border border-stone-200 bg-stone-50 px-2.5 py-[7px] text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => onRemove(row.id)}
                className="flex items-center justify-center w-6 h-6 rounded text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            ) : <span />}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex items-center gap-1.5 text-xs text-stone-400 hover:text-indigo-600 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Add row
      </button>
    </div>
  );
}

// ─── Location block card ──────────────────────────────────────

function LocationBlockCard({
  block, index, canRemove, countries,
  onUpdateBlock, onRemoveBlock, onOpenAddGeo,
  onAddRow, onUpdateRow, onRemoveRow,
}: {
  block: LocationBlock;
  index: number;
  canRemove: boolean;
  countries: Country[];
  onUpdateBlock: (p: Partial<LocationBlock>) => void;
  onRemoveBlock: () => void;
  onOpenAddGeo: (mode: "country" | "state" | "place") => void;
  onAddRow: () => void;
  onUpdateRow: (rowId: string, p: Partial<RateRow>) => void;
  onRemoveRow: (rowId: string) => void;
}) {
  const selectedPlace   = block.places.find((p) => String(p.id) === block.placeId);
  const selectedCountry = countries.find((c) => String(c.id) === block.countryId);
  const selectedState   = block.states.find((s) => String(s.id) === block.stateId);

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="border-b border-stone-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-stone-300 uppercase tracking-widest tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          {selectedPlace ? (
            <span className="text-xs font-medium text-stone-600">
              {selectedPlace.name}
              {selectedState   && <span className="text-stone-400">, {selectedState.name}</span>}
              {selectedCountry && <span className="text-stone-400"> · {selectedCountry.code}</span>}
            </span>
          ) : (
            <span className="text-xs text-stone-400">New location</span>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemoveBlock}
            className="text-[11px] text-stone-300 hover:text-red-400 flex items-center gap-1 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Remove
          </button>
        )}
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">Country</label>
            <div className="flex gap-1.5">
              <GeoSelect value={block.countryId} onChange={(v) => onUpdateBlock({ countryId: v })} placeholder="Select">
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </GeoSelect>
              <AddButton onClick={() => onOpenAddGeo("country")} title="Add country" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">State / Province</label>
            <div className="flex gap-1.5">
              <GeoSelect
                value={block.stateId}
                onChange={(v) => onUpdateBlock({ stateId: v })}
                disabled={!block.countryId || block.states.length === 0}
                placeholder="Select"
              >
                {block.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </GeoSelect>
              <AddButton onClick={() => onOpenAddGeo("state")} disabled={!block.countryId} title="Add state" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">Place / City</label>
            <div className="flex gap-1.5">
              <GeoSelect
                value={block.placeId}
                onChange={(v) => onUpdateBlock({ placeId: v })}
                disabled={!block.stateId || block.places.length === 0}
                placeholder="Select"
              >
                {block.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </GeoSelect>
              <AddButton onClick={() => onOpenAddGeo("place")} disabled={!block.stateId} title="Add place" />
            </div>
          </div>
        </div>

        {selectedPlace && (
          <div className="flex items-center gap-2 text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-md px-3.5 py-2">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="5.5" cy="5.5" r="4.5" stroke="#a8a29e" strokeWidth="1.1" />
              <path d="M5.5 4.5v2.5M5.5 3.25v.25" stroke="#a8a29e" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            Current:{" "}
            {selectedPlace.effective_rate !== null ? (
              <>
                <strong className="text-stone-600 font-medium">₹{selectedPlace.effective_rate}/sqft</strong>
                {" · "}{selectedPlace.rate_status.label}
              </>
            ) : <em>no data yet</em>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">
              Occupancy Type <span className="text-indigo-400">*</span>
            </label>
            <GeoSelect
              value={block.occupancy_type}
              onChange={(v) => onUpdateBlock({ occupancy_type: v as OccupancyType })}
              placeholder="Select"
            >
              {(Object.entries(OCCUPANCY_TYPE_LABELS) as [OccupancyType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </GeoSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">Date Surveyed</label>
            <input
              type="date"
              value={block.surveyed_on}
              onChange={(e) => onUpdateBlock({ surveyed_on: e.target.value })}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">Location Note</label>
            <input
              type="text"
              value={block.location_note}
              onChange={(e) => onUpdateBlock({ location_note: e.target.value })}
              placeholder="e.g. urban area"
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
            Rates by Finish Level
          </p>
          <RateRowsTable
            rows={block.rows}
            onAdd={onAddRow}
            onUpdate={onUpdateRow}
            onRemove={onRemoveRow}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-500">
            Notes <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            type="text"
            value={block.notes}
            onChange={(e) => onUpdateBlock({ notes: e.target.value })}
            placeholder="Any context for reviewers…"
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function SurveyPage() {
  const [roleChecked, setRoleChecked] = useState(false);
  const [role, setRole]               = useState<AreacalcRole>("anonymous");
  const [allowed, setAllowed]         = useState(false);

  const [countries, setCountries]     = useState<Country[]>([]);
  const [source, setSource]           = useState<SourceForm>(EMPTY_SOURCE);
  const [blocks, setBlocks]           = useState<LocationBlock[]>([makeLocation()]);
  const [addGeo, setAddGeo]           = useState<AddGeoState>(EMPTY_ADD_GEO);

  const [submitting, setSubmitting]   = useState(false);
  const [result, setResult]           = useState<SubmitResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Role check ───────────────────────────────────────────────
  useEffect(() => {
    fetchMyRole()
      .then((data) => {
        setRole(data.role);
        const ok = canAccessSurvey(data.role);
        setAllowed(ok);
        if (ok) {
          fetchCountries()
            .then(setCountries)
            .catch((e: Error) => setGlobalError(e.message));
        }
      })
      .catch(() => { setRole("anonymous"); setAllowed(false); })
      .finally(() => setRoleChecked(true));
  }, []);

  // ── Block helpers ────────────────────────────────────────────
  const updateBlock = useCallback((blockId: string, patch: Partial<LocationBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
    setGlobalError(null); setResult(null);
  }, []);

  const handleCountryChange = useCallback(async (blockId: string, countryId: string) => {
    updateBlock(blockId, { countryId, stateId: "", placeId: "", states: [], places: [] });
    if (!countryId) return;
    try {
      const states = await fetchStates(Number(countryId));
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, states } : b)));
    } catch (e) { setGlobalError((e as Error).message); }
  }, [updateBlock]);

  const handleStateChange = useCallback(async (blockId: string, stateId: string) => {
    updateBlock(blockId, { stateId, placeId: "", places: [] });
    if (!stateId) return;
    try {
      const places = await fetchPlaces(Number(stateId));
      setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, places } : b)));
    } catch (e) { setGlobalError((e as Error).message); }
  }, [updateBlock]);

  const handleBlockUpdate = useCallback((blockId: string, patch: Partial<LocationBlock>) => {
    if ("countryId" in patch) { handleCountryChange(blockId, patch.countryId!); return; }
    if ("stateId"   in patch) { handleStateChange(blockId,   patch.stateId!);   return; }
    updateBlock(blockId, patch);
  }, [handleCountryChange, handleStateChange, updateBlock]);

  function addBlock()              { setBlocks((p) => [...p, makeLocation()]); }
  function removeBlock(id: string) { setBlocks((p) => p.filter((b) => b.id !== id)); }

  function addRow(blockId: string) {
    setBlocks((p) => p.map((b) => b.id === blockId ? { ...b, rows: [...b.rows, makeRow()] } : b));
  }
  function updateRow(blockId: string, rowId: string, patch: Partial<RateRow>) {
    setBlocks((p) => p.map((b) =>
      b.id === blockId
        ? { ...b, rows: b.rows.map((r) => r.id === rowId ? { ...r, ...patch } : r) }
        : b
    ));
    setGlobalError(null); setResult(null);
  }
  function removeRow(blockId: string, rowId: string) {
    setBlocks((p) => p.map((b) =>
      b.id === blockId ? { ...b, rows: b.rows.filter((r) => r.id !== rowId) } : b
    ));
  }

  // ── Add Geo ──────────────────────────────────────────────────
  function openAddGeo(blockId: string, mode: "country" | "state" | "place") {
    setAddGeo({ ...EMPTY_ADD_GEO, mode, locationBlockId: blockId });
  }
  function closeAddGeo() { setAddGeo(EMPTY_ADD_GEO); }
  function patchAddGeo(p: Partial<AddGeoState>) { setAddGeo((g) => ({ ...g, ...p })); }

  async function submitAddGeo() {
    if (!addGeo.mode || !addGeo.name.trim() || !addGeo.locationBlockId) return;
    patchAddGeo({ loading: true, error: null });
    const blockId = addGeo.locationBlockId;
    const block = blocks.find((b) => b.id === blockId);
    if (!block) { closeAddGeo(); return; }

    try {
      if (addGeo.mode === "country") {
        if (!addGeo.code.trim()) {
          patchAddGeo({ loading: false, error: "Country code is required (e.g. IN, US)." });
          return;
        }
        const created = await createCountry(addGeo.name.trim(), addGeo.code.trim());
        setCountries((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
        handleCountryChange(blockId, String(created.id));
        closeAddGeo();
      } else if (addGeo.mode === "state") {
        if (!block.countryId) { patchAddGeo({ loading: false, error: "Select a country first." }); return; }
        const created = await createState(addGeo.name.trim(), addGeo.code.trim(), Number(block.countryId));
        setBlocks((p) => p.map((b) =>
          b.id === blockId
            ? { ...b, states: [...b.states, created].sort((a, b) => a.name.localeCompare(b.name)) }
            : b
        ));
        updateBlock(blockId, { stateId: String(created.id), placeId: "", places: [] });
        closeAddGeo();
      } else if (addGeo.mode === "place") {
        if (!block.stateId) { patchAddGeo({ loading: false, error: "Select a state first." }); return; }
        const created = await createPlace(addGeo.name.trim(), Number(block.stateId));
        setBlocks((p) => p.map((b) =>
          b.id === blockId
            ? { ...b, places: [...b.places, created].sort((a, b) => a.name.localeCompare(b.name)) }
            : b
        ));
        updateBlock(blockId, { placeId: String(created.id) });
        closeAddGeo();
      }
    } catch (e) { patchAddGeo({ loading: false, error: (e as Error).message }); }
  }

  // ── Validate ─────────────────────────────────────────────────
  function validate(): string | null {
    if (!source.source_type) return "Please select a source type.";
    if (source.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source.contact_email))
      return "Please enter a valid email address.";
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      const loc = `Location ${bi + 1}`;
      if (!b.placeId)          return `${loc}: please select a place.`;
      if (!b.occupancy_type)   return `${loc}: please select an occupancy type.`;
      for (let ri = 0; ri < b.rows.length; ri++) {
        const rate = parseFloat(b.rows[ri].rate_per_sqft);
        if (isNaN(rate) || rate < 1) return `${loc} / row ${ri + 1}: rate must be at least ₹1.`;
      }
    }
    return null;
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!allowed) return;
    setGlobalError(null); setResult(null);
    const err = validate();
    if (err) { setGlobalError(err); return; }

    const payloads: SurveyRateEntryPayload[] = blocks.flatMap((b) =>
      b.rows.map((r) => ({
        place: Number(b.placeId),
        source_name: source.source_name || undefined,
        source_type: source.source_type as SourceType,
        contact_email: source.contact_email || undefined,
        contact_phone_country_code: source.contact_phone ? source.contact_phone_country_code : undefined,
        contact_phone: source.contact_phone || undefined,
        occupancy_type: b.occupancy_type as OccupancyType,
        rate_per_sqft: parseFloat(r.rate_per_sqft),
        finish_level: r.finish_level,
        location_note: b.location_note || undefined,
        surveyed_on: b.surveyed_on || null,
        notes: b.notes || undefined,
      }))
    );

    setSubmitting(true);
    let succeeded = 0;
    const errors: string[] = [];
    const results = await Promise.allSettled(payloads.map((p) => submitSurveyEntry(p)));
    results.forEach((res, i) => {
      if (res.status === "fulfilled") succeeded++;
      else errors.push(`Entry ${i + 1}: ${(res.reason as Error).message}`);
    });

    setResult({ total: payloads.length, succeeded, failed: payloads.length - succeeded, errors });
    if (succeeded > 0) { setSource(EMPTY_SOURCE); setBlocks([makeLocation()]); }
    setSubmitting(false);
  }

  const totalRows = blocks.reduce((s, b) => s + b.rows.length, 0);
  const activeGeoBlock   = addGeo.locationBlockId ? blocks.find((b) => b.id === addGeo.locationBlockId) : null;
  const activeGeoCountry = activeGeoBlock ? countries.find((c) => String(c.id) === activeGeoBlock.countryId) : null;
  const activeGeoState   = activeGeoBlock ? activeGeoBlock.states.find((s) => String(s.id) === activeGeoBlock.stateId) : null;

  if (!roleChecked) return <LoadingScreen />;
  if (!allowed)     return <AccessDenied role={role} />;

  return (
    <div className="min-h-screen bg-[#f5f2ec] font-[family-name:var(--font-geist-sans)]">

      {addGeo.mode && (
        <AddGeoModal
          geo={addGeo} onChange={patchAddGeo} onSubmit={submitAddGeo} onClose={closeAddGeo}
          parentLabel={
            addGeo.mode === "state" ? activeGeoCountry?.name
            : addGeo.mode === "place" ? activeGeoState?.name
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
                <path d="M2 13L6 9M6 9L8 11L14 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 tracking-tight">Construction Rate Survey</h1>
              <p className="text-xs text-stone-400">areacalc · Modelflick</p>
            </div>
          </div>
          <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${
            role === "admin"
              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}>{role}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h2 className="text-2xl font-semibold text-stone-800 mb-1.5 tracking-tight">Batch Rate Entry</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Record rates from a single source across multiple locations and finish levels in one submission.
          </p>
        </div>

        {/* Result banner */}
        {result && (
          <div className={`flex items-start gap-3 rounded-lg px-5 py-4 border ${
            result.failed === 0
              ? "bg-emerald-50 border-emerald-200"
              : result.succeeded > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-red-50 border-red-200"
          }`}>
            <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
              {result.failed === 0 ? (<>
                <circle cx="8" cy="8" r="7" stroke="#059669" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </>) : (<>
                <circle cx="8" cy="8" r="7" stroke="#d97706" strokeWidth="1.5" />
                <path d="M8 5v3M8 10.5v.5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
              </>)}
            </svg>
            <div>
              <p className="text-sm font-medium text-stone-800">
                {result.succeeded} of {result.total} entr{result.total !== 1 ? "ies" : "y"} submitted
                {result.succeeded === result.total ? " successfully." : "."}
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 mt-0.5">{e}</p>
              ))}
              {result.succeeded > 0 && (
                <p className="text-xs text-stone-400 mt-1">Pending review before publication.</p>
              )}
            </div>
          </div>
        )}

        {/* Global error */}
        {globalError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-5 py-4">
            <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5" />
              <path d="M8 5v3M8 10.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-red-700">{globalError}</p>
          </div>
        )}

        {/* ── 01 Source ── */}
        <Section label="Source" index="01">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">
                Source Type <span className="text-indigo-400">*</span>
              </label>
              <GeoSelect
                value={source.source_type}
                onChange={(v) => { setSource((s) => ({ ...s, source_type: v as SourceType })); setGlobalError(null); setResult(null); }}
                placeholder="Select type"
              >
                {(Object.entries(SOURCE_TYPE_LABELS) as [SourceType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </GeoSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">Source Name</label>
              <input
                type="text"
                value={source.source_name}
                onChange={(e) => setSource((s) => ({ ...s, source_name: e.target.value }))}
                placeholder="e.g. XYZ Architects"
                className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100">
            <p className="text-xs font-medium text-stone-500 mb-3">
              Contact Details <span className="font-normal text-stone-400">(optional)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-600">Email</label>
                <input
                  type="email"
                  value={source.contact_email}
                  onChange={(e) => setSource((s) => ({ ...s, contact_email: e.target.value }))}
                  placeholder="e.g. architect@example.com"
                  className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-600">Phone</label>
                <div className="flex gap-2">
                  <select
                    value={source.contact_phone_country_code}
                    onChange={(e) => setSource((s) => ({ ...s, contact_phone_country_code: e.target.value }))}
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
                    {!COMMON_COUNTRY_CODES.some((c) => c.code === source.contact_phone_country_code)
                      && source.contact_phone_country_code && (
                      <option value={source.contact_phone_country_code}>
                        {source.contact_phone_country_code}
                      </option>
                    )}
                  </select>
                  <input
                    type="tel"
                    value={source.contact_phone}
                    onChange={(e) => setSource((s) => ({ ...s, contact_phone: e.target.value }))}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 02 Locations & Rates ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-stone-300 uppercase tracking-widest">02</span>
              <h3 className="text-sm font-semibold text-stone-700 tracking-tight">Locations &amp; Rates</h3>
            </div>
            <span className="text-xs text-stone-400">
              {blocks.length} location{blocks.length !== 1 ? "s" : ""} · {totalRows} rate{totalRows !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-4">
            {blocks.map((block, bi) => (
              <LocationBlockCard
                key={block.id} block={block} index={bi} canRemove={blocks.length > 1}
                countries={countries}
                onUpdateBlock={(p) => handleBlockUpdate(block.id, p)}
                onRemoveBlock={() => removeBlock(block.id)}
                onOpenAddGeo={(mode) => openAddGeo(block.id, mode)}
                onAddRow={() => addRow(block.id)}
                onUpdateRow={(rowId, p) => updateRow(block.id, rowId, p)}
                onRemoveRow={(rowId) => removeRow(block.id, rowId)}
              />
            ))}

            <button
              type="button"
              onClick={addBlock}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-stone-400 hover:text-indigo-600 border-2 border-dashed border-stone-200 hover:border-indigo-300 rounded-xl py-3.5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Add another location
            </button>
          </div>
        </div>

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
                Submitting {totalRows} entr{totalRows !== 1 ? "ies" : "y"}…
              </>
            ) : (
              <>
                Submit {totalRows} entr{totalRows !== 1 ? "ies" : "y"}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
          <p className="text-xs text-stone-400">
            {totalRows} rate{totalRows !== 1 ? "s" : ""} across {blocks.length} location{blocks.length !== 1 ? "s" : ""} · pending review.
          </p>
        </div>

      </main>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────

function Section({ label, index, children }: { label: string; index: string; children: React.ReactNode }) {
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

function GeoSelect({
  value, onChange, disabled, placeholder, children,
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
      className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23a8a29e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: "2rem",
      }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {children}
    </select>
  );
}

function AddButton({ onClick, disabled, title }: { onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="shrink-0 w-9 h-[2.125rem] flex items-center justify-center rounded-md border border-stone-200 bg-white text-stone-400 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}