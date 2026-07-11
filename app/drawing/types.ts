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
  stage: string; // '1'..'5'
  status: 'not_started' | 'ongoing' | 'ready' | 'passed' | 'failed' | 'discrepancy';
}

export interface DrawingDocument {
  id: number;
  deliverable_id: number; // links up to Deliverable -> Project -> Organisation
  title: string;
  description: string;
  file_type: 'pdf' | 'image' | 'document';
  file_url: string;
  thumbnail_url?: string;
  uploaded_at: string;
  uploaded_by: string;
  category: string; // discipline tag: Architectural, Structural, etc — independent of org hierarchy
  size: number; // in bytes
  is_favorite: boolean;
  tags: string[];
  version: string;
  status: 'draft' | 'published' | 'archived';
  file_path?: string;
}

// Resolved shape used by the UI once org/project/deliverable are joined in
export interface DrawingDocumentResolved extends DrawingDocument {
  deliverable_name: string;
  project_id: number;
  project_name: string;
  organisation_id: number;
  organisation_name: string;
}