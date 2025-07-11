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

      // Define paths where authentication is NOT required
      const publicPaths = [
        "/password-reset",
        "/auth/register",
        "/auth/login",
        "/tools/fee"
      ];

      // Allow access to public pages without token verification
      if (publicPaths.some(path => currentPath.startsWith(path))) {
        dispatch(finishInitialLoad());
        return;
      }

      // Redirect authenticated users away from auth pages to dashboard
      if (access && currentPath.startsWith("/auth/") && !hasRedirected) {
        setHasRedirected(true);
        router.push("/dashboard");
        return;
      }

      // If no tokens at all, redirect to login (except for public pages above)
      if (!access && !refresh && !hasRedirected) {
        setHasRedirected(true);
        dispatch(logout());
        router.push("/auth/login");
        return;
      }

      try {
        if (access) {
          // Verify the access token
          await verify({ token: access }).unwrap();
          dispatch(setAuth());
        } else if (refresh) {
          // If no access token, try refreshing it
          const response = await refreshToken({ refresh }).unwrap();

          if (response?.access) {
            localStorage.setItem("access", response.access);
          }

          if (response?.refresh) {
            localStorage.setItem("refresh", response.refresh);
          }

          dispatch(setAuth());
        } else {
          // If refreshing fails
          dispatch(logout());
          if (!hasRedirected) {
            setHasRedirected(true);
            router.push("/auth/login");
          }
        }
      } catch (error) {
        console.error("Token verification or refresh error:", error);

        if (error && typeof error === "object" && "status" in error) {
          const err = error as { status?: number | string };
          if (err.status === 401 || err.status === "FETCH_ERROR") {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
          }
        }

        dispatch(logout());
        if (!hasRedirected) {
          setHasRedirected(true);
          router.push("/auth/login");
        }
      } finally {
        dispatch(finishInitialLoad());
      }
    };

    verifyToken();
  }, [dispatch, verify, refreshToken, router, hasRedirected]);
}