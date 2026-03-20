// ---------------------------------------------------------------------------
// dashboardData.ts
// Hardcoded prototype data — swap fetch() calls here when connecting a backend.
// ---------------------------------------------------------------------------

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
}

export interface WorkSession {
  /** unique id for this worklog row */
  id: string;
  deliverableId: string;
  projectId: string;
  /** ISO 8601 strings — null means the session is open / still running */
  startTime: string | null;
  endTime: string | null;
}

export interface Skill {
  name: string;
  score: string;
}

export interface User {
  id: string;
  name: string;
  skills: Skill[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const currentUser: User = {
  id: "user-1",
  name: "Arun Ravikumar",
  skills: [
    { name: "AutoCAD", score: "3.5/5" },
    { name: "Bonsai",  score: "3.5/5" },
    { name: "Revit",   score: "4.0/5" },
  ],
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
  { id: "del-1", name: "Floor Plan",        projectId: "proj-1" },
  { id: "del-2", name: "Elevation Drawing", projectId: "proj-1" },
  { id: "del-3", name: "Site Layout",       projectId: "proj-2" },
  { id: "del-4", name: "Structural Report", projectId: "proj-2" },
  { id: "del-5", name: "3D Render",         projectId: "proj-3" },
];

/**
 * Worklog — past sessions with both start & end recorded.
 * The elapsed seconds are derived at runtime from startTime / endTime.
 */
export const worklogSessions: WorkSession[] = [
  {
    id: "wl-1",
    deliverableId: "del-1",
    projectId: "proj-1",
    startTime: "2025-03-18T09:00:00Z",
    endTime:   "2025-03-18T10:30:00Z", // 1h 30m
  },
  {
    id: "wl-2",
    deliverableId: "del-3",
    projectId: "proj-2",
    startTime: "2025-03-18T11:00:00Z",
    endTime:   "2025-03-18T13:30:00Z", // 2h 30m
  },
];

/**
 * Assigned — deliverables assigned to the user, not yet started.
 * elapsed starts at 0; the app will accumulate time when the user hits play.
 */
export const assignedSessions: WorkSession[] = [
  {
    id: "as-1",
    deliverableId: "del-2",
    projectId: "proj-1",
    startTime: null,
    endTime:   null,
  },
  {
    id: "as-2",
    deliverableId: "del-4",
    projectId: "proj-2",
    startTime: null,
    endTime:   null,
  },
];

/**
 * Quick Access — user-pinned deliverables for fast access.
 */
export const quickAccessSessions: WorkSession[] = [
  {
    id: "qa-1",
    deliverableId: "del-5",
    projectId: "proj-3",
    startTime: null,
    endTime:   null,
  },
];

// ---------------------------------------------------------------------------
// Helper — convert a WorkSession into elapsed seconds
// ---------------------------------------------------------------------------
export function sessionToElapsed(session: WorkSession): number {
  if (!session.startTime || !session.endTime) return 0;
  const start = new Date(session.startTime).getTime();
  const end   = new Date(session.endTime).getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

// ---------------------------------------------------------------------------
// Lookup helpers (replace with API calls when moving to a real backend)
// ---------------------------------------------------------------------------
export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function getDeliverable(id: string): Deliverable | undefined {
  return deliverables.find((d) => d.id === id);
}

/**
 * When you move to a real backend, replace the data constants above with
 * async fetch functions, e.g.:
 *
 *   export async function fetchDashboardData(): Promise<DashboardPayload> {
 *     const res = await fetch("/api/dashboard");
 *     return res.json();
 *   }
 *
 * Then call it inside a useEffect in the page and set state accordingly.
 */