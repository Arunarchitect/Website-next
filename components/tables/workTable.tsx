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
  getDay,
  addDays,
} from "date-fns";
import { WorkTableProps, SortKey, UserWorkLog } from "@/types/worklogs"; 
import { CalendarView } from "@/components/Worklogs/CalendarView";
import { RemarksModal } from "@/components/Worklogs/RemarksModal";
import { WorkTableFilters } from "@/components/Userworklogs/WorkTableFilters";
import { WorkTableHeader } from "@/components/Userworklogs/WorkTableHeader";
import { WorkTableContent } from "@/components/Userworklogs/WorkTableContent";

export default function WorkTable({
  worklogs: initialWorklogs,
  isError,
  totalHours,
  sortKey: initialSortKey = "start_time",
  sortDirection: initialSortDirection = "desc",
  onSort,
}: WorkTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortDirection);
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

  const organizations = useMemo(
    () => Array.from(new Set(worklogs.map((log) => log.organisation).filter((org): org is string => !!org))),
    [worklogs]
  );

  const orgFilteredLogs = useMemo(() => {
    return selectedOrg === "all"
      ? worklogs
      : worklogs.filter((log) => log.organisation === selectedOrg);
  }, [worklogs, selectedOrg]);

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
    const start = addDays(
      startOfMonth(currentMonth),
      -getDay(startOfMonth(currentMonth))
    );
    const end = addDays(start, 41);
    return eachDayOfInterval({ start, end });
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

  const filteredTotalHours = useMemo(() => {
    return filteredLogs.reduce((acc, log) => acc + (log.duration || 0), 0) / 60;
  }, [filteredLogs]);

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

  const renderSortArrow = (key: SortKey) => {
    if (key !== sortKey) return <span className="ml-1 text-gray-300">↕</span>;
    return sortOrder === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

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
      />
      {selectedDate && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">
            Showing worklogs for: {format(selectedDate, "MMMM d, yyyy")}
            {selectedOrg !== "all" && ` (${selectedOrg})`}
          </div>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filter
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
      <div className="mb-4">
        <p className="text-sm text-gray-500">Total Hours Worked</p>
        <p className="text-xl font-semibold text-gray-900">
          {filteredTotalHours.toFixed(2)} hours
        </p>
      </div>
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