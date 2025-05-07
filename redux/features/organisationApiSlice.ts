// organisationApiSlice.ts

import { apiSlice } from "@/redux/services/apiSlice";

export const organisationApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    // Fetch all organisations
    getOrganisations: builder.query<Organisation[], void>({
      query: () => "/organisations/",
      providesTags: ["Organisation"],
    }),

    // Fetch projects under a specific organisation
    getProjectsByOrg: builder.query<Project[], number>({
      query: (organisationId) => `/projects/?organisation=${organisationId}`,
      providesTags: ["Project"],
    }),
  }),
});

export const {
  useGetOrganisationsQuery,
  useGetProjectsByOrgQuery,
} = organisationApiSlice;

// Types
interface Organisation {
  id: number;
  name: string;
  // Add more fields if you have (optional)
}

interface Project {
  id: number;
  name: string;
  // Add more fields if you have (optional)
}
