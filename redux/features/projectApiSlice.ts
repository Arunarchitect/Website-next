import { apiSlice } from "@/redux/services/apiSlice";

interface Deliverable {
  name: string;
  stage: string;
  status: string;
  remarks: string;
}

interface DeliverableSummary {
  name: string;
  duration_seconds: number;
}

interface ProjectDetails {
  project: string;
  current_stage: string;
  total_duration_seconds: number;
  deliverables: Deliverable[];
  deliverables_summary?: DeliverableSummary[];
}

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
  organisation: number; // <-- Add this line
}

export const projectApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => "/projects/",
      providesTags: ['Project'],
    }),
    getProjectSummary: builder.query<ProjectDetails, string>({
      query: (id) => `/projects/${id}/summary/`,
      providesTags: (result, error, id) => [{ type: 'Project', id }],
    }),
  }),
});

export const { useGetProjectsQuery, useGetProjectSummaryQuery } = projectApiSlice;
