// app/new/dash/constants.ts

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
    key: "dashadmin",
    href: "/new/dash/dashadmin",
    icon: "ti-layout-dashboard",
    label: "Organisation Dashboard",
    description: "Projects, deliverables, team members, work logs",
    tag: "Org Admin",
    tagColor: "purple",
    external: false,
  },
];

export const quickLinks: QuickLink[] = [
  { label: "Survey rates", href: "/tools/areacalc/survey", icon: "ti-clipboard-data" },
  { label: "Space templates", href: "/tools/areacalc", icon: "ti-template" },
  { label: "Team members", href: "/new/dash/dashadmin", icon: "ti-users" },
  { label: "Projects", href: "/new/dash/dashadmin", icon: "ti-briefcase" },
];

export const issueStatsConfig = [
  { label: "Open Issues", icon: "ti-alert-circle" },
  { label: "In Progress", icon: "ti-loader" },
  { label: "Resolved", icon: "ti-check" },
  { label: "High Priority", icon: "ti-flag" },
];