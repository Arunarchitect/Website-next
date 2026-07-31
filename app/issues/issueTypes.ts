// ---------------------------------------------------------------------------
// Shared issue model
//
// BimIssue maps 1:1 onto a BCF (BIM Collaboration Format) 2.1 / 3.0 "Topic",
// so it can be imported/exported to any BCF-compliant tool (BIMcollab,
// Trimble Connect, Solibri, Navisworks, etc.) or a bcfXchange 3.0 server.
//
// DesignIssue covers issues that have nothing to do with the IFC model
// (documentation, schedule, client sign-off, etc.) but still need to live
// in the same tracker, list, and stats as BIM issues.
// ---------------------------------------------------------------------------

export type IssueStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type IssuePriority = "High" | "Medium" | "Low";
export type IssueDomain = "bim" | "design" | "other";

export type BcfTopicType =
  | "Clash"
  | "Coordinate"
  | "Quality"
  | "Safety"
  | "General"
  | "Request"
  | "Fault";

// ---------------------------------------------------------------------------
// Access control: classification drives who can see an issue at all;
// allowedRoles narrows a gated classification to specific org roles;
// sharedWith is an explicit per-user grant that bypasses both.
// ---------------------------------------------------------------------------

export type IssueClassification =
  | "general"
  | "public"
  | "internal"
  | "strategic"
  | "confidential";

export const CLASSIFICATION_OPTIONS: IssueClassification[] = [
  "general",
  "public",
  "internal",
  "strategic",
  "confidential",
];

// Classifications that require the viewer to be an org admin, hold an
// allowed role, be the reporter/assignee, or be explicitly shared-with.
export const GATED_CLASSIFICATIONS: IssueClassification[] = [
  "internal",
  "strategic",
  "confidential",
];

export const CLASSIFICATION_LABELS: Record<IssueClassification, string> = {
  general: "General",
  public: "Public",
  internal: "Internal",
  strategic: "Strategic",
  confidential: "Confidential",
};

export const isGatedClassification = (c: IssueClassification | string): boolean =>
  (GATED_CLASSIFICATIONS as string[]).includes(c);

export interface SharedUser {
  id: number;
  email: string;
  fullName: string;
}

export interface BcfViewpoint {
  guid: string;
  cameraPosition: { x: number; y: number; z: number };
  cameraDirection: { x: number; y: number; z: number };
  cameraUpVector?: { x: number; y: number; z: number };
  fieldOfView?: number;
  clippingPlanes?: Array<{ x: number; y: number; z: number; d: number }>;
  components?: Array<{
    ifcGuid: string;
    selectionType: "IfcProduct";
    visible?: boolean;
  }>;
  snapshot?: {
    data: string;
    format: "png" | "jpg";
    width?: number;
    height?: number;
  };
  clear_snapshot?: boolean;
}

export interface BcfSnapshot {
  guid: string;
  snapshot: string;
  snapshot_type: "png" | "jpg";
}

export interface IssueComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  viewpointGuid?: string;
  snapshot?: string;
}

export interface LinkedDocument {
  id: number;
  title: string;
  file_type: string;
}

interface BaseIssue {
  id: string | number;
  domain: IssueDomain;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  module: string;
  reportedBy: string;
  reportedById?: number | null;
  assignedTo: string | null;
  assignedToId: number | null;
  created: string;
  updated?: string;
  dueDate?: string | null;
  labels?: string[];
  comments: IssueComment[];
  linkedIssues?: string[];
  resolution?: string | null;
  linkedDocuments?: LinkedDocument[];
  project?: number;
  project_id?: number;
  deliverable?: number | null;
  reported_by?: number;
  assigned_to?: number | null;
  organisation: string | null;
  organisationId: number | null;

  // --- Access control -------------------------------------------------
  classification: IssueClassification;
  classificationDisplay?: string;
  allowedRoles: string[];
  isArchived: boolean;
  sharedWith: number[];
  sharedWithDetails: SharedUser[];
  // Whether the CURRENT viewer may change classification/allowedRoles/
  // sharedWith on this issue — server-computed (Issue.can_manage_access),
  // true for org admins/staff/superusers regardless of who reported it.
  canManageAccess: boolean;
}

export interface BimIssue extends BaseIssue {
  domain: "bim";
  bcfGuid: string;
  topicType: BcfTopicType;
  ifcElements?: string[];
  viewpoint?: BcfViewpoint;
  category?: never;
  attachments?: never;
}

export interface DesignIssue extends BaseIssue {
  domain: "design" | "other";
  category?: string;
  attachments?: string[];
  bcfGuid?: never;
  topicType?: never;
  ifcElements?: never;
  viewpoint?: never;
}

export const isBimIssue = (issue: Issue): issue is BimIssue =>
  issue.domain === "bim";

export const isDesignIssue = (issue: Issue): issue is DesignIssue =>
  issue.domain === "design" || issue.domain === "other";

export function assertBimIssue(issue: Issue): asserts issue is BimIssue {
  if (issue.domain !== "bim") {
    throw new Error(`Expected BIM issue but got domain: ${issue.domain}`);
  }
}

export function assertDesignIssue(issue: Issue): asserts issue is DesignIssue {
  if (issue.domain !== "design" && issue.domain !== "other") {
    throw new Error(`Expected Design issue but got domain: ${issue.domain}`);
  }
}

export type Issue = BimIssue | DesignIssue;

export interface IssueListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Issue[];
}

export type IssueDetailResponse = Issue;

export interface IssueCreatePayload {
  project: number;
  project_id?: number;
  deliverable?: number | null;
  domain: IssueDomain;
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  module?: string;
  assigned_to?: number | null;
  assignedToId?: number | null;
  due_date?: string | null;
  labels?: string[];
  topic_type?: BcfTopicType;
  ifc_elements?: string[];
  category?: string;
  attachments?: string[];
  classification?: IssueClassification;
  allowed_roles?: string[];
  shared_with?: number[];
}

export interface IssueUpdatePayload extends Partial<IssueCreatePayload> {
  resolution?: string;
  assignedToId?: number | null;
}

export interface IssueResolvePayload {
  resolution: string;
}

export interface IssueCommentPayload {
  text: string;
  viewpoint?: number | null;
  snapshot?: string;
}

export interface LinkIssuePayload {
  linked_issue_id: string | number;
}

export interface BcfTopic {
  guid: string;
  topic_type: string;
  topic_status: string;
  title: string;
  description: string;
  priority: string;
  creation_date: string;
  creation_author?: string;
  modified_date?: string;
  assigned_to?: string;
  due_date?: string;
  labels?: string[];
  comments?: BcfComment[];
  snapshots?: BcfSnapshot[];
}

export interface BcfComment {
  guid: string;
  date: string;
  author?: string;
  comment: string;
  viewpoint_guid?: string;
}

export interface BcfImportPayload {
  project: number;
  topic_data: BcfTopic;
  module?: string;
}

export const STATUS_OPTIONS: IssueStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
export const PRIORITY_OPTIONS: IssuePriority[] = ["High", "Medium", "Low"];
export const DOMAIN_OPTIONS: IssueDomain[] = ["bim", "design", "other"];
export const TOPIC_TYPE_OPTIONS: BcfTopicType[] = [
  "Clash",
  "Coordinate",
  "Quality",
  "Safety",
  "General",
  "Request",
  "Fault",
];

export const getStatusColor = (status: IssueStatus): string => {
  const colors: Record<IssueStatus, string> = {
    "Open": "#D43E3E",
    "In Progress": "#E8A838",
    "Resolved": "#4A8B6B",
    "Closed": "#6B7280",
  };
  return colors[status] || "#6B7280";
};

export const getPriorityColor = (priority: IssuePriority): string => {
  const colors: Record<IssuePriority, string> = {
    "High": "#D43E3E",
    "Medium": "#E8A838",
    "Low": "#4A8B6B",
  };
  return colors[priority] || "#6B7280";
};

export const getClassificationColor = (c: IssueClassification | string): string => {
  const colors: Record<string, string> = {
    general: "#6B7280",
    public: "#4A8B6B",
    internal: "#3B82F6",
    strategic: "#8B5CF6",
    confidential: "#D43E3E",
  };
  return colors[c] || "#6B7280";
};

export const getDomainLabel = (domain: IssueDomain): string => {
  return domain === "bim" ? "BIM Issue" : "Design Issue";
};

export const getStatusLabel = (status: IssueStatus): string => status;
export const getPriorityLabel = (priority: IssuePriority): string => priority;
export const getTopicTypeLabel = (type: BcfTopicType): string => type;

export const getDefaultIssue = (domain: IssueDomain = "design"): Partial<Issue> => {
  const base = {
    domain,
    status: "Open" as IssueStatus,
    priority: "Medium" as IssuePriority,
    module: "",
    comments: [],
    labels: [],
    assignedTo: null,
    assignedToId: null,
    classification: "general" as IssueClassification,
    allowedRoles: [],
    isArchived: false,
    sharedWith: [],
    sharedWithDetails: [],
    canManageAccess: false,
  };

  if (domain === "bim") {
    return {
      ...base,
      domain: "bim",
      bcfGuid: "",
      topicType: "General" as BcfTopicType,
      ifcElements: [],
    } as Partial<BimIssue>;
  }

  return {
    ...base,
    domain: "design",
    category: "",
    attachments: [],
  } as Partial<DesignIssue>;
};

export function toBcfTopic(issue: BimIssue): BcfTopic {
  return {
    guid: issue.bcfGuid,
    topic_type: issue.topicType,
    topic_status: issue.status,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    creation_date: issue.created,
    creation_author: issue.reportedBy,
    modified_date: issue.updated,
    assigned_to: issue.assignedTo || undefined,
    due_date: issue.dueDate || undefined,
    labels: issue.labels || [],
    comments: issue.comments.map((c) => ({
      guid: c.id,
      date: c.timestamp,
      author: c.author,
      comment: c.text,
      viewpoint_guid: c.viewpointGuid,
    })),
  };
}

export function fromBcfTopic(topic: BcfTopic, module = "BIM Coordination"): BimIssue {
  return {
    id: topic.guid,
    domain: "bim",
    bcfGuid: topic.guid,
    topicType: (topic.topic_type as BcfTopicType) || "General",
    title: topic.title,
    description: topic.description || "",
    status: (topic.topic_status as IssueStatus) || "Open",
    priority: (topic.priority as IssuePriority) || "Medium",
    module,
    reportedBy: topic.creation_author || "Unknown",
    assignedTo: topic.assigned_to || null,
    assignedToId: null,
    created: topic.creation_date || new Date().toISOString(),
    updated: topic.modified_date,
    dueDate: topic.due_date,
    labels: topic.labels || [],
    comments: (topic.comments || []).map((c) => ({
      id: c.guid,
      author: c.author || "Unknown",
      text: c.comment,
      timestamp: c.date || new Date().toISOString(),
      viewpointGuid: c.viewpoint_guid,
    })),
    ifcElements: [],
    organisation: null,
    organisationId: null,
    classification: "general",
    allowedRoles: [],
    isArchived: false,
    sharedWith: [],
    sharedWithDetails: [],
    canManageAccess: false,
  };
}

type DjangoRef =
  | { id?: number; email?: string; full_name?: string }
  | number
  | null
  | undefined;

interface DjangoCommentData {
  id: string | number;
  author?: DjangoRef;
  text: string;
  timestamp: string;
  snapshot?: string;
  viewpoint?: { guid?: string };
}

interface DjangoViewpointComponentData {
  ifc_guid: string;
  selection_type?: string;
  visible?: boolean;
}

interface DjangoViewpointData {
  guid: string;
  camera_position: { x: number; y: number; z: number };
  camera_direction: { x: number; y: number; z: number };
  camera_up_vector?: { x: number; y: number; z: number };
  field_of_view?: number;
  clipping_planes?: Array<{ x: number; y: number; z: number; d: number }>;
  snapshot?: string;
  snapshot_format?: "png" | "jpg";
  components?: DjangoViewpointComponentData[];
}

interface DjangoSharedUserData {
  id: number;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}

export interface DjangoIssueData {
  id: string | number;
  domain: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  module?: string;
  reported_by_name?: string;
  reported_by?: DjangoRef;
  assigned_to_name?: string;
  assigned_to?: DjangoRef;
  created: string;
  updated?: string;
  due_date?: string | null;
  labels?: string[];
  resolution?: string | null;
  linked_documents_details?: LinkedDocument[];
  comments?: DjangoCommentData[];
  project?: DjangoRef;
  deliverable?: DjangoRef;
  organisation?: string | null;
  organisation_id?: number;   
  bcf_guid?: string;
  topic_type?: string;
  ifc_elements?: string[];
  viewpoint?: DjangoViewpointData;
  category?: string;
  attachments?: string[];
  classification?: string;
  classification_display?: string;
  allowed_roles?: string[];
  is_archived?: boolean;
  shared_with?: number[];
  shared_with_details?: DjangoSharedUserData[];
  can_manage_access?: boolean;
}

function extractId(value: DjangoRef): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  return value.id ?? null;
}

function extractRefText(
  value: DjangoRef,
  key: "email" | "full_name"
): string | undefined {
  if (value && typeof value === "object") return value[key];
  return undefined;
}

export function fromDjangoIssue(data: DjangoIssueData): Issue {
  const base: BaseIssue = {
    id: String(data.id),
    domain: data.domain as IssueDomain,
    title: data.title,
    description: data.description || '',
    status: data.status as IssueStatus,
    priority: data.priority as IssuePriority,
    module: data.module || '',
    reportedBy: data.reported_by_name || extractRefText(data.reported_by, 'email') || 'Unknown',
    assignedTo: data.assigned_to_name || extractRefText(data.assigned_to, 'email') || null,
    assignedToId: extractId(data.assigned_to),
    created: data.created,
    updated: data.updated,
    dueDate: data.due_date,
    labels: data.labels || [],
    resolution: data.resolution,
    linkedDocuments: data.linked_documents_details || [],
    comments: (data.comments || []).map((c) => ({
      id: String(c.id),
      author: extractRefText(c.author, 'email') || extractRefText(c.author, 'full_name') || 'Unknown',
      text: c.text,
      timestamp: c.timestamp,
      snapshot: c.snapshot,
      viewpointGuid: c.viewpoint?.guid || undefined,
    })),
    project: extractId(data.project) ?? undefined,
    project_id: extractId(data.project) ?? undefined,
    deliverable: extractId(data.deliverable),
    reported_by: extractId(data.reported_by) ?? undefined,
    assigned_to: extractId(data.assigned_to),
    organisation: data.organisation || null,
    organisationId: typeof data.organisation_id === 'number' ? data.organisation_id : null, 
    classification: (data.classification as IssueClassification) || 'general',
    classificationDisplay: data.classification_display,
    allowedRoles: data.allowed_roles || [],
    isArchived: !!data.is_archived,
    sharedWith: data.shared_with || [],
    sharedWithDetails: (data.shared_with_details || []).map((u) => ({
      id: u.id,
      email: u.email || '',
      fullName: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || `User #${u.id}`,
    })),
    canManageAccess: !!data.can_manage_access,
  };

  if (data.domain === 'bim') {
    return {
      ...base,
      domain: 'bim',
      bcfGuid: data.bcf_guid || '',
      topicType: (data.topic_type as BcfTopicType) || 'General',
      ifcElements: data.ifc_elements || [],
      viewpoint: data.viewpoint ? {
        guid: data.viewpoint.guid,
        cameraPosition: data.viewpoint.camera_position,
        cameraDirection: data.viewpoint.camera_direction,
        cameraUpVector: data.viewpoint.camera_up_vector,
        fieldOfView: data.viewpoint.field_of_view,
        clippingPlanes: data.viewpoint.clipping_planes || [],
        snapshot: data.viewpoint.snapshot ? {
          data: data.viewpoint.snapshot,
          format: data.viewpoint.snapshot_format || 'png',
        } : undefined,
        components: (data.viewpoint.components || []).map((comp) => ({
          ifcGuid: comp.ifc_guid,
          selectionType: "IfcProduct" as const,
          visible: comp.visible !== false,
        })),
      } : undefined,
    } as BimIssue;
  }

  return {
    ...base,
    domain: 'design',
    category: data.category || '',
    attachments: data.attachments || [],
  } as DesignIssue;
}