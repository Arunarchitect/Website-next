"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SchedulePerson } from "./data";

export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export const namesFor = (ids: number[] | undefined, people: SchedulePerson[]) =>
  (ids ?? [])
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");

export default function AssigneePicker({
  people,
  value,
  onChange,
  onAddPerson,
  disabled,
  compact,
}: {
  people: SchedulePerson[];
  value: number[];
  onChange: (ids: number[]) => void;
  /** Present = show the "Add consultant" form. */
  onAddPerson?: (name: string, email: string) => Promise<SchedulePerson | null>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () =>
      value
        .map((id) => people.find((p) => p.id === id))
        .filter((p): p is SchedulePerson => !!p),
    [value, people]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
        )
      : people;
  }, [people, query]);

  const openPop = () => {
    if (disabled) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const w = 272;
      setPos({
        top: Math.min(r.bottom + 4, window.innerHeight - 300),
        left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setQuery("");
      setAdding(false);
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name || !onAddPerson) return;
    setBusy(true);
    try {
      const p = await onAddPerson(name, newEmail.trim());
      if (p) {
        if (!value.includes(p.id)) onChange([...value, p.id]);
        setNewName("");
        setNewEmail("");
        setAdding(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openPop}
        className={`flex w-full flex-wrap items-center gap-1 rounded border bg-white px-1.5 py-1 text-left text-xs ${
          disabled ? "cursor-default bg-gray-50" : "hover:bg-gray-50"
        }`}
        title={namesFor(value, people) || "Assign people"}
      >
        {selected.length === 0 && (
          <span className="text-gray-400">{disabled ? "—" : "Assign…"}</span>
        )}
        {selected.map((p) => (
          <span
            key={p.id}
            className={`rounded px-1 py-0.5 text-[10px] ${
              p.linked ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
            }`}
            title={p.linked ? p.name : `${p.name} (consultant)`}
          >
            {compact && selected.length > 2 ? initialsOf(p.name) : p.name}
          </span>
        ))}
      </button>

      {open && (
        <div
          ref={popRef}
          className="fixed z-[120] w-68 rounded-md border bg-white text-xs shadow-lg"
          style={{ top: pos.top, left: pos.left, width: 272 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b p-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              className="w-full rounded border px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-2 py-1.5 text-gray-500">No matches.</div>
            )}
            {filtered.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-1.5 px-2 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="min-w-0 flex-1 truncate" title={p.email || p.name}>
                  {p.name}
                </span>
                {!p.linked && (
                  <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] text-amber-800">
                    consultant
                  </span>
                )}
              </label>
            ))}
          </div>
          {onAddPerson && (
            <div className="border-t p-1.5">
              {!adding ? (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="rounded border border-dashed px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                >
                  ＋ Add consultant
                </button>
              ) : (
                <div className="grid gap-1">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name"
                    className="rounded border px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email (optional — links them if they sign up)"
                    className="rounded border px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="rounded border px-2 py-0.5 text-[11px] hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!newName.trim() || busy}
                      onClick={() => void submitNew()}
                      className="rounded bg-black px-2 py-0.5 text-[11px] text-white disabled:opacity-40"
                    >
                      {busy ? "Adding…" : "Add & assign"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}