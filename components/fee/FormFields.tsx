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
}) => {
  return (
    <>
      <div>
        <label htmlFor="clientName" className="block text-sm font-medium mb-1">
          Client Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="clientName"
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Enter client name"
          required
        />
      </div>

      <div>
        <label htmlFor="area" className="block text-sm font-medium mb-1">
          Area (in sq.ft) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="area"
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2"
          value={area}
          onChange={(e) =>
            setArea(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="Enter area in square feet"
          required
        />
      </div>

      <div>
        <label htmlFor="promoCode" className="block text-sm font-medium mb-1">
          Promo Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="promoCode"
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Enter promo code"
          required
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="select-all"
          checked={selectAll}
          onChange={handleSelectAllChange}
          className="mr-2"
        />
        <label htmlFor="select-all" className="text-sm font-medium">
          Select All Services
        </label>
      </div>
    </>
  );
};