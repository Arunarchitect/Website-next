// types/worklogs.ts
export interface Project {
  id: number;
  name: string;
}

export interface Deliverable {
  id: number;
  name: string;
  projectId: number;
}

export interface BaseWorkLog {
  id: number;
  start_time: string;
  end_time?: string;
  duration?: number;
  remarks?: string | null;
  employee?: number;
}

export interface WorkLog extends BaseWorkLog {
  deliverable_name: string;
  employee: number;
  deliverable: number;
}

export interface UserWorkLog extends BaseWorkLog {
  deliverable: string;
  project: string;
  organisation: string;
}

export interface EditableWorkLog extends Omit<BaseWorkLog, 'start_time' | 'end_time'> {
  start_time: Date;
  end_time: Date;
  projectId: number;
  deliverable: string;
  remarks?: string;
}

export type SortDirection = 'asc' | 'desc';

export type SortKey = keyof Pick<
  UserWorkLog,
  'start_time' | 'end_time' | 'duration' | 'deliverable' | 'project' | 'organisation' | 'remarks'
>;

export interface WorklogsTableProps {
  worklogs: WorkLog[];
  projects: Project[];
  deliverables: Deliverable[];
  onDelete: (id: number) => void;
  onUpdate: (worklog: EditableWorkLog) => Promise<void>;
  refetch: () => void;
  isLoading?: boolean;
  isError?: boolean;
}

export interface WorkTableProps {
  worklogs: UserWorkLog[];
  isError: boolean;
  totalHours: number;
  sortKey?: SortKey;
  sortDirection?: SortDirection;
  onSort?: (key: SortKey) => void;
}