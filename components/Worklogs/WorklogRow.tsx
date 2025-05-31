import { format, parseISO } from "date-fns";
import { PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Worklog, EditableWorklog, Project, Deliverable } from "@/types/worklogs";

interface WorklogRowProps {
  worklog: Worklog;
  projects: Project[];
  deliverables: Deliverable[];
  projectMap: Map<number, Project>;
  deliverableMap: Map<number, Deliverable>;
  isEditing: boolean;
  editableWorklog: EditableWorklog | null;
  handleFieldChange: (field: keyof EditableWorklog, value: string | number) => void;
  startEditing: (worklog: Worklog) => void;
  onDelete: (id: number) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  handleShowRemarks: (remarks: string) => void;
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
  handleShowRemarks
}: WorklogRowProps) => {
  const deliverable = deliverableMap.get(worklog.deliverable);
  const project = deliverable ? projectMap.get(deliverable.project) : null;

  const getFilteredDeliverables = (projectId: number) => {
    return deliverables.filter((d) => d.project === projectId);
  };

  return (
    <tr key={worklog.id}>
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

      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <select
            value={editableWorklog?.deliverable || ""}
            onChange={(e) => handleFieldChange("deliverable", e.target.value)}
            className="border rounded p-1"
            disabled={!editableWorklog?.project}
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

      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <input
            type="datetime-local"
            value={editableWorklog?.start_time || ""}
            onChange={(e) => handleFieldChange("start_time", e.target.value)}
            className="border rounded p-1"
          />
        ) : (
          format(parseISO(worklog.start_time), "d MMM yyyy EEE h:mm a")
        )}
      </td>

      <td className="px-6 py-4 text-sm text-gray-700">
        {isEditing ? (
          <input
            type="datetime-local"
            value={editableWorklog?.end_time || ""}
            onChange={(e) => handleFieldChange("end_time", e.target.value)}
            className="border rounded p-1"
          />
        ) : (
          format(parseISO(worklog.end_time), "d MMM yyyy EEE h:mm a ")
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
            onClick={() => handleShowRemarks(worklog.remarks || "")}
            className="text-left hover:text-blue-600"
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
          </div>
        )}
      </td>
    </tr>
  );
};