"use client";

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import "svg2pdf.js";

const BudgetCalculator: React.FC = () => {
  const [area, setArea] = useState<number | "">("");
  const [promoCode, setPromoCode] = useState<string>("");
  const [baseFee, setBaseFee] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedComponents, setSelectedComponents] = useState<{
    [key: string]: boolean;
  }>({
    "Advance Payment, Initial Site visit": false,
    "First Sketch Design": false,
    "Detailed Plan": false,
    "Statutory Permit": false,
    "Structural Drawing": false,
    "Joinery & Grill": false,
    "Electrical Plan": false,
    Plumbing: false,
    "Floor & Tile": false,
    "Toilet Design": false,
    "Kitchen Design": false,
    "Wardrobe Design": false,
    "Selection of Interior Finish": false,
    "Gate & Wall Design": false,
    "Completion Drawings": false,
  });

  const feePercentages: { [key: string]: number } = {
    "Advance Payment, Initial Site visit": 5.0,
    "First Sketch Design": 16.0,
    "Detailed Plan": 12.0,
    "Statutory Permit": 8.0,
    "Structural Drawing": 12.0,
    "Joinery & Grill": 6.3,
    "Electrical Plan": 7.2,
    Plumbing: 7.2,
    "Floor & Tile": 3.2,
    "Toilet Design": 4.0,
    "Kitchen Design": 5.6,
    "Wardrobe Design": 7.2,
    "Selection of Interior Finish": 2.4,
    "Gate & Wall Design": 2.4,
    "Completion Drawings": 1.5,
  };

  const escapeXML = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const handleCheckboxChange = (service: string) => {
    setSelectedComponents((prev) => ({
      ...prev,
      [service]: !prev[service],
    }));
  };

  const handleSelectAllChange = () => {
    const newState = !selectAll;
    setSelectAll(newState);
    const updated = Object.fromEntries(
      Object.keys(selectedComponents).map((key) => [key, newState])
    );
    setSelectedComponents(updated);
  };

  const handleCalculate = async () => {
    setError(null);
    if (!area || area <= 0) {
      setError("Please enter a valid area");
      return;
    }

    try {
      const res = await fetch(
        `https://api.modelflick.com/fees/fee/?promo_code=${promoCode}`
      );
      const data = await res.json();

      if (data?.error) {
        setError(data.error);
        return;
      }

      const designFee = data?.base_fee_per_sqft;
      setBaseFee(designFee);

      let total = 0;
      Object.keys(selectedComponents).forEach((service) => {
        if (selectedComponents[service]) {
          const percent = feePercentages[service] / 100;
          total += designFee * percent * Number(area);
        }
      });

      setResult(total);
    } catch (err) {
      console.error("Error fetching fee:", err);
      setError("Failed to fetch fee. Please try again.");
    }
  };

  const generatePDF = async () => {
    try {
      const response = await fetch("/svg/template.svg");
      const svgText = await response.text();

      const selected = Object.keys(selectedComponents).filter(
        (service) => selectedComponents[service]
      );

      const column1X = 70;
      const column2X = 300;
      const startY = 250;
      const lineHeight = 24;
      const mid = Math.ceil(selected.length / 2);

      const bulletElements = selected
        .map((item, index) => {
          const col = index < mid ? 0 : 1;
          const x = col === 0 ? column1X : column2X;
          const y = startY + (index % mid) * lineHeight;
          return `<text x="${x}" y="${y}">• ${escapeXML(item)}</text>`;
        })
        .join("\n");

      const filledSVG = svgText
        .replace("{{AREA}}", escapeXML(`${area} sq.ft`))
        .replace("{{PROMO}}", escapeXML(promoCode || "None"))
        .replace("{{BASE_FEE}}", escapeXML(`${baseFee?.toFixed(2)}`))
        .replace("{{TOTAL}}", escapeXML(`${result?.toLocaleString()}`))
        .replace("{{BULLET_LIST}}", bulletElements);

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(filledSVG, "image/svg+xml");
      const svgElement = svgDoc.documentElement;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      await pdf.svg(svgElement, { x: 0, y: 0, width: 595, height: 842 });
      pdf.save("budget-calculator-report.pdf");
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 sm:px-6 md:px-8 py-16">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-center mb-10 uppercase">
        Know your Design Fee!
      </h1>

      <div className="w-full max-w-2xl space-y-6">
        {/* Area input */}
        <div>
          <label htmlFor="area" className="block text-sm font-medium mb-1">
            Area (in sq.ft):
          </label>
          <input
            type="number"
            id="area"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={area}
            onChange={(e) => {
              const val = e.target.value;
              setArea(val === "" ? "" : Number(val));
            }}
            placeholder="Enter your area in square feet"
          />
        </div>

        {/* Promo input */}
        <div>
          <label htmlFor="promoCode" className="block text-sm font-medium mb-1">
            Security Code:
          </label>
          <input
            type="text"
            id="promoCode"
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter promo code"
          />
        </div>

        {/* Select All */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="select-all"
            checked={selectAll}
            onChange={handleSelectAllChange}
            className="mr-2"
          />
          <label htmlFor="select-all" className="text-sm font-medium">
            Select All
          </label>
        </div>

        {/* Service checkboxes */}
        <div className="bg-gray-900 rounded-md p-4 max-h-64 overflow-y-auto border border-gray-800">
          {Object.keys(feePercentages).map((service) => (
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

        {/* Calculate button */}
        <button
          onClick={handleCalculate}
          className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-6 rounded transition duration-200"
        >
          Calculate
        </button>

        {/* Error message */}
        {error && (
          <div className="bg-red-600 text-white px-4 py-2 rounded text-center font-medium">
            {error}
          </div>
        )}

        {/* Result and download */}
        {result !== null && (
          <div className="text-center mt-6 space-y-4">
            <div>
              <p className="text-lg">Your Design Fee is:</p>
              <p className="text-3xl font-bold text-green-400">
                ₹{result.toLocaleString()}
              </p>
            </div>

            <button
              onClick={generatePDF}
              className="bg-white text-black font-semibold py-2 px-6 rounded-lg hover:bg-gray-200 transition duration-200"
            >
              Download PDF Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetCalculator;
