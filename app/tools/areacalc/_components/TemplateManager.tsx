"use client";

import { useState } from "react";
import { getFloorLabel, type SpaceTemplate, type SpaceInstance, type ProjectTemplate } from "../areadata";
import {
  saveGeneralProjectTemplate,
  type ApiMyRole, type ApiCustomProjectTemplate,
  type ApiProjectTemplate,
} from "../areacalcApi";
import { Spin } from "./ui";

// ─── Shared input style helper ────────────────────────────────
// Forces explicit light-mode colors so dark-mode OS/browser themes
// don't render grey text on white backgrounds inside modals.

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%",
    fontSize: 14,
    padding: "9px 11px",
    borderRadius: 9,
    border: "1.5px solid #e5e7eb",
    boxSizing: "border-box" as const,
    outline: "none",
    // ── Force light-mode colors regardless of OS/browser theme ──
    background: "#ffffff",
    color: "#111827",
    colorScheme: "light" as const,
    WebkitTextFillColor: "#111827",
    ...extra,
  };
}

// ─── ActiveTemplateSource ─────────────────────────────────────

export type ActiveTemplateSource =
  | { type: "custom"; id: number }
  | { type: "public"; id: number }
  | null;

// ─── TemplatePanel ────────────────────────────────────────────

export function TemplatePanel({
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

export function SaveAsCustomModal({ defaultLabel, existingNames, onSave, onClose }: {
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
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 350, padding: 16,
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 16, padding: 24,
        width: "100%", maxWidth: 380,
        boxShadow: "0 24px 64px rgba(0,0,0,.2)",
        colorScheme: "light" as const,
      }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#111827" }}>
          💾 Save as Custom Template
        </h3>

        <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
          Template Name <span style={{ color: "#ef4444" }}>*</span>
        </label>

        <input
          autoFocus
          value={label}
          onChange={(e) => { setLabel(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. My 3-Bed Villa"
          style={inputStyle({
            marginBottom: 6,
            border: `1.5px solid ${error ? "#ef4444" : "#e5e7eb"}`,
          })}
        />

        {error && (
          <p style={{ fontSize: 11, color: "#ef4444", margin: "0 0 12px" }}>{error}</p>
        )}
        {!error && (
          <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.5 }}>
            Saves all current rooms, dimensions, and settings as a reusable template for you.
          </p>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim()}
            style={{
              flex: 1, padding: "11px", borderRadius: 9, border: "none",
              background: label.trim() && !saving ? "#16a34a" : "#e5e7eb",
              color: label.trim() && !saving ? "#fff" : "#9ca3af",
              fontWeight: 700, fontSize: 14,
              cursor: label.trim() && !saving ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {saving ? <><Spin size={13} color="#fff" /> Saving…</> : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "11px 16px", borderRadius: 9,
              border: "1px solid #e5e7eb", background: "#fff",
              cursor: "pointer", fontSize: 14, color: "#374151",
            }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SaveAsGeneralModal ───────────────────────────────────────

export function SaveAsGeneralModal({ spaces, spaceTemplates, onClose, onSaved }: {
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
  override_l: s.L !== tpl.L ? +s.L.toFixed(2) : null,
  override_b: s.B !== tpl.B ? +s.B.toFixed(2) : null,
  sort_order: idx,
  sub_ids: subIds,
  notes: JSON.stringify({
    desc: s.description || "",
    subs: s.subSpaces.map((sub) => ({
      desc: sub.description || "",
      L: sub.L,
      B: sub.B,
      name: sub.name,
      templateId: sub.templateId,
    })),
  }),
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

  // Shared small-text input style (description, template ID)
  const smallInput = (extra?: React.CSSProperties): React.CSSProperties =>
    inputStyle({ fontSize: 13, padding: "8px 11px", ...extra });

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 400, padding: 16,
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 18, padding: 28,
        width: "100%", maxWidth: 460,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 64px rgba(0,0,0,.25)",
        colorScheme: "light" as const,
      }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
          🌐 Save as Public Template
        </h3>
        <p style={{ margin: "0 0 22px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          This template will be <strong style={{ color: "#374151" }}>visible to all users</strong>.
          Requires member / admin role.
        </p>

        {/* Template Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
            Template Name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            autoFocus
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(""); }}
            placeholder="e.g. 3-Bedroom Villa, Primary School Block…"
            style={inputStyle()}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
            Short Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Typical 2-floor residence with 3 beds"
            style={smallInput()}
          />
        </div>

        {/* Template ID */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
            Template ID{" "}
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>(unique slug — no spaces)</span>
          </label>
          <input
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value.replace(/\s+/g, "_").toLowerCase())}
            placeholder="e.g. villa_3bed_standard"
            style={smallInput({ fontSize: 12, fontFamily: "monospace" })}
          />
        </div>

        {/* Icon picker */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>
            Icon
          </label>
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

        {/* Spaces preview */}
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 18,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>
            Spaces to include ({resolvableSpaces.length} of {spaces.length})
          </p>
          {resolvableSpaces.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>
              ⚠️ No template-backed spaces found. Add rooms from the palette first.
            </p>
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

          {/* ADD THIS BELOW */}
          {spaces.some((s) => s.subSpaces.some((sub) => sub.templateId === "custom")) && (
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#b45309", background: "#fffbeb", padding: "6px 9px", borderRadius: 6, lineHeight: 1.5 }}>
              ⚠️ Custom sub-spaces cannot be saved in public templates and will be skipped.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 9,
            background: "#fef2f2", border: "1px solid #fecaca",
            marginBottom: 16, fontSize: 12, color: "#b91c1c", lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
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
          <button type="button" onClick={onClose} style={{
            padding: "12px 18px", borderRadius: 10,
            border: "1.5px solid #e5e7eb", background: "#fff",
            cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 600,
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SaveButtons ──────────────────────────────────────────────

export interface SaveButtonsProps {
  myRole: ApiMyRole | null;
  savingTemplate: boolean;
  templateSaveMsg: string;
  activeTemplateSource: ActiveTemplateSource;
  canSaveCustom: boolean;
  canSavePublic: boolean;
  spaces: SpaceInstance[];
  onSave: () => void;
  onSaveAsCustom: () => void;
  onSaveAsPublic: () => void;
}

export function SaveButtons({
  savingTemplate, templateSaveMsg,
  activeTemplateSource, canSaveCustom, canSavePublic,
  spaces, onSave, onSaveAsCustom, onSaveAsPublic,
}: SaveButtonsProps) {
  const hasSpaces = spaces.length > 0;

  const saveLabel = savingTemplate ? "Saving…" : "💾 Save";
  const saveTitle = (() => {
    if (!canSaveCustom && !canSavePublic) return "Beta Version ";
    if (!activeTemplateSource) return "Save as a new custom template";
    if (activeTemplateSource.type === "custom") return "Update this custom template";
    if (activeTemplateSource.type === "public") return "Update this public template";
    return "Save";
  })();
  const saveEnabled = hasSpaces && !savingTemplate && (canSaveCustom || canSavePublic);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <button type="button" onClick={onSave} disabled={!saveEnabled} title={saveTitle} style={{
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

      {canSaveCustom && (
        <button type="button" onClick={onSaveAsCustom} disabled={!hasSpaces}
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

      {canSavePublic && (
        <button type="button" onClick={onSaveAsPublic} disabled={!hasSpaces}
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