"use client";

import {
  UNIT_SYSTEMS,
  calcSpaceArea,
  fmt,
  fmtCost,
  fmtDim,
  getFloorLabel,
  type SpaceInstance,
  type UnitKey,
} from "./areadata";

type Totals = {
  net: number;
  wallA: number;
  circA: number;
  gross: number;
  cost: number;
};

type Props = {
  projectName: string;
  clientName?: string;
  spaces: SpaceInstance[];
  unit: UnitKey;
  wall: number;
  circ: number;
  costPerSqft: number;
  totals: Totals;
  floorGroups: Map<number, SpaceInstance[]>;
  locationLabel: string;
  disabled?: boolean;
};

function safeFileName(name: string) {
  return (
    (name || "space-requirement")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "space-requirement"
  );
}

function stripEmoji(value: string) {
  return value.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

function cleanRupee(value: string) {
  return value.replace("₹", "Rs. ");
}

export default function SpaceRequirementPdfButton({
  projectName,
  clientName = "",
  spaces,
  unit,
  wall,
  circ,
  costPerSqft,
  totals,
  floorGroups,
  locationLabel,
  disabled = false,
}: Props) {
  async function downloadPdf() {
    if (disabled || spaces.length === 0) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const usableWidth = pageWidth - margin * 2;
    let y = 16;

    const dark: [number, number, number] = [17, 24, 39];
    const muted: [number, number, number] = [107, 114, 128];
    const line: [number, number, number] = [229, 231, 235];
    const accent: [number, number, number] = [180, 83, 9];
    const green: [number, number, number] = [4, 120, 87];
    const aLabel = UNIT_SYSTEMS[unit].areaLabel;
    const dLabel = UNIT_SYSTEMS[unit].dimLabel;
    const clientDisplayName = clientName.trim() || "Client";
    const generatedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const setText = (
      size: number,
      color: [number, number, number] = dark,
      style: "normal" | "bold" = "normal",
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    };

    const ensurePage = (needed = 16) => {
      if (y + needed > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }
    };

    const addSectionTitle = (title: string) => {
      ensurePage(16);
      setText(11, dark, "bold");
      doc.text(title.toUpperCase(), margin, y);
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2.5, margin + 22, y + 2.5);
      y += 9;
    };

    const addFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setDrawColor(...line);
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        setText(8, muted);
        doc.text("www.modelflick.com", margin, pageHeight - 8);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth - margin,
          pageHeight - 8,
          { align: "right" },
        );
      }
    };

    // ── Cover header ─────────────────────────────────────────
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 42, "F");
    doc.setDrawColor(...line);
    doc.line(margin, 38, pageWidth - margin, 38);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(margin, 12, 42, 8, 2, 2, "F");

    setText(8, accent, "bold");
    doc.text("SPACE REQUIREMENT", margin + 3, 17.5);

    setText(20, dark, "bold");
    doc.text(projectName || "Untitled Project", margin, 30, {
      maxWidth: usableWidth - 56,
    });

    setText(8, muted);
    doc.text(`Generated: ${generatedDate}`, pageWidth - margin, 17, {
      align: "right",
    });
    doc.text("Preliminary area statement", pageWidth - margin, 22, {
      align: "right",
    });
    y = 48;

    // ── Project meta card ────────────────────────────────────
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...line);
    doc.roundedRect(margin, y, usableWidth, 34, 3, 3, "FD");

    const leftX = margin + 5;
    const rightX = margin + usableWidth / 2 + 2;
    setText(8, muted, "bold");
    doc.text("CLIENT", leftX, y + 8);
    doc.text("LOCATION", rightX, y + 8);
    doc.text("RATE", leftX, y + 23);
    doc.text("ALLOWANCES", rightX, y + 23);

    setText(11, dark, "bold");
    doc.text(`Client: ${clientDisplayName}`, leftX, y + 14, {
      maxWidth: usableWidth / 2 - 8,
    });
    setText(10, dark);
    doc.text(
      locationLabel || "Not specified",
      rightX,
      y + 14,
      { maxWidth: usableWidth / 2 - 8 },
    );
    doc.text(`Rs. ${costPerSqft.toLocaleString("en-IN")}/sqft`, leftX, y + 29);
    doc.text(`Wall ${wall}%  |  Circulation ${circ}%`, rightX, y + 29);
    y += 46;

    // ── Summary cards ────────────────────────────────────────
    const cardGap = 4;
    const cardW = (usableWidth - cardGap * 3) / 4;
    const cards: Array<{ label: string; value: string; strong?: boolean }> = [
      { label: "Net Carpet", value: `${fmt(totals.net, unit)} ${aLabel}` },
      { label: `Wall Area`, value: `+ ${fmt(totals.wallA, unit)} ${aLabel}` },
      { label: `Circulation`, value: `+ ${fmt(totals.circA, unit)} ${aLabel}` },
      {
        label: "Gross Built-up",
        value: `${fmt(totals.gross, unit)} ${aLabel}`,
        strong: true,
      },
    ];

    cards.forEach((card, index) => {
      const x = margin + index * (cardW + cardGap);
      if (card.strong) {
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(245, 158, 11);
      } else {
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(...line);
      }
      doc.roundedRect(x, y, cardW, 25, 3, 3, "FD");
      setText(7.5, muted, "bold");
      doc.text(card.label.toUpperCase(), x + 3, y + 7);
      setText(card.strong ? 11 : 10, card.strong ? accent : dark, "bold");
      doc.text(card.value, x + 3, y + 17, { maxWidth: cardW - 6 });
    });
    y += 34;

    // ── Cost band ────────────────────────────────────────────
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, y, usableWidth, 22, 3, 3, "FD");
    setText(8, green, "bold");
    doc.text("ESTIMATED CONSTRUCTION COST", margin + 5, y + 8);
    setText(17, green, "bold");
    doc.text(cleanRupee(fmtCost(totals.cost)), margin + 5, y + 17);
    setText(8, green);
    doc.text(
      `Based on gross built-up area @ Rs. ${costPerSqft.toLocaleString("en-IN")}/sqft`,
      pageWidth - margin - 5,
      y + 14,
      { align: "right" },
    );
    y += 34;

    // ── Area breakdown by type ───────────────────────────────
    addSectionTitle("Area Breakdown by Type");

    // Dynamically import CATEGORY_META for the breakdown section
    const { CATEGORY_META } = await import("./areadata");

    Object.entries(CATEGORY_META).forEach(([cat, meta]) => {
      const catSpaces = spaces.filter((s) => s.category === cat);
      if (!catSpaces.length) return;
      const catArea = catSpaces.reduce((sum, s) => sum + calcSpaceArea(s), 0);

      ensurePage(10);
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(...line);
      doc.roundedRect(margin, y - 4, usableWidth, 8, 2, 2, "FD");
      setText(8.5, dark, "bold");
      doc.text(meta.label, margin + 3, y + 1);
      setText(8.5, dark, "bold");
      doc.text(
        `${fmt(catArea, unit)} ${aLabel}`,
        pageWidth - margin - 3,
        y + 1,
        { align: "right" },
      );
      y += 10;
    });
    y += 4;

    // ── Detailed space requirement ───────────────────────────
    addSectionTitle("Detailed Space Requirement");

    Array.from(floorGroups.entries()).forEach(([floor, floorSpaces]) => {
      const floorArea = floorSpaces.reduce(
        (sum, s) => sum + calcSpaceArea(s),
        0,
      );
      ensurePage(24);

      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(...line);
      doc.roundedRect(margin, y, usableWidth, 10, 2, 2, "FD");
      setText(9, dark, "bold");
      doc.text(getFloorLabel(floor), margin + 4, y + 6.5);
      doc.text(
        `${fmt(floorArea, unit)} ${aLabel}`,
        pageWidth - margin - 4,
        y + 6.5,
        { align: "right" },
      );
      y += 15;

      setText(7.5, muted, "bold");
      doc.text("SPACE", margin, y);
      doc.text(`L x B (${dLabel})`, margin + 72, y);
      doc.text(`MAIN AREA (${aLabel})`, margin + 104, y);
      doc.text(`TOTAL (${aLabel})`, margin + 130, y);
      doc.text("DESCRIPTION", margin + 153, y);
      doc.setDrawColor(...line);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 7;

      floorSpaces.forEach((space) => {
        const mainArea = space.L * space.B;
        const totalArea = calcSpaceArea(space);
        const hasSubSpaces = space.subSpaces.length > 0;
        const spaceName = stripEmoji(space.name) || space.name;
        const descriptionLines = doc
          .splitTextToSize(space.description || "-", 38)
          .slice(0, 4);
        const rowHeight = Math.max(10, descriptionLines.length * 4 + 4);
        ensurePage(rowHeight + 8);

        setText(8.7, dark, "bold");
        doc.text(spaceName, margin, y, { maxWidth: 66 });
        setText(8, dark);
        doc.text(
          `${fmtDim(space.L, unit)} x ${fmtDim(space.B, unit)}`,
          margin + 72,
          y,
        );
        doc.text(fmt(mainArea, unit), margin + 104, y);
        doc.text(hasSubSpaces ? "-" : fmt(totalArea, unit), margin + 130, y);
        setText(7.5, muted);
        doc.text(descriptionLines, margin + 153, y);
        y += rowHeight;

        space.subSpaces.forEach((sub) => {
          const subDescription = doc
            .splitTextToSize(sub.description || "-", 38)
            .slice(0, 2);
          const subHeight = Math.max(7, subDescription.length * 4 + 2);
          ensurePage(subHeight + 5);

          setText(7.7, muted);
          doc.text(`- ${stripEmoji(sub.name)}`, margin + 4, y, {
            maxWidth: 64,
          });
          doc.text(
            `${fmtDim(sub.L, unit)} x ${fmtDim(sub.B, unit)}`,
            margin + 72,
            y,
          );
          doc.text(fmt(sub.L * sub.B, unit), margin + 104, y);
          doc.text("-", margin + 130, y);
          doc.text(subDescription, margin + 153, y);
          y += subHeight;
        });

        if (hasSubSpaces) {
          ensurePage(8);
          doc.setFillColor(255, 251, 235);
          doc.setDrawColor(253, 230, 138);
          doc.roundedRect(
            margin + 96,
            y - 4.5,
            usableWidth - 96,
            7,
            1.5,
            1.5,
            "FD",
          );
          setText(7.7, accent, "bold");
          doc.text(`Total ${spaceName}`, margin + 104, y);
          doc.text(
            `${fmt(totalArea, unit)} ${aLabel}`,
            pageWidth - margin - 3,
            y,
            { align: "right" },
          );
          y += 8;
        }

        doc.setDrawColor(243, 244, 246);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
        y += 2;
      });
      y += 5;
    });

    // ── Disclaimer note ──────────────────────────────────────
    ensurePage(25);
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(...line);
    doc.roundedRect(margin, y, usableWidth, 22, 3, 3, "FD");
    setText(8.5, dark, "bold");
    doc.text("NOTE", margin + 5, y + 7);
    setText(8, muted);
    doc.text(
      "This is a preliminary space requirement and area estimate for architectural discussion and future reference. Final areas may vary after design development, structural planning, services coordination, statutory checks, and site-specific decisions.",
      margin + 5,
      y + 13,
      { maxWidth: usableWidth - 10 },
    );

    addFooter();
    doc.save(`${safeFileName(projectName)}-space-requirement.pdf`);
  }

  return (
    <button
      onClick={downloadPdf}
      disabled={disabled}
      title={
        disabled
          ? "Add at least one space to generate a PDF"
          : "Download PDF report"
      }
      style={{
        fontSize: 13,
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid #a7f3d0",
        background: disabled ? "#f3f4f6" : "#ecfdf5",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        color: disabled ? "#9ca3af" : "#047857",
      }}
    >
      📄 Download PDF Report
    </button>
  );
}