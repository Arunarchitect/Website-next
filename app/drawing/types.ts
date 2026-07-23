// app/drawing/types.ts

export interface Organisation {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  organisation_id: number;
  name: string;
  client_name: string;
  location: string;
}

export interface Deliverable {
  id: number;
  project_id: number;
  name: string;
  stage: string;
  status: string;
  stage_name?: string;
  status_name?: string;
}

export interface DrawingDocument {
  id: number;
  deliverable_id: number;
  title: string;
  description: string;
  file_type: 'pdf' | 'image' | 'document' | 'dxf' | 'ifc';
  file_url: string;
  thumbnail_url?: string;
  uploaded_at: string;
  // API returns the uploader's numeric id under `uploaded_by`, and the
  // display name under `uploaded_by_name`. Components should render
  // `uploaded_by_name`, not `uploaded_by`.
  uploaded_by?: number | null;
  uploaded_by_name: string;
  category: string;
  size: number;
  is_favorite: boolean;
  tags: string[];
  version: string;
  status: 'draft' | 'published' | 'archived';
  file_path?: string;
  is_private: boolean;
  allowed_roles?: string[];
  is_public: boolean;
}

export interface DrawingDocumentResolved extends DrawingDocument {
  deliverable_name: string;
  project_id: number;
  project_name: string;
  organisation_id: number;
  organisation_name: string;
}

export interface UserContext {
  id: number;
  name: string;
  email: string;
  roles: string[];
  hasDrawingPrivateAccess: boolean;
  organisationIds: number[]
}

// Form data for creating/editing documents
export interface DrawingDocumentFormData {
  deliverable_id: number;
  title: string;
  description: string;
  file_type: 'pdf' | 'image' | 'document' | 'dxf' | 'ifc';
  file?: File | null;
  thumbnail?: File | null;
  category: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  tags: string[];
  is_private: boolean;
  allowed_roles: string[];
}

// Cascading dropdown data
export interface OrganisationOption {
  id: number;
  name: string;
}

export interface ProjectOption {
  id: number;
  organisation_id: number;
  name: string;
  client_name: string;
}

export interface DeliverableOption {
  id: number;
  project_id: number;
  name: string;
  stage_name?: string;
  status_name?: string;
}