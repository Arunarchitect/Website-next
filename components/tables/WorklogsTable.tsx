"use client";

import { useState, useMemo, useEffect } from "react";
import {
  WorklogsTableProps,
  Worklog,
  EditableWorklog,
  SortKey,
} from "@/types/worklogs";
import { useWorklogsSort } from "@/hooks/work/useWorklogsSort";
import { useCalendarDays } from "@/hooks/work/useCalendarDays";
import { CalendarView } from "@/components/Worklogs/CalendarView";
import { WorklogRow } from "@/components/Worklogs/WorklogRow";
import { RemarksModal } from "@/components/Worklogs/RemarksModal";
import { AttendanceSummary } from "@/components/Worklogs/AttendanceSummary";
import { PaginationControls } from "@/components/Worklogs/PaginationControls";
import { format, parseISO, isSameDay } from "date-fns";
import Spinner from "@/components/common/Spinner";

const getSafeRemarks = (remarks: string | null | undefined): string => {
  return remarks ?? "";
};

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
  const [editableWorklog, setEditableWorklog] =
    useState<EditableWorklog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 10;

  const { sortedWorklogs, requestSort, getSortIcon } = useWorklogsSort();
  const {
    currentMonth,
    calendarDays,
    worklogDates,
    daysWithWorklogsCount,
    selectedDate,
    monthlyWorklogs,
    totalHours,
    prevMonth,
    nextMonth,
    handleDateClick,
    handleMonthChange,
    handleYearChange,
    setSelectedDate,
  } = useCalendarDays({ worklogs });

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const deliverableMap = useMemo(
    () => new Map(deliverables.map((d) => [d.id, d])),
    [deliverables]
  );

  const filteredWorklogs = useMemo(() => {
    if (!selectedDate) return monthlyWorklogs;
    return monthlyWorklogs.filter((worklog) =>
      worklog.startDate ? isSameDay(worklog.startDate, selectedDate) : false
    );
  }, [monthlyWorklogs, selectedDate]);

  useEffect(() => {
    setCurrentPage(1); // Reset pagination when selectedDate changes
  }, [selectedDate]);

  const sorted = sortedWorklogs(
    selectedDate ? filteredWorklogs : monthlyWorklogs,
    projectMap,
    deliverableMap
  );

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedWorklogs = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleFieldChange = <K extends keyof EditableWorklog>(
    field: K,
    value: EditableWorklog[K]
  ) => {
    if (!editableWorklog) return;

    setEditableWorklog({
      ...editableWorklog,
      [field]: value,
    });
  };

  const saveEditing = async () => {
  if (!editableWorklog) return;
  setError(null);

  try {
    if (!editableWorklog.project || !editableWorklog.deliverable) {
      throw new Error("Project and Deliverable are required");
    }

    const updatedWorklog = {
      ...editableWorklog,
      start_time: new Date(editableWorklog.start_time).toISOString(),
      end_time: new Date(editableWorklog.end_time).toISOString(),
      remarks: editableWorklog.remarks || "",
    };

    console.log("Full PUT payload:", JSON.stringify(updatedWorklog, null, 2));
    
    const response = await onUpdate(updatedWorklog);
    console.log("API Response:", response);

    setEditingId(null);
    setEditableWorklog(null);
    refetch();
  } catch (err) {
    console.error("Failed to update worklog:", err);
    setError(err instanceof Error ? err.message : "Failed to update worklog");
  }
};
  const cancelEditing = () => {
    setEditingId(null);
    setEditableWorklog(null);
    setError(null);
  };

  const startEditing = (worklog: Worklog) => {
    const deliverable = deliverableMap.get(worklog.deliverable);

    if (!deliverable) {
      console.error("No deliverable found for worklog:", worklog);
      return;
    }

    const parseIfString = (input: string | Date | null | undefined): Date => {
      if (!input) return new Date();
      return typeof input === "string" ? parseISO(input) : input;
    };

    const safeStartTime = parseIfString(worklog.start_time);
    const safeEndTime = parseIfString(worklog.end_time);

    const initialEditableWorklog: EditableWorklog = {
      id: worklog.id,
      start_time: format(safeStartTime, "yyyy-MM-dd'T'HH:mm"),
      end_time: format(safeEndTime, "yyyy-MM-dd'T'HH:mm"),
      project: deliverable.project,
      deliverable: worklog.deliverable,
      remarks: getSafeRemarks(worklog.remarks),
    };

    setEditingId(worklog.id);
    setEditableWorklog(initialEditableWorklog);
  };

  const handleShowRemarks = (remarks: string | null | undefined) => {
    setCurrentRemarks(getSafeRemarks(remarks));
    setShowRemarksModal(true);
  };

  // Define sortable columns with proper typing
  const sortableColumns: { key: SortKey; label: string }[] = [
    { key: "project", label: "Project" },
    { key: "deliverable", label: "Deliverable" },
    { key: "start_time", label: "Start Time" },
    { key: "end_time", label: "End Time" },
  ];

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

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded">{error}</div>
      )}

      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Worklogs</h2>

      <AttendanceSummary
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
      />

      {selectedDate && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            Showing worklogs for: {format(selectedDate, "MMMM d, yyyy")}
          </div>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear date filter
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {sortableColumns.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => requestSort(key)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                >
                  <div className="flex items-center">
                    {label} {getSortIcon(key)}
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Remarks
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedWorklogs.map((worklog) => (
              <WorklogRow
                key={worklog.id}
                worklog={worklog}
                projects={projects}
                deliverables={deliverables}
                projectMap={projectMap}
                deliverableMap={deliverableMap}
                isEditing={editingId === worklog.id}
                editableWorklog={editableWorklog}
                handleFieldChange={handleFieldChange}
                startEditing={startEditing}
                onDelete={onDelete}
                saveEditing={saveEditing}
                cancelEditing={cancelEditing}
                handleShowRemarks={handleShowRemarks}
              />
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
