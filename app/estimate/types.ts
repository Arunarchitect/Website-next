export type EstimateStatus = "draft" | "published" | "archived";

export interface EstimatePermissions {
  can_edit: boolean;
  can_delete: boolean;
  can_download: boolean;
  can_change_status: boolean;
}

export interface EstimateItem {
  id: string;
  hierarchy: string;
  parent: string | null;
  level: number;
  identification: string;
  name: string;
  description: string;
  is_sum: boolean;
  quantity: number | null;
  unit: string;
  rate: number;
  total: number;
}

export interface Estimate {
  id: number;
  title: string;
  description: string;
  status: EstimateStatus;
  project_id: number;
  project_name: string;
  organisation_id: number;
  organisation_name: string;
  original_filename: string;
  file_size: number;
  total_amount: number;
  item_count: number;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
  permissions: EstimatePermissions;
}

export interface EstimateDetail extends Estimate {
  items: EstimateItem[];
}

export interface Organisation {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
}

export interface RawMembership {
  id: number;
  organisation: number;
  role: string;
  project: number | null;
}