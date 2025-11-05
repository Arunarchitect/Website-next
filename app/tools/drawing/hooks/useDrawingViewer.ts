import { useState, useCallback } from "react";
import { 
  Organisation, 
  Project, 
  Deliverable, 
  Drawing 
} from "../types";

const API_BASE_URL = "http://localhost:8000/api/drawings";

interface DrawingViewerState {
  accessKey: string;
  isLoading: boolean;
  isLoadingProjects: boolean;
  isLoadingDeliverables: boolean;
  isLoadingDrawings: boolean;
  error: string;
  organisation: Organisation | null;
  projects: Project[];
  selectedProject: Project | null;
  deliverables: Deliverable[];
  selectedDeliverable: Deliverable | null;
  drawings: Drawing[];
}

export const useDrawingViewer = (initialAccessKey: string) => {
  const [state, setState] = useState<DrawingViewerState>({
    accessKey: initialAccessKey,
    isLoading: false,
    isLoadingProjects: false,
    isLoadingDeliverables: false,
    isLoadingDrawings: false,
    error: "",
    organisation: null,
    projects: [],
    selectedProject: null,
    deliverables: [],
    selectedDeliverable: null,
    drawings: [],
  });

  const updateState = useCallback((updates: Partial<DrawingViewerState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const fetchData = useCallback(async (url: string, errorMessage: string) => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetails = errorData.detail || errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = response.statusText;
        }
        throw new Error(`${errorMessage}: ${errorDetails}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      updateState({ error: (error as Error).message });
      return null;
    }
  }, [updateState]);

  const fetchProjects = useCallback(async (key: string) => {
    updateState({ 
      isLoading: true, 
      isLoadingProjects: true,
      error: "" 
    });

    const data = await fetchData(
      `${API_BASE_URL}/public/access/${key}/projects/`,
      "Invalid access key or failed to fetch projects"
    );

    if (data) {
      updateState({
        organisation: data.organisation,
        projects: data.projects || [],
        selectedProject: null,
        deliverables: [],
        selectedDeliverable: null,
        drawings: [],
      });
    }

    updateState({ 
      isLoading: false, 
      isLoadingProjects: false 
    });
  }, [fetchData, updateState]);

  const fetchDeliverables = useCallback(async (projectId: number) => {
    updateState({ 
      isLoadingDeliverables: true,
      deliverables: [], // Clear previous deliverables while loading
      selectedDeliverable: null,
      drawings: [],
    });

    const data = await fetchData(
      `${API_BASE_URL}/public/access/${state.accessKey}/projects/${projectId}/deliverables/`,
      "Failed to fetch deliverables"
    );

    if (data) {
      updateState({
        deliverables: data.deliverables || [],
        selectedDeliverable: null,
        drawings: [],
      });
    }

    updateState({ isLoadingDeliverables: false });
  }, [state.accessKey, fetchData, updateState]);

  const fetchDrawings = useCallback(async (projectId: number, deliverableId: number) => {
    updateState({ 
      isLoadingDrawings: true,
      drawings: [], // Clear previous drawings while loading
    });

    const data = await fetchData(
      `${API_BASE_URL}/public/access/${state.accessKey}/projects/${projectId}/deliverables/${deliverableId}/drawings/`,
      "Failed to fetch drawings"
    );

    if (data) {
      updateState({ drawings: data.drawings || [] });
    }

    updateState({ isLoadingDrawings: false });
  }, [state.accessKey, fetchData, updateState]);

  return {
    state,
    updateState,
    fetchProjects,
    fetchDeliverables,
    fetchDrawings,
  };
};