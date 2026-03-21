// dashboardData.ts

export interface Organisation {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  organisationId: string;
}

export interface Deliverable {
  id: string;
  name: string;
  projectId: string;
  organisationId: string;
  stage: "1" | "2" | "3" | "4" | "5";
  status: "not_started" | "ongoing" | "ready" | "passed" | "failed" | "discrepancy";
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

export interface User {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const currentUser: User = {
  id: "user-1",
  name: "Arun Ravikumar",
};

export const organisations: Organisation[] = [
  { id: "org-1", name: "Sunilkumar Associates" },
  { id: "org-2", name: "Test Corp" },
  { id: "org-3", name: "Greenfield Ltd" },
];

export const projects: Project[] = [
  { id: "proj-1", name: "Sunilkumar Residence", organisationId: "org-1" },
  { id: "proj-2", name: "Test Office Block",    organisationId: "org-2" },
  { id: "proj-3", name: "Greenfield Mall",      organisationId: "org-3" },
];

export const deliverables: Deliverable[] = [
  { id: "del-1", name: "Floor Plan",        projectId: "proj-1", organisationId: "org-1", stage: "1", status: "not_started" },
  { id: "del-2", name: "Elevation Drawing", projectId: "proj-1", organisationId: "org-1", stage: "1", status: "not_started" },
  { id: "del-3", name: "Site Layout",       projectId: "proj-2", organisationId: "org-2", stage: "2", status: "not_started" },
  { id: "del-4", name: "Structural Report", projectId: "proj-2", organisationId: "org-2", stage: "2", status: "not_started" },
  { id: "del-5", name: "3D Render",         projectId: "proj-3", organisationId: "org-3", stage: "3", status: "not_started" },
];

export const assignments: Assignment[] = [
  { id: "asgn-1", deliverableId: "del-1", memberId: "user-1", startDate: "2025-03-20", dueDate: "2025-03-28" },
  { id: "asgn-2", deliverableId: "del-4", memberId: "user-1", startDate: "2025-03-22", dueDate: "2025-04-01" },
];

export const quickAccessItems: QuickAccess[] = [
  { id: "qa-1", userId: "user-1", deliverableId: "del-5", position: 0 },
  { id: "qa-2", userId: "user-1", deliverableId: "del-2", position: 1 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getDeliverable(id: string) {
  return deliverables.find((d) => d.id === id);
}

export function getProject(id: string) {
  return projects.find((p) => p.id === id);
}

export function getOrganisation(id: string) {
  return organisations.find((o) => o.id === id);
}

export function getMyAssignments(userId = currentUser.id) {
  return assignments.filter((a) => a.memberId === userId);
}

export function getMyQuickAccess(userId = currentUser.id) {
  return quickAccessItems
    .filter((q) => q.userId === userId)
    .sort((a, b) => a.position - b.position);
}