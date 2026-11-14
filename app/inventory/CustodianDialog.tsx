"use client";

import { useEffect, useState } from "react";
import { getApiErrorMessage, type Item, type Member } from "./inventoryApi";

interface Props {
  item: Item;
  members: Member[];
  onSave: (ids: number[]) => Promise<void>;
  onClose: () => void;
}

export default function CustodianDialog({ item, members, onSave, onClose }: Props) {
  const [ids, setIds] = useState<number[]>(item.custodians);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: number) =>
    setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await onSave(ids);
      onClose();
    } catch (e) {
      setErr(getApiErrorMessage(e, "Couldn’t save the custodians."));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-16 w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Custodians</h2>
        <p className="mb-3 text-sm text-slate-600">
          {item.name} · none = unassigned, several = shared
        </p>

        <div className="space-y-2">
          {members.length === 0 && (
            <p className="text-sm text-slate-500">No people are on this project yet.</p>
          )}
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={ids.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.name}
            </label>
          ))}
        </div>

        {err && <p role="alert" className="mt-3 text-sm text-rose-700">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}