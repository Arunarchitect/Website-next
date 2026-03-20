// ─── Types ────────────────────────────────────────────────────────────────────

export type Organisation = {
  id: string;
  name: string;
  tagline: string;
  logo: string; // initials
  industry: string;
  since: number;
};

export type Project = {
  id: string;
  name: string;
  color: string;
};

export type Deliverable = {
  id: string;
  name: string;
  projectId: string;
};

export type Member = {
  id: string;
  name: string;
  avatar: string; // initials
  role: string;
};

export type Entry = {
  id: string;
  date: string;        // "YYYY-MM-DD"
  projectId: string;
  deliverableId: string;
  memberId: string;
  revenue: number;
  spend: number;
};

// ─── Organisation ─────────────────────────────────────────────────────────────

export const organisation: Organisation = {
  id: "org1",
  name: "Nexaflow Solutions",
  tagline: "Building the future, one sprint at a time",
  logo: "NF",
  industry: "Software & Consulting",
  since: 2019,
};

// ─── Static data ──────────────────────────────────────────────────────────────

export const projects: Project[] = [
  { id: "p1", name: "Nova Platform",    color: "#6366f1" },
  { id: "p2", name: "Horizon App",      color: "#f59e0b" },
  { id: "p3", name: "Pulse Dashboard",  color: "#10b981" },
  { id: "p4", name: "Orbit CRM",        color: "#ef4444" },
];

export const deliverables: Deliverable[] = [
  { id: "d1", name: "UI Design",         projectId: "p1" },
  { id: "d2", name: "Backend API",       projectId: "p1" },
  { id: "d3", name: "QA Testing",        projectId: "p1" },
  { id: "d4", name: "Mobile App",        projectId: "p2" },
  { id: "d5", name: "Analytics Module",  projectId: "p2" },
  { id: "d6", name: "Reporting Engine",  projectId: "p3" },
  { id: "d7", name: "Real-time Feed",    projectId: "p3" },
  { id: "d8", name: "CRM Integration",   projectId: "p4" },
  { id: "d9", name: "Email Automation",  projectId: "p4" },
];

export const members: Member[] = [
  { id: "m1", name: "Arjun Nair",    avatar: "AN", role: "Engineer"  },
  { id: "m2", name: "Priya Menon",   avatar: "PM", role: "Designer"  },
  { id: "m3", name: "Rohan Das",     avatar: "RD", role: "Manager"   },
  { id: "m4", name: "Sneha Iyer",    avatar: "SI", role: "Analyst"   },
  { id: "m5", name: "Vikram Pillai", avatar: "VP", role: "Engineer"  },
];

// ─── Pre-computed lookup maps (used by entry generator & page) ────────────────

/** projectId → deliverable ids belonging to that project */
export const deliverablesByProject: Record<string, string[]> = {};
for (const d of deliverables) {
  (deliverablesByProject[d.projectId] ??= []).push(d.id);
}

// ─── Deterministic PRNG (mulberry32) — fast, no Math.sin, no allocation ──────

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ─── Entry generation: Jan 2024 – Mar 2026 ───────────────────────────────────

export const entries: Entry[] = (() => {
  const result: Entry[] = [];
  const rng = mulberry32(0xdeadbeef);

  const pIds  = projects.map(p => p.id);
  const mIds  = members.map(m => m.id);

  let entryIndex = 0;

  for (let year = 2024; year <= 2026; year++) {
    const lastMonth = year === 2026 ? 3 : 12;

    for (let month = 1; month <= lastMonth; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();
      // 15–25 entries per month (deterministic via rng)
      const count = 15 + Math.floor(rng() * 11);

      for (let i = 0; i < count; i++) {
        const day      = 1 + Math.floor(rng() * daysInMonth);
        const pId      = pIds[Math.floor(rng() * pIds.length)];
        const dList    = deliverablesByProject[pId];
        const dId      = dList[Math.floor(rng() * dList.length)];
        const mId      = mIds[Math.floor(rng() * mIds.length)];
        const revenue  = Math.round(rng() * 45_000 + 5_000);
        const spend    = Math.round(rng() * revenue * 0.7 + 1_000);

        result.push({
          id:             `e${entryIndex++}`,
          date:           `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          projectId:      pId,
          deliverableId:  dId,
          memberId:       mId,
          revenue,
          spend,
        });
      }
    }
  }

  return result;
})();