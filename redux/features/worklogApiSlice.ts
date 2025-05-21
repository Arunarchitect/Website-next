import { apiSlice } from "@/redux/services/apiSlice";

interface Worklog {
  id: number;
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  employee: number;
  remarks: string;
}

interface CreateWorklogRequest {
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
}

export const worklogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createWorklog: builder.mutation<Worklog, CreateWorklogRequest>({
      query: (body) => ({
        url: "/work-logs/",
        method: "POST",
        body,
      }),
      invalidatesTags: ['Worklog'],
    }),

    getWorklogs: builder.query<Worklog[], void>({
      query: () => "/work-logs/",
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

    deleteWorklog: builder.mutation<void, number>({
      query: (id) => ({
        url: `/work-logs/${id}/`,
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