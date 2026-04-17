// ─────────────────────────────────────────────────────────────
//  areacalc.ts  –  Architectural Area Calculator Dataset
// ─────────────────────────────────────────────────────────────

export type SpaceCategory = "residence" | "school" | "commercial" | "healthcare" | "hospitality";

export interface SubSpaceTemplate {
  id: string;
  name: string;
  defaultLength: number; // in feet
  defaultBreadth: number; // in feet
  remarks: string;
}

export interface SpaceTemplate {
  id: string;
  name: string;
  category: SpaceCategory;
  defaultLength: number; // in feet
  defaultBreadth: number; // in feet
  remarks: string;
  icon: string;
  subSpaces?: SubSpaceTemplate[];
}

export interface SpaceInstance {
  instanceId: string;
  templateId: string;
  name: string;
  category: SpaceCategory;
  length: number;
  breadth: number;
  floor: number; // 0 = Ground floor, 1 = First floor, etc.
  remarks: string;
  icon: string;
  subSpaces: SubSpaceInstance[];
  isExpanded?: boolean;
}

export interface SubSpaceInstance {
  instanceId: string;
  templateId: string;
  name: string;
  length: number;
  breadth: number;
  remarks: string;
}

export interface ProjectSettings {
  wallThicknessPercent: number;    // default 10%
  circulationPercent: number;      // default 15%
  costPerSqft: number;             // default 2000 INR
  currency: string;                // default "₹"
  areaUnit: string;                // default "sqft"
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  wallThicknessPercent: 10,
  circulationPercent: 15,
  costPerSqft: 2000,
  currency: "₹",
  areaUnit: "sqft",
};

// ─── RESIDENCE SPACES ────────────────────────────────────────
const residenceSpaces: SpaceTemplate[] = [
  {
    id: "res_master_bed",
    name: "Master Bedroom",
    category: "residence",
    defaultLength: 14,
    defaultBreadth: 12,
    remarks: "Primary bedroom with attached bath. Typically placed on upper floors for privacy.",
    icon: "🛏️",
    subSpaces: [
      { id: "sub_attached_toilet", name: "Attached Toilet", defaultLength: 8, defaultBreadth: 5, remarks: "En-suite toilet/bath attached to bedroom." },
      { id: "sub_wardrobe_alcove", name: "Wardrobe Alcove", defaultLength: 6, defaultBreadth: 2, remarks: "Built-in wardrobe recess." },
      { id: "sub_balcony", name: "Balcony", defaultLength: 10, defaultBreadth: 4, remarks: "Private balcony off master bedroom." },
    ],
  },
  {
    id: "res_bedroom",
    name: "Bedroom",
    category: "residence",
    defaultLength: 12,
    defaultBreadth: 10,
    remarks: "Standard bedroom. Can accommodate double bed + wardrobe.",
    icon: "🛏️",
    subSpaces: [
      { id: "sub_common_toilet", name: "Common Toilet", defaultLength: 7, defaultBreadth: 4, remarks: "Shared bathroom adjacent to bedroom." },
      { id: "sub_study_nook", name: "Study Nook", defaultLength: 5, defaultBreadth: 4, remarks: "Small reading/study alcove." },
    ],
  },
  {
    id: "res_living",
    name: "Living Room",
    category: "residence",
    defaultLength: 18,
    defaultBreadth: 14,
    remarks: "Primary social space. Should have good natural light and ventilation.",
    icon: "🛋️",
    subSpaces: [
      { id: "sub_foyer", name: "Foyer / Entry", defaultLength: 6, defaultBreadth: 5, remarks: "Entry transition zone." },
      { id: "sub_pooja", name: "Pooja Room", defaultLength: 5, defaultBreadth: 4, remarks: "Prayer/worship alcove, common in Kerala homes." },
    ],
  },
  {
    id: "res_dining",
    name: "Dining Room",
    category: "residence",
    defaultLength: 14,
    defaultBreadth: 10,
    remarks: "Dining area for 6–8 persons. Best connected to kitchen.",
    icon: "🍽️",
    subSpaces: [],
  },
  {
    id: "res_kitchen",
    name: "Kitchen",
    category: "residence",
    defaultLength: 14,
    defaultBreadth: 10,
    remarks: "Modular kitchen with provision for utility area.",
    icon: "🍳",
    subSpaces: [
      { id: "sub_utility", name: "Utility / Wash Area", defaultLength: 8, defaultBreadth: 5, remarks: "Washing machine, drying, utility sink." },
      { id: "sub_store", name: "Store Room", defaultLength: 6, defaultBreadth: 5, remarks: "Dry goods and provisions storage." },
      { id: "sub_pantry", name: "Pantry", defaultLength: 5, defaultBreadth: 4, remarks: "Small walk-in pantry or larder." },
    ],
  },
  {
    id: "res_toilet",
    name: "Common Toilet",
    category: "residence",
    defaultLength: 7,
    defaultBreadth: 4,
    remarks: "Guest/common toilet on ground floor.",
    icon: "🚽",
    subSpaces: [],
  },
  {
    id: "res_sit_out",
    name: "Sit-out / Verandah",
    category: "residence",
    defaultLength: 14,
    defaultBreadth: 6,
    remarks: "Open or semi-open transitional space typical in Kerala homes.",
    icon: "🌿",
    subSpaces: [],
  },
  {
    id: "res_car_porch",
    name: "Car Porch",
    category: "residence",
    defaultLength: 18,
    defaultBreadth: 12,
    remarks: "Covered parking for 1–2 vehicles.",
    icon: "🚗",
    subSpaces: [],
  },
  {
    id: "res_staircase",
    name: "Staircase",
    category: "residence",
    defaultLength: 12,
    defaultBreadth: 5,
    remarks: "Stair flight + landing. Adjust for open-riser/closed-riser type.",
    icon: "🪜",
    subSpaces: [],
  },
  {
    id: "res_passage",
    name: "Passage / Corridor",
    category: "residence",
    defaultLength: 14,
    defaultBreadth: 4,
    remarks: "Internal corridor connecting bedrooms.",
    icon: "↔️",
    subSpaces: [],
  },
];

// ─── SCHOOL SPACES ───────────────────────────────────────────
const schoolSpaces: SpaceTemplate[] = [
  {
    id: "sch_classroom",
    name: "Classroom",
    category: "school",
    defaultLength: 28,
    defaultBreadth: 24,
    remarks: "Standard classroom for 40 students. Min. 1 sqft/student for Kerala norms.",
    icon: "📚",
    subSpaces: [
      { id: "sub_storage_cabinet", name: "Storage Cabinet Area", defaultLength: 4, defaultBreadth: 2, remarks: "Wall-mounted or built-in storage." },
    ],
  },
  {
    id: "sch_staff_room",
    name: "Staff Room",
    category: "school",
    defaultLength: 20,
    defaultBreadth: 16,
    remarks: "Common room for teaching staff.",
    icon: "👩‍🏫",
    subSpaces: [],
  },
  {
    id: "sch_principal_office",
    name: "Principal's Office",
    category: "school",
    defaultLength: 16,
    defaultBreadth: 14,
    remarks: "Administrative office with attached toilet and waiting area.",
    icon: "🏫",
    subSpaces: [
      { id: "sub_waiting", name: "Waiting Area", defaultLength: 10, defaultBreadth: 8, remarks: "Seats for visitors/parents." },
    ],
  },
  {
    id: "sch_library",
    name: "Library",
    category: "school",
    defaultLength: 30,
    defaultBreadth: 24,
    remarks: "Reading room + stacks. Good natural light essential.",
    icon: "📖",
    subSpaces: [],
  },
  {
    id: "sch_lab",
    name: "Science / Computer Lab",
    category: "school",
    defaultLength: 30,
    defaultBreadth: 24,
    remarks: "Workbench layout. Provision for water, drainage, power.",
    icon: "🔬",
    subSpaces: [
      { id: "sub_prep_room", name: "Preparation Room", defaultLength: 12, defaultBreadth: 8, remarks: "Chemical/equipment storage annex." },
    ],
  },
  {
    id: "sch_toilet_block",
    name: "Toilet Block",
    category: "school",
    defaultLength: 20,
    defaultBreadth: 10,
    remarks: "Boys + Girls toilets per floor. Kerala norms: 1 WC per 40 students.",
    icon: "🚽",
    subSpaces: [],
  },
  {
    id: "sch_assembly",
    name: "Assembly Hall / Auditorium",
    category: "school",
    defaultLength: 60,
    defaultBreadth: 40,
    remarks: "Multi-purpose hall. Stage + seating.",
    icon: "🎭",
    subSpaces: [
      { id: "sub_stage", name: "Stage", defaultLength: 30, defaultBreadth: 16, remarks: "Raised performance stage." },
      { id: "sub_green_room", name: "Green Room", defaultLength: 12, defaultBreadth: 10, remarks: "Backstage/dressing room." },
    ],
  },
  {
    id: "sch_corridor",
    name: "Corridor",
    category: "school",
    defaultLength: 80,
    defaultBreadth: 8,
    remarks: "Main access corridor. Min. 2m (6.5ft) clear width for schools.",
    icon: "↔️",
    subSpaces: [],
  },
];

// ─── COMMERCIAL SPACES ───────────────────────────────────────
const commercialSpaces: SpaceTemplate[] = [
  {
    id: "com_retail_unit",
    name: "Retail Shop Unit",
    category: "commercial",
    defaultLength: 20,
    defaultBreadth: 15,
    remarks: "Standard shop unit. Ground floor preferred for retail.",
    icon: "🛍️",
    subSpaces: [
      { id: "sub_storage_back", name: "Back Storage", defaultLength: 8, defaultBreadth: 6, remarks: "Stock room at rear." },
      { id: "sub_display", name: "Display Area", defaultLength: 14, defaultBreadth: 10, remarks: "Front merchandising zone." },
    ],
  },
  {
    id: "com_office",
    name: "Office Space",
    category: "commercial",
    defaultLength: 30,
    defaultBreadth: 20,
    remarks: "Open-plan office. ~80–100 sqft/person for standard fit-out.",
    icon: "💼",
    subSpaces: [
      { id: "sub_cabin", name: "Manager's Cabin", defaultLength: 12, defaultBreadth: 10, remarks: "Enclosed manager cabin." },
      { id: "sub_conf_room", name: "Conference Room", defaultLength: 16, defaultBreadth: 12, remarks: "Meeting/conference room for 8–10." },
      { id: "sub_pantry_office", name: "Pantry", defaultLength: 10, defaultBreadth: 6, remarks: "Office kitchen/pantry." },
    ],
  },
  {
    id: "com_lobby",
    name: "Lobby / Reception",
    category: "commercial",
    defaultLength: 24,
    defaultBreadth: 18,
    remarks: "Building entry lobby. Reception counter + seating.",
    icon: "🏢",
    subSpaces: [],
  },
  {
    id: "com_restaurant",
    name: "Restaurant / Café",
    category: "commercial",
    defaultLength: 40,
    defaultBreadth: 30,
    remarks: "Dining space. ~15 sqft/cover as thumb rule.",
    icon: "🍴",
    subSpaces: [
      { id: "sub_commercial_kitchen", name: "Commercial Kitchen", defaultLength: 20, defaultBreadth: 14, remarks: "Kitchen with cooking, prep, cold storage zones." },
      { id: "sub_toilet_cust", name: "Customer Toilets", defaultLength: 14, defaultBreadth: 8, remarks: "Male + Female toilets for patrons." },
    ],
  },
  {
    id: "com_parking",
    name: "Parking Level",
    category: "commercial",
    defaultLength: 80,
    defaultBreadth: 50,
    remarks: "Basement/surface parking. ~300 sqft/car including drive aisle.",
    icon: "🅿️",
    subSpaces: [],
  },
];

// ─── HEALTHCARE SPACES ───────────────────────────────────────
const healthcareSpaces: SpaceTemplate[] = [
  {
    id: "hc_consultation",
    name: "Doctor's Consultation Room",
    category: "healthcare",
    defaultLength: 14,
    defaultBreadth: 12,
    remarks: "Private consultation. Examination table + desk.",
    icon: "🩺",
    subSpaces: [
      { id: "sub_exam_alcove", name: "Examination Alcove", defaultLength: 7, defaultBreadth: 5, remarks: "Screened area for patient examination." },
    ],
  },
  {
    id: "hc_waiting",
    name: "Waiting Area",
    category: "healthcare",
    defaultLength: 20,
    defaultBreadth: 14,
    remarks: "Patient waiting. ~4–5 sqft/seat.",
    icon: "🪑",
    subSpaces: [],
  },
  {
    id: "hc_ward",
    name: "General Ward",
    category: "healthcare",
    defaultLength: 30,
    defaultBreadth: 20,
    remarks: "6–8 bed ward. ~80 sqft/bed as minimum.",
    icon: "🏥",
    subSpaces: [],
  },
  {
    id: "hc_pharmacy",
    name: "Pharmacy",
    category: "healthcare",
    defaultLength: 16,
    defaultBreadth: 12,
    remarks: "Dispensing counter + drug storage.",
    icon: "💊",
    subSpaces: [],
  },
];

// ─── HOSPITALITY SPACES ──────────────────────────────────────
const hospitalitySpaces: SpaceTemplate[] = [
  {
    id: "hot_standard_room",
    name: "Standard Hotel Room",
    category: "hospitality",
    defaultLength: 16,
    defaultBreadth: 14,
    remarks: "Double-occupancy room. Wardrobe + desk + attached bath.",
    icon: "🛎️",
    subSpaces: [
      { id: "sub_hotel_bath", name: "Attached Bathroom", defaultLength: 8, defaultBreadth: 6, remarks: "Bath + WC + wash basin." },
      { id: "sub_hotel_wardrobe", name: "Wardrobe", defaultLength: 5, defaultBreadth: 2, remarks: "Built-in wardrobe unit." },
    ],
  },
  {
    id: "hot_suite",
    name: "Suite",
    category: "hospitality",
    defaultLength: 24,
    defaultBreadth: 18,
    remarks: "Premium room with separate living area.",
    icon: "✨",
    subSpaces: [
      { id: "sub_suite_living", name: "Sitting Area", defaultLength: 12, defaultBreadth: 10, remarks: "Lounge/sitting zone within suite." },
      { id: "sub_suite_bath", name: "Suite Bathroom", defaultLength: 10, defaultBreadth: 8, remarks: "Luxury bath with tub + shower." },
    ],
  },
  {
    id: "hot_lobby",
    name: "Hotel Lobby",
    category: "hospitality",
    defaultLength: 40,
    defaultBreadth: 30,
    remarks: "Reception + lounge. Grand scale typical.",
    icon: "🏨",
    subSpaces: [],
  },
  {
    id: "hot_banquet",
    name: "Banquet / Event Hall",
    category: "hospitality",
    defaultLength: 80,
    defaultBreadth: 50,
    remarks: "~10–12 sqft/person for banquet layout.",
    icon: "🎉",
    subSpaces: [],
  },
];

// ─── MASTER DATASET ──────────────────────────────────────────
export const SPACE_TEMPLATES: SpaceTemplate[] = [
  ...residenceSpaces,
  ...schoolSpaces,
  ...commercialSpaces,
  ...healthcareSpaces,
  ...hospitalitySpaces,
];

export const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  residence: "Residence",
  school: "School / Education",
  commercial: "Commercial",
  healthcare: "Healthcare",
  hospitality: "Hospitality",
};

export const CATEGORY_COLORS: Record<SpaceCategory, string> = {
  residence: "#D97706",
  school: "#2563EB",
  commercial: "#7C3AED",
  healthcare: "#059669",
  hospitality: "#DB2777",
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

export function getFloorLabel(floor: number): string {
  return FLOOR_LABELS[floor] ?? `Floor ${floor}`;
}

// ─── CALCULATION HELPERS ─────────────────────────────────────

export function calcSpaceArea(space: SpaceInstance): number {
  const main = space.length * space.breadth;
  const sub = space.subSpaces.reduce((acc, s) => acc + s.length * s.breadth, 0);
  return main + sub;
}

export function calcGrossArea(
  spaces: SpaceInstance[],
  settings: ProjectSettings
): {
  netArea: number;
  wallArea: number;
  circulationArea: number;
  grossArea: number;
  estimatedCost: number;
} {
  const netArea = spaces.reduce((acc, s) => acc + calcSpaceArea(s), 0);
  const wallArea = (netArea * settings.wallThicknessPercent) / 100;
  const circulationArea = (netArea * settings.circulationPercent) / 100;
  const grossArea = netArea + wallArea + circulationArea;
  const estimatedCost = grossArea * settings.costPerSqft;
  return { netArea, wallArea, circulationArea, grossArea, estimatedCost };
}

export function groupByFloor(spaces: SpaceInstance[]): Map<number, SpaceInstance[]> {
  const map = new Map<number, SpaceInstance[]>();
  for (const s of spaces) {
    if (!map.has(s.floor)) map.set(s.floor, []);
    map.get(s.floor)!.push(s);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}