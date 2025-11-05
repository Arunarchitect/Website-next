import { Deliverable, Project } from "../types";
import { SectionTitle } from "./SectionTitle";
import { DocumentIcon, ChevronRightIcon } from "./icons";
import { LoadingState } from "./LoadingState";

interface DeliverablesListProps {
  deliverables: Deliverable[];
  selectedDeliverable: Deliverable | null;
  selectedProject: Project;
  onDeliverableSelect: (deliverable: { id: number }) => void; // Accept minimal object
  isLoading: boolean;
}

export const DeliverablesList = ({
  deliverables,
  selectedDeliverable,
  selectedProject,
  onDeliverableSelect,
  isLoading = false,
}: DeliverablesListProps) => (
  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
    <SectionTitle
      icon={<DocumentIcon className="w-5 h-5" />}
      title={`Select Deliverable for ${selectedProject.name}`}
    />

    {isLoading ? (
      <LoadingState message="Loading deliverables..." />
    ) : deliverables.length === 0 ? (
      <div className="text-center py-8 text-gray-500">
        No deliverables with drawings found for this project.
      </div>
    ) : (
      <div className="space-y-3">
        {deliverables.map((deliverable) => (
          <button
            key={deliverable.id}
            onClick={() => onDeliverableSelect(deliverable)}
            className={`w-full p-4 text-left rounded-lg border transition-all ${
              selectedDeliverable?.id === deliverable.id
                ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">
                  {deliverable.name}
                </h4>
                {deliverable.remarks && (
                  <p className="text-sm text-gray-600">
                    {deliverable.remarks}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {deliverable.drawing_count || 0} drawing(s) • Deliverable ID:{" "}
                  {deliverable.id}
                </p>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);