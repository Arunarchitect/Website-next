// app/main/client/types.ts

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

export interface ClientSection {
  icon: string;
  label: string;
  description: string;
  href: string;
  cta: string;
  requiresAreacalc?: boolean;
}

export interface OrganisationMembership {
  id: number;
  organisation: number;
  organisation_name: string;
  role: 'admin' | 'manager' | 'member' | 'client';
  user: number;
}

export interface AreacalcRoleResponse {
  role: 'admin' | 'member' | 'customer' | 'user' | 'anonymous';
  is_active?: boolean;
}

export interface ClientStats {
  totalProjects: number;
  totalDeliverables: number;
  totalTasks: number;
}

export interface ClientProject {
  id: number;
  name: string;
  client_name: string;
  location: string;
  project_type: string;
  current_stage: string;
  status_display: string;
  is_completed: boolean;
  delivered_count: number;
  role: 'admin' | 'manager' | 'member' | 'client' | null;
}