"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

interface Worklog {
  id: number;
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  employee: number;
}

interface EditableWorklog extends Omit<Worklog, "start_time" | "end_time"> {
  start_time: string;
  end_time: string;
}

interface WorklogsTableProps {
  worklogs: Worklog[];
  projects: { id: number; name: string }[];
  deliverables: { id: number; name: string }[];
  onDelete: (id: number) => void;
  onUpdate: (worklog: EditableWorklog) => Promise<void>;
  refetch: () => void;
}

type SortDirection = 'asc' | 'desc';
type SortableField = 'start_time' | 'end_time';

export default function WorklogsTable({
  worklogs,
  projects,
  deliverables,
  onDelete,
  onUpdate,
  refetch,
}: WorklogsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editableWorklog, setEditableWorklog] = useState<EditableWorklog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: SortableField;
    direction: SortDirection;
  } | null>(null);

  const PAGE_SIZE = 10;

  const sortedWorklogs = useMemo(() => {
    let sorted = [...worklogs];
    
    if (sortConfig !== null) {
      sorted.sort((a, b) => {
        const aValue = new Date(a[sortConfig.key]).getTime();
        const bValue = new Date(b[sortConfig.key]).getTime();
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return sorted;
  }, [worklogs, sortConfig]);

  const totalPages = Math.ceil(sortedWorklogs.length / PAGE_SIZE);
  const paginatedWorklogs = sortedWorklogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const requestSort = (key: SortableField) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleEdit = (worklog: Worklog) => {
    setEditingId(worklog.id);
    setEditableWorklog({
      ...worklog,
      start_time: format(parseISO(worklog.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(parseISO(worklog.end_time), "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditableWorklog(null);
  };

  const handleSaveEdit = async () => {
    if (!editableWorklog) return;

    try {
      await onUpdate(editableWorklog);
      refetch();
      setEditingId(null);
      setEditableWorklog(null);
    } catch (err) {
      console.error("Failed to update worklog:", err);
    }
  };

  const handleFieldChange = (
    field: keyof EditableWorklog,
    value: string | number
  ) => {
    if (!editableWorklog) return;
    setEditableWorklog({
      ...editableWorklog,
      [field]: value,
    });
  };

  const getProjectName = (id: number) =>
    projects.find((p) => p.id === id)?.name || "Unknown";
  const getDeliverableName = (id: number) =>
    deliverables.find((d) => d.id === id)?.name || "Unknown";

  const getSortIcon = (key: SortableField) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronUpIcon className="h-4 w-4 opacity-0" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4" />
    ) : (
      <ChevronDownIcon className="h-4 w-4" />
    );
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4">Your Worklogs</h2>
      {worklogs.length === 0 ? (
        <p className="text-gray-500">No worklogs found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deliverable
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('start_time')}
                >
                  <div className="flex items-center">
                    Start Time
                    <span className="ml-1">
                      {getSortIcon('start_time')}
                    </span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => requestSort('end_time')}
                >
                  <div className="flex items-center">
                    End Time
                    <span className="ml-1">
                      {getSortIcon('end_time')}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedWorklogs.map((worklog) => (
                <tr key={worklog.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingId === worklog.id ? (
                      <select
                        value={editableWorklog?.project || ""}
                        onChange={(e) =>
                          handleFieldChange("project", Number(e.target.value))
                        }
                        className="border rounded p-1"
                      >
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getProjectName(worklog.project)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingId === worklog.id ? (
                      <select
                        value={editableWorklog?.deliverable || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            "deliverable",
                            Number(e.target.value)
                          )
                        }
                        className="border rounded p-1"
                      >
                        {deliverables.map((deliverable) => (
                          <option key={deliverable.id} value={deliverable.id}>
                            {deliverable.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getDeliverableName(worklog.deliverable)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingId === worklog.id ? (
                      <input
                        type="datetime-local"
                        value={editableWorklog?.start_time || ""}
                        onChange={(e) =>
                          handleFieldChange("start_time", e.target.value)
                        }
                        className="border rounded p-1"
                      />
                    ) : (
                      format(parseISO(worklog.start_time), "PPpp")
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingId === worklog.id ? (
                      <input
                        type="datetime-local"
                        value={editableWorklog?.end_time || ""}
                        onChange={(e) =>
                          handleFieldChange("end_time", e.target.value)
                        }
                        className="border rounded p-1"
                      />
                    ) : (
                      format(parseISO(worklog.end_time), "PPpp")
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editingId === worklog.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="text-green-600 hover:text-green-900"
                          title="Save"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-600 hover:text-red-900"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(worklog)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => onDelete(worklog.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Previous
              </button>
              <div className="flex space-x-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-md ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}