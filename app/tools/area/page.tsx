"use client";

import React, { useState } from "react";
import SpaceList from "@/components/areafind/SpaceList";
import SpaceDetails from "@/components/areafind/SpaceDetails";
import CalculationSummary from "@/components/areafind/CalculationSummary";
import { generatePDF } from "@/components/areafind/PDFGenerator";
import { spaceTypes } from "@/components/areafind/constants";
import { SpaceType, SelectedSpace } from "@/components/areafind/types";

const AreaCalculator: React.FC = () => {
  const [selectedSpaces, setSelectedSpaces] = useState<SelectedSpace[]>([]);
  const [clientName, setClientName] = useState<string>("");
  const [wallPercentage, setWallPercentage] = useState<number>(10);
  const [circulationPercentage, setCirculationPercentage] =
    useState<number>(10);
  const [error, setError] = useState<string | null>(null);
  const [showSpaceList, setShowSpaceList] = useState<boolean>(false);

  const handleAddSpace = (spaceType: SpaceType) => {
    setSelectedSpaces((prev) => [
      ...prev,
      {
        type: spaceType,
        customArea: spaceType.defaultArea,
        id: `${spaceType.name}-${Date.now()}`,
      },
    ]);
    setShowSpaceList(false);
    setError(null); // Clear error when adding a space
  };

  const handleNameChange = (id: string, newName: string) => {
    setSelectedSpaces((prev) =>
      prev.map((space) =>
        space.id === id
          ? {
              ...space,
              type: {
                ...space.type,
                name: newName,
              },
            }
          : space
      )
    );
  };

  const handleDuplicateSpace = (id: string) => {
    const spaceToDuplicate = selectedSpaces.find((space) => space.id === id);
    if (spaceToDuplicate) {
      setSelectedSpaces((prev) => [
        ...prev,
        {
          ...spaceToDuplicate,
          id: `${spaceToDuplicate.type.name}-${Date.now()}`,
        },
      ]);
    }
    setError(null); // Clear error when duplicating a space
  };

  const handleRemoveSpace = (id: string) => {
    setSelectedSpaces((prev) => prev.filter((s) => s.id !== id));
    setError(null); // Clear error when removing a space
  };

  const clearAllSpaces = () => {
    setSelectedSpaces([]);
    setError(null); // Clear error when clearing all spaces
  };

  const updateCustomArea = (id: string, area: number) => {
    // Allow 0 or positive numbers
    if (area >= 0) {
      setSelectedSpaces((prev) =>
        prev.map((s) => (s.id === id ? { ...s, customArea: area } : s))
      );
    }
  };

  const calculateTotalArea = () => {
    let total = selectedSpaces.reduce(
      (sum, space) => sum + space.customArea,
      0
    );

    if (wallPercentage > 0) {
      total += total * (wallPercentage / 100);
    }

    if (circulationPercentage > 0) {
      total += total * (circulationPercentage / 100);
    }

    return Math.round(total);
  };

  const handleGeneratePDF = () => {
    if (!clientName.trim()) {
      setError("Please enter client name");
      return;
    }

    if (selectedSpaces.length === 0) {
      setError("Please add at least one space");
      return;
    }

    setError(null); // Clear any previous errors
    generatePDF(
      clientName,
      selectedSpaces,
      wallPercentage,
      circulationPercentage,
      calculateTotalArea()
    );
  };

  const totalArea = calculateTotalArea();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Space Area Calculator
        </h1>

        {/* Client Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setError(null); // Clear error when typing
            }}
            placeholder="Enter client name"
          />
        </div>

        {/* Percentage Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">
                Wall Percentage: {wallPercentage}%
              </label>
              <span className="text-xs text-gray-500">10-50%</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={wallPercentage}
              onChange={(e) => setWallPercentage(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">
                Circulation Percentage: {circulationPercentage}%
              </label>
              <span className="text-xs text-gray-500">10-50%</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={circulationPercentage}
              onChange={(e) => setCirculationPercentage(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Space Selection and Display */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <SpaceList
            spaceTypes={spaceTypes} // Add this prop
            selectedSpaces={selectedSpaces}
            showSpaceList={showSpaceList}
            onToggleSpaceList={() => setShowSpaceList(!showSpaceList)}
            onAddSpace={handleAddSpace}
            onClearAll={clearAllSpaces}
          />

          <SpaceDetails
            spaces={selectedSpaces}
            onRemoveSpace={handleRemoveSpace}
            onDuplicateSpace={handleDuplicateSpace}
            onAreaChange={updateCustomArea}
            onNameChange={handleNameChange}
          />
        </div>

        {/* Results */}
        {selectedSpaces.length > 0 && (
          <CalculationSummary
            totalArea={totalArea}
            wallPercentage={wallPercentage}
            circulationPercentage={circulationPercentage}
          />
        )}

        {/* Error/Warning */}
        {error && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-center">
            {error}
          </div>
        )}

        {/* Generate PDF Button - Always active */}
        <button
          onClick={handleGeneratePDF}
          className="w-full py-2 px-4 rounded font-medium bg-blue-600 hover:bg-blue-700 text-white"
        >
          Generate PDF Report
        </button>
      </div>
    </div>
  );
};

export default AreaCalculator;
