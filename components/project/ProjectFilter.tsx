import React from "react";

interface ProjectFilterProps {
  filterOrgId: number | null;
  setFilterOrgId: React.Dispatch<React.SetStateAction<number | null>>;
  organisations: { id: number; name: string }[];
}

const ProjectFilter: React.FC<ProjectFilterProps> = ({ filterOrgId, setFilterOrgId, organisations }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6 mb-4 md:mb-0">
      <h1 className="text-2xl font-bold text-white">Projects</h1>
      <div className="flex items-center space-x-2">
        <span className="text-white">Filter by:</span>
        <select
          value={filterOrgId ?? ""}
          onChange={(e) => setFilterOrgId(e.target.value ? Number(e.target.value) : null)}
          className="bg-gray-800 text-white rounded px-3 py-2"
        >
          <option value="">All Organizations</option>
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ProjectFilter;
