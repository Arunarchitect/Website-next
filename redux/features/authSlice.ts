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
    // ✅ Make setAuth handle both cases: with payload and without
    setAuth: (state, action?: PayloadAction<{ user: User; token: string } | null>) => {
      // If no payload, use existing user from state or localStorage
      if (!action || !action.payload) {
        state.isAuthenticated = true;
        // If user is already in state, keep it
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