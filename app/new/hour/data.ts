// data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Relational hierarchy:
//   Organisation → Projects → Deliverables
//   Organisation → Members  → Skills + Assignments
//
// Worklog data (used by OrgPage):
//   WorklogEntry   — historical time records (Worklog tab)
//   AssignedEntry  — tasks pushed to a member to track (Assigned tab)
//   QuickEntry     — pinned / recently used combos (Quick Access tab)
//
// Named exports consumed by each page
//   OrgPage         : organisation, projects, deliverables, members,
//                     entries, assignedEntries, quickEntries
//   PerformancePage : ORGANISATIONS, PROJECTS, DELIVERABLES, MEMBERS
//                     + all scoring helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type RemarkLevel = "Excellent" | "Good" | "Average" | "Needs Improvement";

export interface Skill {
  name: string;
  score: number; // 0–100
  remark: RemarkLevel;
}

/** A task assigned to a member with a deadline — shown in the Assigned tab */
export interface AssignedEntry {
  id: string;
  memberId: string;       // → Member.id
  projectId: string;      // → Project.id
  deliverableId: string;  // → Deliverable.id
  title: string;
  dueAt: string;          // ISO date
  estimatedSeconds: number; // expected effort
  loggedSeconds: number;    // time logged so far (starts at 0)
  status: "Completed" | "In Progress" | "Overdue";
}

/** A member's personal assignment — used in PerformancePage scoring */
export interface Assignment {
  id: string;
  title: string;
  projectId: string;      // → Project.id
  deliverableId: string;  // → Deliverable.id
  assignedAt: string;     // ISO date
  dueAt: string;
  completedAt: string | null;
  status: "Completed" | "In Progress" | "Overdue";
}

/** A historical time-tracking record — shown in the Worklog tab */
export interface WorklogEntry {
  id: string;
  date: string;           // ISO date e.g. "2025-03-10"
  memberId: string;       // → Member.id
  projectId: string;      // → Project.id
  deliverableId: string;  // → Deliverable.id
  seconds: number;        // total seconds logged
  note?: string;
}

/** A pinned / recently used project+deliverable combo — shown in Quick Access tab */
export interface QuickEntry {
  id: string;
  memberId: string;       // → Member.id — whose quick-access list this belongs to
  projectId: string;      // → Project.id
  deliverableId: string;  // → Deliverable.id
  label?: string;         // optional friendly label
  loggedSeconds: number;  // pre-filled time (starts at 0)
}

export interface Member {
  id: string;
  orgId: string;          // → Organisation.id
  name: string;
  avatar: string;         // 2-letter initials
  role: string;
  skills: Skill[];
  assignments: Assignment[];
}

export interface Deliverable {
  id: string;
  projectId: string;      // → Project.id
  name: string;
}

export interface Project {
  id: string;
  orgId: string;          // → Organisation.id
  name: string;
  color: string;          // hex — used for dot badges
}

export interface Organisation {
  id: string;
  name: string;
  logo: string;           // short label shown in the org badge
  industry: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function remark(score: number): RemarkLevel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

function sk(name: string, score: number): Skill {
  return { name, score, remark: remark(score) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ORGANISATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const ORGANISATIONS: Organisation[] = [
  { id: "org1", name: "Nexus Labs",      logo: "NL", industry: "Software"    },
  { id: "org2", name: "Orbit Solutions", logo: "OS", industry: "Engineering" },
];

/** Singleton — OrgPage defaults to first org */
export const organisation = ORGANISATIONS[0];

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROJECTS  (→ orgId)
// ─────────────────────────────────────────────────────────────────────────────

export const PROJECTS: Project[] = [
  { id: "proj1", orgId: "org1", name: "Project Aurora", color: "#6366f1" },
  { id: "proj2", orgId: "org1", name: "Project Beacon", color: "#0ea5e9" },
  { id: "proj3", orgId: "org2", name: "Project Cirrus", color: "#f59e0b" },
  { id: "proj4", orgId: "org2", name: "Project Delta",  color: "#10b981" },
];

/** Flat alias — OrgPage project dropdown */
export const projects = PROJECTS;

// ─────────────────────────────────────────────────────────────────────────────
// 3. DELIVERABLES  (→ projectId)
// ─────────────────────────────────────────────────────────────────────────────

export const DELIVERABLES: Deliverable[] = [
  // Project Aurora (proj1)
  { id: "del1",  projectId: "proj1", name: "UI Redesign"      },
  { id: "del2",  projectId: "proj1", name: "API Integration"  },
  { id: "del3",  projectId: "proj1", name: "QA Testing"       },

  // Project Beacon (proj2)
  { id: "del4",  projectId: "proj2", name: "Data Pipeline"    },
  { id: "del5",  projectId: "proj2", name: "Dashboard"        },
  { id: "del6",  projectId: "proj2", name: "User Research"    },

  // Project Cirrus (proj3)
  { id: "del7",  projectId: "proj3", name: "Mobile App"       },
  { id: "del8",  projectId: "proj3", name: "Backend Services" },
  { id: "del9",  projectId: "proj3", name: "Documentation"    },

  // Project Delta (proj4)
  { id: "del10", projectId: "proj4", name: "Auth System"      },
  { id: "del11", projectId: "proj4", name: "Reporting Module" },
];

/** Flat alias — OrgPage deliverable dropdown */
export const deliverables = DELIVERABLES;

// ─────────────────────────────────────────────────────────────────────────────
// 4. MEMBERS  (→ orgId)
// ─────────────────────────────────────────────────────────────────────────────

export const MEMBERS: Member[] = [

  // ── Nexus Labs (org1) ──────────────────────────────────────────────────────

  {
    id: "m1", orgId: "org1",
    name: "Arjun Menon", avatar: "AM", role: "Frontend Engineer",
    skills: [
      sk("Code Quality",      88), sk("Communication",     74),
      sk("Problem Solving",   91), sk("Collaboration",     80),
      sk("Documentation",     65), sk("UI/UX Sensitivity", 85),
      sk("Testing",           70), sk("Time Management",   60),
      sk("React Proficiency", 93),
    ],
    assignments: [
      { id:"a1", projectId:"proj1", deliverableId:"del1", title:"Redesign Landing Page",    assignedAt:"2025-01-05", dueAt:"2025-01-20", completedAt:"2025-01-18", status:"Completed"   },
      { id:"a2", projectId:"proj1", deliverableId:"del2", title:"Connect Auth API",          assignedAt:"2025-01-21", dueAt:"2025-02-05", completedAt:"2025-02-08", status:"Completed"   },
      { id:"a3", projectId:"proj1", deliverableId:"del3", title:"Write E2E Test Suite",      assignedAt:"2025-02-10", dueAt:"2025-02-25", completedAt:null,         status:"In Progress" },
      { id:"a4", projectId:"proj2", deliverableId:"del5", title:"Build Analytics Dashboard", assignedAt:"2025-03-01", dueAt:"2025-03-15", completedAt:"2025-03-14", status:"Completed"   },
    ],
  },

  {
    id: "m2", orgId: "org1",
    name: "Priya Nair", avatar: "PN", role: "Backend Engineer",
    skills: [
      sk("Code Quality",       92), sk("Communication",      68),
      sk("Problem Solving",    87), sk("Collaboration",      75),
      sk("Documentation",      82), sk("Database Design",    90),
      sk("API Design",         88), sk("Security Awareness", 71),
    ],
    assignments: [
      { id:"a5", projectId:"proj2", deliverableId:"del4", title:"Design ETL Pipeline", assignedAt:"2025-01-10", dueAt:"2025-01-30", completedAt:"2025-01-28", status:"Completed" },
      { id:"a6", projectId:"proj3", deliverableId:"del8", title:"Setup Microservices", assignedAt:"2025-02-01", dueAt:"2025-02-20", completedAt:"2025-02-25", status:"Completed" },
      { id:"a7", projectId:"proj3", deliverableId:"del9", title:"Write API Docs",      assignedAt:"2025-03-01", dueAt:"2025-03-10", completedAt:null,         status:"Overdue"   },
    ],
  },

  {
    id: "m3", orgId: "org1",
    name: "Meera Krishnan", avatar: "MK", role: "QA Engineer",
    skills: [
      sk("Code Quality",    78), sk("Communication",   82),
      sk("Problem Solving", 86), sk("Collaboration",   88),
      sk("Documentation",   91), sk("Test Planning",   94),
      sk("Bug Reporting",   89),
    ],
    assignments: [
      { id:"a11", projectId:"proj1", deliverableId:"del3", title:"QA Regression Suite",   assignedAt:"2025-01-08", dueAt:"2025-01-22", completedAt:"2025-01-21", status:"Completed"   },
      { id:"a12", projectId:"proj2", deliverableId:"del5", title:"Performance Benchmark", assignedAt:"2025-02-03", dueAt:"2025-02-18", completedAt:"2025-02-20", status:"Completed"   },
      { id:"a13", projectId:"proj3", deliverableId:"del7", title:"Mobile Smoke Tests",    assignedAt:"2025-03-02", dueAt:"2025-03-12", completedAt:null,         status:"In Progress" },
    ],
  },

  // ── Orbit Solutions (org2) ────────────────────────────────────────────────

  {
    id: "m4", orgId: "org2",
    name: "Rahul Das", avatar: "RD", role: "Product Designer",
    skills: [
      sk("Code Quality",     55), sk("Communication",    90),
      sk("Problem Solving",  78), sk("Collaboration",    95),
      sk("Documentation",    72), sk("Visual Design",    94),
      sk("Prototyping",      89), sk("User Research",    85),
      sk("Accessibility",    76), sk("Stakeholder Mgmt", 80),
    ],
    assignments: [
      { id:"a8",  projectId:"proj3", deliverableId:"del7",  title:"Mobile Onboarding Flow", assignedAt:"2025-02-05", dueAt:"2025-02-28", completedAt:"2025-03-03", status:"Completed"   },
      { id:"a9",  projectId:"proj4", deliverableId:"del10", title:"Auth UI Flows",           assignedAt:"2025-02-10", dueAt:"2025-02-28", completedAt:"2025-02-26", status:"Completed"   },
      { id:"a10", projectId:"proj4", deliverableId:"del11", title:"Component Library",       assignedAt:"2025-03-05", dueAt:"2025-03-18", completedAt:null,         status:"In Progress" },
    ],
  },

  {
    id: "m5", orgId: "org2",
    name: "Sana Iyer", avatar: "SI", role: "DevOps Engineer",
    skills: [
      sk("Code Quality",         80), sk("Communication",        72),
      sk("Problem Solving",      84), sk("Collaboration",        78),
      sk("Documentation",        69), sk("CI/CD Pipelines",      92),
      sk("Cloud Infrastructure", 88), sk("Security Awareness",   76),
      sk("Monitoring & Alerts",  83),
    ],
    assignments: [
      { id:"a14", projectId:"proj3", deliverableId:"del8",  title:"Deploy Microservices",   assignedAt:"2025-01-12", dueAt:"2025-01-28", completedAt:"2025-01-27", status:"Completed"   },
      { id:"a15", projectId:"proj4", deliverableId:"del10", title:"Auth Service Hardening", assignedAt:"2025-02-14", dueAt:"2025-03-01", completedAt:"2025-02-28", status:"Completed"   },
      { id:"a16", projectId:"proj4", deliverableId:"del11", title:"Reports Pipeline Setup", assignedAt:"2025-03-03", dueAt:"2025-03-17", completedAt:null,         status:"In Progress" },
    ],
  },
];

/** Flat list for OrgPage member dropdown */
export const members = MEMBERS.map(m => ({ id: m.id, name: m.name }));

// ─────────────────────────────────────────────────────────────────────────────
// 5. WORKLOG ENTRIES  — historical time records (Worklog tab)
//    seconds = duration of that session
// ─────────────────────────────────────────────────────────────────────────────

export const ENTRIES: WorklogEntry[] = [
  // Jan 2025
  { id:"e1",  date:"2025-01-08", memberId:"m3", projectId:"proj1", deliverableId:"del3", seconds:5400  },
  { id:"e2",  date:"2025-01-10", memberId:"m2", projectId:"proj2", deliverableId:"del4", seconds:7200  },
  { id:"e3",  date:"2025-01-14", memberId:"m1", projectId:"proj1", deliverableId:"del1", seconds:9000  },
  { id:"e4",  date:"2025-01-18", memberId:"m1", projectId:"proj1", deliverableId:"del1", seconds:6300  },
  { id:"e5",  date:"2025-01-20", memberId:"m5", projectId:"proj3", deliverableId:"del8", seconds:8100  },
  { id:"e6",  date:"2025-01-22", memberId:"m3", projectId:"proj1", deliverableId:"del3", seconds:3600  },
  { id:"e7",  date:"2025-01-25", memberId:"m2", projectId:"proj3", deliverableId:"del8", seconds:5400  },
  { id:"e8",  date:"2025-01-28", memberId:"m4", projectId:"proj3", deliverableId:"del7", seconds:7200  },

  // Feb 2025
  { id:"e9",  date:"2025-02-03", memberId:"m3", projectId:"proj2", deliverableId:"del5", seconds:4500  },
  { id:"e10", date:"2025-02-05", memberId:"m1", projectId:"proj1", deliverableId:"del2", seconds:5400  },
  { id:"e11", date:"2025-02-08", memberId:"m1", projectId:"proj1", deliverableId:"del2", seconds:3600  },
  { id:"e12", date:"2025-02-10", memberId:"m4", projectId:"proj4", deliverableId:"del10",seconds:9000  },
  { id:"e13", date:"2025-02-14", memberId:"m5", projectId:"proj4", deliverableId:"del10",seconds:7200  },
  { id:"e14", date:"2025-02-18", memberId:"m2", projectId:"proj3", deliverableId:"del8", seconds:6300  },
  { id:"e15", date:"2025-02-20", memberId:"m3", projectId:"proj2", deliverableId:"del5", seconds:5400  },
  { id:"e16", date:"2025-02-25", memberId:"m2", projectId:"proj3", deliverableId:"del8", seconds:4500  },
  { id:"e17", date:"2025-02-26", memberId:"m4", projectId:"proj4", deliverableId:"del10",seconds:3600  },
  { id:"e18", date:"2025-02-28", memberId:"m5", projectId:"proj4", deliverableId:"del10",seconds:6300  },

  // Mar 2025
  { id:"e19", date:"2025-03-01", memberId:"m1", projectId:"proj2", deliverableId:"del5", seconds:7200  },
  { id:"e20", date:"2025-03-03", memberId:"m4", projectId:"proj3", deliverableId:"del7", seconds:5400  },
  { id:"e21", date:"2025-03-05", memberId:"m4", projectId:"proj4", deliverableId:"del11",seconds:4500  },
  { id:"e22", date:"2025-03-08", memberId:"m1", projectId:"proj1", deliverableId:"del3", seconds:3600  },
  { id:"e23", date:"2025-03-10", memberId:"m2", projectId:"proj3", deliverableId:"del9", seconds:5400  },
  { id:"e24", date:"2025-03-12", memberId:"m3", projectId:"proj3", deliverableId:"del7", seconds:4500  },
  { id:"e25", date:"2025-03-14", memberId:"m1", projectId:"proj2", deliverableId:"del5", seconds:7200  },
  { id:"e26", date:"2025-03-17", memberId:"m5", projectId:"proj4", deliverableId:"del11",seconds:6300  },
  { id:"e27", date:"2025-03-20", memberId:"m2", projectId:"proj3", deliverableId:"del9", seconds:3600  },
  { id:"e28", date:"2025-03-22", memberId:"m5", projectId:"proj3", deliverableId:"del8", seconds:5400  },
];

/** Flat alias — OrgPage Worklog tab */
export const entries = ENTRIES;

// ─────────────────────────────────────────────────────────────────────────────
// 6. ASSIGNED ENTRIES  — tasks pushed to a member to log time against
//    (Assigned tab in OrgPage — shows with 00:00:00 initially)
// ─────────────────────────────────────────────────────────────────────────────

export const ASSIGNED_ENTRIES: AssignedEntry[] = [
  {
    id: "ae1",
    memberId: "m1", projectId: "proj1", deliverableId: "del1",
    title: "Elevation Drawing",
    dueAt: "2025-04-10",
    estimatedSeconds: 14400, // 4 hrs
    loggedSeconds: 0,
    status: "In Progress",
  },
  {
    id: "ae2",
    memberId: "m1", projectId: "proj1", deliverableId: "del3",
    title: "Structural Report",
    dueAt: "2025-04-15",
    estimatedSeconds: 10800, // 3 hrs
    loggedSeconds: 0,
    status: "In Progress",
  },
  {
    id: "ae3",
    memberId: "m2", projectId: "proj2", deliverableId: "del4",
    title: "Pipeline Schema Design",
    dueAt: "2025-04-08",
    estimatedSeconds: 7200,
    loggedSeconds: 0,
    status: "In Progress",
  },
  {
    id: "ae4",
    memberId: "m3", projectId: "proj3", deliverableId: "del7",
    title: "Regression Test Plan",
    dueAt: "2025-04-05",
    estimatedSeconds: 5400,
    loggedSeconds: 0,
    status: "Overdue",
  },
  {
    id: "ae5",
    memberId: "m4", projectId: "proj4", deliverableId: "del11",
    title: "Report Module Wireframes",
    dueAt: "2025-04-20",
    estimatedSeconds: 9000,
    loggedSeconds: 0,
    status: "In Progress",
  },
  {
    id: "ae6",
    memberId: "m5", projectId: "proj4", deliverableId: "del10",
    title: "Auth Hardening Review",
    dueAt: "2025-04-12",
    estimatedSeconds: 3600,
    loggedSeconds: 0,
    status: "In Progress",
  },
];

/** Flat alias — OrgPage Assigned tab */
export const assignedEntries = ASSIGNED_ENTRIES;

// ─────────────────────────────────────────────────────────────────────────────
// 7. QUICK-ACCESS ENTRIES  — pinned / recently used combos per member
//    (Quick Access tab in OrgPage)
// ─────────────────────────────────────────────────────────────────────────────

export const QUICK_ENTRIES: QuickEntry[] = [
  // m1 — Arjun Menon
  { id: "qe1", memberId: "m1", projectId: "proj1", deliverableId: "del1", label: "Landing page work",    loggedSeconds: 0 },
  { id: "qe2", memberId: "m1", projectId: "proj2", deliverableId: "del5", label: "Dashboard iterations", loggedSeconds: 0 },

  // m2 — Priya Nair
  { id: "qe3", memberId: "m2", projectId: "proj2", deliverableId: "del4", label: "Pipeline debugging",   loggedSeconds: 0 },
  { id: "qe4", memberId: "m2", projectId: "proj3", deliverableId: "del8", label: "Services standup",     loggedSeconds: 0 },

  // m3 — Meera Krishnan
  { id: "qe5", memberId: "m3", projectId: "proj3", deliverableId: "del7", label: "3D Render review",     loggedSeconds: 0 },
  { id: "qe6", memberId: "m3", projectId: "proj1", deliverableId: "del3", label: "QA sign-off",          loggedSeconds: 0 },

  // m4 — Rahul Das
  { id: "qe7", memberId: "m4", projectId: "proj4", deliverableId: "del11", label: "Reporting UI",        loggedSeconds: 0 },
  { id: "qe8", memberId: "m4", projectId: "proj3", deliverableId: "del7",  label: "Mobile flows",        loggedSeconds: 0 },

  // m5 — Sana Iyer
  { id: "qe9",  memberId: "m5", projectId: "proj4", deliverableId: "del10", label: "Auth pipeline",       loggedSeconds: 0 },
  { id: "qe10", memberId: "m5", projectId: "proj3", deliverableId: "del8",  label: "Infra monitoring",    loggedSeconds: 0 },
];

/** Flat alias — OrgPage Quick Access tab */
export const quickEntries = QUICK_ENTRIES;

// ─────────────────────────────────────────────────────────────────────────────
// LOOKUP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Projects belonging to an org */
export function projectsByOrg(orgId: string): Project[] {
  return PROJECTS.filter(p => p.orgId === orgId);
}

/** Deliverables belonging to a single project */
export function deliverablesByProject(projectId: string): Deliverable[] {
  return DELIVERABLES.filter(d => d.projectId === projectId);
}

/** Deliverables across multiple projects */
export function deliverablesByProjects(projectIds: string[]): Deliverable[] {
  const set = new Set(projectIds);
  return DELIVERABLES.filter(d => set.has(d.projectId));
}

/** Members belonging to an org */
export function membersByOrg(orgId: string): Member[] {
  return MEMBERS.filter(m => m.orgId === orgId);
}

/** Resolve a project name from its id */
export function projectName(id: string): string {
  return PROJECTS.find(p => p.id === id)?.name ?? id;
}

/** Resolve a deliverable name from its id */
export function deliverableName(id: string): string {
  return DELIVERABLES.find(d => d.id === id)?.name ?? id;
}

/** Resolve a member name from its id */
export function memberName(id: string): string {
  return MEMBERS.find(m => m.id === id)?.name ?? id;
}

/** Worklog entries for a specific member */
export function entriesByMember(memberId: string): WorklogEntry[] {
  return ENTRIES.filter(e => e.memberId === memberId);
}

/** Worklog entries for a specific project */
export function entriesByProject(projectId: string): WorklogEntry[] {
  return ENTRIES.filter(e => e.projectId === projectId);
}

/** Worklog entries for a date range (inclusive ISO strings) */
export function entriesByDateRange(from: string, to: string): WorklogEntry[] {
  return ENTRIES.filter(e => e.date >= from && e.date <= to);
}

/** Assigned entries for a specific member */
export function assignedByMember(memberId: string): AssignedEntry[] {
  return ASSIGNED_ENTRIES.filter(e => e.memberId === memberId);
}

/** Quick-access entries for a specific member */
export function quickByMember(memberId: string): QuickEntry[] {
  return QUICK_ENTRIES.filter(e => e.memberId === memberId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING HELPERS  (used by PerformancePage)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Max skills assessed across all members in one org.
 * Scoped per-org so inter-org comparisons stay fair.
 */
export function maxOrgSkills(orgId: string): number {
  const ms = membersByOrg(orgId);
  return ms.length ? Math.max(...ms.map(m => m.skills.length)) : 1;
}

/** Simple mean of all skill scores */
export function rawAvgSkillScore(member: Member): number {
  if (!member.skills.length) return 0;
  return Math.round(member.skills.reduce((s, sk) => s + sk.score, 0) / member.skills.length);
}

/**
 * Coverage factor = member's assessed skill count ÷ org's max skill count.
 * Rewards breadth — 7/10 skills → 0.70 factor applied to raw average.
 */
export function coverageFactor(member: Member): number {
  return member.skills.length / maxOrgSkills(member.orgId);
}

/**
 * Weighted score = rawAvg × coverageFactor.
 * Prevents 1 skill @ 90% equalling 10 skills averaging 90%.
 */
export function weightedSkillScore(member: Member): number {
  if (!member.skills.length) return 0;
  return Math.round(rawAvgSkillScore(member) * coverageFactor(member));
}

/**
 * Assignment time-efficiency (0–100).
 * On-time / early = 100 · late = penalised proportionally
 * In-Progress pending = 50 · Overdue pending = 0
 */
export function assignmentEfficiency(assignments: Assignment[]): number {
  if (!assignments.length) return 0;
  const scores = assignments.map(a => {
    if (!a.completedAt) return a.status === "Overdue" ? 0 : 50;
    const due      = new Date(a.dueAt).getTime();
    const done     = new Date(a.completedAt).getTime();
    const assigned = new Date(a.assignedAt).getTime();
    const ratio    = (done - assigned) / (due - assigned);
    return Math.max(0, Math.min(100, Math.round((2 - ratio) * 50)));
  });
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}