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
  duration?: number;  // Made optional with ?
  remarks?: string | null;
  employee: number;
}

/**
 * API response format
 */
export interface Worklog extends BaseWorkLog {
  deliverable: number;
  deliverable_name?: string; // Added to match API response
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
  id: number;
  start_time: string;  // yyyy-MM-dd'T'HH:mm
  end_time: string;    // yyyy-MM-dd'T'HH:mm
  project: number;
  deliverable: number; // Changed from optional to required
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

export type SortKey = keyof Pick<
  Worklog, 
  'start_time' | 'end_time' | 'duration'
> | 'project' | 'deliverable';

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
  isLoading?: boolean; 
  sortKey?: SortKey;
  sortDirection?: SortDirection;
  onSort?: (key: SortKey) => void;
  onDateSelect?: (date: Date | null) => void;
  showOnlyCurrentMonth?: boolean; // Add this
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

/**
 * Extended types for calendar functionality
 */
export interface WorklogWithDuration extends Worklog {
  startDate: Date | null;
  endDate: Date | null;
  duration: number;
}

export interface UseCalendarDaysReturn {
  currentMonth: Date;
  calendarDays: Date[];
  worklogDates: Set<string>;
  daysWithWorklogsCount: number;
  leaveDaysCount: number;
  totalHours: number;
  selectedDate: Date | null;
  worklogsWithDuration: WorklogWithDuration[];
  prevMonth: () => void;
  nextMonth: () => void;
  handleDateClick: (day: Date) => void;
  handleMonthChange: (month: number) => void;
  handleYearChange: (year: number) => void;
  setSelectedDate: (date: Date | null) => void;
}


