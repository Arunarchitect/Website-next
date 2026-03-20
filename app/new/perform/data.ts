// data.ts — Performance Page Data (Relational hierarchy)
// Structure: Organisation → Projects → Deliverables
//            Organisation → Members  → Skills + Assignments

// ─── Primitive types ─────────────────────────────────────────────────────────

export type RemarkLevel = "Excellent" | "Good" | "Average" | "Needs Improvement";

export interface Skill {
  name: string;
  score: number; // 0–100
  remark: RemarkLevel;
}

export interface Assignment {
  id: string;
  title: string;
  projectId: string;      // ref → Project.id
  deliverableId: string;  // ref → Deliverable.id
  assignedAt: string;     // ISO date
  dueAt: string;
  completedAt: string | null;
  status: "Completed" | "In Progress" | "Overdue";
}

export interface Member {
  id: string;
  orgId: string;          // ref → Organisation.id
  name: string;
  avatar: string;
  role: string;
  skills: Skill[];
  assignments: Assignment[];
}

export interface Deliverable {
  id: string;
  projectId: string;      // ref → Project.id
  name: string;
}

export interface Project {
  id: string;
  orgId: string;          // ref → Organisation.id
  name: string;
}

export interface Organisation {
  id: string;
  name: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

export function remark(score: number): RemarkLevel {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

function sk(name: string, score: number): Skill {
  return { name, score, remark: remark(score) };
}

// ─── 1. Organisations ────────────────────────────────────────────────────────

export const ORGANISATIONS: Organisation[] = [
  { id: "org1", name: "Nexus Labs"      },
  { id: "org2", name: "Orbit Solutions" },
];

// ─── 2. Projects (reference orgId) ───────────────────────────────────────────

export const PROJECTS: Project[] = [
  { id: "proj1", orgId: "org1", name: "Project Aurora" },
  { id: "proj2", orgId: "org1", name: "Project Beacon" },
  { id: "proj3", orgId: "org2", name: "Project Cirrus" },
  { id: "proj4", orgId: "org2", name: "Project Delta"  },
];

// ─── 3. Deliverables (reference projectId) ───────────────────────────────────

export const DELIVERABLES: Deliverable[] = [
  // Project Aurora
  { id: "del1",  projectId: "proj1", name: "UI Redesign"      },
  { id: "del2",  projectId: "proj1", name: "API Integration"  },
  { id: "del3",  projectId: "proj1", name: "QA Testing"       },
  // Project Beacon
  { id: "del4",  projectId: "proj2", name: "Data Pipeline"    },
  { id: "del5",  projectId: "proj2", name: "Dashboard"        },
  { id: "del6",  projectId: "proj2", name: "User Research"    },
  // Project Cirrus
  { id: "del7",  projectId: "proj3", name: "Mobile App"       },
  { id: "del8",  projectId: "proj3", name: "Backend Services" },
  { id: "del9",  projectId: "proj3", name: "Documentation"    },
  // Project Delta
  { id: "del10", projectId: "proj4", name: "Auth System"      },
  { id: "del11", projectId: "proj4", name: "Reporting Module" },
];

// ─── 4. Members (reference orgId; assignments reference projectId/deliverableId) ──

export const MEMBERS: Member[] = [

  // ── Nexus Labs (org1) ────────────────────────────────────────────────────

  {
    id: "m1", orgId: "org1",
    name: "Arjun Menon", avatar: "AM", role: "Frontend Engineer",
    skills: [
      sk("Code Quality",      88),
      sk("Communication",     74),
      sk("Problem Solving",   91),
      sk("Collaboration",     80),
      sk("Documentation",     65),
      sk("UI/UX Sensitivity", 85),
      sk("Testing",           70),
      sk("Time Management",   60),
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
      sk("Code Quality",       92),
      sk("Communication",      68),
      sk("Problem Solving",    87),
      sk("Collaboration",      75),
      sk("Documentation",      82),
      sk("Database Design",    90),
      sk("API Design",         88),
      sk("Security Awareness", 71),
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
      sk("Code Quality",    78),
      sk("Communication",   82),
      sk("Problem Solving", 86),
      sk("Collaboration",   88),
      sk("Documentation",   91),
      sk("Test Planning",   94),
      sk("Bug Reporting",   89),
    ],
    assignments: [
      { id:"a11", projectId:"proj1", deliverableId:"del3", title:"QA Regression Suite",   assignedAt:"2025-01-08", dueAt:"2025-01-22", completedAt:"2025-01-21", status:"Completed"   },
      { id:"a12", projectId:"proj2", deliverableId:"del5", title:"Performance Benchmark", assignedAt:"2025-02-03", dueAt:"2025-02-18", completedAt:"2025-02-20", status:"Completed"   },
      { id:"a13", projectId:"proj3", deliverableId:"del7", title:"Mobile Smoke Tests",    assignedAt:"2025-03-02", dueAt:"2025-03-12", completedAt:null,         status:"In Progress" },
    ],
  },

  // ── Orbit Solutions (org2) ───────────────────────────────────────────────

  {
    id: "m4", orgId: "org2",
    name: "Rahul Das", avatar: "RD", role: "Product Designer",
    skills: [
      sk("Code Quality",     55),
      sk("Communication",    90),
      sk("Problem Solving",  78),
      sk("Collaboration",    95),
      sk("Documentation",    72),
      sk("Visual Design",    94),
      sk("Prototyping",      89),
      sk("User Research",    85),
      sk("Accessibility",    76),
      sk("Stakeholder Mgmt", 80),
    ],
    assignments: [
      { id:"a8",  projectId:"proj3", deliverableId:"del7", title:"Mobile Onboarding Flow", assignedAt:"2025-02-05", dueAt:"2025-02-28", completedAt:"2025-03-03", status:"Completed"   },
      { id:"a9",  projectId:"proj4", deliverableId:"del10",title:"Auth UI Flows",           assignedAt:"2025-02-10", dueAt:"2025-02-28", completedAt:"2025-02-26", status:"Completed"   },
      { id:"a10", projectId:"proj4", deliverableId:"del11",title:"Component Library",       assignedAt:"2025-03-05", dueAt:"2025-03-18", completedAt:null,         status:"In Progress" },
    ],
  },

  {
    id: "m5", orgId: "org2",
    name: "Sana Iyer", avatar: "SI", role: "DevOps Engineer",
    skills: [
      sk("Code Quality",        80),
      sk("Communication",       72),
      sk("Problem Solving",     84),
      sk("Collaboration",       78),
      sk("Documentation",       69),
      sk("CI/CD Pipelines",     92),
      sk("Cloud Infrastructure",88),
      sk("Security Awareness",  76),
      sk("Monitoring & Alerts", 83),
    ],
    assignments: [
      { id:"a14", projectId:"proj3", deliverableId:"del8", title:"Deploy Microservices",   assignedAt:"2025-01-12", dueAt:"2025-01-28", completedAt:"2025-01-27", status:"Completed"   },
      { id:"a15", projectId:"proj4", deliverableId:"del10",title:"Auth Service Hardening", assignedAt:"2025-02-14", dueAt:"2025-03-01", completedAt:"2025-02-28", status:"Completed"   },
      { id:"a16", projectId:"proj4", deliverableId:"del11",title:"Reports Pipeline Setup", assignedAt:"2025-03-03", dueAt:"2025-03-17", completedAt:null,         status:"In Progress" },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** All projects belonging to an org */
export function projectsByOrg(orgId: string): Project[] {
  return PROJECTS.filter(p => p.orgId === orgId);
}

/** All deliverables belonging to a project */
export function deliverablesByProject(projectId: string): Deliverable[] {
  return DELIVERABLES.filter(d => d.projectId === projectId);
}

/** All deliverables across multiple projects */
export function deliverablesByProjects(projectIds: string[]): Deliverable[] {
  const set = new Set(projectIds);
  return DELIVERABLES.filter(d => set.has(d.projectId));
}

/** All members belonging to an org */
export function membersByOrg(orgId: string): Member[] {
  return MEMBERS.filter(m => m.orgId === orgId);
}

/** Resolve a project name from its id */
export function projectName(projectId: string): string {
  return PROJECTS.find(p => p.id === projectId)?.name ?? projectId;
}

/** Resolve a deliverable name from its id */
export function deliverableName(deliverableId: string): string {
  return DELIVERABLES.find(d => d.id === deliverableId)?.name ?? deliverableId;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * Maximum skills assessed across ALL members in the org — used as coverage denominator.
 * Scoped per-org so members in different orgs aren't unfairly compared cross-org.
 */
export function maxOrgSkills(orgId: string): number {
  const members = membersByOrg(orgId);
  return members.length ? Math.max(...members.map(m => m.skills.length)) : 1;
}

/** Raw average: simple mean of all skill scores */
export function rawAvgSkillScore(member: Member): number {
  if (!member.skills.length) return 0;
  return Math.round(member.skills.reduce((s, sk) => s + sk.score, 0) / member.skills.length);
}

/** Coverage factor: member's skill count ÷ org's max skill count */
export function coverageFactor(member: Member): number {
  return member.skills.length / maxOrgSkills(member.orgId);
}

/**
 * Weighted score = rawAvg × coverageFactor.
 * Penalises members assessed on fewer skills — breadth matters.
 */
export function weightedSkillScore(member: Member): number {
  if (!member.skills.length) return 0;
  return Math.round(rawAvgSkillScore(member) * coverageFactor(member));
}

/**
 * Assignment time-efficiency (0–100) for a given list of assignments.
 * On-time/early = 100; late = penalised proportionally;
 * In Progress (pending) = 50; Overdue (pending) = 0.
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