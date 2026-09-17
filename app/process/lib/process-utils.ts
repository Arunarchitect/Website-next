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
   * LEAF-ONLY. One number, in the document's BASE unit (see ProcessData.valueDef).
   * A node WITH children never stores its own value; its number is derived
   * from whichever children resolve to a number (see getNodeValue).
   */
  value?: number;

  /** @deprecated legacy alias for `value`. Migrated on load. */
  area?: number;
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

  /** What the leaf numbers mean, and their conversion table. */
  valueDef?: ValueDef;

  /** Which display unit is currently selected. Purely cosmetic. */
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

/* =========================================================
   SINGLE DOCUMENT-LEVEL VALUE
   ---------------------------------------------------------
   Each leaf node carries ONE number: `value`. The document decides
   what that number *means* — its label ("Area"), its base unit ("m²"),
   and which display units the user can switch between. Parents never
   store their own value; theirs is always the sum of their children.

   Values are ALWAYS stored in the document's base unit. Switching
   display units converts on the fly; nothing on disk is rewritten.
========================================================= */

export type UnitOption = {
  /** Short symbol shown in the UI, e.g. "m²", "ft²". */
  symbol: string;
  /** Multiply a base-unit value by this to get the display value. */
  fromBase: number;
  /** Multiply a display value by this to get back to base. */
  toBase: number;
};

/** The document's chosen value type — one per ProcessData. */
export type ValueDef = {
  /** What this number is, e.g. "Area", "Cost", "Length". */
  label: string;
  /** Base unit symbol — what stored values are assumed to be in. */
  unit: string;
  unitPosition?: "prefix" | "suffix"; // default suffix ("12 m²"); prefix for "₹12"
  precision?: number;                 // decimals, default 2
  /** Alternative display units, including the base one. */
  units: UnitOption[];
};

export type ValueResult = {
  value: number | null;
  partial: boolean;
};

const unit = (symbol: string, fromBase: number, toBase: number): UnitOption => ({
  symbol,
  fromBase,
  toBase,
});

const base = (symbol: string): UnitOption => unit(symbol, 1, 1);

/* ── Preset value types the user can pick from ──────────────────── */

export const VALUE_PRESETS: Record<string, ValueDef> = {
  area: {
  label: "Area",
  unit: "ft²",          // ← was "m²"
  precision: 2,
  units: [
    base("ft²"),
    unit("m²", 0.09290304, 10.7639104),
    unit("yd²", 0.111111, 9),
  ],
},
  volume: {
    label: "Volume",
    unit: "m³",
    precision: 2,
    units: [
      base("m³"),
      unit("ft³", 35.3146667, 0.0283168466),
      unit("L", 1000, 0.001),
    ],
  },
  length: {
    label: "Length",
    unit: "m",
    precision: 2,
    units: [
      base("m"),
      unit("ft", 3.2808399, 0.3048),
      unit("cm", 100, 0.01),
      unit("mm", 1000, 0.001),
    ],
  },
  cost: {
    label: "Cost",
    unit: "₹",
    unitPosition: "prefix",
    precision: 2,
    units: [
      base("₹"),
      unit("$", 0.012, 83.3333),
      unit("€", 0.011, 90.9091),
      unit("AED", 0.044, 22.7273),
    ],
  },
  weight: {
    label: "Weight",
    unit: "kg",
    precision: 2,
    units: [
      base("kg"),
      unit("lb", 2.20462262, 0.45359237),
      unit("t", 0.001, 1000),
    ],
  },
  count: {
    label: "Count",
    unit: "",
    precision: 0,
    units: [base("")],
  },
};

/** The default value type — used when a document doesn't declare one. */
export const DEFAULT_VALUE_DEF: ValueDef = VALUE_PRESETS.area;

/** Safe resolution: document's def wins, otherwise the default. */
export function resolveValueDef(def: ValueDef | undefined): ValueDef {
  return def ?? DEFAULT_VALUE_DEF;
}

/* ── Unit selection + conversion ─────────────────────────────────── */

export function resolveUnit(def: ValueDef, chosenSymbol?: string): UnitOption {
  if (def.units.length === 0) return base(def.unit);
  if (chosenSymbol) {
    const match = def.units.find((u) => u.symbol === chosenSymbol);
    if (match) return match;
  }
  const baseOpt = def.units.find((u) => u.symbol === def.unit);
  return baseOpt ?? def.units[0];
}

export function toDisplay(baseValue: number, def: ValueDef, chosenSymbol?: string): number {
  return baseValue * resolveUnit(def, chosenSymbol).fromBase;
}

export function toBase(displayValue: number, def: ValueDef, chosenSymbol?: string): number {
  return displayValue * resolveUnit(def, chosenSymbol).toBase;
}

/* ── Reading values off the tree ─────────────────────────────────── */

function readLeafValue(node: ProcessNode): number | null {
  if (typeof node.value === "number" && Number.isFinite(node.value)) return node.value;
  // Legacy: files that stored the number under `area` still work.
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

/**
 * Does this document use the value feature at all? True if any node
 * carries a `value` (or a legacy `area`). A document with none renders
 * exactly as a pre-value document did.
 */
export function hasAnyValue(root: ProcessNode): boolean {
  let found = false;
  const walk = (n: ProcessNode) => {
    if (found) return;
    if (typeof n.value === "number" || typeof n.area === "number") {
      found = true;
      return;
    }
    (n.children ?? []).forEach(walk);
  };
  walk(root);
  return found;
}

/** One-way migration: legacy `area` field → `value`. Run on load. */
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

export function migrateProcessData(data: ProcessData): ProcessData {
  return { ...data, children: data.children?.map(migrateNodeValue) };
}

/* ── Back-compat aliases (existing imports keep working) ───────────── */
export type AreaResult = ValueResult;
export const getNodeArea = (node: ProcessNode): ValueResult => getNodeValue(node);
export const formatArea = (value: number): string =>
  formatValue(value, DEFAULT_VALUE_DEF);

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
  const findNode = (node: ProcessNode, id: string): ProcessNode | null => {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };
  const toNode = findNode(root, toId);
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