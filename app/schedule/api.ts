/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import type { Task, Sequence, SchedulePerson } from "./data";

// ── Same base URL pattern as productApi.ts ───────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api`;

// ── Token reader (matches productApi.ts) ─────────────────────────────────
const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access") ||
    null
  );
};

// ── Redirect on 401 (same as productApi.ts) ──────────────────────────────
function redirectToLogin() {
  if (typeof window === "undefined") return;
  const current = window.location.pathname + window.location.search;
  const shouldAttachNext =
    current && current !== "/" && !current.startsWith("/auth/login");
  const target = shouldAttachNext
    ? `/auth/login?next=${encodeURIComponent(current)}`
    : "/auth/login";
  if (window.location.pathname + window.location.search !== target) {
    window.location.href = target;
  }
}

// ── Axios instance ───────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

// ── Error class — preserved so useScheduleSync's status checks work ──────
export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(
      typeof body === "string"
        ? body
        : body?.detail ?? body?.non_field_errors?.[0] ?? `HTTP ${status}`
    );
    this.status = status;
    this.body = body;
  }
}

function wrapAxiosError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    return new ApiError(
      err.response?.status ?? 0,
      err.response?.data ?? err.message
    );
  }
  if (err instanceof ApiError) return err;
  return new ApiError(0, err instanceof Error ? err.message : "Unknown error");
}

// ── Types ────────────────────────────────────────────────────────────────
export interface ScheduleDoc {
  id: number;
  project: number;
  name: string;
  version: number;
  calendar: unknown | null;
  tasks: Task[];
  sequences: Sequence[];
  canEdit?: boolean;
  scope?: "MAIN" | "PERSONAL";
  ownerId?: number | null;
  ownerName?: string | null;
  sourceId?: number | null;
  basedOnVersion?: number | null;
  mainVersion?: number;
}

export interface ScheduleListItem {
  id: number;
  name: string;
  version: number;
  predefinedType?: string;
  updatedAt?: string;
  scope?: "MAIN" | "PERSONAL";
  ownerName?: string | null;
  isMine?: boolean;
}

export interface MyProjectSchedule {
  id: number;
  name: string;
  predefinedType: string;
  version: number;
  scope: "MAIN" | "PERSONAL";
  ownerId: number | null;
  ownerName: string | null;
  isMine: boolean;
  canEdit: boolean;
  basedOnVersion: number | null;
}

export interface MyProject {
  id: number;
  name: string;
  clientName: string;
  organisation: string;
  isCompleted: boolean;
  role: "admin" | "manager" | "member" | "client";
  canEdit: boolean;
  mainId: number | null;
  schedules: MyProjectSchedule[];
}

// ── Endpoints ────────────────────────────────────────────────────────────
export async function listMyProjects(): Promise<MyProject[]> {
  try {
    const res = await apiClient.get<MyProject[]>("/schedules/projects/");
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function listSchedules(projectId: number): Promise<{
  canEdit: boolean;
  results: ScheduleListItem[];
}> {
  try {
    const res = await apiClient.get("/schedules/", {
      params: { project: projectId },
    });
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function getSchedule(id: number): Promise<ScheduleDoc> {
  try {
    const res = await apiClient.get<ScheduleDoc>(`/schedules/${id}/`);
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function createSchedule(
  project: number,
  name: string
): Promise<ScheduleDoc> {
  try {
    const res = await apiClient.post<ScheduleDoc>("/schedules/", {
      project,
      name,
    });
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function saveSchedule(
  id: number,
  body: {
    version: number;
    tasks: Task[];
    sequences: Sequence[];
    calendar: unknown | null;
  }
): Promise<{ version: number; updatedAt: string }> {
  try {
    const res = await apiClient.put(`/schedules/${id}/`, body);
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}


export async function importSchedule(
  id: number,
  file: File
): Promise<ScheduleDoc> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await apiClient.post<ScheduleDoc>(
      `/schedules/${id}/import/`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}


export async function forkSchedule(mainId: number): Promise<ScheduleDoc> {
  try {
    const res = await apiClient.post<ScheduleDoc>(`/schedules/${mainId}/fork/`);
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function pullMainSchedule(id: number): Promise<ScheduleDoc> {
  try {
    const res = await apiClient.post<ScheduleDoc>(`/schedules/${id}/pull-main/`);
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function promoteSchedule(id: number): Promise<ScheduleDoc> {
  try {
    const res = await apiClient.post<ScheduleDoc>(`/schedules/${id}/promote/`);
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function listPeople(projectId: number): Promise<{
  people: SchedulePerson[];
  mePersonId: number | null;
}> {
  try {
    const res = await apiClient.get("/schedules/people/", {
      params: { project: projectId },
    });
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function addPerson(
  projectId: number,
  name: string,
  email?: string
): Promise<SchedulePerson> {
  try {
    const res = await apiClient.post<SchedulePerson>("/schedules/people/", {
      project: projectId,
      name,
      email: email ?? "",
    });
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}

export async function updatePerson(
  id: number,
  patch: { name?: string; email?: string; userId?: number | null }
): Promise<SchedulePerson> {
  try {
    const res = await apiClient.patch<SchedulePerson>(
      `/schedules/people/${id}/`,
      patch
    );
    return res.data;
  } catch (err) {
    throw wrapAxiosError(err);
  }
}