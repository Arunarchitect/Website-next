// app/main/client/clientApi.ts

import axios from 'axios';
import { User, OrganisationMembership, ClientStats, ClientProject } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api`;

// Helper to get auth token
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
    console.log('🔑 [ClientApi] Token found, length:', token.length);
  } else {
    console.warn('⚠️ [ClientApi] No authentication token found');
  }

  return token;
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
    }
    return config;
  },
  (error) => {
    console.error('❌ [ClientApi] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`📥 [ClientApi] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    if (error.response) {
      console.error(`❌ [ClientApi] API Error ${error.response.status}:`, {
        url: error.config?.url,
        data: error.response.data,
      });

      if (error.response.status === 401) {
        console.warn('🔒 [ClientApi] Unauthorized - token may be expired or invalid');
        
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
            console.error('❌ [ClientApi] Token refresh failed:', refreshError);
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
// USER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current user info from localStorage
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      console.log('✅ [ClientApi] User from localStorage:', userData.email);
      return {
        id: userData.id || 0,
        email: userData.email || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email || '',
        username: userData.username || userData.email || '',
        is_superuser: userData.is_superuser || false,
        is_staff: userData.is_staff || false,
      };
    }
    console.warn('⚠️ [ClientApi] No user found in localStorage');
    return null;
  } catch (error) {
    console.error('❌ [ClientApi] Error getting user:', error);
    return null;
  }
};

/**
 * Fetch user profile from API
 */
export const fetchUserProfile = async (): Promise<User | null> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('⚠️ [ClientApi] No token, cannot fetch user profile');
      return null;
    }

    console.log('🔄 [ClientApi] Fetching user profile...');
    const response = await apiClient.get('/users/me/');
    
    if (response.data) {
      const userData = response.data;
      console.log('✅ [ClientApi] User profile fetched:', userData.email);
      return {
        id: userData.id || 0,
        email: userData.email || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email || '',
        username: userData.username || userData.email || '',
        is_superuser: userData.is_superuser || false,
        is_staff: userData.is_staff || false,
      };
    }
    return null;
  } catch (error) {
    console.error('❌ [ClientApi] Error fetching user profile:', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ORGANISATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get user's organisation memberships
 */
export const getOrganisationMemberships = async (): Promise<OrganisationMembership[]> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('⚠️ [ClientApi] No token, cannot fetch memberships');
      return [];
    }

    console.log('🔄 [ClientApi] Fetching organisation memberships...');
    const response = await apiClient.get('/my-memberships/');
    
    if (response.data) {
      console.log(`✅ [ClientApi] Found ${response.data.length} organisation(s)`);
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('❌ [ClientApi] Error fetching memberships:', error);
    return [];
  }
};

/**
 * Get user's highest organisation role
 */
export const getOrganisationRole = async (): Promise<string | null> => {
  try {
    const memberships = await getOrganisationMemberships();
    if (!memberships.length) return null;

    const PRIORITY: string[] = ['admin', 'manager', 'member', 'client'];
    for (const role of PRIORITY) {
      if (memberships.some((m) => m.role === role)) {
        console.log(`✅ [ClientApi] Highest organisation role: ${role}`);
        return role;
      }
    }
    return null;
  } catch (error) {
    console.error('❌ [ClientApi] Error getting organisation role:', error);
    return null;
  }
};



/**
 * Get projects the current user has project-level membership on
 */
export const getClientProjects = async (): Promise<ClientProject[]> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('⚠️ [ClientApi] No token, cannot fetch projects');
      return [];
    }

    console.log('🔄 [ClientApi] Fetching client projects...');
    const response = await apiClient.get('/my-projects/', {
      params: { role: 'client' },
    });

    if (response.data) {
      console.log(`✅ [ClientApi] Found ${response.data.length} project(s)`);
      return response.data;
    }
    return [];
  } catch (error) {
    console.error('❌ [ClientApi] Error fetching projects:', error);
    return [];
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// AREACALC FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get user's Areacalc role
 */
export const getAreacalcRole = async (): Promise<string | null> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('⚠️ [ClientApi] No token, cannot fetch Areacalc role');
      return null;
    }

    console.log('🔄 [ClientApi] Fetching Areacalc role...');
    const response = await apiClient.get('/areacalc/me/role/');
    
    if (response.data) {
      const role = response.data.role || 'anonymous';
      console.log(`✅ [ClientApi] Areacalc role: ${role}`);
      return role;
    }
    return 'anonymous';
  } catch (error) {
    console.error('❌ [ClientApi] Error fetching Areacalc role:', error);
    return 'anonymous';
  }
};

/**
 * Check if user has Areacalc access (not anonymous)
 */
export const hasAreacalcAccess = async (): Promise<boolean> => {
  const role = await getAreacalcRole();
  return role !== null && role !== 'anonymous';
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT STATS FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get client dashboard stats
 */
export const getClientStats = async (): Promise<ClientStats> => {
  try {
    const token = getAuthToken();
    if (!token) {
      console.warn('⚠️ [ClientApi] No token, cannot fetch stats');
      return { totalProjects: 0, totalDeliverables: 0, totalTasks: 0 };
    }

    console.log('🔄 [ClientApi] Fetching client stats...');
    // This endpoint might need to be created on the backend
    // For now, return default values
    return {
      totalProjects: 0,
      totalDeliverables: 0,
      totalTasks: 0,
    };
  } catch (error) {
    console.error('❌ [ClientApi] Error fetching stats:', error);
    return { totalProjects: 0, totalDeliverables: 0, totalTasks: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format timestamp to readable string
 */
export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

/**
 * Get greeting based on time of day
 */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Get user initials for avatar
 */
export const getUserInitials = (user: User | null): string => {
  if (!user) return '?';
  const name = user.full_name || user.email || 'User';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Get user display name
 */
export const getUserDisplayName = (user: User | null): string => {
  if (!user) return 'Guest';
  return user.full_name || user.email || 'Client';
};