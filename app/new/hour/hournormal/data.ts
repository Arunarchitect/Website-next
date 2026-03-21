// data.ts — single source of truth for dashboard + worklog pages

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