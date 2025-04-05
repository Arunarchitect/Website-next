// src/app/budget-calculator/page.tsx

'use client';

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';

const BudgetCalculator: React.FC = () => {
  const [area, setArea] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>(''); // New: promo code
  const [baseFee, setBaseFee] = useState<number | null>(null); // Fetched fee
  const [result, setResult] = useState<number | null>(null);
  const [selectAll, setSelectAll] = useState<boolean>(false);
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

  const handleCheckboxChange = (service: string) => {
    setSelectedComponents((prev) => ({
      ...prev,
      [service]: !prev[service],
    }));
  };

  const handleSelectAllChange = () => {
    const newState = !selectAll;
    setSelectAll(newState);
    const updated = Object.fromEntries(Object.keys(selectedComponents).map(key => [key, newState]));
    setSelectedComponents(updated);
  };

  const handleCalculate = async () => {
    if (!area) return alert('Please enter area');
    try {
      const res = await fetch(`https://api.modelflick.com/api/fee/?promo_code=${promoCode}`);
      const data = await res.json();
      const designFee = data.base_fee_per_sqft;
      setBaseFee(designFee);

      let total = 0;
      Object.keys(selectedComponents).forEach(service => {
        if (selectedComponents[service]) {
          const percent = feePercentages[service] / 100;
          total += designFee * percent * area;
        }
      });

      setResult(total);
    } catch (err) {
      console.error('Error fetching fee:', err);
      alert('Failed to fetch fee. Please try again.');
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Budget Calculator Report', 20, 20);

    doc.setFontSize(14);
    doc.text(`Area: ${area} sq.ft`, 20, 40);
    doc.text(`Promo Code: ${promoCode || 'None'}`, 20, 50);
    doc.text(`Base Fee per sq.ft: ₹${baseFee}`, 20, 60);

    const selected = Object.keys(selectedComponents).filter(service => selectedComponents[service]);
    doc.text(`Selected Options: ${selected.join(', ')}`, 20, 70);

    doc.text(`Total Estimated Cost: ₹${result}`, 20, 90);

    doc.save('budget-calculator-report.pdf');
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-center items-center p-4">
      <h1 className="text-4xl sm:text-6xl md:text-8xl uppercase font-extrabold mb-8 text-center">
        Budget Calculator
      </h1>

      <div className="mb-4 w-full max-w-md">
        <label htmlFor="area" className="text-lg block mb-1">Area (in sq.ft):</label>
        <input
          type="number"
          id="area"
          className="bg-gray-800 text-white py-2 px-4 rounded w-full"
          value={area}
          onChange={(e) => setArea(Number(e.target.value))}
          placeholder="Enter area in sq.ft"
        />
      </div>

      <div className="mb-4 w-full max-w-md">
        <label htmlFor="promoCode" className="text-lg block mb-1">Promo Code (optional):</label>
        <input
          type="text"
          id="promoCode"
          className="bg-gray-800 text-white py-2 px-4 rounded w-full"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Enter promo code"
        />
      </div>

      <div className="mb-4 w-full max-w-md">
        <input
          type="checkbox"
          id="select-all"
          checked={selectAll}
          onChange={handleSelectAllChange}
          className="mr-2"
        />
        <label htmlFor="select-all" className="text-lg">Select All</label>
      </div>

      <div className="space-y-2 mb-8 max-h-80 overflow-auto w-full max-w-md">
        {Object.keys(feePercentages).map((service) => (
          <div key={service}>
            <input
              type="checkbox"
              id={service}
              checked={selectedComponents[service]}
              onChange={() => handleCheckboxChange(service)}
              className="mr-2"
            />
            <label htmlFor={service} className="text-base">{service}</label>
          </div>
        ))}
      </div>

      <button
        onClick={handleCalculate}
        className="bg-white text-black py-2 px-6 rounded-lg text-xl font-bold hover:bg-gray-300 transition"
      >
        Calculate
      </button>

      {result !== null && (
        <div className="mt-8 text-xl text-center">
          <p>Total Estimated Cost:</p>
          <p className="font-bold">₹{result.toLocaleString()}</p>
        </div>
      )}

      {result !== null && (
        <button
          onClick={generatePDF}
          className="bg-white text-black py-2 px-6 rounded-lg text-xl font-bold hover:bg-gray-300 transition mt-4"
        >
          Download PDF Report
        </button>
      )}
    </div>
  );
};

export default BudgetCalculator;
