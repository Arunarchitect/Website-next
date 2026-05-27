"use client";

import { useRef } from "react";
import {
  UNIT_SYSTEMS,
  CATEGORY_META,
  FLOORS,
  calcSpaceArea,
  fmt,
  fmtDim,
  getFloorLabel,
  groupByFloor,
  uid,
  type SpaceInstance,
  type SubSpaceInstance,
  type UnitKey,
  type CategoryKey,
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
  // Location IDs — saved to CSV so import can restore the full location
  countryId?: number | null;
  stateId?: number | null;
  placeId?: number | null;
  disabled?: boolean;
  importOnly?: boolean;
  onImport?: (payload: ImportPayload) => void;
};

export type ImportPayload = {
  projectName: string;
  clientName: string;
  unit: UnitKey;
  wall: number;
  circ: number;
  spaces: SpaceInstance[];
  countryId?: number | null;
  stateId?: number | null;
  placeId?: number | null;
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

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const VALID_UNITS: UnitKey[] = ["sqft", "sqm"];
const VALID_CATEGORIES = Object.keys(CATEGORY_META) as CategoryKey[];
const VALID_FLOORS = FLOORS;

function isValidUnit(s: string): s is UnitKey {
  return VALID_UNITS.includes(s as UnitKey);
}
function isValidCategory(s: string): s is CategoryKey {
  return VALID_CATEGORIES.includes(s as CategoryKey);
}

// ── CSV SCHEMA ────────────────────────────────────────────────
//
// Machine-readable rows (prefix ##):
//   ##META,key,value          — project settings + location IDs
//   ##SPACE,...               — one row per space
//   ##SUBS,...                — one row per sub-space
//   ## END DATA ##            — everything below is human-readable only

// ── EXPORT ────────────────────────────────────────────────────

function buildCsv(
  projectName: string,
  clientName: string,
  spaces: SpaceInstance[],
  unit: UnitKey,
  wall: number,
  circ: number,
  totals: Totals,
  locationLabel: string,
  countryId?: number | null,
  stateId?: number | null,
  placeId?: number | null,
): string {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const dLabel = UNIT_SYSTEMS[unit].dimLabel;
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const lines: string[] = [];

  // ── Machine-readable header ────────────────────────────────
  lines.push(
    csvRow(
      "## SPACE REQUIREMENT CSV — modelflick.com",
      "",
      "Re-import this file to restore your project. Edit ##SPACE / ##SUBS rows freely; do NOT remove ## prefix.",
    ),
  );
  lines.push(
    csvRow(
      "## Fields marked [edit] are safe to change. Fields marked [id] are used for data integrity.",
    ),
  );
  lines.push("");

  // META rows — project settings
  lines.push(csvRow("##META", "projectName", projectName || "Untitled Project"));
  lines.push(csvRow("##META", "clientName", clientName || ""));
  lines.push(csvRow("##META", "unit", unit));
  lines.push(csvRow("##META", "wall", String(wall)));
  lines.push(csvRow("##META", "circ", String(circ)));
  lines.push(csvRow("##META", "locationLabel", locationLabel || ""));
  lines.push(csvRow("##META", "exportedAt", generatedDate));

  // META rows — location IDs (only written when present; used to restore
  // country → state → city dropdowns on re-import)
  if (countryId != null) lines.push(csvRow("##META", "countryId", String(countryId)));
  if (stateId   != null) lines.push(csvRow("##META", "stateId",   String(stateId)));
  if (placeId   != null) lines.push(csvRow("##META", "placeId",   String(placeId)));

  lines.push("");

  // SPACE header comment
  lines.push(
    csvRow(
      "## [edit] name",
      "[edit] category: residence|school|commercial|healthcare|hospitality",
      `[edit] L (${dLabel})`,
      `[edit] B (${dLabel})`,
      "[edit] floor: -1=Basement 0=Ground 1=First 2=Second 3=Third 4=Fourth 5=Fifth",
      "[edit] icon",
      "[edit] description",
      "",
      "[id] instanceId",
      "[id] templateId",
      "[id] isCustom",
    ),
  );

  // SPACE rows (dimensions stored in feet internally)
  for (const space of spaces) {
    lines.push(
      csvRow(
        "##SPACE",
        space.instanceId,
        space.templateId,
        space.name,
        space.category,
        String(space.L),
        String(space.B),
        String(space.floor),
        space.icon || "📐",
        space.isCustom ? "true" : "false",
        space.description ?? "",
      ),
    );

    for (const sub of space.subSpaces) {
      lines.push(
        csvRow(
          "##SUBS",
          sub.instanceId,
          space.instanceId,
          sub.templateId,
          sub.name,
          String(sub.L),
          String(sub.B),
          sub.description ?? "",
        ),
      );
    }
  }

  lines.push("");
  lines.push(
    csvRow(
      "## END DATA ##",
      "Rows below are for human reading only; ignored on import.",
    ),
  );
  lines.push("");

  // ── Human-readable display section ────────────────────────
  lines.push(
    csvRow(
      `PROJECT: ${projectName || "Untitled"}`,
      `Client: ${clientName || "—"}`,
      `Location: ${locationLabel || "—"}`,
      `Date: ${generatedDate}`,
    ),
  );
  lines.push("");

  const floorGroups = groupByFloor(spaces);

  for (const [floor, floorSpaces] of floorGroups.entries()) {
    const floorTotal = floorSpaces.reduce((acc, s) => acc + calcSpaceArea(s), 0);
    lines.push(
      csvRow(`── ${getFloorLabel(floor).toUpperCase()}  (${fmt(floorTotal, unit)} ${aLabel})`),
    );
    lines.push(
      csvRow(
        "Space Name",
        "Category",
        `L (${dLabel})`,
        `B (${dLabel})`,
        `Area (${aLabel})`,
        "Description",
      ),
    );

    for (const space of floorSpaces) {
      const mainArea = space.L * space.B;
      const totalArea = calcSpaceArea(space);
      const hasSubs = space.subSpaces.length > 0;

      lines.push(
        csvRow(
          space.name,
          space.category,
          fmtDim(space.L, unit),
          fmtDim(space.B, unit),
          fmt(hasSubs ? totalArea : mainArea, unit),
          space.description ?? "",
        ),
      );

      for (const sub of space.subSpaces) {
        lines.push(
          csvRow(
            `  └─ ${sub.name}`,
            "",
            fmtDim(sub.L, unit),
            fmtDim(sub.B, unit),
            fmt(sub.L * sub.B, unit),
            sub.description ?? "",
          ),
        );
      }

      if (hasSubs) {
        lines.push(
          csvRow(`  ↳ ${space.name} total`, "", "", "", fmt(totalArea, unit), ""),
        );
      }
    }
    lines.push("");
  }

  // Summary
  lines.push(csvRow("── AREA SUMMARY ──"));
  lines.push(csvRow("Net Carpet Area",    "", "", "", fmt(totals.net,   unit), aLabel));
  lines.push(csvRow(`Wall Area (${wall}%)`, "", "", "", fmt(totals.wallA, unit), aLabel));
  lines.push(csvRow(`Circulation (${circ}%)`, "", "", "", fmt(totals.circA, unit), aLabel));
  lines.push(csvRow("Gross Built-up Area", "", "", "", fmt(totals.gross, unit), aLabel));

  return "\uFEFF" + lines.join("\r\n");
}

// ── IMPORT ────────────────────────────────────────────────────

type ParseResult =
  | { ok: true; payload: ImportPayload }
  | { ok: false; error: string };

function parseCsv(text: string): ParseResult {
  const raw = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = raw.split("\n");

  const meta: Record<string, string> = {};
  const spaceRows: string[][] = [];
  const subRows: string[][] = [];

  let foundEnd = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const tag = cells[0]?.trim();

    if (tag === "## END DATA ##") {
      foundEnd = true;
      break;
    }
    if (tag === "##META") {
      const key = cells[1]?.trim();
      const val = cells[2]?.trim() ?? "";
      if (key) meta[key] = val;
    } else if (tag === "##SPACE") {
      spaceRows.push(cells);
    } else if (tag === "##SUBS") {
      subRows.push(cells);
    }
  }

  if (spaceRows.length === 0 && !foundEnd) {
    return {
      ok: false,
      error:
        "No valid space data found. Make sure this is a CSV exported from the Area Calculator.",
    };
  }

  const unit: UnitKey = isValidUnit(meta.unit ?? "") ? (meta.unit as UnitKey) : "sqft";
  const wall = Math.max(0, parseFloat(meta.wall ?? "10") || 10);
  const circ = Math.max(0, parseFloat(meta.circ ?? "15") || 15);

  // Parse location IDs — present only if they were set when the CSV was exported
  const countryId = meta.countryId ? parseInt(meta.countryId) || null : null;
  const stateId   = meta.stateId   ? parseInt(meta.stateId)   || null : null;
  const placeId   = meta.placeId   ? parseInt(meta.placeId)   || null : null;

  // Build sub-space lookup by parentId
  const subsByParent = new Map<string, SubSpaceInstance[]>();
  for (const row of subRows) {
    // ##SUBS, instanceId, parentId, templateId, name, L, B, description
    const [, instanceId, parentId, templateId, name, Lraw, Braw, description] = row;
    if (!parentId || !instanceId) continue;
    const L = Math.max(0.01, parseFloat(Lraw ?? "8") || 8);
    const B = Math.max(0.01, parseFloat(Braw ?? "6") || 6);
    const sub: SubSpaceInstance = {
      instanceId: instanceId.trim() || uid(),
      templateId: (templateId ?? "custom").trim(),
      name: (name ?? "Sub-space").trim(),
      L,
      B,
      description: (description ?? "").trim(),
    };
    const arr = subsByParent.get(parentId.trim()) ?? [];
    arr.push(sub);
    subsByParent.set(parentId.trim(), arr);
  }

  const spaces: SpaceInstance[] = [];

  for (const row of spaceRows) {
    // ##SPACE, instanceId, templateId, name, category, L, B, floor, icon, isCustom, description
    const [, instanceId, templateId, name, categoryRaw, Lraw, Braw, floorRaw, icon, isCustomRaw, ...descParts] = row;
    const description = descParts.join(",").trim();
    const categoryText = (categoryRaw ?? "").trim();
    const category: CategoryKey = isValidCategory(categoryText) ? categoryText : "residence";
    const L = Math.max(0.01, parseFloat(Lraw ?? "10") || 10);
    const B = Math.max(0.01, parseFloat(Braw ?? "10") || 10);
    const floorNum = parseInt(floorRaw ?? "0");
    const floor = VALID_FLOORS.includes(floorNum) ? floorNum : 0;
    const isCustom = (isCustomRaw ?? "").trim() === "true";
    const resolvedId = (instanceId ?? "").trim() || uid();

    spaces.push({
      instanceId: resolvedId,
      templateId: (templateId ?? "custom").trim(),
      name: (name ?? "Space").trim(),
      category,
      L,
      B,
      floor,
      icon: (icon ?? "📐").trim() || "📐",
      isCustom,
      description,
      subSpaces: subsByParent.get(resolvedId) ?? [],
    });
  }

  if (spaces.length === 0) {
    return {
      ok: false,
      error: "CSV parsed but contained no spaces. Please check the file.",
    };
  }

  return {
    ok: true,
    payload: {
      projectName: (meta.projectName ?? "").trim() || "Imported Project",
      clientName: (meta.clientName ?? "").trim(),
      unit,
      wall,
      circ,
      spaces,
      countryId,
      stateId,
      placeId,
    },
  };
}

// ── COMPONENT ─────────────────────────────────────────────────

export default function SpaceRequirementCsvButton({
  projectName,
  clientName = "",
  spaces,
  unit,
  wall,
  circ,
  totals,
  locationLabel,
  countryId,
  stateId,
  placeId,
  disabled = false,
  importOnly = false,
  onImport,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export ─────────────────────────────────────────────────
  function downloadCsv() {
    if (disabled || spaces.length === 0) return;
    const csv = buildCsv(
      projectName,
      clientName,
      spaces,
      unit,
      wall,
      circ,
      totals,
      locationLabel,
      countryId,
      stateId,
      placeId,
    );
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

  // ── Import ─────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const result = parseCsv(text);
      if (!result.ok) {
        alert(`Import failed:\n${result.error}`);
        return;
      }
      onImport?.(result.payload);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  const exportDisabled = disabled || spaces.length === 0;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {!importOnly && (
        <button
          onClick={downloadCsv}
          disabled={exportDisabled}
          title={
            exportDisabled
              ? "Add at least one space to export CSV"
              : "Download editable CSV (can be re-imported)"
          }
          style={{
            fontSize: 13,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #bfdbfe",
            background: exportDisabled ? "#f3f4f6" : "#eff6ff",
            cursor: exportDisabled ? "not-allowed" : "pointer",
            fontWeight: 700,
            color: exportDisabled ? "#9ca3af" : "#1d4ed8",
          }}
        >
          📊 Export CSV
        </button>
      )}

      {onImport && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Import a previously exported CSV to restore your project"
            style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #ddd6fe",
              background: "#f5f3ff",
              cursor: "pointer",
              fontWeight: 700,
              color: "#6d28d9",
            }}
          >
            📂 Import CSV
          </button>
        </>
      )}
    </div>
  );
}