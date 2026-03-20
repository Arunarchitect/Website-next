// analysis/types.ts

import type { computeEarnings } from "./analysisData";

export type Granularity = "day" | "month" | "year";
export type SectionState = "idle" | "loading" | "loaded";
export type CalcMode = "monthly" | "daily" | "yearly" | "project";

export interface SummaryData {
  totalHours:    number;
  totalRevenue:  number;
  totalSpend:    number;
  totalProjects: number;
  reimburse:     number;
  totalPayable:  number;
  teamActive:    number;
  earnings:      ReturnType<typeof computeEarnings>;
}

export interface CalcResult {
  person:        string;
  periodLabel:   string;
  hoursWorked:   number;
  hourlyRate:    number;
  grossEarnings: number;
  spends:        number;
  reimburseAmt:  number;
  ownCostAmt:    number;
  netPayable:    number;
  contractType:  string;
  role:          string;
  projectPct?:   number;
  projectName?:  string;
}

export interface ChartsData {
  byPerson:      { label: string; hours: number }[];
  byProject:     { label: string; hours: number }[];
  byDeliverable: { label: string; hours: number }[];
  byDay:         { label: string; hours: number }[];
}