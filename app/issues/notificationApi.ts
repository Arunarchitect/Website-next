// notificationApi.ts

import axios from 'axios';
import { API_URL } from './issueApi';

export interface NotificationActor {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  username: string;
}

export type NotificationType = 'issue_created' | 'mentioned' | 'issue_resolved';

export interface AppNotification {
  id: number;
  actor: NotificationActor | null;
  notification_type: NotificationType;
  notification_type_display: string;
  issue: number;
  issue_title: string;
  comment_id: number | null;
  message: string;
  is_priority: boolean;
  is_read: boolean;
  created: string;
}

export interface PaginatedNotifications {
  results: AppNotification[];
  count: number;
  next: string | null;
  previous: string | null;
}

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('access') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('access') ||
    sessionStorage.getItem('access_token') ||
    null
  );
};

const getCsrfToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? match[1] : null;
};

const notificationClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  withCredentials: true,
});

notificationClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const csrfToken = getCsrfToken();
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

/**
 * Some endpoints return a bare array, others a DRF-style paginated object
 * ({ results: [...] }). Accepts `unknown` (rather than `any`) and narrows
 * it safely before returning a typed array.
 */
function unwrapListResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray((data as { results?: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export async function getNotifications(params?: {
  unread?: boolean;
  page?: number;
  page_size?: number;
}): Promise<PaginatedNotifications> {
  try {
    const response = await notificationClient.get('/notifications/', { params });
    const data = response.data;
    if (Array.isArray(data)) {
      return { results: data, count: data.length, next: null, previous: null };
    }
    return {
      results: unwrapListResponse<AppNotification>(data),
      count: data.count ?? 0,
      next: data.next ?? null,
      previous: data.previous ?? null,
    };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const response = await notificationClient.get('/notifications/unread-count/');
    return response.data?.count ?? 0;
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
}

export async function markNotificationRead(id: number | string): Promise<AppNotification | undefined> {
  try {
    const response = await notificationClient.patch(`/notifications/${id}/mark-read/`);
    return response.data;
  } catch (error) {
    console.error('Error marking notification read:', error);
    throw error;
  }
}

export async function markAllNotificationsRead(): Promise<number> {
  try {
    const response = await notificationClient.post('/notifications/mark-all-read/');
    return response.data?.updated ?? 0;
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    throw error;
  }
}

export async function deleteNotification(id: number | string): Promise<void> {
  try {
    await notificationClient.delete(`/notifications/${id}/`);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

export async function deleteAllReadNotifications(): Promise<number> {
  try {
    const response = await notificationClient.post('/notifications/delete-all-read/');
    return response.data?.deleted ?? 0;
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    throw error;
  }
}

const notificationApi = {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllReadNotifications,
};

export default notificationApi;