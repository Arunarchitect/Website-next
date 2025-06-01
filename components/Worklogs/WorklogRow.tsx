// WorklogRow.tsx
import { format, parseISO } from "date-fns";
import {
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Worklog,
  EditableWorklog,
  Project,
  Deliverable,
} from "@/types/worklogs";
import { useMemo } from "react";

interface WorklogRowProps {
  worklog: Worklog;
  projects: Project[];
  deliverables: Deliverable[];
  projectMap: Map<number, Project>;
  deliverableMap: Map<number, Deliverable>;
  isEditing: boolean;
  editableWorklog: EditableWorklog | null;
  handleFieldChange: <K extends keyof EditableWorklog>(
    field: K,
    value: EditableWorklog[K]
  ) => void;
  startEditing: (worklog: Worklog) => void;
  onDelete: (id: number) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  handleShowRemarks: (remarks: string | null | undefined) => void;
}

const getSafeRemarks = (remarks: string | null | undefined): string => {
  return remarks ?? "";
};

export const WorklogRow = ({
  worklog,
  projects,
  deliverables,
  projectMap,
  deliverableMap,
  isEditing,
  editableWorklog,
  handleFieldChange,
  startEditing,
  onDelete,
  saveEditing,
  cancelEditing,
  handleShowRemarks,
}: WorklogRowProps) => {
  // Filter deliverables based on selected project
  const filteredDeliverables = useMemo(() => {
    if (!editableWorklog?.project) return [];
    return deliverables.filter((d) => d.project === editableWorklog.project);
  }, [editableWorklog?.project, deliverables]);

  // Get current deliverable and project
  const currentDeliverable = editableWorklog
    ? deliverableMap.get(editableWorklog.deliverable)
    : deliverableMap.get(worklog.deliverable);

  const currentProject = currentDeliverable
    ? projectMap.get(currentDeliverable.project)
    : null;

  const parseIfString = (input: string | Date | null | undefined): Date => {
    if (!input) return new Date();
    return typeof input === "string" ? parseISO(input) : input;
  };

  const formatDateTime = (dateTime: string | Date): string => {
    return format(parseIfString(dateTime), "d MMM yyyy EEE h:mm a");
  };

  return (
    <tr key={worklog.id}>
      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <select
            value={editableWorklog?.project ?? ""}
            onChange={(e) => {
              const projectId = Number(e.target.value);
              handleFieldChange("project", projectId);
            }}
            className="border rounded p-1 w-full"
            required
          >
            <option value="">Select Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          currentProject?.name || "Invalid Project"
        )}
      </td>

      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <select
            value={editableWorklog?.deliverable ?? ""}
            onChange={(e) =>
              handleFieldChange("deliverable", Number(e.target.value))
            }
            className="border rounded p-1 w-full"
            disabled={!editableWorklog?.project}
            required
          >
            <option value="">Select Deliverable</option>
            {filteredDeliverables.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          currentDeliverable?.name ||
          worklog.deliverable_name ||
          "Invalid Deliverable"
        )}
      </td>

      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <input
            type="datetime-local"
            value={editableWorklog?.start_time || ""}
            onChange={(e) => {
              console.log("Start time changed to:", e.target.value);
              handleFieldChange("start_time", e.target.value);
            }}
            className="border rounded p-1 w-full"
            required
          />
        ) : (
          formatDateTime(worklog.start_time)
        )}
      </td>

      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <input
            type="datetime-local"
            value={editableWorklog?.end_time || ""}
            onChange={(e) => {
              console.log("End time changed to:", e.target.value);
              handleFieldChange("end_time", e.target.value);
            }}
            className="border rounded p-1 w-full"
            required
          />
        ) : (
          formatDateTime(worklog.end_time)
        )}
      </td>

      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
        {isEditing ? (
          <textarea
            value={editableWorklog?.remarks || ""}
            onChange={(e) => handleFieldChange("remarks", e.target.value)}
            className="border rounded p-1 w-full"
            rows={2}
            placeholder="Add remarks..."
          />
        ) : worklog.remarks ? (
          <button
            onClick={() => handleShowRemarks(getSafeRemarks(worklog.remarks))}
            className="text-left hover:text-blue-600 w-full"
          >
            {worklog.remarks.length > 50
              ? `${worklog.remarks.substring(0, 50)}...`
              : worklog.remarks}
          </button>
        ) : (
          <span className="text-gray-400">No remarks</span>
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
              onClick={() => {
                console.log("Starting to edit worklog:", worklog.id);
                startEditing(worklog);
              }}
              className="text-blue-600 hover:text-blue-800"
              aria-label="Edit worklog"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                console.log("Deleting worklog:", worklog.id);
                onDelete(worklog.id);
              }}
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
};