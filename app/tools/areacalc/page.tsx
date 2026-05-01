

"use client";

import { useState, useCallback, useMemo } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────

const UNIT_SYSTEMS = {
  sqft: { label: "sq ft", areaLabel: "sqft", factor: 1, dimLabel: "ft", dimFactor: 1 },
  sqm: { label: "sq m", areaLabel: "sqm", factor: 0.0929, dimLabel: "m", dimFactor: 0.3048 },
};

const LOCATION_RATES = {
  kerala: {
    label: "Kerala",
    regions: {
      trivandrum: { label: "Thiruvananthapuram", rate: 2200 },
      kochi: { label: "Kochi / Ernakulam", rate: 2600 },
      kozhikode: { label: "Kozhikode", rate: 2100 },
      thrissur: { label: "Thrissur", rate: 2000 },
      kollam: { label: "Kollam", rate: 1900 },
      palakkad: { label: "Palakkad", rate: 1800 },
      kottayam: { label: "Kottayam", rate: 2000 },
      malappuram: { label: "Malappuram", rate: 1850 },
      kannur: { label: "Kannur", rate: 1950 },
      other_kerala: { label: "Other Kerala", rate: 1750 },
    },
  },
  tamilnadu: {
    label: "Tamil Nadu",
    regions: {
      chennai: { label: "Chennai", rate: 3200 },
      coimbatore: { label: "Coimbatore", rate: 2400 },
      madurai: { label: "Madurai", rate: 2100 },
      salem: { label: "Salem", rate: 1900 },
      tiruchirappalli: { label: "Tiruchirappalli", rate: 2000 },
      tirunelveli: { label: "Tirunelveli", rate: 1850 },
      vellore: { label: "Vellore", rate: 1950 },
      other_tn: { label: "Other Tamil Nadu", rate: 1800 },
    },
  },
  karnataka: {
    label: "Karnataka",
    regions: {
      bangalore: { label: "Bengaluru", rate: 3500 },
      mysore: { label: "Mysuru", rate: 2300 },
      hubli: { label: "Hubballi-Dharwad", rate: 2000 },
      mangalore: { label: "Mangaluru", rate: 2400 },
      other_ka: { label: "Other Karnataka", rate: 1900 },
    },
  },
  andhra: {
    label: "Andhra Pradesh",
    regions: {
      visakhapatnam: { label: "Visakhapatnam", rate: 2200 },
      vijayawada: { label: "Vijayawada", rate: 2000 },
      guntur: { label: "Guntur", rate: 1900 },
      other_ap: { label: "Other AP", rate: 1750 },
    },
  },
  telangana: {
    label: "Telangana",
    regions: {
      hyderabad: { label: "Hyderabad", rate: 3000 },
      warangal: { label: "Warangal", rate: 2100 },
      other_tg: { label: "Other Telangana", rate: 1900 },
    },
  },
  goa: {
    label: "Goa",
    regions: {
      panaji: { label: "Panaji / North Goa", rate: 3800 },
      south_goa: { label: "South Goa", rate: 3400 },
    },
  },
};

const CATEGORY_META = {
  residence: { label: "Residence", color: "#B45309", bg: "#FEF3C7", border: "#FCD34D", badge: "#92400E", badgeBg: "#FEF3C7" },
  school: { label: "Education", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", badge: "#1E3A8A", badgeBg: "#DBEAFE" },
  commercial: { label: "Commercial", color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", badge: "#4C1D95", badgeBg: "#EDE9FE" },
  healthcare: { label: "Healthcare", color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", badge: "#064E3B", badgeBg: "#D1FAE5" },
  hospitality: { label: "Hospitality", color: "#9D174D", bg: "#FDF2F8", border: "#FBCFE8", badge: "#831843", badgeBg: "#FCE7F3" },
};

const FLOOR_LABELS: Record<number, string> = { "-1": "Basement", 0: "Ground Floor", 1: "First Floor", 2: "Second Floor", 3: "Third Floor", 4: "Fourth Floor", 5: "Fifth Floor" };
const FLOORS = [-1, 0, 1, 2, 3, 4, 5];

const getFloorLabel = (f: number) => FLOOR_LABELS[f] ?? `Floor ${f}`;

// ─── TYPES ────────────────────────────────────────────────────

type UnitKey = keyof typeof UNIT_SYSTEMS;
type CategoryKey = keyof typeof CATEGORY_META;
type StateKey = keyof typeof LOCATION_RATES;

interface SubSpaceTemplate {
  id: string;
  name: string;
  L: number;
  B: number;
  remarks: string;
}

interface SpaceTemplate {
  id: string;
  name: string;
  category: CategoryKey;
  L: number;
  B: number;
  icon: string;
  remarks: string;
  subSpaces?: SubSpaceTemplate[];
}

interface SubSpaceInstance {
  instanceId: string;
  templateId: string;
  name: string;
  L: number;
  B: number;
  remarks: string;
}

interface SpaceInstance {
  instanceId: string;
  templateId: string;
  name: string;
  category: CategoryKey;
  L: number;
  B: number;
  floor: number;
  remarks: string;
  icon: string;
  subSpaces: SubSpaceInstance[];
  isCustom: boolean;
}

interface ProjectTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  spaces: { templateId: string; floor: number; L: number; B: number; subIds: string[] }[];
}

// ─── SPACE DATA ──────────────────────────────────────────────

const SPACE_TEMPLATES: SpaceTemplate[] = [
  // RESIDENCE
  { id: "res_master_bed", name: "Master Bedroom", category: "residence", L: 14, B: 12, icon: "🛏️", remarks: "Primary bedroom with attached bath", subSpaces: [
    { id: "sub_att_toilet", name: "Attached Toilet", L: 8, B: 5, remarks: "En-suite bathroom" },
    { id: "sub_wardrobe", name: "Wardrobe Alcove", L: 6, B: 2, remarks: "Built-in wardrobe" },
    { id: "sub_balcony", name: "Balcony", L: 10, B: 4, remarks: "Private balcony" },
  ]},
  { id: "res_bedroom", name: "Bedroom", category: "residence", L: 12, B: 10, icon: "🛏️", remarks: "Standard bedroom", subSpaces: [
    { id: "sub_common_wc", name: "Common Toilet", L: 7, B: 4, remarks: "Shared bathroom" },
    { id: "sub_study_nook", name: "Study Nook", L: 5, B: 4, remarks: "Reading/study alcove" },
  ]},
  { id: "res_living", name: "Living Room", category: "residence", L: 18, B: 14, icon: "🛋️", remarks: "Primary social space", subSpaces: [
    { id: "sub_foyer", name: "Foyer / Entry", L: 6, B: 5, remarks: "Entry zone" },
    { id: "sub_pooja", name: "Pooja Room", L: 5, B: 4, remarks: "Prayer alcove — Kerala homes" },
  ]},
  { id: "res_dining", name: "Dining Room", category: "residence", L: 14, B: 10, icon: "🍽️", remarks: "Dining for 6–8 persons", subSpaces: [] },
  { id: "res_kitchen", name: "Kitchen", category: "residence", L: 14, B: 10, icon: "🍳", remarks: "Modular kitchen", subSpaces: [
    { id: "sub_utility", name: "Utility / Wash", L: 8, B: 5, remarks: "Washing + drying area" },
    { id: "sub_store", name: "Store Room", L: 6, B: 5, remarks: "Dry storage" },
    { id: "sub_pantry", name: "Pantry", L: 5, B: 4, remarks: "Walk-in pantry" },
  ]},
  { id: "res_toilet", name: "Common Toilet", category: "residence", L: 7, B: 4, icon: "🚿", remarks: "Guest toilet on ground floor", subSpaces: [] },
  { id: "res_sit_out", name: "Sit-out / Verandah", category: "residence", L: 14, B: 6, icon: "🌿", remarks: "Semi-open Kerala-style verandah", subSpaces: [] },
  { id: "res_car_porch", name: "Car Porch", category: "residence", L: 18, B: 12, icon: "🚗", remarks: "Covered parking 1–2 vehicles", subSpaces: [] },
  { id: "res_staircase", name: "Staircase", category: "residence", L: 12, B: 5, icon: "🪜", remarks: "Stair + landing", subSpaces: [] },
  { id: "res_passage", name: "Corridor / Passage", category: "residence", L: 14, B: 4, icon: "↔️", remarks: "Internal corridor", subSpaces: [] },
  // SCHOOL
  { id: "sch_classroom", name: "Classroom", category: "school", L: 28, B: 24, icon: "📚", remarks: "40-student classroom", subSpaces: [
    { id: "sub_storage_cab", name: "Storage Cabinet", L: 4, B: 2, remarks: "Built-in storage" },
  ]},
  { id: "sch_staff_room", name: "Staff Room", category: "school", L: 20, B: 16, icon: "👩‍🏫", remarks: "Common room for teaching staff", subSpaces: [] },
  { id: "sch_principal", name: "Principal's Office", category: "school", L: 16, B: 14, icon: "🏫", remarks: "Admin office", subSpaces: [
    { id: "sub_waiting", name: "Waiting Area", L: 10, B: 8, remarks: "Visitor seating" },
  ]},
  { id: "sch_library", name: "Library", category: "school", L: 30, B: 24, icon: "📖", remarks: "Reading room + stacks", subSpaces: [] },
  { id: "sch_lab", name: "Science / Computer Lab", category: "school", L: 30, B: 24, icon: "🔬", remarks: "Lab with power/water provisions", subSpaces: [
    { id: "sub_prep_room", name: "Prep Room", L: 12, B: 8, remarks: "Chemical/equipment storage" },
  ]},
  { id: "sch_toilet_block", name: "Toilet Block", category: "school", L: 20, B: 10, icon: "🚽", remarks: "Boys + Girls per floor", subSpaces: [] },
  { id: "sch_assembly", name: "Assembly Hall", category: "school", L: 60, B: 40, icon: "🎭", remarks: "Multi-purpose hall with stage", subSpaces: [
    { id: "sub_stage", name: "Stage", L: 30, B: 16, remarks: "Raised performance stage" },
    { id: "sub_green_room", name: "Green Room", L: 12, B: 10, remarks: "Backstage dressing room" },
  ]},
  // COMMERCIAL
  { id: "com_retail", name: "Retail Shop Unit", category: "commercial", L: 20, B: 15, icon: "🛍️", remarks: "Standard shop unit", subSpaces: [
    { id: "sub_back_store", name: "Back Storage", L: 8, B: 6, remarks: "Stock room at rear" },
  ]},
  { id: "com_office", name: "Office Space", category: "commercial", L: 30, B: 20, icon: "💼", remarks: "Open-plan office", subSpaces: [
    { id: "sub_cabin", name: "Manager Cabin", L: 12, B: 10, remarks: "Enclosed cabin" },
    { id: "sub_conf", name: "Conference Room", L: 16, B: 12, remarks: "Meeting room 8–10" },
    { id: "sub_pantry_off", name: "Pantry", L: 10, B: 6, remarks: "Office kitchen" },
  ]},
  { id: "com_lobby", name: "Lobby / Reception", category: "commercial", L: 24, B: 18, icon: "🏢", remarks: "Building entry lobby", subSpaces: [] },
  { id: "com_restaurant", name: "Restaurant / Café", category: "commercial", L: 40, B: 30, icon: "🍴", remarks: "Dining ~15 sqft/cover", subSpaces: [
    { id: "sub_com_kitchen", name: "Commercial Kitchen", L: 20, B: 14, remarks: "Full kitchen zone" },
    { id: "sub_toilet_cust", name: "Customer Toilets", L: 14, B: 8, remarks: "Male + Female" },
  ]},
  { id: "com_parking", name: "Parking Level", category: "commercial", L: 80, B: 50, icon: "🅿️", remarks: "~300 sqft/car including aisle", subSpaces: [] },
  // HEALTHCARE
  { id: "hc_consult", name: "Doctor's Consultation", category: "healthcare", L: 14, B: 12, icon: "🩺", remarks: "Private consultation room", subSpaces: [
    { id: "sub_exam_alcove", name: "Examination Alcove", L: 7, B: 5, remarks: "Screened exam area" },
  ]},
  { id: "hc_waiting", name: "Waiting Area", category: "healthcare", L: 20, B: 14, icon: "🪑", remarks: "Patient waiting ~4 sqft/seat", subSpaces: [] },
  { id: "hc_ward", name: "General Ward", category: "healthcare", L: 30, B: 20, icon: "🏥", remarks: "6–8 bed ward", subSpaces: [] },
  { id: "hc_pharmacy", name: "Pharmacy", category: "healthcare", L: 16, B: 12, icon: "💊", remarks: "Dispensing + drug storage", subSpaces: [] },
  // HOSPITALITY
  { id: "hot_std_room", name: "Standard Hotel Room", category: "hospitality", L: 16, B: 14, icon: "🛎️", remarks: "Double-occupancy room", subSpaces: [
    { id: "sub_hotel_bath", name: "Attached Bathroom", L: 8, B: 6, remarks: "Bath + WC + basin" },
    { id: "sub_hotel_ward", name: "Wardrobe", L: 5, B: 2, remarks: "Built-in wardrobe" },
  ]},
  { id: "hot_suite", name: "Suite", category: "hospitality", L: 24, B: 18, icon: "✨", remarks: "Premium room with living area", subSpaces: [
    { id: "sub_suite_living", name: "Sitting Area", L: 12, B: 10, remarks: "Lounge zone" },
    { id: "sub_suite_bath", name: "Suite Bathroom", L: 10, B: 8, remarks: "Luxury bath with tub" },
  ]},
  { id: "hot_lobby", name: "Hotel Lobby", category: "hospitality", L: 40, B: 30, icon: "🏨", remarks: "Grand reception + lounge", subSpaces: [] },
  { id: "hot_banquet", name: "Banquet Hall", category: "hospitality", L: 80, B: 50, icon: "🎉", remarks: "~10 sqft/person banquet", subSpaces: [] },
];

// ─── PROJECT TEMPLATES ────────────────────────────────────────
const PROJECT_TEMPLATES: ProjectTemplate[] = [
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
const uid = () => `inst_${++_id}_${Math.random().toString(36).slice(2, 7)}`;

function toUnit(sqftVal: number, unit: UnitKey) {
  if (unit === "sqm") return sqftVal * 0.0929;
  return sqftVal;
}
function fromUnit(val: number, unit: UnitKey) {
  if (unit === "sqm") return val / 0.0929;
  return val;
}
function dimToUnit(ftVal: number, unit: UnitKey) {
  if (unit === "sqm") return ftVal * 0.3048;
  return ftVal;
}
function dimFromUnit(val: number, unit: UnitKey) {
  if (unit === "sqm") return val / 0.3048;
  return val;
}

function fmt(n: number, unit: UnitKey) {
  const display = toUnit(n, unit);
  return display.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}
function fmtDim(ft: number, unit: UnitKey) {
  return dimToUnit(ft, unit).toFixed(unit === "sqm" ? 2 : 1);
}
function fmtCost(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function calcSpaceArea(space: SpaceInstance) {
  const main = space.L * space.B;
  const sub = space.subSpaces.reduce((a, s) => a + s.L * s.B, 0);
  return main + sub;
}

function calcGrossArea(spaces: SpaceInstance[], wall: number, circ: number, costPerSqft: number) {
  const net = spaces.reduce((a, s) => a + calcSpaceArea(s), 0);
  const wallA = (net * wall) / 100;
  const circA = (net * circ) / 100;
  const gross = net + wallA + circA;
  return { net, wallA, circA, gross, cost: gross * costPerSqft };
}

function groupByFloor(spaces: SpaceInstance[]) {
  const map = new Map<number, SpaceInstance[]>();
  for (const s of spaces) {
    if (!map.has(s.floor)) map.set(s.floor, []);
    map.get(s.floor)!.push(s);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}

function makeSpaceFromTemplate(t: SpaceTemplate, floor: number, subIds: string[], overrideL?: number, overrideB?: number): SpaceInstance {
  const L = overrideL ?? t.L;
  const B = overrideB ?? t.B;
  const subSpaces = (subIds ?? []).map((sid) => {
    const subT = t.subSpaces?.find((s) => s.id === sid);
    if (!subT) return null;
    return { instanceId: uid(), templateId: subT.id, name: subT.name, L: subT.L, B: subT.B, remarks: subT.remarks };
  }).filter((x): x is SubSpaceInstance => x !== null);
  return {
    instanceId: uid(),
    templateId: t.id,
    name: t.name,
    category: t.category,
    L, B,
    floor: floor ?? 0,
    remarks: t.remarks,
    icon: t.icon,
    subSpaces,
    isCustom: false,
  };
}

// ─── COMPONENTS ───────────────────────────────────────────────

function DimAreaInput({ space, onUpdate, unit }: { space: SpaceInstance; onUpdate: (s: SpaceInstance) => void; unit: UnitKey }) {
  const [editMode, setEditMode] = useState<"dims" | "area">("dims");
  const uLabel = UNIT_SYSTEMS[unit].dimLabel;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;

  const displayL = parseFloat(fmtDim(space.L, unit));
  const displayB = parseFloat(fmtDim(space.B, unit));
  const displayArea = parseFloat(fmt(space.L * space.B, unit));

  function handleL(val: string) {
    const ft = dimFromUnit(parseFloat(val) || 1, unit);
    onUpdate({ ...space, L: ft });
  }
  function handleB(val: string) {
    const ft = dimFromUnit(parseFloat(val) || 1, unit);
    onUpdate({ ...space, B: ft });
  }
  function handleArea(val: string) {
    const targetSqft = fromUnit(parseFloat(val) || 1, unit);
    const curArea = space.L * space.B;
    if (curArea === 0) return;
    const ratio = Math.sqrt(targetSqft / curArea);
    const newL = Math.round((space.L * ratio) * 2) / 2;
    const newB = Math.round((space.B * ratio) * 2) / 2;
    onUpdate({ ...space, L: newL, B: newB });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: 2 }}>
        <button onClick={() => setEditMode("dims")} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: editMode === "dims" ? "#fff" : "transparent", cursor: "pointer", fontWeight: editMode === "dims" ? 600 : 400, color: editMode === "dims" ? "#1f2937" : "#6b7280" }}>L × B</button>
        <button onClick={() => setEditMode("area")} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none", background: editMode === "area" ? "#fff" : "transparent", cursor: "pointer", fontWeight: editMode === "area" ? 600 : 400, color: editMode === "area" ? "#1f2937" : "#6b7280" }}>Area</button>
      </div>
      {editMode === "dims" ? (
        <>
          <label style={{ fontSize: 11, color: "#9ca3af" }}>L ({uLabel})</label>
          <input type="number" min={0.5} step={unit === "sqm" ? 0.1 : 0.5} value={displayL} onChange={(e) => handleL(e.target.value)} style={{ width: 70, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
          <label style={{ fontSize: 11, color: "#9ca3af" }}>B ({uLabel})</label>
          <input type="number" min={0.5} step={unit === "sqm" ? 0.1 : 0.5} value={displayB} onChange={(e) => handleB(e.target.value)} style={{ width: 70, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
        </>
      ) : (
        <>
          <label style={{ fontSize: 11, color: "#9ca3af" }}>Area ({aLabel})</label>
          <input type="number" min={1} step={1} value={displayArea} onChange={(e) => handleArea(e.target.value)} style={{ width: 90, fontSize: 13, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
          <span style={{ fontSize: 10, color: "#9ca3af" }}>ratio kept</span>
        </>
      )}
    </div>
  );
}

function SubSpaceRow({ sub, onUpdate, onRemove, unit }: { sub: SubSpaceInstance; onUpdate: (s: SubSpaceInstance) => void; onRemove: () => void; unit: UnitKey }) {
  const uLabel = UNIT_SYSTEMS[unit].dimLabel;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const dL = parseFloat(fmtDim(sub.L, unit));
  const dB = parseFloat(fmtDim(sub.B, unit));
  const area = fmt(sub.L * sub.B, unit);

  return (
    <div style={{ marginLeft: 16, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
      <span style={{ fontSize: 13, color: "#6b7280", minWidth: 12 }}>↳</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "#374151", minWidth: 110 }}>{sub.name}</span>
      <input type="number" min={0.5} step={unit === "sqm" ? 0.1 : 0.5} value={dL} onChange={(e) => { const ft = dimFromUnit(parseFloat(e.target.value)||1,unit); onUpdate({...sub,L:ft}); }} style={{ width: 65, fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb" }} placeholder={`L ${uLabel}`} />
      <input type="number" min={0.5} step={unit === "sqm" ? 0.1 : 0.5} value={dB} onChange={(e) => { const ft = dimFromUnit(parseFloat(e.target.value)||1,unit); onUpdate({...sub,B:ft}); }} style={{ width: 65, fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb" }} placeholder={`B ${uLabel}`} />
      <span style={{ fontSize: 12, fontFamily: "monospace", color: "#374151", background: "#fff", border: "1px solid #e5e7eb", padding: "3px 8px", borderRadius: 6 }}>{area} {aLabel}</span>
      <input type="text" value={sub.remarks} onChange={(e) => onUpdate({...sub, remarks: e.target.value})} placeholder="Notes…" style={{ flex: 1, minWidth: 80, fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid #e5e7eb", color: "#6b7280" }} />
      <button onClick={onRemove} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}>✕</button>
    </div>
  );
}

function SpaceCard({ space, onUpdate, onRemove, unit }: { space: SpaceInstance; onUpdate: (s: SpaceInstance) => void; onRemove: () => void; unit: UnitKey }) {
  const [expanded, setExpanded] = useState(true);
  const [addingCustomSub, setAddingCustomSub] = useState(false);
  const [customSubName, setCustomSubName] = useState("");
  const [addSubOpen, setAddSubOpen] = useState(false);
  const meta = CATEGORY_META[space.category];
  const template = SPACE_TEMPLATES.find((t) => t.id === space.templateId);
  const mainArea = fmt(space.L * space.B, unit);
  const totalArea = fmt(calcSpaceArea(space), unit);
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const hasSubs = space.subSpaces.length > 0;
  const availableSubs = template?.subSpaces ?? [];

  function addSubFromTemplate(subId: string) {
    const subT = availableSubs.find((s) => s.id === subId);
    if (!subT) return;
    onUpdate({ ...space, subSpaces: [...space.subSpaces, { instanceId: uid(), templateId: subT.id, name: subT.name, L: subT.L, B: subT.B, remarks: subT.remarks }] });
    setAddSubOpen(false);
  }
  function addCustomSub() {
    if (!customSubName.trim()) return;
    onUpdate({ ...space, subSpaces: [...space.subSpaces, { instanceId: uid(), templateId: "custom", name: customSubName.trim(), L: 8, B: 6, remarks: "" }] });
    setCustomSubName("");
    setAddingCustomSub(false);
    setAddSubOpen(false);
  }
  function updateSub(id: string, updated: SubSpaceInstance) {
    onUpdate({ ...space, subSpaces: space.subSpaces.map((s) => s.instanceId === id ? updated : s) });
  }
  function removeSub(id: string) {
    onUpdate({ ...space, subSpaces: space.subSpaces.filter((s) => s.instanceId !== id) });
  }

  return (
    <div style={{ borderRadius: 12, border: `2px solid ${meta.border}`, background: meta.bg, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", width: 18, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</button>
        <span style={{ fontSize: 18 }}>{space.icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#111827", minWidth: 100 }}>{space.name}</span>
        {space.isCustom && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#e5e7eb", color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Custom</span>}
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: meta.badgeBg, color: meta.badge, fontWeight: 700, textTransform: "uppercase", border: `1px solid ${meta.border}` }}>{meta.label}</span>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <select value={space.floor} onChange={(e) => onUpdate({ ...space, floor: parseInt(e.target.value) })} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff" }}>
            {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
          </select>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Main:</span>
            <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#111827", background: "#fff", padding: "3px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}>{mainArea} {aLabel}</span>
          </div>
          {hasSubs && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Total:</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: meta.color, background: "#fff", padding: "3px 8px", borderRadius: 6, border: `1px solid ${meta.border}` }}>{totalArea} {aLabel}</span>
            </div>
          )}
          <button onClick={onRemove} style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "2px 6px" }}>🗑</button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 12px 12px" }}>
          <DimAreaInput space={space} onUpdate={onUpdate} unit={unit} />
          <input type="text" value={space.remarks} onChange={(e) => onUpdate({ ...space, remarks: e.target.value })} placeholder="Remarks / notes…" style={{ width: "100%", marginTop: 8, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", color: "#6b7280", boxSizing: "border-box" }} />
          {space.subSpaces.map((sub) => (
            <SubSpaceRow key={sub.instanceId} sub={sub} unit={unit} onUpdate={(u) => updateSub(sub.instanceId, u)} onRemove={() => removeSub(sub.instanceId)} />
          ))}
          <div style={{ marginTop: 8, marginLeft: 16 }}>
            {addSubOpen ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {availableSubs.filter((s) => !space.subSpaces.find((ss) => ss.templateId === s.id)).map((s) => (
                  <button key={s.id} onClick={() => addSubFromTemplate(s.id)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", color: "#374151" }}>+ {s.name}</button>
                ))}
                {addingCustomSub ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input autoFocus value={customSubName} onChange={(e) => setCustomSubName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomSub()} placeholder="Sub-space name" style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid #d1d5db", width: 140 }} />
                    <button onClick={addCustomSub} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer" }}>Add</button>
                    <button onClick={() => setAddingCustomSub(false)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingCustomSub(true)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px dashed #9ca3af", background: "#f9fafb", cursor: "pointer", color: "#6b7280" }}>+ Custom sub-space</button>
                )}
                <button onClick={() => { setAddSubOpen(false); setAddingCustomSub(false); }} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddSubOpen(true)} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>⊕</span> Add sub-space
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomSpaceModal({ onAdd, onClose }: { onAdd: (s: SpaceInstance) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("residence");
  const [L, setL] = useState(12);
  const [B, setB] = useState(10);
  const [icon, setIcon] = useState("📐");
  const [floor, setFloor] = useState(0);
  const icons = ["📐","🏗️","🏠","🛋️","🛏️","🍳","🚿","🌿","🚗","💼","📚","🔬","🏥","🛍️","🎉","✨","🏨","🏢","🪑","🩺","💊","🎭","📖","🅿️","🍴","🔑","🪜","↔️"];

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({ instanceId: uid(), templateId: "custom", name: name.trim(), category, L, B, floor, icon, remarks: "", subSpaces: [], isCustom: true });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Add Custom Space</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Space Name *</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Server Room, Prayer Hall…" style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 12, boxSizing: "border-box" }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as CategoryKey)} style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 12 }}>
          {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Length (ft)</label>
            <input type="number" value={L} min={1} step={0.5} onChange={(e) => setL(parseFloat(e.target.value)||1)} style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Breadth (ft)</label>
            <input type="number" value={B} min={1} step={0.5} onChange={(e) => setB(parseFloat(e.target.value)||1)} style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", boxSizing: "border-box" }} />
          </div>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Floor</label>
        <select value={floor} onChange={(e) => setFloor(parseInt(e.target.value))} style={{ width: "100%", fontSize: 14, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 12 }}>
          {FLOORS.map((f) => <option key={f} value={f}>{getFloorLabel(f)}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Icon</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {icons.map((ic) => <button key={ic} onClick={() => setIcon(ic)} style={{ fontSize: 20, background: icon === ic ? "#fef3c7" : "#f9fafb", border: icon === ic ? "2px solid #f59e0b" : "1px solid #e5e7eb", borderRadius: 8, width: 40, height: 40, cursor: "pointer" }}>{ic}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleAdd} disabled={!name.trim()} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: name.trim() ? "#1d4ed8" : "#e5e7eb", color: name.trim() ? "#fff" : "#9ca3af", fontWeight: 600, cursor: name.trim() ? "pointer" : "default", fontSize: 14 }}>Add Space</button>
          <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 14 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── PALETTE PANEL ────────────────────────────────────────────
function PalettePanel({
  filteredTemplates,
  activeCategory,
  setActiveCategory,
  searchQ,
  setSearchQ,
  addSpace,
  setShowCustomModal,
}: {
  filteredTemplates: SpaceTemplate[];
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  searchQ: string;
  setSearchQ: (q: string) => void;
  addSpace: (id: string) => void;
  setShowCustomModal: (v: boolean) => void;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Space Palette</p>
      <input type="text" placeholder="🔍  Search…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", marginBottom: 8, boxSizing: "border-box" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        <button onClick={() => setActiveCategory("all")} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid", borderColor: activeCategory === "all" ? "#374151" : "#e5e7eb", background: activeCategory === "all" ? "#374151" : "#fff", color: activeCategory === "all" ? "#fff" : "#6b7280", cursor: "pointer", textTransform: "uppercase" }}>All</button>
        {Object.entries(CATEGORY_META).map(([k, v]) => (
          <button key={k} onClick={() => setActiveCategory(k)} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid", borderColor: activeCategory === k ? v.color : "#e5e7eb", background: activeCategory === k ? v.color : "#fff", color: activeCategory === k ? "#fff" : "#6b7280", cursor: "pointer", textTransform: "uppercase" }}>{v.label.split(" ")[0]}</button>
        ))}
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {filteredTemplates.map((t) => (
          <button key={t.id} onClick={() => addSpace(t.id)} title={t.remarks} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #f3f4f6", background: "#f9fafb", marginBottom: 4, cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</p>
              <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>{t.L}&apos; × {t.B}&apos; = {t.L * t.B} sqft</p>
            </div>
            <span style={{ fontSize: 16, color: "#d1d5db" }}>+</span>
          </button>
        ))}
        {filteredTemplates.length === 0 && <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: 16 }}>No spaces found</p>}
      </div>
      <button onClick={() => setShowCustomModal(true)} style={{ width: "100%", marginTop: 8, padding: "8px", borderRadius: 8, border: "1px dashed #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 12, color: "#6b7280", fontWeight: 600 }}>✏️ Add Custom Space</button>
    </div>
  );
}

// ─── SUMMARY CARD ─────────────────────────────────────────────
function SummaryCard({
  totals,
  unit,
  wall,
  circ,
  costPerSqft,
  spaces,
  floorGroups,
  stateKey,
  regionKey,
}: {
  totals: { net: number; wallA: number; circA: number; gross: number; cost: number };
  unit: UnitKey;
  wall: number;
  circ: number;
  costPerSqft: number;
  spaces: SpaceInstance[];
  floorGroups: Map<number, SpaceInstance[]>;
  stateKey: StateKey;
  regionKey: string;
}) {
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;
  const stateLabel = LOCATION_RATES[stateKey]?.label;
  const regionLabel = Object.entries(LOCATION_RATES[stateKey]?.regions ?? {}).find(([k]) => k === regionKey)?.[1]?.label;

  return (
    <div style={{ borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", padding: 20, marginTop: 8 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 16px" }}>Area Summary</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Net Carpet Area", val: fmt(totals.net, unit), color: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
          { label: `Wall (${wall}%)`, val: `+ ${fmt(totals.wallA, unit)}`, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
          { label: `Circulation (${circ}%)`, val: `+ ${fmt(totals.circA, unit)}`, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
          { label: "Gross Built-up", val: fmt(totals.gross, unit), color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
        ].map((item) => (
          <div key={item.label} style={{ borderRadius: 10, border: `1px solid ${item.border}`, background: item.bg, padding: "12px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 4px" }}>{item.label}</p>
            <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 20, color: item.color, margin: 0 }}>{item.val}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{aLabel}</p>
          </div>
        ))}
      </div>

      {/* Cost */}
      <div style={{ borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#059669", textTransform: "uppercase", margin: "0 0 4px" }}>Estimated Construction Cost</p>
          <p style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 28, color: "#047857", margin: 0 }}>{fmtCost(totals.cost)}</p>
        </div>
        <div style={{ fontSize: 12, color: "#047857" }}>
          <p style={{ margin: "0 0 2px" }}>@ ₹{costPerSqft.toLocaleString("en-IN")}/sqft × {fmt(totals.gross, "sqft")} sqft</p>
          <p style={{ margin: 0, color: "#6ee7b7" }}>{stateLabel}{regionLabel ? ` · ${regionLabel}` : ""} · Finishing extra</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Array.from(floorGroups.entries()).map(([floor, fs]) => {
            const fa = fs.reduce((a, s) => a + calcSpaceArea(s), 0);
            return (
              <div key={floor} style={{ textAlign: "center", borderRadius: 8, border: "1px solid #a7f3d0", background: "#fff", padding: "6px 10px" }}>
                <p style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, margin: 0 }}>{getFloorLabel(floor)}</p>
                <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#374151", margin: 0 }}>{fmt(fa, unit)} {aLabel}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: "0 0 8px" }}>Breakdown by Type</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => {
            const catSpaces = spaces.filter((s) => s.category === cat);
            if (!catSpaces.length) return null;
            const catArea = catSpaces.reduce((a, s) => a + calcSpaceArea(s), 0);
            const pct = totals.net > 0 ? Math.round((catArea / totals.net) * 100) : 0;
            return (
              <div key={cat} style={{ borderRadius: 10, border: `1px solid ${meta.border}`, background: meta.bg, padding: "8px 12px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: meta.badge, margin: "0 0 2px" }}>{meta.label}</p>
                <p style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#374151", margin: 0 }}>{fmt(catArea, unit)} {aLabel} <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>({pct}%)</span></p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [spaces, setSpaces] = useState<SpaceInstance[]>([]);
  const [unit, setUnit] = useState<UnitKey>("sqft");
  const [wall, setWall] = useState(10);
  const [circ, setCirc] = useState(15);
  const [stateKey, setStateKey] = useState<StateKey>("kerala");
  const [regionKey, setRegionKey] = useState("kochi");
  const [customRate, setCustomRate] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [activeFloor, setActiveFloor] = useState<number | "all">("all");
  const [projectName, setProjectName] = useState("Untitled Project");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costPerSqft = customRate ?? (LOCATION_RATES[stateKey]?.regions as any)[regionKey]?.rate ?? 2000;
  const aLabel = UNIT_SYSTEMS[unit].areaLabel;

  const stateObj = LOCATION_RATES[stateKey];
  const regionOptions = stateObj ? Object.entries(stateObj.regions) : [];

  const filteredTemplates = useMemo(() => SPACE_TEMPLATES.filter((t) => {
    const catOk = activeCategory === "all" || t.category === activeCategory;
    const qOk = !searchQ.trim() || t.name.toLowerCase().includes(searchQ.toLowerCase());
    return catOk && qOk;
  }), [activeCategory, searchQ]);

  const addSpace = useCallback((templateId: string) => {
    const t = SPACE_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    const floor = typeof activeFloor === "number" ? activeFloor : 0;
    setSpaces((prev) => [...prev, makeSpaceFromTemplate(t, floor, [])]);
  }, [activeFloor]);

  const addCustomSpace = useCallback((space: SpaceInstance) => {
    setSpaces((prev) => [...prev, space]);
  }, []);

  const updateSpace = useCallback((id: string, updated: SpaceInstance) => {
    setSpaces((prev) => prev.map((s) => s.instanceId === id ? updated : s));
  }, []);

  const removeSpace = useCallback((id: string) => {
    setSpaces((prev) => prev.filter((s) => s.instanceId !== id));
  }, []);

  function loadTemplate(tpl: ProjectTemplate) {
    const newSpaces = tpl.spaces.map(({ templateId, floor, L, B, subIds }) => {
      const t = SPACE_TEMPLATES.find((x) => x.id === templateId);
      if (!t) return null;
      return makeSpaceFromTemplate(t, floor, subIds, L, B);
    }).filter((x): x is SpaceInstance => x !== null);
    setSpaces(newSpaces);
    setProjectName(tpl.label);
    setShowTemplatePanel(false);
  }

  const totals = useMemo(() => calcGrossArea(spaces, wall, circ, costPerSqft), [spaces, wall, circ, costPerSqft]);
  const floorGroups = useMemo(() => groupByFloor(spaces), [spaces]);
  const usedFloors = useMemo(() => Array.from(floorGroups.keys()).sort((a, b) => a - b), [floorGroups]);
  const visibleSpaces = useMemo(() => activeFloor === "all" ? spaces : spaces.filter((s) => s.floor === activeFloor), [spaces, activeFloor]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📐</span>
          <div>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ fontSize: 16, fontWeight: 700, color: "#111827", background: "transparent", border: "none", borderBottom: "2px solid transparent", outline: "none", maxWidth: 200 }} onFocus={(e) => (e.target.style.borderBottomColor = "#f59e0b")} onBlur={(e) => (e.target.style.borderBottomColor = "transparent")} />
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Area Calculator</p>
          </div>

          {/* Quick stats */}
          <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: 0 }}>Gross</p>
              <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#d97706", margin: 0, fontSize: 14 }}>{fmt(totals.gross, unit)} {aLabel}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", margin: 0 }}>Est. Cost</p>
              <p style={{ fontFamily: "monospace", fontWeight: 700, color: "#059669", margin: 0, fontSize: 14 }}>{fmtCost(totals.cost)}</p>
            </div>

            {/* Unit toggle */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 2 }}>
              {Object.entries(UNIT_SYSTEMS).map(([k, v]) => (
                <button key={k} onClick={() => setUnit(k as UnitKey)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: unit === k ? "#fff" : "transparent", fontWeight: unit === k ? 700 : 400, cursor: "pointer", color: unit === k ? "#111827" : "#6b7280", boxShadow: unit === k ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{v.areaLabel}</button>
              ))}
            </div>

            <button onClick={() => setSettingsOpen(!settingsOpen)} style={{ fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: settingsOpen ? "#fef3c7" : "#fff", cursor: "pointer", color: "#374151" }}>⚙️ Settings</button>
          </div>
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <div style={{ background: "#fffbeb", borderTop: "1px solid #fde68a", padding: "12px 16px" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
              {/* State/Region */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>STATE</label>
                <select value={stateKey} onChange={(e) => { const sk = e.target.value as StateKey; setStateKey(sk); const first = Object.keys(LOCATION_RATES[sk].regions)[0]; setRegionKey(first); setCustomRate(null); }} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", minWidth: 140 }}>
                  {Object.entries(LOCATION_RATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>CITY / REGION</label>
                <select value={regionKey} onChange={(e) => { setRegionKey(e.target.value); setCustomRate(null); }} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", minWidth: 180 }}>
                  {regionOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>RATE (₹/sqft) <span style={{ fontWeight: 400, color: "#9ca3af" }}>— override</span></label>
                <input type="number" min={500} step={100} value={customRate ?? costPerSqft} onChange={(e) => setCustomRate(parseInt(e.target.value)||null)} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", width: 100 }} />
                {customRate && <button onClick={() => setCustomRate(null)} style={{ marginLeft: 6, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>reset</button>}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>WALL THICKNESS: {wall}%</label>
                <input type="range" min={5} max={20} step={1} value={wall} onChange={(e) => setWall(parseInt(e.target.value))} style={{ width: 120, accentColor: "#f59e0b" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>CIRCULATION: {circ}%</label>
                <input type="range" min={5} max={25} step={1} value={circ} onChange={(e) => setCirc(parseInt(e.target.value))} style={{ width: 120, accentColor: "#f59e0b" }} />
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", borderLeft: "2px solid #fcd34d", paddingLeft: 12 }}>
                <strong style={{ color: "#92400e" }}>₹{costPerSqft.toLocaleString("en-IN")}/sqft</strong><br />
                <span style={{ fontSize: 11 }}>{stateObj?.label} · {regionOptions.find(([k]) => k === regionKey)?.[1]?.label}</span>
              </div>
            </div>
          </div>
        )}
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* MAIN */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* FABs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button onClick={() => setPaletteOpen(true)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>📦 Add Space</button>
            <button onClick={() => setShowTemplatePanel(!showTemplatePanel)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: showTemplatePanel ? "#fef3c7" : "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>🏗️ Templates</button>
            <button onClick={() => setShowCustomModal(true)} style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 600, color: "#374151" }}>✏️ Custom Space</button>
          </div>

          {/* Templates strip */}
          {showTemplatePanel && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
              <p style={{ width: "100%", margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Project Templates — click to load</p>
              {PROJECT_TEMPLATES.map((tpl) => (
                <button key={tpl.id} onClick={() => loadTemplate(tpl)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "12px 16px", borderRadius: 12, border: "2px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", minWidth: 180, textAlign: "left" }}>
                  <span style={{ fontSize: 28 }}>{tpl.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{tpl.label}</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{tpl.description}</span>
                </button>
              ))}
            </div>
          )}

          {/* Floor tabs */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
            <button onClick={() => setActiveFloor("all")} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: activeFloor !== "all" ? "1px solid #e5e7eb" : "none", background: activeFloor === "all" ? "#374151" : "#fff", color: activeFloor === "all" ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>All</button>
            {usedFloors.map((f) => (
              <button key={f} onClick={() => setActiveFloor(f)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: activeFloor !== f ? "1px solid #e5e7eb" : "none", background: activeFloor === f ? "#f59e0b" : "#fff", color: activeFloor === f ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                {getFloorLabel(f)} <span style={{ opacity: 0.7 }}>({floorGroups.get(f)?.length ?? 0})</span>
              </button>
            ))}
            {FLOORS.filter((f) => !usedFloors.includes(f)).map((f) => (
              <button key={f} onClick={() => setActiveFloor(f)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "1px dashed #d1d5db", background: "transparent", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>+ {getFloorLabel(f)}</button>
            ))}
          </div>

          {/* Spaces */}
          {visibleSpaces.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 16, border: "2px dashed #d1d5db", background: "#fff", padding: "60px 24px", textAlign: "center" }}>
              <span style={{ fontSize: 48, marginBottom: 12 }}>🏗️</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#9ca3af", margin: "0 0 6px" }}>No spaces yet</p>
              <p style={{ fontSize: 14, color: "#d1d5db", margin: 0 }}>Use &ldquo;Add Space&rdquo;, &ldquo;Templates&rdquo; or &ldquo;Custom Space&rdquo; above</p>
            </div>
          ) : activeFloor === "all" ? (
            Array.from(floorGroups.entries()).map(([floor, fs]) => (
              <div key={floor} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{getFloorLabel(floor)}</span>
                  <div style={{ flex: 1, borderTop: "1px solid #e5e7eb" }} />
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#9ca3af" }}>{fmt(fs.reduce((a, s) => a + calcSpaceArea(s), 0), unit)} {aLabel}</span>
                </div>
                {fs.map((s) => <SpaceCard key={s.instanceId} space={s} unit={unit} onUpdate={(u) => updateSpace(s.instanceId, u)} onRemove={() => removeSpace(s.instanceId)} />)}
              </div>
            ))
          ) : (
            visibleSpaces.map((s) => <SpaceCard key={s.instanceId} space={s} unit={unit} onUpdate={(u) => updateSpace(s.instanceId, u)} onRemove={() => removeSpace(s.instanceId)} />)
          )}

          {/* SUMMARY */}
          {spaces.length > 0 && <SummaryCard totals={totals} unit={unit} wall={wall} circ={circ} costPerSqft={costPerSqft} spaces={spaces} floorGroups={floorGroups} stateKey={stateKey} regionKey={regionKey} />}
        </main>
      </div>

      {/* Mobile palette drawer */}
      {paletteOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} onClick={() => setPaletteOpen(false)} />
          <div style={{ width: 300, background: "#fff", height: "100%", overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Space Palette</span>
              <button onClick={() => setPaletteOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
            </div>
            <PalettePanel
              filteredTemplates={filteredTemplates}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              searchQ={searchQ}
              setSearchQ={setSearchQ}
              addSpace={(id) => { addSpace(id); setPaletteOpen(false); }}
              setShowCustomModal={() => { setShowCustomModal(true); setPaletteOpen(false); }}
            />
          </div>
        </div>
      )}

      {showCustomModal && <CustomSpaceModal onAdd={addCustomSpace} onClose={() => setShowCustomModal(false)} />}
    </div>
  );
}