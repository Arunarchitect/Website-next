"use client";

import { useEffect, useState } from "react";
import {
  createCategory, createSubCategory, deleteCategory, deleteSubCategory,
  getApiErrorMessage, updateCategory, updateSubCategory,
  type Category,
} from "./inventoryApi";

interface Props {
  projectId: number;
  categories: Category[];
  onChanged: () => Promise<void>;
  onClose: () => void;
}

type Editing = { kind: "cat" | "sub"; id: number; text: string } | null;

const input =
  "rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300";
const link = "underline focus:outline-none focus:ring-2 focus:ring-slate-300";

export default function CategoryManager({ projectId, categories, onChanged, onClose }: Props) {
  const [newCat, setNewCat] = useState("");
  const [newSub, setNewSub] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Runs a change, reloads, and reports whether it worked. */
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await onChanged();
      return true;
    } catch (e) {
      setErr(getApiErrorMessage(e, "Couldn’t save the change."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCat.trim();
    if (!name) return;
    if (await run(() => createCategory(projectId, name))) setNewCat("");
  }

  async function addSub(e: React.FormEvent, categoryId: number) {
    e.preventDefault();
    const name = (newSub[categoryId] ?? "").trim();
    if (!name) return;
    if (await run(() => createSubCategory(categoryId, name))) {
      setNewSub((p) => ({ ...p, [categoryId]: "" }));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    const ok = await run(() =>
      editing.kind === "cat" ? updateCategory(editing.id, text) : updateSubCategory(editing.id, text)
    );
    if (ok) setEditing(null);
  }

  function removeCategory(id: number, name: string, items: number) {
    const msg = items
      ? `Delete “${name}” and its subcategories? ${items} item${items === 1 ? "" : "s"} will become uncategorised.`
      : `Delete “${name}” and its subcategories?`;
    if (window.confirm(msg)) run(() => deleteCategory(id));
  }

  function removeSub(id: number, name: string, items: number) {
    const msg = items
      ? `Delete “${name}”? ${items} item${items === 1 ? "" : "s"} will keep their category but lose the subcategory.`
      : `Delete “${name}”?`;
    if (window.confirm(msg)) run(() => deleteSubCategory(id));
  }

  const renameBox = (kind: "cat" | "sub", id: number) =>
    editing && editing.kind === kind && editing.id === id ? (
      <span className="flex items-center gap-2">
        <input
          className={input}
          autoFocus
          value={editing.text}
          onChange={(e) => setEditing({ ...editing, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") { e.stopPropagation(); setEditing(null); }
          }}
        />
        <button className={`${link} text-slate-800`} onClick={saveEdit} disabled={busy}>Save</button>
        <button className={`${link} text-slate-600`} onClick={() => setEditing(null)}>Cancel</button>
      </span>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
            <p className="mt-1 text-sm text-slate-600">
              Make your own categories and subcategories. Renaming keeps the items attached.
            </p>
          </div>
          <button onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Done
          </button>
        </div>

        {err && <p role="alert" className="mt-3 text-sm text-rose-700">{err}</p>}

        <form onSubmit={addCategory} className="mt-4 flex gap-2">
          <input
            className={`${input} flex-1`}
            placeholder="New category, e.g. Kitchen"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            aria-label="New category name"
          />
          <button type="submit" disabled={busy || !newCat.trim()} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-60">
            Add category
          </button>
        </form>

        {categories.length === 0 && (
          <p className="mt-6 text-sm text-slate-500">
            No categories yet. Add one above, or import your sheet and they are created from its Category column.
          </p>
        )}

        <ul className="mt-4 space-y-4">
          {categories.map((c) => (
            <li key={c.id} className="rounded border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {renameBox("cat", c.id) ?? (
                  <span className="font-medium text-slate-900">
                    {c.name} <span className="text-sm font-normal text-slate-500">{c.item_count ?? 0} items</span>
                  </span>
                )}
                {!(editing?.kind === "cat" && editing.id === c.id) && (
                  <span className="flex gap-3 text-sm">
                    <button className={`${link} text-slate-700`} onClick={() => setEditing({ kind: "cat", id: c.id, text: c.name })}>Rename</button>
                    <button className={`${link} text-rose-700`} onClick={() => removeCategory(c.id, c.name, c.item_count ?? 0)}>Delete</button>
                  </span>
                )}
              </div>

              <ul className="mt-2 space-y-1 border-l border-slate-200 pl-3">
                {c.subcategories.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    {renameBox("sub", s.id) ?? (
                      <span className="text-slate-800">
                        {s.name} <span className="text-slate-500">{s.item_count ?? 0} items</span>
                      </span>
                    )}
                    {!(editing?.kind === "sub" && editing.id === s.id) && (
                      <span className="flex gap-3">
                        <button className={`${link} text-slate-700`} onClick={() => setEditing({ kind: "sub", id: s.id, text: s.name })}>Rename</button>
                        <button className={`${link} text-rose-700`} onClick={() => removeSub(s.id, s.name, s.item_count ?? 0)}>Delete</button>
                      </span>
                    )}
                  </li>
                ))}
                <li>
                  <form onSubmit={(e) => addSub(e, c.id)} className="mt-1 flex gap-2">
                    <input
                      className={`${input} flex-1`}
                      placeholder={`New subcategory in ${c.name}`}
                      value={newSub[c.id] ?? ""}
                      onChange={(e) => setNewSub((p) => ({ ...p, [c.id]: e.target.value }))}
                      aria-label={`New subcategory in ${c.name}`}
                    />
                    <button type="submit" disabled={busy || !(newSub[c.id] ?? "").trim()} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      Add
                    </button>
                  </form>
                </li>
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
