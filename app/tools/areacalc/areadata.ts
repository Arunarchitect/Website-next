// areadata.ts — constants, types, and pure utility functions only.
// Hardcoded LOCATION_RATES / SPACE_TEMPLATES / PROJECT_TEMPLATES removed.
// Fetch those from the Django API via areacalcApi.ts.

export const UNIT_SYSTEMS = {
  sqft: { label: "sq ft", areaLabel: "sqft", factor: 1, dimLabel: "ft", dimFactor: 1 },
  sqm: { label: "sq m", areaLabel: "sqm", factor: 0.0929, dimLabel: "m", dimFactor: 0.3048 },
};

export const CATEGORY_META = {
  residence:   { label: "Residence",   color: "#B45309", bg: "#FEF3C7", border: "#FCD34D", badge: "#92400E", badgeBg: "#FEF3C7" },
  school:      { label: "Education",   color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", badge: "#1E3A8A", badgeBg: "#DBEAFE" },
  commercial:  { label: "Commercial",  color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", badge: "#4C1D95", badgeBg: "#EDE9FE" },
  healthcare:  { label: "Healthcare",  color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", badge: "#064E3B", badgeBg: "#D1FAE5" },
  hospitality: { label: "Hospitality", color: "#9D174D", bg: "#FDF2F8", border: "#FBCFE8", badge: "#831843", badgeBg: "#FCE7F3" },
};

export const FLOOR_LABELS: Record<number, string> = {
  "-1": "Basement",
  0: "Ground Floor",
  1: "First Floor",
  2: "Second Floor",
  3: "Third Floor",
  4: "Fourth Floor",
  5: "Fifth Floor",
};
export const FLOORS = [-1, 0, 1, 2, 3, 4, 5];
export const getFloorLabel = (f: number) => FLOOR_LABELS[f] ?? `Floor ${f}`;

// ── Types ─────────────────────────────────────────────────────

export type UnitKey = keyof typeof UNIT_SYSTEMS;
export type CategoryKey = keyof typeof CATEGORY_META;

export interface SubSpaceTemplate {
  id: string;
  name: string;
  L: number;
  B: number;
  description: string;
}

export interface SpaceTemplate {
  id: string;
  name: string;
  category: CategoryKey;
  L: number;
  B: number;
  icon: string;
  description: string;
  subSpaces?: SubSpaceTemplate[];
}

export interface SubSpaceInstance {
  instanceId: string;
  templateId: string;
  name: string;
  L: number;
  B: number;
  description: string;
}

export interface SpaceInstance {
  instanceId: string;
  templateId: string;
  name: string;
  category: CategoryKey;
  L: number;
  B: number;
  floor: number;
  description: string;
  icon: string;
  subSpaces: SubSpaceInstance[];
  isCustom: boolean;
}

export interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  spaces: { templateId: string; floor: number; L: number; B: number; subIds: string[] }[];
}

// ── Utilities ─────────────────────────────────────────────────

let _id = 0;
export const uid = () => `inst_${++_id}_${Math.random().toString(36).slice(2, 7)}`;

export function toUnit(sqftVal: number, unit: UnitKey): number {
  return unit === "sqm" ? sqftVal * 0.0929 : sqftVal;
}
export function fromUnit(val: number, unit: UnitKey): number {
  return unit === "sqm" ? val / 0.0929 : val;
}
export function dimToUnit(ftVal: number, unit: UnitKey): number {
  return unit === "sqm" ? ftVal * 0.3048 : ftVal;
}
export function dimFromUnit(val: number, unit: UnitKey): number {
  return unit === "sqm" ? val / 0.3048 : val;
}
export function fmt(n: number, unit: UnitKey): string {
  return toUnit(n, unit).toLocaleString("en-IN", { maximumFractionDigits: 1 });
}
export function fmtDim(ft: number, unit: UnitKey): string {
  return dimToUnit(ft, unit).toFixed(unit === "sqm" ? 2 : 1);
}
export function fmtCost(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function calcSpaceArea(space: SpaceInstance): number {
  return space.L * space.B + space.subSpaces.reduce((a, s) => a + s.L * s.B, 0);
}

export function calcGrossArea(
  spaces: SpaceInstance[],
  wall: number,
  circ: number,
  costPerSqft: number,
): { net: number; wallA: number; circA: number; gross: number; cost: number } {
  const net = spaces.reduce((a, s) => a + calcSpaceArea(s), 0);
  const wallA = (net * wall) / 100;
  const circA = (net * circ) / 100;
  const gross = net + wallA + circA;
  return { net, wallA, circA, gross, cost: gross * costPerSqft };
}

export function groupByFloor(spaces: SpaceInstance[]): Map<number, SpaceInstance[]> {
  const map = new Map<number, SpaceInstance[]>();
  for (const s of spaces) {
    if (!map.has(s.floor)) map.set(s.floor, []);
    map.get(s.floor)!.push(s);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}

export function makeSpaceFromTemplate(
  t: SpaceTemplate,
  floor: number,
  subIds: string[],
  overrideL?: number,
  overrideB?: number,
): SpaceInstance {
  const L = overrideL ?? t.L;
  const B = overrideB ?? t.B;
  const subSpaces = (subIds ?? [])
    .map((sid) => {
      const subT = t.subSpaces?.find((s) => s.id === sid);
      if (!subT) return null;
      return {
        instanceId: uid(),
        templateId: subT.id,
        name: subT.name,
        L: subT.L,
        B: subT.B,
        description: subT.description,
      };
    })
    .filter((x): x is SubSpaceInstance => x !== null);

  return {
    instanceId: uid(),
    templateId: t.id,
    name: t.name,
    category: t.category,
    L,
    B,
    floor: floor ?? 0,
    description: t.description,
    icon: t.icon,
    subSpaces,
    isCustom: false,
  };
}