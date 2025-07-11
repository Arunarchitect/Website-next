import React from "react";
import { FaTrash, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { SpaceType, SelectedSpace } from "./types";


interface SpaceListProps {
  spaceTypes: SpaceType[];
  selectedSpaces: SelectedSpace[];
  showSpaceList: boolean;
  onToggleSpaceList: () => void;
  onAddSpace: (spaceType: SpaceType) => void;
  onClearAll: () => void;
}

const SpaceList: React.FC<SpaceListProps> = ({
  spaceTypes,
  selectedSpaces,
  showSpaceList,
  onToggleSpaceList,
  onAddSpace,
  onClearAll,
}) => {
  const spaceCounts = selectedSpaces.reduce((acc, space) => {
    acc[space.type.name] = (acc[space.type.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full md:w-1/4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Space Types</h2>
        {selectedSpaces.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
            title="Clear all spaces"
          >
            <FaTrash size={14} /> Clear All
          </button>
        )}
      </div>

      <button
        onClick={onToggleSpaceList}
        className="w-full p-2 mb-4 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-between"
      >
        <span>Add Space</span>
        {showSpaceList ? <FaChevronUp /> : <FaChevronDown />}
      </button>

      {showSpaceList && (
        <div className="space-y-2 mb-4 border border-gray-200 rounded p-2">
          {spaceTypes.map((space) => (
            <button
              key={space.name}
              onClick={() => onAddSpace(space)}
              className="w-full p-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded text-left flex justify-between items-center"
            >
              <span>{space.name}</span>
              <span className="text-xs text-gray-500">
                {space.defaultArea} sqft
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <h3 className="font-medium mb-2">Selected Types</h3>
        {Object.keys(spaceCounts).length === 0 ? (
          <p className="text-sm text-gray-500">No spaces added yet</p>
        ) : (
          <ul className="space-y-2">
            {Object.entries(spaceCounts).map(([name, count]) => (
              <li
                key={name}
                className="flex justify-between items-center p-2 bg-gray-50 rounded"
              >
                <span>{name}</span>
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SpaceList;
