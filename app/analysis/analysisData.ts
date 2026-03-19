// ---------------------------------------------------------------------------
// analysisData.ts  —  v2
// Added: PersonProfile (hourly rate, role), PersonSpend, salary calculations,
//        date-range filter (fromDate / toDate), per-deliverable spends.
// ---------------------------------------------------------------------------

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonProfile {
  name: string;
  role: string;
  /** INR per hour */
  hourlyRate: number;
  /** contract type — used for labelling */
  contractType: "Full-time" | "Freelance" | "Part-time";
}

export interface WorkEntry {
  id: string;
  date: string;           // "YYYY-MM-DD"
  person: string;
  projectId: string;
  projectName: string;
  deliverableId: string;
  deliverableName: string;
  hoursWorked: number;
  notes?: string;
}

export interface RevenueEntry {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  amount: number;         // INR
  type: "Invoice" | "Payment" | "Advance";
  from: string;
}

/** Project / deliverable-level spend by a person (materials, travel, tools…) */
export interface PersonSpend {
  id: string;
  date: string;           // "YYYY-MM-DD"
  person: string;
  projectId: string;
  projectName: string;
  /** null = general project expense, not tied to a deliverable */
  deliverableId: string | null;
  deliverableName: string | null;
  amount: number;         // INR
  category: "Travel" | "Software" | "Printing" | "Material" | "Food" | "Misc";
  description: string;
  /** reimbursed by the company? */
  reimbursed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Person profiles  (hourly rates)
// ─────────────────────────────────────────────────────────────────────────────

export const personProfiles: PersonProfile[] = [
  { name: "Arun Ravikumar", role: "Lead Architect",        hourlyRate: 2500, contractType: "Full-time"  },
  { name: "Meera Nair",     role: "Landscape Designer",    hourlyRate: 1800, contractType: "Full-time"  },
  { name: "Jithin Thomas",  role: "Interior Designer",     hourlyRate: 1600, contractType: "Freelance"  },
  { name: "Priya Krishnan", role: "Structural Engineer",   hourlyRate: 2000, contractType: "Full-time"  },
  { name: "Deepak Pillai",  role: "Façade Specialist",     hourlyRate: 1700, contractType: "Freelance"  },
  { name: "Asha Varma",     role: "Interior Concept Lead", hourlyRate: 1900, contractType: "Part-time"  },
];

export function getProfile(name: string): PersonProfile | undefined {
  return personProfiles.find((p) => p.name === name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Work entries
// ─────────────────────────────────────────────────────────────────────────────

export const workEntries: WorkEntry[] = [

  // ═══════════════════════════════════════════════════════════════
  // JANUARY 2025
  // Each person logs near-daily entries across their active projects
  // ═══════════════════════════════════════════════════════════════

  // Arun Ravikumar — ~22 working days × 7-8 h = ~160 h → ₹4 L gross
  { id:"w_a_0102", date:"2025-01-02", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:7 },
  { id:"w_a_0103", date:"2025-01-03", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:8 },
  { id:"w_a_0106", date:"2025-01-06", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:7 },
  { id:"w_a_0107", date:"2025-01-07", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:8 },
  { id:"w_a_0108", date:"2025-01-08", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:6 },
  { id:"w_a_0109", date:"2025-01-09", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:7 },
  { id:"w_a_0110", date:"2025-01-10", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0113", date:"2025-01-13", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:5 },
  { id:"w_a_0114", date:"2025-01-14", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:6 },
  { id:"w_a_0115", date:"2025-01-15", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:7 },
  { id:"w_a_0116", date:"2025-01-16", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:8 },
  { id:"w_a_0117", date:"2025-01-17", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:5 },
  { id:"w_a_0120", date:"2025-01-20", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:7 },
  { id:"w_a_0121", date:"2025-01-21", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0122", date:"2025-01-22", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:8 },
  { id:"w_a_0123", date:"2025-01-23", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:7 },
  { id:"w_a_0124", date:"2025-01-24", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0127", date:"2025-01-27", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:8 },
  { id:"w_a_0128", date:"2025-01-28", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:7 },
  { id:"w_a_0129", date:"2025-01-29", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0130", date:"2025-01-30", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         hoursWorked:7 },
  { id:"w_a_0131", date:"2025-01-31", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:5 },

  // Meera Nair — ~18 days × 6 h = ~108 h → ₹1.94 L gross
  { id:"w_m_0102", date:"2025-01-02", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0103", date:"2025-01-03", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:7 },
  { id:"w_m_0106", date:"2025-01-06", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0108", date:"2025-01-08", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0110", date:"2025-01-10", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0113", date:"2025-01-13", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:7 },
  { id:"w_m_0115", date:"2025-01-15", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:4 },
  { id:"w_m_0117", date:"2025-01-17", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0120", date:"2025-01-20", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:7 },
  { id:"w_m_0122", date:"2025-01-22", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0123", date:"2025-01-23", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0124", date:"2025-01-24", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0127", date:"2025-01-27", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:7 },
  { id:"w_m_0128", date:"2025-01-28", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0129", date:"2025-01-29", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0131", date:"2025-01-31", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:4 },

  // Jithin Thomas — ~16 days × 7 h = ~112 h → ₹1.79 L gross
  { id:"w_j_0102", date:"2025-01-02", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0103", date:"2025-01-03", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0106", date:"2025-01-06", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:6 },
  { id:"w_j_0108", date:"2025-01-08", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0110", date:"2025-01-10", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0113", date:"2025-01-13", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:7 },
  { id:"w_j_0115", date:"2025-01-15", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:6 },
  { id:"w_j_0117", date:"2025-01-17", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0120", date:"2025-01-20", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0122", date:"2025-01-22", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0124", date:"2025-01-24", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:6 },
  { id:"w_j_0127", date:"2025-01-27", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0128", date:"2025-01-28", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:6 },
  { id:"w_j_0129", date:"2025-01-29", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:8 },
  { id:"w_j_0131", date:"2025-01-31", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:5 },

  // Priya Krishnan — ~16 days × 7 h = ~112 h → ₹2.24 L gross
  { id:"w_p_0102", date:"2025-01-02", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:8 },
  { id:"w_p_0103", date:"2025-01-03", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0106", date:"2025-01-06", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },
  { id:"w_p_0108", date:"2025-01-08", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:8 },
  { id:"w_p_0110", date:"2025-01-10", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0113", date:"2025-01-13", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:6 },
  { id:"w_p_0115", date:"2025-01-15", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:7 },
  { id:"w_p_0117", date:"2025-01-17", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:8 },
  { id:"w_p_0120", date:"2025-01-20", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0122", date:"2025-01-22", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:6 },
  { id:"w_p_0124", date:"2025-01-24", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:8 },
  { id:"w_p_0127", date:"2025-01-27", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:5 },
  { id:"w_p_0128", date:"2025-01-28", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:7 },
  { id:"w_p_0129", date:"2025-01-29", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },
  { id:"w_p_0131", date:"2025-01-31", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:7 },

  // Deepak Pillai — starts Feb (project kicked off late Jan, first log Feb)
  // Asha Varma — starts Feb

  // ═══════════════════════════════════════════════════════════════
  // FEBRUARY 2025
  // ═══════════════════════════════════════════════════════════════

  // Arun
  { id:"w_a_0203", date:"2025-02-03", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:7 },
  { id:"w_a_0204", date:"2025-02-04", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0205", date:"2025-02-05", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:8 },
  { id:"w_a_0206", date:"2025-02-06", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:7 },
  { id:"w_a_0207", date:"2025-02-07", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0210", date:"2025-02-10", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:8 },
  { id:"w_a_0211", date:"2025-02-11", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:7 },
  { id:"w_a_0212", date:"2025-02-12", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0213", date:"2025-02-13", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:5 },
  { id:"w_a_0214", date:"2025-02-14", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:7 },
  { id:"w_a_0217", date:"2025-02-17", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:8 },
  { id:"w_a_0218", date:"2025-02-18", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:9 },
  { id:"w_a_0219", date:"2025-02-19", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:6 },
  { id:"w_a_0220", date:"2025-02-20", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:7 },
  { id:"w_a_0221", date:"2025-02-21", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:6 },
  { id:"w_a_0224", date:"2025-02-24", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:7 },
  { id:"w_a_0225", date:"2025-02-25", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-2",  deliverableName:"Elevation Drawing",  hoursWorked:5 },
  { id:"w_a_0226", date:"2025-02-26", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:8 },
  { id:"w_a_0227", date:"2025-02-27", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          hoursWorked:7 },
  { id:"w_a_0228", date:"2025-02-28", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",        hoursWorked:6 },

  // Meera
  { id:"w_m_0203", date:"2025-02-03", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0205", date:"2025-02-05", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0207", date:"2025-02-07", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:7 },
  { id:"w_m_0210", date:"2025-02-10", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:6 },
  { id:"w_m_0212", date:"2025-02-12", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0214", date:"2025-02-14", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-6",  deliverableName:"Tenant Layout Plan", hoursWorked:6 },
  { id:"w_m_0217", date:"2025-02-17", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-6",  deliverableName:"Tenant Layout Plan", hoursWorked:7 },
  { id:"w_m_0219", date:"2025-02-19", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0221", date:"2025-02-21", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-6",  deliverableName:"Tenant Layout Plan", hoursWorked:6 },
  { id:"w_m_0224", date:"2025-02-24", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-6",  deliverableName:"Tenant Layout Plan", hoursWorked:7 },
  { id:"w_m_0226", date:"2025-02-26", person:"Meera Nair", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     hoursWorked:5 },
  { id:"w_m_0228", date:"2025-02-28", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-6",  deliverableName:"Tenant Layout Plan", hoursWorked:6 },

  // Jithin
  { id:"w_j_0203", date:"2025-02-03", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0205", date:"2025-02-05", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0207", date:"2025-02-07", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:6 },
  { id:"w_j_0210", date:"2025-02-10", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:8 },
  { id:"w_j_0212", date:"2025-02-12", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:7 },
  { id:"w_j_0214", date:"2025-02-14", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0217", date:"2025-02-17", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0219", date:"2025-02-19", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:6 },
  { id:"w_j_0221", date:"2025-02-21", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0224", date:"2025-02-24", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:8 },
  { id:"w_j_0226", date:"2025-02-26", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:6 },
  { id:"w_j_0228", date:"2025-02-28", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },

  // Priya
  { id:"w_p_0203", date:"2025-02-03", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0205", date:"2025-02-05", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },
  { id:"w_p_0207", date:"2025-02-07", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:7 },
  { id:"w_p_0210", date:"2025-02-10", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:8 },
  { id:"w_p_0212", date:"2025-02-12", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },
  { id:"w_p_0214", date:"2025-02-14", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0217", date:"2025-02-17", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:8 },
  { id:"w_p_0219", date:"2025-02-19", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0220", date:"2025-02-20", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:5 },
  { id:"w_p_0221", date:"2025-02-21", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:6 },
  { id:"w_p_0224", date:"2025-02-24", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:8 },
  { id:"w_p_0226", date:"2025-02-26", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:7 },
  { id:"w_p_0228", date:"2025-02-28", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },

  // Deepak Pillai — joins Feb
  { id:"w_d_0203", date:"2025-02-03", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:6 },
  { id:"w_d_0205", date:"2025-02-05", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:7 },
  { id:"w_d_0210", date:"2025-02-10", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:5 },
  { id:"w_d_0212", date:"2025-02-12", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:8 },
  { id:"w_d_0214", date:"2025-02-14", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:6 },
  { id:"w_d_0217", date:"2025-02-17", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:7 },
  { id:"w_d_0219", date:"2025-02-19", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:5 },
  { id:"w_d_0221", date:"2025-02-21", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:6 },
  { id:"w_d_0224", date:"2025-02-24", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:8 },
  { id:"w_d_0226", date:"2025-02-26", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:5 },
  { id:"w_d_0228", date:"2025-02-28", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:7 },

  // Asha Varma — joins Feb
  { id:"w_av_0203", date:"2025-02-03", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:5 },
  { id:"w_av_0205", date:"2025-02-05", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:6 },
  { id:"w_av_0210", date:"2025-02-10", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0212", date:"2025-02-12", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:5 },
  { id:"w_av_0214", date:"2025-02-14", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:6 },
  { id:"w_av_0217", date:"2025-02-17", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0219", date:"2025-02-19", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:5 },
  { id:"w_av_0221", date:"2025-02-21", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:6 },
  { id:"w_av_0224", date:"2025-02-24", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0226", date:"2025-02-26", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:5 },
  { id:"w_av_0227", date:"2025-02-27", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0228", date:"2025-02-28", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:6 },

  // ═══════════════════════════════════════════════════════════════
  // MARCH 2025  (up to 19th — today)
  // ═══════════════════════════════════════════════════════════════

  // Arun
  { id:"w_a_0303", date:"2025-03-03", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:6 },
  { id:"w_a_0304", date:"2025-03-04", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:7 },
  { id:"w_a_0305", date:"2025-03-05", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence", deliverableId:"del-2",  deliverableName:"Elevation Drawing", hoursWorked:5 },
  { id:"w_a_0306", date:"2025-03-06", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:8 },
  { id:"w_a_0307", date:"2025-03-07", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:7 },
  { id:"w_a_0310", date:"2025-03-10", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:5 },
  { id:"w_a_0311", date:"2025-03-11", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence", deliverableId:"del-2",  deliverableName:"Elevation Drawing", hoursWorked:6 },
  { id:"w_a_0312", date:"2025-03-12", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:7 },
  { id:"w_a_0313", date:"2025-03-13", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:8 },
  { id:"w_a_0314", date:"2025-03-14", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence", deliverableId:"del-2",  deliverableName:"Elevation Drawing", hoursWorked:5 },
  { id:"w_a_0317", date:"2025-03-17", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence", deliverableId:"del-2",  deliverableName:"Elevation Drawing", hoursWorked:4 },
  { id:"w_a_0318", date:"2025-03-18", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:6 },
  { id:"w_a_0319", date:"2025-03-19", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",      deliverableId:"del-5",  deliverableName:"3D Render",         hoursWorked:5 },

  // Meera
  { id:"w_m_0303", date:"2025-03-03", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:6 },
  { id:"w_m_0305", date:"2025-03-05", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:5 },
  { id:"w_m_0307", date:"2025-03-07", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:7 },
  { id:"w_m_0310", date:"2025-03-10", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:3 },
  { id:"w_m_0312", date:"2025-03-12", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:6 },
  { id:"w_m_0314", date:"2025-03-14", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:7 },
  { id:"w_m_0317", date:"2025-03-17", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:5 },
  { id:"w_m_0319", date:"2025-03-19", person:"Meera Nair", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-6", deliverableName:"Tenant Layout Plan", hoursWorked:6 },

  // Jithin
  { id:"w_j_0303", date:"2025-03-03", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0305", date:"2025-03-05", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0307", date:"2025-03-07", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:6 },
  { id:"w_j_0310", date:"2025-03-10", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },
  { id:"w_j_0312", date:"2025-03-12", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0314", date:"2025-03-14", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:7 },
  { id:"w_j_0317", date:"2025-03-17", person:"Jithin Thomas", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:6 },
  { id:"w_j_0319", date:"2025-03-19", person:"Jithin Thomas", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",   hoursWorked:8 },

  // Priya
  { id:"w_p_0303", date:"2025-03-03", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0305", date:"2025-03-05", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:6 },
  { id:"w_p_0307", date:"2025-03-07", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:8 },
  { id:"w_p_0310", date:"2025-03-10", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:7 },
  { id:"w_p_0312", date:"2025-03-12", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:6 },
  { id:"w_p_0314", date:"2025-03-14", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:7 },
  { id:"w_p_0317", date:"2025-03-17", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4b", deliverableName:"MEP Drawings",      hoursWorked:8 },
  { id:"w_p_0319", date:"2025-03-19", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block", deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },

  // Deepak
  { id:"w_d_0303", date:"2025-03-03", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:7 },
  { id:"w_d_0305", date:"2025-03-05", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:6 },
  { id:"w_d_0306", date:"2025-03-06", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:4 },
  { id:"w_d_0307", date:"2025-03-07", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:7 },
  { id:"w_d_0310", date:"2025-03-10", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:8 },
  { id:"w_d_0312", date:"2025-03-12", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:6 },
  { id:"w_d_0314", date:"2025-03-14", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:7 },
  { id:"w_d_0317", date:"2025-03-17", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:5 },
  { id:"w_d_0319", date:"2025-03-19", person:"Deepak Pillai", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-7", deliverableName:"Façade Design", hoursWorked:6 },

  // Asha
  { id:"w_av_0303", date:"2025-03-03", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0305", date:"2025-03-05", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:8 },
  { id:"w_av_0307", date:"2025-03-07", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:6 },
  { id:"w_av_0310", date:"2025-03-10", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0312", date:"2025-03-12", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:8 },
  { id:"w_av_0314", date:"2025-03-14", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:6 },
  { id:"w_av_0317", date:"2025-03-17", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:7 },
  { id:"w_av_0318", date:"2025-03-18", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:9 },
  { id:"w_av_0319", date:"2025-03-19", person:"Asha Varma", projectId:"proj-3", projectName:"Greenfield Mall", deliverableId:"del-8", deliverableName:"Interior Concept", hoursWorked:5 },

  // ═══════════════════════════════════════════════════════════════
  // 2024 — Horizon Villa + Test Office retrospective
  // ═══════════════════════════════════════════════════════════════
  { id:"w_a_2404", date:"2024-04-08", person:"Arun Ravikumar", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-9",  deliverableName:"Master Site Plan",  hoursWorked:8 },
  { id:"w_a_2406", date:"2024-04-15", person:"Arun Ravikumar", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-9",  deliverableName:"Master Site Plan",  hoursWorked:7 },
  { id:"w_j_2404", date:"2024-04-15", person:"Jithin Thomas",  projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:9 },
  { id:"w_j_2406", date:"2024-06-20", person:"Jithin Thomas",  projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:8 },
  { id:"w_a_2406b",date:"2024-06-10", person:"Arun Ravikumar", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-9",  deliverableName:"Master Site Plan",  hoursWorked:7 },
  { id:"w_a_2409", date:"2024-09-20", person:"Arun Ravikumar", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-11", deliverableName:"Landscape & Pool",  hoursWorked:6 },
  { id:"w_m_2409", date:"2024-09-25", person:"Meera Nair",     projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-11", deliverableName:"Landscape & Pool",  hoursWorked:7 },
  { id:"w_a_2411", date:"2024-11-05", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",       hoursWorked:8 },
  { id:"w_a_2411b",date:"2024-11-12", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-3",  deliverableName:"Site Layout",       hoursWorked:7 },
  { id:"w_p_2412", date:"2024-12-02", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:5 },
  { id:"w_p_2412b",date:"2024-12-09", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report", hoursWorked:6 },
  { id:"w_j_2412", date:"2024-12-10", person:"Jithin Thomas",  projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans", hoursWorked:8 },
  { id:"w_m_2412", date:"2024-12-18", person:"Meera Nair",     projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-11", deliverableName:"Landscape & Pool",  hoursWorked:5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Revenue entries
// ─────────────────────────────────────────────────────────────────────────────

export const revenueEntries: RevenueEntry[] = [
  { id:"r1", date:"2025-01-15", projectId:"proj-1", projectName:"Sunilkumar Residence",  amount:500000,  type:"Advance",  from:"Sunil Kumar" },
  { id:"r2", date:"2025-02-01", projectId:"proj-2", projectName:"Test Office Block",     amount:800000,  type:"Invoice",  from:"Rajesh Menon" },
  { id:"r3", date:"2025-02-20", projectId:"proj-2", projectName:"Test Office Block",     amount:800000,  type:"Payment",  from:"Rajesh Menon" },
  { id:"r4", date:"2025-03-05", projectId:"proj-3", projectName:"Greenfield Mall",       amount:2000000, type:"Advance",  from:"Greenfield Developers" },
  { id:"r5", date:"2025-03-10", projectId:"proj-1", projectName:"Sunilkumar Residence",  amount:600000,  type:"Invoice",  from:"Sunil Kumar" },
  { id:"r6", date:"2024-04-10", projectId:"proj-4", projectName:"Horizon Villa Complex", amount:1500000, type:"Advance",  from:"Horizon Builders Pvt Ltd" },
  { id:"r7", date:"2024-09-01", projectId:"proj-4", projectName:"Horizon Villa Complex", amount:2000000, type:"Payment",  from:"Horizon Builders Pvt Ltd" },
  { id:"r8", date:"2024-12-15", projectId:"proj-4", projectName:"Horizon Villa Complex", amount:1600000, type:"Payment",  from:"Horizon Builders Pvt Ltd" },
  { id:"r9", date:"2025-03-18", projectId:"proj-3", projectName:"Greenfield Mall",       amount:1500000, type:"Invoice",  from:"Greenfield Developers" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Person spends  (replaces old ExpenseEntry — now richer)
// ─────────────────────────────────────────────────────────────────────────────

export const personSpends: PersonSpend[] = [
  // Arun
  { id:"ps1",  date:"2025-01-20", person:"Arun Ravikumar", projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-1",  deliverableName:"Floor Plan",         amount:3200,  category:"Software",  description:"AutoCAD annual licence",     reimbursed:true  },
  { id:"ps2",  date:"2025-02-10", person:"Arun Ravikumar", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:null,      deliverableName:null,                 amount:1800,  category:"Travel",    description:"Site visit Kochi (train)",   reimbursed:true  },
  { id:"ps3",  date:"2025-03-03", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-5",  deliverableName:"3D Render",          amount:22000, category:"Software",  description:"Lumion render licence",      reimbursed:true  },
  { id:"ps4",  date:"2025-03-19", person:"Arun Ravikumar", projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:null,      deliverableName:null,                 amount:4500,  category:"Travel",    description:"Flight BLR site visit",     reimbursed:false },
  { id:"ps5",  date:"2024-04-08", person:"Arun Ravikumar", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-9",  deliverableName:"Master Site Plan",   amount:900,   category:"Printing",  description:"A1 prints × 6",             reimbursed:true  },
  { id:"ps6",  date:"2024-09-20", person:"Arun Ravikumar", projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-11", deliverableName:"Landscape & Pool",   amount:9000,  category:"Material",  description:"Sample tile procurement",    reimbursed:true  },

  // Meera
  { id:"ps7",  date:"2025-01-15", person:"Meera Nair",     projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     amount:2500,  category:"Material",  description:"Plant samples for concept",  reimbursed:false },
  { id:"ps8",  date:"2025-02-12", person:"Meera Nair",     projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3a", deliverableName:"Landscape Plan",     amount:1200,  category:"Travel",    description:"Bus + auto to site",        reimbursed:true  },
  { id:"ps9",  date:"2025-03-10", person:"Meera Nair",     projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-6",  deliverableName:"Tenant Layout Plan", amount:850,   category:"Printing",  description:"Layout prints",             reimbursed:true  },
  { id:"ps10", date:"2024-12-18", person:"Meera Nair",     projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-11", deliverableName:"Landscape & Pool",   amount:3300,  category:"Material",  description:"Garden fittings sample",    reimbursed:true  },

  // Jithin
  { id:"ps11", date:"2025-01-22", person:"Jithin Thomas",  projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",    amount:5000,  category:"Printing",  description:"Interior boards × 10",      reimbursed:true  },
  { id:"ps12", date:"2025-02-14", person:"Jithin Thomas",  projectId:"proj-1", projectName:"Sunilkumar Residence",  deliverableId:"del-3b", deliverableName:"Interior Layout",    amount:1800,  category:"Travel",    description:"Client presentation trip",  reimbursed:true  },
  { id:"ps13", date:"2024-04-15", person:"Jithin Thomas",  projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans",  amount:1200,  category:"Printing",  description:"Floor plan prints",         reimbursed:true  },
  { id:"ps14", date:"2024-12-10", person:"Jithin Thomas",  projectId:"proj-4", projectName:"Horizon Villa Complex", deliverableId:"del-10", deliverableName:"Villa Floor Plans",  amount:600,   category:"Misc",      description:"Courier docs to client",    reimbursed:false },

  // Priya
  { id:"ps15", date:"2025-02-05", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report",  amount:8500,  category:"Software",  description:"STAAD.Pro licence renewal",  reimbursed:true  },
  { id:"ps16", date:"2025-02-20", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4",  deliverableName:"Structural Report",  amount:2200,  category:"Travel",    description:"Site inspection Kochi",     reimbursed:true  },
  { id:"ps17", date:"2025-03-12", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:"del-4b", deliverableName:"MEP Drawings",       amount:6200,  category:"Software",  description:"AutoCAD MEP add-on",        reimbursed:true  },
  { id:"ps18", date:"2024-12-02", person:"Priya Krishnan", projectId:"proj-2", projectName:"Test Office Block",     deliverableId:null,      deliverableName:null,                 amount:1500,  category:"Food",      description:"Team lunch – site review",  reimbursed:false },

  // Deepak
  { id:"ps19", date:"2025-02-26", person:"Deepak Pillai",  projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-7",  deliverableName:"Façade Design",      amount:15000, category:"Travel",    description:"Flight TVM–BLR site visit", reimbursed:true  },
  { id:"ps20", date:"2025-03-06", person:"Deepak Pillai",  projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-7",  deliverableName:"Façade Design",      amount:3800,  category:"Material",  description:"Façade cladding samples",   reimbursed:true  },
  { id:"ps21", date:"2025-03-19", person:"Deepak Pillai",  projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-7",  deliverableName:"Façade Design",      amount:900,   category:"Printing",  description:"Detail drawings A0",        reimbursed:true  },

  // Asha
  { id:"ps22", date:"2025-02-27", person:"Asha Varma",     projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-8",  deliverableName:"Interior Concept",   amount:12000, category:"Material",  description:"Material mood board items", reimbursed:true  },
  { id:"ps23", date:"2025-03-05", person:"Asha Varma",     projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:"del-8",  deliverableName:"Interior Concept",   amount:2800,  category:"Travel",    description:"BLR client meeting travel", reimbursed:true  },
  { id:"ps24", date:"2025-03-18", person:"Asha Varma",     projectId:"proj-3", projectName:"Greenfield Mall",       deliverableId:null,      deliverableName:null,                 amount:1100,  category:"Food",      description:"Team lunch",                reimbursed:false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived lists for filter dropdowns
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_PERSONS = Array.from(new Set(workEntries.map((w) => w.person))).sort();
export const ALL_PROJECTS = Array.from(
  new Map(workEntries.map((w) => [w.projectId, w.projectName])).entries()
).map(([id, name]) => ({ id, name }));
export const ALL_DELIVERABLES = Array.from(
  new Map(workEntries.map((w) => [w.deliverableId, w.deliverableName])).entries()
).map(([id, name]) => ({ id, name }));

// ─────────────────────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)} K`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter interface — now supports fromDate / toDate date range
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisFilter {
  /** calendar-tab granularity */
  granularity: "day" | "month" | "year";
  /** "YYYY-MM-DD" | "YYYY-MM" | "YYYY" */
  dateKey: string;
  /** custom date range overrides dateKey when both set */
  fromDate: string | null;  // "YYYY-MM-DD"
  toDate: string | null;    // "YYYY-MM-DD"
  person: string | null;
  projectId: string | null;
  deliverableId: string | null;
}

function inRange(date: string, f: AnalysisFilter): boolean {
  if (f.fromDate && f.toDate) {
    return date >= f.fromDate && date <= f.toDate;
  }
  if (f.granularity === "day")   return date === f.dateKey;
  if (f.granularity === "month") return date.startsWith(f.dateKey);
  if (f.granularity === "year")  return date.startsWith(f.dateKey);
  return true;
}

export function filterWorkEntries(entries: WorkEntry[], f: AnalysisFilter): WorkEntry[] {
  return entries.filter((w) => {
    if (!inRange(w.date, f)) return false;
    if (f.person        && w.person         !== f.person)        return false;
    if (f.projectId     && w.projectId      !== f.projectId)     return false;
    if (f.deliverableId && w.deliverableId  !== f.deliverableId) return false;
    return true;
  });
}

export function filterRevenue(entries: RevenueEntry[], f: AnalysisFilter): RevenueEntry[] {
  return entries.filter((r) => {
    if (!inRange(r.date, f)) return false;
    if (f.projectId && r.projectId !== f.projectId) return false;
    return true;
  });
}

export function filterSpends(entries: PersonSpend[], f: AnalysisFilter): PersonSpend[] {
  return entries.filter((s) => {
    if (!inRange(s.date, f)) return false;
    if (f.person        && s.person         !== f.person)                            return false;
    if (f.projectId     && s.projectId      !== f.projectId)                         return false;
    if (f.deliverableId && s.deliverableId  !== f.deliverableId)                     return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Salary / earnings calculation
// ─────────────────────────────────────────────────────────────────────────────

export interface EarningsSummary {
  person: string;
  role: string;
  hourlyRate: number;
  contractType: string;
  hoursWorked: number;
  grossEarnings: number;       // hoursWorked × hourlyRate
  spends: number;              // sum of PersonSpend.amount for this person
  reimburseableSpends: number; // spends where reimbursed === true
  netPayable: number;          // grossEarnings + reimburseableSpends (company owes)
}

export function computeEarnings(
  work: WorkEntry[],
  spends: PersonSpend[],
  persons?: string[]          // if null, compute for everyone in work
): EarningsSummary[] {
  const names = persons ?? Array.from(new Set(work.map((w) => w.person)));
  return names.map((name) => {
    const profile = getProfile(name);
    const rate    = profile?.hourlyRate ?? 0;
    const hours   = work.filter((w) => w.person === name).reduce((s, w) => s + w.hoursWorked, 0);
    const pSpends = spends.filter((s) => s.person === name);
    const totalSpend   = pSpends.reduce((s, e) => s + e.amount, 0);
    const reimbursable = pSpends.filter((e) => e.reimbursed).reduce((s, e) => s + e.amount, 0);
    const gross  = hours * rate;
    return {
      person:              name,
      role:                profile?.role        ?? "Unknown",
      hourlyRate:          rate,
      contractType:        profile?.contractType ?? "—",
      hoursWorked:         hours,
      grossEarnings:       gross,
      spends:              totalSpend,
      reimburseableSpends: reimbursable,
      netPayable:          gross + reimbursable,
    };
  }).filter((s) => s.hoursWorked > 0 || s.spends > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregates for bar charts
// ─────────────────────────────────────────────────────────────────────────────

export function hoursPerPerson(entries: WorkEntry[])      { return _groupBy(entries, (w) => w.person,         (w) => w.hoursWorked); }
export function hoursPerProject(entries: WorkEntry[])     { return _groupBy(entries, (w) => w.projectName,    (w) => w.hoursWorked); }
export function hoursPerDeliverable(entries: WorkEntry[]) { return _groupBy(entries, (w) => w.deliverableName,(w) => w.hoursWorked); }
export function hoursPerDay(entries: WorkEntry[]) {
  return _groupBy(entries, (w) => w.date, (w) => w.hoursWorked, true);
}

function _groupBy(
  entries: WorkEntry[],
  key: (w: WorkEntry) => string,
  val: (w: WorkEntry) => number,
  sort = false
): { label: string; hours: number }[] {
  const map = new Map<string, number>();
  entries.forEach((w) => map.set(key(w), (map.get(key(w)) ?? 0) + val(w)));
  const arr = Array.from(map.entries()).map(([label, hours]) => ({ label, hours }));
  return sort ? arr.sort((a, b) => a.label.localeCompare(b.label)) : arr.sort((a, b) => b.hours - a.hours);
}