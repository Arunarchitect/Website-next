// app/main/member/constants.ts
import { Tool, QuickLink } from './types';

export const tools: Tool[] = [
  {
    key: "areacalc",
    href: "/tools/areacalc",
    icon: "ti-ruler-measure",
    label: "Area Calculator",
    description: "Survey rates, place management, space templates",
    tag: "Areacalc",
    tagColor: "teal",
    external: false,
  },
  {
    key: "dashboard",
    href: "/new/dash/dashnormal",
    icon: "ti-layout-dashboard",
    label: "Dashboard",
    description: "Projects, deliverables, team members, work logs",
    tag: "Dashboard",
    tagColor: "purple",
    external: false,
  },
];

export const quickLinks: QuickLink[] = [
  { label: "My Worklogs", href: "/new/hour/hournormal", icon: "ti-clock" },
  { label: "Add Expense", href: "/new/exp/expnormal", icon: "ti-wallet" },
  { label: "Leave", href: "/new/leave", icon: "ti-calendar-event" },
  { label: "My Issues", href: "/issues?assigned=true", icon: "ti-bug" },
];

export const issueStatsConfig = [
  { label: "Open Issues", icon: "ti-alert-circle" },
  { label: "In Progress", icon: "ti-loader" },
  { label: "Resolved", icon: "ti-check" },
  { label: "High Priority", icon: "ti-flag" },
];