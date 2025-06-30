"use client";

import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { UserWorkLog } from "@/types/worklogs";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { useParams } from "next/navigation";
import { useGetUserDetailsQuery } from "@/redux/features/userApiSlice";
import { useGetExpensesQuery } from "@/redux/features/expenseApiSlice";
import { Expense } from "@/types/expenses";
import { useState, useMemo } from "react";
import { Dispatch, SetStateAction } from "react";

interface MonthlyReportButtonProps {
  worklogs: UserWorkLog[];
  currentMonth: Date;
  selectedOrg: string;
  className?: string;
  // WorkTable filter props
  worklogsSelectedDate?: Date | null;
  worklogsMonthRange?: { start: Date; end: Date };
  worklogsShowOnlyCurrentMonth?: boolean;
  // AdminExpensesTable filter props
  expensesSelectedDate?: Date | null;
  expensesMonthRange?: { start: Date; end: Date };
  expensesShowOnlyCurrentMonth?: boolean;
  setExpensesSelectedDate?: Dispatch<SetStateAction<Date | null>>;
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
  // WorkTable filter props
  worklogsSelectedDate,
  worklogsMonthRange,
  worklogsShowOnlyCurrentMonth = false,
  // AdminExpensesTable filter props
  expensesSelectedDate,
  expensesMonthRange,
  expensesShowOnlyCurrentMonth = false,
}: MonthlyReportButtonProps): React.JSX.Element {
  const [baseFee, setBaseFee] = useState<string>("");
  const params = useParams();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const { data: selectedUser } = useGetUserDetailsQuery(userId || "", {
    skip: !userId,
  });

  // Get all expenses (we'll filter them client-side based on AdminExpensesTable filters)
  const expensesQuery = useGetExpensesQuery(
    {}, // Empty params since we'll filter client-side
    { skip: !userId }
  );

  const allExpenses: Expense[] = expensesQuery.data || [];

  // Determine the worklogs display range (same logic as WorkTable)
  const worklogsDisplayRange = useMemo(() => {
    if (worklogsSelectedDate) return null;
    if (worklogsMonthRange) return worklogsMonthRange;
    if (worklogsShowOnlyCurrentMonth) {
      return {
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      };
    }
    return null;
  }, [
    worklogsSelectedDate,
    worklogsMonthRange,
    worklogsShowOnlyCurrentMonth,
    currentMonth,
  ]);

  // Determine the expenses display range (same logic as AdminExpensesTable)
  const expensesDisplayRange = useMemo(() => {
    if (expensesSelectedDate) return null;
    if (expensesMonthRange) return expensesMonthRange;
    if (expensesShowOnlyCurrentMonth) {
      return {
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      };
    }
    return null;
  }, [
    expensesSelectedDate,
    expensesMonthRange,
    expensesShowOnlyCurrentMonth,
    currentMonth,
  ]);

  // Filter worklogs based on WorkTable filters
  const filteredWorklogs = useMemo(() => {
    let result = [...worklogs];

    // Apply organization filter
    result = result.filter(
      (log) => selectedOrg === "all" || log.organisation === selectedOrg
    );

    // Apply date filters
    if (worklogsSelectedDate) {
      result = result.filter((log) => {
        try {
          const logDate = parseISO(log.start_time);
          return isSameDay(logDate, worklogsSelectedDate);
        } catch {
          return false;
        }
      });
    } else if (worklogsDisplayRange) {
      result = result.filter((log) => {
        try {
          const logDate = parseISO(log.start_time);
          return isWithinInterval(logDate, {
            start: worklogsDisplayRange.start,
            end: worklogsDisplayRange.end,
          });
        } catch {
          return false;
        }
      });
    }

    return result;
  }, [worklogs, selectedOrg, worklogsSelectedDate, worklogsDisplayRange]);

  // Filter expenses based on AdminExpensesTable filters
  const filteredExpenses = useMemo(() => {
  console.log('All expenses:', allExpenses); // Debug raw data
  console.log('Filter params:', { 
    userId,
    expensesSelectedDate, 
    expensesDisplayRange
  });

  let result = allExpenses.filter(
    (expense) => expense.user?.id === Number(userId)
  );
  
  console.log('After user filter:', result); // Debug after user filter

  if (expensesSelectedDate) {
    result = result.filter((expense) => {
      if (!expense.date) return false;
      try {
        const expenseDate = parseISO(expense.date);
        return isSameDay(expenseDate, expensesSelectedDate);
      } catch {
        return false;
      }
    });
    console.log('After date filter:', result); // Debug after date filter
  } else if (expensesDisplayRange) {
    result = result.filter((expense) => {
      if (!expense.date) return false;
      try {
        const expenseDate = parseISO(expense.date);
        return isWithinInterval(expenseDate, {
          start: expensesDisplayRange.start,
          end: expensesDisplayRange.end
        });
      } catch {
        return false;
      }
    });
    console.log('After range filter:', result); // Debug after range filter
  }
  
  return result;
}, [allExpenses, userId, expensesSelectedDate, expensesDisplayRange]);

  const generateMonthlyReport = (): void => {
    const monthName = format(currentMonth, "MMMM yyyy");

    // Use filteredWorklogs instead of monthlyWorklogs
    if (filteredWorklogs.length === 0 && filteredExpenses.length === 0) {
      alert(`No worklogs or expenses found for ${monthName}`);
      return;
    }

    const userName = selectedUser
      ? `${selectedUser.first_name} ${selectedUser.last_name}`
      : "User";

    // Organize worklog data by date first
    const dailyData: Record<string, DailySummary> = {};
    const orgData: Record<string, OrgSummary> = {};

    // Use filteredWorklogs here
    filteredWorklogs.forEach((log) => {
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

    // Effective days calculation logic
    let fullDaysCount = 0;
    let halfDaysCount = 0;
    let lessTimeHours = 0;
    let overtimeHours = 0;

    sortedDays.forEach((day) => {
      const hours = day.minutes / 60;

      if (hours >= 7.5 && hours <= 8) {
        fullDaysCount += 1;
      } else if (hours >= 3.5 && hours <= 4) {
        halfDaysCount += 1;
      } else if (hours < 7.5) {
        lessTimeHours += hours;
      } else {
        const overtime = hours - 8;
        overtimeHours += overtime;
        fullDaysCount += 1;
      }
    });

    // Calculate effective days from less time and overtime
    const totalExtraHours = lessTimeHours + overtimeHours;
    const extraDays = (totalExtraHours / 4) * 0.5;
    const roundedExtraDays = Math.floor(extraDays * 2) / 2;

    // Total effective days (full days + half days + converted extra time)
    const effectiveDays =
      fullDaysCount + halfDaysCount * 0.5 + roundedExtraDays;
    const hoursPerDay = totalHours / uniqueWorkDays;

    // Calculate total expenses
    const totalExpenses = filteredExpenses.reduce((sum, expense) => {
      const amount = parseFloat(expense.amount) || 0;
      return sum + amount;
    }, 0);

    // Calculate salary and total amount to pay
    const baseFeeValue = parseFloat(baseFee) || 0;
    const salary = baseFeeValue * effectiveDays;
    const totalAmountToPay = salary + totalExpenses;

    // Create PDF
    const doc = new jsPDF() as JsPDFWithAutoTable;

    // Title and metadata
    doc.setFontSize(14);
    doc.text(`Monthly Work Summary - ${monthName}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Report for: ${userName}`, 14, 22);

    // Create summary table
    const summaryData = [
      ["Filter", selectedOrg === "all" ? "All Organizations" : selectedOrg],
      ["Days Worked", uniqueWorkDays],
      ["Hours per Day", hoursPerDay.toFixed(1) + "h"],
      ["Full Days", fullDaysCount],
      ["Half Days", halfDaysCount],
      ["Extra Time Days", roundedExtraDays.toFixed(1)],
      ["Effective Days", effectiveDays.toFixed(1)],
      ["Total Hours", formatDuration(totalMinutes)],
      ["Total Expenses", `Rs.${totalExpenses.toFixed(2)}`],
    ];

    if (baseFeeValue > 0) {
      summaryData.push(["Base Fee per Day", `Rs.${baseFeeValue.toFixed(2)}`]);
      summaryData.push(["Salary", `Rs.${salary.toFixed(2)}`]);
      summaryData.push([
        "Total Amount to Pay",
        `Rs.${totalAmountToPay.toFixed(2)}`,
      ]);
    } else {
      summaryData.push([
        "Total Amount to Pay",
        `Rs.${totalExpenses.toFixed(2)}`,
      ]);
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
          if (data.row.index === 2) {
            data.cell.styles.fontStyle = "italic";
          }
          if (data.row.index === 6) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 20 },
    } as UserOptions);

    let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : 60;

    // Add expenses table if there are expenses
    if (filteredExpenses.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Monthly Expenses", 14, startY);
      startY += 7;

      const expenseTableData = filteredExpenses.map((expense) => {
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
          if (data.section === "body" && data.row.index === filteredExpenses.length) {
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
    if (filteredWorklogs.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(41, 128, 185);
      doc.text("Daily Work Summary", 14, startY);
      startY += 7;

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

            if (hours < 3.5) {
              data.cell.styles.textColor = [255, 0, 0];
            } else if (hours >= 3.5 && hours <= 4) {
              data.cell.styles.textColor = [0, 100, 0];
            } else if (hours >= 7.5 && hours <= 8) {
              data.cell.styles.textColor = [0, 200, 0];
            } else if (hours > 8) {
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
