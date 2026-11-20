"use client";

// app/gallery/artist/[id]/page.tsx
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArtCard, ArtImage } from "../../components";
import { getArtist, getArtworksByArtist } from "../../galleryApi";
import type { Artist, Artwork } from "../../types";

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [works, setWorks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [a, w] = await Promise.all([getArtist(id), getArtworksByArtist(id)]);
      if (!alive) return;
      setArtist(a);
      setWorks(w);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <p className="g-muted g-center">Loading…</p>;
  if (!artist)
    return (
      <div className="g-center">
        <p>This artist could not be found.</p>
        <Link href="/gallery" className="g-link">
          Return to the exhibition
        </Link>
      </div>
    );

  return (
    <>
      <p className="g-crumbs">
        <Link href="/gallery">Exhibition</Link>
        <span>›</span>
        <em>{artist.name}</em>
      </p>

      <section className="g-artist">
        <div className="g-artist-portrait">
          <div className="g-frame">
            <span className="g-mat">
              <ArtImage src={artist.portrait} alt={artist.name} />
            </span>
          </div>
        </div>
        <div className="g-artist-text">
          <h2 className="g-h1 g-left">{artist.name}</h2>
          <p className="g-label-artist">
            {artist.location} · born {artist.born}
          </p>
          <div className="g-rule g-rule-left" />
          <p>{artist.bio}</p>
          <blockquote className="g-quote">“{artist.statement}”</blockquote>
        </div>
      </section>

      <h2 className="g-h2 g-center-text">Works by {artist.name}</h2>
      <div className="g-grid">
        {works.map((w) => (
          <ArtCard key={w.id} art={w} artist={artist} />
        ))}
      </div>
    </>
  );
}