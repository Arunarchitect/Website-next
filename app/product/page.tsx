// page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./product.css";
import ProductListPrintButton from "./ProductListPrint";
import ProductCatalog, { PriceBlock, ProductLink, useDebounced } from "./ProductCatalog";
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
  confirmAssignment,
  removeAssignment,
  declineAssignment,
  undeclineAssignment,
  editAssignmentNote,
  createSpace,
  updateSpace,
  deleteSpace,
} from "./productApi";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

const EMPTY_SPACE_FORM = {
  name: "",
  required_categories: [] as string[],
};

type ApiError = {
  response?: {
    data?: {
      organisation?: string[];
      name?: string[];
      detail?: string;
    };
  };
};

function isApiError(err: unknown): err is ApiError {
  return typeof err === "object" && err !== null && "response" in err;
}

function getErrorMessage(err: unknown, field: "organisation" | "name", fallback: string): string {
  if (isApiError(err)) {
    const data = err.response?.data;
    const fieldMessage = field === "organisation" ? data?.organisation?.[0] : data?.name?.[0];
    return fieldMessage || data?.detail || fallback;
  }
  return fallback;
}

function statusLabel(a: Assignment): string {
  if (a.declined) {
    const decliner = a.declined_by === "client" ? "Client" : "Architect";
    return `Declined by ${decliner}`;
  }
  if (a.client_confirmed && a.architect_confirmed) return "Confirmed";
  const waitingOn = a.proposed_by === "client" ? "architect" : "client";
  return `Awaiting ${waitingOn} confirmation`;
}

function sumByCurrency(products: ProductItem[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  products.forEach((item) => {
    const value = item.effective_price ?? item.base_price;
    if (value === null || value === undefined) return;
    const num = Number(value);
    if (Number.isNaN(num)) return;
    const currency = item.currency || "INR";
    totals.set(currency, (totals.get(currency) ?? 0) + num);
  });
  return Array.from(totals.entries()).map(([currency, total]) => ({ currency, total }));
}

function formatTotal(t: { currency: string; total: number }): string {
  return `${t.currency} ${t.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

interface ScrollableSectionProps {
  children: React.ReactNode;
  itemCount?: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

function ScrollableSection({ children, scrollRef, className = "" }: ScrollableSectionProps) {
  return (
    <div ref={scrollRef} className={`pf-scroll-row flex gap-3 overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}

function SkeletonPill() {
  return <div className="pf-skeleton h-9 w-28 rounded-full animate-pulse flex-shrink-0" />;
}
function SkeletonRow() {
  return (
    <div className="pf-row flex items-center gap-4 sm:gap-5 rounded-2xl px-4 sm:px-5 py-4">
      <div className="pf-skeleton-light w-16 h-16 sm:w-20 sm:h-20 rounded-xl animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="pf-skeleton-light h-4 w-1/2 rounded animate-pulse" />
        <div className="pf-skeleton-light h-3 w-1/3 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function ProductPage() {
  const [organisations, setOrganisations] = useState<OrganisationGroup[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [role, setRole] = useState<Role>("architect");
  const [rawRole, setRawRole] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState("");

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);

  const [filterSpaceIds, setFilterSpaceIds] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");
  const debouncedFilterSearch = useDebounced(filterSearch, 250);

  const [catalogAll, setCatalogAll] = useState<ProductItem[]>([]);

  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [spaceForm, setSpaceForm] = useState(EMPTY_SPACE_FORM);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const [decliningNoteId, setDecliningNoteId] = useState<number | null>(null);
  const [declineNoteText, setDeclineNoteText] = useState("");

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const orgScrollRef = useRef<HTMLDivElement>(null);
  const projectScrollRef = useRef<HTMLDivElement>(null);
  const spaceScrollRef = useRef<HTMLDivElement>(null);
  const filterSpaceScrollRef = useRef<HTMLDivElement>(null);

  function isBusy(key: string) {
    return busyKeys.has(key);
  }

  async function runExclusive(key: string, fn: () => Promise<void>) {
    if (busyKeys.has(key)) return;
    setBusyKeys((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const entries = await getMyProductContext();
        const groups = groupByOrganisation(entries);
        setOrganisations(groups);
        if (groups.length) {
          setOrgId(groups[0].id);
          const firstProject = groups[0].projects[0];
          if (firstProject) {
            setProjectId(firstProject.id);
            setRole(roleToUiRole(firstProject.role));
            setRawRole(firstProject.role);
          }
        }
      } catch (err) {
        console.error('Failed to load product context:', err);
      } finally {
        setLoadingContext(false);
      }
    })();
  }, []);

  const currentOrg = organisations.find((o) => o.id === orgId);

  const isViewOnly = rawRole === "member" || rawRole === "manager";

  const filteredProjects = useMemo(() => {
    if (!currentOrg) return [];
    const term = projectSearch.trim().toLowerCase();
    if (!term) return currentOrg.projects;
    return currentOrg.projects.filter((p) => p.name.toLowerCase().includes(term));
  }, [currentOrg, projectSearch]);

  function handleSelectProject(pid: number, projRole: Role, raw: string) {
    setProjectId(pid);
    setRole(projRole);
    setRawRole(raw);
  }

  function handleSelectOrg(oid: number) {
    setOrgId(oid);
    setProjectSearch("");
    const org = organisations.find((o) => o.id === oid);
    const firstProject = org?.projects[0];
    if (firstProject) {
      setProjectId(firstProject.id);
      setRole(roleToUiRole(firstProject.role));
      setRawRole(firstProject.role);
    } else {
      setProjectId(null);
      setRawRole("");
    }
  }

  async function reloadProjectData(pid: number, keepSpaceId?: number | null) {
    setLoadingProjectData(true);
    const [s, a] = await Promise.all([getSpaces(pid), getAssignments(pid)]);
    setSpaces(s);
    setAssignments(a);
    setFilterSpaceIds(new Set(s.map((sp) => sp.id)));
    if (keepSpaceId && s.some((sp) => sp.id === keepSpaceId)) {
      setSpaceId(keepSpaceId);
    } else {
      setSpaceId(s[0]?.id ?? null);
    }
    setLoadingProjectData(false);
  }

  useEffect(() => {
    if (!projectId) return;
    reloadProjectData(projectId);
  }, [projectId]);

  const refetchCatalog = useCallback(async () => {
    if (!projectId) return;
    setLoadingCatalog(true);
    try {
      const result = await getProductsByCategory("", projectId);
      // ✅ getProductsByCategory returns a PaginatedResult, not an array.
      setCatalogAll(result.items);
    } finally {
      setLoadingCatalog(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setCatalogAll([]);
      return;
    }
    refetchCatalog();
  }, [projectId, refetchCatalog]);

  const priceIndex = useMemo(() => {
    const map: Record<string, ProductItem> = {};
    // Guard against non-array values so a bad payload can never crash the page.
    if (Array.isArray(catalogAll)) {
      catalogAll.forEach((p) => { map[p.id] = p; });
    }
    return map;
  }, [catalogAll]);

  const pricedProduct = useCallback(
    (item: ProductItem): ProductItem => priceIndex[item.id] ?? item,
    [priceIndex]
  );

  const assignmentsForSpace = useMemo(
    () => assignments.filter((a) => a.project === projectId && a.space === spaceId),
    [assignments, projectId, spaceId]
  );
  // ✅ Used in the spaces section header — shows how many assignments the
  // currently-selected space has, independent of the filter chips below.
  const currentSpaceItemCount = assignmentsForSpace.length;

  const currentSpaceName = spaces.find((s) => s.id === spaceId)?.name ?? "";
  const currentProjectName = currentOrg?.projects.find((p) => p.id === projectId)?.name ?? "";

  const spaceNameById = useMemo(() => {
    const map = new Map<number, string>();
    spaces.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [spaces]);

  const filteredAssignments = useMemo(() => {
    const term = debouncedFilterSearch.trim().toLowerCase();
    return assignments.filter((a) => {
      if (a.project !== projectId) return false;
      if (!filterSpaceIds.has(a.space)) return false;
      const item = pricedProduct(a.product_detail);
      if (filterCategory && item.category !== filterCategory) return false;
      if (term) {
        const hay = `${item.item} ${item.manufacturer} ${item.model_label}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, projectId, filterSpaceIds, filterCategory, debouncedFilterSearch, pricedProduct]);

  const filteredTotals = useMemo(
    () => sumByCurrency(filteredAssignments.map((a) => pricedProduct(a.product_detail))),
    [filteredAssignments, pricedProduct]
  );

  const filteredPrintRows = useMemo(
    () =>
      filteredAssignments.map((a) => {
        const item = pricedProduct(a.product_detail);
        return {
          space: spaceNameById.get(a.space) ?? "—",
          item: item.item,
          manufacturer: item.manufacturer,
          model_label: item.model_label,
          priceLabel: formatPrice(item),
          status: statusLabel(a),
          proposed_by: a.proposed_by,
          imageSrc: getImageSource(item, { preferThumbnail: true }),
          product_link: item.product_link || null,
          proposerNote: a.proposer_note || null,
          declinedNote: a.declined ? a.declined_note || null : null,
        };
      }),
    [filteredAssignments, pricedProduct, spaceNameById]
  );

  const filterScopeLabel = useMemo(() => {
    const spaceLabel = (() => {
      if (spaces.length === 0) return "All spaces";
      if (filterSpaceIds.size === spaces.length) return "All spaces";
      if (filterSpaceIds.size === 0) return "No spaces selected";
      return spaces.filter((s) => filterSpaceIds.has(s.id)).map((s) => s.name).join(", ");
    })();
    const catLabel = filterCategory ? CATEGORIES.find((c) => c.id === filterCategory)?.label : null;
    const searchLabel = filterSearch.trim() ? `Search: "${filterSearch.trim()}"` : null;
    const parts = [spaceLabel];
    if (catLabel) parts.push(catLabel);
    if (searchLabel) parts.push(searchLabel);
    return parts.join(" · ");
  }, [spaces, filterSpaceIds, filterCategory, filterSearch]);

  function toggleFilterSpace(id: number) {
    setFilterSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFilterSpaces() {
    setFilterSpaceIds(new Set(spaces.map((s) => s.id)));
  }

  function clearFilterSpaces() {
    setFilterSpaceIds(new Set());
  }

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

  function handleAssignmentCreated(created: Assignment) {
    setAssignments((prev) => [...prev, created]);
  }

  async function handleConfirm(id: number) {
    await runExclusive(`confirm-${id}`, async () => {
      const updated = await confirmAssignment(id, role);
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    });
  }

  async function handleRemove(id: number) {
    await runExclusive(`remove-${id}`, async () => {
      await removeAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    });
  }

  function openDeclineNote(id: number) {
    setDecliningNoteId(id);
    setDeclineNoteText("");
  }

  function cancelDeclineNote() {
    setDecliningNoteId(null);
    setDeclineNoteText("");
  }

  async function handleDecline(id: number, note: string) {
    await runExclusive(`decline-${id}`, async () => {
      const updated = await declineAssignment(id, note);
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setDecliningNoteId(null);
      setDeclineNoteText("");
    });
  }

  async function handleUndoDecline(id: number) {
    await runExclusive(`undecline-${id}`, async () => {
      const updated = await undeclineAssignment(id);
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    });
  }

  function openEditNote(a: Assignment) {
    setEditingNoteId(a.id);
    setEditNoteText(a.proposer_note ?? "");
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setEditNoteText("");
  }

  async function handleSaveNote(id: number, note: string) {
    await runExclusive(`edit-note-${id}`, async () => {
      const updated = await editAssignmentNote(id, note);
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setEditingNoteId(null);
      setEditNoteText("");
    });
  }

  function openAddSpace() {
    setEditingSpaceId(null);
    setSpaceForm(EMPTY_SPACE_FORM);
    setSpaceError(null);
    setShowSpaceModal(true);
  }

  function openEditSpace(space: Space) {
    setEditingSpaceId(space.id);
    setSpaceForm({ name: space.name, required_categories: [...space.required_categories] });
    setSpaceError(null);
    setShowSpaceModal(true);
  }

  function openEditSelectedSpace() {
    const space = spaces.find((s) => s.id === spaceId);
    if (space) {
      openEditSpace(space);
    }
  }

  function closeSpaceModal() {
    const savingKey = editingSpaceId ? `save-space-${editingSpaceId}` : "save-space-new";
    if (isBusy(savingKey) || (editingSpaceId && isBusy(`delete-space-${editingSpaceId}`))) return;
    setShowSpaceModal(false);
    setEditingSpaceId(null);
    setSpaceForm(EMPTY_SPACE_FORM);
    setSpaceError(null);
  }

  function toggleSpaceCategory(catId: string) {
    setSpaceForm((prev) => ({
      ...prev,
      required_categories: prev.required_categories.includes(catId)
        ? prev.required_categories.filter((c) => c !== catId)
        : [...prev.required_categories, catId],
    }));
  }

  async function handleSaveSpace() {
    if (!projectId) return;
    if (!spaceForm.name.trim()) {
      setSpaceError("Give the space a name.");
      return;
    }
    const key = editingSpaceId ? `save-space-${editingSpaceId}` : "save-space-new";
    await runExclusive(key, async () => {
      setSpaceError(null);
      try {
        if (editingSpaceId) {
          await updateSpace(editingSpaceId, {
            name: spaceForm.name.trim(),
            required_categories: spaceForm.required_categories,
          });
          await reloadProjectData(projectId, editingSpaceId);
        } else {
          const created = await createSpace(projectId, spaceForm.name.trim(), spaceForm.required_categories);
          await reloadProjectData(projectId, created.id);
        }
        setShowSpaceModal(false);
        setEditingSpaceId(null);
        setSpaceForm(EMPTY_SPACE_FORM);
      } catch (err: unknown) {
        setSpaceError(getErrorMessage(err, "name", "Couldn't save the space. Please try again."));
      }
    });
  }

  async function handleDeleteSpace(id: number) {
    if (!projectId) return;
    await runExclusive(`delete-space-${id}`, async () => {
      await deleteSpace(id);
      await reloadProjectData(projectId, spaceId === id ? null : spaceId);
      setShowSpaceModal(false);
      setEditingSpaceId(null);
      setSpaceForm(EMPTY_SPACE_FORM);
    });
  }

  const savingSpaceKey = editingSpaceId ? `save-space-${editingSpaceId}` : "save-space-new";
  const savingSpace = isBusy(savingSpaceKey);
  const deletingSpace = editingSpaceId ? isBusy(`delete-space-${editingSpaceId}`) : false;

  return (
    <div className={`${display.variable} ${body.variable} pf-page min-h-screen font-[var(--font-body)]`}>
      <header className="pf-header px-4 sm:px-6 lg:px-10 py-3.5 sm:py-5 flex items-center justify-between gap-3 flex-wrap sticky top-0 z-10">
        <div className="min-w-0">
          <p className="pf-eyebrow text-xs tracking-wide">Modelflick</p>
          <h1 className="font-[var(--font-display)] text-lg sm:text-2xl font-medium leading-tight truncate">
            Fixture &amp; product assignment
          </h1>
        </div>
        {!loadingContext && organisations.length > 0 && (
          <span className="pf-role-badge px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm capitalize flex-shrink-0">
            {role}
          </span>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-8 sm:space-y-10">
        <section>
          <p className="pf-muted text-sm mb-3">Organisation</p>
          <ScrollableSection scrollRef={orgScrollRef} itemCount={organisations.length}>
            {loadingContext ? (
              <>
                <SkeletonPill /><SkeletonPill /><SkeletonPill />
              </>
            ) : organisations.length === 0 ? (
              <p className="pf-muted text-sm">No projects with product activity found for your account yet.</p>
            ) : (
              organisations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className={`touch-manipulation flex-shrink-0 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-sm border whitespace-nowrap ${org.id === orgId ? "pf-pill-active" : "pf-pill"}`}
                >
                  {org.name}
                </button>
              ))
            )}
          </ScrollableSection>
        </section>

        {!loadingContext && currentOrg && (
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="pf-muted text-sm">Project</p>
              {currentOrg.projects.length > 5 && (
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="pf-input px-3 py-1.5 rounded-full text-xs w-40 sm:w-48"
                />
              )}
            </div>
            <ScrollableSection scrollRef={projectScrollRef} itemCount={filteredProjects.length}>
              {filteredProjects.length === 0 ? (
                <p className="pf-muted text-sm">No projects match &quot;{projectSearch}&quot;.</p>
              ) : (
                filteredProjects.map((p) => {
                  const active = p.id === projectId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProject(p.id, roleToUiRole(p.role), p.role)}
                      className={`touch-manipulation relative text-left flex-shrink-0 min-w-[190px] sm:min-w-[220px] rounded-2xl border px-4 sm:px-5 py-3.5 sm:py-4 ${
                        active ? "pf-project-card-active" : "pf-project-card-inactive"
                      }`}
                    >
                      {p.has_assignments && (
                        <span className="pf-badge-count absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                          {p.assignment_count} item{p.assignment_count === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="font-[var(--font-display)] text-base sm:text-lg block truncate">{p.name}</span>
                      <span className="pf-muted text-xs capitalize">Your role: {p.role}</span>
                    </button>
                  );
                })
              )}
            </ScrollableSection>
          </section>
        )}

        {projectId && (
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="pf-muted text-sm">
                {loadingProjectData
                  ? "Loading spaces…"
                  : `Spaces · ${fullySpecifiedCount} of ${spaces.length} fully specified${
                      spaceId && currentSpaceItemCount > 0
                        ? ` · ${currentSpaceItemCount} item${currentSpaceItemCount === 1 ? "" : "s"} in ${currentSpaceName}`
                        : ""
                    }`}
              </p>
              {!isViewOnly && (
                <div className="flex gap-2">
                  {spaceId && spaces.length > 0 && (
                    <button
                      onClick={openEditSelectedSpace}
                      className="touch-manipulation pf-btn-outline rounded-full px-4 py-1.5 text-sm flex-shrink-0"
                    >
                      Edit selected
                    </button>
                  )}
                  <button
                    onClick={openAddSpace}
                    className="touch-manipulation pf-btn-outline-accent rounded-full px-4 py-1.5 text-sm flex-shrink-0"
                  >
                    Add space
                  </button>
                </div>
              )}
            </div>

            <ScrollableSection scrollRef={spaceScrollRef} itemCount={spaces.length}>
              {loadingProjectData ? (
                <><SkeletonPill /><SkeletonPill /><SkeletonPill /></>
              ) : spaces.length === 0 ? (
                <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-6 text-sm text-center w-full">
                  No spaces yet for this project. {isViewOnly ? "" : "Add one (e.g. \"Master Bedroom\", \"Kitchen\") to start assigning products."}
                </div>
              ) : (
                spaces.map((s) => {
                  const active = s.id === spaceId;
                  const prog = spaceProgress(s);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSpaceId(s.id)}
                      className={`touch-manipulation flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-sm border whitespace-nowrap ${
                        active ? "pf-space-pill-active" : "pf-space-pill"
                      }`}
                    >
                      {s.name}
                      {prog.total > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "pf-badge-soft-on-active" : "pf-badge-soft"}`}>
                          {prog.confirmed}/{prog.total}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </ScrollableSection>
          </section>
        )}

        {!loadingProjectData && requirements.length > 0 && (
          <section>
            <h2 className="font-[var(--font-display)] text-lg sm:text-xl mb-3">What {currentSpaceName || "this space"} needs</h2>
            <div className="flex flex-wrap gap-2">
              {requirements.map((r) => {
                const style =
                  r.status === "confirmed" ? "pf-req-confirmed" : r.status === "pending" ? "pf-req-pending" : "pf-req-needed";
                return (
                  <button
                    key={r.category.id}
                    onClick={() => setCategoryId(r.category.id)}
                    className={`touch-manipulation rounded-full border px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm ${style}`}
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
            <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl">Assigned products</h2>
              <div className="flex items-center gap-3">
                <span className="pf-muted text-sm">{filteredAssignments.length} item{filteredAssignments.length === 1 ? "" : "s"}</span>
                {filteredAssignments.length > 0 && (
                  <ProductListPrintButton
                    orgName={currentOrg?.name ?? ""}
                    projectName={currentProjectName}
                    scopeLabel={filterScopeLabel}
                    rows={filteredPrintRows}
                    totals={filteredTotals}
                    className="pf-btn-outline text-xs rounded-full px-3 py-1.5"
                    label="Print"
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 sm:items-center mt-4 mb-3">
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search manufacturer, item, model…"
                className="pf-input px-4 py-2.5 sm:py-2 rounded-full text-sm w-full sm:w-64"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pf-input px-4 py-2.5 sm:py-2 rounded-full text-sm w-full sm:w-auto"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {spaces.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <span className="pf-muted text-sm">Spaces</span>
                  <div className="flex gap-3 text-sm">
                    <button onClick={selectAllFilterSpaces} className="touch-manipulation pf-link">Select all</button>
                    <button onClick={clearFilterSpaces} className="touch-manipulation pf-link">Clear</button>
                  </div>
                </div>
                <ScrollableSection scrollRef={filterSpaceScrollRef} itemCount={spaces.length}>
                  {spaces.map((s) => {
                    const checked = filterSpaceIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border cursor-pointer flex-shrink-0 whitespace-nowrap ${
                          checked ? "pf-checkbox-label-active" : "pf-checkbox-label"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFilterSpace(s.id)}
                          className="pf-checkbox-input"
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </ScrollableSection>
              </div>
            )}

            {filteredTotals.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {filteredTotals.map((t) => (
                  <span key={t.currency} className="pf-total-pill text-sm font-medium rounded-full px-3 py-1">
                    Total: {formatTotal(t)}
                  </span>
                ))}
              </div>
            )}

            {loadingProjectData ? (
              <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
            ) : spaces.length === 0 ? (
              <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-10 text-center text-sm">
                Add a space above, then assign products to it.
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-10 text-center text-sm">
                {filterSpaceIds.size === 0
                  ? "No spaces selected above."
                  : "Nothing matches this filter yet."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssignments.map((a) => {
                  const item = pricedProduct(a.product_detail);
                  const bothConfirmed = a.client_confirmed && a.architect_confirmed;
                  const canConfirm = !isViewOnly && !a.declined && ((role === "client" && !a.client_confirmed) || (role === "architect" && !a.architect_confirmed));

                  const isProposer = a.proposed_by === role;
                  const canHardDelete = !isViewOnly && isProposer;
                  const canDecline = !isViewOnly && !isProposer && !a.declined;
                  const canUndoDecline = !isViewOnly && a.declined && a.declined_by === role;
                  const confirmKey = `confirm-${a.id}`;
                  const removeKey = `remove-${a.id}`;
                  const declineKey = `decline-${a.id}`;
                  const undeclineKey = `undecline-${a.id}`;
                  const editNoteKey = `edit-note-${a.id}`;
                  const isConfirming = isBusy(confirmKey);
                  const isRemoving = isBusy(removeKey);
                  const isDeclining = isBusy(declineKey);
                  const isUndeclining = isBusy(undeclineKey);
                  const isSavingNote = isBusy(editNoteKey);
                  const noteBoxOpen = decliningNoteId === a.id;
                  const editNoteBoxOpen = editingNoteId === a.id;

                  return (
                    <div key={a.id} className="pf-row flex flex-col gap-3 rounded-2xl px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                        <div className="flex items-center gap-4 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getImageSource(item)}
                            alt={item.item}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-white flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="pf-badge-soft text-[11px] px-2 py-0.5 rounded-full inline-block mb-1">
                              {spaceNameById.get(a.space) ?? "—"}
                            </span>
                            <div className="font-[var(--font-display)] text-base sm:text-lg leading-tight truncate">{item.item}</div>
                            <div className="pf-muted text-sm truncate">{item.manufacturer} — {item.model_label}</div>
                            <div className="pf-faint text-xs capitalize mt-0.5">Proposed by {a.proposed_by}</div>
                            <PriceBlock item={item} />
                            {item.product_link && (
                              <ProductLink
                                href={item.product_link}
                                className="pf-link text-xs underline underline-offset-2 mt-1 inline-block"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                          <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${
                            a.declined ? "pf-btn-danger-outline" : bothConfirmed ? "pf-status-confirmed" : "pf-status-pending"
                          }`}>
                            {statusLabel(a)}
                          </span>
                          {!isViewOnly && (
                            <div className="flex gap-2 flex-wrap justify-end">
                              {canConfirm && (
                                <button
                                  onClick={() => handleConfirm(a.id)}
                                  disabled={isConfirming}
                                  className="touch-manipulation pf-btn-accent text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  {isConfirming ? "Confirming…" : "Confirm"}
                                </button>
                              )}
                              {canHardDelete && (
                                <button
                                  onClick={() => handleRemove(a.id)}
                                  disabled={isRemoving}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  {isRemoving ? "Removing…" : "Remove"}
                                </button>
                              )}
                              {isProposer && !editNoteBoxOpen && (
                                <button
                                  onClick={() => openEditNote(a)}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5"
                                >
                                  {a.proposer_note ? "Edit note" : "Add note"}
                                </button>
                              )}
                              {canDecline && !noteBoxOpen && (
                                <button
                                  onClick={() => openDeclineNote(a.id)}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5"
                                >
                                  Decline
                                </button>
                              )}
                              {canUndoDecline && (
                                <button
                                  onClick={() => handleUndoDecline(a.id)}
                                  disabled={isUndeclining}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  {isUndeclining ? "Undoing…" : "Undo decline"}
                                </button>
                              )}
                              {!canHardDelete && !canDecline && !canUndoDecline && a.declined && (
                                <span className="pf-faint text-xs px-3 py-1.5">Declined</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {a.proposer_note && !editNoteBoxOpen && (
                        <div className="pf-empty-dashed rounded-xl px-4 py-2.5 text-sm">
                          <span className="pf-faint text-xs uppercase tracking-wide block mb-0.5">
                            Note from {a.proposed_by === "client" ? "client" : "architect"}
                          </span>
                          {a.proposer_note}
                        </div>
                      )}

                      {editNoteBoxOpen && (
                        <div className="pf-empty-dashed rounded-xl px-4 py-3 space-y-2">
                          <label className="text-xs pf-muted block">
                            Your note — visible to {a.proposed_by === "client" ? "the architect" : "the client"} too
                          </label>
                          <textarea
                            value={editNoteText}
                            onChange={(e) => setEditNoteText(e.target.value)}
                            rows={2}
                            disabled={isSavingNote}
                            placeholder="e.g. Matches the finish we discussed."
                            className="pf-input rounded-lg px-3 py-2 text-sm w-full disabled:opacity-60"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNote(a.id, editNoteText)}
                              disabled={isSavingNote}
                              className="touch-manipulation pf-btn-accent text-xs rounded-full px-4 py-1.5 disabled:opacity-50"
                            >
                              {isSavingNote ? "Saving…" : "Save note"}
                            </button>
                            <button
                              onClick={cancelEditNote}
                              disabled={isSavingNote}
                              className="touch-manipulation pf-btn-outline text-xs rounded-full px-4 py-1.5 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {a.declined && a.declined_note && (
                        <div className="pf-empty-dashed rounded-xl px-4 py-2.5 text-sm">
                          <span className="pf-faint text-xs uppercase tracking-wide block mb-0.5">Decline note</span>
                          {a.declined_note}
                        </div>
                      )}

                      {noteBoxOpen && (
                        <div className="pf-empty-dashed rounded-xl px-4 py-3 space-y-2">
                          <label className="text-xs pf-muted block">
                            Optional note — let {a.proposed_by === "client" ? "the client" : "the architect"} know why
                          </label>
                          <textarea
                            value={declineNoteText}
                            onChange={(e) => setDeclineNoteText(e.target.value)}
                            rows={2}
                            disabled={isDeclining}
                            placeholder="e.g. Over budget for this space, or doesn't match the finish."
                            className="pf-input rounded-lg px-3 py-2 text-sm w-full disabled:opacity-60"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDecline(a.id, declineNoteText)}
                              disabled={isDeclining}
                              className="touch-manipulation pf-btn-accent text-xs rounded-full px-4 py-1.5 disabled:opacity-50"
                            >
                              {isDeclining ? "Declining…" : "Confirm decline"}
                            </button>
                            <button
                              onClick={cancelDeclineNote}
                              disabled={isDeclining}
                              className="touch-manipulation pf-btn-outline text-xs rounded-full px-4 py-1.5 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {projectId && (
          <ProductCatalog
            catalogAll={catalogAll}
            setCatalogAll={setCatalogAll}
            assignments={assignments}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            projectId={projectId}
            orgId={orgId}
            spaceId={spaceId}
            currentSpaceName={currentSpaceName}
            role={role}
            rawRole={rawRole}
            isViewOnly={isViewOnly}
            loadingCatalog={loadingCatalog}
            isBusy={isBusy}
            runExclusive={runExclusive}
            onAssignmentCreated={handleAssignmentCreated}
            refetchCatalog={refetchCatalog}
          />
        )}
      </main>

      {showSpaceModal && !isViewOnly && (
        <div
          className="pf-modal-overlay fixed inset-0 flex items-end sm:items-center justify-center z-20 px-0 sm:px-4"
          onClick={closeSpaceModal}
        >
          <div
            className="pf-modal rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-[var(--font-display)] text-lg sm:text-xl">{editingSpaceId ? "Edit space" : "Add space"}</h3>
              <button
                onClick={closeSpaceModal}
                disabled={savingSpace || deletingSpace}
                className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {spaceError && (
              <p className="pf-error-box text-xs rounded-lg px-3 py-2">{spaceError}</p>
            )}

            <fieldset disabled={savingSpace || deletingSpace} className="space-y-4 disabled:opacity-60">
              <label className="flex flex-col gap-1 text-sm">
                Space name
                <input
                  value={spaceForm.name}
                  onChange={(e) => setSpaceForm({ ...spaceForm, name: e.target.value })}
                  placeholder="e.g. Master Bedroom"
                  className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                />
              </label>

              <div className="flex flex-col gap-2 text-sm">
                <span>Required categories</span>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const active = spaceForm.required_categories.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleSpaceCategory(c.id)}
                        className={`touch-manipulation text-xs px-3 py-1.5 rounded-full border ${active ? "pf-checkbox-label-active" : "pf-checkbox-label"}`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div className="flex gap-3">
                <button
                  onClick={handleSaveSpace}
                  disabled={savingSpace || deletingSpace}
                  className="touch-manipulation pf-btn-accent text-sm rounded-full px-5 py-2.5 disabled:opacity-50 flex-1 sm:flex-none"
                >
                  {savingSpace ? "Saving…" : editingSpaceId ? "Save changes" : "Add space"}
                </button>
                <button
                  onClick={closeSpaceModal}
                  disabled={savingSpace || deletingSpace}
                  className="touch-manipulation pf-btn-outline text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {editingSpaceId && (
                <button
                  onClick={() => handleDeleteSpace(editingSpaceId)}
                  disabled={savingSpace || deletingSpace}
                  className="touch-manipulation pf-btn-danger-outline text-xs rounded-full px-4 py-2"
                >
                  {deletingSpace ? "Deleting…" : "Delete space"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}