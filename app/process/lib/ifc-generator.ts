// lib/ifc-generator.ts
//
// IFC4X3 writer: one IFCSPACE per real room, arranged on a per-storey
// grid, each storey stacked `storeyHeight` metres above the previous
// one. No walls, no slabs.
//
// Schema: IFC4X3_ADD2 (ISO 16739-1:2024). Backwards-compatible with
// IFC4 for every entity we emit; all argument positions match.
//
// Two safety nets added after Bonsai's "expected a string type, not
// entity_instance" error:
//   1. All spatial elements (IFCPROJECT, IFCSITE, IFCBUILDING,
//      IFCBUILDINGSTOREY, IFCSPACE) are emitted with the LongName
//      attribute present, as $ if there's no value.
//   2. validateSpatialLine() re-parses the emitted line and throws
//      at export time if any attribute that must be a string or null
//      holds a # reference instead.
//
// IMPORTANT — attribute order for IfcSpatialStructureElement subtypes
// (IfcSite, IfcBuilding, IfcBuildingStorey, IfcSpace):
//   GlobalId, OwnerHistory, Name, Description, ObjectType,
//   ObjectPlacement, Representation,   <- inherited from IfcProduct
//   LongName,                          <- inherited from IfcSpatialElement
//   CompositionType,                   <- inherited from IfcSpatialStructureElement
//   <subtype-specific attributes...>
// ObjectPlacement/Representation come BEFORE LongName/CompositionType.
// (IfcProject is the one exception — it doesn't inherit from IfcProduct,
// so it has no ObjectPlacement/Representation at all.)

import type { ProcessData, ProcessNode } from "./process-utils";

const IFC_SCHEMA = "IFC4X3_ADD2";

/** Used when the caller doesn't supply a storey height, or supplies an invalid one. */
const DEFAULT_STOREY_HEIGHT_M = 3.0;
/** Used when the caller doesn't supply a wall thickness / gap, or supplies an invalid one. */
const DEFAULT_WALL_THICKNESS_M = 0.2;

export interface IfcExportOptions {
  /** Floor-to-floor height for every storey, in metres. Must be > 0. Defaults to 3 m. */
  storeyHeight?: number;
  /**
   * Gap left between adjacent spaces in the auto-layout, in metres — stands
   * in for wall thickness since no walls are modelled. Must be >= 0.
   * Defaults to 0.2 m.
   */
  wallThickness?: number;
}

function normalizePositive(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

function normalizeNonNegative(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

/* ─── String helpers ────────────────────────────────────────── */

function ifcString(s: string): string {
  const str = String(s ?? "");

  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(str)) {
    throw new Error(
      `IFC string contains control characters that cannot be encoded: ${JSON.stringify(
        str.slice(0, 60),
      )}`,
    );
  }

  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/\r\n/g, "\\n")
    .replace(/\r/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function n6(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(`Non-finite number passed to IFC writer: ${n}`);
  }
  const r = Math.round(n * 1e6) / 1e6;
  if (!Number.isFinite(r)) {
    throw new Error(`Number overflowed during rounding: ${n}`);
  }
  return r.toFixed(6);
}

function encodeGuid(seed: number): string {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
  let n = Math.abs(Math.floor(seed)) + 1;
  let out = "";
  for (let i = 0; i < 22; i++) {
    out = alphabet[n % 64] + out;
    n = Math.floor(n / 64);
  }
  return out;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * Split a single STEP entity line into its top-level comma-separated
 * arguments, respecting nested parentheses and quoted strings.
 * Used by validateSpatialLine().
 */
function splitArgs(line: string): string[] {
  const start = line.indexOf("(");
  const end = line.lastIndexOf(")");
  if (start < 0 || end < 0) return [];
  const body = line.slice(start + 1, end);

  const args: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" ) {
      inString = !inString;
      current += ch;
      continue;
    }
    if (!inString) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        args.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.length > 0) args.push(current);
  return args;
}

/**
 * Validate that a spatial element line has a string-or-$ value in the
 * LongName slot. If it's a # reference, we throw immediately — that's
 * the exact condition that crashed Bonsai.
 *
 * Entity → LongName attribute index (0-based in splitArgs). All of
 * these inherit ObjectPlacement(6th) + Representation(7th) from
 * IfcProduct BEFORE LongName, so LongName sits at 0-based index 7 —
 * except IfcProject, which skips ObjectPlacement/Representation
 * entirely and has LongName at 0-based index 5.
 *   IfcProject         → index 5
 *   IfcSite            → index 7
 *   IfcBuilding        → index 7
 *   IfcBuildingStorey  → index 7
 *   IfcSpace           → index 7
 */
function validateSpatialLine(
  entityName: string,
  line: string,
  longNameIndex: number,
): void {
  const args = splitArgs(line);
  if (args.length <= longNameIndex) {
    throw new Error(
      `${entityName} emitted with too few arguments (need at least ${
        longNameIndex + 1
      }, got ${args.length}): ${line}`,
    );
  }
  const longName = args[longNameIndex].trim();
  const isString = longName.startsWith("'") && longName.endsWith("'");
  const isNull = longName === "$";
  if (!isString && !isNull) {
    throw new Error(
      `${entityName}.LongName must be a string or $, got "${longName}". ` +
        `Full line: ${line}`,
    );
  }
}

/* ─── Tree shape detection ──────────────────────────────────── */

function subtreeIsDeep(node: ProcessNode): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return false;
  return children.some((c) => (c.children ?? []).length > 0);
}

function isRealRoom(node: ProcessNode): boolean {
  if ((node.children ?? []).length > 0) return false;
  const hasDims =
    typeof node.factor1 === "number" || typeof node.factor2 === "number";
  const hasValue =
    typeof node.value === "number" && Number.isFinite(node.value);
  return hasDims || hasValue;
}

/* ─── Leaf collection ───────────────────────────────────────── */

type LeafEntry = {
  node: ProcessNode;
  storey: string;
  indexInStorey: number;
};

function collectLeaves(root: ProcessNode): LeafEntry[] {
  const deep = subtreeIsDeep(root);

  if (deep) {
    const storeys: Array<{ label: string; rooms: ProcessNode[] }> = [];

    (root.children ?? []).forEach((level1) => {
      const rooms: ProcessNode[] = [];
      const gather = (n: ProcessNode) => {
        const cs = n.children ?? [];
        if (cs.length === 0) {
          if (isRealRoom(n)) rooms.push(n);
          return;
        }
        cs.forEach(gather);
      };
      gather(level1);
      if (rooms.length > 0) {
        storeys.push({ label: level1.label, rooms });
      }
    });

    const out: LeafEntry[] = [];
    storeys.forEach(({ label, rooms }) => {
      rooms.forEach((node, i) => {
        out.push({ node, storey: label, indexInStorey: i });
      });
    });
    return out;
  }

  const storeyName = root.label || "Level 1";
  const out: LeafEntry[] = [];
  const counter = { n: 0 };

  const walk = (node: ProcessNode) => {
    const children = node.children ?? [];
    if (children.length === 0) {
      if (isRealRoom(node)) {
        out.push({ node, storey: storeyName, indexInStorey: counter.n });
        counter.n += 1;
      }
      return;
    }
    children.forEach(walk);
  };

  (root.children ?? []).forEach(walk);
  return out;
}

/* ─── Layout — shelf packer ─────────────────────────────────── */

type Placed = {
  leaf: LeafEntry;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
};

type StoreyLayout = {
  storey: string;
  z: number;
  placed: Placed[];
};

function layoutLeaves(
  leaves: LeafEntry[],
  storeyHeight: number,
  wallThickness: number,
): StoreyLayout[] {
  const byStorey = new Map<string, LeafEntry[]>();
  const storeyOrder: string[] = [];
  leaves.forEach((l) => {
    if (!byStorey.has(l.storey)) {
      byStorey.set(l.storey, []);
      storeyOrder.push(l.storey);
    }
    byStorey.get(l.storey)!.push(l);
  });

  const out: StoreyLayout[] = [];

  storeyOrder.forEach((storeyLabel, storeyIdx) => {
    const group = byStorey.get(storeyLabel)!;

    const rooms = group.map((leaf) => ({
      leaf,
      w:
        typeof leaf.node.factor1 === "number" && leaf.node.factor1 > 0
          ? leaf.node.factor1
          : 4,
      d:
        typeof leaf.node.factor2 === "number" && leaf.node.factor2 > 0
          ? leaf.node.factor2
          : 4,
    }));

    const zBase = storeyIdx * storeyHeight;

    // Target row width is sized to fit roughly ⌈√N⌉ rooms per row
    // (based on the AVERAGE room width), not √(total area). Using
    // √area was the bug: for typical room proportions it came out
    // narrower than a single room's width, so every room wrapped to
    // its own row — producing a single-file column where the visible
    // "gap" between boxes was actually the previous room's full depth
    // plus wallThickness, not just wallThickness. The extra
    // `wallThickness * colsTarget` term is slack so same-row rooms of
    // slightly different widths, and floating-point rounding, don't
    // accidentally trigger an extra wrap.
    const count = rooms.length;
    const colsTarget = Math.max(1, Math.ceil(Math.sqrt(count)));
    const totalWidth = rooms.reduce((sum, r) => sum + r.w, 0);
    const avgWidth = count > 0 ? totalWidth / count : 4;
    const targetRowWidth =
      count > 0
        ? avgWidth * colsTarget + wallThickness * colsTarget
        : 20;

    rooms.sort((a, b) => b.d - a.d);

    const placed: Placed[] = [];
    let cursorX = 0;
    let cursorY = 0;
    let rowDepth = 0;

    rooms.forEach((r) => {
      if (cursorX > 0 && cursorX + r.w + wallThickness > targetRowWidth) {
        cursorY += rowDepth + wallThickness;
        cursorX = 0;
        rowDepth = 0;
      }

      placed.push({
        leaf: r.leaf,
        x: cursorX,
        y: cursorY,
        z: zBase,
        w: r.w,
        d: r.d,
        h: storeyHeight,
      });

      cursorX += r.w + wallThickness;
      if (r.d > rowDepth) rowDepth = r.d;
    });

    out.push({ storey: storeyLabel, z: zBase, placed });
  });

  return out;
}

/* ─── Writer ────────────────────────────────────────────────── */

export function generateIfc(
  data: ProcessData,
  rootNode: ProcessNode,
  options?: IfcExportOptions,
): string {
  const storeyHeight = normalizePositive(options?.storeyHeight, DEFAULT_STOREY_HEIGHT_M);
  const wallThickness = normalizeNonNegative(options?.wallThickness, DEFAULT_WALL_THICKNESS_M);

  const lines: string[] = [];
  let nextId = 1;

  const emit = (entity: string): number => {
    const id = nextId++;
    const line = `#${id}= ${entity};`;
    if (!line.endsWith(";")) {
      throw new Error(
        `IFC writer produced a line without a terminating semicolon: ${line.slice(0, 120)}`,
      );
    }
    lines.push(line);
    return id;
  };

  /* ── Header ─────────────────────────────────────────────── */
  const fileHeader: string[] = [];
  fileHeader.push("ISO-10303-21;");
  fileHeader.push("HEADER;");
  fileHeader.push(
    `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`,
  );
  fileHeader.push(
    `FILE_NAME('${ifcString(data.title || "model.ifc")}','${timestamp()}',('modelflick'),('modelflick'),'modelflick-process-editor','modelflick-process-editor','');`,
  );
  fileHeader.push(`FILE_SCHEMA(('${IFC_SCHEMA}'));`);
  fileHeader.push("ENDSEC;");
  fileHeader.push("DATA;");

  /* ── Core spatial structure ────────────────────────────── */

  const personId = emit(`IFCPERSON($,'modelflick',$,$,$,$,$,$)`);
  const orgId = emit(`IFCORGANIZATION($,'modelflick',$,$,$)`);
  const personOrgId = emit(
    `IFCPERSONANDORGANIZATION(#${personId},#${orgId},$)`,
  );
  const appId = emit(
    `IFCAPPLICATION(#${orgId},'1.0','Process Editor','MFPE')`,
  );
  const ownerHistoryId = emit(
    `IFCOWNERHISTORY(#${personOrgId},#${appId},$,.ADDED.,$,$,$,${Math.floor(
      Date.now() / 1000,
    )})`,
  );

  const unitLenId = emit(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const unitAreaId = emit(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const unitVolId = emit(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const unitAngleId = emit(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const unitAssignId = emit(
    `IFCUNITASSIGNMENT((#${unitLenId},#${unitAreaId},#${unitVolId},#${unitAngleId}))`,
  );

  const originPtId = emit(`IFCCARTESIANPOINT((0.,0.,0.))`);
  const worldXAxisId = emit(`IFCDIRECTION((1.,0.,0.))`);
  const worldZAxisId = emit(`IFCDIRECTION((0.,0.,1.))`);
  const worldPlacementId = emit(
    `IFCAXIS2PLACEMENT3D(#${originPtId},#${worldZAxisId},#${worldXAxisId})`,
  );
  const contextId = emit(
    `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${worldPlacementId},$)`,
  );

  // IfcProject — 9 arguments (does NOT inherit ObjectPlacement/Representation
  // from IfcProduct — IfcProject is a subtype of IfcContext, not IfcProduct):
  //   GlobalId, OwnerHistory, Name, Description, ObjectType,
  //   LongName, Phase, RepresentationContexts, UnitsInContext
  const projectEntity =
    `IFCPROJECT('${encodeGuid(1)}',#${ownerHistoryId},'${ifcString(
      data.title || "Project",
    )}','${ifcString(data.description ?? "")}',$,$,$,(#${contextId}),#${unitAssignId})`;
  validateSpatialLine("IfcProject", projectEntity, 5);
  const projectId = emit(projectEntity);

  const sitePlacementId = emit(`IFCLOCALPLACEMENT($,#${worldPlacementId})`);

  // IfcSite — 14 arguments:
  //   GlobalId, OwnerHistory, Name, Description, ObjectType,
  //   ObjectPlacement, Representation, LongName, CompositionType,
  //   RefLatitude, RefLongitude, RefElevation, LandTitleNumber, SiteAddress
  const siteEntity =
    `IFCSITE('${encodeGuid(2)}',#${ownerHistoryId},'Site',$,$,#${sitePlacementId},$,$,.ELEMENT.,$,$,$,$,$)`;
  validateSpatialLine("IfcSite", siteEntity, 7);
  const siteId = emit(siteEntity);

  const buildingPlacementId = emit(
    `IFCLOCALPLACEMENT(#${sitePlacementId},#${worldPlacementId})`,
  );

  // IfcBuilding — 12 arguments:
  //   GlobalId, OwnerHistory, Name, Description, ObjectType,
  //   ObjectPlacement, Representation, LongName, CompositionType,
  //   ElevationOfRefHeight, ElevationOfTerrain, BuildingAddress
  const buildingEntity =
    `IFCBUILDING('${encodeGuid(3)}',#${ownerHistoryId},'${ifcString(
      rootNode.label || "Building",
    )}',$,$,#${buildingPlacementId},$,$,.ELEMENT.,$,$,$)`;
  validateSpatialLine("IfcBuilding", buildingEntity, 7);
  const buildingId = emit(buildingEntity);

  /* ── Storeys + spaces ──────────────────────────────────── */

  const leaves = collectLeaves(rootNode);
  const storeyLayouts = layoutLeaves(leaves, storeyHeight, wallThickness);

  const storeyIds: number[] = [];
  const spacesPerStorey: number[][] = [];

  storeyLayouts.forEach((layout, storeyIdx) => {
    const storeyZ = layout.z;

    const storeyOriginId = emit(
      `IFCCARTESIANPOINT((0.,0.,${n6(storeyZ)}))`,
    );
    const storeyAxisId = emit(
      `IFCAXIS2PLACEMENT3D(#${storeyOriginId},#${worldZAxisId},#${worldXAxisId})`,
    );
    const storeyPlacementId = emit(
      `IFCLOCALPLACEMENT(#${buildingPlacementId},#${storeyAxisId})`,
    );

    // IfcBuildingStorey — 10 arguments:
    //   GlobalId, OwnerHistory, Name, Description, ObjectType,
    //   ObjectPlacement, Representation, LongName, CompositionType,
    //   Elevation
    const storeyEntity =
      `IFCBUILDINGSTOREY('${encodeGuid(
        storeyIdx + 100,
      )}',#${ownerHistoryId},'${ifcString(layout.storey)}',$,$,#${storeyPlacementId},$,$,.ELEMENT.,${n6(storeyZ)})`;
    validateSpatialLine("IfcBuildingStorey", storeyEntity, 7);
    const storeyId = emit(storeyEntity);
    storeyIds.push(storeyId);

    const idsForSpaces: number[] = [];

    layout.placed.forEach((p, i) => {
      const { node, x, y, w, d, h } = {
        node: p.leaf.node,
        x: p.x,
        y: p.y,
        w: p.w,
        d: p.d,
        h: p.h,
      };

      const spaceOriginId = emit(
        `IFCCARTESIANPOINT((${n6(x)},${n6(y)},0.))`,
      );
      const spaceAxisId = emit(
        `IFCAXIS2PLACEMENT3D(#${spaceOriginId},#${worldZAxisId},#${worldXAxisId})`,
      );
      const spacePlacementId = emit(
        `IFCLOCALPLACEMENT(#${storeyPlacementId},#${spaceAxisId})`,
      );

      const profileOriginId = emit(`IFCCARTESIANPOINT((0.,0.))`);
      const profileDirId = emit(`IFCDIRECTION((1.,0.))`);
      const profileAxisId = emit(
        `IFCAXIS2PLACEMENT2D(#${profileOriginId},#${profileDirId})`,
      );
      const profileId = emit(
        `IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profileAxisId},${n6(w)},${n6(d)})`,
      );

      const solidOriginId = emit(
        `IFCCARTESIANPOINT((${n6(x)},${n6(y)},0.))`,
      );
      const solidAxisId = emit(
        `IFCAXIS2PLACEMENT3D(#${solidOriginId},#${worldZAxisId},#${worldXAxisId})`,
      );
      const extrudeDirId = emit(`IFCDIRECTION((0.,0.,1.))`);
      const extrudedId = emit(
        `IFCEXTRUDEDAREASOLID(#${profileId},#${solidAxisId},#${extrudeDirId},${n6(h)})`,
      );

      const shapeRepId = emit(
        `IFCSHAPEREPRESENTATION(#${contextId},'Body','SweptSolid',(#${extrudedId}))`,
      );
      const productDefId = emit(
        `IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}))`,
      );

      // IfcSpace — 11 arguments:
      //   GlobalId, OwnerHistory, Name, Description, ObjectType,
      //   ObjectPlacement, Representation, LongName, CompositionType,
      //   PredefinedType, ElevationWithFlooring
      const spaceEntity =
        `IFCSPACE('${encodeGuid(
          storeyIdx * 10000 + i + 1000,
        )}',#${ownerHistoryId},'${ifcString(node.label)}','${ifcString(
          node.description ?? "",
        )}',$,#${spacePlacementId},#${productDefId},$,.ELEMENT.,$,$)`;
      validateSpatialLine("IfcSpace", spaceEntity, 7);
      const spaceId = emit(spaceEntity);
      idsForSpaces.push(spaceId);

      if (typeof node.value === "number" && Number.isFinite(node.value)) {
        const propId = emit(
          `IFCPROPERTYSINGLEVALUE('Area',$,IFCAREAMEASURE(${n6(node.value)}),$)`,
        );
        const psetId = emit(
          `IFCPROPERTYSET('${encodeGuid(
            storeyIdx * 10000 + i + 5000,
          )}',#${ownerHistoryId},'Pset_SpaceCommon',$,(#${propId}))`,
        );
        emit(
          `IFCRELDEFINESBYPROPERTIES('${encodeGuid(
            storeyIdx * 10000 + i + 7000,
          )}',#${ownerHistoryId},$,$,(#${spaceId}),#${psetId})`,
        );
      }
    });

    spacesPerStorey.push(idsForSpaces);
  });

  /* ── Containment and aggregation ───────────────────────── */

  emit(
    `IFCRELAGGREGATES('${encodeGuid(9001)}',#${ownerHistoryId},$,$,#${projectId},(#${siteId}))`,
  );
  emit(
    `IFCRELAGGREGATES('${encodeGuid(9002)}',#${ownerHistoryId},$,$,#${siteId},(#${buildingId}))`,
  );
  if (storeyIds.length > 0) {
    emit(
      `IFCRELAGGREGATES('${encodeGuid(9003)}',#${ownerHistoryId},$,$,#${buildingId},(${storeyIds
        .map((id) => `#${id}`)
        .join(",")}))`,
    );
  }

  storeyIds.forEach((storeyId, idx) => {
    const ids = spacesPerStorey[idx] ?? [];
    if (ids.length === 0) return;

    const refList = ids.map((id) => `#${id}`).join(",");

    emit(
      `IFCRELCONTAINEDINSPATIALSTRUCTURE('${encodeGuid(
        9100 + idx,
      )}',#${ownerHistoryId},$,$,(${refList}),#${storeyId})`,
    );

    emit(
      `IFCRELAGGREGATES('${encodeGuid(
        9300 + idx,
      )}',#${ownerHistoryId},$,$,#${storeyId},(${refList}))`,
    );
  });

  /* ── Finish ─────────────────────────────────────────────── */

  const fileBody =
    fileHeader
      .concat(lines)
      .concat(["ENDSEC;", "END-ISO-10303-21;"])
      .join("\n") + "\n";

  return fileBody;
}