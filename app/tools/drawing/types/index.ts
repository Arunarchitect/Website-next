export interface Organisation {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
  deliverables_count?: number;
}

export interface Deliverable {
  id: number;
  name: string;
  remarks?: string;
  project: number;
  drawing_count?: number;
}

export interface Drawing {
  id: number;
  drawing_name: string;
  description?: string;
  original_file_type: "svg" | "png" | "pdf";
  status: string;
  created_at: string;
  updated_at: string;
  file_info?: {
    original?: { url?: string | null; type?: string };
    svg?: { url?: string | null };
    pdf?: { url?: string | null };
    png?: { url?: string | null };
  };
  available_files?: string[]; // This should include "svg", "pdf", "png"
  is_conversion_complete?: boolean;
  required_conversions?: string[];
}

export interface ProjectsResponse {
  organisation: Organisation;
  projects: Project[];
}

export interface DeliverablesResponse {
  deliverables: Deliverable[];
  project: { id: number; name: string };
}

export interface DrawingsResponse {
  drawings: Drawing[];
  project: { id: number; name: string };
  deliverable: { id: number; name: string };
}

export type ActionButtonStyle = "blue" | "green" | "purple";
