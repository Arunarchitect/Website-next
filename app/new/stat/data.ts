// ─── Types ────────────────────────────────────────────────────────────────────

export type Organisation = {
  id: string;
  name: string;
  tagline: string;
  logo: string;
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
  avatar: string;
  role: string;
};

export type ExpenseCategory =
  | "travel"
  | "food"
  | "accommodation"
  | "stationery"
  | "others";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel:        "Travel",
  food:          "Food",
  accommodation: "Accommodation",
  stationery:    "Stationery",
  others:        "Others",
};

/** Matches Django's Expense model — NOT linked to a deliverable */
export type Expense = {
  id: string;
  date: string;          // "YYYY-MM-DD"
  userId: string;        // FK → Member (user)
  projectId: string;     // FK → Project
  amount: number;        // DecimalField equivalent
  category: ExpenseCategory;
  remarks?: string;
  createdAt: string;     // ISO timestamp
};

/** Legacy entry type kept for the revenue/spend analysis grid */
export type Entry = {
  id: string;
  date: string;          // "YYYY-MM-DD"
  projectId: string;
  deliverableId: string;
  memberId: string;
  revenue: number;
  spend: number;
};

// ─── Organisation ─────────────────────────────────────────────────────────────

export const organisation: Organisation = {
  id: "org1",
  name: "Stonemark Studio",
  tagline: "Designing spaces that endure",
  logo: "SM",
  industry: "Architecture & Urban Design",
  since: 2019,
};

// ─── Static data ──────────────────────────────────────────────────────────────

export const projects: Project[] = [
  { id: "p1", name: "Meridian Tower",      color: "#6366f1" },
  { id: "p2", name: "Harlow Residences",   color: "#f59e0b" },
  { id: "p3", name: "Civic Arts Pavilion", color: "#10b981" },
  { id: "p4", name: "Vantage Mixed-Use",   color: "#ef4444" },
];

export const deliverables: Deliverable[] = [
  { id: "d1", name: "Concept Design",      projectId: "p1" },
  { id: "d2", name: "Structural Drawings", projectId: "p1" },
  { id: "d3", name: "Planning Submission", projectId: "p1" },
  { id: "d4", name: "Interior Layouts",    projectId: "p2" },
  { id: "d5", name: "Landscape Plan",      projectId: "p2" },
  { id: "d6", name: "Facade Design",       projectId: "p3" },
  { id: "d7", name: "Acoustic Report",     projectId: "p3" },
  { id: "d8", name: "Site Master Plan",    projectId: "p4" },
  { id: "d9", name: "3D Visualisations",   projectId: "p4" },
];

export const members: Member[] = [
  { id: "m1", name: "Arjun Nair",    avatar: "AN", role: "Architect"           },
  { id: "m2", name: "Priya Menon",   avatar: "PM", role: "Interior Designer"   },
  { id: "m3", name: "Rohan Das",     avatar: "RD", role: "Project Manager"     },
  { id: "m4", name: "Sneha Iyer",    avatar: "SI", role: "Urban Planner"       },
  { id: "m5", name: "Vikram Pillai", avatar: "VP", role: "Structural Engineer" },
];

export const deliverablesByProject: Record<string, string[]> = {};
for (const d of deliverables) {
  (deliverablesByProject[d.projectId] ??= []).push(d.id);
}

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ─── Revenue/Spend Entries (linked to deliverables) ──────────────────────────

export const entries: Entry[] = (() => {
  const result: Entry[] = [];
  const rng = mulberry32(0xdeadbeef);

  const pIds = projects.map(p => p.id);
  const mIds = members.map(m => m.id);

  let idx = 0;

  for (let year = 2024; year <= 2026; year++) {
    const lastMonth = year === 2026 ? 3 : 12;

    for (let month = 1; month <= lastMonth; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const count = 15 + Math.floor(rng() * 11);

      for (let i = 0; i < count; i++) {
        const day     = 1 + Math.floor(rng() * daysInMonth);
        const pId     = pIds[Math.floor(rng() * pIds.length)];
        const dList   = deliverablesByProject[pId];
        const dId     = dList[Math.floor(rng() * dList.length)];
        const mId     = mIds[Math.floor(rng() * mIds.length)];
        const revenue = Math.round(rng() * 45_000 + 5_000);
        const spend   = Math.round(rng() * revenue * 0.7 + 1_000);

        result.push({
          id:            `e${idx++}`,
          date:          `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          projectId:     pId,
          deliverableId: dId,
          memberId:      mId,
          revenue,
          spend,
        });
      }
    }
  }

  return result;
})();

// ─── Expenses (separate model — NOT linked to deliverables) ──────────────────

const CATEGORIES: ExpenseCategory[] = [
  "travel", "food", "accommodation", "stationery", "others",
];

const REMARKS_BY_CATEGORY: Record<ExpenseCategory, string[]> = {
  travel:        ["Site visit – Meridian Tower", "Client meeting travel", "Field survey transport", "Airport transfer"],
  food:          ["Team lunch", "Client dinner", "Working meal – deadline sprint", "Catering for presentation"],
  accommodation: ["Hotel – site inspection", "Overnight stay – outstation project", "Service apartment – long-term project"],
  stationery:    ["A3 printing – drawing sheets", "Marker set & trace paper", "Binding & lamination", "Plotter consumables"],
  others:        ["Software licence renewal", "Courier – document dispatch", "Miscellaneous project expense", "Utilities – site office"],
};

export const expenses: Expense[] = (() => {
  const result: Expense[] = [];
  const rng = mulberry32(0xcafebabe);

  const pIds = projects.map(p => p.id);
  const mIds = members.map(m => m.id);

  let idx = 0;

  for (let year = 2024; year <= 2026; year++) {
    const lastMonth = year === 2026 ? 3 : 12;

    for (let month = 1; month <= lastMonth; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();
      // 8–14 expense records per month
      const count = 8 + Math.floor(rng() * 7);

      for (let i = 0; i < count; i++) {
        const day      = 1 + Math.floor(rng() * daysInMonth);
        const pId      = pIds[Math.floor(rng() * pIds.length)];
        const uId      = mIds[Math.floor(rng() * mIds.length)];
        const cat      = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
        const amount   = Math.round(rng() * 8_000 + 200); // ₹200 – ₹8200
        const remarksList = REMARKS_BY_CATEGORY[cat];
        const remarks  = remarksList[Math.floor(rng() * remarksList.length)];
        const dateStr  = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        result.push({
          id:        `exp${idx++}`,
          date:      dateStr,
          userId:    uId,
          projectId: pId,
          amount,
          category:  cat,
          remarks,
          createdAt: `${dateStr}T${String(Math.floor(rng() * 23)).padStart(2, "0")}:${String(Math.floor(rng() * 59)).padStart(2, "0")}:00`,
        });
      }
    }
  }

  return result;
})();