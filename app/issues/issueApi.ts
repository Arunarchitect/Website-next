// issues/issueApi.ts

/* eslint-disable @typescript-eslint/no-explicit-any */

import axios from 'axios';
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
// API CONFIGURATION
// ---------------------------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api`;

// Helper to get auth token with the correct key
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  const token =
    localStorage.getItem('access') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('access') ||
    sessionStorage.getItem('access_token') ||
    null;

  if (token) {
    console.log('🔑 Token found, length:', token.length);
  } else {
    console.warn('⚠️ No authentication token found in localStorage');
  }

  return token;
};

// Get CSRF token from cookies (if needed)
const getCsrfToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? match[1] : null;
};

// ✅ UPDATED: Helper to safely get image source with fallback
// issues/issueApi.ts

// Find the getImageSource function (around line 70-110) and replace it with:

export const getImageSource = (imageData: string | undefined, fallback?: string): string => {
  // ✅ Use test.jpg as the default placeholder
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

  console.warn('Unable to process image data:', imageData.substring(0, 50) + '...');
  return fallback || '/images/test.jpg'; // ✅ Use test.jpg as fallback
};

// ✅ NEW: Helper to check if an image URL is accessible
export const checkImageAccessibility = async (url: string): Promise<boolean> => {
  if (!url || url.startsWith('data:')) return true;
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

// ✅ NEW: Helper to validate image URL
export const validateImageUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('data:')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Return true for remote URLs, they'll be handled by onError
    return true;
  }
  // For local media paths, return true but they'll be handled by onError
  return true;
};

// Axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url} - Auth header added`);
    } else {
      console.warn(`📤 ${config.method?.toUpperCase()} ${config.url} - No auth token`);
    }

    const csrfToken = getCsrfToken();
    if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    if (error.response) {
      console.error(`❌ API Error ${error.response.status}:`, {
        url: error.config?.url,
        data: error.response.data,
      });

      if (error.response.status === 401) {
        console.warn('🔒 Unauthorized - token may be expired or invalid');

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
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
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

// ---------------------------------------------------------------------------
// Helper to map frontend enums to backend enums
// ---------------------------------------------------------------------------

const mapStatusToBackend = (status: string): string => {
  const statusMap: {[key: string]: string} = {
    'Open': 'open',
    'In Progress': 'in_progress',
    'Resolved': 'resolved',
    'Closed': 'closed',
    'open': 'open',
    'in_progress': 'in_progress',
    'resolved': 'resolved',
    'closed': 'closed'
  };
  return statusMap[status] || 'open';
};

const mapPriorityToBackend = (priority: string): string => {
  const priorityMap: {[key: string]: string} = {
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low',
    'high': 'high',
    'medium': 'medium',
    'low': 'low'
  };
  return priorityMap[priority] || 'medium';
};

const mapTopicTypeToBackend = (topicType: string): string => {
  const topicTypeMap: {[key: string]: string} = {
    'Clash': 'clash',
    'Coordinate': 'coordinate',
    'Quality': 'quality',
    'Safety': 'safety',
    'General': 'general',
    'Request': 'request',
    'Fault': 'fault',
    'clash': 'clash',
    'coordinate': 'coordinate',
    'quality': 'quality',
    'safety': 'safety',
    'general': 'general',
    'request': 'request',
    'fault': 'fault'
  };
  return topicTypeMap[topicType] || 'general';
};

const mapStatusToFrontend = (status: string): string => {
  const statusMap: {[key: string]: string} = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed'
  };
  return statusMap[status] || status;
};

const mapPriorityToFrontend = (priority: string): string => {
  const priorityMap: {[key: string]: string} = {
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
  };
  return priorityMap[priority] || priority;
};

const mapTopicTypeToFrontend = (topicType: string): string => {
  const topicTypeMap: {[key: string]: string} = {
    'clash': 'Clash',
    'coordinate': 'Coordinate',
    'quality': 'Quality',
    'safety': 'Safety',
    'general': 'General',
    'request': 'Request',
    'fault': 'Fault'
  };
  return topicTypeMap[topicType] || topicType;
};

// ---------------------------------------------------------------------------
// Helper to convert Django issue to frontend Issue type
// ---------------------------------------------------------------------------

const convertDjangoIssue = (data: any): Issue => {
  // Create the base object without specifying domain type explicitly
  const baseIssue = {
    id: String(data.id),
    title: data.title,
    description: data.description || '',
    status: mapStatusToFrontend(data.status) as IssueStatus,
    priority: mapPriorityToFrontend(data.priority) as IssuePriority,
    module: data.module || '',
    reportedBy: data.reported_by_name || data.reported_by?.email || data.reported_by?.full_name || 'Unknown',
    assignedTo: data.assigned_to_name || data.assigned_to?.email || data.assigned_to?.full_name || null,
    assignedToId: data.assigned_to?.id || null,
    created: data.created,
    updated: data.updated,
    dueDate: data.due_date,
    labels: data.labels || [],
    resolution: data.resolution,
    is_deleted: data.is_deleted || false,
    deleted_at: data.deleted_at || null,
    deleted_by: data.deleted_by || null,
    organisation: data.organisation || data.organisation_details?.name || data.project_details?.organisation_name || null,
    comments: (data.comments || []).map((c: any) => ({
      id: String(c.id),
      author: c.author?.email || c.author?.full_name || c.author?.username || 'Unknown',
      text: c.text,
      timestamp: c.timestamp,
      snapshot: c.snapshot ? getImageSource(c.snapshot) : null,
      viewpointGuid: c.viewpoint?.guid || null,
    })),
  };

  // Handle BIM domain
  if (data.domain === 'bim') {
    return {
      ...baseIssue,
      domain: 'bim' as const,
      bcfGuid: data.bcf_guid,
      topicType: mapTopicTypeToFrontend(data.topic_type) || 'General',
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

  // Handle non-BIM domains (design/other)
  return {
    ...baseIssue,
    domain: (data.domain === 'design' ? 'design' : 'other') as const,
    category: data.category || '',
    attachments: (data.attachments || []).map((a: any) => {
      if (typeof a === 'string') {
        return getImageSource(a);
      }
      return getImageSource(a?.file || a?.url || a?.data || '');
    }).filter(Boolean),
  };
};

// Helper to convert frontend issue to Django payload
const convertToDjangoPayload = (issue: Partial<Issue>, includeDomain: boolean = true): any => {
  const payload: any = {};

  if (issue.project_id !== undefined && issue.project_id !== null) {
    payload.project = issue.project_id;
  } else if (issue.project !== undefined && issue.project !== null) {
    payload.project = typeof issue.project === 'number' ? issue.project : undefined;
  }

  if (includeDomain && issue.domain !== undefined) {
    payload.domain = issue.domain === 'bim' ? 'bim' : 'other';
  }

  if (issue.title !== undefined && issue.title !== '') payload.title = issue.title;
  if (issue.description !== undefined) payload.description = issue.description;

  if (issue.status !== undefined) {
    payload.status = mapStatusToBackend(issue.status);
  }

  if (issue.priority !== undefined) {
    payload.priority = mapPriorityToBackend(issue.priority);
  }

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

  if (issue.resolution !== undefined && issue.resolution !== '') {
    payload.resolution = issue.resolution;
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
        camera_position:
          viewpoint.camera_position || viewpoint.cameraPosition || { x: 0, y: 0, z: 0 },
        camera_direction:
          viewpoint.camera_direction || viewpoint.cameraDirection || { x: 0, y: 0, z: -1 },
        camera_up_vector:
          viewpoint.camera_up_vector || viewpoint.cameraUpVector || { x: 0, y: 1, z: 0 },
        field_of_view:
          viewpoint.field_of_view ?? viewpoint.fieldOfView ?? 60,
        clipping_planes:
          viewpoint.clipping_planes || viewpoint.clippingPlanes || [],
      };

      const snapshotData = viewpoint.snapshot_data ?? viewpoint.snapshot?.data;
      const snapshotFormat = viewpoint.snapshot_format ?? viewpoint.snapshot?.format;

      if (snapshotData) {
        viewpointPayload.snapshot_data = snapshotData;
        viewpointPayload.snapshot_format = snapshotFormat || 'png';
      } else if (viewpoint.clear_snapshot === true) {
        viewpointPayload.snapshot_data = null;
        viewpointPayload.snapshot_format = null;
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
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  console.log('📤 Final payload:', JSON.stringify(payload, null, 2));
  return payload;
};

// ---------------------------------------------------------------------------
// CRUD OPERATIONS
// ---------------------------------------------------------------------------

/**
 * Get all issues with optional filters
 * @param params - Optional filters including include_deleted
 */
export async function getIssues(params?: {
  project?: number;
  domain?: string;
  status?: string;
  assigned_to?: number;
  deliverable?: number;
  include_deleted?: boolean;
}): Promise<Issue[]> {
  try {
    console.log('Fetching issues with params:', params);
    
    const queryParams: any = { ...params };
    if (params?.include_deleted !== undefined) {
      queryParams.include_deleted = params.include_deleted ? 'true' : 'false';
    }
    
    const response = await apiClient.get('/issues/issues/', { 
      params: queryParams 
    });
    
    console.log('✅ Issues fetched successfully:', response.data?.length || 0, 'items');
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
    console.log('📤 Creating issue with input:', input);
    const payload = convertToDjangoPayload({
      ...input,
      project: input.project_id || input.project,
    });

    console.log('📤 Image data present (viewpoint):', !!payload.viewpoint?.snapshot_data);
    console.log('📤 Image data length (viewpoint):', payload.viewpoint?.snapshot_data?.length || 0);
    console.log('📤 Image data present (attachment):', !!payload.new_attachment_data);

    const response = await apiClient.post('/issues/issues/', payload);
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Server validation errors:', error.response.data);
      console.error('❌ Full error response:', JSON.stringify(error.response.data, null, 2));
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

    console.log('📤 Updating issue with payload:', JSON.stringify(payload, null, 2));
    console.log('📤 Image data present in update (viewpoint):', !!payload.viewpoint?.snapshot_data);
    console.log('📤 Image data present in update (attachment):', !!payload.new_attachment_data);

    const response = await apiClient.patch(`/issues/issues/${id}/`, payload);
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error updating issue - Response data:', error.response.data);
      console.error('❌ Error updating issue - Response status:', error.response.status);
    }
    console.error('Error updating issue:', error);
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
    const payload: any = {
      resolution: resolution,
    };
    
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
    console.log(`📤 Deleting issue ${id}`);
    await apiClient.delete(`/issues/issues/${id}/`);
    console.log('✅ Issue deleted successfully');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error deleting issue:', error.response.data);
      if (error.response.status === 403) {
        throw new Error('You can only delete issues you created.');
      }
    } else {
      console.error('❌ Error deleting issue:', error);
    }
    throw error;
  }
}

export async function restoreIssue(id: string | number): Promise<Issue | undefined> {
  try {
    console.log(`📤 Restoring issue ${id}`);
    const response = await apiClient.post(`/issues/issues/${id}/restore/`);
    console.log('✅ Issue restored successfully');
    return convertDjangoIssue(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error restoring issue:', error.response.data);
      if (error.response.status === 403) {
        throw new Error('You can only restore issues you created.');
      }
    } else {
      console.error('❌ Error restoring issue:', error);
    }
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

// ---------------------------------------------------------------------------
// COMMENTS
// ---------------------------------------------------------------------------

export async function addComment(
  id: string | number,
  author: string,
  text: string,
  snapshotData?: string,
  snapshotFormat?: "png" | "jpg"
): Promise<Issue | undefined> {
  try {
    console.log(`📤 Adding comment to issue ${id}`);
    console.log(`📤 Comment text: "${text}"`);
    console.log(`📤 Has snapshot: ${!!snapshotData}`);
    
    const payload: any = {
      text: text,
    };
    
    if (snapshotData) {
      payload.snapshot_data = snapshotData;
      payload.snapshot_format = snapshotFormat || 'png';
      console.log(`📸 Including snapshot data, format: ${snapshotFormat || 'png'}`);
      console.log(`📸 Snapshot data length: ${snapshotData.length}`);
    }
    
    const response = await apiClient.post(`/issues/issues/${id}/add-comment/`, payload);
    console.log('✅ Comment added successfully:', response.data);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const updatedIssue = await getIssue(id);
    console.log('📥 Fetched updated issue with comments:', updatedIssue?.comments?.length || 0, 'comments');
    
    if (updatedIssue && updatedIssue.comments && updatedIssue.comments.length > 0) {
      const lastComment = updatedIssue.comments[updatedIssue.comments.length - 1];
      console.log('📝 Last comment:', {
        id: lastComment.id,
        author: lastComment.author,
        text: lastComment.text,
        hasSnapshot: !!lastComment.snapshot,
        snapshot: lastComment.snapshot ? lastComment.snapshot.substring(0, 50) + '...' : null,
      });
    }
    
    return updatedIssue;
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
  console.log(`📤 Adding comment with snapshot to issue ${id}`);
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
    console.log(`📤 Deleting comment ${commentId} from issue ${issueId}`);
    await apiClient.delete(`/issues/comments/${commentId}/`);
    console.log('✅ Comment deleted successfully');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error deleting comment:', error.response.data);
      if (error.response.status === 403) {
        throw new Error('You can only delete your own comments.');
      }
      if (error.response.status === 404) {
        throw new Error('Comment not found.');
      }
    } else {
      console.error('❌ Error deleting comment:', error);
    }
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
    console.log(`📤 Editing comment ${commentId} on issue ${issueId}`);

    const payload: any = { text };

    if (snapshotData) {
      payload.snapshot_data = snapshotData;
      payload.snapshot_format = snapshotFormat || 'png';
    } else if (removeSnapshot) {
      payload.snapshot_data = null;
      payload.snapshot_format = null;
    }

    const response = await apiClient.patch(`/issues/comments/${commentId}/`, payload);
    console.log('✅ Comment edited successfully');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error editing comment:', error.response.data);
      if (error.response.status === 403) {
        throw new Error('You can only edit your own comments.');
      }
      if (error.response.status === 404) {
        throw new Error('Comment not found.');
      }
    } else {
      console.error('❌ Error editing comment:', error);
    }
    throw error;
  }
}
// ---------------------------------------------------------------------------
// LINKED ISSUES
// ---------------------------------------------------------------------------

export async function linkIssue(
  id: string | number,
  linkedIssueId: string | number
): Promise<void> {
  try {
    await apiClient.post(`/issues/issues/${id}/link-issue/`, {
      linked_issue_id: linkedIssueId,
    });
  } catch (error) {
    console.error('Error linking issue:', error);
    throw error;
  }
}

export async function hardDeleteIssue(id: string | number): Promise<void> {
  try {
    console.log(`📤 Permanently deleting issue ${id}`);
    const response = await apiClient.delete(`/issues/issues/${id}/hard-delete/`);
    console.log('✅ Issue permanently deleted:', response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Error hard deleting issue:', error.response.data);
      if (error.response.status === 403) {
        throw new Error('Only administrators can permanently delete issues.');
      }
      throw new Error(error.response.data?.error || 'Failed to permanently delete issue.');
    } else {
      console.error('❌ Error hard deleting issue:', error);
      throw error;
    }
  }
}

export async function unlinkIssue(
  id: string | number,
  linkedIssueId: string | number
): Promise<void> {
  try {
    await apiClient.post(`/issues/issues/${id}/unlink-issue/`, {
      linked_issue_id: linkedIssueId,
    });
  } catch (error) {
    console.error('Error unlinking issue:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// VIEWPOINTS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// BCF EXPORT/IMPORT
// ---------------------------------------------------------------------------

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
    const response = await apiClient.get(
      `/issues/issues/${issue.id}/export-bcf/?include_snapshots=true`
    );
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

// ---------------------------------------------------------------------------
// FILTERS / QUERIES
// ---------------------------------------------------------------------------

export const getIssuesByTopicType = async (type: BcfTopicType) => {
  const issues = await getIssues({ include_deleted: false });
  return issues.filter(isBimIssue).filter((i) => i.topicType === type);
};

export const getIssuesByAssignee = async (assignee: string) => {
  const issues = await getIssues({ include_deleted: false });
  return issues.filter((i) => i.assignedTo === assignee);
};

export const getIssuesByDomain = async (domain: IssueDomain) => {
  const issues = await getIssues({ include_deleted: false });
  return issues.filter((i) => i.domain === domain);
};

export const getIssuesByIfcElement = async (ifcGuid: string) => {
  const issues = await getIssues({ include_deleted: false });
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

// ---------------------------------------------------------------------------
// DISPLAY HELPERS
// ---------------------------------------------------------------------------

export const getStatusColor = (status: IssueStatus): string => {
  switch (status) {
    case 'Resolved':
      return '#4A8B6B';
    case 'Closed':
      return '#6B7280';
    case 'In Progress':
      return '#E8A838';
    default:
      return '#D43E3E';
  }
};

export const getPriorityColor = (priority: IssuePriority): string => {
  switch (priority) {
    case 'High':
      return '#D43E3E';
    case 'Medium':
      return '#E8A838';
    default:
      return '#4A8B6B';
  }
};

// ---------------------------------------------------------------------------
// EXPORT DEFAULTS
// ---------------------------------------------------------------------------

export default {
  getIssues,
  getIssue,
  createIssue,
  updateIssue,
  resolveIssue,
  deleteIssue,
  restoreIssue,
  removeSnapshot,
  removeAttachment,
  addComment,
  addCommentWithSnapshot,
  getComments,
  deleteComment,
  editComment,
  hardDeleteIssue,
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
  getStatusColor,
  getPriorityColor,
};