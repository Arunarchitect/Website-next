"use client";

import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { UserWorkLog } from "@/types/worklogs";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { useParams } from "next/navigation";
import { useGetUserDetailsQuery } from "@/redux/features/userApiSlice";
import { useGetExpensesQuery } from "@/redux/features/expenseApiSlice";
import { Expense } from "@/types/expenses";
import { useState } from "react";

interface MonthlyReportButtonProps {
  worklogs: UserWorkLog[];
  currentMonth: Date;
  selectedOrg: string;
  className?: string;
}

interface ProjectSummary {
  name: string;
  minutes: number;
  deliverables: {
    name: string;
    minutes: number;
  }[];
}

interface OrgSummary {
  name: string;
  minutes: number;
  projects: ProjectSummary[];
}

interface DailySummary {
  date: string;
  minutes: number;
}

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

export function MonthlyReportButton({
  worklogs,
  currentMonth,
  selectedOrg,
  className = "",
}: MonthlyReportButtonProps): React.JSX.Element {
  const [baseFee, setBaseFee] = useState<string>("");
  const params = useParams();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const { data: selectedUser } = useGetUserDetailsQuery(userId || "", {
    skip: !userId,
  });

  // Get expenses for the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const expensesQuery = useGetExpensesQuery(
    {
      start_date: format(monthStart, "yyyy-MM-dd"),
      end_date: format(monthEnd, "yyyy-MM-dd"),
    },
    { skip: !userId }
  );

  const allExpenses: Expense[] = expensesQuery.data || [];

  // Filter expenses by user ID
  const expenses = allExpenses.filter(
    (expense) => expense.user?.id === Number(userId)
  );

  const generateMonthlyReport = (): void => {
    const monthName = format(currentMonth, "MMMM yyyy");

    const monthlyWorklogs = worklogs.filter((log) => {
      try {
        const date = parseISO(log.start_time);
        const isInMonth = date >= monthStart && date <= monthEnd;
        const isOrgMatch =
          selectedOrg === "all" || log.organisation === selectedOrg;
        return isInMonth && isOrgMatch;
      } catch (err) {
        console.error("Invalid date in start_time:", log.start_time, err);
        return false;
      }
    });

    if (monthlyWorklogs.length === 0 && expenses.length === 0) {
      alert(`No worklogs or expenses found for ${monthName}`);
      return;
    }

    const userName = selectedUser
      ? `${selectedUser.first_name} ${selectedUser.last_name}`
      : "User";

    // Organize worklog data by date first
    const dailyData: Record<string, DailySummary> = {};
    const orgData: Record<string, OrgSummary> = {};

    monthlyWorklogs.forEach((log) => {
      const date = parseISO(log.start_time);
      const dateStr = format(date, "yyyy-MM-dd");
      const orgName = log.organisation || "Uncategorized";
      const projectName = log.project || "Uncategorized";
      const deliverableName = log.deliverable || "Uncategorized";
      const minutes = log.duration || 0;

      // Update daily summary
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          date: dateStr,
          minutes: 0,
        };
      }
      dailyData[dateStr].minutes += minutes;

      // Update organization/project/deliverable summary
      if (!orgData[orgName]) {
        orgData[orgName] = {
          name: orgName,
          minutes: 0,
          projects: [],
        };
      }

      let project = orgData[orgName].projects.find(
        (p) => p.name === projectName
      );
      if (!project) {
        project = {
          name: projectName,
          minutes: 0,
          deliverables: [],
        };
        orgData[orgName].projects.push(project);
      }

      let deliverable = project.deliverables.find(
        (d) => d.name === deliverableName
      );
      if (!deliverable) {
        deliverable = {
          name: deliverableName,
          minutes: 0,
        };
        project.deliverables.push(deliverable);
      }

      deliverable.minutes += minutes;
      project.minutes += minutes;
      orgData[orgName].minutes += minutes;
    });

    // Sort data
    const sortedDays = Object.values(dailyData).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const sortedOrgs = Object.values(orgData).sort(
      (a, b) => b.minutes - a.minutes
    );
    sortedOrgs.forEach((org) => {
      org.projects.sort((a, b) => b.minutes - a.minutes);
      org.projects.forEach((project) => {
        project.deliverables.sort((a, b) => b.minutes - a.minutes);
      });
    });

    const uniqueWorkDays = Object.keys(dailyData).length;
    const totalMinutes = sortedOrgs.reduce((sum, org) => sum + org.minutes, 0);
    const totalHours = totalMinutes / 60;
    const effectiveDays = sortedDays.reduce((sum, day) => {
      const hours = day.minutes / 60;
      return sum + (hours < 6 ? 0.5 : 1); // Half day if <6 hours, full day otherwise
    }, 0);
    const hoursPerDay = totalHours / uniqueWorkDays;

    // Calculate total expenses - properly handle string amounts
    const totalExpenses = expenses.reduce((sum, expense) => {
      const amount = parseFloat(expense.amount) || 0;
      return sum + amount;
    }, 0);

    // Calculate salary and total amount to pay
    const baseFeeValue = parseFloat(baseFee) || 0;
    const salary = baseFeeValue * effectiveDays;
    const totalAmountToPay = salary + totalExpenses;

    // Create PDF
    const doc = new jsPDF() as JsPDFWithAutoTable;

    // Title and metadata - smaller font size
    doc.setFontSize(14);
    doc.text(`Monthly Work Summary - ${monthName}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Report for: ${userName}`, 14, 22);

    // Create summary table
    const summaryData = [
      ["Filter", selectedOrg === "all" ? "All Organizations" : selectedOrg],
      ["Days Worked", uniqueWorkDays],
      ["Hours per Day", hoursPerDay.toFixed(1) + "h"],
      ["Effective Days", effectiveDays.toFixed(1)],
      ["Total Hours", formatDuration(totalMinutes)],
      ["Total Expenses", `Rs.${totalExpenses.toFixed(2)}`],
    ];

    if (baseFeeValue > 0) {
      summaryData.push(["Base Fee per Day", `Rs.${baseFeeValue.toFixed(2)}`]);
      summaryData.push(["Salary", `Rs.${salary.toFixed(2)}`]);
      summaryData.push(["Total Amount to Pay", `Rs.${totalAmountToPay.toFixed(2)}`]);
    } else {
      summaryData.push(["Total Amount to Pay", `Rs.${totalExpenses.toFixed(2)}`]);
    }

    autoTable(doc, {
      startY: 30,
      head: [["Summary", "Value"]],
      body: summaryData,
      theme: "grid",
      headStyles: {
        fillColor: [51, 51, 51],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        1: { fontStyle: "bold" },
      },
      bodyStyles: {
        fontSize: 10,
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          if (data.cell.raw === "Effective Days") {
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.section === "body" && data.column.index === 1) {
          if (data.row.index === 2) { // Hours per day row
            data.cell.styles.fontStyle = "italic";
          }
          if (data.row.index === 3) { // Effective days row
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 20 },
    } as UserOptions);

    let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : 60;

    // Add expenses table if there are expenses
    if (expenses.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Monthly Expenses", 14, startY);
      startY += 7;

      const expenseTableData = expenses.map((expense) => {
        const formattedDate = format(new Date(expense.date), "MMM dd, yyyy");
        const amount = parseFloat(expense.amount) || 0;
        const projectName = expense.project?.name || "Uncategorized";
        const category = expense.category_name || expense.category || "No category";
        return [
          formattedDate,
          projectName,
          category,
          `Rs.${amount.toFixed(2)}`,
        ];
      });

      // Add total row
      expenseTableData.push(["", "", "Total", `Rs.${totalExpenses.toFixed(2)}`]);

      autoTable(doc, {
        startY,
        head: [["Date", "Project", "Category", "Amount"]],
        body: expenseTableData,
        theme: "grid",
        headStyles: {
          fillColor: [51, 51, 51],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          3: { halign: "right" },
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          fontSize: 9,
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === expenses.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [220, 220, 220];
          }
        },
        margin: { left: 20 },
      } as UserOptions);

      startY = doc.lastAutoTable?.finalY
        ? doc.lastAutoTable.finalY + 10
        : startY + 20;
    }

    // Add daily summary table if there are worklogs
    if (monthlyWorklogs.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Daily Work Summary", 14, startY);
      startY += 7;

      const dailyTableData = sortedDays.map((day) => {
        const formattedDate = format(new Date(day.date), "MMM dd, yyyy (EEEE)");
        const preciseHours = day.minutes / 60;
        const displayDuration = formatDuration(day.minutes);
        const dayType = preciseHours < 6 ? "Half Day" : "Full Day";

        return {
          date: formattedDate,
          duration: displayDuration,
          dayType,
          preciseHours,
        };
      });

      autoTable(doc, {
        startY,
        head: [["Date", "Hours Worked", "Day Type"]],
        body: dailyTableData.map((day) => [
          day.date,
          day.duration,
          day.dayType,
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [51, 51, 51],
          textColor: 255,
          fontStyle: "bold",
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          fontSize: 9,
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 1) {
            const rowIndex = data.row.index;
            const hours = dailyTableData[rowIndex].preciseHours;

            if (hours < 6) {
              data.cell.styles.textColor = [255, 0, 0];
            } else if (hours > 10) {
              data.cell.styles.textColor = [0, 0, 255];
            }
          }
        },
        margin: { left: 20 },
      } as UserOptions);

      startY = doc.lastAutoTable?.finalY
        ? doc.lastAutoTable.finalY + 10
        : startY + 20;

      // Generate organization/project tables
      sortedOrgs.forEach((org) => {
        doc.setFontSize(12);
        doc.setTextColor(41, 128, 185);
        doc.text(`${org.name} - ${formatDuration(org.minutes)}`, 14, startY);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        startY += 7;

        const projectData = org.projects.map((project) => [
          project.name,
          formatDuration(project.minutes),
        ]);

        autoTable(doc, {
          startY,
          head: [["Project", "Total Time"]],
          body: projectData,
          theme: "grid",
          headStyles: {
            fillColor: [51, 51, 51],
            textColor: 255,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { fontStyle: "bold" },
          },
          bodyStyles: {
            fontSize: 9,
          },
          margin: { left: 20 },
        } as UserOptions);

        startY = doc.lastAutoTable?.finalY
          ? doc.lastAutoTable.finalY + 7
          : startY + 15;

        org.projects.forEach((project) => {
          doc.setFontSize(10);
          doc.setTextColor(41, 128, 185);
          doc.text(`${project.name} Deliverables`, 25, startY);
          doc.setFontSize(9);
          doc.setTextColor(0, 0, 0);
          startY += 5;

          const deliverableData = project.deliverables.map((deliverable) => [
            deliverable.name,
            formatDuration(deliverable.minutes),
          ]);

          autoTable(doc, {
            startY,
            head: [["Deliverable", "Time"]],
            body: deliverableData,
            theme: "grid",
            headStyles: {
              fillColor: [200, 200, 200],
              textColor: 0,
              fontStyle: "bold",
            },
            bodyStyles: {
              fontSize: 8,
            },
            margin: { left: 25 },
          } as UserOptions);

          startY = doc.lastAutoTable?.finalY
            ? doc.lastAutoTable.finalY + 5
            : startY + 10;
        });

        startY += 5;
      });
    }

    doc.save(
      `Work_Summary_${monthName.replace(" ", "_")}_${userName.replace(
        " ",
        "_"
      )}.pdf`
    );
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex flex-col">
        <label htmlFor="baseFee" className="text-sm text-gray-600 mb-1">
          Base Fee per Day (Rs.)
        </label>
        <input
          id="baseFee"
          type="number"
          placeholder="Enter base fee per day"
          value={baseFee}
          onChange={(e) => setBaseFee(e.target.value)}
          className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        type="button"
        onClick={generateMonthlyReport}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
      >
        Download Monthly Summary
      </button>
    </div>
  );
}