export type GroupKey = "investors" | "overheads" | "technical";

export interface GroupDef {
  key:      GroupKey;
  label:    string;
  color:    string;
  shades:   string[];
  dimColor: string;
  idealPct: number;
}

export const GROUPS: GroupDef[] = [
  {
    key: "investors", label: "Investors Share",
    color: "#a78bfa",
    shades: ["#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#c4b5fd", "#ddd6fe"],
    dimColor: "rgba(167,139,250,0.10)", idealPct: 33.33,
  },
  {
    key: "overheads", label: "Overhead Costs",
    color: "#fb923c",
    shades: ["#fb923c", "#f97316", "#ea580c", "#c2410c", "#fdba74", "#fed7aa"],
    dimColor: "rgba(251,146,60,0.10)", idealPct: 33.33,
  },
  {
    key: "technical", label: "Technical Costs",
    color: "#38bdf8",
    shades: ["#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#7dd3fc", "#bae6fd"],
    dimColor: "rgba(56,189,248,0.10)", idealPct: 33.33,
  },
];

export const GROUP_MAP = Object.fromEntries(
  GROUPS.map((g) => [g.key, g])
) as Record<GroupKey, GroupDef>;