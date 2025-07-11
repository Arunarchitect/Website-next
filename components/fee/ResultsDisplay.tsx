import React from "react";

interface ResultsDisplayProps {
  result: number | null;
  error: string | null;
  generatePDF: () => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  result,
  error,
  generatePDF,
}) => {
  if (result === null) return null;

  return (
    <div className="text-center mt-6 space-y-4">
      {error && (
        <div className="bg-red-600 text-white px-4 py-2 rounded text-center font-medium">
          {error}
        </div>
      )}
      <div>
        <p className="text-lg">Your Design Fee is:</p>
        <p className="text-3xl font-bold text-green-400">
          Rs. {result.toLocaleString()}
        </p>
      </div>
      <button
        onClick={generatePDF}
        className="bg-white text-black font-semibold py-2 px-6 rounded-lg hover:bg-gray-200 transition duration-200"
      >
        Generate PDF Proposal
      </button>
    </div>
  );
};