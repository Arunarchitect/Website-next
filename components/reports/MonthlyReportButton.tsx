"use client";

import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { UserWorkLog } from "@/types/worklogs";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { useParams } from "next/navigation";
import { useGetUserDetailsQuery } from "@/redux/features/userApiSlice";

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
  const params = useParams();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const { data: selectedUser } = useGetUserDetailsQuery(userId || "", {
    skip: !userId,
  });

  const generateMonthlyReport = (): void => {
    const monthName = format(currentMonth, "MMMM yyyy");
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

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

    if (monthlyWorklogs.length === 0) {
      alert(`No worklogs found for ${monthName}`);
      return;
    }

    const userName = selectedUser
      ? `${selectedUser.first_name} ${selectedUser.last_name}`
      : "User";

    // Organize data by date first
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
    const totalDays = sortedDays.reduce((sum, day) => {
      const hours = day.minutes / 60;
      return sum + (hours < 6 ? 0.5 : 1); // Half day if <6 hours, full day otherwise
    }, 0);

    // Create PDF
    const doc = new jsPDF() as JsPDFWithAutoTable;

    // Title and metadata
    doc.setFontSize(18);
    doc.text(`Monthly Work Summary - ${monthName}`, 14, 20);
    doc.text(`Report for: ${userName}`, 14, 30);

    doc.setFontSize(12);
    doc.text(
      `Filter: ${selectedOrg === "all" ? "All Organizations" : selectedOrg}`,
      14,
      40
    );
    doc.text(`Days Worked: ${uniqueWorkDays} (${totalDays.toFixed(1)} days)`, 14, 50);
    doc.text(`Total Hours: ${formatDuration(totalMinutes)}`, 14, 60);

    let startY = 70;

    // Add daily summary table
    doc.setFontSize(14);
    doc.setTextColor(41, 128, 185);
    doc.text("Daily Work Summary", 14, startY);
    startY += 10;

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
      body: dailyTableData.map((day) => [day.date, day.duration, day.dayType]),
      theme: "grid",
      headStyles: {
        fillColor: [51, 51, 51],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: [0, 0, 0], // Default black
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const rowIndex = data.row.index;
          const hours = dailyTableData[rowIndex].preciseHours;
          
          // Set cell styles based on hours worked
          if (hours < 6) {
            data.cell.styles.textColor = [255, 0, 0]; // Red for less than 6 hours
          } else if (hours > 10) {
            data.cell.styles.textColor = [0, 0, 255]; // Blue for more than 10 hours
          }
        }
      },
      margin: { left: 20 },
    } as UserOptions);

    // Reset color after table
    doc.setTextColor(0, 0, 0);
    startY = doc.lastAutoTable?.finalY
      ? doc.lastAutoTable.finalY + 20
      : startY + 30;

    // Generate organization/project tables
    sortedOrgs.forEach((org) => {
      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text(`${org.name} - ${formatDuration(org.minutes)}`, 14, startY);
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      startY += 10;

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
        margin: { left: 20 },
      } as UserOptions);

      startY = doc.lastAutoTable?.finalY
        ? doc.lastAutoTable.finalY + 10
        : startY + 30;

      org.projects.forEach((project) => {
        doc.setFontSize(12);
        doc.setTextColor(41, 128, 185);
        doc.text(`${project.name} Deliverables`, 30, startY);
        doc.setFontSize(10);
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
          margin: { left: 30 },
        } as UserOptions);

        startY = doc.lastAutoTable?.finalY
          ? doc.lastAutoTable.finalY + 5
          : startY + 20;
      });

      startY += 10;
    });

    doc.save(
      `Work_Summary_${monthName.replace(" ", "_")}_${userName.replace(
        " ",
        "_"
      )}.pdf`
    );
  };

  return (
    <button
      type="button"
      onClick={generateMonthlyReport}
      className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors ${className}`}
    >
      Download Monthly Summary
    </button>
  );
}