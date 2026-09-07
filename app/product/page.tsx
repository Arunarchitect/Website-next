"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// Shape of the error payloads our API returns on validation failures.
// Kept intentionally loose (all optional) since different endpoints
// surface different fields.
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

// Sum effective (discounted) price per currency across a set of products.
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

export default function ProductPage() {
  const [organisations, setOrganisations] = useState<OrganisationGroup[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [role, setRole] = useState<Role>("architect");
  const [rawRole, setRawRole] = useState<string>("");

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounced(searchTerm, 250);

  const [summarySpaceIds, setSummarySpaceIds] = useState<Set<number>>(new Set());

  const [catalogAll, setCatalogAll] = useState<ProductItem[]>([]);

  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestForm, setSuggestForm] = useState(EMPTY_SUGGESTION);
  const [suggestSuccess, setSuggestSuccess] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // When set, the suggest modal is in "edit an existing pending suggestion"
  // mode instead of "create a new suggestion" mode.
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<number | null>(null);
  const [spaceForm, setSpaceForm] = useState(EMPTY_SPACE_FORM);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const [decliningNoteId, setDecliningNoteId] = useState<number | null>(null);
  const [declineNoteText, setDeclineNoteText] = useState("");

  // ─── Click-guard ──────────────────────────────────────────────────────
  // Every button that fires a network request is keyed by a unique string
  // (e.g. `confirm-42`, `decline-42`, `save-space-7`). While that key is
  // "busy" only the button that owns it disables itself — a slow request
  // or an impatient double/triple tap on the SAME button can never fire
  // twice, but unrelated buttons (a different assignment, a different
  // space) stay fully usable. runExclusive() is the single choke point:
  // it no-ops if the key is already running and always clears the key in
  // a `finally`, so a rejected request can't leave a button stuck.
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

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
      setLoadingContext(false);
    })();
  }, []);

  const currentOrg = organisations.find((o) => o.id === orgId);

  // View-only mode: members and managers can only view, filter, and print
  const isViewOnly = rawRole === "member" || rawRole === "manager";

  function handleSelectProject(pid: number, projRole: Role, raw: string) {
    setProjectId(pid);
    setRole(projRole);
    setRawRole(raw);
  }

  function handleSelectOrg(oid: number) {
    setOrgId(oid);
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
    setSummarySpaceIds(new Set(s.map((sp) => sp.id)));
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

  const assignmentsForSpace = useMemo(
    () => assignments.filter((a) => a.project === projectId && a.space === spaceId),
    [assignments, projectId, spaceId]
  );
  const currentSpaceName = spaces.find((s) => s.id === spaceId)?.name ?? "";
  const currentProjectName = currentOrg?.projects.find((p) => p.id === projectId)?.name ?? "";

  const spaceTotals = useMemo(
    () => sumByCurrency(assignmentsForSpace.map((a) => pricedProduct(a.product_detail))),
    [assignmentsForSpace, pricedProduct]
  );

  const printRows = useMemo(
    () =>
      assignmentsForSpace.map((a) => {
        const item = pricedProduct(a.product_detail);
        return {
          item: item.item,
          manufacturer: item.manufacturer,
          model_label: item.model_label,
          priceLabel: formatPrice(item),
          status: statusLabel(a),
          proposed_by: a.proposed_by,
          imageSrc: getImageSource(item.product_image),
        };
      }),
    [assignmentsForSpace, pricedProduct]
  );


  const spaceNameById = useMemo(() => {
    const map = new Map<number, string>();
    spaces.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [spaces]);

  const summaryAssignments = useMemo(
    () => assignments.filter((a) => a.project === projectId && summarySpaceIds.has(a.space)),
    [assignments, projectId, summarySpaceIds]
  );

  const summaryTotals = useMemo(
    () => sumByCurrency(summaryAssignments.map((a) => pricedProduct(a.product_detail))),
    [summaryAssignments, pricedProduct]
  );

   const summaryPrintRows = useMemo(
    () =>
      summaryAssignments.map((a) => {
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
        };
      }),
    [summaryAssignments, pricedProduct, spaceNameById]
  );

  const summaryScopeLabel = useMemo(() => {
    if (spaces.length === 0) return "All spaces";
    if (summarySpaceIds.size === spaces.length) return "All spaces";
    if (summarySpaceIds.size === 0) return "No spaces selected";
    const names = spaces.filter((s) => summarySpaceIds.has(s.id)).map((s) => s.name);
    return names.join(", ");
  }, [spaces, summarySpaceIds]);

  function toggleSummarySpace(id: number) {
    setSummarySpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllSummarySpaces() {
    setSummarySpaceIds(new Set(spaces.map((s) => s.id)));
  }

  function clearSummarySpaces() {
    setSummarySpaceIds(new Set());
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

  async function handleProposeItem(itemId: string) {
    if (!projectId || !spaceId) return;
    await runExclusive(`propose-${itemId}`, async () => {
      const created = await proposeAssignment(projectId, spaceId, itemId, role);
      setAssignments((prev) => [...prev, created]);
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

  function openSuggestModal() {
    setEditingProductId(null);
    setSuggestForm({ ...EMPTY_SUGGESTION, category: categoryId });
    setSuggestSuccess(false);
    setSuggestError(null);
    setShowSuggestModal(true);
  }

  // Opens the same modal pre-filled with an existing pending suggestion's
  // details, in "edit" mode. Only ever called for items where
  // canWithdraw is true (role === "client" && status === "pending"), so
  // there's no separate permission check needed here — the button that
  // triggers this already gates on that.
  function openEditSuggestion(item: ProductItem) {
    setEditingProductId(item.id);
    setSuggestForm({
      // The original free-text "space" the client typed isn't part of the
      // catalog item, so it can't be pre-filled here — it isn't editable
      // in this flow (the field is hidden while editing, see modal below).
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
      // Optimistically remove it from the catalog right away so the card
      // disappears instantly instead of waiting on the request — if the
      // delete fails server-side, put it back.
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-8 sm:space-y-12">
        {/* Organisation */}
        <section>
          <p className="pf-muted text-sm mb-3">Organisation</p>
          <div className="pf-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
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
          </div>
        </section>

        {/* Project — active ones (has_assignments) surface first, highlighted */}
        {!loadingContext && currentOrg && (
          <section>
            <p className="pf-muted text-sm mb-3">Project</p>
            <div className="pf-scroll-row flex gap-3 sm:gap-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {currentOrg.projects.map((p) => {
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
              })}
            </div>
          </section>
        )}

        {/* Spaces — with add / edit / delete */}
        {projectId && (
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="pf-muted text-sm">
                {loadingProjectData ? "Loading spaces…" : `Spaces · ${fullySpecifiedCount} of ${spaces.length} fully specified`}
              </p>
              {!isViewOnly && (
                <button
                  onClick={openAddSpace}
                  className="touch-manipulation pf-btn-outline-accent rounded-full px-4 py-1.5 text-sm flex-shrink-0"
                >
                  Add space
                </button>
              )}
            </div>

            <div className="pf-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
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
                    <div key={s.id} className="flex items-stretch gap-1.5 flex-shrink-0">
                      <button
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
                      {!isViewOnly && (
                        <button
                          onClick={() => openEditSpace(s)}
                          className="touch-manipulation pf-btn-outline rounded-full px-3 py-2 sm:py-2.5 text-xs flex-shrink-0"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl">Assigned to {currentSpaceName || "—"}</h2>
              <div className="flex items-center gap-3">
                <span className="pf-muted text-sm">{assignmentsForSpace.length} item{assignmentsForSpace.length === 1 ? "" : "s"}</span>
                {assignmentsForSpace.length > 0 && (
                  <ProductListPrintButton
                    orgName={currentOrg?.name ?? ""}
                    projectName={currentProjectName}
                    scopeLabel={currentSpaceName || "Space"}
                    rows={printRows}
                    totals={spaceTotals}
                    className="pf-btn-outline text-xs rounded-full px-3 py-1.5"
                    label="Print"
                  />
                )}
              </div>
            </div>

            {spaceTotals.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {spaceTotals.map((t) => (
                  <span key={t.currency} className="pf-total-pill text-sm font-medium rounded-full px-3 py-1">
                    Total: {formatTotal(t)}
                  </span>
                ))}
              </div>
            )}

            {loadingProjectData ? (
              <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
            ) : !spaceId ? (
              <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-10 text-center text-sm">
                Add a space above, then select it to start assigning products.
              </div>
            ) : assignmentsForSpace.length === 0 ? (
              <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-10 text-center text-sm">
                Nothing assigned yet. Choose an item from the catalog below.
              </div>
            ) : (
              <div className="space-y-3">
                {assignmentsForSpace.map((a) => {
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
                  const isConfirming = isBusy(confirmKey);
                  const isRemoving = isBusy(removeKey);
                  const isDeclining = isBusy(declineKey);
                  const isUndeclining = isBusy(undeclineKey);
                  const noteBoxOpen = decliningNoteId === a.id;

                  return (
                    <div key={a.id} className="pf-row flex flex-col gap-3 rounded-2xl px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                        <div className="flex items-center gap-4 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getImageSource(item.product_image)}
                            alt={item.item}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-[var(--font-display)] text-base sm:text-lg leading-tight truncate">{item.item}</div>
                            <div className="pf-muted text-sm truncate">{item.manufacturer} — {item.model_label}</div>
                            <div className="pf-faint text-xs capitalize mt-0.5">Proposed by {a.proposed_by}</div>
                            {price && <div className="text-sm font-medium mt-1">{price}</div>}
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

                      {/* Reason shown to both sides once this item has been declined. */}
                      {a.declined && a.declined_note && (
                        <div className="pf-empty-dashed rounded-xl px-4 py-2.5 text-sm">
                          <span className="pf-faint text-xs uppercase tracking-wide block mb-0.5">Decline note</span>
                          {a.declined_note}
                        </div>
                      )}

                      {/* Inline "add an optional note" box, opened by the Decline button above. */}
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

        {/* All spaces — combined list, filterable by space, printable */}
        {projectId && spaces.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
              <h2 className="font-[var(--font-display)] text-lg sm:text-xl">All spaces</h2>
              <div className="flex items-center gap-3">
                <span className="pf-muted text-sm">{summaryAssignments.length} item{summaryAssignments.length === 1 ? "" : "s"}</span>
                {summaryAssignments.length > 0 && (
                  <ProductListPrintButton
                    orgName={currentOrg?.name ?? ""}
                    projectName={currentProjectName}
                    scopeLabel={summaryScopeLabel}
                    rows={summaryPrintRows}
                    totals={summaryTotals}
                    className="pf-btn-outline text-xs rounded-full px-3 py-1.5"
                    label="Print"
                  />
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="pf-muted text-sm">Include spaces</span>
                <div className="flex gap-3 text-sm">
                  <button onClick={selectAllSummarySpaces} className="touch-manipulation pf-link">Select all</button>
                  <button onClick={clearSummarySpaces} className="touch-manipulation pf-link">Clear</button>
                </div>
              </div>
              <div className="pf-scroll-row flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {spaces.map((s) => {
                  const checked = summarySpaceIds.has(s.id);
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
                        onChange={() => toggleSummarySpace(s.id)}
                        className="pf-checkbox-input"
                      />
                      {s.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {summaryTotals.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {summaryTotals.map((t) => (
                  <span key={t.currency} className="pf-total-pill text-sm font-medium rounded-full px-3 py-1">
                    Total: {formatTotal(t)}
                  </span>
                ))}
              </div>
            )}

            {summaryAssignments.length === 0 ? (
              <div className="pf-empty-dashed rounded-2xl px-5 sm:px-6 py-10 text-center text-sm">
                {summarySpaceIds.size === 0
                  ? "No spaces selected above."
                  : "No products assigned in the selected spaces yet."}
              </div>
            ) : (
              <div className="pf-row rounded-2xl overflow-hidden">
                {/* Desktop / tablet: table */}
                <div className="pf-table-wrap overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="pf-table-head">
                        <th className="text-left px-4 py-2 font-medium">Space</th>
                        <th className="text-left px-4 py-2 font-medium">Item</th>
                        <th className="text-left px-4 py-2 font-medium">Manufacturer / Model</th>
                        <th className="text-left px-4 py-2 font-medium">Price</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryAssignments.map((a) => {
                        const item = pricedProduct(a.product_detail);
                        const price = formatPrice(item);
                        return (
                          <tr key={a.id} className="pf-table-row">
                            <td className="px-4 py-2">{spaceNameById.get(a.space) ?? "—"}</td>
                            <td className="px-4 py-2">{item.item}</td>
                            <td className="px-4 py-2 pf-muted">{item.manufacturer} — {item.model_label}</td>
                            <td className="px-4 py-2 font-medium">{price ?? "—"}</td>
                            <td className="px-4 py-2">{statusLabel(a)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: stacked cards, same data */}
                <div className="pf-summary-cards">
                  {summaryAssignments.map((a) => {
                    const item = pricedProduct(a.product_detail);
                    const price = formatPrice(item);
                    return (
                      <div key={a.id} className="pf-summary-card">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{item.item}</span>
                          {price && <span className="text-sm font-medium flex-shrink-0">{price}</span>}
                        </div>
                        <div className="pf-muted text-xs mt-0.5 truncate">{item.manufacturer} — {item.model_label}</div>
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <span className="pf-badge-soft text-[11px] px-2 py-0.5 rounded-full">
                            {spaceNameById.get(a.space) ?? "—"}
                          </span>
                          <span className="pf-faint text-[11px]">{statusLabel(a)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  // Editing and withdrawing a suggestion share the same
                  // permission: the client who can see it as "not approved
                  // yet" is the only one allowed to touch it, and only
                  // while it's still pending. Once an admin approves it
                  // (status flips away from "pending"), both buttons stop
                  // showing — same as the existing withdraw behaviour.
                  const canWithdraw = !isViewOnly && role === "client" && isPending;
                  const proposeKey = `propose-${item.id}`;
                  const withdrawKey = `withdraw-${item.id}`;
                  const isProposing = isBusy(proposeKey);
                  const isWithdrawing = isBusy(withdrawKey);
                  return (
                    <div key={item.id} className="pf-card rounded-2xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageSource(item.product_image)} alt={item.item} className="w-full h-36 sm:h-40 object-cover" />
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
                          <a href={item.product_link} target="_blank" className="pf-link text-xs underline underline-offset-2">
                            Product link
                          </a>
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
                        {!isViewOnly && (
                          <button
                            onClick={() => handleProposeItem(item.id)}
                            disabled={!spaceId || isProposing}
                            className="touch-manipulation pf-btn-primary mt-3 w-full text-sm rounded-full py-2.5 sm:py-2 disabled:opacity-40"
                          >
                            {!spaceId
                              ? "Add a space first"
                              : isProposing
                              ? "Adding…"
                              : count > 0
                              ? role === "client"
                                ? "Add another"
                                : "Suggest another"
                              : role === "client"
                              ? "Select for this space"
                              : "Suggest for this space"}
                          </button>
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

      {/* ── Suggest / edit-a-product modal ──────────────────────────────── */}
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

      {/* ── Space manager modal (add / edit / delete) ────────────────────── */}
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