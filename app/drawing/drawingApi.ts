// app/drawing/drawingApi.ts

import axios from 'axios';
import {
  Organisation,
  Project,
  Deliverable,
  DrawingDocument,
  DrawingDocumentResolved,
  UserContext,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// API CONFIGURATION - Same as issues API
// ─────────────────────────────────────────────────────────────────────────────

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
            // Refresh failed — clear tokens and bounce to login.
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

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: HELPER: Get Full File URL - Handles all URL formats
// ─────────────────────────────────────────────────────────────────────────────

export const getFullFileUrl = (fileUrl: string | undefined | null): string => {
  if (!fileUrl) {
    console.warn('⚠️ getFullFileUrl called with undefined or empty URL');
    return '';
  }

  // If it's already a full URL, return it
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }

  // Handle the case where the URL already starts with /media/
  if (fileUrl.startsWith('/media/')) {
    return `${API_BASE_URL}${fileUrl}`;
  }

  // Handle the case where the URL starts with / but not /media/
  if (fileUrl.startsWith('/')) {
    return `${API_BASE_URL}${fileUrl}`;
  }

  // Handle the case where the URL is a relative path
  // Examples:
  // - "drawings/organisation_1/project_2/deliverable_32/Array_1783932785_4e8073.png"
  // - "media/drawings/organisation_1/project_2/deliverable_32/Array_1783932785_4e8073.png"
  if (!fileUrl.startsWith('/') && !fileUrl.startsWith('http')) {
    // If it already contains 'drawings/' or 'media/', add /media/ prefix
    if (fileUrl.includes('drawings/') || fileUrl.includes('media/')) {
      // Remove any leading 'media/' to avoid double media
      const cleanUrl = fileUrl.replace(/^media\//, '');
      return `${API_BASE_URL}/media/${cleanUrl}`;
    }
    
    // Default case: add /media/ prefix
    return `${API_BASE_URL}/media/${fileUrl}`;
  }

  // Fallback
  return `${API_BASE_URL}/${fileUrl}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: Function to get file URL for display (synchronous)
// ─────────────────────────────────────────────────────────────────────────────

export const getDisplayFileUrl = (doc: DrawingDocumentResolved): string => {
  if (!doc) {
    console.warn('⚠️ getDisplayFileUrl called with undefined document');
    return '';
  }

  console.log(`🔍 Getting display URL for doc ${doc.id} (${doc.file_type}):`, {
    file_url: doc.file_url,
    thumbnail_url: doc.thumbnail_url,
  });

  let urlToUse = '';

  // For images, use file_url directly
  if (doc.file_type === 'image') {
    urlToUse = doc.file_url || '';
    console.log(`🖼️ Image file, using file_url: ${urlToUse}`);
  } else {
    // For other file types, try thumbnail_url first, then file_url
    urlToUse = doc.thumbnail_url || doc.file_url || '';
    console.log(`📄 Non-image file, using thumbnail_url or file_url: ${urlToUse}`);
  }

  if (!urlToUse) {
    console.warn(`⚠️ No URL found for document ${doc.id}`);
    return '';
  }

  const fullUrl = getFullFileUrl(urlToUse);
  console.log(`✅ Full URL for doc ${doc.id}: ${fullUrl}`);
  return fullUrl;
};

// ─────────────────────────────────────────────────────────────────────────────
// USER CONTEXT - Get from actual authentication (same as issues)
// ─────────────────────────────────────────────────────────────────────────────

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
      };
    }

    const response = await apiClient.get('/users/me/');
    const userData = response.data;

    // Check if user has drawing_private_role
    const roles = userData.roles || [];
    const hasDrawingPrivateAccess = roles.includes('drawing_private_role');

    return {
      id: userData.id,
      name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email,
      email: userData.email,
      roles: roles,
      hasDrawingPrivateAccess,
    };
  } catch (error) {
    console.error('Error fetching current user:', error);
    return {
      id: 0,
      name: 'Guest',
      email: 'guest@example.com',
      roles: [],
      hasDrawingPrivateAccess: false,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS - Using apiClient like issues API
// ─────────────────────────────────────────────────────────────────────────────

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
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: Get Documents with better URL handling
// ─────────────────────────────────────────────────────────────────────────────

export const getDocuments = async (
  filters: DocumentFilters = {}
): Promise<DrawingDocumentResolved[]> => {
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
    if (filters.page) {
      params.append('page', filters.page.toString());
    }
    if (filters.pageSize) {
      params.append('page_size', filters.pageSize.toString());
    }
    
    const url = `/drawings/documents/?${params.toString()}`;
    console.log('📡 Fetching documents from:', url);
    
    const response = await apiClient.get(url);
    
    console.log('📥 API Response received');
    
    // If the API returns paginated data
    let docs = [];
    if (response.data.results) {
      docs = response.data.results;
    } else {
      docs = response.data;
    }
    
    // Log first document for debugging
    if (docs.length > 0) {
      console.log('🔍 First document from API:', {
        id: docs[0].id,
        title: docs[0].title,
        file_type: docs[0].file_type,
        file_url: docs[0].file_url,
        thumbnail_url: docs[0].thumbnail_url,
      });
    }
    
    return docs;
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

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: Download Document with better handling
// ─────────────────────────────────────────────────────────────────────────────

export const downloadDocument = async (doc: DrawingDocument): Promise<void> => {
  try {
    // First check if user has access
    const currentUser = await getCurrentUser();
    if (!canAccessDocument(doc, currentUser)) {
      throw new Error('You do not have permission to download this document');
    }
    
    // Open the download URL in a new window/tab
    const downloadUrl = `${API_URL}/drawings/documents/${doc.id}/download/`;
    
    // Use window.open or create a link with auth header
    const token = getAuthToken();
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    if (token) {
      link.href = `${downloadUrl}?token=${encodeURIComponent(token)}`;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE/UPDATE/DELETE DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

export const createDocument = async (formData: FormData): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.post('/drawings/documents/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('✅ Document created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating document:', error);
    throw new Error('Failed to create document');
  }
};

export const updateDocument = async (id: number, formData: FormData): Promise<DrawingDocumentResolved> => {
  try {
    const response = await apiClient.patch(`/drawings/documents/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('✅ Document updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating document:', error);
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

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: Get a single document by ID with better URL handling
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY CHECK HELPER
// ─────────────────────────────────────────────────────────────────────────────

export const canAccessDocument = (
  doc: DrawingDocument,
  user: UserContext
): boolean => {
  // If document is public, anyone can access
  if (!doc.is_private) return true;
  
  // If user has drawing private role, they can access all private documents
  if (user.hasDrawingPrivateAccess) return true;
  
  // Check if user has any of the allowed roles for this document
  if (doc.allowed_roles && doc.allowed_roles.length > 0) {
    return doc.allowed_roles.some(role => user.roles.includes(role));
  }
  
  return false;
};