// clientApi.ts - Client-side API with dummy data
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ProjectListItem,
  ProjectDetail,
  ProjectStage,
  FeeSetup,
  PaymentStatus,
} from '@/app/new/project_api';

// ---------------------------------------------------------------------------
// BCF Issue Types (BIM Collaboration Format friendly)
// ---------------------------------------------------------------------------

export type BCFIssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type BCFIssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type BCFIssueType = 'clash' | 'error' | 'warning' | 'info' | 'request';

export interface BCFIssue {
  id: string;
  title: string;
  description: string;
  status: BCFIssueStatus;
  priority: BCFIssuePriority;
  type: BCFIssueType;
  assigned_to: string;
  created_date: string;
  updated_date: string;
  due_date: string | null;
  viewpoint_camera?: {
    x: number;
    y: number;
    z: number;
    direction_x: number;
    direction_y: number;
    direction_z: number;
  };
  snapshot_url?: string;
  comments_count: number;
  related_element_id?: string;
  ifc_guid?: string;
  location_in_model: string;
}

// ---------------------------------------------------------------------------
// Client Dashboard Types
// ---------------------------------------------------------------------------

export interface ClientProjectSummary {
  project: ProjectListItem;
  current_stage_label: string;
  total_fees: number;
  fees_paid: number;
  fees_pending: number;
  payment_percentage: number;
  open_issues: number;
  critical_issues: number;
  last_update: string;
  next_milestone: string | null;
}

export interface ClientDashboardData {
  client_name: string;
  client_organisation: string;
  projects: ClientProjectSummary[];
  total_projects: number;
  total_outstanding_amount: number;
  total_paid_amount: number;
  overall_payment_percentage: number;
  total_open_issues: number;
}

// ---------------------------------------------------------------------------
// Dummy Data
// ---------------------------------------------------------------------------

const dummyIssues: Record<number, BCFIssue[]> = {
  1: [
    {
      id: 'bcf-001',
      title: 'Structural column clash with HVAC duct',
      description: 'Column C12 conflicts with main supply duct on Level 3',
      status: 'open',
      priority: 'high',
      type: 'clash',
      assigned_to: 'Structural Team',
      created_date: '2026-06-15',
      updated_date: '2026-06-28',
      due_date: '2026-07-10',
      viewpoint_camera: {
        x: 12.5,
        y: 8.3,
        z: 3.2,
        direction_x: 0.5,
        direction_y: -0.8,
        direction_z: 0.3,
      },
      comments_count: 3,
      related_element_id: '2x3jGfjk89sH',
      ifc_guid: '3pO9Lk7mN2bV5cX',
      location_in_model: 'Level 3, Grid C-12',
    },
    {
      id: 'bcf-002',
      title: 'Door clearance insufficient for wheelchair access',
      description: 'Door D45 on Ground floor has only 800mm clear width',
      status: 'in_progress',
      priority: 'high',
      type: 'error',
      assigned_to: 'Architecture Team',
      created_date: '2026-06-10',
      updated_date: '2026-06-25',
      due_date: '2026-07-05',
      comments_count: 5,
      location_in_model: 'Ground Floor, Room G-12',
    },
    {
      id: 'bcf-003',
      title: 'Missing fire damper in wall penetration',
      description: 'Wall W23 lacks fire damper where duct penetrates',
      status: 'open',
      priority: 'critical',
      type: 'error',
      assigned_to: 'MEP Team',
      created_date: '2026-06-20',
      updated_date: '2026-06-29',
      due_date: '2026-07-08',
      snapshot_url: '/snapshots/fire-damper-missing.png',
      comments_count: 2,
      location_in_model: 'Level 2, Grid D-7',
    },
  ],
  2: [
    {
      id: 'bcf-004',
      title: 'Pipe routing conflicts with beam B15',
      description: 'Sprinkler main conflicts with structural beam on Level 1',
      status: 'open',
      priority: 'medium',
      type: 'clash',
      assigned_to: 'MEP Team',
      created_date: '2026-06-18',
      updated_date: '2026-06-27',
      due_date: '2026-07-12',
      comments_count: 1,
      location_in_model: 'Level 1, Grid B-15',
    },
  ],
};

const dummyDashboardData: ClientDashboardData = {
  client_name: 'Acme Corporation',
  client_organisation: 'Acme Corp Ltd.',
  projects: [
    {
      project: {
        id: 1,
        name: 'Downtown Office Tower',
        description: '40-story commercial tower with retail podium',
        location: 'Mumbai, India',
        client_name: 'Acme Corporation',
        organisation_id: 1,
        organisation_name: 'Acme Corp Ltd.',
        project_type: 'commercial',
        billing_type: 'percentage_share',
        current_stage: '3' as ProjectStage,
        is_completed: false,
        start_date: '2026-01-15',
        end_date: '2027-06-30',
        agg_deliverable_count: 24,
        agg_delivered_count: 18,
        agg_revenue: 1500000,
        agg_expenses: 800000,
        agg_hours_seconds: 3200 * 3600,
      },
      current_stage_label: 'Stage 3 - Detailed Design',
      total_fees: 2500000,
      fees_paid: 1500000,
      fees_pending: 1000000,
      payment_percentage: 60,
      open_issues: 3,
      critical_issues: 1,
      last_update: '2026-06-28',
      next_milestone: 'Stage 3 deliverable review - Jul 15, 2026',
    },
    {
      project: {
        id: 2,
        name: 'Greenfield Residential Complex',
        description: '500-unit residential development with amenities',
        location: 'Pune, India',
        client_name: 'Acme Corporation',
        organisation_id: 1,
        organisation_name: 'Acme Corp Ltd.',
        project_type: 'residential',
        billing_type: 'hourly',
        current_stage: '2' as ProjectStage,
        is_completed: false,
        start_date: '2026-03-01',
        end_date: '2027-12-31',
        agg_deliverable_count: 16,
        agg_delivered_count: 10,
        agg_revenue: 900000,
        agg_expenses: 450000,
        agg_hours_seconds: 1800 * 3600,
      },
      current_stage_label: 'Stage 2 - Schematic Design',
      total_fees: 1800000,
      fees_paid: 720000,
      fees_pending: 1080000,
      payment_percentage: 40,
      open_issues: 1,
      critical_issues: 0,
      last_update: '2026-06-27',
      next_milestone: 'Stage 2 completion - Aug 30, 2026',
    },
  ],
  total_projects: 2,
  total_outstanding_amount: 2080000,
  total_paid_amount: 2220000,
  overall_payment_percentage: 51.6,
  total_open_issues: 4,
};

// ---------------------------------------------------------------------------
// API Functions (with dummy data fallback)
// ---------------------------------------------------------------------------

export async function fetchClientDashboard(): Promise<ClientDashboardData> {
  // In production, uncomment the actual API call:
  // const res = await fetch(`${BASE}/api/v2/client/dashboard/`, {
  //   headers: authHeaders(),
  // });
  // if (!res.ok) throw new Error(`Client dashboard failed: ${res.status}`);
  // return res.json();

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  return dummyDashboardData;
}

export async function fetchProjectIssues(
  projectId: number
): Promise<BCFIssue[]> {
  // In production, uncomment the actual API call:
  // const res = await fetch(`${BASE}/api/v2/projects/${projectId}/issues/`, {
  //   headers: authHeaders(),
  // });
  // if (!res.ok) throw new Error(`Issues fetch failed: ${res.status}`);
  // return res.json();

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return dummyIssues[projectId] || [];
}

export async function fetchAllIssues(): Promise<
  Record<number, BCFIssue[]>
> {
  // In production: fetch from backend
  await new Promise((resolve) => setTimeout(resolve, 600));
  return dummyIssues;
}