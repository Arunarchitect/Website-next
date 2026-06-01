/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import SpaceRequirementPdfButton from "./SpaceRequirementPdfButton";
import SpaceRequirementCsvButton, {
  type ImportPayload,
} from "./SpaceRequirementCsvButton";
import {
  UNIT_SYSTEMS,
  CATEGORY_META,
  FLOORS,
  getFloorLabel,
  uid,
  dimFromUnit,
  dimToUnit,
  fmt,
  fmtCost,
  calcSpaceArea,
  calcGrossArea,
  groupByFloor,
  makeSpaceFromTemplate,
  type UnitKey,
  type CategoryKey,
  type SpaceTemplate,
  type SubSpaceInstance,
  type SpaceInstance,
  type ProjectTemplate,
} from "./areadata";
import {
  fetchCountries,
  fetchStates,
  fetchPlaces,
  fetchRateLookup,
  fetchSpaceTemplates,
  fetchProjectTemplates,
  toSpaceTemplate,
  toProjectTemplate,
  fetchMyRole,
  fetchCustomProjectTemplates,
  saveCustomProjectTemplate,
  updateCustomProjectTemplate,
  saveGeneralProjectTemplate,
  updatePublicProjectTemplate,
  fetchRateSnapshot,
  deleteCustomProjectTemplate,
  deletePublicProjectTemplate,
  type ApiCountry,
  type ApiState,
  type ApiRateStatus,
  type ApiMyRole,
  type ApiCustomProjectTemplate,
  type ApiProjectTemplate,
  type ApiRateSnapshot,
} from "./areacalcApi";

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

type WizardStep = "location" | "project-type" | "spaces" | "summary";
const WIZARD_STEPS: { id: WizardStep; label: string; emoji: string }[] = [
  { id: "location",     label: "Location", emoji: "📍" },
  { id: "project-type", label: "Project",  emoji: "🏗️" },
  { id: "spaces",       label: "Rooms",    emoji: "🏠" },
  { id: "summary",      label: "Summary",  emoji: "📊" },
];

const OCCUPANCY_TYPE_META: Record<string, { emoji: string; label: string }> = {
  residential:   { emoji: "🏠", label: "Home / Villa"        },
  commercial:    { emoji: "🏢", label: "Shop / Office"       },
  institutional: { emoji: "🏫", label: "School / Hospital"   },
  industrial:    { emoji: "🏭", label: "Warehouse / Factory" },
  mixed:         { emoji: "🏙️", label: "Mixed Use"           },
};
const FINISH_LEVEL_META: Record<string, { emoji: string; label: string; hint: string }> = {
  basic:    { emoji: "🪨", label: "Basic",    hint: "Plain plaster, simple tiles"      },
  medium:   { emoji: "🧱", label: "Medium",   hint: "Branded tiles, modular kitchen"   },
  standard: { emoji: "🧱", label: "Standard", hint: "Branded tiles, modular kitchen"   },
  premium:  { emoji: "✨", label: "Premium",  hint: "Imported materials, false ceiling" },
  luxury:   { emoji: "💎", label: "Luxury",   hint: "Marble, designer fittings"        },
};

// ─── Active template source type ─────────────────────────────
// Tracks what template is currently "open" so Save knows where to write.
type ActiveTemplateSource =
  | { type: "custom"; id: number }
  | { type: "public"; id: number }  // id = numeric DB pk
  | null;

// ─── Tiny helpers ─────────────────────────────────────────────

function Spin({ size = 16, color = "#6b7280" }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${color}33`, borderTop: `2px solid ${color}`,
      borderRadius: "50%", animation: "spin .7s linear infinite", flexShrink: 0,
    }} />
  );
}

function InfoBox({ icon, title, body }: { icon: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <button type="button" onClick={() => setOpen(true)} style={{
        fontSize: 11, width: 16, height: 16, borderRadius: "50%",
        border: "1.5px solid #d1d5db", background: "#f9fafb",
        color: "#6b7280", cursor: "pointer", display: "inline-flex",
        alignItems: "center", justifyContent: "center", fontWeight: 700, marginLeft: 4,
      }}>?</button>
      {open && (
        <span onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <span onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,.2)",
          }}>
            <p style={{ fontSize: 26, margin: "0 0 8px" }}>{icon}</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>{title}</p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.6 }}>{body}</p>
            <button type="button" onClick={() => setOpen(false)} style={{
              width: "100%", padding: "10px", borderRadius: 8, border: "none",
              background: "#f3f4f6", color: "#374151", fontWeight: 700, cursor: "pointer",
            }}>Got it</button>
          </span>
        </span>
      )}
    </span>
  );
}

function RateBadge({ source }: { source: string }) {
  const MAP: Record<string, { label: string; color: string; bg: string }> = {
    survey:                { label: "📍 Local data",  color: "#047857", bg: "#ecfdf5" },
    survey_all_categories: { label: "📊 Area data",   color: "#1d4ed8", bg: "#eff6ff" },
    country_average:       { label: "🌍 Country avg", color: "#6d28d9", bg: "#f5f3ff" },
    fallback:              { label: "📌 Estimated",   color: "#b45309", bg: "#fffbeb" },
    custom:                { label: "✏️ Custom rate",  color: "#be185d", bg: "#fdf2f8" },
  };
  const s = MAP[source] ?? { label: source, color: "#6b7280", bg: "#f9fafb" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
      background: s.bg, color: s.color, display: "inline-block",
    }}>{s.label}</span>
  );
}

function BigOption({ selected, onClick, emoji, label, hint, accent = "#f59e0b" }: {
  selected: boolean; onClick: () => void;
  emoji: string; label: string; hint?: string; accent?: string;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      gap: 3, padding: "12px 14px", borderRadius: 12,
      border: `2px solid ${selected ? accent : "#e5e7eb"}`,
      background: selected ? `${accent}14` : "#fff",
      cursor: "pointer", textAlign: "left", flex: "1 1 120px",
      transition: "all .18s",
      boxShadow: selected ? `0 0 0 3px ${accent}33` : "none",
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{label}</span>
      {hint && <span style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>{hint}</span>}
    </button>
  );
}

// ─── DimAreaEditor ────────────────────────────────────────────

function DimAreaEditor({ L, B, unit, onUpdate }: {
  L: number; B: number; unit: UnitKey;
  onUpdate: (L: number, B: number) => void;
}) {
  const uLabel = UNIT_SYSTEMS[unit].dimLabel;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;

  const [lDraft, setLDraft] = useState(() => String(+dimToUnit(L, unit).toFixed(unit === "sqm" ? 2 : 1)));
  const [bDraft, setBDraft] = useState(() => String(+dimToUnit(B, unit).toFixed(unit === "sqm" ? 2 : 1)));
  const [aDraft, setADraft] = useState(() => {
    const a = dimToUnit(L, unit) * dimToUnit(B, unit);
    return String(+a.toFixed(1));
  });
  const [areaError, setAreaError] = useState("");

  useEffect(() => {
    const ld = +dimToUnit(L, unit).toFixed(unit === "sqm" ? 2 : 1);
    const bd = +dimToUnit(B, unit).toFixed(unit === "sqm" ? 2 : 1);
    setLDraft(String(ld));
    setBDraft(String(bd));
    setADraft(String(+(ld * bd).toFixed(1)));
    setAreaError("");
  }, [unit, L, B]);

  function commitL(raw: string) {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setLDraft(String(n));
    const newL = dimFromUnit(n, unit);
    const bd = parseFloat(bDraft);
    if (Number.isFinite(bd) && bd > 0) setADraft(String(+(n * bd).toFixed(1)));
    onUpdate(newL, B);
  }

  function commitB(raw: string) {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setBDraft(String(n));
    const newB = dimFromUnit(n, unit);
    const ld = parseFloat(lDraft);
    if (Number.isFinite(ld) && ld > 0) setADraft(String(+(ld * n).toFixed(1)));
    onUpdate(L, newB);
  }

  function applyArea() {
    const targetDisplay = parseFloat(aDraft);
    if (!Number.isFinite(targetDisplay) || targetDisplay <= 0) { setAreaError("Enter a valid area > 0"); return; }
    const currentL = dimToUnit(L, unit);
    const currentB = dimToUnit(B, unit);
    const currentArea = currentL * currentB;
    if (currentArea <= 0) { setAreaError("Current dims are zero"); return; }
    const scale = Math.sqrt(targetDisplay / currentArea);
    const newLDisplay = +(currentL * scale).toFixed(unit === "sqm" ? 2 : 1);
    const newBDisplay = +(currentB * scale).toFixed(unit === "sqm" ? 2 : 1);
    setLDraft(String(newLDisplay));
    setBDraft(String(newBDisplay));
    setADraft(String(+(newLDisplay * newBDisplay).toFixed(1)));
    setAreaError("");
    onUpdate(dimFromUnit(newLDisplay, unit), dimFromUnit(newBDisplay, unit));
  }

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    fontSize: 13, padding: "6px 8px", borderRadius: 7,
    border: "1.5px solid #e5e7eb", outline: "none",
    background: "#fff", color: "#111827", fontFamily: "monospace", fontWeight: 700,
    width: 80, ...extra,
  });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>
          Length ({uLabel})
        </label>
        <input type="number" min={0.1} step={unit === "sqm" ? 0.1 : 0.5}
          value={lDraft} onChange={(e) => setLDraft(e.target.value)}
          onBlur={(e) => commitL(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitL((e.target as HTMLInputElement).value)}
          style={inp()} />
      </div>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>
          Width ({uLabel})
        </label>
        <input type="number" min={0.1} step={unit === "sqm" ? 0.1 : 0.5}
          value={bDraft} onChange={(e) => setBDraft(e.target.value)}
          onBlur={(e) => commitB(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitB((e.target as HTMLInputElement).value)}
          style={inp()} />
      </div>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>
          Area ({aLabel})
        </label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="number" min={0.1} step={1} value={aDraft}
            onChange={(e) => { setADraft(e.target.value); setAreaError(""); }}
            onKeyDown={(e) => e.key === "Enter" && applyArea()}
            style={inp({ width: 96, border: areaError ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb" })} />
          <button type="button" onClick={applyArea} title="Apply area — scales L & W proportionally" style={{
            height: 30, minWidth: 32, borderRadius: 7,
            border: "1px solid #16a34a", background: "#dcfce7",
            color: "#166534", cursor: "pointer", fontWeight: 800, fontSize: 13,
          }}>✓</button>
        </div>
        {areaError && <p style={{ fontSize: 10, color: "#ef4444", margin: "3px 0 0" }}>{areaError}</p>}
      </div>
      <span style={{ fontSize: 10, color: "#d1d5db", paddingBottom: 4, whiteSpace: "nowrap" }}>Press ✓ or Enter to apply area</span>
    </div>
  );
}

// ─── TotalAreaScaler ──────────────────────────────────────────

function TotalAreaScaler({ spaces, unit, currentNet, onScale }: {
  spaces: SpaceInstance[]; unit: UnitKey; currentNet: number;
  onScale: (scaledSpaces: SpaceInstance[]) => void;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const toDisplay = (sqft: number) => unit === "sqm" ? sqft * 0.0929 : sqft;
  const fromDisplay = (val: number) => unit === "sqm" ? val / 0.0929 : val;

  const [draft, setDraft] = useState(() => String(+toDisplay(currentNet).toFixed(1)));
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setDraft(String(+toDisplay(currentNet).toFixed(1)));
    setApplied(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, currentNet]);

  function applyScale() {
    const targetDisplay = parseFloat(draft);
    if (!Number.isFinite(targetDisplay) || targetDisplay <= 0) { setError("Enter a valid area > 0"); return; }
    const targetSqft = fromDisplay(targetDisplay);
    if (currentNet <= 0) { setError("Add some rooms first."); return; }
    const ratio = Math.sqrt(targetSqft / currentNet);
    const scaled = spaces.map((s): SpaceInstance => ({
      ...s,
      L: +(s.L * ratio).toFixed(2),
      B: +(s.B * ratio).toFixed(2),
      subSpaces: s.subSpaces.map((sub): SubSpaceInstance => ({
        ...sub,
        L: +(sub.L * ratio).toFixed(2),
        B: +(sub.B * ratio).toFixed(2),
      })),
    }));
    setError("");
    setApplied(true);
    onScale(scaled);
    setTimeout(() => setApplied(false), 2000);
  }

  if (spaces.length === 0) return null;

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: "linear-gradient(135deg, #fefce8, #fff7ed)",
      border: "1.5px solid #fcd34d",
      display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end",
    }}>
      <div style={{ flex: "0 0 auto" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: .4 }}>
          🎯 Scale Total Area
        </p>
        <p style={{ margin: 0, fontSize: 10, color: "#b45309", lineHeight: 1.4 }}>
          Set target net carpet area — all rooms resize proportionally
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 10, color: "#92400e", display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>
            Target ({aLabel})
          </label>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="number" min={1} step={unit === "sqm" ? 1 : 10} value={draft}
              onChange={(e) => { setDraft(e.target.value); setError(""); setApplied(false); }}
              onKeyDown={(e) => e.key === "Enter" && applyScale()}
              style={{
                fontSize: 14, padding: "7px 10px", borderRadius: 8, fontFamily: "monospace",
                border: error ? "2px solid #ef4444" : "2px solid #fcd34d",
                outline: "none", background: "#fff", fontWeight: 700, color: "#111827", width: 110,
              }} />
            <button type="button" onClick={applyScale} style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: applied ? "#16a34a" : "#d97706",
              color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
              transition: "background .2s", display: "flex", alignItems: "center", gap: 5,
            }}>
              {applied ? "✓ Applied" : "Apply"}
            </button>
          </div>
          {error && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#ef4444" }}>{error}</p>}
        </div>
        <div style={{ fontSize: 11, color: "#92400e", lineHeight: 1.5, paddingBottom: 2 }}>
          Current: <strong style={{ fontFamily: "monospace" }}>
            {+toDisplay(currentNet).toFixed(1)} {aLabel}
          </strong>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-space row ────────────────────────────────────────────

function SubSpaceRow({ sub, onUpdate, onRemove, onCopy, unit }: {
  sub: SubSpaceInstance; onUpdate: (s: SubSpaceInstance) => void;
  onRemove: () => void; onCopy: () => void; unit: UnitKey;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  return (
    <div style={{
      marginLeft: 12, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8,
      alignItems: "flex-start", background: "#f9fafb", border: "1px solid #e5e7eb",
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>↳ {sub.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={onCopy} title="Duplicate sub-space" style={{
            fontSize: 13, background: "none", border: "1px solid #d1d5db",
            borderRadius: 5, cursor: "pointer", padding: "2px 6px",
            color: "#6b7280", lineHeight: 1, display: "flex", alignItems: "center",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button onClick={onRemove} title="Remove sub-space" style={{
            fontSize: 13, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
          }}>✕</button>
        </div>
      </div>
      <DimAreaEditor L={sub.L} B={sub.B} unit={unit}
        onUpdate={(newL, newB) => onUpdate({ ...sub, L: newL, B: newB })} />
      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
          = {fmt(sub.L * sub.B, unit)} {aLabel}
        </span>
        <input type="text" value={sub.description}
          onChange={(e) => onUpdate({ ...sub, description: e.target.value })}
          placeholder="Note…"
          style={{ flex: 1, fontSize: 11, padding: "3px 7px", borderRadius: 6, border: "1px solid #e5e7eb", color: "#6b7280" }} />
      </div>
    </div>
  );
}

// ─── SpaceCard ────────────────────────────────────────────────

function SpaceCard({ space, onUpdate, onRemove, onCopy, unit, spaceTemplates }: {
  space: SpaceInstance; onUpdate: (s: SpaceInstance) => void;
  onRemove: () => void; onCopy: () => void; unit: UnitKey; spaceTemplates: SpaceTemplate[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addingCustomSub, setAddingCustomSub] = useState(false);
  const [customSubName, setCustomSubName] = useState("");
  const meta = CATEGORY_META[space.category];
  const template = spaceTemplates.find((t) => t.id === space.templateId);
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const totalArea = fmt(calcSpaceArea(space), unit);
  const mainArea = fmt(space.L * space.B, unit);

  function addSubFromTemplate(subId: string) {
    const subT = (template?.subSpaces ?? []).find((s) => s.id === subId);
    if (!subT) return;
    onUpdate({
      ...space, subSpaces: [...space.subSpaces, {
        instanceId: uid(), templateId: subT.id, name: subT.name,
        L: subT.L, B: subT.B, description: subT.description,
      }],
    });
    setAddSubOpen(false);
  }

  function addCustomSub() {
    if (!customSubName.trim()) return;
    onUpdate({
      ...space, subSpaces: [...space.subSpaces, {
        instanceId: uid(), templateId: "custom", name: customSubName.trim(),
        L: 8, B: 6, description: "",
      }],
    });
    setCustomSubName(""); setAddingCustomSub(false); setAddSubOpen(false);
  }

  function copySubSpace(sub: SubSpaceInstance) {
    const copied: SubSpaceInstance = { ...sub, instanceId: uid(), name: `${sub.name} (copy)` };
    const idx = space.subSpaces.findIndex((s) => s.instanceId === sub.instanceId);
    const next = [...space.subSpaces];
    next.splice(idx + 1, 0, copied);
    onUpdate({ ...space, subSpaces: next });
  }

  return (
    <div style={{
      borderRadius: 12, border: `1.5px solid ${meta.border}`,
      background: "#fff", overflow: "hidden", marginBottom: 8,
      boxShadow: "0 1px 4px rgba(0,0,0,.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", flexWrap: "wrap" }}>
        <button onClick={() => setExpanded(!expanded)} style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9ca3af",
          flexShrink: 0, transition: "transform .15s",
          transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
        }}>▾</button>
        <span style={{ fontSize: 20 }}>{space.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#111827", flex: 1, minWidth: 80 }}>{space.name}</span>
        {space.isCustom && (
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "#e5e7eb", color: "#6b7280", fontWeight: 700 }}>Custom</span>
        )}
        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, background: meta.badgeBg, color: meta.badge, fontWeight: 700, border: `1px solid ${meta.border}` }}>{meta.label}</span>
        <select value={space.floor} onChange={(e) => onUpdate({ ...space, floor: parseInt(e.target.value) })}
          style={{ fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" }}>
          {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 8px" }}>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Area</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: space.subSpaces.length ? meta.color : "#374151" }}>
            {space.subSpaces.length ? totalArea : mainArea} {aLabel}
          </span>
        </div>
        <button onClick={onCopy} title="Duplicate space" style={{
          fontSize: 15, background: "none", border: "1px solid #d1d5db",
          borderRadius: 6, cursor: "pointer", padding: "4px 7px", color: "#6b7280", opacity: .7,
          display: "flex", alignItems: "center",
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1"; (e.currentTarget as HTMLButtonElement).style.color = "#6366f1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#d1d5db"; (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button onClick={onRemove} style={{ fontSize: 15, background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "3px 5px", opacity: .6 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; }}>🗑</button>
      </div>

      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ marginTop: 10 }}>
            <DimAreaEditor L={space.L} B={space.B} unit={unit}
              onUpdate={(newL, newB) => onUpdate({ ...space, L: newL, B: newB })} />
          </div>
          {space.subSpaces.map((sub) => (
            <SubSpaceRow key={sub.instanceId} sub={sub} unit={unit}
              onUpdate={(u) => onUpdate({ ...space, subSpaces: space.subSpaces.map((s) => s.instanceId === sub.instanceId ? u : s) })}
              onRemove={() => onUpdate({ ...space, subSpaces: space.subSpaces.filter((s) => s.instanceId !== sub.instanceId) })}
              onCopy={() => copySubSpace(sub)} />
          ))}
          <div style={{ marginTop: 10, marginLeft: 12 }}>
            {addSubOpen ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {(template?.subSpaces ?? []).filter((s) => !space.subSpaces.find((ss) => ss.templateId === s.id)).map((s) => (
                  <button key={s.id} onClick={() => addSubFromTemplate(s.id)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 20,
                    border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#374151",
                  }}>+ {s.name}</button>
                ))}
                {addingCustomSub ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input autoFocus value={customSubName}
                      onChange={(e) => setCustomSubName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomSub()}
                      placeholder="Sub-space name"
                      style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid #d1d5db", width: 130 }} />
                    <button onClick={addCustomSub} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer" }}>Add</button>
                    <button onClick={() => setAddingCustomSub(false)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingCustomSub(true)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 20,
                    border: "1px dashed #9ca3af", background: "#f9fafb", cursor: "pointer", color: "#6b7280",
                  }}>+ Custom</button>
                )}
                <button onClick={() => { setAddSubOpen(false); setAddingCustomSub(false); }} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddSubOpen(true)} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 14 }}>⊕</span> Add sub-space
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom Space Modal ───────────────────────────────────────

function CustomSpaceModal({ onAdd, onClose }: { onAdd: (s: SpaceInstance) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("residence");
  const [L, setL] = useState(12);
  const [B, setB] = useState(10);
  const [icon, setIcon] = useState("📐");
  const [floor, setFloor] = useState(0);
  const icons = ["📐","🏗️","🏠","🛋️","🛏️","🍳","🚿","🌿","🚗","💼","📚","🔬","🏥","🛍️","🎉","✨","🏨","🏢","🪑","🩺","💊","🎭","📖","🅿️","🍴","🔑","🪜","↔️"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.2)" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 800, color: "#111827" }}>✏️ Custom Space</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>Space Name *</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && (onAdd({ instanceId: uid(), templateId: "custom", name: name.trim(), category, L, B, floor, icon, description: "", subSpaces: [], isCustom: true }), onClose())}
            placeholder="e.g. Server Room, Prayer Hall…"
            style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as CategoryKey)}
              style={{ width: "100%", fontSize: 13, padding: "7px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>Floor</label>
            <select value={floor} onChange={(e) => setFloor(parseInt(e.target.value))}
              style={{ width: "100%", fontSize: 13, padding: "7px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[{ label: "Length (ft)", val: L, set: setL }, { label: "Width (ft)", val: B, set: setB }].map(({ label, val, set }) => (
            <div key={label} style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>{label}</label>
              <input type="number" value={val} min={1} step={0.5}
                onChange={(e) => (set as (n: number) => void)(parseFloat(e.target.value) || 1)}
                style={{ width: "100%", fontSize: 14, padding: "7px 8px", borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 }}>Icon</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 18 }}>
          {icons.map((ic) => (
            <button key={ic} onClick={() => setIcon(ic)} style={{
              fontSize: 18, background: icon === ic ? "#fef3c7" : "#f9fafb",
              border: icon === ic ? "2px solid #f59e0b" : "1px solid #e5e7eb",
              borderRadius: 8, width: 36, height: 36, cursor: "pointer",
            }}>{ic}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => {
            if (!name.trim()) return;
            onAdd({ instanceId: uid(), templateId: "custom", name: name.trim(), category, L, B, floor, icon, description: "", subSpaces: [], isCustom: true });
            onClose();
          }} disabled={!name.trim()} style={{
            flex: 1, padding: "11px", borderRadius: 9, border: "none",
            background: name.trim() ? "#1d4ed8" : "#e5e7eb",
            color: name.trim() ? "#fff" : "#9ca3af",
            fontWeight: 700, cursor: name.trim() ? "pointer" : "default", fontSize: 14,
          }}>Add Space</button>
          <button onClick={onClose} style={{ padding: "11px 18px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Palette Drawer ───────────────────────────────────────────

function PaletteDrawer({ spaceTemplates, onAdd, onCustom, onClose }: {
  spaceTemplates: SpaceTemplate[];
  onAdd: (id: string) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  const filtered = useMemo(() => spaceTemplates.filter((t) => {
    const catOk = activeCat === "all" || t.category === activeCat;
    const qOk = !search.trim() || t.name.toLowerCase().includes(search.toLowerCase());
    return catOk && qOk;
  }), [spaceTemplates, activeCat, search]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,.4)" }} onClick={onClose} />
      <div style={{ width: "min(340px, 92vw)", background: "#fff", height: "100%", overflowY: "auto", padding: 16, boxShadow: "-4px 0 24px rgba(0,0,0,.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>Space Palette</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>
        <input type="text" placeholder="🔍 Search rooms…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 9, border: "1.5px solid #e5e7eb", background: "#f9fafb", marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {[{ key: "all", label: "All" }, ...Object.entries(CATEGORY_META).map(([k, v]) => ({ key: k, label: v.label.split(" ")[0] }))].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveCat(key)} style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              border: "1px solid", borderColor: activeCat === key ? "#374151" : "#e5e7eb",
              background: activeCat === key ? "#374151" : "#fff",
              color: activeCat === key ? "#fff" : "#6b7280", cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>
        <div>
          {filtered.length === 0 && <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 16 }}>No spaces found</p>}
          {filtered.map((t) => {
            const meta = CATEGORY_META[t.category as CategoryKey];
            return (
              <button key={t.id} onClick={() => { onAdd(t.id); onClose(); }} style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%",
                padding: "8px 10px", borderRadius: 8, border: `1px solid ${meta.border}`,
                background: meta.bg, marginBottom: 4, cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</p>
                  <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, fontFamily: "monospace" }}>{t.L}′×{t.B}′</p>
                </div>
                <span style={{ fontSize: 14, color: "#d1d5db" }}>+</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => { onCustom(); onClose(); }} style={{
          width: "100%", marginTop: 8, padding: "9px", borderRadius: 8,
          border: "1px dashed #d1d5db", background: "#f9fafb",
          cursor: "pointer", fontSize: 12, color: "#6b7280", fontWeight: 600,
        }}>✏️ Custom Space</button>
      </div>
    </div>
  );
}

// ─── Template Panel ───────────────────────────────────────────

function TemplatePanel({
  projectTemplates, customTemplates, loadingTemplates,
  activeTemplateSource, myRole,
  onLoad, onLoadCustom, onDeleteCustom, onDeletePublic, onClose,
}: {
  projectTemplates: ProjectTemplate[];
  customTemplates: ApiCustomProjectTemplate[];
  loadingTemplates: boolean;
  activeTemplateSource: ActiveTemplateSource;
  myRole: ApiMyRole | null;
  onLoad: (t: ProjectTemplate) => void;
  onLoadCustom: (t: ApiCustomProjectTemplate) => void;
  onDeleteCustom: (id: number) => void;
  onDeletePublic: (id: string) => void;
  onClose: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canManage = myRole?.role === "member" || myRole?.role === "admin";

  async function confirmDeleteCustom(id: number, label: string) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setDeletingId(`c_${id}`);
    try { await onDeleteCustom(id); }
    finally { setDeletingId(null); }
  }

  async function confirmDeletePublic(id: string, label: string) {
    if (!confirm(`Delete public template "${label}"? All users will lose access.`)) return;
    setDeletingId(`p_${id}`);
    try { await onDeletePublic(id); }
    finally { setDeletingId(null); }
  }

  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#374151" }}>🏗️ Project Templates</p>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af" }}>✕</button>
      </div>

      {loadingTemplates ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 13 }}><Spin /> Loading…</div>
      ) : (
        <>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .5, margin: "0 0 8px" }}>
            Public templates
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {projectTemplates.map((tpl) => {
              const isActive = activeTemplateSource?.type === "public" && activeTemplateSource.id === tpl.dbId;
              return (
                <div key={tpl.id} style={{ position: "relative" }}>
                  <button onClick={() => { onLoad(tpl); onClose(); }} style={{
                    display: "flex", flexDirection: "column", gap: 3,
                    padding: canManage ? "12px 30px 12px 14px" : "12px 14px",
                    borderRadius: 10,
                    border: isActive ? "2px solid #6366f1" : "1.5px solid #e5e7eb",
                    background: isActive ? "#eef2ff" : "#f9fafb",
                    cursor: "pointer", minWidth: 130, textAlign: "left", transition: "all .15s",
                  }}
                    onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "#fffbeb"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fcd34d"; } }}
                    onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; } }}>
                    <span style={{ fontSize: 24 }}>{tpl.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{tpl.label}</span>
                    <span style={{ fontSize: 10, color: isActive ? "#4338ca" : "#9ca3af" }}>{isActive ? "✓ Active" : tpl.description}</span>
                  </button>
                  {canManage && (
                    <button
                      onClick={() => confirmDeletePublic(tpl.id, tpl.label)}
                      disabled={deletingId === `p_${tpl.id}`}
                      title="Delete public template"
                      style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#d1d5db", padding: 2, lineHeight: 1 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d1d5db"; }}>
                      {deletingId === `p_${tpl.id}` ? <Spin size={10} /> : "🗑"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {customTemplates.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: .5, margin: "14px 0 8px" }}>
            My saved templates
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {customTemplates.map((tpl) => {
              const isActive = activeTemplateSource?.type === "custom" && activeTemplateSource.id === tpl.id;
              return (
                <div key={tpl.id} style={{ position: "relative" }}>
                  <button onClick={() => { onLoadCustom(tpl); onClose(); }} style={{
                    display: "flex", flexDirection: "column", gap: 3,
                    padding: "12px 32px 12px 14px",
                    borderRadius: 10,
                    border: isActive ? "2px solid #16a34a" : "1.5px solid #bbf7d0",
                    background: isActive ? "#dcfce7" : "#f0fdf4",
                    cursor: "pointer", minWidth: 130, textAlign: "left",
                  }}>
                    <span style={{ fontSize: 24 }}>{tpl.icon || "🏠"}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#14532d" }}>{tpl.label}</span>
                    <span style={{ fontSize: 10, color: "#166534" }}>{isActive ? "✓ Active" : "Saved"}</span>
                  </button>
                  <button
                    onClick={() => confirmDeleteCustom(tpl.id, tpl.label)}
                    disabled={deletingId === `c_${tpl.id}`}
                    title="Delete this template"
                    style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#d1d5db", padding: 2, lineHeight: 1 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d1d5db"; }}>
                    {deletingId === `c_${tpl.id}` ? <Spin size={10} /> : "🗑"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SaveAsCustomModal ────────────────────────────────────────

function SaveAsCustomModal({ defaultLabel, existingNames, onSave, onClose }: {
  defaultLabel: string;
  existingNames: string[];
  onSave: (label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(`${defaultLabel} (copy)`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function validate(v: string) {
    const trimmed = v.trim();
    if (!trimmed) return "Name is required.";
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase()))
      return `You already have a template named "${trimmed}". Choose a different name.`;
    return "";
  }

  async function handleSave() {
    const err = validate(label);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await onSave(label.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 350, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,.2)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#111827" }}>💾 Save as Custom Template</h3>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
          Template Name <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input autoFocus value={label}
          onChange={(e) => { setLabel(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. My 3-Bed Villa"
          style={{
            width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 9,
            border: `1.5px solid ${error ? "#ef4444" : "#e5e7eb"}`,
            boxSizing: "border-box", outline: "none", marginBottom: 6,
          }} />
        {error && <p style={{ fontSize: 11, color: "#ef4444", margin: "0 0 12px" }}>{error}</p>}
        {!error && <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 16px", lineHeight: 1.5 }}>
          Saves all current rooms, dimensions, and settings as a reusable template for you.
        </p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleSave} disabled={saving || !label.trim()} style={{
            flex: 1, padding: "11px", borderRadius: 9, border: "none",
            background: label.trim() && !saving ? "#16a34a" : "#e5e7eb",
            color: label.trim() && !saving ? "#fff" : "#9ca3af",
            fontWeight: 700, fontSize: 14,
            cursor: label.trim() && !saving ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {saving ? <><Spin size={13} color="#fff" /> Saving…</> : "Save"}
          </button>
          <button type="button" onClick={onClose} style={{ padding: "11px 16px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WizardProgress ───────────────────────────────────────────

function WizardProgress({ step, onJump }: { step: WizardStep; onJump: (s: WizardStep) => void }) {
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

// ─── Step 1: Location ─────────────────────────────────────────

function StepLocation({
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

function CustomRateInput({ customRate, setCustomRate }: {
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

// ─── Step 2: Project Type ─────────────────────────────────────

function StepProjectType({
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

// ─── Save as General Template Modal ──────────────────────────

function SaveAsGeneralModal({ spaces, spaceTemplates, onClose, onSaved }: {
  spaces: SpaceInstance[];
  spaceTemplates: SpaceTemplate[];
  onClose: () => void;
  onSaved: (tpl: ApiProjectTemplate) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🏗️");
  const [templateId, setTemplateId] = useState(() => `custom_${Date.now().toString(36)}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ICON_OPTIONS = ["🏗️","🏠","🏢","🏫","🏥","🏨","🏭","🌆","🏛️","🏟️","🏬","🏪","🏰","🛖","🏡"];

  const resolvableSpaces = spaces.filter((s) => {
    if (s.isCustom) return false;
    const tpl = spaceTemplates.find((t) => t.id === s.templateId);
    return !!(tpl as SpaceTemplate & { dbId?: number })?.dbId;
  });

  async function handleSave() {
    if (!label.trim()) { setError("Template name is required."); return; }
    if (resolvableSpaces.length === 0) {
      setError("No template-backed spaces found. Custom spaces cannot be saved as a general template.");
      return;
    }
    const spacesPayload = resolvableSpaces.map((s, idx) => {
      const tpl = spaceTemplates.find((t) => t.id === s.templateId)!;
      const dbId = (tpl as SpaceTemplate & { dbId?: number }).dbId!;
      const subIds = s.subSpaces
        .map((sub) => tpl.subSpaces?.find((x) => x.id === sub.templateId)?.dbId)
        .filter((id): id is number => typeof id === "number");

      return {
        space_template: dbId,
        floor: s.floor,
        override_l: s.L !== tpl.L ? s.L : null,
        override_b: s.B !== tpl.B ? s.B : null,
        sort_order: idx,
        sub_ids: subIds,
      };
    });
    try {
      setSaving(true); setError("");
      const saved = await saveGeneralProjectTemplate({
        template_id: templateId.trim() || `custom_${Date.now().toString(36)}`,
        label: label.trim(), description: description.trim(), icon, spaces: spacesPayload,
      });
      onSaved(saved);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Save failed. Check console for details.");
    } finally { setSaving(false); }
  }

  const canSubmit = !saving && label.trim().length > 0 && resolvableSpaces.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#111827" }}>🌐 Save as Public Template</h3>
        <p style={{ margin: "0 0 22px", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
          This template will be <strong>visible to all users</strong>. Requires member / admin role.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Template Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input autoFocus value={label} onChange={(e) => { setLabel(e.target.value); setError(""); }}
            placeholder="e.g. 3-Bedroom Villa, Primary School Block…"
            style={{ width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 9, border: "1.5px solid #e5e7eb", boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Short Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Typical 2-floor residence with 3 beds"
            style={{ width: "100%", fontSize: 13, padding: "8px 11px", borderRadius: 9, border: "1.5px solid #e5e7eb", boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
            Template ID <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>(unique slug — no spaces)</span>
          </label>
          <input value={templateId} onChange={(e) => setTemplateId(e.target.value.replace(/\s+/g, "_").toLowerCase())}
            placeholder="e.g. villa_3bed_standard"
            style={{ width: "100%", fontSize: 12, padding: "8px 11px", borderRadius: 9, border: "1.5px solid #e5e7eb", boxSizing: "border-box", fontFamily: "monospace", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>Icon</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ICON_OPTIONS.map((ic) => (
              <button key={ic} type="button" onClick={() => setIcon(ic)} style={{
                fontSize: 20, width: 40, height: 40, borderRadius: 9, cursor: "pointer",
                border: icon === ic ? "2.5px solid #6366f1" : "1.5px solid #e5e7eb",
                background: icon === ic ? "#eef2ff" : "#f9fafb", transition: "all .12s",
              }}>{ic}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 18 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>
            Spaces to include ({resolvableSpaces.length} of {spaces.length})
          </p>
          {resolvableSpaces.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>⚠️ No template-backed spaces found. Add rooms from the palette first.</p>
          ) : (
            resolvableSpaces.map((s) => (
              <div key={s.instanceId} style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 5 }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                <span style={{ fontSize: 12, color: "#374151", flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{getFloorLabel(s.floor)}</span>
              </div>
            ))
          )}
          {spaces.some((s) => s.isCustom) && (
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "#b45309", background: "#fffbeb", padding: "6px 9px", borderRadius: 6, lineHeight: 1.5 }}>
              ⚠️ {spaces.filter((s) => s.isCustom).length} custom space(s) will be skipped.
            </p>
          )}
        </div>
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 9, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 16, fontSize: 12, color: "#b91c1c", lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={handleSave} disabled={!canSubmit} style={{
            flex: 1, padding: "12px", borderRadius: 10, border: "none",
            background: canSubmit ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "#e5e7eb",
            color: canSubmit ? "#fff" : "#9ca3af",
            fontWeight: 800, fontSize: 14, cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: canSubmit ? "0 4px 14px #6366f155" : "none", transition: "all .15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {saving ? <><Spin size={14} color="#fff" /> Saving…</> : "🌐 Publish Template"}
          </button>
          <button type="button" onClick={onClose} style={{ padding: "12px 18px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 600 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Save button bar shared props type ───────────────────────
// Used by both StepSpaces and StepSummary to keep buttons consistent.

interface SaveButtonsProps {
  myRole: ApiMyRole | null;
  savingTemplate: boolean;
  templateSaveMsg: string;
  activeTemplateSource: ActiveTemplateSource;
  canSaveCustom: boolean;   // myRole.can_save_custom_templates
  canSavePublic: boolean;   // member/admin
  spaces: SpaceInstance[];
  onSave: () => void;
  onSaveAsCustom: () => void;   // opens SaveAsCustomModal
  onSaveAsPublic: () => void;   // opens SaveAsGeneralModal
}

function SaveButtons({
  myRole, savingTemplate, templateSaveMsg,
  activeTemplateSource, canSaveCustom, canSavePublic,
  spaces, onSave, onSaveAsCustom, onSaveAsPublic,
}: SaveButtonsProps) {
  const hasSpaces = spaces.length > 0;

  // Determine what "Save" will do so we can label it clearly
  const saveLabel = (() => {
    if (savingTemplate) return "Saving…";
    if (!activeTemplateSource) return "💾 Save";   // fresh → will open name modal
    if (activeTemplateSource.type === "custom") return "💾 Save";
    if (activeTemplateSource.type === "public") return "💾 Save";
    return "💾 Save";
  })();

  const saveTitle = (() => {
    if (!canSaveCustom && !canSavePublic) return "Paid plan required to save templates";
    if (!activeTemplateSource) return "Save as a new custom template";
    if (activeTemplateSource.type === "custom") return "Update this custom template";
    if (activeTemplateSource.type === "public") return "Update this public template";
    return "Save";
  })();

  const saveEnabled = hasSpaces && !savingTemplate && (canSaveCustom || canSavePublic);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {/* ── Save (in-place update, or open modal if fresh) ── */}
      <button type="button" onClick={onSave}
        disabled={!saveEnabled}
        title={saveTitle}
        style={{
          fontSize: 13, padding: "8px 14px", borderRadius: 8,
          border: `1px solid ${saveEnabled ? "#16a34a" : "#e5e7eb"}`,
          background: saveEnabled ? "#dcfce7" : "#f9fafb",
          cursor: saveEnabled ? "pointer" : "not-allowed",
          fontWeight: 700,
          color: saveEnabled ? "#166534" : "#9ca3af",
          display: "flex", alignItems: "center", gap: 5,
        }}>
        {savingTemplate ? <><Spin size={12} color="#166534" /> Saving…</> : saveLabel}
      </button>

      {/* ── Save as Custom (always new) ── */}
      {canSaveCustom && (
        <button type="button" onClick={onSaveAsCustom}
          disabled={!hasSpaces}
          title="Save a new custom template (only visible to you)"
          style={{
            fontSize: 13, padding: "8px 14px", borderRadius: 8,
            border: `1px solid ${hasSpaces ? "#6366f1" : "#e5e7eb"}`,
            background: hasSpaces ? "#eef2ff" : "#f9fafb",
            cursor: hasSpaces ? "pointer" : "not-allowed",
            fontWeight: 600,
            color: hasSpaces ? "#4338ca" : "#c7d2fe",
          }}>
          💾 Save as Custom
        </button>
      )}

      {/* ── Save as Public (always new, member/admin only) ── */}
      {canSavePublic && (
        <button type="button" onClick={onSaveAsPublic}
          disabled={!hasSpaces}
          title="Publish a new public template visible to all users"
          style={{
            fontSize: 13, padding: "8px 14px", borderRadius: 8,
            border: `1px solid ${hasSpaces ? "#6366f1" : "#e5e7eb"}`,
            background: hasSpaces ? "#eef2ff" : "#f9fafb",
            cursor: hasSpaces ? "pointer" : "not-allowed",
            fontWeight: 700,
            color: hasSpaces ? "#4338ca" : "#c7d2fe",
          }}>
          🌐 Save as Public
        </button>
      )}

      {templateSaveMsg && (
        <span style={{
          fontSize: 12, alignSelf: "center",
          color: templateSaveMsg.includes("✓") ? "#166534" : "#9ca3af",
        }}>
          {templateSaveMsg}
        </span>
      )}
    </div>
  );
}

// ─── Step 3: Spaces ───────────────────────────────────────────

function StepSpaces({
  spaces, setSpaces, spaceTemplates, projectTemplates, customTemplates,
  unit, loadingTemplates,
  activeTemplateSource, myRole,
  savingTemplate, templateSaveMsg,
  onSave, onSaveAsCustom, onSaveAsPublic,
  saveAsCustomOpen, setSaveAsCustomOpen, onSaveAsCustomConfirm,
  onDeleteCustom, onDeletePublic, onLoadProjectTemplate, onLoadCustomProjectTemplate,
  locationLabel, clientName, projectName, wall, circ, costPerSqft,
  totals, floorGroups, onCsvImport, rateStatus,
  onNext, onBack,
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
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [importBanner, setImportBanner] = useState(false);

  const canSaveCustom = myRole?.can_save_custom_templates ?? false;
  const canSavePublic = myRole?.role === "member" || myRole?.role === "admin";

  function addFromTemplate(id: string) {
    const t = spaceTemplates.find((x) => x.id === id);
    if (!t) return;
    setSpaces([...spaces, makeSpaceFromTemplate(t, 0, [])]);
  }

  function loadProjectTemplate(tpl: ProjectTemplate) {
    const newSpaces = tpl.spaces.map(({ dbId, templateId, floor, L, B, subIds }) => {
      const t = spaceTemplates.find((x) => x.id === templateId);
      return t ? makeSpaceFromTemplate(t, floor, subIds, L, B, dbId) : null;
    }).filter((x): x is SpaceInstance => x !== null);
    setSpaces(newSpaces);
  }

  function loadCustomTemplate(tpl: ApiCustomProjectTemplate) {
    const data = tpl.data as { spaces?: SpaceInstance[] };
    setSpaces(data.spaces || []);
  }

  function handleCsvImportHere(payload: ImportPayload) {
    setSpaces(payload.spaces);
    setImportBanner(true);
    onCsvImport(payload);
  }

  const update = (id: string, s: SpaceInstance) => setSpaces(spaces.map((x) => x.instanceId === id ? s : x));
  const remove = (id: string) => setSpaces(spaces.filter((x) => x.instanceId !== id));

  function copySpace(space: SpaceInstance) {
    const copied: SpaceInstance = {
      ...space, instanceId: uid(), name: `${space.name} (copy)`,
      subSpaces: space.subSpaces.map((sub) => ({ ...sub, instanceId: uid() })),
    };
    const idx = spaces.findIndex((s) => s.instanceId === space.instanceId);
    const next = [...spaces];
    next.splice(idx + 1, 0, copied);
    setSpaces(next);
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

      {spaces.length > 0 ? (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: .4 }}>
            {spaces.length} Room{spaces.length !== 1 ? "s" : ""}
          </p>
          {spaces.map((s) => (
            <SpaceCard key={s.instanceId} space={s} unit={unit} spaceTemplates={spaceTemplates}
              onUpdate={(u) => update(s.instanceId, u)}
              onRemove={() => remove(s.instanceId)}
              onCopy={() => copySpace(s)} />
          ))}
        </div>
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
        <CustomSpaceModal onAdd={(s) => setSpaces([...spaces, s])} onClose={() => setCustomModalOpen(false)} />
      )}
    </div>
  );
}

// ─── Step 4: Summary ──────────────────────────────────────────

function StepSummary({
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
          totals={totals} locationLabel={locationLabel} disabled={false} onImport={onCsvImport} />
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
        <p style={{ fontSize: 11, color: "#059669", margin: "4px 0 0", opacity: .7 }}>Finishing, MEP &amp; professional fees not included</p>
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

// ─── Sticky cost bar ──────────────────────────────────────────

function StickyBar({ gross, cost, unit, loading }: { gross: number; cost: number; unit: UnitKey; loading: boolean }) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  if (gross <= 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "#1f2937", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 20, padding: "10px 16px", flexWrap: "wrap",
      boxShadow: "0 -4px 20px rgba(0,0,0,.2)",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9, opacity: .5, textTransform: "uppercase", letterSpacing: .7 }}>Gross Area</p>
        <p style={{ margin: 0, fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: "#fcd34d" }}>{fmt(gross, unit)} {aLabel}</p>
      </div>
      <div style={{ width: 1, height: 28, background: "#374151", flexShrink: 0 }} />
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 9, opacity: .5, textTransform: "uppercase", letterSpacing: .7 }}>Est. Cost</p>
        <p style={{ margin: 0, fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: "#4ade80" }}>{loading ? "—" : fmtCost(cost)}</p>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState<WizardStep>("location");

  // Geography
  const [countries,     setCountries]    = useState<ApiCountry[]>([]);
  const [statesList,    setStatesList]   = useState<ApiState[]>([]);
  const [placesList,    setPlacesList]   = useState<{ id: number; name: string }[]>([]);
  const [countryId,     setCountryId]    = useState<number | null>(null);
  const [stateId,       setStateId]      = useState<number | null>(null);
  const [placeId,       setPlaceId]      = useState<number | null>(null);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  const pendingLocationRef = useRef<{ stateId: number | null; placeId: number | null } | null>(null);

  // Project settings
  const [finishLevel,   setFinishLevel]   = useState("");
  const [occupancyType, setOccupancyType] = useState("");
  const [wall, setWall] = useState(10);
  const [circ, setCirc] = useState(15);
  const [unit, setUnit] = useState<UnitKey>("sqft");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [clientName,  setClientName]  = useState("");
  const [customRate,  setCustomRate]  = useState<number | null>(null);

  // Templates
  const [spaceTemplates,   setSpaceTemplates]   = useState<SpaceTemplate[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Spaces
  const [spaces, setSpaces] = useState<SpaceInstance[]>([]);

  // Rate
  const [rateStatus,  setRateStatus]  = useState<ApiRateStatus | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // Role + custom templates
  const [myRole,          setMyRole]          = useState<ApiMyRole | null>(null);
  const [customTemplates, setCustomTemplates] = useState<ApiCustomProjectTemplate[]>([]);
  const [savingTemplate,  setSavingTemplate]  = useState(false);
  const [templateSaveMsg, setTemplateSaveMsg] = useState("");

  // ── NEW: unified active template source ──────────────────────
  // null  = fresh / unsaved
  // { type: 'custom', id }  = opened a user custom template
  // { type: 'public', id }  = opened a public template (id = dbId)
  const [activeTemplateSource, setActiveTemplateSource] = useState<ActiveTemplateSource>(null);

  // Modals
  const [generalModalOpen,     setGeneralModalOpen]     = useState(false);
  const [generalTemplateSaved, setGeneralTemplateSaved] = useState("");
  const [saveAsCustomOpen,     setSaveAsCustomOpen]     = useState(false);

  // Snapshots
  const [allSnapshots,   setAllSnapshots]   = useState<ApiRateSnapshot[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [placeHasData,   setPlaceHasData]   = useState(false);

  // Derived occupancy type buttons
  const occupancyTypes = useMemo(() => {
    const seen = new Set<string>();
    return allSnapshots
      .filter((s) => s.occupancy_type !== "" && s.finish_level === "")
      .filter((s) => { const ok = !seen.has(s.occupancy_type); seen.add(s.occupancy_type); return ok; })
      .map((s) => ({
        value: s.occupancy_type,
        label: OCCUPANCY_TYPE_META[s.occupancy_type]?.label ?? s.occupancy_type,
        emoji: OCCUPANCY_TYPE_META[s.occupancy_type]?.emoji ?? "🏗️",
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSnapshots]);

  // Derived finish level buttons
  const finishLevels = useMemo(() => {
    const seen = new Set<string>();
    return allSnapshots
      .filter((s) => s.finish_level !== "" && s.occupancy_type === "")
      .filter((s) => { const ok = !seen.has(s.finish_level); seen.add(s.finish_level); return ok; })
      .map((s) => ({
        value: s.finish_level,
        label: FINISH_LEVEL_META[s.finish_level]?.label ?? s.finish_level,
        emoji: FINISH_LEVEL_META[s.finish_level]?.emoji ?? "🏗️",
        hint:  FINISH_LEVEL_META[s.finish_level]?.hint  ?? "",
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSnapshots]);

  const snapshotRate = useMemo((): number | null => {
    if (allSnapshots.length === 0) return null;
    const exact = allSnapshots.find((s) => s.occupancy_type === occupancyType && s.finish_level === finishLevel);
    if (exact) return exact.avg_rate;
    const occOnly = allSnapshots.find((s) => s.occupancy_type === occupancyType && s.finish_level === "");
    if (occOnly) return occOnly.avg_rate;
    return allSnapshots.find((s) => s.occupancy_type === "" && s.finish_level === "")?.avg_rate ?? null;
  }, [allSnapshots, occupancyType, finishLevel]);

  const costPerSqft = customRate !== null ? customRate : (snapshotRate ?? 2000);

  // Snapshot fetch
  useEffect(() => {
    if (!countryId) return;
    setLoadingOptions(true);

    const applySnapshots = (rows: ApiRateSnapshot[]) => {
      setAllSnapshots(rows);
      const occs = [...new Set(rows.filter((r) => r.occupancy_type !== "" && r.finish_level === "").map((r) => r.occupancy_type))];
      if (occs.length > 0 && !occs.includes(occupancyType)) setOccupancyType(occs[0]);
      const fins = [...new Set(rows.filter((r) => r.finish_level !== "" && r.occupancy_type === "").map((r) => r.finish_level))];
      if (fins.length > 0 && !fins.includes(finishLevel)) setFinishLevel(fins.includes("basic") ? "basic" : fins[0]);
    };

    (async () => {
      try {
        if (placeId) {
          const placeRows = await fetchRateSnapshot({ scope: "place", place_id: placeId });
          if (placeRows.some((r) => r.occupancy_type !== "" || r.finish_level !== "")) {
            setPlaceHasData(true); applySnapshots(placeRows); return;
          }
        }
        setPlaceHasData(false);
        applySnapshots(await fetchRateSnapshot({ scope: "country", country_id: countryId }));
      } catch (err) { console.error(err); }
      finally { setLoadingOptions(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, placeId]);

  // rateStatus fetch
  useEffect(() => {
    if (!placeId) { setRateStatus(null); return; }
    setLoadingRate(true);
    fetchRateLookup(placeId, null,
      finishLevel   && finishLevel   !== "unknown" ? finishLevel   : undefined,
      occupancyType && occupancyType !== "unknown" ? occupancyType : undefined,
    ).then((data) => setRateStatus(data.rate_status)).catch(console.error).finally(() => setLoadingRate(false));
  }, [placeId, finishLevel, occupancyType]);

  // Derived
  const selectedCountry = countries.find((c) => c.id === countryId);
  const selectedState   = statesList.find((s) => s.id === stateId);
  const selectedPlace   = placesList.find((p) => p.id === placeId);
  const locationLabel   = [selectedCountry?.name, selectedState?.name, selectedPlace?.name].filter(Boolean).join(" · ");
  const totals          = useMemo(() => calcGrossArea(spaces, wall, circ, costPerSqft), [spaces, wall, circ, costPerSqft]);
  const floorGroups     = useMemo(() => groupByFloor(spaces), [spaces]);
  const canSavePublic   = myRole?.role === "member" || myRole?.role === "admin";

  // Mount
  useEffect(() => {
    fetchCountries().then((data) => {
      setCountries(data);
      const india = data.find((c) => c.code?.toUpperCase() === "IN" || c.name.toLowerCase() === "india");
      if (india) setCountryId(india.id);
    }).catch(console.error);

    Promise.all([fetchSpaceTemplates(), fetchProjectTemplates()])
      .then(([sts, pts]) => { setSpaceTemplates(sts.map(toSpaceTemplate)); setProjectTemplates(pts.map(toProjectTemplate)); })
      .catch(console.error).finally(() => setLoadingTemplates(false));

    fetchMyRole().then((role) => {
      setMyRole(role);
      if (role.can_save_custom_templates) fetchCustomProjectTemplates().then(setCustomTemplates).catch(console.error);
    }).catch(console.error);
  }, []);

  // States
  useEffect(() => {
    if (!countryId) { setStatesList([]); setStateId(null); return; }
    setLoadingStates(true);
    fetchStates(countryId).then((data) => {
      setStatesList(data);
      if (pendingLocationRef.current) { setStateId(pendingLocationRef.current.stateId); }
      else { setStateId(null); setPlaceId(null); }
    }).catch(console.error).finally(() => setLoadingStates(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // Places
  useEffect(() => {
    if (!stateId) { setPlacesList([]); setPlaceId(null); return; }
    setLoadingPlaces(true);
    fetchPlaces(stateId).then((data) => {
      setPlacesList(data);
      if (pendingLocationRef.current) { setPlaceId(pendingLocationRef.current.placeId); pendingLocationRef.current = null; }
      else { setPlaceId(null); }
    }).catch(console.error).finally(() => setLoadingPlaces(false));
  }, [stateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
  const goNext = (from: WizardStep) => {
    const order: WizardStep[] = ["location", "project-type", "spaces", "summary"];
    const idx = order.indexOf(from);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };
  const goBack = (from: WizardStep) => {
    const order: WizardStep[] = ["location", "project-type", "spaces", "summary"];
    const idx = order.indexOf(from);
    if (idx > 0) setStep(order[idx - 1]);
  };

  // ── Build save payload ────────────────────────────────────────
  function buildSaveData() {
    return {
      projectName, clientName, unit, wall, circ, spaces,
      countryId, stateId, placeId, customRate,
    };
  }

  function buildPublicSpacesPayload() {
    return spaces
      .filter((s) => {
        if (s.isCustom) return false;
        const st = spaceTemplates.find((x) => x.id === s.templateId);
        return !!st?.dbId;
      })
      .map((s, idx) => {
        const st = spaceTemplates.find((x) => x.id === s.templateId)!;
        const subIds = s.subSpaces
          .map((sub) => st.subSpaces?.find((x) => x.id === sub.templateId)?.dbId)
          .filter((id): id is number => typeof id === "number");

        return {
          id: s.projectSpaceDbId,
          space_template: st.dbId!,
          floor: s.floor,
          override_l: s.L !== st.L ? s.L : null,
          override_b: s.B !== st.B ? s.B : null,
          sort_order: idx,
          sub_ids: subIds,
        };
      });
  }

  // ── handleSave: in-place update of whatever is currently open ─
  // If nothing is open yet (fresh), fall through to open the
  // "Save as Custom" name modal instead.
  async function handleSave() {
    if (!myRole?.can_save_custom_templates && !canSavePublic) {
      setTemplateSaveMsg("Paid plan required to save templates.");
      return;
    }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }

    // Fresh (nothing open) → create a new template.
    // Prefer custom; if this user can only publish public templates, open the public modal.
    if (activeTemplateSource === null) {
      if (myRole?.can_save_custom_templates) setSaveAsCustomOpen(true);
      else if (canSavePublic) setGeneralModalOpen(true);
      return;
    }

    try {
      setSavingTemplate(true); setTemplateSaveMsg("");

      if (activeTemplateSource.type === "custom") {
        // Update the currently opened custom template in-place.
        // Do not change its name here; "Save as Custom" is the only path that creates a new named template.
        const updated = await updateCustomProjectTemplate(activeTemplateSource.id, {
          data: buildSaveData(),
        });
        setCustomTemplates((prev) => prev.map((t) => t.id === activeTemplateSource.id ? updated : t));
        setTemplateSaveMsg("✓ Custom template updated.");

      } else if (activeTemplateSource.type === "public") {
        if (!canSavePublic) {
          setTemplateSaveMsg("Member / admin role required to update public templates.");
          return;
        }

        // Update the currently opened public template in-place.
        // Do not change label/icon/template_id here; "Save as Public" creates a new public template.
        const tpl = projectTemplates.find((t) => t.dbId === activeTemplateSource.id);
        if (!tpl) { setTemplateSaveMsg("Template not found."); return; }

        const spacesPayload = buildPublicSpacesPayload();
        if (spacesPayload.length === 0) {
          setTemplateSaveMsg("No template-backed spaces found. Custom spaces cannot be saved into a public template.");
          return;
        }

        const updated = await updatePublicProjectTemplate(activeTemplateSource.id, {
          template_id: tpl.id,
          label: tpl.label,
          description: tpl.description,
          icon: tpl.icon,
          spaces: spacesPayload,
        });

        const updatedTpl = toProjectTemplate(updated);
        // Some DRF nested update serializers return the updated parent before
        // nested rows are re-expanded. If that happens, keep the local rooms
        // so the UI does not show an empty template until the next fetch.
        if (updatedTpl.spaces.length === 0 && spacesPayload.length > 0) {
          setProjectTemplates((prev) => prev.map((t) =>
            t.dbId === activeTemplateSource.id
              ? { ...tpl, spaces: spacesPayload.map((sp) => {
                  const st = spaceTemplates.find((x) => x.dbId === sp.space_template);
                  return {
                    dbId: sp.id,
                    templateId: st?.id ?? "",
                    floor: sp.floor,
                    L: typeof sp.override_l === "number" ? sp.override_l : (st?.L ?? 0),
                    B: typeof sp.override_b === "number" ? sp.override_b : (st?.B ?? 0),
                    subIds: [],
                  };
                }).filter((sp) => sp.templateId) }
              : t,
          ));
        } else {
          setProjectTemplates((prev) => prev.map((t) => t.dbId === activeTemplateSource.id ? updatedTpl : t));
        }
        setTemplateSaveMsg("✓ Public template updated.");
      }
    } catch (err) {
      console.error(err);
      setTemplateSaveMsg("Could not save.");
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── handleSaveAsCustomConfirm: called from SaveAsCustomModal ─
  // Always creates a new custom template.
  async function handleSaveAsCustomConfirm(label: string) {
    const saved = await saveCustomProjectTemplate({
      label,
      description: "User saved",
      icon: "🏠",
      data: buildSaveData(),
      source_project_template: activeTemplateSource?.type === "public" ? activeTemplateSource.id : null,
    });
    setCustomTemplates((prev) => [saved, ...prev]);
    setProjectName(label);
    setActiveTemplateSource({ type: "custom", id: saved.id });
    setTemplateSaveMsg("✓ Saved as custom template.");
  }

  // ── handleSaveAsCustom: opens the name modal ──────────────────
  function handleSaveAsCustom() {
    if (!myRole?.can_save_custom_templates) {
      setTemplateSaveMsg("Paid plan required to save custom templates.");
      return;
    }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }
    setSaveAsCustomOpen(true);
  }

  // ── handleSaveAsPublic: opens the general template modal ──────
  function handleSaveAsPublic() {
    if (!canSavePublic) {
      setTemplateSaveMsg("Member / admin role required.");
      return;
    }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }
    setGeneralModalOpen(true);
  }

  // ── handleGeneralTemplateSaved: called when public modal saves ─
  function handleGeneralTemplateSaved(tpl: ApiProjectTemplate) {
    const converted = toProjectTemplate(tpl);
    setProjectTemplates((prev) => [...prev, converted]);
    setProjectName(tpl.label || "Untitled Project");
    setActiveTemplateSource({ type: "public", id: tpl.id });
    setGeneralModalOpen(false);
    setGeneralTemplateSaved(`✓ "${tpl.label}" published.`);
    setTimeout(() => setGeneralTemplateSaved(""), 5000);
  }

  // ── Delete custom template ────────────────────────────────────
  async function handleDeleteCustomTemplate(id: number) {
    await deleteCustomProjectTemplate(id);
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    if (activeTemplateSource?.type === "custom" && activeTemplateSource.id === id) {
      setActiveTemplateSource(null);
      setTemplateSaveMsg("Template deleted.");
    }
  }

  // ── Delete public template ────────────────────────────────────
  async function handleDeletePublicTemplate(templateStringId: string) {
    const tpl = projectTemplates.find((t) => t.id === templateStringId);
    if (!tpl?.dbId) return;
    await deletePublicProjectTemplate(tpl.dbId);
    setProjectTemplates((prev) => prev.filter((t) => t.id !== templateStringId));
    if (activeTemplateSource?.type === "public" && activeTemplateSource.id === tpl.dbId) {
      setActiveTemplateSource(null);
    }
    setTemplateSaveMsg("✓ Public template deleted.");
  }

  // ── TemplatePanel callbacks: set activeTemplateSource on load ─
  function handleLoadPublicTemplate(tpl: ProjectTemplate) {
    const newSpaces = tpl.spaces.map(({ dbId, templateId, floor, L, B, subIds }) => {
      const t = spaceTemplates.find((x) => x.id === templateId);
      return t ? makeSpaceFromTemplate(t, floor, subIds, L, B, dbId) : null;
    }).filter((x): x is SpaceInstance => x !== null);

    setSpaces(newSpaces);
    // Important: load the template label into the project name field.
    // Otherwise the editor keeps showing "Untitled Project" and normal Save can behave like Save As.
    setProjectName(tpl.label || "Untitled Project");
    setClientName((prev) => prev || "Name");
    setActiveTemplateSource(tpl.dbId != null ? { type: "public", id: tpl.dbId } : null);
    setTemplateSaveMsg("Opened public template. Save will update this template.");
  }

  function handleLoadCustomTemplate(tpl: ApiCustomProjectTemplate) {
    const data = tpl.data as Partial<ReturnType<typeof buildSaveData>>;
    const loadedProjectName =
      typeof data.projectName === "string" && data.projectName.trim() && data.projectName !== "Untitled Project"
        ? data.projectName
        : tpl.label;
    setProjectName(loadedProjectName || "Untitled Project");
    setClientName(data.clientName ?? "Name");
    if (data.unit === "sqft" || data.unit === "sqm") setUnit(data.unit);
    if (typeof data.wall === "number") setWall(data.wall);
    if (typeof data.circ === "number") setCirc(data.circ);
    if (typeof data.countryId === "number" || data.countryId === null) {
      setCountryId(data.countryId ?? null);
      pendingLocationRef.current = {
        stateId: typeof data.stateId === "number" ? data.stateId : null,
        placeId: typeof data.placeId === "number" ? data.placeId : null,
      };
    }
    setCustomRate(typeof data.customRate === "number" ? data.customRate : null);
    setSpaces((data.spaces as SpaceInstance[] | undefined) || []);
    setActiveTemplateSource({ type: "custom", id: tpl.id });
    setTemplateSaveMsg("Opened custom template. Save will update this template.");
  }

  // ── CSV import ────────────────────────────────────────────────
  const handleCsvImport = useCallback((
    payload: ImportPayload & { countryId?: number | null; stateId?: number | null; placeId?: number | null },
  ) => {
    setProjectName(payload.projectName);
    setClientName(payload.clientName);
    setUnit(payload.unit);
    setWall(payload.wall);
    setCirc(payload.circ);
    setSpaces(payload.spaces);
    setActiveTemplateSource(null);
    setTemplateSaveMsg("");

    if (payload.countryId && payload.stateId && payload.placeId) {
      pendingLocationRef.current = { stateId: payload.stateId, placeId: payload.placeId };
      if (countryId === payload.countryId) { setStateId(payload.stateId); }
      else { setCountryId(payload.countryId); }
    }
    setStep("spaces");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // Combined save message: prefer generalTemplateSaved when present
  const displaySaveMsg = generalTemplateSaved || templateSaveMsg;

  // Shared props for both steps that show save buttons
  const saveButtonSharedProps = {
    myRole,
    savingTemplate,
    templateSaveMsg: displaySaveMsg,
    activeTemplateSource,
    canSaveCustom: myRole?.can_save_custom_templates ?? false,
    canSavePublic,
    spaces,
    onSave: handleSave,
    onSaveAsCustom: handleSaveAsCustom,
    onSaveAsPublic: handleSaveAsPublic,
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f4f1; font-family: 'Segoe UI', system-ui, sans-serif; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 1; }
      `}</style>

      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.05)", position: "sticky", top: 0, zIndex: 80 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 160px", minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📐</div>
            <div style={{ minWidth: 0 }}>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name"
                style={{ fontSize: 14, fontWeight: 700, color: "#111827", background: "transparent", border: "none", borderBottom: "2px solid transparent", outline: "none", width: "100%", maxWidth: 160, transition: "border-color .15s" }}
                onFocus={(e) => { e.target.style.borderBottomColor = "#f59e0b"; }}
                onBlur={(e)  => { e.target.style.borderBottomColor = "transparent"; }} />
              <p style={{ margin: 0, fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .4 }}>Cost Estimator</p>
            </div>
          </div>
          <div style={{ flex: "1 1 130px", minWidth: 0 }}>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name"
              style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", outline: "none", width: "100%", transition: "border-color .15s" }}
              onFocus={(e) => { e.target.style.borderColor = "#f59e0b"; e.target.style.background = "#fff"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }} />
          </div>
          {locationLabel && (
            <span onClick={() => setStep("location")} style={{ fontSize: 11, color: "#047857", background: "#ecfdf5", padding: "4px 9px", borderRadius: 20, border: "1px solid #a7f3d0", cursor: "pointer", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
              📍 {locationLabel}
            </span>
          )}
          {customRate !== null && (
            <span onClick={() => setStep("project-type")} title="Custom rate active — click to edit"
              style={{ fontSize: 11, color: "#be185d", background: "#fdf2f8", padding: "4px 9px", borderRadius: 20, border: "1px solid #f9a8d4", cursor: "pointer", flexShrink: 0 }}>
              ✏️ ₹{customRate.toLocaleString("en-IN")}/sqft
            </span>
          )}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 7, padding: 2, flexShrink: 0 }}>
            {(["sqft", "sqm"] as UnitKey[]).map((u) => (
              <button key={u} type="button" onClick={() => setUnit(u)} style={{
                padding: "4px 10px", borderRadius: 5, border: "none",
                background: unit === u ? "#fff" : "transparent",
                fontWeight: unit === u ? 700 : 500, fontSize: 11,
                color: unit === u ? "#111827" : "#9ca3af", cursor: "pointer",
                boxShadow: unit === u ? "0 1px 3px rgba(0,0,0,.1)" : "none",
              }}>{u}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "18px 14px 110px" }}>
        <WizardProgress step={step} onJump={setStep} />

        {step === "location" && (
          <StepLocation
            countries={countries} statesList={statesList} placesList={placesList}
            countryId={countryId} stateId={stateId} placeId={placeId}
            setCountryId={setCountryId} setStateId={setStateId} setPlaceId={setPlaceId}
            loadingStates={loadingStates} loadingPlaces={loadingPlaces}
            onNext={() => goNext("location")} onCsvImport={handleCsvImport} />
        )}

        {step === "project-type" && (
          <StepProjectType
            occupancyTypes={occupancyTypes} finishLevels={finishLevels}
            loadingOptions={loadingOptions} placeHasData={placeHasData}
            occupancyType={occupancyType} setOccupancyType={setOccupancyType}
            finishLevel={finishLevel} setFinishLevel={setFinishLevel}
            currentRate={snapshotRate} customRate={customRate} setCustomRate={setCustomRate}
            wall={wall} setWall={setWall} circ={circ} setCirc={setCirc}
            onNext={() => goNext("project-type")} onBack={() => goBack("project-type")} />
        )}

        {step === "spaces" && (
          <StepSpaces
            spaces={spaces} setSpaces={setSpaces}
            spaceTemplates={spaceTemplates} projectTemplates={projectTemplates}
            customTemplates={customTemplates}
            unit={unit} loadingTemplates={loadingTemplates}
            locationLabel={locationLabel} clientName={clientName} projectName={projectName}
            wall={wall} circ={circ} costPerSqft={costPerSqft}
            totals={totals} floorGroups={floorGroups}
            rateStatus={rateStatus} onCsvImport={handleCsvImport}
            saveAsCustomOpen={saveAsCustomOpen} setSaveAsCustomOpen={setSaveAsCustomOpen}
            onSaveAsCustomConfirm={handleSaveAsCustomConfirm}
            onDeleteCustom={handleDeleteCustomTemplate}
            onDeletePublic={handleDeletePublicTemplate}
            onLoadProjectTemplate={handleLoadPublicTemplate}
            onLoadCustomProjectTemplate={handleLoadCustomTemplate}
            onNext={() => goNext("spaces")} onBack={() => goBack("spaces")}
            {...saveButtonSharedProps}
          />
        )}

        {step === "summary" && (
          <StepSummary
            spaces={spaces} unit={unit} wall={wall} circ={circ}
            costPerSqft={costPerSqft} rateStatus={rateStatus}
            locationLabel={locationLabel} projectName={projectName} clientName={clientName}
            floorGroups={floorGroups} totals={totals}
            onCsvImport={handleCsvImport}
            onBack={() => goBack("summary")} onEdit={() => setStep("spaces")}
            customRate={customRate}
            {...saveButtonSharedProps}
          />
        )}
      </main>

      <StickyBar gross={totals.gross} cost={totals.cost} unit={unit} loading={loadingRate && customRate === null} />

      {generalModalOpen && (
        <SaveAsGeneralModal
          spaces={spaces} spaceTemplates={spaceTemplates}
          onClose={() => setGeneralModalOpen(false)}
          onSaved={handleGeneralTemplateSaved} />
      )}

      {/* SaveAsCustomModal at app level so it works from both steps */}
      {saveAsCustomOpen && (myRole?.can_save_custom_templates) && (
        <SaveAsCustomModal
          defaultLabel={projectName || "Untitled"}
          existingNames={customTemplates.map((t) => t.label)}
          onSave={handleSaveAsCustomConfirm}
          onClose={() => setSaveAsCustomOpen(false)} />
      )}
    </>
  );
}