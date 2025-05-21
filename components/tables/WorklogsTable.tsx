import { useState, useMemo } from "react";
import { WorklogsTableProps, Worklog, EditableWorklog } from "@/types/worklogs";
import { useWorklogsSort } from "@/hooks/work/useWorklogsSort";
import { useCalendarDays } from "@/hooks/work/useCalendarDays";
import { CalendarView } from "@/components/Worklogs/CalendarView";
import { WorklogRow } from "@/components/Worklogs/WorklogRow";
import { RemarksModal } from "@/components/Worklogs/RemarksModal";
import { AttendanceSummary } from "@/components/Worklogs/AttendanceSummary";
import { PaginationControls } from "@/components/Worklogs/PaginationControls";
import { format, parseISO } from "date-fns";

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
    prevMonth,
    nextMonth,
    handleDateClick,
    setSelectedDate
  } = useCalendarDays(worklogs);

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const deliverableMap = useMemo(
    () => new Map(deliverables.map((d) => [d.id, d])),
    [deliverables]
  );

  // Filter worklogs by selected date
  const filteredWorklogs = useMemo(() => {
    if (!selectedDate) return worklogs;
    return worklogs.filter(worklog => {
      const worklogDate = format(parseISO(worklog.start_time), "yyyy-MM-dd");
      const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
      return worklogDate === selectedDateStr;
    });
  }, [worklogs, selectedDate]);

  const sorted = sortedWorklogs(selectedDate ? filteredWorklogs : worklogs, projectMap, deliverableMap);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedWorklogs = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const startEditing = (worklog: Worklog) => {
    const deliverable = deliverableMap.get(worklog.deliverable);
    if (!deliverable) return;
    setEditingId(worklog.id);
    setEditableWorklog({
      ...worklog,
      start_time: format(parseISO(worklog.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(worklog.end_time), "yyyy-MM-dd'T'HH:mm"),
      project: deliverable.project,
      remarks: worklog.remarks || "",
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

  const handleShowRemarks = (remarks: string) => {
    setCurrentRemarks(remarks);
    setShowRemarksModal(true);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <RemarksModal
        show={showRemarksModal}
        onClose={() => setShowRemarksModal(false)}
        remarks={currentRemarks}
      />

      <h2 className="text-2xl text-gray-700 font-semibold mb-4">Worklogs</h2>

      <AttendanceSummary
        currentMonth={currentMonth}
        daysWithWorklogsCount={daysWithWorklogsCount}
        calendarDays={calendarDays}
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
                Remarks
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
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