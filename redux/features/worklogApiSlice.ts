import { apiSlice } from "@/redux/services/apiSlice";

// Define types for Worklog, Project, and Deliverable
interface Worklog {
  id: number;
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  employee: number;
}

interface CreateWorklogRequest {
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  employee?: number; // employee is optional as it'll be added from the interceptor
}

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
}

interface Deliverable {
  id: number;
  name: string;
  project: number;  // This is required
}


// Extend the API slice with endpoints
export const worklogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createWorklog: builder.mutation<Worklog, Omit<CreateWorklogRequest, 'employee'>>({
      query: (worklog) => ({
        url: "/work-logs/",
        method: "POST",
        body: worklog,
      }),
      transformResponse: (response: Worklog) => response,
      invalidatesTags: ['Worklog', 'Deliverables'],
    }),

    getWorklogs: builder.query<Worklog[], void>({
      query: () => "/work-logs/",
      transformResponse: (response: Worklog[]) => response,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Worklog' as const, id })), 'Worklog']
          : ['Worklog'],
    }),

    getWorklogById: builder.query<Worklog, number>({
      query: (id) => `/work-logs/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Worklog', id }],
    }),

    updateWorklog: builder.mutation<Worklog, Partial<Worklog> & Pick<Worklog, 'id'>>({
      query: ({ id, ...patch }) => ({
        url: `/work-logs/${id}/`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Worklog', id }],
    }),

    deleteWorklog: builder.mutation<{ success: boolean; id: number }, number>({
      query: (id) => ({
        url: `/work-logs/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Worklog', id }],
    }),

    getProjects: builder.query<Project[], void>({
      query: () => "/projects/",
      transformResponse: (response: Project[]) => response,
      providesTags: ['Projects'],
    }),

    getDeliverables: builder.query<Deliverable[], void>({
      query: () => "/deliverables/",
      transformResponse: (response: Deliverable[]) => response,
      providesTags: ['Deliverables'],
    }),
  }),
  // ❌ Do NOT add `tagTypes` here. Only in `apiSlice.ts`
});

export const {
  useCreateWorklogMutation,
  useGetWorklogsQuery,
  useGetWorklogByIdQuery,
  useUpdateWorklogMutation,
  useDeleteWorklogMutation,
  useGetProjectsQuery,
  useGetDeliverablesQuery,
} = worklogApiSlice;
