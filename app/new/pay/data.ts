// data.ts — single source of truth for all pages

// ─── Core types ───────────────────────────────────────────────────────────────

export interface Organisation { id: string; name: string; }
export interface Project { id: string; organisationId: string; name: string; color: string; }
export interface Deliverable {
  id: string; projectId: string; organisationId: string; name: string;
  stage: "1"|"2"|"3"|"4"|"5";
  status: "not_started"|"ongoing"|"ready"|"passed"|"failed"|"discrepancy";
}
export interface Member { id: string; name: string; role: string; }
export interface Assignment { id: string; deliverableId: string; memberId: string; startDate: string; dueDate: string; }
export interface QuickAccess { id: string; userId: string; deliverableId: string; position: number; }
export interface WorklogEntry {
  id: string; organisationId: string; projectId: string; deliverableId: string;
  memberId: string; date: string; startTime: string; endTime: string; notes?: string;
}
export interface User { id: string; name: string; }

// ─── Expense — mirrors the Django Expense model ────────────────────────────────
// category matches CATEGORY_CHOICES from the model.
// reimbursed: true = company has already paid back; false = still pending.

export type ExpenseCategory = "travel" | "food" | "accommodation" | "stationery" | "others";

export interface Expense {
  id: string;
  organisationId: string;   // denormalised for fast filtering (not on Django model, inferred from project)
  memberId: string;         // maps to User FK
  projectId: string;        // maps to Project FK
  amount: number;           // maps to DecimalField amount
  category: ExpenseCategory;
  remarks: string;          // maps to TextField remarks (blank=True, null=True)
  date: string;             // YYYY-MM-DD — maps to DateField date
  createdAt: string;        // ISO datetime — maps to DateTimeField created_at
  reimbursed: boolean;      // true = reimbursed; false = reimbursable/pending
}

// ─── Current user ──────────────────────────────────────────────────────────────
export const currentUser: User = { id: "user-1", name: "Arun Ravikumar" };

// ─── Organisations ─────────────────────────────────────────────────────────────
export const organisations: Organisation[] = [
  { id: "org-1", name: "Sunilkumar Associates" },
  { id: "org-2", name: "Test Corp" },
  { id: "org-3", name: "Greenfield Ltd" },
];

// ─── Projects ──────────────────────────────────────────────────────────────────
export const projects: Project[] = [
  { id: "proj-1", organisationId: "org-1", name: "Sunilkumar Residence", color: "#6366f1" },
  { id: "proj-2", organisationId: "org-2", name: "Test Office Block",    color: "#f59e0b" },
  { id: "proj-3", organisationId: "org-3", name: "Greenfield Mall",      color: "#10b981" },
];

// ─── Deliverables ──────────────────────────────────────────────────────────────
export const deliverables: Deliverable[] = [
  { id: "del-1", projectId: "proj-1", organisationId: "org-1", name: "Floor Plan",        stage: "1", status: "not_started" },
  { id: "del-2", projectId: "proj-1", organisationId: "org-1", name: "Elevation Drawing", stage: "1", status: "not_started" },
  { id: "del-3", projectId: "proj-2", organisationId: "org-2", name: "Site Layout",       stage: "2", status: "not_started" },
  { id: "del-4", projectId: "proj-2", organisationId: "org-2", name: "Structural Report", stage: "2", status: "not_started" },
  { id: "del-5", projectId: "proj-3", organisationId: "org-3", name: "3D Render",         stage: "3", status: "not_started" },
];

// ─── Members ───────────────────────────────────────────────────────────────────
export const members: Member[] = [
  { id: "user-1", name: "Arun Ravikumar",  role: "Lead Architect"  },
  { id: "user-2", name: "Priya Menon",     role: "Project Manager" },
  { id: "user-3", name: "Rohan Das",       role: "Structural Eng." },
];

// ─── Assignments ───────────────────────────────────────────────────────────────
export const assignments: Assignment[] = [
  { id: "asgn-1", deliverableId: "del-1", memberId: "user-1", startDate: "2025-03-20", dueDate: "2025-03-28" },
  { id: "asgn-2", deliverableId: "del-4", memberId: "user-1", startDate: "2025-03-22", dueDate: "2025-04-01" },
];

// ─── Quick Access ──────────────────────────────────────────────────────────────
export let quickAccessItems: QuickAccess[] = [
  { id: "qa-1", userId: "user-1", deliverableId: "del-5", position: 0 },
  { id: "qa-2", userId: "user-1", deliverableId: "del-2", position: 1 },
];
export function addQuickAccess(userId: string, deliverableId: string): void {
  if (quickAccessItems.some(q => q.userId === userId && q.deliverableId === deliverableId)) return;
  const maxPos = quickAccessItems.filter(q => q.userId === userId).reduce((m, q) => Math.max(m, q.position), -1);
  quickAccessItems = [...quickAccessItems, { id: `qa-${Date.now()}`, userId, deliverableId, position: maxPos + 1 }];
}
export function removeQuickAccess(userId: string, deliverableId: string): void {
  quickAccessItems = quickAccessItems.filter(q => !(q.userId === userId && q.deliverableId === deliverableId));
}

// ─── Worklog entries ───────────────────────────────────────────────────────────
export const worklogEntries: WorklogEntry[] = [
  { id: "wl-1",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-1", memberId: "user-1", date: "2025-01-06", startTime: "09:00", endTime: "12:30" },
  { id: "wl-2",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-2", memberId: "user-1", date: "2025-01-07", startTime: "10:00", endTime: "13:00" },
  { id: "wl-3",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-3", memberId: "user-2", date: "2025-01-08", startTime: "14:00", endTime: "17:30" },
  { id: "wl-4",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-4", memberId: "user-3", date: "2025-01-10", startTime: "08:30", endTime: "11:30" },
  { id: "wl-5",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-1", memberId: "user-1", date: "2025-02-03", startTime: "09:00", endTime: "12:00" },
  { id: "wl-6",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-3", memberId: "user-2", date: "2025-02-11", startTime: "08:00", endTime: "10:30" },
  { id: "wl-7",  organisationId: "org-3", projectId: "proj-3", deliverableId: "del-5", memberId: "user-1", date: "2025-02-17", startTime: "10:00", endTime: "12:30" },
  { id: "wl-8",  organisationId: "org-1", projectId: "proj-1", deliverableId: "del-2", memberId: "user-1", date: "2025-03-10", startTime: "13:00", endTime: "17:30" },
  { id: "wl-9",  organisationId: "org-2", projectId: "proj-2", deliverableId: "del-4", memberId: "user-3", date: "2025-03-11", startTime: "09:00", endTime: "11:30" },
  { id: "wl-10", organisationId: "org-3", projectId: "proj-3", deliverableId: "del-5", memberId: "user-1", date: "2025-03-18", startTime: "13:00", endTime: "15:30" },
  { id: "wl-11", organisationId: "org-1", projectId: "proj-1", deliverableId: "del-1", memberId: "user-1", date: "2025-03-21", startTime: "09:00", endTime: "12:00" },
];

// ─── Lookup maps ───────────────────────────────────────────────────────────────
export const orgMap    = Object.fromEntries(organisations.map(o => [o.id, o]));
export const projMap   = Object.fromEntries(projects.map(p => [p.id, p]));
export const delivMap  = Object.fromEntries(deliverables.map(d => [d.id, d]));
export const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

// ─── Query helpers ─────────────────────────────────────────────────────────────
export function getMyAssignments(userId = currentUser.id) { return assignments.filter(a => a.memberId === userId); }
export function getMyQuickAccess(userId = currentUser.id) {
  return quickAccessItems.filter(q => q.userId === userId).sort((a, b) => a.position - b.position);
}
export function isQuickAccess(userId: string, deliverableId: string) {
  return quickAccessItems.some(q => q.userId === userId && q.deliverableId === deliverableId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALARY CALCULATOR DATA
// ═══════════════════════════════════════════════════════════════════════════════

export interface MemberRate { memberId: string; hourlyRate: number; }

export interface ProjectFee { projectId: string; totalFee: number; }

export interface StageFee {
  id: string; projectId: string; stage: "1"|"2"|"3"|"4"|"5"; label: string; fee: number;
}

export interface FundAllocation {
  id: string; projectId: string; label: string;
  memberId?: string; percentage: number; color?: string;
}

// ─── Member hourly rates ───────────────────────────────────────────────────────
export const memberRates: MemberRate[] = [
  { memberId: "user-1", hourlyRate: 1500 },
  { memberId: "user-2", hourlyRate: 1200 },
  { memberId: "user-3", hourlyRate: 900  },
];

// ─── Project total fees ────────────────────────────────────────────────────────
export const projectFees: ProjectFee[] = [
  { projectId: "proj-1", totalFee: 1200000 },
  { projectId: "proj-2", totalFee: 850000  },
  { projectId: "proj-3", totalFee: 2500000 },
];

// ─── Stage fees ────────────────────────────────────────────────────────────────
export const stageFees: StageFee[] = [
  { id:"sf-1-1", projectId:"proj-1", stage:"1", label:"Concept & Schematic",    fee: 240000 },
  { id:"sf-1-2", projectId:"proj-1", stage:"2", label:"Design Development",     fee: 300000 },
  { id:"sf-1-3", projectId:"proj-1", stage:"3", label:"Construction Documents", fee: 360000 },
  { id:"sf-1-4", projectId:"proj-1", stage:"4", label:"Tender & Procurement",   fee: 180000 },
  { id:"sf-1-5", projectId:"proj-1", stage:"5", label:"Site Supervision",       fee: 120000 },
  { id:"sf-2-1", projectId:"proj-2", stage:"1", label:"Concept & Schematic",    fee: 127500 },
  { id:"sf-2-2", projectId:"proj-2", stage:"2", label:"Design Development",     fee: 212500 },
  { id:"sf-2-3", projectId:"proj-2", stage:"3", label:"Construction Documents", fee: 255000 },
  { id:"sf-2-4", projectId:"proj-2", stage:"4", label:"Tender & Procurement",   fee: 127500 },
  { id:"sf-2-5", projectId:"proj-2", stage:"5", label:"Site Supervision",       fee: 127500 },
  { id:"sf-3-1", projectId:"proj-3", stage:"1", label:"Concept & Schematic",    fee: 500000 },
  { id:"sf-3-2", projectId:"proj-3", stage:"2", label:"Design Development",     fee: 625000 },
  { id:"sf-3-3", projectId:"proj-3", stage:"3", label:"Construction Documents", fee: 750000 },
  { id:"sf-3-4", projectId:"proj-3", stage:"4", label:"Tender & Procurement",   fee: 375000 },
  { id:"sf-3-5", projectId:"proj-3", stage:"5", label:"Site Supervision",       fee: 250000 },
];

// ─── Fund allocations ──────────────────────────────────────────────────────────
export const fundAllocations: FundAllocation[] = [
  { id:"fa-1-1", projectId:"proj-1", label:"Company Expenses", percentage:30, color:"#6366f1" },
  { id:"fa-1-2", projectId:"proj-1", label:"CEO",              percentage:30, color:"#f59e0b" },
  { id:"fa-1-3", projectId:"proj-1", label:"Arun Ravikumar",   percentage:25, color:"#10b981", memberId:"user-1" },
  { id:"fa-1-4", projectId:"proj-1", label:"Savings Fund",     percentage:15, color:"#06b6d4" },
  { id:"fa-2-1", projectId:"proj-2", label:"Company Expenses", percentage:30, color:"#6366f1" },
  { id:"fa-2-2", projectId:"proj-2", label:"CEO",              percentage:25, color:"#f59e0b" },
  { id:"fa-2-3", projectId:"proj-2", label:"Priya Menon",      percentage:20, color:"#10b981", memberId:"user-2" },
  { id:"fa-2-4", projectId:"proj-2", label:"Rohan Das",        percentage:15, color:"#818cf8", memberId:"user-3" },
  { id:"fa-2-5", projectId:"proj-2", label:"Savings Fund",     percentage:10, color:"#06b6d4" },
  { id:"fa-3-1", projectId:"proj-3", label:"Company Expenses", percentage:30, color:"#6366f1" },
  { id:"fa-3-2", projectId:"proj-3", label:"CEO",              percentage:30, color:"#f59e0b" },
  { id:"fa-3-3", projectId:"proj-3", label:"Arun Ravikumar",   percentage:20, color:"#10b981", memberId:"user-1" },
  { id:"fa-3-4", projectId:"proj-3", label:"Savings Fund",     percentage:10, color:"#06b6d4" },
  { id:"fa-3-5", projectId:"proj-3", label:"Priya Menon",      percentage:10, color:"#818cf8", memberId:"user-2" },
];

// ─── Expenses ──────────────────────────────────────────────────────────────────
// Mirrors the Django Expense model with the added `reimbursed` boolean field.
export const expenses: Expense[] = [
  // Arun — proj-1 (Sunilkumar Residence)
  { id:"exp-1",  organisationId:"org-1", memberId:"user-1", projectId:"proj-1", amount:1800,  category:"travel",        remarks:"Site visit cab fare",          date:"2025-01-08", createdAt:"2025-01-08T09:00:00Z", reimbursed:true  },
  { id:"exp-2",  organisationId:"org-1", memberId:"user-1", projectId:"proj-1", amount:650,   category:"food",          remarks:"Client lunch meeting",         date:"2025-01-15", createdAt:"2025-01-15T14:00:00Z", reimbursed:true  },
  { id:"exp-3",  organisationId:"org-1", memberId:"user-1", projectId:"proj-1", amount:4200,  category:"accommodation", remarks:"Overnight stay — site review",  date:"2025-02-05", createdAt:"2025-02-05T18:00:00Z", reimbursed:false },
  { id:"exp-4",  organisationId:"org-1", memberId:"user-1", projectId:"proj-1", amount:320,   category:"stationery",   remarks:"Printing drawings A1",         date:"2025-02-12", createdAt:"2025-02-12T11:00:00Z", reimbursed:true  },
  { id:"exp-5",  organisationId:"org-1", memberId:"user-1", projectId:"proj-1", amount:950,   category:"travel",        remarks:"Fuel — client meetings",        date:"2025-03-10", createdAt:"2025-03-10T10:00:00Z", reimbursed:false },
  { id:"exp-6",  organisationId:"org-1", memberId:"user-1", projectId:"proj-1", amount:2100,  category:"others",        remarks:"Survey equipment rental",      date:"2025-03-18", createdAt:"2025-03-18T09:30:00Z", reimbursed:false },

  // Arun — proj-3 (Greenfield Mall)
  { id:"exp-7",  organisationId:"org-3", memberId:"user-1", projectId:"proj-3", amount:5500,  category:"travel",        remarks:"Flight — Greenfield site",     date:"2025-02-17", createdAt:"2025-02-17T06:00:00Z", reimbursed:true  },
  { id:"exp-8",  organisationId:"org-3", memberId:"user-1", projectId:"proj-3", amount:7800,  category:"accommodation", remarks:"Hotel 2 nights",               date:"2025-02-17", createdAt:"2025-02-17T18:00:00Z", reimbursed:false },

  // Priya — proj-2 (Test Office Block)
  { id:"exp-9",  organisationId:"org-2", memberId:"user-2", projectId:"proj-2", amount:1200,  category:"travel",        remarks:"Train tickets — client visit",  date:"2025-01-10", createdAt:"2025-01-10T08:00:00Z", reimbursed:true  },
  { id:"exp-10", organisationId:"org-2", memberId:"user-2", projectId:"proj-2", amount:480,   category:"food",          remarks:"Team lunch",                   date:"2025-01-20", createdAt:"2025-01-20T13:00:00Z", reimbursed:true  },
  { id:"exp-11", organisationId:"org-2", memberId:"user-2", projectId:"proj-2", amount:850,   category:"stationery",   remarks:"Report printing & binding",    date:"2025-02-14", createdAt:"2025-02-14T10:00:00Z", reimbursed:false },
  { id:"exp-12", organisationId:"org-2", memberId:"user-2", projectId:"proj-2", amount:3600,  category:"accommodation", remarks:"Client city hotel — 1 night",  date:"2025-03-05", createdAt:"2025-03-05T20:00:00Z", reimbursed:false },

  // Rohan — proj-2 (Test Office Block)
  { id:"exp-13", organisationId:"org-2", memberId:"user-3", projectId:"proj-2", amount:760,   category:"travel",        remarks:"Cab to structural lab",        date:"2025-01-12", createdAt:"2025-01-12T09:00:00Z", reimbursed:true  },
  { id:"exp-14", organisationId:"org-2", memberId:"user-3", projectId:"proj-2", amount:2400,  category:"others",        remarks:"Soil testing fee",             date:"2025-01-22", createdAt:"2025-01-22T11:00:00Z", reimbursed:true  },
  { id:"exp-15", organisationId:"org-2", memberId:"user-3", projectId:"proj-2", amount:540,   category:"food",          remarks:"Site team snacks",             date:"2025-03-12", createdAt:"2025-03-12T16:00:00Z", reimbursed:false },
  { id:"exp-16", organisationId:"org-2", memberId:"user-3", projectId:"proj-2", amount:1100,  category:"stationery",   remarks:"Technical drawing supplies",   date:"2025-03-20", createdAt:"2025-03-20T09:00:00Z", reimbursed:false },
];

// ─── Salary helper ─────────────────────────────────────────────────────────────
export function minutesPerMember(entries: WorklogEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    map[e.memberId] = (map[e.memberId] ?? 0) + (eh * 60 + em - (sh * 60 + sm));
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE PAGE EXTENSIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type RemarkLevel = "Excellent" | "Good" | "Average" | "Needs Improvement";
export interface PerformanceMember {
  id: string; name: string; role: string; orgId: string; avatar: string;
  skills: { name: string; score: number; remark: RemarkLevel }[];
  assignments: {
    id: string; title: string; projectId: string; deliverableId: string;
    assignedAt: string; dueAt: string; completedAt?: string;
    status: "Completed" | "In Progress" | "Overdue";
  }[];
}
export const ORGANISATIONS = organisations;
export const MEMBERS: PerformanceMember[] = [
  {
    id:"user-1", name:"Arun Ravikumar", role:"Lead Architect", orgId:"org-1", avatar:"AR",
    skills:[
      { name:"Architectural Design",    score:92, remark:"Excellent" },
      { name:"AutoCAD",                 score:88, remark:"Excellent" },
      { name:"BIM Modelling",           score:75, remark:"Good"      },
      { name:"Structural Coordination", score:68, remark:"Average"   },
      { name:"Client Presentation",     score:80, remark:"Good"      },
    ],
    assignments:[
      { id:"pa-1", title:"Floor Plan — Sunilkumar Residence",       projectId:"proj-1", deliverableId:"del-1", assignedAt:"2025-03-20", dueAt:"2025-03-28", completedAt:"2025-03-26", status:"Completed"   },
      { id:"pa-2", title:"Elevation Drawing — Sunilkumar Residence", projectId:"proj-1", deliverableId:"del-2", assignedAt:"2025-03-22", dueAt:"2025-04-05", status:"In Progress" },
      { id:"pa-3", title:"3D Render — Greenfield Mall",              projectId:"proj-3", deliverableId:"del-5", assignedAt:"2025-02-10", dueAt:"2025-02-28", completedAt:"2025-03-05", status:"Overdue"     },
    ],
  },
  {
    id:"user-2", name:"Priya Menon", role:"Project Manager", orgId:"org-1", avatar:"PM",
    skills:[
      { name:"Project Scheduling", score:90, remark:"Excellent"         },
      { name:"Risk Management",    score:74, remark:"Good"              },
      { name:"Stakeholder Comms",  score:85, remark:"Excellent"         },
      { name:"Budget Control",     score:60, remark:"Average"           },
      { name:"AutoCAD",            score:38, remark:"Needs Improvement" },
    ],
    assignments:[
      { id:"pa-4", title:"Site Layout — Test Office Block",              projectId:"proj-2", deliverableId:"del-3", assignedAt:"2025-01-08", dueAt:"2025-01-20", completedAt:"2025-01-18", status:"Completed" },
      { id:"pa-5", title:"Structural Report Review — Test Office Block", projectId:"proj-2", deliverableId:"del-4", assignedAt:"2025-03-01", dueAt:"2025-03-15", completedAt:"2025-03-20", status:"Overdue"   },
    ],
  },
  {
    id:"user-3", name:"Rohan Das", role:"Structural Eng.", orgId:"org-2", avatar:"RD",
    skills:[
      { name:"Structural Analysis", score:95, remark:"Excellent"         },
      { name:"STAAD.Pro",           score:88, remark:"Excellent"         },
      { name:"Concrete Design",     score:82, remark:"Good"              },
      { name:"Foundation Design",   score:70, remark:"Good"              },
      { name:"Technical Reporting", score:55, remark:"Average"           },
      { name:"Client Presentation", score:42, remark:"Needs Improvement" },
    ],
    assignments:[
      { id:"pa-6", title:"Structural Report — Test Office Block",   projectId:"proj-2", deliverableId:"del-4", assignedAt:"2025-01-10", dueAt:"2025-01-25", completedAt:"2025-01-24", status:"Completed"   },
      { id:"pa-7", title:"Foundation Analysis — Test Office Block", projectId:"proj-2", deliverableId:"del-4", assignedAt:"2025-03-11", dueAt:"2025-03-25", status:"In Progress" },
    ],
  },
];
export function projectsByOrg(orgId: string) { return projects.filter(p => p.organisationId === orgId); }
export function deliverablesByProject(projectId: string) { return deliverables.filter(d => d.projectId === projectId); }
export function deliverablesByProjects(projectIds: string[]) {
  const set = new Set(projectIds); return deliverables.filter(d => set.has(d.projectId));
}
export function membersByOrg(orgId: string): PerformanceMember[] { return MEMBERS.filter(m => m.orgId === orgId); }
export function projectName(projectId: string) { return projMap[projectId]?.name ?? projectId; }
export function deliverableName(deliverableId: string) { return delivMap[deliverableId]?.name ?? deliverableId; }
export function maxOrgSkills(orgId: string) {
  const om = membersByOrg(orgId); return om.length === 0 ? 1 : Math.max(...om.map(m => m.skills.length), 1);
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
    const due = new Date(a.dueAt).getTime(), assigned = new Date(a.assignedAt).getTime();
    const done = a.completedAt ? new Date(a.completedAt).getTime() : null;
    const win = due - assigned;
    if (!done || win <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((2 - (done - assigned) / win) * 50)));
  });
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}