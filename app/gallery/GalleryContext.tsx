"use client";

// app/gallery/GalleryContext.tsx
// Shared across all gallery pages: commercial toggle, units, currency, rates, search.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { convertPrice, formatMoney, getRates } from "./galleryApi";
import type { Artwork, Currency, RatesResult, Unit } from "./types";

interface GalleryState {
  commercial: boolean;
  setCommercial: (v: boolean) => void;
  unit: Unit;
  setUnit: (u: Unit) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: RatesResult | null;
  priceLabel: (w: Artwork) => string;
  query: string;
  setQuery: (q: string) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
}

const Ctx = createContext<GalleryState | null>(null);
const KEY = "gallery-prefs-v1";

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [commercial, setCommercial] = useState(false);
  const [unit, setUnit] = useState<Unit>("metric");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [rates, setRates] = useState<RatesResult | null>(null);
  const [ready, setReady] = useState(false);

  // search state lives here so the masthead and the home page share it.
  // It is deliberately not saved: every visit starts with a clean search.
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);

  // restore prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.commercial === "boolean") setCommercial(p.commercial);
        if (p.unit === "metric" || p.unit === "imperial") setUnit(p.unit);
        if (typeof p.currency === "string") setCurrency(p.currency);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // save prefs
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ commercial, unit, currency }));
    } catch {
      /* ignore */
    }
  }, [ready, commercial, unit, currency]);

  // rates API is only hit once commercial mode is on
  useEffect(() => {
    if (commercial && !rates) getRates().then(setRates);
  }, [commercial, rates]);

  const priceLabel = (w: Artwork) =>
    w.priceOnRequest
      ? "Price on request"
      : rates
        ? formatMoney(convertPrice(w.price, currency, rates.rates), currency)
        : formatMoney(w.price.amount, w.price.currency);

  return (
    <Ctx.Provider
      value={{
        commercial,
        setCommercial,
        unit,
        setUnit,
        currency,
        setCurrency,
        rates,
        priceLabel,
        query,
        setQuery,
        advanced,
        setAdvanced,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useGallery() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGallery must be used inside <GalleryProvider>");
  return v;
}