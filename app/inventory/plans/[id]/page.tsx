"use client";

/* app/inventory/plans/[id]/page.tsx
 *
 * One search bar does both jobs:
 *   - type a name  -> matching inventory items appear, pick one to add to Taking
 *   - nothing fits -> the last row adds what you typed to To buy
 *
 * Lines are edited with an Edit button; Save sends all changes in one update.
 * To buy lines can be starred as priority; starred lines sort to the top.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UNITS,
  fmtQty,
  getApiErrorMessage,
  listItems,
  listMyProjects,
  money,
  unitShort,
  type Project,
  type Unit,
} from "../../inventoryApi";
import {
  addBuyLine,
  addItemsToPlan,
  deleteLine,
  finishPlan,
  getPlan,
  updateLine,
  updatePlan,
  field,
  ghostBtn,
  primaryBtn,
  type Plan,
  type PlanLine,
} from "../../planApi";
import { ConfirmDialog, FinishDialog } from "../PlanDialogs";
import AddToInventoryFlow from "../AddToInventoryFlow";
import PlanJsonTool, { copyPlanForAi, type InventoryEntry } from "../PlanJsonTool";

interface Pending {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
}

/** An inventory item plus where it lives, so search results can show it. */
type Entry = InventoryEntry;

/** Values typed while a line is being edited. */
type Draft = { name: string; qty: string; unit: Unit; est_rate: string };

/** "1.000" -> "1", "2.500" -> "2.5": decimals only show when they matter. */
const plain = (x: string | number | null) => (x === null || x === "" ? "" : String(Number(x)));

const qtyText = (n: number | string, unit: string) => {
  const u = unitShort(unit);
  return `${fmtQty(n)}${u ? ` ${u}` : ""}`;
};

type Row = { kind: "item"; entry: Entry; inPlan: boolean } | { kind: "buy"; name: string };

type SortKey = "priority" | "bought" | "boughtPriority" | "az" | "za" | "newest" | "oldest";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority first" },
  { value: "bought", label: "Bought / packed first" },
  { value: "boughtPriority", label: "Bought first, then priority" },
  { value: "az", label: "A to Z" },
  { value: "za", label: "Z to A" },
  { value: "newest", label: "Newest added" },
  { value: "oldest", label: "Oldest added" },
];

/** Returns a sorted copy. Lines have no date field, so "added" order is the line id (it only grows). */
function sortLines(lines: PlanLine[], key: SortKey): PlanLine[] {
  const byName = (a: PlanLine, b: PlanLine) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }) || a.id - b.id;
  const arr = [...lines];
  switch (key) {
    case "bought": // ticked lines first (bought in To buy, packed in Taking)
      return arr.sort((a, b) => Number(b.done) - Number(a.done) || a.id - b.id);
    case "boughtPriority": // ticked lines first, then starred, then added order
      return arr.sort(
        (a, b) => Number(b.done) - Number(a.done) || Number(b.important) - Number(a.important) || a.id - b.id
      );
    case "az":
      return arr.sort(byName);
    case "za":
      return arr.sort((a, b) => byName(b, a));
    case "newest":
      return arr.sort((a, b) => b.id - a.id);
    case "oldest":
      return arr.sort((a, b) => a.id - b.id);
    default: // priority: starred first, then the order they were added
      return arr.sort((a, b) => Number(b.important) - Number(a.important) || a.id - b.id);
  }
}

export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [itemsTick, setItemsTick] = useState(0); // bump to reload inventory
  const [itemsLoading, setItemsLoading] = useState(true); // search results not complete yet
  const [loadFailed, setLoadFailed] = useState(false); // some inventory could not be loaded
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [addInvLine, setAddInvLine] = useState<PlanLine | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  // Line editing (one line at a time)
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", qty: "", unit: "COUNT" as Unit, est_rate: "" });

  // Sorting (applies to both Taking and To buy)
  const [sortBy, setSortBy] = useState<SortKey>("priority");

  // Smart search
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const p = await getPlan(planId);
    setPlan(p);
    return p;
  }, [planId]);

  useEffect(() => {
    Promise.all([getPlan(planId), listMyProjects()])
      .then(([pl, pr]) => {
        setPlan(pl);
        setProjects(pr);
      })
      .catch((e) => setError(getApiErrorMessage(e, "Couldn’t load the plan.")));
  }, [planId]);

  // Load every inventory the user can see, once, so search is instant.
  useEffect(() => {
    if (!projects.length) {
      setItemsLoading(false);
      return;
    }
    let cancelled = false;
    let failed = false;
    setItemsLoading(true);
    Promise.all(
      projects.map((p) =>
        listItems(p.id)
          .then((its) => its.map((item): Entry => ({ item, project: p.name, org: p.organisation_name })))
          .catch(() => {
            failed = true;
            return [] as Entry[];
          })
      )
    ).then((lists) => {
      if (cancelled) return;
      setEntries(lists.flat());
      setLoadFailed(failed);
      setItemsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projects, itemsTick]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const editableProjects = useMemo(() => projects.filter((p) => p.can_edit), [projects]);
  const inPlan = useMemo(
    () => new Set((plan?.lines ?? []).map((l) => l.item).filter((x): x is number => x !== null)),
    [plan]
  );

  const taking = sortLines((plan?.lines ?? []).filter((l) => l.source === "ITEM"), sortBy);
  const buying = sortLines((plan?.lines ?? []).filter((l) => l.source === "BUY"), sortBy);
  const priorityOpen = buying.filter((l) => l.important && !l.done).length;
  const buyTotal = buying.reduce((s, l) => s + (l.est_rate ? Number(l.est_rate) * Number(l.qty) : 0), 0);
  const isDone = plan?.status === "DONE";

  const fail = (e: unknown, fallback: string) => setError(getApiErrorMessage(e, fallback));

  // ── Search results ────────────────────────────────────────────────
  const q = query.trim();
  const rows: Row[] = useMemo(() => {
    if (!q) return [];
    const lc = q.toLowerCase();
    const hits = entries
      .filter(({ item: i }) => [i.name, i.variant, i.brand, i.code].some((s) => (s ?? "").toLowerCase().includes(lc)))
      .sort((a, b) => {
        const as = a.item.name.toLowerCase().startsWith(lc) ? 0 : 1;
        const bs = b.item.name.toLowerCase().startsWith(lc) ? 0 : 1;
        return as - bs || a.item.name.localeCompare(b.item.name);
      })
      .slice(0, 8)
      .map((entry): Row => ({ kind: "item", entry, inPlan: inPlan.has(entry.item.id) }));
    return [...hits, { kind: "buy", name: q }];
  }, [q, entries, inPlan]);

  useEffect(() => setActive(0), [q]);

  const open = focused && q !== "" && !isDone;

  function resetSearch() {
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  async function pick(row: Row) {
    // Never add to To buy until the inventory search has finished.
    if (row.kind === "buy" && itemsLoading) return;
    if (row.kind === "item") {
      if (row.inPlan) return;
      await addItems([row.entry.item.id]);
    } else {
      await addBuy(row.name);
    }
    resetSearch();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) pick(rows[active]);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  // ── Plan actions ──────────────────────────────────────────────────
  /** If a Taking line needs more than the stock, offer to keep the To buy list in step. */
  function askShortfall(line: PlanLine, p: Plan) {
    if (line.source !== "ITEM" || line.item === null || line.item_qty_have === null) return;
    const have = Number(line.item_qty_have);
    const short = Number((Number(line.qty) - have).toFixed(3));
    const existing = p.lines.find((b) => b.for_line === line.id);

    if (short > 0 && !existing) {
      setPending({
        title: "Add to the To buy list?",
        message: `You have ${qtyText(have, line.unit)} of ${line.name} but plan to take ${qtyText(line.qty, line.unit)}. Add the missing ${qtyText(short, line.unit)} to the To buy list?`,
        confirmLabel: "Add to To buy",
        run: async () => {
          await addBuyLine(planId, {
            name: line.name,
            qty: short,
            unit: line.unit,
            est_rate: line.item_rate,
            for_line: line.id,
          });
          await refresh();
        },
      });
    } else if (short > 0 && existing && Number(existing.qty) !== short) {
      setPending({
        title: "Update the To buy list?",
        message: `You now need ${qtyText(short, line.unit)} more of ${line.name}. Change the To buy quantity from ${qtyText(existing.qty, line.unit)} to ${qtyText(short, line.unit)}?`,
        confirmLabel: "Update quantity",
        run: async () => {
          await updateLine(existing.id, { qty: String(short) });
          await refresh();
        },
      });
    } else if (short <= 0 && existing) {
      setPending({
        title: "Remove from the To buy list?",
        message: `You have enough ${line.name} now. Remove the extra ${qtyText(existing.qty, line.unit)} from the To buy list?`,
        confirmLabel: "Remove",
        run: async () => {
          await deleteLine(existing.id);
          await refresh();
        },
      });
    }
  }

  async function addItems(ids: number[]) {
    if (!ids.length) return;
    try {
      const r = await addItemsToPlan(planId, ids);
      setNotice(`Added ${r.added} item${r.added === 1 ? "" : "s"} to Taking.`);
      const p = await refresh();
      // A new line may already be short on stock (e.g. stock is 0): offer the To buy prompt.
      const fresh = p.lines.find((l) => l.source === "ITEM" && l.item === ids[ids.length - 1]);
      if (fresh && fresh.item_qty_have !== null && Number(fresh.qty) > Number(fresh.item_qty_have)) {
        askShortfall(fresh, p);
      }
    } catch (e) {
      fail(e, "Couldn’t add the item.");
    }
  }

  async function addBuy(name: string) {
    try {
      await addBuyLine(planId, { name, qty: 1, unit: "COUNT", est_rate: null });
      setNotice(`Added “${name}” to To buy.`);
      await refresh();
    } catch (e) {
      fail(e, "Couldn’t add the item to buy.");
    }
  }

  /** Used by the checkboxes (packed / bought) and the priority star. */
  async function patchLine(
    line: PlanLine,
    patch: Partial<Pick<PlanLine, "done" | "important" | "qty" | "name" | "unit">>
  ): Promise<Plan | null> {
    setPlan((p) => p && { ...p, lines: p.lines.map((l) => (l.id === line.id ? { ...l, ...patch } : l)) });
    try {
      await updateLine(line.id, patch);
    } catch (e) {
      fail(e, "Couldn’t update the line.");
    }
    try {
      return await refresh();
    } catch {
      return null;
    }
  }

  // ── Edit / Save ───────────────────────────────────────────────────
  function startEdit(l: PlanLine) {
    setError("");
    setEditId(l.id);
    setDraft({ name: l.name, qty: plain(l.qty), unit: l.unit as Unit, est_rate: plain(l.est_rate) });
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit(l: PlanLine) {
    const name = draft.name.trim();
    if (l.source === "BUY" && !name) return setError("Name can’t be empty.");
    if (draft.qty === "" || Number(draft.qty) < 0) return setError("Enter a valid quantity.");
    if (draft.est_rate !== "" && Number(draft.est_rate) < 0) return setError("Enter a valid price.");

    const patch: Parameters<typeof updateLine>[1] = {};
    if (Number(draft.qty) !== Number(l.qty)) patch.qty = draft.qty;
    if (l.source === "BUY") {
      if (name !== l.name) patch.name = name;
      if (draft.unit !== l.unit) patch.unit = draft.unit;
      const rate = draft.est_rate === "" ? null : draft.est_rate;
      const oldRate = l.est_rate === null ? null : plain(l.est_rate);
      if (rate !== oldRate) patch.est_rate = rate;
    }

    setEditId(null);
    if (Object.keys(patch).length === 0) return;

    try {
      await updateLine(l.id, patch);
    } catch (e) {
      fail(e, "Couldn’t save the changes.");
    }
    try {
      const p = await refresh();
      const cur = p.lines.find((x) => x.id === l.id);
      if (l.source === "ITEM" && patch.qty !== undefined && cur) askShortfall(cur, p);
    } catch {
      /* ignore */
    }
  }

  async function removeLine(line: PlanLine) {
    try {
      await deleteLine(line.id);
      if (editId === line.id) setEditId(null);
      await refresh();
    } catch (e) {
      fail(e, "Couldn’t remove the line.");
    }
  }

  async function copyForAi() {
    if (!plan) return;
    const r = await copyPlanForAi(plan, entries);
    if (r.ok) setNotice(r.message);
    else setError(r.message);
  }

  async function reopen() {
    try {
      await updatePlan(planId, { status: "PLANNING" });
      setNotice("Plan reopened. You can edit it again.");
      await refresh();
    } catch (e) {
      fail(e, "Couldn’t reopen the plan.");
    }
  }

  async function finish(o: { project: number | null; deleteUnbought: boolean }) {
    const r = await finishPlan(planId, { add_bought_to_project: o.project, delete_unbought: o.deleteUnbought });
    setFinishOpen(false);
    setNotice(`Plan finished. ${r.added_to_inventory} added to inventory, ${r.removed} removed.`);
    await refresh();
  }

  if (!plan) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-sm text-slate-600">
        {error ? (
          <p role="alert" className="rounded bg-rose-50 p-3 text-rose-800">
            {error}
          </p>
        ) : (
          "Loading…"
        )}
      </main>
    );
  }

  const borrowed = (l: PlanLine) => plan.organisation !== null && l.item_org_id !== null && l.item_org_id !== plan.organisation;

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/inventory/plans" className="text-sm text-slate-600 underline">
            All plans
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{plan.name}</h1>
          <p className="text-sm text-slate-600">
            {plan.done_lines} of {plan.total_lines} ready
            {plan.organisation_name && ` · for ${plan.organisation_name}`}
            {isDone && " · Done"}
          </p>
        </div>
        {isDone ? (
          <button onClick={reopen} className={ghostBtn}>
            Reopen plan
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyForAi}
              disabled={itemsLoading}
              title={itemsLoading ? "Waiting for your inventory to load" : "Copy this plan as JSON with instructions for an AI"}
              className={`${ghostBtn} disabled:opacity-50`}
            >
              Copy for AI
            </button>
            <button onClick={() => setJsonOpen(true)} className={ghostBtn}>
              Paste JSON
            </button>
            <button onClick={() => setFinishOpen(true)} className={primaryBtn}>
              Finish plan
            </button>
          </div>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">
          {error}{" "}
          <button className="underline" onClick={() => setError("")}>
            Dismiss
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </p>
      )}

      {/* ── One search bar: inventory or To buy ─────────────────────── */}
      {!isDone && (
        <div className="relative z-20">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls="plan-search-list"
            aria-autocomplete="list"
            autoComplete="off"
            className={`${field} w-full py-3 text-base`}
            placeholder="Search your stuff, or type something new to buy…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
          />
          {!q && (
            <p className="mt-1.5 text-xs text-slate-500">
              Found in your inventory? Pick it to add it to Taking. Not there? Press Enter to add it to To buy.
            </p>
          )}

          {open && (
            <ul
              id="plan-search-list"
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {itemsLoading && (
                <li role="status" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                  />
                  Checking your inventory…
                </li>
              )}
              {!itemsLoading && loadFailed && (
                <li role="status" className="px-3 py-2 text-xs text-amber-800">
                  Couldn’t load every inventory, so results may be incomplete.
                </li>
              )}
              {rows.map((row, idx) => {
                const isActive = idx === active;
                const base = `flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  isActive ? "bg-slate-100" : ""
                }`;
                if (row.kind === "buy") {
                  return (
                    <li key="buy" role="option" aria-selected={isActive} className={rows.length > 1 ? "border-t border-slate-100" : ""}>
                      <button
                        type="button"
                        disabled={itemsLoading}
                        className={`${base} ${itemsLoading ? "cursor-wait opacity-50" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => pick(row)}
                      >
                        <span className="text-slate-900">
                          Add <span className="font-medium">“{row.name}”</span> to To buy
                        </span>
                        <span className="text-xs text-slate-500">
                          {itemsLoading ? "Waiting for search…" : rows.length > 1 ? "Not listed above" : "No match in inventory"}
                        </span>
                      </button>
                    </li>
                  );
                }
                const { item: i, project, org } = row.entry;
                const u = unitShort(i.unit);
                return (
                  <li key={i.id} role="option" aria-selected={isActive} aria-disabled={row.inPlan}>
                    <button
                      type="button"
                      disabled={row.inPlan}
                      className={`${base} ${row.inPlan ? "cursor-default opacity-60" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => pick(row)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {i.name}
                          {i.variant && <span className="font-normal text-slate-500"> · {i.variant}</span>}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {i.code} · {project} · {org}
                          {i.location_name && ` · ${i.location_name}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-600">
                        {row.inPlan ? "In plan" : `have ${fmtQty(i.qty_have)}${u ? ` ${u}` : ""}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
        <label htmlFor="plan-sort">Sort by</label>
        <select
          id="plan-sort"
          className={`${field} py-1`}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Taking ────────────────────────────────────────────────── */}
        <section className="rounded border border-slate-200 bg-white p-4" aria-label="Taking">
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            Taking <span className="font-normal text-slate-500">({taking.filter((l) => l.done).length}/{taking.length} packed)</span>
          </h2>
          {taking.length === 0 && <p className="text-sm text-slate-500">Nothing yet. Search above to add things you own.</p>}
          <ul className="divide-y divide-slate-100">
            {taking.map((l) => {
              const have = l.item_qty_have !== null ? Number(l.item_qty_have) : null;
              const short = have !== null && Number(l.qty) > have;
              const shortLine = buying.find((b) => b.for_line === l.id);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Packed: ${l.name}`}
                    checked={l.done}
                    disabled={isDone}
                    onChange={(e) => patchLine(l, { done: e.target.checked })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium ${l.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {l.name}
                      {l.item_code && <span className="ml-1 font-normal text-slate-500">{l.item_code}</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {l.item === null ? (
                        <span className="text-rose-700">This item was deleted from inventory</span>
                      ) : (
                        <>
                          {l.item_project_name}
                          {l.item_org_name && ` · ${l.item_org_name}`}
                          {borrowed(l) && (
                            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">Borrowed, return it</span>
                          )}
                          {l.added_to_inventory && (
                            <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900">Just added to inventory</span>
                          )}
                        </>
                      )}
                    </div>
                    {short && have !== null && (
                      <div className="text-xs text-amber-700">
                        Only {qtyText(have, l.unit)} in stock.{" "}
                        {shortLine ? (
                          "The rest is in the To buy list."
                        ) : (
                          !isDone && (
                            <button className="underline" onClick={() => askShortfall(l, plan)}>
                              Add {qtyText(Number(l.qty) - have, l.unit)} to To buy
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {editId === l.id ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Quantity of ${l.name}`}
                        className={`${field} w-20 py-1`}
                        value={draft.qty}
                        onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                      />
                      <button className={primaryBtn} onClick={() => saveEdit(l)}>
                        Save
                      </button>
                      <button className={ghostBtn} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-700">{qtyText(l.qty, l.unit)}</span>
                      {!isDone && (
                        <>
                          <button className={ghostBtn} onClick={() => startEdit(l)}>
                            Edit
                          </button>
                          <button className="text-rose-700 underline" onClick={() => removeLine(l)}>
                            Remove
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── To buy ────────────────────────────────────────────────── */}
        <section className="rounded border border-slate-200 bg-white p-4" aria-label="To buy">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            To buy <span className="font-normal text-slate-500">({buying.filter((l) => l.done).length}/{buying.length} bought)</span>
            {priorityOpen > 0 && (
              <span className="ml-2 text-xs font-normal text-rose-700">{priorityOpen} priority</span>
            )}
          </h2>
          <p className="mb-2 text-xs text-slate-500">
            Tick Bought when you have it. Tap the star to buy something first. Rented or borrowed things can stay here without going into inventory.
          </p>
          {buying.length === 0 && <p className="text-sm text-slate-500">Nothing to buy. Type a new name above to add it here.</p>}
          <ul className="divide-y divide-slate-100">
            {buying.map((l) => {
              const parent = l.for_line ? taking.find((t) => t.id === l.for_line) : undefined;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Bought: ${l.name}`}
                    checked={l.done}
                    disabled={isDone}
                    onChange={(e) => patchLine(l, { done: e.target.checked })}
                  />
                  <button
                    type="button"
                    disabled={isDone}
                    aria-pressed={l.important}
                    aria-label={l.important ? `Remove priority from ${l.name}` : `Mark ${l.name} as priority`}
                    title={l.important ? "Priority: buy first" : "Mark as priority"}
                    onClick={() => patchLine(l, { important: !l.important })}
                    className={`text-lg leading-none ${
                      l.important ? "text-amber-500" : "text-slate-300 hover:text-amber-500"
                    } disabled:cursor-default disabled:hover:text-slate-300`}
                  >
                    {l.important ? "★" : "☆"}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editId === l.id ? (
                      <input
                        type="text"
                        aria-label={`Name of ${l.name}`}
                        className={`${field} w-full py-1 font-medium`}
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    ) : (
                      <div className={`font-medium ${l.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {l.name}
                        {l.important && !l.done && (
                          <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-normal text-rose-800">Priority</span>
                        )}
                      </div>
                    )}
                    {parent && <div className="mt-0.5 text-xs text-slate-500">Extra for {parent.item_code ?? parent.name}</div>}
                    <div className="mt-0.5 text-xs text-slate-500">
                      {l.est_rate !== null ? `${money(l.line_cost)} total` : "No price yet"}
                      {l.added_to_inventory && <span className="ml-2 text-emerald-700">Added to inventory</span>}
                    </div>
                  </div>

                  {editId === l.id ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Quantity of ${l.name}`}
                        className={`${field} w-20 py-1`}
                        value={draft.qty}
                        onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                      />
                      <select
                        aria-label={`Unit of ${l.name}`}
                        className={`${field} py-1`}
                        value={draft.unit}
                        onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.short || "nos"}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Price per unit of ${l.name}`}
                        placeholder={`₹ per ${unitShort(draft.unit) || "unit"}`}
                        className={`${field} w-28 py-1`}
                        value={draft.est_rate}
                        onChange={(e) => setDraft({ ...draft, est_rate: e.target.value })}
                      />
                      <button className={primaryBtn} onClick={() => saveEdit(l)}>
                        Save
                      </button>
                      <button className={ghostBtn} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-700">
                        {qtyText(l.qty, l.unit)}
                        {l.est_rate !== null && ` · ${money(l.est_rate)}/${unitShort(l.unit) || "unit"}`}
                      </span>
                      {l.done && !l.added_to_inventory && !isDone && editableProjects.length > 0 && (
                        <button className={ghostBtn} onClick={() => setAddInvLine(l)}>
                          Add to inventory
                        </button>
                      )}
                      {!isDone && (
                        <>
                          <button className={ghostBtn} onClick={() => startEdit(l)}>
                            Edit
                          </button>
                          <button className="text-rose-700 underline" onClick={() => removeLine(l)}>
                            Remove
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {buyTotal > 0 && <p className="mt-3 text-right text-sm font-medium text-slate-800">Estimated to buy: {money(buyTotal)}</p>}
        </section>
      </div>

      {jsonOpen && (
        <PlanJsonTool
          plan={plan}
          entries={entries}
          inventoryReady={!itemsLoading}
          inventoryComplete={!loadFailed}
          onChanged={refresh}
          onNotice={setNotice}
          onClose={() => setJsonOpen(false)}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          onConfirm={pending.run}
          onClose={() => setPending(null)}
        />
      )}

      {addInvLine && (
        <AddToInventoryFlow
          line={addInvLine}
          parent={addInvLine.for_line ? (taking.find((t) => t.id === addInvLine.for_line) ?? null) : null}
          editableProjects={editableProjects}
          onDone={(msg) => {
            setAddInvLine(null);
            setNotice(msg);
            refresh().catch(() => undefined);
            setItemsTick((t) => t + 1);
          }}
          onClose={() => setAddInvLine(null)}
        />
      )}

      {finishOpen && (
        <FinishDialog
          editableProjects={editableProjects}
          boughtCount={buying.filter((l) => l.done && !l.added_to_inventory).length}
          unboughtCount={buying.filter((l) => !l.done).length}
          onFinish={finish}
          onClose={() => setFinishOpen(false)}
        />
      )}
    </main>
  );
}