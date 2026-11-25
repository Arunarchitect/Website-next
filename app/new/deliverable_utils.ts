// Templates + similar-name detection for deliverables.

export interface TemplateItem { name: string; stage: string }
export interface DeliverableTemplate {
  id: string;
  label: string;
  description: string;
  items: TemplateItem[];
}

const S = (stage: string, names: string[]): TemplateItem[] =>
  names.map(name => ({ name, stage }));

// Stage mapping is my assumption from the payment schedule. Edit freely.
const FULL: TemplateItem[] = [
  ...S("1", [
    "Site Analysis, Project Feasibility & Design Strategy Note",
    "First Sketch Plan",
  ]),
  ...S("2", [
    "Revised Plan Drawing after Presentation",
    "Final Detailed Plan Drawings",
    "Sections and Elevation Drawings",
    "Furniture Layout",
    "Exterior 3D Visualizations",
    "Interior 3D Visualizations",
  ]),
  ...S("3", [
    "Final Design Report",
    "Estimate of Cost",
    "Building Permit Drawings",
  ]),
  ...S("4", [
    "Foundation Setout Drawings",
    "Foundation Structural Detail Drawings",
    "Superstructure Setout Drawings",
    "Column/Beam Specifications",
    "Slab Details and Specifications",
    "Lintel and Sunshade Detail Drawings",
    "Door and Window Detail Drawings",
    "Plumbing and Sanitary Fitting Design Drawings",
    "Sanitary Sewer System Detail Drawings",
    "Water Supply System Detail Drawings",
    "Vertical Access and Safety Details",
    "Electrical Drawings",
    "Lighting Design Drawings",
    "Ceiling Design Drawings",
    "HVAC Layout",
    "Roof Plan and Detail Drawings",
    "Floor Finish Detail Drawings",
    "Final Interior and Exterior Finishes and Color Schemes",
    "Detailed Kitchen Layout",
    "Landscape Plan",
    "Hardscape Detail Drawings",
    "Design of Wardrobe and Fixed Furniture",
    "Toilet Wall and Floor Detail Drawings",
    "Furniture Selection Specifications",
    "Electrical and Sanitary Fittings Specifications",
    "Interior Wall Ornaments and Art Installation Specifications",
    "Work Schedule",
  ]),
  ...S("5", [
    "Completion Drawing for Building Number",
    "Project Completion Report and Building Manual",
  ]),
];

const INTERIOR_NAMES = new Set([
  "Furniture Layout",
  "Interior 3D Visualizations",
  "Ceiling Design Drawings",
  "Lighting Design Drawings",
  "Floor Finish Detail Drawings",
  "Final Interior and Exterior Finishes and Color Schemes",
  "Detailed Kitchen Layout",
  "Design of Wardrobe and Fixed Furniture",
  "Toilet Wall and Floor Detail Drawings",
  "Furniture Selection Specifications",
  "Electrical and Sanitary Fittings Specifications",
  "Interior Wall Ornaments and Art Installation Specifications",
  "Work Schedule",
]);

export const DELIVERABLE_TEMPLATES: DeliverableTemplate[] = [
  {
    id: "full",
    label: "Full design consultation (40)",
    description: "All 40 deliverables across Stages 1–5",
    items: FULL,
  },
  {
    id: "concept_permit",
    label: "Concept to permit (Stages 1–3)",
    description: "Site analysis through building permit drawings",
    items: FULL.filter(i => ["1", "2", "3"].includes(i.stage)),
  },
  {
    id: "interior",
    label: "Interior package",
    description: "Interior-focused deliverables only",
    items: FULL.filter(i => INTERIOR_NAMES.has(i.name)),
  },
];

// ── Similar-name detection ───────────────────────────────────────────────────

export function normName(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// generic words that shouldn't count as a match on their own
const STOP = new Set([
  "a", "an", "and", "of", "the", "for", "to", "in", "on", "with", "after",
  "final", "drawing", "drawings", "detail", "details", "detailed", "design",
  "plan", "report", "layout",
]);

const SYN: Record<string, string> = {
  modelling: "model", modeling: "model", modelled: "model", model: "model",
  visualization: "visual", visualisation: "visual", render: "visual", rendering: "visual",
  specification: "spec", spec: "spec",
};

function stem(t: string): string {
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return SYN[t] ?? t;
}

function tokens(s: string): Set<string> {
  return new Set(
    normName(s).split(" ").filter(Boolean).map(stem).filter(t => !STOP.has(t)),
  );
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

export type SimilarKind = "same" | "similar";
export interface SimilarMatch<T> { item: T; kind: SimilarKind }

export function findSimilar<T extends { id: number; name: string }>(
  name: string,
  existing: T[],
  excludeId?: number,
): SimilarMatch<T>[] {
  const n = normName(name);
  if (!n) return [];
  const ta = tokens(name);
  const out: SimilarMatch<T>[] = [];

  for (const e of existing) {
    if (e.id === excludeId) continue;
    const en = normName(e.name);
    if (!en) continue;

    if (en === n) { out.push({ item: e, kind: "same" }); continue; }

    const tb = tokens(e.name);
    let inter = 0;
    ta.forEach(t => { if (tb.has(t)) inter++; });
    const union = ta.size + tb.size - inter;
    const jacc = union ? inter / union : 0;
    const ratio = 1 - lev(n, en) / Math.max(n.length, en.length);
    const contains = n.length > 4 && en.length > 4 && (n.includes(en) || en.includes(n));

    if (jacc >= 0.5 || ratio >= 0.8 || contains) out.push({ item: e, kind: "similar" });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "same" ? -1 : 1));
}