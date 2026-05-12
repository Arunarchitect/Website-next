"use client";

import {
  UNIT_SYSTEMS,
  calcSpaceArea,
  fmt,
  fmtDim,
  getFloorLabel,
  groupByFloor,
  type SpaceInstance,
  type UnitKey,
} from "./areadata";

// ── Types ─────────────────────────────────────────────────────

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
  totals: Totals;
  locationLabel: string;
  disabled?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────

function safeFileName(name: string): string {
  return (
    (name || "space-requirement")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "space-requirement"
  );
}

function cell(
  value: string | number | null | undefined,
  forceQuote = false,
): string {
  const s = value == null ? "" : String(value);
  if (forceQuote || s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map((c) => cell(c)).join(",");
}

// ── Layout ────────────────────────────────────────────────────
//
//  Col A  Space Name        ← editable
//  Col B  Floor             ← editable (human label)
//  Col C  Category          ← editable
//  Col D  Length (ft/m)     ← editable
//  Col E  Breadth (ft/m)    ← editable
//  Col F  Area (sqft/sqm)   ← read-only reference (recalculated on import)
//  Col G  Description       ← editable
//  Col H  [visual gap]
//  Col I  _id               ← do not edit
//  Col J  _parent_id        ← do not edit (links sub-space to parent)
//  Col K  _template_id      ← do not edit

export default function SpaceRequirementCsvButton({
  projectName,
  clientName = "",
  spaces,
  unit,
  wall,
  circ,
  totals,
  locationLabel,
  disabled = false,
}: Props) {
  function downloadCsv() {
    if (disabled || spaces.length === 0) return;

    const dLabel = UNIT_SYSTEMS[unit].dimLabel;
    const aLabel = UNIT_SYSTEMS[unit].areaLabel;
    const generatedDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const lines: string[] = [];
    const blank = () => lines.push("");

    // ── Project info ───────────────────────────────────────────
    lines.push(row("PROJECT", projectName || "Untitled Project"));
    lines.push(row("Client", clientName || ""));
    lines.push(row("Location", locationLabel || ""));
    lines.push(row("Generated", generatedDate));
    lines.push(row("Display unit", aLabel));
    blank();

    // ── Settings ───────────────────────────────────────────────
    lines.push(row("SETTINGS", "", "", "", "", "", "# Change these values if needed"));
    lines.push(row("Wall allowance (%)", wall));
    lines.push(row("Circulation allowance (%)", circ));
    blank();

    // ── Column header row (reused per floor) ───────────────────
    const colHeaders = row(
      "Space Name",
      "Floor",
      "Category",
      `Length (${dLabel})`,
      `Breadth (${dLabel})`,
      `Area (${aLabel})`,
      "Description",
      "",
      "_id [do not edit]",
      "_parent_id [do not edit]",
      "_template_id [do not edit]",
    );

    // ── Spaces grouped by floor ────────────────────────────────
    const floorGroups = groupByFloor(spaces);

    for (const [floor, floorSpaces] of floorGroups.entries()) {
      const floorLabel = getFloorLabel(floor);
      const floorTotal = floorSpaces.reduce(
        (acc, s) => acc + calcSpaceArea(s),
        0,
      );

      // Floor group heading + column headers
      lines.push(
        cell(
          `── ${floorLabel.toUpperCase()}  (${fmt(floorTotal, unit)} ${aLabel} total)`,
          true,
        ),
      );
      lines.push(colHeaders);

      for (const space of floorSpaces) {
        const mainAreaSqft = space.L * space.B;
        const totalAreaSqft = calcSpaceArea(space);
        const hasSubs = space.subSpaces.length > 0;

        // Main space row
        lines.push(
          row(
            space.name,
            floorLabel,
            space.category,
            fmtDim(space.L, unit),
            fmtDim(space.B, unit),
            fmt(hasSubs ? totalAreaSqft : mainAreaSqft, unit),
            space.description ?? "",
            "",
            space.instanceId,
            "",
            space.templateId,
          ),
        );

        // Sub-space rows — visually indented, parent linked via _parent_id
        for (const sub of space.subSpaces) {
          lines.push(
            row(
              `  \u2514\u2500 ${sub.name}`,   // └─ prefix
              "",
              "",
              fmtDim(sub.L, unit),
              fmtDim(sub.B, unit),
              fmt(sub.L * sub.B, unit),
              sub.description ?? "",
              "",
              sub.instanceId,
              space.instanceId,
              sub.templateId,
            ),
          );
        }

        // Sub-total row when sub-spaces exist
        if (hasSubs) {
          lines.push(
            row(
              `  \u21b3 ${space.name} total`,  // ↳ prefix
              "", "", "", "",
              fmt(totalAreaSqft, unit),
              "",
              "", "", "", "",
            ),
          );
        }
      }

      blank();
    }

    // ── Area summary ───────────────────────────────────────────
    lines.push(cell("── AREA SUMMARY ──", true));
    lines.push(row("", "", "", "", "", `Area (${aLabel})`, "Notes"));
    lines.push(row("Net Carpet Area",        "", "", "", "", fmt(totals.net,   unit), "Sum of all space areas"));
    lines.push(row(`Wall Area (${wall}%)`,   "", "", "", "", fmt(totals.wallA, unit), "Structural walls allowance"));
    lines.push(row(`Circulation (${circ}%)`, "", "", "", "", fmt(totals.circA, unit), "Corridors, stairs, lobbies"));
    lines.push(row("Gross Built-up Area",    "", "", "", "", fmt(totals.gross, unit), "Net + Wall + Circulation"));
    blank();

    // ── Editing guide ──────────────────────────────────────────
    lines.push(cell("── HOW TO EDIT ──", true));
    lines.push(row("1. Edit freely: Space Name, Floor, Category, Length, Breadth, Description."));
    lines.push(row("2. Do NOT change the _id / _parent_id / _template_id columns — needed for re-import."));
    lines.push(row("3. Resize a space by changing its Length or Breadth. Area is recalculated on import."));
    lines.push(row("4. Remove a space: delete its row AND all its  └─  sub-space rows."));
    lines.push(row("5. Remove a sub-space: delete only the  └─  row."));
    lines.push(row("6. Floor must be one of: Basement / Ground Floor / First Floor / Second Floor / Third Floor / Fourth Floor / Fifth Floor"));
    lines.push(row("7. Category must be one of: residence / school / commercial / healthcare / hospitality"));
    lines.push(row("8. Rate is NOT stored here — fetched from the database by location on import."));

    // ── Write file ─────────────────────────────────────────────
    const csv = "\uFEFF" + lines.join("\r\n");  // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(projectName)}-spaces.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={downloadCsv}
      disabled={disabled}
      title={
        disabled
          ? "Add at least one space to export CSV"
          : "Download editable CSV"
      }
      style={{
        fontSize: 13,
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid #bfdbfe",
        background: disabled ? "#f3f4f6" : "#eff6ff",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        color: disabled ? "#9ca3af" : "#1d4ed8",
      }}
    >
      📊 Export CSV
    </button>
  );
}