"use client";

// app/gallery/artwork/[id]/page.tsx
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArtCard, ArtImage, Critiques } from "../../components";
import { useGallery } from "../../GalleryContext";
import {
  buyArtwork,
  formatMoney,
  formatSize,
  getArtist,
  getArtwork,
  getArtworksByArtist,
  sendEnquiry,
} from "../../galleryApi";
import type { Artist, Artwork } from "../../types";

export default function ArtworkPage() {
  const { id } = useParams<{ id: string }>();
  const { commercial, unit, currency, priceLabel } = useGallery();

  const [art, setArt] = useState<Artwork | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [more, setMore] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);

  const [buying, setBuying] = useState(false); // also opens the enquiry form
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const w = await getArtwork(id);
      if (!alive) return;
      setArt(w);
      if (w) {
        const [a, others] = await Promise.all([
          getArtist(w.artistId),
          getArtworksByArtist(w.artistId),
        ]);
        if (!alive) return;
        setArtist(a);
        setMore(others.filter((o) => o.id !== w.id));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const doBuy = async () => {
    if (!art) return;
    setBusy(true);
    setMsg(null);
    try {
      const updated = await buyArtwork(art.id, buyer);
      setArt(updated);
      setBuying(false);
      setMsg({ ok: true, text: "Thank you. This work is now marked as sold (demonstration only)." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doEnquire = async () => {
    if (!art) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendEnquiry(art.id, { ...buyer, note });
      setBuying(false);
      setNote("");
      setMsg({
        ok: true,
        text: "Thank you. Your enquiry has been sent. The gallery will reply with the price (demonstration only).",
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="g-muted g-center">Loading…</p>;
  if (!art)
    return (
      <div className="g-center">
        <p>This work could not be found.</p>
        <Link href="/gallery" className="g-link">
          Return to the exhibition
        </Link>
      </div>
    );

  const por = !!art.priceOnRequest;
  const converted = !por && art.price.currency !== currency;

  return (
    <>
      <p className="g-crumbs">
        <Link href="/gallery">Exhibition</Link>
        <span>›</span>
        {artist && (
          <>
            <Link href={`/gallery/artist/${artist.id}`}>{artist.name}</Link>
            <span>›</span>
          </>
        )}
        <em>{art.title}</em>
      </p>

      <div className="g-detail">
        <div className="g-detail-image">
          <div className="g-frame g-frame-lg">
            <span className="g-mat">
              <ArtImage src={art.image} alt={art.title} />
            </span>
            {commercial && art.status !== "available" && (
              <span className={`g-stamp g-stamp-${art.status}`}>
                {art.status === "sold" ? "Sold" : "Reserved"}
              </span>
            )}
          </div>
        </div>

        <aside className="g-label">
          <h2 className="g-h1 g-left">{art.title}</h2>
          {artist && (
            <Link href={`/gallery/artist/${artist.id}`} className="g-label-artist">
              {artist.name}
            </Link>
          )}
          <p className="g-label-gist">{art.gist}</p>
          <div className="g-rule g-rule-left" />
          <p>{art.description}</p>

          <dl className="g-specs">
            <dt>Category</dt>
            <dd>{art.type}</dd>
            <dt>Medium</dt>
            <dd>{art.medium}</dd>
            <dt>Year</dt>
            <dd>{art.year}</dd>
            <dt>Dimensions</dt>
            <dd>{formatSize(art.dims, unit)}</dd>
          </dl>

          {commercial && (
            <div className="g-buybox">
              <div>
                <div
                  className={`g-price ${art.status === "sold" ? "g-struck" : ""} ${
                    por && art.status !== "sold" ? "g-por" : ""
                  }`}
                >
                  {art.status === "sold" ? "Sold" : priceLabel(art)}
                </div>
                {converted && art.status !== "sold" && (
                  <small className="g-muted">
                    Listed at {formatMoney(art.price.amount, art.price.currency)}
                  </small>
                )}
              </div>

              {art.status === "available" && !buying && (
                <button className="g-btn" onClick={() => setBuying(true)}>
                  {por ? "Enquire about price" : "Acquire this work"}
                </button>
              )}
              {art.status === "reserved" && <span className="g-tag">Reserved</span>}
              {art.status === "sold" && <span className="g-tag g-tag-sold">Sold out</span>}
            </div>
          )}

          {commercial && buying && (
            <div className="g-form">
              <input
                placeholder="Full name"
                value={buyer.name}
                onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
              />
              <input
                placeholder="Email"
                type="email"
                value={buyer.email}
                onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
              />
              {por && (
                <textarea
                  rows={3}
                  placeholder="Your message (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
              <div className="g-row">
                <button className="g-btn" disabled={busy} onClick={por ? doEnquire : doBuy}>
                  {busy ? "Processing…" : por ? "Send enquiry (demo)" : "Confirm (demo)"}
                </button>
                <button className="g-btn g-btn-ghost" onClick={() => setBuying(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {msg && <p className={msg.ok ? "g-ok" : "g-err"}>{msg.text}</p>}
        </aside>
      </div>

      <Critiques artworkId={art.id} />

      {more.length > 0 && artist && (
        <section className="g-more">
          <h2 className="g-h2">More by {artist.name}</h2>
          <div className="g-grid">
            {more.map((w) => (
              <ArtCard key={w.id} art={w} artist={artist} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}