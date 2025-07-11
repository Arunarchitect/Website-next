import React from "react";

interface ServicesChecklistProps {
  services: string[];
  selectedComponents: Record<string, boolean>;
  handleCheckboxChange: (service: string) => void;
  selectAll?: boolean;
  error?: string;
}

export const ServicesChecklist: React.FC<ServicesChecklistProps> = ({
  services,
  selectedComponents,
  handleCheckboxChange,
  error,
}) => {
  // Check if at least one service is selected (excluding "Advance Payment and Site Visit")
  const hasMinimumSelection = Object.entries(selectedComponents)
    .filter(([service]) => service !== "Advance Payment and Site Visit")
    .some(([, selected]) => selected);

  return (
    <div className="space-y-4">
      <div 
        className={`bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto border ${
          error ? "border-red-500" : "border-gray-700"
        } transition-colors`}
        aria-live="polite"
      >
        <h3 className="text-lg font-medium text-gray-300 mb-3">
          Select Services
          {error && !hasMinimumSelection && (
            <span className="text-red-500 ml-2 text-sm font-normal">
              (Select at least one service)
            </span>
          )}
        </h3>
        
        <div className="space-y-2">
          {services.map((service) => (
            <div key={service} className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id={`service-${service}`}
                  checked={selectedComponents[service]}
                  onChange={() => handleCheckboxChange(service)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-700 rounded"
                  aria-describedby={`service-${service}-description`}
                />
              </div>
              <div className="ml-3 text-sm">
                <label 
                  htmlFor={`service-${service}`} 
                  className="font-medium text-gray-300"
                >
                  {service}
                </label>
                {service === "Advance Payment and Site Visit" && (
                  <p 
                    id={`service-${service}-description`} 
                    className="text-gray-400 text-xs"
                  >
                    Required for all projects
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};