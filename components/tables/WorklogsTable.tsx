"use client";

import { useState, useMemo, useEffect } from "react";
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
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface Project {
  id: number;
  name: string;
}

interface Deliverable {
  id: number;
  name: string;
  project: number;
}

interface Worklog {
  id: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  employee: number;
}

export interface EditableWorklog
  extends Omit<Worklog, "start_time" | "end_time"> {
  start_time: string;
  end_time: string;
  project: number;
}

interface WorklogsTableProps {
  worklogs: Worklog[];
  projects: Project[];
  deliverables: Deliverable[];
  onDelete: (id: number) => void;
  onUpdate: (worklog: EditableWorklog) => Promise<void>;
  refetch: () => void;
  isLoading?: boolean;
}

type SortDirection = "asc" | "desc";
type SortableField = "start_time" | "end_time" | "project" | "deliverable";

export default function WorklogsTable({
  worklogs,
  projects,
  deliverables,
  onDelete,
  onUpdate,
  refetch,
  isLoading = false,
}: WorklogsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editableWorklog, setEditableWorklog] = useState<EditableWorklog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: SortableField;
    direction: SortDirection;
  } | null>({
    key: "start_time",
    direction: "desc",
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const PAGE_SIZE = 10;

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const deliverableMap = useMemo(
    () => new Map(deliverables.map((d) => [d.id, d])),
    [deliverables]
  );

  // Get unique dates with worklogs and count for current month
  const { worklogDates, daysWithWorklogsCount } = useMemo(() => {
    const dates = new Set<string>();
    let count = 0;
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    worklogs.forEach((worklog) => {
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
      ).size,
      worklogCount: count,  // Use count here
    };
  }, [worklogs, currentMonth]);

  // Filter worklogs by selected date
  const filteredWorklogs = useMemo(() => {
    if (!selectedDate) return worklogs;
    return worklogs.filter(worklog => {
      const worklogDate = format(parseISO(worklog.start_time), "yyyy-MM-dd");
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      return worklogDate === selectedDateStr;
    });
  }, [worklogs, selectedDate]);

  // Calendar generation with correct weekday alignment
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
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(day);
    }
    setCurrentPage(1);
  };

  const sortedWorklogs = useMemo(() => {
    const sorted = [...(selectedDate ? filteredWorklogs : worklogs)];
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aValue: string | number = "";
        let bValue: string | number = "";

        if (sortConfig.key === "project") {
          const aDeliverable = deliverableMap.get(a.deliverable);
          const bDeliverable = deliverableMap.get(b.deliverable);
          aValue = aDeliverable
            ? projectMap.get(aDeliverable.project)?.name || ""
            : "";
          bValue = bDeliverable
            ? projectMap.get(bDeliverable.project)?.name || ""
            : "";
        } else if (sortConfig.key === "deliverable") {
          aValue = deliverableMap.get(a.deliverable)?.name || "";
          bValue = deliverableMap.get(b.deliverable)?.name || "";
        } else {
          aValue = new Date(a[sortConfig.key]).getTime();
          bValue = new Date(b[sortConfig.key]).getTime();
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return sortConfig.direction === "asc"
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      });
    }
    return sorted;
  }, [selectedDate, filteredWorklogs, worklogs, sortConfig, deliverableMap, projectMap]);

  const totalPages = Math.ceil(sortedWorklogs.length / PAGE_SIZE);
  const paginatedWorklogs = sortedWorklogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const requestSort = (key: SortableField) => {
    setSortConfig((prev) => {
      if (prev?.key === key && prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key, direction: "asc" };
    });
    setCurrentPage(1);
  };

  const startEditing = (worklog: Worklog) => {
    const deliverable = deliverableMap.get(worklog.deliverable);
    if (!deliverable) return;
    setEditingId(worklog.id);
    setEditableWorklog({
      ...worklog,
      start_time: format(parseISO(worklog.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(worklog.end_time), "yyyy-MM-dd'T'HH:mm"),
      project: deliverable.project,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditableWorklog(null);
  };

  const saveEditing = async () => {
    if (!editableWorklog) return;
    try {
      await onUpdate(editableWorklog);
      refetch();
      cancelEditing();
    } catch (error) {
      console.error("Failed to update worklog:", error);
    }
  };

  const handleFieldChange = (
    field: keyof EditableWorklog,
    value: string | number
  ) => {
    if (!editableWorklog) return;
    if (field === "project") {
      setEditableWorklog({
        ...editableWorklog,
        project: Number(value),
        deliverable: 0,
      });
    } else {
      setEditableWorklog({ ...editableWorklog, [field]: value });
    }
  };

  const getFilteredDeliverables = (projectId: number) => {
    return deliverables.filter((d) => d.project === projectId);
  };

  const getSortIcon = (key: SortableField) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <span className="ml-1 text-gray-300">↑</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [worklogs, selectedDate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Worklogs</h2>

      {/* Attendance Summary Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Monthly Attendance</h3>
            <p className="text-sm text-gray-600">
              {format(currentMonth, "MMMM yyyy")}
            </p>
          </div>
          <div className="flex space-x-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{daysWithWorklogsCount}</p>
              <p className="text-sm text-gray-600">Days Worked</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {calendarDays.filter(day => isSameMonth(day, currentMonth)).length - daysWithWorklogsCount}
              </p>
              <p className="text-sm text-gray-600">Days Leave</p>
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
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 rounded-full hover:bg-gray-100"
              aria-label="Next month"
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
            const isCurrentMonth = isSameMonth(day, currentMonth);
            
            return (
              <button
                key={dateStr}
                onClick={() => isCurrentMonth && handleDateClick(day)}
                className={`h-10 flex items-center justify-center rounded-full text-sm
                  ${isCurrentMonth ? "text-gray-900" : "text-gray-400"}
                  ${hasWorklog && isCurrentMonth ? "bg-blue-100 font-medium" : ""}
                  ${isSameDay(day, new Date()) ? "border border-blue-500" : ""}
                  ${isSelected && isCurrentMonth ? "bg-blue-200 ring-2 ring-blue-400" : ""}
                  ${isCurrentMonth ? "hover:bg-gray-100" : "cursor-default"}
                  transition-colors
                `}
                aria-label={`Day ${format(day, "d")}`}
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
          </div>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filter
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                onClick={() => requestSort("project")}
              >
                <div className="flex items-center">
                  Project {getSortIcon("project")}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                onClick={() => requestSort("deliverable")}
              >
                <div className="flex items-center">
                  Deliverable {getSortIcon("deliverable")}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                onClick={() => requestSort("start_time")}
              >
                <div className="flex items-center">
                  Start Time {getSortIcon("start_time")}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase cursor-pointer"
                onClick={() => requestSort("end_time")}
              >
                <div className="flex items-center">
                  End Time {getSortIcon("end_time")}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedWorklogs.map((worklog) => {
              const deliverable = deliverableMap.get(worklog.deliverable);
              const project = deliverable
                ? projectMap.get(deliverable.project)
                : null;
              const isEditing = editingId === worklog.id;

              return (
                <tr key={worklog.id}>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <select
                        value={editableWorklog?.project || ""}
                        onChange={(e) =>
                          handleFieldChange("project", e.target.value)
                        }
                        className="border rounded p-1"
                      >
                        <option value="">Select Project</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      project?.name || "Invalid Project"
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <select
                        value={editableWorklog?.deliverable || ""}
                        onChange={(e) =>
                          handleFieldChange("deliverable", e.target.value)
                        }
                        className="border rounded p-1"
                        disabled={!editableWorklog?.project}
                      >
                        <option value="">Select Deliverable</option>
                        {editableWorklog?.project &&
                          getFilteredDeliverables(
                            editableWorklog.project
                          ).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      deliverable?.name || "Invalid Deliverable"
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={editableWorklog?.start_time || ""}
                        onChange={(e) =>
                          handleFieldChange("start_time", e.target.value)
                        }
                        className="border rounded p-1"
                      />
                    ) : (
                      format(parseISO(worklog.start_time), "d MMM yyyy EEE h:mm a")
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={editableWorklog?.end_time || ""}
                        onChange={(e) =>
                          handleFieldChange("end_time", e.target.value)
                        }
                        className="border rounded p-1"
                      />
                    ) : (
                      format(parseISO(worklog.end_time), "d MMM yyyy EEE h:mm a ")
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={saveEditing}
                          className="text-green-600 hover:text-green-800"
                          aria-label="Save changes"
                        >
                          <CheckIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-gray-600 hover:text-gray-800"
                          aria-label="Cancel editing"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditing(worklog)}
                          className="text-blue-600 hover:text-blue-800"
                          aria-label="Edit worklog"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onDelete(worklog.id)}
                          className="text-red-600 hover:text-red-800"
                          aria-label="Delete worklog"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <div>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="mx-2 text-sm">{currentPage}</span>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div>
          <span className="text-sm text-gray-500">
            Showing {PAGE_SIZE * (currentPage - 1) + 1} to{" "}
            {Math.min(PAGE_SIZE * currentPage, sortedWorklogs.length)} of{" "}
            {sortedWorklogs.length} entries
          </span>
        </div>
      </div>
    </div>
  );
}