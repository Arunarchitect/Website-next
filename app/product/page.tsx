"use client";

import { useEffect, useMemo, useState } from "react";
import { Fraunces, Inter } from "next/font/google";
import {
  Role,
  OrganisationGroup,
  Space,
  ProductItem,
  Assignment,
  CATEGORIES,
  getImageSource,
  formatPrice,
  roleToUiRole,
  groupByOrganisation,
  getMyProductContext,
  getSpaces,
  getProductsByCategory,
  getAssignments,
  proposeAssignment,
  confirmAssignment,
  removeAssignment,
} from "./productApi";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

function statusLabel(a: Assignment): string {
  if (a.client_confirmed && a.architect_confirmed) return "Confirmed";
  const waitingOn = a.proposed_by === "client" ? "architect" : "client";
  return `Awaiting ${waitingOn} confirmation`;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Skeletons ────────────────────────────────────────────────────────────
function SkeletonPill() {
  return <div className="h-9 w-28 rounded-full bg-[#DCE0D8] animate-pulse" />;
}
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#DCE0D8] bg-white overflow-hidden">
      <div className="w-full h-40 bg-[#E4E8E1] animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 bg-[#E4E8E1] rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-[#E4E8E1] rounded animate-pulse" />
        <div className="h-3 w-1/3 bg-[#E4E8E1] rounded animate-pulse" />
        <div className="h-8 w-full bg-[#E4E8E1] rounded-full animate-pulse mt-3" />
      </div>
    </div>
  );
}
function SkeletonRow() {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-[#DCE0D8] bg-white px-5 py-4">
      <div className="w-20 h-20 rounded-xl bg-[#E4E8E1] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 bg-[#E4E8E1] rounded animate-pulse" />
        <div className="h-3 w-1/3 bg-[#E4E8E1] rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function ProductPage() {
  const [organisations, setOrganisations] = useState<OrganisationGroup[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [role, setRole] = useState<Role>("architect");

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounced(searchTerm, 250);

  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Initial: fetch org/project context only — fastest possible first paint
  useEffect(() => {
    (async () => {
      const entries = await getMyProductContext();
      const groups = groupByOrganisation(entries);
      setOrganisations(groups);
      if (groups.length) {
        setOrgId(groups[0].id);
        const firstProject = groups[0].projects[0];
        if (firstProject) {
          setProjectId(firstProject.id);
          setRole(roleToUiRole(firstProject.role));
        }
      }
      setLoadingContext(false);
    })();
  }, []);

  const currentOrg = organisations.find((o) => o.id === orgId);

  function handleSelectProject(pid: number, projRole: Role) {
    setProjectId(pid);
    setRole(projRole);
  }

  function handleSelectOrg(oid: number) {
    setOrgId(oid);
    const org = organisations.find((o) => o.id === oid);
    const firstProject = org?.projects[0];
    if (firstProject) {
      setProjectId(firstProject.id);
      setRole(roleToUiRole(firstProject.role));
    } else {
      setProjectId(null);
    }
  }

  // Spaces + assignments load together (parallel, not sequential)
  useEffect(() => {
    if (!projectId) return;
    setLoadingProjectData(true);
    (async () => {
      const [s, a] = await Promise.all([getSpaces(projectId), getAssignments(projectId)]);
      setSpaces(s);
      setAssignments(a);
      setSpaceId(s[0]?.id ?? null);
      setLoadingProjectData(false);
    })();
  }, [projectId]);

  // Catalog: category + search, debounced, server-side filtered
  useEffect(() => {
    if (!projectId) return;
    setLoadingCatalog(true);
    (async () => {
      const i = await getProductsByCategory(categoryId, projectId, debouncedSearch);
      setItems(i);
      setLoadingCatalog(false);
    })();
  }, [categoryId, projectId, debouncedSearch]);

  const assignmentsForSpace = useMemo(
    () => assignments.filter((a) => a.project === projectId && a.space === spaceId),
    [assignments, projectId, spaceId]
  );
  const currentSpaceName = spaces.find((s) => s.id === spaceId)?.name ?? "";

  function spaceProgress(space: Space) {
    const req = space.required_categories;
    if (req.length === 0) return { confirmed: 0, total: 0 };
    const confirmedCats = new Set(
      assignments
        .filter((a) => a.space === space.id && a.client_confirmed && a.architect_confirmed)
        .map((a) => a.product_detail?.category)
    );
    const confirmed = req.filter((c) => confirmedCats.has(c)).length;
    return { confirmed, total: req.length };
  }

  const fullySpecifiedCount = spaces.filter((s) => {
    const p = spaceProgress(s);
    return p.total > 0 && p.confirmed === p.total;
  }).length;

  const requirements = useMemo(() => {
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) return [];
    return space.required_categories.map((catCode) => {
      const cat = CATEGORIES.find((c) => c.id === catCode) ?? { id: catCode, label: catCode };
      const inCat = assignments.filter(
        (a) => a.space === spaceId && a.product_detail?.category === catCode
      );
      const confirmed = inCat.some((a) => a.client_confirmed && a.architect_confirmed);
      const pending = !confirmed && inCat.length > 0;
      return { category: cat, status: confirmed ? "confirmed" : pending ? "pending" : "needed" } as const;
    });
  }, [spaceId, spaces, assignments]);

  const itemStats = useMemo(() => {
    const map = new Map<string, { projects: Set<number>; confirmed: number; pending: number }>();
    assignments.forEach((a) => {
      const entry = map.get(a.product) ?? { projects: new Set<number>(), confirmed: 0, pending: 0 };
      entry.projects.add(a.project);
      if (a.client_confirmed && a.architect_confirmed) entry.confirmed += 1;
      else entry.pending += 1;
      map.set(a.product, entry);
    });
    return map;
  }, [assignments]);

  async function handleProposeItem(itemId: string) {
    if (!projectId || !spaceId) return;
    const created = await proposeAssignment(projectId, spaceId, itemId, role);
    setAssignments((prev) => [...prev, created]);
  }

  async function handleConfirm(id: number) {
    const updated = await confirmAssignment(id, role);
    setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  async function handleRemove(id: number) {
    await removeAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className={`${display.variable} ${body.variable} min-h-screen font-[var(--font-body)] bg-[#EDEFEA] text-[#1C2521]`}>
      <header className="border-b border-[#DCE0D8] bg-[#EDEFEA]/90 backdrop-blur px-6 sm:px-10 py-5 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs tracking-wide text-[#6B7570]">Modelflick</p>
          <h1 className="font-[var(--font-display)] text-xl sm:text-2xl font-medium">Fixture & product assignment</h1>
        </div>
        {!loadingContext && organisations.length > 0 && (
          <span className="px-4 py-1.5 rounded-full text-sm capitalize bg-[#2F6E62] text-white">
            Viewing as: {role}
          </span>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-12">
        {/* Organisation */}
        <section>
          <p className="text-sm text-[#6B7570] mb-3">Organisation</p>
          <div className="flex gap-3 flex-wrap">
            {loadingContext ? (
              <>
                <SkeletonPill /><SkeletonPill /><SkeletonPill />
              </>
            ) : organisations.length === 0 ? (
              <p className="text-sm text-[#6B7570]">No projects with product activity found for your account yet.</p>
            ) : (
              organisations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className={`rounded-full px-5 py-2.5 text-sm border transition-colors ${
                    org.id === orgId ? "bg-[#1C2521] border-[#1C2521] text-white" : "bg-white border-[#DCE0D8] hover:border-[#1C2521]"
                  }`}
                >
                  {org.name}
                </button>
              ))
            )}
          </div>
        </section>

        {/* Project — active ones (has_assignments) surface first, highlighted */}
        {!loadingContext && currentOrg && (
          <section>
            <p className="text-sm text-[#6B7570] mb-3">Project</p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {currentOrg.projects.map((p) => {
                const active = p.id === projectId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProject(p.id, roleToUiRole(p.role))}
                    className={`relative text-left min-w-[220px] rounded-2xl border px-5 py-4 transition-colors ${
                      active ? "border-[#2F6E62] bg-white" : "border-[#DCE0D8] bg-white/60 hover:bg-white"
                    }`}
                  >
                    {p.has_assignments && (
                      <span className="absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full bg-[#B8802F] text-white shadow-sm">
                        {p.assignment_count} item{p.assignment_count === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="font-[var(--font-display)] text-lg block">{p.name}</span>
                    <span className="text-xs text-[#6B7570] capitalize">Your role: {p.role}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Space */}
        {projectId && (
          <section>
            <p className="text-sm text-[#6B7570] mb-3">
              {loadingProjectData ? "Loading spaces…" : `Spaces · ${fullySpecifiedCount} of ${spaces.length} fully specified`}
            </p>
            <div className="flex gap-3 flex-wrap">
              {loadingProjectData ? (
                <><SkeletonPill /><SkeletonPill /><SkeletonPill /></>
              ) : (
                spaces.map((s) => {
                  const active = s.id === spaceId;
                  const prog = spaceProgress(s);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSpaceId(s.id)}
                      className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm border transition-colors ${
                        active ? "bg-[#2F6E62] border-[#2F6E62] text-white" : "bg-white border-[#DCE0D8] text-[#1C2521] hover:border-[#2F6E62]"
                      }`}
                    >
                      {s.name}
                      {prog.total > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-[#EDEFEA] text-[#6B7570]"}`}>
                          {prog.confirmed}/{prog.total}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </section>
        )}

        {!loadingProjectData && requirements.length > 0 && (
          <section>
            <h2 className="font-[var(--font-display)] text-xl mb-3">What {currentSpaceName || "this space"} needs</h2>
            <div className="flex flex-wrap gap-2">
              {requirements.map((r) => {
                const style =
                  r.status === "confirmed"
                    ? "bg-[#E4EFEB] border-[#2F6E62] text-[#2F6E62]"
                    : r.status === "pending"
                    ? "bg-[#F3E9D8] border-[#B8802F] text-[#8A5E20]"
                    : "bg-white border-dashed border-[#C7CDC3] text-[#6B7570]";
                return (
                  <button
                    key={r.category.id}
                    onClick={() => setCategoryId(r.category.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${style}`}
                  >
                    {r.category.label}
                    <span className="ml-2 text-xs opacity-80 capitalize">{r.status === "needed" ? "not selected" : r.status}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {projectId && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-[var(--font-display)] text-xl">Assigned to {currentSpaceName || "—"}</h2>
              <span className="text-sm text-[#6B7570]">{assignmentsForSpace.length} item{assignmentsForSpace.length === 1 ? "" : "s"}</span>
            </div>

            {loadingProjectData ? (
              <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
            ) : assignmentsForSpace.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#C7CDC3] bg-white/50 px-6 py-10 text-center text-sm text-[#6B7570]">
                Nothing assigned yet. Choose an item from the catalog below.
              </div>
            ) : (
              <div className="space-y-3">
                {assignmentsForSpace.map((a) => {
                  const item = a.product_detail;
                  const price = formatPrice(item);
                  const bothConfirmed = a.client_confirmed && a.architect_confirmed;
                  const canConfirm = (role === "client" && !a.client_confirmed) || (role === "architect" && !a.architect_confirmed);
                  return (
                    <div key={a.id} className="flex items-center gap-5 rounded-2xl border border-[#DCE0D8] bg-white px-5 py-4">
                      <img src={getImageSource(item.product_image)} alt={item.item} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-[var(--font-display)] text-lg leading-tight truncate">{item.item}</div>
                        <div className="text-sm text-[#6B7570]">{item.manufacturer} — {item.model_label}</div>
                        <div className="text-xs text-[#8A938E] capitalize mt-0.5">Proposed by {a.proposed_by}</div>
                        {price && <div className="text-sm font-medium text-[#1C2521] mt-1">{price}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${bothConfirmed ? "bg-[#E4EFEB] text-[#2F6E62]" : "bg-[#F3E9D8] text-[#8A5E20]"}`}>
                          {statusLabel(a)}
                        </span>
                        <div className="flex gap-2">
                          {canConfirm && (
                            <button onClick={() => handleConfirm(a.id)} className="text-xs bg-[#2F6E62] text-white rounded-full px-3 py-1.5">
                              Confirm
                            </button>
                          )}
                          <button onClick={() => handleRemove(a.id)} className="text-xs border border-[#DCE0D8] rounded-full px-3 py-1.5 hover:bg-[#EDEFEA]">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {projectId && (
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-[var(--font-display)] text-xl">Catalog</h2>
              <div className="flex gap-3 flex-wrap items-center">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search manufacturer, item, model…"
                  className="px-4 py-2 rounded-full border border-[#DCE0D8] bg-white text-sm w-64 focus:outline-none focus:border-[#2F6E62]"
                />
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-4 py-2 rounded-full border border-[#DCE0D8] bg-white text-sm focus:outline-none focus:border-[#2F6E62]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {loadingCatalog ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : items.length === 0 ? (
                <p className="text-sm text-[#6B7570] col-span-full text-center py-10">No matching products.</p>
              ) : (
                items.map((item) => {
                  const stats = itemStats.get(item.id);
                  const price = formatPrice(item);
                  return (
                    <div key={item.id} className="rounded-2xl border border-[#DCE0D8] bg-white overflow-hidden hover:shadow-md transition-shadow">
                      <img src={getImageSource(item.product_image)} alt={item.item} className="w-full h-40 object-cover" />
                      <div className="p-4">
                        <div className="font-[var(--font-display)] text-base">{item.item}</div>
                        <div className="text-sm text-[#6B7570]">{item.manufacturer} — {item.model_label}</div>
                        {price && <div className="text-sm font-medium text-[#1C2521] mt-1">{price}</div>}
                        {item.product_link && (
                          <a href={item.product_link} target="_blank" className="text-xs text-[#2F6E62] underline underline-offset-2">
                            Product link
                          </a>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {stats ? (
                            <>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#EDEFEA] text-[#4B5650]">
                                {stats.projects.size} project{stats.projects.size === 1 ? "" : "s"}
                              </span>
                              {stats.confirmed > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-[#E4EFEB] text-[#2F6E62]">{stats.confirmed} confirmed</span>}
                              {stats.pending > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3E9D8] text-[#8A5E20]">{stats.pending} pending</span>}
                            </>
                          ) : (
                            <span className="text-xs text-[#8A938E]">Not yet used</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleProposeItem(item.id)}
                          disabled={!spaceId}
                          className="mt-3 w-full text-sm bg-[#1C2521] text-white rounded-full py-2 disabled:opacity-40"
                        >
                          {role === "client" ? "Select for this space" : "Suggest for this space"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}