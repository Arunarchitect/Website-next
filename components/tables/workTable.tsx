import { useState } from "react";
import { format } from "date-fns";

export interface WorkLog {
  id: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  deliverable: string;
  project: string;
}

interface WorkTableProps {
  worklogs: WorkLog[];
  isError: boolean;
  totalHours: number;
}

type SortKey = keyof Pick<WorkLog, "start_time" | "end_time" | "duration" | "deliverable" | "project">;

export default function WorkTable({ worklogs, isError, totalHours }: WorkTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("start_time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedLogs = [...worklogs].sort((a, b) => {
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

  const renderSortArrow = (key: SortKey) => {
    if (key !== sortKey) return "↕";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Work Logs</h2>
      <div className="mb-4">
        <p className="text-sm text-gray-500">Total Hours Worked</p>
        <p className="text-xl font-semibold text-gray-900">
          {totalHours.toFixed(2)} hours
        </p>
      </div>
      {isError ? (
        <p className="text-red-500">Error loading work logs</p>
      ) : sortedLogs.length === 0 ? (
        <p className="text-gray-500">No work logs found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("start_time")}
                >
                  Start Time {renderSortArrow("start_time")}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("project")}
                >
                  Project {renderSortArrow("project")}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("deliverable")}
                >
                  Deliverable {renderSortArrow("deliverable")}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("end_time")}
                >
                  End Time {renderSortArrow("end_time")}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("duration")}
                >
                  Duration (hours) {renderSortArrow("duration")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(log.start_time), "HH:mm EEE d MMM yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.project}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.deliverable}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.end_time
                      ? format(new Date(log.end_time), "HH:mm EEE d MMM yyyy")
                      : "In progress"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
