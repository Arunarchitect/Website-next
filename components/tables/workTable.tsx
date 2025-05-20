"use client";

import { useState, useMemo } from "react";
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  getDay,
  addDays
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export interface WorkLog {
  id: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  deliverable: string;
  project: string;
  organisation: string;
}

interface WorkTableProps {
  worklogs: WorkLog[];
  isError: boolean;
  totalHours: number;
}

type SortKey = keyof Pick<WorkLog, "start_time" | "end_time" | "duration" | "deliverable" | "project" | "organisation">;

export default function WorkTable({ worklogs, isError, totalHours }: WorkTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("start_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // Get unique organizations for filter button group
  const organizations = Array.from(new Set(worklogs.map(log => log.organisation)));

  // Get organization-filtered worklogs
  const orgFilteredLogs = useMemo(() => {
    return selectedOrg === "all" 
      ? worklogs 
      : worklogs.filter(log => log.organisation === selectedOrg);
  }, [worklogs, selectedOrg]);

  // Get unique dates with worklogs and count for current month - now organization-aware
  const { worklogDates, daysWithWorklogsCount } = useMemo(() => {
    const dates = new Set<string>();
    let count = 0;
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    orgFilteredLogs.forEach((worklog) => {
      const date = parseISO(worklog.start_time);
      const dateStr = format(date, "yyyy-MM-dd");
      dates.add(dateStr);
      
      if (date >= monthStart && date <= monthEnd) {
        count++;
      }
    });
    
    return {
      worklogDates: dates,
      daysWithWorklogsCount: new Set(
        Array.from(dates).filter(dateStr => {
          const date = parseISO(dateStr);
          return date >= monthStart && date <= monthEnd;
        })
      ).size
    };
  }, [orgFilteredLogs, currentMonth]);

  // Calendar generation - fixed to show correct weekday alignment
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Get the day of week for the first day of month (0 = Sunday, 6 = Saturday)
    const startDay = getDay(monthStart);
    
    // Calculate days from previous month to show
    const daysFromPrevMonth = startDay; // For Sunday-start week
    
    // Create the calendar grid including days from previous and next month
    const startDate = addDays(monthStart, -daysFromPrevMonth);
    const daysNeeded = 42; // 6 weeks
    const daysInMonth = monthEnd.getDate();
    const daysFromNextMonth = daysNeeded - daysFromPrevMonth - daysInMonth;
    const endDate = addDays(monthEnd, daysFromNextMonth);
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
    setSelectedDate(null);
  };
  
  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (day: Date) => {
    if (isSameDay(day, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(day);
    }
  };

  // Filter worklogs by selected organization and date
  const filteredLogs = useMemo(() => {
    let logs = orgFilteredLogs;

    if (selectedDate) {
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      logs = logs.filter(log => {
        const logDate = format(parseISO(log.start_time), "yyyy-MM-dd");
        return logDate === selectedDateStr;
      });
    }

    return logs;
  }, [orgFilteredLogs, selectedDate]);

  const sortedLogs = useMemo(() => {
    const logs = [...filteredLogs].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null) return 1;
      if (bVal === null) return -1;

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
    return logs;
  }, [filteredLogs, sortKey, sortOrder]);

  // Calculate filtered total hours
  const filteredTotalHours = filteredLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
  const orgTotalHours = orgFilteredLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

  const renderSortArrow = (key: SortKey) => {
    if (key !== sortKey) return <span className="ml-1 text-gray-300">↕</span>;
    return sortOrder === "asc" ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Work Logs</h2>

      {/* Attendance Summary Section - now organization-aware */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Monthly Attendance</h3>
            <p className="text-sm text-gray-600">
              {format(currentMonth, "MMMM yyyy")}
              {selectedOrg !== "all" && ` (${selectedOrg})`}
            </p>
          </div>
          <div className="flex space-x-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{daysWithWorklogsCount}</p>
              <p className="text-sm text-gray-600">Days with logs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {calendarDays.filter(day => isSameMonth(day, currentMonth)).length - daysWithWorklogsCount}
              </p>
              <p className="text-sm text-gray-600">Days without logs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Component */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={prevMonth}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded-full hover:bg-gray-100"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const hasWorklog = worklogDates.has(dateStr);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <button
                key={dateStr}
                onClick={() => handleDateClick(day)}
                className={`h-10 flex items-center justify-center rounded-full text-sm
                  ${isSameMonth(day, currentMonth) ? "text-gray-900" : "text-gray-400"}
                  ${hasWorklog ? "bg-blue-100 font-medium" : ""}
                  ${isSameDay(day, new Date()) ? "border border-blue-500" : ""}
                  ${isSelected ? "bg-blue-200 ring-2 ring-blue-400" : ""}
                  hover:bg-gray-100 transition-colors
                `}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Filter Indicator */}
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="sm:hidden px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
          {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        
        {/* Desktop filter buttons */}
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => setSelectedOrg("all")}
            className={`px-4 py-2 rounded-lg text-sm ${selectedOrg === "all" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"}`}
          >
            All Organizations
          </button>
          {organizations.map(org => (
            <button
              key={org}
              onClick={() => setSelectedOrg(org)}
              className={`px-4 py-2 rounded-lg text-sm ${selectedOrg === org ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"}`}
            >
              {org}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile filter dropdown */}
      {showMobileFilters && (
        <div className="sm:hidden mb-4 bg-gray-50 p-3 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Organization</label>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Organizations</option>
            {organizations.map(org => (
              <option key={org} value={org}>{org}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-500">Total Hours Worked</p>
        <p className="text-xl font-semibold text-gray-900">
          {filteredTotalHours.toFixed(2)} hours
          {selectedOrg !== "all" ? (
            <span className="text-sm text-gray-500 ml-2">
              (out of {orgTotalHours.toFixed(2)} org total)
            </span>
          ) : (
            <span className="text-sm text-gray-500 ml-2">
              (out of {totalHours.toFixed(2)} total)
            </span>
          )}
        </p>
      </div>

      {isError ? (
        <p className="text-red-500">Error loading work logs</p>
      ) : sortedLogs.length === 0 ? (
        <p className="text-gray-500">No work logs found{selectedOrg !== "all" ? ` for ${selectedOrg}` : ""}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                  onClick={() => handleSort("start_time")}
                >
                  <div className="flex items-center">
                    Start Time {renderSortArrow("start_time")}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                  onClick={() => handleSort("project")}
                >
                  <div className="flex items-center">
                    Project {renderSortArrow("project")}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                  onClick={() => handleSort("organisation")}
                >
                  <div className="flex items-center">
                    Organization {renderSortArrow("organisation")}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                  onClick={() => handleSort("deliverable")}
                >
                  <div className="flex items-center">
                    Deliverable {renderSortArrow("deliverable")}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                  onClick={() => handleSort("end_time")}
                >
                  <div className="flex items-center">
                    End Time {renderSortArrow("end_time")}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                  onClick={() => handleSort("duration")}
                >
                  <div className="flex items-center">
                    Duration (hours) {renderSortArrow("duration")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {format(new Date(log.start_time), "d MMM yyyy EEE h:mm a")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[100px]">
                    {log.project}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[80px]">
                    {log.organisation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate max-w-[80px]">
                    {log.deliverable}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {log.end_time
                      ? format(new Date(log.end_time), "d MMM yyyy EEE h:mm a")
                      : "In progress"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {log.duration?.toFixed(2) ?? "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}