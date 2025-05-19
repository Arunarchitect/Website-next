import { useState } from "react";
import { format } from "date-fns";

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

  // Filter worklogs by selected organization
  const filteredLogs = selectedOrg === "all" 
    ? worklogs 
    : worklogs.filter(log => log.organisation === selectedOrg);

  const sortedLogs = [...filteredLogs].sort((a, b) => {
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

  // Calculate filtered total hours
  const filteredTotalHours = filteredLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

  const renderSortArrow = (key: SortKey) => {
    if (key !== sortKey) return "↕";
    return sortOrder === "asc" ? "↑" : "↓";
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Work Logs</h2>
        <div className="flex gap-4">
          <div>
            <label className="sr-only">Filter by organization</label>
            <div className="flex gap-2">
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
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500">Total Hours Worked</p>
        <p className="text-xl font-semibold text-gray-900">
          {filteredTotalHours.toFixed(2)} hours
          {selectedOrg !== "all" && (
            <span className="text-sm text-gray-500 ml-2">
              (out of {totalHours.toFixed(2)} total)
            </span>
          )}
        </p>
      </div>

      {isError ? (
        <p className="text-red-500">Error loading work logs</p>
      ) : sortedLogs.length === 0 ? (
        <p className="text-gray-500">No work logs found{selectedOrg !== "all" ? " for this organization" : ""}</p>
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
                  onClick={() => handleSort("organisation")}
                >
                  Organization {renderSortArrow("organisation")}
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
                    {log.organisation}
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
