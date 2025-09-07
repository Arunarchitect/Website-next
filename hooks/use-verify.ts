'use client';

import { useEffect, useState } from "react";
import { useAppDispatch } from "@/redux/hooks";
import { setAuth, finishInitialLoad, logout } from "@/redux/features/authSlice";
import { useVerifyMutation, useRefreshTokenMutation } from "@/redux/features/authApiSlice";
import { useRouter } from "next/navigation";

export default function useVerify() {
  const dispatch = useAppDispatch();
  const [verify] = useVerifyMutation();
  const [refreshToken] = useRefreshTokenMutation();
  const router = useRouter();

  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      const access = localStorage.getItem("access");
      const refresh = localStorage.getItem("refresh");
      const currentPath = window.location.pathname;

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

      const isPublic = publicPaths.some(path => currentPath.startsWith(path));

      try {
        // === Case 1: Access token exists - verify it ===
        if (access) {
          await verify({ token: access }).unwrap();
          dispatch(setAuth());

          // Redirect authenticated users away from auth pages
          if (currentPath.startsWith("/auth/") && !hasRedirected) {
            setHasRedirected(true);
            router.push("/dashboard");
            return;
          }
        }
        // === Case 2: Refresh token exists - refresh it ===
        else if (refresh) {
          const response = await refreshToken({ refresh }).unwrap();

          if (response?.access) {
            localStorage.setItem("access", response.access);
          }

          if (response?.refresh) {
            localStorage.setItem("refresh", response.refresh);
          }

          dispatch(setAuth());

          // Redirect authenticated users away from auth pages
          if (currentPath.startsWith("/auth/") && !hasRedirected) {
            setHasRedirected(true);
            router.push("/dashboard");
            return;
          }
        }
        // === Case 3: No valid tokens ===
        else {
          dispatch(logout());
          if (!hasRedirected && !isPublic) {
            setHasRedirected(true);
            router.push("/auth/login");
          }
        }
      } catch (error) {
        console.error("Token verification or refresh error:", error);

        // Clear tokens if unauthorized or fetch fails
        if (error && typeof error === "object" && "status" in error) {
          const err = error as { status?: number | string };
          if (err.status === 401 || err.status === "FETCH_ERROR") {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
          }
        }

        dispatch(logout());

        if (!hasRedirected && !isPublic) {
          setHasRedirected(true);
          router.push("/auth/login");
        }
      } finally {
        dispatch(finishInitialLoad());
      }
    };

    verifyToken();
  }, [dispatch, verify, refreshToken, router, hasRedirected]);

  // Hook handles auth logic via side effects, no return value needed
}
