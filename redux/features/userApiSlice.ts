// @/redux/features/userApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface OrganisationMembership {
  id: number;
  organisation: {
    id: number;
    name: string;
  };
  role: string;
}

interface UserDeliverable {
  id: number;
  name: string;
  project: {
    id: number;
    name: string;
    location: string;
    client_name: string;
    current_stage: string;
  };
  stage: string;
  stage_name: string;
  status: string;
  status_name: string;
  start_date?: string;
  end_date?: string;
  validation_date?: string;
}

interface UserWorkLog {
  id: number;
  deliverable: string;
  project: string;
  organisation: string;  // Add this line
  start_time: string;
  end_time?: string;
  duration?: number;
}

export const userApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUserDetails: builder.query<User, string>({
      query: (userId) => `/users/${userId}/`,
      providesTags: (result, error, userId) => [{ type: 'User', id: userId }],
    }),

    getUserOrganisations: builder.query<OrganisationMembership[], string>({
      query: (userId) => `/users/${userId}/organisations/`,
      providesTags: (result, error, userId) => [
        { type: 'UserOrganisations', id: userId },
        ...(result?.map(({ id }) => ({ type: 'Membership' as const, id })) ?? [])
      ],
    }),

    getUserDeliverables: builder.query<UserDeliverable[], string>({
      query: (userId) => `/users/${userId}/deliverables/`,
      providesTags: (result, error, userId) => [
        { type: 'UserDeliverables', id: userId },
        ...(result?.map(({ id }) => ({ type: 'Deliverable' as const, id })) ?? [])
      ],
    }),

    getUserWorkLogs: builder.query<UserWorkLog[], string>({
      query: (userId) => `/users/${userId}/worklogs/`,
      providesTags: (result, error, userId) => [
        { type: 'UserWorkLogs', id: userId },
        ...(result?.map(({ id }) => ({ type: 'Worklog' as const, id })) ?? [])
      ],
    }),
  }),
});

export const { 
  useGetUserDetailsQuery,
  useGetUserOrganisationsQuery,
  useGetUserDeliverablesQuery,
  useGetUserWorkLogsQuery,
} = userApiSlice;