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

  const data = sortData(rawData, adjust?.sort, adjust?.merges); // `open` indexes refer to this sorted order
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
  const M = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const finalTotal = finalCol ? (withWaste ? calc.effTotal : totals[finalCol.key]) : null;
  const anyOpen = rows.some((r, i) => open.has(i) && r.details && r.details.length > 0);

  // ── header ────────────────────────────────────────────────────────
  const maxW = pageW - M * 2 - 60;
  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(meta.title, M, 15, { maxWidth: maxW });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`${meta.projectName}  |  ${meta.organisationName}`, M, 21, { maxWidth: maxW });

  doc.setFontSize(7.5);
  doc.text(
    `QUANTITIES  -  ${anyOpen ? "DETAILED" : "SUMMARY"}  -  ${meta.status.toUpperCase()}`,
    pageW - M,
    11,
    { align: "right" }
  );
  doc.setFontSize(8);
  doc.text(new Date(meta.updatedAt).toLocaleDateString("en-IN"), pageW - M, 15, { align: "right" });

  if (showTotal && finalCol && finalTotal !== null && finalTotal !== undefined) {
    doc.setFontSize(7.5);
    doc.text(`Total ${finalCol.label}${withWaste ? ` (incl. ${calc.percent}% wastage)` : ""}`, pageW - M, 20.5, {
      align: "right",
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(`${fmt(finalTotal, decimals)}${unit}`, pageW - M, 26, { align: "right" });
  }

  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.4);
  doc.line(M, 29, pageW - M, 29);

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
        line.push("");
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
    startY: 32,
    head,
    body,
    theme: "plain",
    margin: { top: 14, left: M, right: M, bottom: 16 },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: [30, 30, 30],
      cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
      overflow: "linebreak",
      lineWidth: 0,
    },
    headStyles: { fontStyle: "bold", fontSize: 7.5, textColor: [90, 90, 90] },
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
        d.cell.styles.fontSize = 9;
      } else if (kind === "detail") {
        d.cell.styles.fontSize = 7.5;
        d.cell.styles.textColor = [110, 110, 110];
        if (d.column.index === 0) {
          d.cell.styles.cellPadding = { top: 1.2, bottom: 1.2, right: 2, left: 6 };
        }
      }
      if ((d.column.index === finalIdx || d.column.index === wasteIdx) && kind !== "detail") {
        d.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: (d) => {
      const { x, y, width, height } = d.cell;
      if (d.section === "head") {
        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(0.25);
        doc.line(x, y + height, x + width, y + height);
      } else if (d.section === "body") {
        if (kinds[d.row.index] === "footer") {
          doc.setDrawColor(40, 40, 40);
          doc.setLineWidth(0.3);
          doc.line(x, y, x + width, y);
        } else {
          doc.setDrawColor(225, 225, 225);
          doc.setLineWidth(0.1);
          doc.line(x, y + height, x + width, y + height);
        }
        if (mergeIdx >= 0 && d.column.index === mergeIdx && kinds[d.row.index] !== "footer") {
          doc.setDrawColor(150, 150, 150);
          doc.setLineWidth(0.2);
          doc.line(x, y, x, y + height);
        }
      }
    },
  });

  // ── footer on every page ──────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.1);
    doc.line(M, pageH - 11, pageW - M, pageH - 11);
    doc.text(`${meta.title}  |  ${meta.projectName}`, M, pageH - 7);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 7, { align: "right" });
  }

  const safe = meta.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "quantities";
  doc.save(`${safe}_quantities.pdf`);
}