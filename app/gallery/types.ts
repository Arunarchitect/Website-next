// app/gallery/types.ts

export type ArtType =
  | "Painting"
  | "Sculpture"
  | "Installation"
  | "Drawing"
  | "Photography"
  | "Digital";

export type ArtStatus = "available" | "reserved" | "sold";
export type Currency = "INR" | "USD" | "EUR" | "GBP" | "AED" | "JPY";
export type Unit = "metric" | "imperial";

/** "default" = random order on every page load */
export type SortOption =
  | "default"
  | "price-asc"
  | "price-desc"
  | "rating-desc"
  | "rating-asc";

export interface Artist {
  id: string;
  name: string;
  location: string;
  born: number;
  bio: string;
  statement: string;
  portrait: string; // image URL
}

export interface Dimensions {
  h: number; // cm
  w: number; // cm
  d?: number; // cm (sculpture / installation)
}

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Artwork {
  id: string;
  artistId: string;
  title: string;
  year: number;
  type: ArtType;
  medium: string;
  gist: string;
  description: string;
  dims: Dimensions; // always stored in cm
  price: Money; // still required internally, even when undisclosed
  priceOnRequest?: boolean; // true => price is never shown or searchable
  status: ArtStatus;
  image: string; // image URL
}

export interface Critique {
  id: string;
  artworkId: string;
  author: string;
  text: string;
  rating: number; // 1-5
  verified: boolean;
  emailMasked?: string;
  createdAt: string; // ISO
}

export interface RatesResult {
  rates: Record<Currency, number>;
  live: boolean;
  updated: string;
}