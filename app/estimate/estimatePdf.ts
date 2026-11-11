import { EstimateItem } from "./types";

export interface EstimatePdfMeta {
  title: string;
  projectName: string;
  organisationName: string;
  status: string;
  updatedAt: string;
}

const money = (n: number | null | undefined): string =>
  n === null || n === undefined || n === 0
    ? "-"
    : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qtyFmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? "-" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

type RowMeta = { sum: boolean; level: number; footer?: boolean };

/**
 * rows = the rows currently visible in the UI (respects expanded/collapsed state).
 * Monochrome, hairline rules, A4 portrait, compact.
 */
export async function generateEstimatePdf(
  meta: EstimatePdfMeta,
  rows: EstimateItem[],
  total: number,
  detailed: boolean
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const M = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── header (first page) ────────────────────────────────────────────
  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(meta.title, M, 15, { maxWidth: pageW - M * 2 - 55 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`${meta.projectName}  |  ${meta.organisationName}`, M, 21, { maxWidth: pageW - M * 2 - 55 });

  doc.setFontSize(7.5);
  doc.text(
    `COST ESTIMATE  -  ${detailed ? "DETAILED" : "SUMMARY"}  -  ${meta.status.toUpperCase()}`,
    pageW - M,
    11,
    { align: "right" }
  );
  doc.setFontSize(8);
  doc.text(new Date(meta.updatedAt).toLocaleDateString("en-IN"), pageW - M, 15, { align: "right" });

  doc.setFontSize(7.5);
  doc.text("Total estimate", pageW - M, 20.5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(25, 25, 25);
  doc.text(`INR ${total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageW - M, 26, {
    align: "right",
  });

  doc.setDrawColor(25, 25, 25);
  doc.setLineWidth(0.4);
  doc.line(M, 29, pageW - M, 29);

  // ── table ──────────────────────────────────────────────────────────
  const rowMeta: RowMeta[] = rows.map((r) => ({ sum: r.is_sum, level: r.level }));
  const body: string[][] = rows.map((r) => [
    r.identification,
    r.name,
    r.is_sum ? "" : qtyFmt(r.quantity),
    r.is_sum ? "" : r.unit || "-",
    r.is_sum ? "" : money(r.rate),
    money(r.total),
  ]);

  body.push(["", "Grand total", "", "", "", money(total)]);
  rowMeta.push({ sum: true, level: 0, footer: true });

  autoTable(doc, {
    startY: 32,
    head: [["ID", "Description", "Qty", "Unit", "Rate (INR)", "Amount (INR)"]],
    body,
    theme: "plain",
    margin: { top: 14, left: M, right: M, bottom: 16 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: [30, 30, 30],
      cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 },
      overflow: "linebreak",
      lineWidth: 0,
    },
    headStyles: { fontStyle: "bold", fontSize: 7.5, textColor: [90, 90, 90] },
    columnStyles: {
      0: { cellWidth: 17 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 13, halign: "center" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const m = rowMeta[data.row.index];
      if (!m) return;

      if (m.sum) data.cell.styles.fontStyle = "bold";
      if (m.sum && m.level === 0 && !m.footer) data.cell.styles.fillColor = [240, 240, 240];
      if (m.footer) data.cell.styles.fontSize = 9;
      if (data.column.index === 0 && !m.footer) data.cell.styles.textColor = [120, 120, 120];
      if (data.column.index === 1) {
        data.cell.styles.cellPadding = { top: 1.4, bottom: 1.4, right: 2, left: 2 + m.level * 3.5 };
      }
    },
    didDrawCell: (data) => {
      const { x, y, width, height } = data.cell;
      if (data.section === "head") {
        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(0.25);
        doc.line(x, y + height, x + width, y + height);
      } else if (data.section === "body") {
        const m = rowMeta[data.row.index];
        if (m?.footer) {
          doc.setDrawColor(40, 40, 40);
          doc.setLineWidth(0.3);
          doc.line(x, y, x + width, y);
        } else {
          doc.setDrawColor(225, 225, 225);
          doc.setLineWidth(0.1);
          doc.line(x, y + height, x + width, y + height);
        }
      }
    },
  });

  // ── footer on every page ───────────────────────────────────────────
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

  const safe = meta.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "estimate";
  doc.save(`${safe}_estimate.pdf`);
}