// SREEKESH PROJECT — corrected, forward-planned schedule
//
// Reference date for the split between "actual" and "planned" is 2 Oct 2026.
// Everything whose scheduleFinish < today is treated as ACTUAL (completion 100
// unless specified otherwise). Everything whose scheduleStart >= today is
// PLANNED — you can move it freely without it looking "in the past".
//
// Field names follow IFC4x3 so a later import/export is a 1:1 mapping:
//   WorkSchedule -> IfcWorkSchedule
//   Task         -> IfcTask (+ IfcTaskTime: ScheduleStart / ScheduleFinish / ActualStart / ActualFinish / Completion)
//   parentId     -> IfcRelNests (task decomposition)
//   Sequence     -> IfcRelSequence (RelatingProcess / RelatedProcess / SequenceType / TimeLag)
//   linkedElements -> IfcRelAssignsToProcess (IFC GlobalIds of walls, slabs, ...)
//
// Planned vs actual:
//   scheduleStart/Finish   = current forecast (moves as the job progresses)
//   baselineStart/Finish   = frozen plan, set once via "Set baseline"
//   actualStart/Finish     = what really happened
// The three optional fields come back as null from the server when unset.

export type SequenceType =
  | "FINISH_START"
  | "START_START"
  | "FINISH_FINISH"
  | "START_FINISH";

export const SEQUENCE_TYPES: { value: SequenceType; short: string; label: string }[] = [
  { value: "FINISH_START", short: "FS", label: "FS · finish → start" },
  { value: "START_START", short: "SS", label: "SS · start → start" },
  { value: "FINISH_FINISH", short: "FF", label: "FF · finish → finish" },
  { value: "START_FINISH", short: "SF", label: "SF · start → finish" },
];

export interface Task {
  id: string;
  name: string;
  parentId: string | null; // IfcRelNests
  scheduleStart: string; // YYYY-MM-DD
  scheduleFinish: string; // YYYY-MM-DD (inclusive)
  baselineStart?: string | null; // YYYY-MM-DD, frozen plan
  baselineFinish?: string | null; // YYYY-MM-DD, frozen plan
  actualStart?: string | null; // YYYY-MM-DD, IfcTaskTime.ActualStart
  actualFinish?: string | null; // YYYY-MM-DD, IfcTaskTime.ActualFinish
  completion: number; // 0-100
  isMilestone: boolean;
  linkedElements?: string[]; // IFC GlobalIds (future)
  remarks?: string;
  workCode?: string;
}

export interface Sequence {
  id: string;
  relatingTask: string;
  relatedTask: string;
  sequenceType: SequenceType;
  lagDays: number;
}

export interface WorkSchedule {
  name: string;
  predefinedType: "BASELINE" | "PLANNED" | "ACTUAL";
  tasks: Task[];
  sequences: Sequence[];
}

// ---------- constants ----------
const TODAY = "2026-10-02";        // reference "now"
const TODAY_DAY = Math.round(Date.UTC(2026, 9, 2) / 86400000);
const DAY = 86400000;

const toDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};

/** A task finishing before today = 100% done. */
const completionFor = (finishISO: string, explicit?: number) => {
  if (explicit !== undefined) return explicit;
  return toDay(finishISO) < TODAY_DAY ? 100 : 0;
};

// ---------- task factory ----------
const T = (
  id: string,
  name: string,
  parentId: string | null,
  start: string,
  finish: string,
  opts: { code?: string; remarks?: string; completion?: number; milestone?: boolean } = {}
): Task => ({
  id,
  name,
  parentId,
  scheduleStart: start,
  scheduleFinish: finish,
  completion: completionFor(finish, opts.completion),
  isMilestone: !!opts.milestone,
  remarks: opts.remarks,
  workCode: opts.code,
});

const G = (id: string, name: string): Task => ({
  id,
  name,
  parentId: null,
  scheduleStart: TODAY,
  scheduleFinish: TODAY,
  completion: 0,
  isMilestone: false,
});

// ---------- phases ----------
const groups: Task[] = [
  G("g-pre",    "1. Pre-construction"),
  G("g-found",  "2. Foundation"),
  G("g-struct", "3. Superstructure"),
  G("g-roof",   "4. Roof & FF structure"),
  G("g-mep",    "5. MEP & services"),
  G("g-fin",    "6. Finishing"),
  G("g-fitout", "7. Fit-out & landscaping"),
  G("g-close",  "8. Closeout"),
];

// ---------- activities ----------
const activities: Task[] = [
  // ========== 1. PRE-CONSTRUCTION ==========
  T("a-site", "Site clearance & boundary fencing", "g-pre",
    "2025-05-19", "2025-05-21",
    { code: "1", remarks: "Kaavu boundary fence fabrication" }),
  T("a-set", "Setting out", "g-pre",
    "2025-06-02", "2025-06-02",
    { code: "2" }),

  // ========== 2. FOUNDATION ==========
  T("a-exc", "Excavation for footings", "g-found",
    "2025-06-09", "2025-07-03",
    { code: "3" }),
  T("a-pcc", "PCC bed & curing", "g-found",
    "2025-07-07", "2025-07-15",
    { code: "4-5" }),
  T("a-rrm", "RRM foundation below G.L.", "g-found",
    "2025-08-11", "2025-08-21",
    { code: "6" }),

  // ========== 3. SUPERSTRUCTURE ==========
  T("a-plinth", "Plinth beam (steel, formwork, concrete & curing)", "g-struct",
    "2025-09-24", "2025-10-08",
    { code: "7-9" }),
  T("a-fill", "Earth filling, levelling & PCC floor bed", "g-struct",
    "2025-10-15", "2025-11-06",
    { code: "10-13" }),
  T("a-bw", "GF brickwork & columns", "g-struct",
    "2025-11-10", "2026-01-21",
    { code: "14, 17" }),
  T("a-lintel", "Lintel level (shuttering, concrete, curing, wall BW)", "g-struct",
    "2026-01-23", "2026-02-28",
    { code: "18-21" }),
  T("a-gfroof", "GF roof slab (shuttering, steel, concrete & curing)", "g-struct",
    "2026-03-12", "2026-04-10",
    { code: "22-25" }),
  T("a-beam", "GF structural beams", "g-struct",
    "2026-03-12", "2026-04-10",
    { code: "36-38", remarks: "Concurrent with GF roof slab" }),
  T("a-stair", "Staircase (steel, formwork, concrete & curing)", "g-struct",
    "2026-03-12", "2026-04-10",
    { code: "39-41", remarks: "Concurrent with GF roof slab" }),

  // ========== 4. ROOF & FF STRUCTURE ==========
  T("a-ffslab", "FF floor slab (steel, formwork, concrete & curing)", "g-roof",
    "2026-04-13", "2026-05-15",
    { code: "48-50", remarks: "Dates inferred from source sequence" }),
  T("a-ffwall", "FF walls & curing", "g-roof",
    "2026-05-18", "2026-06-15",
    { code: "51-52", remarks: "Dates inferred from source sequence" }),
  T("a-fflintel", "FF lintels (steel, concrete, curing)", "g-roof",
    "2026-06-16", "2026-06-25",
    { code: "53-55", remarks: "Dates inferred from source sequence" }),
  T("a-ffsun", "FF sunshades (steel, formwork, concrete & curing)", "g-roof",
    "2026-06-26", "2026-07-05",
    { code: "56-58", remarks: "Dates inferred from source sequence" }),
  T("a-ffbeam", "FF structural beams (steel, formwork, concrete & curing)", "g-roof",
    "2026-07-06", "2026-07-20",
    { code: "59-61", remarks: "Dates inferred from source sequence" }),
  T("a-ffroof", "FF roof slab (steel, formwork, concrete & curing)", "g-roof",
    "2026-07-21", "2026-08-20",
    { code: "62-64", remarks: "Dates inferred from source sequence" }),
  T("a-sitout", "Sit-out (setout, PCC, RRM, stair room brickwork)", "g-roof",
    "2026-06-22", "2026-06-30",
    { code: "27-30", remarks: "Concurrent with FF works" }),
  T("a-frames", "Door & window frames fixing", "g-roof",
    "2026-08-21", "2026-08-31",
    { code: "65", remarks: "After FF roof curing" }),

  // ========== 5. MEP & SERVICES ==========
  T("a-plumb", "Plumbing rough-in (GF & FF pipes)", "g-mep",
    "2026-05-05", "2026-09-30",
    { code: "26, 34, 73-75", remarks: "Progressed alongside structure" }),
  T("a-elec", "Electrical — conduits, wiring & fixtures", "g-mep",
    "2026-07-02", "2026-10-15",
    { code: "31, 66-67, 104",
      remarks: "Rough-in complete; final fixtures remain",
      completion: 60 }),
  T("a-pump", "Motor pump & solar panel installation", "g-mep",
    "2026-10-03", "2026-10-20",
    { code: "68-69" }),
  T("a-hvac", "HVAC — AC input/output units", "g-mep",
    "2026-10-15", "2026-11-10",
    { code: "70-72" }),
  T("a-drain", "External drainage, RWH chamber & water tank", "g-mep",
    "2026-10-05", "2026-11-15",
    { code: "76-78" }),

  // ========== 6. FINISHING ==========
  T("a-plast", "Plastering — internal, external, GF & FF floors", "g-fin",
    "2026-10-03", "2026-11-10",
    { code: "32, 79-82",
      remarks: "In progress — primary driver of the finish",
      completion: 15 }),
  T("a-tile", "Tile work — floors, bathrooms, car porch & verandah", "g-fin",
    "2026-11-11", "2026-12-15",
    { code: "83-87", remarks: "Follows plastering cure" }),
  T("a-ceil", "False ceiling — inside & porch", "g-fin",
    "2026-12-01", "2026-12-20",
    { code: "88-90", remarks: "Parallel with tiling tail" }),
  T("a-join", "Joinery — door & window installation", "g-fin",
    "2026-12-16", "2027-01-10",
    { code: "100-101", remarks: "After tiling & painting first coat" }),
  T("a-paint", "Painting — internal, external & white wash", "g-fin",
    "2026-12-21", "2027-02-05",
    { code: "35, 91-93",
      remarks: "Source had reversed dates for white washing; corrected here" }),

  // ========== 7. FIT-OUT & LANDSCAPING ==========
  T("a-furn", "Furniture — fixed & loose, kitchen, wardrobes", "g-fitout",
    "2027-01-15", "2027-02-20",
    { code: "94-99" }),
  T("a-sanit", "Sanitary fixtures — kitchen & bathrooms", "g-fitout",
    "2027-01-05", "2027-01-31",
    { code: "102-103" }),
  T("a-metal", "Metal fabrication — pergolas, handrails, porch & glass roof", "g-fitout",
    "2026-10-10", "2026-12-31",
    { code: "42-47", remarks: "Runs parallel to finishing" }),
  T("a-land", "Landscaping — compound wall, gate, paving", "g-fitout",
    "2027-01-01", "2027-02-28",
    { code: "105-108" }),

  // ========== 8. CLOSEOUT ==========
  T("a-hand", "Handover", "g-close",
    "2027-03-15", "2027-03-15",
    { code: "handover", remarks: "Practical completion & snag close-out",
      milestone: true }),
];

export const demoSchedule: WorkSchedule = {
  name: "SREEKESH PROJECT — schedule (as of 2 Oct 2026)",
  predefinedType: "PLANNED",
  tasks: [...groups, ...activities],
  sequences: [
    // ---- main construction chain (drives the critical path) ----
    { id: "s01", relatingTask: "a-set",     relatedTask: "a-exc",      sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s02", relatingTask: "a-exc",     relatedTask: "a-pcc",      sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s03", relatingTask: "a-pcc",     relatedTask: "a-rrm",      sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s04", relatingTask: "a-rrm",     relatedTask: "a-plinth",   sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s05", relatingTask: "a-plinth",  relatedTask: "a-fill",     sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s06", relatingTask: "a-fill",    relatedTask: "a-bw",       sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s07", relatingTask: "a-bw",      relatedTask: "a-lintel",   sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s08", relatingTask: "a-lintel",  relatedTask: "a-gfroof",   sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s09", relatingTask: "a-gfroof",  relatedTask: "a-ffslab",   sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s10", relatingTask: "a-ffslab",  relatedTask: "a-ffwall",   sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s11", relatingTask: "a-ffwall",  relatedTask: "a-ffroof",   sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s12", relatingTask: "a-ffroof",  relatedTask: "a-plast",    sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s13", relatingTask: "a-plast",   relatedTask: "a-tile",     sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s14", relatingTask: "a-tile",    relatedTask: "a-join",     sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s15", relatingTask: "a-join",    relatedTask: "a-paint",    sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s16", relatingTask: "a-paint",   relatedTask: "a-hand",     sequenceType: "FINISH_START", lagDays: 0 },

    // ---- parallel services feeding into finishing ----
    { id: "s17", relatingTask: "a-bw",      relatedTask: "a-plumb",    sequenceType: "START_START",  lagDays: 5 },
    { id: "s18", relatingTask: "a-bw",      relatedTask: "a-elec",     sequenceType: "START_START",  lagDays: 5 },
    { id: "s19", relatingTask: "a-plumb",   relatedTask: "a-plast",    sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s20", relatingTask: "a-elec",    relatedTask: "a-plast",    sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s21", relatingTask: "a-ffroof",  relatedTask: "a-metal",    sequenceType: "FINISH_START", lagDays: 5 },
    { id: "s22", relatingTask: "a-ffroof",  relatedTask: "a-drain",    sequenceType: "FINISH_START", lagDays: 5 },
    { id: "s23", relatingTask: "a-plast",   relatedTask: "a-ceil",     sequenceType: "FINISH_START", lagDays: 20 },
    { id: "s24", relatingTask: "a-paint",   relatedTask: "a-sanit",    sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s25", relatingTask: "a-paint",   relatedTask: "a-furn",     sequenceType: "FINISH_START", lagDays: 0 },
    { id: "s26", relatingTask: "a-tile",    relatedTask: "a-land",     sequenceType: "FINISH_START", lagDays: 0 },
  ],
};