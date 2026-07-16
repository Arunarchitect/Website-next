/* eslint-disable @typescript-eslint/no-explicit-any */

import axios from 'axios';
import {
  Issue,
  BimIssue,
  IssueComment,
  IssueStatus,
  IssuePriority,
  IssueDomain,
  IssueClassification,
  BcfTopicType,
  isBimIssue,
} from "./issueTypes";

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST;
const API_URL = `${API_BASE_URL}/api`;

export { API_BASE_URL, API_URL };

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  const token =
    localStorage.getItem('access') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('access') ||
    sessionStorage.getItem('access_token') ||
    null;

  if (!token) {
    console.warn('⚠️ No authentication token found in localStorage');
  }

  return token;
};

const getCsrfToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? match[1] : null;
};

export const getImageSource = (imageData: string | undefined, fallback?: string): string => {
  if (!imageData) {
    return fallback || '/images/test.jpg';
  }

  if (imageData.startsWith('data:image')) {
    return imageData;
  }

  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }

  if (imageData.startsWith('/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    return `${baseUrl}${imageData}`;
  }

  if (imageData.includes('issue_snapshots/') || imageData.includes('media/')) {
    const baseUrl = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
    const path = imageData.startsWith('/') ? imageData : `/${imageData}`;
    return `${baseUrl}${path}`;
  }

  if (imageData.length > 100) {
    try {
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(imageData.substring(0, 100));
      if (isBase64) {
        const isPng = imageData.startsWith('iVBORw0KGgo');
        const format = isPng ? 'png' : 'jpeg';
        return `data:image/${format};base64,${imageData}`;
      }
    } catch (e) {
      console.warn('Failed to process image data:', e);
    }
  }

  return fallback || '/images/test.jpg';
};

export const checkImageAccessibility = async (url: string): Promise<boolean> => {
  if (!url || url.startsWith('data:')) return true;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

export const validateImageUrl = (url: string): boolean => {
  if (!url) return false;
  return true;
};

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const csrfToken = getCsrfToken();
    if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      console.error(`❌ API Error ${error.response.status}:`, {
        url: error.config?.url,
        data: error.response.data,
      });

      if (error.response.status === 401) {
        const refreshToken = localStorage.getItem('refresh');
        if (refreshToken && !error.config._retry) {
          error.config._retry = true;
          try {
            const response = await axios.post(`${API_URL}/auth/refresh/`, {
              refresh: refreshToken
            });
            if (response.data.access) {
              localStorage.setItem('access', response.data.access);
              error.config.headers.Authorization = `Bearer ${response.data.access}`;
              return apiClient(error.config);
            }
          } catch {
            localStorage.removeItem('access');
            localStorage.removeItem('refresh');
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
              window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
            }
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

const mapStatusToBackend = (status: string): string => {
  const statusMap: {[key: string]: string} = {
    'Open': 'open', 'In Progress': 'in_progress', 'Resolved': 'resolved', 'Closed': 'closed',
    'open': 'open', 'in_progress': 'in_progress', 'resolved': 'resolved', 'closed': 'closed'
  };
  return statusMap[status] || 'open';
};

const mapPriorityToBackend = (priority: string): string => {
  const priorityMap: {[key: string]: string} = {
    'High': 'high', 'Medium': 'medium', 'Low': 'low',
    'high': 'high', 'medium': 'medium', 'low': 'low'
  };
  return priorityMap[priority] || 'medium';
};

const mapTopicTypeToBackend = (topicType: string): string => {
  const topicTypeMap: {[key: string]: string} = {
    'Clash': 'clash', 'Coordinate': 'coordinate', 'Quality': 'quality', 'Safety': 'safety',
    'General': 'general', 'Request': 'request', 'Fault': 'fault',
    'clash': 'clash', 'coordinate': 'coordinate', 'quality': 'quality', 'safety': 'safety',
    'general': 'general', 'request': 'request', 'fault': 'fault'
  };
  return topicTypeMap[topicType] || 'general';
};

const mapStatusToFrontend = (status: string): string => {
  const statusMap: {[key: string]: string} = {
    'open': 'Open', 'in_progress': 'In Progress', 'resolved': 'Resolved', 'closed': 'Closed'
  };
  return statusMap[status] || status;
};

const mapPriorityToFrontend = (priority: string): string => {
  const priorityMap: {[key: string]: string} = { 'high': 'High', 'medium': 'Medium', 'low': 'Low' };
  return priorityMap[priority] || priority;
};

const mapTopicTypeToFrontend = (topicType: string): BcfTopicType => {
  const topicTypeMap: {[key: string]: BcfTopicType} = {
    'clash': 'Clash', 'coordinate': 'Coordinate', 'quality': 'Quality', 'safety': 'Safety',
    'general': 'General', 'request': 'Request', 'fault': 'Fault'
  };
  return topicTypeMap[topicType] || 'General';
};

export interface AssigneeOption {
  id: number;
  displayName: string;
  email: string;
  role?: string | null;
}

export interface DeliverableOption {
  id: number;
  name: string;
}

export interface DrawingOption {
  id: number;
  title: string;
  file_type: string;
}

// ---------------------------------------------------------------------------
// Lightweight summaries used to drive the Organisation → Project → Deliverable
// filter cascade on the issues list page.
// ---------------------------------------------------------------------------

export interface OrganisationSummary {
  id: number;
  name: string;
}

export interface ProjectSummary {
  id: number;
  name: string;
  organisation_id: number;
  organisation_name: string;
}

const extractIdSafe = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id;
    return typeof id === 'number' ? id : undefined;
  }
  return undefined;
};

export async function getMyOrganisations(): Promise<OrganisationSummary[]> {
  try {
    const response = await apiClient.get('/my-organisations/');
    return response.data;
  } catch (error) {
    console.error('Error fetching organisations:', error);
    return [];
  }
}

export async function getOrganisationProjects(organisationId: number | string): Promise<ProjectSummary[]> {
  try {
    const response = await apiClient.get(`/organisations/${organisationId}/projects/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching organisation projects:', error);
    return [];
  }
}

export async function getOrganisationMembers(organisationId: number | string): Promise<AssigneeOption[]> {
  try {
    const response = await apiClient.get(`/organisations/${organisationId}/members/`);
    return response.data.map((m: any) => {
      const u = m.user || m;
      return {
        id: u.id,
        displayName:
          `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
          u.full_name ||
          u.email ||
          `User #${u.id}`,
        email: u.email || '',
        // `role` may live on the membership record (`m.role`) or, in some
        // backends, directly on the nested user object — check both.
        role: m.role ?? u.role ?? null,
      };
    });
  } catch (error) {
    console.error('Error fetching organisation members:', error);
    return [];
  }
}

/**
 * Finds the current user's own membership role within an organisation, by
 * matching against the members list. Used to gate the classification
 * dropdown (and "share with" control) on the *new issue* form, before any
 * issue exists for the backend to compute `can_manage_access` on.
 *
 * Returns null if the user isn't a member (or the lookup fails) — callers
 * should treat null as "not privileged".
 */
export async function getMyRoleInOrganisation(
  organisationId: number | string,
  currentUserId: number | null | undefined,
  currentUserEmail?: string | null
): Promise<string | null> {
  if (!organisationId || (!currentUserId && !currentUserEmail)) return null;
  try {
    const members = await getOrganisationMembers(organisationId);
    const mine = members.find((m) =>
      (currentUserId && m.id === currentUserId) ||
      (currentUserEmail && m.email && m.email.toLowerCase() === currentUserEmail.toLowerCase())
    );
    return mine?.role ?? null;
  } catch (error) {
    console.error('Error resolving current user role in organisation:', error);
    return null;
  }
}

export async function getDeliverablesForProject(projectId: number | string): Promise<DeliverableOption[]> {
  try {
    const response = await apiClient.get('/drawings/deliverables/', {
      params: { project_id: projectId },
    });
    return response.data.map((d: any) => ({
      id: d.id,
      name: d.name || d.title || `Deliverable #${d.id}`,
    }));
  } catch (error) {
    console.error('Error fetching deliverables:', error);
    return [];
  }
}

export async function getDeliverableDrawings(deliverableId: number | string): Promise<DrawingOption[]> {
  try {
    const response = await apiClient.get('/drawings/documents/', {
      params: { deliverable_id: deliverableId },
    });
    return response.data.map((d: any) => ({
      id: d.id,
      title: d.title,
      file_type: d.file_type,
    }));
  } catch (error) {
    console.error('Error fetching drawings:', error);
    return [];
  }
}

export async function getProjectDrawings(projectId: number | string): Promise<DrawingOption[]> {
  try {
    const response = await apiClient.get('/drawings/documents/', {
      params: { project_id: projectId },
    });
    return response.data.map((d: any) => ({
      id: d.id,
      title: d.title,
      file_type: d.file_type,
    }));
  } catch (error) {
    console.error('Error fetching project drawings:', error);
    return [];
  }
}

const convertDjangoIssue = (data: any): Issue => {
  const baseIssue = {
    id: String(data.id),
    title: data.title,
    description: data.description || '',
    status: mapStatusToFrontend(data.status) as IssueStatus,
    priority: mapPriorityToFrontend(data.priority) as IssuePriority,
    module: data.module || '',
    reportedBy: data.reported_by_name || data.reported_by?.email || data.reported_by?.full_name || 'Unknown',
    assignedTo: data.assigned_to_name || data.assigned_to?.email || data.assigned_to?.full_name || null,
    assignedToId: extractIdSafe(data.assigned_to) ?? null,
    project: extractIdSafe(data.project),
    project_id: extractIdSafe(data.project),
    deliverable: extractIdSafe(data.deliverable) ?? null,
    organisationId:
      typeof data.organisation_id === 'number'
        ? data.organisation_id
        : (data.organisation_details?.id ?? null),
    created: data.created,
    updated: data.updated,
    dueDate: data.due_date,
    labels: data.labels || [],
    resolution: data.resolution,
    organisation: data.organisation || data.organisation_details?.name || data.project_details?.organisation_name || null,
    linkedDocuments: (data.linked_documents_details || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      file_type: d.file_type,
    })),
    comments: (data.comments || []).map((c: any) => ({
      id: String(c.id),
      author: c.author?.email || c.author?.full_name || c.author?.username || 'Unknown',
      text: c.text,
      timestamp: c.timestamp,
      snapshot: c.snapshot ? getImageSource(c.snapshot) : null,
      viewpointGuid: c.viewpoint?.guid || null,
    })),
    // --- Access control ---
    classification: (data.classification || 'general') as IssueClassification,
    classificationDisplay: data.classification_display,
    allowedRoles: data.allowed_roles || [],
    isArchived: !!data.is_archived,
    sharedWith: (data.shared_with || []).map((v: any) => (typeof v === 'number' ? v : v?.id)).filter(Boolean),
    sharedWithDetails: (data.shared_with_details || []).map((u: any) => ({
      id: u.id,
      email: u.email || '',
      fullName:
        `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
        u.full_name ||
        u.email ||
        `User #${u.id}`,
    })),
    canManageAccess: !!data.can_manage_access,
  };

  if (data.domain === 'bim') {
    return {
      ...baseIssue,
      domain: 'bim' as const,
      bcfGuid: data.bcf_guid,
      topicType: mapTopicTypeToFrontend(data.topic_type),
      ifcElements: data.ifc_elements || [],
      viewpoint: data.viewpoint ? {
        guid: data.viewpoint.guid,
        cameraPosition: data.viewpoint.camera_position,
        cameraDirection: data.viewpoint.camera_direction,
        cameraUpVector: data.viewpoint.camera_up_vector,
        fieldOfView: data.viewpoint.field_of_view,
        clippingPlanes: data.viewpoint.clipping_planes || [],
        snapshot: data.viewpoint.snapshot ? {
          data: getImageSource(data.viewpoint.snapshot),
          format: data.viewpoint.snapshot_format || 'png',
        } : undefined,
        components: (data.viewpoint.components || []).map((comp: any) => ({
          ifcGuid: comp.ifc_guid,
          selectionType: comp.selection_type || 'IfcProduct',
          visible: comp.visible !== false,
        })),
      } : undefined,
    };
  }

  return {
    ...baseIssue,
    domain: data.domain === 'design' ? ('design' as const) : ('other' as const),
    category: data.category || '',
    attachments: (data.attachments || []).map((a: any) => {
      if (typeof a === 'string') return getImageSource(a);
      return getImageSource(a?.file || a?.url || a?.data || '');
    }).filter(Boolean),
  };
};

const convertToDjangoPayload = (issue: Partial<Issue>, includeDomain: boolean = true): any => {
  const payload: any = {};

  if (issue.project_id !== undefined && issue.project_id !== null) {
    payload.project = issue.project_id;
  } else if (issue.project !== undefined && issue.project !== null) {
    payload.project = typeof issue.project === 'number' ? issue.project : undefined;
  }

  if (issue.deliverable !== undefined) {
    payload.deliverable = issue.deliverable === null ? null : issue.deliverable;
  }

  if (includeDomain && issue.domain !== undefined) {
    payload.domain = issue.domain === 'bim' ? 'bim' : 'other';
  }

  if (issue.title !== undefined && issue.title !== '') payload.title = issue.title;
  if (issue.description !== undefined) payload.description = issue.description;
  if (issue.status !== undefined) payload.status = mapStatusToBackend(issue.status);
  if (issue.priority !== undefined) payload.priority = mapPriorityToBackend(issue.priority);
  if (issue.module !== undefined && issue.module !== '') payload.module = issue.module;

  if (issue.assignedToId !== undefined && issue.assignedToId !== null) {
    payload.assigned_to = issue.assignedToId;
  } else if (issue.assignedTo !== undefined && issue.assignedTo !== null && issue.assignedTo !== '') {
    if (!isNaN(Number(issue.assignedTo))) {
      payload.assigned_to = Number(issue.assignedTo);
    }
  }

  if (issue.dueDate !== undefined && issue.dueDate !== '') {
    payload.due_date = issue.dueDate;
  }

  if (issue.labels !== undefined && Array.isArray(issue.labels) && issue.labels.length > 0) {
    payload.labels = issue.labels;
  }

  const issueAny = issue as any;
  if (issueAny.linkedDocumentIds !== undefined && Array.isArray(issueAny.linkedDocumentIds)) {
    payload.linked_documents = issueAny.linkedDocumentIds;
  }

  if (issue.resolution !== undefined && issue.resolution !== '') {
    payload.resolution = issue.resolution;
  }

  // --- Access control: only included when explicitly set on the patch, so
  // a plain-member's edit (which never touches these) can't accidentally
  // clear them, and so the backend's privilege check only fires when the
  // user actually tried to change something access-related. ---
  if (issue.classification !== undefined) {
    payload.classification = issue.classification;
  }
  if (issue.allowedRoles !== undefined) {
    payload.allowed_roles = issue.allowedRoles;
  }
  if (issue.sharedWith !== undefined) {
    payload.shared_with = issue.sharedWith;
  }

  if (issue.domain === 'bim') {
    const bimIssue = issue as any;

    if (bimIssue.topicType !== undefined) {
      payload.topic_type = mapTopicTypeToBackend(bimIssue.topicType);
    }
    if (bimIssue.ifcElements !== undefined && Array.isArray(bimIssue.ifcElements)) {
      payload.ifc_elements = bimIssue.ifcElements;
    }

    if (bimIssue.viewpoint) {
      const viewpoint = bimIssue.viewpoint;

      const viewpointPayload: any = {
        camera_position: viewpoint.camera_position || viewpoint.cameraPosition || { x: 0, y: 0, z: 0 },
        camera_direction: viewpoint.camera_direction || viewpoint.cameraDirection || { x: 0, y: 0, z: -1 },
        camera_up_vector: viewpoint.camera_up_vector || viewpoint.cameraUpVector || { x: 0, y: 1, z: 0 },
        field_of_view: viewpoint.field_of_view ?? viewpoint.fieldOfView ?? 60,
        clipping_planes: viewpoint.clipping_planes || viewpoint.clippingPlanes || [],
      };

      const snapshotData = viewpoint.snapshot_data ?? viewpoint.snapshot?.data;
      const snapshotFormat = viewpoint.snapshot_format ?? viewpoint.snapshot?.format;

      if (snapshotData) {
        viewpointPayload.snapshot_data = snapshotData;
        viewpointPayload.snapshot_format = snapshotFormat || 'png';
      } else if (viewpoint.clear_snapshot === true) {
        viewpointPayload.clear_snapshot = true;
      }

      payload.viewpoint = viewpointPayload;
    }
  }

  if (issue.domain === 'other' || issue.domain === 'design') {
    const designIssue = issue as any;
    if (designIssue.category !== undefined && designIssue.category !== '') {
      payload.category = designIssue.category;
    }

    if (designIssue.newAttachmentData) {
      payload.new_attachment_data = designIssue.newAttachmentData;
      payload.new_attachment_format = designIssue.newAttachmentFormat || 'png';
    }

    if (designIssue.attachments !== undefined && Array.isArray(designIssue.attachments)) {
      payload.attachments = designIssue.attachments;
    }

    if (designIssue.removeAttachmentIndex !== undefined) {
      payload.remove_attachment_index = designIssue.removeAttachmentIndex;
    }
  }

  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
};

export async function getIssues(params?: {
  project?: number;
  domain?: string;
  status?: string;
  assigned_to?: number;
  deliverable?: number;
  classification?: string;
}): Promise<Issue[]> {
  try {
    const response = await apiClient.get('/issues/issues/', { params });
    return response.data.map(convertDjangoIssue);
  } catch (error) {
    console.error('❌ Error fetching issues:', error);
    throw error;
  }
}

export async function getIssue(id: string | number): Promise<Issue | undefined> {
  try {
    const response = await apiClient.get(`/issues/issues/${id}/`);
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    console.error('Error fetching issue:', error);
    throw error;
  }
}

export async function createIssue(input: any): Promise<Issue> {
  try {
    const payload = convertToDjangoPayload({
      ...input,
      project: input.project_id || input.project,
    });
    const response = await apiClient.post('/issues/issues/', payload);
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Server validation errors:', error.response.data);
    }
    console.error('Error creating issue:', error);
    throw error;
  }
}

export async function updateIssue(id: string | number, patch: Partial<Issue>): Promise<Issue | undefined> {
  try {
    const payload = convertToDjangoPayload({
      ...patch,
      project: patch.project_id || patch.project,
    }, false);

    const response = await apiClient.patch(`/issues/issues/${id}/`, payload);
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error updating issue - Response data:', error.response.data);
    }
    console.error('Error updating issue:', error);
    throw error;
  }
}

/**
 * Admin-only: update classification / allowedRoles / sharedWith on an issue
 * the current user did NOT create. Hits the dedicated /access/ endpoint,
 * which only requires org-admin (or staff/superuser), not "is reporter".
 *
 * Sends only these three fields — never title/status/etc — so it can never
 * accidentally clobber the reporter's content, and so it passes even if the
 * caller isn't the reporter (which the main PATCH endpoint restricts).
 */
export async function updateIssueAccess(
  id: string | number,
  access: {
    classification?: IssueClassification;
    allowedRoles?: string[];
    sharedWith?: number[];
  }
): Promise<Issue | undefined> {
  try {
    const payload: any = {};
    if (access.classification !== undefined) payload.classification = access.classification;
    if (access.allowedRoles !== undefined) payload.allowed_roles = access.allowedRoles;
    if (access.sharedWith !== undefined) payload.shared_with = access.sharedWith;

    const response = await apiClient.patch(`/issues/issues/${id}/access/`, payload);
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error('Only organisation admins can manage access for this issue.');
    }
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error updating issue access:', error.response.data);
    }
    console.error('Error updating issue access:', error);
    throw error;
  }
}

export async function resolveIssue(
  id: string | number,
  resolution: string,
  resolvedBy?: string,
  snapshotData?: string,
  snapshotFormat?: "png" | "jpg"
): Promise<Issue | undefined> {
  try {
    const payload: any = { resolution };
    if (snapshotData) {
      payload.snapshot_data = snapshotData;
      payload.snapshot_format = snapshotFormat || 'png';
    }
    const response = await apiClient.post(`/issues/issues/${id}/resolve/`, payload);
    return convertDjangoIssue(response.data.issue);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    console.error('Error resolving issue:', error);
    throw error;
  }
}

export async function deleteIssue(id: string | number): Promise<void> {
  try {
    await apiClient.delete(`/issues/issues/${id}/`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403) {
        throw new Error('You can only delete issues you created.');
      }
    }
    console.error('❌ Error deleting issue:', error);
    throw error;
  }
}

export async function removeSnapshot(id: string | number): Promise<Issue | undefined> {
  return updateIssue(id, {
    domain: 'bim',
    viewpoint: { clear_snapshot: true },
  } as any);
}

export async function removeAttachment(id: string | number, index: number): Promise<Issue | undefined> {
  return updateIssue(id, {
    domain: 'other',
    removeAttachmentIndex: index,
  } as any);
}

export async function addComment(
  id: string | number,
  author: string,
  text: string,
  snapshotData?: string,
  snapshotFormat?: "png" | "jpg"
): Promise<Issue | undefined> {
  try {
    const payload: any = { text };
    if (snapshotData) {
      payload.snapshot_data = snapshotData;
      payload.snapshot_format = snapshotFormat || 'png';
    }
    await apiClient.post(`/issues/issues/${id}/add-comment/`, payload);
    return await getIssue(id);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error adding comment:', error.response.data);
    } else {
      console.error('❌ Error adding comment:', error);
    }
    throw error;
  }
}

export async function addCommentWithSnapshot(
  id: string | number,
  author: string,
  text: string,
  snapshotData?: string,
  snapshotFormat?: "png" | "jpg"
): Promise<Issue | undefined> {
  return addComment(id, author, text, snapshotData, snapshotFormat);
}

export async function getComments(id: string | number): Promise<IssueComment[]> {
  try {
    const response = await apiClient.get(`/issues/issues/${id}/comments/`);
    return response.data.map((c: any) => ({
      id: String(c.id),
      author: c.author?.email || c.author?.username || 'Unknown',
      text: c.text,
      timestamp: c.timestamp,
      snapshot: c.snapshot ? getImageSource(c.snapshot) : null,
      viewpointGuid: c.viewpoint?.guid || null,
    }));
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

export async function deleteComment(
  issueId: string | number,
  commentId: string | number
): Promise<void> {
  try {
    await apiClient.delete(`/issues/comments/${commentId}/`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403) {
        throw new Error('You can only delete your own comments.');
      }
      if (error.response.status === 404) {
        throw new Error('Comment not found.');
      }
    }
    console.error('❌ Error deleting comment:', error);
    throw error;
  }
}

export async function editComment(
  issueId: string | number,
  commentId: string | number,
  text: string,
  snapshotData?: string,
  snapshotFormat?: "png" | "jpg",
  removeSnapshot?: boolean
): Promise<IssueComment> {
  try {
    const payload: any = { text };

    if (snapshotData) {
      payload.snapshot_data = snapshotData;
      payload.snapshot_format = snapshotFormat || 'png';
    } else if (removeSnapshot) {
      payload.snapshot_data = null;
      payload.snapshot_format = null;
    }

    const response = await apiClient.patch(`/issues/comments/${commentId}/`, payload);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403) {
        throw new Error('You can only edit your own comments.');
      }
      if (error.response.status === 404) {
        throw new Error('Comment not found.');
      }
    }
    console.error('❌ Error editing comment:', error);
    throw error;
  }
}

export async function linkIssue(id: string | number, linkedIssueId: string | number): Promise<void> {
  try {
    await apiClient.post(`/issues/issues/${id}/link-issue/`, { linked_issue_id: linkedIssueId });
  } catch (error) {
    console.error('Error linking issue:', error);
    throw error;
  }
}

export async function unlinkIssue(id: string | number, linkedIssueId: string | number): Promise<void> {
  try {
    await apiClient.post(`/issues/issues/${id}/unlink-issue/`, { linked_issue_id: linkedIssueId });
  } catch (error) {
    console.error('Error unlinking issue:', error);
    throw error;
  }
}

export async function getViewpoint(id: string | number): Promise<any> {
  try {
    const response = await apiClient.get(`/issues/issues/${id}/viewpoint/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    console.error('Error fetching viewpoint:', error);
    throw error;
  }
}

export async function toBcfTopic(issue: BimIssue): Promise<any> {
  try {
    const response = await apiClient.get(`/issues/issues/${issue.id}/export-bcf/`);
    return response.data;
  } catch (error) {
    console.error('Error exporting to BCF:', error);
    throw error;
  }
}

export async function toBcfTopicWithSnapshots(issue: BimIssue): Promise<any> {
  try {
    const response = await apiClient.get(`/issues/issues/${issue.id}/export-bcf/?include_snapshots=true`);
    return response.data;
  } catch (error) {
    console.error('Error exporting to BCF with snapshots:', error);
    throw error;
  }
}

export async function fromBcfTopic(topic: any, projectId: number): Promise<Issue> {
  try {
    const response = await apiClient.post('/issues/issues/import-bcf/', {
      project: projectId,
      topic_data: topic,
      module: 'BIM Coordination',
    });
    return convertDjangoIssue(response.data);
  } catch (error) {
    console.error('Error importing BCF topic:', error);
    throw error;
  }
}

export const getIssuesByTopicType = async (type: BcfTopicType) => {
  const issues = await getIssues();
  return issues.filter(isBimIssue).filter((i) => i.topicType === type);
};

export const getIssuesByAssignee = async (assignee: string) => {
  const issues = await getIssues();
  return issues.filter((i) => i.assignedTo === assignee);
};

export const getIssuesByDomain = async (domain: IssueDomain) => {
  const issues = await getIssues();
  return issues.filter((i) => i.domain === domain);
};

export const getIssuesByIfcElement = async (ifcGuid: string) => {
  const issues = await getIssues();
  return issues.filter(isBimIssue).filter((i) => i.ifcElements?.includes(ifcGuid));
};

export const getMyIssues = async (): Promise<Issue[]> => {
  try {
    const response = await apiClient.get('/issues/my-issues/');
    return response.data.map(convertDjangoIssue);
  } catch (error) {
    console.error('Error fetching my issues:', error);
    throw error;
  }
};

export const getStatusColor = (status: IssueStatus): string => {
  switch (status) {
    case 'Resolved': return '#4A8B6B';
    case 'Closed': return '#6B7280';
    case 'In Progress': return '#E8A838';
    default: return '#D43E3E';
  }
};

export const getPriorityColor = (priority: IssuePriority): string => {
  switch (priority) {
    case 'High': return '#D43E3E';
    case 'Medium': return '#E8A838';
    default: return '#4A8B6B';
  }
};

const issueApi = {
  getIssues,
  getIssue,
  createIssue,
  updateIssue,
  updateIssueAccess,
  resolveIssue,
  deleteIssue,
  removeSnapshot,
  removeAttachment,
  addComment,
  addCommentWithSnapshot,
  getComments,
  deleteComment,
  editComment,
  linkIssue,
  unlinkIssue,
  getViewpoint,
  toBcfTopic,
  toBcfTopicWithSnapshots,
  fromBcfTopic,
  getIssuesByTopicType,
  getIssuesByAssignee,
  getIssuesByDomain,
  getIssuesByIfcElement,
  getMyIssues,
  getMyOrganisations,
  getOrganisationProjects,
  getOrganisationMembers,
  getMyRoleInOrganisation,
  getDeliverablesForProject,
  getDeliverableDrawings,
  getProjectDrawings,
  getStatusColor,
  getPriorityColor,
};

export default issueApi;