/* =========================================================
   TYPES
========================================================= */

export type Person = {
  id: string;
  name: string;
};

export type ProcessNode = {
  id: string;
  label: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  predecessors?: string[];
  successors?: string[];
  assignedPersonIds?: string[];
  children?: ProcessNode[];
  important?: boolean;

  /**
   * LEAF-ONLY main value, in the leaf's value type's BASE unit.
   * See ProcessData.valueDef / VALUE_PRESETS.
   */
  value?: number;

  /** @deprecated legacy alias for `value`. Migrated on load. */
  area?: number;

  /**
   * LEAF-ONLY. Which value type this leaf uses (a preset id, e.g.
   * "area" | "cost" | "volume" | "length" | "weight" | "count").
   * When absent, the document's `valueDef` is used. Present only on
   * leaves that have been individually typed.
   */
  valueType?: string;

  /**
   * LEAF-ONLY. Two optional factors whose product yields `value`.
   * Rendered with the factor labels/unit of the leaf's value type.
   */
  factor1?: number;
  factor2?: number;
};

export type ProcessData = {
  title: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  completed?: string[];
  edgeStyles?: Record<string, { dashed?: boolean }>;
  persons?: Person[];

  /** Default value type for leaves that haven't picked one. */
  valueDef?: ValueDef;

  /**
   * Per-value-type display unit. E.g. { area: "ft²", cost: "$" }.
   * Falls back to each type's base unit when an entry is missing.
   */
  displayUnits?: Record<string, string>;

  /** @deprecated legacy single display unit. Migrated to displayUnits on load. */
  displayUnit?: string;

  children?: ProcessNode[];
};

export type ColorTheme = {
  background: string;
  border: string;
  title: string;
  description: string;
};

/* =========================================================
   TREE HELPERS
========================================================= */

export function countNodes(node: ProcessNode): number {
  const children = node.children ?? [];
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}

export function getLeafIds(node: ProcessNode): string[] {
  const children = node.children ?? [];
  if (children.length === 0) return [node.id];
  return children.flatMap(getLeafIds);
}

export function isNodeComplete(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return completed.has(node.id);
  return children.every((child) => isNodeComplete(child, completed));
}

export function isNodePartial(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return false;
  const anyProgress = children.some(
    (child) => isNodeComplete(child, completed) || isNodePartial(child, completed)
  );
  const allComplete = children.every((child) => isNodeComplete(child, completed));
  return anyProgress && !allComplete;
}

export function findNodeById(root: ProcessNode, id: string): ProcessNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/* =========================================================
   VALUE SYSTEM
   ---------------------------------------------------------
   Each leaf carries ONE main number. The document supplies a
   default meaning ("value type") via VALUE_PRESETS, and a leaf can
   override it with its own `valueType`. Parents never store a
   value; theirs is the sum of their children.
========================================================= */

export type UnitOption = {
  /** Symbol shown for the main value, e.g. "m²", "ft²". */
  symbol: string;
  /** Multiply a base-unit value by this to get the display value. */
  fromBase: number;
  /** Multiply a display value by this to get back to base. */
  toBase: number;

  /** Factor symbol for this display unit, e.g. "m", "ft". */
  factorSymbol?: string;
  /** Display factor value = base factor value × this. */
  factorFromBase?: number;
  /** Base factor value = display factor value × this. */
  factorToBase?: number;
};

/** The document's chosen value type — one per ProcessData. */
export type ValueDef = {
  /** Preset id, e.g. "area". Must match a key in VALUE_PRESETS. */
  id?: string;
  /** What this number is, e.g. "Area", "Cost", "Length". */
  label: string;
  /** Base unit symbol — what stored values are assumed to be in. */
  unit: string;
  unitPosition?: "prefix" | "suffix";
  precision?: number;
  units: UnitOption[];
  /** Names for the two factor inputs. Absent = no factors for this type. */
  factorLabels?: [string, string];
  /** Default factor unit symbol. Overridden per display unit when set. */
  factorUnit?: string;
};

export type ValueResult = {
  value: number | null;
  partial: boolean;
};

const unit = (
  symbol: string,
  fromBase: number,
  toBase: number,
  factorSymbol?: string,
  factorFromBase?: number,
  factorToBase?: number,
): UnitOption => ({
  symbol,
  fromBase,
  toBase,
  factorSymbol,
  factorFromBase,
  factorToBase,
});

/* ── Preset value types the user can pick from ──────────────────── */

export const VALUE_PRESETS: Record<string, ValueDef> = {
  area: {
    id: "area",
    label: "Area",
    unit: "m²",
    precision: 2,
    factorLabels: ["Length", "Breadth"],
    factorUnit: "m",
    units: [
      unit("m²", 1, 1, "m", 1, 1),
      unit("ft²", 10.7639104, 0.09290304, "ft", 3.2808399, 0.3048),
      unit("yd²", 1.19599005, 0.83612736, "yd", 1.0936133, 0.9144),
    ],
  },
  volume: {
    id: "volume",
    label: "Volume",
    unit: "m³",
    precision: 2,
    units: [
      unit("m³", 1, 1, "m", 1, 1),
      unit("ft³", 35.3146667, 0.0283168466, "ft", 3.2808399, 0.3048),
      unit("L", 1000, 0.001, "dm", 10, 0.1),
    ],
  },
  length: {
    id: "length",
    label: "Length",
    unit: "m",
    precision: 2,
    units: [
      unit("m", 1, 1),
      unit("ft", 3.2808399, 0.3048),
      unit("cm", 100, 0.01),
      unit("mm", 1000, 0.001),
    ],
  },
  cost: {
    id: "cost",
    label: "Cost",
    unit: "₹",
    unitPosition: "prefix",
    precision: 2,
    factorLabels: ["Quantity", "Rate"],
    factorUnit: "",
    units: [
      unit("₹", 1, 1, "", 1, 1),
      unit("$", 0.012, 83.3333, "", 1, 1),
      unit("€", 0.011, 90.9091, "", 1, 1),
      unit("AED", 0.044, 22.7273, "", 1, 1),
    ],
  },
  weight: {
    id: "weight",
    label: "Weight",
    unit: "kg",
    precision: 2,
    units: [
      unit("kg", 1, 1),
      unit("lb", 2.20462262, 0.45359237),
      unit("t", 0.001, 1000),
    ],
  },
  count: {
    id: "count",
    label: "Count",
    unit: "",
    precision: 0,
    units: [unit("", 1, 1)],
  },
};

export const DEFAULT_VALUE_DEF: ValueDef = VALUE_PRESETS.area;

/**
 * Resolve the ValueDef a node should use. Priority:
 *   1. node.valueType (must be a known preset id)
 *   2. document def (data.valueDef)
 *   3. DEFAULT_VALUE_DEF
 */
export function resolveNodeValueDef(
  node: ProcessNode,
  documentDef: ValueDef | undefined,
): ValueDef {
  if (node.valueType && VALUE_PRESETS[node.valueType]) {
    return VALUE_PRESETS[node.valueType];
  }
  return resolveValueDef(documentDef);
}

/** Safe resolution for a document-level def. */
export function resolveValueDef(def: ValueDef | undefined): ValueDef {
  return def ?? DEFAULT_VALUE_DEF;
}

/* ── Unit selection + conversion ─────────────────────────────────── */

export function resolveUnit(def: ValueDef, chosenSymbol?: string): UnitOption {
  if (def.units.length === 0) return unit(def.unit, 1, 1);
  if (chosenSymbol) {
    const match = def.units.find((u) => u.symbol === chosenSymbol);
    if (match) return match;
  }
  const baseOpt = def.units.find((u) => u.symbol === def.unit);
  return baseOpt ?? def.units[0];
}

/** The unit symbol chosen for a value type, given the document's prefs. */
export function unitForType(
  def: ValueDef,
  displayUnits: Record<string, string> | undefined,
): string {
  const id = def.id ?? "area";
  return displayUnits?.[id] ?? def.unit;
}

export function toDisplay(baseValue: number, def: ValueDef, chosenSymbol?: string): number {
  return baseValue * resolveUnit(def, chosenSymbol).fromBase;
}

export function toBase(displayValue: number, def: ValueDef, chosenSymbol?: string): number {
  return displayValue * resolveUnit(def, chosenSymbol).toBase;
}

/** Factor conversion: base factor value → display factor value. */
export function factorToDisplay(
  baseFactor: number,
  def: ValueDef,
  chosenSymbol?: string,
): number {
  const opt = resolveUnit(def, chosenSymbol);
  const k = opt.factorFromBase ?? 1;
  return baseFactor * k;
}

/** Factor conversion: display factor value → base factor value. */
export function factorFromDisplay(
  displayFactor: number,
  def: ValueDef,
  chosenSymbol?: string,
): number {
  const opt = resolveUnit(def, chosenSymbol);
  const k = opt.factorToBase ?? 1;
  return displayFactor * k;
}

/* ── Factors ─────────────────────────────────────────────────────── */

export function hasFactors(def: ValueDef): boolean {
  return !!(def.factorLabels && def.factorLabels.length === 2);
}

export function computeValueFromFactors(
  node: ProcessNode,
  def: ValueDef,
): number | null {
  if (!hasFactors(def)) return null;
  if (typeof node.factor1 !== "number" || typeof node.factor2 !== "number") return null;
  return node.factor1 * node.factor2;
}

/* ── Reading values off the tree ─────────────────────────────────── */

function readLeafValue(node: ProcessNode): number | null {
  if (typeof node.value === "number" && Number.isFinite(node.value)) return node.value;
  if (typeof node.area === "number" && Number.isFinite(node.area)) return node.area;
  return null;
}

export function getNodeValue(node: ProcessNode): ValueResult {
  const children = node.children ?? [];

  if (children.length === 0) {
    return { value: readLeafValue(node), partial: false };
  }

  const childResults = children.map(getNodeValue);
  const withValue = childResults.filter((r) => r.value !== null);

  if (withValue.length === 0) return { value: null, partial: false };

  const sum = withValue.reduce((total, r) => total + (r.value as number), 0);
  return { value: sum, partial: withValue.length < children.length };
}

/**
 * Format a BASE-unit value for display in the currently-chosen unit.
 */
export function formatValue(
  baseValue: number,
  def: ValueDef,
  chosenSymbol?: string,
): string {
  const opt = resolveUnit(def, chosenSymbol);
  const display = baseValue * opt.fromBase;
  const p = def.precision ?? 2;
  const factor = 10 ** p;
  const rounded = Math.round(display * factor) / factor;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(p);
  const u = opt.symbol;
  if (!u) return text;
  return def.unitPosition === "prefix" ? `${u}${text}` : `${text} ${u}`;
}

/** Format a factor value for display in the current factor unit. */
export function formatFactor(
  baseFactor: number,
  def: ValueDef,
  chosenSymbol?: string,
): string {
  const display = factorToDisplay(baseFactor, def, chosenSymbol);
  const rounded = Math.round(display * 1e6) / 1e6;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded);
  const u = resolveUnit(def, chosenSymbol).factorSymbol ?? def.factorUnit ?? "";
  return u ? `${text} ${u}` : text;
}

/**
 * Does this document use the value feature at all?
 */
export function hasAnyValue(root: ProcessNode): boolean {
  if (typeof root.value === "number") return true;
  if (typeof root.area === "number") return true;
  for (const child of root.children ?? []) {
    if (hasAnyValue(child)) return true;
  }
  return false;
}

/** One-way migration: legacy `area` → `value`. Run on load. */
export function migrateNodeValue(node: ProcessNode): ProcessNode {
  const { area, ...rest } = node;
  return {
    ...rest,
    ...(typeof area === "number" && typeof node.value !== "number"
      ? { value: area }
      : {}),
    children: node.children?.map(migrateNodeValue),
  };
}

/** Migrate the doc-level `displayUnit` string → `displayUnits` record. */
export function migrateDisplayUnits(data: ProcessData): ProcessData {
  const { displayUnit, displayUnits, ...rest } = data;
  if (displayUnits) return { ...rest, displayUnits };
  if (displayUnit) {
    // Pre-change, the doc was implicitly Area. Carry the old unit over.
    return { ...rest, displayUnits: { area: displayUnit } };
  }
  return rest;
}

export function migrateProcessData(data: ProcessData): ProcessData {
  const migratedUnits = migrateDisplayUnits(data);
  return {
    ...migratedUnits,
    children: migratedUnits.children?.map(migrateNodeValue),
  };
}

/* ── Back-compat aliases ─────────────────────────────────────────── */
export type AreaResult = ValueResult;
export const getNodeArea = (node: ProcessNode): ValueResult => getNodeValue(node);
export const formatArea = (value: number): string =>
  formatValue(value, DEFAULT_VALUE_DEF);

/* =========================================================
   VALUE SCOPE
========================================================= */

export type ValueScope = string | null;

function subtreeContains(node: ProcessNode, id: string): boolean {
  if (node.id === id) return true;
  for (const child of node.children ?? []) {
    if (subtreeContains(child, id)) return true;
  }
  return false;
}

export function isNodeInValueScope(
  root: ProcessNode,
  nodeId: string,
  scope: ValueScope,
): boolean {
  if (scope === null) return false;
  if (scope === "root") return true;
  if (nodeId === scope) return true;

  const scopeRoot = findNodeById(root, scope);
  if (!scopeRoot) return false;
  return subtreeContains(scopeRoot, nodeId);
}

export function scopeHasAnyValue(root: ProcessNode, scope: ValueScope): boolean {
  if (scope === null) return false;
  const scopeRoot = scope === "root" ? root : findNodeById(root, scope);
  if (!scopeRoot) return false;
  return hasAnyValue(scopeRoot);
}

/* =========================================================
   RELATION SANITIZATION
========================================================= */

export type SanitizeResult = {
  data: ProcessData;
  notes: string[];
};

function collectAllNodes(node: ProcessNode, acc: ProcessNode[]) {
  acc.push(node);
  (node.children ?? []).forEach((c) => collectAllNodes(c, acc));
}

export function sanitizeProcessRelations(data: ProcessData): SanitizeResult {
  const notes: string[] = [];
  const rootChildren = data.children ?? [];

  const stripSelfLoops = (node: ProcessNode): ProcessNode => {
    const successors = (node.successors ?? []).filter((id) => id !== node.id);
    const predecessors = (node.predecessors ?? []).filter((id) => id !== node.id);

    if (node.successors && node.successors.length !== successors.length) {
      notes.push(`"${node.label}" listed itself as its own successor — removed.`);
    }
    if (node.predecessors && node.predecessors.length !== predecessors.length) {
      notes.push(`"${node.label}" listed itself as its own predecessor — removed.`);
    }

    return {
      ...node,
      successors: node.successors ? successors : undefined,
      predecessors: node.predecessors ? predecessors : undefined,
      children: node.children?.map(stripSelfLoops),
    };
  };

  const cleanedChildren = rootChildren.map(stripSelfLoops);

  const allNodes: ProcessNode[] = [];
  cleanedChildren.forEach((c) => collectAllNodes(c, allNodes));
  const nodesById = new Map(allNodes.map((n) => [n.id, n]));

  const edgeSet = new Set<string>();
  allNodes.forEach((n) => {
    (n.successors ?? []).forEach((to) => edgeSet.add(`${n.id}->${to}`));
  });

  const newEdgeStyles: Record<string, { dashed?: boolean }> = { ...(data.edgeStyles ?? {}) };
  const seenPairs = new Set<string>();

  edgeSet.forEach((key) => {
    const [from, to] = key.split("->");
    const reverseKey = `${to}->${from}`;
    if (!edgeSet.has(reverseKey)) return;

    const pairKey = [from, to].sort().join("|");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    const alreadyDashedBothWays = newEdgeStyles[key]?.dashed && newEdgeStyles[reverseKey]?.dashed;
    if (!alreadyDashedBothWays) {
      newEdgeStyles[key] = { ...newEdgeStyles[key], dashed: true };
      newEdgeStyles[reverseKey] = { ...newEdgeStyles[reverseKey], dashed: true };
      const fromLabel = nodesById.get(from)?.label ?? from;
      const toLabel = nodesById.get(to)?.label ?? to;
      notes.push(`"${fromLabel}" and "${toLabel}" reference each other — shown as a dashed loop.`);
    }
  });

  return {
    data: { ...data, children: cleanedChildren, edgeStyles: newEdgeStyles },
    notes,
  };
}

export function reverseEdgeExists(root: ProcessNode, fromId: string, toId: string): boolean {
  const toNode = findNodeById(root, toId);
  return !!toNode?.successors?.includes(fromId);
}

/* =========================================================
   COLOUR THEMES
========================================================= */

export function getColorTheme(level: number, colorIndex: number): ColorTheme {
  if (level === 0) {
    return {
      background: "#F3F6FA",
      border: "#B8C5D6",
      title: "#26364A",
      description: "#536273",
    };
  }

  const themes: ColorTheme[] = [
    { background: "#EEF7F0", border: "#B8D8BD", title: "#315C38", description: "#55725A" },
    { background: "#FFF5E8", border: "#E8C79A", title: "#754C20", description: "#80684B" },
    { background: "#F5F0FA", border: "#D1BDE2", title: "#5A3D70", description: "#725D83" },
    { background: "#EEF5FB", border: "#B8D2E8", title: "#315878", description: "#59748C" },
    { background: "#FBEFF2", border: "#E4BBC5", title: "#713D4A", description: "#805E66" },
    { background: "#FFF9E8", border: "#E6D49A", title: "#705E22", description: "#7C7048" },
  ];

  const base = themes[colorIndex % themes.length];

  if (level === 1) return base;

  if (level === 2) {
    return {
      background: lighten(base.background, 0.45),
      border: lighten(base.border, 0.15),
      title: base.title,
      description: base.description,
    };
  }

  return {
    background: lighten(base.background, 0.65),
    border: lighten(base.border, 0.3),
    title: base.title,
    description: base.description,
  };
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  return `rgb(${newR}, ${newG}, ${newB})`;
}

/* =========================================================
   TEXT SIZING
========================================================= */

export function getLayout(level: number) {
  const layouts = [
    { titleSize: "26px", descriptionSize: "15px", padding: "26px" },
    { titleSize: "19px", descriptionSize: "12px", padding: "16px" },
    { titleSize: "16px", descriptionSize: "11px", padding: "13px" },
    { titleSize: "14px", descriptionSize: "10px", padding: "11px" },
  ];
  return layouts[Math.min(level, layouts.length - 1)];
}

/* ── Report helpers ──────────────────────────────────────────── */

const SQFT_PER_SQM = 10.7639104;

function roundTo(n: number, p: number): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

function fmtNumber(n: number, p: number): string {
  const r = roundTo(n, p);
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(p);
}

/**
 * Format an area (stored in m²) for printing. Returns both the primary
 * value in the chosen unit and the secondary value in the other unit,
 * so a report can render "120 sqft (11.1 m²)".
 */
export function formatAreaPair(
  sqm: number,
  unit: "sqft" | "sqm",
  precision = 1,
): { primary: string; secondary: string } {
  if (unit === "sqft") {
    return {
      primary: `${fmtNumber(sqm * SQFT_PER_SQM, precision)} sqft`,
      secondary: `${fmtNumber(sqm, precision)} m²`,
    };
  }
  return {
    primary: `${fmtNumber(sqm, precision)} m²`,
    secondary: `${fmtNumber(sqm * SQFT_PER_SQM, precision)} sqft`,
  };
}

/**
 * Flatten the tree to leaves, in depth-first order, with each leaf's
 * number path (its position in the tree). Used to render the detailed
 * space table.
 */
export function leafRows(
  root: ProcessNode,
): { node: ProcessNode; path: number[]; depth: number }[] {
  const out: { node: ProcessNode; path: number[]; depth: number }[] = [];
  const walk = (node: ProcessNode, path: number[], depth: number) => {
    const children = node.children ?? [];
    if (children.length === 0) {
      out.push({ node, path, depth });
      return;
    }
    children.forEach((c, i) => walk(c, [...path, i + 1], depth + 1));
  };
  (root.children ?? []).forEach((c, i) => walk(c, [i + 1], 1));
  return out;
}

/**
 * Flatten the tree to one row per node — parents AND leaves — in
 * depth-first order, with each node's number path and depth.
 *
 * Used by the Space report so parents like "Utility" appear above
 * their children. A parent's value is its derived sum (Σ of children),
 * which the caller renders just like a leaf value.
 */
export function allRows(
  root: ProcessNode,
): { node: ProcessNode; path: number[]; depth: number; isLeaf: boolean }[] {
  const out: { node: ProcessNode; path: number[]; depth: number; isLeaf: boolean }[] = [];
  const walk = (node: ProcessNode, path: number[], depth: number) => {
    const children = node.children ?? [];
    out.push({ node, path, depth, isLeaf: children.length === 0 });
    children.forEach((c, i) => walk(c, [...path, i + 1], depth + 1));
  };
  (root.children ?? []).forEach((c, i) => walk(c, [i + 1], 1));
  return out;
}

/**
 * Group leaves by their `valueType` (falling back to a default when a
 * leaf hasn't picked one). Returns an ordered map.
 */
export function groupLeavesByType(
  root: ProcessNode,
  defaultType: string,
): Map<string, { total: number; leaves: { node: ProcessNode; value: number }[] }> {
  const out = new Map<
    string,
    { total: number; leaves: { node: ProcessNode; value: number }[] }
  >();

  const walk = (node: ProcessNode) => {
    const children = node.children ?? [];
    if (children.length === 0) {
      const v = getNodeValue(node).value;
      if (v !== null) {
        const key = node.valueType ?? defaultType;
        const bucket = out.get(key) ?? { total: 0, leaves: [] };
        bucket.total += v;
        bucket.leaves.push({ node, value: v });
        out.set(key, bucket);
      }
      return;
    }
    children.forEach(walk);
  };

  walk(root);
  return out;
}