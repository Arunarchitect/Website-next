"use client";

import { useState, useMemo, useEffect } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  differenceInMinutes,
} from "date-fns";
import { WorkTableProps, SortKey, UserWorkLog } from "@/types/worklogs";
import { CalendarView } from "@/components/Worklogs/CalendarView";
import { RemarksModal } from "@/components/Worklogs/RemarksModal";
import { WorkTableFilters } from "@/components/Userworklogs/WorkTableFilters";
import { WorkTableHeader } from "@/components/Userworklogs/WorkTableHeader";
import { WorkTableContent } from "@/components/Userworklogs/WorkTableContent";
import Spinner from "@/components/common/Spinner";
import { MonthlyReportButton } from "@/components/reports/MonthlyReportButton";

const formatDuration = (minutes: number | undefined): string => {
  if (minutes === undefined || isNaN(minutes)) return "0h 0m";
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = Math.round(absMinutes % 60);
  return minutes < 0 ? `-${hours}h ${mins}m` : `${hours}h ${mins}m`;
};

const calculateDuration = (startTime: string, endTime: string): number => {
  try {
    if (!startTime || !endTime) return 0;
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    return differenceInMinutes(end, start);
  } catch (error) {
    console.error("Error calculating duration:", error);
    return 0;
  }
};

export default function WorkTable({
  worklogs: initialWorklogs,
  isError,
  isLoading = false,
  sortKey: initialSortKey = "start_time",
  sortDirection: initialSortDirection = "desc",
  onSort,
  showOnlyCurrentMonth = false,
}: WorkTableProps & { showOnlyCurrentMonth?: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortDirection);
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState("");
  const [worklogs, setWorklogs] = useState<UserWorkLog[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Expense filter states
  const [expensesMonthRange, setExpensesMonthRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    setWorklogs(
      initialWorklogs.map((log) => {
        const duration = calculateDuration(log.start_time, log.end_time ?? "");
        return {
          ...log,
          end_time: log.end_time ?? "",
          duration,
          remarks: log.remarks ?? "",
          organisation: log.organisation ?? "",
          formattedDuration: formatDuration(duration),
        };
      })
    );
    setCurrentPage(1);
  }, [initialWorklogs]);

  const organizations = useMemo<string[]>(() => {
    return Array.from(
      new Set(
        worklogs
          .map((log) => log.organisation)
          .filter((org): org is string => !!org)
      )
    );
  }, [worklogs]);

  const orgFilteredLogs = useMemo(() => {
    const logs =
      selectedOrg === "all"
        ? worklogs
        : worklogs.filter((log) => log.organisation === selectedOrg);

    if (showOnlyCurrentMonth) {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      return logs.filter((log) => {
        try {
          const date = parseISO(log.start_time);
          return date >= monthStart && date <= monthEnd;
        } catch (err) {
          console.error("Invalid date in start_time:", log.start_time, err);
          return false;
        }
      });
    }
    return logs;
  }, [worklogs, selectedOrg, currentMonth, showOnlyCurrentMonth]);

  const { worklogDates, daysWithWorklogsCount } = useMemo(() => {
    const dates = new Set<string>();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    orgFilteredLogs.forEach((log) => {
      try {
        const date = parseISO(log.start_time);
        const formatted = format(date, "yyyy-MM-dd");
        dates.add(formatted);
      } catch (err) {
        console.error("Invalid date in start_time:", log.start_time, err);
      }
    });

    const count = Array.from(dates).filter((d) => {
      try {
        const date = parseISO(d);
        return date >= monthStart && date <= monthEnd;
      } catch (err) {
        console.error("Invalid date when filtering:", d, err);
        return false;
      }
    }).length;

    return { worklogDates: dates, daysWithWorklogsCount: count };
  }, [orgFilteredLogs, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const filteredLogs = useMemo(() => {
    if (!selectedDate) return orgFilteredLogs;
    const target = format(selectedDate, "yyyy-MM-dd");
    return orgFilteredLogs.filter((log) => {
      try {
        return format(parseISO(log.start_time), "yyyy-MM-dd") === target;
      } catch (err) {
        console.error("Error parsing date when filtering:", log.start_time, err);
        return false;
      }
    });
  }, [orgFilteredLogs, selectedDate]);

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [filteredLogs, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLogs, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSort = (key: SortKey) => {
    if (onSort) {
      onSort(key);
    } else {
      if (key === sortKey) {
        const newOrder = sortOrder === "asc" ? "desc" : "asc";
        setSortOrder(newOrder);
      } else {
        setSortKey(key);
        setSortOrder("asc");
      }
    }
    setCurrentPage(1);
  };

  const handleShowRemarks = (remarks: string | null) => {
    if (!remarks) return;
    setCurrentRemarks(remarks);
    setShowRemarksModal(true);
  };

  const prevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setSelectedDate(null);
    setCurrentPage(1);
    setExpensesMonthRange({
      start: startOfMonth(newMonth),
      end: endOfMonth(newMonth),
    });
  };

  const nextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    setSelectedDate(null);
    setCurrentPage(1);
    setExpensesMonthRange({
      start: startOfMonth(newMonth),
      end: endOfMonth(newMonth),
    });
  };

  const handleDateClick = (day: Date) => {
    setSelectedDate((prev) => (prev && isSameDay(prev, day) ? null : day));
    setCurrentPage(1);
  };

  const handleMonthChange = (month: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), month, 1);
    setCurrentMonth(newMonth);
    setCurrentPage(1);
    setExpensesMonthRange({
      start: startOfMonth(newMonth),
      end: endOfMonth(newMonth),
    });
  };

  const handleYearChange = (year: number) => {
    const newMonth = new Date(year, currentMonth.getMonth(), 1);
    setCurrentMonth(newMonth);
    setCurrentPage(1);
    setExpensesMonthRange({
      start: startOfMonth(newMonth),
      end: endOfMonth(newMonth),
    });
  };

  const renderSortArrow = (key: SortKey) => {
    if (key !== sortKey) return <span className="ml-1 text-gray-300">↕</span>;
    return sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  const monthlyReportButtonProps = {
    worklogs,
    currentMonth,
    selectedOrg,
    worklogsSelectedDate: selectedDate,
    worklogsMonthRange: {
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    },
    showOnlyCurrentMonth,
    expensesSelectedDate: null,
    expensesMonthRange,
    expensesShowOnlyCurrentMonth: true,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner lg />
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <RemarksModal
        show={showRemarksModal}
        onClose={() => setShowRemarksModal(false)}
        remarks={currentRemarks}
      />

      <div className="flex justify-between items-center mb-4">
        <WorkTableHeader
          currentMonth={currentMonth}
          daysWithWorklogsCount={daysWithWorklogsCount}
        />
        {!isMobile && (
          <MonthlyReportButton {...monthlyReportButtonProps} className="px-2 py-2" />
        )}
      </div>

      {isMobile && (
        <div className="mb-4">
          <MonthlyReportButton {...monthlyReportButtonProps} className="w-full py-2" />
        </div>
      )}

      <CalendarView
        currentMonth={currentMonth}
        calendarDays={calendarDays}
        worklogDates={worklogDates}
        selectedDate={selectedDate}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        handleDateClick={handleDateClick}
        handleMonthChange={handleMonthChange}
        handleYearChange={handleYearChange}
        showOnlyCurrentMonth={showOnlyCurrentMonth}
      />

      {selectedDate && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            Showing worklogs for: {format(selectedDate, "MMMM d, yyyy")}
            {selectedOrg !== "all" && ` (${selectedOrg})`}
          </div>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear date filter
          </button>
        </div>
      )}

      <WorkTableFilters
        organizations={organizations}
        selectedOrg={selectedOrg}
        setSelectedOrg={setSelectedOrg}
        showMobileFilters={showMobileFilters}
        setShowMobileFilters={setShowMobileFilters}
      />

      {isError ? (
        <p className="text-red-500">Error loading work logs</p>
      ) : sortedLogs.length === 0 ? (
        <p className="text-gray-500">
          No work logs found
          {selectedOrg !== "all" && ` for ${selectedOrg}`}
          {selectedDate && ` on ${format(selectedDate, "MMMM d, yyyy")}`}
        </p>
      ) : (
        <div className="relative">
          <WorkTableContent
            sortedLogs={paginatedLogs}
            handleSort={handleSort}
            renderSortArrow={renderSortArrow}
            handleShowRemarks={handleShowRemarks}
          />

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-md ${
                  currentPage === 1
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Previous
              </button>

              <div className="flex items-center space-x-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 rounded-md ${
                        currentPage === pageNum
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 hover:bg-gray-300"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-2">...</span>
                )}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className={`px-3 py-1 rounded-md ${
                      currentPage === totalPages
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    {totalPages}
                  </button>
                )}
              </div>

              <button
                onClick={() =>
                  handlePageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-md ${
                  currentPage === totalPages
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}