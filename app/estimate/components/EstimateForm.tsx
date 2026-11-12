"use client";

import { useEffect, useRef, useState } from "react";
import { getProjects } from "../estimateApi";
import { Estimate, EstimateKind, EstimateStatus, Organisation, Project, QuantityConfig } from "../types";
import { firstValues, parseCsv, suggestConfig } from "../quantityCsv";
import QuantityConfigEditor from "./QuantityConfigEditor";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<void>;
  estimate: Estimate | null; // null = create
  organisations: Organisation[]; // only orgs the user can manage
}

export default function EstimateForm({ isOpen, onClose, onSave, estimate, organisations }: Props) {
  const isEdit = estimate !== null;

  const [orgId, setOrgId] = useState<number | undefined>(undefined);
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [kind, setKind] = useState<EstimateKind>("estimate");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<EstimateStatus>("draft");
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState<QuantityConfig | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    setFile(null);
    setSamples({});
    if (fileRef.current) fileRef.current.value = "";
    if (estimate) {
      setOrgId(estimate.organisation_id);
      setProjectId(estimate.project_id);
      setKind(estimate.kind ?? "estimate");
      setTitle(estimate.title);
      setDescription(estimate.description || "");
      setStatus(estimate.status);
      setConfig(estimate.kind === "quantity" && estimate.config?.columns ? estimate.config : null);
    } else {
      setOrgId(organisations.length === 1 ? organisations[0].id : undefined);
      setProjectId(undefined);
      setKind("estimate");
      setTitle("");
      setDescription("");
      setStatus("draft");
      setConfig(null);
    }
  }, [isOpen, estimate, organisations]);

  useEffect(() => {
    if (!isOpen || orgId === undefined) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    getProjects(orgId)
      .then((data) => !cancelled && setProjects(data))
      .catch(() => !cancelled && setError("Failed to load projects"));
    return () => {
      cancelled = true;
    };
  }, [isOpen, orgId]);

  // Quantities: read the chosen CSV in the browser to build the column setup
  useEffect(() => {
    if (!isOpen || kind !== "quantity" || !file) return;
    let cancelled = false;
    file
      .text()
      .then((text) => {
        if (cancelled) return;
        const parsed = parseCsv(text);
        setSamples(firstValues(parsed));
        setConfig((prev) => suggestConfig(parsed, prev));
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not read the CSV"));
    return () => {
      cancelled = true;
    };
  }, [isOpen, kind, file]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) return setError("Select a project.");
    if (!title.trim()) return setError("Title is required.");
    if (!isEdit && !file) return setError("Choose the CSV file.");
    if (file && !file.name.toLowerCase().endsWith(".csv")) return setError("Only .csv files are allowed.");
    if (kind === "quantity") {
      if (!config) return setError("Choose the quantities CSV.");
      if (!config.columns.some((c) => c.show)) return setError("Show at least one column.");
    }

    const fd = new FormData();
    fd.append("project_id", String(projectId));
    fd.append("kind", kind);
    fd.append("title", title.trim());
    fd.append("description", description);
    fd.append("status", status);
    if (kind === "quantity" && config) fd.append("config", JSON.stringify(config));
    if (file) fd.append("file", file);

    try {
      setSaving(true);
      await onSave(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  const fileLabel = isEdit
    ? "Replace CSV (old file is deleted)"
    : kind === "quantity"
      ? "Quantities CSV (e.g. Blender / Bonsai schedule export)"
      : "Estimate CSV (from Bonsai)";

  return (
    <div className="est-modal-overlay" onClick={saving ? undefined : onClose}>
      <form className="est-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="est-modal-head">
          <h2>{isEdit ? "Edit" : "New upload"}</h2>
          <button type="button" className="est-icon-btn" onClick={onClose} disabled={saving} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="est-modal-body">
          <label className="est-field">
            <span>Type</span>
            <select value={kind} disabled={isEdit} onChange={(e) => setKind(e.target.value as EstimateKind)}>
              <option value="estimate">Cost estimate (Bonsai CSV)</option>
              <option value="quantity">Quantities (any CSV — group &amp; sum)</option>
            </select>
          </label>

          <div className="est-field-row">
            <label className="est-field">
              <span>Organisation</span>
              <select
                value={orgId ?? ""}
                onChange={(e) => {
                  setOrgId(e.target.value ? Number(e.target.value) : undefined);
                  setProjectId(undefined);
                }}
              >
                <option value="">Select organisation</option>
                {organisations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="est-field">
              <span>Project</span>
              <select
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)}
                disabled={orgId === undefined}
              >
                <option value="">{orgId === undefined ? "Select organisation first" : "Select project"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="est-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "quantity" ? "e.g. Plumbing pipe quantities" : "e.g. Toilet & kitchen renovation"}
            />
          </label>

          <label className="est-field">
            <span>Description (optional)</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <label className="est-field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as EstimateStatus)}>
              <option value="draft">Draft (hidden from clients)</option>
              <option value="published">Published (visible to project clients)</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="est-field">
            <span>{fileLabel}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {isEdit && !file && estimate?.original_filename && (
              <small className="est-hint">Current: {estimate.original_filename}</small>
            )}
          </label>

          {kind === "quantity" && config && (
            <QuantityConfigEditor config={config} samples={samples} onChange={setConfig} />
          )}

          {error && (
            <div className="est-form-error" role="alert">
              <i className="ti ti-alert-circle" /> {error}
            </div>
          )}
        </div>

        <div className="est-modal-foot">
          <button type="button" className="est-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="est-btn est-btn-primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}