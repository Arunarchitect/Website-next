// app/main/admin/adminApi.ts

import axios from 'axios';
import { Organisation, User, DashboardIssue, DashboardStats } from './types';
import { fetchAreacalcRole } from '@/lib/resolveUserDestination';

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

// Get current user info.
// FIX: previously this rebuilt the user from only id/email/names, which threw
// away every admin field (is_admin, is_staff, role, ...) and made the admin
// check always fail. We now spread the stored user so those fields survive.
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      return {
        ...userData,
        id: userData.id || 0,
        email: userData.email || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        full_name:
          `${userData.first_name || ''} ${userData.last_name || ''}`.trim() ||
          userData.email ||
          '',
        username: userData.username || userData.email || '',
      } as User;
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

// ---------------------------------------------------------------------------
// Admin check
// ---------------------------------------------------------------------------

function hasAdminFlag(user: User | null): boolean {
  if (!user) return false;
  const u = user as unknown as Record<string, unknown>;
  return (
    u.is_admin === true ||
    u.is_staff === true ||
    u.is_superuser === true ||
    u.is_org_admin === true ||
    (typeof u.role === 'string' && u.role.toLowerCase() === 'admin') ||
    (typeof u.user_type === 'string' && u.user_type.toLowerCase() === 'admin')
  );
}

export interface AdminCheckResult {
  user: User | null;
  isAdmin: boolean;
}

type OrgRole = 'admin' | 'manager' | 'member' | 'client' | null;
const ROLE_PRIORITY: Exclude<OrgRole, null>[] = ['admin', 'manager', 'member', 'client'];

// Same source the login redirect uses: /api/my-memberships/.
// Highest-priority role wins (admin > manager > member > client).
export const getHighestOrgRole = async (): Promise<OrgRole> => {
  try {
    const res = await apiClient.get('/my-memberships/');
    const data = res.data;
    const list: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
        ? data.results
        : [];

    const roles = list.map((m) =>
      String(m.role ?? m.membership_role ?? '').toLowerCase()
    );
    console.log('[admin check] membership roles:', roles, 'raw:', list);

    return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
  } catch (error) {
    console.error('Error fetching memberships:', error);
    return null;
  }
};

// Mirrors login rules 1 and 2 for /main/admin:
//   1. org role is admin or manager
//   2. org role is member AND areacalc role is admin or member
export const checkIsAdmin = async (): Promise<AdminCheckResult> => {
  const user = await getCurrentUser();
  if (!user) return { user: null, isAdmin: false };

  if (hasAdminFlag(user)) return { user, isAdmin: true };

  const orgRole = await getHighestOrgRole();
  let isAdmin = orgRole === 'admin' || orgRole === 'manager';

  if (!isAdmin && orgRole === 'member') {
    try {
      const token = getAuthToken();
      const areacalcRole = token ? await fetchAreacalcRole(token) : null;
      isAdmin = areacalcRole === 'admin' || areacalcRole === 'member';
    } catch (e) {
      console.error('Areacalc role check failed:', e);
    }
  }

  console.log('[admin check] orgRole:', orgRole, '-> isAdmin:', isAdmin);
  return { user, isAdmin };
};

// ---------------------------------------------------------------------------
// Issues / stats (unchanged)
// ---------------------------------------------------------------------------

// Unwraps either a bare array or a DRF-paginated {count, next, previous,
// results} envelope.
function unwrapListResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { results?: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }
  console.warn('⚠️ Unexpected list response shape from /issues/issues/:', data);
  return [];
}

// NOTE: /issues/issues/ is paginated, so this only returns ONE PAGE of
// issues. Use getDashboardStats() for accurate counts.
export const getIssuesByOrganisation = async (organisationId: number): Promise<DashboardIssue[]> => {
  try {
    const response = await apiClient.get('/issues/issues/', {
      params: {
        organisation: organisationId || undefined,
      },
    });

    return unwrapListResponse<DashboardIssue>(response.data);
  } catch (error) {
    console.error('Error fetching issues:', error);
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
export const getPriorityColor = (priority: DashboardIssue['priority']): string => {
  switch (priority) {
    case 'High': return '#D43E3E';
    case 'Medium': return '#E8A838';
    case 'Low': return '#4A8B6B';
    default: return '#6E6B62';
  }
};

// Helper to get status color
export const getStatusColor = (status: DashboardIssue['status']): string => {
  switch (status) {
    case 'Open': return '#D43E3E';
    case 'In Progress': return '#E8A838';
    case 'Resolved': return '#4A8B6B';
    case 'Closed': return '#6B7280';
    default: return '#6E6B62';
  }
};