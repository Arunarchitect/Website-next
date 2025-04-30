import { apiSlice } from "../services/apiSlice";

// Define types for user data and response structures
interface User {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface AuthResponse {
  access: string;
  refresh: string;
}

interface GoogleAuthArgs {
  provider: string;
  state: string;
  code: string;
}

interface CreateUserResponse {
  success: boolean;
  user: User;
  tokens?: AuthResponse;
}

interface LoginArgs {
  email: string;
  password: string;
}

interface RegisterArgs {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  re_password: string;
}

interface VerifyArgs {
  token: string;
}

interface ActivationArgs {
  uid: string;
  token: string;
}

interface ResetPasswordArgs {
  email: string;
}

interface ResetPasswordConfirmArgs {
  uid: string;
  token: string;
  new_password: string;
  re_new_password: string;
}

interface RefreshTokenArgs {
  refresh: string;
}

// Define your API slice with endpoints
const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Retrieve the current authenticated user
    retrieveUser: builder.query<User, void>({
      query: () => "/users/me/",
      providesTags: ['User'],
    }),

    // Google Authentication (OAuth)
    googleAuthenticate: builder.mutation<CreateUserResponse, GoogleAuthArgs>({
      query: ({ provider, state, code }) => ({
        url: `/o/${provider}/?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }),
      invalidatesTags: ['User'],
    }),

    // User login mutation
    login: builder.mutation<AuthResponse, LoginArgs>({
      query: ({ email, password }) => ({
        url: "/jwt/create/",
        method: "POST",
        body: { email, password },
      }),
      invalidatesTags: ['User'],
    }),

    // Register a new user
    register: builder.mutation<CreateUserResponse, RegisterArgs>({
      query: ({ first_name, last_name, email, password, re_password }) => ({
        url: "/users/",
        method: "POST",
        body: { first_name, last_name, email, password, re_password },
      }),
    }),

    // Verify JWT token
    verify: builder.mutation<void, VerifyArgs>({
      query: ({ token }) => ({
        url: "/jwt/verify/",
        method: "POST",
        body: { token },
      }),
    }),

    // Logout user
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/logout/",
        method: "POST",
      }),
      invalidatesTags: ['User'],
    }),

    // Activate a user's account
    activation: builder.mutation<void, ActivationArgs>({
      query: ({ uid, token }) => ({
        url: "/users/activation/",
        method: "POST",
        body: { uid, token },
      }),
    }),

    // Request password reset
    resetPassword: builder.mutation<void, ResetPasswordArgs>({
      query: ({ email }) => ({
        url: "/users/reset_password/",
        method: "POST",
        body: { email },
      }),
    }),

    // Confirm password reset with new password
    resetPasswordConfirm: builder.mutation<void, ResetPasswordConfirmArgs>({
      query: ({ uid, token, new_password, re_new_password }) => ({
        url: "/users/reset_password_confirm/",
        method: "POST",
        body: { uid, token, new_password, re_new_password },
      }),
    }),

    // Refresh the JWT token
    refreshToken: builder.mutation<AuthResponse, RefreshTokenArgs>({
      query: ({ refresh }) => ({
        url: "/jwt/refresh/",
        method: "POST",
        body: { refresh },
      }),
    }),
  }),
});

// Export hooks for each endpoint
export const {
  useRetrieveUserQuery,
  useGoogleAuthenticateMutation,
  useLoginMutation,
  useRegisterMutation,
  useVerifyMutation,
  useLogoutMutation,
  useActivationMutation,
  useResetPasswordMutation,
  useResetPasswordConfirmMutation,
  useRefreshTokenMutation, // Add this export
} = authApiSlice;
