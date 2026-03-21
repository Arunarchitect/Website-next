// data.ts — single source of truth for dashboard + worklog + performance + salary pages

// ─── Core entity types ────────────────────────────────────────────────────────

export interface Organisation {
  id: string;
  name: string;
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
  organisationId: string; // denormalised for fast lookup
  name: string;
  stage: "1" | "2" | "3" | "4" | "5";
  status: "not_started" | "ongoing" | "ready" | "passed" | "failed" | "discrepancy";
}

export interface Member {
  id: string;
  name: string;
  role: string;
}

// ─── Assignment: deliverable assigned to a member ─────────────────────────────

export interface Assignment {
  id: string;
  deliverableId: string;
  memberId: string;
  startDate: string; // "YYYY-MM-DD"
  dueDate: string;   // "YYYY-MM-DD"
}

// ─── QuickAccess: per-user pinned deliverables ────────────────────────────────

export interface QuickAccess {
  id: string;
  userId: string;
  deliverableId: string;
  position: number;
}

// ─── WorklogEntry: a completed or open work session ──────────────────────────

export interface WorklogEntry {
  id: string;
  organisationId: string;
  projectId: string;
  deliverableId: string;
  memberId: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  notes?: string;
}

// ─── Current user ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
}

export const currentUser: User = {
  id: "user-1",
  name: "Arun Ravikumar",
};

// ─── Organisations ────────────────────────────────────────────────────────────

export const organisations: Organisation[] = [
  { id: "org-1", name: "Sunilkumar Associates" },
  { id: "org-2", name: "Test Corp" },
  { id: "org-3", name: "Greenfield Ltd" },
];

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects: Project[] = [
  { id: "proj-1", organisationId: "org-1", name: "Sunilkumar Residence", color: "#6366f1" },
  { id: "proj-2", organisationId: "org-2", name: "Test Office Block",    color: "#f59e0b" },
  { id: "proj-3", organisationId: "org-3", name: "Greenfield Mall",      color: "#10b981" },
];

// ─── Deliverables ─────────────────────────────────────────────────────────────

export const deliverables: Deliverable[] = [
  { id: "del-1", projectId: "proj-1", organisationId: "org-1", name: "Floor Plan",        stage: "1", status: "not_started" },
  { id: "del-2", projectId: "proj-1", organisationId: "org-1", name: "Elevation Drawing", stage: "1", status: "not_started" },
  { id: "del-3", projectId: "proj-2", organisationId: "org-2", name: "Site Layout",       stage: "2", status: "not_started" },
  { id: "del-4", projectId: "proj-2", organisationId: "org-2", name: "Structural Report", stage: "2", status: "not_started" },
  { id: "del-5", projectId: "proj-3", organisationId: "org-3", name: "3D Render",         stage: "3", status: "not_started" },
];

// ─── Members ──────────────────────────────────────────────────────────────────

export const members: Member[] = [
  { id: "user-1", name: "Arun Ravikumar",  role: "Lead Architect"  },
  { id: "user-2", name: "Priya Menon",     role: "Project Manager" },
  { id: "user-3", name: "Rohan Das",       role: "Structural Eng." },
];

// ─── Assignments ──────────────────────────────────────────────────────────────

export const assignments: Assignment[] = [
  { id: "asgn-1", deliverableId: "del-1", memberId: "user-1", startDate: "2025-03-20", dueDate: "2025-03-28" },
  { id: "asgn-2", deliverableId: "del-4", memberId: "user-1", startDate: "2025-03-22", dueDate: "2025-04-01" },
];

// ─── Quick Access ─────────────────────────────────────────────────────────────

export let quickAccessItems: QuickAccess[] = [
  { id: "qa-1", userId: "user-1", deliverableId: "del-5", position: 0 },
  { id: "qa-2", userId: "user-1", deliverableId: "del-2", position: 1 },
];

// Mutators used by the worklog page (replace with API calls in production)
export function addQuickAccess(userId: string, deliverableId: string): void {
  if (quickAccessItems.some(q => q.userId === userId && q.deliverableId === deliverableId)) return;
  const maxPos = quickAccessItems.filter(q => q.userId === userId)
    .reduce((m, q) => Math.max(m, q.position), -1);
  quickAccessItems = [
    ...quickAccessItems,
    { id: `qa-${Date.now()}`, userId, deliverableId, position: maxPos + 1 },
  ];
}

export function removeQuickAccess(userId: string, deliverableId: string): void {
  quickAccessItems = quickAccessItems.filter(
    q => !(q.userId === userId && q.deliverableId === deliverableId)
  );
}

// ─── Worklog entries ──────────────────────────────────────────────────────────

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

// ─── Lookup maps ──────────────────────────────────────────────────────────────

export const orgMap      = Object.fromEntries(organisations.map(o => [o.id, o]));
export const projMap     = Object.fromEntries(projects.map(p => [p.id, p]));
export const delivMap    = Object.fromEntries(deliverables.map(d => [d.id, d]));
export const memberMap   = Object.fromEntries(members.map(m => [m.id, m]));

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getMyAssignments(userId = currentUser.id) {
  return assignments.filter(a => a.memberId === userId);
}

export function getMyQuickAccess(userId = currentUser.id) {
  return quickAccessItems
    .filter(q => q.userId === userId)
    .sort((a, b) => a.position - b.position);
}

export function isQuickAccess(userId: string, deliverableId: string) {
  return quickAccessItems.some(q => q.userId === userId && q.deliverableId === deliverableId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALARY CALCULATOR EXTENSIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Per-member compensation rates.
 *  hourlyRate      — amount paid per hour of logged work (used in Hourly mode)
 *  feePercentage   — share of total project fee paid to this member, 0–100 (used in % of Fee mode)
 */
export interface MemberRate {
  memberId: string;
  hourlyRate: number;    // ₹ per hour
  feePercentage: number; // % of total project fee (0–100)
}

/**
 * Agreed total fee for a project.
 * Used as the base for percentage-of-fee calculations.
 */
export interface ProjectFee {
  projectId: string;
  totalFee: number; // ₹
}

// ─── Default rates (editable in the UI, these are seed values) ────────────────

export const memberRates: MemberRate[] = [
  { memberId: "user-1", hourlyRate: 1500, feePercentage: 40 },
  { memberId: "user-2", hourlyRate: 1200, feePercentage: 35 },
  { memberId: "user-3", hourlyRate: 900,  feePercentage: 25 },
];

// ─── Default project fees ─────────────────────────────────────────────────────

export const projectFees: ProjectFee[] = [
  { projectId: "proj-1", totalFee: 1200000 },
  { projectId: "proj-2", totalFee: 850000  },
  { projectId: "proj-3", totalFee: 2500000 },
];

// ─── Salary helper: compute minutes logged per member for a set of entries ────

export function minutesPerMember(entries: WorklogEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of entries) {
    const [sh, sm] = e.startTime.split(":").map(Number);
    const [eh, em] = e.endTime.split(":").map(Number);
    const mins = eh * 60 + em - (sh * 60 + sm);
    map[e.memberId] = (map[e.memberId] ?? 0) + mins;
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE PAGE EXTENSIONS  (additive — used only by performance.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

export type RemarkLevel = "Excellent" | "Good" | "Average" | "Needs Improvement";

export interface PerformanceMember {
  id: string;
  name: string;
  role: string;
  orgId: string;
  avatar: string;
  skills: { name: string; score: number; remark: RemarkLevel; }[];
  assignments: {
    id: string; title: string; projectId: string; deliverableId: string;
    assignedAt: string; dueAt: string; completedAt?: string;
    status: "Completed" | "In Progress" | "Overdue";
  }[];
}

export const ORGANISATIONS = organisations;

export const MEMBERS: PerformanceMember[] = [
  {
    id: "user-1", name: "Arun Ravikumar", role: "Lead Architect", orgId: "org-1", avatar: "AR",
    skills: [
      { name: "Architectural Design",    score: 92, remark: "Excellent" },
      { name: "AutoCAD",                 score: 88, remark: "Excellent" },
      { name: "BIM Modelling",           score: 75, remark: "Good"      },
      { name: "Structural Coordination", score: 68, remark: "Average"   },
      { name: "Client Presentation",     score: 80, remark: "Good"      },
    ],
    assignments: [
      { id: "pa-1", title: "Floor Plan — Sunilkumar Residence",   projectId: "proj-1", deliverableId: "del-1", assignedAt: "2025-03-20", dueAt: "2025-03-28", completedAt: "2025-03-26", status: "Completed"   },
      { id: "pa-2", title: "Elevation Drawing — Sunilkumar Residence", projectId: "proj-1", deliverableId: "del-2", assignedAt: "2025-03-22", dueAt: "2025-04-05", status: "In Progress" },
      { id: "pa-3", title: "3D Render — Greenfield Mall",          projectId: "proj-3", deliverableId: "del-5", assignedAt: "2025-02-10", dueAt: "2025-02-28", completedAt: "2025-03-05", status: "Overdue"     },
    ],
  },
  {
    id: "user-2", name: "Priya Menon", role: "Project Manager", orgId: "org-1", avatar: "PM",
    skills: [
      { name: "Project Scheduling", score: 90, remark: "Excellent"         },
      { name: "Risk Management",    score: 74, remark: "Good"              },
      { name: "Stakeholder Comms",  score: 85, remark: "Excellent"         },
      { name: "Budget Control",     score: 60, remark: "Average"           },
      { name: "AutoCAD",            score: 38, remark: "Needs Improvement" },
    ],
    assignments: [
      { id: "pa-4", title: "Site Layout — Test Office Block",           projectId: "proj-2", deliverableId: "del-3", assignedAt: "2025-01-08", dueAt: "2025-01-20", completedAt: "2025-01-18", status: "Completed" },
      { id: "pa-5", title: "Structural Report Review — Test Office Block", projectId: "proj-2", deliverableId: "del-4", assignedAt: "2025-03-01", dueAt: "2025-03-15", completedAt: "2025-03-20", status: "Overdue" },
    ],
  },
  {
    id: "user-3", name: "Rohan Das", role: "Structural Eng.", orgId: "org-2", avatar: "RD",
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
      { id: "pa-7", title: "Foundation Analysis — Test Office Block", projectId: "proj-2", deliverableId: "del-4", assignedAt: "2025-03-11", dueAt: "2025-03-25", status: "In Progress" },
    ],
  },
];

export function projectsByOrg(orgId: string)  { return projects.filter(p => p.organisationId === orgId); }
export function deliverablesByProject(projectId: string) { return deliverables.filter(d => d.projectId === projectId); }
export function deliverablesByProjects(projectIds: string[]) {
  const set = new Set(projectIds);
  return deliverables.filter(d => set.has(d.projectId));
}
export function membersByOrg(orgId: string): PerformanceMember[] { return MEMBERS.filter(m => m.orgId === orgId); }
export function projectName(projectId: string): string  { return projMap[projectId]?.name ?? projectId; }
export function deliverableName(deliverableId: string): string { return delivMap[deliverableId]?.name ?? deliverableId; }

export function maxOrgSkills(orgId: string): number {
  const om = membersByOrg(orgId);
  return om.length === 0 ? 1 : Math.max(...om.map(m => m.skills.length), 1);
}
export function rawAvgSkillScore(member: PerformanceMember): number {
  if (member.skills.length === 0) return 0;
  return Math.round(member.skills.reduce((a, s) => a + s.score, 0) / member.skills.length);
}
export function coverageFactor(member: PerformanceMember): number {
  const max = maxOrgSkills(member.orgId);
  return max > 0 ? member.skills.length / max : 0;
}
export function weightedSkillScore(member: PerformanceMember): number {
  return Math.round(rawAvgSkillScore(member) * coverageFactor(member));
}
export function assignmentEfficiency(assignments: PerformanceMember["assignments"]): number {
  if (assignments.length === 0) return 0;
  const scores = assignments.map(a => {
    const due = new Date(a.dueAt).getTime(), assigned = new Date(a.assignedAt).getTime();
    const done = a.completedAt ? new Date(a.completedAt).getTime() : null;
    const win = due - assigned;
    if (!done || win <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((2 - (done - assigned) / win) * 50)));
  });
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}