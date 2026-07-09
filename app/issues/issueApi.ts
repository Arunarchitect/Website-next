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

// Axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - adds auth token to every request
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
// Helper to convert Django issue to frontend Issue type
// ---------------------------------------------------------------------------

const convertDjangoIssue = (data: any): Issue => {
  const baseIssue: Issue = {
    id: String(data.id),
    domain: data.domain as IssueDomain,
    title: data.title,
    description: data.description || '',
    status: data.status as IssueStatus,
    priority: data.priority as IssuePriority,
    module: data.module || '',
    reportedBy: data.reported_by_name || data.reported_by?.email || data.reported_by?.full_name || 'Unknown',
    assignedTo: data.assigned_to_name || data.assigned_to?.email || data.assigned_to?.full_name || null,
    assignedToId: data.assigned_to?.id || null,
    created: data.created,
    updated: data.updated,
    dueDate: data.due_date,
    labels: data.labels || [],
    resolution: data.resolution,
    comments: (data.comments || []).map((c: any) => ({
      id: String(c.id),
      author: c.author?.email || c.author?.full_name || c.author?.username || 'Unknown',
      text: c.text,
      timestamp: c.timestamp,
      snapshot: c.snapshot,
      viewpointGuid: c.viewpoint?.guid || null,
    })),
  };

  if (data.domain === 'bim') {
    const bimIssue: BimIssue = {
      ...baseIssue,
      domain: 'bim',
      bcfGuid: data.bcf_guid,
      topicType: data.topic_type || 'General',
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
        components: (data.viewpoint.components || []).map((comp: any) => ({
          ifcGuid: comp.ifc_guid,
          selectionType: comp.selection_type || 'IfcProduct',
          visible: comp.visible !== false,
        })),
      } : undefined,
    };
    return bimIssue;
  }

  return {
    ...baseIssue,
    domain: 'design',
    category: data.category || '',
    attachments: data.attachments || [],
  };
};

// Helper to convert frontend issue to Django payload
const convertToDjangoPayload = (issue: Partial<Issue>): any => {
  const payload: any = {};

  // Only include fields that are provided and valid
  if (issue.project_id !== undefined && issue.project_id !== null) {
    payload.project = issue.project_id;
  } else if (issue.project !== undefined && issue.project !== null) {
    payload.project = typeof issue.project === 'number' ? issue.project : undefined;
  }

  if (issue.domain !== undefined) payload.domain = issue.domain;
  if (issue.title !== undefined && issue.title !== '') payload.title = issue.title;
  if (issue.description !== undefined) payload.description = issue.description;
  if (issue.status !== undefined) payload.status = issue.status;
  if (issue.priority !== undefined) payload.priority = issue.priority;
  if (issue.module !== undefined && issue.module !== '') payload.module = issue.module;
  
  // Handle assigned_to - only send if it's a number (user ID)
  if (issue.assignedToId !== undefined && issue.assignedToId !== null) {
    payload.assigned_to = issue.assignedToId;
  } else if (issue.assignedTo !== undefined && issue.assignedTo !== null && issue.assignedTo !== '') {
    // If assignedTo is a number string, convert it
    if (!isNaN(Number(issue.assignedTo))) {
      payload.assigned_to = Number(issue.assignedTo);
    }
    // Otherwise skip - it's a name string that Django can't use
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

  // Handle BIM-specific fields
  if (issue.domain === 'bim') {
    const bimIssue = issue as any;
    if (bimIssue.topicType !== undefined) {
      payload.topic_type = bimIssue.topicType;
    }
    if (bimIssue.ifcElements !== undefined && Array.isArray(bimIssue.ifcElements)) {
      payload.ifc_elements = bimIssue.ifcElements;
    }
  }

  // Handle Design-specific fields
  if (issue.domain === 'design') {
    const designIssue = issue as any;
    if (designIssue.category !== undefined && designIssue.category !== '') {
      payload.category = designIssue.category;
    }
    if (designIssue.attachments !== undefined && Array.isArray(designIssue.attachments)) {
      payload.attachments = designIssue.attachments;
    }
  }

  // Remove any undefined or null values
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined || payload[key] === null) {
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
 */
export async function getIssues(params?: {
  project?: number;
  domain?: string;
  status?: string;
  assigned_to?: number;
  deliverable?: number;
}): Promise<Issue[]> {
  try {
    console.log('Fetching issues with params:', params);
    const response = await apiClient.get('/issues/issues/', { params });
    console.log('✅ Issues fetched successfully:', response.data?.length || 0, 'items');
    return response.data.map(convertDjangoIssue);
  } catch (error) {
    console.error('❌ Error fetching issues:', error);
    throw error;
  }
}

/**
 * Get a single issue by ID
 */
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

/**
 * Create a new issue
 */
export async function createIssue(input: any): Promise<Issue> {
  try {
    const payload = convertToDjangoPayload({
      ...input,
      project: input.project_id || input.project,
    });
    const response = await apiClient.post('/issues/issues/', payload);
    return convertDjangoIssue(response.data);
  } catch (error) {
    console.error('Error creating issue:', error);
    throw error;
  }
}

/**
 * Update an issue
 */
export async function updateIssue(id: string | number, patch: Partial<Issue>): Promise<Issue | undefined> {
  try {
    const payload = convertToDjangoPayload({
      ...patch,
      project: patch.project_id || patch.project,
    });
    
    console.log('📤 Updating issue with payload:', JSON.stringify(payload, null, 2));
    
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

/**
 * Resolve an issue
 */
export async function resolveIssue(
  id: string | number,
  resolution: string,
  resolvedBy?: string
): Promise<Issue | undefined> {
  try {
    const response = await apiClient.post(`/issues/issues/${id}/resolve/`, {
      resolution,
    });
    return convertDjangoIssue(response.data.issue);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    console.error('Error resolving issue:', error);
    throw error;
  }
}

/**
 * Delete an issue
 */
export async function deleteIssue(id: string | number): Promise<void> {
  try {
    await apiClient.delete(`/issues/issues/${id}/`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return;
    }
    console.error('Error deleting issue:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// COMMENTS
// ---------------------------------------------------------------------------

/**
 * Add a comment to an issue
 */
export async function addComment(
  id: string | number,
  author: string,
  text: string,
  snapshot?: string
): Promise<Issue | undefined> {
  try {
    await apiClient.post(`/issues/issues/${id}/add-comment/`, {
      text,
      snapshot,
    });
    return getIssue(id);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return undefined;
    }
    console.error('Error adding comment:', error);
    throw error;
  }
}

/**
 * Add a comment with snapshot
 */
export async function addCommentWithSnapshot(
  id: string | number,
  author: string,
  text: string,
  snapshotData?: string
): Promise<Issue | undefined> {
  return addComment(id, author, text, snapshotData);
}

/**
 * Get comments for an issue
 */
export async function getComments(id: string | number): Promise<IssueComment[]> {
  try {
    const response = await apiClient.get(`/issues/issues/${id}/comments/`);
    return response.data.map((c: any) => ({
      id: String(c.id),
      author: c.author?.email || c.author?.username || 'Unknown',
      text: c.text,
      timestamp: c.timestamp,
      snapshot: c.snapshot,
      viewpointGuid: c.viewpoint?.guid || null,
    }));
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// LINKED ISSUES
// ---------------------------------------------------------------------------

/**
 * Link an issue to another
 */
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

/**
 * Unlink an issue
 */
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

/**
 * Get viewpoint for an issue
 */
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

/**
 * Export an issue to BCF format
 */
export async function toBcfTopic(issue: BimIssue): Promise<any> {
  try {
    const response = await apiClient.get(`/issues/issues/${issue.id}/export-bcf/`);
    return response.data;
  } catch (error) {
    console.error('Error exporting to BCF:', error);
    throw error;
  }
}

/**
 * Export with snapshots
 */
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

/**
 * Import a BCF topic
 */
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

/**
 * Get issues by topic type (BIM only)
 */
export const getIssuesByTopicType = async (type: BcfTopicType) => {
  const issues = await getIssues();
  return issues.filter(isBimIssue).filter((i) => i.topicType === type);
};

/**
 * Get issues by assignee
 */
export const getIssuesByAssignee = async (assignee: string) => {
  const issues = await getIssues();
  return issues.filter((i) => i.assignedTo === assignee);
};

/**
 * Get issues by domain
 */
export const getIssuesByDomain = async (domain: IssueDomain) => {
  const issues = await getIssues();
  return issues.filter((i) => i.domain === domain);
};

/**
 * Get issues by IFC element (BIM only)
 */
export const getIssuesByIfcElement = async (ifcGuid: string) => {
  const issues = await getIssues();
  return issues.filter(isBimIssue).filter((i) => i.ifcElements?.includes(ifcGuid));
};

/**
 * Get my issues (assigned to current user)
 */
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
  addComment,
  addCommentWithSnapshot,
  getComments,
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