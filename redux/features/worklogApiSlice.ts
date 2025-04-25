import { apiSlice } from "@/redux/services/apiSlice";

interface Worklog {
  id: number;
  project: number;
  work_type: number;
  start_time: string;
  end_time: string;
  employee: number;
}

interface CreateWorklogRequest {
  project: number;
  work_type: number;
  start_time: string;
  end_time: string;
  employee?: number; // Made optional since it will be added in the interceptor
}

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
}

interface WorkType {
  id: number;
  name: string;
}

export const worklogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createWorklog: builder.mutation<Worklog, Omit<CreateWorklogRequest, 'employee'>>({
      query: (worklog) => ({
        url: "/work-logs/",
        method: "POST",
        body: worklog,
      }),
      transformResponse: (response: Worklog) => response,
      transformErrorResponse: (response: { status: number, data?: any }) => {
        return {
          status: response.status,
          data: response.data || 'Failed to create worklog'
        };
      },
      invalidatesTags: ['Worklog'],
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

    // Fetch all projects
    getProjects: builder.query<Project[], void>({
      query: () => "/projects/",
      transformResponse: (response: Project[]) => response,
      providesTags: ['Projects'],
    }),

    // Fetch all work types
    getWorkTypes: builder.query<WorkType[], void>({
      query: () => "/work-types/",
      transformResponse: (response: WorkType[]) => response,
      providesTags: ['WorkTypes'],
    }),
  }),
});

export const {
  useCreateWorklogMutation,
  useGetWorklogsQuery,
  useGetWorklogByIdQuery,
  useUpdateWorklogMutation,
  useDeleteWorklogMutation,
  useGetProjectsQuery,       // Hook for fetching projects
  useGetWorkTypesQuery,      // Hook for fetching work types
} = worklogApiSlice;
