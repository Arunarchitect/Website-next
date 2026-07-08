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
export type IssueDomain = "bim" | "design";

// BCF topic_type is free text in the spec, but this set matches what most
// BCF servers ship by default.
export type BcfTopicType =
  | "Clash"
  | "Coordinate"
  | "Quality"
  | "Safety"
  | "General"
  | "Request"
  | "Fault";

export interface IssueComment {
  id: string;
  author: string;
  text: string;
  timestamp: string; // ISO 8601
  viewpointGuid?: string; // BCF: comment can reference a specific viewpoint
}

// In issueTypes.ts - update BcfViewpoint interface
export interface BcfViewpoint {
  guid: string;
  cameraPosition: { x: number; y: number; z: number };
  cameraDirection: { x: number; y: number; z: number };
  cameraUpVector?: { x: number; y: number; z: number };
  fieldOfView?: number;
  clippingPlanes?: Array<{ x: number; y: number; z: number; d: number }>;
  components?: Array<{ ifcGuid: string; selectionType: "IfcProduct"; visible?: boolean }>;
  snapshot?: {
    data: string; // base64 encoded image
    format: "png" | "jpg";
    width?: number;
    height?: number;
  };
}

// Add this for BCF import/export
export interface BcfSnapshot {
  guid: string; // viewpoint guid
  snapshot: string; // base64 or URL
  snapshot_type: "png" | "jpg";
}

// Update IssueComment
export interface IssueComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  viewpointGuid?: string;
  snapshot?: string; // base64 or URL
}


interface BaseIssue {
  id: string; // internal id (uuid)
  domain: IssueDomain;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  module: string; // e.g. "Modeling", "Import", "Documentation"
  reportedBy: string;
  assignedTo?: string;
  created: string; // ISO 8601
  updated?: string; // ISO 8601
  dueDate?: string; // ISO 8601 date
  labels?: string[]; // BCF: labels[]
  comments: IssueComment[];
  linkedIssues?: string[]; // BCF: related_topic
  resolution?: string;
}

// Model-linked issue -> BCF Topic
export interface BimIssue extends BaseIssue {
  domain: "bim";
  bcfGuid: string; // BCF topic guid
  topicType: BcfTopicType; // BCF topic_type
  ifcElements?: string[]; // IFC GUIDs of affected elements
  viewpoint?: BcfViewpoint;
}

// Non-model design issue
export interface DesignIssue extends BaseIssue {
  domain: "design";
  category?: string; // e.g. "Documentation", "Schedule", "Coordination"
  attachments?: string[]; // file URLs, no IFC involved
}

export type Issue = BimIssue | DesignIssue;

export const isBimIssue = (issue: Issue): issue is BimIssue => issue.domain === "bim";
export const isDesignIssue = (issue: Issue): issue is DesignIssue => issue.domain === "design";