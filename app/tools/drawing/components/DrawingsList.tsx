import { Drawing, Deliverable } from "../types";
import { SectionTitle } from "./SectionTitle";
import { DrawingIcon } from "./icons";
import { DrawingCard } from "./DrawingCard";
import { LoadingState } from "./LoadingState";

interface DrawingsListProps {
  drawings: Drawing[];
  selectedDeliverable: Deliverable;
  onViewDocument: (drawing: Drawing) => void;
  onDownloadPdf: (drawing: Drawing) => void;
  onDownloadSvg: (drawing: Drawing) => void;
  isLoading?: boolean;
}

export const DrawingsList = ({
  drawings,
  selectedDeliverable,
  onViewDocument,
  onDownloadPdf,
  onDownloadSvg,
  isLoading = false,
}: DrawingsListProps) => (
  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
    <SectionTitle
      icon={<DrawingIcon className="w-5 h-5" />}
      title={`Documents for ${selectedDeliverable.name}`}
    />

    {isLoading ? (
      <LoadingState message="Loading drawings..." />
    ) : drawings.length === 0 ? (
      <div className="text-center py-8 text-gray-500">
        No drawings found for this deliverable.
      </div>
    ) : (
      <div className="space-y-4">
        {drawings.map((drawing) => (
          <DrawingCard
            key={drawing.id}
            drawing={drawing}
            onViewDocument={onViewDocument}
            onDownloadPdf={onDownloadPdf}
            onDownloadSvg={onDownloadSvg}
          />
        ))}
      </div>
    )}
  </div>
);