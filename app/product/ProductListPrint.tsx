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
  imageSrc?: string | null;
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

async function preloadImages(rows: PrintableRow[]): Promise<Map<string, string>> {
  const imageCache = new Map<string, string>();
  
  await Promise.all(
    rows.map(async (row) => {
      if (!row.imageSrc) return;
      
      try {
        // Fetch the image as a blob to avoid CORS/auth issues
        const response = await fetch(row.imageSrc);
        if (response.ok) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          imageCache.set(row.imageSrc, objectUrl);
        }
      } catch (err) {
        // Silently fail - image just won't show in print
        console.warn(`Failed to preload image: ${row.imageSrc}`, err);
      }
    })
  );
  
  return imageCache;
}

function buildPrintHtml(props: ProductListPrintProps, imageCache: Map<string, string>): string {
  const { orgName, projectName, scopeLabel, rows, totals } = props;
  const generatedAt = new Date().toLocaleString("en-IN");
  const showSpaceColumn = rows.some((r) => r.space);

  const rowsHtml = rows
    .map((r) => {
      const imageUrl = r.imageSrc ? imageCache.get(r.imageSrc) || r.imageSrc : null;
      const imageHtml = imageUrl
        ? `<td class="thumb"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(r.item)}" /></td>`
        : `<td class="thumb"><div class="thumb-placeholder">—</div></td>`;
      
      return `
        <tr>
          ${imageHtml}
          ${showSpaceColumn ? `<td>${escapeHtml(r.space ?? "")}</td>` : ""}
          <td>${escapeHtml(r.item)}</td>
          <td>${escapeHtml(r.manufacturer)} — ${escapeHtml(r.model_label)}</td>
          <td class="price">${r.priceLabel ? escapeHtml(r.priceLabel) : "—"}</td>
          <td>${escapeHtml(r.status)}</td>
          <td class="capitalize">${escapeHtml(r.proposed_by)}</td>
        </tr>`;
    })
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
  th, td { text-align: left; padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #DCE0D8; vertical-align: middle; }
  th { background: #EDEFEA; font-weight: 600; }
  td.price { font-weight: 600; white-space: nowrap; }
  .capitalize { text-transform: capitalize; }
  .thumb { width: 60px; text-align: center; }
  .thumb img {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
    margin: 0 auto;
  }
  .thumb-placeholder {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #EDEFEA;
    border-radius: 6px;
    color: #8A938E;
    font-size: 16px;
    margin: 0 auto;
  }
  .totals { margin-top: 20px; text-align: right; }
  .total-line { font-size: 14px; margin-top: 4px; }
  footer { margin-top: 32px; font-size: 10px; color: #8A938E; }
  @media print {
    body { padding: 12mm; }
    header { break-inside: avoid; }
    .thumb img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
              <th class="thumb">Image</th>
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

export async function printProductList(props: ProductListPrintProps) {
  // Preload all images first to avoid CORS/auth issues
  const imageCache = await preloadImages(props.rows);
  const html = buildPrintHtml(props, imageCache);
  
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    // Clean up object URLs if popup blocked
    imageCache.forEach((url) => URL.revokeObjectURL(url));
    return;
  }
  
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    
    // Clean up object URLs after print dialog closes
    setTimeout(() => {
      imageCache.forEach((url) => URL.revokeObjectURL(url));
    }, 1000);
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