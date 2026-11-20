# The Online Gallery

A classic-style online art exhibition and sale, built as a self-contained module for the **Next.js App Router** with **TypeScript**. Cream paper, serif type, gilt frames. It runs entirely on in-memory demo data, so you can drop it in and see it working with no backend.

> **Demonstration only.** All artists and works are fictional, no payments are taken, and the in-memory data resets on a full page refresh.

---

## Features

- **Exhibition home** with all artworks, filterable by type (Painting, Sculpture, Installation, Drawing, Photography, Digital).
- **Artwork page** with a large framed image, description, specs, related works by the same artist, and critiques.
- **Artist page** with portrait, bio, statement and all of that artist's works.
- **Commercial mode** toggle that reveals prices, sold/reserved stamps and a demo purchase flow.
- **Multi-currency pricing** (INR, USD, EUR, GBP, AED, JPY) using live rates, with an offline fallback.
- **Metric / imperial** size display, automatically switching between cm / m and in / ft.
- **Critiques** that can be posted anonymously or verified by email (demo code flow), with a "Verified only" filter.
- **Persistent preferences**: commercial mode, unit and currency are saved in `localStorage` and shared across all pages.

---

## Folder layout

```
app/gallery/
├── types.ts                  # Shared TypeScript types
├── galleryApi.ts             # Demo data layer + currency/size helpers
├── GalleryContext.tsx        # Shared state: commercial, unit, currency, rates
├── components.tsx            # Masthead, Footer, ArtImage, ArtCard, Critiques
├── layout.tsx                # Wraps all gallery pages with provider + chrome
├── style.css                 # All styling (scoped under .g-root)
├── page.tsx                  # /gallery                → exhibition home
├── artwork/[id]/page.tsx     # /gallery/artwork/:id    → single artwork
└── artist/[id]/page.tsx      # /gallery/artist/:id     → artist page
```

## Routes

| Route                    | Description                                   |
| ------------------------ | --------------------------------------------- |
| `/gallery`               | Exhibition home (artworks only, with filters) |
| `/gallery/artwork/[id]`  | Single artwork, buy box and critiques         |
| `/gallery/artist/[id]`   | Artist biography and their works              |

On the home page, each work's image and title link to the artwork page, and the artist name links to the artist page.

---

## Getting started

Requirements: a Next.js project using the App Router (Next 13.4+; 14 or 15 recommended) with TypeScript.

1. Copy the `gallery` folder into your project's `app/` directory.
2. Run the dev server:

   ```bash
   npm run dev
   ```

3. Open <http://localhost:3000/gallery>.

No extra dependencies or `next.config` changes are needed. Images use a plain `<img>` tag, so remote image domains do not have to be whitelisted.

---

## How it works

### Shared state

`GalleryContext.tsx` provides `commercial`, `unit`, `currency`, `rates` and a `priceLabel()` helper through `<GalleryProvider>`, which is mounted in `layout.tsx`. Because the layout persists across navigation, these settings carry over between all three pages. Preferences are stored under the `gallery-prefs-v1` key in `localStorage`.

The exchange-rate request is only made once Commercial mode is switched on.

### Data layer

`galleryApi.ts` is the only file that knows where data comes from. All functions are `async` and return copies of the demo data after a short artificial delay:

| Function                                   | Purpose                                  |
| ------------------------------------------ | ---------------------------------------- |
| `getArtists()` / `getArtist(id)`           | Artist lookup                            |
| `getArtworks()` / `getArtwork(id)`         | Artwork lookup                           |
| `getArtworksByArtist(artistId)`            | Works for one artist                     |
| `buyArtwork(id, buyer)`                    | Marks a work as sold (no payment)        |
| `getCritiques(artworkId)`                  | Critiques, newest first                  |
| `addCritique(input)`                       | Post a critique (anonymous or verified)  |
| `requestEmailVerification(email)`          | Returns a demo code for the UI to show   |
| `confirmEmailVerification(email, code)`    | Checks the code                          |
| `getRates()`                               | Live rates, cached for 1 hour            |

Pure helpers: `convertPrice()`, `formatMoney()` and `formatSize()`.

### Moving to a real backend

Replace the function bodies in `galleryApi.ts` with `fetch()` calls to your API and keep the signatures unchanged. The pages and components will not need to change. For email verification, send the code by email and stop returning `demoCode` (then remove the "Demonstration: your code is …" line in `components.tsx`).

### Currency

Rates come from `https://open.er-api.com/v6/latest/USD` and are cached in memory for an hour. If the request fails, hard-coded fallback rates are used and the masthead shows "Indicative exchange rates" instead of "Live exchange rates". Prices are stored in each work's own currency and converted for display.

### Sizes

Dimensions are always stored in **centimetres**. `formatSize()` converts for display:

- Metric: cm, or metres when the largest side is 200 cm or more.
- Imperial: inches, or feet when the largest side is 48 in or more.

---

## Customising

### Images

Artwork and portrait images use seeded [picsum.photos](https://picsum.photos) URLs through the `img()` helper at the top of `galleryApi.ts`. They load reliably but are random photos, not real art. To use your own, replace each `img(...)` call with a URL or a `/public` path such as `/art/laterite-monsoon.jpg`.

### Fonts

The stylesheet uses *Cormorant Garamond* when available, then falls back to Garamond, Palatino and Georgia. To load Cormorant Garamond, use `next/font/google` in your **root** layout:

```tsx
// app/layout.tsx
import { Cormorant_Garamond } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={cormorant.className}>{children}</body>
    </html>
  );
}
```

### Colours

All colours are CSS variables defined on `.g-root` at the top of `style.css` (`--paper`, `--ink`, `--gilt`, `--red`, `--green`, and so on). All class names use the `g-` prefix, so the styles will not leak into the rest of your site.

### Adding artworks or artists

Add entries to the `artists` and `artworks` arrays in `galleryApi.ts`. Keep dimensions in cm, and set `status` to `"available"`, `"reserved"` or `"sold"`.

---

## Known limitations

- **State resets on refresh.** Sold status, new critiques and email verifications live in module-level memory. They persist during client-side navigation only.
- **No real payments or email.** `buyArtwork()` simply flips a work to sold, and verification codes are shown on screen.
- **Client-rendered pages.** All pages use `"use client"` and fetch in `useEffect`, so content is not server-rendered for SEO. When you add a real backend, consider fetching in server components.
- **Preferences load after hydration.** Saved settings are read from `localStorage` in an effect, so there may be a brief flash of the default state on first paint.
- **Metadata** is only set on the gallery layout, not per artwork or artist.

---

## Tech

Next.js (App Router) · React · TypeScript · plain CSS