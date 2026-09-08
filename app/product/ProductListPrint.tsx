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

function formatTotalLine(t: PrintableTotal): string {
  return `${t.currency} ${t.total.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Loads an image via fetch() + FileReader and draws it to a canvas at PDF
 * size. Relies on the server sending correct CORS headers (see nginx config)
 * and, ideally, on `url` already pointing at a small pre-resized thumbnail
 * rather than the full-size original — that's what actually makes this fast
 * on mobile, since there's far less to download before the canvas work even
 * starts. A single AbortController-based timeout (generous, since mobile
 * networks vary) replaces the old dangling setTimeout race.
 */
async function loadImageForPdf(
  url: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal, mode: "cors" });
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return await new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const maxSize = 300;
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          const aspectRatio = width / height;
          if (width > height) {
            if (width > maxSize) {
              width = maxSize;
              height = Math.round(width / aspectRatio);
            }
          } else if (height > maxSize) {
            height = maxSize;
            width = Math.round(height * aspectRatio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          resolve({
            dataUrl: canvas.toDataURL("image/png"),
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Runs loadImageForPdf across all rows with only `concurrency` requests
 * in flight at once, instead of firing every image fetch simultaneously.
 * On mobile especially, unlimited concurrency means N images all compete
 * for the same limited bandwidth and CPU, and everything slows down
 * together — a small pool finishes faster in practice and is far less
 * likely to hit any single request's timeout.
 */
async function loadImagesWithLimit(
  rows: PrintableRow[],
  concurrency = 4
): Promise<Array<{ dataUrl: string; width: number; height: number } | null>> {
  const results: Array<{ dataUrl: string; width: number; height: number } | null> = new Array(
    rows.length
  ).fill(null);
  let index = 0;

  async function worker() {
    while (index < rows.length) {
      const current = index++;
      const row = rows[current];
      if (row.imageSrc) {
        results[current] = await loadImageForPdf(row.imageSrc);
        if (!results[current]) {
          console.warn(`Failed to load image for ${row.item}: ${row.imageSrc}`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  return results;
}

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

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

export async function generateProductListPdf(
  props: ProductListPrintProps
): Promise<void> {
  const { orgName, projectName, scopeLabel, rows, totals } = props;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  }) as AutoTableDoc;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const generatedAt = new Date().toLocaleString("en-IN");

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

  const showSpaceColumn = rows.some((row) => Boolean(row.space));
  const showLinkColumn = rows.some((row) => Boolean(row.product_link));
  const showNotesColumn = rows.some((row) => Boolean(row.proposerNote) || Boolean(row.declinedNote));

  const headers: string[] = ["#"];
  if (showSpaceColumn) headers.push("Space");
  headers.push("Image", "Item", "Manufacturer / Model", "Price", "Status", "Proposed By");
  if (showNotesColumn) headers.push("Notes");
  if (showLinkColumn) headers.push("Product Link");

  console.log("Loading product images...");
  const images = await loadImagesWithLimit(rows, 4);
  console.log(`Loaded ${images.filter((img) => img !== null).length} of ${images.length} images`);

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
    if (showLinkColumn) values.push("");
    return values;
  });

  const imageColumnIndex = showSpaceColumn ? 2 : 1;

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
      if (data.column.index === imageColumnIndex) {
        if (images[data.row.index]) {
          data.cell.styles.minCellHeight = 35;
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const rowIndex = data.row.index;

      if (data.column.index === imageColumnIndex) {
        const imageData = images[rowIndex];

        if (imageData) {
          try {
            const maxWidth = data.cell.width - 6;
            const maxHeight = data.cell.height - 6;
            const aspectRatio = imageData.width / imageData.height;

            let drawWidth = maxWidth;
            let drawHeight = drawWidth / aspectRatio;

            if (drawHeight > maxHeight) {
              drawHeight = maxHeight;
              drawWidth = drawHeight * aspectRatio;
            }

            const x = data.cell.x + (data.cell.width - drawWidth) / 2;
            const y = data.cell.y + (data.cell.height - drawHeight) / 2;

            doc.addImage(imageData.dataUrl, "PNG", x, y, drawWidth, drawHeight);
          } catch {
            console.error("Could not add image to PDF");
          }
        }
      }

      if (showLinkColumn && data.column.index === headers.length - 1) {
        const row = rows[rowIndex];
        if (row?.product_link) {
          try {
            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
              url: row.product_link,
            });

            const text = "View Link";
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 255);

            const x = data.cell.x + 3;
            const y = data.cell.y + data.cell.height / 2 + 1;

            doc.text(text, x, y);

            const textWidth = doc.getTextWidth(text);
            doc.setDrawColor(0, 0, 255);
            doc.setLineWidth(0.2);
            doc.line(x, y + 0.7, x + textWidth, y + 0.7);

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

  const finalY = doc.lastAutoTable?.finalY || pageHeight / 2;

  if (totals.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 37, 33);

    totals.forEach((total, index) => {
      const yPos = finalY + 10 + index * 7;
      doc.text(`Total (${total.currency}): ${formatTotalLine(total)}`, pageWidth - margin, yPos, {
        align: "right",
      });
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(107, 117, 112);
    doc.text("No priced items yet.", pageWidth - margin, finalY + 10, { align: "right" });
  }

  const footerY = pageHeight - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(138, 147, 142);
  doc.text("Modelflick - Fixture & Product Assignment", margin, footerY);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(138, 147, 142);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  }

  const safeScopeLabel = scopeLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const filename = `product-list-${safeScopeLabel || "all-spaces"}.pdf`;
  doc.save(filename);
}

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
    <button type="button" onClick={handleClick} className={className} disabled={isGenerating}>
      {isGenerating ? "Generating..." : label ?? "Download PDF"}
    </button>
  );
}