"use client";

import { useEffect, useState } from "react";
import {
  IssueClassification,
  CLASSIFICATION_OPTIONS,
  CLASSIFICATION_LABELS,
  getClassificationColor,
  isGatedClassification,
  SharedUser,
} from "./issueTypes";
import { AssigneeOption } from "./issueApi";

// A couple of role strings the backend already treats specially
// (Issue.DEFAULT_GATED_ROLES) — offered as quick checkboxes. Anything else
// (e.g. a custom "client" role) can still be added as free text, since
// allowed_roles is just a JSON list of strings on the backend.
const QUICK_ROLE_OPTIONS = ["admin", "manager", "member"];

// ---------------------------------------------------------------------------
// ClassificationBadge — small colored pill. Renders nothing for "general"
// by default since that's the unmarked/default state and would just add
// noise to every card.
// ---------------------------------------------------------------------------

interface ClassificationBadgeProps {
  classification: IssueClassification | string;
  hideGeneral?: boolean;
}

export function ClassificationBadge({ classification, hideGeneral = true }: ClassificationBadgeProps) {
  if (hideGeneral && classification === "general") return null;

  const color = getClassificationColor(classification);
  const label = CLASSIFICATION_LABELS[classification as IssueClassification] || classification;

  return (
    <span
      className="classification-badge"
      style={{ background: `${color}20`, color }}
    >
      <i className="ti ti-shield-lock" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AccessControlFields — the actual editable controls: classification select,
// role checkboxes (only relevant once a gated classification is chosen),
// and a shared-with member picker. Used inside ManageAccessPanel below.
// Admin-only by construction: nothing renders this unless the caller has
// already checked issue.canManageAccess.
// ---------------------------------------------------------------------------

interface AccessControlFieldsProps {
  classification: IssueClassification;
  setClassification: (c: IssueClassification) => void;
  allowedRoles: string[];
  setAllowedRoles: (roles: string[]) => void;
  sharedWith: number[];
  setSharedWith: (ids: number[]) => void;
  orgMembers: AssigneeOption[];
  loadingOrgMembers: boolean;
  sharedWithDetails: SharedUser[];
}

export function AccessControlFields({
  classification,
  setClassification,
  allowedRoles,
  setAllowedRoles,
  sharedWith,
  setSharedWith,
  orgMembers,
  loadingOrgMembers,
  sharedWithDetails,
}: AccessControlFieldsProps) {
  const [customRole, setCustomRole] = useState("");
  const gated = isGatedClassification(classification);

  const toggleRole = (role: string) => {
    setAllowedRoles(
      allowedRoles.includes(role)
        ? allowedRoles.filter((r) => r !== role)
        : [...allowedRoles, role]
    );
  };

  const toggleMember = (id: number) => {
    setSharedWith(
      sharedWith.includes(id) ? sharedWith.filter((m) => m !== id) : [...sharedWith, id]
    );
  };

  // Anyone currently shared-with who isn't in the loaded org-members list
  // (e.g. their membership changed since) — fall back to their saved label
  // so the checkbox row doesn't just say "User #12".
  const extraSharedUsers = sharedWithDetails.filter(
    (u) => !orgMembers.some((m) => m.id === u.id)
  );

  return (
    <div className="access-control-fields">
      <div className="form-field">
        <label>Classification</label>
        <select
          className="field-select"
          value={classification}
          onChange={(e) => setClassification(e.target.value as IssueClassification)}
        >
          {CLASSIFICATION_OPTIONS.map((c) => (
            <option key={c} value={c}>{CLASSIFICATION_LABELS[c]}</option>
          ))}
        </select>
        <span className="file-hint">
          {gated
            ? "Restricted — only allowed roles, the reporter/assignee, or explicitly shared users can view."
            : "Visible to everyone with organisation (or public) access, as usual."}
        </span>
      </div>

      {gated && (
        <div className="form-field">
          <label>Allowed roles</label>
          <div className="access-role-checkboxes">
            {QUICK_ROLE_OPTIONS.map((role) => (
              <label key={role} className="access-checkbox-label">
                <input
                  type="checkbox"
                  checked={allowedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {role}
              </label>
            ))}
            {allowedRoles
              .filter((r) => !QUICK_ROLE_OPTIONS.includes(r))
              .map((role) => (
                <label key={role} className="access-checkbox-label">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
          </div>
          <div className="access-custom-role-row">
            <input
              className="field-input small"
              placeholder="Add custom role…"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customRole.trim()) {
                  e.preventDefault();
                  if (!allowedRoles.includes(customRole.trim())) {
                    setAllowedRoles([...allowedRoles, customRole.trim()]);
                  }
                  setCustomRole("");
                }
              }}
            />
            <button
              type="button"
              className="btn-outline small"
              disabled={!customRole.trim()}
              onClick={() => {
                if (customRole.trim() && !allowedRoles.includes(customRole.trim())) {
                  setAllowedRoles([...allowedRoles, customRole.trim()]);
                }
                setCustomRole("");
              }}
            >
              <i className="ti ti-plus" /> Add
            </button>
          </div>
          <span className="file-hint">Leave empty to fall back to admin/member (the default).</span>
        </div>
      )}

      <div className="form-field">
        <label>Shared with (bypasses classification entirely)</label>
        {loadingOrgMembers ? (
          <div className="loading-indicator">Loading members…</div>
        ) : (
          <div className="access-member-list">
            {extraSharedUsers.map((u) => (
              <label key={u.id} className="access-checkbox-label">
                <input
                  type="checkbox"
                  checked={sharedWith.includes(u.id)}
                  onChange={() => toggleMember(u.id)}
                />
                {u.fullName || u.email}
              </label>
            ))}
            {orgMembers.map((m) => (
              <label key={m.id} className="access-checkbox-label">
                <input
                  type="checkbox"
                  checked={sharedWith.includes(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
                {m.displayName}
              </label>
            ))}
            {orgMembers.length === 0 && extraSharedUsers.length === 0 && (
              <span className="file-hint">No members found for this organisation.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ManageAccessPanel — standalone editor for classification/allowedRoles/
// sharedWith, independent of the main edit form. This is what lets an org
// admin who did NOT report the issue change access without being able to
// (or needing to) touch title/status/etc — it talks to the dedicated
// /access/ endpoint via onSave, mirroring the backend split.
// ---------------------------------------------------------------------------

interface ManageAccessPanelProps {
  classification: IssueClassification;
  allowedRoles: string[];
  sharedWith: number[];
  sharedWithDetails: SharedUser[];
  orgMembers: AssigneeOption[];
  loadingOrgMembers: boolean;
  onCancel: () => void;
  onSave: (access: {
    classification: IssueClassification;
    allowedRoles: string[];
    sharedWith: number[];
  }) => Promise<void>;
}

export function ManageAccessPanel({
  classification: initialClassification,
  allowedRoles: initialAllowedRoles,
  sharedWith: initialSharedWith,
  sharedWithDetails,
  orgMembers,
  loadingOrgMembers,
  onCancel,
  onSave,
}: ManageAccessPanelProps) {
  const [classification, setClassification] = useState(initialClassification);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(initialAllowedRoles);
  const [sharedWith, setSharedWith] = useState<number[]>(initialSharedWith);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync if the underlying issue changes out from under us (e.g. a
  // refresh landed while this panel was open).
  useEffect(() => {
    setClassification(initialClassification);
    setAllowedRoles(initialAllowedRoles);
    setSharedWith(initialSharedWith);
  }, [initialClassification, initialAllowedRoles, initialSharedWith]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ classification, allowedRoles, sharedWith });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update access.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="manage-access-panel">
      <div className="manage-access-panel-header">
        <i className="ti ti-shield-lock" />
        <span>Manage access</span>
      </div>

      {error && (
        <div className="error-banner small">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <AccessControlFields
        classification={classification}
        setClassification={setClassification}
        allowedRoles={allowedRoles}
        setAllowedRoles={setAllowedRoles}
        sharedWith={sharedWith}
        setSharedWith={setSharedWith}
        orgMembers={orgMembers}
        loadingOrgMembers={loadingOrgMembers}
        sharedWithDetails={sharedWithDetails}
      />

      <div className="form-actions">
        <button className="btn-outline" onClick={onCancel} type="button" disabled={saving}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave} type="button" disabled={saving}>
          <i className={`ti ${saving ? "ti-loader" : "ti-device-floppy"}`} />
          {saving ? "Saving…" : "Save access"}
        </button>
      </div>
    </div>
  );
}