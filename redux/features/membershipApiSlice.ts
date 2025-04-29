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
}

export const membershipApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMyMemberships: builder.query<Membership[], void>({
      query: () => "/my-memberships/",
      providesTags: ["User"],
    }),
  }),
});

export const { useGetMyMembershipsQuery } = membershipApiSlice;
