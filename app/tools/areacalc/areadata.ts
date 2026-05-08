// ─── CONSTANTS ───────────────────────────────────────────────

export const UNIT_SYSTEMS = {
  sqft: { label: "sq ft", areaLabel: "sqft", factor: 1, dimLabel: "ft", dimFactor: 1 },
  sqm: { label: "sq m", areaLabel: "sqm", factor: 0.0929, dimLabel: "m", dimFactor: 0.3048 },
};

// ─── SURVEY-BASED LOCATION RATES ──────────────────────────────

export type RateProjectCategory =
  | "residence"
  | "school"
  | "commercial"
  | "healthcare"
  | "hospitality";

export type SurveySourceType =
  | "architect"
  | "contractor"
  | "engineer"
  | "client"
  | "completed_project"
  | "other";

export interface SurveyRateEntry {
  id: string;
  sourceName?: string;
  sourceType: SurveySourceType;
  projectCategory: RateProjectCategory;
  ratePerSqft: number;
  locationNote?: string;
  finishLevel?: "basic" | "standard" | "premium" | "luxury" | "unknown";
  surveyedOn?: string;
  notes?: string;
}

export interface SurveyRegionRate {
  label: string;
  fallbackRate: number;
  surveyRates: SurveyRateEntry[];
}

export interface SurveyStateRate {
  label: string;
  regions: Record<string, SurveyRegionRate>;
}

export const LOCATION_RATES: Record<string, SurveyStateRate> = {
  kerala: {
    label: "Kerala",
    regions: {
      trivandrum: { label: "Thiruvananthapuram", fallbackRate: 2200, surveyRates: [] },
      kochi: { label: "Kochi / Ernakulam", fallbackRate: 2600, surveyRates: [] },
      kozhikode: { label: "Kozhikode", fallbackRate: 2100, surveyRates: [] },
      thrissur: { label: "Thrissur", fallbackRate: 2000, surveyRates: [] },
      kollam: {
        label: "Kollam",
        fallbackRate: 1900,
        surveyRates: [
          // Example format only. Replace/add your real surveyed entries:
          // {
          //   id: "kollam-res-001",
          //   sourceName: "Architect name / office name",
          //   sourceType: "architect",
          //   projectCategory: "residence",
          //   ratePerSqft: 2200,
          //   finishLevel: "standard",
          //   surveyedOn: "2026-05-07",
          //   locationNote: "Kollam urban area",
          //   notes: "Residence built-up area rate excluding loose furniture",
          // },
        ],
      },
      palakkad: { label: "Palakkad", fallbackRate: 1800, surveyRates: [] },
      kottayam: { label: "Kottayam", fallbackRate: 2000, surveyRates: [] },
      malappuram: { label: "Malappuram", fallbackRate: 1850, surveyRates: [] },
      kannur: { label: "Kannur", fallbackRate: 1950, surveyRates: [] },
      other_kerala: { label: "Other Kerala", fallbackRate: 1750, surveyRates: [] },
    },
  },
  tamilnadu: {
    label: "Tamil Nadu",
    regions: {
      chennai: { label: "Chennai", fallbackRate: 3200, surveyRates: [] },
      coimbatore: { label: "Coimbatore", fallbackRate: 2400, surveyRates: [] },
      madurai: { label: "Madurai", fallbackRate: 2100, surveyRates: [] },
      salem: { label: "Salem", fallbackRate: 1900, surveyRates: [] },
      tiruchirappalli: { label: "Tiruchirappalli", fallbackRate: 2000, surveyRates: [] },
      tirunelveli: { label: "Tirunelveli", fallbackRate: 1850, surveyRates: [] },
      vellore: { label: "Vellore", fallbackRate: 1950, surveyRates: [] },
      other_tn: { label: "Other Tamil Nadu", fallbackRate: 1800, surveyRates: [] },
    },
  },
  karnataka: {
    label: "Karnataka",
    regions: {
      bangalore: { label: "Bengaluru", fallbackRate: 3500, surveyRates: [] },
      mysore: { label: "Mysuru", fallbackRate: 2300, surveyRates: [] },
      hubli: { label: "Hubballi-Dharwad", fallbackRate: 2000, surveyRates: [] },
      mangalore: { label: "Mangaluru", fallbackRate: 2400, surveyRates: [] },
      other_ka: { label: "Other Karnataka", fallbackRate: 1900, surveyRates: [] },
    },
  },
  andhra: {
    label: "Andhra Pradesh",
    regions: {
      visakhapatnam: { label: "Visakhapatnam", fallbackRate: 2200, surveyRates: [] },
      vijayawada: { label: "Vijayawada", fallbackRate: 2000, surveyRates: [] },
      guntur: { label: "Guntur", fallbackRate: 1900, surveyRates: [] },
      other_ap: { label: "Other AP", fallbackRate: 1750, surveyRates: [] },
    },
  },
  telangana: {
    label: "Telangana",
    regions: {
      hyderabad: { label: "Hyderabad", fallbackRate: 3000, surveyRates: [] },
      warangal: { label: "Warangal", fallbackRate: 2100, surveyRates: [] },
      other_tg: { label: "Other Telangana", fallbackRate: 1900, surveyRates: [] },
    },
  },
  goa: {
    label: "Goa",
    regions: {
      panaji: { label: "Panaji / North Goa", fallbackRate: 3800, surveyRates: [] },
      south_goa: { label: "South Goa", fallbackRate: 3400, surveyRates: [] },
    },
  },
};

// Derive StateKey from the object keys at the type level
export type StateKey = keyof typeof LOCATION_RATES;

export function getSurveyEntries(
  stateKey: StateKey,
  regionKey: string,
  projectCategory?: RateProjectCategory,
): SurveyRateEntry[] {
  const region = LOCATION_RATES[stateKey]?.regions?.[regionKey];
  if (!region) return [];
  if (!projectCategory) return region.surveyRates;
  return region.surveyRates.filter((entry) => entry.projectCategory === projectCategory);
}

export function getAverageSurveyRate(entries: SurveyRateEntry[]): number | null {
  const validRates = entries
    .map((entry) => entry.ratePerSqft)
    .filter((rate) => Number.isFinite(rate) && rate > 0);

  if (validRates.length === 0) return null;
  return Math.round(validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length);
}

export function getLocationRate(
  stateKey: StateKey,
  regionKey: string,
  projectCategory: RateProjectCategory = "residence",
): number {
  const region = LOCATION_RATES[stateKey]?.regions?.[regionKey];
  if (!region) return 2000;

  const categoryAverage = getAverageSurveyRate(getSurveyEntries(stateKey, regionKey, projectCategory));
  if (categoryAverage) return categoryAverage;

  const overallAverage = getAverageSurveyRate(getSurveyEntries(stateKey, regionKey));
  if (overallAverage) return overallAverage;

  return region.fallbackRate;
}

export function getRateDataStatus(
  stateKey: StateKey,
  regionKey: string,
  projectCategory: RateProjectCategory = "residence",
): { source: string; sampleCount: number; label: string } {
  const region = LOCATION_RATES[stateKey]?.regions?.[regionKey];
  if (!region) {
    return { source: "default", sampleCount: 0, label: "Default estimate" };
  }

  const categoryEntries = getSurveyEntries(stateKey, regionKey, projectCategory);
  if (categoryEntries.length > 0) {
    return {
      source: "survey",
      sampleCount: categoryEntries.length,
      label: `Survey average · ${categoryEntries.length} sample${categoryEntries.length === 1 ? "" : "s"}`,
    };
  }

  const allEntries = getSurveyEntries(stateKey, regionKey);
  if (allEntries.length > 0) {
    return {
      source: "survey_all_categories",
      sampleCount: allEntries.length,
      label: `Survey average · all categories · ${allEntries.length} sample${allEntries.length === 1 ? "" : "s"}`,
    };
  }

  return { source: "fallback", sampleCount: 0, label: "Fallback baseline rate" };
}

export const CATEGORY_META = {
  residence: { label: "Residence", color: "#B45309", bg: "#FEF3C7", border: "#FCD34D", badge: "#92400E", badgeBg: "#FEF3C7" },
  school: { label: "Education", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", badge: "#1E3A8A", badgeBg: "#DBEAFE" },
  commercial: { label: "Commercial", color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", badge: "#4C1D95", badgeBg: "#EDE9FE" },
  healthcare: { label: "Healthcare", color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", badge: "#064E3B", badgeBg: "#D1FAE5" },
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

// ─── TYPES ────────────────────────────────────────────────────

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

// ─── SPACE DATA ──────────────────────────────────────────────

export const SPACE_TEMPLATES: SpaceTemplate[] = [
  // RESIDENCE
  {
    id: "res_master_bed", name: "Master Bedroom", category: "residence", L: 14, B: 12, icon: "🛏️",
    description: "Primary bedroom with attached bath",
    subSpaces: [
      { id: "sub_att_toilet", name: "Attached Toilet", L: 8, B: 5, description: "En-suite bathroom" },
      { id: "sub_wardrobe", name: "Wardrobe Alcove", L: 6, B: 2, description: "Built-in wardrobe" },
      { id: "sub_balcony", name: "Balcony", L: 10, B: 4, description: "Private balcony" },
    ],
  },
  {
    id: "res_bedroom", name: "Bedroom", category: "residence", L: 12, B: 10, icon: "🛏️",
    description: "Standard bedroom",
    subSpaces: [
      { id: "sub_common_wc", name: "Common Toilet", L: 7, B: 4, description: "Shared bathroom" },
      { id: "sub_study_nook", name: "Study Nook", L: 5, B: 4, description: "Reading/study alcove" },
    ],
  },
  {
    id: "res_living", name: "Living Room", category: "residence", L: 18, B: 14, icon: "🛋️",
    description: "Primary social space",
    subSpaces: [
      { id: "sub_foyer", name: "Foyer / Entry", L: 6, B: 5, description: "Entry zone" },
      { id: "sub_pooja", name: "Pooja Room", L: 5, B: 4, description: "Prayer alcove — Kerala homes" },
    ],
  },
  { id: "res_dining", name: "Dining Room", category: "residence", L: 14, B: 10, icon: "🍽️", description: "Dining for 6–8 persons", subSpaces: [] },
  {
    id: "res_kitchen", name: "Kitchen", category: "residence", L: 14, B: 10, icon: "🍳",
    description: "Modular kitchen",
    subSpaces: [
      { id: "sub_utility", name: "Utility / Wash", L: 8, B: 5, description: "Washing + drying area" },
      { id: "sub_store", name: "Store Room", L: 6, B: 5, description: "Dry storage" },
      { id: "sub_pantry", name: "Pantry", L: 5, B: 4, description: "Walk-in pantry" },
    ],
  },
  { id: "res_toilet", name: "Common Toilet", category: "residence", L: 7, B: 4, icon: "🚿", description: "Guest toilet on ground floor", subSpaces: [] },
  { id: "res_sit_out", name: "Sit-out / Verandah", category: "residence", L: 14, B: 6, icon: "🌿", description: "Semi-open Kerala-style verandah", subSpaces: [] },
  { id: "res_car_porch", name: "Car Porch", category: "residence", L: 18, B: 12, icon: "🚗", description: "Covered parking 1–2 vehicles", subSpaces: [] },
  { id: "res_staircase", name: "Staircase", category: "residence", L: 12, B: 5, icon: "🪜", description: "Stair + landing", subSpaces: [] },
  { id: "res_passage", name: "Corridor / Passage", category: "residence", L: 14, B: 4, icon: "↔️", description: "Internal corridor", subSpaces: [] },
  // SCHOOL
  {
    id: "sch_classroom", name: "Classroom", category: "school", L: 28, B: 24, icon: "📚",
    description: "40-student classroom",
    subSpaces: [
      { id: "sub_storage_cab", name: "Storage Cabinet", L: 4, B: 2, description: "Built-in storage" },
    ],
  },
  { id: "sch_staff_room", name: "Staff Room", category: "school", L: 20, B: 16, icon: "👩‍🏫", description: "Common room for teaching staff", subSpaces: [] },
  {
    id: "sch_principal", name: "Principal's Office", category: "school", L: 16, B: 14, icon: "🏫",
    description: "Admin office",
    subSpaces: [
      { id: "sub_waiting", name: "Waiting Area", L: 10, B: 8, description: "Visitor seating" },
    ],
  },
  { id: "sch_library", name: "Library", category: "school", L: 30, B: 24, icon: "📖", description: "Reading room + stacks", subSpaces: [] },
  {
    id: "sch_lab", name: "Science / Computer Lab", category: "school", L: 30, B: 24, icon: "🔬",
    description: "Lab with power/water provisions",
    subSpaces: [
      { id: "sub_prep_room", name: "Prep Room", L: 12, B: 8, description: "Chemical/equipment storage" },
    ],
  },
  { id: "sch_toilet_block", name: "Toilet Block", category: "school", L: 20, B: 10, icon: "🚽", description: "Boys + Girls per floor", subSpaces: [] },
  {
    id: "sch_assembly", name: "Assembly Hall", category: "school", L: 60, B: 40, icon: "🎭",
    description: "Multi-purpose hall with stage",
    subSpaces: [
      { id: "sub_stage", name: "Stage", L: 30, B: 16, description: "Raised performance stage" },
      { id: "sub_green_room", name: "Green Room", L: 12, B: 10, description: "Backstage dressing room" },
    ],
  },
  // COMMERCIAL
  {
    id: "com_retail", name: "Retail Shop Unit", category: "commercial", L: 20, B: 15, icon: "🛍️",
    description: "Standard shop unit",
    subSpaces: [
      { id: "sub_back_store", name: "Back Storage", L: 8, B: 6, description: "Stock room at rear" },
    ],
  },
  {
    id: "com_office", name: "Office Space", category: "commercial", L: 30, B: 20, icon: "💼",
    description: "Open-plan office",
    subSpaces: [
      { id: "sub_cabin", name: "Manager Cabin", L: 12, B: 10, description: "Enclosed cabin" },
      { id: "sub_conf", name: "Conference Room", L: 16, B: 12, description: "Meeting room 8–10" },
      { id: "sub_pantry_off", name: "Pantry", L: 10, B: 6, description: "Office kitchen" },
    ],
  },
  { id: "com_lobby", name: "Lobby / Reception", category: "commercial", L: 24, B: 18, icon: "🏢", description: "Building entry lobby", subSpaces: [] },
  {
    id: "com_restaurant", name: "Restaurant / Café", category: "commercial", L: 40, B: 30, icon: "🍴",
    description: "Dining ~15 sqft/cover",
    subSpaces: [
      { id: "sub_com_kitchen", name: "Commercial Kitchen", L: 20, B: 14, description: "Full kitchen zone" },
      { id: "sub_toilet_cust", name: "Customer Toilets", L: 14, B: 8, description: "Male + Female" },
    ],
  },
  { id: "com_parking", name: "Parking Level", category: "commercial", L: 80, B: 50, icon: "🅿️", description: "~300 sqft/car including aisle", subSpaces: [] },
  // HEALTHCARE
  {
    id: "hc_consult", name: "Doctor's Consultation", category: "healthcare", L: 14, B: 12, icon: "🩺",
    description: "Private consultation room",
    subSpaces: [
      { id: "sub_exam_alcove", name: "Examination Alcove", L: 7, B: 5, description: "Screened exam area" },
    ],
  },
  { id: "hc_waiting", name: "Waiting Area", category: "healthcare", L: 20, B: 14, icon: "🪑", description: "Patient waiting ~4 sqft/seat", subSpaces: [] },
  { id: "hc_ward", name: "General Ward", category: "healthcare", L: 30, B: 20, icon: "🏥", description: "6–8 bed ward", subSpaces: [] },
  { id: "hc_pharmacy", name: "Pharmacy", category: "healthcare", L: 16, B: 12, icon: "💊", description: "Dispensing + drug storage", subSpaces: [] },
  // HOSPITALITY
  {
    id: "hot_std_room", name: "Standard Hotel Room", category: "hospitality", L: 16, B: 14, icon: "🛎️",
    description: "Double-occupancy room",
    subSpaces: [
      { id: "sub_hotel_bath", name: "Attached Bathroom", L: 8, B: 6, description: "Bath + WC + basin" },
      { id: "sub_hotel_ward", name: "Wardrobe", L: 5, B: 2, description: "Built-in wardrobe" },
    ],
  },
  {
    id: "hot_suite", name: "Suite", category: "hospitality", L: 24, B: 18, icon: "✨",
    description: "Premium room with living area",
    subSpaces: [
      { id: "sub_suite_living", name: "Sitting Area", L: 12, B: 10, description: "Lounge zone" },
      { id: "sub_suite_bath", name: "Suite Bathroom", L: 10, B: 8, description: "Luxury bath with tub" },
    ],
  },
  { id: "hot_lobby", name: "Hotel Lobby", category: "hospitality", L: 40, B: 30, icon: "🏨", description: "Grand reception + lounge", subSpaces: [] },
  { id: "hot_banquet", name: "Banquet Hall", category: "hospitality", L: 80, B: 50, icon: "🎉", description: "~10 sqft/person banquet", subSpaces: [] },
];

// ─── PROJECT TEMPLATES ────────────────────────────────────────
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "tpl_budget_home",
    label: "Budget Home",
    description: "2BHK · ~900 sqft · Simple, efficient layout",
    icon: "🏠",
    spaces: [
      { templateId: "res_living", floor: 0, L: 14, B: 12, subIds: [] },
      { templateId: "res_kitchen", floor: 0, L: 10, B: 8, subIds: ["sub_utility"] },
      { templateId: "res_dining", floor: 0, L: 10, B: 8, subIds: [] },
      { templateId: "res_toilet", floor: 0, L: 6, B: 4, subIds: [] },
      { templateId: "res_bedroom", floor: 0, L: 10, B: 10, subIds: [] },
      { templateId: "res_master_bed", floor: 0, L: 12, B: 10, subIds: ["sub_att_toilet"] },
      { templateId: "res_car_porch", floor: 0, L: 14, B: 10, subIds: [] },
    ],
  },
  {
    id: "tpl_mid_home",
    label: "Mid-Range Home",
    description: "3BHK · ~1,500 sqft · Two floors, pooja room",
    icon: "🏡",
    spaces: [
      { templateId: "res_sit_out", floor: 0, L: 14, B: 6, subIds: [] },
      { templateId: "res_living", floor: 0, L: 18, B: 14, subIds: ["sub_foyer", "sub_pooja"] },
      { templateId: "res_dining", floor: 0, L: 14, B: 10, subIds: [] },
      { templateId: "res_kitchen", floor: 0, L: 14, B: 10, subIds: ["sub_utility", "sub_store"] },
      { templateId: "res_toilet", floor: 0, L: 7, B: 4, subIds: [] },
      { templateId: "res_car_porch", floor: 0, L: 18, B: 12, subIds: [] },
      { templateId: "res_staircase", floor: 0, L: 12, B: 5, subIds: [] },
      { templateId: "res_master_bed", floor: 1, L: 14, B: 12, subIds: ["sub_att_toilet", "sub_balcony"] },
      { templateId: "res_bedroom", floor: 1, L: 12, B: 10, subIds: ["sub_common_wc"] },
      { templateId: "res_bedroom", floor: 1, L: 11, B: 10, subIds: [] },
      { templateId: "res_passage", floor: 1, L: 14, B: 4, subIds: [] },
    ],
  },
  {
    id: "tpl_luxury_home",
    label: "Luxury Home",
    description: "4BHK + · ~3,000 sqft · Premium finishes, two floors",
    icon: "🏰",
    spaces: [
      { templateId: "res_sit_out", floor: 0, L: 20, B: 8, subIds: [] },
      { templateId: "res_living", floor: 0, L: 22, B: 18, subIds: ["sub_foyer", "sub_pooja"] },
      { templateId: "res_dining", floor: 0, L: 18, B: 14, subIds: [] },
      { templateId: "res_kitchen", floor: 0, L: 16, B: 14, subIds: ["sub_utility", "sub_store", "sub_pantry"] },
      { templateId: "res_bedroom", floor: 0, L: 14, B: 12, subIds: ["sub_common_wc"] },
      { templateId: "res_toilet", floor: 0, L: 8, B: 5, subIds: [] },
      { templateId: "res_car_porch", floor: 0, L: 22, B: 14, subIds: [] },
      { templateId: "res_staircase", floor: 0, L: 14, B: 6, subIds: [] },
      { templateId: "res_master_bed", floor: 1, L: 18, B: 14, subIds: ["sub_att_toilet", "sub_wardrobe", "sub_balcony"] },
      { templateId: "res_bedroom", floor: 1, L: 14, B: 12, subIds: ["sub_att_toilet"] },
      { templateId: "res_bedroom", floor: 1, L: 14, B: 12, subIds: ["sub_common_wc"] },
      { templateId: "res_bedroom", floor: 1, L: 13, B: 11, subIds: ["sub_study_nook"] },
      { templateId: "res_passage", floor: 1, L: 18, B: 5, subIds: [] },
    ],
  },
];

// ─── UTILITIES ────────────────────────────────────────────────
let _id = 0;
export const uid = () => `inst_${++_id}_${Math.random().toString(36).slice(2, 7)}`;

export function toUnit(sqftVal: number, unit: UnitKey): number {
  if (unit === "sqm") return sqftVal * 0.0929;
  return sqftVal;
}
export function fromUnit(val: number, unit: UnitKey): number {
  if (unit === "sqm") return val / 0.0929;
  return val;
}
export function dimToUnit(ftVal: number, unit: UnitKey): number {
  if (unit === "sqm") return ftVal * 0.3048;
  return ftVal;
}
export function dimFromUnit(val: number, unit: UnitKey): number {
  if (unit === "sqm") return val / 0.3048;
  return val;
}

export function fmt(n: number, unit: UnitKey): string {
  const display = toUnit(n, unit);
  return display.toLocaleString("en-IN", { maximumFractionDigits: 1 });
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
  const main = space.L * space.B;
  const sub = space.subSpaces.reduce((a, s) => a + s.L * s.B, 0);
  return main + sub;
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