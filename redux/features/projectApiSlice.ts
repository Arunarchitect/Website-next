import { apiSlice } from "@/redux/services/apiSlice";

interface Project {
  id: number;
  name: string;
  location: string;
  client_name: string;
  current_stage: string;
}

export const projectApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => "/projects/",
      providesTags: ['Project'],
    }),
  }),
});

export const { useGetProjectsQuery } = projectApiSlice;