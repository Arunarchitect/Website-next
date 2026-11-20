// app/gallery/search.ts
// Pure helpers: query parsing, searching, rating stats, sorting, shuffling.
// No React, no data fetching, so it is easy to test or move server-side later.

import { convertPrice } from "./galleryApi";
import type { Artist, Artwork, Critique, Currency, SortOption } from "./types";

export interface ParsedQuery {
  terms: string[]; // lowercase words that must all match
  min?: number; // price bounds, in the currently selected currency
  max?: number;
}

export interface Rating {
  avg: number;
  count: number;
}

/* ------------------------------ query parsing ---------------------------- */
/*
  Price syntax (commercial mode only), mixed freely with normal words:
    under 50000   below 50k   <50000        -> max
    over 20000    above 20k   >20000        -> min
    price:10000-50000   price:10k to 50k    -> range
  Amounts are in the currency chosen in the masthead.
*/

const N = String.raw`(\d[\d.,]*)(k)?(?![a-z])`;
const RANGE = new RegExp(String.raw`price\s*:\s*${N}\s*(?:-|to)\s*${N}`, "i");
const MAX = new RegExp(
  String.raw`(?:price\s*:\s*)?(?:\b(?:under|below)\s+|<\s*)${N}`,
  "i",
);
const MIN = new RegExp(
  String.raw`(?:price\s*:\s*)?(?:\b(?:over|above)\s+|>\s*)${N}`,
  "i",
);

const toNum = (digits: string, k?: string) => {
  const n = parseFloat(digits.replace(/,/g, ""));
  return k ? n * 1000 : n;
};

export function parseQuery(raw: string, commercial: boolean): ParsedQuery {
  const out: ParsedQuery = { terms: [] };
  let s = raw.toLowerCase().replace(/×/g, "x");

  if (commercial) {
    s = s.replace(RANGE, (_m, a: string, ak: string, b: string, bk: string) => {
      const x = toNum(a, ak);
      const y = toNum(b, bk);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        out.min = Math.min(x, y);
        out.max = Math.max(x, y);
      }
      return " ";
    });
    s = s.replace(MAX, (_m, a: string, k: string) => {
      const n = toNum(a, k);
      if (Number.isFinite(n)) out.max = n;
      return " ";
    });
    s = s.replace(MIN, (_m, a: string, k: string) => {
      const n = toNum(a, k);
      if (Number.isFinite(n)) out.min = n;
      return " ";
    });
  }

  out.terms = s.split(/\s+/).filter(Boolean);
  return out;
}

/* -------------------------------- ratings -------------------------------- */

export function ratingStats(critiques: Critique[]): Record<string, Rating> {
  const sums: Record<string, { total: number; count: number }> = {};
  for (const c of critiques) {
    const s = (sums[c.artworkId] ??= { total: 0, count: 0 });
    s.total += c.rating;
    s.count += 1;
  }
  const out: Record<string, Rating> = {};
  for (const [id, s] of Object.entries(sums)) {
    out[id] = { avg: s.total / s.count, count: s.count };
  }
  return out;
}

/* -------------------------------- search --------------------------------- */

const sizeText = (w: Artwork) => {
  const v = [w.dims.h, w.dims.w, ...(w.dims.d != null ? [w.dims.d] : [])];
  const inch = v.map((x) => Math.round(x / 2.54));
  return `${v.join("x")} ${v.join(" x ")} ${v.join(" ")} cm ${inch.join("x")} in`;
};

export function searchWorks(args: {
  works: Artwork[];
  artists: Record<string, Artist>;
  critiques: Critique[];
  parsed: ParsedQuery;
  advanced: boolean; // also search critique text and critic names
  commercial: boolean;
  currency: Currency;
  rates: Record<Currency, number> | null;
}): Artwork[] {
  const { works, artists, critiques, parsed, advanced, commercial, currency, rates } = args;

  const critiqueText = new Map<string, string>();
  if (advanced) {
    for (const c of critiques) {
      critiqueText.set(
        c.artworkId,
        `${critiqueText.get(c.artworkId) ?? ""} ${c.author} ${c.text}`,
      );
    }
  }

  const hasPrice = commercial && (parsed.min != null || parsed.max != null);

  return works.filter((w) => {
    if (parsed.terms.length) {
      const hay = [
        w.title,
        artists[w.artistId]?.name ?? "",
        w.type,
        w.medium,
        w.gist,
        w.description,
        sizeText(w),
        advanced ? (critiqueText.get(w.id) ?? "") : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!parsed.terms.every((t) => hay.includes(t))) return false;
    }

    if (hasPrice) {
      if (w.priceOnRequest) return false; // undisclosed prices cannot be compared
      const p = rates ? convertPrice(w.price, currency, rates) : w.price.amount;
      if (parsed.min != null && p < parsed.min) return false;
      if (parsed.max != null && p > parsed.max) return false;
    }
    return true;
  });
}

/* --------------------------------- sorting ------------------------------- */

export function shuffleRanks(ids: string[]): Record<string, number> {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return Object.fromEntries(a.map((id, i) => [id, i]));
}

// nulls (undisclosed price / no ratings) always go to the end
const cmpNullsLast = (a: number | null, b: number | null, dir: 1 | -1) =>
  a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : (a - b) * dir;

export function sortWorks(
  list: Artwork[],
  sort: SortOption,
  ctx: {
    rank: Record<string, number>; // random order for this page load
    ratings: Record<string, Rating>;
    currency: Currency;
    rates: Record<Currency, number> | null;
  },
): Artwork[] {
  const byRank = (a: Artwork, b: Artwork) => (ctx.rank[a.id] ?? 0) - (ctx.rank[b.id] ?? 0);
  const price = (w: Artwork): number | null =>
    w.priceOnRequest
      ? null
      : ctx.rates
        ? convertPrice(w.price, ctx.currency, ctx.rates)
        : w.price.amount;
  const avg = (w: Artwork) => ctx.ratings[w.id]?.avg ?? null;
  const cnt = (w: Artwork) => ctx.ratings[w.id]?.count ?? 0;

  const out = [...list];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => cmpNullsLast(price(a), price(b), 1) || byRank(a, b));
    case "price-desc":
      return out.sort((a, b) => cmpNullsLast(price(a), price(b), -1) || byRank(a, b));
    case "rating-desc":
      return out.sort(
        (a, b) => cmpNullsLast(avg(a), avg(b), -1) || cnt(b) - cnt(a) || byRank(a, b),
      );
    case "rating-asc":
      return out.sort(
        (a, b) => cmpNullsLast(avg(a), avg(b), 1) || cnt(b) - cnt(a) || byRank(a, b),
      );
    default:
      return out.sort(byRank);
  }
}