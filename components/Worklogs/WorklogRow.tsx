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
  onDelete: (id: number) => Promise<void>;
  saveEditing: () => Promise<void>;
  cancelEditing: () => void;
  handleShowRemarks: (remarks: string | null | undefined) => void;
}

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
  const filteredDeliverables = useMemo(() => {
    if (!editableWorklog?.project) return [];
    return deliverables.filter((d) => d.project === editableWorklog.project);
  }, [editableWorklog?.project, deliverables]);

  const currentDeliverable = editableWorklog
    ? deliverableMap.get(editableWorklog.deliverable)
    : deliverableMap.get(worklog.deliverable);

  const currentProject = currentDeliverable
    ? projectMap.get(currentDeliverable.project)
    : null;

  const formatDateTime = (dateTime: string | Date): string => {
    const date = typeof dateTime === 'string' ? parseISO(dateTime) : dateTime;
    return format(date, "d MMM yyyy EEE h:mm a");
  };

  return (
    <tr key={worklog.id}>
      {/* Project Cell */}
      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <select
            value={editableWorklog?.project ?? ""}
            onChange={(e) => handleFieldChange("project", Number(e.target.value))}
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

      {/* Deliverable Cell */}
      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <select
            value={editableWorklog?.deliverable ?? ""}
            onChange={(e) => handleFieldChange("deliverable", Number(e.target.value))}
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
          currentDeliverable?.name || "Invalid Deliverable"
        )}
      </td>

      {/* Start Time Cell */}
      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <input
            type="datetime-local"
            value={editableWorklog?.start_time || ""}
            onChange={(e) => handleFieldChange("start_time", e.target.value)}
            className="border rounded p-1 w-full"
            required
          />
        ) : (
          formatDateTime(worklog.start_time)
        )}
      </td>

      {/* End Time Cell */}
      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <input
            type="datetime-local"
            value={editableWorklog?.end_time || ""}
            onChange={(e) => handleFieldChange("end_time", e.target.value)}
            className="border rounded p-1 w-full"
            required
          />
        ) : (
          formatDateTime(worklog.end_time)
        )}
      </td>

      {/* Remarks Cell */}
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
            onClick={() => handleShowRemarks(worklog.remarks)}
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

      {/* Actions Cell */}
      <td className="px-6 py-4 text-sm text-gray-700">
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
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
            </>
          ) : (
            <>
              <button
                onClick={() => startEditing(worklog)}
                className="text-blue-600 hover:text-blue-800"
                aria-label="Edit worklog"
              >
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(worklog.id)}
                className="text-red-600 hover:text-red-800"
                aria-label="Delete worklog"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};