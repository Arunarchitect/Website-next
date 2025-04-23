import { apiSlice } from "../services/apiSlice";

interface User {
  first_name: string;
  last_name: string;
  email: string;
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

const authApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    retrieveUser: builder.query<User, void>({
      query: () => "/users/me/",
      providesTags: ['User'],
    }),
    googleAuthenticate: builder.mutation<CreateUserResponse, GoogleAuthArgs>({
      query: ({ provider, state, code }) => ({
        url: `/o/${provider}/?state=${encodeURIComponent(
          state
        )}&code=${encodeURIComponent(code)}`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }),
      invalidatesTags: ['User'],
    }),
    login: builder.mutation<AuthResponse, LoginArgs>({
      query: ({ email, password }) => ({
        url: "/jwt/create/",
        method: "POST",
        body: { email, password },
      }),
      invalidatesTags: ['User'],
    }),
    register: builder.mutation<User, RegisterArgs>({
      query: ({ first_name, last_name, email, password, re_password }) => ({
        url: "/users/",
        method: "POST",
        body: { first_name, last_name, email, password, re_password },
      }),
    }),
    verify: builder.mutation<void, { token: string }>({
      query: ({ token }) => ({
        url: "/jwt/verify/",
        method: "POST",
        body: { token },
      }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/logout/",
        method: "POST",
      }),
      invalidatesTags: ['User'],
    }),
    activation: builder.mutation<void, ActivationArgs>({
      query: ({ uid, token }) => ({
        url: "/users/activation/",
        method: "POST",
        body: { uid, token },
      }),
    }),
    resetPassword: builder.mutation<void, ResetPasswordArgs>({
      query: ({ email }) => ({
        url: "/users/reset_password/",
        method: "POST",
        body: { email },
      }),
    }),
    resetPasswordConfirm: builder.mutation<void, ResetPasswordConfirmArgs>({
      query: ({ uid, token, new_password, re_new_password }) => ({
        url: "/users/reset_password_confirm/",
        method: "POST",
        body: { uid, token, new_password, re_new_password },
      }),
    }),
  }),
});

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
} = authApiSlice;