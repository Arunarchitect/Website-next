"use client";

import {
  UNIT_SYSTEMS,
  calcSpaceArea,
  fmt,
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

/** Remove characters jsPDF can't render (superscripts, etc.) */
function sanitizeText(value: string): string {
  // Replace common problematic chars with ASCII equivalents
  return value
    .replace(/[²³¹]/g, "")
    .replace(/[^\x00-\x7E\u00A0-\u00FF]/g, "");
}

// ── Unit conversion helpers ───────────────────────────────────
const SQM_PER_SQFT = 0.0929;
const M_PER_FT     = 0.3048;

function altAreaStr(sqftValue: number, primaryUnit: UnitKey): string {
  if (primaryUnit === "sqft") {
    const m2 = sqftValue * SQM_PER_SQFT;
    return `${m2.toLocaleString("en-IN", { maximumFractionDigits: 1 })} m\u00B2`;
  } else {
    return `${sqftValue.toLocaleString("en-IN", { maximumFractionDigits: 1 })} sqft`;
  }
}

function altDimStr(ftValue: number, primaryUnit: UnitKey): string {
  if (primaryUnit === "sqft") {
    return `${(ftValue * M_PER_FT).toFixed(2)} m`;
  } else {
    return `${ftValue.toFixed(1)} ft`;
  }
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
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const PW  = doc.internal.pageSize.getWidth();   // 210 mm
    const PH  = doc.internal.pageSize.getHeight();  // 297 mm
    const ML  = 14;
    const UW  = PW - ML * 2;                        // 182 mm usable width
    let   y   = 0;

    // ── Colour palette ────────────────────────────────────────
    const C_DARK   : [number,number,number] = [22,  28,  36 ];
    const C_MED    : [number,number,number] = [55,  65,  81 ];
    const C_MUTED  : [number,number,number] = [107, 114, 128];
    const C_RULE   : [number,number,number] = [209, 213, 219];
    const C_ACCENT : [number,number,number] = [146, 64,  14 ];
    const C_GREEN  : [number,number,number] = [6,   95,  70 ];
    const C_ALT    : [number,number,number] = [140, 140, 140];
    const C_TINT   : [number,number,number] = [249, 250, 251];
    const C_AMBER_TINT: [number,number,number] = [255, 253, 235];

    const aLabel = UNIT_SYSTEMS[unit].areaLabel;
    const dLabel = UNIT_SYSTEMS[unit].dimLabel;
    const altALabel = unit === "sqft" ? "m\u00B2" : "sqft";
    const altDLabel = unit === "sqft" ? "m"       : "ft";

    // ── Helpers ───────────────────────────────────────────────
    const T = (
      size: number,
      color: [number,number,number] = C_DARK,
      style: "normal" | "bold" = "normal",
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    };

    const rule = (
      x1: number, y1: number, x2: number, y2: number,
      color: [number,number,number] = C_RULE,
      w = 0.25,
    ) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(w);
      doc.line(x1, y1, x2, y2);
    };

    const ensurePage = (needed = 16) => {
      if (y + needed > PH - 16) { doc.addPage(); y = 16; }
    };

    const sectionTitle = (title: string) => {
      ensurePage(14);
      rule(ML, y, PW - ML, y);
      y += 5.5;
      T(7, C_ACCENT, "bold");
      doc.text(title.toUpperCase(), ML, y);
      y += 6;
    };

    const generatedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const clientDisplayName = clientName.trim() || "\u2014";

    // ────────────────────────────────────────────────────────
    // PAGE 1 — HEADER
    // ────────────────────────────────────────────────────────
    y = 14;

    doc.setFillColor(...C_ACCENT);
    doc.rect(ML, y, UW, 0.6, "F");
    y += 5;

    T(6.5, C_ACCENT, "bold");
    doc.text("SPACE REQUIREMENT", ML, y);
    T(7, C_MUTED);
    doc.text(`Generated  ${generatedDate}`, PW - ML, y, { align: "right" });
    y += 5;

    T(18, C_DARK, "bold");
    doc.text(projectName || "Untitled Project", ML, y, { maxWidth: UW - 56 });
    y += 7;

    T(8, C_MED);
    doc.text(
      `${clientDisplayName}   \u00B7   ${locationLabel || "Location not set"}`,
      ML, y,
      { maxWidth: UW },
    );
    y += 10;

    rule(ML, y, PW - ML, y);
    y += 7;

    // ── Project meta ──────────────────────────────────────────
    const metaL: [string, string][] = [
      ["Construction Rate", `Rs. ${costPerSqft.toLocaleString("en-IN")} / sqft`],
      ["Wall Allowance",    `${wall}%`],
      ["Circulation",       `${circ}%`],
    ];
    const metaR: [string, string][] = [
      ["Unit",   `${aLabel}  (${altALabel} in brackets)`],
      ["Status", "Preliminary Estimate"],
    ];

    const metaRowH = 8;
    const colMid   = ML + UW / 2;

    metaL.forEach(([label, value], i) => {
      const ry = y + i * metaRowH;
      T(6.5, C_MUTED);      doc.text(label, ML,      ry);
      T(8,   C_DARK, "bold"); doc.text(value, ML + 28, ry);
    });
    metaR.forEach(([label, value], i) => {
      const ry = y + i * metaRowH;
      T(6.5, C_MUTED);      doc.text(label, colMid,      ry);
      T(8,   C_DARK, "bold"); doc.text(value, colMid + 20, ry);
    });
    y += Math.max(metaL.length, metaR.length) * metaRowH + 4;

    rule(ML, y, PW - ML, y);
    y += 8;

    // ── Summary cards ─────────────────────────────────────────
    const cGap = 3;
    const cW   = (UW - cGap * 3) / 4;
    const cH   = 22;

    const cards = [
      { label: "Net Carpet",     value: `${fmt(totals.net,   unit)}`,  strong: false },
      { label: "Wall Area",      value: `+ ${fmt(totals.wallA,unit)}`, strong: false },
      { label: "Circulation",    value: `+ ${fmt(totals.circA,unit)}`, strong: false },
      { label: "Gross Built-up", value: `${fmt(totals.gross, unit)}`,  strong: true  },
    ];
    const cardAreaVals = [totals.net, totals.wallA, totals.circA, totals.gross];

    cards.forEach((card, i) => {
      const cx = ML + i * (cW + cGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...(card.strong ? C_ACCENT : C_RULE));
      doc.setLineWidth(card.strong ? 0.6 : 0.3);
      doc.rect(cx, y, cW, cH, "FD");

      T(6.5, C_MUTED, "bold");
      doc.text(card.label.toUpperCase(), cx + 3.5, y + 6.5);

      T(card.strong ? 10 : 9, card.strong ? C_ACCENT : C_DARK, "bold");
      doc.text(card.value, cx + 3.5, y + 14);

      const valW = doc.getTextWidth(card.value);
      T(7, card.strong ? C_ACCENT : C_MUTED);
      doc.text(` ${aLabel}`, cx + 3.5 + valW, y + 14);

      // Alt unit on second line
      T(6.5, C_ALT);
      doc.text(altAreaStr(cardAreaVals[i], unit), cx + 3.5, y + 20);
    });
    y += cH + 5;

    // ── Cost band ─────────────────────────────────────────────
    doc.setFillColor(248, 252, 249);
    doc.setDrawColor(...C_RULE);
    doc.setLineWidth(0.25);
    doc.roundedRect(ML, y, UW, 17, 2, 2, "FD");
    doc.setFillColor(...C_GREEN);
    doc.rect(ML, y + 1.5, 2, 14, "F");

    T(7, C_GREEN, "bold");
    doc.text("ESTIMATED CONSTRUCTION COST", ML + 6, y + 6.5);
    T(13, C_GREEN, "bold");
    const costStr = (totals.cost >= 1e7)
      ? `Rs. ${(totals.cost / 1e7).toFixed(2)} Cr`
      : `Rs. ${(totals.cost / 1e5).toFixed(2)} L`;
    doc.text(costStr, ML + 6, y + 14);

    T(7, C_MUTED);
    doc.text(
      `${fmt(totals.gross, unit)} ${aLabel}  x  Rs. ${costPerSqft.toLocaleString("en-IN")} / sqft`,
      PW - ML - 3, y + 14, { align: "right" },
    );
    y += 26;

    // ────────────────────────────────────────────────────────
    // AREA BREAKDOWN BY SPACE TYPE
    // ────────────────────────────────────────────────────────
    const { CATEGORY_META } = await import("./areadata");

    sectionTitle("Area Breakdown by Space Type");

    T(6.5, C_MUTED, "bold");
    doc.text("SPACE TYPE",           ML,           y);
    doc.text(`AREA (${aLabel})`,     PW - ML - 60, y);
    doc.text(`(${altALabel})`,       PW - ML - 24, y);
    doc.text("% OF NET",             PW - ML,      y, { align: "right" });
    y += 3;
    rule(ML, y, PW - ML, y, C_RULE, 0.2);
    y += 5;

    Object.entries(CATEGORY_META).forEach(([cat, meta]) => {
      const catSpaces = spaces.filter((s) => s.category === cat);
      if (!catSpaces.length) return;
      const catArea = catSpaces.reduce((sum, s) => sum + calcSpaceArea(s), 0);
      const pct     = totals.net > 0 ? ((catArea / totals.net) * 100).toFixed(1) : "\u2014";

      ensurePage(8);
      T(8, C_DARK);
      doc.text(meta.label, ML, y);
      T(8, C_DARK, "bold");
      doc.text(`${fmt(catArea, unit)}`, PW - ML - 60, y);
      T(7, C_ALT);
      doc.text(altAreaStr(catArea, unit), PW - ML - 24, y);
      T(7.5, C_MUTED);
      doc.text(`${pct}%`, PW - ML, y, { align: "right" });
      y += 7;
    });

    rule(ML, y, PW - ML, y, C_RULE, 0.3);
    y += 4;
    T(8, C_DARK, "bold");
    doc.text("Net Carpet Total", ML, y);
    doc.text(`${fmt(totals.net, unit)} ${aLabel}`, PW - ML - 60, y);
    T(7, C_ALT);
    doc.text(altAreaStr(totals.net, unit), PW - ML - 24, y);
    y += 10;

    // ────────────────────────────────────────────────────────
    // DETAILED SPACE REQUIREMENT
    // ────────────────────────────────────────────────────────
    sectionTitle("Detailed Space Requirement");

    // ── Column positions ──────────────────────────────────────
    // NAME: ML–ML+44  (44 mm)
    // DIMS: ML+46     (40 mm)
    // AREA: ML+100    (28 mm)
    // TOTL: ML+132    (28 mm)
    // DESC: ML+163    (rest ~19 mm)
    const CN  = ML;
    const CDM = ML + 46;
    const CIA = ML + 100;
    const CTO = ML + 132;
    const CDX = ML + 163;
    const NAME_W = 42;
    const DIM_W  = 50;
    const DESC_W = PW - ML - CDX;   // ~19 mm — just for short notes

    // Column headers
    T(6.5, C_MUTED, "bold");
    doc.text("SPACE / ROOM", CN,  y);
    doc.text("DIMENSIONS",   CDM, y);
    doc.text("AREA",         CIA, y);
    doc.text("TOTAL",        CTO, y);
    doc.text("NOTES",        CDX, y);

    // Sub-headers (unit labels)
    T(6, C_ALT);
    doc.text(`${dLabel}  (${altDLabel})`,       CDM, y + 3.5);
    doc.text(`${aLabel} (${altALabel})`,         CIA, y + 3.5);
    doc.text(`${aLabel} (${altALabel})`,         CTO, y + 3.5);

    y += 6;
    rule(ML, y, PW - ML, y, C_RULE, 0.35);
    y += 4;

    // ── Floor groups ──────────────────────────────────────────
    Array.from(floorGroups.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([floor, floorSpaces]) => {
        const floorArea = floorSpaces.reduce((s, sp) => s + calcSpaceArea(sp), 0);
        ensurePage(22);

        // Floor banner
        doc.setFillColor(...C_TINT);
        doc.setDrawColor(...C_RULE);
        doc.setLineWidth(0.25);
        doc.roundedRect(ML, y, UW, 9, 1.5, 1.5, "FD");

        T(8.5, C_DARK, "bold");
        doc.text(getFloorLabel(floor), CN + 3, y + 6);

        // ── FIX: primary value first, alt in brackets after ──
        const fPrimary = `${fmt(floorArea, unit)} ${aLabel}`;
        const fAlt     = `(${altAreaStr(floorArea, unit)})`;
        T(8.5, C_DARK, "bold");
        doc.text(fPrimary, PW - ML - 3, y + 6, { align: "right" });
        const fPrimW = doc.getTextWidth(fPrimary);
        T(6.5, C_ALT);
        doc.text(fAlt, PW - ML - 3 - fPrimW - 3, y + 6, { align: "right" });

        y += 13;

        // ── Space rows ────────────────────────────────────────
        floorSpaces.forEach((space, rowIdx) => {
          const mainArea  = space.L * space.B;
          const totalArea = calcSpaceArea(space);
          const hasSubs   = space.subSpaces.length > 0;

          // ── FIX: sanitize name, hard-truncate to NAME_W ─────
          const name = sanitizeText(stripEmoji(space.name) || space.name);
          const nameLines = doc.splitTextToSize(name, NAME_W) as string[];
          // Limit to 2 lines max — long run-on names won't push columns
          const nameLinesClipped = nameLines.slice(0, 2);

          // Description — clamp to DESC_W and 2 lines
          const rawDesc   = sanitizeText(space.description || "");
          const descLines = (doc.splitTextToSize(rawDesc, DESC_W) as string[]).slice(0, 2);

          // Row height: 2 text baselines (primary + alt) = ~10mm, plus padding
          // If name wraps to 2 lines, add extra height
          const nameExtraH = nameLinesClipped.length > 1 ? 4 : 0;
          const rowH = Math.max(14, nameExtraH + 14);
          ensurePage(rowH + 6);

          // Alternating tint
          if (rowIdx % 2 === 0) {
            doc.setFillColor(251, 251, 252);
            doc.rect(ML, y, UW, rowH, "F");
          }

          // ── Space name ──────────────────────────────────────
          T(8, C_DARK, "bold");
          doc.text(nameLinesClipped, CN, y + 5);
          if (space.isCustom) {
            T(6, C_MUTED);
            doc.text("Custom", CN, y + 5 + (nameLinesClipped.length > 1 ? 8 : 4));
          }

          // ── Dimensions ──────────────────────────────────────
          // Keep dims on one line each — truncate to DIM_W
          const primDim  = `${fmtDim(space.L, unit)} x ${fmtDim(space.B, unit)} ${dLabel}`;
          const altDimTx = `(${altDimStr(space.L, unit)} x ${altDimStr(space.B, unit)})`;

          T(7.5, C_MED);
          doc.text(primDim, CDM, y + 5, { maxWidth: DIM_W });
          T(6.5, C_ALT);
          doc.text(altDimTx, CDM, y + 9.5, { maxWidth: DIM_W });

          // ── Area (L×B of this space) ─────────────────────────
          // ── FIX: pass unit to fmt() ──────────────────────────
          T(7.5, C_DARK);
          doc.text(fmt(mainArea, unit), CIA, y + 5);
          T(6.5, C_ALT);
          doc.text(altAreaStr(mainArea, unit), CIA, y + 9.5);

          // ── Total (includes subs) ────────────────────────────
          if (hasSubs) {
            T(8, C_ACCENT, "bold");
            doc.text(fmt(totalArea, unit), CTO, y + 5);
            T(6.5, C_ALT);
            doc.text(altAreaStr(totalArea, unit), CTO, y + 9.5);
          } else {
            T(7.5, C_DARK);
            doc.text(fmt(totalArea, unit), CTO, y + 5);
            T(6.5, C_ALT);
            doc.text(altAreaStr(totalArea, unit), CTO, y + 9.5);
          }

          // ── Description ──────────────────────────────────────
          if (descLines.length > 0 && rawDesc) {
            T(6.5, C_MUTED);
            doc.text(descLines, CDX, y + 5, { maxWidth: DESC_W });
          }

          y += rowH;

          // ── Sub-space rows ────────────────────────────────────
          space.subSpaces.forEach((sub) => {
            const subArea  = sub.L * sub.B;
            const subName  = sanitizeText(stripEmoji(sub.name) || sub.name);
            const subDesc  = sanitizeText(sub.description || "");
            const subDescL = (doc.splitTextToSize(subDesc, DESC_W) as string[]).slice(0, 2);
            const subRowH  = 11;
            ensurePage(subRowH + 4);

            doc.setFillColor(252, 252, 254);
            doc.rect(ML, y, UW, subRowH, "F");

            doc.setDrawColor(...C_RULE);
            doc.setLineWidth(0.3);
            doc.line(CN + 3, y + 1, CN + 3, y + subRowH - 1);

            T(7.5, C_MED);
            doc.text(`-> ${subName}`, CN + 6, y + 4.5, { maxWidth: NAME_W - 4 });

            const subPrimDim = `${fmtDim(sub.L, unit)} x ${fmtDim(sub.B, unit)} ${dLabel}`;
            T(7.5, C_MED);
            doc.text(subPrimDim, CDM, y + 4.5, { maxWidth: DIM_W });
            T(6.5, C_ALT);
            doc.text(`(${altDimStr(sub.L, unit)} x ${altDimStr(sub.B, unit)})`, CDM, y + 8.5, { maxWidth: DIM_W });

            // ── FIX: pass unit to fmt() for sub area ────────────
            T(7.5, C_MED);
            doc.text(fmt(subArea, unit), CIA, y + 4.5);
            T(6.5, C_ALT);
            doc.text(altAreaStr(subArea, unit), CIA, y + 8.5);

            T(7.5, C_ALT);
            doc.text("\u2014", CTO, y + 4.5);

            if (subDescL.length > 0 && subDesc) {
              T(6.5, C_MUTED);
              doc.text(subDescL, CDX, y + 4.5, { maxWidth: DESC_W });
            }

            y += subRowH;
          });

          // ── Subtotal band ─────────────────────────────────────
          if (hasSubs) {
            // ── FIX: measure content and use proper height ───────
            const subtotalBandH = 11;
            ensurePage(subtotalBandH + 4);

            doc.setFillColor(...C_AMBER_TINT);
            doc.setDrawColor(252, 211, 77);
            doc.setLineWidth(0.3);
            // Draw band across AREA+TOTAL+DESC columns only (left of name/dims)
            doc.roundedRect(CIA - 2, y, PW - ML - CIA + 2, subtotalBandH, 1.5, 1.5, "FD");

            T(7, C_ACCENT, "bold");
            // Truncate label so it doesn't bleed into value
            const subLabel = doc.splitTextToSize(`Subtotal - ${name}`, 28) as string[];
            doc.text(subLabel.slice(0, 1), CIA, y + 4);

            // ── FIX: render total value cleanly, no text overlap ─
            T(8, C_ACCENT, "bold");
            doc.text(fmt(totalArea, unit), CTO, y + 4);
            T(6.5, C_ALT);
            doc.text(altAreaStr(totalArea, unit), CTO, y + 8.5);

            // Unit label
            T(6.5, C_ACCENT);
            doc.text(aLabel, CTO + doc.getTextWidth(fmt(totalArea, unit)) + 1, y + 4);

            y += subtotalBandH + 3;
          }

          // Row separator
          rule(ML, y, PW - ML, y, [235, 237, 240], 0.2);
          y += 2;
        });

        y += 5;
      });

    // ────────────────────────────────────────────────────────
    // DISCLAIMER NOTE
    // ────────────────────────────────────────────────────────
    ensurePage(22);
    rule(ML, y, PW - ML, y, C_RULE, 0.25);
    y += 6;

    T(6.5, C_MUTED, "bold");
    doc.text("NOTE", ML, y);
    y += 4;
    T(7, C_MUTED);
    const noteText =
      "This is a preliminary space requirement and area estimate prepared for architectural discussion and future reference. " +
      "All dimensions and areas are indicative. Final areas may vary after design development, structural planning, services " +
      "coordination, statutory approvals, and site-specific conditions.";
    const noteLines = doc.splitTextToSize(noteText, UW) as string[];
    doc.text(noteLines, ML, y);

    // ── Footer (all pages) ────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      rule(ML, PH - 12, PW - ML, PH - 12, C_RULE, 0.25);
      T(7, C_MUTED);
      doc.text("www.modelflick.com", ML, PH - 7);
      T(7, C_MUTED);
      doc.text(`Page ${i} of ${pageCount}`, PW - ML, PH - 7, { align: "right" });
    }

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