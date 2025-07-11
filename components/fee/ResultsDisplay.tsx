import React from "react";

interface ResultsDisplayProps {
  result: number | null;
  error: string | null;
  serviceFees: Record<string, number>;
  selectedComponents: Record<string, boolean>;
  generatePDF: () => void;
  isLoading?: boolean;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  result,
  error,
  generatePDF,
  isLoading = false,
}) => {
  if (result === null && !error) return null;

  return (
    <div className="bg-gray-900 rounded-lg p-6 mt-6 border border-gray-700">
      {error ? (
        <div 
          className="bg-red-900/50 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-4"
          role="alert"
        >
          <h3 className="font-bold mb-1">Calculation Error</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <h3 className="text-xl font-bold text-gray-200 mb-4">
            Your Design Fee Summary
          </h3>
          
          {/* Friendly message */}
          <div className="mb-6">
            <p className="text-gray-300 mb-4">
              Your custom design proposal is ready! Click the button below to generate and download 
              a detailed PDF report with all the service information and fee breakdown.
            </p>
            
            {/* Total Fee */}
            <div className="flex justify-between items-center border-t border-gray-700 pt-4 mb-4">
              <span className="text-lg font-semibold text-gray-200">Total Estimated Fee:</span>
              <span className="text-2xl font-bold text-green-400">
                ₹{result?.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* PDF Generation Button */}
          <button
            onClick={generatePDF}
            disabled={isLoading}
            className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ${
              isLoading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </span>
            ) : (
              "Download Detailed Proposal"
            )}
          </button>
        </>
      )}
    </div>
  );
};