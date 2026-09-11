// app/projectfee/billPdf.tsx
//
// Generates a downloadable "bill" PDF for a single fee instalment (stage).
// Client-side only (jsPDF) — no server round-trip. Requires `jspdf`:
//   npm install jspdf
//
// jsPDF's built-in fonts don't render the ₹ glyph reliably, so amounts here
// use "Rs." instead of "₹" — this file only affects the generated PDF, not
// the on-screen page (which keeps using ₹ via fmtCurrency as before).

import type { FeeInstalment } from "./projectfeeApi";

export interface BillPdfProject {
  name: string;
  client_name: string;
  location?: string | null;
}

export interface BillPdfCalc {
  currency: string;
  final_fee: string | number;
  billing_type_display?: string;
}

export interface GenerateBillPdfParams {
  organisationName?: string;
  project: BillPdfProject;
  calc: BillPdfCalc;
  instalment: FeeInstalment;
}

// ─── Formatting helpers (PDF-safe — no ₹ glyph) ────────────────────────────

function pdfAmount(value: string | number | null | undefined, currency: string): string {
  const n = Number(value ?? 0);
  if (isNaN(n)) return "-";
  const formatted = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const sign = n < 0 ? "-" : "";
  if (currency === "INR") return `${sign}Rs. ${formatted}`;
  return `${sign}${currency} ${formatted}`;
}

function statusLabel(status: FeeInstalment["status"]): string {
  const map: Record<FeeInstalment["status"], string> = {
    pending: "Not Yet Invoiced",
    partially_invoiced: "Partially Invoiced",
    invoiced: "Invoiced - Awaiting Payment",
    partially_paid: "Partially Paid",
    paid: "Paid in Full",
    overdue: "Overdue",
    waived: "Waived",
  };
  return map[status] ?? status;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function generateBillPdf({
  organisationName,
  project,
  calc,
  instalment,
}: GenerateBillPdfParams): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  const INK = "#1a1a1a";
  const MUTED = "#6b6b6b";
  const AMBER = "#c9791a";
  const LINE = "#dddddd";

  const rightAlignAt = pageWidth - marginX;

  // ── Header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK);
  doc.text(organisationName || "Fee Bill", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text("BILL / PAYMENT REQUEST", rightAlignAt, y - 4, { align: "right" });
  doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, rightAlignAt, y + 10, { align: "right" });

  y += 24;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, rightAlignAt, y);
  y += 26;

  // ── Bill To / Project block ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  doc.text("BILLED TO", marginX, y);
  doc.text("PROJECT", pageWidth / 2 + 10, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text(project.client_name || "-", marginX, y);
  doc.text(project.name || "-", pageWidth / 2 + 10, y);
  y += 16;

  if (project.location) {
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(project.location, pageWidth / 2 + 10, y);
    y += 14;
  }

  y += 20;
  doc.setDrawColor(LINE);
  doc.line(marginX, y, rightAlignAt, y);
  y += 30;

  // ── Stage title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(INK);
  doc.text(`Stage ${instalment.stage_order_snapshot}: ${instalment.stage_name_snapshot}`, marginX, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(AMBER);
  doc.text(statusLabel(instalment.status), rightAlignAt, y, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  const subLine = [
    `${instalment.fee_percentage}% of total project fee`,
    calc.billing_type_display ? `${calc.billing_type_display} billing` : null,
    instalment.due_date ? `Due ${fmtDate(instalment.due_date)}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(subLine, marginX, y);
  y += 30;

  // ── Amount table ──
  const rows: [string, string][] = [
    ["Stage Amount", pdfAmount(instalment.amount, calc.currency)],
    ["Invoiced to Date", pdfAmount(instalment.invoiced_amount, calc.currency)],
    ["Paid to Date", pdfAmount(instalment.paid_amount, calc.currency)],
    ["Outstanding", pdfAmount(instalment.outstanding_amount, calc.currency)],
  ];

  doc.setDrawColor(LINE);
  doc.setFillColor(247, 247, 247);
  doc.rect(marginX, y, rightAlignAt - marginX, rows.length * 26 + 14, "F");
  y += 20;

  rows.forEach(([label, value], i) => {
    const isOutstanding = label === "Outstanding";
    doc.setFont("helvetica", isOutstanding ? "bold" : "normal");
    doc.setFontSize(isOutstanding ? 12 : 11);
    doc.setTextColor(isOutstanding ? AMBER : INK);
    doc.text(label, marginX + 16, y);
    doc.text(value, rightAlignAt - 16, y, { align: "right" });
    if (i < rows.length - 1) {
      y += 26;
    }
  });
  y += 34;

  // ── Invoice reference (if invoiced) ──
  if (instalment.invoice_number || instalment.invoice_date) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text("INVOICE REFERENCE", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(
      `${instalment.invoice_number ? `No. ${instalment.invoice_number}` : "No number on file"}` +
        (instalment.invoice_date ? `   ·   Dated ${fmtDate(instalment.invoice_date)}` : ""),
      marginX,
      y,
    );
    y += 24;
  }

  // ── Payment history ──
  if (instalment.payments.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text("PAYMENT HISTORY", marginX, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    instalment.payments.forEach((p) => {
      doc.setTextColor(INK);
      doc.text(fmtDate(p.paid_at), marginX, y);
      doc.text(pdfAmount(p.amount, calc.currency), pageWidth / 2, y);
      if (p.remarks) {
        doc.setTextColor(MUTED);
        doc.text(p.remarks, pageWidth / 2 + 90, y);
      }
      y += 16;
    });
    y += 14;
  }

  // ── Remarks ──
  if (instalment.remarks) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text("REMARKS", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    const wrapped = doc.splitTextToSize(instalment.remarks, rightAlignAt - marginX);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 13 + 10;
  }

  // ── Footer ──
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(LINE);
  doc.line(marginX, pageHeight - 60, rightAlignAt, pageHeight - 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(
    `This is a system-generated bill for one stage of the total project fee (${pdfAmount(calc.final_fee, calc.currency)}).`,
    marginX,
    pageHeight - 42,
  );

  // ── Save ──
  const filename = `Bill_${sanitizeFilename(project.name)}_Stage${instalment.stage_order_snapshot}_${sanitizeFilename(
    instalment.stage_name_snapshot,
  )}.pdf`;
  doc.save(filename);
}