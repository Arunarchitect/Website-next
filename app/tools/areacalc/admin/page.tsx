/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

/**
 * areacalc/admin/page.tsx
 *
 * Admin / Member panel for:
 *  1. Space Templates  — create / edit / delete (with sub-spaces)
 *  2. Project Templates — create / edit / delete (with floor-assigned space slots)
 *  3. Promote a saved CustomProjectTemplate → public ProjectTemplate ("Publish")
 *
 * Access:  role === "member" | "admin"   (checked against /api/areacalc/me/role/)
 */

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────

type Role = "anonymous" | "user" | "customer" | "member" | "admin";

interface MyRole {
  authenticated: boolean;
  role: Role;
  can_save_custom_templates: boolean;
}

interface SubSpaceForm {
  id?: number;
  sub_id: string;
  name: string;
  default_l: string;
  default_b: string;
  description: string;
  sort_order: number;
}

interface SpaceTemplateForm {
  id?: number;
  template_id: string;
  name: string;
  category: string;
  default_l: string;
  default_b: string;
  icon: string;
  description: string;
  sort_order: number;
  sub_spaces: SubSpaceForm[];
}

interface ApiSubSpace {
  id: number;
  sub_id: string;
  name: string;
  default_l: string;
  default_b: string;
  description: string;
  sort_order: number;
}

interface ApiSpaceTemplate {
  id: number;
  template_id: string;
  name: string;
  category: string;
  default_l: string;
  default_b: string;
  icon: string;
  description: string;
  sort_order: number;
  sub_spaces: ApiSubSpace[];
}

interface ProjectSpaceSlot {
  _key: string; // client-only uid
  id?: number;
  space_template: number | "";
  space_template_id?: string;
  space_name?: string;
  floor: number;
  override_l: string;
  override_b: string;
  sort_order: number;
  sub_ids: number[]; // SubSpaceTemplate pk list
}

interface ProjectTemplateForm {
  id?: number;
  template_id: string;
  label: string;
  description: string;
  icon: string;
  sort_order: number;
  spaces: ProjectSpaceSlot[];
}

interface ApiSubId {
  id: number;
  sub_space_template: number;
  sub_id: string;
  sub_name: string;
}

interface ApiProjectSpace {
  id: number;
  space_template: number;
  space_template_id: string;
  space_name: string;
  floor: number;
  override_l: string | null;
  override_b: string | null;
  effective_l: string;
  effective_b: string;
  sort_order: number;
  sub_ids: ApiSubId[];
}

interface ApiProjectTemplate {
  id: number;
  template_id: string;
  label: string;
  description: string;
  icon: string;
  sort_order: number;
  spaces: ApiProjectSpace[];
}

interface ApiCustomTemplate {
  id: number;
  owner: string;
  label: string;
  description: string;
  icon: string;
  data: {
    projectName?: string;
    spaces?: unknown[];
  };
  source_project_template: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────

const HOST = process.env.NEXT_PUBLIC_HOST ?? "";
const BASE = `${HOST}/api/areacalc`;

const CATEGORIES = [
  { value: "residence", label: "Residence" },
  { value: "school", label: "Education / School" },
  { value: "commercial", label: "Commercial" },
  { value: "healthcare", label: "Healthcare" },
  { value: "hospitality", label: "Hospitality" },
];

const FLOORS = [
  { value: -1, label: "Basement" },
  { value: 0, label: "Ground Floor" },
  { value: 1, label: "First Floor" },
  { value: 2, label: "Second Floor" },
  { value: 3, label: "Third Floor" },
  { value: 4, label: "Fourth Floor" },
  { value: 5, label: "Fifth Floor" },
];

const ICONS = [
  "📐",
  "🏗️",
  "🏠",
  "🛋️",
  "🛏️",
  "🍳",
  "🚿",
  "🌿",
  "🚗",
  "💼",
  "📚",
  "🔬",
  "🏥",
  "🛍️",
  "🎉",
  "✨",
  "🏨",
  "🏢",
  "🪑",
  "🩺",
  "💊",
  "🎭",
  "📖",
  "🅿️",
  "🍴",
  "🔑",
  "🪜",
  "↔️",
  "🏫",
  "🛁",
  "🚪",
  "🪟",
  "📋",
  "🖥️",
  "🔧",
  "⚕️",
];

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  residence: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  school: { bg: "#dbeafe", text: "#1e3a8a", border: "#bfdbfe" },
  commercial: { bg: "#ede9fe", text: "#4c1d95", border: "#ddd6fe" },
  healthcare: { bg: "#d1fae5", text: "#064e3b", border: "#a7f3d0" },
  hospitality: { bg: "#fce7f3", text: "#831843", border: "#fbcfe8" },
};

// ─── API helpers ──────────────────────────────────────────────

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status}: ${txt}`);
  }
  return res.json();
}

const api = {
  get: <T,>(url: string) => apiFetch<T>(url),
  post: <T,>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T,>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T,>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: (url: string) =>
    fetch(url, { method: "DELETE", headers: authHeaders() }),
};

// ─── Small UI atoms ───────────────────────────────────────────

function Badge({ cat }: { cat: string }) {
  const c = CATEGORY_COLORS[cat] ?? {
    bg: "#f3f4f6",
    text: "#374151",
    border: "#e5e7eb",
  };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 20,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        textTransform: "uppercase",
      }}
    >
      {CATEGORIES.find((x) => x.value === cat)?.label ?? cat}
    </span>
  );
}

function StatusMsg({ msg, type }: { msg: string; type: "ok" | "err" | "" }) {
  if (!msg) return null;
  const colors =
    type === "ok"
      ? { bg: "#dcfce7", border: "#86efac", color: "#166534" }
      : { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b" };
  return (
    <div
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        marginBottom: 12,
      }}
    >
      {type === "ok" ? "✓ " : "✕ "}
      {msg}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  min,
  step,
  style: extStyle,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  min?: number;
  step?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6b7280",
          display: "block",
          marginBottom: 3,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          fontSize: 13,
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          boxSizing: "border-box",
          ...extStyle,
        }}
      />
      {hint && (
        <p style={{ fontSize: 10, color: "#9ca3af", margin: "3px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6b7280",
          display: "block",
          marginBottom: 3,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          fontSize: 13,
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "#fff",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  small,
  style: ext,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  disabled?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
}) {
  const variants = {
    primary: { bg: "#1d4ed8", color: "#fff", border: "#1d4ed8" },
    secondary: { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
    danger: { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
    ghost: { bg: "transparent", color: "#6b7280", border: "transparent" },
    success: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
  };
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: small ? 11 : 13,
        padding: small ? "4px 10px" : "8px 16px",
        borderRadius: 8,
        border: `1px solid ${v.border}`,
        background: disabled ? "#f3f4f6" : v.bg,
        color: disabled ? "#9ca3af" : v.color,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        ...ext,
      }}
    >
      {children}
    </button>
  );
}

// ─── Icon picker ──────────────────────────────────────────────

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6b7280",
          display: "block",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Icon — selected: <span style={{ fontSize: 18 }}>{value}</span>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {ICONS.map((ic) => (
          <button
            key={ic}
            type="button"
            onClick={() => onChange(ic)}
            style={{
              fontSize: 18,
              width: 36,
              height: 36,
              borderRadius: 8,
              cursor: "pointer",
              background: value === ic ? "#fef3c7" : "#f9fafb",
              border: value === ic ? "2px solid #f59e0b" : "1px solid #e5e7eb",
            }}
          >
            {ic}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-space editor (inside SpaceTemplate form) ─────────────

function SubSpaceEditor({
  subs,
  onChange,
}: {
  subs: SubSpaceForm[];
  onChange: (s: SubSpaceForm[]) => void;
}) {
  function add() {
    onChange([
      ...subs,
      {
        sub_id: "",
        name: "",
        default_l: "3",
        default_b: "3",
        description: "",
        sort_order: subs.length,
      },
    ]);
  }
  function remove(i: number) {
    onChange(subs.filter((_, idx) => idx !== i));
  }
  function update(i: number, field: keyof SubSpaceForm, val: string | number) {
    onChange(subs.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Sub-spaces ({subs.length})
        </span>
        <Btn small variant="secondary" onClick={add}>
          + Add Sub-space
        </Btn>
      </div>
      {subs.map((sub, i) => (
        <div
          key={i}
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 100px" }}>
              <label
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Sub ID
              </label>
              <input
                value={sub.sub_id}
                onChange={(e) => update(i, "sub_id", e.target.value)}
                placeholder="e.g. wc_1"
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "2 1 140px" }}>
              <label
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Name
              </label>
              <input
                value={sub.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder="e.g. Attached WC"
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "1 1 70px" }}>
              <label
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                L (ft)
              </label>
              <input
                type="number"
                value={sub.default_l}
                onChange={(e) => update(i, "default_l", e.target.value)}
                min={0.1}
                step={0.5}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "1 1 70px" }}>
              <label
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                B (ft)
              </label>
              <input
                type="number"
                value={sub.default_b}
                onChange={(e) => update(i, "default_b", e.target.value)}
                min={0.1}
                step={0.5}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "1 1 50px" }}>
              <label
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Order
              </label>
              <input
                type="number"
                value={sub.sort_order}
                onChange={(e) =>
                  update(i, "sort_order", parseInt(e.target.value) || 0)
                }
                min={0}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ flex: "3 1 180px" }}>
              <label
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Description
              </label>
              <input
                value={sub.description}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="Optional"
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={() => remove(i)}
              style={{
                alignSelf: "flex-end",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#ef4444",
                fontSize: 16,
                padding: "4px",
              }}
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SpaceTemplate Form modal ─────────────────────────────────

const BLANK_SPACE_FORM: SpaceTemplateForm = {
  template_id: "",
  name: "",
  category: "residence",
  default_l: "12",
  default_b: "10",
  icon: "📐",
  description: "",
  sort_order: 0,
  sub_spaces: [],
};

function SpaceTemplateModal({
  initial,
  allTemplates,
  onClose,
  onSaved,
}: {
  initial?: ApiSpaceTemplate | null;
  allTemplates: ApiSpaceTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<SpaceTemplateForm>(() => {
    if (initial) {
      return {
        id: initial.id,
        template_id: initial.template_id,
        name: initial.name,
        category: initial.category,
        default_l: initial.default_l,
        default_b: initial.default_b,
        icon: initial.icon,
        description: initial.description,
        sort_order: initial.sort_order,
        sub_spaces: initial.sub_spaces.map((s) => ({ ...s })),
      };
    }
    return { ...BLANK_SPACE_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(field: keyof SpaceTemplateForm, val: unknown) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handleSave() {
    if (!form.template_id.trim() || !form.name.trim()) {
      setErr("Template ID and Name are required.");
      return;
    }
    // Validate unique template_id (unless editing the same one)
    const conflict = allTemplates.find(
      (t) => t.template_id === form.template_id.trim() && t.id !== form.id,
    );
    if (conflict) {
      setErr(
        `Template ID "${form.template_id}" is already used by "${conflict.name}".`,
      );
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const payload = {
        template_id: form.template_id.trim(),
        name: form.name.trim(),
        category: form.category,
        default_l: parseFloat(form.default_l) || 10,
        default_b: parseFloat(form.default_b) || 10,
        icon: form.icon,
        description: form.description.trim(),
        sort_order: form.sort_order,
        sub_spaces: form.sub_spaces.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          sub_id: s.sub_id.trim(),
          name: s.name.trim(),
          default_l: parseFloat(s.default_l) || 3,
          default_b: parseFloat(s.default_b) || 3,
          description: s.description.trim(),
          sort_order: s.sort_order,
        })),
      };
      if (isEdit) {
        await api.put(`${BASE}/templates/spaces/${form.id}/`, payload);
      } else {
        await api.post(`${BASE}/templates/spaces/`, payload);
      }
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {isEdit ? `Edit: ${initial!.name}` : "New Space Template"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            ✕
          </button>
        </div>

        {err && <StatusMsg msg={err} type="err" />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <Input
            label="Template ID *"
            value={form.template_id}
            onChange={(v) => set("template_id", v)}
            placeholder="e.g. master_bedroom"
            hint="Unique slug, no spaces"
          />
          <Input
            label="Name *"
            value={form.name}
            onChange={(v) => set("name", v)}
            placeholder="e.g. Master Bedroom"
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(v) => set("category", v)}
            options={CATEGORIES}
          />
          <Input
            label="Sort Order"
            value={form.sort_order}
            onChange={(v) => set("sort_order", parseInt(v) || 0)}
            type="number"
            min={0}
          />
          <Input
            label="Default Length (ft)"
            value={form.default_l}
            onChange={(v) => set("default_l", v)}
            type="number"
            min={1}
            step={0.5}
          />
          <Input
            label="Default Breadth (ft)"
            value={form.default_b}
            onChange={(v) => set("default_b", v)}
            type="number"
            min={1}
            step={0.5}
          />
        </div>

        <Input
          label="Description"
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="Brief description"
        />
        <IconPicker value={form.icon} onChange={(v) => set("icon", v)} />

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: 16,
            marginTop: 4,
          }}
        >
          <SubSpaceEditor
            subs={form.sub_spaces}
            onChange={(v) => set("sub_spaces", v)}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving
              ? "Saving…"
              : isEdit
                ? "Update Template"
                : "Create Template"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Project Space Slot editor ────────────────────────────────

function ProjectSpaceSlotEditor({
  slots,
  onChange,
  spaceTemplates,
}: {
  slots: ProjectSpaceSlot[];
  onChange: (s: ProjectSpaceSlot[]) => void;
  spaceTemplates: ApiSpaceTemplate[];
}) {
  function addSlot() {
    onChange([
      ...slots,
      {
        _key: `k_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        space_template: "",
        floor: 0,
        override_l: "",
        override_b: "",
        sort_order: slots.length,
        sub_ids: [],
      },
    ]);
  }
  function remove(key: string) {
    onChange(slots.filter((s) => s._key !== key));
  }
  function update(key: string, patch: Partial<ProjectSpaceSlot>) {
    onChange(slots.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Space Slots ({slots.length})
        </span>
        <Btn small variant="secondary" onClick={addSlot}>
          + Add Space Slot
        </Btn>
      </div>

      {slots.length === 0 && (
        <p
          style={{
            fontSize: 12,
            color: "#9ca3af",
            textAlign: "center",
            padding: "12px 0",
          }}
        >
          No slots yet — add spaces to this project template.
        </p>
      )}

      {slots.map((slot, i) => {
        const tpl = spaceTemplates.find(
          (t) => t.id === Number(slot.space_template),
        );
        const availableSubs = tpl?.sub_spaces ?? [];

        return (
          <div
            key={slot._key}
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div style={{ flex: "3 1 180px" }}>
                <label
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Space Template *
                </label>
                <select
                  value={slot.space_template}
                  onChange={(e) =>
                    update(slot._key, {
                      space_template: e.target.value
                        ? Number(e.target.value)
                        : "",
                      sub_ids: [],
                    })
                  }
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  <option value="">— select —</option>
                  {spaceTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.name} ({t.template_id})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 130px" }}>
                <label
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Floor
                </label>
                <select
                  value={slot.floor}
                  onChange={(e) =>
                    update(slot._key, { floor: parseInt(e.target.value) })
                  }
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  {FLOORS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 80px" }}>
                <label
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Override L
                </label>
                <input
                  type="number"
                  value={slot.override_l}
                  placeholder={tpl ? tpl.default_l : "—"}
                  onChange={(e) =>
                    update(slot._key, { override_l: e.target.value })
                  }
                  min={0.5}
                  step={0.5}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: "1 1 80px" }}>
                <label
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Override B
                </label>
                <input
                  type="number"
                  value={slot.override_b}
                  placeholder={tpl ? tpl.default_b : "—"}
                  onChange={(e) =>
                    update(slot._key, { override_b: e.target.value })
                  }
                  min={0.5}
                  step={0.5}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: "0 0 60px" }}>
                <label
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Order
                </label>
                <input
                  type="number"
                  value={slot.sort_order}
                  onChange={(e) =>
                    update(slot._key, {
                      sort_order: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                onClick={() => remove(slot._key)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontSize: 16,
                  alignSelf: "flex-end",
                  padding: "5px",
                }}
              >
                🗑
              </button>
            </div>

            {/* Sub-space selection */}
            {availableSubs.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <label
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Include Sub-spaces
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {availableSubs.map((sub) => {
                    const checked = slot.sub_ids.includes(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() =>
                          update(slot._key, {
                            sub_ids: checked
                              ? slot.sub_ids.filter((id) => id !== sub.id)
                              : [...slot.sub_ids, sub.id],
                          })
                        }
                        style={{
                          fontSize: 11,
                          padding: "3px 10px",
                          borderRadius: 20,
                          cursor: "pointer",
                          background: checked ? "#dbeafe" : "#fff",
                          border: checked
                            ? "1px solid #93c5fd"
                            : "1px solid #e5e7eb",
                          color: checked ? "#1e40af" : "#6b7280",
                          fontWeight: checked ? 700 : 400,
                        }}
                      >
                        {checked ? "✓ " : ""}
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── ProjectTemplate Form modal ───────────────────────────────

const BLANK_PROJECT_FORM: ProjectTemplateForm = {
  template_id: "",
  label: "",
  description: "",
  icon: "🏗️",
  sort_order: 0,
  spaces: [],
};

function ProjectTemplateModal({
  initial,
  allProjectTemplates,
  spaceTemplates,
  onClose,
  onSaved,
}: {
  initial?: ApiProjectTemplate | null;
  allProjectTemplates: ApiProjectTemplate[];
  spaceTemplates: ApiSpaceTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<ProjectTemplateForm>(() => {
    if (initial) {
      return {
        id: initial.id,
        template_id: initial.template_id,
        label: initial.label,
        description: initial.description,
        icon: initial.icon,
        sort_order: initial.sort_order,
        spaces: initial.spaces.map((s) => ({
          _key: `k_${s.id}`,
          id: s.id,
          space_template: s.space_template,
          space_template_id: s.space_template_id,
          space_name: s.space_name,
          floor: s.floor,
          override_l: s.override_l ?? "",
          override_b: s.override_b ?? "",
          sort_order: s.sort_order,
          sub_ids: s.sub_ids.map((x) => x.sub_space_template),
        })),
      };
    }
    return { ...BLANK_PROJECT_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(field: keyof ProjectTemplateForm, val: unknown) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handleSave() {
    if (!form.template_id.trim() || !form.label.trim()) {
      setErr("Template ID and Label are required.");
      return;
    }
    const conflict = allProjectTemplates.find(
      (t) => t.template_id === form.template_id.trim() && t.id !== form.id,
    );
    if (conflict) {
      setErr(
        `Template ID "${form.template_id}" is already used by "${conflict.label}".`,
      );
      return;
    }
    if (form.spaces.some((s) => !s.space_template)) {
      setErr("All space slots must have a space template selected.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const payload = {
        template_id: form.template_id.trim(),
        label: form.label.trim(),
        description: form.description.trim(),
        icon: form.icon,
        sort_order: form.sort_order,
        spaces: form.spaces.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          space_template: s.space_template,
          floor: s.floor,
          override_l: s.override_l ? parseFloat(s.override_l) : null,
          override_b: s.override_b ? parseFloat(s.override_b) : null,
          sort_order: s.sort_order,
          sub_ids: s.sub_ids,
        })),
      };
      if (isEdit) {
        await api.put(`${BASE}/templates/projects/${form.id}/`, payload);
      } else {
        await api.post(`${BASE}/templates/projects/`, payload);
      }
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {isEdit ? `Edit: ${initial!.label}` : "New Project Template"}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            ✕
          </button>
        </div>

        {err && <StatusMsg msg={err} type="err" />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <Input
            label="Template ID *"
            value={form.template_id}
            onChange={(v) => set("template_id", v)}
            placeholder="e.g. 3bhk_villa"
            hint="Unique slug"
          />
          <Input
            label="Label *"
            value={form.label}
            onChange={(v) => set("label", v)}
            placeholder="e.g. 3 BHK Villa"
          />
          <Select
            label="Sort Order"
            value={form.sort_order}
            onChange={(v) => set("sort_order", parseInt(v) || 0)}
            options={Array.from({ length: 20 }, (_, i) => ({
              value: i,
              label: String(i),
            }))}
          />
        </div>

        <Input
          label="Description"
          value={form.description}
          onChange={(v) => set("description", v)}
          placeholder="Short description shown to users"
        />
        <IconPicker value={form.icon} onChange={(v) => set("icon", v)} />

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: 16,
            marginTop: 4,
          }}
        >
          <ProjectSpaceSlotEditor
            slots={form.spaces}
            onChange={(v) => set("spaces", v)}
            spaceTemplates={spaceTemplates}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={handleSave} disabled={saving}>
            {saving
              ? "Saving…"
              : isEdit
                ? "Update Template"
                : "Create Template"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Promote Custom → Public modal ───────────────────────────

function PromoteModal({
  custom,
  allProjectTemplates,
  spaceTemplates,
  onClose,
  onDone,
}: {
  custom: ApiCustomTemplate;
  allProjectTemplates: ApiProjectTemplate[];
  spaceTemplates: ApiSpaceTemplate[];
  onClose: () => void;
  onDone: () => void;
}) {
  const rawSpaces = (custom.data?.spaces ?? []) as Array<{
    templateId?: string;
    floor?: number;
    L?: number;
    B?: number;
    subSpaces?: Array<{ templateId?: string; instanceId?: string }>;
  }>;

  // Pre-fill: map custom template's spaces to slot form
  const inferredSlots: ProjectSpaceSlot[] = rawSpaces.map((s, i) => {
    const tpl = spaceTemplates.find((t) => t.template_id === s.templateId);
    return {
      _key: `p_${i}`,
      space_template: tpl?.id ?? "",
      floor: s.floor ?? 0,
      override_l: s.L ? String(s.L) : "",
      override_b: s.L ? String(s.L) : "",
      sort_order: i,
      sub_ids: [],
    };
  });

  const suggestedId = (custom.data?.projectName ?? custom.label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 50);

  const [form, setForm] = useState<ProjectTemplateForm>({
    template_id: suggestedId,
    label: custom.data?.projectName || custom.label,
    description: custom.description || "",
    icon: custom.icon || "🏗️",
    sort_order: allProjectTemplates.length,
    spaces: inferredSlots,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(field: keyof ProjectTemplateForm, val: unknown) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handlePublish() {
    if (!form.template_id.trim() || !form.label.trim()) {
      setErr("Template ID and Label are required.");
      return;
    }
    const conflict = allProjectTemplates.find(
      (t) => t.template_id === form.template_id.trim(),
    );
    if (conflict) {
      setErr(`Template ID "${form.template_id}" already exists.`);
      return;
    }
    if (form.spaces.some((s) => !s.space_template)) {
      setErr("All space slots must have a space template selected.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const payload = {
        template_id: form.template_id.trim(),
        label: form.label.trim(),
        description: form.description.trim(),
        icon: form.icon,
        sort_order: form.sort_order,
        spaces: form.spaces.map((s) => ({
          space_template: s.space_template,
          floor: s.floor,
          override_l: s.override_l ? parseFloat(s.override_l) : null,
          override_b: s.override_b ? parseFloat(s.override_b) : null,
          sort_order: s.sort_order,
          sub_ids: s.sub_ids,
        })),
      };
      await api.post(`${BASE}/templates/projects/`, payload);
      // Optionally mark the custom template as linked
      await api.patch(`${BASE}/templates/custom-projects/${custom.id}/`, {
        description: `Published as public template: ${form.template_id}`,
      });
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Publish as Public Template
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
              Source: <strong>{custom.label}</strong> by {custom.owner}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#9ca3af",
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            marginBottom: 16,
            fontSize: 12,
            color: "#92400e",
          }}
        >
          ⚠️ This will create a new <strong>public</strong> project template
          visible to all users. Review and correct space slot mappings carefully
          — the custom template may use space types not in the library.
        </div>

        {err && <StatusMsg msg={err} type="err" />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 16px",
          }}
        >
          <Input
            label="Template ID *"
            value={form.template_id}
            onChange={(v) => set("template_id", v)}
            placeholder="e.g. 3bhk_villa"
            hint="Unique slug"
          />
          <Input
            label="Label *"
            value={form.label}
            onChange={(v) => set("label", v)}
          />
        </div>
        <Input
          label="Description"
          value={form.description}
          onChange={(v) => set("description", v)}
        />
        <IconPicker value={form.icon} onChange={(v) => set("icon", v)} />

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: 16,
            marginTop: 4,
          }}
        >
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 10px" }}>
            Map each custom space to a Space Template from the library. Spaces
            that could not be auto-matched show an empty dropdown — please
            select manually.
          </p>
          <ProjectSpaceSlotEditor
            slots={form.spaces}
            onChange={(v) => set("spaces", v)}
            spaceTemplates={spaceTemplates}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 20,
          }}
        >
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn variant="success" onClick={handlePublish} disabled={saving}>
            {saving ? "Publishing…" : "🌐 Publish as Public Template"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm delete dialog ────────────────────────────────────

function ConfirmDelete({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          width: 360,
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 16,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Delete &quot;{label}&quot;?
        </h3>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
          This cannot be undone. Any project templates referencing this space
          template will break.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn variant="danger" onClick={onConfirm}>
            Delete
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Space Templates ──────────────────────────────────

function SpaceTemplatesSection({
  templates,
  loading,
  onRefresh,
}: {
  templates: ApiSpaceTemplate[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [editTarget, setEditTarget] = useState<
    ApiSpaceTemplate | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ApiSpaceTemplate | null>(
    null,
  );
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState({
    msg: "",
    type: "" as "ok" | "err" | "",
  });

  const filtered = templates.filter((t) => {
    const catOk = filterCat === "all" || t.category === filterCat;
    const qOk =
      !search.trim() ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.template_id.toLowerCase().includes(search.toLowerCase());
    return catOk && qOk;
  });

  async function handleDelete(t: ApiSpaceTemplate) {
    try {
      await api.delete(`${BASE}/templates/spaces/${t.id}/`);
      setStatusMsg({ msg: `"${t.name}" deleted.`, type: "ok" });
      onRefresh();
    } catch (e: unknown) {
      setStatusMsg({
        msg: e instanceof Error ? e.message : "Delete failed",
        type: "err",
      });
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      {editTarget !== undefined && (
        <SpaceTemplateModal
          initial={editTarget}
          allTemplates={templates}
          onClose={() => setEditTarget(undefined)}
          onSaved={() => {
            setEditTarget(undefined);
            setStatusMsg({ msg: "Space template saved.", type: "ok" });
            onRefresh();
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          label={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search…"
          style={{
            fontSize: 13,
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            width: 200,
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setFilterCat("all")}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: filterCat === "all" ? "#374151" : "#e5e7eb",
              background: filterCat === "all" ? "#374151" : "#fff",
              color: filterCat === "all" ? "#fff" : "#6b7280",
              cursor: "pointer",
            }}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCat(c.value)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                border: "1px solid",
                borderColor:
                  filterCat === c.value
                    ? CATEGORY_COLORS[c.value].text
                    : "#e5e7eb",
                background:
                  filterCat === c.value ? CATEGORY_COLORS[c.value].bg : "#fff",
                color:
                  filterCat === c.value
                    ? CATEGORY_COLORS[c.value].text
                    : "#6b7280",
                cursor: "pointer",
              }}
            >
              {c.label.split(" ")[0]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Btn variant="primary" onClick={() => setEditTarget(null)}>
            + New Space Template
          </Btn>
        </div>
      </div>

      {statusMsg.msg && <StatusMsg msg={statusMsg.msg} type={statusMsg.type} />}

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p
          style={{
            color: "#9ca3af",
            fontSize: 13,
            textAlign: "center",
            padding: 24,
          }}
        >
          No space templates found.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((t) => (
            <div
              key={t.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#111827",
                      margin: "0 0 3px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.name}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      margin: 0,
                      fontFamily: "monospace",
                    }}
                  >
                    {t.template_id}
                  </p>
                </div>
                <Badge cat={t.category} />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: "#374151",
                    background: "#f3f4f6",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  {t.default_l}′ × {t.default_b}′
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  ={" "}
                  {Math.round(
                    parseFloat(t.default_l) * parseFloat(t.default_b),
                  )}{" "}
                  sqft
                </span>
                {t.sub_spaces.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#6366f1",
                      marginLeft: "auto",
                    }}
                  >
                    {t.sub_spaces.length} sub-space
                    {t.sub_spaces.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {t.description && (
                <p
                  style={{ fontSize: 11, color: "#6b7280", margin: "0 0 10px" }}
                >
                  {t.description}
                </p>
              )}
              {t.sub_spaces.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    marginBottom: 10,
                  }}
                >
                  {t.sub_spaces.map((s) => (
                    <span
                      key={s.id}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: "#f5f3ff",
                        color: "#4c1d95",
                        border: "1px solid #ddd6fe",
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="secondary" onClick={() => setEditTarget(t)}>
                  ✏️ Edit
                </Btn>
                <Btn small variant="danger" onClick={() => setDeleteTarget(t)}>
                  🗑 Delete
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Project Templates ───────────────────────────────

function ProjectTemplatesSection({
  templates,
  spaceTemplates,
  loading,
  onRefresh,
}: {
  templates: ApiProjectTemplate[];
  spaceTemplates: ApiSpaceTemplate[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [editTarget, setEditTarget] = useState<
    ApiProjectTemplate | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ApiProjectTemplate | null>(
    null,
  );
  const [statusMsg, setStatusMsg] = useState({
    msg: "",
    type: "" as "ok" | "err" | "",
  });

  async function handleDelete(t: ApiProjectTemplate) {
    try {
      await api.delete(`${BASE}/templates/projects/${t.id}/`);
      setStatusMsg({ msg: `"${t.label}" deleted.`, type: "ok" });
      onRefresh();
    } catch (e: unknown) {
      setStatusMsg({
        msg: e instanceof Error ? e.message : "Delete failed",
        type: "err",
      });
    }
    setDeleteTarget(null);
  }

  return (
    <div>
      {editTarget !== undefined && (
        <ProjectTemplateModal
          initial={editTarget}
          allProjectTemplates={templates}
          spaceTemplates={spaceTemplates}
          onClose={() => setEditTarget(undefined)}
          onSaved={() => {
            setEditTarget(undefined);
            setStatusMsg({ msg: "Project template saved.", type: "ok" });
            onRefresh();
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          label={deleteTarget.label}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <Btn variant="primary" onClick={() => setEditTarget(null)}>
          + New Project Template
        </Btn>
      </div>

      {statusMsg.msg && <StatusMsg msg={statusMsg.msg} type={statusMsg.type} />}

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
      ) : templates.length === 0 ? (
        <p
          style={{
            color: "#9ca3af",
            fontSize: 13,
            textAlign: "center",
            padding: 24,
          }}
        >
          No project templates yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 12,
          }}
        >
          {templates.map((t) => (
            <div
              key={t.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#111827",
                      margin: "0 0 2px",
                    }}
                  >
                    {t.label}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      margin: 0,
                      fontFamily: "monospace",
                    }}
                  >
                    {t.template_id}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    fontFamily: "monospace",
                    background: "#f3f4f6",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  {t.spaces.length} spaces
                </span>
              </div>
              {t.description && (
                <p
                  style={{ fontSize: 11, color: "#6b7280", margin: "0 0 8px" }}
                >
                  {t.description}
                </p>
              )}

              {/* Floor breakdown */}
              {Array.from(new Set(t.spaces.map((s) => s.floor)))
                .sort()
                .map((floor) => {
                  const floorSpaces = t.spaces.filter((s) => s.floor === floor);
                  return (
                    <div key={floor} style={{ marginBottom: 6 }}>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          margin: "0 0 3px",
                        }}
                      >
                        {FLOORS.find((f) => f.value === floor)?.label ??
                          `Floor ${floor}`}
                      </p>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
                      >
                        {floorSpaces.map((s) => (
                          <span
                            key={s.id}
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 20,
                              background: "#f9fafb",
                              border: "1px solid #e5e7eb",
                              color: "#374151",
                            }}
                          >
                            {spaceTemplates.find(
                              (t) => t.id === s.space_template,
                            )?.icon ?? ""}{" "}
                            {s.space_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}

              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <Btn small variant="secondary" onClick={() => setEditTarget(t)}>
                  ✏️ Edit
                </Btn>
                <Btn small variant="danger" onClick={() => setDeleteTarget(t)}>
                  🗑 Delete
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Custom Templates (promote to public) ────────────

function CustomTemplatesSection({
  customs,
  projectTemplates,
  spaceTemplates,
  loading,
  onRefresh,
}: {
  customs: ApiCustomTemplate[];
  projectTemplates: ApiProjectTemplate[];
  spaceTemplates: ApiSpaceTemplate[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [promoting, setPromoting] = useState<ApiCustomTemplate | null>(null);
  const [statusMsg, setStatusMsg] = useState({
    msg: "",
    type: "" as "ok" | "err" | "",
  });

  return (
    <div>
      {promoting && (
        <PromoteModal
          custom={promoting}
          allProjectTemplates={projectTemplates}
          spaceTemplates={spaceTemplates}
          onClose={() => setPromoting(null)}
          onDone={() => {
            setPromoting(null);
            setStatusMsg({
              msg: "Custom template published as public project template.",
              type: "ok",
            });
            onRefresh();
          }}
        />
      )}

      {statusMsg.msg && <StatusMsg msg={statusMsg.msg} type={statusMsg.type} />}

      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</p>
      ) : customs.length === 0 ? (
        <p
          style={{
            color: "#9ca3af",
            fontSize: 13,
            textAlign: "center",
            padding: 24,
          }}
        >
          No custom templates submitted by users yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {customs.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 28 }}>{c.icon || "🏠"}</span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#111827",
                      margin: "0 0 2px",
                    }}
                  >
                    {c.label}
                  </p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                    by {c.owner}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: c.is_active ? "#dcfce7" : "#fee2e2",
                    color: c.is_active ? "#166534" : "#991b1b",
                    border: `1px solid ${c.is_active ? "#86efac" : "#fca5a5"}`,
                    fontWeight: 700,
                  }}
                >
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                {(c.data?.spaces as Array<{ name?: string }> | undefined)
                  ?.length ?? 0}{" "}
                space
                {((c.data?.spaces as unknown[] | undefined)?.length ?? 0) !== 1
                  ? "s"
                  : ""}
                {" · "}Project: <em>{c.data?.projectName ?? "—"}</em>
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 10 }}>
                Updated:{" "}
                {new Date(c.updated_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>

              {c.source_project_template && (
                <div
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    marginBottom: 10,
                  }}
                >
                  🔗 Based on project template #{c.source_project_template}
                </div>
              )}

              <Btn small variant="success" onClick={() => setPromoting(c)}>
                🌐 Publish as Public Template
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export default function AreacalcAdminPage() {
  const [role, setRole] = useState<MyRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState<"spaces" | "projects" | "customs">("spaces");

  const [spaceTemplates, setSpaceTemplates] = useState<ApiSpaceTemplate[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<
    ApiProjectTemplate[]
  >([]);
  const [customTemplates, setCustomTemplates] = useState<ApiCustomTemplate[]>(
    [],
  );

  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingCustoms, setLoadingCustoms] = useState(false);

  const fetchSpaces = useCallback(async () => {
    setLoadingSpaces(true);
    try {
      setSpaceTemplates(
        await api.get<ApiSpaceTemplate[]>(`${BASE}/templates/spaces/`),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSpaces(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      setProjectTemplates(
        await api.get<ApiProjectTemplate[]>(`${BASE}/templates/projects/`),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const fetchCustoms = useCallback(async () => {
    setLoadingCustoms(true);
    try {
      setCustomTemplates(
        await api.get<ApiCustomTemplate[]>(
          `${BASE}/templates/custom-projects/`,
        ),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCustoms(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<MyRole>(`${BASE}/me/role/`);
        setRole(r);

        if (!r.authenticated || !["member", "admin"].includes(r.role)) {
          setAccessDenied(true);
        } else {
          await Promise.all([fetchSpaces(), fetchProjects(), fetchCustoms()]);
        }
      } catch {
        setRole({
          authenticated: false,
          role: "anonymous",
          can_save_custom_templates: false,
        });
        setAccessDenied(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchSpaces, fetchProjects, fetchCustoms]);

  function refreshAll() {
    fetchSpaces();
    fetchProjects();
    fetchCustoms();
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f7f4",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Checking access…</p>
        </div>
      </div>
    );
  }

  // ── Access denied ────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f7f4",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              margin: "0 0 8px",
            }}
          >
            Access Restricted
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px" }}>
            This page is only available to <strong>members</strong> and{" "}
            <strong>admins</strong>.
            {role && !role.authenticated && " You are not logged in."}
            {role?.authenticated &&
              !["member", "admin"].includes(role.role) &&
              ` Your current role is "${role.role}".`}
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {role && !role.authenticated && (
              <a
                href="/auth/login?next=/tools/areacalc/admin"
                style={{
                  fontSize: 13,
                  padding: "8px 18px",
                  borderRadius: 8,
                  background: "#1d4ed8",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Sign in
              </a>
            )}
            <a
              href="/areacalc"
              style={{
                fontSize: 13,
                color: "#1d4ed8",
                textDecoration: "none",
                fontWeight: 600,
                padding: "8px 0",
              }}
            >
              ← Back to Area Calculator
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────
  const tabs: {
    key: "spaces" | "projects" | "customs";
    label: string;
    count: number;
    icon: string;
  }[] = [
    {
      key: "spaces",
      label: "Space Templates",
      count: spaceTemplates.length,
      icon: "📦",
    },
    {
      key: "projects",
      label: "Project Templates",
      count: projectTemplates.length,
      icon: "🏗️",
    },
    {
      key: "customs",
      label: "User Customs",
      count: customTemplates.length,
      icon: "💾",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f7f4",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 24 }}>📐</span>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Areacalc Admin
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
              Template management
            </p>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {role?.authenticated ? (
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: role.role === "admin" ? "#fef3c7" : "#dbeafe",
                  color: role.role === "admin" ? "#92400e" : "#1e3a8a",
                  fontWeight: 700,
                  border: `1px solid ${role.role === "admin" ? "#fcd34d" : "#bfdbfe"}`,
                }}
              >
                {role.role.toUpperCase()}
              </span>
            ) : (
              <a
                href="/login?next=/areacalc/admin"
                style={{
                  fontSize: 13,
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "#1d4ed8",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Sign in
              </a>
            )}
            <a
              href="/areacalc"
              style={{
                fontSize: 13,
                color: "#6b7280",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Calculator
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            gap: 2,
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                fontSize: 13,
                fontWeight: tab === t.key ? 700 : 500,
                padding: "10px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderBottom: `3px solid ${tab === t.key ? "#1d4ed8" : "transparent"}`,
                color: tab === t.key ? "#1d4ed8" : "#6b7280",
              }}
            >
              {t.icon} {t.label}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 20,
                  background: tab === t.key ? "#dbeafe" : "#f3f4f6",
                  color: tab === t.key ? "#1d4ed8" : "#9ca3af",
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>
        {tab === "spaces" && (
          <SpaceTemplatesSection
            templates={spaceTemplates}
            loading={loadingSpaces}
            onRefresh={refreshAll}
          />
        )}
        {tab === "projects" && (
          <ProjectTemplatesSection
            templates={projectTemplates}
            spaceTemplates={spaceTemplates}
            loading={loadingProjects}
            onRefresh={refreshAll}
          />
        )}
        {tab === "customs" && (
          <CustomTemplatesSection
            customs={customTemplates}
            projectTemplates={projectTemplates}
            spaceTemplates={spaceTemplates}
            loading={loadingCustoms}
            onRefresh={refreshAll}
          />
        )}
      </main>
    </div>
  );
}
