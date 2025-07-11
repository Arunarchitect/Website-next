import React from "react";
import SpaceItem from "./SpaceItem";
import { SelectedSpace } from "./types";

interface SpaceDetailsProps {
  spaces: SelectedSpace[];
  onRemoveSpace: (id: string) => void;
  onDuplicateSpace: (id: string) => void;
  onAreaChange: (id: string, area: number) => void;
  onNameChange: (id: string, name: string) => void; // New prop
}

const SpaceDetails: React.FC<SpaceDetailsProps> = ({
  spaces,
  onRemoveSpace,
  onDuplicateSpace,
  onAreaChange,
  onNameChange
}) => {
  const handleAreaChange = (id: string, area: number) => {
    const validatedArea = Math.max(0, area);
    onAreaChange(id, validatedArea);
  };

  return (
    <div className="w-full md:w-3/4">
      <h2 className="text-lg font-semibold mb-3">Space Details</h2>
      {spaces.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500">No spaces added yet</p>
          <p className="text-sm text-gray-400 mt-1">Click `Add Space` to begin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => (
            <SpaceItem
              key={space.id}
              space={space}
              onRemove={onRemoveSpace}
              onDuplicate={onDuplicateSpace}
              onAreaChange={handleAreaChange}
              onNameChange={onNameChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SpaceDetails;