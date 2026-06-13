// app/feecalc/feeCalcPdf.ts

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtCurrency } from "./feeCalcApi";
import {
  nv,
  r2,
  type JSPDFWithAutoTable,
  type QuoteOption,
  type QuantityResult,
  type HourlyResult,
  type DiscountBreakdownLine,
  type DiscountPackage,
  type ActiveTypes,
} from "./feeCalcTypes";

export function generateProposalPdf(params: {
  quote: QuoteOption;
  qtyResult: QuantityResult | null;
  hourlyResult: HourlyResult | undefined;
  discPct: number;
  discBreakdown: DiscountBreakdownLine[];
  effectivePkg: DiscountPackage | null;
  currency: string;
  activeTypes: ActiveTypes;
}) {
  const { quote, qtyResult, hourlyResult, discPct, discBreakdown, effectivePkg, currency, activeTypes } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as JSPDFWithAutoTable;
  const W = 210;
  const ML = 18;
  const MR = 18;
  const CW = W - ML - MR;
  let y = 0;

  const DARK    = [15,  23,  42 ] as [number,number,number];
  const MID     = [71,  85,  105] as [number,number,number];
  const LIGHT   = [148, 163, 184] as [number,number,number];
  const PALE    = [241, 245, 249] as [number,number,number];
  const WHITE   = [255, 255, 255] as [number,number,number];
  const AMBER   = [180, 83,   9 ] as [number,number,number];
  const AMBER_L = [255, 251, 235] as [number,number,number];
  const AMBER_B = [253, 230, 138] as [number,number,number];
  const TEAL    = [13,  148, 136] as [number,number,number];
  const TEAL_L  = [240, 253, 250] as [number,number,number];
  const TEAL_B  = [153, 246, 228] as [number,number,number];
  const INDIGO  = [79,  70,  229] as [number,number,number];
  const INDIGO_L= [238, 242, 255] as [number,number,number];
  const GREEN   = [21,  128, 61 ] as [number,number,number];
  const GREEN_L = [240, 253, 244] as [number,number,number];
  const GREEN_B = [134, 239, 172] as [number,number,number];

  const addPage = () => { doc.addPage(); y = 22; };
  const checkY  = (needed: number) => { if (y + needed > 272) addPage(); };

  const setFill   = (c: [number,number,number]) => doc.setFillColor(...c);
  const setStroke = (c: [number,number,number]) => doc.setDrawColor(...c);
  const setTxt    = (c: [number,number,number]) => doc.setTextColor(...c);
  const setFont   = (style: "normal"|"bold"|"italic" = "normal", size = 9) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const sectionHeader = (label: string, accent: [number,number,number], accentLight: [number,number,number]) => {
    checkY(14);
    setFill(accentLight);
    doc.setLineWidth(0);
    doc.rect(ML, y, CW, 10, "F");
    setFill(accent);
    doc.rect(ML, y, 3, 10, "F");
    setFont("bold", 9);
    setTxt(accent);
    doc.text(label.toUpperCase(), ML + 7, y + 6.5);
    y += 14;
  };

  // ── COVER HEADER ─────────────────────────────────────────────────────────
  setFill(DARK);
  doc.rect(0, 0, W, 52, "F");
  setFill(AMBER);
  doc.rect(0, 0, 4, 52, "F");

  setFont("bold", 7);
  setTxt([148, 163, 184]);
  doc.text("PROFESSIONAL FEE PROPOSAL", ML + 2, 13);

  setFont("bold", 20);
  setTxt(WHITE);
  doc.text(quote.name, ML + 2, 28);

  setFont("normal", 8);
  setTxt([148, 163, 184]);
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(`Ref: ${quote.access_code}   ·   ${today}   ·   Confidential`, ML + 2, 40);

  const billingLabels: string[] = [];
  if (activeTypes.quantity) billingLabels.push("Quantity × Rate");
  if (activeTypes.hourly)   billingLabels.push("Hourly Billing");
  if (activeTypes.lumpsum)  billingLabels.push("Lump-sum");
  let px = ML + 2;
  billingLabels.forEach((lbl) => {
    const tw = doc.getTextWidth(lbl);
    setFill([50, 60, 80] as [number,number,number]);
    setStroke([100, 116, 139] as [number,number,number]);
    doc.setLineWidth(0.25);
    doc.roundedRect(px, 44, tw + 10, 6, 3, 3, "FD");
    setFont("normal", 7);
    setTxt(WHITE);
    doc.text(lbl, px + 5, 48.2);
    px += tw + 16;
  });

  y = 62;

  // ── DISCOUNT SECTION ─────────────────────────────────────────────────────
  const meaningfulBreakdown = discBreakdown.filter((b) => b.type !== "cap");
  if (effectivePkg && meaningfulBreakdown.length > 0) {
    checkY(16);
    setFill(GREEN_L); setStroke(GREEN_B);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, 10, 2, 2, "FD");
    setFill(GREEN); doc.rect(ML, y, 3, 10, "F");
    setFont("bold", 8.5);
    setTxt(GREEN);
    doc.text(
      `Discount unlocked: ${effectivePkg.name}  —  ${discPct.toFixed(1)}% total saving`,
      ML + 7, y + 6.5,
    );
    y += 14;

    const discRows = meaningfulBreakdown.map((b) => [
      b.label,
      b.pct !== null ? `\u2212${b.pct}%` : "",
    ]);
    discRows.push(["Total discount applied", `\u2212${discPct.toFixed(1)}%`]);

    autoTable(doc, {
      startY: y,
      head: [["Discount item", "Amount"]],
      body: discRows,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [55, 65, 81] as [number,number,number] },
      headStyles: { fontStyle: "bold", textColor: GREEN, fillColor: GREEN_L },
      columnStyles: {
        0: { cellWidth: CW * 0.76 },
        1: { cellWidth: CW * 0.24, halign: "right", fontStyle: "bold", textColor: GREEN },
      },
      margin: { left: ML, right: MR },
      didParseCell: (data) => {
        if (data.row.index === discRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = GREEN_L;
        }
      },
    } as Parameters<typeof autoTable>[1]);
    y = (doc as JSPDFWithAutoTable).lastAutoTable.finalY + 10;
  }

  // ── QUANTITY RESULT ───────────────────────────────────────────────────────
  if (activeTypes.quantity && qtyResult) {
    sectionHeader("Quantity × Rate Fee", AMBER, AMBER_L);

    checkY(32);
    setFill(AMBER_L); setStroke(AMBER_B);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, 28, 4, 4, "FD");

    setFont("bold", 8);
    setTxt(AMBER);
    doc.text("TOTAL PROFESSIONAL FEE", ML + CW / 2, y + 7, { align: "center" });

    setFont("bold", 24);
    setTxt(DARK);
    doc.text(fmtCurrency(qtyResult.final_fee, currency), ML + CW / 2, y + 19, { align: "center" });

    if (nv(qtyResult.discount_pct) > 0) {
      setFont("normal", 7.5);
      setTxt(MID);
      doc.text(
        `Base: ${fmtCurrency(qtyResult.base_fee, currency)}  ·  ${nv(qtyResult.discount_pct).toFixed(1)}% discount applied`,
        ML + CW / 2, y + 25.5, { align: "center" },
      );
    }
    y += 34;

    autoTable(doc, {
      startY: y,
      head: [["Quantity", "Rate / Unit", "Base Fee", "Discount", "Final Fee"]],
      body: [[
        `${Number(qtyResult.quantity).toLocaleString("en-IN")}${qtyResult.quantity_unit ? " " + qtyResult.quantity_unit : ""}`,
        fmtCurrency(qtyResult.rate, currency),
        fmtCurrency(qtyResult.base_fee, currency),
        nv(qtyResult.discount_pct) > 0 ? `\u2212${nv(qtyResult.discount_pct).toFixed(1)}%` : "\u2014",
        fmtCurrency(qtyResult.final_fee, currency),
      ]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: DARK },
      headStyles: { fillColor: PALE, textColor: MID, fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        4: { fontStyle: "bold", textColor: AMBER },
      },
      margin: { left: ML, right: MR },
    } as Parameters<typeof autoTable>[1]);
    y = (doc as JSPDFWithAutoTable).lastAutoTable.finalY + 8;

    if (qtyResult.stages.length > 0) {
      checkY(12);
      setFont("bold", 7.5); setTxt(MID);
      doc.text("PAYMENT SCHEDULE", ML, y);
      y += 5;

      const stageBodyRows: (string | number)[][] = qtyResult.stages.map((st, idx) => {
        const amt = nv(st.instalment_amount ?? 0);
        return [
          String(idx + 1),
          st.stage_name,
          `${st.fee_percentage}%`,
          fmtCurrency(amt, currency),
          `Net ${st.payment_terms_days}d`,
        ];
      });
      stageBodyRows.push(["", "Total", "100%", fmtCurrency(qtyResult.final_fee, currency), ""]);

      const totalRowIdx = stageBodyRows.length - 1;

      autoTable(doc, {
        startY: y,
        head: [["#", "Stage", "%", "Amount", "Terms"]],
        body: stageBodyRows,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, textColor: DARK },
        headStyles: { fillColor: PALE, textColor: MID, fontStyle: "bold", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          2: { cellWidth: 16, halign: "center" },
          3: { cellWidth: 38, halign: "right", fontStyle: "bold", textColor: AMBER },
          4: { cellWidth: 24, halign: "center" },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] as [number,number,number] },
        margin: { left: ML, right: MR },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === totalRowIdx) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = AMBER_L;
            if (data.column.index === 3) data.cell.styles.textColor = AMBER;
          }
        },
      } as Parameters<typeof autoTable>[1]);
      y = (doc as JSPDFWithAutoTable).lastAutoTable.finalY + 4;

      const delivRows: string[] = [];
      qtyResult.stages.forEach((st) => {
        st.deliverables.forEach((d) => {
          if (!d.opted_out) {
            delivRows.push(`${d.is_mandatory ? "\u25CF" : "\u25CB"}  ${d.name}${d.is_mandatory ? "" : " (optional)"}`);
          }
        });
      });

      if (delivRows.length > 0) {
        checkY(10);
        setFont("bold", 7.5); setTxt(MID);
        doc.text("DELIVERABLES", ML, y); y += 5;
        setFont("normal", 8); setTxt(MID);
        delivRows.forEach((dr) => {
          checkY(5);
          doc.text(dr, ML + 3, y);
          y += 4.5;
        });
      }
      y += 6;
    }
  }

  // ── HOURLY BILLING ────────────────────────────────────────────────────────
  if (activeTypes.hourly && hourlyResult) {
    sectionHeader("Hourly Billing", TEAL, TEAL_L);

    checkY(12);
    setFill(TEAL_L); setStroke(TEAL_B);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, y, CW, 9, 2, 2, "FD");
    setFont("italic", 8);
    setTxt(TEAL);
    doc.text(hourlyResult.note, ML + 5, y + 5.8);
    y += 13;

    if (hourlyResult.consultant_rates.length > 0) {
      checkY(12);
      setFont("bold", 7.5); setTxt(MID);
      doc.text("CONSULTANT BILLING RATES", ML, y); y += 5;

      autoTable(doc, {
        startY: y,
        head: [["Role / Designation", "Rate / Hour"]],
        body: hourlyResult.consultant_rates.map((r) => {
          const role = normaliseRole(r.role);
          const baseRate = Number(r.rate_per_hour);
          const discountedRate = discPct > 0
            ? Math.round(baseRate * (1 - discPct / 100) * 100) / 100
            : baseRate;
          const rateDisplay = discPct > 0
            ? `${fmtCurrency(discountedRate, r.currency ?? currency)}/hr  (was ${fmtCurrency(baseRate, r.currency ?? currency)}/hr)`
            : `${fmtCurrency(baseRate, r.currency ?? currency)}/hr`;
          return [role || "\u2014", rateDisplay];
        }),
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: DARK },
        headStyles: { fillColor: TEAL_L, textColor: TEAL, fontStyle: "bold", fontSize: 7.5 },
        columnStyles: {
          1: { fontStyle: "bold", textColor: TEAL, halign: "right" },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] as [number,number,number] },
        margin: { left: ML, right: MR },
      } as Parameters<typeof autoTable>[1]);
      y = (doc as JSPDFWithAutoTable).lastAutoTable.finalY + 6;
    }

    if (hourlyResult.stages.length > 0) {
      checkY(12);
      setFont("bold", 7.5); setTxt(MID);
      doc.text("PROJECT STAGES", ML, y); y += 5;

      const hourlyStageRows = hourlyResult.stages.map((st, idx) => [
        String(idx + 1),
        st.stage_name,
        `${st.fee_percentage}%`,
        `Net ${st.payment_terms_days}d`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["#", "Stage", "Fee %", "Terms"]],
        body: hourlyStageRows,
        theme: "striped",
        styles: { fontSize: 8.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, textColor: DARK },
        headStyles: { fillColor: TEAL_L, textColor: TEAL, fontStyle: "bold", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 26, halign: "center" },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] as [number,number,number] },
        margin: { left: ML, right: MR },
      } as Parameters<typeof autoTable>[1]);
      y = (doc as JSPDFWithAutoTable).lastAutoTable.finalY + 8;
    }
  }

  // ── LUMP-SUM ──────────────────────────────────────────────────────────────
  if (activeTypes.lumpsum && quote.lumpsum_amount) {
    sectionHeader("Lump-sum Quote", INDIGO, INDIGO_L);

    const base    = nv(quote.lumpsum_amount);
    const discAmt = r2((base * discPct) / 100);
    const final   = r2(base - discAmt);

    checkY(26);
    setFill(INDIGO_L); setStroke([165, 180, 252] as [number,number,number]);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, 22, 4, 4, "FD");
    setFont("bold", 8); setTxt(INDIGO);
    doc.text(quote.lumpsum_label || "Fixed Professional Fee", ML + CW / 2, y + 7, { align: "center" });
    setFont("bold", 20); setTxt(DARK);
    doc.text(fmtCurrency(final, currency), ML + CW / 2, y + 17, { align: "center" });
    y += 27;

    if (discPct > 0) {
      autoTable(doc, {
        startY: y,
        body: [
          ["Base fee", fmtCurrency(base, currency)],
          [`Discount (${discPct.toFixed(1)}%)`, `\u2212${fmtCurrency(discAmt, currency)}`],
          ["Final fee", fmtCurrency(final, currency)],
        ],
        theme: "plain",
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 5, right: 5 }, textColor: DARK },
        columnStyles: {
          0: { cellWidth: CW * 0.7 },
          1: { halign: "right", fontStyle: "bold", textColor: INDIGO },
        },
        didParseCell: (data) => {
          if (data.row.index === 2) {
            data.cell.styles.fillColor = INDIGO_L;
          }
        },
        margin: { left: ML, right: MR },
      } as Parameters<typeof autoTable>[1]);
      y = (doc as JSPDFWithAutoTable).lastAutoTable.finalY + 6;
    }

    if (quote.lumpsum_note) {
      checkY(12);
      setFont("italic", 8); setTxt(MID);
      const lines = doc.splitTextToSize(`Note: ${quote.lumpsum_note}`, CW);
      lines.forEach((l: string) => { checkY(5); doc.text(l, ML, y); y += 4.5; });
      y += 4;
    }
  }

  // ── TERMS ─────────────────────────────────────────────────────────────────
  if (quote.description && quote.description.trim()) {
    sectionHeader("Terms & Conditions", [71, 85, 105] as [number,number,number], PALE);
    setFont("normal", 8.5); setTxt(MID);
    const lines = doc.splitTextToSize(quote.description.trim(), CW);
    lines.forEach((l: string) => { checkY(5); doc.text(l, ML, y); y += 4.8; });
    y += 4;
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setFill(DARK);
    doc.rect(0, 283, W, 14, "F");
    setFont("normal", 7); setTxt(LIGHT);
    doc.text("This document is confidential and prepared for the named client only.", ML, 291);
    doc.text(`Page ${i} / ${pages}`, W - MR, 291, { align: "right" });
  }

  doc.save(`Fee-Proposal-${quote.access_code}.pdf`);
}

// local copy to avoid importing React-side helper into the PDF module
function normaliseRole(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}