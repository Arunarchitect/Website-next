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

export const worklogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createWorklog: builder.mutation<Worklog, Omit<CreateWorklogRequest, 'employee'>>({
      query: (worklog) => ({
        url: "/projects/work-logs/",
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
      query: () => "/projects/work-logs/",
      transformResponse: (response: Worklog[]) => response,
      providesTags: (result) => 
        result 
          ? [...result.map(({ id }) => ({ type: 'Worklog' as const, id })), 'Worklog']
          : ['Worklog'],
    }),
    getWorklogById: builder.query<Worklog, number>({
      query: (id) => `/projects/work-logs/${id}/`,
      providesTags: (result, error, id) => [{ type: 'Worklog', id }],
    }),
    updateWorklog: builder.mutation<Worklog, Partial<Worklog> & Pick<Worklog, 'id'>>({
      query: ({ id, ...patch }) => ({
        url: `/projects/work-logs/${id}/`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Worklog', id }],
    }),
    deleteWorklog: builder.mutation<{ success: boolean; id: number }, number>({
      query: (id) => ({
        url: `/projects/work-logs/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Worklog', id }],
    }),
  }),
});

export const {
  useCreateWorklogMutation,
  useGetWorklogsQuery,
  useGetWorklogByIdQuery,
  useUpdateWorklogMutation,
  useDeleteWorklogMutation,
} = worklogApiSlice;