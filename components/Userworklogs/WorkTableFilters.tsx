import { useState } from "react";

interface WorkTableFiltersProps {
  organizations: string[];
  selectedOrg: string;
  setSelectedOrg: (org: string) => void;
  showMobileFilters: boolean;
  setShowMobileFilters: (show: boolean) => void;
}

export const WorkTableFilters = ({
  organizations,
  selectedOrg,
  setSelectedOrg,
  showMobileFilters,
  setShowMobileFilters,
}: WorkTableFiltersProps) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="sm:hidden px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
        >
          {showMobileFilters ? "Hide Filters" : "Show Filters"}
        </button>

        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => setSelectedOrg("all")}
            className={`px-4 py-2 rounded-lg text-sm ${
              selectedOrg === "all"
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            All Organizations
          </button>
          {organizations.map((org) => (
            <button
              key={org}
              onClick={() => setSelectedOrg(org)}
              className={`px-4 py-2 rounded-lg text-sm ${
                selectedOrg === org
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {org}
            </button>
          ))}
        </div>
      </div>

      {showMobileFilters && (
        <div className="sm:hidden mb-4 bg-gray-50 p-3 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Organization
          </label>
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Organizations</option>
            {organizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
};
