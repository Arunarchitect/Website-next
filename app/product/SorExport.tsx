"use client";

import { useState } from "react";
import { Assignment, ProductItem } from "./productApi";

interface SorExportProps {
  orgName: string;
  projectName: string;
  projectId: number | null;
  assignments: Assignment[];
  resolveProduct: (item: ProductItem) => ProductItem;
  className?: string;
  label?: string;
}

interface SorRow {
  id: string;
  description: string;
  name: string;
  unit: string;
  value: string;
}

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function cleanSuffix(label: string): string {
  return label.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export function buildSorRows(
  assignments: Assignment[],
  projectId: number | null,
  resolveProduct: (item: ProductItem) => ProductItem
): SorRow[] {
  const map = new Map<string, SorRow>();

  for (const a of assignments) {
    if (a.project !== projectId || a.declined) continue;

    const product = resolveProduct(a.product_detail);
    const variant = a.variant_detail ?? null;
    const key = `${product.id}:${variant?.id ?? 0}`;
    if (map.has(key)) continue;

    const baseId = product.rate_id || `UNID-${String(product.id).slice(0, 6).toUpperCase()}`;
    const suffix = variant?.label ? cleanSuffix(variant.label) : "";
    const id = suffix ? `${baseId}-${suffix}` : baseId;

    const priceSource = variant ?? product;
    const rawValue = priceSource.effective_price ?? priceSource.base_price;
    const num = rawValue === null || rawValue === undefined || rawValue === "" ? NaN : Number(rawValue);

    map.set(key, {
      id,
      description: `${product.item} - ${product.manufacturer} ${product.model_label}`.trim(),
      name: variant?.label ? `${product.item} (${variant.label})` : product.item,
      unit: product.unit || "count",
      value: Number.isNaN(num) ? "" : String(num),
    });
  }

  return Array.from(map.values()).sort((x, y) => x.id.localeCompare(y.id, undefined, { numeric: true }));
}

export function generateSorCsv(rows: SorRow[]): string {
  const header = ["Index", "Identification", "Description", "Name", "Quantity", "Unit", "Value"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [1, r.id, r.description, r.name, 1, r.unit, r.value].map(csvCell).join(",")
    );
  }
  return lines.join("\r\n");
}

export default function SorExportButton({
  projectName,
  projectId,
  assignments,
  resolveProduct,
  className,
  label,
}: SorExportProps) {
  const [busy, setBusy] = useState(false);
  const rows = buildSorRows(assignments, projectId, resolveProduct);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || rows.length === 0) return;
    setBusy(true);
    try {
      // BOM so Excel opens UTF-8 correctly
      const blob = new Blob(["\uFEFF" + generateSorCsv(rows)], { type: "text/csv;charset=utf-8;" });
      const safe = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-of-rates-${safe || "project"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || rows.length === 0}
      className={className}
      title={rows.length === 0 ? "No assigned products to export" : undefined}
    >
      {label ?? "Schedule of rates (CSV)"}
    </button>
  );
}