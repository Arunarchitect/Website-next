// app/main/user/types.ts

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  is_superuser?: boolean;
  is_staff?: boolean;
}

export interface OrganisationMembership {
  id: number;
  organisation: number;
  organisation_name: string;
  role: 'admin' | 'manager' | 'member' | 'client';
  user: number;
}

export interface UserTile {
  href: string;
  icon: string;
  label: string;
  description: string;
  tag: string;
  requiresAreacalc?: boolean;
  requiresOrganisation?: boolean;
}

export interface UserStats {
  totalProjects: number;
  totalTasks: number;
  totalDeliverables: number;
}

export interface AreacalcRoleResponse {
  authenticated: boolean;
  role: 'admin' | 'member' | 'customer' | 'user' | 'anonymous';
  can_save_custom_templates: boolean;
}