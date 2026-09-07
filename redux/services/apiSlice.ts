import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { setAuth, logout } from "../features/authSlice";
import { Mutex } from "async-mutex";

const mutex = new Mutex();

// Redirects to the login page, preserving the current path/query as ?next=
// so the user can be sent back here after they log in.
function redirectToLogin() {
  if (typeof window === 'undefined') return;

  const current = window.location.pathname + window.location.search;

  // Don't attach a next param if we're already on the login page,
  // or if there's nothing meaningful to return to (root path).
  const shouldAttachNext = current && current !== '/' && !current.startsWith('/auth/login');

  const target = shouldAttachNext
    ? `/auth/login?next=${encodeURIComponent(current)}`
    : '/auth/login';

  // Avoid redirecting if we're already there (prevents redirect loops
  // if multiple 401s fire in quick succession).
  if (window.location.pathname + window.location.search !== target) {
    window.location.href = target;
  }
}

// Create base query with auth headers
const baseQuery = fetchBaseQuery({
  baseUrl: `${process.env.NEXT_PUBLIC_HOST}/api`,
  prepareHeaders: (headers) => {
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
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refresh = typeof window !== 'undefined'
          ? localStorage.getItem('refresh')
          : null;

        if (!refresh) {
          api.dispatch(logout());
          redirectToLogin();
          return result;
        }

        const refreshResult = await baseQuery(
          {
            url: '/token/refresh/',
            method: 'POST',
            body: { refresh }
          },
          api,
          extraOptions
        );

        if (!refreshResult.data) {
          api.dispatch(logout());
          redirectToLogin();
          return refreshResult;
        }

        const { access } = refreshResult.data as { access: string };
        if (typeof window !== 'undefined') {
          localStorage.setItem('access', access);
        }

        api.dispatch(setAuth());
        result = await baseQuery(args, api, extraOptions);
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

// ✅ Extended tagTypes to support all feature slice tags
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User',                 // Single user
    'Auth',                 // Auth state
    'Worklog',              // Worklog entries
    'Project',              // Project data
    'Deliverable',          // Deliverables
    'Membership',           // Single membership
    'Organisation',         // Organisation base data
    'OrganisationMembers',  // Org-specific member list
    'OrganisationProjects', // Org-specific project list
    'Memberships',          // List of memberships
    'UserWorkLogs',       // For the list of worklogs
    'UserWorklog',        // For individual worklog entries (note the lowercase 'l' to match the error)
    'UserDeliverables',
    'UserOrganisations',
    'Expense',
    'Quiz',
    'Exams',
    'Categories',
    'Scores'
  ],
  endpoints: () => ({}),
});

export default apiSlice;