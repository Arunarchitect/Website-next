"use client";

import { useState, useMemo, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
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

export interface EditableWorklog extends Omit<Worklog, "start_time" | "end_time"> {
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
  } | null>(null);

  const PAGE_SIZE = 10;

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const deliverableMap = useMemo(() => new Map(deliverables.map((d) => [d.id, d])), [deliverables]);

  const sortedWorklogs = useMemo(() => {
    const sorted = [...worklogs];
    if (sortConfig) {
      sorted.sort((a, b) => {
        let aValue: string | number = "";
        let bValue: string | number = "";

        if (sortConfig.key === "project") {
          const aDeliverable = deliverableMap.get(a.deliverable);
          const bDeliverable = deliverableMap.get(b.deliverable);
          aValue = aDeliverable ? (projectMap.get(aDeliverable.project)?.name || "") : "";
          bValue = bDeliverable ? (projectMap.get(bDeliverable.project)?.name || "") : "";
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
  }, [worklogs, sortConfig, deliverableMap, projectMap]);

  const totalPages = Math.ceil(sortedWorklogs.length / PAGE_SIZE);
  const paginatedWorklogs = sortedWorklogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  const handleFieldChange = (field: keyof EditableWorklog, value: string | number) => {
    if (!editableWorklog) return;
    if (field === "project") {
      setEditableWorklog({ ...editableWorklog, project: Number(value), deliverable: 0 });
    } else {
      setEditableWorklog({ ...editableWorklog, [field]: value });
    }
  };

  const getFilteredDeliverables = (projectId: number) => {
    return deliverables.filter((d) => d.project === projectId);
  };

  const getSortIcon = (key: SortableField) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <span className="ml-1 text-gray-300">↑</span>; // Invisible placeholder
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [worklogs]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Worklogs</h2>

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
              const project = deliverable ? projectMap.get(deliverable.project) : null;
              const isEditing = editingId === worklog.id;

              return (
                <tr key={worklog.id}>
                  {/* Project */}
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <select
                        value={editableWorklog?.project || ""}
                        onChange={(e) => handleFieldChange("project", e.target.value)}
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

                  {/* Deliverable */}
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <select
                        value={editableWorklog?.deliverable || ""}
                        onChange={(e) => handleFieldChange("deliverable", e.target.value)}
                        className="border rounded p-1"
                      >
                        <option value="">Select Deliverable</option>
                        {editableWorklog?.project &&
                          getFilteredDeliverables(editableWorklog.project).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      deliverable?.name || "Invalid Deliverable"
                    )}
                  </td>

                  {/* Start Time */}
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={editableWorklog?.start_time || ""}
                        onChange={(e) => handleFieldChange("start_time", e.target.value)}
                        className="border rounded p-1"
                      />
                    ) : (
                      format(parseISO(worklog.start_time), "PPpp")
                    )}
                  </td>

                  {/* End Time */}
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={editableWorklog?.end_time || ""}
                        onChange={(e) => handleFieldChange("end_time", e.target.value)}
                        className="border rounded p-1"
                      />
                    ) : (
                      format(parseISO(worklog.end_time), "PPpp")
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 flex space-x-2">
                    {isEditing ? (
                      <>
                        <button onClick={saveEditing} className="text-green-600 hover:text-green-900" title="Save">
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button onClick={cancelEditing} className="text-gray-600 hover:text-gray-900" title="Cancel">
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditing(worklog)} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button onClick={() => onDelete(worklog.id)} className="text-red-600 hover:text-red-900" title="Delete">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Previous
            </button>
            <div>Page {currentPage} of {totalPages}</div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
