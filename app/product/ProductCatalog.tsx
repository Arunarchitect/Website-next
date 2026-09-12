"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Role,
  ProductItem,
  Assignment,
  CATEGORIES,
  CATALOG_PAGE_SIZE,
  getImageSource,
  getPriceInfo,
  getProductsByCategory,
  proposeAssignment,
  suggestProduct,
  updateProductSuggestion,
  deleteProductSuggestion,
  setOrganisationNote,
} from "./productApi";

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

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatCurrencyValue(currency: string, value: number): string {
  return `${currency} ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function ProductLink({ href, className }: { href?: string | null; className?: string }) {
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

export function PriceBlock({ item, className }: { item: ProductItem; className?: string }) {
  const info = getPriceInfo(item);
  if (info.effective === null) return null;

  const effectiveLabel = formatCurrencyValue(info.currency, info.effective);
  const baseLabel = info.base !== null ? formatCurrencyValue(info.currency, info.base) : null;
  const pctLabel = info.diffPct !== null ? `${info.diffPct > 0 ? "+" : ""}${info.diffPct.toFixed(1)}%` : null;
  const pctClass = info.diffPct !== null && info.diffPct < 0 ? "pf-price-down" : "pf-price-up";

  return (
    <div className={className ?? "mt-1"}>
      <span className="text-sm font-medium">
        {effectiveLabel}
        {info.differs && pctLabel && (
          <span className={`ml-1.5 text-xs font-semibold ${pctClass}`}>{pctLabel}</span>
        )}
      </span>
      {baseLabel && (
        <div className="pf-faint text-xs mt-0.5">
          {info.differs ? <span className="line-through">{baseLabel}</span> : <span>{baseLabel}</span>} MRP
        </div>
      )}
    </div>
  );
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

interface ProductCatalogProps {
  catalogAll: ProductItem[];
  setCatalogAll: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  assignments: Assignment[];
  categoryId: string;
  setCategoryId: (id: string) => void;
  projectId: number | null;
  orgId: number | null;
  spaceId: number | null;
  currentSpaceName: string;
  role: Role;
  rawRole: string;
  isViewOnly: boolean;
  loadingCatalog: boolean;
  isBusy: (key: string) => boolean;
  runExclusive: (key: string, fn: () => Promise<void>) => Promise<void>;
  onAssignmentCreated: (a: Assignment) => void;
  refetchCatalog: () => Promise<void>;
}

export default function ProductCatalog({
  catalogAll,
  setCatalogAll,
  assignments,
  categoryId,
  setCategoryId,
  projectId,
  orgId,
  spaceId,
  currentSpaceName,
  role,
  rawRole,
  isViewOnly,
  loadingCatalog: pageCatalogLoading,
  isBusy,
  runExclusive,
  onAssignmentCreated,
  refetchCatalog,
}: ProductCatalogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounced(searchTerm, 250);

  const [page, setPage] = useState(1);
  const [pageItems, setPageItems] = useState<ProductItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestForm, setSuggestForm] = useState(EMPTY_SUGGESTION);
  const [suggestSuccess, setSuggestSuccess] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [proposingNoteId, setProposingNoteId] = useState<string | null>(null);
  const [proposeNoteText, setProposeNoteText] = useState("");

  const [editingOrgNoteId, setEditingOrgNoteId] = useState<string | null>(null);
  const [orgNoteText, setOrgNoteText] = useState("");
  const [orgNoteError, setOrgNoteError] = useState<string | null>(null);
  const [orgNoteSavedFlash, setOrgNoteSavedFlash] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [projectId, categoryId, debouncedSearch]);

  const fetchPage = useCallback(async () => {
    if (!projectId) {
      setPageItems([]);
      setTotalCount(0);
      setHasNext(false);
      return;
    }
    setLoadingPage(true);
    try {
      const result = await getProductsByCategory(categoryId, projectId, {
        search: debouncedSearch || undefined,
        page,
      });
      setPageItems(result.items);
      setTotalCount(result.count);
      setHasNext(result.hasNext);
    } finally {
      setLoadingPage(false);
    }
  }, [projectId, categoryId, debouncedSearch, page]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / CATALOG_PAGE_SIZE));

  const assignmentsForSpace = useMemo(
    () => assignments.filter((a) => a.project === projectId && a.space === spaceId),
    [assignments, projectId, spaceId]
  );

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
      onAssignmentCreated(created);
      setProposingNoteId(null);
      setProposeNoteText("");
    });
  }

  function openOrgNoteEditor(item: ProductItem) {
    setEditingOrgNoteId(item.id);
    setOrgNoteText(item.organisation_note?.note ?? "");
    setOrgNoteError(null);
  }

  function cancelOrgNoteEditor() {
    setEditingOrgNoteId(null);
    setOrgNoteText("");
    setOrgNoteError(null);
  }

  async function handleSaveOrgNote(itemId: string, note: string) {
    if (!orgId) return;
    setOrgNoteError(null);
    await runExclusive(`org-note-${itemId}`, async () => {
      try {
        const saved = await setOrganisationNote(itemId, orgId, note);

        setPageItems((prev) =>
          prev.map((p) => (p.id === itemId ? { ...p, organisation_note: saved } : p))
        );
        setCatalogAll((prev) =>
          Array.isArray(prev)
            ? prev.map((p) => (p.id === itemId ? { ...p, organisation_note: saved } : p))
            : prev
        );

        setEditingOrgNoteId(null);
        setOrgNoteText("");
        setOrgNoteSavedFlash(saved?.note ? "Note saved." : "Note cleared.");
        window.setTimeout(() => setOrgNoteSavedFlash(null), 2500);
      } catch (err: unknown) {
        setOrgNoteError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't save the note. Please try again."
        );
      }
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
          setPageItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          await refetchCatalog();
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
          await fetchPage();
          await refetchCatalog();
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
      const previous = pageItems;
      setPageItems((prev) => prev.filter((p) => p.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      try {
        await deleteProductSuggestion(id);
        await refetchCatalog();
      } catch (err) {
        setPageItems(previous);
        setTotalCount((c) => c + 1);
        throw err;
      }
    });
  }

  const suggesting = isBusy("suggest-submit");
  const isOrgAdmin = !isViewOnly && rawRole === "admin";

  // Referenced so no-unused-vars doesn't complain; the paginated view
  // intentionally uses its own pageItems state.
  void catalogAll;
  void pageCatalogLoading;

  return (
    <>
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
          {loadingPage ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : pageItems.length === 0 ? (
            <div className="col-span-full text-center py-10 space-y-3">
              <p className="pf-muted text-sm">No matching products.</p>
              {!isViewOnly && role === "client" && (
                <button onClick={openSuggestModal} className="touch-manipulation pf-btn-primary text-sm rounded-full px-5 py-2.5">
                  Can&apos;t find it? Suggest a product
                </button>
              )}
            </div>
          ) : (
            pageItems.map((item) => {
              const stats = itemStats.get(item.id);
              const count = selectedCountsForSpace.get(item.id) ?? 0;
              const isPending = item.status === "pending";
              const canWithdraw = !isViewOnly && role === "client" && isPending;
              const proposeKey = `propose-${item.id}`;
              const withdrawKey = `withdraw-${item.id}`;
              const orgNoteKey = `org-note-${item.id}`;
              const isProposing = isBusy(proposeKey);
              const isWithdrawing = isBusy(withdrawKey);
              const isSavingOrgNote = isBusy(orgNoteKey);
              const noteBoxOpen = proposingNoteId === item.id;
              const orgNoteEditorOpen = editingOrgNoteId === item.id;
              return (
                <div key={item.id} className="pf-card rounded-2xl overflow-hidden">
                  <div className="w-full h-36 sm:h-40 bg-white flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageSource(item)}
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
                    <PriceBlock item={item} />
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

                    {orgNoteEditorOpen ? (
                      <div className="mt-3 space-y-2">
                        <label className="text-xs pf-muted block">
                          Your organisation&apos;s note on this product — visible to everyone in your org
                        </label>
                        <textarea
                          value={orgNoteText}
                          onChange={(e) => setOrgNoteText(e.target.value)}
                          rows={2}
                          disabled={isSavingOrgNote}
                          placeholder="e.g. We get a trade discount from this manufacturer."
                          className="pf-input rounded-lg px-3 py-2 text-sm w-full disabled:opacity-60"
                        />
                        {orgNoteError && (
                          <p className="pf-error-box text-xs rounded-lg px-3 py-2">{orgNoteError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveOrgNote(item.id, orgNoteText)}
                            disabled={isSavingOrgNote}
                            className="touch-manipulation pf-btn-accent text-xs rounded-full px-4 py-1.5 disabled:opacity-50"
                          >
                            {isSavingOrgNote ? "Saving…" : "Save note"}
                          </button>
                          <button
                            onClick={cancelOrgNoteEditor}
                            disabled={isSavingOrgNote}
                            className="touch-manipulation pf-btn-outline text-xs rounded-full px-4 py-1.5 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {orgNoteSavedFlash && item.organisation_note && (
                          <p className="pf-success-text text-xs mt-1">{orgNoteSavedFlash}</p>
                        )}
                        {item.organisation_note?.note && (
                          <div className="pf-empty-dashed rounded-xl px-3 py-2 text-xs mt-2">
                            <span className="pf-faint uppercase tracking-wide block mb-0.5">
                              Note from your organisation
                            </span>
                            {item.organisation_note.note}
                          </div>
                        )}
                        {isOrgAdmin && (
                          <button
                            onClick={() => openOrgNoteEditor(item)}
                            className="touch-manipulation pf-link text-xs mt-1.5 inline-block"
                          >
                            {item.organisation_note?.note ? "Edit org note" : "Add org note"}
                          </button>
                        )}
                      </>
                    )}

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

        {!loadingPage && totalCount > 0 && (
          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <p className="pf-muted text-xs">
              Page {page} of {totalPages} · {totalCount} item{totalCount === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="touch-manipulation pf-btn-outline text-xs rounded-full px-4 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => (hasNext ? p + 1 : p))}
                disabled={!hasNext}
                className="touch-manipulation pf-btn-outline text-xs rounded-full px-4 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

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
                      catalog right away (marked as pending), and an admin will review it
                      before others can see it.
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
    </>
  );
}