"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./product.css";
import ProductListPrintButton from "./ProductListPrint";
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
  declineAssignment,
  undeclineAssignment,
  editAssignmentNote,
  suggestProduct,
  updateProductSuggestion,
  deleteProductSuggestion,
  createSpace,
  updateSpace,
  deleteSpace,
} from "./productApi";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

const EMPTY_SUGGESTION = {
  space: "",
  category: CATEGORIES[0].id,
  item: "",
  manufacturer: "",
  model_label: "",
  base_price: "",
  currency: "INR",
  product_link: "",
  product_image: null as File | null,
};

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

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
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

// Small reusable clickable product-link element used across every list
// (assigned list, catalog cards).
function ProductLink({ href, className }: { href?: string | null; className?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className ?? "pf-link text-xs underline underline-offset-2"}
    >
      Product link
    </a>
  );
}

// ── Skeletons ────────────────────────────────────────────────────────────
function SkeletonPill() {
  return <div className="pf-skeleton h-9 w-28 rounded-full animate-pulse flex-shrink-0" />;
}
function SkeletonCard() {
  return (
    <div className="pf-card rounded-2xl overflow-hidden">
      <div className="pf-skeleton-light w-full h-36 sm:h-40 animate-pulse" />
      <div className="p-3.5 sm:p-4 space-y-2">
        <div className="pf-skeleton-light h-4 w-3/4 rounded animate-pulse" />
        <div className="pf-skeleton-light h-3 w-1/2 rounded animate-pulse" />
        <div className="pf-skeleton-light h-3 w-1/3 rounded animate-pulse" />
        <div className="pf-skeleton-light h-8 w-full rounded-full animate-pulse mt-3" />
      </div>
    </div>
  );
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

// ── Scrollable section with arrow buttons ────────────────────────────────
interface ScrollableSectionProps {
  children: React.ReactNode;
  itemCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

function ScrollableSection({ children, itemCount, scrollRef, className = "" }: ScrollableSectionProps) {
  const [showArrows, setShowArrows] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const el = scrollRef.current;
      if (el) {
        setShowArrows(el.scrollWidth > el.clientWidth);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => {
      window.removeEventListener("resize", checkOverflow);
    };
  }, [scrollRef, itemCount]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className="pf-scroll-container">
      {showArrows && (
        <button
          onClick={() => scrollBy(-1)}
          className="pf-scroll-arrow pf-scroll-arrow-left"
          aria-label="Scroll left"
        >
          ‹
        </button>
      )}
      <div ref={scrollRef} className={`pf-scroll-row flex gap-3 overflow-x-auto ${className}`}>
        {children}
      </div>
      {showArrows && (
        <button
          onClick={() => scrollBy(1)}
          className="pf-scroll-arrow pf-scroll-arrow-right"
          aria-label="Scroll right"
        >
          ›
        </button>
      )}
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
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounced(searchTerm, 250);

  // Filters for the unified "Assigned products" list below (space
  // multi-select, category, and its own search box — independent from the
  // catalog browsing controls above).
  const [filterSpaceIds, setFilterSpaceIds] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState("");
  const debouncedFilterSearch = useDebounced(filterSearch, 250);

  const [catalogAll, setCatalogAll] = useState<ProductItem[]>([]);

  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestForm, setSuggestForm] = useState(EMPTY_SUGGESTION);
  const [suggestSuccess, setSuggestSuccess] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [spaceForm, setSpaceForm] = useState(EMPTY_SPACE_FORM);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  // Proposer note — shown only to the person doing the proposing (client OR
  // architect, whichever `role` currently is), right before the assignment
  // is created. The other party never sees this input; they only ever get
  // the decline-note box below.
  const [proposingNoteId, setProposingNoteId] = useState<string | null>(null);
  const [proposeNoteText, setProposeNoteText] = useState("");

  const [decliningNoteId, setDecliningNoteId] = useState<number | null>(null);
  const [declineNoteText, setDeclineNoteText] = useState("");

  // Editing an already-created assignment's own proposer_note. Distinct
  // from proposingNoteId above (which is for the note written at the
  // moment of creating a NEW assignment) — this one opens from the
  // "Add note" / "Edit note" button on an existing row, and is only ever
  // shown to the proposer of that row.
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");

  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  // Refs for scrollable sections
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
      // 401s are handled by the apiClient response interceptor (redirect to login).
      // Anything else, just log it so the page doesn't spin forever.
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

  useEffect(() => {
    if (!projectId) {
      setCatalogAll([]);
      return;
    }
    setLoadingCatalog(true);
    (async () => {
      const all = await getProductsByCategory("", projectId);
      setCatalogAll(all);
      setLoadingCatalog(false);
    })();
  }, [projectId]);

  const priceIndex = useMemo(() => {
    const map: Record<string, ProductItem> = {};
    catalogAll.forEach((p) => { map[p.id] = p; });
    return map;
  }, [catalogAll]);

  const pricedProduct = useCallback(
    (item: ProductItem): ProductItem => priceIndex[item.id] ?? item,
    [priceIndex]
  );

  const items = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return catalogAll.filter((p) => {
      if (p.category !== categoryId) return false;
      if (!term) return true;
      return (
        p.item.toLowerCase().includes(term) ||
        p.manufacturer.toLowerCase().includes(term) ||
        p.model_label.toLowerCase().includes(term)
      );
    });
  }, [catalogAll, categoryId, debouncedSearch]);

  // Assignments scoped to the single currently-selected space — used only
  // to drive the catalog's "Added ×N" badge and requirement chips below,
  // not for display as a list of its own (see the unified filtered list
  // further down).
  const assignmentsForSpace = useMemo(
    () => assignments.filter((a) => a.project === projectId && a.space === spaceId),
    [assignments, projectId, spaceId]
  );
  const currentSpaceName = spaces.find((s) => s.id === spaceId)?.name ?? "";
  const currentProjectName = currentOrg?.projects.find((p) => p.id === projectId)?.name ?? "";

  const spaceNameById = useMemo(() => {
    const map = new Map<number, string>();
    spaces.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [spaces]);

  // ── Unified "Assigned products" list ────────────────────────────────
  // One list for the whole project, filtered by space(s), category, and
  // free-text search. When every space is selected this shows everything
  // assigned across the project.
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
          imageSrc: getImageSource(item.product_image),
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

  const selectedCountsForSpace = useMemo(() => {
    const map = new Map<string, number>();
    assignmentsForSpace.forEach((a) => map.set(a.product, (map.get(a.product) ?? 0) + 1));
    return map;
  }, [assignmentsForSpace]);

  // ── Propose-note flow ──────────────────────────────────────────────────
  // Opens the inline note box for THIS caller's own proposal. Whoever is
  // currently acting (client or architect, per `role`) is the only one who
  // can ever fill in proposer_note for the assignment they're about to
  // create — the other side only ever writes a decline note, later.
  function openProposeNote(itemId: string) {
    if (!spaceId) return;
    setProposingNoteId(itemId);
    setProposeNoteText("");
  }

  function cancelProposeNote() {
    setProposingNoteId(null);
    setProposeNoteText("");
  }

  async function handleProposeItem(itemId: string, note?: string) {
    if (!projectId || !spaceId) return;
    await runExclusive(`propose-${itemId}`, async () => {
      const created = await proposeAssignment(projectId, spaceId, itemId, role, note);
      setAssignments((prev) => [...prev, created]);
      setProposingNoteId(null);
      setProposeNoteText("");
    });
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

  // Opens the note editor for an EXISTING assignment — only ever called
  // from the proposer's own row (gated by isProposer at render time).
  // Pre-fills with whatever note is already there so it reads as "edit",
  // not "overwrite blind".
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

  function openSuggestModal() {
    setEditingProductId(null);
    setSuggestForm({ ...EMPTY_SUGGESTION, category: categoryId });
    setSuggestSuccess(false);
    setSuggestError(null);
    setShowSuggestModal(true);
  }

  function openEditSuggestion(item: ProductItem) {
    setEditingProductId(item.id);
    setSuggestForm({
      space: "",
      category: item.category,
      item: item.item,
      manufacturer: item.manufacturer,
      model_label: item.model_label,
      base_price: item.base_price ? String(item.base_price) : "",
      currency: item.currency || "INR",
      product_link: item.product_link || "",
      product_image: null,
    });
    setSuggestSuccess(false);
    setSuggestError(null);
    setShowSuggestModal(true);
  }

  function closeSuggestModal() {
    if (isBusy("suggest-submit")) return;
    setShowSuggestModal(false);
    setSuggestForm(EMPTY_SUGGESTION);
    setSuggestError(null);
    setEditingProductId(null);
  }

  async function handleSuggestSubmit() {
    if (!editingProductId && !orgId) {
      setSuggestError("No organisation context found — pick a project first.");
      return;
    }
    const missingSpace = !editingProductId && !suggestForm.space;
    if (!suggestForm.item || !suggestForm.manufacturer || !suggestForm.model_label || missingSpace) {
      setSuggestError("Space, item, manufacturer and model are required.");
      return;
    }
    await runExclusive("suggest-submit", async () => {
      setSuggestError(null);
      try {
        if (editingProductId) {
          const updated = await updateProductSuggestion(editingProductId, {
            category: suggestForm.category,
            item: suggestForm.item,
            manufacturer: suggestForm.manufacturer,
            model_label: suggestForm.model_label,
            base_price: suggestForm.base_price || undefined,
            currency: suggestForm.currency || undefined,
            product_link: suggestForm.product_link || undefined,
            product_image: suggestForm.product_image,
          });
          setCatalogAll((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        } else if (orgId) {
          await suggestProduct({
            space: suggestForm.space,
            category: suggestForm.category,
            item: suggestForm.item,
            manufacturer: suggestForm.manufacturer,
            model_label: suggestForm.model_label,
            base_price: suggestForm.base_price || undefined,
            currency: suggestForm.currency || undefined,
            product_link: suggestForm.product_link || undefined,
            product_image: suggestForm.product_image,
            organisation: orgId,
          });
          if (projectId) {
            setLoadingCatalog(true);
            const all = await getProductsByCategory("", projectId);
            setCatalogAll(all);
            setLoadingCatalog(false);
          }
        }
        setSuggestSuccess(true);
        setSuggestForm(EMPTY_SUGGESTION);
      } catch (err: unknown) {
        setSuggestError(
          getErrorMessage(
            err,
            "organisation",
            editingProductId
              ? "Couldn't update the suggestion. Please check the details and try again."
              : "Couldn't submit the suggestion. Please check the details and try again."
          )
        );
      }
    });
  }

  async function handleWithdrawSuggestion(id: string) {
    await runExclusive(`withdraw-${id}`, async () => {
      const previous = catalogAll;
      setCatalogAll((prev) => prev.filter((p) => p.id !== id));
      try {
        await deleteProductSuggestion(id);
      } catch (err) {
        setCatalogAll(previous);
        throw err;
      }
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
  const suggesting = isBusy("suggest-submit");

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
        {/* Organisation */}
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

        {/* Project with search */}
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

        {/* Spaces with unified edit button */}
        {projectId && (
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="pf-muted text-sm">
                {loadingProjectData ? "Loading spaces…" : `Spaces · ${fullySpecifiedCount} of ${spaces.length} fully specified`}
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

        {/* ── Unified assigned-products list ──────────────────────────
            One list for the whole project — filter by space(s), category
            and free text instead of two separate lists. */}
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
                  const price = formatPrice(item);
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
                            src={getImageSource(item.product_image)}
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
                            {price && <div className="text-sm font-medium mt-1">{price}</div>}
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
                              {/* Note button — only the proposer of THIS
                                  assignment ever sees this; it's how they
                                  add or change their own proposer_note
                                  after the fact, any time. */}
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

                      {/* Proposer's own note — written at propose time or
                          any time after via "Add note"/"Edit note" above.
                          Only the proposer can ever write it; both parties
                          can see it. Hidden while the edit box (below) is
                          open so the two don't show at once. */}
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

                      {/* Decline note — only ever written by the OTHER side,
                          via the decline action below. */}
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
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl">Catalog</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 sm:items-center mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search manufacturer, item, model…"
                className="pf-input px-4 py-2.5 sm:py-2 rounded-full text-sm w-full sm:w-64"
              />
              <div className="flex gap-2.5 sm:gap-3 flex-wrap items-center">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="pf-input px-4 py-2.5 sm:py-2 rounded-full text-sm flex-1 sm:flex-none min-w-0"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                {!isViewOnly && role === "client" && (
                  <button
                    onClick={openSuggestModal}
                    className="touch-manipulation pf-btn-outline-accent rounded-full px-4 py-2.5 sm:py-2 text-sm whitespace-nowrap"
                  >
                    Suggest a product
                  </button>
                )}
                {!isViewOnly && rawRole === "admin" && (
                  <Link
                    href="/product/manage"
                    className="touch-manipulation pf-btn-outline-accent rounded-full px-4 py-2.5 sm:py-2 text-sm whitespace-nowrap"
                  >
                    Manage catalog
                  </Link>
                )}
              </div>
            </div>

            {!spaceId && (
              <p className="pf-muted text-sm mb-4">Select or add a space above to enable choosing items.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {loadingCatalog ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : items.length === 0 ? (
                <div className="col-span-full text-center py-10 space-y-3">
                  <p className="pf-muted text-sm">No matching products.</p>
                  {!isViewOnly && role === "client" && (
                    <button onClick={openSuggestModal} className="touch-manipulation pf-btn-primary text-sm rounded-full px-5 py-2.5">
                      Can&apos;t find it? Suggest a product
                    </button>
                  )}
                </div>
              ) : (
                items.map((item) => {
                  const stats = itemStats.get(item.id);
                  const price = formatPrice(item);
                  const count = selectedCountsForSpace.get(item.id) ?? 0;
                  const isPending = item.status === "pending";
                  const canWithdraw = !isViewOnly && role === "client" && isPending;
                  const proposeKey = `propose-${item.id}`;
                  const withdrawKey = `withdraw-${item.id}`;
                  const isProposing = isBusy(proposeKey);
                  const isWithdrawing = isBusy(withdrawKey);
                  const noteBoxOpen = proposingNoteId === item.id;
                  return (
                    <div key={item.id} className="pf-card rounded-2xl overflow-hidden">
                      <div className="w-full h-36 sm:h-40 bg-white flex items-center justify-center p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getImageSource(item.product_image)}
                          alt={item.item}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="p-3.5 sm:p-4">
                        <div className="font-[var(--font-display)] text-base truncate">{item.item}</div>
                        {isPending && (
                          <div className="pf-status-pending inline-block text-[10px] px-2 py-0.5 rounded-full mt-1">
                            Not approved yet — visible only to you
                          </div>
                        )}
                        <div className="pf-muted text-sm truncate">{item.manufacturer} — {item.model_label}</div>
                        {price && <div className="text-sm font-medium mt-1">{price}</div>}
                        {item.product_link && (
                          <ProductLink
                            href={item.product_link}
                            className="pf-link text-xs underline underline-offset-2 inline-block mt-0.5"
                          />
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {stats ? (
                            <>
                              <span className="pf-badge-soft text-xs px-2 py-0.5 rounded-full">
                                {stats.projects.size} project{stats.projects.size === 1 ? "" : "s"}
                              </span>
                              {stats.confirmed > 0 && <span className="pf-status-confirmed text-xs px-2 py-0.5 rounded-full">{stats.confirmed} confirmed</span>}
                              {stats.pending > 0 && <span className="pf-status-pending text-xs px-2 py-0.5 rounded-full">{stats.pending} pending</span>}
                            </>
                          ) : (
                            <span className="pf-faint text-xs">Not yet used</span>
                          )}
                          {count > 0 && (
                            <span className="pf-selected-badge text-xs px-2 py-0.5 rounded-full">Added ×{count}</span>
                          )}
                        </div>

                        {/* Propose flow: clicking the main action opens an
                            inline note box for the CURRENT role only — a
                            client proposing writes their own note here; an
                            architect proposing writes theirs. Whoever is NOT
                            the proposer never sees this box, only the
                            decline-note box on the resulting assignment. */}
                        {!isViewOnly && (
                          noteBoxOpen ? (
                            <div className="mt-3 space-y-2">
                              <label className="text-xs pf-muted block">
                                Optional note — why this pick for {currentSpaceName || "this space"}?
                              </label>
                              <textarea
                                value={proposeNoteText}
                                onChange={(e) => setProposeNoteText(e.target.value)}
                                rows={2}
                                disabled={isProposing}
                                placeholder={
                                  role === "client"
                                    ? "e.g. Matches the finish we discussed."
                                    : "e.g. Fits the budget and lead time for this space."
                                }
                                className="pf-input rounded-lg px-3 py-2 text-sm w-full disabled:opacity-60"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleProposeItem(item.id, proposeNoteText)}
                                  disabled={isProposing}
                                  className="touch-manipulation pf-btn-primary flex-1 text-xs rounded-full py-2 disabled:opacity-50"
                                >
                                  {isProposing ? "Adding…" : "Add"}
                                </button>
                                <button
                                  onClick={cancelProposeNote}
                                  disabled={isProposing}
                                  className="touch-manipulation pf-btn-outline flex-1 text-xs rounded-full py-2 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openProposeNote(item.id)}
                              disabled={!spaceId}
                              className="touch-manipulation pf-btn-primary mt-3 w-full text-sm rounded-full py-2.5 sm:py-2 disabled:opacity-40"
                            >
                              {!spaceId
                                ? "Add a space first"
                                : count > 0
                                ? role === "client"
                                  ? "Add another"
                                  : "Suggest another"
                                : role === "client"
                                ? "Select for this space"
                                : "Suggest for this space"}
                            </button>
                          )
                        )}
                        {canWithdraw && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => openEditSuggestion(item)}
                              disabled={isWithdrawing}
                              className="touch-manipulation pf-btn-outline flex-1 text-xs rounded-full py-1.5 disabled:opacity-50"
                            >
                              Edit suggestion
                            </button>
                            <button
                              onClick={() => handleWithdrawSuggestion(item.id)}
                              disabled={isWithdrawing}
                              className="touch-manipulation pf-btn-danger-outline flex-1 text-xs rounded-full py-1.5 disabled:opacity-50"
                            >
                              {isWithdrawing ? "Withdrawing…" : "Withdraw"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}
      </main>

      {/* Modals remain the same */}
      {showSuggestModal && !isViewOnly && (
        <div
          className="pf-modal-overlay fixed inset-0 flex items-end sm:items-center justify-center z-20 px-0 sm:px-4"
          onClick={closeSuggestModal}
        >
          <div
            className="pf-modal rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-[var(--font-display)] text-lg sm:text-xl">
                {editingProductId ? "Edit suggestion" : "Suggest a product"}
              </h3>
              <button
                onClick={closeSuggestModal}
                disabled={suggesting}
                className="touch-manipulation pf-btn-outline text-xs rounded-full px-3 py-1.5 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {suggestSuccess ? (
              <div className="text-center py-8 space-y-3">
                <p className="pf-success-text text-sm">
                  {editingProductId
                    ? "Your changes have been saved. It still shows as not approved yet, and an admin will review the updated details before it becomes visible to everyone."
                    : "Thanks — your suggestion now shows in the catalog for you, marked as not approved yet. Once an admin at your organisation approves it, it becomes visible to everyone. You can withdraw or edit it yourself any time before then."}
                </p>
                <button onClick={closeSuggestModal} className="touch-manipulation pf-btn-primary text-sm rounded-full px-5 py-2.5">
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="pf-muted text-xs">
                  {editingProductId ? (
                    <>
                      Update the details below — this only applies while your suggestion is
                      still pending. Once an admin approves it, it can no longer be edited
                      from here.
                    </>
                  ) : (
                    <>
                      Not in the catalog yet? Add the details below — it&apos;ll appear in your
                      catalog right away (marked as pending), and an admin at{" "}
                      <span className="font-medium">{currentOrg?.name || "your organisation"}</span> will review it before others can see it.
                    </>
                  )}
                </p>

                {suggestError && (
                  <p className="pf-error-box text-xs rounded-lg px-3 py-2">{suggestError}</p>
                )}

                <fieldset disabled={suggesting} className="grid sm:grid-cols-2 gap-3 disabled:opacity-60">
                  {!editingProductId && (
                    <label className="flex flex-col gap-1 text-sm">
                      Space
                      <input
                        value={suggestForm.space}
                        onChange={(e) => setSuggestForm({ ...suggestForm, space: e.target.value })}
                        className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm">
                    Category
                    <select
                      value={suggestForm.category}
                      onChange={(e) => setSuggestForm({ ...suggestForm, category: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Item name
                    <input
                      value={suggestForm.item}
                      onChange={(e) => setSuggestForm({ ...suggestForm, item: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Manufacturer
                    <input
                      value={suggestForm.manufacturer}
                      onChange={(e) => setSuggestForm({ ...suggestForm, manufacturer: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Model
                    <input
                      value={suggestForm.model_label}
                      onChange={(e) => setSuggestForm({ ...suggestForm, model_label: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Approx. price (optional)
                    <input
                      type="number"
                      value={suggestForm.base_price}
                      onChange={(e) => setSuggestForm({ ...suggestForm, base_price: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Currency
                    <select
                      value={suggestForm.currency}
                      onChange={(e) => setSuggestForm({ ...suggestForm, currency: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Product link (optional)
                    <input
                      value={suggestForm.product_link}
                      onChange={(e) => setSuggestForm({ ...suggestForm, product_link: e.target.value })}
                      className="pf-input rounded-lg px-3 py-2.5 sm:py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    {editingProductId ? "Replace photo (optional)" : "Photo (optional)"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSuggestForm({ ...suggestForm, product_image: e.target.files?.[0] ?? null })}
                      className="text-sm"
                    />
                  </label>
                </fieldset>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSuggestSubmit}
                    disabled={suggesting}
                    className="touch-manipulation pf-btn-accent text-sm rounded-full px-5 py-2.5 disabled:opacity-50 flex-1 sm:flex-none"
                  >
                    {suggesting ? "Saving…" : editingProductId ? "Save changes" : "Submit suggestion"}
                  </button>
                  <button
                    onClick={closeSuggestModal}
                    disabled={suggesting}
                    className="touch-manipulation pf-btn-outline text-sm rounded-full px-5 py-2.5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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