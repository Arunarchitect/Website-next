"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { UserWorkLog } from "@/types/worklogs";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

interface MonthlyReportButtonProps {
  worklogs: UserWorkLog[];
  currentMonth: Date;
  selectedOrg: string;
  className?: string;
}

export function MonthlyReportButton({
  worklogs,
  currentMonth,
  selectedOrg,
  className = "",
}: MonthlyReportButtonProps) {
  const generateMonthlyReport = () => {
    const monthName = format(currentMonth, "MMMM yyyy");
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Filter logs based on selected org and current month
    const monthlyWorklogs = worklogs.filter((log) => {
      try {
        const date = parseISO(log.start_time);
        const isInMonth = date >= monthStart && date <= monthEnd;
        const isOrgMatch = selectedOrg === "all" || log.organisation === selectedOrg;
        return isInMonth && isOrgMatch;
      } catch (err) {
        console.error("Invalid date in start_time:", log.start_time, err);
        return false;
      }
    });

    if (monthlyWorklogs.length === 0) {
      alert(`No worklogs found for ${monthName}`);
      return;
    }


    
    const uniqueWorkDays = new Set(
      monthlyWorklogs.map(log => format(parseISO(log.start_time), "yyyy-MM-dd"))
    ).size;

    // Create PDF
    const doc = new jsPDF();

    // Title and metadata
    doc.setFontSize(18);
    doc.text(`Monthly Work Report - ${monthName}`, 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Days Worked: ${uniqueWorkDays}`, 14, 40);

    // Table data
    const tableData = monthlyWorklogs.map((log) => {
      const startDate = parseISO(log.start_time);
      const endDate = log.end_time ? parseISO(log.end_time) : null;
      const durationHours = ((log.duration || 0) / 60).toFixed(2);

      return [
        format(startDate, "yyyy-MM-dd"),
        format(startDate, "HH:mm"),
        endDate ? format(endDate, "HH:mm") : "In Progress",
        `${durationHours}h`,
        log.deliverable,
        log.organisation || "-",
        log.remarks || "-"
      ];
    });

    // Generate table
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Start', 'End', 'Duration', 'Deliverable', 'Organization', 'Remarks']],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 50 }
    });

    // Save the PDF
    doc.save(`Work_Report_${monthName.replace(" ", "_")}.pdf`);
  };

  return (
    <button
      onClick={generateMonthlyReport}
      className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors ${className}`}
    >
      Download Monthly Report
    </button>
  );
}