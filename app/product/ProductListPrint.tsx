"use client";

// Standalone print trigger for a product list. Works for a single space
// (no `space` on each row) or a combined multi-space report (each row
// carries its space name, and the table gains a Space column). Opens a
// separate window with its own minimal stylesheet, writes a simple table +
// totals, then calls window.print() — "Save as PDF" is a print destination
// in every modern browser, so no PDF library is needed.

export interface PrintableRow {
  space?: string;
  item: string;
  manufacturer: string;
  model_label: string;
  priceLabel: string | null;
  status: string;
  proposed_by: string;
}

export interface PrintableTotal {
  currency: string;
  total: number;
}

interface ProductListPrintProps {
  orgName: string;
  projectName: string;
  scopeLabel: string; // e.g. a space name, or "All spaces (3 selected)"
  rows: PrintableRow[];
  totals: PrintableTotal[];
  className?: string;
  label?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTotalLine(t: PrintableTotal): string {
  return `${t.currency} ${t.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function buildPrintHtml(props: ProductListPrintProps): string {
  const { orgName, projectName, scopeLabel, rows, totals } = props;
  const generatedAt = new Date().toLocaleString("en-IN");
  const showSpaceColumn = rows.some((r) => r.space);

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          ${showSpaceColumn ? `<td>${escapeHtml(r.space ?? "")}</td>` : ""}
          <td>${escapeHtml(r.item)}</td>
          <td>${escapeHtml(r.manufacturer)} — ${escapeHtml(r.model_label)}</td>
          <td class="price">${r.priceLabel ? escapeHtml(r.priceLabel) : "—"}</td>
          <td>${escapeHtml(r.status)}</td>
          <td class="capitalize">${escapeHtml(r.proposed_by)}</td>
        </tr>`
    )
    .join("");

  const totalsHtml = totals.length
    ? totals.map((t) => `<div class="total-line">Total (${escapeHtml(t.currency)}): <strong>${formatTotalLine(t)}</strong></div>`).join("")
    : `<div class="total-line">No priced items yet.</div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(scopeLabel)} — Product list</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif;
    color: #1C2521;
    padding: 32px;
    margin: 0;
  }
  header { margin-bottom: 24px; border-bottom: 2px solid #1C2521; padding-bottom: 16px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #6B7570; margin: 0 0 4px 0; }
  h1 { font-size: 20px; margin: 0 0 4px 0; }
  .meta { font-size: 12px; color: #6B7570; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #DCE0D8; }
  th { background: #EDEFEA; font-weight: 600; }
  td.price { font-weight: 600; white-space: nowrap; }
  .capitalize { text-transform: capitalize; }
  .totals { margin-top: 20px; text-align: right; }
  .total-line { font-size: 14px; margin-top: 4px; }
  footer { margin-top: 32px; font-size: 10px; color: #8A938E; }
  @media print {
    body { padding: 12mm; }
    header { break-inside: avoid; }
  }
</style>
</head>
<body>
  <header>
    <p class="eyebrow">${escapeHtml(orgName)} · ${escapeHtml(projectName)}</p>
    <h1>Product list — ${escapeHtml(scopeLabel)}</h1>
    <p class="meta">Generated ${escapeHtml(generatedAt)}</p>
  </header>

  ${
    rows.length
      ? `<table>
          <thead>
            <tr>
              ${showSpaceColumn ? "<th>Space</th>" : ""}
              <th>Item</th><th>Manufacturer / Model</th><th>Price</th><th>Status</th><th>Proposed by</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="totals">${totalsHtml}</div>`
      : `<p>No products in this selection.</p>`
  }

  <footer>Modelflick — fixture &amp; product assignment</footer>
</body>
</html>`;
}

export function printProductList(props: ProductListPrintProps) {
  const html = buildPrintHtml(props);
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) return; // popup blocked — caller can surface a message if desired
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

export default function ProductListPrintButton(props: ProductListPrintProps) {
  const { className, label } = props;
  return (
    <button onClick={() => printProductList(props)} className={className}>
      {label ?? "Print / Save as PDF"}
    </button>
  );
}