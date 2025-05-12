import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { setAuth, logout } from "../features/authSlice";
import { Mutex } from "async-mutex";

const mutex = new Mutex();

// Create base query with auth headers
const baseQuery = fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_HOST}/api`,
  prepareHeaders: (headers) => {
    // Only try to get token if we're in the browser environment
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return headers;
  }
});

// Enhanced base query with re-authentication logic
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs, 
  unknown, 
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Wait for any pending reauth to complete
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  // If 401 error, try to refresh token
  if (result.error?.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        // Try to get refresh token
        const refresh = typeof window !== 'undefined' 
          ? localStorage.getItem('refresh') 
          : null;

        if (!refresh) {
          api.dispatch(logout());
          return result;
        }

        // Attempt to refresh the token
        const refreshResult = await baseQuery(
          {
            url: '/token/refresh/',
            method: 'POST',
            body: { refresh }
          },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          // Update stored access token with new one
          const { access } = refreshResult.data as { access: string };
          if (typeof window !== 'undefined') {
            localStorage.setItem('access', access);
          }
          
          // Update auth state and retry original request
          api.dispatch(setAuth());
          result = await baseQuery(args, api, extraOptions);
        } else {
          // Refresh failed - logout user
          api.dispatch(logout());
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }
      } finally {
        release();
      }
    } else {
      // Wait for the pending reauth to complete and retry
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }

  return result;
};

// Create API slice with all tag types
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  // Include all tag types used across different API slices
  tagTypes: [
    'User',           // For user-related endpoints
    'Auth',           // For authentication state
    'Worklog',        // For worklog endpoints
    'Project',        // For project endpoints
    'Deliverable',    // For deliverable endpoints
    'Membership',     // For membership endpoints
    'Organization'    // For organization endpoints
  ],
  endpoints: () => ({}), // Endpoints are injected in feature slices
});

export default apiSlice;