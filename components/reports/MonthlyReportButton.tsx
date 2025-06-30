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
  const expenses = allExpenses.filter(
    (expense) => expense.user?.id === Number(userId)
  );

  const generateMonthlyReport = (): void => {
    const monthName = format(currentMonth, "MMMM yyyy");
    const userName = selectedUser
      ? `${selectedUser.first_name} ${selectedUser.last_name}`
      : "User";

    // Create PDF
    const doc = new jsPDF() as JsPDFWithAutoTable;

    // Title and metadata
    doc.setFontSize(14);
    doc.text(`Monthly Work Summary - ${monthName}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Report for: ${userName}`, 14, 22);
    doc.text(`Organization: ${selectedOrg === "all" ? "All" : selectedOrg}`, 14, 29);

    // Filter worklogs for selected month and organization
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

    // Initialize summary variables with default 0 values
    let uniqueWorkDays = 0;
    let totalMinutes = 0;
    let fullDaysCount = 0;
    let halfDaysCount = 0;
    let roundedExtraDays = 0;
    let effectiveDays = 0;
    let hoursPerDay = 0;

    // Only calculate if there are worklogs
    if (monthlyWorklogs.length > 0) {
      const { worklogDates, daysWithWorklogsCount } = monthlyWorklogs.reduce(
        (acc, log) => {
          try {
            const date = parseISO(log.start_time);
            const dateStr = format(date, "yyyy-MM-dd");
            acc.worklogDates.add(dateStr);
            return acc;
          } catch (err) {
            console.error("Invalid date in start_time:", log.start_time, err);
            return acc;
          }
        },
        { worklogDates: new Set<string>(), daysWithWorklogsCount: 0 }
      );

      uniqueWorkDays = worklogDates.size;
      totalMinutes = monthlyWorklogs.reduce((sum, log) => sum + (log.duration || 0), 0);

      // Calculate day types
      const dailySummaries: Record<string, DailySummary> = {};
      monthlyWorklogs.forEach((log) => {
        try {
          const dateStr = format(parseISO(log.start_time), "yyyy-MM-dd");
          if (!dailySummaries[dateStr]) {
            dailySummaries[dateStr] = { date: dateStr, minutes: 0 };
          }
          dailySummaries[dateStr].minutes += log.duration || 0;
        } catch (err) {
          console.error("Invalid date in start_time:", log.start_time, err);
        }
      });

      Object.values(dailySummaries).forEach((day) => {
        const hours = day.minutes / 60;
        if (hours >= 7.5 && hours <= 8) {
          fullDaysCount += 1;
        } else if (hours >= 3.5 && hours <= 4) {
          halfDaysCount += 1;
        } else if (hours < 7.5) {
          const lessTimeHours = hours;
          roundedExtraDays += Math.floor((lessTimeHours / 4) * 2) / 2;
        } else {
          const overtime = hours - 8;
          roundedExtraDays += Math.floor((overtime / 4) * 2) / 2;
          fullDaysCount += 1;
        }
      });

      effectiveDays = fullDaysCount + halfDaysCount * 0.5 + roundedExtraDays;
      hoursPerDay = uniqueWorkDays > 0 ? totalMinutes / 60 / uniqueWorkDays : 0;
    }

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => {
      const amount = parseFloat(expense.amount) || 0;
      return sum + amount;
    }, 0);

    // Calculate salary and total amount to pay
    const baseFeeValue = parseFloat(baseFee) || 0;
    const salary = baseFeeValue * effectiveDays;
    const totalAmountToPay = salary + totalExpenses;

    // Create summary table
    const summaryData = [
      ["Filter", selectedOrg === "all" ? "All Organizations" : selectedOrg],
      ["Days Worked", uniqueWorkDays],
      ["Hours per Day", hoursPerDay.toFixed(1) + "h"],
      ["Full Days", fullDaysCount],
      ["Half Days", halfDaysCount],
      ["Extra Time Days", roundedExtraDays.toFixed(1)],
      ["Effective Days", effectiveDays.toFixed(1)],
      ["Total Hours", monthlyWorklogs.length > 0 ? formatDuration(totalMinutes) : "0h 0m"],
      ["Total Expenses", `Rs.${totalExpenses.toFixed(2)}`],
    ];

    if (baseFeeValue > 0) {
      summaryData.push(["Base Fee per Day", `Rs.${baseFeeValue.toFixed(2)}`]);
      summaryData.push(["Salary", `Rs.${salary.toFixed(2)}`]);
      summaryData.push([
        "Total Amount to Pay",
        `Rs.${totalAmountToPay.toFixed(2)}`,
      ]);
    }

    autoTable(doc, {
      startY: 40,
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
      margin: { left: 20 },
    } as UserOptions);

    let currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : 60;

    // Add expenses section
    doc.setFontSize(12);
    doc.setTextColor(41, 128, 185);
    doc.text("Monthly Expenses", 14, currentY);
    currentY += 7;

    if (expenses.length > 0) {
      const expenseTableData = expenses.map((expense) => {
        const formattedDate = format(new Date(expense.date), "MMM dd, yyyy");
        const amount = parseFloat(expense.amount) || 0;
        const projectName = expense.project?.name || "Uncategorized";
        const category =
          expense.category_name || expense.category || "No category";
        return [
          formattedDate,
          projectName,
          category,
          `Rs.${amount.toFixed(2)}`,
        ];
      });

      // Add total row
      expenseTableData.push([
        "",
        "",
        "Total",
        `Rs.${totalExpenses.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY,
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

      currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : currentY + 20;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0);
      doc.text("No expenses found for selected month", 20, currentY);
      currentY += 10;
    }

    // Add worklogs section
    doc.setFontSize(12);
    doc.setTextColor(41, 128, 185);
    doc.text("Work Summary", 14, currentY);
    currentY += 7;

    if (monthlyWorklogs.length > 0) {
      // Daily summary table
      const dailySummaries: Record<string, DailySummary> = {};
      monthlyWorklogs.forEach((log) => {
        try {
          const dateStr = format(parseISO(log.start_time), "yyyy-MM-dd");
          if (!dailySummaries[dateStr]) {
            dailySummaries[dateStr] = { date: dateStr, minutes: 0 };
          }
          dailySummaries[dateStr].minutes += log.duration || 0;
        } catch (err) {
          console.error("Invalid date in start_time:", log.start_time, err);
        }
      });

      const sortedDays = Object.values(dailySummaries).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const dailyTableData = sortedDays.map((day) => {
        const formattedDate = format(new Date(day.date), "MMM dd, yyyy (EEEE)");
        const preciseHours = day.minutes / 60;
        const displayDuration = formatDuration(day.minutes);

        let dayType = "";
        if (preciseHours >= 7.5 && preciseHours <= 8) {
          dayType = "Full Day";
        } else if (preciseHours >= 3.5 && preciseHours <= 4) {
          dayType = "Half Day";
        } else if (preciseHours < 7.5) {
          dayType = "Less Time Day";
        } else {
          dayType = `Overtime Day (+${(preciseHours - 8).toFixed(1)}h)`;
        }

        return {
          date: formattedDate,
          duration: displayDuration,
          dayType,
          preciseHours,
        };
      });

      autoTable(doc, {
        startY: currentY,
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
        margin: { left: 20 },
      } as UserOptions);

      currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : currentY + 20;

      // Organization/project breakdown
      const orgData: Record<string, OrgSummary> = {};

      monthlyWorklogs.forEach((log) => {
        const orgName = log.organisation || "Uncategorized";
        const projectName = log.project || "Uncategorized";
        const deliverableName = log.deliverable || "Uncategorized";
        const minutes = log.duration || 0;

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

      const sortedOrgs = Object.values(orgData).sort(
        (a, b) => b.minutes - a.minutes
      );

      sortedOrgs.forEach((org) => {
        doc.setFontSize(12);
        doc.setTextColor(41, 128, 185);
        doc.text(`${org.name} - ${formatDuration(org.minutes)}`, 14, currentY);
        currentY += 7;

        const projectData = org.projects.map((project) => [
          project.name,
          formatDuration(project.minutes),
        ]);

        autoTable(doc, {
          startY: currentY,
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

        currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 7 : currentY + 15;

        org.projects.forEach((project) => {
          doc.setFontSize(10);
          doc.setTextColor(41, 128, 185);
          doc.text(`${project.name} Deliverables`, 25, currentY);
          currentY += 5;

          const deliverableData = project.deliverables.map((deliverable) => [
            deliverable.name,
            formatDuration(deliverable.minutes),
          ]);

          autoTable(doc, {
            startY: currentY,
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

          currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : currentY + 10;
        });

        currentY += 5;
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0);
      doc.text("No worklogs found for selected month/filter", 20, currentY);
      currentY += 10;
    }

    doc.save(
      `Work_Summary_${monthName.replace(" ", "_")}_${userName.replace(" ", "_")}.pdf`
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
          className="px-2 py-2 w-25 h-16 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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