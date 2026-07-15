// @/redux/features/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  full_name?: string;
  display_name?: string;
  name?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
}

// Load initial state from localStorage
const getInitialState = (): AuthState => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  let user = null;

  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        console.error('Failed to parse user from localStorage:', e);
      }
    }
  }

  return {
    isAuthenticated: !!token,
    isLoading: true,
    user: user,
    token: token,
  };
};

const initialState: AuthState = getInitialState();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Rewritten with `prepare` instead of an optional case-reducer parameter.
    // An optional `action?: PayloadAction<X | null>` param makes RTK's
    // action-creator overload inference collapse to `void & {...}` in some
    // TS versions, which is what produced the "Type '{...}' is not
    // assignable to type 'void & {...}'" build error at dispatch(setAuth(...))
    // call sites. `prepare` makes the 0-or-1-argument shape explicit and
    // gives a single, correctly-typed action creator.
    setAuth: {
      reducer(state, action: PayloadAction<{ user: User; token: string } | null>) {
        // If no payload, use existing user from state or localStorage
        if (!action.payload) {
          state.isAuthenticated = true;
          if (!state.user && typeof window !== 'undefined') {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              try {
                state.user = JSON.parse(userStr);
              } catch (e) {
                console.error('Failed to parse user from localStorage:', e);
              }
            }
          }
          return;
        }

        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      },
      prepare(payload?: { user: User; token: string } | null) {
        return { payload: payload ?? null };
      },
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
      }
    },
    finishInitialLoad: (state) => {
      state.isLoading = false;
    },
  },
});

export const { setAuth, setUser, setToken, logout, finishInitialLoad } = authSlice.actions;
export default authSlice.reducer;