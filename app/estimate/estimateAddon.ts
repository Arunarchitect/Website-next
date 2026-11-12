/**
 * Add-on data for the estimate viewer: the project's product list total (from the Products page)
 * plus the totals of other estimates of the same project. Pure helpers, no network code.
 */

// Structural types, so the product module's Assignment objects fit without importing them here.
export interface AddonPriced {
  base_price?: string | null;
  currency?: string | null;
  effective_price?: string | null;
}
export interface AddonAssignment {
  declined: boolean;
  client_confirmed: boolean;
  architect_confirmed: boolean;
  product_detail: AddonPriced;
  variant_detail?: AddonPriced | null;
}

export type ProductScope = "all" | "non_declined" | "confirmed";

export const PRODUCT_SCOPES: { value: ProductScope; label: string }[] = [
  { value: "non_declined", label: "Excluding declined items" },
  { value: "all", label: "All items (same as the Products page total)" },
  { value: "confirmed", label: "Only items confirmed by both sides" },
];

export interface ProductsAddon {
  count: number;
  unpriced: number;
  byCurrency: Record<string, number>;
  scope: ProductScope;
}

export interface EstimateAddonItem {
  id: number;
  title: string;
  item_count: number;
  total: number;
}

export interface AddonState {
  products: ProductsAddon | null;
  estimates: EstimateAddonItem[];
}

export const EMPTY_ADDON: AddonState = { products: null, estimates: [] };

export interface AddonLine {
  key: string;
  title: string;
  /** Number added into the combined total, or null when shown for information only. */
  amount: number | null;
  amountLabel: string;
}

export const money = (n: number): string =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * One assignment = one unit, priced like the Products page: the picked variant's price, else the product's.
 * `scope` decides which assignments count.
 */
export function summarizeAssignments(list: AddonAssignment[], scope: ProductScope): ProductsAddon {
  let count = 0;
  let unpriced = 0;
  const byCurrency: Record<string, number> = {};
  list.forEach((a) => {
    if (scope !== "all" && a.declined) return;
    if (scope === "confirmed" && !(a.client_confirmed && a.architect_confirmed)) return;
    count++;
    const src = a.variant_detail ?? a.product_detail; // variant prices are already resolved server-side
    const raw = src.effective_price ?? src.base_price;
    const v = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(v)) {
      unpriced++;
      return;
    }
    const cur = src.currency || "INR";
    byCurrency[cur] = Math.round(((byCurrency[cur] ?? 0) + v) * 100) / 100;
  });
  return { count, unpriced, byCurrency, scope };
}

export function addonLines(a: AddonState): AddonLine[] {
  const out: AddonLine[] = [];
  if (a.products) {
    const p = a.products;
    const scopeNote = p.scope === "non_declined" ? ", excl. declined" : p.scope === "confirmed" ? ", confirmed only" : "";
    const base = `Product list (${p.count} item${p.count === 1 ? "" : "s"}${scopeNote}${
      p.unpriced ? `, ${p.unpriced} unpriced` : ""
    })`;
    const currencies = Object.keys(p.byCurrency);
    if (currencies.length === 0) out.push({ key: "products", title: base, amount: 0, amountLabel: "-" });
    currencies.forEach((c, i) => {
      const v = p.byCurrency[c];
      const title = i === 0 ? base : `${base} - ${c}`;
      if (c === "INR") out.push({ key: "products-INR", title, amount: v, amountLabel: money(v) });
      else out.push({ key: `products-${c}`, title: `${title} (${c})`, amount: null, amountLabel: `${c} ${money(v)} (not added)` });
    });
  }
  a.estimates.forEach((e) =>
    out.push({
      key: `estimate-${e.id}`,
      title: `Estimate: ${e.title} (${e.item_count} item${e.item_count === 1 ? "" : "s"})`,
      amount: e.total,
      amountLabel: money(e.total),
    })
  );
  return out;
}

export const addonTotal = (a: AddonState): number =>
  Math.round(addonLines(a).reduce((s, l) => s + (l.amount ?? 0), 0) * 100) / 100;