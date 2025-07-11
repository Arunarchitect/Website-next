import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { JSPDFWithAutoTable } from "./types";
import { componentDescriptions } from "./constants";

interface ConsultantData {
  consultant: string;
  designation: string;
  education: string;
  url?: string;
}

export const generatePDF = (
  clientName: string,
  selectedComponents: Record<string, boolean>,
  serviceFees: Record<string, number>,
  result: number,
  area: number | "",
  consultantData: ConsultantData | null
): void => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  }) as JSPDFWithAutoTable;

  // Set styles
  doc.setFont("helvetica");
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

  // Enhanced consultant data handling with fallbacks
  const consultantName = consultantData?.consultant || "Design Consultant";
  const designation = consultantData?.designation || "Architectural Designer";
  const education = consultantData?.education || "";

  // Robust URL handling
  let websiteUrl = "";
  let displayUrl = "";

  if (consultantData?.url) {
    try {
      const rawUrl = consultantData.url.trim();
      websiteUrl = rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`;
      displayUrl = websiteUrl
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "");
    } catch {
      // Silently handle URL processing errors by keeping empty strings
    }
  }

  // Header with dynamic consultant data
  doc
    .setFontSize(14)
    .setTextColor(...secondaryColor)
    .setFont("helvetica", "bold")
    .text(consultantName, 50, 40);

  if (education) {
    const nameWidth = doc.getTextWidth(consultantName);
    doc
      .setFontSize(10)
      .setTextColor(100, 100, 100)
      .setFont("helvetica", "italic")
      .text(` ${education}`, 50 + nameWidth + 2, 40);
  }

  doc
    .setFontSize(10)
    .setTextColor(100, 100, 100)
    .setFont("helvetica", "normal")
    .text(designation, 50, 60);

  if (websiteUrl) {
    doc
      .setFontSize(10)
      .setTextColor(...primaryColor)
      .setFont("helvetica", "normal")
      .textWithLink(displayUrl, doc.internal.pageSize.width - 50, 60, {
        align: "right",
        url: websiteUrl,
      });
  }

  // Header with dynamic consultant data
  doc
    .setFontSize(14)
    .setTextColor(...secondaryColor)
    .setFont("helvetica", "bold")
    .text(consultantName, 50, 40);

  if (education) {
    const nameWidth = doc.getTextWidth(consultantName);
    doc
      .setFontSize(10)
      .setTextColor(100, 100, 100)
      .setFont("helvetica", "italic")
      .text(` ${education}`, 50 + nameWidth + 2, 40);
  }

  doc
    .setFontSize(10)
    .setTextColor(100, 100, 100)
    .setFont("helvetica", "normal")
    .text(designation, 50, 60);

  if (websiteUrl) {
    doc
      .setFontSize(10)
      .setTextColor(...primaryColor)
      .setFont("helvetica", "normal")
      .textWithLink(displayUrl, doc.internal.pageSize.width - 50, 60, {
        align: "right",
        url: websiteUrl,
      });
  }

  // Divider line
  doc
    .setDrawColor(...lightGray)
    .setLineWidth(0.5)
    .line(50, 90, doc.internal.pageSize.width - 50, 90);

  // Main Content
  let y = 120;

  // Title
  doc
    .setFontSize(22)
    .setTextColor(...primaryColor)
    .setFont("helvetica", "bold")
    .text(`Design Fee Proposal`, 50, y);

  doc
    .setFontSize(12)
    .setTextColor(100, 100, 100)
    .setFont("helvetica", "italic")
    .text(`Date: ${formattedDate}`, doc.internal.pageSize.width - 50, y, {
      align: "right",
    });

  // Basic info - Friendly letter format
  y += 40;
  doc.setFontSize(12).setTextColor(0, 0, 0).setFont("helvetica", "normal");

  // Greeting
  const greetingText = `Dear ${clientName || "Valued Client"},`;
  doc.text(greetingText, 50, y);
  y += 20;

  // Main message
  const mainMessage = [
    `Thank you for considering our design services. We're delighted to work with you on your project.`,
    `Based on the approximate area of ${
      area || "___"
    } sq.ft, the estimated design fee is:`,
  ];

  mainMessage.forEach((line, i) => {
    if (y > 750) {
      doc.addPage();
      y = 60;
    }
    doc.text(line, 50, y + i * 20);
  });
  y += mainMessage.length * 20;

  // Fee display
  doc
    .setFont("helvetica", "bold")
    .text(`Rs. ${result?.toLocaleString() || "0"}`, 50, y);
  y += 30;

  // Closing note
  const closingNote = [
    "Please don't hesitate to reach out if you have any questions or need clarification.",
    "We're happy to discuss any aspect of this proposal at your convenience.",
  ];

  closingNote.forEach((line, i) => {
    if (y > 750) {
      doc.addPage();
      y = 60;
    }
    doc.setFont("helvetica", "normal").text(line, 50, y + i * 20);
  });
  y += closingNote.length * 20 + 10;

  // Divider
  doc
    .setDrawColor(...lightGray)
    .setLineWidth(0.5)
    .line(50, y, doc.internal.pageSize.width - 50, y);
  y += 20;

  // Selected Services
  doc
    .setFontSize(14)
    .setTextColor(...primaryColor)
    .setFont("helvetica", "bold")
    .text("Selected Services", 50, y);
  y += 20;

  // Services table
  const selectedServices = Object.keys(selectedComponents).filter(
    (s) => selectedComponents[s]
  );

  autoTable(doc, {
    startY: y,
    head: [["Service", "Fee (Rs.)"]],
    body: selectedServices.map((service) => [
      service,
      `Rs. ${Math.round(serviceFees[service] || 0).toLocaleString()}`,
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
      1: { cellWidth: "auto", halign: "right" },
    },
    margin: { left: 50, right: 50 },
    styles: {
      lineColor: lightGray,
      lineWidth: 0.3,
    },
  } as UserOptions);

  y = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : y + 20;

  // Service Descriptions
  doc
    .setFontSize(14)
    .setTextColor(...primaryColor)
    .setFont("helvetica", "bold")
    .text("Service Descriptions", 50, y);
  y += 20;

  // Add descriptions
  let currentY = y;
  selectedServices.forEach((service) => {
    const description = componentDescriptions[service];
    const text = `• ${service}: ${description}`;

    if (currentY > 750) {
      doc.addPage();
      currentY = 60;
    }

    const splitText = doc.splitTextToSize(text, 495);
    doc.setFontSize(10).setTextColor(0, 0, 0).setFont("helvetica", "normal");
    doc.text(splitText, 50, currentY);
    currentY += splitText.length * 12 + 8;
  });

  currentY += 10;

  // Disclaimer
  doc
    .setFontSize(12)
    .setTextColor(0, 0, 0)
    .setFont("helvetica", "bold")
    .text("Terms and Conditions", 50, currentY);
  currentY += 15;

  const disclaimerText = `The advance amount is payable at the time of the site visit. A detailed breakdown of deliverables and the payment schedule will be provided following the site visit. All quoted amounts are subject to revision based on changes in the approximate square footage. This quote remains valid for 10 days from the date of generation or until a formal contract is executed, whichever comes first. If any legal or property-related discrepancies are identified during the initial sketch design stage, a project halt report shall be issued, and the advance amount paid shall be non-refundable.`;

  doc.setFontSize(10).setFont("helvetica", "normal");
  const splitDisclaimer = doc.splitTextToSize(disclaimerText, 495);
  doc.text(splitDisclaimer, 50, currentY);

  // Save PDF
  const fileName = `Design-Fee-Proposal-${(clientName || "Client").replace(
    /\s+/g,
    "-"
  )}-${formattedDate.replace(/\//g, "-")}.pdf`;
  doc.save(fileName);
};
