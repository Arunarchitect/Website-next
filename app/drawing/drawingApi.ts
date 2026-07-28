import axios from 'axios';
import {
  Organisation,
  Project,
  Deliverable,
  DrawingDocumentResolved,
  UserContext,
  PaginatedDocuments,
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
    if (filters.ordering) {                         // <-- add this block
      params.append('ordering', filters.ordering);
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());

    const url = `/drawings/documents/?${params.toString()}`;
    console.log('📡 Fetching documents from:', url);

    const response = await apiClient.get(url);
    console.log('📥 API Response received');

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
    console.log('✅ Document created:', response.data);
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
    console.log('✅ Document updated:', response.data);
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
    console.log('✅ Document deleted:', id);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error('Failed to delete document');
  }
};

export const getDocument = async (id: number): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.get(`/drawings/documents/${id}/`);
    console.log(`📄 Document ${id} details retrieved`);
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