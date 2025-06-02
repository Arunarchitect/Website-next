"use client";

import { format, parseISO } from "date-fns";
import { useEffect } from "react";
import { UserWorkLog, SortKey } from "@/types/worklogs";

interface WorkTableContentProps {
  sortedLogs: UserWorkLog[];
  handleSort: (key: SortKey) => void;
  renderSortArrow: (key: SortKey) => React.ReactElement;
  handleShowRemarks: (remarks: string | null) => void;
}

const hasValidRemarks = (
  remarks: string | null | undefined
): remarks is string => {
  if (typeof remarks !== "string") return false;
  const str = remarks.trim();
  return str.length > 0 && !["null"].includes(str.toLowerCase());
};

export function WorkTableContent({
  sortedLogs,
  handleSort,
  renderSortArrow,
  handleShowRemarks,
}: WorkTableContentProps) {
  useEffect(() => {
    console.group("[WorkLogs] Data Validation");
    console.table(
      sortedLogs.map((log) => ({
        id: log.id,
        remarks: log.remarks,
        type: typeof log.remarks,
        isValid: hasValidRemarks(log.remarks),
      }))
    );
    console.groupEnd();
  }, [sortedLogs]);

  const formatDurationDisplay = (duration: number | undefined) => {
    if (duration === undefined) {
      return <span className="text-gray-400">N/A</span>;
    }

    const hours = Math.floor(Math.abs(duration) / 60);
    const mins = Math.round(Math.abs(duration) % 60);
    const formatted = `${hours}h ${mins}m`;

    if (duration < 0) {
      return (
        <span className="inline-flex items-center">
          -{formatted}
          <span className="ml-1 text-red-500" title="Negative duration">
            ⚠
          </span>
        </span>
      );
    }
    return formatted;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              onClick={() => handleSort("deliverable")}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            >
              Deliverable {renderSortArrow("deliverable")}
            </th>
            <th
              onClick={() => handleSort("project")}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            >
              Project {renderSortArrow("project")}
            </th>
            <th
              onClick={() => handleSort("start_time")}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            >
              Start Time {renderSortArrow("start_time")}
            </th>
            <th
              onClick={() => handleSort("end_time")}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            >
              End Time {renderSortArrow("end_time")}
            </th>
            <th
              onClick={() => handleSort("duration")}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            >
              Duration {renderSortArrow("duration")}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Remarks
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedLogs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {log.deliverable || <span className="text-gray-400">—</span>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {log.project || <span className="text-gray-400">—</span>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {log.start_time ? (
                  format(parseISO(log.start_time), "PPpp")
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {log.end_time ? (
                  format(parseISO(log.end_time), "PPpp")
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {formatDurationDisplay(log.duration)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {hasValidRemarks(log.remarks) ? (
                  <button
                    onClick={() => handleShowRemarks(log.remarks ?? null)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    View
                  </button>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}