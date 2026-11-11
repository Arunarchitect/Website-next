import axios from "axios";
import {
  Estimate,
  EstimateDetail,
  EstimateStatus,
  Organisation,
  Project,
  RawMembership,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST || "http://127.0.0.1:8000";
const API_URL = `${API_BASE_URL}/api`;

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access") ||
    sessionStorage.getItem("access_token") ||
    null
  );
};

const getCsrfToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? match[1] : null;
};

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { Accept: "application/json" },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const csrf = getCsrfToken();
  if (csrf && ["post", "put", "patch", "delete"].includes(config.method?.toLowerCase() || "")) {
    config.headers["X-CSRFToken"] = csrf;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const refresh = localStorage.getItem("refresh");
      if (refresh && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
          if (res.data.access) {
            localStorage.setItem("access", res.data.access);
            error.config.headers.Authorization = `Bearer ${res.data.access}`;
            return apiClient(error.config);
          }
        } catch {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          if (!window.location.pathname.includes("/login")) {
            window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

/** Flattens DRF errors ({detail} | {field: [msgs]} | string) into one message. */
const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data as unknown;
    if (typeof data === "string") return data.length < 300 ? data : fallback;
    if (typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      if (typeof d.detail === "string") return d.detail;
      const parts: string[] = [];
      Object.values(d).forEach((v) => {
        if (Array.isArray(v)) v.forEach((m) => typeof m === "string" && parts.push(m));
        else if (typeof v === "string") parts.push(v);
      });
      if (parts.length) return parts.join(" ");
    }
  }
  return fallback;
};

// ── lookups (same endpoints the drawings app uses) ──────────────────────
export const getOrganisations = async (): Promise<Organisation[]> => {
  const res = await apiClient.get("/drawings/organisations/");
  return res.data;
};

export const getProjects = async (organisationId?: number): Promise<Project[]> => {
  const url = organisationId
    ? `/drawings/projects/?organisation_id=${organisationId}`
    : "/drawings/projects/";
  const res = await apiClient.get(url);
  return res.data;
};

export const getMyMemberships = async (): Promise<RawMembership[]> => {
  try {
    const res = await apiClient.get("/my-memberships/");
    return res.data;
  } catch {
    return [];
  }
};

// ── estimates ───────────────────────────────────────────────────────────
export interface EstimateFilters {
  organisationId?: number;
  projectId?: number;
  status?: EstimateStatus;
  search?: string;
}

export const getEstimates = async (filters: EstimateFilters = {}): Promise<Estimate[]> => {
  try {
    const params: Record<string, string | number> = {};
    if (filters.organisationId) params.organisation_id = filters.organisationId;
    if (filters.projectId) params.project_id = filters.projectId;
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;
    const res = await apiClient.get("/estimate/estimates/", { params });
    return Array.isArray(res.data) ? res.data : res.data.results ?? [];
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to load estimates"));
  }
};

export const getEstimate = async (id: number): Promise<EstimateDetail> => {
  try {
    const res = await apiClient.get(`/estimate/estimates/${id}/`);
    return res.data;
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to load estimate"));
  }
};

export const createEstimate = async (formData: FormData): Promise<EstimateDetail> => {
  try {
    const res = await apiClient.post("/estimate/estimates/", formData);
    return res.data;
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to create estimate"));
  }
};

export const updateEstimate = async (id: number, formData: FormData): Promise<EstimateDetail> => {
  try {
    const res = await apiClient.patch(`/estimate/estimates/${id}/`, formData);
    return res.data;
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to update estimate"));
  }
};

export const setEstimateStatus = async (
  id: number,
  status: EstimateStatus
): Promise<EstimateDetail> => {
  try {
    const res = await apiClient.patch(`/estimate/estimates/${id}/`, { status });
    return res.data;
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to change status"));
  }
};

export const deleteEstimate = async (id: number): Promise<void> => {
  try {
    await apiClient.delete(`/estimate/estimates/${id}/`);
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to delete estimate"));
  }
};

export const downloadEstimateCsv = async (est: Estimate): Promise<void> => {
  try {
    const res = await apiClient.get(`/estimate/estimates/${est.id}/download/`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = est.original_filename || `estimate_${est.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (e) {
    throw new Error(apiErrorMessage(e, "Failed to download CSV"));
  }
};