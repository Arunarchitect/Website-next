// app/main/client/constants.ts

import { ClientSection } from './types';

export const clientSections: ClientSection[] = [
  {
    icon: "ti-briefcase",
    label: "My Projects",
    description: "View projects shared with you by your organisation.",
    href: "/new/projectdash",
    cta: "View projects",
    requiresAreacalc: false,
  },
  {
    icon: "ti-ruler-measure",
    label: "Area Calculator",
    description: "Use the area and cost estimation tool.",
    href: "/tools/areacalc",
    cta: "Open tool",
    requiresAreacalc: true,
  },
];

// Quick links for client dashboard
export const clientQuickLinks = [
  { label: "Project Overview", href: "/new/projectdash", icon: "ti-layout-dashboard" },
  { label: "Area Calculator", href: "/tools/areacalc", icon: "ti-ruler-measure" },
  { label: "Issues", href: "/issues", icon: "ti-bug" },
];

// Role display names and descriptions
export const roleConfig = {
  admin: {
    label: 'Administrator',
    description: 'Full access to all features',
    icon: 'ti-shield-check',
    color: '#D43E3E',
  },
  manager: {
    label: 'Manager',
    description: 'Can manage projects and team members',
    icon: 'ti-user-check',
    color: '#E8A838',
  },
  member: {
    label: 'Member',
    description: 'Can view and contribute to projects',
    icon: 'ti-user',
    color: '#2C5F8A',
  },
  client: {
    label: 'Client',
    description: 'View-only access to projects and deliverables',
    icon: 'ti-user',
    color: '#712B13',
  },
};

export const areacalcRoleConfig = {
  admin: {
    label: 'Areacalc Admin',
    description: 'Full access to Areacalc tools',
    icon: 'ti-calculator',
    color: '#0F6E56',
  },
  member: {
    label: 'Areacalc Member',
    description: 'Can use Areacalc tools',
    icon: 'ti-ruler-measure',
    color: '#0F6E56',
  },
  customer: {
    label: 'Areacalc Customer',
    description: 'Limited Areacalc access',
    icon: 'ti-user',
    color: '#6E6B62',
  },
  user: {
    label: 'Areacalc User',
    description: 'Basic Areacalc access',
    icon: 'ti-user',
    color: '#6E6B62',
  },
  anonymous: {
    label: 'No Areacalc Access',
    description: 'No Areacalc tools available',
    icon: 'ti-lock',
    color: '#6E6B62',
  },
};

// Default sections for client page
export const defaultSections: ClientSection[] = [
  {
    icon: "ti-briefcase",
    label: "My Projects",
    description: "View projects shared with you by your organisation.",
    href: "/new/projectdash",
    cta: "View projects",
    requiresAreacalc: false,
  },
];

// Navigation items for client header
export const clientNavItems = [
  { label: 'Dashboard', href: '/new/projectdash', icon: 'ti-layout-dashboard' },
  { label: 'Area Calculator', href: '/tools/areacalc', icon: 'ti-ruler-measure' },
  { label: 'Issues', href: '/issues', icon: 'ti-bug' },
];