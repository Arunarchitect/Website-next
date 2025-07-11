"use client";

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import {
  serviceComponents,
  feePercentages,
  initialSelectedComponents,
  componentHierarchy,
  componentDescriptions,
} from "./data";

interface ComponentHierarchy {
  [key: string]: number;
}


interface ComponentDescriptions {
  [key: string]: string;
}

interface ServiceFees {
  [key: string]: number;
}

interface JSPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

const BudgetCalculator: React.FC = () => {
  const [area, setArea] = useState<number | "">("");
  const [clientName, setClientName] = useState<string>("");
  const [promoCode, setPromoCode] = useState<string>("");
  const [result, setResult] = useState<number | null>(null);
  const [serviceFees, setServiceFees] = useState<ServiceFees>({});
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<
    Record<string, boolean>
  >(initialSelectedComponents);

  const handleCheckboxChange = (service: string) => {
    setSelectedComponents((prev) => {
      const updated = { ...prev };
      const currentState = updated[service];
      updated[service] = !currentState;

      const thisLevel = (componentHierarchy as ComponentHierarchy)[service];

      if (!currentState) {
        Object.entries(componentHierarchy as ComponentHierarchy).forEach(
          ([key, level]) => {
            if (level < thisLevel) updated[key] = true;
          }
        );
      } else {
        const hasDependent = Object.entries(
          componentHierarchy as ComponentHierarchy
        ).some(([key, level]) => level > thisLevel && updated[key] === true);
        if (hasDependent) return prev;
      }

      return updated;
    });
  };

  const handleSelectAllChange = () => {
    const newState = !selectAll;
    setSelectAll(newState);
    const updated = Object.fromEntries(
      serviceComponents.map((key) => [key, newState])
    );
    setSelectedComponents(updated);
  };

  const handleCalculate = async () => {
    setError(null);

    // Validate required fields (unchanged)
    if (!clientName.trim()) {
      setError("Please enter client name");
      return;
    }
    if (!promoCode.trim()) {
      setError("Please enter promo code");
      return;
    }
    if (!area || area <= 0) {
      setError("Please enter a valid area");
      return;
    }
    const selected = Object.entries(selectedComponents).filter(
      ([, val]) => val
    );
    if (
      selected.length === 1 &&
      selected[0][0] === "Advance Payment and Site Visit"
    ) {
      setError("Please select at least one more service.");
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
      const areaValue = Number(area);

      // Calculate individual fees
      const calculatedFees: ServiceFees = {};
      let totalFee = 0;

      Object.keys(selectedComponents).forEach((service) => {
        if (selectedComponents[service]) {
          const fee = designFee * (feePercentages[service] / 100) * areaValue;
          calculatedFees[service] = fee;
          totalFee += fee;
        }
      });

      setServiceFees(calculatedFees);
      setResult(totalFee);
    } catch (err) {
      console.error("Error fetching fee:", err);
      setError("Failed to fetch fee. Please try again.");
    }
  };

  const generatePDF = async () => {
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      }) as JSPDFWithAutoTable;

      // Set styles
      pdf.setFont("helvetica");
      const primaryColor: [number, number, number] = [41, 128, 185];
      const secondaryColor: [number, number, number] = [51, 51, 51];
      const lightGray: [number, number, number] = [220, 220, 220];

      // Get current date
      const today = new Date();
      const formattedDate = today.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // ========== Professional Header ==========
      // Logo or Header Image (you can add this if you have one)
      // pdf.addImage(logoData, 'JPEG', 50, 20, 50, 50);

      // Your professional information
      pdf
        .setFontSize(14)
        .setTextColor(...secondaryColor)
        .setFont("helvetica", "bold")
        .text("Arun Ravikumar (B.Arch, M.Plan)", 50, 40);

      pdf
        .setFontSize(10)
        .setTextColor(100, 100, 100)
        .setFont("helvetica", "normal")
        .text("Licensed Architect and Planner", 50, 60);

      pdf
        .setFontSize(10)
        .setTextColor(...primaryColor)
        .setFont("helvetica", "normal")
        .text("www.arunarchitect.in", pdf.internal.pageSize.width - 50, 60, {
          align: "right",
        });

      // Divider line after header
      pdf
        .setDrawColor(...lightGray)
        .setLineWidth(0.5)
        .line(50, 70, pdf.internal.pageSize.width - 50, 70);

      // ========== Main Content ==========
      let y = 100; // Starting Y position after header

      // Main Title
      pdf
        .setFontSize(22)
        .setTextColor(...primaryColor)
        .setFont("helvetica", "bold")
        .text(`Design Fee Proposal for ${clientName}`, 50, y);

      // Date on same line as title
      pdf
        .setFontSize(12)
        .setTextColor(100, 100, 100)
        .setFont("helvetica", "italic")
        .text(`Date: ${formattedDate}`, pdf.internal.pageSize.width - 50, y, {
          align: "right",
        });

      // Basic info
      y += 40;
      pdf.setFontSize(12).setTextColor(0, 0, 0).setFont("helvetica", "normal");
      pdf.text(`Client: ${clientName}`, 50, y);
      y += 20;
      pdf.text(`Area: ${area} sq.ft`, 50, y);
      y += 20;
      pdf.text("Total Design Fee:", 50, y);
      pdf
        .setFont("helvetica", "bold")
        .text(`Rs. ${result?.toLocaleString()}`, 200, y);
      y += 30;

      // Divider after basic info
      pdf
        .setDrawColor(...lightGray)
        .setLineWidth(0.5)
        .line(50, y, pdf.internal.pageSize.width - 50, y);
      y += 20;

      // Selected Services section
      pdf
        .setFontSize(14)
        .setTextColor(...primaryColor)
        .setFont("helvetica", "bold")
        .text("Selected Services", 50, y);
      y += 20;

      // Prepare services data
      const selectedServices = Object.keys(selectedComponents).filter(
        (s) => selectedComponents[s]
      );

      // Create services table
      autoTable(pdf, {
        startY: y,
        head: [["Service", "Fee (Rs.)"]], // Removed "Percentage" from headers
        body: selectedServices.map((service) => [
          service,
          `Rs. ${Math.round(serviceFees[service]).toLocaleString()}`, // Removed percentage value
        ]),
        headStyles: {
          fillColor: secondaryColor,
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: {
          textColor: 0,
          fontSize: 10,
        },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: "auto", halign: "right" }, // Adjusted column index since we removed a column
        },
        margin: { left: 50, right: 50 },
        styles: {
          lineColor: lightGray,
          lineWidth: 0.3,
        },
      } as UserOptions);

      y = pdf.lastAutoTable?.finalY ? pdf.lastAutoTable.finalY + 20 : y + 20;

      // Service Descriptions
      pdf
        .setFontSize(14)
        .setTextColor(...primaryColor)
        .setFont("helvetica", "bold")
        .text("Service Descriptions", 50, y);
      y += 20;

      // Add service descriptions
      let currentY = y;
      selectedServices.forEach((service) => {
        const description = (componentDescriptions as ComponentDescriptions)[
          service
        ];
        const text = `• ${service}: ${description}`;

        if (currentY > 750) {
          pdf.addPage();
          currentY = 60;
        }

        const splitText = pdf.splitTextToSize(text, 495);
        pdf
          .setFontSize(10)
          .setTextColor(0, 0, 0)
          .setFont("helvetica", "normal");
        pdf.text(splitText, 50, currentY);
        currentY += splitText.length * 12 + 8;
      });

      currentY += 10;

      // Disclaimer
      pdf
        .setFontSize(12)
        .setTextColor(0, 0, 0)
        .setFont("helvetica", "bold")
        .text("Terms and Conditions", 50, currentY);
      currentY += 15;

      const disclaimerText = `The advance amount is payable at the time of the site visit. A detailed breakdown of deliverables and the payment schedule will be provided following the site visit. All quoted amounts are subject to revision based on changes in the approximate square footage. This quote remains valid for 10 days from the date of generation or until a formal contract is executed, whichever comes first. If any legal or property-related discrepancies are identified during the initial sketch design stage, a project halt report shall be issued, and the advance amount paid shall be non-refundable.`;

      pdf.setFontSize(10).setFont("helvetica", "normal");
      const splitDisclaimer = pdf.splitTextToSize(disclaimerText, 495);
      pdf.text(splitDisclaimer, 50, currentY);

      pdf.save(
        `Design-Fee-Proposal-${clientName.replace(
          /\s+/g,
          "-"
        )}-${formattedDate.replace(/\//g, "-")}.pdf`
      );
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-16">
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center mb-10 uppercase">
        Design Fee Calculator
      </h1>

      <div className="w-full max-w-2xl space-y-6">
        {/* Client Name Field - Required */}
        <div>
          <label
            htmlFor="clientName"
            className="block text-sm font-medium mb-1"
          >
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

        {/* Area Field */}
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

        {/* Promo Code Field - Mandatory but not shown in PDF */}
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

        {/* Select All Checkbox */}
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

        {/* Services Checklist */}
        <div className="bg-gray-900 rounded-md p-4 max-h-64 overflow-y-auto border border-gray-800">
          {serviceComponents.map((service) => (
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

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-6 rounded transition duration-200"
        >
          Calculate Fee
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-600 text-white px-4 py-2 rounded text-center font-medium">
            {error}
          </div>
        )}

        {/* Results Section */}
        {result !== null && (
          <div className="text-center mt-6 space-y-4">
            <div>
              <p className="text-lg">Your Design Fee is:</p>
              <p className="text-3xl font-bold text-green-400">
                Rs. {result.toLocaleString()}
              </p>
            </div>

            <button
              onClick={generatePDF}
              className="bg-white text-black font-semibold py-2 px-6 rounded-lg hover:bg-gray-200 transition duration-200"
            >
              Generate PDF Proposal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetCalculator;
