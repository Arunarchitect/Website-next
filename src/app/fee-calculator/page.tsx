// src/app/budget-calculator/page.tsx

'use client'; // Marking this file as a client component

import React, { useState } from 'react';
import { jsPDF } from 'jspdf'; // Import jsPDF

const BudgetCalculator: React.FC = () => {
  const [area, setArea] = useState<number>(0); // Area in sq.ft
  const [selectedComponents, setSelectedComponents] = useState<{ [key: string]: boolean }>({
    'Advance, Site visit': false,
    'Sketch Design': false,
    'Detailed Plan': false,
    'Statutory Permit': false,
    'Structural Drawing': false,
    'Joinery & Grill': false,
    'Electrical Plan': false,
    'Plumbing': false,
    'Floor & Tile': false,
    'Toilet Design': false,
    'Kitchen Design': false,
    'Wardrobe Design': false,
    'Interior Finish': false,
    'Gate & Wall Design': false,
    'Completion Drawings': false,
  });

  const feePercentages: { [key: string]: number } = {
    'Advance, Site visit': 5.0,
    'Sketch Design': 16.0,
    'Detailed Plan': 12.0,
    'Statutory Permit': 8.0,
    'Structural Drawing': 12.0,
    'Joinery & Grill': 6.3,
    'Electrical Plan': 7.2,
    'Plumbing': 7.2,
    'Floor & Tile': 3.2,
    'Toilet Design': 4.0,
    'Kitchen Design': 5.6,
    'Wardrobe Design': 7.2,
    'Interior Finish': 2.4,
    'Gate & Wall Design': 2.4,
    'Completion Drawings': 1.6,
  };

  const [result, setResult] = useState<number | null>(null); // The calculated result
  const [selectAll, setSelectAll] = useState<boolean>(false); // State to manage "Select All" checkbox

  const handleCalculate = () => {
    let total = 0;
    let selectedServices = [];

    const designfee = 175; // Hardcoded design fee constant

    Object.keys(selectedComponents).forEach((service) => {
      if (selectedComponents[service]) {
        const feeMultiplier = feePercentages[service] / 100; // Convert percentage to multiplier
        const feeComponent = designfee * feeMultiplier; // Multiply design fee by the multiplier
        total += feeComponent * area; // Calculate the fee for the selected service and multiply by area
        selectedServices.push(service); // Track selected services
      }
    });

    setResult(total); // Set the result after calculation
  };

  // Function to generate and download the PDF
  const generatePDF = () => {
    const doc = new jsPDF();

    // Add Title
    doc.setFontSize(20);
    doc.text('Budget Calculator Report', 20, 20);

    // Add Calculated Result
    doc.setFontSize(14);
    doc.text(`Area: ${area} sq.ft`, 20, 40);

    // List selected services
    const selectedServices = Object.keys(selectedComponents).filter(service => selectedComponents[service]);
    doc.text(`Selected Options: ${selectedServices.join(', ')}`, 20, 50);

    // Add Result to PDF
    doc.text(`Calculated Result: ${result} rupees.`, 20, 60);

    // Save the PDF with a filename
    doc.save('budget-calculator-report.pdf');
  };

  const handleCheckboxChange = (service: string) => {
    setSelectedComponents((prevState) => ({
      ...prevState,
      [service]: !prevState[service],
    }));
  };

  // Function to handle "Select All" checkbox
  const handleSelectAllChange = () => {
    setSelectAll(!selectAll);
    const newSelectedComponents = Object.keys(selectedComponents).reduce((acc, service) => {
      acc[service] = !selectAll;
      return acc;
    }, {} as { [key: string]: boolean });

    setSelectedComponents(newSelectedComponents);
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-center items-center p-4">
      <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl xl:text-9xl uppercase font-extrabold mb-8">
        Budget Calculator
      </h1>

      {/* Input field for area */}
      <div className="mb-4">
        <label htmlFor="area" className="text-lg sm:text-xl">Area (in sq.ft):</label>
        <input
          type="number"
          id="area"
          className="bg-gray-800 text-white py-2 px-4 rounded mt-2 w-72"
          value={area}
          onChange={(e) => setArea(Number(e.target.value))}
          placeholder="Enter area in sq.ft"
        />
      </div>

      {/* Select All Checkbox */}
      <div className="mb-4">
        <input
          type="checkbox"
          id="select-all"
          checked={selectAll}
          onChange={handleSelectAllChange}
          className="mr-2"
        />
        <label htmlFor="select-all" className="text-lg sm:text-xl">Select All</label>
      </div>

      {/* Checkbox inputs for all service components */}
      <div className="space-y-4 mb-8 max-h-80 overflow-auto">
        {Object.keys(feePercentages).map((service) => (
          <div key={service}>
            <input
              type="checkbox"
              id={service}
              checked={selectedComponents[service]}
              onChange={() => handleCheckboxChange(service)}
              className="mr-2"
            />
            <label htmlFor={service} className="text-lg sm:text-xl">{service}</label>
          </div>
        ))}
      </div>

      {/* Calculate button */}
      <button
        onClick={handleCalculate}
        className="bg-white text-black py-2 px-6 rounded-lg text-xl uppercase font-bold hover:bg-gray-200 transition duration-300"
      >
        Calculate
      </button>

      {/* Display the result */}
      {result !== null && (
        <div className="mt-8 text-xl sm:text-2xl">
          <p>The calculated result is:</p>
          <p className="font-bold">{result} rupees.</p>
        </div>
      )}

      {/* PDF Download Button */}
      {result !== null && (
        <button
          onClick={generatePDF}
          className="bg-white text-black py-2 px-6 rounded-lg text-xl uppercase font-bold hover:bg-gray-200 transition duration-300 mt-4"
        >
          Download PDF Report
        </button>
      )}
    </div>
  );
};

export default BudgetCalculator;
