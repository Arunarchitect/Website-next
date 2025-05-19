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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
    <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Work Logs</h2>
        
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
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("start_time")}
                >
                  <span className="hidden sm:inline">Start Time</span>
                  <span className="sm:hidden">Start</span> {renderSortArrow("start_time")}
                </th>
                <th
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("project")}
                >
                  Project {renderSortArrow("project")}
                </th>
                <th
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("organisation")}
                >
                  <span className="hidden sm:inline">Organization</span>
                  <span className="sm:hidden">Org</span> {renderSortArrow("organisation")}
                </th>
                <th
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("deliverable")}
                >
                  <span className="hidden sm:inline">Deliverable</span>
                  <span className="sm:hidden">Deliv</span> {renderSortArrow("deliverable")}
                </th>
                <th
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("end_time")}
                >
                  <span className="hidden sm:inline">End Time</span>
                  <span className="sm:hidden">End</span> {renderSortArrow("end_time")}
                </th>
                <th
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort("duration")}
                >
                  <span className="hidden sm:inline">Duration (hours)</span>
                  <span className="sm:hidden">Hours</span> {renderSortArrow("duration")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="hidden sm:inline">
                      {format(new Date(log.start_time), "HH:mm EEE d MMM yyyy")}
                    </span>
                    <span className="sm:hidden">
                      {format(new Date(log.start_time), "HH:mm d MMM")}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-[100px]">
                    {log.project}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-[80px]">
                    {log.organisation}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 truncate max-w-[80px]">
                    {log.deliverable}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="hidden sm:inline">
                      {log.end_time
                        ? format(new Date(log.end_time), "HH:mm EEE d MMM yyyy")
                        : "In progress"}
                    </span>
                    <span className="sm:hidden">
                      {log.end_time
                        ? format(new Date(log.end_time), "HH:mm")
                        : "In prog"}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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