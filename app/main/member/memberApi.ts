// app/main/member/memberApi.ts
import axios from 'axios';
import { Organisation, User, DashboardIssue, DashboardStats } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api`;

// Helper to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access') || localStorage.getItem('access_token') || null;
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

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Get current user info
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      return {
        id: userData.id || 0,
        email: userData.email || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email || '',
        username: userData.username || userData.email || '',
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Fetch user's organisations
export const getUserOrganisations = async (): Promise<Organisation[]> => {
  try {
    const response = await apiClient.get('/my-organisations/');
    return response.data;
  } catch (error) {
    console.error('Error fetching organisations:', error);
    return [];
  }
};

interface PaginatedList<T> {
  results?: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
}

function unwrapListResponse<T>(data: T[] | PaginatedList<T>): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  console.warn('⚠️ Unexpected list response shape from /issues/issues/:', data);
  return [];
}

// Fetch issues for a specific organisation.
// NOTE: /issues/issues/ is paginated — this returns ONE PAGE only, so it's
// NOT reliable for counts (use getDashboardStats for that) and not reliable
// for "give me everything assigned to me" either (use getMyAssignedIssues,
// which filters server-side by assigned_to so it doesn't depend on paging
// through everything to find a match).
export const getIssuesByOrganisation = async (
  organisationId: number,
  extraParams?: { page_size?: number }
): Promise<DashboardIssue[]> => {
  try {
    const response = await apiClient.get('/issues/issues/', {
      params: {
        organisation: organisationId || undefined,
        ...extraParams,
      },
    });
    return unwrapListResponse<DashboardIssue>(response.data);
  } catch (error) {
    console.error('Error fetching issues:', error);
    return [];
  }
};

// Issues assigned to the given user, scoped to an organisation. Filters
// server-side by assigned_to (user id) — no client-side name/email
// string-matching needed, and no dependency on which page a matching
// issue happens to land on.
export const getMyAssignedIssues = async (
  organisationId: number | undefined,
  userId: number | undefined,
  limit: number = 50
): Promise<DashboardIssue[]> => {
  if (!userId) return [];
  try {
    const response = await apiClient.get('/issues/issues/', {
      params: {
        organisation: organisationId || undefined,
        assigned_to: userId,
        page_size: limit,
      },
    });
    return unwrapListResponse<DashboardIssue>(response.data);
  } catch (error) {
    console.error('Error fetching assigned issues:', error);
    return [];
  }
};

// Backend shape returned by /issues/issues/stats/
interface RawIssueStats {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  low: number;
  medium: number;
  high: number;
  total: number;
}

// Get dashboard stats — backed by the dedicated stats endpoint, which
// aggregates over the FULL filtered queryset in the database rather than
// whatever page of issues happens to be loaded client-side.
export const getDashboardStats = async (organisationId?: number): Promise<DashboardStats> => {
  try {
    const response = await apiClient.get('/issues/issues/stats/', {
      params: {
        organisation: organisationId || undefined,
      },
    });
    const raw = response.data as RawIssueStats;

    return {
      open: raw.open ?? 0,
      inProgress: raw.in_progress ?? 0,
      resolved: raw.resolved ?? 0,
      highPriority: raw.high ?? 0,
      total: raw.total ?? 0,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      open: 0,
      inProgress: 0,
      resolved: 0,
      highPriority: 0,
      total: 0,
    };
  }
};

// Helper to format timestamp
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

// Helper to get priority color
export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'High': return '#D43E3E';
    case 'Medium': return '#E8A838';
    case 'Low': return '#4A8B6B';
    default: return '#6E6B62';
  }
};

// Helper to get status color
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Open': return '#D43E3E';
    case 'In Progress': return '#E8A838';
    case 'Resolved': return '#4A8B6B';
    case 'Closed': return '#6B7280';
    default: return '#6E6B62';
  }
};