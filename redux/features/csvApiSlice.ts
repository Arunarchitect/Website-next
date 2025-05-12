import { apiSlice } from '@/redux/services/apiSlice'; // Reuse the existing apiSlice

export const extendedApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    downloadDeliverablesCSV: builder.query<string, void>({
      query: () => ({
        url: '/deliverables/download_csv/',
        method: 'GET',
        responseHandler: (response) => response.text(), // CSV is plain text
      }),
    }),
    downloadWorklogsCSV: builder.query<string, void>({
      query: () => ({
        url: '/work-logs/download_csv/',
        method: 'GET',
        responseHandler: (response) => response.text(),
      }),
    }),
  }),
  overrideExisting: false,
});

// Export hooks
export const { useDownloadDeliverablesCSVQuery, useDownloadWorklogsCSVQuery } = extendedApiSlice;
