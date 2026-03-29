const BASE = process.env.NEXT_PUBLIC_HOST;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliverableStatus =
  | "not_started" | "ongoing" | "ready"
  | "passed"      | "failed"  | "discrepancy";

export type ProjectStage = "1" | "2" | "3" | "4" | "5";

export interface OrganisationOption { id: number; name: string }

export interface DeliverableRow {
  id: number;
  name: string;
  stage: ProjectStage;
  stage_name: string;
  status: DeliverableStatus;
  status_display: string;
  is_completed: boolean;
  start_date: string | null;
  end_date: string | null;
  assigned_to_display: string;
  hours_logged: number;
}

export interface ProjectRow {
  id: number;
  name: string;
  organisation_id: number;
  organisation_name: string;
  client_name: string;
  location: string;
  project_type: string;
  current_stage: ProjectStage;
  is_completed: boolean;
  status_display: string;
  start_date: string | null;
  end_date: string | null;
  total_hours: number;
  total_revenue: number;
  total_expenses: number;
  delivered_count: number;
  deliverable_count: number;
}

export interface ProjectDetail extends ProjectRow {
  description: string | null;
  deliverables: DeliverableRow[];
}

export interface ProjectListParams {
  org_id?: number;
  is_completed?: "true" | "false";
  stage?: ProjectStage;
  q?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatINR(value: number | null | undefined): string {
  const n = value ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return "—";
  }
}

export const STAGE_LABEL: Record<ProjectStage, string> = {
  "1": "Stage 1", "2": "Stage 2", "3": "Stage 3", "4": "Stage 4", "5": "Stage 5",
};

export const DELIVERABLE_STATUS_COLOR: Record<DeliverableStatus, { bg: string; text: string }> = {
  not_started: { bg: "#f0f0f0", text: "#777"    },
  ongoing:     { bg: "#e3f2fd", text: "#1565c0" },
  ready:       { bg: "#fff8e1", text: "#e65100" },
  passed:      { bg: "#e8f5e9", text: "#2e7d32" },
  failed:      { bg: "#fce4ec", text: "#b71c1c" },
  discrepancy: { bg: "#f3e5f5", text: "#6a1b9a" },
};

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchProjectOrganisations(): Promise<OrganisationOption[]> {
  try {
    const res = await fetch(`${BASE}/api/v2/projects/organisations/`, { 
      headers: authHeaders() 
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch organisations:", error);
    return [];
  }
}

export async function fetchProjects(p: ProjectListParams = {}): Promise<ProjectRow[]> {
  try {
    const qs = new URLSearchParams();
    if (p.org_id)       qs.set("org_id",       String(p.org_id));
    if (p.is_completed) qs.set("is_completed",  p.is_completed);
    if (p.stage)        qs.set("stage",         p.stage);
    if (p.q)            qs.set("q",             p.q);
    
    const url = `${BASE}/api/v2/projects/${qs.toString() ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: authHeaders() });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    throw error;
  }
}

export async function fetchProjectDetail(id: number): Promise<ProjectDetail> {
  try {
    const res = await fetch(`${BASE}/api/v2/projects/${id}/`, { 
      headers: authHeaders() 
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Validate the response has the required fields
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }
    
    return data as ProjectDetail;
  } catch (error) {
    console.error(`Failed to fetch project detail for ID ${id}:`, error);
    throw error;
  }
}

// Debug function to test API connection
export async function debugProjects(): Promise<any> {
  try {
    const res = await fetch(`${BASE}/api/v2/projects/debug/`, { 
      headers: authHeaders() 
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Debug API failed:", error);
    throw error;
  }
}