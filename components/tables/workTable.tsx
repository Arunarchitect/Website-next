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
  isSameMonth,
} from "date-fns";
import { WorkTableProps, SortKey, UserWorkLog } from "@/types/worklogs";
import { CalendarView } from "@/components/Worklogs/CalendarView";
import { RemarksModal } from "@/components/Worklogs/RemarksModal";
import { WorkTableFilters } from "@/components/Userworklogs/WorkTableFilters";
import { WorkTableHeader } from "@/components/Userworklogs/WorkTableHeader";
import { WorkTableContent } from "@/components/Userworklogs/WorkTableContent";
import Spinner from "@/components/common/Spinner";

export default function WorkTable({
  worklogs: initialWorklogs,
  isError,
  isLoading = false,
  totalHours,
  sortKey: initialSortKey = "start_time",
  sortDirection: initialSortDirection = "desc",
  onSort,
  showOnlyCurrentMonth = false,
}: WorkTableProps & { showOnlyCurrentMonth?: boolean }) {
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    initialSortDirection
  );
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState("");
  const [worklogs, setWorklogs] = useState<UserWorkLog[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    setWorklogs(
      initialWorklogs.map((log) => ({
        ...log,
        end_time: log.end_time ?? "",
        duration: log.duration ?? 0,
        remarks: log.remarks ?? "",
        organisation: log.organisation ?? "",
      }))
    );
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
  };

  const handleShowRemarks = (remarks: string | null) => {
    if (!remarks) return;
    setCurrentRemarks(remarks);
    setShowRemarksModal(true);
  };

  const prevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day: Date) => {
    setSelectedDate((prev) => (prev && isSameDay(prev, day) ? null : day));
  };

  const handleMonthChange = (month: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), month, 1));
  };

  const handleYearChange = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
  };

  const renderSortArrow = (key: SortKey) => {
    if (key !== sortKey) return <span className="ml-1 text-gray-300">↕</span>;
    return sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
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

      <WorkTableHeader
        currentMonth={currentMonth}
        daysWithWorklogsCount={daysWithWorklogsCount}
        totalHours={totalHours}
      />

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
        <WorkTableContent
          sortedLogs={sortedLogs}
          handleSort={handleSort}
          renderSortArrow={renderSortArrow}
          handleShowRemarks={handleShowRemarks}
        />
      )}
    </div>
  );
}