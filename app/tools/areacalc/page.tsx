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
  fetchAreaRate,
  fetchMyRole,
  fetchCustomProjectTemplates,
  saveCustomProjectTemplate,
  updateCustomProjectTemplate,
  saveGeneralProjectTemplate,
  fetchRateOptions,
  type ApiCountry,
  type ApiState,
  type ApiRateStatus,
  type ApiMyRole,
  type ApiCustomProjectTemplate,
  type ApiProjectTemplate,
  type ApiRateOptions,
} from "./areacalcApi";

// ─── Constants ────────────────────────────────────────────────

const WALL_PRESETS = [{ v: 8, l: "Light 8%" }, { v: 10, l: "Normal 10%" }, { v: 15, l: "Heavy 15%" }];
const CIRC_PRESETS = [{ v: 10, l: "Compact 10%" }, { v: 15, l: "Normal 15%" }, { v: 20, l: "Spacious 20%" }];

type WizardStep = "location" | "project-type" | "spaces" | "summary";
const WIZARD_STEPS: { id: WizardStep; label: string; emoji: string }[] = [
  { id: "location",     label: "Location", emoji: "📍" },
  { id: "project-type", label: "Project",  emoji: "🏗️" },
  { id: "spaces",       label: "Rooms",    emoji: "🏠" },
  { id: "summary",      label: "Summary",  emoji: "📊" },
];

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
    if (!Number.isFinite(targetDisplay) || targetDisplay <= 0) {
      setAreaError("Enter a valid area > 0"); return;
    }
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
          value={lDraft}
          onChange={(e) => setLDraft(e.target.value)}
          onBlur={(e) => commitL(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitL((e.target as HTMLInputElement).value)}
          style={inp()} />
      </div>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>
          Width ({uLabel})
        </label>
        <input type="number" min={0.1} step={unit === "sqm" ? 0.1 : 0.5}
          value={bDraft}
          onChange={(e) => setBDraft(e.target.value)}
          onBlur={(e) => commitB(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commitB((e.target as HTMLInputElement).value)}
          style={inp()} />
      </div>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>
          Area ({aLabel})
        </label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="number" min={0.1} step={1}
            value={aDraft}
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

function TotalAreaScaler({
  spaces, unit, currentNet, onScale,
}: {
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
    if (!Number.isFinite(targetDisplay) || targetDisplay <= 0) {
      setError("Enter a valid area > 0"); return;
    }
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
            <input
              type="number" min={1} step={unit === "sqm" ? 1 : 10} value={draft}
              onChange={(e) => { setDraft(e.target.value); setError(""); setApplied(false); }}
              onKeyDown={(e) => e.key === "Enter" && applyScale()}
              style={{
                fontSize: 14, padding: "7px 10px", borderRadius: 8, fontFamily: "monospace",
                border: error ? "2px solid #ef4444" : "2px solid #fcd34d",
                outline: "none", background: "#fff", fontWeight: 700, color: "#111827", width: 110,
              }}
            />
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

function SubSpaceRow({ sub, onUpdate, onRemove, unit }: {
  sub: SubSpaceInstance; onUpdate: (s: SubSpaceInstance) => void;
  onRemove: () => void; unit: UnitKey;
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
        <button onClick={onRemove} style={{ fontSize: 13, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>✕</button>
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

function SpaceCard({ space, onUpdate, onRemove, unit, spaceTemplates }: {
  space: SpaceInstance; onUpdate: (s: SpaceInstance) => void;
  onRemove: () => void; unit: UnitKey; spaceTemplates: SpaceTemplate[];
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
              onRemove={() => onUpdate({ ...space, subSpaces: space.subSpaces.filter((s) => s.instanceId !== sub.instanceId) })} />
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

function TemplatePanel({ projectTemplates, customTemplates, loadingTemplates, activeCustomTemplateId, onLoad, onLoadCustom, onClose }: {
  projectTemplates: ProjectTemplate[];
  customTemplates: ApiCustomProjectTemplate[];
  loadingTemplates: boolean;
  activeCustomTemplateId: number | null;
  onLoad: (t: ProjectTemplate) => void;
  onLoadCustom: (t: ApiCustomProjectTemplate) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#374151" }}>🏗️ Project Templates</p>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af" }}>✕</button>
      </div>
      {loadingTemplates ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 13 }}><Spin /> Loading…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {projectTemplates.map((tpl) => (
            <button key={tpl.id} onClick={() => { onLoad(tpl); onClose(); }} style={{
              display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", borderRadius: 10,
              border: "1.5px solid #e5e7eb", background: "#f9fafb",
              cursor: "pointer", minWidth: 130, textAlign: "left", transition: "all .15s",
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fffbeb"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fcd34d"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb"; }}>
              <span style={{ fontSize: 24 }}>{tpl.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{tpl.label}</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>{tpl.description}</span>
            </button>
          ))}
        </div>
      )}
      {customTemplates.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: .5, margin: "14px 0 8px" }}>My Saved Templates</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {customTemplates.map((tpl) => (
              <button key={tpl.id} onClick={() => { onLoadCustom(tpl); onClose(); }} style={{
                display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", borderRadius: 10,
                border: tpl.id === activeCustomTemplateId ? "2px solid #16a34a" : "1.5px solid #bbf7d0",
                background: tpl.id === activeCustomTemplateId ? "#dcfce7" : "#f0fdf4",
                cursor: "pointer", minWidth: 130, textAlign: "left",
              }}>
                <span style={{ fontSize: 24 }}>{tpl.icon || "🏠"}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#14532d" }}>{tpl.label}</span>
                <span style={{ fontSize: 10, color: "#166534" }}>{tpl.id === activeCustomTemplateId ? "✓ Active" : "Saved"}</span>
              </button>
            ))}
          </div>
        </>
      )}
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
          locationLabel="" disabled={false} importOnly
          onImport={onCsvImport}
        />
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

// ─── Step 2: Project Type ─────────────────────────────────────
// Options are fetched from the API — no hardcoded fallbacks.
// loadingOptions: true while global OR place-specific options are loading.
// placeHasData: shows a note when place-specific options are narrower than global.

function StepProjectType({
  finishLevels,
  occupancyTypes,
  loadingOptions,
  placeHasData,
  finishLevel, setFinishLevel,
  occupancyType, setOccupancyType,
  wall, setWall, circ, setCirc,
  onNext, onBack,
}: {
  finishLevels: { value: string; label: string; emoji: string; hint: string }[];
  occupancyTypes: { value: string; label: string; emoji: string }[];
  loadingOptions: boolean;
  placeHasData: boolean;
  finishLevel: string; setFinishLevel: (v: string) => void;
  occupancyType: string; setOccupancyType: (v: string) => void;
  wall: number; setWall: (n: number) => void;
  circ: number; setCirc: (n: number) => void;
  onNext: () => void; onBack: () => void;
}) {
  const SkeletonOptions = ({ count }: { count: number }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          flex: "1 1 120px", height: 80, borderRadius: 12,
          background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>🏗️ Tell us about your project</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>These choices help pick the right rate for your project.</p>
        {/* Show a note when showing place-specific surveyed options */}
        {placeHasData && !loadingOptions && (
          <p style={{ fontSize: 11, color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>
            📍 Showing only building types &amp; finish levels with local survey data for your city.
          </p>
        )}
      </div>

      {/* ── Occupancy / Building type ── */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>What are you building?</p>
        {loadingOptions ? (
          <SkeletonOptions count={4} />
        ) : occupancyTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>No building types available for this location yet.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {occupancyTypes.map((ot) => (
              <BigOption
                key={ot.value}
                selected={occupancyType === ot.value}
                onClick={() => setOccupancyType(ot.value)}
                emoji={ot.emoji}
                label={ot.label}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Finish level / Quality ── */}
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>
          Quality of finish?
          <InfoBox icon="✨" title="Finish Level" body="Basic = plain tiles. Standard = branded tiles, modular kitchen. Premium = imported marble, false ceiling. Luxury = designer finishes." />
        </p>
        {loadingOptions ? (
          <SkeletonOptions count={4} />
        ) : finishLevels.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", padding: "12px 0" }}>No finish levels available for this location yet.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {finishLevels.map((fl) => (
              <BigOption
                key={fl.value}
                selected={finishLevel === fl.value}
                onClick={() => setFinishLevel(fl.value)}
                emoji={fl.emoji}
                label={fl.label}
                hint={fl.hint}
              />
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
                  background: wall === p.v ? "#eef2ff" : "#fff", color: wall === p.v ? "#4338ca" : "#374151", fontWeight: wall === p.v ? 700 : 400,
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
                  background: circ === p.v ? "#eef2ff" : "#fff", color: circ === p.v ? "#4338ca" : "#374151", fontWeight: circ === p.v ? 700 : 400,
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

function SaveAsGeneralModal({
  spaces, spaceTemplates, onClose, onSaved,
}: {
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
      return {
        space_template: dbId,
        floor: s.floor,
        override_l: s.L !== tpl.L ? s.L : null,
        override_b: s.B !== tpl.B ? s.B : null,
        sort_order: idx,
        sub_ids: [] as number[],
      };
    });

    try {
      setSaving(true); setError("");
      const saved = await saveGeneralProjectTemplate({
        template_id: templateId.trim() || `custom_${Date.now().toString(36)}`,
        label: label.trim(),
        description: description.trim(),
        icon,
        spaces: spacesPayload,
      });
      onSaved(saved);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Save failed. Check console for details.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !saving && label.trim().length > 0 && resolvableSpaces.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#111827" }}>🌐 Save as General Template</h3>
        <p style={{ margin: "0 0 22px", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
          This template will be <strong>visible to all users</strong> in the Templates panel. Requires member / admin role.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
            Template Name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input autoFocus value={label} onChange={(e) => { setLabel(e.target.value); setError(""); }}
            placeholder="e.g. 3-Bedroom Villa, Primary School Block…"
            style={{ width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 9, border: "1.5px solid #e5e7eb", boxSizing: "border-box", outline: "none" }}
            onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }}
            onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }} />
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
              ⚠️ {spaces.filter((s) => s.isCustom).length} custom space(s) will be skipped — custom rooms have no shared template definition.
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
            fontWeight: 800, fontSize: 14,
            cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: canSubmit ? "0 4px 14px #6366f155" : "none",
            transition: "all .15s",
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

// ─── Step 3: Spaces ───────────────────────────────────────────

function StepSpaces({
  spaces, setSpaces, spaceTemplates, projectTemplates, customTemplates,
  unit, loadingTemplates, activeCustomTemplateId, myRole,
  savingTemplate, templateSaveMsg, onSave, onSaveAs,
  locationLabel, clientName, projectName, wall, circ, costPerSqft,
  totals, floorGroups, onCsvImport, rateStatus,
  canSaveGeneral, onOpenGeneralModal, generalTemplateSaved,
  onNext, onBack,
}: {
  spaces: SpaceInstance[]; setSpaces: (s: SpaceInstance[]) => void;
  spaceTemplates: SpaceTemplate[]; projectTemplates: ProjectTemplate[];
  customTemplates: ApiCustomProjectTemplate[];
  unit: UnitKey; loadingTemplates: boolean;
  activeCustomTemplateId: number | null; myRole: ApiMyRole | null;
  savingTemplate: boolean; templateSaveMsg: string;
  onSave: () => void; onSaveAs: () => void;
  locationLabel: string; clientName: string; projectName: string;
  wall: number; circ: number; costPerSqft: number;
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  floorGroups: Map<number, SpaceInstance[]>;
  onCsvImport: (p: ImportPayload) => void;
  rateStatus: ApiRateStatus | null;
  canSaveGeneral: boolean;
  onOpenGeneralModal: () => void;
  generalTemplateSaved: string;
  onNext: () => void; onBack: () => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [importBanner, setImportBanner] = useState(false);

  function addFromTemplate(id: string) {
    const t = spaceTemplates.find((x) => x.id === id);
    if (!t) return;
    setSpaces([...spaces, makeSpaceFromTemplate(t, 0, [])]);
  }

  function loadProjectTemplate(tpl: ProjectTemplate) {
    const newSpaces = tpl.spaces.map(({ templateId, floor, L, B, subIds }) => {
      const t = spaceTemplates.find((x) => x.id === templateId);
      return t ? makeSpaceFromTemplate(t, floor, subIds, L, B) : null;
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>🏠 Add rooms &amp; spaces</h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Use templates, palette, or add custom spaces.</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" onClick={() => setPaletteOpen(true)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer" }}>📦 Add Space</button>
        <button type="button" onClick={() => setTemplatePanelOpen(!templatePanelOpen)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: templatePanelOpen ? "#fef3c7" : "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>🏗️ Templates</button>
        <button type="button" onClick={() => setCustomModalOpen(true)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>✏️ Custom</button>
        <button type="button" onClick={onSave} disabled={savingTemplate || spaces.length === 0}
          title={myRole?.can_save_custom_templates ? "Save template" : "Paid plan required"}
          style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: `1px solid ${myRole?.can_save_custom_templates ? "#16a34a" : "#e5e7eb"}`, background: myRole?.can_save_custom_templates ? "#dcfce7" : "#f9fafb", cursor: myRole?.can_save_custom_templates && spaces.length > 0 ? "pointer" : "not-allowed", fontWeight: 600, color: myRole?.can_save_custom_templates ? "#166534" : "#9ca3af" }}>
          💾 {savingTemplate ? "Saving…" : "Save"}
        </button>
        {activeCustomTemplateId !== null && myRole?.can_save_custom_templates && (
          <button type="button" onClick={onSaveAs} disabled={savingTemplate || spaces.length === 0} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #6366f1", background: "#eef2ff", cursor: spaces.length > 0 ? "pointer" : "not-allowed", fontWeight: 600, color: "#4338ca" }}>📋 Save As</button>
        )}
        {canSaveGeneral && (
          <button type="button" onClick={onOpenGeneralModal} disabled={spaces.length === 0}
            title="Publish as a general template visible to all users"
            style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1.5px solid #6366f1", background: spaces.length > 0 ? "#eef2ff" : "#f9fafb", cursor: spaces.length > 0 ? "pointer" : "not-allowed", fontWeight: 700, color: spaces.length > 0 ? "#4338ca" : "#c7d2fe" }}>🌐 General</button>
        )}
        {(templateSaveMsg || generalTemplateSaved) && (
          <span style={{ fontSize: 12, alignSelf: "center", color: (templateSaveMsg || generalTemplateSaved).includes("✓") ? "#166534" : (generalTemplateSaved ? "#4338ca" : "#9ca3af") }}>
            {generalTemplateSaved || templateSaveMsg}
          </span>
        )}
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
          disabled={false}
          onImport={handleCsvImportHere} />
      </div>

      {importBanner && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac" }}>
          <span>📂</span>
          <span style={{ fontSize: 13, color: "#166534", fontWeight: 600, flex: 1 }}>Project imported — review spaces below.</span>
          <button onClick={() => setImportBanner(false)} style={{ fontSize: 11, color: "#166534", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {templatePanelOpen && (
        <TemplatePanel
          projectTemplates={projectTemplates} customTemplates={customTemplates}
          loadingTemplates={loadingTemplates} activeCustomTemplateId={activeCustomTemplateId}
          onLoad={loadProjectTemplate} onLoadCustom={loadCustomTemplate}
          onClose={() => setTemplatePanelOpen(false)} />
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
              onRemove={() => remove(s.instanceId)} />
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
  savingTemplate, templateSaveMsg, activeCustomTemplateId,
  onSave, onSaveAs, onCsvImport, onBack, onEdit,
  canSaveGeneral, onOpenGeneralModal, generalTemplateSaved,
}: {
  spaces: SpaceInstance[]; unit: UnitKey;
  wall: number; circ: number; costPerSqft: number;
  rateStatus: ApiRateStatus | null; locationLabel: string;
  projectName: string; clientName: string;
  floorGroups: Map<number, SpaceInstance[]>;
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  myRole: ApiMyRole | null;
  savingTemplate: boolean; templateSaveMsg: string;
  activeCustomTemplateId: number | null;
  onSave: () => void; onSaveAs: () => void;
  onCsvImport: (p: ImportPayload) => void;
  onBack: () => void; onEdit: () => void;
  canSaveGeneral: boolean;
  onOpenGeneralModal: () => void;
  generalTemplateSaved: string;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;

  const rows = [
    { label: "Net Carpet Area",         value: fmt(totals.net,   unit), hint: "Actual usable floor area inside all rooms.", color: "#111827", bg: "#f9fafb", bold: false },
    { label: `+ Wall (${wall}%)`,        value: `+${fmt(totals.wallA, unit)}`, hint: "Extra area for walls and columns.",      color: "#6b7280", bg: "#f9fafb", bold: false },
    { label: `+ Circulation (${circ}%)`, value: `+${fmt(totals.circA, unit)}`, hint: "Corridors, staircase, lift lobby.",       color: "#6b7280", bg: "#f9fafb", bold: false },
    { label: "= Gross Built-up Area",    value: fmt(totals.gross, unit), hint: "Total area used for cost calculation.",   color: "#d97706", bg: "#fffbeb", bold: true  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>📊 Your Estimate</h2>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{locationLabel || "No location"} · {spaces.length} room{spaces.length !== 1 ? "s" : ""}{clientName ? ` · ${clientName}` : ""}</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        <SpaceRequirementPdfButton projectName={projectName} clientName={clientName}
          spaces={spaces} unit={unit} wall={wall} circ={circ}
          costPerSqft={costPerSqft} totals={totals} floorGroups={floorGroups}
          locationLabel={locationLabel} disabled={false} />
        <SpaceRequirementCsvButton projectName={projectName} clientName={clientName}
          spaces={spaces} unit={unit} wall={wall} circ={circ}
          totals={totals} locationLabel={locationLabel} disabled={false}
          onImport={onCsvImport} />
        <button type="button" onClick={onSave} disabled={savingTemplate || spaces.length === 0}
          title={myRole?.can_save_custom_templates ? "Save template" : "Paid plan required"}
          style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: `1px solid ${myRole?.can_save_custom_templates ? "#16a34a" : "#e5e7eb"}`, background: myRole?.can_save_custom_templates ? "#dcfce7" : "#f9fafb", cursor: myRole?.can_save_custom_templates ? "pointer" : "not-allowed", fontWeight: 600, color: myRole?.can_save_custom_templates ? "#166534" : "#9ca3af" }}>
          💾 {savingTemplate ? "Saving…" : "Save"}
        </button>
        {activeCustomTemplateId !== null && myRole?.can_save_custom_templates && (
          <button type="button" onClick={onSaveAs} disabled={savingTemplate} style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1px solid #6366f1", background: "#eef2ff", cursor: "pointer", fontWeight: 600, color: "#4338ca" }}>📋 Save As</button>
        )}
        {canSaveGeneral && (
          <button type="button" onClick={onOpenGeneralModal}
            title="Publish as a general template visible to all users"
            style={{ fontSize: 13, padding: "7px 12px", borderRadius: 8, border: "1.5px solid #6366f1", background: "#eef2ff", cursor: "pointer", fontWeight: 700, color: "#4338ca" }}>🌐 General</button>
        )}
        {(templateSaveMsg || generalTemplateSaved) && (
          <span style={{ fontSize: 12, alignSelf: "center", color: (generalTemplateSaved || templateSaveMsg).includes("✓") ? "#166534" : (generalTemplateSaved ? "#4338ca" : "#9ca3af") }}>
            {generalTemplateSaved || templateSaveMsg}
          </span>
        )}
      </div>

      {rateStatus && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <RateBadge source={rateStatus.source} />
          <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>{rateStatus.label}</span>
          <strong style={{ fontSize: 16, color: "#d97706", fontFamily: "monospace", letterSpacing: -0.5 }}>
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
  const [countries,    setCountries]   = useState<ApiCountry[]>([]);
  const [statesList,   setStatesList]  = useState<ApiState[]>([]);
  const [placesList,   setPlacesList]  = useState<{ id: number; name: string }[]>([]);
  const [countryId,    setCountryId]   = useState<number | null>(null);
  const [stateId,      setStateId]     = useState<number | null>(null);
  const [placeId,      setPlaceId]     = useState<number | null>(null);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  const pendingLocationRef = useRef<{ stateId: number; placeId: number } | null>(null);

  // Project settings — empty until API responds
  const [finishLevel,   setFinishLevel]   = useState("");
  const [occupancyType, setOccupancyType] = useState("");
  const [wall, setWall] = useState(10);
  const [circ, setCirc] = useState(15);
  const [unit, setUnit] = useState<UnitKey>("sqft");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [clientName,  setClientName]  = useState("");

  // Templates
  const [spaceTemplates,   setSpaceTemplates]   = useState<SpaceTemplate[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Spaces
  const [spaces, setSpaces] = useState<SpaceInstance[]>([]);

  // Rate
  const [apiRate,        setApiRate]        = useState<number | null>(null);
  const [rateStatus,     setRateStatus]     = useState<ApiRateStatus | null>(null);
  const [countryAvgRate, setCountryAvgRate] = useState<number | null>(null);
  const [loadingRate,    setLoadingRate]    = useState(false);

  // Role + custom templates
  const [myRole,                 setMyRole]                 = useState<ApiMyRole | null>(null);
  const [customTemplates,        setCustomTemplates]        = useState<ApiCustomProjectTemplate[]>([]);
  const [savingTemplate,         setSavingTemplate]         = useState(false);
  const [templateSaveMsg,        setTemplateSaveMsg]        = useState("");
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<number | null>(null);

  // General template modal
  const [generalModalOpen,     setGeneralModalOpen]     = useState(false);
  const [generalTemplateSaved, setGeneralTemplateSaved] = useState("");

  // ── Rate options ───────────────────────────────────────────
  // globalRateOptions: all surveyed types across the whole database (no place filter)
  // placeRateOptions: surveyed types for the selected place specifically
  // When a place is selected and has data, we show placeRateOptions (narrower).
  // When no place is selected or place has no data, fall back to globalRateOptions.
  const [globalRateOptions,   setGlobalRateOptions]   = useState<ApiRateOptions | null>(null);
  const [placeRateOptions,    setPlaceRateOptions]     = useState<ApiRateOptions | null>(null);
  const [loadingGlobalOptions, setLoadingGlobalOptions] = useState(true);
  const [loadingPlaceOptions,  setLoadingPlaceOptions]  = useState(false);

  // Combined loading flag passed to StepProjectType
  const loadingOptions = loadingGlobalOptions || loadingPlaceOptions;

  // Effective options: use place-specific when available and non-empty, else global
  const effectiveRateOptions = useMemo(() => {
    const hasPlaceData =
      placeRateOptions &&
      (placeRateOptions.finish_levels.length > 0 || placeRateOptions.occupancy_types.length > 0);
    return hasPlaceData ? placeRateOptions : globalRateOptions;
  }, [placeRateOptions, globalRateOptions]);

  // Whether the shown options are place-specific (used for the info badge in Step 2)
  const placeHasData =
    !!placeRateOptions &&
    (placeRateOptions.finish_levels.length > 0 || placeRateOptions.occupancy_types.length > 0);

  // ── Emoji/hint decoration maps — purely client-side display ──
  const FINISH_LEVEL_META: Record<string, { emoji: string; hint: string }> = {
    unknown:  { emoji: "🤷", hint: "We'll use the area average" },
    basic:    { emoji: "🪨", hint: "Plain plaster, simple tiles" },
    standard: { emoji: "🧱", hint: "Branded tiles, modular kitchen" },
    premium:  { emoji: "✨", hint: "Imported materials, false ceiling" },
    luxury:   { emoji: "💎", hint: "Marble, designer fittings" },
  };

  const OCCUPANCY_TYPE_EMOJI: Record<string, string> = {
    unknown:       "🤷",
    residential:   "🏠",
    commercial:    "🏢",
    institutional: "🏫",
    industrial:    "🏭",
    mixed:         "🏙️",
  };

  // Derived finish levels — sourced from effectiveRateOptions, decorated client-side
  const finishLevels = useMemo(() => {
    if (!effectiveRateOptions) return [];
    return effectiveRateOptions.finish_levels.map((f) => ({
      ...f,
      emoji: FINISH_LEVEL_META[f.value]?.emoji ?? "🏗️",
      hint:  FINISH_LEVEL_META[f.value]?.hint  ?? "",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRateOptions]);

  // Derived occupancy types — sourced from effectiveRateOptions, decorated client-side
  const occupancyTypes = useMemo(() => {
    if (!effectiveRateOptions) return [];
    return effectiveRateOptions.occupancy_types.map((o) => ({
      ...o,
      emoji: OCCUPANCY_TYPE_EMOJI[o.value] ?? "🏗️",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRateOptions]);

  // Set defaults once effectiveRateOptions changes (global on mount, or place-specific on place select)
  useEffect(() => {
    if (!effectiveRateOptions) return;
    const fls = effectiveRateOptions.finish_levels;
    const ots = effectiveRateOptions.occupancy_types;
    // Reset finish level if current value not in new options (or not yet set)
    if (fls.length > 0 && (!finishLevel || !fls.find((f) => f.value === finishLevel))) {
      setFinishLevel(fls[0].value);
    }
    // Reset occupancy type if current value not in new options (or not yet set)
    if (ots.length > 0 && (!occupancyType || !ots.find((o) => o.value === occupancyType))) {
      setOccupancyType(ots[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRateOptions]);

  // Derived
  const selectedCountry = countries.find((c) => c.id === countryId);
  const selectedState   = statesList.find((s) => s.id === stateId);
  const selectedPlace   = placesList.find((p) => p.id === placeId);
  const locationLabel   = [selectedCountry?.name, selectedState?.name, selectedPlace?.name].filter(Boolean).join(" · ");
  const rateCategory    = spaces[0]?.category ?? "residence";
  const costPerSqft     = apiRate ?? countryAvgRate ?? 2000;
  const totals          = useMemo(() => calcGrossArea(spaces, wall, circ, costPerSqft), [spaces, wall, circ, costPerSqft]);
  const floorGroups     = useMemo(() => groupByFloor(spaces), [spaces]);

  const canSaveGeneral = myRole?.role === "member" || myRole?.role === "admin";

  // ── Mount ──────────────────────────────────────────────────
  useEffect(() => {
    fetchCountries()
      .then((data) => {
        setCountries(data);
        const india = data.find((c) => c.code?.toUpperCase() === "IN" || c.name.toLowerCase() === "india");
        if (india) setCountryId(india.id);
      })
      .catch(console.error);

    Promise.all([fetchSpaceTemplates(), fetchProjectTemplates()])
      .then(([sts, pts]) => {
        setSpaceTemplates(sts.map(toSpaceTemplate));
        setProjectTemplates(pts.map(toProjectTemplate));
      })
      .catch(console.error)
      .finally(() => setLoadingTemplates(false));

    fetchMyRole()
      .then((role) => {
        setMyRole(role);
        if (role.can_save_custom_templates) {
          fetchCustomProjectTemplates().then(setCustomTemplates).catch(console.error);
        }
      })
      .catch(console.error);

    // Fetch global options (no place filter) — shows all surveyed types in DB
    setLoadingGlobalOptions(true);
    fetchRateOptions()
      .then(setGlobalRateOptions)
      .catch(console.error)
      .finally(() => setLoadingGlobalOptions(false));
  }, []);

  // ── Place-specific options: re-fetch when place changes ────
  // This is the core of "Option B": after a place is selected we call
  // rates/options/?place_id=X and show only what's surveyed for that city.
  useEffect(() => {
    if (!placeId) {
      setPlaceRateOptions(null); // clear → fall back to global
      return;
    }
    setLoadingPlaceOptions(true);
    fetchRateOptions(placeId)
      .then(setPlaceRateOptions)
      .catch(() => setPlaceRateOptions(null)) // on error fall back to global
      .finally(() => setLoadingPlaceOptions(false));
  }, [placeId]);

  // ── States ─────────────────────────────────────────────────
  useEffect(() => {
    if (!countryId) { setStatesList([]); setStateId(null); return; }
    setLoadingStates(true);
    fetchStates(countryId)
      .then((data) => {
        setStatesList(data);
        if (pendingLocationRef.current) {
          setStateId(pendingLocationRef.current.stateId);
        } else {
          setStateId(null);
          setPlaceId(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingStates(false));

    fetchAreaRate({ countryId, category: rateCategory, finishLevel: finishLevel || undefined })
      .then(setCountryAvgRate)
      .catch(() => setCountryAvgRate(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // ── Places ─────────────────────────────────────────────────
  useEffect(() => {
    if (!stateId) { setPlacesList([]); setPlaceId(null); return; }
    setLoadingPlaces(true);
    fetchPlaces(stateId)
      .then((data) => {
        setPlacesList(data);
        if (pendingLocationRef.current) {
          setPlaceId(pendingLocationRef.current.placeId);
          pendingLocationRef.current = null;
        } else {
          setPlaceId(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingPlaces(false));
  }, [stateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rate lookup ────────────────────────────────────────────
  useEffect(() => {
    if (!placeId) { setApiRate(null); setRateStatus(null); return; }
    setLoadingRate(true);
    fetchRateLookup(
      placeId, rateCategory,
      finishLevel   && finishLevel   !== "unknown" ? finishLevel   : undefined,
      occupancyType && occupancyType !== "unknown" ? occupancyType : undefined,
    )
      .then((data) => {
        setApiRate(data.effective_rate);
        setRateStatus(data.rate_status);
      })
      .catch(console.error)
      .finally(() => setLoadingRate(false));
  }, [placeId, rateCategory, finishLevel, occupancyType]);

  // ── Navigation ─────────────────────────────────────────────
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

  // ── Custom template save ───────────────────────────────────
  async function handleSaveTemplate() {
    if (!myRole?.can_save_custom_templates) { setTemplateSaveMsg("Only paid customers can save."); return; }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }
    try {
      setSavingTemplate(true); setTemplateSaveMsg("");
      const payload = {
        label: projectName || "Untitled",
        description: "User saved",
        icon: "🏠",
        data: { projectName, clientName, unit, wall, circ, spaces, countryId, stateId, placeId },
        source_project_template: null as number | null,
      };
      if (activeCustomTemplateId !== null) {
        const updated = await updateCustomProjectTemplate(activeCustomTemplateId, payload);
        setCustomTemplates((prev) => prev.map((t) => t.id === activeCustomTemplateId ? updated : t));
        setTemplateSaveMsg("✓ Updated.");
      } else {
        const saved = await saveCustomProjectTemplate(payload);
        setCustomTemplates((prev) => [saved, ...prev]);
        setActiveCustomTemplateId(saved.id);
        setTemplateSaveMsg("✓ Saved.");
      }
    } catch (err) { console.error(err); setTemplateSaveMsg("Could not save."); }
    finally { setSavingTemplate(false); }
  }

  async function handleSaveAsTemplate() {
    if (!myRole?.can_save_custom_templates || spaces.length === 0) return;
    try {
      setSavingTemplate(true); setTemplateSaveMsg("");
      const saved = await saveCustomProjectTemplate({
        label: `${projectName || "Untitled"} (copy)`,
        description: "User saved",
        icon: "🏠",
        data: { projectName, clientName, unit, wall, circ, spaces, countryId, stateId, placeId },
        source_project_template: null,
      });
      setCustomTemplates((prev) => [saved, ...prev]);
      setActiveCustomTemplateId(saved.id);
      setTemplateSaveMsg("✓ Saved as new.");
    } catch (err) { console.error(err); setTemplateSaveMsg("Could not save."); }
    finally { setSavingTemplate(false); }
  }

  function handleGeneralTemplateSaved(tpl: ApiProjectTemplate) {
    setProjectTemplates((prev) => [...prev, toProjectTemplate(tpl)]);
    setGeneralModalOpen(false);
    setGeneralTemplateSaved(`✓ "${tpl.label}" published.`);
    setTimeout(() => setGeneralTemplateSaved(""), 5000);
  }

  // ── CSV import ─────────────────────────────────────────────
  const handleCsvImport = useCallback((
    payload: ImportPayload & {
      countryId?: number | null;
      stateId?: number | null;
      placeId?: number | null;
    },
  ) => {
    setProjectName(payload.projectName);
    setClientName(payload.clientName);
    setUnit(payload.unit);
    setWall(payload.wall);
    setCirc(payload.circ);
    setSpaces(payload.spaces);
    setActiveCustomTemplateId(null);
    setTemplateSaveMsg("");

    if (payload.countryId && payload.stateId && payload.placeId) {
      pendingLocationRef.current = {
        stateId: payload.stateId,
        placeId: payload.placeId,
      };
      if (countryId === payload.countryId) {
        setStateId(payload.stateId);
      } else {
        setCountryId(payload.countryId);
      }
    }

    setStep("spaces");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  const saveProps = {
    myRole, savingTemplate, templateSaveMsg, activeCustomTemplateId,
    onSave: handleSaveTemplate, onSaveAs: handleSaveAsTemplate,
  };

  const generalSaveProps = {
    canSaveGeneral,
    generalTemplateSaved,
    onOpenGeneralModal: () => setGeneralModalOpen(true),
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

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,.05)",
        position: "sticky", top: 0, zIndex: 80,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 160px", minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📐</div>
            <div style={{ minWidth: 0 }}>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
                style={{ fontSize: 14, fontWeight: 700, color: "#111827", background: "transparent", border: "none", borderBottom: "2px solid transparent", outline: "none", width: "100%", maxWidth: 160, transition: "border-color .15s" }}
                onFocus={(e) => { e.target.style.borderBottomColor = "#f59e0b"; }}
                onBlur={(e)  => { e.target.style.borderBottomColor = "transparent"; }}
              />
              <p style={{ margin: 0, fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: .4 }}>Cost Estimator</p>
            </div>
          </div>

          <div style={{ flex: "1 1 130px", minWidth: 0 }}>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              style={{
                fontSize: 13, color: "#374151", background: "#f9fafb",
                border: "1.5px solid #e5e7eb", borderRadius: 8,
                padding: "5px 10px", outline: "none", width: "100%",
                transition: "border-color .15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#f59e0b"; e.target.style.background = "#fff"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
            />
          </div>

          {locationLabel && (
            <span onClick={() => setStep("location")} style={{
              fontSize: 11, color: "#047857", background: "#ecfdf5", padding: "4px 9px",
              borderRadius: 20, border: "1px solid #a7f3d0", cursor: "pointer",
              maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0,
            }}>📍 {locationLabel}</span>
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

      {/* Main */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "18px 14px 110px" }}>
        <WizardProgress step={step} onJump={setStep} />

        {step === "location" && (
          <StepLocation
            countries={countries} statesList={statesList} placesList={placesList}
            countryId={countryId} stateId={stateId} placeId={placeId}
            setCountryId={setCountryId} setStateId={setStateId} setPlaceId={setPlaceId}
            loadingStates={loadingStates} loadingPlaces={loadingPlaces}
            onNext={() => goNext("location")}
            onCsvImport={handleCsvImport} />
        )}

        {step === "project-type" && (
          <StepProjectType
            finishLevels={finishLevels}
            occupancyTypes={occupancyTypes}
            loadingOptions={loadingOptions}
            placeHasData={placeHasData}
            finishLevel={finishLevel} setFinishLevel={setFinishLevel}
            occupancyType={occupancyType} setOccupancyType={setOccupancyType}
            wall={wall} setWall={setWall} circ={circ} setCirc={setCirc}
            onNext={() => goNext("project-type")}
            onBack={() => goBack("project-type")} />
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
            onNext={() => goNext("spaces")} onBack={() => goBack("spaces")}
            {...saveProps}
            {...generalSaveProps} />
        )}

        {step === "summary" && (
          <StepSummary
            spaces={spaces} unit={unit} wall={wall} circ={circ}
            costPerSqft={costPerSqft} rateStatus={rateStatus}
            locationLabel={locationLabel} projectName={projectName} clientName={clientName}
            floorGroups={floorGroups} totals={totals}
            onCsvImport={handleCsvImport}
            onBack={() => goBack("summary")} onEdit={() => setStep("spaces")}
            {...saveProps}
            {...generalSaveProps} />
        )}
      </main>

      <StickyBar gross={totals.gross} cost={totals.cost} unit={unit} loading={loadingRate} />

      {generalModalOpen && (
        <SaveAsGeneralModal
          spaces={spaces}
          spaceTemplates={spaceTemplates}
          onClose={() => setGeneralModalOpen(false)}
          onSaved={handleGeneralTemplateSaved}
        />
      )}
    </>
  );
}