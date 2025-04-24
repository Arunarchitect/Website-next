import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null; // Add token to the state
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  token: null, // Initialize token as null
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth: (state) => {
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.token = null; // Reset the token on logout
      // Clear tokens from storage
      localStorage.removeItem('access');
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload; // Store the token in the state
    },
    finishInitialLoad: (state) => {
      state.isLoading = false;
    },
  },
});

export const { setAuth, logout, setToken, finishInitialLoad } = authSlice.actions;
export default authSlice.reducer;
