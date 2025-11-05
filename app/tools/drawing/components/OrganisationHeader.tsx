import { FolderIcon } from "./icons";

interface OrganisationHeaderProps {
  organisation: { id: number; name: string };
  accessKey: string;
  onReset: () => void;
}

export const OrganisationHeader = ({
  organisation,
  accessKey,
  onReset,
}: OrganisationHeaderProps) => (
  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-6">
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">
          Organisation: {organisation.name}
        </h3>
        {accessKey && (
          <p className="text-sm text-gray-600 mt-1">Access Key: {accessKey}</p>
        )}
      </div>
      <button
        onClick={onReset}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
      >
        <FolderIcon className="w-4 h-4" />
        New Access Key
      </button>
    </div>
  </div>
);