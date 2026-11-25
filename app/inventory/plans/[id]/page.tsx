"use client";

/* app/inventory/plans/[id]/page.tsx */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UNITS,
  fmtQty,
  getApiErrorMessage,
  listCategories,
  listItems,
  listMyProjects,
  money,
  unitShort,
  type Category,
  type Item,
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

interface Pending {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
}

/** Quantity box that saves when you leave it. */
function LineQty({ line, onSave }: { line: PlanLine; onSave: (v: string) => void }) {
  const [v, setV] = useState(line.qty);
  useEffect(() => setV(line.qty), [line.qty]);
  const u = unitShort(line.unit);
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        step="any"
        aria-label={`Quantity of ${line.name}`}
        className={`${field} w-20 py-1`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== "" && Number(v) >= 0 && Number(v) !== Number(line.qty)) onSave(v);
          else setV(line.qty);
        }}
      />
      {u && <span className="text-xs text-slate-500">{u}</span>}
    </span>
  );
}

const qtyText = (n: number | string, unit: string) => {
  const u = unitShort(unit);
  return `${fmtQty(n)}${u ? ` ${u}` : ""}`;
};

export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const planId = Number(params.id);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [addInvLine, setAddInvLine] = useState<PlanLine | null>(null);

  // Picker (left)
  const [pickProject, setPickProject] = useState<number | null>(null);
  const [pickTick, setPickTick] = useState(0); // bump to reload the picker
  const [pickItems, setPickItems] = useState<Item[]>([]);
  const [pickCats, setPickCats] = useState<Category[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [catId, setCatId] = useState("");
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  // Quick-add (right)
  const [bName, setBName] = useState("");
  const [bQty, setBQty] = useState("1");
  const [bUnit, setBUnit] = useState<Unit>("COUNT");
  const [bRate, setBRate] = useState("");

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
        const first = pr.find((p) => p.organisation_id === pl.organisation) ?? pr[0];
        setPickProject(first?.id ?? null);
      })
      .catch((e) => setError(getApiErrorMessage(e, "Couldn’t load the plan.")));
  }, [planId]);

  useEffect(() => {
    setSearch("");
    setCatId("");
    setChosen(new Set());
  }, [pickProject]);

  useEffect(() => {
    if (pickProject == null) return;
    setPickLoading(true);
    Promise.all([listItems(pickProject), listCategories(pickProject)])
      .then(([its, cats]) => {
        setPickItems(its);
        setPickCats(cats);
      })
      .catch((e) => setError(getApiErrorMessage(e, "Couldn’t load that inventory.")))
      .finally(() => setPickLoading(false));
  }, [pickProject, pickTick]);

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

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pickItems.filter((i) => {
      if (catId === "none" ? i.category !== null : catId && i.category !== Number(catId)) return false;
      return !q || [i.name, i.variant, i.brand].some((s) => s.toLowerCase().includes(q));
    });
  }, [pickItems, search, catId]);

  const taking = (plan?.lines ?? []).filter((l) => l.source === "ITEM");
  const buying = (plan?.lines ?? []).filter((l) => l.source === "BUY");
  const buyTotal = buying.reduce((s, l) => s + (l.est_rate ? Number(l.est_rate) * Number(l.qty) : 0), 0);
  const isDone = plan?.status === "DONE";

  const fail = (e: unknown, fallback: string) => setError(getApiErrorMessage(e, fallback));

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
      setChosen(new Set());
      setNotice(`Added ${r.added} item${r.added === 1 ? "" : "s"}.`);
      await refresh();
    } catch (e) {
      fail(e, "Couldn’t add the items.");
    }
  }

  async function patchLine(line: PlanLine, patch: Partial<Pick<PlanLine, "done" | "qty">>): Promise<Plan | null> {
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

  async function changeTakingQty(line: PlanLine, v: string) {
    const p = await patchLine(line, { qty: v });
    const cur = p?.lines.find((l) => l.id === line.id);
    if (p && cur) askShortfall(cur, p);
  }

  async function removeLine(line: PlanLine) {
    try {
      await deleteLine(line.id);
      await refresh();
    } catch (e) {
      fail(e, "Couldn’t remove the line.");
    }
  }

  async function addBuy(e: React.FormEvent) {
    e.preventDefault();
    if (!bName.trim()) return;
    try {
      await addBuyLine(planId, {
        name: bName.trim(),
        qty: bQty === "" ? 1 : bQty,
        unit: bUnit,
        est_rate: bRate === "" ? null : bRate,
      });
      setBName("");
      setBQty("1");
      setBRate("");
      await refresh();
    } catch (ex) {
      fail(ex, "Couldn’t add the item to buy.");
    }
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
  const pickerOrgs = [...new Set(projects.map((p) => p.organisation_id))];

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
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
          <button onClick={() => setFinishOpen(true)} className={primaryBtn}>
            Finish plan
          </button>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Left: pick from inventory ─────────────────────────────── */}
        <section className="space-y-3 rounded border border-slate-200 bg-white p-4" aria-label="Pick from inventory">
          <h2 className="text-base font-semibold text-slate-900">Pick from my stuff</h2>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Inventory"
              className={`${field} min-w-[12rem] flex-1`}
              value={pickProject ?? ""}
              onChange={(e) => setPickProject(Number(e.target.value))}
            >
              {pickerOrgs.map((oid) => (
                <optgroup key={oid} label={projects.find((p) => p.organisation_id === oid)?.organisation_name}>
                  {projects
                    .filter((p) => p.organisation_id === oid)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <select aria-label="Category" className={field} value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">All categories</option>
              {pickCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">Uncategorised</option>
            </select>
          </div>
          <input
            className={`${field} w-full`}
            placeholder="Search item, brand"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {chosen.size > 0 && (
            <div className="flex items-center gap-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span>{chosen.size} selected</span>
              <button className={ghostBtn} onClick={() => addItems([...chosen])}>
                Add selected
              </button>
              <button className="underline" onClick={() => setChosen(new Set())}>
                Clear
              </button>
            </div>
          )}

          <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto rounded border border-slate-200">
            {pickLoading && <li className="p-4 text-center text-sm text-slate-500">Loading…</li>}
            {!pickLoading && shown.length === 0 && (
              <li className="p-4 text-center text-sm text-slate-500">
                {pickItems.length === 0 ? "This inventory has no items." : "No items match."}
              </li>
            )}
            {shown.map((i) => {
              const added = inPlan.has(i.id);
              const u = unitShort(i.unit);
              return (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Select ${i.name}`}
                    disabled={added}
                    checked={chosen.has(i.id)}
                    onChange={() =>
                      setChosen((prev) => {
                        const n = new Set(prev);
                        if (n.has(i.id)) n.delete(i.id);
                        else n.add(i.id);
                        return n;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">
                      {i.name}
                      {i.variant && <span className="font-normal text-slate-500"> · {i.variant}</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {i.code} · have {fmtQty(i.qty_have)}
                      {u && ` ${u}`}
                      {i.location_name && ` · ${i.location_name}`}
                    </div>
                  </div>
                  {added ? (
                    <span className="text-xs text-slate-500">In plan</span>
                  ) : (
                    <button className="text-slate-700 underline" onClick={() => addItems([i.id])}>
                      Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Right: the checklist ──────────────────────────────────── */}
        <section className="space-y-5 rounded border border-slate-200 bg-white p-4" aria-label="Plan checklist">
          <div>
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              Taking <span className="font-normal text-slate-500">({taking.filter((l) => l.done).length}/{taking.length} packed)</span>
            </h2>
            {taking.length === 0 && <p className="text-sm text-slate-500">Nothing yet. Add things from the left.</p>}
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
                    <LineQty line={l} onSave={(v) => changeTakingQty(l, v)} />
                    {!isDone && (
                      <button className="text-rose-700 underline" onClick={() => removeLine(l)}>
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h2 className="mb-1 text-base font-semibold text-slate-900">
              To buy <span className="font-normal text-slate-500">({buying.filter((l) => l.done).length}/{buying.length} bought)</span>
            </h2>
            <p className="mb-2 text-xs text-slate-500">
              Tick Bought when you have it. Rented or borrowed things can stay here without going into inventory.
            </p>
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
                    <div className="min-w-0 flex-1">
                      <div className={`font-medium ${l.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {l.name}
                        {parent && <span className="ml-1 font-normal text-slate-500">· extra for {parent.item_code ?? parent.name}</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {l.est_rate !== null ? `${money(l.est_rate)} each · ${money(l.line_cost)}` : "No price"}
                        {l.added_to_inventory && <span className="ml-2 text-emerald-700">Added to inventory</span>}
                      </div>
                    </div>
                    <LineQty line={l} onSave={(v) => patchLine(l, { qty: v })} />
                    {l.done && !l.added_to_inventory && !isDone && editableProjects.length > 0 && (
                      <button className={ghostBtn} onClick={() => setAddInvLine(l)}>
                        Add to inventory
                      </button>
                    )}
                    {!isDone && (
                      <button className="text-rose-700 underline" onClick={() => removeLine(l)}>
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {!isDone && (
              <form onSubmit={addBuy} className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className={`${field} min-w-[10rem] flex-1`}
                  placeholder="Something to buy"
                  aria-label="Name of item to buy"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label="Quantity"
                  className={`${field} w-20`}
                  value={bQty}
                  onChange={(e) => setBQty(e.target.value)}
                />
                <select aria-label="Unit" className={field} value={bUnit} onChange={(e) => setBUnit(e.target.value as Unit)}>
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
                  aria-label={`Rate per ${unitShort(bUnit) || "unit"}`}
                  placeholder={`₹ per ${unitShort(bUnit) || "unit"}`}
                  className={`${field} w-28`}
                  value={bRate}
                  onChange={(e) => setBRate(e.target.value)}
                />
                <button type="submit" className={ghostBtn}>
                  Add
                </button>
              </form>
            )}
            {buyTotal > 0 && <p className="mt-3 text-right text-sm font-medium text-slate-800">Estimated to buy: {money(buyTotal)}</p>}
          </div>
        </section>
      </div>

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
            setPickTick((t) => t + 1);
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