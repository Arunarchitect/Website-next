// app/gallery/galleryApi.ts
// Demo data layer. Swap function bodies for real fetch() calls later.

import type {
  ArtType,
  Artist,
  Artwork,
  Critique,
  Currency,
  Dimensions,
  Money,
  RatesResult,
  Unit,
} from "./types";

export const CURRENCIES: Currency[] = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "JPY",
];
export const ART_TYPES: ArtType[] = [
  "Painting",
  "Sculpture",
  "Installation",
  "Drawing",
  "Photography",
  "Digital",
];

/* ------------------------------ demo data ------------------------------ */
// Images are real, working placeholder photos (picsum.photos, seeded so they
// never change). Replace the URLs with your own artwork images later.
const img = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const artists: Artist[] = [
  {
    id: "a1",
    name: "Meera Raveendran",
    location: "Thiruvananthapuram, Kerala",
    born: 1986,
    bio: "Meera works between the mural traditions of Kerala and contemporary abstraction. Her practice follows monsoon light, laterite walls and the colour of wet earth. She has exhibited in Kochi, Mumbai and Singapore.",
    statement:
      "I paint the hour after rain, when everything is still deciding what colour to be.",
    portrait: img("portrait-meera", 600, 760),
  },
  {
    id: "a2",
    name: "Tobias Reinhardt",
    location: "Rotterdam, Netherlands",
    born: 1979,
    bio: "Tobias is a sculptor working with salvaged steel and cast concrete. His forms study load, balance and the quiet violence of construction sites.",
    statement: "Every structure is a negotiation with gravity.",
    portrait: img("portrait-tobias", 600, 760),
  },
  {
    id: "a3",
    name: "Aiko Tanabe",
    location: "Kyoto, Japan",
    born: 1991,
    bio: "Aiko builds immersive installations from paper, thread and light. Her work asks viewers to slow down and walk through memory.",
    statement: "A room can remember who has stood in it.",
    portrait: img("portrait-aiko", 600, 760),
  },
  {
    id: "a4",
    name: "Rahul Krishnan",
    location: "Kochi, Kerala",
    born: 1994,
    bio: "Rahul is a photographer and digital artist documenting coastal Kerala: fishing harbours, shuttered cinemas and the architecture of in-between places.",
    statement: "I photograph what is about to be renovated.",
    portrait: img("portrait-rahul", 600, 760),
  },
];

const artworks: Artwork[] = [
  {
    id: "w1",
    artistId: "a1",
    title: "Laterite Monsoon",
    year: 2024,
    type: "Painting",
    medium: "Acrylic and earth pigment on canvas",
    gist: "A wall of red laterite dissolving in the first rain.",
    description:
      "Layers of earth pigment are washed and re-applied until the surface behaves like weathered stone. The vertical streaks echo rainwater tracing old masonry.",
    dims: { h: 150, w: 120 },
    price: { amount: 185000, currency: "INR" },
    status: "available",
    image: img("laterite-monsoon", 800, 1000),
  },
  {
    id: "w2",
    artistId: "a1",
    title: "Courtyard, 5 PM",
    year: 2023,
    type: "Painting",
    medium: "Oil on linen",
    gist: "Late sun across a nalukettu courtyard.",
    description: `
The study begins at first light, when the sun is still low and its rays must travel a long, deliberate path to reach the house, entering as a thin, golden blade that cuts across the open centre of the courtyard. This central void—the aangan—is the heart of the home, a roofless room open to the sky, and it is here that the entire drama of light and shadow is staged.

As the morning advances, the beam of light widens and sweeps across the stone floor, climbing the walls with a slow, tactile insistence, and in its wake, it leaves not emptiness but a palpable presence. The shadow is not a void where light has failed to reach; it is a substance in its own right, a deep, cool pool of indigo and slate that pools in the corners and under the eaves, a colour as deliberate as the ochre and terracotta of the sunlit surfaces.

The architecture is designed to choreograph this dance: the overhanging chhajja, the carved jaali screens, and the deep verandahs do not merely block the sun but filter and sculpt it, fragmenting it into intricate patterns that fall like lace upon the floor, and for every shard of light, there is a corresponding, equally considered pool of shade.

The shadow is treated as a colour because it has its own hue, its own temperature, and its own emotional weight; it is the cool blue that balances the hot orange of noon, the deep umber that gives form and depth to the pale lime-washed walls, the soft grey that softens the hard edges of the world. To sit in the courtyard is to be immersed in this chromatic interplay, to feel the warmth of the sun on one's back and the cool breath of the shade on one's face at the same time, and to understand that the house is not merely a shelter from the elements but an instrument for experiencing them.

The open centre is the aperture through which the sky is framed, and as the day turns, the light crosses it like the hand of a sundial, marking the hours not with numbers but with shifting geometries of brightness and dark. At dusk, the process reverses, and the courtyard fills with a soft, ambient glow that seems to emanate from the walls themselves, while the shadows deepen into a rich, velvety black that is not an absence of light but a concentration of it, a final, saturated note in the day's long composition.

To study such a house is to learn that shadow is not the enemy of light but its necessary partner, the silence that gives the music its shape, the dark ground against which the figure of the sun is drawn, and in this understanding, the courtyard becomes a living painting, a canvas of stone and air on which the sun and the sky collaborate to paint a masterpiece that is never twice the same.
  `.trim(),
    dims: { h: 90, w: 90 },
    price: { amount: 120000, currency: "INR" },
    status: "sold",
    image: img("courtyard-5pm", 900, 900),
  },
  {
    id: "w3",
    artistId: "a1",
    title: "Study for Wet Ground",
    year: 2025,
    type: "Drawing",
    medium: "Charcoal and gouache on paper",
    gist: "Quick sketch that became the Laterite series.",
    description:
      "A working drawing made on site after a downpour. Loose, fast and left deliberately unfinished.",
    dims: { h: 42, w: 30 },
    price: { amount: 28000, currency: "INR" },
    status: "reserved",
    image: img("wet-ground", 700, 980),
  },
  {
    id: "w4",
    artistId: "a2",
    title: "Counterweight No. 3",
    year: 2022,
    type: "Sculpture",
    medium: "Salvaged steel, cast concrete",
    gist: "A steel arm held in place by a block of concrete.",
    description:
      "Part of the Counterweight series. A rusted crane arm pivots on a concrete plinth, almost balanced, never quite still.",
    dims: { h: 210, w: 140, d: 90 },
    price: { amount: 9800, currency: "EUR" },
    status: "available",
    image: img("counterweight-3", 900, 1100),
  },
  {
    id: "w5",
    artistId: "a2",
    title: "Rebar Garden",
    year: 2024,
    type: "Sculpture",
    medium: "Welded rebar, patina",
    gist: "Reinforcement bars grown into something botanical.",
    description:
      "Offcuts from demolition sites are welded into tall, branching forms. The orange patina is left to develop naturally.",
    dims: { h: 180, w: 60, d: 60 },
    price: { amount: 6400, currency: "EUR" },
    status: "available",
    image: img("rebar-garden", 800, 1000),
  },
  {
    id: "w6",
    artistId: "a3",
    title: "Threshold of Paper",
    year: 2025,
    type: "Installation",
    medium: "Washi paper, cotton thread, LED light",
    gist: "A walk-through corridor of hanging paper panels.",
    description:
      "Two hundred paper panels hang at different depths, lit from within. Visitors move through slowly, and their shadows become part of the piece.",
    dims: { h: 300, w: 600, d: 400 },
    price: { amount: 42000, currency: "USD" },
    status: "available",
    image: img("threshold-paper", 1200, 800),
  },
  {
    id: "w7",
    artistId: "a3",
    title: "Memory Loom",
    year: 2023,
    type: "Installation",
    medium: "Silk thread, wood frame",
    gist: "Thousands of threads stretched into a quiet room.",
    description:
      "A wooden frame holds threads in gradual colour shifts. Meant to be seen from several angles as the visible pattern changes.",
    dims: { h: 250, w: 350, d: 120 },
    price: { amount: 27500, currency: "USD" },
    status: "sold",
    image: img("memory-loom", 1200, 800),
  },
  {
    id: "w8",
    artistId: "a4",
    title: "Harbour, Closed",
    year: 2025,
    type: "Photography",
    medium: "Archival pigment print, edition of 10",
    gist: "Fishing boats at rest during the trawling ban.",
    description:
      "Made during the monsoon trawling ban at Fort Kochi. The empty harbour holds more activity than it seems at first glance.",
    dims: { h: 60, w: 90 },
    price: { amount: 450, currency: "USD" },
    status: "available",
    image: img("harbour-closed", 1200, 800),
  },
  {
    id: "w9",
    artistId: "a4",
    title: "Last Show (Triptych)",
    year: 2024,
    type: "Digital",
    medium: "Digital collage, giclée print",
    gist: "Shuttered cinema posters layered into one image.",
    description:
      "Scans of peeling posters from three closed single-screen theatres merged into a single layered composition.",
    dims: { h: 80, w: 180 },
    price: { amount: 780, currency: "USD" },
    status: "available",
    image: img("last-show", 1400, 700),
  },
];

const critiques: Critique[] = [
  {
    id: "c1",
    artworkId: "w1",
    author: "Anjali S.",
    text: "The surface is remarkable. You can almost smell the rain. The lower third feels slightly heavy to me though.",
    rating: 4,
    verified: true,
    emailMasked: "a*****@gmail.com",
    createdAt: "2026-10-02T10:20:00Z",
  },
  {
    id: "c2",
    artworkId: "w1",
    author: "Guest",
    text: "Nice colours.",
    rating: 3,
    verified: false,
    createdAt: "2026-10-05T14:05:00Z",
  },
  {
    id: "c3",
    artworkId: "w4",
    author: "Dr. Kavya Raghavan",
    text: "Tension between the steel and concrete reads very well. Would love to see it outdoors.",
    rating: 5,
    verified: true,
    emailMasked: "k****@iitm.ac.in",
    createdAt: "2026-10-11T09:00:00Z",
  },
  {
    id: "c4",
    artworkId: "w2",
    author: "Sneha R.",
    text: "I stood in front of this for twenty minutes. The dusk passage is the whole painting — the wall glow is painted, not suggested, and you feel the temperature drop as you look at it.",
    rating: 5,
    verified: true,
    emailMasked: "s*******@outlook.com",
    createdAt: "2026-09-18T17:40:00Z",
  },
  {
    id: "c5",
    artworkId: "w2",
    author: "Guest",
    text: "Beautiful light but I wish the description were shorter. The painting does not need that much explaining.",
    rating: 4,
    verified: false,
    createdAt: "2026-09-27T11:12:00Z",
  },
  {
    id: "c6",
    artworkId: "w1",
    author: "Vikram T.",
    text: "Two stars is harsh, but the pigment feels muddy in the middle register where the washes overlap. The top edge is superb. Uneven work from an artist I usually admire.",
    rating: 2,
    verified: true,
    emailMasked: "v****@yahoo.in",
    createdAt: "2026-10-19T08:55:00Z",
  },
  {
    id: "c7",
    artworkId: "w3",
    author: "Guest",
    text: "The unfinished left side is the best part. Do not touch it.",
    rating: 4,
    verified: false,
    createdAt: "2026-10-22T16:30:00Z",
  },
  {
    id: "c8",
    artworkId: "w5",
    author: "Farhan A.",
    text: "Saw this in the Rotterdam studio. In person the patina is much deeper and redder than the photograph shows. The welds are left visible on purpose and it works.",
    rating: 4,
    verified: true,
    emailMasked: "f*****@protonmail.com",
    createdAt: "2026-09-05T13:25:00Z",
  },
  {
    id: "c9",
    artworkId: "w6",
    author: "Lena Fischer",
    text: "Walked through this twice at a fair in Basel. The second time I noticed the shadows of other visitors moving on the panels before I saw the visitors themselves. Genuinely disorienting in the best way.",
    rating: 5,
    verified: true,
    emailMasked: "l***@gmx.de",
    createdAt: "2026-10-14T18:05:00Z",
  },
  {
    id: "c10",
    artworkId: "w6",
    author: "Guest",
    text: "Spectacular in a gallery, impossible in a flat. Would love a smaller edition.",
    rating: 3,
    verified: false,
    createdAt: "2026-10-30T09:47:00Z",
  },
  {
    id: "c11",
    artworkId: "w7",
    author: "Priya M.",
    text: "The colour shift is so gradual that from one end the piece looks grey and from the other it looks gold. Same object, two different rooms. I have not stopped thinking about it.",
    rating: 5,
    verified: true,
    emailMasked: "p****@gmail.com",
    createdAt: "2026-08-29T15:10:00Z",
  },
  {
    id: "c12",
    artworkId: "w8",
    author: "Arjun N.",
    text: "I know this harbour. The print catches something the place itself does not — the silence of the ban, the boats waiting. Slightly overpriced for an edition of ten, in my view.",
    rating: 4,
    verified: true,
    emailMasked: "a*****@rediffmail.com",
    createdAt: "2026-11-02T07:20:00Z",
  },
  {
    id: "c13",
    artworkId: "w9",
    author: "Meghna D.",
    text: "The layering is clever but it flattens at thumbnail size, which matters for a digital work sold online. Ask for the full-resolution file before buying.",
    rating: 3,
    verified: true,
    emailMasked: "m****@icloud.com",
    createdAt: "2026-11-08T12:00:00Z",
  },
  {
    id: "c14",
    artworkId: "w4",
    author: "Guest",
    text: "Would be perfect in a courtyard, which is funny given the other work in this gallery.",
    rating: 5,
    verified: false,
    createdAt: "2026-11-12T19:33:00Z",
  },
];

/* ------------------------------- helpers ------------------------------- */

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------ data access ---------------------------- */

export async function getArtists(): Promise<Artist[]> {
  await delay();
  return artists.map((a) => ({ ...a }));
}

export async function getArtist(id: string): Promise<Artist | null> {
  await delay();
  const a = artists.find((x) => x.id === id);
  return a ? { ...a } : null;
}

export async function getArtworks(): Promise<Artwork[]> {
  await delay();
  return artworks.map((a) => ({ ...a }));
}

export async function getArtwork(id: string): Promise<Artwork | null> {
  await delay();
  const a = artworks.find((x) => x.id === id);
  return a ? { ...a } : null;
}

export async function getArtworksByArtist(
  artistId: string,
): Promise<Artwork[]> {
  await delay();
  return artworks.filter((a) => a.artistId === artistId).map((a) => ({ ...a }));
}

/* ------------------------------ currency ------------------------------- */

// Fallback rates, 1 USD = x
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  JPY: 150,
};

let ratesCache: { at: number; data: RatesResult } | null = null;

export async function getRates(): Promise<RatesResult> {
  if (ratesCache && Date.now() - ratesCache.at < 60 * 60 * 1000) {
    return ratesCache.data;
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const json = await res.json();
    if (json?.result === "success" && json.rates) {
      const rates = {} as Record<Currency, number>;
      for (const c of CURRENCIES) rates[c] = json.rates[c] ?? FALLBACK_RATES[c];
      const data: RatesResult = {
        rates,
        live: true,
        updated: json.time_last_update_utc ?? new Date().toISOString(),
      };
      ratesCache = { at: Date.now(), data };
      return data;
    }
  } catch {
    /* fall through to fallback */
  }
  return {
    rates: FALLBACK_RATES,
    live: false,
    updated: "offline fallback rates",
  };
}

export function convertPrice(
  price: Money,
  to: Currency,
  rates: Record<Currency, number>,
): number {
  if (price.currency === to) return price.amount;
  return (price.amount / rates[price.currency]) * rates[to];
}

export function formatMoney(amount: number, currency: Currency): string {
  const big = amount >= 1000;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: big || currency === "JPY" ? 0 : 2,
  }).format(amount);
}

/* ------------------------------- sizes --------------------------------- */

const trim = (n: number, dp: number) => parseFloat(n.toFixed(dp)).toString();

export function formatSize(d: Dimensions, unit: Unit): string {
  const vals = [d.h, d.w, ...(d.d != null ? [d.d] : [])];
  const labels = d.d != null ? "H × W × D" : "H × W";
  const max = Math.max(...vals);

  if (unit === "metric") {
    if (max >= 200) {
      return `${vals.map((v) => trim(v / 100, 2)).join(" × ")} m (${labels})`;
    }
    return `${vals.map((v) => trim(v, 1)).join(" × ")} cm (${labels})`;
  }
  const inches = vals.map((v) => v / 2.54);
  if (Math.max(...inches) >= 48) {
    return `${inches.map((v) => trim(v / 12, 1)).join(" × ")} ft (${labels})`;
  }
  return `${inches.map((v) => trim(v, 1)).join(" × ")} in (${labels})`;
}

/* ------------------------------- selling ------------------------------- */

export async function buyArtwork(
  id: string,
  buyer: { name: string; email: string },
): Promise<Artwork> {
  await delay(500);
  const a = artworks.find((x) => x.id === id);
  if (!a) throw new Error("Artwork not found");
  if (a.status !== "available")
    throw new Error("This work is no longer available");
  if (!buyer.name.trim() || !buyer.email.includes("@"))
    throw new Error("Enter a valid name and email");
  a.status = "sold"; // demo only: no payment taken
  return { ...a };
}

/* ------------------------------ critiques ------------------------------ */

const pendingCodes = new Map<string, string>();
const verifiedEmails = new Set<string>();

const maskEmail = (email: string) => {
  const [u, d] = email.split("@");
  return `${u[0]}${"*".repeat(Math.max(u.length - 1, 3))}@${d}`;
};

/** Demo: returns the code so the UI can show it. In prod, email it and return nothing. */
export async function requestEmailVerification(
  email: string,
): Promise<{ demoCode: string }> {
  await delay(400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  pendingCodes.set(email.toLowerCase(), code);
  return { demoCode: code };
}

export async function confirmEmailVerification(
  email: string,
  code: string,
): Promise<boolean> {
  await delay(300);
  const key = email.toLowerCase();
  if (pendingCodes.get(key) === code.trim()) {
    pendingCodes.delete(key);
    verifiedEmails.add(key);
    return true;
  }
  return false;
}

export async function getCritiques(artworkId: string): Promise<Critique[]> {
  await delay(150);
  return critiques
    .filter((c) => c.artworkId === artworkId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => ({ ...c }));
}

export async function addCritique(input: {
  artworkId: string;
  author: string;
  text: string;
  rating: number;
  email?: string; // present => verified path
}): Promise<Critique> {
  await delay(300);
  const author = input.author.trim() || "Guest";
  const text = input.text.trim();
  if (text.length < 3) throw new Error("Write a bit more");

  let verified = false;
  let emailMasked: string | undefined;
  if (input.email) {
    if (!verifiedEmails.has(input.email.toLowerCase()))
      throw new Error("Email not verified");
    verified = true;
    emailMasked = maskEmail(input.email);
  }

  const c: Critique = {
    id: uid(),
    artworkId: input.artworkId,
    author,
    text,
    rating: Math.min(5, Math.max(1, input.rating)),
    verified,
    emailMasked,
    createdAt: new Date().toISOString(),
  };
  critiques.push(c);
  return { ...c };
}

/** All critiques, used by the exhibition page for advanced search and rating sort. */
export async function getAllCritiques(): Promise<Critique[]> {
  await delay(150);
  return critiques.map((c) => ({ ...c }));
}

/** Demo: records nothing. In production, email the gallery or store the enquiry. */
export async function sendEnquiry(
  artworkId: string,
  from: { name: string; email: string; note?: string },
): Promise<void> {
  await delay(400);
  if (!artworks.some((x) => x.id === artworkId))
    throw new Error("Artwork not found");
  if (!from.name.trim() || !/^\S+@\S+\.\S+$/.test(from.email))
    throw new Error("Enter a valid name and email");
}