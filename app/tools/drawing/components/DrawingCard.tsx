import { Drawing } from "../types";
import { ActionButton } from "./ActionButton";
import { EyeIcon, DownloadIcon } from "./icons";

interface DrawingCardProps {
  drawing: Drawing;
  onViewDocument: (drawing: Drawing) => void;
  onDownloadPdf: (drawing: Drawing) => void;
  onDownloadSvg: (drawing: Drawing) => void;
}

export const DrawingCard = ({
  drawing,
  onViewDocument,
  onDownloadPdf,
  onDownloadSvg,
}: DrawingCardProps) => {
  const isFileAvailable = (fileType: string): boolean =>
    drawing.available_files?.includes(fileType) ?? false;

  const hasPdf = isFileAvailable("pdf");
  const hasSvg = isFileAvailable("svg");
  const hasPng = isFileAvailable("png");
  const isViewable = hasPng || hasPdf;
  const isConversionComplete = drawing.is_conversion_complete;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-gray-800 mb-1">
                {drawing.drawing_name}
              </h4>
              {drawing.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {drawing.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              {isConversionComplete ? (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Converted
                </span>
              ) : (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Converting...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
            <span>Type: {drawing.original_file_type.toUpperCase()}</span>
            <span>Status: {drawing.status}</span>
            <span>
              Created: {new Date(drawing.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Available files indicator */}
          {drawing.available_files && drawing.available_files.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Available formats:</span>
              <div className="flex gap-1">
                {drawing.available_files.map((fileType) => (
                  <span
                    key={fileType}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded capitalize"
                  >
                    {fileType}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <ActionButton
          onClick={() => onViewDocument(drawing)}
          disabled={!isViewable}
          icon={<EyeIcon className="w-4 h-4" />}
          label="View Document"
          style="blue"
          isAvailable={isViewable}
        />
        <ActionButton
          onClick={() => onDownloadPdf(drawing)}
          disabled={!hasPdf}
          icon={<DownloadIcon className="w-4 h-4" />}
          label="Download PDF"
          style="green"
          isAvailable={hasPdf}
        />
        <ActionButton
          onClick={() => onDownloadSvg(drawing)}
          disabled={!hasSvg}
          icon={<DownloadIcon className="w-4 h-4" />}
          label="Download SVG"
          style="purple"
          isAvailable={hasSvg}
        />
      </div>
    </div>
  );
};