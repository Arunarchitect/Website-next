// data.ts — single source of truth for all pages

// ═══════════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Organisation {
  id: string;
  name: string;
  tagline?: string;
  logo?: string;
  industry?: string;
  since?: number;
}

export interface Project {
  id: string;
  organisationId: string;
  name: string;
  color: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  organisationId: string;
  name: string;
  stage?: "1" | "2" | "3" | "4" | "5";
  status?: "not_started" | "ongoing" | "ready" | "passed" | "failed" | "discrepancy";
}

export interface Member {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

export interface Assignment {
  id: string;
  deliverableId: string;
  memberId: string;
  startDate: string; // "YYYY-MM-DD"
  dueDate: string;   // "YYYY-MM-DD"
}

export interface QuickAccess {
  id: string;
  userId: string;
  deliverableId: string;
  position: number;
}

export interface WorklogEntry {
  id: string;
  organisationId: string;
  projectId: string;
  deliverableId: string;
  memberId: string;
  date: string;      // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  notes?: string;
}

export interface User {
  id: string;
  name: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────
// Mirrors Django Expense model.
// `organisationId` is denormalised for fast filtering (inferred from project).
// `memberId` maps to User FK on the Django model.
// `reimbursed`: true = company has already paid back; false = pending.

export type ExpenseCategory =
  | "salary"        // finance/payroll component only
  | "travel"
  | "food"
  | "accommodation"
  | "stationery"
  | "others";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  salary:        "Salary",
  travel:        "Travel",
  food:          "Food",
  accommodation: "Accommodation",
  stationery:    "Stationery",
  others:        "Others",
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  salary:        "#6366f1",
  travel:        "#f59e0b",
  food:          "#10b981",
  accommodation: "#3b82f6",
  stationery:    "#8b5cf6",
  others:        "#6b7280",
};

export interface Expense {
  id: string;
  organisationId: string;
  memberId: string;   // FK → Member  (was `userId` in older finance file)
  projectId: string;  // FK → Project
  amount: number;
  category: ExpenseCategory;
  remarks: string;
  date: string;       // "YYYY-MM-DD"
  createdAt: string;  // ISO datetime
  reimbursed: boolean;
}

/** Revenue/spend entry — linked to a deliverable (finance component) */
export interface Entry {
  id: string;
  date: string;
  projectId: string;
  deliverableId: string;
  memberId: string;
  revenue: number;
  spend: number;
}

// ─── Salary-calculator types ──────────────────────────────────────────────────

export interface MemberRate     { memberId: string; hourlyRate: number; }
export interface ProjectFee     { projectId: string; totalFee: number; }
export interface StageFee       { id: string; projectId: string; stage: "1"|"2"|"3"|"4"|"5"; label: string; fee: number; }
export interface FundAllocation { id: string; projectId: string; label: string; memberId?: string; percentage: number; color?: string; }

// ─── Performance types ────────────────────────────────────────────────────────

export type RemarkLevel = "Excellent" | "Good" | "Average" | "Needs Improvement";

export interface PerformanceMember {
  id: string;
  name: string;
  role: string;
  orgId: string;
  avatar: string;
  skills: { name: string; score: number; remark: RemarkLevel }[];
  assignments: {
    id: string;
    title: string;
    projectId: string;
    deliverableId: string;
    assignedAt: string;
    dueAt: string;
    completedAt?: string;
    status: "Completed" | "In Progress" | "Overdue";
  }[];
}

// ─── Project dashboard types ──────────────────────────────────────────────────
// These types serve the project dashboard component exclusively.
// `DeliverableStatus` uses display-friendly casing ("Not Started" etc.)
// which differs from the core Deliverable.status snake_case convention.

export type ProjectStatus     = "Active" | "On Hold" | "Completed" | "Cancelled";
export type DeliverableStatus = "Not Started" | "In Progress" | "Review" | "Done";

export interface Client {
  name: string;
  contact: string;   // email or phone
  location: string;  // city, country
}

export interface DeliverableItem {
  id: string;
  name: string;
  assignedTo: string;  // member name string (display only)
  status: DeliverableStatus;
  dueDate: string;     // "YYYY-MM-DD"
  hoursLogged: number;
}

export interface ProjectDetail {
  id: string;           // matches Project.id where applicable
  name: string;
  organisation: string; // org name string (display only)
  status: ProjectStatus;
  client: Client;
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;      // "YYYY-MM-DD"
  revenue: number;      // INR
  currency: string;
  description: string;
  tags: string[];
  deliverables: DeliverableItem[];
  teamMembers: string[]; // member name strings (display only)
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Current user ─────────────────────────────────────────────────────────────
// ID mapping: user-1 → m6, user-2 → m2, user-3 → m3

export const currentUser: User = { id: "m6", name: "Arun Ravikumar" };

// ─── Organisations ────────────────────────────────────────────────────────────

export const organisations: Organisation[] = [
  // Finance component org (Stonemark Studio)
  { id: "org1", name: "Stonemark Studio", tagline: "Designing spaces that endure", logo: "SM", industry: "Architecture & Urban Design", since: 2019 },
  // Worklog / salary / performance / dashboard orgs
  { id: "org-1", name: "Sunilkumar Associates" },
  { id: "org-2", name: "Test Corp"             },
  { id: "org-3", name: "Greenfield Ltd"        },
  { id: "org-4", name: "Horizon Builders"      },
];

// Alias used by performance page
export const ORGANISATIONS = organisations;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects: Project[] = [
  // Finance component projects (org: "org1")
  { id: "p1", organisationId: "org1", name: "Meridian Tower",      color: "#6366f1" },
  { id: "p2", organisationId: "org1", name: "Harlow Residences",   color: "#f59e0b" },
  { id: "p3", organisationId: "org1", name: "Civic Arts Pavilion", color: "#10b981" },
  { id: "p4", organisationId: "org1", name: "Vantage Mixed-Use",   color: "#ef4444" },
  // Worklog / salary / performance / dashboard projects
  { id: "proj-1", organisationId: "org-1", name: "Sunilkumar Residence", color: "#6366f1" },
  { id: "proj-2", organisationId: "org-2", name: "Test Office Block",    color: "#f59e0b" },
  { id: "proj-3", organisationId: "org-3", name: "Greenfield Mall",      color: "#10b981" },
  { id: "proj-4", organisationId: "org-4", name: "Horizon Villa Complex", color: "#8b5cf6" },
];

// ─── Deliverables ─────────────────────────────────────────────────────────────

export const deliverables: Deliverable[] = [
  // Finance component deliverables (no stage/status — finance page doesn't need them)
  { id: "d1", projectId: "p1", organisationId: "org1", name: "Concept Design"      },
  { id: "d2", projectId: "p1", organisationId: "org1", name: "Structural Drawings" },
  { id: "d3", projectId: "p1", organisationId: "org1", name: "Planning Submission" },
  { id: "d4", projectId: "p2", organisationId: "org1", name: "Interior Layouts"    },
  { id: "d5", projectId: "p2", organisationId: "org1", name: "Landscape Plan"      },
  { id: "d6", projectId: "p3", organisationId: "org1", name: "Facade Design"       },
  { id: "d7", projectId: "p3", organisationId: "org1", name: "Acoustic Report"     },
  { id: "d8", projectId: "p4", organisationId: "org1", name: "Site Master Plan"    },
  { id: "d9", projectId: "p4", organisationId: "org1", name: "3D Visualisations"   },
  // Worklog / salary / performance deliverables (have stage + status)
  { id: "del-1", projectId: "proj-1", organisationId: "org-1", name: "Floor Plan",        stage: "1", status: "not_started" },
  { id: "del-2", projectId: "proj-1", organisationId: "org-1", name: "Elevation Drawing", stage: "1", status: "not_started" },
  { id: "del-3", projectId: "proj-2", organisationId: "org-2", name: "Site Layout",       stage: "2", status: "not_started" },
  { id: "del-4", projectId: "proj-2", organisationId: "org-2", name: "Structural Report", stage: "2", status: "not_started" },
  { id: "del-5", projectId: "proj-3", organisationId: "org-3", name: "3D Render",         stage: "3", status: "not_started" },
];

// ─── Members ──────────────────────────────────────────────────────────────────
//
//  Unified ID map:
//  m1  Arjun Nair       (finance only)
//  m2  Priya Menon      ← was user-2
//  m3  Rohan Das        ← was user-3
//  m4  Sneha Iyer       (finance only)
//  m5  Vikram Pillai    (finance only)
//  m6  Arun Ravikumar   ← was user-1, currentUser

export const members: Member[] = [
  { id: "m1", name: "Arjun Nair",     avatar: "AN", role: "Architect"           },
  { id: "m2", name: "Priya Menon",    avatar: "PM", role: "Project Manager"     },
  { id: "m3", name: "Rohan Das",      avatar: "RD", role: "Structural Eng."     },
  { id: "m4", name: "Sneha Iyer",     avatar: "SI", role: "Urban Planner"       },
  { id: "m5", name: "Vikram Pillai",  avatar: "VP", role: "Structural Engineer" },
  { id: "m6", name: "Arun Ravikumar", avatar: "AR", role: "Lead Architect"      },
];

// ─── Assignments ──────────────────────────────────────────────────────────────

export const assignments: Assignment[] = [
  { id: "asgn-1", deliverableId: "del-1", memberId: "m6", startDate: "2025-03-20", dueDate: "2025-03-28" },
  { id: "asgn-2", deliverableId: "del-4", memberId: "m6", startDate: "2025-03-22", dueDate: "2025-04-01" },
];

// ─── Quick Access ─────────────────────────────────────────────────────────────

export let quickAccessItems: QuickAccess[] = [
  { id: "qa-1", userId: "m6", deliverableId: "del-5", position: 0 },
  { id: "qa-2", userId: "m6", deliverableId: "del-2", position: 1 },
];

export function addQuickAccess(userId: string, deliverableId: string): void {
  if (quickAccessItems.some(q => q.userId === userId && q.deliverableId === deliverableId)) return;
  const maxPos = quickAccessItems
    .filter(q => q.userId === userId)
    .reduce((m, q) => Math.max(m, q.position), -1);
  quickAccessItems = [...quickAccessItems, { id: `qa-${Date.now()}`, userId, deliverableId, position: maxPos + 1 }];
}

export function removeQuickAccess(userId: string, deliverableId: string): void {
  quickAccessItems = quickAccessItems.filter(q => !(q.userId === userId && q.deliverableId === deliverableId));
}

// ─── Worklog entries ──────────────────────────────────────────────────────────

export const worklogEntries: WorklogEntry[] = [
  { id: "wl-1",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-1", memberId: "m6", date: "2025-01-06", startTime: "09:00", endTime: "12:30" },
  { id: "wl-2",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-2", memberId: "m6", date: "2025-01-07", startTime: "10:00", endTime: "13:00" },
  { id: "wl-3",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-3", memberId: "m2", date: "2025-01-08", startTime: "14:00", endTime: "17:30" },
  { id: "wl-4",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-4", memberId: "m3", date: "2025-01-10", startTime: "08:30", endTime: "11:30" },
  { id: "wl-5",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-1", memberId: "m6", date: "2025-02-03", startTime: "09:00", endTime: "12:00" },
  { id: "wl-6",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-3", memberId: "m2", date: "2025-02-11", startTime: "08:00", endTime: "10:30" },
  { id: "wl-7",  organisationId: "org-3", projectId: "proj-3", deliverableId: "del-5", memberId: "m6", date: "2025-02-17", startTime: "10:00", endTime: "12:30" },
  { id: "wl-8",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-2", memberId: "m6", date: "2025-03-10", startTime: "13:00", endTime: "17:30" },
  { id: "wl-9",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-4", memberId: "m3", date: "2025-03-11", startTime: "09:00", endTime: "11:30" },
  { id: "wl-10", organisationId: "org-3", projectId: "proj-3", deliverableId: "del-5", memberId: "m6", date: "2025-03-18", startTime: "13:00", endTime: "15:30" },
  { id: "wl-11", organisationId: "org-1", projectId: "proj-1", deliverableId: "del-1", memberId: "m6", date: "2025-03-21", startTime: "09:00", endTime: "12:00" },
];

// ─── Salary calculator data ───────────────────────────────────────────────────

export const memberRates: MemberRate[] = [
  { memberId: "m6", hourlyRate: 1500 },
  { memberId: "m2", hourlyRate: 1200 },
  { memberId: "m3", hourlyRate: 900  },
];

export const projectFees: ProjectFee[] = [
  { projectId: "proj-1", totalFee: 1_200_000 },
  { projectId: "proj-2", totalFee:   850_000 },
  { projectId: "proj-3", totalFee: 2_500_000 },
];

export const stageFees: StageFee[] = [
  { id: "sf-1-1", projectId: "proj-1", stage: "1", label: "Concept & Schematic",    fee:  240_000 },
  { id: "sf-1-2", projectId: "proj-1", stage: "2", label: "Design Development",     fee:  300_000 },
  { id: "sf-1-3", projectId: "proj-1", stage: "3", label: "Construction Documents", fee:  360_000 },
  { id: "sf-1-4", projectId: "proj-1", stage: "4", label: "Tender & Procurement",   fee:  180_000 },
  { id: "sf-1-5", projectId: "proj-1", stage: "5", label: "Site Supervision",       fee:  120_000 },
  { id: "sf-2-1", projectId: "proj-2", stage: "1", label: "Concept & Schematic",    fee:  127_500 },
  { id: "sf-2-2", projectId: "proj-2", stage: "2", label: "Design Development",     fee:  212_500 },
  { id: "sf-2-3", projectId: "proj-2", stage: "3", label: "Construction Documents", fee:  255_000 },
  { id: "sf-2-4", projectId: "proj-2", stage: "4", label: "Tender & Procurement",   fee:  127_500 },
  { id: "sf-2-5", projectId: "proj-2", stage: "5", label: "Site Supervision",       fee:  127_500 },
  { id: "sf-3-1", projectId: "proj-3", stage: "1", label: "Concept & Schematic",    fee:  500_000 },
  { id: "sf-3-2", projectId: "proj-3", stage: "2", label: "Design Development",     fee:  625_000 },
  { id: "sf-3-3", projectId: "proj-3", stage: "3", label: "Construction Documents", fee:  750_000 },
  { id: "sf-3-4", projectId: "proj-3", stage: "4", label: "Tender & Procurement",   fee:  375_000 },
  { id: "sf-3-5", projectId: "proj-3", stage: "5", label: "Site Supervision",       fee:  250_000 },
];

export const fundAllocations: FundAllocation[] = [
  { id: "fa-1-1", projectId: "proj-1", label: "Company Expenses", percentage: 30, color: "#6366f1" },
  { id: "fa-1-2", projectId: "proj-1", label: "CEO",              percentage: 30, color: "#f59e0b" },
  { id: "fa-1-3", projectId: "proj-1", label: "Arun Ravikumar",   percentage: 25, color: "#10b981", memberId: "m6" },
  { id: "fa-1-4", projectId: "proj-1", label: "Savings Fund",     percentage: 15, color: "#06b6d4" },
  { id: "fa-2-1", projectId: "proj-2", label: "Company Expenses", percentage: 30, color: "#6366f1" },
  { id: "fa-2-2", projectId: "proj-2", label: "CEO",              percentage: 25, color: "#f59e0b" },
  { id: "fa-2-3", projectId: "proj-2", label: "Priya Menon",      percentage: 20, color: "#10b981", memberId: "m2" },
  { id: "fa-2-4", projectId: "proj-2", label: "Rohan Das",        percentage: 15, color: "#818cf8", memberId: "m3" },
  { id: "fa-2-5", projectId: "proj-2", label: "Savings Fund",     percentage: 10, color: "#06b6d4" },
  { id: "fa-3-1", projectId: "proj-3", label: "Company Expenses", percentage: 30, color: "#6366f1" },
  { id: "fa-3-2", projectId: "proj-3", label: "CEO",              percentage: 30, color: "#f59e0b" },
  { id: "fa-3-3", projectId: "proj-3", label: "Arun Ravikumar",   percentage: 20, color: "#10b981", memberId: "m6" },
  { id: "fa-3-4", projectId: "proj-3", label: "Savings Fund",     percentage: 10, color: "#06b6d4" },
  { id: "fa-3-5", projectId: "proj-3", label: "Priya Menon",      percentage: 10, color: "#818cf8", memberId: "m2" },
];

// ─── Performance page members ─────────────────────────────────────────────────

export const MEMBERS: PerformanceMember[] = [
  {
    id: "m6", name: "Arun Ravikumar", role: "Lead Architect", orgId: "org-1", avatar: "AR",
    skills: [
      { name: "Architectural Design",    score: 92, remark: "Excellent" },
      { name: "AutoCAD",                 score: 88, remark: "Excellent" },
      { name: "BIM Modelling",           score: 75, remark: "Good"      },
      { name: "Structural Coordination", score: 68, remark: "Average"   },
      { name: "Client Presentation",     score: 80, remark: "Good"      },
    ],
    assignments: [
      { id: "pa-1", title: "Floor Plan — Sunilkumar Residence",       projectId: "proj-1", deliverableId: "del-1", assignedAt: "2025-03-20", dueAt: "2025-03-28", completedAt: "2025-03-26", status: "Completed"   },
      { id: "pa-2", title: "Elevation Drawing — Sunilkumar Residence", projectId: "proj-1", deliverableId: "del-2", assignedAt: "2025-03-22", dueAt: "2025-04-05",                           status: "In Progress" },
      { id: "pa-3", title: "3D Render — Greenfield Mall",              projectId: "proj-3", deliverableId: "del-5", assignedAt: "2025-02-10", dueAt: "2025-02-28", completedAt: "2025-03-05", status: "Overdue"     },
    ],
  },
  {
    id: "m2", name: "Priya Menon", role: "Project Manager", orgId: "org-1", avatar: "PM",
    skills: [
      { name: "Project Scheduling", score: 90, remark: "Excellent"         },
      { name: "Risk Management",    score: 74, remark: "Good"              },
      { name: "Stakeholder Comms",  score: 85, remark: "Excellent"         },
      { name: "Budget Control",     score: 60, remark: "Average"           },
      { name: "AutoCAD",            score: 38, remark: "Needs Improvement" },
    ],
    assignments: [
      { id: "pa-4", title: "Site Layout — Test Office Block",              projectId: "proj-2", deliverableId: "del-3", assignedAt: "2025-01-08", dueAt: "2025-01-20", completedAt: "2025-01-18", status: "Completed" },
      { id: "pa-5", title: "Structural Report Review — Test Office Block", projectId: "proj-2", deliverableId: "del-4", assignedAt: "2025-03-01", dueAt: "2025-03-15", completedAt: "2025-03-20", status: "Overdue"   },
    ],
  },
  {
    id: "m3", name: "Rohan Das", role: "Structural Eng.", orgId: "org-2", avatar: "RD",
    skills: [
      { name: "Structural Analysis", score: 95, remark: "Excellent"         },
      { name: "STAAD.Pro",           score: 88, remark: "Excellent"         },
      { name: "Concrete Design",     score: 82, remark: "Good"              },
      { name: "Foundation Design",   score: 70, remark: "Good"              },
      { name: "Technical Reporting", score: 55, remark: "Average"           },
      { name: "Client Presentation", score: 42, remark: "Needs Improvement" },
    ],
    assignments: [
      { id: "pa-6", title: "Structural Report — Test Office Block",   projectId: "proj-2", deliverableId: "del-4", assignedAt: "2025-01-10", dueAt: "2025-01-25", completedAt: "2025-01-24", status: "Completed"   },
      { id: "pa-7", title: "Foundation Analysis — Test Office Block", projectId: "proj-2", deliverableId: "del-4", assignedAt: "2025-03-11", dueAt: "2025-03-25",                           status: "In Progress" },
    ],
  },
];

// ─── Project dashboard data ───────────────────────────────────────────────────
// `ProjectDetail.id` matches `Project.id` for proj-1/2/3.
// `proj-4` (Horizon Villa Complex) is dashboard-only — completed project,
// not present in the worklog/performance dataset.
// `teamMembers` and `DeliverableItem.assignedTo` use name strings (display only).

export const projectDetails: ProjectDetail[] = [
  {
    id: "proj-1",
    name: "Sunilkumar Residence",
    organisation: "Sunilkumar Associates",
    status: "Active",
    client: { name: "Sunil Kumar", contact: "sunil@example.com", location: "Thiruvananthapuram, Kerala" },
    startDate: "2025-01-10",
    endDate: "2025-08-31",
    revenue: 1_850_000,
    currency: "INR",
    description: "Design and documentation for a 3-bedroom luxury residence including landscaping, interior layouts, and structural drawings.",
    tags: ["Residential", "Luxury", "Kerala"],
    teamMembers: ["Arun Ravikumar", "Meera Nair", "Jithin Thomas"],
    deliverables: [
      { id: "del-1",  name: "Floor Plan",        assignedTo: "Arun Ravikumar", status: "Done",        dueDate: "2025-02-28", hoursLogged: 18 },
      { id: "del-2",  name: "Elevation Drawing", assignedTo: "Arun Ravikumar", status: "In Progress", dueDate: "2025-04-15", hoursLogged:  9 },
      { id: "del-3a", name: "Landscape Plan",    assignedTo: "Meera Nair",     status: "Not Started", dueDate: "2025-06-01", hoursLogged:  0 },
      { id: "del-3b", name: "Interior Layout",   assignedTo: "Jithin Thomas",  status: "Review",      dueDate: "2025-05-10", hoursLogged: 22 },
    ],
  },
  {
    id: "proj-2",
    name: "Test Office Block",
    organisation: "Test Corp",
    status: "On Hold",
    client: { name: "Rajesh Menon", contact: "+91 98765 43210", location: "Kochi, Kerala" },
    startDate: "2024-11-01",
    endDate: "2025-06-30",
    revenue: 3_200_000,
    currency: "INR",
    description: "Commercial office block — 6 floors, open-plan with modular workstations. Structural, MEP, and façade documentation.",
    tags: ["Commercial", "Office", "MEP"],
    teamMembers: ["Arun Ravikumar", "Priya Krishnan"],
    deliverables: [
      { id: "del-3",  name: "Site Layout",      assignedTo: "Arun Ravikumar",  status: "Done",        dueDate: "2024-12-15", hoursLogged: 30 },
      { id: "del-4",  name: "Structural Report", assignedTo: "Priya Krishnan", status: "In Progress", dueDate: "2025-03-30", hoursLogged: 14 },
      { id: "del-4b", name: "MEP Drawings",      assignedTo: "Priya Krishnan", status: "Not Started", dueDate: "2025-05-15", hoursLogged:  0 },
    ],
  },
  {
    id: "proj-3",
    name: "Greenfield Mall",
    organisation: "Greenfield Ltd",
    status: "Active",
    client: { name: "Greenfield Developers", contact: "projects@greenfield.in", location: "Bangalore, Karnataka" },
    startDate: "2025-02-01",
    endDate: "2026-03-31",
    revenue: 8_750_000,
    currency: "INR",
    description: "Large-format retail mall — 3 levels, 120 tenants. Full architectural, structural, and interior design package.",
    tags: ["Retail", "Large-scale", "Interior"],
    teamMembers: ["Arun Ravikumar", "Meera Nair", "Deepak Pillai", "Asha Varma"],
    deliverables: [
      { id: "del-5", name: "3D Render",        assignedTo: "Arun Ravikumar", status: "In Progress", dueDate: "2025-04-30", hoursLogged: 11 },
      { id: "del-6", name: "Tenant Layout Plan", assignedTo: "Meera Nair",   status: "Not Started", dueDate: "2025-07-01", hoursLogged:  0 },
      { id: "del-7", name: "Façade Design",    assignedTo: "Deepak Pillai",  status: "Not Started", dueDate: "2025-08-15", hoursLogged:  0 },
      { id: "del-8", name: "Interior Concept", assignedTo: "Asha Varma",     status: "Review",      dueDate: "2025-05-20", hoursLogged: 28 },
    ],
  },
  {
    id: "proj-4",
    name: "Horizon Villa Complex",
    organisation: "Horizon Builders",
    status: "Completed",
    client: { name: "Horizon Builders Pvt Ltd", contact: "info@horizonbuilders.com", location: "Kozhikode, Kerala" },
    startDate: "2024-03-01",
    endDate: "2024-12-31",
    revenue: 5_100_000,
    currency: "INR",
    description: "Cluster of 8 premium villas with shared amenities — pool, gym, and landscaped gardens. Full documentation delivered.",
    tags: ["Residential", "Villa", "Completed"],
    teamMembers: ["Arun Ravikumar", "Jithin Thomas"],
    deliverables: [
      { id: "del-9",  name: "Master Site Plan",  assignedTo: "Arun Ravikumar", status: "Done", dueDate: "2024-05-01", hoursLogged: 35 },
      { id: "del-10", name: "Villa Floor Plans",  assignedTo: "Jithin Thomas",  status: "Done", dueDate: "2024-07-01", hoursLogged: 48 },
      { id: "del-11", name: "Landscape & Pool",   assignedTo: "Arun Ravikumar", status: "Done", dueDate: "2024-10-01", hoursLogged: 20 },
    ],
  },
];

// ─── Project dashboard status colours ─────────────────────────────────────────

export const STATUS_COLOR: Record<ProjectStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: "#e8f5e9", text: "#2e7d32", dot: "#43a047" },
  "On Hold": { bg: "#fff8e1", text: "#f57f17", dot: "#ffc107" },
  Completed: { bg: "#e3f2fd", text: "#1565c0", dot: "#42a5f5" },
  Cancelled: { bg: "#fce4ec", text: "#b71c1c", dot: "#ef5350" },
};

export const DELIVERABLE_STATUS_COLOR: Record<DeliverableStatus, { bg: string; text: string }> = {
  "Not Started": { bg: "#f5f5f5", text: "#757575" },
  "In Progress": { bg: "#fff3e0", text: "#e65100" },
  Review:        { bg: "#f3e5f5", text: "#6a1b9a" },
  Done:          { bg: "#e8f5e9", text: "#2e7d32" },
};

// ─── Hand-written real expenses (salary-calculator / expense-tracker page) ────
// Exported as `expenseRecords` to distinguish from the seeded `expenses` array.

export const expenseRecords: Expense[] = [
  // m6 (Arun) — proj-1 (Sunilkumar Residence)
  { id: "exp-1",  organisationId: "org-1", memberId: "m6", projectId: "proj-1", amount: 1800, category: "travel",        remarks: "Site visit cab fare",          date: "2025-01-08", createdAt: "2025-01-08T09:00:00Z", reimbursed: true  },
  { id: "exp-2",  organisationId: "org-1", memberId: "m6", projectId: "proj-1", amount:  650, category: "food",          remarks: "Client lunch meeting",         date: "2025-01-15", createdAt: "2025-01-15T14:00:00Z", reimbursed: true  },
  { id: "exp-3",  organisationId: "org-1", memberId: "m6", projectId: "proj-1", amount: 4200, category: "accommodation", remarks: "Overnight stay — site review",  date: "2025-02-05", createdAt: "2025-02-05T18:00:00Z", reimbursed: false },
  { id: "exp-4",  organisationId: "org-1", memberId: "m6", projectId: "proj-1", amount:  320, category: "stationery",    remarks: "Printing drawings A1",          date: "2025-02-12", createdAt: "2025-02-12T11:00:00Z", reimbursed: true  },
  { id: "exp-5",  organisationId: "org-1", memberId: "m6", projectId: "proj-1", amount:  950, category: "travel",        remarks: "Fuel — client meetings",        date: "2025-03-10", createdAt: "2025-03-10T10:00:00Z", reimbursed: false },
  { id: "exp-6",  organisationId: "org-1", memberId: "m6", projectId: "proj-1", amount: 2100, category: "others",        remarks: "Survey equipment rental",       date: "2025-03-18", createdAt: "2025-03-18T09:30:00Z", reimbursed: false },
  // m6 (Arun) — proj-3 (Greenfield Mall)
  { id: "exp-7",  organisationId: "org-3", memberId: "m6", projectId: "proj-3", amount: 5500, category: "travel",        remarks: "Flight — Greenfield site",      date: "2025-02-17", createdAt: "2025-02-17T06:00:00Z", reimbursed: true  },
  { id: "exp-8",  organisationId: "org-3", memberId: "m6", projectId: "proj-3", amount: 7800, category: "accommodation", remarks: "Hotel 2 nights",                date: "2025-02-17", createdAt: "2025-02-17T18:00:00Z", reimbursed: false },
  // m2 (Priya) — proj-2 (Test Office Block)
  { id: "exp-9",  organisationId: "org-2", memberId: "m2", projectId: "proj-2", amount: 1200, category: "travel",        remarks: "Train tickets — client visit",  date: "2025-01-10", createdAt: "2025-01-10T08:00:00Z", reimbursed: true  },
  { id: "exp-10", organisationId: "org-2", memberId: "m2", projectId: "proj-2", amount:  480, category: "food",          remarks: "Team lunch",                    date: "2025-01-20", createdAt: "2025-01-20T13:00:00Z", reimbursed: true  },
  { id: "exp-11", organisationId: "org-2", memberId: "m2", projectId: "proj-2", amount:  850, category: "stationery",    remarks: "Report printing & binding",     date: "2025-02-14", createdAt: "2025-02-14T10:00:00Z", reimbursed: false },
  { id: "exp-12", organisationId: "org-2", memberId: "m2", projectId: "proj-2", amount: 3600, category: "accommodation", remarks: "Client city hotel — 1 night",   date: "2025-03-05", createdAt: "2025-03-05T20:00:00Z", reimbursed: false },
  // m3 (Rohan) — proj-2 (Test Office Block)
  { id: "exp-13", organisationId: "org-2", memberId: "m3", projectId: "proj-2", amount:  760, category: "travel",        remarks: "Cab to structural lab",         date: "2025-01-12", createdAt: "2025-01-12T09:00:00Z", reimbursed: true  },
  { id: "exp-14", organisationId: "org-2", memberId: "m3", projectId: "proj-2", amount: 2400, category: "others",        remarks: "Soil testing fee",              date: "2025-01-22", createdAt: "2025-01-22T11:00:00Z", reimbursed: true  },
  { id: "exp-15", organisationId: "org-2", memberId: "m3", projectId: "proj-2", amount:  540, category: "food",          remarks: "Site team snacks",              date: "2025-03-12", createdAt: "2025-03-12T16:00:00Z", reimbursed: false },
  { id: "exp-16", organisationId: "org-2", memberId: "m3", projectId: "proj-2", amount: 1100, category: "stationery",    remarks: "Technical drawing supplies",    date: "2025-03-20", createdAt: "2025-03-20T09:00:00Z", reimbursed: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LOOKUP MAPS
// ═══════════════════════════════════════════════════════════════════════════════

export const orgMap    = Object.fromEntries(organisations.map(o => [o.id, o]));
export const projMap   = Object.fromEntries(projects.map(p => [p.id, p]));
export const delivMap  = Object.fromEntries(deliverables.map(d => [d.id, d]));
export const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

// Record-form lookup used by the seeded Entry generator below.
// Named `deliverablesByProjectMap` to avoid collision with the
// function `deliverablesByProject` used by the performance page.
export const deliverablesByProjectMap: Record<string, string[]> = {};
for (const d of deliverables) {
  (deliverablesByProjectMap[d.projectId] ??= []).push(d.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function getDeliverable(id: string)  { return delivMap[id]  ?? null; }
export function getProject(id: string)      { return projMap[id]   ?? null; }
export function getOrganisation(id: string) { return orgMap[id]    ?? null; }

export function getMyAssignments(userId = currentUser.id) {
  return assignments.filter(a => a.memberId === userId);
}
export function getMyQuickAccess(userId = currentUser.id) {
  return quickAccessItems.filter(q => q.userId === userId).sort((a, b) => a.position - b.position);
}
export function isQuickAccess(userId: string, deliverableId: string) {
  return quickAccessItems.some(q => q.userId === userId && q.deliverableId === deliverableId);
}

// Performance page helpers
export function projectsByOrg(orgId: string)             { return projects.filter(p => p.organisationId === orgId); }
export function deliverablesByProject(projectId: string) { return deliverables.filter(d => d.projectId === projectId); }
export function deliverablesByProjects(projectIds: string[]) {
  const set = new Set(projectIds); return deliverables.filter(d => set.has(d.projectId));
}
export function membersByOrg(orgId: string): PerformanceMember[] { return MEMBERS.filter(m => m.orgId === orgId); }
export function projectName(projectId: string)           { return projMap[projectId]?.name     ?? projectId;      }
export function deliverableName(deliverableId: string)   { return delivMap[deliverableId]?.name ?? deliverableId; }

export function maxOrgSkills(orgId: string) {
  const om = membersByOrg(orgId);
  return om.length === 0 ? 1 : Math.max(...om.map(m => m.skills.length), 1);
}
export function rawAvgSkillScore(member: PerformanceMember) {
  if (!member.skills.length) return 0;
  return Math.round(member.skills.reduce((a, s) => a + s.score, 0) / member.skills.length);
}
export function coverageFactor(member: PerformanceMember) {
  const max = maxOrgSkills(member.orgId); return max > 0 ? member.skills.length / max : 0;
}
export function weightedSkillScore(member: PerformanceMember) {
  return Math.round(rawAvgSkillScore(member) * coverageFactor(member));
}
export function assignmentEfficiency(assignments: PerformanceMember["assignments"]) {
  if (!assignments.length) return 0;
  const scores = assignments.map(a => {
    const due      = new Date(a.dueAt).getTime();
    const assigned = new Date(a.assignedAt).getTime();
    const done     = a.completedAt ? new Date(a.completedAt).getTime() : null;
    const win      = due - assigned;
    if (!done || win <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((2 - (done - assigned) / win) * 50)));
  });
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}

// Salary calculator helper
export function minutesPerMember(entries: WorklogEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    map[e.memberId] = (map[e.memberId] ?? 0) + (eh * 60 + em - (sh * 60 + sm));
  }
  return map;
}

// Project dashboard helpers
export function searchProjects(query: string): ProjectDetail[] {
  const q = query.toLowerCase().trim();
  if (!q) return projectDetails;
  return projectDetails.filter(p =>
    p.name.toLowerCase().includes(q)         ||
    p.organisation.toLowerCase().includes(q) ||
    p.client.name.toLowerCase().includes(q)  ||
    p.client.location.toLowerCase().includes(q) ||
    p.status.toLowerCase().includes(q)       ||
    p.tags.some(t => t.toLowerCase().includes(q))
  );
}

export function formatINR(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDED GENERATED DATA  (finance component — uses finance projects p1–p4)
// ═══════════════════════════════════════════════════════════════════════════════

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// Revenue/spend entries
export const entries: Entry[] = (() => {
  const result: Entry[] = [];
  const rng   = mulberry32(0xdeadbeef);
  const pIds  = ["p1", "p2", "p3", "p4"];
  const mIds  = ["m1", "m2", "m3", "m4", "m5"];
  let idx = 0;
  for (let year = 2024; year <= 2026; year++) {
    const lastMonth = year === 2026 ? 3 : 12;
    for (let month = 1; month <= lastMonth; month++) {
      const days  = new Date(year, month, 0).getDate();
      const count = 15 + Math.floor(rng() * 11);
      for (let i = 0; i < count; i++) {
        const day     = 1 + Math.floor(rng() * days);
        const pId     = pIds[Math.floor(rng() * pIds.length)];
        const dList   = deliverablesByProjectMap[pId];
        const dId     = dList[Math.floor(rng() * dList.length)];
        const mId     = mIds[Math.floor(rng() * mIds.length)];
        const revenue = Math.round(rng() * 45_000 + 5_000);
        const spend   = Math.round(rng() * revenue * 0.7 + 1_000);
        result.push({
          id: `e${idx++}`,
          date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          projectId: pId, deliverableId: dId, memberId: mId, revenue, spend,
        });
      }
    }
  }
  return result;
})();

// Seeded salary + misc expenses (finance component)
const REMARKS_MAP: Record<ExpenseCategory, string[]> = {
  salary:        ["Monthly salary", "Salary advance", "Performance bonus", "Contract payment"],
  travel:        ["Site visit – Meridian Tower", "Client meeting travel", "Field survey transport", "Airport transfer"],
  food:          ["Team lunch", "Client dinner", "Working meal – deadline sprint", "Catering for presentation"],
  accommodation: ["Hotel – site inspection", "Overnight stay – outstation project", "Service apartment – long-term project"],
  stationery:    ["A3 printing – drawing sheets", "Marker set & trace paper", "Binding & lamination", "Plotter consumables"],
  others:        ["Software licence renewal", "Courier – document dispatch", "Utilities – site office", "Miscellaneous project expense"],
};

const MEMBER_SALARY: Record<string, number> = {
  m1: 95_000, m2: 82_000, m3: 88_000, m4: 78_000, m5: 91_000, m6: 98_000,
};

export const expenses: Expense[] = (() => {
  const result: Expense[] = [];
  const rng  = mulberry32(0xcafebabe);
  const pIds = ["p1", "p2", "p3", "p4"];
  const mIds = ["m1", "m2", "m3", "m4", "m5", "m6"];
  const nonSalaryCats: ExpenseCategory[] = ["travel", "food", "accommodation", "stationery", "others"];
  let idx = 0;
  for (let year = 2024; year <= 2026; year++) {
    const lastMonth = year === 2026 ? 3 : 12;
    for (let month = 1; month <= lastMonth; month++) {
      const days = new Date(year, month, 0).getDate();
      const ds   = (day: number) =>
        `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      for (const mId of mIds) {
        result.push({
          id: `exp${idx++}`, organisationId: "org1", memberId: mId,
          projectId: pIds[Math.floor(rng() * pIds.length)],
          amount: MEMBER_SALARY[mId], category: "salary", remarks: "Monthly salary",
          date: ds(1), createdAt: `${ds(1)}T09:00:00`, reimbursed: true,
        });
      }
      const count = 7 + Math.floor(rng() * 7);
      for (let i = 0; i < count; i++) {
        const day        = 1 + Math.floor(rng() * days);
        const cat        = nonSalaryCats[Math.floor(rng() * nonSalaryCats.length)];
        const mId        = mIds[Math.floor(rng() * mIds.length)];
        const pId        = pIds[Math.floor(rng() * pIds.length)];
        const amount     = Math.round(rng() * 8_000 + 200);
        const remarks    = REMARKS_MAP[cat][Math.floor(rng() * REMARKS_MAP[cat].length)];
        const reimbursed = rng() < 0.62;
        result.push({
          id: `exp${idx++}`, organisationId: "org1", memberId: mId, projectId: pId,
          amount, category: cat, remarks, reimbursed,
          date: ds(day),
          createdAt: `${ds(day)}T${String(Math.floor(rng() * 22 + 1)).padStart(2, "0")}:${String(Math.floor(rng() * 59)).padStart(2, "0")}:00`,
        });
      }
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
})();