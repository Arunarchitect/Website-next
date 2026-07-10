// app/new/dash/types.ts

export interface Organisation {
  id: number;
  name: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
}

export interface DashboardIssue {
  id: string | number;
  title: string;
  description: string;
  status: string;  // Changed from specific union to string to handle both formats
  priority: string; // Changed from specific union to string
  domain: 'bim' | 'other';
  reportedBy: string;
  assignedTo: string | null;
  created: string;
  updated: string;
  topicType?: string;
  organisation?: string;
  organisation_id?: number;
}

export interface DashboardStats {
  open: number;
  inProgress: number;
  resolved: number;
  highPriority: number;
  total: number;
}

export interface Tool {
  key: string;
  href: string;
  icon: string;
  label: string;
  description: string;
  tag: string;
  tagColor: 'teal' | 'purple';
  external: boolean;
}

export interface QuickLink {
  label: string;
  href: string;
  icon: string;
}