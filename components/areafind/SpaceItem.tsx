import React from "react";
import { SelectedSpace } from "./types";
import { FaTimes, FaPlus } from "react-icons/fa";

interface SpaceItemProps {
  space: SelectedSpace;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAreaChange: (id: string, area: number) => void;
}

const SpaceItem: React.FC<SpaceItemProps> = ({ 
  space, 
  onRemove, 
  onDuplicate, 
  onAreaChange 
}) => {
  const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string (when backspacing) but convert to 0 when needed
    if (value === "") {
      onAreaChange(space.id, 0);
    } else {
      const numValue = Number(value);
      if (!isNaN(numValue) && numValue >= 0) {
        onAreaChange(space.id, numValue);
      }
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 relative hover:shadow-md transition-shadow">
      <button
        onClick={() => onRemove(space.id)}
        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
        title="Remove space"
      >
        <FaTimes />
      </button>
      <h3 className="font-medium mb-2">{space.type.name}</h3>
      <div className="mb-2">
        <label className="block text-sm text-gray-600 mb-1">Area (sqft)</label>
        <input
          type="number"
          min="0"
          value={space.customArea || ""}
          onChange={handleAreaChange}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <p className="text-xs text-gray-500 mt-1">
          Default: {space.type.defaultArea} sqft
        </p>
      </div>
      <button
        onClick={() => onDuplicate(space.id)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
        title="Duplicate space"
      >
        <FaPlus size={12} /> Copy
      </button>
    </div>
  );
};

export default SpaceItem;