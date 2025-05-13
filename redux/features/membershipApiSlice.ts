// redux/features/membershipApiSlice.ts
import { apiSlice } from "@/redux/services/apiSlice";

export interface Membership {
  id: number;
  organisation: number;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  role: "admin" | "manager" | "member";
  organisation_name?: string; // 👈 Add this line
}

export interface Organisation {
  id: number;
  name: string;
}

export const membershipApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMyMemberships: builder.query<Membership[], void>({
      query: () => "/my-memberships/",
      providesTags: ["User"],
    }),

    // New endpoint to get organizations
    getMyOrganisations: builder.query<Organisation[], void>({
      query: () => "/my-organisations/",
      providesTags: ["User"],
    }),
  }),
});

export const { useGetMyMembershipsQuery, useGetMyOrganisationsQuery } = membershipApiSlice;
