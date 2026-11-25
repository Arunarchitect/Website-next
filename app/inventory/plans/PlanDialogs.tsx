"use client";

/* app/inventory/plans/PlanDialogs.tsx */
import { useEffect, useState, type ReactNode } from "react";
import { getApiErrorMessage, type Project } from "../inventoryApi";
import { KINDS, field, ghostBtn, primaryBtn, type PlanInput, type PlanKind } from "../planApi";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-16 w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function NewPlanDialog({
  organisations,
  onCreate,
  onClose,
}: {
  organisations: { id: number; name: string }[];
  onCreate: (v: PlanInput) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlanKind>("TRIP");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [org, setOrg] = useState<string>(organisations[0] ? String(organisations[0].id) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Give the plan a name.");
    setSaving(true);
    setErr("");
    try {
      await onCreate({
        name: name.trim(),
        kind,
        start_date: start || null,
        end_date: end || null,
        organisation: org ? Number(org) : null,
      });
    } catch (ex) {
      setErr(getApiErrorMessage(ex, "Couldn’t create the plan."));
      setSaving(false);
    }
  }

  return (
    <Modal title="New plan" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm text-slate-700">
        <label className="block">
          <span className="mb-1 block">Name</span>
          <input
            className={`${field} w-full`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Munnar trip, Moving to Kochi…"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block">Type</span>
          <select className={`${field} w-full`} value={kind} onChange={(e) => setKind(e.target.value as PlanKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block">From</span>
            <input type="date" className={`${field} w-full`} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block">To</span>
            <input type="date" className={`${field} w-full`} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {organisations.length > 0 && (
          <label className="block">
            <span className="mb-1 block">My own organisation</span>
            <select className={`${field} w-full`} value={org} onChange={(e) => setOrg(e.target.value)}>
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
              <option value="">Not set</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Items from any other organisation are marked as borrowed.
            </span>
          </label>
        )}

        {err && (
          <p role="alert" className="text-rose-700">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Creating…" : "Create plan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function FinishDialog({
  editableProjects,
  boughtCount,
  unboughtCount,
  onFinish,
  onClose,
}: {
  editableProjects: Project[];
  boughtCount: number;
  unboughtCount: number;
  onFinish: (o: { project: number | null; deleteUnbought: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const canAdd = boughtCount > 0 && editableProjects.length > 0;
  const [addToInv, setAddToInv] = useState(canAdd);
  const [project, setProject] = useState<string>(editableProjects[0] ? String(editableProjects[0].id) : "");
  const [deleteUnbought, setDeleteUnbought] = useState(unboughtCount > 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setSaving(true);
    setErr("");
    try {
      await onFinish({ project: addToInv && project ? Number(project) : null, deleteUnbought });
    } catch (ex) {
      setErr(getApiErrorMessage(ex, "Couldn’t finish the plan."));
      setSaving(false);
    }
  }

  return (
    <Modal title="Finish plan" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>The plan is marked Done. Things you took from your stock are not changed.</p>

        {boughtCount > 0 && (
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={addToInv} disabled={!canAdd} onChange={(e) => setAddToInv(e.target.checked)} />
              Add the {boughtCount} bought item{boughtCount === 1 ? "" : "s"} to inventory (name, quantity and price only)
            </label>
            {editableProjects.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">You can’t edit any inventory, so bought items can’t be added.</p>
            )}
            {addToInv && editableProjects.length > 0 && (
              <select className={`${field} mt-2 w-full`} value={project} onChange={(e) => setProject(e.target.value)}>
                {editableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.organisation_name ? `${p.organisation_name} · ` : ""}
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {unboughtCount > 0 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={deleteUnbought} onChange={(e) => setDeleteUnbought(e.target.checked)} />
            Remove the {unboughtCount} item{unboughtCount === 1 ? "" : "s"} never bought
          </label>
        )}

        {err && (
          <p role="alert" className="text-rose-700">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={go} disabled={saving} className={primaryBtn}>
            {saving ? "Finishing…" : "Finish plan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true);
    setErr("");
    try {
      await onConfirm();
      onClose();
    } catch (ex) {
      setErr(getApiErrorMessage(ex, "Something went wrong."));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-700">{message}</p>
      {err && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {err}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>
          Cancel
        </button>
        <button type="button" onClick={go} disabled={busy} className={primaryBtn}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}