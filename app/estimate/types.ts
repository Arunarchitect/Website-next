export type EstimateStatus = "draft" | "published" | "archived";
export type EstimateKind = "estimate" | "quantity";

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

export type QuantityRole = "group" | "sum" | "avg" | "min" | "max" | "text";

export interface QuantityColumnConfig {
  key: string;
  label: string;
  show: boolean;
  role: QuantityRole;
  unit: string;
}

export type QuantityCell = string | number | null;

export interface QuantityRow {
  cells: Record<string, QuantityCell>;
  count: number;
  details?: Record<string, QuantityCell>[];
}

export interface QuantityData {
  columns: QuantityColumnConfig[];
  grouped: boolean;
  show_count: boolean;
  decimals: number;
  final: string | null;
  rows: QuantityRow[];
  totals: Record<string, QuantityCell>;
}

export interface Estimate {
  id: number;
  kind: EstimateKind;
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
  config: QuantityConfig | null;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
  permissions: EstimatePermissions;
}

export interface EstimateDetail extends Estimate {
  items: EstimateItem[];
  quantity_data: QuantityData | null;
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

export interface QuantityWastage {
  percent: number;
  all: boolean;
  keys: string[];
}

export interface QuantityMerge {
  id: string;
  label: string;
  keys: string[];
}

export interface QuantitySortKey {
  key: string;
  dir: "asc" | "desc";
}

export interface QuantityAdjust {
  wastage: QuantityWastage;
  merges: QuantityMerge[];
  waste_label?: string;
  combined_label?: string;
  combined_waste_label?: string;
  /** legacy single sort, still read if sort_by is empty */
  sort?: "none" | "asc" | "desc";
  /** multi-level sort, first = main sort */
  sort_by?: QuantitySortKey[];
  /** manual row order (row keys) */
  order?: string[];
  show_total?: boolean;
}

export interface QuantityConfig {
  columns: QuantityColumnConfig[];
  final: string | null;
  show_count: boolean;
  show_details: boolean;
  decimals: number;
  adjust?: QuantityAdjust;
}