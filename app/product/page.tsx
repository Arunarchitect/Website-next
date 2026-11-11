"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fraunces as display, inter as body } from "@/lib/fonts";
import "./product.css";
import ProductListPrintButton from "./ProductListPrint";
import ProductCatalog, { PriceBlock, ProductLink, useDebounced } from "./ProductCatalog";
import { getCurrentUser } from "@/app/main/user/userApi"; // ⚠️ adjust this relative path to match your tree
import {
  Role,
  OrganisationGroup,
  Space,
  ProductItem,
  Assignment,
  PricedFields,
  CATEGORIES,
  IFC_PREDEFINED_TYPES,
  getImageSource,
  getVariantImageSource,
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
import { groupAssignments, AssignmentGroup } from "./groupAssignments";

import SorExportButton from "./SorExport";


const EMPTY_SPACE_FORM = {
  name: "",
  required_categories: [] as string[],
};

type PrintDeclineFilter = "all" | "non_declined" | "except_client" | "except_architect";

const PRINT_DECLINE_OPTIONS: { value: PrintDeclineFilter; label: string; scope: string | null }[] = [
  { value: "all", label: "Print all", scope: null },
  { value: "non_declined", label: "Only non-declined", scope: "Excluding all declined" },
  { value: "except_client", label: "Except client-declined", scope: "Excluding client-declined" },
  { value: "except_architect", label: "Except architect-declined", scope: "Excluding architect-declined" },
];

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

function sumByCurrency(products: PricedFields[]): { currency: string; total: number }[] {
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

/** Numeric unit price for a priced thing, or null if it has none. */
function unitPriceOf(src: PricedFields): number | null {
  const value = src.effective_price ?? src.base_price;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

/** "INR 32,340" = unit price x quantity, or null if there's no price. */
function lineTotalLabel(src: PricedFields, quantity: number): string | null {
  const unit = unitPriceOf(src);
  if (unit === null) return null;
  return formatTotal({ currency: src.currency || "INR", total: unit * quantity });
}

/** The price/image source for an assignment row — the picked variant's own
 * numbers when one was chosen, else the product's. Both shapes already
 * carry resolved (server-side) price/image fields, so no extra fallback
 * logic is needed here. */
function assignmentPriceSource(a: Assignment, product: ProductItem): PricedFields {
  return a.variant_detail ?? product;
}

function assignmentImageSource(a: Assignment, product: ProductItem): string {
  return a.variant_detail ? getVariantImageSource(a.variant_detail) : getImageSource(product);
}

/** "architect (you)" / "architect (other user)" so two rows for the same
 * product from different people are distinguishable. Falls back to just the
 * role for older rows with no proposed_by_user. */
function proposerLabel(a: Assignment, currentUserId: number | null): string {
  if (a.proposed_by_user == null || currentUserId === null) return a.proposed_by;
  return a.proposed_by_user === currentUserId
    ? `${a.proposed_by} (you)`
    : `${a.proposed_by} (other user)`;
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

  // The logged-in user's own id — needed to tell "my proposal" apart from
  // "someone else on my side's proposal" now that member/manager (not just
  // client/architect-admin) can propose assignments. Pulled from whatever
  // getCurrentUser() already resolves (localStorage-cached user record).
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [spaces, setSpaces] = useState<Space[]>([]);
  // ONE space selection for the whole page. It drives the assigned-products
  // list, the print/PDF scope AND the catalog's "propose into" target.
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<Set<number>>(new Set());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categoryId, setCategoryId] = useState("");

  // Proposing needs exactly one target space. With 0 or 2+ selected there is
  // no valid target, so spaceId is null and the catalog shows a warning.
  const spaceId: number | null = useMemo(
    () => (selectedSpaceIds.size === 1 ? Array.from(selectedSpaceIds)[0] : null),
    [selectedSpaceIds]
  );

  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterPredefinedType, setFilterPredefinedType] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");
  const debouncedFilterSearch = useDebounced(filterSearch, 250);

  // Print-only: which declined items to leave out of the PDF. Does not
  // affect the on-screen list, totals pills or SOR export.
  const [printDeclineFilter, setPrintDeclineFilter] = useState<PrintDeclineFilter>("all");

  // The predefined-type option list depends on filterCategory — clear the
  // selection whenever the category filter changes so it can't point at a
  // type that doesn't belong to the newly-selected category.
  useEffect(() => {
    setFilterPredefinedType("");
  }, [filterCategory]);

  const [catalogAll, setCatalogAll] = useState<ProductItem[]>([]);

  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [spaceForm, setSpaceForm] = useState(EMPTY_SPACE_FORM);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  // These hold the *representative* assignment id of a group.
  const [decliningNoteId, setDecliningNoteId] = useState<number | null>(null);
  const [declineNoteText, setDeclineNoteText] = useState("");

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const orgScrollRef = useRef<HTMLDivElement>(null);
  const projectScrollRef = useRef<HTMLDivElement>(null);
  const spaceScrollRef = useRef<HTMLDivElement>(null);

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
      const user = await getCurrentUser();
      setCurrentUserId(user?.id ?? null);
    })();
  }, []);

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
    // Start with exactly one space selected (the kept one, else the first),
    // so proposing from the catalog works straight away.
    const target =
      keepSpaceId && s.some((sp) => sp.id === keepSpaceId) ? keepSpaceId : s[0]?.id ?? null;
    setSelectedSpaceIds(new Set(target !== null ? [target] : []));
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
  // Shown in the spaces header when exactly one space is selected.
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
      if (!selectedSpaceIds.has(a.space)) return false;
      const item = pricedProduct(a.product_detail);
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterPredefinedType && item.predefined_type !== filterPredefinedType) return false;
      if (term) {
        const hay = `${item.item} ${item.manufacturer} ${item.model_label}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [assignments, projectId, selectedSpaceIds, filterCategory, filterPredefinedType, debouncedFilterSearch, pricedProduct]);

  // Identical assignments (same space/product/variant/proposer/note/status)
  // collapse into one row with a quantity. Backend rows stay separate.
  const groupedAssignments = useMemo(
    () => groupAssignments(filteredAssignments),
    [filteredAssignments]
  );

  // Totals stay on the UNGROUPED rows, so every unit is counted.
  const filteredTotals = useMemo(
    () =>
      sumByCurrency(
        filteredAssignments.map((a) => assignmentPriceSource(a, pricedProduct(a.product_detail)))
      ),
    [filteredAssignments, pricedProduct]
  );

  // Print-only subset: the decline filter applied on top of the on-screen filters.
  const printAssignments = useMemo(
    () =>
      filteredAssignments.filter((a) => {
        switch (printDeclineFilter) {
          case "non_declined":
            return !a.declined;
          case "except_client":
            return !(a.declined && a.declined_by === "client");
          case "except_architect":
            return !(a.declined && a.declined_by === "architect");
          default:
            return true;
        }
      }),
    [filteredAssignments, printDeclineFilter]
  );

  const printGroups = useMemo(() => groupAssignments(printAssignments), [printAssignments]);

  // Ungrouped, so every unit is counted (same rule as filteredTotals).
  const printTotals = useMemo(
    () =>
      sumByCurrency(
        printAssignments.map((a) => assignmentPriceSource(a, pricedProduct(a.product_detail)))
      ),
    [printAssignments, pricedProduct]
  );

  const filteredPrintRows = useMemo(
    () =>
      printGroups.map((g) => {
        const a = g.rep;
        const item = pricedProduct(a.product_detail);
        const priceSource = assignmentPriceSource(a, item);
        return {
          space: spaceNameById.get(a.space) ?? "—",
          item: item.item,
          manufacturer: item.manufacturer,
          model_label: item.model_label,
          variantLabel: a.variant_detail?.label || null,
          priceLabel: formatPrice(priceSource),
          quantity: g.quantity,
          amountLabel: lineTotalLabel(priceSource, g.quantity),
          status: statusLabel(a),
          proposed_by: a.proposed_by,
          imageSrc: assignmentImageSource(a, item),
          product_link: item.product_link || null,
          proposerNote: a.proposer_note || null,
          declinedNote: a.declined ? a.declined_note || null : null,
        };
      }),
    [printGroups, pricedProduct, spaceNameById]
  );

  const filterScopeLabel = useMemo(() => {
    const spaceLabel = (() => {
      if (spaces.length === 0) return "All spaces";
      if (selectedSpaceIds.size === spaces.length) return "All spaces";
      if (selectedSpaceIds.size === 0) return "No spaces selected";
      return spaces.filter((s) => selectedSpaceIds.has(s.id)).map((s) => s.name).join(", ");
    })();
    const catLabel = filterCategory ? CATEGORIES.find((c) => c.id === filterCategory)?.label : null;
    const typeLabel = filterPredefinedType
      ? IFC_PREDEFINED_TYPES[filterCategory]?.find((t) => t.code === filterPredefinedType)?.label
      : null;
    const searchLabel = filterSearch.trim() ? `Search: "${filterSearch.trim()}"` : null;
    const parts = [spaceLabel];
    if (catLabel) parts.push(catLabel);
    if (typeLabel) parts.push(typeLabel);
    if (searchLabel) parts.push(searchLabel);
    const declineScope = PRINT_DECLINE_OPTIONS.find((o) => o.value === printDeclineFilter)?.scope;
    if (declineScope) parts.push(declineScope);
    return parts.join(" · ");
  }, [spaces, selectedSpaceIds, filterCategory, filterPredefinedType, filterSearch, printDeclineFilter]);

  function toggleSpace(id: number) {
    setSelectedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllSpaces() {
    setSelectedSpaceIds(new Set(spaces.map((s) => s.id)));
  }

  function clearSpaces() {
    setSelectedSpaceIds(new Set());
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

  function replaceAssignment(updated: Assignment) {
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  // ── Group-aware handlers: act on every assignment in the group ─────────
  async function handleConfirmGroup(g: AssignmentGroup) {
    await runExclusive(`confirm-${g.rep.id}`, async () => {
      for (const id of g.ids) {
        replaceAssignment(await confirmAssignment(id, role));
      }
    });
  }

  /** Removes ONE copy (the last one) of the group. */
  async function handleRemoveOne(g: AssignmentGroup) {
    const id = g.ids[g.ids.length - 1];
    await runExclusive(`remove-${g.rep.id}`, async () => {
      await removeAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
    });
  }

  /** Removes EVERY copy in the group. */
  async function handleRemoveAll(g: AssignmentGroup) {
    await runExclusive(`remove-${g.rep.id}`, async () => {
      for (const id of g.ids) {
        await removeAssignment(id);
        setAssignments((prev) => prev.filter((a) => a.id !== id));
      }
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

  async function handleDeclineGroup(g: AssignmentGroup, note: string) {
    await runExclusive(`decline-${g.rep.id}`, async () => {
      for (const id of g.ids) {
        replaceAssignment(await declineAssignment(id, note));
      }
      setDecliningNoteId(null);
      setDeclineNoteText("");
    });
  }

  async function handleUndoDeclineGroup(g: AssignmentGroup) {
    await runExclusive(`undecline-${g.rep.id}`, async () => {
      for (const id of g.ids) {
        replaceAssignment(await undeclineAssignment(id));
      }
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

  async function handleSaveNoteGroup(g: AssignmentGroup, note: string) {
    await runExclusive(`edit-note-${g.rep.id}`, async () => {
      for (const id of g.ids) {
        replaceAssignment(await editAssignmentNote(id, note));
      }
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

  const totalUnits = filteredAssignments.length;
  const totalRows = groupedAssignments.length;

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
                      className={`touch-manipulation relative text-left flex-shrink-0 min-w-[190px] sm:min-w-[220px] rounded-2xl border px-4 sm:px-5 py-3.5 sm:py-4 ${active ? "pf-project-card-active" : "pf-project-card-inactive"
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
                  : `Spaces · ${fullySpecifiedCount} of ${spaces.length} fully specified${spaceId && currentSpaceItemCount > 0
                    ? ` · ${currentSpaceItemCount} item${currentSpaceItemCount === 1 ? "" : "s"} in ${currentSpaceName}`
                    : ""
                  }`}
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                {spaces.length > 1 && (
                  <div className="flex gap-3 text-sm mr-1">
                    <button onClick={selectAllSpaces} className="touch-manipulation pf-link">Select all</button>
                    <button onClick={clearSpaces} className="touch-manipulation pf-link">Clear</button>
                  </div>
                )}
                {!isViewOnly && (
                  <>
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
                  </>
                )}
              </div>
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
                  const active = selectedSpaceIds.has(s.id);
                  const prog = spaceProgress(s);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSpace(s.id)}
                      aria-pressed={active}
                      className={`touch-manipulation flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-sm border whitespace-nowrap ${active ? "pf-space-pill-active" : "pf-space-pill"
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
            {!loadingProjectData && spaces.length > 1 && (
              <p className="pf-faint text-xs mt-2">
                Tap spaces to view them together. To suggest a product, select just one space.
              </p>
            )}
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
              <div className="flex items-center gap-3 flex-wrap">
                <span className="pf-muted text-sm">
                  {totalRows} item{totalRows === 1 ? "" : "s"}
                  {totalUnits !== totalRows ? ` · ${totalUnits} units` : ""}
                </span>
                {rawRole !== "client" && assignments.length > 0 && (
                  <SorExportButton
                    orgName={currentOrg?.name ?? ""}
                    projectName={currentProjectName}
                    projectId={projectId}
                    assignments={assignments}
                    resolveProduct={pricedProduct}
                    className="pf-btn-outline text-xs rounded-full px-3 py-1.5"
                    label="SOR CSV"
                  />
                )}
                {filteredAssignments.length > 0 && (
                  <>
                    <select
                      value={printDeclineFilter}
                      onChange={(e) => setPrintDeclineFilter(e.target.value as PrintDeclineFilter)}
                      aria-label="Which items to print"
                      className="pf-input text-xs rounded-full px-3 py-1.5"
                    >
                      {PRINT_DECLINE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {printAssignments.length > 0 ? (
                      <ProductListPrintButton
                        orgName={currentOrg?.name ?? ""}
                        projectName={currentProjectName}
                        scopeLabel={filterScopeLabel}
                        rows={filteredPrintRows}
                        totals={printTotals}
                        className="pf-btn-outline text-xs rounded-full px-3 py-1.5"
                        label="Print"
                      />
                    ) : (
                      <span className="pf-faint text-xs">Nothing to print with this option</span>
                    )}
                  </>
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
              {filterCategory && (IFC_PREDEFINED_TYPES[filterCategory]?.length ?? 0) > 0 && (
                <select
                  value={filterPredefinedType}
                  onChange={(e) => setFilterPredefinedType(e.target.value)}
                  className="pf-input px-4 py-2.5 sm:py-2 rounded-full text-sm w-full sm:w-auto"
                >
                  <option value="">All types</option>
                  {IFC_PREDEFINED_TYPES[filterCategory].map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              )}
            </div>

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
            ) : groupedAssignments.length === 0 ? (
              <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-10 text-center text-sm">
                {selectedSpaceIds.size === 0
                  ? "No spaces selected above."
                  : "Nothing matches this filter yet."}
              </div>
            ) : (
              <div className="space-y-3">
                {groupedAssignments.map((g) => {
                  const a = g.rep;
                  const qty = g.quantity;
                  const item = pricedProduct(a.product_detail);
                  const priceSource = assignmentPriceSource(a, item);
                  const imageSrc = assignmentImageSource(a, item);
                  const lineTotal = qty > 1 ? lineTotalLabel(priceSource, qty) : null;
                  const bothConfirmed = a.client_confirmed && a.architect_confirmed;
                  const canConfirm = !isViewOnly && !a.declined && ((role === "client" && !a.client_confirmed) || (role === "architect" && !a.architect_confirmed));

                  const isProposer = a.proposed_by === role;
                  // Admin can remove any assignment. Otherwise it's the
                  // specific person who proposed it — not just "anyone on
                  // the same side" — since member/manager (isViewOnly) now
                  // share the architect bucket with admin but shouldn't be
                  // able to remove each other's proposals.
                  const canHardDelete =
                    rawRole === "admin" ||
                    (currentUserId !== null && a.proposed_by_user === currentUserId);
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

                  // Whether the action row should render at all for this
                  // row: everyone gets it if they're not view-only; a
                  // view-only person (member/manager) still gets it
                  // *only* to see their own remove button.
                  const showActionRow = !isViewOnly || canHardDelete;

                  return (
                    <div key={g.key} className="pf-row flex flex-col gap-3 rounded-2xl px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                        <div className="flex items-center gap-4 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageSrc}
                            alt={item.item}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-white flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="pf-badge-soft text-[11px] px-2 py-0.5 rounded-full inline-block mb-1">
                              {spaceNameById.get(a.space) ?? "—"}
                            </span>
                            <div className="font-[var(--font-display)] text-base sm:text-lg leading-tight flex items-center gap-2 min-w-0">
                              <span className="truncate">{item.item}</span>
                              {qty > 1 && (
                                <span className="pf-badge-soft text-xs px-2 py-0.5 rounded-full flex-shrink-0">
                                  ×{qty}
                                </span>
                              )}
                            </div>
                            <div className="pf-muted text-sm truncate">{item.manufacturer} — {item.model_label}</div>
                            {a.variant_detail?.label && (
                              <div className="pf-faint text-xs mt-0.5">Size: {a.variant_detail.label}</div>
                            )}
                            <div className="pf-faint text-xs capitalize mt-0.5">
                              Proposed by {proposerLabel(a, currentUserId)}
                            </div>
                            <PriceBlock item={priceSource} />
                            {qty > 1 && (
                              <div className="pf-muted text-xs mt-0.5">
                                Qty {qty}{lineTotal ? ` · Total ${lineTotal}` : ""}
                              </div>
                            )}
                            {item.product_link && (
                              <ProductLink
                                href={item.product_link}
                                className="pf-link text-xs underline underline-offset-2 mt-1 inline-block"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                          <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${a.declined ? "pf-btn-danger-outline" : bothConfirmed ? "pf-status-confirmed" : "pf-status-pending"
                            }`}>
                            {statusLabel(a)}
                          </span>
                          {showActionRow && (
                            <div className="flex gap-2 flex-wrap justify-end">
                              {!isViewOnly && canConfirm && (
                                <button
                                  onClick={() => handleConfirmGroup(g)}
                                  disabled={isConfirming}
                                  className="touch-manipulation pf-btn-accent text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  {isConfirming ? "Confirming…" : qty > 1 ? "Confirm all" : "Confirm"}
                                </button>
                              )}
                              {canHardDelete && (
                                <button
                                  onClick={() => handleRemoveOne(g)}
                                  disabled={isRemoving}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  {isRemoving ? "Removing…" : qty > 1 ? "Remove one" : "Remove"}
                                </button>
                              )}
                              {canHardDelete && qty > 1 && (
                                <button
                                  onClick={() => handleRemoveAll(g)}
                                  disabled={isRemoving}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  Remove all
                                </button>
                              )}
                              {!isViewOnly && isProposer && !editNoteBoxOpen && (
                                <button
                                  onClick={() => openEditNote(a)}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5"
                                >
                                  {a.proposer_note ? "Edit note" : "Add note"}
                                </button>
                              )}
                              {!isViewOnly && canDecline && !noteBoxOpen && (
                                <button
                                  onClick={() => openDeclineNote(a.id)}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5"
                                >
                                  {qty > 1 ? "Decline all" : "Decline"}
                                </button>
                              )}
                              {!isViewOnly && canUndoDecline && (
                                <button
                                  onClick={() => handleUndoDeclineGroup(g)}
                                  disabled={isUndeclining}
                                  className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
                                >
                                  {isUndeclining ? "Undoing…" : "Undo decline"}
                                </button>
                              )}
                              {!isViewOnly && !canHardDelete && !canDecline && !canUndoDecline && a.declined && (
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
                            {qty > 1 ? ` (applies to all ${qty} units)` : ""}
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
                              onClick={() => handleSaveNoteGroup(g, editNoteText)}
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
                              onClick={() => handleDeclineGroup(g, declineNoteText)}
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

        {projectId && spaces.length > 0 && selectedSpaceIds.size !== 1 && (
          <div className="pf-error-box text-sm rounded-xl px-4 py-3">
            {selectedSpaceIds.size === 0
              ? "Select a space above to suggest a product."
              : "Only one space should be selected to suggest a product. Select a single space above."}
          </div>
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