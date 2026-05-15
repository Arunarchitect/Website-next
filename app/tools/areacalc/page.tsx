"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
  fetchAreaRate,
  type ApiMyRole,
  type ApiCustomProjectTemplate,
} from "./areacalcApi";

// ── Finish level options ───────────────────────────────────────
const FINISH_LEVELS = [
  { value: "unknown", label: "Any" },
  { value: "basic",    label: "Basic",    icon: "🪨" },
  { value: "standard", label: "Standard", icon: "🧱" },
  { value: "premium",  label: "Premium",  icon: "✨" },
  { value: "luxury",   label: "Luxury",   icon: "💎" },
];

// ── Spinner ────────────────────────────────────────────────────
function Spinner({ size = 14, color = "#9ca3af" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}22`,
        borderTop: `2px solid ${color}`,
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ── RateStatusBadge ────────────────────────────────────────────
function RateStatusBadge({ source }: { source: string }) {
  const MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
    survey:                { label: "Local Survey",     bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
    survey_all_categories: { label: "Area Survey",      bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    country_average:       { label: "Country Average",  bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" },
    fallback:              { label: "Estimated",        bg: "#fffbeb", color: "#b45309", border: "#fcd34d" },
  };
  const s = MAP[source] ?? { label: source, bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 20,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        letterSpacing: 0.3,
      }}
    >
      {s.label}
    </span>
  );
}

// ── LocationGate ───────────────────────────────────────────────
function LocationGate({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        borderRadius: 20,
        border: "2px dashed #fcd34d",
        background: "linear-gradient(135deg, #fffbeb 0%, #fef9ee 100%)",
        padding: "56px 24px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          "linear-gradient(135deg, #fef3c7 0%, #fde68a22 100%)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#f59e0b";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background =
          "linear-gradient(135deg, #fffbeb 0%, #fef9ee 100%)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#fcd34d";
      }}
    >
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: "#fef3c7",
        border: "2px solid #fcd34d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
      }}>
        📍
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#92400e", margin: "0 0 6px" }}>
          Set your location to begin
        </p>
        <p style={{ fontSize: 14, color: "#b45309", margin: 0, maxWidth: 340 }}>
          Choose a <strong>Country</strong> and <strong>City</strong> in Settings
          to load local construction rates.
        </p>
      </div>
      <button
        type="button"
        style={{
          marginTop: 4,
          padding: "10px 28px",
          borderRadius: 10,
          border: "none",
          background: "#f59e0b",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "0 4px 12px #f59e0b44",
        }}
      >
        ⚙️ Open Settings
      </button>
    </div>
  );
}

// ── LockedActionButton ─────────────────────────────────────────
function LockedActionButton({
  label,
  locked,
  onUnlock,
  onClick,
  style: extraStyle,
}: {
  label: string;
  locked: boolean;
  onUnlock: () => void;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  if (locked) {
    return (
      <button
        type="button"
        onClick={onUnlock}
        title="Select a location first"
        style={{
          fontSize: 13,
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #fcd34d",
          background: "#fffbeb",
          cursor: "pointer",
          fontWeight: 600,
          color: "#b45309",
          display: "flex",
          alignItems: "center",
          gap: 5,
          ...extraStyle,
        }}
      >
        🔒 {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 13,
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: "pointer",
        fontWeight: 600,
        color: "#374151",
        transition: "all 0.15s",
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#d1d5db";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = (extraStyle?.background as string) || "#fff";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
      }}
    >
      {label}
    </button>
  );
}

// ── SelectField ────────────────────────────────────────────────
function SelectField({
  label,
  required,
  value,
  onChange,
  disabled,
  loading,
  children,
  placeholder,
  warning,
  minWidth = 160,
}: {
  label: string;
  required?: boolean;
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  placeholder: string;
  warning?: string;
  minWidth?: number;
}) {
  return (
    <div>
      <label style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        display: "block",
        marginBottom: 5,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}>
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          style={{
            fontSize: 13,
            padding: "7px 32px 7px 10px",
            borderRadius: 8,
            border: warning
              ? "2px solid #f59e0b"
              : "1px solid #e5e7eb",
            background: loading ? "#f9fafb" : "#fff",
            minWidth,
            opacity: loading ? 0.7 : 1,
            appearance: "none",
            cursor: disabled || loading ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            outline: "none",
            color: "#374151",
          }}
        >
          <option value="">{loading ? "Loading…" : placeholder}</option>
          {children}
        </select>
        <span style={{
          position: "absolute",
          right: 10,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
        }}>
          {loading
            ? <Spinner size={12} color="#9ca3af" />
            : <span style={{ color: "#9ca3af", fontSize: 10 }}>▼</span>
          }
        </span>
      </div>
      {warning && !loading && (
        <p style={{ fontSize: 10, color: "#b45309", margin: "4px 0 0" }}>{warning}</p>
      )}
    </div>
  );
}

// ── DimAreaInput ───────────────────────────────────────────────
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
    setAreaDraft(String(parseFloat(fmt(space.L * space.B, unit).replace(/,/g, ""))));
    setAreaError("");
  }, [space.L, space.B, unit]);

  function handleL(val: string) {
    if (val === "") { onUpdate({ ...space, L: 0 }); return; }
    const num = parseFloat(val);
    if (Number.isNaN(num)) return;
    onUpdate({ ...space, L: dimFromUnit(Math.max(0.01, num), unit) });
  }

  function handleB(val: string) {
    if (val === "") { onUpdate({ ...space, B: 0 }); return; }
    const num = parseFloat(val);
    if (Number.isNaN(num)) return;
    onUpdate({ ...space, B: dimFromUnit(Math.max(0.01, num), unit) });
  }

  function confirmArea() {
    const target = parseFloat(areaDraft);
    const current = space.L * space.B;
    if (!Number.isFinite(target) || target <= 0) { setAreaError("Area must be above 0"); return; }
    if (!Number.isFinite(current) || current <= 0) return;
    const targetSqft = unit === "sqm" ? target * 10.7639104167 : target;
    const scale = Math.sqrt(targetSqft / current);
    onUpdate({ ...space, L: Math.max(0.01, space.L * scale), B: Math.max(0.01, space.B * scale) });
    setAreaError("");
  }

  const inputStyle = (err?: boolean): React.CSSProperties => ({
    fontSize: 13,
    padding: "6px 9px",
    borderRadius: 7,
    border: err ? "1.5px solid #ef4444" : "1px solid #e5e7eb",
    outline: "none",
    background: "#fff",
    color: "#111827",
    transition: "border-color 0.15s",
  });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Length ({uLabel})
        </label>
        <input
          type="number" min={0.01}
          step={unit === "sqm" ? 0.1 : 0.5}
          value={space.L <= 0 ? "" : displayL}
          onChange={(e) => handleL(e.target.value)}
          style={{ ...inputStyle(), width: 85 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Breadth ({uLabel})
        </label>
        <input
          type="number" min={0.01}
          step={unit === "sqm" ? 0.1 : 0.5}
          value={space.B <= 0 ? "" : displayB}
          onChange={(e) => handleB(e.target.value)}
          style={{ ...inputStyle(), width: 85 }}
        />
      </div>
      <div>
        <label style={{ fontSize: 10, color: "#9ca3af", display: "block", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Area ({aLabel})
        </label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number" min={0.01}
            step={unit === "sqm" ? 0.1 : 1}
            value={areaDraft}
            onChange={(e) => { setAreaDraft(e.target.value); setAreaError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") confirmArea(); }}
            style={{ ...inputStyle(!!areaError), width: 108, fontFamily: "monospace" }}
          />
          <button
            type="button"
            onClick={confirmArea}
            style={{
              height: 31,
              minWidth: 34,
              borderRadius: 7,
              border: "1px solid #16a34a",
              background: "#dcfce7",
              color: "#166534",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            ✓
          </button>
        </div>
        {areaError && <p style={{ fontSize: 10, color: "#ef4444", margin: "3px 0 0" }}>{areaError}</p>}
      </div>
      <span style={{ fontSize: 10, color: "#d1d5db", paddingBottom: 6 }}>Press ✓ to apply</span>
    </div>
  );
}

// ── SubSpaceRow ────────────────────────────────────────────────
function SubSpaceRow({
  sub, onUpdate, onRemove, unit,
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
    if (!Number.isFinite(target) || target <= 0) { setAreaError("Area must be above 0"); return; }
    const current = sub.L * sub.B;
    if (!Number.isFinite(current) || current <= 0) return;
    const targetArea = unit === "sqm" ? target * 10.7639104167 : target;
    const scale = Math.sqrt(targetArea / current);
    onUpdate({ ...sub, L: Math.max(0.01, sub.L * scale), B: Math.max(0.01, sub.B * scale) });
    setAreaError("");
  }

  return (
    <div style={{
      marginLeft: 16,
      marginTop: 6,
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: "8px 12px",
    }}>
      <span style={{ fontSize: 12, color: "#9ca3af" }}>↳</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", minWidth: 100 }}>{sub.name}</span>
      <input
        type="number" min={0.01} step={unit === "sqm" ? 0.1 : 0.5}
        value={sub.L <= 0 ? "" : dL}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "") { onUpdate({ ...sub, L: 0 }); return; }
          const num = parseFloat(val);
          if (!Number.isNaN(num)) onUpdate({ ...sub, L: dimFromUnit(Math.max(0.01, num), unit) });
        }}
        placeholder={`L ${uLabel}`}
        style={{ width: 65, fontSize: 12, padding: "4px 7px", borderRadius: 6, border: "1px solid #e5e7eb" }}
      />
      <input
        type="number" min={0.01} step={unit === "sqm" ? 0.1 : 0.5}
        value={sub.B <= 0 ? "" : dB}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "") { onUpdate({ ...sub, B: 0 }); return; }
          const num = parseFloat(val);
          if (!Number.isNaN(num)) onUpdate({ ...sub, B: dimFromUnit(Math.max(0.01, num), unit) });
        }}
        placeholder={`B ${uLabel}`}
        style={{ width: 65, fontSize: 12, padding: "4px 7px", borderRadius: 6, border: "1px solid #e5e7eb" }}
      />
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="number" min={0.01} step={unit === "sqm" ? 0.1 : 1}
          value={areaDraft}
          onChange={(e) => { setAreaDraft(e.target.value); setAreaError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmArea(); }}
          style={{
            width: 84, fontSize: 12, padding: "4px 7px", borderRadius: 6,
            border: areaError ? "1px solid #ef4444" : "1px solid #e5e7eb",
            fontFamily: "monospace",
          }}
        />
        <span style={{ fontSize: 10, color: "#9ca3af" }}>{aLabel}</span>
        <button
          type="button"
          onClick={confirmArea}
          style={{
            fontSize: 12, color: "#166534", background: "#dcfce7",
            border: "1px solid #16a34a", cursor: "pointer", padding: "3px 8px",
            borderRadius: 5, fontWeight: 800,
          }}
        >
          ✓
        </button>
      </div>
      <input
        type="text"
        value={sub.description}
        onChange={(e) => onUpdate({ ...sub, description: e.target.value })}
        placeholder="Description…"
        style={{
          flex: 1, minWidth: 80, fontSize: 11, padding: "4px 7px",
          borderRadius: 6, border: "1px solid #e5e7eb", color: "#6b7280",
        }}
      />
      <button
        onClick={onRemove}
        style={{ fontSize: 13, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "3px 6px" }}
      >
        ✕
      </button>
      {areaError && <span style={{ fontSize: 10, color: "#ef4444" }}>{areaError}</span>}
    </div>
  );
}

// ── SpaceCard ──────────────────────────────────────────────────
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
      subSpaces: [...space.subSpaces, {
        instanceId: uid(), templateId: subT.id, name: subT.name,
        L: subT.L, B: subT.B, description: subT.description,
      }],
    });
    setAddSubOpen(false);
  }

  function addCustomSub() {
    if (!customSubName.trim()) return;
    onUpdate({
      ...space,
      subSpaces: [...space.subSpaces, {
        instanceId: uid(), templateId: "custom", name: customSubName.trim(),
        L: 8, B: 6, description: "",
      }],
    });
    setCustomSubName("");
    setAddingCustomSub(false);
    setAddSubOpen(false);
  }

  function updateSub(id: string, updated: SubSpaceInstance) {
    onUpdate({ ...space, subSpaces: space.subSpaces.map((s) => s.instanceId === id ? updated : s) });
  }
  function removeSub(id: string) {
    onUpdate({ ...space, subSpaces: space.subSpaces.filter((s) => s.instanceId !== id) });
  }

  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${meta.border}`,
      background: meta.bg,
      marginBottom: 8,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      transition: "box-shadow 0.15s",
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
      }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "#9ca3af", width: 18, flexShrink: 0,
            transition: "transform 0.15s",
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          ▾
        </button>
        <span style={{ fontSize: 20 }}>{space.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#111827", minWidth: 90 }}>
          {space.name}
        </span>
        {space.isCustom && (
          <span style={{
            fontSize: 9, padding: "2px 7px", borderRadius: 20,
            background: "#e5e7eb", color: "#6b7280", fontWeight: 700, textTransform: "uppercase",
          }}>
            Custom
          </span>
        )}
        <span style={{
          fontSize: 9, padding: "2px 7px", borderRadius: 20,
          background: meta.badgeBg, color: meta.badge, fontWeight: 700,
          textTransform: "uppercase", border: `1px solid ${meta.border}`,
        }}>
          {meta.label}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <select
            value={space.floor}
            onChange={(e) => onUpdate({ ...space, floor: parseInt(e.target.value) })}
            style={{
              fontSize: 12, padding: "4px 8px", borderRadius: 6,
              border: "1px solid #e5e7eb", background: "#fff", color: "#374151",
            }}
          >
            {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
          </select>

          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#fff", border: "1px solid #e5e7eb",
            borderRadius: 7, padding: "4px 10px",
          }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Main</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151" }}>
              {mainArea} {aLabel}
            </span>
          </div>

          {hasSubs && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#fff", border: `1.5px solid ${meta.border}`,
              borderRadius: 7, padding: "4px 10px",
            }}>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>Total</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: meta.color }}>
                {totalArea} {aLabel}
              </span>
            </div>
          )}

          <button
            onClick={onRemove}
            style={{
              fontSize: 15, background: "none", border: "none",
              cursor: "pointer", color: "#ef4444", padding: "3px 6px",
              borderRadius: 6, opacity: 0.6, transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.6")}
          >
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <DimAreaInput space={space} onUpdate={onUpdate} unit={unit} />
          <textarea
            value={space.description ?? ""}
            onChange={(e) => onUpdate({ ...space, description: e.target.value })}
            placeholder="Description…"
            rows={2}
            style={{
              width: "100%", marginTop: 10, fontSize: 12, padding: "7px 9px",
              borderRadius: 7, border: "1px solid #e5e7eb", color: "#374151",
              boxSizing: "border-box", resize: "vertical", fontFamily: "inherit",
              background: "#fff",
            }}
          />

          {space.subSpaces.map((sub) => (
            <SubSpaceRow
              key={sub.instanceId} sub={sub} unit={unit}
              onUpdate={(u) => updateSub(sub.instanceId, u)}
              onRemove={() => removeSub(sub.instanceId)}
            />
          ))}

          <div style={{ marginTop: 10, marginLeft: 16 }}>
            {addSubOpen ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {availableSubs
                  .filter((s) => !space.subSpaces.find((ss) => ss.templateId === s.id))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addSubFromTemplate(s.id)}
                      style={{
                        fontSize: 11, padding: "4px 10px", borderRadius: 20,
                        border: "1px solid #d1d5db", background: "#fff",
                        cursor: "pointer", color: "#374151",
                      }}
                    >
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
                      style={{
                        fontSize: 12, padding: "3px 8px", borderRadius: 6,
                        border: "1px solid #d1d5db", width: 140,
                      }}
                    />
                    <button
                      onClick={addCustomSub}
                      style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 6,
                        border: "none", background: "#16a34a", color: "#fff", cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setAddingCustomSub(false)}
                      style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 6,
                        border: "1px solid #d1d5db", background: "#fff", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCustomSub(true)}
                    style={{
                      fontSize: 11, padding: "4px 10px", borderRadius: 20,
                      border: "1px dashed #9ca3af", background: "#f9fafb",
                      cursor: "pointer", color: "#6b7280",
                    }}
                  >
                    + Custom sub-space
                  </button>
                )}
                <button
                  onClick={() => { setAddSubOpen(false); setAddingCustomSub(false); }}
                  style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddSubOpen(true)}
                style={{
                  fontSize: 11, color: "#9ca3af", background: "none", border: "none",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>⊕</span> Add sub-space
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CustomSpaceModal ───────────────────────────────────────────
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
    onAdd({
      instanceId: uid(), templateId: "custom", name: name.trim(),
      category, L, B, floor, icon, description: "", subSpaces: [], isCustom: true,
    });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 16, backdropFilter: "blur(2px)",
    }}>
      <div style={{
        background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto",
      }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
          ✏️ Custom Space
        </h3>

        {([
          { label: "Space Name *", content: (
            <input
              autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Server Room, Prayer Hall…"
              style={{
                width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8,
                border: "1px solid #e5e7eb", boxSizing: "border-box" as const,
              }}
            />
          )},
          { label: "Category", content: (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryKey)}
              style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            >
              {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )},
          { label: "Floor", content: (
            <select
              value={floor}
              onChange={(e) => setFloor(parseInt(e.target.value))}
              style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            >
              {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
            </select>
          )},
        ] as Array<{ label: string; content: React.ReactNode }>).map(({ label, content }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 5 }}>
              {label}
            </label>
            {content}
          </div>
        ))}

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {([
            { label: "Length (ft)", val: L, set: setL },
            { label: "Breadth (ft)", val: B, set: setB },
          ] as Array<{ label: string; val: number; set: (n: number) => void }>).map(({ label, val, set }) => (
            <div key={label} style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 5 }}>
                {label}
              </label>
              <input
                type="number" value={val} min={1} step={0.5}
                onChange={(e) => set(parseFloat(e.target.value) || 1)}
                style={{
                  width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8,
                  border: "1px solid #e5e7eb", boxSizing: "border-box" as const,
                }}
              />
            </div>
          ))}
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 8 }}>
          Icon
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {icons.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              style={{
                fontSize: 20, background: icon === ic ? "#fef3c7" : "#f9fafb",
                border: icon === ic ? "2px solid #f59e0b" : "1px solid #e5e7eb",
                borderRadius: 8, width: 40, height: 40, cursor: "pointer",
              }}
            >
              {ic}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            style={{
              flex: 1, padding: "11px", borderRadius: 9, border: "none",
              background: name.trim() ? "#1d4ed8" : "#e5e7eb",
              color: name.trim() ? "#fff" : "#9ca3af",
              fontWeight: 700, cursor: name.trim() ? "pointer" : "default", fontSize: 14,
              boxShadow: name.trim() ? "0 4px 12px #1d4ed844" : "none",
            }}
          >
            Add Space
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "11px 18px", borderRadius: 9, border: "1px solid #e5e7eb",
              background: "#fff", cursor: "pointer", fontSize: 14, color: "#374151",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PalettePanel ───────────────────────────────────────────────
function PalettePanel({
  filteredTemplates, activeCategory, setActiveCategory,
  searchQ, setSearchQ, addSpace, setShowCustomModal,
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
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
      <p style={{
        fontSize: 10, fontWeight: 800, color: "#6b7280", textTransform: "uppercase",
        letterSpacing: 1.2, margin: "0 0 10px",
      }}>
        Space Palette
      </p>
      <input
        type="text" placeholder="🔍  Search spaces…" value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        style={{
          width: "100%", fontSize: 12, padding: "7px 10px", borderRadius: 8,
          border: "1px solid #e5e7eb", background: "#f9fafb", marginBottom: 10,
          boxSizing: "border-box", outline: "none",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {[{ key: "all", label: "All", color: "#374151", bg: "#374151" }, ...Object.entries(CATEGORY_META).map(([k, v]) => ({ key: k, label: v.label.split(" ")[0], color: v.color, bg: v.color }))].map(({ key, label, bg }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
              border: "1px solid",
              borderColor: activeCategory === key ? bg : "#e5e7eb",
              background: activeCategory === key ? bg : "#fff",
              color: activeCategory === key ? "#fff" : "#6b7280",
              cursor: "pointer", textTransform: "uppercase",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {filteredTemplates.length === 0 && (
          <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 16 }}>No spaces found</p>
        )}
        {filteredTemplates.map((t) => (
          <button
            key={t.id}
            onClick={() => addSpace(t.id)}
            title={t.description}
            style={{
              display: "flex", alignItems: "center", gap: 9, width: "100%",
              padding: "8px 10px", borderRadius: 8, border: "1px solid #f3f4f6",
              background: "#f9fafb", marginBottom: 4, cursor: "pointer", textAlign: "left",
              transition: "all 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#f0f9ff";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#bae6fd";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#f3f4f6";
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12, fontWeight: 600, color: "#374151", margin: 0,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {t.name}
              </p>
              <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, fontFamily: "monospace" }}>
                {t.L}′ × {t.B}′ = {t.L * t.B} sqft
              </p>
            </div>
            <span style={{ fontSize: 16, color: "#d1d5db" }}>+</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowCustomModal(true)}
        style={{
          width: "100%", marginTop: 8, padding: "9px", borderRadius: 8,
          border: "1px dashed #d1d5db", background: "#f9fafb",
          cursor: "pointer", fontSize: 12, color: "#6b7280", fontWeight: 600,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb"; }}
      >
        ✏️ Add Custom Space
      </button>
    </div>
  );
}

// ── TotalAreaEditor ────────────────────────────────────────────
// Displays Total Area (Net + Wall + Circ = Gross) with an editable field.
// Pressing "Apply" scales all spaces proportionally.
function TotalAreaEditor({
  grossSqft,
  spaces,
  onScaleSpaces,
  unit,
}: {
  grossSqft: number;
  spaces: SpaceInstance[];
  onScaleSpaces: (scaledSpaces: SpaceInstance[]) => void;
  unit: UnitKey;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;

  // Draft holds the user-typed value in display units
  const grossInDisplayUnit = unit === "sqm" ? grossSqft / 10.7639104167 : grossSqft;
  const [draft, setDraft] = useState(String(Math.round(grossInDisplayUnit * 100) / 100));
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync draft when gross changes externally (spaces edited individually)
  useEffect(() => {
    if (!dirty) {
      setDraft(String(Math.round(grossInDisplayUnit * 100) / 100));
    }
  }, [grossInDisplayUnit, dirty]);

  function handleChange(val: string) {
    setDraft(val);
    setError("");
    setDirty(true);
  }

  function handleApply() {
    const targetDisplay = parseFloat(draft);
    if (!Number.isFinite(targetDisplay) || targetDisplay <= 0) {
      setError("Enter a valid area > 0");
      return;
    }
    if (grossInDisplayUnit <= 0 || spaces.length === 0) {
      setError("No spaces to scale");
      return;
    }
    const ratio = targetDisplay / grossInDisplayUnit;
    if (Math.abs(ratio - 1) < 0.0001) {
      setDirty(false);
      return; // nothing changed
    }
    // Scale each space: area scales by ratio, so L and B scale by sqrt(ratio)
    const linearScale = Math.sqrt(ratio);
    const scaled = spaces.map((s): SpaceInstance => ({
      ...s,
      L: Math.max(0.01, s.L * linearScale),
      B: Math.max(0.01, s.B * linearScale),
      subSpaces: s.subSpaces.map((sub): SubSpaceInstance => ({
        ...sub,
        L: Math.max(0.01, sub.L * linearScale),
        B: Math.max(0.01, sub.B * linearScale),
      })),
    }));
    onScaleSpaces(scaled);
    setDirty(false);
    setError("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleApply();
    if (e.key === "Escape") {
      setDraft(String(Math.round(grossInDisplayUnit * 100) / 100));
      setDirty(false);
      setError("");
    }
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      background: dirty ? "#fffbeb" : "#f9fafb",
      border: `1.5px solid ${dirty ? "#fcd34d" : "#e5e7eb"}`,
      borderRadius: 10,
      transition: "all 0.2s",
      flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <label style={{
          fontSize: 10, fontWeight: 800, color: "#6b7280",
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          Total Area (Gross)
        </label>
        <span style={{ fontSize: 9, color: "#9ca3af" }}>
          Net + Wall + Circulation — edit &amp; Apply to scale all spaces
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
        <input
          type="number"
          min={1}
          step={unit === "sqm" ? 1 : 10}
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            fontSize: 15,
            fontFamily: "monospace",
            fontWeight: 700,
            padding: "6px 10px",
            borderRadius: 8,
            border: error
              ? "1.5px solid #ef4444"
              : dirty
              ? "1.5px solid #f59e0b"
              : "1px solid #e5e7eb",
            background: "#fff",
            color: "#111827",
            width: 130,
            outline: "none",
            transition: "border-color 0.15s",
          }}
        />
        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{aLabel}</span>

        {dirty && (
          <>
            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "none",
                background: "#f59e0b",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 8px #f59e0b44",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#d97706")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f59e0b")}
            >
              ✓ Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(String(Math.round(grossInDisplayUnit * 100) / 100));
                setDirty(false);
                setError("");
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#6b7280",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ width: "100%", fontSize: 11, color: "#ef4444", margin: "2px 0 0", fontWeight: 600 }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

// ── SummaryCard ────────────────────────────────────────────────
function SummaryCard({
  totals, unit, wall, circ, costPerSqft, spaces, floorGroups, locationLabel, onScaleSpaces,
}: {
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  unit: UnitKey;
  wall: number;
  circ: number;
  costPerSqft: number;
  spaces: SpaceInstance[];
  floorGroups: Map<number, SpaceInstance[]>;
  locationLabel: string;
  onScaleSpaces: (scaled: SpaceInstance[]) => void;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;

  return (
    <div style={{
      borderRadius: 18, border: "1px solid #e5e7eb", background: "#fff",
      padding: 24, marginTop: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <h2 style={{
        fontSize: 11, fontWeight: 800, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 18px",
      }}>
        Area Summary
      </h2>

      {/* Total Area Editor */}
      <div style={{ marginBottom: 18 }}>
        <TotalAreaEditor
          grossSqft={totals.gross}
          spaces={spaces}
          onScaleSpaces={onScaleSpaces}
          unit={unit}
        />
      </div>

      {/* 4 area metrics */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 10, marginBottom: 18,
      }}>
        {[
          { label: "Net Carpet Area", val: fmt(totals.net, unit), sub: aLabel, color: "#111827", bg: "#f9fafb", border: "#e5e7eb" },
          { label: `Wall Thickness (${wall}%)`, val: `+${fmt(totals.wallA, unit)}`, sub: aLabel, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
          { label: `Circulation (${circ}%)`, val: `+${fmt(totals.circA, unit)}`, sub: aLabel, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
          { label: "Gross Built-up Area", val: fmt(totals.gross, unit), sub: aLabel, color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
        ].map((item) => (
          <div key={item.label} style={{
            borderRadius: 12, border: `1px solid ${item.border}`,
            background: item.bg, padding: "14px 16px",
          }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", margin: "0 0 6px", letterSpacing: 0.5,
            }}>
              {item.label}
            </p>
            <p style={{
              fontFamily: "monospace", fontWeight: 800, fontSize: 22,
              color: item.color, margin: "0 0 2px",
            }}>
              {item.val}
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Cost highlight */}
      <div style={{
        borderRadius: 14, background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
        border: "1px solid #a7f3d0", padding: 20,
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, marginBottom: 18,
      }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, color: "#059669", textTransform: "uppercase", margin: "0 0 4px", letterSpacing: 0.6 }}>
            Estimated Construction Cost
          </p>
          <p style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 32, color: "#047857", margin: 0, letterSpacing: -1 }}>
            {fmtCost(totals.cost)}
          </p>
          <p style={{ fontSize: 12, color: "#6ee7b7", margin: "4px 0 0" }}>
            @ ₹{costPerSqft.toLocaleString("en-IN")}/sqft × {fmt(totals.gross, "sqft")} sqft
          </p>
          <p style={{ fontSize: 11, color: "#059669", margin: "2px 0 0", opacity: 0.7 }}>
            {locationLabel || "No location selected"} · Finishing costs extra
          </p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Array.from(floorGroups.entries()).map(([floor, fs]) => {
            const fa = fs.reduce((a, s) => a + calcSpaceArea(s), 0);
            return (
              <div key={floor} style={{
                textAlign: "center", borderRadius: 10, border: "1px solid #a7f3d0",
                background: "#fff", padding: "8px 14px",
              }}>
                <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, margin: "0 0 2px" }}>
                  {getFloorLabel(floor)}
                </p>
                <p style={{
                  fontFamily: "monospace", fontWeight: 700, fontSize: 14,
                  color: "#374151", margin: 0,
                }}>
                  {fmt(fa, unit)} {aLabel}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <p style={{
          fontSize: 10, fontWeight: 800, color: "#9ca3af",
          textTransform: "uppercase", margin: "0 0 10px", letterSpacing: 0.6,
        }}>
          Breakdown by Type
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const catSpaces = spaces.filter((s) => s.category === cat);
            if (!catSpaces.length) return null;
            const catArea = catSpaces.reduce((a, s) => a + calcSpaceArea(s), 0);
            const pct = totals.net > 0 ? Math.round((catArea / totals.net) * 100) : 0;
            return (
              <div key={cat} style={{
                borderRadius: 10, border: `1px solid ${meta.border}`,
                background: meta.bg, padding: "10px 14px",
              }}>
                <p style={{
                  fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                  color: meta.badge, margin: "0 0 4px", letterSpacing: 0.5,
                }}>
                  {meta.label}
                </p>
                <p style={{
                  fontFamily: "monospace", fontWeight: 700, fontSize: 15,
                  color: "#374151", margin: 0,
                }}>
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

// ── ImportBanner ───────────────────────────────────────────────
function ImportBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
      borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac",
      marginBottom: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 18 }}>📂</span>
      <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>
        Project imported from CSV — review spaces below, then save or export as needed.
      </span>
      <button
        onClick={onDismiss}
        style={{
          marginLeft: "auto", fontSize: 11, color: "#166534",
          background: "none", border: "none", cursor: "pointer",
        }}
      >
        Dismiss ✕
      </button>
    </div>
  );
}

// ── FinishLevelPicker ──────────────────────────────────────────
function FinishLevelPicker({
  value,
  onChange,
  dataMap,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  dataMap: Record<string, boolean | null>;
  loading: boolean;
}) {
  const levels = FINISH_LEVELS.filter((fl) => fl.value !== "unknown");

  return (
    <div>
      <label style={{
        fontSize: 11, fontWeight: 700, color: "#6b7280",
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        Finish Level <span style={{ color: "#ef4444" }}>*</span>
        {loading && <Spinner size={11} color="#9ca3af" />}
        {!loading && Object.keys(dataMap).length > 0 && (
          <span style={{ fontSize: 9, fontWeight: 400, color: "#9ca3af", textTransform: "none" }}>
            — {Object.values(dataMap).filter(Boolean).length} with local data
          </span>
        )}
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {/* "Any" pill */}
        <button
          type="button"
          onClick={() => onChange("unknown")}
          style={{
            padding: "6px 14px",
            borderRadius: 20,
            border: value === "unknown" ? "2px solid #374151" : "1px solid #e5e7eb",
            background: value === "unknown" ? "#374151" : "#f9fafb",
            color: value === "unknown" ? "#fff" : "#9ca3af",
            fontWeight: value === "unknown" ? 700 : 400,
            fontSize: 12, cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          Any
        </button>

        {levels.map((fl) => {
          const hasData  = dataMap[fl.value] === true;
          const noData   = dataMap[fl.value] === false;
          const checking = dataMap[fl.value] == null && loading;
          const isSelected = value === fl.value;

          let borderColor = "#e5e7eb";
          let bgColor = "#f9fafb";
          let textColor = "#d1d5db";
          let fw: number = 400;
          let opacity = 1;

          if (isSelected) {
            borderColor = "#f59e0b"; bgColor = "#fffbeb"; textColor = "#92400e"; fw = 700;
          } else if (hasData) {
            borderColor = "#a7f3d0"; bgColor = "#f0fdf4"; textColor = "#166534"; fw = 600;
          } else if (noData) {
            opacity = 0.4;
          }

          return (
            <button
              key={fl.value}
              type="button"
              onClick={() => onChange(isSelected ? "unknown" : fl.value)}
              title={noData ? "No local survey data for this finish level" : hasData ? "Local survey data available" : ""}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: isSelected ? `2px solid ${borderColor}` : `1px solid ${borderColor}`,
                background: bgColor,
                color: textColor,
                fontWeight: fw,
                fontSize: 12,
                cursor: "pointer",
                opacity,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s",
              }}
            >
              {!isSelected && hasData && (
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#16a34a", flexShrink: 0,
                }} />
              )}
              {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
              {checking && <Spinner size={10} color="#9ca3af" />}
              {(fl as { icon?: string }).icon && !checking && (
                <span style={{ fontSize: 12 }}>{(fl as { icon?: string }).icon}</span>
              )}
              {fl.label}
            </button>
          );
        })}
      </div>

      {!loading && Object.keys(dataMap).length > 0 && (
        <p style={{ fontSize: 10, color: "#9ca3af", margin: "6px 0 0" }}>
          {Object.values(dataMap).filter(Boolean).length === 0
            ? "No finish-level breakdown available yet — using all survey data"
            : "Green = local data · Faded = no data at this location"}
        </p>
      )}
      {value === "unknown" && (
        <p style={{ fontSize: 10, color: "#b45309", margin: "4px 0 0" }}>
          Select a finish level for a more accurate rate estimate
        </p>
      )}
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────
export default function App() {
  const [spaces, setSpaces]   = useState<SpaceInstance[]>([]);
  const [unit, setUnit]       = useState<UnitKey>("sqft");
  const [wall, setWall]       = useState(10);
  const [circ, setCirc]       = useState(15);

  // Geography
  const [countries, setCountries]     = useState<ApiCountry[]>([]);
  const [statesList, setStatesList]   = useState<ApiState[]>([]);
  const [placesList, setPlacesList]   = useState<{ id: number; name: string }[]>([]);
  const [countryId, setCountryId]     = useState<number | null>(null);
  const [stateId, setStateId]         = useState<number | null>(null);
  const [placeId, setPlaceId]         = useState<number | null>(null);

  // Finish level
  const [finishLevel, setFinishLevel] = useState<string>("unknown");
  const [finishLevelData, setFinishLevelData] = useState<Record<string, boolean | null>>({});
  const [loadingFinishLevels, setLoadingFinishLevels] = useState(false);

  // Templates
  const [spaceTemplates, setSpaceTemplates]     = useState<SpaceTemplate[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Rate
  const [apiRate, setApiRate]                 = useState<number | null>(null);
  const [rateStatus, setRateStatus]           = useState<ApiRateStatus | null>(null);
  const [countryAvgRate, setCountryAvgRate]   = useState<number | null>(null);
  const [loadingCountryRate, setLoadingCountryRate] = useState(false);
  const [customRate, setCustomRate]           = useState<number | null>(null);

  // Geography loading states
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  // UI
  const [activeCategory, setActiveCategory]     = useState("all");
  const [searchQ, setSearchQ]                   = useState("");
  const [activeFloor, setActiveFloor]           = useState<number | "all">("all");
  const [projectName, setProjectName]           = useState("Untitled Project");
  const [clientName, setClientName]             = useState("");
  const [settingsOpen, setSettingsOpen]         = useState(false);
  const [paletteOpen, setPaletteOpen]           = useState(false);
  const [showCustomModal, setShowCustomModal]   = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showImportBanner, setShowImportBanner] = useState(false);

  // Custom templates / role
  const [myRole, setMyRole]               = useState<ApiMyRole | null>(null);
  const [customTemplates, setCustomTemplates] = useState<ApiCustomProjectTemplate[]>([]);
  const [savingTemplate, setSavingTemplate]   = useState(false);
  const [templateSaveMsg, setTemplateSaveMsg] = useState("");
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<number | null>(null);

  // ── Location completeness ──────────────────────────────────
  const locationReady = countryId !== null && placeId !== null;

  const openSettingsForLocation = useCallback(() => {
    setSettingsOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const rateCategory = spaces[0]?.category ?? "residence";
  const costPerSqft  = customRate ?? apiRate ?? countryAvgRate ?? 2000;
  const aLabel       = UNIT_SYSTEMS[unit].areaLabel;

  const selectedCountry = countries.find((c) => c.id === countryId);
  const selectedState   = statesList.find((s) => s.id === stateId);
  const selectedPlace   = placesList.find((p) => p.id === placeId);
  const locationLabel   = [selectedCountry?.name, selectedState?.name, selectedPlace?.name].filter(Boolean).join(" · ");

  // ── Mount: countries + templates + role ───────────────────
  useEffect(() => {
    fetchCountries()
      .then((data) => {
        setCountries(data);
        const india = data.find((c) => c.name.toLowerCase() === "india" || c.code.toUpperCase() === "IN");
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
  }, []);

  // ── States when country changes ───────────────────────────
  useEffect(() => {
    if (countryId == null) {
      setStatesList([]); setStateId(null); setCountryAvgRate(null); return;
    }
    setLoadingStates(true);
    fetchStates(countryId)
      .then((data) => { setStatesList(data); setStateId(null); setPlaceId(null); })
      .catch(console.error)
      .finally(() => setLoadingStates(false));

    setLoadingCountryRate(true);
    fetchAreaRate({ countryId, category: rateCategory, finishLevel })
      .then(setCountryAvgRate)
      .catch(() => setCountryAvgRate(null))
      .finally(() => setLoadingCountryRate(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  // ── Country average when finish level changes (no place) ──
  useEffect(() => {
    if (countryId == null || placeId != null) return;
    fetchAreaRate({ countryId, stateId: stateId ?? undefined, category: rateCategory, finishLevel })
      .then(setCountryAvgRate)
      .catch(() => setCountryAvgRate(null));
  }, [finishLevel, countryId, stateId, placeId, rateCategory]);

  // ── Places when state changes ─────────────────────────────
  useEffect(() => {
    if (stateId == null) { setPlacesList([]); setPlaceId(null); return; }
    setLoadingPlaces(true);
    fetchPlaces(stateId)
      .then((data) => { setPlacesList(data); setPlaceId(null); })
      .catch(console.error)
      .finally(() => setLoadingPlaces(false));
  }, [stateId]);

  // ── Rate when place / category / finish level changes ─────
  useEffect(() => {
    if (placeId == null) { setApiRate(null); setRateStatus(null); return; }
    setCustomRate(null);
    fetchRateLookup(placeId, rateCategory, finishLevel !== "unknown" ? finishLevel : undefined)
      .then((data) => { setApiRate(data.effective_rate); setRateStatus(data.rate_status); })
      .catch(console.error);
  }, [placeId, rateCategory, finishLevel]);

  // ── Finish level data availability ────────────────────────
  useEffect(() => {
    if (!countryId) { setFinishLevelData({}); return; }
    setLoadingFinishLevels(true);
    const levels = ["basic", "standard", "premium", "luxury"];
    Promise.all(
      levels.map(async (fl) => {
        const rate = await fetchAreaRate({
          countryId,
          stateId: stateId ?? undefined,
          placeId: placeId ?? undefined,
          finishLevel: fl,
        });
        return [fl, rate !== null] as [string, boolean];
      }),
    )
      .then((results) => setFinishLevelData(Object.fromEntries(results)))
      .catch(() => setFinishLevelData({}))
      .finally(() => setLoadingFinishLevels(false));
  }, [countryId, stateId, placeId]);

  // ── Derived ────────────────────────────────────────────────
  const filteredTemplates = useMemo(
    () => spaceTemplates.filter((t) => {
      const catOk = activeCategory === "all" || t.category === activeCategory;
      const qOk   = !searchQ.trim() || t.name.toLowerCase().includes(searchQ.toLowerCase());
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

  const addCustomSpace = useCallback((space: SpaceInstance) => setSpaces((prev) => [...prev, space]), []);
  const updateSpace    = useCallback((id: string, updated: SpaceInstance) => setSpaces((prev) => prev.map((s) => s.instanceId === id ? updated : s)), []);
  const removeSpace    = useCallback((id: string) => setSpaces((prev) => prev.filter((s) => s.instanceId !== id)), []);

  // ── Scale all spaces (used by TotalAreaEditor) ─────────────
  const scaleAllSpaces = useCallback((scaled: SpaceInstance[]) => {
    setSpaces(scaled);
  }, []);

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

  function loadCustomTemplate(tpl: ApiCustomProjectTemplate) {
    const data = tpl.data as {
      projectName?: string; clientName?: string; unit?: UnitKey;
      wall?: number; circ?: number; spaces?: SpaceInstance[];
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

  const handleCsvImport = useCallback((payload: ImportPayload) => {
    setProjectName(payload.projectName);
    setClientName(payload.clientName);
    setUnit(payload.unit);
    setWall(payload.wall);
    setCirc(payload.circ);
    setSpaces(payload.spaces);
    setActiveCustomTemplateId(null);
    setShowImportBanner(true);
    setTemplateSaveMsg("");
  }, []);

  async function handleSaveTemplate() {
    if (!myRole?.can_save_custom_templates) { setTemplateSaveMsg("Only paid customers can save."); return; }
    if (spaces.length === 0) { setTemplateSaveMsg("Add at least one space first."); return; }
    try {
      setSavingTemplate(true); setTemplateSaveMsg("");
      const payload = {
        label: projectName || "Untitled", description: "User saved custom area template",
        icon: "🏠", data: { projectName, clientName, unit, wall, circ, spaces },
        source_project_template: null as number | null,
      };
      if (activeCustomTemplateId !== null) {
        const updated = await updateCustomProjectTemplate(activeCustomTemplateId, payload);
        setCustomTemplates((prev) => prev.map((t) => t.id === activeCustomTemplateId ? updated : t));
        setTemplateSaveMsg("✓ Template updated.");
      } else {
        const saved = await saveCustomProjectTemplate(payload);
        setCustomTemplates((prev) => [saved, ...prev]);
        setActiveCustomTemplateId(saved.id);
        setTemplateSaveMsg("✓ Template saved.");
      }
      setShowImportBanner(false);
    } catch (err) {
      console.error(err);
      setTemplateSaveMsg("Could not save. Check login and role.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleSaveAsTemplate() {
    if (!myRole?.can_save_custom_templates || spaces.length === 0) return;
    try {
      setSavingTemplate(true); setTemplateSaveMsg("");
      const saved = await saveCustomProjectTemplate({
        label: `${projectName || "Untitled"} (copy)`, description: "User saved custom area template",
        icon: "🏠", data: { projectName, clientName, unit, wall, circ, spaces },
        source_project_template: null,
      });
      setCustomTemplates((prev) => [saved, ...prev]);
      setActiveCustomTemplateId(saved.id);
      setTemplateSaveMsg("✓ Saved as new template.");
    } catch (err) {
      console.error(err);
      setTemplateSaveMsg("Could not save.");
    } finally {
      setSavingTemplate(false);
    }
  }

  const totals      = useMemo(() => calcGrossArea(spaces, wall, circ, costPerSqft), [spaces, wall, circ, costPerSqft]);
  const floorGroups = useMemo(() => groupByFloor(spaces), [spaces]);
  const usedFloors  = useMemo(() => Array.from(floorGroups.keys()).sort((a, b) => a - b), [floorGroups]);
  const visibleSpaces = useMemo(
    () => activeFloor === "all" ? spaces : spaces.filter((s) => s.floor === activeFloor),
    [spaces, activeFloor],
  );

  return (
    <>
      {/* Global spin keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f5f4f1", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "#fff", borderBottom: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            maxWidth: 1400, margin: "0 auto", padding: "10px 20px",
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12,
          }}>
            {/* Logo + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, boxShadow: "0 2px 8px #f59e0b44",
              }}>
                📐
              </div>
              <div>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{
                    fontSize: 15, fontWeight: 700, color: "#111827",
                    background: "transparent", border: "none",
                    borderBottom: "2px solid transparent", outline: "none", maxWidth: 220,
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderBottomColor = "#f59e0b")}
                  onBlur={(e)  => (e.target.style.borderBottomColor = "transparent")}
                />
                <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Area Calculator
                </p>
              </div>
            </div>

            {/* Client name */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", display: "block", marginBottom: 2, letterSpacing: 0.5 }}>
                Client
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Optional"
                style={{
                  fontSize: 13, padding: "5px 9px", borderRadius: 7,
                  border: "1px solid #e5e7eb", background: "#f9fafb",
                  color: "#374151", width: 160, outline: "none",
                }}
              />
            </div>

            {/* Location pill */}
            <div
              onClick={openSettingsForLocation}
              title={locationReady ? locationLabel : "Click to set location"}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 20, cursor: "pointer",
                background: locationReady ? "#ecfdf5" : "#fffbeb",
                border: `1.5px solid ${locationReady ? "#a7f3d0" : "#fcd34d"}`,
                fontSize: 12, fontWeight: 600,
                color: locationReady ? "#047857" : "#b45309",
                transition: "all 0.15s",
              }}
            >
              <span>{locationReady ? "📍" : "⚠️"}</span>
              <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {locationReady ? locationLabel : countryId ? "Select a city →" : "Set location"}
              </span>
            </div>

            {/* Right side */}
            <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
              {/* Gross + Cost summary pills */}
              <div style={{
                display: "flex", gap: 10, background: "#f9fafb",
                border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 14px",
              }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: 0, letterSpacing: 0.5 }}>Gross</p>
                  <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#d97706", margin: 0, fontSize: 14 }}>
                    {fmt(totals.gross, unit)} {aLabel}
                  </p>
                </div>
                <div style={{ width: 1, background: "#e5e7eb" }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: 0, letterSpacing: 0.5 }}>Est. Cost</p>
                  <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#059669", margin: 0, fontSize: 14 }}>
                    {fmtCost(totals.cost)}
                  </p>
                </div>
              </div>

              {/* Unit toggle */}
              <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 3 }}>
                {Object.entries(UNIT_SYSTEMS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setUnit(k as UnitKey)}
                    style={{
                      fontSize: 11, padding: "4px 11px", borderRadius: 6, border: "none",
                      background: unit === k ? "#fff" : "transparent",
                      fontWeight: unit === k ? 700 : 500, cursor: "pointer",
                      color: unit === k ? "#111827" : "#9ca3af",
                      boxShadow: unit === k ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {v.areaLabel}
                  </button>
                ))}
              </div>

              {/* Settings button */}
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                style={{
                  fontSize: 13, padding: "7px 14px", borderRadius: 8,
                  border: `1.5px solid ${!locationReady ? "#fcd34d" : settingsOpen ? "#fde68a" : "#e5e7eb"}`,
                  background: settingsOpen ? "#fef3c7" : !locationReady ? "#fffbeb" : "#fff",
                  cursor: "pointer", color: "#374151", fontWeight: !locationReady ? 700 : 500,
                  transition: "all 0.15s",
                }}
              >
                ⚙️ Settings{!locationReady ? " ●" : ""}
              </button>
            </div>
          </div>

          {/* ── Settings Panel ──────────────────────────────── */}
          {settingsOpen && (
            <div style={{ background: "#fffbeb", borderTop: "1px solid #fde68a", padding: "18px 20px" }}>
              <div style={{
                maxWidth: 1400, margin: "0 auto",
                display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start",
              }}>
                {/* Country */}
                <SelectField
                  label="Country" required
                  value={countryId ?? ""}
                  onChange={(v) => setCountryId(v ? Number(v) : null)}
                  placeholder="— Select country —"
                  warning={!countryId ? "Required to begin" : undefined}
                  minWidth={150}
                >
                  {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectField>

                {/* State */}
                <SelectField
                  label="State / Province"
                  value={stateId ?? ""}
                  onChange={(v) => setStateId(v ? Number(v) : null)}
                  disabled={!countryId || statesList.length === 0}
                  loading={loadingStates}
                  placeholder="— Select —"
                  minWidth={170}
                >
                  {statesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectField>

                {/* Place */}
                <SelectField
                  label="City / Place" required
                  value={placeId ?? ""}
                  onChange={(v) => setPlaceId(v ? Number(v) : null)}
                  disabled={!stateId || placesList.length === 0}
                  loading={loadingPlaces}
                  placeholder="— Select city —"
                  warning={stateId && !placeId && !loadingPlaces ? "Required to unlock calculator" : undefined}
                  minWidth={190}
                >
                  {placesList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </SelectField>

                {/* Finish level picker */}
                <FinishLevelPicker
                  value={finishLevel}
                  onChange={setFinishLevel}
                  dataMap={finishLevelData}
                  loading={loadingFinishLevels}
                />

                {/* Rate override */}
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: "#6b7280",
                    display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                    Rate (₹/sqft){" "}
                    <span style={{ fontWeight: 400, color: "#9ca3af", textTransform: "none" }}>— override</span>
                  </label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="number" min={500} step={100}
                      value={customRate ?? costPerSqft}
                      onChange={(e) => setCustomRate(parseInt(e.target.value) || null)}
                      style={{
                        fontSize: 13, padding: "7px 10px", borderRadius: 8,
                        border: "1px solid #e5e7eb", width: 110, outline: "none",
                      }}
                    />
                    {customRate && (
                      <button
                        onClick={() => setCustomRate(null)}
                        style={{
                          fontSize: 11, color: "#ef4444", background: "#fff",
                          border: "1px solid #fca5a5", cursor: "pointer",
                          padding: "5px 10px", borderRadius: 6,
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Wall */}
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: "#6b7280",
                    display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                    Wall Area (%)
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number" min={0} max={50} step={1} value={wall}
                      onChange={(e) => setWall(Math.max(0, parseFloat(e.target.value) || 0))}
                      style={{ fontSize: 13, padding: "7px 8px", borderRadius: 8, border: "1px solid #e5e7eb", width: 62, outline: "none" }}
                    />
                    <input
                      type="range" min={0} max={50} step={1} value={wall}
                      onChange={(e) => setWall(parseInt(e.target.value))}
                      style={{ width: 90, accentColor: "#f59e0b" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", minWidth: 28 }}>{wall}%</span>
                  </div>
                </div>

                {/* Circulation */}
                <div>
                  <label style={{
                    fontSize: 11, fontWeight: 700, color: "#6b7280",
                    display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5,
                  }}>
                    Circulation (%)
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number" min={0} max={100} step={1} value={circ}
                      onChange={(e) => setCirc(Math.max(0, parseFloat(e.target.value) || 0))}
                      style={{ fontSize: 13, padding: "7px 8px", borderRadius: 8, border: "1px solid #e5e7eb", width: 62, outline: "none" }}
                    />
                    <input
                      type="range" min={0} max={50} step={1} value={circ}
                      onChange={(e) => setCirc(parseInt(e.target.value))}
                      style={{ width: 90, accentColor: "#f59e0b" }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", minWidth: 28 }}>{circ}%</span>
                  </div>
                </div>

                {/* Rate summary */}
                <div style={{
                  borderLeft: "3px solid #fcd34d", paddingLeft: 16, alignSelf: "center",
                  minWidth: 180,
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <strong style={{ fontSize: 20, fontFamily: "monospace", color: "#92400e" }}>
                      ₹{costPerSqft.toLocaleString("en-IN")}
                    </strong>
                    <span style={{ fontSize: 11, color: "#b45309" }}>/sqft</span>
                    {customRate && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
                        background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d",
                      }}>
                        Custom
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "#b45309", margin: "0 0 6px" }}>
                    {locationLabel || (countryId ? "Choose city for local rate" : "No location selected")}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {rateStatus && placeId && <RateStatusBadge source={rateStatus.source} />}
                    {!placeId && countryId && !loadingCountryRate && countryAvgRate && (
                      <RateStatusBadge source="country_average" />
                    )}
                    {loadingCountryRate && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#9ca3af" }}>
                        <Spinner size={10} /> Calculating average…
                      </div>
                    )}
                    {!placeId && countryId && !loadingCountryRate && countryAvgRate && (
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>
                        Using country average until city is selected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* ── MAIN CONTENT ───────────────────────────────────── */}
        <div style={{
          maxWidth: 1400, margin: "0 auto", padding: "18px 20px",
          display: "flex", gap: 18, alignItems: "flex-start",
        }}>
          <main style={{ flex: 1, minWidth: 0 }}>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <LockedActionButton
                label={`📦 Add Space${loadingTemplates ? " (loading…)" : ""}`}
                locked={!locationReady}
                onUnlock={openSettingsForLocation}
                onClick={() => setPaletteOpen(true)}
              />
              <LockedActionButton
                label="🏗️ Templates"
                locked={!locationReady}
                onUnlock={openSettingsForLocation}
                onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                style={{ background: showTemplatePanel ? "#fef3c7" : "#fff" }}
              />
              <LockedActionButton
                label="✏️ Custom Space"
                locked={!locationReady}
                onUnlock={openSettingsForLocation}
                onClick={() => setShowCustomModal(true)}
              />

              {/* Save */}
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || spaces.length === 0}
                title={myRole?.can_save_custom_templates
                  ? activeCustomTemplateId ? "Update template" : "Save as new template"
                  : "Only paid customers can save templates"}
                style={{
                  fontSize: 13, padding: "8px 14px", borderRadius: 8,
                  border: `1px solid ${myRole?.can_save_custom_templates ? "#16a34a" : "#e5e7eb"}`,
                  background: myRole?.can_save_custom_templates ? "#dcfce7" : "#f9fafb",
                  cursor: myRole?.can_save_custom_templates && spaces.length > 0 ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  color: myRole?.can_save_custom_templates ? "#166534" : "#9ca3af",
                }}
              >
                💾 {savingTemplate ? "Saving…" : activeCustomTemplateId ? "Save" : "Save Template"}
              </button>

              {(activeCustomTemplateId !== null || showImportBanner) && myRole?.can_save_custom_templates && (
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={savingTemplate || spaces.length === 0}
                  style={{
                    fontSize: 13, padding: "8px 14px", borderRadius: 8,
                    border: "1px solid #6366f1", background: "#eef2ff",
                    cursor: spaces.length > 0 ? "pointer" : "not-allowed",
                    fontWeight: 600, color: "#4338ca",
                  }}
                >
                  📋 Save As
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

              <SpaceRequirementPdfButton
                projectName={projectName}
                clientName={clientName}
                spaces={spaces}
                unit={unit}
                wall={wall}
                circ={circ}
                costPerSqft={costPerSqft}
                totals={totals}
                floorGroups={floorGroups}
                locationLabel={locationLabel}
                disabled={spaces.length === 0}
              />
              <SpaceRequirementCsvButton
                projectName={projectName}
                clientName={clientName}
                spaces={spaces}
                unit={unit}
                wall={wall}
                circ={circ}
                totals={totals}
                locationLabel={locationLabel}
                disabled={spaces.length === 0}
                onImport={handleCsvImport}
              />
            </div>

            {/* Import banner */}
            {showImportBanner && <ImportBanner onDismiss={() => setShowImportBanner(false)} />}

            {/* Templates strip */}
            {showTemplatePanel && locationReady && (
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18,
                padding: 18, background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
              }}>
                <p style={{
                  width: "100%", margin: "0 0 4px", fontSize: 11, fontWeight: 800,
                  color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8,
                }}>
                  Project Templates — click to load
                </p>
                {loadingTemplates ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 13 }}>
                    <Spinner /> Loading templates…
                  </div>
                ) : projectTemplates.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>No project templates found.</p>
                ) : (
                  projectTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => loadTemplate(tpl)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start",
                        gap: 4, padding: "14px 18px", borderRadius: 12,
                        border: "1.5px solid #e5e7eb", background: "#f9fafb",
                        cursor: "pointer", minWidth: 180, textAlign: "left",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#f0f9ff";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#bae6fd";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{tpl.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{tpl.label}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{tpl.description}</span>
                    </button>
                  ))
                )}

                {customTemplates.length > 0 && (
                  <>
                    <p style={{
                      width: "100%", margin: "12px 0 4px", fontSize: 11, fontWeight: 800,
                      color: "#166534", textTransform: "uppercase", letterSpacing: 0.8,
                    }}>
                      My Saved Templates
                    </p>
                    {customTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => loadCustomTemplate(tpl)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "flex-start",
                          gap: 4, padding: "14px 18px", borderRadius: 12,
                          border: tpl.id === activeCustomTemplateId ? "2px solid #16a34a" : "1.5px solid #bbf7d0",
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
            {locationReady && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
                <button
                  onClick={() => setActiveFloor("all")}
                  style={{
                    flexShrink: 0, padding: "6px 14px", borderRadius: 8,
                    border: "none",
                    background: activeFloor === "all" ? "#374151" : "#fff",
                    color: activeFloor === "all" ? "#fff" : "#6b7280",
                    fontWeight: 700, fontSize: 12, cursor: "pointer",
                    boxShadow: activeFloor === "all" ? "0 2px 6px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
                    transition: "all 0.15s",
                  }}
                >
                  All
                </button>
                {usedFloors.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFloor(f)}
                    style={{
                      flexShrink: 0, padding: "6px 14px", borderRadius: 8, border: "none",
                      background: activeFloor === f ? "#f59e0b" : "#fff",
                      color: activeFloor === f ? "#fff" : "#6b7280",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                      boxShadow: activeFloor === f ? "0 2px 8px #f59e0b44" : "0 1px 3px rgba(0,0,0,0.06)",
                      transition: "all 0.15s",
                    }}
                  >
                    {getFloorLabel(f)}{" "}
                    <span style={{ opacity: 0.7 }}>({floorGroups.get(f)?.length ?? 0})</span>
                  </button>
                ))}
                {FLOORS.filter((f) => !usedFloors.includes(f)).map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFloor(f)}
                    style={{
                      flexShrink: 0, padding: "6px 14px", borderRadius: 8,
                      border: "1px dashed #d1d5db", background: "transparent",
                      color: "#d1d5db", fontSize: 12, cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d1d5db"; }}
                  >
                    + {getFloorLabel(f)}
                  </button>
                ))}
              </div>
            )}

            {/* Main area */}
            {!locationReady ? (
              <LocationGate onOpen={openSettingsForLocation} />
            ) : visibleSpaces.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", borderRadius: 18, border: "2px dashed #e5e7eb",
                background: "#fff", padding: "64px 24px", textAlign: "center",
              }}>
                <span style={{ fontSize: 52, marginBottom: 14 }}>🏗️</span>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#9ca3af", margin: "0 0 6px" }}>
                  No spaces yet
                </p>
                <p style={{ fontSize: 13, color: "#d1d5db", margin: 0 }}>
                  Use  `&quot;Add Space `&quot;,  `&quot;Templates `&quot;,  `&quot;Custom Space `&quot; or  `&quot;Import CSV `&quot; above
                </p>
              </div>
            ) : activeFloor === "all" ? (
              Array.from(floorGroups.entries()).map(([floor, fs]) => (
                <div key={floor} style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: "#6b7280",
                      textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap",
                    }}>
                      {getFloorLabel(floor)}
                    </span>
                    <div style={{ flex: 1, borderTop: "1px solid #e5e7eb" }} />
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#9ca3af", whiteSpace: "nowrap" }}>
                      {fmt(fs.reduce((a, s) => a + calcSpaceArea(s), 0), unit)} {aLabel}
                    </span>
                  </div>
                  {fs.map((s) => (
                    <SpaceCard
                      key={s.instanceId} space={s} unit={unit}
                      spaceTemplates={spaceTemplates}
                      onUpdate={(u) => updateSpace(s.instanceId, u)}
                      onRemove={() => removeSpace(s.instanceId)}
                    />
                  ))}
                </div>
              ))
            ) : (
              visibleSpaces.map((s) => (
                <SpaceCard
                  key={s.instanceId} space={s} unit={unit}
                  spaceTemplates={spaceTemplates}
                  onUpdate={(u) => updateSpace(s.instanceId, u)}
                  onRemove={() => removeSpace(s.instanceId)}
                />
              ))
            )}

            {spaces.length > 0 && locationReady && (
              <SummaryCard
                totals={totals} unit={unit} wall={wall} circ={circ}
                costPerSqft={costPerSqft} spaces={spaces}
                floorGroups={floorGroups} locationLabel={locationLabel}
                onScaleSpaces={scaleAllSpaces}
              />
            )}
          </main>
        </div>

        {/* Mobile palette drawer */}
        {paletteOpen && locationReady && (
          <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex" }}>
            <div
              style={{ flex: 1, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
              onClick={() => setPaletteOpen(false)}
            />
            <div style={{ width: 320, background: "#fff", height: "100%", overflowY: "auto", padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>Space Palette</span>
                <button
                  onClick={() => setPaletteOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}
                >
                  ✕
                </button>
              </div>
              <PalettePanel
                filteredTemplates={filteredTemplates}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                searchQ={searchQ}
                setSearchQ={setSearchQ}
                addSpace={(id) => { addSpace(id); setPaletteOpen(false); }}
                setShowCustomModal={() => { setShowCustomModal(true); setPaletteOpen(false); }}
              />
            </div>
          </div>
        )}

        {showCustomModal && locationReady && (
          <CustomSpaceModal
            onAdd={addCustomSpace}
            onClose={() => setShowCustomModal(false)}
          />
        )}
      </div>
    </>
  );
}
