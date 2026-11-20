"use client";

// app/gallery/page.tsx
import { useEffect, useMemo, useState } from "react";
import { ArtCard } from "./components";
import { useGallery } from "./GalleryContext";
import { ART_TYPES, getAllCritiques, getArtists, getArtworks } from "./galleryApi";
import { parseQuery, ratingStats, searchWorks, shuffleRanks, sortWorks } from "./search";
import type { ArtType, Artist, Artwork, Critique, SortOption } from "./types";

const SORTS: { value: SortOption; label: string }[] = [
  { value: "default", label: "Random order" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating-desc", label: "Rating: high to low" },
  { value: "rating-asc", label: "Rating: low to high" },
];

export default function GalleryHome() {
  const { commercial, currency, rates, query, advanced } = useGallery();

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [artists, setArtists] = useState<Record<string, Artist>>({});
  const [critiques, setCritiques] = useState<Critique[]>([]);
  const [rank, setRank] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<ArtType | "All">("All");
  const [sort, setSort] = useState<SortOption>("default");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [w, a, c] = await Promise.all([getArtworks(), getArtists(), getAllCritiques()]);
      setArtworks(w);
      setArtists(Object.fromEntries(a.map((x) => [x.id, x])));
      setCritiques(c);
      // shuffled here (client only, after mount), so there is no hydration mismatch
      setRank(shuffleRanks(w.map((x) => x.id)));
      setLoading(false);
    })();
  }, []);

  const ratings = useMemo(() => ratingStats(critiques), [critiques]);
  const parsed = useMemo(() => parseQuery(query, commercial), [query, commercial]);
  const rateTable = rates?.rates ?? null;

  const shown = useMemo(() => {
    const found = searchWorks({
      works: artworks.filter((w) => filter === "All" || w.type === filter),
      artists,
      critiques,
      parsed,
      advanced,
      commercial,
      currency,
      rates: rateTable,
    });
    return sortWorks(found, commercial ? sort : "default", {
      rank,
      ratings,
      currency,
      rates: rateTable,
    });
  }, [artworks, artists, critiques, parsed, advanced, commercial, currency, rateTable, filter, sort, rank, ratings]);

  const searching = query.trim().length > 0;
  const priceNote =
    commercial && (parsed.min != null || parsed.max != null)
      ? ` · price ${
          parsed.min != null && parsed.max != null
            ? `${parsed.min.toLocaleString()} to ${parsed.max.toLocaleString()}`
            : parsed.max != null
              ? `up to ${parsed.max.toLocaleString()}`
              : `from ${parsed.min!.toLocaleString()}`
        } ${currency}`
      : "";

  return (
    <>
      <section className="g-intro">
        <h2 className="g-h1">The Current Exhibition</h2>
        <div className="g-rule" />
        <p>
          Paintings, drawings, sculpture, installation and photography, gathered for the
          season. Select a work to view it in detail.
        </p>
      </section>

      <nav className="g-filters" aria-label="Filter by type">
        {(["All", ...ART_TYPES] as const).map((t) => (
          <button key={t} className={filter === t ? "on" : ""} onClick={() => setFilter(t)}>
            {t}
          </button>
        ))}
      </nav>

      {commercial && (
        <div className="g-sortbar">
          <label htmlFor="g-sort">Sort by</label>
          <select
            id="g-sort"
            className="g-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!loading && (searching || priceNote) && (
        <p className="g-results" role="status">
          {shown.length} {shown.length === 1 ? "work" : "works"} found
          {searching ? ` for “${query.trim()}”` : ""}
          {advanced && searching ? " (including critiques)" : ""}
          {priceNote}
        </p>
      )}

      {loading ? (
        <p className="g-muted g-center">Preparing the exhibition…</p>
      ) : shown.length === 0 ? (
        <p className="g-muted g-center">
          No works match. Try fewer words{!advanced ? ", or switch on Advanced to search critiques" : ""}.
        </p>
      ) : (
        <div className="g-grid">
          {shown.map((w) => (
            <ArtCard
              key={w.id}
              art={w}
              artist={artists[w.artistId]}
              rating={ratings[w.id] ?? null}
            />
          ))}
        </div>
      )}
    </>
  );
}