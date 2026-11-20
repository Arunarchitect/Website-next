"use client";

// app/gallery/components.tsx
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useGallery } from "./GalleryContext";
import {
  CURRENCIES,
  addCritique,
  confirmEmailVerification,
  formatSize,
  getCritiques,
  requestEmailVerification,
} from "./galleryApi";
import type { Artist, Artwork, Critique, Currency } from "./types";

/* ------------------------------- masthead ------------------------------- */

export function Masthead() {
  const {
    commercial,
    setCommercial,
    unit,
    setUnit,
    currency,
    setCurrency,
    rates,
    query,
    setQuery,
    advanced,
    setAdvanced,
  } = useGallery();
  const router = useRouter();
  const pathname = usePathname();

  // search results are shown on the exhibition page, so searching from
  // an artwork or artist page takes the visitor back there
  const goHome = () => {
    if (pathname !== "/gallery") router.push("/gallery");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    goHome();
  };

  return (
    <header className="g-masthead">
      <div className="g-masthead-top">
        <span>Est. MMXXVI</span>
        <span>Exhibition &amp; Sale of Fine Art</span>
      </div>
      <h1 className="g-brand">
        <Link href="/gallery">The Online Gallery</Link>
      </h1>
      <p className="g-tagline">A Selection of Contemporary Works</p>

      <nav className="g-nav">
        <div className="g-nav-left">
          <Link href="/gallery">Exhibition</Link>

          <form className="g-search" role="search" onSubmit={onSubmit}>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value) goHome();
              }}
              placeholder={
                commercial
                  ? "Title, artist, size… or “under 50000”"
                  : "Title, artist, size, description…"
              }
              aria-label="Search the exhibition"
            />
            <label className="g-check g-adv" title="Also search the critiques">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) => setAdvanced(e.target.checked)}
              />
              Advanced
            </label>
          </form>
        </div>

        <div className="g-nav-tools">
          <span className="g-tool">
            <button
              className={unit === "metric" ? "on" : ""}
              onClick={() => setUnit("metric")}
            >
              Metric
            </button>
            <span>/</span>
            <button
              className={unit === "imperial" ? "on" : ""}
              onClick={() => setUnit("imperial")}
            >
              Imperial
            </button>
          </span>

          {commercial && (
            <select
              className="g-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              aria-label="Currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}

          <label className="g-switch">
            <input
              type="checkbox"
              checked={commercial}
              onChange={(e) => setCommercial(e.target.checked)}
            />
            <span className="g-switch-track">
              <span className="g-switch-knob" />
            </span>
            <span>Commercial</span>
          </label>
        </div>
      </nav>

      {commercial && rates && (
        <p className="g-ratenote">
          {rates.live ? "Live exchange rates" : "Indicative exchange rates"} · prices shown in{" "}
          {currency} · all purchases on this site are demonstration only
        </p>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="g-footer">
      <p>The Online Gallery · Demonstration site · All works are fictional</p>
    </footer>
  );
}

/* ------------------------------- image ---------------------------------- */

export function ArtImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={`g-img-fallback ${className}`}>Image unavailable</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* ------------------------------- rating --------------------------------- */

export function RatingBadge({ avg, count }: { avg: number; count: number }) {
  return (
    <span className="g-rating" aria-label={`Average rating ${avg.toFixed(1)} of 5 from ${count}`}>
      ★ {avg.toFixed(1)} <span className="g-muted g-small">({count})</span>
    </span>
  );
}

/* ------------------------------- card ----------------------------------- */

export function ArtCard({
  art,
  artist,
  rating,
}: {
  art: Artwork;
  artist?: Artist;
  /** undefined = don't show; null = show "Not yet rated"; object = show badge */
  rating?: { avg: number; count: number } | null;
}) {
  const { commercial, unit, priceLabel } = useGallery();
  const sold = art.status === "sold";

  return (
    <figure className="g-card">
      <Link href={`/gallery/artwork/${art.id}`} className="g-frame" aria-label={art.title}>
        <span className="g-mat">
          <ArtImage src={art.image} alt={art.title} />
        </span>
        {commercial && art.status !== "available" && (
          <span className={`g-stamp g-stamp-${art.status}`}>
            {sold ? "Sold" : "Reserved"}
          </span>
        )}
      </Link>

      <figcaption className="g-caption">
        <Link href={`/gallery/artwork/${art.id}`} className="g-caption-title">
          {art.title}
        </Link>
        {artist && (
          <Link href={`/gallery/artist/${artist.id}`} className="g-caption-artist">
            {artist.name}
          </Link>
        )}
        <span className="g-caption-line">
          {art.type}, {art.year}
        </span>
        <span className="g-caption-line">{art.medium}</span>
        <span className="g-caption-line">{formatSize(art.dims, unit)}</span>
        {commercial && rating !== undefined && (
          rating ? (
            <RatingBadge avg={rating.avg} count={rating.count} />
          ) : (
            <span className="g-caption-line">Not yet rated</span>
          )
        )}
        {commercial && (
          <span
            className={`g-caption-price ${sold ? "g-struck" : ""} ${
              art.priceOnRequest && !sold ? "g-por" : ""
            }`}
          >
            {sold ? "Sold" : priceLabel(art)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/* ------------------------------ critiques ------------------------------- */

function Stars({ n }: { n: number }) {
  return (
    <span className="g-stars" aria-label={`${n} of 5`}>
      {"★".repeat(n)}
      <span className="g-stars-off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Critiques({ artworkId }: { artworkId: string }) {
  const [list, setList] = useState<Critique[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const [mode, setMode] = useState<"unverified" | "verified">("unverified");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [rating, setRating] = useState(4);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [emailOk, setEmailOk] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setList(await getCritiques(artworkId)), [artworkId]);
  useEffect(() => {
    load();
  }, [load]);

  const sendCode = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await requestEmailVerification(email);
      setDemoCode(r.demoCode);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setErr(null);
    setBusy(true);
    const ok = await confirmEmailVerification(email, code);
    setBusy(false);
    if (ok) setEmailOk(true);
    else setErr("Incorrect code");
  };

  const post = async () => {
    setErr(null);
    setBusy(true);
    try {
      await addCritique({
        artworkId,
        author: name,
        text,
        rating,
        email: mode === "verified" ? email : undefined,
      });
      setText("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const visible = verifiedOnly ? list.filter((c) => c.verified) : list;
  const canPost = text.trim().length >= 3 && (mode === "unverified" || emailOk);
  const avg = list.length ? list.reduce((s, c) => s + c.rating, 0) / list.length : null;

  return (
    <section className="g-crit">
      <div className="g-crit-head">
        <h2 className="g-h2">
          Critiques ({list.length})
          {avg !== null && (
            <span className="g-crit-avg">
              <RatingBadge avg={avg} count={list.length} />
            </span>
          )}
        </h2>
        <label className="g-check">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
          />
          Verified only
        </label>
      </div>

      {visible.length === 0 && <p className="g-muted">No critiques have been written yet.</p>}
      <ul className="g-crit-list">
        {visible.map((c) => (
          <li key={c.id}>
            <div className="g-crit-top">
              <strong>{c.author}</strong>
              {c.verified ? (
                <span className="g-tag g-tag-ok" title={c.emailMasked}>
                  Verified
                </span>
              ) : (
                <span className="g-tag">Unverified</span>
              )}
              <Stars n={c.rating} />
              <span className="g-muted g-small">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p>{c.text}</p>
          </li>
        ))}
      </ul>

      <div className="g-form">
        <h3 className="g-h3">Write a critique</h3>

        <div className="g-tool">
          <button
            className={mode === "unverified" ? "on" : ""}
            onClick={() => setMode("unverified")}
          >
            Anonymous
          </button>
          <span>/</span>
          <button className={mode === "verified" ? "on" : ""} onClick={() => setMode("verified")}>
            Verify by email
          </button>
        </div>

        {mode === "verified" && (
          <div className="g-verify">
            <div className="g-row">
              <input
                placeholder="you@email.com"
                type="email"
                value={email}
                disabled={emailOk}
                onChange={(e) => setEmail(e.target.value)}
              />
              {!emailOk && (
                <button className="g-btn g-btn-ghost" disabled={busy || !email} onClick={sendCode}>
                  Send code
                </button>
              )}
            </div>
            {demoCode && !emailOk && (
              <>
                <small className="g-muted">Demonstration: your code is {demoCode}</small>
                <div className="g-row">
                  <input
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button className="g-btn g-btn-ghost" disabled={busy || !code} onClick={verify}>
                    Verify
                  </button>
                </div>
              </>
            )}
            {emailOk && <small className="g-ok">Email verified.</small>}
          </div>
        )}

        <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n})
            </option>
          ))}
        </select>
        <textarea
          rows={4}
          placeholder="Your critique…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {err && <p className="g-err">{err}</p>}
        <button className="g-btn" disabled={!canPost || busy} onClick={post}>
          Submit {mode === "verified" ? "verified " : ""}critique
        </button>
      </div>
    </section>
  );
}