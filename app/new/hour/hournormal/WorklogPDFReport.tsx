/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * WorklogPDFReport.tsx
 * ─────────────────────────────────────────────────────────────
 * Professional, printer-friendly PDF report with:
 *  - Light gray headers (no dark backgrounds - saves ink)
 *  - Compact summary cards
 *  - Daily Breakdown with color-coded hours
 *  - Project Summary
 *  - Expense Summary (NEW) — pulls from the same period, pending
 *    (unreimbursed) expenses are added to the payable total
 *  - Signature box
 *  - Toggle for excluding percentage-fee projects
 *  - Toggle for including expenses
 *  - Optimized spacing for ink/paper savings
 * ─────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  fetchMyExpenses,
  type MyExpenseRow,
} from "@/app/new/myExpenseApi";

// ── Types ─────────────────────────────────────────────────────
export interface WorkLogEntry {
  id: number;
  organisation_name: string;
  project_name: string;
  project_id: number;
  deliverable_name: string;
  employee_name: string;
  start_time: string;
  end_time: string | null;
  start_date_fmt: string;
  start_time_fmt: string;
  end_date_fmt: string | null;
  end_time_fmt: string | null;
  remarks: string | null;
  finalised?: boolean;
}

interface DaySummary {
  date: string;
  totalMinutes: number;
  projects: string[];
}

interface ProjectSummary {
  project: string;
  totalMinutes: number;
}

// ── Pure helpers ─────────────────────────────────────────────
function minutesBetween(start: string, end: string | null): number {
  if (!end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff > 0 ? Math.round(diff / 60000) : 0;
}

function fmtDuration(minutes: number): string {
  if (minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function fmtDurationShort(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtINR(n: number): string {
  if (n <= 0) return "Rs.0";
  return "Rs." + Math.round(n).toLocaleString("en-IN");
}

function fmtRate(n: number): string {
  if (n <= 0) return "Rs.0/hr";
  return "Rs." + Math.round(n).toLocaleString("en-IN") + "/hr";
}

function groupByDay(logs: WorkLogEntry[]): DaySummary[] {
  const map = new Map<string, DaySummary>();
  for (const log of logs) {
    const date = log.start_date_fmt;
    if (!date) continue;
    const mins = minutesBetween(log.start_time, log.end_time);
    if (!map.has(date)) {
      map.set(date, { date, totalMinutes: 0, projects: [] });
    }
    const day = map.get(date)!;
    day.totalMinutes += mins;
    if (!day.projects.includes(log.project_name)) {
      day.projects.push(log.project_name);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function groupByProject(logs: WorkLogEntry[]): ProjectSummary[] {
  const map = new Map<string, number>();
  for (const log of logs) {
    const mins = minutesBetween(log.start_time, log.end_time);
    map.set(log.project_name, (map.get(log.project_name) ?? 0) + mins);
  }
  return Array.from(map.entries())
    .map(([project, totalMinutes]) => ({ project, totalMinutes }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

function getHourColor(hours: number): [number, number, number] {
  if (hours > 8) return [30, 100, 200];
  if (hours >= 7.5) return [34, 150, 80];
  return [200, 40, 40];
}

// ── Colour palette ────────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  headerBg: [245, 245, 248] as RGB,
  border: [200, 200, 210] as RGB,
  textDark: [40, 40, 50] as RGB,
  textGray: [100, 100, 110] as RGB,
  white: [255, 255, 255] as RGB,
  cardBg: [250, 250, 252] as RGB,
  accentLight: [240, 240, 248] as RGB,
  payableBg: [232, 245, 238] as RGB,
  payableBorder: [150, 200, 170] as RGB,
};

// ── Core PDF generation ───────────────────────────────────────
async function generateWorklogPDF(opts: {
  logs: WorkLogEntry[];
  expenses: MyExpenseRow[];
  includeExpenses: boolean;
  dateFrom?: string;
  dateTo?: string;
  hourlyRate: number;
  employeeName: string;
  excludePercentageProjects?: boolean;
  projectBillingMap?: Map<number, string>;
}) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod as any).default ?? autoTableMod;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 12;
  const MR = 12;

  // ── Filter logs ──────────────────────────────────────────────
  let filteredLogs = opts.logs;
  if (opts.excludePercentageProjects && opts.projectBillingMap) {
    filteredLogs = opts.logs.filter((log) => {
      const billingType = opts.projectBillingMap!.get(log.project_id);
      return billingType !== "percentage_share" && billingType !== "fixed";
    });
  }

  // ── Compute work-hour totals ───────────────────────────────
  const totalMinutes = filteredLogs.reduce(
    (s, r) => s + minutesBetween(r.start_time, r.end_time),
    0
  );
  const totalHours = totalMinutes / 60;
  const totalSalary = totalHours * opts.hourlyRate;
  const days = groupByDay(filteredLogs);
  const activeDays = days.length;
  const avgMins = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
  const projects = groupByProject(filteredLogs);

  // ── Compute expense totals ──────────────────────────────────
  const expenses = opts.includeExpenses ? opts.expenses : [];
  const expensesSorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const pendingExpenses = expenses
    .filter((e) => !e.reimbursed)
    .reduce((s, e) => s + e.amount, 0);
  const reimbursedExpenses = totalExpenses - pendingExpenses;

  // Amount actually owed to the employee for this report:
  // salary earned + expenses they paid out-of-pocket that haven't been
  // reimbursed yet. Already-reimbursed expenses are excluded since
  // they've already been settled.
  const totalPayable = totalSalary + pendingExpenses;

  // ── Helpers ──────────────────────────────────────────────────
  const setFill = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
  const setText = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const setDraw = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);

  let Y = 10;

  // ── HEADER ──────────────────────────────────────────────────
  setFill(C.headerBg[0], C.headerBg[1], C.headerBg[2]);
  doc.roundedRect(ML, Y, PW - ML - MR, 28, 2, 2, "F");
  setDraw(C.border[0], C.border[1], C.border[2]);
  doc.roundedRect(ML, Y, PW - ML - MR, 28, 2, 2, "S");

  setText(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("WORK LOG & EXPENSE SALARY REPORT", ML + 6, Y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(C.textGray[0], C.textGray[1], C.textGray[2]);
  const periodTxt =
    opts.dateFrom && opts.dateTo
      ? `${opts.dateFrom} - ${opts.dateTo}`
      : opts.dateFrom
      ? `From: ${opts.dateFrom}`
      : opts.dateTo
      ? `Until: ${opts.dateTo}`
      : "All time";
  doc.text(`Employee: ${opts.employeeName}  |  ${periodTxt}`, ML + 6, Y + 16);

  const genDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.setFontSize(6.5);
  doc.text(`Generated: ${genDate}`, PW - MR - 2, Y + 16, { align: "right" });

  Y += 32;

  // ── SUMMARY CARDS ────────────────────────────────────────────
  const stats = [
    { label: "Hours", value: fmtDuration(totalMinutes) },
    { label: "Rate", value: fmtRate(opts.hourlyRate) },
    { label: "Salary", value: fmtINR(totalSalary) },
    { label: "Days", value: String(activeDays) },
    { label: "Avg/Day", value: fmtDuration(avgMins) },
    { label: "Entries", value: String(filteredLogs.length) },
    ...(opts.includeExpenses
      ? [
          { label: "Expenses (Total)", value: fmtINR(totalExpenses) },
          { label: "Expenses (Pending)", value: fmtINR(pendingExpenses) },
          { label: "Expenses (Paid)", value: fmtINR(reimbursedExpenses) },
        ]
      : []),
  ];

  const colW = (PW - ML - MR - 6) / 3;
  const cardH = 14;
  stats.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = ML + col * (colW + 3);
    const by = Y + row * (cardH + 2);

    setFill(C.white[0], C.white[1], C.white[2]);
    doc.roundedRect(bx, by, colW, cardH, 1.5, 1.5, "F");
    setDraw(C.border[0], C.border[1], C.border[2]);
    doc.roundedRect(bx, by, colW, cardH, 1.5, 1.5, "S");

    setText(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(s.value, bx + colW / 2, by + 5, { align: "center" });

    setText(C.textGray[0], C.textGray[1], C.textGray[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(s.label, bx + colW / 2, by + 11, { align: "center" });
  });

  Y += Math.ceil(stats.length / 3) * (cardH + 2) + 4;

  // ── FILTER NOTE ─────────────────────────────────────────────
  if (opts.excludePercentageProjects) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    setText(C.textGray[0], C.textGray[1], C.textGray[2]);
    doc.text("* Percentage-share projects excluded", ML, Y);
    Y += 5;
  }

  // ── TOTAL PAYABLE BANNER ────────────────────────────────────
  if (Y > PH - 60) {
    doc.addPage();
    Y = 12;
  }

  setFill(C.payableBg[0], C.payableBg[1], C.payableBg[2]);
  doc.roundedRect(ML, Y, PW - ML - MR, 16, 2, 2, "F");
  setDraw(C.payableBorder[0], C.payableBorder[1], C.payableBorder[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, Y, PW - ML - MR, 16, 2, 2, "S");

  setText(20, 90, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total Payable: ${fmtINR(totalPayable)}`, ML + 6, Y + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(C.textGray[0], C.textGray[1], C.textGray[2]);
  const breakdownTxt = opts.includeExpenses
    ? `Salary ${fmtINR(totalSalary)} + Pending Expenses ${fmtINR(pendingExpenses)}`
    : `Salary only (expenses not included in this report)`;
  doc.text(breakdownTxt, PW - MR - 4, Y + 10, { align: "right" });

  Y += 21;

  // ── SIGNATURE BOX ──────────────────────────────────────────
  if (Y > PH - 50) {
    doc.addPage();
    Y = 12;
  }

  const sigY = Y;
  setDraw(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.2);

  const sigWidth = PW - ML - MR;
  doc.rect(ML, sigY, sigWidth, 14, "S");

  setText(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Approved By:", ML + 4, sigY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(C.textGray[0], C.textGray[1], C.textGray[2]);
  doc.text("______________________________", ML + 40, sigY + 5);
  doc.text("______________________________", ML + 40, sigY + 11);

  Y += 18;

  // ── DAILY SUMMARY TABLE ────────────────────────────────────
  if (Y > PH - 45) {
    doc.addPage();
    Y = 12;
  }

  setText(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Daily Summary", ML, Y);
  Y += 3;

  const dayRows = days.map((d) => {
    const hours = d.totalMinutes / 60;
    const color = getHourColor(hours);
    return [
      d.date,
      { content: fmtDurationShort(d.totalMinutes), styles: { textColor: color, fontStyle: "bold" } },
      d.projects.join(", "),
    ];
  });

  autoTable(doc, {
    startY: Y,
    head: [["Date", "Hrs", "Projects"]],
    body: dayRows,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: C.border,
      lineWidth: 0.15,
      textColor: C.textDark,
    },
    headStyles: {
      fillColor: C.headerBg,
      textColor: C.textDark,
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    alternateRowStyles: { fillColor: C.cardBg },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 22, halign: "right" },
      2: { cellWidth: "auto" },
    },
    margin: { left: ML, right: MR },
    didDrawPage: (data: any) => {
      const n = (doc as any).internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      setText(C.textGray[0], C.textGray[1], C.textGray[2]);
      doc.text(`Page ${data.pageNumber}/${n}`, PW / 2, PH - 5, {
        align: "center",
      });
    },
  });

  Y = (doc as any).lastAutoTable.finalY + 6;

  // ── PROJECT SUMMARY TABLE ─────────────────────────────────
  if (Y > PH - 45) {
    doc.addPage();
    Y = 12;
  }

  setText(C.textDark[0], C.textDark[1], C.textDark[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Project Summary", ML, Y);
  Y += 3;

  const projectRows = projects.map((p) => [
    p.project,
    fmtDuration(p.totalMinutes),
  ]);

  projectRows.push(["TOTAL", fmtDuration(totalMinutes)]);

  autoTable(doc, {
    startY: Y,
    head: [["Project", "Hours"]],
    body: projectRows,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: C.border,
      lineWidth: 0.15,
      textColor: C.textDark,
    },
    headStyles: {
      fillColor: C.headerBg,
      textColor: C.textDark,
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    alternateRowStyles: { fillColor: C.cardBg },
    didParseCell: (data: any) => {
      if (data.row.index === projectRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = C.accentLight;
      }
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 30, halign: "right" },
    },
    margin: { left: ML, right: MR },
  });

  Y = (doc as any).lastAutoTable.finalY + 6;

  // ── EXPENSE SUMMARY TABLE (NEW) ─────────────────────────────
  if (opts.includeExpenses && expensesSorted.length > 0) {
    if (Y > PH - 45) {
      doc.addPage();
      Y = 12;
    }

    setText(C.textDark[0], C.textDark[1], C.textDark[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Expense Summary", ML, Y);
    Y += 3;

    const expenseRows = expensesSorted.map((e) => [
      e.date,
      e.category_label,
      e.project_name,
      e.remarks || "-",
      {
        content: e.reimbursed ? "Paid" : "Pending",
        styles: {
          textColor: e.reimbursed ? ([34, 150, 80] as RGB) : ([200, 40, 40] as RGB),
          fontStyle: "bold",
        },
      },
      fmtINR(e.amount),
    ]);

    expenseRows.push([
      "",
      "",
      "",
      "",
      { content: "TOTAL", styles: { fontStyle: "bold" } },
      { content: fmtINR(totalExpenses), styles: { fontStyle: "bold" } },
    ] as any);

    autoTable(doc, {
      startY: Y,
      head: [["Date", "Category", "Project", "Remarks", "Status", "Amount"]],
      body: expenseRows,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        lineColor: C.border,
        lineWidth: 0.15,
        textColor: C.textDark,
      },
      headStyles: {
        fillColor: C.headerBg,
        textColor: C.textDark,
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      },
      alternateRowStyles: { fillColor: C.cardBg },
      didParseCell: (data: any) => {
        if (data.row.index === expenseRows.length - 1) {
          data.cell.styles.fillColor = C.accentLight;
        }
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 24 },
        2: { cellWidth: 28 },
        3: { cellWidth: "auto" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 24, halign: "right" },
      },
      margin: { left: ML, right: MR },
    });

    Y = (doc as any).lastAutoTable.finalY + 5;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    setText(C.textGray[0], C.textGray[1], C.textGray[2]);
    doc.text(
      "* Only pending (unreimbursed) expenses are added to the Total Payable above.",
      ML,
      Y
    );
    Y += 6;
  } else if (opts.includeExpenses) {
    if (Y > PH - 20) {
      doc.addPage();
      Y = 12;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(C.textGray[0], C.textGray[1], C.textGray[2]);
    doc.text("No expenses recorded for this period.", ML, Y);
    Y += 8;
  }

  // ── COLOR LEGEND ────────────────────────────────────────────
  if (Y > PH - 25) {
    doc.addPage();
    Y = 12;
  }

  const legendY = Y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setText(C.textGray[0], C.textGray[1], C.textGray[2]);

  setDraw(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.15);
  doc.rect(ML, legendY - 2, 85, 8, "S");
  setFill(C.cardBg[0], C.cardBg[1], C.cardBg[2]);
  doc.rect(ML, legendY - 2, 85, 8, "F");

  const legendItems = [
    { color: [30, 100, 200], label: ">8hrs" },
    { color: [34, 150, 80], label: "7.5-8hrs" },
    { color: [200, 40, 40], label: "<7.5hrs" },
  ];

  let lx = ML + 6;
  legendItems.forEach((item, i) => {
    if (i > 0) lx += 2;
    setFill(item.color[0], item.color[1], item.color[2]);
    doc.rect(lx, legendY - 1, 4, 4, "F");
    setText(item.color[0], item.color[1], item.color[2]);
    doc.text(item.label, lx + 6, legendY + 3.5);
    lx += 22;
  });

  setText(C.textGray[0], C.textGray[1], C.textGray[2]);
  doc.text("— Daily hours color-coded", lx + 2, legendY + 3.5);

  Y += 10;

  // ── FOOTER ──────────────────────────────────────────────────
  const lastPage = (doc as any).internal.getNumberOfPages();
  doc.setPage(lastPage);

  const fY = PH - 11;
  setFill(C.payableBg[0], C.payableBg[1], C.payableBg[2]);
  doc.rect(ML, fY, PW - ML - MR, 8, "F");
  setDraw(C.payableBorder[0], C.payableBorder[1], C.payableBorder[2]);
  doc.rect(ML, fY, PW - ML - MR, 8, "S");

  setText(20, 90, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`Total Payable: ${fmtINR(totalPayable)}`, ML + 3, fY + 3.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setText(C.textGray[0], C.textGray[1], C.textGray[2]);
  doc.text(
    opts.includeExpenses
      ? `${fmtDuration(totalMinutes)} @ ${fmtRate(opts.hourlyRate)} + ${fmtINR(pendingExpenses)} pending expenses`
      : `${fmtDuration(totalMinutes)} @ ${fmtRate(opts.hourlyRate)}`,
    ML + 3,
    fY + 7
  );
  doc.text(
    "Generated from work logs & expenses",
    PW - MR - 3,
    fY + 6,
    { align: "right" }
  );

  // ── SAVE ──────────────────────────────────────────────────
  const safe = (opts.employeeName || "worklog").replace(/\s+/g, "_");
  const from = (opts.dateFrom ?? "").replace(/-/g, "");
  const to = (opts.dateTo ?? "").replace(/-/g, "");
  doc.save(`worklog_${safe}_${from}${to ? "_" + to : ""}.pdf`);
}

// ── API helpers ───────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_HOST ?? "";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function mapLog(w: any): WorkLogEntry {
  const st = w.start_time ? new Date(w.start_time) : null;
  const et = w.end_time ? new Date(w.end_time) : null;
  return {
    ...w,
    project_id: w.project_id || w.project?.id || 0,
    start_time_fmt: st
      ? `${pad2(st.getHours())}:${pad2(st.getMinutes())}`
      : "",
    start_date_fmt: st
      ? `${st.getFullYear()}-${pad2(st.getMonth() + 1)}-${pad2(st.getDate())}`
      : "",
    end_time_fmt: et
      ? `${pad2(et.getHours())}:${pad2(et.getMinutes())}`
      : null,
    end_date_fmt: et
      ? `${et.getFullYear()}-${pad2(et.getMonth() + 1)}-${pad2(et.getDate())}`
      : null,
  };
}

async function fetchAllLogs(
  dateFrom?: string,
  dateTo?: string
): Promise<WorkLogEntry[]> {
  const all: WorkLogEntry[] = [];
  let page = 1;
  while (true) {
    const url = new URL(`${BASE}/api/v2/hour/worklogs/`);
    if (dateFrom) url.searchParams.set("from", dateFrom);
    if (dateTo) url.searchParams.set("to", dateTo);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", "200");
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error(`Fetch worklogs failed: ${res.status}`);
    const data = await res.json();
    const results: WorkLogEntry[] = (data.results ?? []).map(mapLog);
    all.push(...results);
    if (page >= (data.pages ?? 1)) break;
    page++;
  }
  return all;
}

/**
 * Fetches ALL of the current user's expenses within a date range
 * (paginating through fetchMyExpenses, which the My Expenses page also
 * uses), so the PDF report reflects the same data the user sees there.
 */
async function fetchAllExpensesForPeriod(
  dateFrom?: string,
  dateTo?: string
): Promise<MyExpenseRow[]> {
  const all: MyExpenseRow[] = [];
  let page = 1;
  while (true) {
    const data = await fetchMyExpenses({
      from: dateFrom,
      to: dateTo,
      reimbursed: "all",
      page,
    });
    all.push(...data.results);
    if (page >= (data.pages ?? 1)) break;
    page++;
  }
  return all;
}

async function fetchProjectBillingTypes(projectIds: number[]): Promise<Map<number, string>> {
  const billingMap = new Map<number, string>();
  const uniqueIds = [...new Set(projectIds)];
  
  for (const id of uniqueIds) {
    try {
      const res = await fetch(`${BASE}/api/v2/projects/${id}/`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        billingMap.set(id, data.billing_type || "hourly");
      }
    } catch {
      billingMap.set(id, "hourly");
    }
  }
  
  return billingMap;
}

async function fetchMyHourlyRate(
  dateFrom?: string,
  dateTo?: string
): Promise<{ rate: number; name: string }> {
  const qs = new URLSearchParams({ view_all: "false" });
  if (dateFrom) qs.set("from", dateFrom);
  if (dateTo) qs.set("to", dateTo);
  if (!dateFrom && !dateTo) {
    const now = new Date();
    qs.set("year", String(now.getFullYear()));
    qs.set("month", String(now.getMonth() + 1));
  }

  const res = await fetch(`${BASE}/api/v2/salary-report/?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Salary fetch failed");
  const data = await res.json();
  const emps = data.employees ?? [];
  if (emps.length === 0) return { rate: 0, name: "Employee" };

  const emp = emps[0];
  const totalHours = emp.total_hours ?? 0;
  const hourlyAmt = emp.hourly_amount ?? 0;
  const rate = totalHours > 0 ? hourlyAmt / totalHours : 0;
  return { rate, name: emp.user?.name ?? "Employee" };
}

// ── Props ─────────────────────────────────────────────────────
export interface WorklogPDFButtonProps {
  workLogs: WorkLogEntry[];
  totalMinutes: number;
  dateFrom?: string;
  dateTo?: string;
  hourlyRate?: number;
  employeeName?: string;
  orgId?: number;
  style?: React.CSSProperties;
}

// ── Button component ──────────────────────────────────────────
export default function WorklogPDFButton({
  workLogs,
  dateFrom,
  dateTo,
  hourlyRate: propRate,
  employeeName: propName,
  style,
}: WorklogPDFButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [manualRate, setManualRate] = useState("");
  const [excludePercentage, setExcludePercentage] = useState(false);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [status, setStatus] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setStatus("");
    try {
      setStatus("Fetching work logs…");
      let allLogs: WorkLogEntry[];
      try {
        allLogs = await fetchAllLogs(dateFrom, dateTo);
      } catch {
        allLogs = workLogs;
      }

      if (allLogs.length === 0) {
        setError("No work logs found.");
        setLoading(false);
        return;
      }

      let allExpenses: MyExpenseRow[] = [];
      if (includeExpenses) {
        setStatus("Fetching expenses…");
        try {
          allExpenses = await fetchAllExpensesForPeriod(dateFrom, dateTo);
        } catch {
          allExpenses = [];
        }
      }

      setStatus("Fetching salary info…");
      let rate = propRate ?? 0;
      let name = propName ?? "Employee";

      if (!propRate) {
        const manParsed = parseFloat(manualRate);
        if (!isNaN(manParsed) && manParsed > 0) {
          rate = manParsed;
        } else {
          try {
            const info = await fetchMyHourlyRate(dateFrom, dateTo);
            rate = info.rate;
            name = info.name;
          } catch {
            rate = 0;
          }
        }
      }

      let projectBillingMap: Map<number, string> | undefined;
      if (excludePercentage) {
        setStatus("Fetching project billing types…");
        const projectIds = allLogs.map((log) => log.project_id).filter((id) => id > 0);
        if (projectIds.length > 0) {
          projectBillingMap = await fetchProjectBillingTypes(projectIds);
        }
      }

      setStatus("Generating PDF…");
      await generateWorklogPDF({
        logs: allLogs,
        expenses: allExpenses,
        includeExpenses,
        dateFrom,
        dateTo,
        hourlyRate: rate,
        employeeName: name,
        excludePercentageProjects: excludePercentage,
        projectBillingMap,
      });
    } catch (e: any) {
      setError(e?.message ?? "PDF generation failed");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  const btnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 9,
    border: "1px solid rgba(99,102,241,0.35)",
    background: "rgba(99,102,241,0.1)",
    color: "#818cf8",
    fontSize: 12,
    fontWeight: 600,
    cursor: loading ? "wait" : "pointer",
    opacity: loading ? 0.65 : 1,
    fontFamily: "'DM Sans',sans-serif",
    transition: "all 0.15s",
    ...style,
  };

  const optBtnStyle: React.CSSProperties = {
    background: "none",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 7,
    padding: "7px 10px",
    color: "#64748b",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif",
  };

  const panelStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 280,
  };

  const inpStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    padding: "7px 10px",
    fontSize: 12,
    color: "#f1f5f9",
    outline: "none",
    fontFamily: "'DM Sans',sans-serif",
    width: "100%",
    boxSizing: "border-box",
  };

  function toggleStyleFor(active: boolean): React.CSSProperties {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontSize: 11,
      color: active ? "#10b981" : "#64748b",
      cursor: "pointer",
      background: "none",
      border: "none",
      padding: 0,
      fontFamily: "'DM Sans',sans-serif",
      fontWeight: 500,
    };
  }

  function Toggle({ active }: { active: boolean }) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          width: 28,
          height: 16,
          borderRadius: 99,
          background: active ? "#10b981" : "#334155",
          padding: "0 2px",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#fff",
            transform: active ? "translateX(12px)" : "translateX(0)",
            transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
            display: "block",
          }}
        />
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={btnStyle}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(99,102,241,0.2)";
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(99,102,241,0.6)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "rgba(99,102,241,0.1)";
            (e.currentTarget as HTMLElement).style.borderColor =
              "rgba(99,102,241,0.35)";
          }}
        >
          {loading ? (
            <svg
              width={13}
              height={13}
              viewBox="0 0 20 20"
              fill="none"
              style={{ animation: "wlpdf-spin 0.9s linear infinite" }}
            >
              <path
                d="M17 10a7 7 0 1 1-7-7M10 3v4h4"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width={13} height={13} viewBox="0 0 20 20" fill="none">
              <path
                d="M10 3v10M6 9l4 4 4-4M4 16h12"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {loading ? status || "Generating…" : "Download PDF"}
        </button>

        <button onClick={() => setShowOptions((v) => !v)} style={optBtnStyle}>
          Options {showOptions ? "▲" : "▼"}
        </button>
      </div>

      {showOptions && (
        <div style={panelStyle}>
          <button
            onClick={() => setIncludeExpenses((v) => !v)}
            style={toggleStyleFor(includeExpenses)}
          >
            <Toggle active={includeExpenses} />
            Include expenses in report
          </button>

          <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>
            {includeExpenses
              ? "Pending (unreimbursed) expenses are added to Total Payable."
              : "Expenses are excluded — only salary is shown."}
          </div>

          <button
            onClick={() => setExcludePercentage((v) => !v)}
            style={toggleStyleFor(excludePercentage)}
          >
            <Toggle active={excludePercentage} />
            Exclude %-share projects
          </button>

          <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>
            {excludePercentage
              ? "Only hourly projects included"
              : "All projects included"}
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                color: "#475569",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Rate override (Rs./hr)
            </div>
            <input
              type="number"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder="e.g. 500"
              style={inpStyle}
            />
          </div>

          <div style={{ fontSize: 10, color: "#334155" }}>
            {dateFrom && dateTo
              ? `${dateFrom} → ${dateTo}`
              : "All time"}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 11,
            color: "#ef4444",
            padding: "5px 10px",
            background: "rgba(239,68,68,0.1)",
            borderRadius: 7,
          }}
        >
          Error: {error}
        </div>
      )}

      <style>{`@keyframes wlpdf-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}