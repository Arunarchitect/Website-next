import React from "react";

interface ServicesChecklistProps {
  services: string[];  // Changed from serviceComponents to services
  selectedComponents: Record<string, boolean>;
  handleCheckboxChange: (service: string) => void;
}

const ServicesChecklist: React.FC<ServicesChecklistProps> = ({
  services,  // Changed prop name
  selectedComponents,
  handleCheckboxChange,
}) => {
  return (
    <div className="bg-gray-900 rounded-md p-4 max-h-64 overflow-y-auto border border-gray-800">
      {services.map((service) => (  // Using services prop instead of serviceComponents
        <div key={service} className="flex items-center mb-2">
          <input
            type="checkbox"
            id={service}
            checked={selectedComponents[service]}
            onChange={() => handleCheckboxChange(service)}
            className="mr-2"
          />
          <label htmlFor={service} className="text-sm">
            {service}
          </label>
        </div>
      ))}
    </div>
  );
};

export default ServicesChecklist;