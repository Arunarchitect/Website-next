import { XMarkIcon } from "@heroicons/react/24/outline";

interface RemarksModalProps {
  show: boolean;
  onClose: () => void;
  remarks: string;
}

export const RemarksModal = ({ show, onClose, remarks }: RemarksModalProps) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Remarks</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="whitespace-pre-wrap">
          {remarks || "No remarks available"}
        </div>
      </div>
    </div>
  );
};