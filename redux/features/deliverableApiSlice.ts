import { apiSlice } from "@/redux/services/apiSlice";

interface Deliverable {
  id: number;
  name: string;
  project: number;
}

export const deliverableApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDeliverables: builder.query<Deliverable[], void>({
      query: () => "/deliverables/",
      providesTags: ['Deliverable'],
    }),
  }),
});

export const { useGetDeliverablesQuery } = deliverableApiSlice;