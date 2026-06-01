"use client";

import { useState, useMemo, useEffect } from "react";
import {
  UNIT_SYSTEMS, CATEGORY_META, FLOORS,
  getFloorLabel, uid, dimFromUnit, dimToUnit, fmt, calcSpaceArea,
  type UnitKey, type CategoryKey, type SpaceTemplate,
  type SubSpaceInstance, type SpaceInstance,
} from "../areadata";

// ─── DimAreaEditor ────────────────────────────────────────────

export function DimAreaEditor({ L, B, unit, onUpdate }: {
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

export function TotalAreaScaler({ spaces, unit, currentNet, onScale }: {
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

// ─── SubSpaceRow ──────────────────────────────────────────────

export function SubSpaceRow({ sub, onUpdate, onRemove, onCopy, unit }: {
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

export function SpaceCard({ space, onUpdate, onRemove, onCopy, unit, spaceTemplates }: {
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

// ─── CustomSpaceModal ─────────────────────────────────────────

// CHANGE 1: added `unit` to props type and destructure
export function CustomSpaceModal({ onAdd, onClose, unit }: {
  onAdd: (s: SpaceInstance) => void; onClose: () => void; unit: UnitKey;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("residence");
  // CHANGE 2: default L/B initialised in display units
  const [L, setL] = useState(() => unit === "sqm" ? +dimToUnit(12, "sqm").toFixed(2) : 12);
  const [B, setB] = useState(() => unit === "sqm" ? +dimToUnit(10, "sqm").toFixed(2) : 10);
  const [icon, setIcon] = useState("📐");
  const [floor, setFloor] = useState(0);
  // CHANGE 3: derive uLabel from unit
  const uLabel = UNIT_SYSTEMS[unit].dimLabel;
  const icons = ["📐","🏗️","🏠","🛋️","🛏️","🍳","🚿","🌿","🚗","💼","📚","🔬","🏥","🛍️","🎉","✨","🏨","🏢","🪑","🩺","💊","🎭","📖","🅿️","🍴","🔑","🪜","↔️"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.2)" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 800, color: "#111827" }}>✏️ Custom Space</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>Space Name *</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && (onAdd({
              instanceId: uid(), templateId: "custom", name: name.trim(), category,
              // CHANGE 4a: convert display units → ft on Enter keydown
              L: dimFromUnit(L, unit),
              B: dimFromUnit(B, unit),
              floor, icon, description: "", subSpaces: [], isCustom: true,
            }), onClose())}
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
          {/* CHANGE 5: dynamic label using uLabel; step adapts to unit */}
          {[{ label: `Length (${uLabel})`, val: L, set: setL }, { label: `Width (${uLabel})`, val: B, set: setB }].map(({ label, val, set }) => (
            <div key={label} style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>{label}</label>
              <input type="number" value={val} min={0.1} step={unit === "sqm" ? 0.1 : 0.5}
                onChange={(e) => (set as (n: number) => void)(parseFloat(e.target.value) || 0.1)}
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
            onAdd({
              instanceId: uid(), templateId: "custom", name: name.trim(), category,
              // CHANGE 4b: convert display units → ft on button click
              L: dimFromUnit(L, unit),
              B: dimFromUnit(B, unit),
              floor, icon, description: "", subSpaces: [], isCustom: true,
            });
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

// ─── PaletteDrawer ────────────────────────────────────────────

export function PaletteDrawer({ spaceTemplates, onAdd, onCustom, onClose }: {
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