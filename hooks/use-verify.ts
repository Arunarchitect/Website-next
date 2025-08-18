'use client';

// Import necessary hooks and functions
import { useEffect, useState } from "react";
import { useAppDispatch } from "@/redux/hooks";
import { setAuth, finishInitialLoad, logout } from "@/redux/features/authSlice";
import { useVerifyMutation, useRefreshTokenMutation } from "@/redux/features/authApiSlice";
import { useRouter } from "next/navigation";

/**
 * Custom hook for handling authentication verification and token management
 * 
 * This hook:
 * 1. Verifies the user's authentication status on app load
 * 2. Handles access token verification and refresh token flow
 * 3. Manages redirects based on authentication state
 * 4. Integrates with Redux for global state management
 */
export default function useVerify() {
  // Initialize Redux dispatch function
  const dispatch = useAppDispatch();
  
  // Initialize mutations for token verification and refresh
  const [verify] = useVerifyMutation();
  const [refreshToken] = useRefreshTokenMutation();
  
  // Initialize Next.js router for navigation
  const router = useRouter();
  
  // State to track if redirect has occurred to prevent multiple redirects
  const [hasRedirected, setHasRedirected] = useState(false);

  // Main effect that runs on component mount and when dependencies change
  useEffect(() => {
    /**
     * Async function to verify and handle authentication tokens
     */
    const verifyToken = async () => {
      // Get tokens from localStorage
      const access = localStorage.getItem("access");
      const refresh = localStorage.getItem("refresh");
      
      // Get current path for route-based logic
      const currentPath = window.location.pathname;

      // Define paths that don't require authentication
      const publicPaths = [
        "/password-reset",
        "/auth/register",
        "/auth/login",
        "/tools/fee",
        "/tools/area",
        "/tools/quiz",
        "/donate",
        "/"
      ];

      // Determine if current path is public (no auth required)
      const isPublic = publicPaths.some(path => currentPath.startsWith(path));

      /**
       * Redirect authenticated users away from auth pages
       */
      if (access && currentPath.startsWith("/auth/") && !hasRedirected) {
        setHasRedirected(true);
        router.push("/dashboard");
        return;
      }

      /**
       * Handle case where no tokens exist
       * - If on a protected path (not public), redirect to login
       * - If on a public path, allow access without redirect
       */
      if (!access && !refresh && !hasRedirected && !isPublic) {
        setHasRedirected(true);
        // Clear any auth state
        dispatch(logout());
        // Redirect to login
        router.push("/auth/login");
        return;
      }

      /**
       * Token verification and refresh logic
       * (We now run this even on public paths so Redux auth state is set correctly,
       * fixing the "navbar shows Login on / even after login" issue in production.)
       */
      try {
        // Case 1: Access token exists - verify it
        if (access) {
          await verify({ token: access }).unwrap();
          // Mark user as authenticated
          dispatch(setAuth());
        } 
        // Case 2: Only refresh token exists - attempt to refresh
        else if (refresh) {
          const response = await refreshToken({ refresh }).unwrap();
          
          // Store new access token if received
          if (response?.access) {
            localStorage.setItem("access", response.access);
          }
          
          // Store new refresh token if received
          if (response?.refresh) {
            localStorage.setItem("refresh", response.refresh);
          }
          
          // Mark user as authenticated
          dispatch(setAuth());
        } 
        // Case 3: No valid tokens - logout (stay on public paths, redirect handled above)
        else {
          dispatch(logout());
          if (!hasRedirected && !isPublic) {
            setHasRedirected(true);
            router.push("/auth/login");
          }
        }
      } catch (error) {
        /**
         * Error handling for token verification/refresh failures
         */
        console.error("Token verification or refresh error:", error);

        // Handle specific error cases
        if (error && typeof error === "object" && "status" in error) {
          const err = error as { status?: number | string };
          // Clear tokens on 401 (Unauthorized) or fetch errors
          if (err.status === 401 || err.status === "FETCH_ERROR") {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
          }
        }

        // Ensure logout state and redirect (only redirect off protected routes)
        dispatch(logout());
        if (!hasRedirected && !isPublic) {
          setHasRedirected(true);
          router.push("/auth/login");
        }
      } finally {
        /**
         * Always mark initial load as complete
         * This ensures loading states are properly handled
         * regardless of verification success/failure
         */
        dispatch(finishInitialLoad());
      }
    };

    // Execute the verification function
    verifyToken();
  }, [dispatch, verify, refreshToken, router, hasRedirected]); // Dependencies

  // Note: This hook doesn't return anything as it manages side effects only
}
