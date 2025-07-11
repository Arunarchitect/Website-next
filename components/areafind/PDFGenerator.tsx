import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { SelectedSpace } from "./types";

// Define type extension for jsPDF with autoTable
interface JSPDFAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export const generatePDF = (
  clientName: string,
  selectedSpaces: SelectedSpace[],
  wallPercentage: number,
  circulationPercentage: number,
  totalArea: number
): void => {
  const doc = new jsPDF() as JSPDFAutoTable;
  const today = new Date().toLocaleDateString();

  // Set default styles
  doc.setFont("helvetica");
  doc.setTextColor(50, 50, 50);

  // Header
  doc.setFontSize(16);
  doc.text(`Space Planning Report for ${clientName}`, 20, 20);
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${today}`, 160, 20);

  // Space list table
  doc.setFontSize(12);
  doc.text("Selected Spaces:", 20, 40);

  autoTable(doc, {
    startY: 45,
    head: [['No.', 'Space Type', 'Area (sqft)']],
    body: selectedSpaces.map((space, index) => [
      index + 1,
      space.type.name,
      space.customArea.toLocaleString()
    ]),
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [50, 50, 50],
      fontStyle: 'normal'
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
      lineColor: [220, 220, 220],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'right' }
    }
  });

  // Calculations section
  const subtotal = selectedSpaces.reduce((sum, space) => sum + space.customArea, 0);
  const wallArea = Math.round(subtotal * (wallPercentage / 100));
  const circulationArea = Math.round(subtotal * (circulationPercentage / 100));

  doc.setFontSize(12);
  const tableFinalY = doc.lastAutoTable?.finalY ?? 40;
  doc.text("Area Calculations:", 20, tableFinalY + 15);

  autoTable(doc, {
    startY: tableFinalY + 20,
    body: [
      ['Base Area', subtotal.toLocaleString() + ' sqft'],
      [`+ ${wallPercentage}% Walls`, wallArea.toLocaleString() + ' sqft'],
      [`+ ${circulationPercentage}% Circulation`, circulationArea.toLocaleString() + ' sqft'],
      ['Total Area', totalArea.toLocaleString() + ' sqft']
    ],
    styles: {
      fontSize: 10,
      cellPadding: 4,
      lineColor: [220, 220, 220],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.row.index === 3) {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }
    }
  } as UserOptions);

  // Footer with clickable link
  const pageCount = doc.getNumberOfPages();
  const footerText = "Generated by modelflick.com/tools";
  const footerUrl = "https://modelflick.com/tools";
  const footerHeight = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer background
    doc.setFillColor(245, 245, 245);
    doc.rect(0, doc.internal.pageSize.getHeight() - footerHeight, pageWidth, footerHeight, 'F');
    
    // Footer text with clickable link
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 255);
    doc.textWithLink(footerText, pageWidth - 20, doc.internal.pageSize.getHeight() - 10, {
      url: footerUrl,
      align: 'right'
    });
    
    // Page number
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      20,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // Save the PDF
  doc.save(`Space_Plan_${clientName.replace(/\s+/g, '_')}_${today.replace(/\//g, '-')}.pdf`);
};