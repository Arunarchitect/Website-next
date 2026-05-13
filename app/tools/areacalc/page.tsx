"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import SpaceRequirementPdfButton from "./SpaceRequirementPdfButton";
import SpaceRequirementCsvButton, { type ImportPayload } from "./SpaceRequirementCsvButton";
import {
  UNIT_SYSTEMS,
  CATEGORY_META,
  FLOORS,
  getFloorLabel,
  uid,
  dimFromUnit,
  fmt,
  fmtDim,
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
  type ApiCountry,
  type ApiState,
  type ApiRateStatus,
} from "./areacalcApi";

import {
  fetchMyRole,
  fetchCustomProjectTemplates,
  saveCustomProjectTemplate,
  updateCustomProjectTemplate,
  type ApiMyRole,
  type ApiCustomProjectTemplate,
} from "./areacalcApi";

// ─── DimAreaInput ─────────────────────────────────────────────
function DimAreaInput({
  space,
  onUpdate,
  unit,
}: {
  space: SpaceInstance;
  onUpdate: (s: SpaceInstance) => void;
  unit: UnitKey;
}) {
  const uLabel = UNIT_SYSTEMS[unit].dimLabel;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const displayL = parseFloat(fmtDim(space.L, unit));
  const displayB = parseFloat(fmtDim(space.B, unit));
  const [areaDraft, setAreaDraft] = useState(
    String(parseFloat(fmt(space.L * space.B, unit).replace(/,/g, ""))),
  );
  const [areaError, setAreaError] = useState("");

  useEffect(() => {
    setAreaDraft(
      String(parseFloat(fmt(space.L * space.B, unit).replace(/,/g, ""))),
    );
    setAreaError("");
  }, [space.L, space.B, unit]);

  function handleL(val: string) {
    if (val === "") {
      onUpdate({ ...space, L: 0 });
      return;
    }
    const num = parseFloat(val);
    if (Number.isNaN(num)) return;
    onUpdate({ ...space, L: dimFromUnit(Math.max(0.01, num), unit) });
  }

  function handleB(val: string) {
    if (val === "") {
      onUpdate({ ...space, B: 0 });
      return;
    }
    const num = parseFloat(val);
    if (Number.isNaN(num)) return;
    onUpdate({ ...space, B: dimFromUnit(Math.max(0.01, num), unit) });
  }

  function confirmArea() {
    const target = parseFloat(areaDraft);
    const current = space.L * space.B;
    if (!Number.isFinite(target) || target <= 0) {
      setAreaError("Area must be above 0");
      return;
    }
    if (!Number.isFinite(current) || current <= 0) return;
    const targetSqft = unit === "sqm" ? target * 10.7639104167 : target;
    const scale = Math.sqrt(targetSqft / current);
    onUpdate({
      ...space,
      L: Math.max(0.01, space.L * scale),
      B: Math.max(0.01, space.B * scale),
    });
    setAreaError("");
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
      <div>
        <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 2 }}>
          Length ({uLabel})
        </label>
        <input
          type="number"
          min={0.01}
          step={unit === "sqm" ? 0.1 : 0.5}
          value={space.L <= 0 ? "" : displayL}
          onChange={(e) => handleL(e.target.value)}
          style={{ width: 82, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 2 }}>
          Breadth ({uLabel})
        </label>
        <input
          type="number"
          min={0.01}
          step={unit === "sqm" ? 0.1 : 0.5}
          value={space.B <= 0 ? "" : displayB}
          onChange={(e) => handleB(e.target.value)}
          style={{ width: 82, fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 2 }}>
          Area ({aLabel})
        </label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            min={0.01}
            step={unit === "sqm" ? 0.1 : 1}
            value={areaDraft}
            onChange={(e) => { setAreaDraft(e.target.value); setAreaError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") confirmArea(); }}
            style={{
              width: 104, fontSize: 13, padding: "5px 8px", borderRadius: 6,
              border: areaError ? "1px solid #ef4444" : "1px solid #e5e7eb",
            }}
          />
          <button
            type="button"
            onClick={confirmArea}
            style={{ height: 30, minWidth: 32, borderRadius: 6, border: "1px solid #16a34a", background: "#dcfce7", color: "#166534", cursor: "pointer", fontWeight: 800 }}
          >
            ✓
          </button>
        </div>
        {areaError && <p style={{ fontSize: 10, color: "#ef4444", margin: "3px 0 0" }}>{areaError}</p>}
      </div>
      <span style={{ fontSize: 10, color: "#9ca3af", paddingTop: 22 }}>Press ✓ to apply edited area</span>
    </div>
  );
}

// ─── SubSpaceRow ──────────────────────────────────────────────
function SubSpaceRow({
  sub,
  onUpdate,
  onRemove,
  unit,
}: {
  sub: SubSpaceInstance;
  onUpdate: (s: SubSpaceInstance) => void;
  onRemove: () => void;
  unit: UnitKey;
}) {
  const uLabel = UNIT_SYSTEMS[unit].dimLabel;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const dL = parseFloat(fmtDim(sub.L, unit));
  const dB = parseFloat(fmtDim(sub.B, unit));
  const [areaDraft, setAreaDraft] = useState(
    String(parseFloat(fmt(sub.L * sub.B, unit).replace(/,/g, ""))),
  );
  const [areaError, setAreaError] = useState("");

  useEffect(() => {
    setAreaDraft(String(parseFloat(fmt(sub.L * sub.B, unit).replace(/,/g, ""))));
    setAreaError("");
  }, [sub.L, sub.B, unit]);

  function confirmArea() {
    const target = parseFloat(areaDraft);
    if (!Number.isFinite(target) || target <= 0) {
      setAreaError("Area must be above 0");
      return;
    }
    const current = sub.L * sub.B;
    if (!Number.isFinite(current) || current <= 0) return;
    const targetArea = unit === "sqm" ? target * 10.7639104167 : target;
    const scale = Math.sqrt(targetArea / current);
    onUpdate({ ...sub, L: Math.max(0.01, sub.L * scale), B: Math.max(0.01, sub.B * scale) });
    setAreaError("");
  }

  return (
    <div style={{
      marginLeft: 16, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8,
      alignItems: "center", background: "#f9fafb", border: "1px solid #e5e7eb",
      borderRadius: 8, padding: "8px 12px",
    }}>
      <span style={{ fontSize: 13, color: "#6b7280", minWidth: 12 }}>↳</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", minWidth: 110 }}>{sub.name}</span>
      <input
        type="number" min={0.01} step={unit === "sqm" ? 0.1 : 0.5}
        value={sub.L <= 0 ? "" : dL}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "") { onUpdate({ ...sub, L: 0 }); return; }
          const num = parseFloat(val);
          if (Number.isNaN(num)) return;
          onUpdate({ ...sub, L: dimFromUnit(Math.max(0.01, num), unit) });
        }}
        style={{ width: 65, fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        placeholder={`L ${uLabel}`}
      />
      <input
        type="number" min={0.01} step={unit === "sqm" ? 0.1 : 0.5}
        value={sub.B <= 0 ? "" : dB}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "") { onUpdate({ ...sub, B: 0 }); return; }
          const num = parseFloat(val);
          if (Number.isNaN(num)) return;
          onUpdate({ ...sub, B: dimFromUnit(Math.max(0.01, num), unit) });
        }}
        style={{ width: 65, fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb" }}
        placeholder={`B ${uLabel}`}
      />
      <input
        type="number" min={0.01} step={unit === "sqm" ? 0.1 : 1}
        value={areaDraft}
        onChange={(e) => { setAreaDraft(e.target.value); setAreaError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") confirmArea(); }}
        style={{
          width: 84, fontSize: 12, padding: "3px 6px", borderRadius: 6,
          border: areaError ? "1px solid #ef4444" : "1px solid #e5e7eb", fontFamily: "monospace",
        }}
      />
      <span style={{ fontSize: 11, color: "#6b7280" }}>{aLabel}</span>
      <button
        type="button" onClick={confirmArea}
        style={{ fontSize: 12, color: "#166534", background: "#dcfce7", border: "1px solid #16a34a", cursor: "pointer", padding: "2px 7px", borderRadius: 5, fontWeight: 800 }}
      >✓</button>
      <input
        type="text" value={sub.description}
        onChange={(e) => onUpdate({ ...sub, description: e.target.value })}
        placeholder="Description…"
        style={{ flex: 1, minWidth: 80, fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb", color: "#6b7280" }}
      />
      <button
        onClick={onRemove}
        style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}
      >✕</button>
      {areaError && <span style={{ fontSize: 10, color: "#ef4444" }}>{areaError}</span>}
    </div>
  );
}

// ─── SpaceCard ────────────────────────────────────────────────
function SpaceCard({
  space, onUpdate, onRemove, unit, spaceTemplates,
}: {
  space: SpaceInstance;
  onUpdate: (s: SpaceInstance) => void;
  onRemove: () => void;
  unit: UnitKey;
  spaceTemplates: SpaceTemplate[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingCustomSub, setAddingCustomSub] = useState(false);
  const [customSubName, setCustomSubName] = useState("");
  const [addSubOpen, setAddSubOpen] = useState(false);
  const meta = CATEGORY_META[space.category];
  const template = spaceTemplates.find((t) => t.id === space.templateId);
  const mainArea = fmt(space.L * space.B, unit);
  const totalArea = fmt(calcSpaceArea(space), unit);
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const hasSubs = space.subSpaces.length > 0;
  const availableSubs = template?.subSpaces ?? [];

  function addSubFromTemplate(subId: string) {
    const subT = availableSubs.find((s) => s.id === subId);
    if (!subT) return;
    onUpdate({
      ...space,
      subSpaces: [...space.subSpaces, { instanceId: uid(), templateId: subT.id, name: subT.name, L: subT.L, B: subT.B, description: subT.description }],
    });
    setAddSubOpen(false);
  }

  function addCustomSub() {
    if (!customSubName.trim()) return;
    onUpdate({
      ...space,
      subSpaces: [...space.subSpaces, { instanceId: uid(), templateId: "custom", name: customSubName.trim(), L: 8, B: 6, description: "" }],
    });
    setCustomSubName("");
    setAddingCustomSub(false);
    setAddSubOpen(false);
  }

  function updateSub(id: string, updated: SubSpaceInstance) {
    onUpdate({ ...space, subSpaces: space.subSpaces.map((s) => (s.instanceId === id ? updated : s)) });
  }

  function removeSub(id: string) {
    onUpdate({ ...space, subSpaces: space.subSpaces.filter((s) => s.instanceId !== id) });
  }

  return (
    <div style={{ borderRadius: 12, border: `2px solid ${meta.border}`, background: meta.bg, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", width: 18, flexShrink: 0 }}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span style={{ fontSize: 18 }}>{space.icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#111827", minWidth: 100 }}>{space.name}</span>
        {space.isCustom && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#e5e7eb", color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>
            Custom
          </span>
        )}
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: meta.badgeBg, color: meta.badge, fontWeight: 700, textTransform: "uppercase", border: `1px solid ${meta.border}` }}>
          {meta.label}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <select
            value={space.floor}
            onChange={(e) => onUpdate({ ...space, floor: parseInt(e.target.value) })}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" }}
          >
            {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Main:</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#111827", background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              {mainArea} {aLabel}
            </span>
          </div>
          {hasSubs && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Total:</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: meta.color, background: "#fff", padding: "3px 8px", borderRadius: 6, border: `1px solid ${meta.border}` }}>
                {totalArea} {aLabel}
              </span>
            </div>
          )}
          <button
            onClick={onRemove}
            style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px 6px" }}
          >🗑</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 12px 12px" }}>
          <DimAreaInput space={space} onUpdate={onUpdate} unit={unit} />
          <textarea
            value={space.description ?? ""}
            onChange={(e) => onUpdate({ ...space, description: e.target.value })}
            placeholder="Description…"
            rows={2}
            style={{ width: "100%", marginTop: 8, fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb", color: "#374151", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
          />
          {space.subSpaces.map((sub) => (
            <SubSpaceRow
              key={sub.instanceId} sub={sub} unit={unit}
              onUpdate={(u) => updateSub(sub.instanceId, u)}
              onRemove={() => removeSub(sub.instanceId)}
            />
          ))}
          <div style={{ marginTop: 8, marginLeft: 16 }}>
            {addSubOpen ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {availableSubs
                  .filter((s) => !space.subSpaces.find((ss) => ss.templateId === s.id))
                  .map((s) => (
                    <button key={s.id} onClick={() => addSubFromTemplate(s.id)}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#374151" }}>
                      + {s.name}
                    </button>
                  ))}
                {addingCustomSub ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      autoFocus value={customSubName}
                      onChange={(e) => setCustomSubName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustomSub()}
                      placeholder="Sub-space name"
                      style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid #d1d5db", width: 140 }}
                    />
                    <button onClick={addCustomSub} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer" }}>Add</button>
                    <button onClick={() => setAddingCustomSub(false)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingCustomSub(true)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px dashed #9ca3af", background: "#f9fafb", cursor: "pointer", color: "#6b7280" }}>
                    + Custom sub-space
                  </button>
                )}
                <button
                  onClick={() => { setAddSubOpen(false); setAddingCustomSub(false); }}
                  style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setAddSubOpen(true)}
                style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>⊕</span> Add sub-space
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CustomSpaceModal ─────────────────────────────────────────
function CustomSpaceModal({ onAdd, onClose }: { onAdd: (s: SpaceInstance) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("residence");
  const [L, setL] = useState(12);
  const [B, setB] = useState(10);
  const [icon, setIcon] = useState("📐");
  const [floor, setFloor] = useState(0);
  const icons = ["📐","🏗️","🏠","🛋️","🛏️","🍳","🚿","🌿","🚗","💼","📚","🔬","🏥","🛍️","🎉","✨","🏨","🏢","🪑","🩺","💊","🎭","📖","🅿️","🍴","🔑","🪜","↔️"];

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({ instanceId: uid(), templateId: "custom", name: name.trim(), category, L, B, floor, icon, description: "", subSpaces: [], isCustom: true });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Add Custom Space</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Space Name *</label>
        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Server Room, Prayer Hall…"
          style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 12, boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as CategoryKey)}
          style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 12 }}>
          {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Length (ft)</label>
            <input type="number" value={L} min={1} step={0.5} onChange={(e) => setL(parseFloat(e.target.value) || 1)}
              style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Breadth (ft)</label>
            <input type="number" value={B} min={1} step={0.5} onChange={(e) => setB(parseFloat(e.target.value) || 1)}
              style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
          </div>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Floor</label>
        <select value={floor} onChange={(e) => setFloor(parseInt(e.target.value))}
          style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 12 }}>
          {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Icon</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {icons.map((ic) => (
            <button key={ic} onClick={() => setIcon(ic)}
              style={{ fontSize: 20, background: icon === ic ? "#fef3c7" : "#f9fafb", border: icon === ic ? "2px solid #f59e0b" : "1px solid #e5e7eb", borderRadius: 8, width: 40, height: 40, cursor: "pointer" }}>
              {ic}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleAdd} disabled={!name.trim()}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: name.trim() ? "#1d4ed8" : "#e5e7eb", color: name.trim() ? "#fff" : "#9ca3af", fontWeight: 600, cursor: name.trim() ? "pointer" : "default", fontSize: 14 }}>
            Add Space
          </button>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PalettePanel ─────────────────────────────────────────────
function PalettePanel({
  filteredTemplates, activeCategory, setActiveCategory, searchQ, setSearchQ, addSpace, setShowCustomModal,
}: {
  filteredTemplates: SpaceTemplate[];
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  searchQ: string;
  setSearchQ: (q: string) => void;
  addSpace: (id: string) => void;
  setShowCustomModal: (v: boolean) => void;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Space Palette</p>
      <input
        type="text" placeholder="🔍  Search…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
        style={{ width: "100%", fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", marginBottom: 8, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setActiveCategory("all")}
          style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid", borderColor: activeCategory === "all" ? "#374151" : "#e5e7eb", background: activeCategory === "all" ? "#374151" : "#fff", color: activeCategory === "all" ? "#fff" : "#6b7280", cursor: "pointer", textTransform: "uppercase" }}>
          All
        </button>
        {Object.entries(CATEGORY_META).map(([k, v]) => (
          <button key={k} onClick={() => setActiveCategory(k)}
            style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid", borderColor: activeCategory === k ? v.color : "#e5e7eb", background: activeCategory === k ? v.color : "#fff", color: activeCategory === k ? "#fff" : "#6b7280", cursor: "pointer", textTransform: "uppercase" }}>
            {v.label.split(" ")[0]}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {filteredTemplates.length === 0 && <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 16 }}>No spaces found</p>}
        {filteredTemplates.map((t) => (
          <button key={t.id} onClick={() => addSpace(t.id)} title={t.description}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #f3f4f6", background: "#f9fafb", marginBottom: 4, cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</p>
              <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>{t.L}&apos; × {t.B}&apos; = {t.L * t.B} sqft</p>
            </div>
            <span style={{ fontSize: 16, color: "#d1d5db" }}>+</span>
          </button>
        ))}
      </div>
      <button onClick={() => setShowCustomModal(true)}
        style={{ width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, border: "1px dashed #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
        ✏️ Add Custom Space
      </button>
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────
function SummaryCard({
  totals, unit, wall, circ, costPerSqft, spaces, floorGroups, locationLabel,
}: {
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  unit: UnitKey;
  wall: number;
  circ: number;
  costPerSqft: number;
  spaces: SpaceInstance[];
  floorGroups: Map<number, SpaceInstance[]>;
  locationLabel: string;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  return (
    <div style={{ borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", padding: 20, marginTop: 8 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>Area Summary</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Net Carpet Area", val: fmt(totals.net, unit), color: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
          { label: `Wall (${wall}%)`, val: `+ ${fmt(totals.wallA, unit)}`, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
          { label: `Circulation (${circ}%)`, val: `+ ${fmt(totals.circA, unit)}`, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
          { label: "Gross Built-up", val: fmt(totals.gross, unit), color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
        ].map((item) => (
          <div key={item.label} style={{ borderRadius: 10, border: `1px solid ${item.border}`, background: item.bg, padding: "12px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 4px" }}>{item.label}</p>
            <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 20, color: item.color, margin: 0 }}>{item.val}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{aLabel}</p>
          </div>
        ))}
      </div>
      <div style={{ borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", margin: "0 0 4px" }}>Estimated Construction Cost</p>
          <p style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 28, color: "#047857", margin: 0 }}>{fmtCost(totals.cost)}</p>
        </div>
        <div style={{ fontSize: 12, color: "#047857" }}>
          <p style={{ margin: "0 0 2px" }}>@ ₹{costPerSqft.toLocaleString("en-IN")}/sqft × {fmt(totals.gross, "sqft")} sqft</p>
          <p style={{ margin: 0, color: "#6ee7b7" }}>{locationLabel || "No location selected"} · Finishing extra</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Array.from(floorGroups.entries()).map(([floor, fs]) => {
            const fa = fs.reduce((a, s) => a + calcSpaceArea(s), 0);
            return (
              <div key={floor} style={{ textAlign: "center", borderRadius: 8, border: "1px solid #a7f3d0", background: "#fff", padding: "6px 10px" }}>
                <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, margin: 0 }}>{getFloorLabel(floor)}</p>
                <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151", margin: 0 }}>{fmt(fa, unit)} {aLabel}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 8px" }}>Breakdown by Type</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const catSpaces = spaces.filter((s) => s.category === cat);
            if (!catSpaces.length) return null;
            const catArea = catSpaces.reduce((a, s) => a + calcSpaceArea(s), 0);
            const pct = totals.net > 0 ? Math.round((catArea / totals.net) * 100) : 0;
            return (
              <div key={cat} style={{ borderRadius: 10, border: `1px solid ${meta.border}`, background: meta.bg, padding: "8px 12px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: meta.badge, margin: "0 0 2px" }}>{meta.label}</p>
                <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#374151", margin: 0 }}>
                  {fmt(catArea, unit)} {aLabel}{" "}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>({pct}%)</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── RateStatusBadge ──────────────────────────────────────────
function RateStatusBadge({ source, label }: { source: string; label: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    survey: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
    survey_all_categories: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    fallback: { bg: "#fffbeb", color: "#b45309", border: "#fcd34d" },
    default: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
  };
  const s = styles[source] ?? styles.default;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ─── ImportBanner ─────────────────────────────────────────────
function ImportBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      background: "#f0fdf4", border: "1px solid #86efac",
      marginBottom: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 18 }}>📂</span>
      <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>
        Project imported from CSV — review spaces below, then save or export as needed.
      </span>
      <button onClick={onDismiss}
        style={{ marginLeft: "auto", fontSize: 11, color: "#166534", background: "none", border: "none", cursor: "pointer" }}>
        Dismiss ✕
      </button>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  // Spaces state
  const [spaces, setSpaces] = useState<SpaceInstance[]>([]);
  const [unit, setUnit] = useState<UnitKey>("sqft");
  const [wall, setWall] = useState(10);
  const [circ, setCirc] = useState(15);

  // Geography from API
  const [countries, setCountries] = useState<ApiCountry[]>([]);
  const [statesList, setStatesList] = useState<ApiState[]>([]);
  const [placesList, setPlacesList] = useState<{ id: number; name: string }[]>([]);
  const [countryId, setCountryId] = useState<number | null>(null);
  const [stateId, setStateId] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<number | null>(null);

  // Templates from API
  const [spaceTemplates, setSpaceTemplates] = useState<SpaceTemplate[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Rate from API
  const [apiRate, setApiRate] = useState<number | null>(null);
  const [rateStatus, setRateStatus] = useState<ApiRateStatus | null>(null);
  const [customRate, setCustomRate] = useState<number | null>(null);

  // UI state
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [activeFloor, setActiveFloor] = useState<number | "all">("all");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [clientName, setClientName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // CSV import banner
  const [showImportBanner, setShowImportBanner] = useState(false);

  // Saved custom templates / role
  const [myRole, setMyRole] = useState<ApiMyRole | null>(null);
  const [customTemplates, setCustomTemplates] = useState<ApiCustomProjectTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaveMsg, setTemplateSaveMsg] = useState("");

  // tracks which custom template is currently "active" (loaded or last saved)
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<number | null>(null);

  // Derived
  const rateCategory = spaces[0]?.category ?? "residence";
  const costPerSqft = customRate ?? apiRate ?? 2000;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const selectedCountry = countries.find((c) => c.id === countryId);
  const selectedState = statesList.find((s) => s.id === stateId);
  const selectedPlace = placesList.find((p) => p.id === placeId);
  const locationLabel = [selectedCountry?.name, selectedState?.name, selectedPlace?.name].filter(Boolean).join(" · ");

  // Load countries + templates + user role on mount
  useEffect(() => {
    fetchCountries().then(setCountries).catch(console.error);
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
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (countryId == null) { setStatesList([]); setStateId(null); return; }
    fetchStates(countryId).then((data) => { setStatesList(data); setStateId(null); setPlaceId(null); }).catch(console.error);
  }, [countryId]);

  // Load places when state changes
  useEffect(() => {
    if (stateId == null) { setPlacesList([]); setPlaceId(null); return; }
    fetchPlaces(stateId).then((data) => { setPlacesList(data); setPlaceId(null); }).catch(console.error);
  }, [stateId]);

  // Fetch rate when place or category changes
  useEffect(() => {
    if (placeId == null) { setApiRate(null); setRateStatus(null); return; }
    setCustomRate(null);
    fetchRateLookup(placeId, rateCategory)
      .then((data) => { setApiRate(data.effective_rate); setRateStatus(data.rate_status); })
      .catch(console.error);
  }, [placeId, rateCategory]);

  const filteredTemplates = useMemo(
    () => spaceTemplates.filter((t) => {
      const catOk = activeCategory === "all" || t.category === activeCategory;
      const qOk = !searchQ.trim() || t.name.toLowerCase().includes(searchQ.toLowerCase());
      return catOk && qOk;
    }),
    [spaceTemplates, activeCategory, searchQ],
  );

  const addSpace = useCallback(
    (templateId: string) => {
      const t = spaceTemplates.find((x) => x.id === templateId);
      if (!t) return;
      const floor = typeof activeFloor === "number" ? activeFloor : 0;
      setSpaces((prev) => [...prev, makeSpaceFromTemplate(t, floor, [])]);
    },
    [spaceTemplates, activeFloor],
  );

  const addCustomSpace = useCallback((space: SpaceInstance) => { setSpaces((prev) => [...prev, space]); }, []);

  const updateSpace = useCallback((id: string, updated: SpaceInstance) => {
    setSpaces((prev) => prev.map((s) => (s.instanceId === id ? updated : s)));
  }, []);

  const removeSpace = useCallback((id: string) => {
    setSpaces((prev) => prev.filter((s) => s.instanceId !== id));
  }, []);

  // Load a project template → clears any active custom template reference
  function loadTemplate(tpl: ProjectTemplate) {
    const newSpaces = tpl.spaces
      .map(({ templateId, floor, L, B, subIds }) => {
        const t = spaceTemplates.find((x) => x.id === templateId);
        if (!t) return null;
        return makeSpaceFromTemplate(t, floor, subIds, L, B);
      })
      .filter((x): x is SpaceInstance => x !== null);
    setSpaces(newSpaces);
    setProjectName(tpl.label);
    setActiveCustomTemplateId(null);
    setShowImportBanner(false);
    setShowTemplatePanel(false);
  }

  // Load a custom template → tracks its ID so Save will PATCH
  function loadCustomTemplate(tpl: ApiCustomProjectTemplate) {
    const data = tpl.data as {
      projectName?: string;
      clientName?: string;
      unit?: UnitKey;
      wall?: number;
      circ?: number;
      spaces?: SpaceInstance[];
    };
    setProjectName(data.projectName || tpl.label);
    setClientName(data.clientName || "");
    setUnit(data.unit || "sqft");
    setWall(data.wall ?? 10);
    setCirc(data.circ ?? 15);
    setSpaces(data.spaces || []);
    setActiveCustomTemplateId(tpl.id);
    setShowImportBanner(false);
    setShowTemplatePanel(false);
  }

  // ── CSV Import handler ─────────────────────────────────────
  const handleCsvImport = useCallback((payload: ImportPayload) => {
    setProjectName(payload.projectName);
    setClientName(payload.clientName);
    setUnit(payload.unit);
    setWall(payload.wall);
    setCirc(payload.circ);
    setSpaces(payload.spaces);
    // CSV import: not tied to any saved template — next Save will POST
    setActiveCustomTemplateId(null);
    setShowImportBanner(true);
    setTemplateSaveMsg("");
  }, []);

  // ── Save: PATCH if activeCustomTemplateId exists, else POST ──
  async function handleSaveTemplate() {
    if (!myRole?.can_save_custom_templates) {
      setTemplateSaveMsg("Only paid customers can save custom templates.");
      return;
    }
    if (spaces.length === 0) {
      setTemplateSaveMsg("Add at least one space before saving.");
      return;
    }

    try {
      setSavingTemplate(true);
      setTemplateSaveMsg("");

      const payload = {
        label: projectName || "Untitled Custom Template",
        description: "User saved custom area template",
        icon: "🏠",
        data: { projectName, clientName, unit, wall, circ, spaces },
        source_project_template: null as number | null,
      };

      if (activeCustomTemplateId !== null) {
        // PATCH — update the existing template in place
        const updated = await updateCustomProjectTemplate(activeCustomTemplateId, payload);
        setCustomTemplates((prev) =>
          prev.map((t) => (t.id === activeCustomTemplateId ? updated : t))
        );
        setTemplateSaveMsg("Template updated.");
      } else {
        // POST — first-time save
        const saved = await saveCustomProjectTemplate(payload);
        setCustomTemplates((prev) => [saved, ...prev]);
        setActiveCustomTemplateId(saved.id);
        setTemplateSaveMsg("Template saved.");
      }
      setShowImportBanner(false);
    } catch (err) {
      console.error(err);
      setTemplateSaveMsg("Could not save template. Check login and role permission.");
    } finally {
      setSavingTemplate(false);
    }
  }

  // ── Save As: always POST, then switch active ID to new copy ──
  async function handleSaveAsTemplate() {
    if (!myRole?.can_save_custom_templates) {
      setTemplateSaveMsg("Only paid customers can save custom templates.");
      return;
    }
    if (spaces.length === 0) {
      setTemplateSaveMsg("Add at least one space before saving.");
      return;
    }

    try {
      setSavingTemplate(true);
      setTemplateSaveMsg("");

      const saved = await saveCustomProjectTemplate({
        label: `${projectName || "Untitled"} (copy)`,
        description: "User saved custom area template",
        icon: "🏠",
        data: { projectName, clientName, unit, wall, circ, spaces },
        source_project_template: null,
      });

      setCustomTemplates((prev) => [saved, ...prev]);
      setActiveCustomTemplateId(saved.id);
      setTemplateSaveMsg("Saved as new template.");
      setShowImportBanner(false);
    } catch (err) {
      console.error(err);
      setTemplateSaveMsg("Could not save. Check login and role permission.");
    } finally {
      setSavingTemplate(false);
    }
  }

  const totals = useMemo(() => calcGrossArea(spaces, wall, circ, costPerSqft), [spaces, wall, circ, costPerSqft]);
  const floorGroups = useMemo(() => groupByFloor(spaces), [spaces]);
  const usedFloors = useMemo(() => Array.from(floorGroups.keys()).sort((a, b) => a - b), [floorGroups]);
  const visibleSpaces = useMemo(
    () => activeFloor === "all" ? spaces : spaces.filter((s) => s.floor === activeFloor),
    [spaces, activeFloor],
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📐</span>
          <div>
            <input
              value={projectName} onChange={(e) => setProjectName(e.target.value)}
              style={{ fontSize: 16, fontWeight: 700, color: "#111827", background: "transparent", border: "none", borderBottom: "2px solid transparent", outline: "none", maxWidth: 200 }}
              onFocus={(e) => (e.target.style.borderBottomColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Area Calculator</p>
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Client name</label>
            <input
              value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Optional"
              style={{ width: "100%", fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: 0 }}>Gross</p>
              <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#d97706", margin: 0, fontSize: 14 }}>{fmt(totals.gross, unit)} {aLabel}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: 0 }}>Est. Cost</p>
              <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#059669", margin: 0, fontSize: 14 }}>{fmtCost(totals.cost)}</p>
            </div>
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 2 }}>
              {Object.entries(UNIT_SYSTEMS).map(([k, v]) => (
                <button key={k} onClick={() => setUnit(k as UnitKey)}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: unit === k ? "#fff" : "transparent", fontWeight: unit === k ? 700 : 400, cursor: "pointer", color: unit === k ? "#111827" : "#6b7280", boxShadow: unit === k ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  {v.areaLabel}
                </button>
              ))}
            </div>
            <button onClick={() => setSettingsOpen(!settingsOpen)}
              style={{ fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: settingsOpen ? "#fef3c7" : "#fff", cursor: "pointer", color: "#374151" }}>
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <div style={{ background: "#fffbeb", borderTop: "1px solid #fde68a", padding: "12px 16px" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>COUNTRY</label>
                <select value={countryId ?? ""} onChange={(e) => setCountryId(e.target.value ? Number(e.target.value) : null)}
                  style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", minWidth: 140 }}>
                  <option value="">— Select —</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>STATE / PROVINCE</label>
                <select value={stateId ?? ""} onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!countryId || statesList.length === 0}
                  style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", minWidth: 160 }}>
                  <option value="">— Select —</option>
                  {statesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>CITY / PLACE</label>
                <select value={placeId ?? ""} onChange={(e) => setPlaceId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!stateId || placesList.length === 0}
                  style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", minWidth: 180 }}>
                  <option value="">— Select —</option>
                  {placesList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  RATE (₹/sqft) <span style={{ fontWeight: 400, color: "#9ca3af" }}>— override</span>
                </label>
                <input type="number" min={500} step={100} value={customRate ?? costPerSqft}
                  onChange={(e) => setCustomRate(parseInt(e.target.value) || null)}
                  style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 100 }} />
                {customRate && (
                  <button onClick={() => setCustomRate(null)}
                    style={{ marginLeft: 6, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
                    reset
                  </button>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>WALL AREA (%)</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={50} step={1} value={wall}
                    onChange={(e) => setWall(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ fontSize: 13, padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", width: 64 }} />
                  <input type="range" min={0} max={50} step={1} value={wall}
                    onChange={(e) => setWall(parseInt(e.target.value))}
                    style={{ width: 90, accentColor: "#f59e0b" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>CIRCULATION AREA (%)</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={100} step={1} value={circ}
                    onChange={(e) => setCirc(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ fontSize: 13, padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", width: 64 }} />
                  <input type="range" min={0} max={50} step={1} value={circ}
                    onChange={(e) => setCirc(parseInt(e.target.value))}
                    style={{ width: 90, accentColor: "#f59e0b" }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", borderLeft: "2px solid #fcd34d", paddingLeft: 12 }}>
                <strong style={{ color: "#92400e" }}>₹{costPerSqft.toLocaleString("en-IN")}/sqft</strong>
                {customRate && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 20, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}>
                    Custom override
                  </span>
                )}
                <br />
                <span style={{ fontSize: 11 }}>{locationLabel || "No location selected"}</span>
                {rateStatus && <div style={{ marginTop: 5 }}><RateStatusBadge source={rateStatus.source} label={rateStatus.label} /></div>}
                {!placeId && <div style={{ marginTop: 4, fontSize: 10, color: "#b45309" }}>Select a city to load survey rates</div>}
              </div>
            </div>
          </div>
        )}
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => setPaletteOpen(true)}
              style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>
              📦 Add Space{loadingTemplates ? " (loading…)" : ""}
            </button>
            <button onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: showTemplatePanel ? "#fef3c7" : "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>
              🏗️ Templates
            </button>
            <button onClick={() => setShowCustomModal(true)}
              style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>
              ✏️ Custom Space
            </button>

            {/* Save button: PATCH if active template, else POST */}
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || spaces.length === 0}
              title={
                myRole?.can_save_custom_templates
                  ? activeCustomTemplateId
                    ? "Update the currently loaded custom template"
                    : "Save this layout as a new custom template"
                  : "Only paid customers can save custom templates"
              }
              style={{
                fontSize: 13,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #16a34a",
                background: myRole?.can_save_custom_templates ? "#dcfce7" : "#f3f4f6",
                cursor: myRole?.can_save_custom_templates && spaces.length > 0 ? "pointer" : "not-allowed",
                fontWeight: 600,
                color: myRole?.can_save_custom_templates ? "#166534" : "#9ca3af",
              }}
            >
              💾 {savingTemplate ? "Saving…" : activeCustomTemplateId ? "Save" : "Save Template"}
            </button>

            {/* Save As: shown when an active template is tracked OR after CSV import (for paid users) */}
            {(activeCustomTemplateId !== null || showImportBanner) && myRole?.can_save_custom_templates && (
              <button
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate || spaces.length === 0}
                title="Save a new copy of this layout as a separate template"
                style={{
                  fontSize: 13,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #6366f1",
                  background: "#eef2ff",
                  cursor: spaces.length > 0 ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  color: "#4338ca",
                }}
              >
                📋 Save As
              </button>
            )}

            {templateSaveMsg && (
              <span style={{ fontSize: 12, color: templateSaveMsg.includes("saved") || templateSaveMsg.includes("updated") ? "#166534" : "#6b7280", alignSelf: "center" }}>
                {templateSaveMsg}
              </span>
            )}

            <SpaceRequirementPdfButton
              projectName={projectName} clientName={clientName} spaces={spaces} unit={unit}
              wall={wall} circ={circ} costPerSqft={costPerSqft} totals={totals}
              floorGroups={floorGroups} locationLabel={locationLabel} disabled={spaces.length === 0}
            />

            {/* CSV Export + Import (always available) */}
            <SpaceRequirementCsvButton
              projectName={projectName} clientName={clientName} spaces={spaces} unit={unit}
              wall={wall} circ={circ} totals={totals} locationLabel={locationLabel}
              disabled={spaces.length === 0}
              onImport={handleCsvImport}
            />
          </div>

          {/* Import banner */}
          {showImportBanner && <ImportBanner onDismiss={() => setShowImportBanner(false)} />}

          {/* Templates strip */}
          {showTemplatePanel && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <p style={{ width: "100%", margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                Project Templates — click to load
              </p>
              {loadingTemplates ? (
                <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading templates…</p>
              ) : projectTemplates.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 13 }}>No project templates found.</p>
              ) : (
                projectTemplates.map((tpl) => (
                  <button key={tpl.id} onClick={() => loadTemplate(tpl)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "12px 16px", borderRadius: 12, border: "2px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", minWidth: 180, textAlign: "left" }}>
                    <span style={{ fontSize: 28 }}>{tpl.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{tpl.label}</span>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{tpl.description}</span>
                  </button>
                ))
              )}

              {customTemplates.length > 0 && (
                <>
                  <p style={{ width: "100%", margin: "16px 0 8px", fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                    My Saved Templates
                  </p>
                  {customTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => loadCustomTemplate(tpl)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                        padding: "12px 16px", borderRadius: 12,
                        border: tpl.id === activeCustomTemplateId ? "2px solid #16a34a" : "2px solid #bbf7d0",
                        background: tpl.id === activeCustomTemplateId ? "#dcfce7" : "#f0fdf4",
                        cursor: "pointer", minWidth: 180, textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{tpl.icon || "🏠"}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#14532d" }}>{tpl.label}</span>
                      <span style={{ fontSize: 11, color: "#166534" }}>
                        {tpl.id === activeCustomTemplateId ? "✓ Currently active" : "Custom saved template"}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Floor tabs */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
            <button onClick={() => setActiveFloor("all")}
              style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: activeFloor !== "all" ? "1px solid #e5e7eb" : "none", background: activeFloor === "all" ? "#374151" : "#fff", color: activeFloor === "all" ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              All
            </button>
            {usedFloors.map((f) => (
              <button key={f} onClick={() => setActiveFloor(f)}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: activeFloor !== f ? "1px solid #e5e7eb" : "none", background: activeFloor === f ? "#f59e0b" : "#fff", color: activeFloor === f ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {getFloorLabel(f)} <span style={{ opacity: 0.7 }}>({floorGroups.get(f)?.length ?? 0})</span>
              </button>
            ))}
            {FLOORS.filter((f) => !usedFloors.includes(f)).map((f) => (
              <button key={f} onClick={() => setActiveFloor(f)}
                style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "1px dashed #d1d5db", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>
                + {getFloorLabel(f)}
              </button>
            ))}
          </div>

          {/* Spaces list */}
          {visibleSpaces.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 16, border: "2px dashed #d1d5db", background: "#fff", padding: "60px 24px", textAlign: "center" }}>
              <span style={{ fontSize: 48, marginBottom: 12 }}>🏗️</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#9ca3af", margin: "0 0 6px" }}>No spaces yet</p>
              <p style={{ fontSize: 14, color: "#d1d5db", margin: 0 }}>Use &ldquo;Add Space&rdquo;, &ldquo;Templates&rdquo;, &ldquo;Custom Space&rdquo; or &ldquo;Import CSV&rdquo; above</p>
            </div>
          ) : activeFloor === "all" ? (
            Array.from(floorGroups.entries()).map(([floor, fs]) => (
              <div key={floor} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{getFloorLabel(floor)}</span>
                  <div style={{ flex: 1, borderTop: "1px solid #e5e7eb" }} />
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#9ca3af" }}>
                    {fmt(fs.reduce((a, s) => a + calcSpaceArea(s), 0), unit)} {aLabel}
                  </span>
                </div>
                {fs.map((s) => (
                  <SpaceCard key={s.instanceId} space={s} unit={unit} spaceTemplates={spaceTemplates}
                    onUpdate={(u) => updateSpace(s.instanceId, u)} onRemove={() => removeSpace(s.instanceId)} />
                ))}
              </div>
            ))
          ) : (
            visibleSpaces.map((s) => (
              <SpaceCard key={s.instanceId} space={s} unit={unit} spaceTemplates={spaceTemplates}
                onUpdate={(u) => updateSpace(s.instanceId, u)} onRemove={() => removeSpace(s.instanceId)} />
            ))
          )}

          {spaces.length > 0 && (
            <SummaryCard
              totals={totals} unit={unit} wall={wall} circ={circ} costPerSqft={costPerSqft}
              spaces={spaces} floorGroups={floorGroups} locationLabel={locationLabel}
            />
          )}
        </main>
      </div>

      {/* Mobile palette drawer */}
      {paletteOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={() => setPaletteOpen(false)} />
          <div style={{ width: 300, background: "#fff", height: "100%", overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Space Palette</span>
              <button onClick={() => setPaletteOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
            </div>
            <PalettePanel
              filteredTemplates={filteredTemplates} activeCategory={activeCategory}
              setActiveCategory={setActiveCategory} searchQ={searchQ} setSearchQ={setSearchQ}
              addSpace={(id) => { addSpace(id); setPaletteOpen(false); }}
              setShowCustomModal={() => { setShowCustomModal(true); setPaletteOpen(false); }}
            />
          </div>
        </div>
      )}

      {showCustomModal && <CustomSpaceModal onAdd={addCustomSpace} onClose={() => setShowCustomModal(false)} />}
    </div>
  );
}