import React, { useState } from "react";
import { SelectedSpace } from "./types";
import { FaTimes, FaPlus, FaEdit } from "react-icons/fa";

interface SpaceItemProps {
  space: SelectedSpace;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAreaChange: (id: string, area: number) => void;
  onNameChange?: (id: string, name: string) => void; // New prop for name changes
}

const SpaceItem: React.FC<SpaceItemProps> = ({ 
  space, 
  onRemove, 
  onDuplicate, 
  onAreaChange,
  onNameChange 
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [spaceName, setSpaceName] = useState(space.type.name);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpaceName(e.target.value);
  };

  const saveNameChange = () => {
    if (onNameChange && spaceName.trim()) {
      onNameChange(space.id, spaceName);
    }
    setIsEditingName(false);
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
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
      
      {space.type.isCustom ? (
        <div className="mb-2 flex items-center">
          {isEditingName ? (
            <>
              <input
                type="text"
                value={spaceName}
                onChange={handleNameChange}
                onBlur={saveNameChange}
                onKeyPress={(e) => e.key === 'Enter' && saveNameChange()}
                className="flex-1 p-1 border border-gray-300 rounded"
                autoFocus
              />
              <button 
                onClick={saveNameChange}
                className="ml-2 text-blue-500"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <h3 className="font-medium">{spaceName}</h3>
              <button
                onClick={() => setIsEditingName(true)}
                className="ml-2 text-gray-500 hover:text-gray-700"
                title="Edit space name"
              >
                <FaEdit size={12} />
              </button>
            </>
          )}
        </div>
      ) : (
        <h3 className="font-medium mb-2">{space.type.name}</h3>
      )}

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