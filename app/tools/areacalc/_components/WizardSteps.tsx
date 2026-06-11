"use client";

import { useState } from "react";
import SpaceRequirementPdfButton from "../SpaceRequirementPdfButton";
import SpaceRequirementCsvButton, { type ImportPayload } from "../SpaceRequirementCsvButton";
import {
  UNIT_SYSTEMS, CATEGORY_META, getFloorLabel, uid, fmt, fmtCost,
  calcSpaceArea, makeSpaceFromTemplate,
  type UnitKey, type SpaceTemplate, type SpaceInstance,
  type ProjectTemplate,
} from "../areadata";
import {
  type ApiCountry, type ApiState, type ApiRateStatus,
  type ApiMyRole, type ApiCustomProjectTemplate,
} from "../areacalcApi";
import { Spin, InfoBox, RateBadge, BigOption } from "./ui";
import {
  CustomSpaceModal, PaletteDrawer, TotalAreaScaler, DraggableSpaceList,
} from "./SpaceEditor";
import {
  TemplatePanel, SaveAsCustomModal,
  type ActiveTemplateSource,
  SaveButtons,
} from "./TemplateManager";

// ─── Constants ────────────────────────────────────────────────

const WALL_PRESETS = [
  { v: 8,  l: "Light 8%"    },
  { v: 10, l: "Normal 10%"  },
  { v: 15, l: "Heavy 15%"   },
];
const CIRC_PRESETS = [
  { v: 10, l: "Compact 10%"  },
  { v: 15, l: "Normal 15%"   },
  { v: 20, l: "Spacious 20%" },
];

export type WizardStep = "location" | "project-type" | "spaces" | "summary";

export const WIZARD_STEPS: { id: WizardStep; label: string; emoji: string }[] = [
  { id: "location",     label: "Location", emoji: "📍" },
  { id: "project-type", label: "Project",  emoji: "🏗️" },
  { id: "spaces",       label: "Rooms",    emoji: "🏠" },
  { id: "summary",      label: "Summary",  emoji: "📊" },
];

// ─── WizardProgress ───────────────────────────────────────────

export function WizardProgress({ step, onJump }: { step: WizardStep; onJump: (s: WizardStep) => void }) {
  const current = WIZARD_STEPS.findIndex((s) => s.id === step);
  return (
    <div style={{ display: "flex", alignItems: "stretch", marginBottom: 24, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
      {WIZARD_STEPS.map((s, i) => {
        const isActive = s.id === step;
        const isDone = i < current;
        return (
          <button key={s.id} type="button" onClick={() => onJump(s.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 2, padding: "10px 4px", border: "none",
            borderRight: i < WIZARD_STEPS.length - 1 ? "1px solid #f3f4f6" : "none",
            background: isActive ? "#f59e0b" : isDone ? "#f0fdf4" : "#fff",
            cursor: "pointer", transition: "background .2s", position: "relative",
          }}>
            <span style={{ fontSize: 16 }}>{isDone ? "✅" : s.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, color: isActive ? "#fff" : isDone ? "#059669" : "#9ca3af", whiteSpace: "nowrap" }}>
              {s.label}
            </span>
            {isActive && (
              <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#d97706", borderRadius: "3px 3px 0 0" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── StepLocation ─────────────────────────────────────────────

export function StepLocation({
  countries, statesList, placesList, countryId, stateId, placeId,
  setCountryId, setStateId, setPlaceId, loadingStates, loadingPlaces, onNext, onCsvImport,
}: {
  countries: ApiCountry[]; statesList: ApiState[];
  placesList: { id: number; name: string }[];
  countryId: number | null; stateId: number | null; placeId: number | null;
  setCountryId: (n: number | null) => void;
  setStateId: (n: number | null) => void;
  setPlaceId: (n: number | null) => void;
  loadingStates: boolean; loadingPlaces: boolean;
  onNext: () => void;
  onCsvImport: (p: ImportPayload) => void;
}) {
  const sel = (hasValue: boolean): React.CSSProperties => ({
    width: "100%", fontSize: 15, padding: "12px 14px", borderRadius: 10,
    border: `2px solid ${hasValue ? "#22c55e" : "#e5e7eb"}`,
    background: "#fff", color: hasValue ? "#111827" : "#9ca3af",
    appearance: "none" as const, cursor: "pointer", outline: "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>📍 Where is your project?</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Choose your country and city to load local construction rates.</p>
      </div>
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "#eff6ff", border: "1.5px solid #bfdbfe" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", margin: "0 0 6px" }}>📂 Have a saved project CSV?</p>
        <p style={{ fontSize: 12, color: "#3b82f6", margin: "0 0 10px" }}>Import it to restore your rooms, dimensions, and location automatically.</p>
        <SpaceRequirementCsvButton
          projectName="" clientName="" spaces={[]} unit="sqft"
          wall={10} circ={15} totals={{ net: 0, wallA: 0, circA: 0, gross: 0, cost: 0 }}
          locationLabel="" disabled={false} importOnly onImport={onCsvImport} />
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
          Country <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <select value={countryId ?? ""} onChange={(e) => setCountryId(e.target.value ? Number(e.target.value) : null)} style={sel(!!countryId)}>
            <option value="">— Select your country —</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af", fontSize: 10 }}>▼</span>
        </div>
      </div>
      <div style={{ opacity: countryId ? 1 : .4 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>State / Province</label>
        <div style={{ position: "relative" }}>
          <select value={stateId ?? ""} onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : null)}
            disabled={!countryId || loadingStates} style={sel(!!stateId)}>
            <option value="">{loadingStates ? "Loading…" : "— Select state —"}</option>
            {statesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af" }}>
            {loadingStates ? <Spin size={12} /> : <span style={{ fontSize: 10 }}>▼</span>}
          </span>
        </div>
      </div>
      <div style={{ opacity: stateId ? 1 : .4 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5 }}>
          City / Town <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <select value={placeId ?? ""} onChange={(e) => setPlaceId(e.target.value ? Number(e.target.value) : null)}
            disabled={!stateId || loadingPlaces} style={sel(!!placeId)}>
            <option value="">{loadingPlaces ? "Loading…" : "— Select your city —"}</option>
            {placesList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9ca3af" }}>
            {loadingPlaces ? <Spin size={12} /> : <span style={{ fontSize: 10 }}>▼</span>}
          </span>
        </div>
      </div>
      {placeId && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "#ecfdf5", border: "1.5px solid #a7f3d0" }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <p style={{ margin: 0, fontSize: 13, color: "#047857", fontWeight: 600 }}>Location set! Local rates loaded.</p>
        </div>
      )}
      <button type="button" onClick={onNext} style={{
        width: "100%", padding: "15px", borderRadius: 12, border: "none",
        background: "#f59e0b", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
        boxShadow: "0 4px 16px #f59e0b55",
      }}>Continue →</button>
    </div>
  );
}

// ─── CustomRateInput ──────────────────────────────────────────

export function CustomRateInput({ customRate, setCustomRate }: {
  customRate: number | null;
  setCustomRate: (r: number | null) => void;
}) {
  const [draft, setDraft] = useState(customRate !== null ? String(customRate) : "");
  const [active, setActive] = useState(customRate !== null);

  function apply() {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n <= 0) { setCustomRate(null); setActive(false); return; }
    setCustomRate(n);
    setActive(true);
  }

  function clear() { setDraft(""); setCustomRate(null); setActive(false); }

  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: active ? "linear-gradient(135deg, #fdf2f8, #fce7f3)" : "#f9fafb",
      border: `1.5px solid ${active ? "#f472b6" : "#e5e7eb"}`, transition: "all .2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>✏️</span>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: active ? "#be185d" : "#374151" }}>
          Custom Rate Override
        </p>
        {active && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#fce7f3", color: "#be185d", fontWeight: 700, border: "1px solid #f9a8d4" }}>Active</span>
        )}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
        Enter your own rate (₹/sqft) to override the auto-fetched rate. Leave blank to use the survey/location rate.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 140px" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9ca3af", pointerEvents: "none", fontWeight: 600 }}>₹</span>
          <input type="number" min={1} step={50} value={draft} placeholder="e.g. 2500"
            onChange={(e) => { setDraft(e.target.value); if (!e.target.value) { setCustomRate(null); setActive(false); } }}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            style={{
              width: "100%", fontSize: 15, padding: "9px 10px 9px 26px",
              borderRadius: 9, border: `2px solid ${active ? "#f472b6" : "#e5e7eb"}`,
              outline: "none", fontFamily: "monospace", fontWeight: 700,
              color: "#111827", background: "#fff", boxSizing: "border-box",
            }} />
        </div>
        <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>/sqft</span>
        <button type="button" onClick={apply} style={{
          padding: "9px 16px", borderRadius: 9, border: "none",
          background: "#be185d", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
          boxShadow: "0 2px 8px #f472b633", flexShrink: 0,
        }}>Apply</button>
        {active && (
          <button type="button" onClick={clear} style={{
            padding: "9px 12px", borderRadius: 9, border: "1.5px solid #fecdd3", background: "#fff",
            fontWeight: 600, fontSize: 12, color: "#9f1239", cursor: "pointer", flexShrink: 0,
          }}>Clear</button>
        )}
      </div>
      {active && customRate !== null && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#be185d", fontWeight: 600 }}>
          ✓ Using ₹{customRate.toLocaleString("en-IN")}/sqft for all estimates
        </p>
      )}
    </div>
  );
}

// ─── StepProjectType ──────────────────────────────────────────

export function StepProjectType({
  occupancyTypes, finishLevels, loadingOptions, placeHasData,
  occupancyType, setOccupancyType, finishLevel, setFinishLevel,
  currentRate, customRate, setCustomRate,
  wall, setWall, circ, setCirc, onNext, onBack,
}: {
  occupancyTypes: { value: string; label: string; emoji: string }[];
  finishLevels: { value: string; label: string; emoji: string; hint: string }[];
  loadingOptions: boolean; placeHasData: boolean;
  occupancyType: string; setOccupancyType: (v: string) => void;
  finishLevel: string; setFinishLevel: (v: string) => void;
  currentRate: number | null; customRate: number | null; setCustomRate: (r: number | null) => void;
  wall: number; setWall: (n: number) => void;
  circ: number; setCirc: (n: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  const effectiveRate = customRate !== null ? customRate : currentRate;

  const SkeletonOptions = ({ count }: { count: number }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          flex: "1 1 120px", height: 80, borderRadius: 12,
          background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
          backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>🏗️ Tell us about your project</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>These choices refine the rate used for your estimate.</p>
        {placeHasData && !loadingOptions && (
          <p style={{ fontSize: 11, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>
            📍 Showing building types &amp; finish levels with local survey data for your city.
          </p>
        )}
      </div>
      {effectiveRate !== null && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 10,
          background: customRate !== null ? "linear-gradient(135deg, #fdf2f8, #fce7f3)" : "linear-gradient(135deg, #fffbeb, #fef3c7)",
          border: `1.5px solid ${customRate !== null ? "#f9a8d4" : "#fcd34d"}`,
        }}>
          <div>
            <span style={{ fontSize: 13, color: customRate !== null ? "#be185d" : "#92400e", fontWeight: 600 }}>
              {loadingOptions ? "Loading rate…" : customRate !== null ? "Custom rate (overriding survey)" : "Estimated rate for this selection"}
            </span>
            {customRate !== null && <p style={{ margin: "2px 0 0", fontSize: 10, color: "#f472b6" }}>Survey rate ignored while custom is active</p>}
          </div>
          {loadingOptions && customRate === null ? <Spin size={14} color="#d97706" /> : (
            <strong style={{ fontFamily: "monospace", fontSize: 18, color: customRate !== null ? "#be185d" : "#d97706", letterSpacing: -0.5 }}>
              ₹{effectiveRate.toLocaleString("en-IN")}/sqft
            </strong>
          )}
        </div>
      )}
      <CustomRateInput customRate={customRate} setCustomRate={setCustomRate} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>What are you building?</p>
        {loadingOptions ? <SkeletonOptions count={4} /> : occupancyTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>No building types available yet.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {occupancyTypes.map((ot) => (
              <BigOption key={ot.value} selected={occupancyType === ot.value}
                onClick={() => setOccupancyType(ot.value)} emoji={ot.emoji} label={ot.label} />
            ))}
          </div>
        )}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>
          Quality of finish?
          <InfoBox icon="✨" title="Finish Level" body="Basic = plain tiles. Standard = branded tiles, modular kitchen. Premium = imported marble, false ceiling. Luxury = designer finishes." />
        </p>
        {loadingOptions ? <SkeletonOptions count={4} /> : finishLevels.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>No finish levels available yet.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {finishLevels.map((fl) => (
              <BigOption key={fl.value} selected={finishLevel === fl.value}
                onClick={() => setFinishLevel(fl.value)} emoji={fl.emoji} label={fl.label} hint={fl.hint} />
            ))}
          </div>
        )}
      </div>
      <details>
        <summary style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", cursor: "pointer", padding: "8px 0", userSelect: "none" }}>
          ⚙️ Advanced: Wall &amp; Circulation
        </summary>
        <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Wall Thickness Allowance: <strong>{wall}%</strong></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {WALL_PRESETS.map((p) => (
                <button key={p.v} type="button" onClick={() => setWall(p.v)} style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  border: `1.5px solid ${wall === p.v ? "#6366f1" : "#e5e7eb"}`,
                  background: wall === p.v ? "#eef2ff" : "#fff",
                  color: wall === p.v ? "#4338ca" : "#374151", fontWeight: wall === p.v ? 700 : 400,
                }}>{p.l}</button>
              ))}
            </div>
            <input type="range" min={0} max={30} step={1} value={wall} onChange={(e) => setWall(Number(e.target.value))} style={{ width: "100%", accentColor: "#6366f1" }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Circulation Space: <strong>{circ}%</strong></label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {CIRC_PRESETS.map((p) => (
                <button key={p.v} type="button" onClick={() => setCirc(p.v)} style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                  border: `1.5px solid ${circ === p.v ? "#6366f1" : "#e5e7eb"}`,
                  background: circ === p.v ? "#eef2ff" : "#fff",
                  color: circ === p.v ? "#4338ca" : "#374151", fontWeight: circ === p.v ? 700 : 400,
                }}>{p.l}</button>
              ))}
            </div>
            <input type="range" min={0} max={40} step={1} value={circ} onChange={(e) => setCirc(Number(e.target.value))} style={{ width: "100%", accentColor: "#6366f1" }} />
          </div>
        </div>
      </details>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onBack} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 14, fontWeight: 700, color: "#374151", cursor: "pointer" }}>← Back</button>
        <button type="button" onClick={onNext} style={{ flex: 3, padding: "13px", borderRadius: 12, border: "none", background: "#f59e0b", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px #f59e0b55" }}>Add Rooms →</button>
      </div>
    </div>
  );
}

// ─── StepSpaces ───────────────────────────────────────────────

export function StepSpaces({
  spaces, setSpaces, spaceTemplates, projectTemplates, customTemplates,
  unit, loadingTemplates,
  activeTemplateSource, myRole,
  savingTemplate, templateSaveMsg,
  onSave, onSaveAsCustom, onSaveAsPublic,
  saveAsCustomOpen, setSaveAsCustomOpen, onSaveAsCustomConfirm,
  onDeleteCustom, onDeletePublic, onLoadProjectTemplate, onLoadCustomProjectTemplate,
  locationLabel, clientName, projectName, wall, circ, costPerSqft,
  totals, floorGroups, onCsvImport,
  onNext, onBack,
  customRate,
}: {
  spaces: SpaceInstance[]; setSpaces: (s: SpaceInstance[]) => void;
  spaceTemplates: SpaceTemplate[]; projectTemplates: ProjectTemplate[];
  customTemplates: ApiCustomProjectTemplate[];
  unit: UnitKey; loadingTemplates: boolean;
  locationLabel: string; clientName: string; projectName: string;
  wall: number; circ: number; costPerSqft: number;
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  floorGroups: Map<number, SpaceInstance[]>;
  onCsvImport: (p: ImportPayload) => void;
  rateStatus: ApiRateStatus | null;
  activeTemplateSource: ActiveTemplateSource; myRole: ApiMyRole | null;
  savingTemplate: boolean; templateSaveMsg: string;
  onSave: () => void;
  onSaveAsCustom: () => void;
  onSaveAsPublic: () => void;
  saveAsCustomOpen: boolean; setSaveAsCustomOpen: (v: boolean) => void;
  onSaveAsCustomConfirm: (label: string) => Promise<void>;
  onDeleteCustom: (id: number) => Promise<void>;
  onDeletePublic: (id: string) => Promise<void>;
  onLoadProjectTemplate: (tpl: ProjectTemplate) => void;
  onLoadCustomProjectTemplate: (tpl: ApiCustomProjectTemplate) => void;
  onNext: () => void; onBack: () => void;
  customRate: number | null;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [importBanner, setImportBanner] = useState(false);

  // Copy modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<SpaceInstance | null>(null);
  const [copyName, setCopyName] = useState("");

  const canSaveCustom = myRole?.can_save_custom_templates ?? false;
  const canSavePublic = myRole?.role === "member" || myRole?.role === "admin";

  function addFromTemplate(id: string) {
    const t = spaceTemplates.find((x) => x.id === id);
    if (!t) return;
    setSpaces([...spaces, makeSpaceFromTemplate(t, 0, [])]);
  }

  function handleCsvImportHere(payload: ImportPayload) {
    setSpaces(payload.spaces);
    setImportBanner(true);
    onCsvImport(payload);
  }

  function copySpace(space: SpaceInstance) {
    setCopyTarget(space);
    setCopyName(`${space.name} (copy)`);
    setCopyModalOpen(true);
  }

  function confirmCopy() {
    if (!copyTarget) return;
    const finalName = copyName.trim() || `${copyTarget.name} (copy)`;
    const copied: SpaceInstance = {
      ...copyTarget,
      instanceId: uid(),
      name: finalName,
      subSpaces: copyTarget.subSpaces.map((sub) => ({ ...sub, instanceId: uid() })),
    };
    const idx = spaces.findIndex((s) => s.instanceId === copyTarget.instanceId);
    const next = [...spaces];
    next.splice(idx + 1, 0, copied);
    setSpaces(next);
    setCopyModalOpen(false);
    setCopyTarget(null);
    setCopyName("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>🏠 Add rooms &amp; spaces</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Use templates, palette, or add custom spaces.</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" onClick={() => setPaletteOpen(true)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          📦 Add Space
        </button>
        <button type="button" onClick={() => setTemplatePanelOpen(!templatePanelOpen)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: templatePanelOpen ? "#fef3c7" : "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>
          🏗️ Templates
        </button>
        <button type="button" onClick={() => setCustomModalOpen(true)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>
          ✏️ Custom
        </button>
        <SaveButtons
          myRole={myRole} savingTemplate={savingTemplate} templateSaveMsg={templateSaveMsg}
          activeTemplateSource={activeTemplateSource}
          canSaveCustom={canSaveCustom} canSavePublic={canSavePublic}
          spaces={spaces}
          onSave={onSave} onSaveAsCustom={onSaveAsCustom} onSaveAsPublic={onSaveAsPublic}
        />
        <SpaceRequirementPdfButton
          projectName={projectName} clientName={clientName}
          spaces={spaces} unit={unit} wall={wall} circ={circ}
          costPerSqft={costPerSqft} totals={totals}
          floorGroups={floorGroups} locationLabel={locationLabel}
          disabled={spaces.length === 0} />
        <SpaceRequirementCsvButton
          projectName={projectName} clientName={clientName}
          spaces={spaces} unit={unit} wall={wall} circ={circ}
          totals={totals} locationLabel={locationLabel}
          customRate={customRate}
          disabled={false} onImport={handleCsvImportHere} />
      </div>

      {importBanner && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac" }}>
          <span>📂</span>
          <span style={{ fontSize: 13, color: "#166534", fontWeight: 600, flex: 1 }}>Project imported — review spaces below.</span>
          <button onClick={() => setImportBanner(false)} style={{ fontSize: 11, color: "#166634", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {templatePanelOpen && (
        <TemplatePanel
          projectTemplates={projectTemplates} customTemplates={customTemplates}
          loadingTemplates={loadingTemplates} activeTemplateSource={activeTemplateSource}
          myRole={myRole}
          onLoad={onLoadProjectTemplate} onLoadCustom={onLoadCustomProjectTemplate}
          onDeleteCustom={onDeleteCustom} onDeletePublic={onDeletePublic}
          onClose={() => setTemplatePanelOpen(false)} />
      )}

      {saveAsCustomOpen && canSaveCustom && (
        <SaveAsCustomModal
          defaultLabel={projectName || "Untitled"}
          existingNames={customTemplates.map((t) => t.label)}
          onSave={onSaveAsCustomConfirm}
          onClose={() => setSaveAsCustomOpen(false)} />
      )}

      {spaces.length > 0 && (
        <TotalAreaScaler spaces={spaces} unit={unit} currentNet={totals.net} onScale={setSpaces} />
      )}

      {/* ── Draggable space list ── */}
      {spaces.length > 0 ? (
        <DraggableSpaceList
          spaces={spaces}
          setSpaces={setSpaces}
          unit={unit}
          spaceTemplates={spaceTemplates}
          onCopy={copySpace}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 16, border: "2px dashed #e5e7eb", background: "#fafafa", padding: "40px 16px", textAlign: "center" }}>
          <span style={{ fontSize: 44, marginBottom: 10 }}>🏗️</span>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#9ca3af", margin: "0 0 4px" }}>No rooms yet</p>
          <p style={{ fontSize: 12, color: "#d1d5db", margin: 0 }}>Tap &quot;Add Space&quot;, &quot;Templates&quot;, or import a CSV</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onBack} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 14, fontWeight: 700, color: "#374151", cursor: "pointer" }}>← Back</button>
        <button type="button" onClick={onNext} disabled={spaces.length === 0} style={{
          flex: 3, padding: "13px", borderRadius: 12, border: "none",
          background: spaces.length > 0 ? "#f59e0b" : "#e5e7eb",
          color: spaces.length > 0 ? "#fff" : "#9ca3af",
          fontSize: 14, fontWeight: 800, cursor: spaces.length > 0 ? "pointer" : "not-allowed",
          boxShadow: spaces.length > 0 ? "0 4px 16px #f59e0b55" : "none",
        }}>
          {spaces.length === 0 ? "Add at least one room" : `See Summary (${spaces.length}) →`}
        </button>
      </div>

      {paletteOpen && (
        <PaletteDrawer spaceTemplates={spaceTemplates}
          onAdd={addFromTemplate} onCustom={() => setCustomModalOpen(true)}
          onClose={() => setPaletteOpen(false)} />
      )}
      {customModalOpen && (
        <CustomSpaceModal onAdd={(s) => setSpaces([...spaces, s])} onClose={() => setCustomModalOpen(false)} unit={unit} />
      )}

      {/* Copy Space Modal */}
      {copyModalOpen && copyTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 400, padding: 16,
        }}>
          <div style={{
            background: "#ffffff", borderRadius: 16, padding: 24,
            width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,.2)",
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#111827" }}>📋 Copy Space</h3>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Space Name</label>
            <input
              autoFocus value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmCopy()}
              placeholder="Enter space name"
              style={{
                width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 9,
                border: "1.5px solid #e5e7eb", boxSizing: "border-box", outline: "none",
                background: "#ffffff", color: "#111827", marginBottom: 20,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={confirmCopy} style={{
                flex: 1, padding: "11px", borderRadius: 9, border: "none",
                background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>Copy Space</button>
              <button type="button" onClick={() => { setCopyModalOpen(false); setCopyTarget(null); setCopyName(""); }} style={{
                padding: "11px 16px", borderRadius: 9, border: "1px solid #e5e7eb",
                background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StepSummary ──────────────────────────────────────────────

export function StepSummary({
  spaces, unit, wall, circ, costPerSqft, rateStatus, locationLabel,
  projectName, clientName, floorGroups, totals, myRole,
  savingTemplate, templateSaveMsg, activeTemplateSource,
  onSave, onSaveAsCustom, onSaveAsPublic,
  onCsvImport, onBack, onEdit,
  customRate,
}: {
  spaces: SpaceInstance[]; unit: UnitKey;
  wall: number; circ: number; costPerSqft: number;
  rateStatus: ApiRateStatus | null; locationLabel: string;
  projectName: string; clientName: string;
  floorGroups: Map<number, SpaceInstance[]>;
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  myRole: ApiMyRole | null;
  savingTemplate: boolean; templateSaveMsg: string;
  activeTemplateSource: ActiveTemplateSource;
  onSave: () => void;
  onSaveAsCustom: () => void;
  onSaveAsPublic: () => void;
  onCsvImport: (p: ImportPayload) => void;
  onBack: () => void; onEdit: () => void;
  customRate: number | null;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const canSaveCustom = myRole?.can_save_custom_templates ?? false;
  const canSavePublic = myRole?.role === "member" || myRole?.role === "admin";

  const rows = [
    { label: "Net Carpet Area",         value: fmt(totals.net,   unit), hint: "Actual usable floor area inside all rooms.", color: "#111827", bg: "#f9fafb", bold: false },
    { label: `+ Wall (${wall}%)`,        value: `+${fmt(totals.wallA, unit)}`, hint: "Extra area for walls and columns.", color: "#6b7280", bg: "#f9fafb", bold: false },
    { label: `+ Circulation (${circ}%)`, value: `+${fmt(totals.circA, unit)}`, hint: "Corridors, staircase, lift lobby.", color: "#6b7280", bg: "#f9fafb", bold: false },
    { label: "= Gross Built-up Area",    value: fmt(totals.gross, unit), hint: "Total area used for cost calculation.", color: "#d97706", bg: "#fffbeb", bold: true  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>📊 Your Estimate</h2>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          {locationLabel || "No location"} · {spaces.length} room{spaces.length !== 1 ? "s" : ""}{clientName ? ` · ${clientName}` : ""}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        <SpaceRequirementPdfButton projectName={projectName} clientName={clientName}
          spaces={spaces} unit={unit} wall={wall} circ={circ}
          costPerSqft={costPerSqft} totals={totals} floorGroups={floorGroups}
          locationLabel={locationLabel} disabled={false} />
        <SpaceRequirementCsvButton projectName={projectName} clientName={clientName}
          spaces={spaces} unit={unit} wall={wall} circ={circ}
          totals={totals} locationLabel={locationLabel} disabled={false} onImport={onCsvImport} customRate={customRate} />
        <SaveButtons
          myRole={myRole} savingTemplate={savingTemplate} templateSaveMsg={templateSaveMsg}
          activeTemplateSource={activeTemplateSource}
          canSaveCustom={canSaveCustom} canSavePublic={canSavePublic}
          spaces={spaces}
          onSave={onSave} onSaveAsCustom={onSaveAsCustom} onSaveAsPublic={onSaveAsPublic}
        />
      </div>

      {(rateStatus || customRate !== null) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "12px 14px", borderRadius: 10,
          background: customRate !== null ? "#fdf2f8" : "#f9fafb",
          border: `1px solid ${customRate !== null ? "#f9a8d4" : "#e5e7eb"}`,
        }}>
          <RateBadge source={customRate !== null ? "custom" : (rateStatus?.source ?? "fallback")} />
          <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>
            {customRate !== null ? "Custom rate override — survey rate ignored" : rateStatus?.label}
          </span>
          <strong style={{ fontSize: 16, color: customRate !== null ? "#be185d" : "#d97706", fontFamily: "monospace", letterSpacing: -0.5 }}>
            ₹{costPerSqft.toLocaleString("en-IN")}/sqft
          </strong>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, margin: "0 0 2px" }}>Area Breakdown</p>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 9, background: r.bg, border: r.bold ? "1.5px solid #fcd34d" : "1px solid #e5e7eb" }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: r.bold ? 700 : 400, color: r.color }}>
              {r.label}
              <InfoBox icon="📐" title={r.label.replace(/^[+=] /, "")} body={r.hint} />
            </span>
            <span style={{ fontFamily: "monospace", fontWeight: r.bold ? 800 : 600, fontSize: r.bold ? 15 : 13, color: r.color }}>
              {r.value} {aLabel}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderRadius: 16, padding: "20px 20px", background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)", border: "2px solid #a7f3d0", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: .7, margin: "0 0 6px" }}>Estimated Construction Cost</p>
        <p style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 36, color: "#047857", margin: "0 0 6px", letterSpacing: -1 }}>{fmtCost(totals.cost)}</p>
        <p style={{ fontSize: 12, color: "#6ee7b7", margin: 0 }}>₹{costPerSqft.toLocaleString("en-IN")}/sqft × {fmt(totals.gross, "sqft")} sqft</p>
        <p style={{ fontSize: 11, color: "#059669", margin: "4px 0 0", opacity: .7 }}>All finishes, furnishings &amp; professional fees included , also estimate is not final - subjected to the final design</p>
      </div>

      {floorGroups.size > 1 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, margin: "0 0 8px" }}>By Floor</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {Array.from(floorGroups.entries()).map(([floor, fs]) => {
              const fa = fs.reduce((a, s) => a + calcSpaceArea(s), 0);
              return (
                <div key={floor} style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#f9fafb", textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, margin: "0 0 2px" }}>{getFloorLabel(floor)}</p>
                  <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151", margin: 0 }}>{fmt(fa, unit)} {aLabel}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, margin: "0 0 8px" }}>By Room Type</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const catSpaces = spaces.filter((s) => s.category === cat);
            if (!catSpaces.length) return null;
            const catArea = catSpaces.reduce((a, s) => a + calcSpaceArea(s), 0);
            const pct = totals.net > 0 ? Math.round((catArea / totals.net) * 100) : 0;
            return (
              <div key={cat} style={{ padding: "9px 12px", borderRadius: 9, border: `1px solid ${meta.border}`, background: meta.bg }}>
                <p style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: meta.badge, margin: "0 0 2px" }}>{meta.label}</p>
                <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151", margin: 0 }}>
                  {fmt(catArea, unit)} {aLabel}<span style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af" }}> ({pct}%)</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, margin: "0 0 8px" }}>Room List</p>
        <div style={{ borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {spaces.map((s, i) => {
            const meta = CATEGORY_META[s.category];
            return (
              <div key={s.instanceId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: i < spaces.length - 1 ? "1px solid #f3f4f6" : "none", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#374151" }}>{s.name}</span>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: meta.bg, color: meta.badge, fontWeight: 700, border: `1px solid ${meta.border}` }}>{meta.label}</span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280", flexShrink: 0 }}>{fmt(calcSpaceArea(s), unit)} {aLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onBack} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer" }}>← Back</button>
        <button type="button" onClick={onEdit} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "1.5px solid #6366f1", background: "#eef2ff", fontSize: 13, fontWeight: 700, color: "#4338ca", cursor: "pointer" }}>✏️ Edit Rooms</button>
      </div>
    </div>
  );
}