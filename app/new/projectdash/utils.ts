// utils.ts
// Formatting helpers shared across the Projects feature.
//
// NOTE: amounts are always rendered in FULL, exact form (e.g. "₹5,10,439"),
// never abbreviated ("₹5.1L"). Abbreviations look tidy but hide the real
// number, which is confusing on a page where people are reconciling fees
// and payments.

/**
 * Formats a number as an exact Indian Rupee amount with Indian digit
 * grouping, e.g. 5104390 -> "₹51,04,390". No decimals, no compacting.
 */
export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Formats an amount for an arbitrary currency code. Falls back to a plain
 * "CODE 1,23,456" format if Intl doesn't recognise the currency.
 */
export function formatMoney(n: number, currency: string): string {
  if (!currency || currency.toUpperCase() === "INR") return formatINR(n);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
}

export function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatHours(h: number): string {
  // Keep at most 2 decimal places, but drop trailing zeros (1308.4h, not 1308.40h)
  const rounded = Math.round(h * 100) / 100;
  return `${rounded}h`;
}