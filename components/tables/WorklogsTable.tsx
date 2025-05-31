"use client";

import { useState, useMemo } from "react";
import { WorklogsTableProps, Worklog, EditableWorklog } from "@/types/worklogs";
import { useWorklogsSort } from "@/hooks/work/useWorklogsSort";
import { useCalendarDays } from "@/hooks/work/useCalendarDays";
import { CalendarView } from "@/components/Worklogs/CalendarView";
import { WorklogRow } from "@/components/Worklogs/WorklogRow";
import { RemarksModal } from "@/components/Worklogs/RemarksModal";
import { AttendanceSummary } from "@/components/Worklogs/AttendanceSummary";
import { PaginationControls } from "@/components/Worklogs/PaginationControls";
import { format, parseISO, isSameDay, differenceInMinutes } from "date-fns";
import Spinner from "@/components/common/Spinner";

const getSafeRemarks = (remarks: string | null | undefined): string => {
  return remarks ?? "";
};

interface WorklogsTableEnhancedProps extends WorklogsTableProps {
  selectedDate?: Date | null;
  monthlyWorklogs?: Worklog[];
}

export default function WorklogsTable({
  worklogs,
  projects,
  deliverables,
  onDelete,
  onUpdate,
  refetch,
  isLoading = false,
}: WorklogsTableEnhancedProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editableWorklog, setEditableWorklog] = useState<EditableWorklog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [currentRemarks, setCurrentRemarks] = useState("");

  const PAGE_SIZE = 10;

  const { sortedWorklogs, requestSort, getSortIcon } = useWorklogsSort();
  const {
    currentMonth,
    calendarDays,
    worklogDates,
    daysWithWorklogsCount,
    selectedDate,
    monthlyWorklogs = [],
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
    if (!selectedDate) return worklogs;

    return worklogs.filter((worklog) => {
      if (!worklog.start_time) return false;
      try {
        const worklogDate = parseISO(worklog.start_time);
        return isSameDay(worklogDate, selectedDate);
      } catch {
        return false;
      }
    });
  }, [worklogs, selectedDate]);

  const calculateTotalHours = (logs: Worklog[]): number => {
    if (!logs || logs.length === 0) return 0;
    
    return logs.reduce((total, worklog) => {
      if (!worklog.start_time || !worklog.end_time) return total;
      
      try {
        const duration = differenceInMinutes(
          parseISO(worklog.end_time),
          parseISO(worklog.start_time)
        ) / 60;
        return total + duration;
      } catch {
        return total;
      }
    }, 0);
  };

  const sorted = sortedWorklogs(
    selectedDate ? filteredWorklogs : worklogs,
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
    try {
      await onUpdate(editableWorklog);
      setEditingId(null);
      setEditableWorklog(null);
      refetch();
    } catch (error) {
      console.error("Failed to update worklog:", error);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditableWorklog(null);
  };

  const startEditing = (worklog: Worklog) => {
    const deliverable = deliverableMap.get(worklog.deliverable);
    if (!deliverable) return;

    const safeStartTime = worklog.start_time
      ? parseISO(worklog.start_time)
      : new Date();
    const safeEndTime = worklog.end_time
      ? parseISO(worklog.end_time)
      : new Date();

    setEditingId(worklog.id);
    setEditableWorklog({
      id: worklog.id,
      start_time: format(safeStartTime, "yyyy-MM-dd'T'HH:mm"),
      end_time: format(safeEndTime, "yyyy-MM-dd'T'HH:mm"),
      project: deliverable.project,
      deliverable: worklog.deliverable,
      remarks: getSafeRemarks(worklog.remarks),
    });
  };

  const handleShowRemarks = (remarks: string | null | undefined) => {
    setCurrentRemarks(getSafeRemarks(remarks));
    setShowRemarksModal(true);
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
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Worklogs</h2>

      <AttendanceSummary
        currentMonth={currentMonth}
        daysWithWorklogsCount={daysWithWorklogsCount}
        calendarDays={calendarDays}
        totalHours={calculateTotalHours(monthlyWorklogs)}
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
              <th
                onClick={() => requestSort("project")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center">
                  Project {getSortIcon("project")}
                </div>
              </th>
              <th
                onClick={() => requestSort("deliverable")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center">
                  Deliverable {getSortIcon("deliverable")}
                </div>
              </th>
              <th
                onClick={() => requestSort("start_time")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center">
                  Start Time {getSortIcon("start_time")}
                </div>
              </th>
              <th
                onClick={() => requestSort("end_time")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              >
                <div className="flex items-center">
                  End Time {getSortIcon("end_time")}
                </div>
              </th>
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