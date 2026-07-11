// app/drawing/types.ts


export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
  is_superuser: boolean;
  is_staff: boolean;
}

export interface OrganisationMembership {
  id: number;
  organisation: number;
  organisation_name: string;
  role: string;
  joined_at: string;
}

export interface AreacalcRoleResponse {
  role: string;
}

export interface ClientStats {
  totalProjects: number;
  totalDeliverables: number;
  totalTasks: number;
}

export interface DrawingDocument {
  id: number;
  title: string;
  description: string;
  file_type: 'pdf' | 'image' | 'document';
  file_url: string;
  thumbnail_url?: string;
  uploaded_at: string;
  uploaded_by: string;
  project_name?: string;
  category: string;
  size: number; // in bytes
  is_favorite: boolean;
  tags: string[];
  version: string;
  status: 'draft' | 'published' | 'archived';
  file_path?: string; // Local file path for public files
}

export interface DocumentCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}