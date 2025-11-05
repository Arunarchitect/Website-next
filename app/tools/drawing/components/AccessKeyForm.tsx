import { KeyIcon, ArrowRightIcon } from "./icons";
import { Spinner } from "./LoadingState";

interface AccessKeyFormProps {
  accessKey: string;
  isLoading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onAccessKeyChange: (value: string) => void;
}

export const AccessKeyForm = ({
  accessKey,
  isLoading,
  error,
  onSubmit,
  onAccessKeyChange,
}: AccessKeyFormProps) => (
  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mb-8">
    <div className="flex items-center mb-5">
      <div className="bg-blue-100 p-3 rounded-lg mr-4">
        <KeyIcon className="w-6 h-6 text-blue-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800">Enter Access Key</h2>
    </div>

    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Enter your access key"
          value={accessKey}
          onChange={(e) => onAccessKeyChange(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Loading...
            </>
          ) : (
            <>
              <ArrowRightIcon className="w-5 h-5 mr-2" />
              Access
            </>
          )}
        </button>
      </div>
    </form>

    {error && (
      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    )}
  </div>
);