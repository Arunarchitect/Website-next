'use client';

import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

const BudgetCalculator: React.FC = () => {
  const [area, setArea] = useState<number | ''>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [baseFee, setBaseFee] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedComponents, setSelectedComponents] = useState<{ [key: string]: boolean }>({
    'Advance Payment, Initial Site visit': false,
    'First Sketch Design': false,
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
    'Selection of Interior Finish': false,
    'Gate & Wall Design': false,
    'Completion Drawings': false,
  });

  const feePercentages: { [key: string]: number } = {
    'Advance Payment, Initial Site visit': 5.0,
    'First Sketch Design': 16.0,
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
    'Selection of Interior Finish': 2.4,
    'Gate & Wall Design': 2.4,
    'Completion Drawings': 1.5,
  };

  const escapeXML = (str: string) =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&apos;');

  const handleCheckboxChange = (service: string) => {
    setSelectedComponents(prev => ({
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
    setError(null);
    if (!area || area <= 0) {
      setError('Please enter a valid area');
      return;
    }

    try {
      const res = await fetch(`https://api.modelflick.com/fees/fee/?promo_code=${promoCode}`);
      const data = await res.json();

      if (data?.error) {
        setError(data.error);
        return;
      }

      const designFee = data?.base_fee_per_sqft;
      setBaseFee(designFee);

      let total = 0;
      Object.keys(selectedComponents).forEach(service => {
        if (selectedComponents[service]) {
          const percent = feePercentages[service] / 100;
          total += designFee * percent * Number(area);
        }
      });

      setResult(total);
    } catch (err) {
      console.error('Error fetching fee:', err);
      setError('Failed to fetch fee. Please try again.');
    }
  };

  const generatePDF = async () => {
    try {
      const response = await fetch('/svg/template.svg');
      const svgText = await response.text();

      const selected = Object.keys(selectedComponents).filter(service => selectedComponents[service]);

      const column1X = 70;
      const column2X = 300;
      const startY = 250;
      const lineHeight = 24;
      const mid = Math.ceil(selected.length / 2);

      const bulletElements = selected.map((item, index) => {
        const col = index < mid ? 0 : 1;
        const x = col === 0 ? column1X : column2X;
        const y = startY + (index % mid) * lineHeight;
        return `<text x="${x}" y="${y}">• ${escapeXML(item)}</text>`;
      }).join('\n');

      const filledSVG = svgText
        .replace('{{AREA}}', escapeXML(`${area} sq.ft`))
        .replace('{{PROMO}}', escapeXML(promoCode || 'None'))
        .replace('{{BASE_FEE}}', escapeXML(`${baseFee?.toFixed(2)}`))
        .replace('{{TOTAL}}', escapeXML(`${result?.toLocaleString()}`))
        .replace('{{BULLET_LIST}}', bulletElements);

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(filledSVG, 'image/svg+xml');
      const svgElement = svgDoc.documentElement;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      await pdf.svg(svgElement, { x: 0, y: 0, width: 595, height: 842 });
      pdf.save('budget-calculator-report.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center p-4 pt-20 sm:pt-24 overflow-y-auto">
      <h1 className="text-4xl sm:text-6xl md:text-8xl uppercase font-extrabold mb-8 text-center">
        Know your Design Fee!
      </h1>

      {/* Area input */}
      <div className="mb-4 w-full max-w-md">
        <label htmlFor="area" className="text-lg block mb-1">Area (in sq.ft):</label>
        <input
          type="number"
          id="area"
          className="bg-gray-800 text-white py-2 px-4 rounded w-full"
          value={area}
          onChange={(e) => {
            const val = e.target.value;
            setArea(val === '' ? '' : Number(val));
          }}
          placeholder="Enter your area in square feet"
        />
      </div>

      {/* Promo input */}
      <div className="mb-4 w-full max-w-md">
        <label htmlFor="promoCode" className="text-lg block mb-1">Security Code:</label>
        <input
          type="text"
          id="promoCode"
          className="bg-gray-800 text-white py-2 px-4 rounded w-full"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Enter promo code"
        />
      </div>

      {/* Select All */}
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

      {/* Service checkboxes */}
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

      {/* Calculate button */}
      <button
        onClick={handleCalculate}
        className="bg-white text-black py-2 px-6 rounded-lg text-xl font-bold hover:bg-gray-300 transition"
      >
        Calculate
      </button>

      {/* Error message */}
      {error && (
        <div className="bg-red-600 text-white px-4 py-2 rounded mt-4 max-w-md w-full text-center font-medium">
          {error}
        </div>
      )}

      {/* Result and download */}
      {result !== null && (
        <>
          <div className="mt-8 text-xl text-center">
            <p>Your Design Fee is:</p>
            <p className="font-bold">₹{result.toLocaleString()}</p>
          </div>

          <button
            onClick={generatePDF}
            className="bg-white text-black py-2 px-6 rounded-lg text-xl font-bold hover:bg-gray-300 transition mt-4"
          >
            Download PDF Report
          </button>
        </>
      )}
    </div>
  );
};

export default BudgetCalculator;
