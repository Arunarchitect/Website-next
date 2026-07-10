// app/main/user/constants.ts

import { UserTile } from './types';

export const userTiles: UserTile[] = [
  {
    href: "/tools/areacalc",
    icon: "ti-ruler-measure",
    label: "Area Calculator",
    description: "Estimate construction costs by area",
    tag: "Tool",
    requiresAreacalc: true,
    requiresOrganisation: false,
  },
  {
    href: "/new/dash/dashnormal",
    icon: "ti-layout-dashboard",
    label: "My Dashboard",
    description: "Your projects and assigned deliverables",
    tag: "Dashboard",
    requiresAreacalc: false,
    requiresOrganisation: true,
  },
];

// Quick links for user dashboard
export const userQuickLinks = [
  { label: "Dashboard", href: "/new/dash/dashnormal", icon: "ti-layout-dashboard" },
  { label: "Area Calculator", href: "/tools/areacalc", icon: "ti-ruler-measure" },
  { label: "Issues", href: "/issues", icon: "ti-bug" },
];

// Role display configurations
export const roleDisplayConfig = {
  admin: {
    label: '🔑 Administrator',
    description: 'Full access to all features',
    color: '#D43E3E',
    bg: '#D43E3E20',
  },
  manager: {
    label: '📋 Manager',
    description: 'Can manage projects and team members',
    color: '#E8A838',
    bg: '#E8A83820',
  },
  member: {
    label: '👤 Member',
    description: 'Can view and contribute to projects',
    color: '#085041',
    bg: '#08504120',
  },
  client: {
    label: '🤝 Client',
    description: 'View-only access to projects and deliverables',
    color: '#712B13',
    bg: '#FAECE7',
  },
  no_organisation: {
    label: '⚠️ No Organisation',
    description: 'You are not a member of any organisation',
    color: '#6B7280',
    bg: '#F0F0F0',
  },
};

export const areacalcDisplayConfig = {
  admin: {
    label: 'Areacalc Admin',
    color: '#0F6E56',
    bg: '#E1F5EE',
  },
  member: {
    label: 'Areacalc Member',
    color: '#0F6E56',
    bg: '#E1F5EE',
  },
  customer: {
    label: 'Areacalc Customer',
    color: '#6E6B62',
    bg: '#F0F0F0',
  },
  user: {
    label: 'Areacalc User',
    color: '#6E6B62',
    bg: '#F0F0F0',
  },
  anonymous: {
    label: 'No Areacalc Access',
    color: '#6B7280',
    bg: '#F0F0F0',
  },
};

// Default tiles for users with no organisation and no Areacalc
export const defaultTiles: UserTile[] = [];