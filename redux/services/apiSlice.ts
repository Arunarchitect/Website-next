import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { setAuth, logout } from "../features/authSlice";
import { Mutex } from "async-mutex";

const mutex = new Mutex();

// Base query with re-authentication logic
const baseQuery = fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_HOST || 'https://api.modelflick.com'}/api`,
  credentials: "include",
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('access');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }
});

// Base query with token refresh mechanism
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  // Handle 401 Unauthorized errors for token refresh
  if (result.error && result.error.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshResult = await baseQuery(
          {
            url: "/jwt/refresh/",
            method: "POST",
          },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          // Store new tokens
          const { access } = refreshResult.data as { access: string };
          localStorage.setItem('access', access);
          api.dispatch(setAuth());
          result = await baseQuery(args, api, extraOptions);
        } else {
          api.dispatch(logout());
          window.location.href = '/auth/login';
        }
      } finally {
        release();
      }
    } else {
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }
  return result;
};

// Define the API slice
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Auth', 'Worklog', 'Projects', 'WorkTypes'], // Add 'Projects' and 'WorkTypes' here
  endpoints: () => ({}), // Define endpoints as needed
});
