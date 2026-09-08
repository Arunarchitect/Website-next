"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PrintableRow {
  space?: string;
  item: string;
  manufacturer: string;
  model_label: string;
  priceLabel: string | null;
  status: string;
  proposed_by: string;
  imageSrc?: string | null;
  product_link?: string | null;
  // Proposer's own note (why they picked this item) and, if the assignment
  // was declined, the decliner's note — both optional, both printed when
  // present.
  proposerNote?: string | null;
  declinedNote?: string | null;
}

export interface PrintableTotal {
  currency: string;
  total: number;
}

interface ProductListPrintProps {
  orgName: string;
  projectName: string;
  scopeLabel: string;
  rows: PrintableRow[];
  totals: PrintableTotal[];
  className?: string;
  label?: string;
}

/**
 * Format total amount
 */
function formatTotalLine(t: PrintableTotal): string {
  return `${t.currency} ${t.total.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Load image using a proxy approach that avoids CORS issues
 * Returns both the data URL and original dimensions
 */
async function loadImageForPdf(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url) return null;

  // Try multiple approaches to load the image
  const approaches = [
    // Approach 1: Direct Image with crossOrigin
    async () => {
      return new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxSize = 300;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            // Maintain aspect ratio while limiting size
            const aspectRatio = width / height;
            if (width > height) {
              if (width > maxSize) {
                width = maxSize;
                height = Math.round(width / aspectRatio);
              }
            } else {
              if (height > maxSize) {
                height = maxSize;
                width = Math.round(height * aspectRatio);
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve({
              dataUrl: canvas.toDataURL('image/png'),
              width: img.naturalWidth,
              height: img.naturalHeight
            });
          } catch {
            console.error('Error processing image');
            resolve(null);
          }
        };
        
        img.onerror = () => {
          resolve(null);
        };
        
        img.src = url;
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });
    },
    
    // Approach 2: Use CORS proxy
    async () => {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) return null;
        
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Process the image
        return new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const maxSize = 300;
              let width = img.naturalWidth;
              let height = img.naturalHeight;
              
              const aspectRatio = width / height;
              if (width > height) {
                if (width > maxSize) {
                  width = maxSize;
                  height = Math.round(width / aspectRatio);
                }
              } else {
                if (height > maxSize) {
                  height = maxSize;
                  width = Math.round(height * aspectRatio);
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(null);
                return;
              }
              
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              
              resolve({
                dataUrl: canvas.toDataURL('image/png'),
                width: img.naturalWidth,
                height: img.naturalHeight
              });
            } catch {
              resolve(null);
            }
          };
          
          img.onerror = () => resolve(null);
          img.src = dataUrl;
          
          setTimeout(() => resolve(null), 5000);
        });
      } catch {
        return null;
      }
    }
  ];

  // Try each approach
  for (const approach of approaches) {
    try {
      const result = await approach();
      if (result) {
        return result;
      }
    } catch {
      console.warn('Image loading approach failed');
    }
  }

  return null;
}

// Define a type for the autoTable document with lastAutoTable property
interface AutoTableDoc extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

/**
 * Build the display string for the Notes column: proposer's note (labeled
 * with who proposed it) and, if declined, the decline note — each on its
 * own line, only included when present.
 */
function buildNotesText(row: PrintableRow): string {
  const parts: string[] = [];
  if (row.proposerNote) {
    parts.push(`Note (${row.proposed_by}): ${row.proposerNote}`);
  }
  if (row.declinedNote) {
    parts.push(`Declined: ${row.declinedNote}`);
  }
  return parts.join("\n");
}

/**
 * Generate the Product List PDF
 */
export async function generateProductListPdf(
  props: ProductListPrintProps
): Promise<void> {
  const {
    orgName,
    projectName,
    scopeLabel,
    rows,
    totals,
  } = props;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  }) as AutoTableDoc;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const generatedAt = new Date().toLocaleString("en-IN");

  // Header is drawn once, on page 1 only — repeating it on every page
  // pushed useful table rows down for no benefit. The essentials (org,
  // project, scope, page number) travel instead via the compact footer
  // that's drawn on every page after the table.
  function drawHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(28, 37, 33);
    doc.text("Product List", margin, margin + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 117, 112);
    doc.text(`${orgName} · ${projectName}`, margin, margin + 12);
    doc.text(`Scope: ${scopeLabel}  ·  Generated: ${generatedAt}`, margin, margin + 18);
  }
  drawHeader();

  // ============================================================
  // DETERMINE COLUMNS
  // ============================================================
  const showSpaceColumn = rows.some((row) => Boolean(row.space));
  const showLinkColumn = rows.some((row) => Boolean(row.product_link));
  const showNotesColumn = rows.some((row) => Boolean(row.proposerNote) || Boolean(row.declinedNote));

  const headers: string[] = ["#"];
  if (showSpaceColumn) headers.push("Space");
  headers.push("Image", "Item", "Manufacturer / Model", "Price", "Status", "Proposed By");
  if (showNotesColumn) headers.push("Notes");
  if (showLinkColumn) headers.push("Product Link");

  // ============================================================
  // LOAD ALL PRODUCT IMAGES
  // ============================================================
  console.log("Loading product images...");
  const images: Array<{ dataUrl: string; width: number; height: number } | null> = await Promise.all(
    rows.map(async (row) => {
      if (!row.imageSrc) return null;
      const imageData = await loadImageForPdf(row.imageSrc);
      if (!imageData) {
        console.warn(`Failed to load image for ${row.item}: ${row.imageSrc}`);
      }
      return imageData;
    })
  );
  
  console.log(`Loaded ${images.filter(img => img !== null).length} of ${images.length} images`);

  // ============================================================
  // CREATE TABLE DATA
  // ============================================================
  const tableData = rows.map((row, index) => {
    const values: string[] = [String(index + 1)];
    if (showSpaceColumn) values.push(row.space || "");
    values.push(""); // Image placeholder
    values.push(row.item);
    values.push(`${row.manufacturer} - ${row.model_label}`);
    values.push(row.priceLabel || "-");
    values.push(row.status);
    values.push(row.proposed_by);
    if (showNotesColumn) values.push(buildNotesText(row));
    if (showLinkColumn) values.push(""); // Empty string for link column - we'll draw it manually
    return values;
  });

  // ============================================================
  // IMAGE COLUMN INDEX
  // ============================================================
  // Shifted by 1 to account for the leading "#" numbering column.
  const imageColumnIndex = showSpaceColumn ? 2 : 1;

  // ============================================================
  // GENERATE TABLE
  // ============================================================
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: margin + 24,
    margin: { left: margin, right: margin, top: margin + 24, bottom: 20 },
    didDrawPage: () => {
      drawHeader();
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      overflow: "linebreak",
      textColor: [28, 37, 33],
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
      valign: "middle",
    },
    headStyles: {
      fillColor: [237, 239, 234],
      textColor: [28, 37, 33],
      fontStyle: "bold",
      fontSize: 9.5,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [248, 249, 247],
    },
    columnStyles: {
      [imageColumnIndex]: {
        cellWidth: 30,
        halign: "center",
        valign: "middle",
      },
      ...(showNotesColumn
        ? {
            [headers.indexOf("Notes")]: {
              cellWidth: 45,
              fontSize: 8,
              valign: "top",
            },
          }
        : {}),
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;

      // Reserve height for images with more space
      if (data.column.index === imageColumnIndex) {
        if (images[data.row.index]) {
          data.cell.styles.minCellHeight = 35;
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const rowIndex = data.row.index;

      // Draw image
      if (data.column.index === imageColumnIndex) {
        const imageData = images[rowIndex];
        
        if (imageData) {
          try {
            // Calculate available space
            const maxWidth = data.cell.width - 6;
            const maxHeight = data.cell.height - 6;
            
            // Get original aspect ratio
            const aspectRatio = imageData.width / imageData.height;
            
            // Calculate dimensions that fit within available space while maintaining aspect ratio
            let drawWidth = maxWidth;
            let drawHeight = drawWidth / aspectRatio;
            
            // If height exceeds available space, scale down based on height
            if (drawHeight > maxHeight) {
              drawHeight = maxHeight;
              drawWidth = drawHeight * aspectRatio;
            }
            
            // Center the image in the cell
            const x = data.cell.x + (data.cell.width - drawWidth) / 2;
            const y = data.cell.y + (data.cell.height - drawHeight) / 2;
            
            // Add image with proper dimensions
            doc.addImage(imageData.dataUrl, "PNG", x, y, drawWidth, drawHeight);
          } catch {
            console.error("Could not add image to PDF");
          }
        }
      }

      // Draw product link (only in link column)
      if (showLinkColumn && data.column.index === headers.length - 1) {
        const row = rows[rowIndex];
        if (row?.product_link) {
          try {
            // Make the entire cell clickable
            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
              url: row.product_link,
            });

            // Draw the link text
            const text = "View Link";
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 255);
            
            const x = data.cell.x + 3;
            const y = data.cell.y + data.cell.height / 2 + 1;
            
            doc.text(text, x, y);
            
            // Underline
            const textWidth = doc.getTextWidth(text);
            doc.setDrawColor(0, 0, 255);
            doc.setLineWidth(0.2);
            doc.line(x, y + 0.7, x + textWidth, y + 0.7);
            
            // Reset state
            doc.setTextColor(28, 37, 33);
            doc.setDrawColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
          } catch {
            console.error("Failed to create PDF link");
          }
        }
      }
    },
  });

  // ============================================================
  // TOTALS
  // ============================================================
  const finalY = doc.lastAutoTable?.finalY || pageHeight / 2;

  if (totals.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 37, 33);

    totals.forEach((total, index) => {
      const yPos = finalY + 10 + index * 7;
      doc.text(
        `Total (${total.currency}): ${formatTotalLine(total)}`,
        pageWidth - margin,
        yPos,
        { align: "right" }
      );
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(107, 117, 112);
    doc.text("No priced items yet.", pageWidth - margin, finalY + 10, { align: "right" });
  }

  // ============================================================
  // FOOTER
  // ============================================================
  const footerY = pageHeight - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(138, 147, 142);
  doc.text("Modelflick - Fixture & Product Assignment", margin, footerY);

  // ============================================================
  // PAGE NUMBERS
  // ============================================================
  // Total page count is only known once the table has finished laying
  // out, so this runs as a final pass over every page rather than inside
  // didDrawPage.
  const totalPages = doc.getNumberOfPages(); // FIXED: Changed from doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(138, 147, 142);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  }

  // ============================================================
  // SAVE PDF
  // ============================================================
  const safeScopeLabel = scopeLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const filename = `product-list-${safeScopeLabel || "all-spaces"}.pdf`;
  doc.save(filename);
}

// ================================================================
// PRINT BUTTON
// ================================================================
export default function ProductListPrintButton(props: ProductListPrintProps) {
  const { className, label } = props;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isGenerating) return;

    setIsGenerating(true);

    try {
      await generateProductListPdf(props);
    } catch {
      console.error("Failed to generate PDF");
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      disabled={isGenerating}
    >
      {isGenerating ? "Generating..." : label ?? "Download PDF"}
    </button>
  );
}