"use client";

import React from "react";
import { useCalculator } from "@/components/fee/useCalculator";
import { generatePDF } from "@/components/fee/PDFGenerator";
import { FormFields } from "@/components/fee/FormFields";
import ServicesChecklist from "@/components/fee/ServicesChecklist";
import { ResultsDisplay } from "@/components/fee/ResultsDisplay";
import { serviceComponents } from "@/components/fee/constants";

const BudgetCalculator: React.FC = () => {
  const {
    area,
    setArea,
    clientName,
    setClientName,
    promoCode,
    setPromoCode,
    result,
    serviceFees,
    selectAll,
    error,
    selectedComponents,
    handleCheckboxChange,
    handleSelectAllChange,
    handleCalculate,
  } = useCalculator();

  const handleGeneratePDF = () => {
    if (result) {
      generatePDF(clientName, selectedComponents, serviceFees, result, area);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-16">
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center mb-10 uppercase">
        Design Fee Calculator
      </h1>

      <div className="w-full max-w-2xl space-y-6">
        <FormFields
          clientName={clientName}
          setClientName={setClientName}
          area={area}
          setArea={setArea}
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          selectAll={selectAll}
          handleSelectAllChange={handleSelectAllChange}
        />

        <ServicesChecklist
          services={serviceComponents} // Passing serviceComponents as services prop
          selectedComponents={selectedComponents}
          handleCheckboxChange={handleCheckboxChange}
        />

        <button
          onClick={handleCalculate}
          className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-6 rounded transition duration-200"
        >
          Calculate Fee
        </button>

        <ResultsDisplay
          result={result}
          error={error}
          generatePDF={handleGeneratePDF}
        />
      </div>
    </div>
  );
};

export default BudgetCalculator;
