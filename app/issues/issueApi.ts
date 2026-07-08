import {
  Issue,
  BimIssue,
  IssueComment,
  IssueStatus,
  IssuePriority,
  IssueDomain,
  BcfTopicType,
  isBimIssue,
} from "./issueTypes";

// ---------------------------------------------------------------------------
// MOCK DATA STORE
// ---------------------------------------------------------------------------

// Use the image URL from public folder
const TRIAL_IMAGE_URL = "/images/tes.jpg";

let db: Issue[] = [
  {
    id: "1",
    domain: "bim",
    bcfGuid: "bcf-001",
    topicType: "Quality",
    title: "Dimension annotations in 3D views",
    description:
      "Dimension annotations currently measure in the projection plane instead of true 3D space.",
    status: "Open",
    priority: "High",
    module: "Annotation",
    reportedBy: "John Smith",
    assignedTo: "Sarah Wilson",
    created: "2026-07-08T06:00:00Z",
    viewpoint: {
      guid: "vp-001",
      cameraPosition: { x: 25.0, y: 15.0, z: 10.0 },
      cameraDirection: { x: -0.5, y: -0.3, z: 0.2 },
      snapshot: {
        data: TRIAL_IMAGE_URL,
        format: "jpg"
      }
    },
    ifcElements: ["3hVqYH9nL9", "4wRxZJ6mK2"],
    comments: [
      {
        id: "c1",
        author: "John Smith",
        text: "This appears in all elevation views.",
        timestamp: "2026-07-08T06:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      },
    ],
  },
  {
    id: "2",
    domain: "bim",
    bcfGuid: "bcf-002",
    topicType: "General",
    title: "IFC export performance",
    description: "Large IFC models take significantly longer to export than expected.",
    status: "In Progress",
    priority: "Medium",
    module: "IFC",
    reportedBy: "Sarah Wilson",
    assignedTo: "Michael Brown",
    created: "2026-07-08T03:00:00Z",
    updated: "2026-07-08T05:00:00Z",
    dueDate: "2026-07-20",
    viewpoint: {
      guid: "vp-002",
      cameraPosition: { x: 0, y: 0, z: 50 },
      cameraDirection: { x: 0, y: 0, z: -1 },
      components: [{ ifcGuid: "5tXqH9nL9a", selectionType: "IfcProduct" }],
      snapshot: {
        data: TRIAL_IMAGE_URL,
        format: "jpg"
      }
    },
    ifcElements: ["5tXqH9nL9a", "6uRyK0oM3b", "7vSzL1pN4c"],
    comments: [
      {
        id: "c2",
        author: "Sarah Wilson",
        text: "Identified bottlenecks in the geometry conversion algorithm.",
        timestamp: "2026-07-08T05:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      },
    ],
  },
  {
    id: "3",
    domain: "bim",
    bcfGuid: "bcf-003",
    topicType: "Quality",
    title: "Wall join inconsistencies",
    description: "Some wall connections fail to clean correctly after editing geometry.",
    status: "Resolved",
    priority: "Low",
    module: "Modeling",
    reportedBy: "David Lee",
    assignedTo: "Emma Davis",
    created: "2026-07-07T09:00:00Z",
    updated: "2026-07-07T16:00:00Z",
    resolution: "Fixed in v2.3.1",
    viewpoint: {
      guid: "vp-003",
      cameraPosition: { x: 12.5, y: 8.0, z: 3.0 },
      cameraDirection: { x: -0.8, y: -0.2, z: 0.1 },
      snapshot: {
        data: TRIAL_IMAGE_URL,
        format: "jpg"
      }
    },
    ifcElements: ["8wAzM2oN5d", "9xBzN3pO6e"],
    comments: [
      {
        id: "c3",
        author: "David Lee",
        text: "This bug was causing significant coordination issues.",
        timestamp: "2026-07-07T09:00:00Z",
      },
      {
        id: "c4",
        author: "Emma Davis",
        text: "Fix verified. Closing this issue.",
        timestamp: "2026-07-07T16:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      },
    ],
  },
  {
    id: "4",
    domain: "bim",
    bcfGuid: "bcf-004",
    topicType: "Clash",
    title: "Crash when importing DWG",
    description: "Certain AutoCAD files cause an unexpected application crash during import.",
    status: "Open",
    priority: "High",
    module: "Import",
    reportedBy: "Emma Davis",
    assignedTo: "David Lee",
    created: "2026-07-07T08:00:00Z",
    ifcElements: ["10CaO4qP7f"],
    comments: [
      {
        id: "c5",
        author: "Emma Davis",
        text: "Most affected files come from structural consultants.",
        timestamp: "2026-07-07T08:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      },
    ],
  },
  {
    id: "5",
    domain: "bim",
    bcfGuid: "bcf-005",
    topicType: "General",
    title: "Material preview not updating",
    description: "Changing materials does not refresh the viewport until reopening the project.",
    status: "In Progress",
    priority: "Medium",
    module: "Rendering",
    reportedBy: "Michael Brown",
    assignedTo: "Sarah Wilson",
    created: "2026-07-06T10:00:00Z",
    updated: "2026-07-07T10:00:00Z",
    dueDate: "2026-07-18",
    viewpoint: {
      guid: "vp-005",
      cameraPosition: { x: 30.0, y: 20.0, z: 15.0 },
      cameraDirection: { x: -0.6, y: -0.4, z: 0.3 },
      clippingPlanes: [{ x: 0, y: 0, z: 1, d: 10 }],
      snapshot: {
        data: TRIAL_IMAGE_URL,
        format: "jpg"
      }
    },
    ifcElements: ["11DbP5rQ8g", "12EcQ6sR9h"],
    comments: [
      {
        id: "c6",
        author: "Michael Brown",
        text: "Seems related to the new rendering pipeline.",
        timestamp: "2026-07-07T10:00:00Z",
      },
    ],
  },
  {
    id: "6",
    domain: "bim",
    bcfGuid: "bcf-006",
    topicType: "Clash",
    title: "Clash between structural columns and MEP ducts",
    description: "Structural columns are interfering with main MEP duct routes on levels 2-4.",
    status: "Open",
    priority: "High",
    module: "Clash Detection",
    reportedBy: "Linda Martinez",
    assignedTo: "Robert Chen",
    created: "2026-07-08T05:00:00Z",
    viewpoint: {
      guid: "vp-006",
      cameraPosition: { x: 40.0, y: 25.0, z: 8.0 },
      cameraDirection: { x: -0.3, y: -0.5, z: 0.2 },
      components: [
        { ifcGuid: "13EfR7tS0i", selectionType: "IfcProduct" },
        { ifcGuid: "14FgS8uT1j", selectionType: "IfcProduct" },
      ],
      snapshot: {
        data: TRIAL_IMAGE_URL,
        format: "jpg"
      }
    },
    ifcElements: ["13EfR7tS0i", "14FgS8uT1j", "15GhT9vU2k"],
    comments: [
      {
        id: "c7",
        author: "Linda Martinez",
        text: "Need to coordinate with structural team to resolve.",
        timestamp: "2026-07-08T05:00:00Z",
      },
    ],
  },
  {
    id: "7",
    domain: "bim",
    bcfGuid: "bcf-007",
    topicType: "Safety",
    title: "Missing fire-rated walls in export",
    description:
      "Fire-rated walls are not being properly exported to IFC, losing critical fire compartmentation data.",
    status: "In Progress",
    priority: "High",
    module: "Export",
    reportedBy: "Robert Chen",
    assignedTo: "Linda Martinez",
    created: "2026-07-07T04:00:00Z",
    updated: "2026-07-07T18:00:00Z",
    dueDate: "2026-07-22",
    viewpoint: {
      guid: "vp-007",
      cameraPosition: { x: 55.0, y: 30.0, z: 12.0 },
      cameraDirection: { x: -0.4, y: -0.3, z: 0.1 },
    },
    ifcElements: ["16IiU9wV3l", "17JjV0xW4m"],
    comments: [
      {
        id: "c8",
        author: "Robert Chen",
        text: "This is a major issue for building safety compliance.",
        timestamp: "2026-07-07T18:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      },
    ],
  },
  // --- Non-BIM design issues (no IFC / BCF fields) --------------------------
  {
    id: "8",
    domain: "design",
    category: "Documentation",
    title: "Finish schedule spec review pending",
    description:
      "Interior finish schedule hasn't been reviewed against the updated client brief.",
    status: "Open",
    priority: "Medium",
    module: "Documentation",
    reportedBy: "Anita Rao",
    assignedTo: "David Lee",
    created: "2026-07-08T02:00:00Z",
    dueDate: "2026-07-15",
    comments: [
      {
        id: "c9",
        author: "Anita Rao",
        text: "Waiting on the client's material selections before sign-off.",
        timestamp: "2026-07-08T02:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      },
    ],
  },
  {
    id: "9",
    domain: "design",
    category: "Coordination",
    title: "Lobby design sign-off delayed",
    description: "Client hasn't approved the revised lobby concept, blocking downstream detailing.",
    status: "Open",
    priority: "High",
    module: "Coordination",
    reportedBy: "Michael Brown",
    created: "2026-07-08T01:00:00Z",
    comments: [
      {
        id: "c10",
        author: "Michael Brown",
        text: "Need to schedule a follow-up meeting with client.",
        timestamp: "2026-07-08T01:00:00Z",
        snapshot: TRIAL_IMAGE_URL
      }
    ],
  },
];

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getIssues(): Promise<Issue[]> {
  return [...db];
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  return db.find((i) => i.id === id);
}

export type NewIssueInput =
  | (Omit<BimIssue, "id" | "created" | "updated" | "comments" | "bcfGuid"> & {
      comments?: IssueComment[];
      bcfGuid?: string;
    })
  | (Omit<Issue, "id" | "created" | "updated" | "comments"> & { comments?: IssueComment[] });

export async function createIssue(input: NewIssueInput): Promise<Issue> {
  const now = new Date().toISOString();
  const base = {
    ...input,
    id: genId(),
    created: now,
    comments: input.comments ?? [],
  };
  const issue: Issue =
    base.domain === "bim"
      ? ({ ...(base as any), bcfGuid: (base as any).bcfGuid || `bcf-${genId()}` } as BimIssue)
      : (base as Issue);

  db = [issue, ...db];
  return issue;
}

export async function updateIssue(id: string, patch: Partial<Issue>): Promise<Issue | undefined> {
  let updated: Issue | undefined;
  db = db.map((issue) => {
    if (issue.id !== id) return issue;
    updated = { ...issue, ...patch, updated: new Date().toISOString() } as Issue;
    return updated;
  });
  return updated;
}

export async function resolveIssue(
  id: string,
  resolution: string,
  resolvedBy: string
): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  const comment: IssueComment = {
    id: genId(),
    author: resolvedBy,
    text: resolution,
    timestamp: new Date().toISOString(),
  };
  return updateIssue(id, {
    status: "Resolved",
    resolution,
    comments: [...issue.comments, comment],
  });
}

export async function addComment(id: string, author: string, text: string): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  const comment: IssueComment = { id: genId(), author, text, timestamp: new Date().toISOString() };
  return updateIssue(id, { comments: [...issue.comments, comment] });
}

export async function deleteIssue(id: string): Promise<void> {
  db = db.filter((i) => i.id !== id);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const getIssuesByTopicType = async (type: BcfTopicType) =>
  (await getIssues()).filter(isBimIssue).filter((i) => i.topicType === type);

export const getIssuesByAssignee = async (assignee: string) =>
  (await getIssues()).filter((i) => i.assignedTo === assignee);

export const getIssuesByDomain = async (domain: IssueDomain) =>
  (await getIssues()).filter((i) => i.domain === domain);

export const getIssuesByIfcElement = async (ifcGuid: string) =>
  (await getIssues()).filter(isBimIssue).filter((i) => i.ifcElements?.includes(ifcGuid));

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const getStatusColor = (status: IssueStatus) => {
  switch (status) {
    case "Resolved":
      return "#4A8B6B";
    case "Closed":
      return "#6B7280";
    case "In Progress":
      return "#E8A838";
    default:
      return "#D43E3E";
  }
};

export const getPriorityColor = (priority: IssuePriority) => {
  switch (priority) {
    case "High":
      return "#D43E3E";
    case "Medium":
      return "#E8A838";
    default:
      return "#4A8B6B";
  }
};

// ---------------------------------------------------------------------------
// BCF interop
// ---------------------------------------------------------------------------

export function toBcfTopic(issue: BimIssue) {
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
    assigned_to: issue.assignedTo,
    due_date: issue.dueDate,
    labels: issue.labels ?? [],
    comments: issue.comments.map((c) => ({
      guid: c.id,
      date: c.timestamp,
      author: c.author,
      comment: c.text,
      viewpoint_guid: c.viewpointGuid,
    })),
  };
}

export function fromBcfTopic(topic: any, module = "BIM Coordination"): BimIssue {
  return {
    id: topic.guid,
    domain: "bim",
    bcfGuid: topic.guid,
    topicType: (topic.topic_type as BcfTopicType) ?? "General",
    title: topic.title,
    description: topic.description ?? "",
    status: (topic.topic_status as IssueStatus) ?? "Open",
    priority: (topic.priority as IssuePriority) ?? "Medium",
    module,
    reportedBy: topic.creation_author,
    assignedTo: topic.assigned_to,
    created: topic.creation_date,
    updated: topic.modified_date,
    dueDate: topic.due_date,
    labels: topic.labels ?? [],
    comments: (topic.comments ?? []).map((c: any) => ({
      id: c.guid,
      author: c.author,
      text: c.comment,
      timestamp: c.date,
      viewpointGuid: c.viewpoint_guid,
    })),
  };
}

// ---------------------------------------------------------------------------
// Screenshot handling
// ---------------------------------------------------------------------------

export async function addCommentWithSnapshot(
  id: string, 
  author: string, 
  text: string, 
  snapshotData?: string // URL or base64 image
): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  
  const comment: IssueComment = { 
    id: genId(), 
    author, 
    text, 
    timestamp: new Date().toISOString(),
    snapshot: snapshotData
  };
  return updateIssue(id, { comments: [...issue.comments, comment] });
}

export function toBcfTopicWithSnapshots(issue: BimIssue) {
  const base = toBcfTopic(issue);
  
  const snapshots: any[] = [];
  if (issue.viewpoint?.snapshot) {
    snapshots.push({
      guid: issue.viewpoint.guid,
      snapshot: issue.viewpoint.snapshot.data,
      snapshot_type: issue.viewpoint.snapshot.format,
    });
  }
  
  const commentSnapshots = issue.comments
    .filter(c => c.viewpointGuid && c.snapshot)
    .map(c => ({
      guid: c.viewpointGuid!,
      snapshot: c.snapshot,
      snapshot_type: "png"
    }));
  
  return {
    ...base,
    snapshots: [...snapshots, ...commentSnapshots]
  };
}