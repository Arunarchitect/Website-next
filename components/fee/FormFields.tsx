import React from "react";

interface FormFieldsProps {
  clientName: string;
  setClientName: (value: string) => void;
  area: number | "";
  setArea: (value: number | "") => void;
  promoCode: string;
  setPromoCode: (value: string) => void;
  selectAll: boolean;
  handleSelectAllChange: () => void;
  error?: string;
}

export const FormFields: React.FC<FormFieldsProps> = ({
  clientName,
  setClientName,
  area,
  setArea,
  promoCode,
  setPromoCode,
  selectAll,
  handleSelectAllChange,
  error,
}) => {
  const handleAreaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setArea(value === "" ? "" : Math.max(0, Number(value)));
  };

  return (
    <div className="space-y-4">
      {/* Client Name Field */}
      <div>
        <label htmlFor="clientName" className="block text-sm font-medium text-gray-300 mb-1">
          Client Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="clientName"
          className={`w-full bg-gray-800 border ${error && !clientName ? "border-red-500" : "border-gray-700"} rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Enter client name"
          required
          aria-invalid={!clientName}
          aria-describedby="clientNameError"
        />
        {error && !clientName && (
          <p id="clientNameError" className="mt-1 text-sm text-red-500">
            Please enter client name
          </p>
        )}
      </div>

      {/* Area Field */}
      <div>
        <label htmlFor="area" className="block text-sm font-medium text-gray-300 mb-1">
          Area (in sq.ft) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="area"
          min="0"
          step="1"
          className={`w-full bg-gray-800 border ${error && (!area || area <= 0) ? "border-red-500" : "border-gray-700"} rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          value={area}
          onChange={handleAreaChange}
          placeholder="Enter area in square feet"
          required
          aria-invalid={!area || area <= 0}
          aria-describedby="areaError"
        />
        {error && (!area || area <= 0) && (
          <p id="areaError" className="mt-1 text-sm text-red-500">
            Please enter a valid area
          </p>
        )}
      </div>

      {/* Promo Code Field */}
      <div>
        <label htmlFor="promoCode" className="block text-sm font-medium text-gray-300 mb-1">
          Promo Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="promoCode"
          className={`w-full bg-gray-800 border ${error && !promoCode ? "border-red-500" : "border-gray-700"} rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Enter promo code"
          required
          aria-invalid={!promoCode}
          aria-describedby="promoCodeError"
        />
        {error && !promoCode && (
          <p id="promoCodeError" className="mt-1 text-sm text-red-500">
            Please enter promo code
          </p>
        )}
      </div>

      {/* Select All Checkbox */}
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            type="checkbox"
            id="select-all"
            checked={selectAll}
            onChange={handleSelectAllChange}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-700 rounded"
            aria-describedby="select-all-description"
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="select-all" className="font-medium text-gray-300">
            Select All Services
          </label>
          <p id="select-all-description" className="text-gray-400">
            Check to select all available services
          </p>
        </div>
      </div>
    </div>
  );
};