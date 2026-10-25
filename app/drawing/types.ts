export interface Organisation {
  id: number;
  name: string;
  // From /drawings/organisations/: true when the user is an org-wide
  // admin/manager/member there (i.e. may upload). Undefined = unknown.
  can_upload?: boolean;
}

export interface Project {
  id: number;
  organisation_id: number;
  name: string;
  client_name: string;
  location: string;
}

export interface Deliverable {
  id: number;
  project_id: number;
  name: string;
  stage: string;
  status: string;
  stage_name?: string;
  status_name?: string;
}

export type DrawingStatus = 'draft' | 'published' | 'archived';

/**
 * approved  = published
 * pending   = draft awaiting admin review
 * rejected  = draft rejected by an admin (not public), reason in rejection_reason
 * archived  = archived
 */
export type ReviewState = 'pending' | 'approved' | 'rejected' | 'archived';

/** Server-computed per-document, per-user capabilities (UI hints only). */
export interface DrawingPermissions {
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_archive: boolean;
  can_restore: boolean;
  can_view_activity: boolean;
}

export interface DrawingDocument {
  id: number;
  deliverable_id: number;
  title: string;
  description: string;
  file_type: 'pdf' | 'image' | 'document' | 'dxf' | 'ifc';
  file_url: string;
  thumbnail_url?: string;
  uploaded_at: string;
  uploaded_by?: number | null;
  uploaded_by_name: string;
  category: string;
  size: number;
  is_favorite: boolean;
  tags: string[];
  version: string;
  status: DrawingStatus;
  file_path?: string;
  is_private: boolean;
  allowed_roles?: string[];
  is_public: boolean;
  // Present only on the detail serializer response (DrawingDocumentSerializer),
  // never on the list serializer. null/undefined means no single-drawing guest
  // link currently exists for this document.
  guest_access_code?: string | null;

  // ── approval workflow ──
  review_state?: ReviewState;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejected_by_name?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string;
  permissions?: DrawingPermissions;
}

export interface DrawingDocumentResolved extends DrawingDocument {
  deliverable_name: string;
  project_id: number;
  project_name: string;
  organisation_id: number;
  organisation_name: string;
}

export interface UserContext {
  id: number;
  name: string;
  email: string;
  roles: string[];
  hasDrawingPrivateAccess: boolean;
  organisationIds: number[];
}

export interface DrawingDocumentFormData {
  deliverable_id: number;
  title: string;
  description: string;
  file_type: 'pdf' | 'image' | 'document' | 'dxf' | 'ifc';
  file?: File | null;
  thumbnail?: File | null;
  category: string;
  version: string;
  // Ignored by the API now (status only changes via approve/reject/archive/
  // restore). Kept optional so older code that still sets it compiles.
  status?: DrawingStatus;
  tags: string[];
  is_private: boolean;
  allowed_roles: string[];
}

// Kept in sync with drawingApi.ts (prefer importing from there).
export interface DocumentFilters {
  organisationId?: number;
  projectId?: number;
  deliverableId?: number;
  search?: string;
  showPrivate?: boolean;
  page?: number;
  pageSize?: number;
  ordering?: string;
  status?: DrawingStatus;
  reviewState?: 'pending' | 'rejected';
  mine?: boolean;
}

export interface PaginatedDocuments {
  results: DrawingDocumentResolved[];
  count: number;
  next: string | null;
  previous: string | null;
}

export type ActivityAction =
  | 'uploaded'
  | 'edited'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'restored'
  | 'deleted'
  | 'link_created'
  | 'link_revoked';

export interface DrawingActivity {
  id: number;
  organisation_id: number;
  organisation_name: string;
  document_id: number | null; // null once the drawing has been deleted
  document_title: string;
  project_name: string;
  deliverable_name: string;
  actor_id: number | null;
  actor_name: string;
  action: ActivityAction;
  action_display: string;
  note: string;
  created_at: string;
}

export interface PaginatedActivity {
  results: DrawingActivity[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface OrganisationOption {
  id: number;
  name: string;
}

export interface ProjectOption {
  id: number;
  organisation_id: number;
  name: string;
  client_name: string;
}

export interface DeliverableOption {
  id: number;
  project_id: number;
  name: string;
  stage_name?: string;
  status_name?: string;
}