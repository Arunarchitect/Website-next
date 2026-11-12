import type { RowInput } from "jspdf-autotable";
import { QuantityAdjust, QuantityCell, QuantityData } from "./types";
import { adjustHeaders, compute, num, sortData } from "./quantityAdjust";

export interface QuantityPdfMeta {
  title: string;
  projectName: string;
  organisationName: string;
  status: string;
  updatedAt: string;
}

/** Ids for the extra columns. Normal columns use their own key. */
export const COL_WASTE = "__waste";
export const COL_COUNT = "__count";
export const COL_COMBINED = "__combined";
export const COL_COMBINED_WASTE = "__combined_waste";

const NUMERIC = ["sum", "avg", "min", "max"];

const BRAND_NAME = "ModelFlick";
const BRAND_TEXT = "modelflick.com";
const BRAND_URL = "https://modelflick.com";

type RGB = [number, number, number];
// Text and hairlines only: no filled areas, so the page prints with very little ink.
const INK: RGB = [28, 28, 28];
const MUTED: RGB = [105, 105, 105];
const FAINT: RGB = [150, 150, 150];
const RULE: RGB = [222, 222, 222];
const ACCENT: RGB = [16, 120, 90];

const fmt = (v: QuantityCell | undefined, d: number): string => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
};

type RowKind = "group" | "detail" | "footer";

interface PdfCol {
  id: string;
  head: string;
  right: boolean;
  data?: QuantityData["columns"][number];
}

export async function generateQuantityPdf(
  meta: QuantityPdfMeta,
  rawData: QuantityData,
  open: Set<number>,
  adjust?: QuantityAdjust | null,
  hidden?: Set<string>
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const data = sortData(rawData, adjust); // `open` indexes refer to this order
  const showTotal = adjust?.show_total !== false;
  const { columns, rows, totals, final, decimals, show_count, grouped } = data;
  const calc = compute(data, adjust);
  const withCount = show_count && grouped;
  const withWaste = calc.wasteOn;
  const hasMerge = calc.blocks.length > 0;
  const hd = adjustHeaders(data, adjust, calc.percent);
  const label = (c: (typeof columns)[number]) => (c.unit ? `${c.label} (${c.unit})` : c.label);
  const isNum = (role: string) => NUMERIC.includes(role);

  const finalCol = final ? columns.find((c) => c.key === final) : undefined;
  const unit = finalCol?.unit ? ` ${finalCol.unit}` : "";

  // ── which columns go into the PDF ────────────────────────────────
  const all: PdfCol[] = [
    ...columns.map((c) => ({ id: c.key, head: label(c), right: isNum(c.role), data: c })),
    ...(withWaste ? [{ id: COL_WASTE, head: hd.waste, right: true }] : []),
    ...(withCount ? [{ id: COL_COUNT, head: "Rows", right: true }] : []),
    ...(hasMerge ? [{ id: COL_COMBINED, head: hd.combined, right: true }] : []),
    ...(hasMerge && withWaste ? [{ id: COL_COMBINED_WASTE, head: hd.combinedWaste, right: true }] : []),
  ];
  const skip = hidden ?? new Set<string>();
  let vis = all.filter((c) => !skip.has(c.id));
  if (vis.length === 0) vis = all; // never print an empty table

  const isMergeCol = (c: PdfCol) => c.id === COL_COMBINED || c.id === COL_COMBINED_WASTE;
  const wasteIdx = vis.findIndex((c) => c.id === COL_WASTE);
  const mergeIdx = vis.findIndex(isMergeCol);
  const finalIdx = finalCol ? vis.findIndex((c) => c.data?.key === finalCol.key) : -1;
  const firstMergeVisible = vis.find(isMergeCol)?.id;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: vis.length > 6 ? "landscape" : "portrait" });
  const M = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const finalTotal = finalCol ? (withWaste ? calc.effTotal : totals[finalCol.key]) : null;
  const anyOpen = rows.some((r, i) => open.has(i) && r.details && r.details.length > 0);
  const hasTotalBox = showTotal && !!finalCol && finalTotal !== null && finalTotal !== undefined;

  // ── header ────────────────────────────────────────────────────────
  const maxW = pageW - M * 2 - 58;
  const titleLines = (doc.splitTextToSize(meta.title, maxW) as string[]).slice(0, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  titleLines.forEach((ln, k) => doc.text(ln, M, 13 + k * 5.4));

  const subY = 13 + (titleLines.length - 1) * 5.4 + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const sub = (doc.splitTextToSize(`${meta.projectName}  ·  ${meta.organisationName}`, maxW) as string[])[0];
  doc.text(sub, M, subY);

  // right block: kind / date, then the total
  doc.setFontSize(6.5);
  doc.setTextColor(...FAINT);
  doc.text(`QUANTITIES  ·  ${anyOpen ? "DETAILED" : "SUMMARY"}`, pageW - M, 10, { align: "right" });
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${new Date(meta.updatedAt).toLocaleDateString("en-IN")}  ·  ${meta.status.toUpperCase()}`,
    pageW - M,
    14,
    { align: "right" }
  );

  if (hasTotalBox) {
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Total ${finalCol!.label}${withWaste ? ` (incl. ${calc.percent}% wastage)` : ""}`, pageW - M, 19.5, {
      align: "right",
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.text(`${fmt(finalTotal, decimals)}${unit}`, pageW - M, 25.5, { align: "right" });
  }

  const ruleY = Math.max(subY + 3.5, hasTotalBox ? 28 : 18);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.15);
  doc.line(M, ruleY, pageW - M, ruleY);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.7);
  doc.line(M, ruleY, M + 14, ruleY);

  // ── table ─────────────────────────────────────────────────────────
  const kinds: RowKind[] = [];
  const body: RowInput[] = [];

  rows.forEach((r, i) => {
    const b = calc.blockAt[i];
    const line: RowInput = [];
    vis.forEach((col) => {
      if (col.data) {
        line.push(isNum(col.data.role) ? fmt(r.cells[col.data.key], decimals) : String(r.cells[col.data.key] ?? ""));
      } else if (col.id === COL_WASTE) {
        line.push(fmt(calc.eff[i], decimals));
      } else if (col.id === COL_COUNT) {
        line.push(String(r.count));
      } else if (!b) {
        // unmerged row: show its own value in the combined columns
        const v = col.id === COL_COMBINED ? calc.base[i] : calc.eff[i];
        line.push({ content: `${fmt(v, decimals)}${unit}`, styles: { halign: "right" } });
      } else if (b.start === i) {
        let span = 0;
        for (let j = b.start; j <= b.end; j++) span += 1 + (open.has(j) ? rows[j].details?.length ?? 0 : 0);
        const showLabel = col.id === firstMergeVisible && !!b.label;
        const value = col.id === COL_COMBINED ? b.raw : b.value;
        line.push({
          content: `${showLabel ? b.label + "\n" : ""}${fmt(value, decimals)}${unit}`,
          rowSpan: span,
          styles: { halign: "right", valign: "middle", fontStyle: "bold" },
        });
      }
      // other rows of a merged block: the row-spanning cell already covers them
    });
    body.push(line);
    kinds.push("group");

    if (open.has(i) && r.details) {
      r.details.forEach((d) => {
        const dl: RowInput = [];
        vis.forEach((col) => {
          if (col.data) {
            dl.push(isNum(col.data.role) ? fmt(d[col.data.key], decimals) : String(d[col.data.key] ?? ""));
          } else if (col.id === COL_WASTE) {
            dl.push(fmt(num(final ? d[final] : null) * calc.factor[i], decimals));
          } else if (col.id === COL_COUNT) {
            dl.push("");
          } else if (!b) {
            dl.push("");
          }
        });
        body.push(dl);
        kinds.push("detail");
      });
    }
  });

  if (showTotal) {
    const foot: RowInput = vis.map((col, i) => {
      if (col.data) {
        if (i === 0 && !isNum(col.data.role)) return "Total";
        return isNum(col.data.role) ? fmt(totals[col.data.key], decimals) : "";
      }
      if (col.id === COL_WASTE) return fmt(calc.effTotal, decimals);
      if (col.id === COL_COUNT) return String(rows.reduce((s, r) => s + r.count, 0));
      return "";
    });
    body.push(foot);
    kinds.push("footer");
  }

  const head = [vis.map((c) => c.head)];

  const rightCols = new Set<number>();
  vis.forEach((c, i) => c.right && rightCols.add(i));
  const columnStyles: Record<number, { halign: "right" }> = {};
  rightCols.forEach((i) => (columnStyles[i] = { halign: "right" }));

  autoTable(doc, {
    startY: ruleY + 3,
    head,
    body,
    theme: "plain",
    margin: { top: 14, left: M, right: M, bottom: 15 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: INK,
      cellPadding: { top: 1.1, bottom: 1.1, left: 1.8, right: 1.8 },
      overflow: "linebreak",
      lineWidth: 0,
    },
    headStyles: { fontStyle: "bold", fontSize: 7, textColor: MUTED, cellPadding: { top: 1.2, bottom: 1.6, left: 1.8, right: 1.8 } },
    columnStyles,
    didParseCell: (d) => {
      if (d.section === "head") {
        if (rightCols.has(d.column.index)) d.cell.styles.halign = "right";
        return;
      }
      if (d.section !== "body") return;
      const kind = kinds[d.row.index];
      if (kind === "footer") {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fontSize = 8.5;
        d.cell.styles.cellPadding = { top: 1.8, bottom: 1.4, left: 1.8, right: 1.8 };
      } else if (kind === "detail") {
        d.cell.styles.fontSize = 7;
        d.cell.styles.textColor = MUTED;
        d.cell.styles.cellPadding = { top: 0.8, bottom: 0.8, left: d.column.index === 0 ? 5.5 : 1.8, right: 1.8 };
      }
      if ((d.column.index === finalIdx || d.column.index === wasteIdx) && kind !== "detail") {
        d.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: (d) => {
      const { x, y, width, height } = d.cell;
      if (d.section === "head") {
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.25);
        doc.line(x, y + height, x + width, y + height);
      } else if (d.section === "body") {
        if (kinds[d.row.index] === "footer") {
          doc.setDrawColor(...INK);
          doc.setLineWidth(0.3);
          doc.line(x, y, x + width, y);
        } else {
          doc.setDrawColor(...RULE);
          doc.setLineWidth(0.1);
          doc.line(x, y + height, x + width, y + height);
        }
        if (mergeIdx >= 0 && d.column.index === mergeIdx && kinds[d.row.index] !== "footer") {
          const next = vis[d.column.index];
          if (next) {
            doc.setDrawColor(...FAINT);
            doc.setLineWidth(0.15);
            doc.line(x, y, x, y + height);
          }
        }
      }
    },
  });

  // ── footer on every page ──────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  const fy = pageH - 6.5;
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.line(M, pageH - 10, pageW - M, pageH - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    // left: document
    doc.setTextColor(...FAINT);
    const left = (doc.splitTextToSize(`${meta.title}  ·  ${meta.projectName}`, (pageW - M * 2) / 3) as string[])[0];
    doc.text(left, M, fy);

    // centre: brand link
    const pre = "Prepared with ";
    const wPre = doc.getTextWidth(pre);
    doc.setFont("helvetica", "bold");
    const wBrand = doc.getTextWidth(`${BRAND_NAME}  ·  ${BRAND_TEXT}`);
    const startX = (pageW - (wPre + wBrand)) / 2;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...FAINT);
    doc.text(pre, startX, fy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ACCENT);
    doc.text(`${BRAND_NAME}  ·  `, startX + wPre, fy);
    const wName = doc.getTextWidth(`${BRAND_NAME}  ·  `);
    doc.textWithLink(BRAND_TEXT, startX + wPre + wName, fy, { url: BRAND_URL });

    // right: page number
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...FAINT);
    doc.text(`Page ${i} of ${pages}`, pageW - M, fy, { align: "right" });
  }

  const safe = meta.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "quantities";
  doc.save(`${safe}_quantities.pdf`);
}