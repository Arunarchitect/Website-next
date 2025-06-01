// worklogApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";

interface Worklog {
  id: number;
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  employee: number;
  remarks?: string | null;
}

interface CreateWorklogRequest {
  project: number;
  deliverable: number;
  start_time: string;
  end_time: string;
  remarks?: string | null;
}

interface UpdateWorklogRequest extends Partial<CreateWorklogRequest> {
  id: number;
}

export const worklogApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    createWorklog: builder.mutation<Worklog, CreateWorklogRequest>({
      query: (body) => ({
        url: "/work-logs/",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Worklog"],
    }),

    getWorklogs: builder.query<Worklog[], void>({
      query: () => "/work-logs/",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Worklog" as const, id })),
              { type: "Worklog", id: "LIST" },
            ]
          : [{ type: "Worklog", id: "LIST" }],
    }),

    getWorklogById: builder.query<Worklog, number>({
      query: (id) => `/work-logs/${id}/`,
      providesTags: (result, error, id) => [{ type: "Worklog", id }],
    }),

    updateWorklog: builder.mutation<Worklog, UpdateWorklogRequest>({
      query: ({ id, ...body }) => ({
        url: `/work-logs/${id}/`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Worklog", id }],
    }),

    deleteWorklog: builder.mutation<void, number>({
      query: (id) => ({
        url: `/work-logs/${id}/`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Worklog", id }],
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