// types/worklogs.ts

/**
 * Core entity types
 */
export interface Project {
  id: number;
  name: string;
  organisation?: number;
}

export interface Deliverable {
  id: number;
  name: string;
  project: number;
}

/**
 * Time tracking types
 */
export interface WorklogDuration {
  hours: number;
  minutes: number;
}

export interface WorklogGroup {
  date: string;
  worklogs: UserWorkLog[];
  totalDuration: number;
}

/**
 * Base worklog interface
 */
export interface BaseWorkLog {
  id: number;
  start_time: string;  // ISO format
  end_time: string;    // ISO format
  duration: number;    // in minutes
  remarks?: string | null;
  employee: number;
}

/**
 * API response format
 */
export interface Worklog extends BaseWorkLog {
  deliverable: number;
}

/**
 * UI display format
 */
export interface UserWorkLog {
  id: number;
  start_time: string;
  end_time: string;
  duration: number;
  remarks?: string | null;
  deliverable: string;
  project: string;
  organisation?: string;
  employee: number;
}

/**
 * Form editing type
 */
export interface EditableWorklog {
  id?: number;
  start_time: string;  // yyyy-MM-dd'T'HH:mm
  end_time: string;    // yyyy-MM-dd'T'HH:mm
  project: number;
  deliverable?: number;
  remarks: string;
}


/**
 * New worklog creation type
 */
export interface NewWorklog extends Omit<EditableWorklog, 'id'> {
  employee: number;
}

/**
 * Validation errors
 */
export interface WorklogValidationErrors {
  start_time?: string;
  end_time?: string;
  project?: string;
  deliverable?: string;
  remarks?: string;
}

/**
 * Sorting types
 */
export type SortDirection = 'asc' | 'desc';

export type WorkLogSortKey = keyof Pick<
  UserWorkLog,
  'start_time' | 'end_time' | 'duration' | 'deliverable' | 'project' | 'organisation'
>;

/**
 * Component props
 */
export interface WorklogsTableProps {
  worklogs: Worklog[];
  projects: Project[];
  deliverables: Deliverable[];
  onDelete: (id: number) => Promise<void>;
  onUpdate: (worklog: EditableWorklog) => Promise<void>;
  refetch: () => void;
  isLoading?: boolean;
  isError?: boolean;
  selectedDate?: Date | null;
}

export interface WorkTableProps {
  worklogs: UserWorkLog[];
  totalHours: number;
  isError?: boolean;
  sortKey?: WorkLogSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: WorkLogSortKey) => void;
  onDateSelect?: (date: Date | null) => void;
}

/**
 * API response types
 */
export interface WorklogsResponse {
  data: Worklog[];
  total: number;
}

export interface WorklogCreateResponse {
  data: Worklog;
  success: boolean;
  error?: string;
}