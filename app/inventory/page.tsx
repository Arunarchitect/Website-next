"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACTIONS,
  CONDITIONS,
  createCategory,
  createItem,
  createLocation,
  createSubCategory,
  deleteItem,
  fmtQty,
  getApiErrorMessage,
  labelOf,
  listCategories,
  listItems,
  listLocations,
  listMyProjects,
  money,
  unitShort,
  unitText,
  updateItem,
  type Category,
  type Condition,
  type Item,
  type ItemInput,
  type Location,
  type Project,
} from "./inventoryApi";
import ItemForm, { type SaveNames } from "./ItemForm";
import ImportPanel from "./ImportPanel";
import CategoryManager from "./CategoryManager";
import CustodianDialog from "./CustodianDialog";
import JsonPanel from "./JsonPanel";
import { colorName } from "./ColorField";
import { copyText, itemsToJson } from "./itemJson";

type Tab = "all" | "unrated" | "attention" | "lacking";

const needsAction = (i: Item) =>
  i.condition === "POOR" || i.condition === "BROKEN" || i.action !== "NONE";

const conditionStyle: Record<string, string> = {
  "": "border-slate-300 bg-white text-slate-500",
  GOOD: "border-emerald-300 bg-emerald-50 text-emerald-900",
  FAIR: "border-amber-300 bg-amber-50 text-amber-900",
  POOR: "border-orange-300 bg-orange-50 text-orange-900",
  BROKEN: "border-rose-300 bg-rose-50 text-rose-900",
};

const field =
  "rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300";
const ghostBtn =
  "rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50";

export default function InventoryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [custodian, setCustodian] = useState("");
  const [locationId, setLocationId] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [custodianItem, setCustodianItem] = useState<Item | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState("");

  const project = projects.find((p) => p.id === projectId) ?? null;
  const canEdit = project?.can_edit ?? false;

  // Organisations are derived from the projects response (no extra request)
  const organisations = useMemo(() => {
    const m = new Map<number, string>();
    projects.forEach((p) => {
      if (!m.has(p.organisation_id))
        m.set(p.organisation_id, p.organisation_name);
    });
    return [...m].map(([id, name]) => ({ id, name }));
  }, [projects]);

  // Projects that belong to the selected organisation
  const orgProjects = useMemo(
    () => projects.filter((p) => p.organisation_id === orgId),
    [projects, orgId],
  );

  // Switching organisation selects that organisation's first project
  function changeOrg(id: number) {
    setOrgId(id);
    setProjectId(projects.find((p) => p.organisation_id === id)?.id ?? null);
  }

  const reload = useCallback(async () => {
    if (projectId == null) return;
    const [its, locs, cats] = await Promise.all([
      listItems(projectId),
      listLocations(projectId),
      listCategories(projectId),
    ]);
    setItems(its);
    setSelected((prev) => new Set([...prev].filter((id) => its.some((i) => i.id === id))));
    setLocations(locs);
    setCategories(cats);
  }, [projectId]);

  useEffect(() => {
    listMyProjects()
      .then((ps) => {
        setProjects(ps);
        if (ps.length) {
          setOrgId(ps[0].organisation_id);
          setProjectId(ps[0].id);
        }
      })
      .catch((e) =>
        setError(getApiErrorMessage(e, "Couldn’t load your projects.")),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (projectId == null) return;
    setLoading(true);
    setCategoryId("");
    setSubcategoryId("");
    setCustodian("");
    setLocationId("");
    setSearch("");
    setTab("all");
    setSelected(new Set());
    reload()
      .catch((e) =>
        setError(getApiErrorMessage(e, "Couldn’t load the inventory.")),
      )
      .finally(() => setLoading(false));
  }, [projectId, reload]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const counts = useMemo(
    () => ({
      all: items.length,
      unrated: items.filter((i) => i.condition === "").length,
      attention: items.filter(needsAction).length,
      lacking: items.filter((i) => Number(i.gap) > 0).length,
    }),
    [items],
  );

  const subcategoryOptions = useMemo(
    () =>
      categories.find((c) => String(c.id) === categoryId)?.subcategories ?? [],
    [categories, categoryId],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (tab === "unrated" && i.condition !== "") return false;
      if (tab === "attention" && !needsAction(i)) return false;
      if (tab === "lacking" && Number(i.gap) === 0) return false;
      if (
        categoryId === "none"
          ? i.category !== null
          : categoryId && i.category !== Number(categoryId)
      )
        return false;
      if (subcategoryId && i.subcategory !== Number(subcategoryId))
        return false;
      if (
        custodian === "none"
          ? i.custodians.length > 0
          : custodian && !i.custodians.includes(Number(custodian))
      )
        return false;
      if (
        locationId === "none"
          ? i.location !== null
          : locationId && i.location !== Number(locationId)
      )
        return false;
      if (
        q &&
        ![i.name, i.variant, i.brand, i.remarks].some((s) =>
          s.toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
  }, [items, tab, search, categoryId, subcategoryId, custodian, locationId]);

  // Total value of the rows currently shown (items without a rate count as 0)
  const totalCost = useMemo(
    () => visible.reduce((sum, i) => sum + (i.cost ? Number(i.cost) : 0), 0),
    [visible],
  );

  /** Finds or creates the location / category / subcategory typed in the form. */
  async function handleSave(values: ItemInput, names: SaveNames) {
    const lname = names.location.trim();
    const cname = names.category.trim();
    const sname = names.subcategory.trim();
    if (sname && !cname)
      throw new Error("Pick a category for the subcategory.");

    let location: number | null = null;
    if (lname) {
      const found = locations.find(
        (l) => l.name.toLowerCase() === lname.toLowerCase(),
      );
      location = found
        ? found.id
        : (await createLocation(values.project, lname)).id;
    }

    let category: number | null = null;
    let subcategory: number | null = null;
    if (cname) {
      const foundCat = categories.find(
        (c) => c.name.toLowerCase() === cname.toLowerCase(),
      );
      category = foundCat
        ? foundCat.id
        : (await createCategory(values.project, cname)).id;
      if (sname) {
        const foundSub = foundCat?.subcategories.find(
          (s) => s.name.toLowerCase() === sname.toLowerCase(),
        );
        subcategory = foundSub
          ? foundSub.id
          : (await createSubCategory(category, sname)).id;
      }
    }

    const payload = { ...values, location, category, subcategory };
    if (editing) await updateItem(editing.id, payload);
    else await createItem(payload);
    await reload();
  }

  async function setCondition(item: Item, condition: Condition) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, condition } : i)),
    );
    try {
      await updateItem(item.id, { condition });
    } catch (e) {
      setError(getApiErrorMessage(e, "Couldn’t change the condition."));
      await reload();
    }
  }

  async function saveCustodians(item: Item, ids: number[]) {
    await updateItem(item.id, { custodians: ids });
    await reload();
  }

  async function remove(item: Item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteItem(item.id);
      await reload();
    } catch (e) {
      setError(getApiErrorMessage(e, "Couldn’t delete the item."));
    }
  }

  const visibleIds = visible.map((i) => i.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copySelected() {
    const chosen = items.filter((i) => selected.has(i.id));
    if (!project || chosen.length === 0) return;
    const ok = await copyText(itemsToJson(chosen, project));
    setNotice(
      ok
        ? `Copied JSON of ${chosen.length} item${chosen.length === 1 ? "" : "s"}.`
        : "Couldn’t copy to the clipboard.",
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All items" },
    { key: "unrated", label: "Not rated" },
    { key: "attention", label: "Needs action" },
    { key: "lacking", label: "Lacking" },
  ];

  if (!loading && projects.length === 0 && !error) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-slate-700">
        You are not on any project yet. Ask your organisation admin to add you
        to your family’s project.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Household inventory
          </h1>
          {project && (
            <p className="text-sm text-slate-600">
              {project.organisation_name
                ? `${project.organisation_name} · `
                : ""}
              {project.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {organisations.length > 1 && (
            <select
              aria-label="Organisation"
              className={field}
              value={orgId ?? ""}
              onChange={(e) => changeOrg(Number(e.target.value))}
            >
              {organisations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          {orgProjects.length > 1 && (
            <select
              aria-label="Project"
              className={field}
              value={projectId ?? ""}
              onChange={(e) => setProjectId(Number(e.target.value))}
            >
              {orgProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {canEdit ? (
            <>
              <button
                onClick={() => setCategoriesOpen(true)}
                className={ghostBtn}
              >
                Categories
              </button>
              <button onClick={() => setImportOpen(true)} className={ghostBtn}>
                Import from sheet
              </button>
              <button onClick={() => setJsonOpen(true)} className={ghostBtn}>
                Paste JSON
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900"
              >
                Add item
              </button>
            </>
          ) : (
            <span className="rounded bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              View only
            </span>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded bg-rose-50 p-3 text-sm text-rose-800"
        >
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

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Views">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`rounded border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-slate-300 ${
              tab === t.key
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="block text-xl font-semibold">{counts[t.key]}</span>
            <span className="text-sm">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap gap-2">
        <input
          className={`${field} min-w-[12rem] flex-1`}
          placeholder="Search item, brand, remarks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Category"
          className={field}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSubcategoryId("");
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Uncategorised</option>
        </select>
        {subcategoryOptions.length > 0 && (
          <select
            aria-label="Subcategory"
            className={field}
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
          >
            <option value="">All subcategories</option>
            {subcategoryOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Custodian"
          className={field}
          value={custodian}
          onChange={(e) => setCustodian(e.target.value)}
        >
          <option value="">Everyone</option>
          {project?.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value="none">Unassigned</option>
        </select>
        <select
          aria-label="Location"
          className={field}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <option value="none">No location</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span>{selected.size} selected</span>
          <button onClick={copySelected} className={ghostBtn}>
            Copy JSON
          </button>
          <button className="underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[80rem] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  disabled={visible.length === 0}
                />
              </th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Color</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Custodians</th>
              <th className="px-3 py-2 font-medium">Condition</th>
              <th className="px-3 py-2 font-medium">Have / need</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Rate</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={14}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td
                  colSpan={14}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  {items.length === 0
                    ? canEdit
                      ? "No items yet. Add one, or import your sheet."
                      : "No items yet."
                    : "No items match these filters."}
                </td>
              </tr>
            )}
            {visible.map((i) => {
              const u = unitShort(i.unit);
              return (
                <tr
                  key={i.id}
                  className={`border-b border-slate-100 align-top last:border-0 ${
                    selected.has(i.id) ? "bg-slate-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${i.name}`}
                      checked={selected.has(i.id)}
                      onChange={() => toggleOne(i.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{i.code}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{i.name}</div>
                    <div className="text-xs text-slate-500">
                      {[i.variant, i.brand].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {i.color ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-5 w-5 rounded border border-slate-300"
                          style={{ backgroundColor: i.color }}
                          aria-hidden="true"
                        />
                        <span className="text-xs text-slate-600">
                          {colorName(i.color) || i.color}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.category_name || (
                      <span className="text-slate-400">Uncategorised</span>
                    )}
                    {i.subcategory_name && (
                      <div className="text-xs text-slate-500">
                        {i.subcategory_name}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.location_name || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {i.custodian_details.length ? (
                      i.custodian_details.map((c) => c.name).join(", ")
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                    {canEdit && (
                      <button
                        className="ml-2 text-xs text-slate-600 underline"
                        onClick={() => setCustodianItem(i)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        aria-label={`Condition of ${i.name}`}
                        value={i.condition}
                        onChange={(e) =>
                          setCondition(i, e.target.value as Condition)
                        }
                        className={`rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 ${conditionStyle[i.condition]}`}
                      >
                        <option value="">Not rated</option>
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-block rounded border px-2 py-1 text-sm ${conditionStyle[i.condition]}`}
                      >
                        {i.condition
                          ? labelOf(CONDITIONS, i.condition)
                          : "Not rated"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {fmtQty(i.qty_have)} / {fmtQty(i.qty_needed)}
                    {Number(i.gap) > 0 && (
                      <div className="text-xs text-amber-700">
                        Short by {fmtQty(i.gap)}
                        {u && ` ${u}`}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {unitText(i.unit)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {money(i.rate)}
                    {u && i.rate !== null && (
                      <span className="text-xs text-slate-500"> / {u}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {money(i.cost)}
                  </td>
                  <td className="px-3 py-2">{labelOf(ACTIONS, i.action)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {canEdit && (
                      <>
                        <button
                          className="mr-3 text-slate-700 underline"
                          onClick={() => {
                            setEditing(i);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-rose-700 underline"
                          onClick={() => remove(i)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!loading && visible.length > 0 && totalCost > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-slate-700">
              <tr>
                <td colSpan={11} className="px-3 py-2 text-right font-medium">
                  Total cost of items shown
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {money(totalCost)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {formOpen && project && canEdit && (
        <ItemForm
          key={editing?.id ?? "new"}
          item={editing}
          projectId={project.id}
          members={project.members}
          locations={locations}
          categories={categories}
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}
      {importOpen && project && canEdit && (
        <ImportPanel
          projectId={project.id}
          onDone={reload}
          onClose={() => setImportOpen(false)}
        />
      )}
      {categoriesOpen && project && canEdit && (
        <CategoryManager
          projectId={project.id}
          categories={categories}
          onChanged={reload}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
      {custodianItem && project && canEdit && (
        <CustodianDialog
          key={custodianItem.id}
          item={custodianItem}
          members={project.members}
          onSave={(ids) => saveCustodians(custodianItem, ids)}
          onClose={() => setCustodianItem(null)}
        />
      )}
      {jsonOpen && project && canEdit && (
        <JsonPanel
          projectId={project.id}
          onDone={reload}
          onClose={() => setJsonOpen(false)}
        />
      )}
    </main>
  );
}