import React from "react";

interface CalculationSummaryProps {
  totalArea: number;
  wallPercentage: number;
  circulationPercentage: number;
}

const CalculationSummary: React.FC<CalculationSummaryProps> = ({
  totalArea,
  wallPercentage,
  circulationPercentage,
}) => {
  return (
    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">Area Calculation</h2>
      <p className="text-2xl font-bold text-blue-800">
        Approximate Total Area: {totalArea} sqft
      </p>
      <p className="text-sm text-gray-600 mt-1">
        {wallPercentage > 0 && circulationPercentage > 0
          ? `Includes ${wallPercentage}% for walls and ${circulationPercentage}% for circulation`
          : wallPercentage > 0
          ? `Includes ${wallPercentage}% for walls`
          : circulationPercentage > 0
          ? `Includes ${circulationPercentage}% for circulation`
          : "Base area only"}
      </p>
    </div>
  );
};

export default CalculationSummary;