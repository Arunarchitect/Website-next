// analysis/tokens.ts — single source of truth for all design values

export const ACCENT = "#2563eb";
export const GREEN  = "#16a34a";
export const RED    = "#dc2626";
export const AMBER  = "#d97706";
export const MUTED  = "#94a3b8";
export const SURF   = "#ffffff";
export const BG     = "#f1f5f9";
export const BORDER = "#e2e8f0";
export const TEXT   = "#0f172a";
export const TEXT2  = "#64748b";
export const BARS   = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#be185d"];

export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const MONTHS_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
export const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export const PAGE_SIZE = 25;

export function pad(n: number) { return String(n).padStart(2, "0"); }

/** Simulated async fetch — replace body with real fetch() calls */
export function simulateFetch<T>(value: T, ms: number): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}
