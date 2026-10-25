import axios from 'axios';
import {
  Organisation,
  Project,
  Deliverable,
  DrawingDocumentResolved,
  UserContext,
  PaginatedDocuments,
  DrawingActivity,
  PaginatedActivity,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || 'http://127.0.0.1:8000';
const API_URL = `${API_BASE_URL}/api`;

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

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
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
              refresh: refreshToken,
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

/**
 * Pull the server's message out of an axios error (DRF uses `detail`,
 * our custom 400s use `detail` or `error`), else fall back.
 */
const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as unknown;
    if (typeof data === 'string') return data.length < 300 ? data : fallback;
    if (typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      if (typeof d.detail === 'string') return d.detail;
      if (typeof d.error === 'string') return d.error;
    }
  }
  return fallback;
};

export const getFullFileUrl = (fileUrl: string | undefined | null): string => {
  if (!fileUrl) {
    console.warn('⚠️ getFullFileUrl called with undefined or empty URL');
    return '';
  }
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  if (fileUrl.startsWith('/media/')) {
    return `${API_BASE_URL}${fileUrl}`;
  }
  if (fileUrl.startsWith('/')) {
    return `${API_BASE_URL}${fileUrl}`;
  }
  if (!fileUrl.startsWith('/') && !fileUrl.startsWith('http')) {
    if (fileUrl.includes('drawings/') || fileUrl.includes('media/')) {
      const cleanUrl = fileUrl.replace(/^media\//, '');
      return `${API_BASE_URL}/media/${cleanUrl}`;
    }
    return `${API_BASE_URL}/media/${fileUrl}`;
  }
  return `${API_BASE_URL}/${fileUrl}`;
};

export const getDisplayFileUrl = (doc: DrawingDocumentResolved): string => {
  if (!doc) {
    console.warn('⚠️ getDisplayFileUrl called with undefined document');
    return '';
  }
  let urlToUse = '';
  if (doc.file_type === 'image') {
    urlToUse = doc.file_url || '';
  } else {
    urlToUse = doc.thumbnail_url || doc.file_url || '';
  }
  if (!urlToUse) {
    console.warn(`⚠️ No URL found for document ${doc.id}`);
    return '';
  }
  return getFullFileUrl(urlToUse);
};

export const getCurrentUser = async (): Promise<UserContext> => {
  try {
    const token = getAuthToken();
    if (!token) {
      return {
        id: 0,
        name: 'Guest',
        email: 'guest@example.com',
        roles: [],
        hasDrawingPrivateAccess: false,
        organisationIds: [],
      };
    }
    const response = await apiClient.get('/users/me/');
    const userData = response.data;
    const roles = userData.roles || [];
    const hasDrawingPrivateAccess = roles.includes('drawing_private_role');
    let organisationIds: number[] = [];
    try {
      const orgs = await getOrganisations();
      organisationIds = orgs.map((o) => o.id);
    } catch (err) {
      console.error('Error loading organisation memberships:', err);
    }
    return {
      id: userData.id,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
      email: userData.email,
      roles,
      hasDrawingPrivateAccess,
      organisationIds,
    };
  } catch (error) {
    console.error('Error fetching current user:', error);
    return {
      id: 0,
      name: 'Guest',
      email: 'guest@example.com',
      roles: [],
      hasDrawingPrivateAccess: false,
      organisationIds: [],
    };
  }
};

export const getOrganisations = async (): Promise<Organisation[]> => {
  try {
    const response = await apiClient.get('/drawings/organisations/');
    return response.data;
  } catch (error) {
    console.error('Error fetching organisations:', error);
    throw new Error('Failed to fetch organisations');
  }
};

export const getProjects = async (organisationId?: number): Promise<Project[]> => {
  try {
    const url = organisationId
      ? `/drawings/projects/?organisation_id=${organisationId}`
      : '/drawings/projects/';
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw new Error('Failed to fetch projects');
  }
};

export const getDeliverables = async (projectId?: number): Promise<Deliverable[]> => {
  try {
    const url = projectId
      ? `/drawings/deliverables/?project_id=${projectId}`
      : '/drawings/deliverables/';
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching deliverables:', error);
    throw new Error('Failed to fetch deliverables');
  }
};

export interface DocumentFilters {
  organisationId?: number;
  projectId?: number;
  deliverableId?: number;
  search?: string;
  showPrivate?: boolean;
  page?: number;
  pageSize?: number;
  ordering?: string;
  status?: 'draft' | 'published' | 'archived';
  /** Only meaningful with status 'draft': pending review vs rejected. */
  reviewState?: 'pending' | 'rejected';
  /** Only drawings I uploaded. */
  mine?: boolean;
}

export const getDocuments = async (
  filters: DocumentFilters = {}
): Promise<PaginatedDocuments> => {
  try {
    const params = new URLSearchParams();

    if (filters.organisationId) {
      params.append('organisation_id', filters.organisationId.toString());
    }
    if (filters.projectId) {
      params.append('project_id', filters.projectId.toString());
    }
    if (filters.deliverableId) {
      params.append('deliverable_id', filters.deliverableId.toString());
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    if (filters.showPrivate) {
      params.append('show_private', 'true');
    }
    if (filters.ordering) {
      params.append('ordering', filters.ordering);
    }
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.reviewState) {
      params.append('review_state', filters.reviewState);
    }
    if (filters.mine) {
      params.append('mine', 'true');
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());

    const url = `/drawings/documents/?${params.toString()}`;

    const response = await apiClient.get(url);

    if (response.data.results) {
      return {
        results: response.data.results,
        count: response.data.count ?? response.data.results.length,
        next: response.data.next ?? null,
        previous: response.data.previous ?? null,
      };
    }

    return {
      results: response.data,
      count: response.data.length,
      next: null,
      previous: null,
    };
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw new Error('Failed to fetch documents');
  }
};

export const toggleFavorite = async (id: number): Promise<boolean> => {
  try {
    const response = await apiClient.post(`/drawings/documents/${id}/toggle-favorite/`);
    return response.data.is_favorite;
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw new Error('Failed to toggle favorite');
  }
};

// ─────────────────────────────────────────────────────────────────────────
// APPROVAL WORKFLOW
// Each returns the fresh detail-serializer document so the UI can swap it in.
// ─────────────────────────────────────────────────────────────────────────

/** Admin: draft -> published. */
export const approveDocument = async (id: number): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.post(`/drawings/documents/${id}/approve/`);
    return response.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to approve drawing'));
  }
};

/** Admin: keep as draft, mark rejected (never public). Reason is optional. */
export const rejectDocument = async (
  id: number,
  reason: string = ''
): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.post(`/drawings/documents/${id}/reject/`, { reason });
    return response.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to reject drawing'));
  }
};

/** Admin: published -> archived (also revokes its share link). */
export const archiveDocument = async (id: number): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.post(`/drawings/documents/${id}/archive/`);
    return response.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to archive drawing'));
  }
};

/** Admin: archived -> draft (needs approval again). */
export const restoreDocument = async (id: number): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.post(`/drawings/documents/${id}/restore/`);
    return response.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to restore drawing'));
  }
};

// ─────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────

/** History of ONE drawing (org-wide admin/manager/member). Newest first. */
export const getDocumentActivity = async (id: number): Promise<DrawingActivity[]> => {
  try {
    const response = await apiClient.get(`/drawings/documents/${id}/activity/`);
    return response.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to load activity'));
  }
};

export interface ActivityFilters {
  organisationId?: number;
  action?: string;
  actorId?: number;
  documentId?: number;
  search?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

/** Org-wide log. Org admins only (server scopes to their admin orgs). */
export const getActivityLog = async (
  filters: ActivityFilters = {}
): Promise<PaginatedActivity> => {
  try {
    const params = new URLSearchParams();
    if (filters.organisationId) params.append('organisation_id', String(filters.organisationId));
    if (filters.action) params.append('action', filters.action);
    if (filters.actorId) params.append('actor_id', String(filters.actorId));
    if (filters.documentId) params.append('document_id', String(filters.documentId));
    if (filters.search) params.append('search', filters.search);
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    params.append('page', String(filters.page ?? 1));
    params.append('page_size', String(filters.pageSize ?? 25));

    const response = await apiClient.get(`/drawings/activity/?${params.toString()}`);
    return {
      results: response.data.results ?? [],
      count: response.data.count ?? 0,
      next: response.data.next ?? null,
      previous: response.data.previous ?? null,
    };
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to load activity log'));
  }
};

export interface GuestLinkResult {
  guest_access_code: string | null;
}

/**
 * Create (or fetch the existing) single-drawing guest link for this
 * document. Idempotent. Server only allows this for PUBLISHED drawings.
 */
export const createGuestLink = async (id: number): Promise<GuestLinkResult> => {
  try {
    const response = await apiClient.post(`/drawings/documents/${id}/guest-link/`);
    return response.data;
  } catch (error) {
    console.error('Error creating guest link:', error);
    throw new Error(apiErrorMessage(error, 'Failed to create guest link'));
  }
};

/**
 * Revoke this document's single-drawing guest link. Anyone holding the
 * old link loses access immediately.
 */
export const revokeGuestLink = async (id: number): Promise<void> => {
  try {
    await apiClient.delete(`/drawings/documents/${id}/guest-link/`);
  } catch (error) {
    console.error('Error revoking guest link:', error);
    throw new Error('Failed to revoke guest link');
  }
};

/** Builds the public share URL from a code, e.g. "/drawing/<code>". */
export const buildGuestLinkUrl = (code: string): string => {
  if (typeof window === 'undefined') return `/drawing/${code}`;
  return `${window.location.origin}/drawing/${code}`;
};

export interface BulkLink {
  id: number;
  title: string;
  code: string;
  project_name: string;
  deliverable_name: string;
  is_private: boolean;
}

/**
 * Create (or fetch existing) single-drawing guest links for many documents
 * at once. Only PUBLISHED drawings get links; others are counted in
 * `skipped`. Max 300 ids per call.
 */
export const bulkCreateGuestLinks = async (
  ids: number[]
): Promise<{ links: BulkLink[]; skipped: number }> => {
  try {
    const response = await apiClient.post('/drawings/documents/bulk-guest-link/', { ids });
    return response.data;
  } catch (error) {
    console.error('Error creating bulk guest links:', error);
    throw new Error('Failed to create guest links');
  }
};

/**
 * All drawings matching the filters that already have an active guest link.
 * Same filter shape as getDocuments (page/pageSize ignored). Not paginated.
 */
export const getActiveGuestLinks = async (
  filters: Omit<DocumentFilters, 'page' | 'pageSize'> = {}
): Promise<BulkLink[]> => {
  try {
    const params = new URLSearchParams();
    if (filters.organisationId) params.append('organisation_id', filters.organisationId.toString());
    if (filters.projectId) params.append('project_id', filters.projectId.toString());
    if (filters.deliverableId) params.append('deliverable_id', filters.deliverableId.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.showPrivate) params.append('show_private', 'true');
    if (filters.status) params.append('status', filters.status);
    const response = await apiClient.get(`/drawings/documents/guest-links/?${params.toString()}`);
    return response.data.links ?? [];
  } catch (error) {
    console.error('Error fetching active guest links:', error);
    throw new Error('Failed to fetch active guest links');
  }
};

/** Revoke the guest link on many drawings at once. Max 300 ids per call. */
export const bulkRevokeGuestLinks = async (
  ids: number[]
): Promise<{ revoked: number[]; skipped: number }> => {
  try {
    const response = await apiClient.post('/drawings/documents/bulk-revoke-guest-link/', { ids });
    return response.data;
  } catch (error) {
    console.error('Error revoking bulk guest links:', error);
    throw new Error('Failed to revoke guest links');
  }
};

export const downloadDocument = async (doc: DrawingDocumentResolved): Promise<void> => {
  try {
    const currentUser = await getCurrentUser();
    if (!canAccessDocument(doc, currentUser)) {
      throw new Error('You do not have permission to download this document');
    }

    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const downloadUrl = `${API_URL}/drawings/documents/${doc.id}/download/`;

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Session expired. Please log in again.');
      if (response.status === 403) throw new Error('You do not have permission to download this document.');
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const disposition = response.headers.get('Content-Disposition');
    let filename = '';

    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match) {
        filename = decodeURIComponent(utf8Match[1]);
      } else {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
        if (match) {
          filename = match[1].trim();
        }
      }
    }

    if (!filename) {
      const urlParts = doc.file_url?.split('?')[0].split('.');
      const ext = urlParts && urlParts.length > 1 ? urlParts.pop()!.toLowerCase() : '';
      const baseName = doc.title?.trim() || `document_${doc.id}`;
      filename = ext ? `${baseName}.${ext}` : baseName;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
};

export const createDocument = async (formData: FormData): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.post('/drawings/documents/', formData);
    return response.data;
  } catch (error) {
    console.error('Error creating document:', error);
    if (axios.isAxiosError(error) && error.response?.data) {
      const detail =
        typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      throw new Error(detail);
    }
    throw new Error('Failed to create document');
  }
};

export const updateDocument = async (id: number, formData: FormData): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.patch(`/drawings/documents/${id}/`, formData);
    return response.data;
  } catch (error) {
    console.error('Error updating document:', error);
    if (axios.isAxiosError(error) && error.response?.data) {
      const detail =
        typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
      throw new Error(detail);
    }
    throw new Error('Failed to update document');
  }
};

export const deleteDocument = async (id: number): Promise<void> => {
  try {
    await apiClient.delete(`/drawings/documents/${id}/`);
  } catch (error) {
    console.error('Error deleting document:', error);
    // Surfaces the server's reason, e.g. "Approved drawings can't be deleted. Archive it instead."
    throw new Error(apiErrorMessage(error, 'Failed to delete document'));
  }
};

export const getDocument = async (id: number): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.get(`/drawings/documents/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching document:', error);
    throw new Error('Failed to fetch document');
  }
};

export const canAccessDocument = (doc: DrawingDocumentResolved, user: UserContext): boolean => {
  if (!user.organisationIds.includes(doc.organisation_id)) return false;
  if (!doc.is_private) return true;
  if (user.hasDrawingPrivateAccess) return true;
  if (doc.allowed_roles && doc.allowed_roles.length > 0) {
    return doc.allowed_roles.some((role) => user.roles.includes(role));
  }
  return false;
};

export interface RawMembership {
  id: number;
  organisation: number;
  role: string;
  project: number | null;
}

/** Same endpoint userApi.ts's getOrganisationMemberships() uses. */
export const getMyMemberships = async (): Promise<RawMembership[]> => {
  try {
    const response = await apiClient.get('/my-memberships/');
    return response.data;
  } catch (error) {
    console.error('Error fetching memberships:', error);
    return [];
  }
};