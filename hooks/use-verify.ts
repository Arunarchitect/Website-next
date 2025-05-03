"use client";

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

  const [hasRedirected, setHasRedirected] = useState(false); // Prevent multiple redirects

  useEffect(() => {
    const verifyToken = async () => {
      const access = localStorage.getItem("access");
      const refresh = localStorage.getItem("refresh");

      // Step 1: If no tokens available, redirect to login
      if (!access && !refresh && !hasRedirected) {
        setHasRedirected(true);
        dispatch(logout());
        router.push("/auth/login");
        return;
      }

      try {
        // Step 2: If access token exists, verify it
        if (access) {
          await verify({ token: access }).unwrap();
          dispatch(setAuth());
        } else if (refresh) {
          // Step 3: If no access token, try to refresh it
          const response = await refreshToken({ refresh }).unwrap();

          if (response?.access) {
            localStorage.setItem("access", response.access);
          }

          if (response?.refresh) {
            localStorage.setItem("refresh", response.refresh);
          }

          dispatch(setAuth());
        } else {
          // If both tokens are invalid or missing
          dispatch(logout());
          if (!hasRedirected) {
            setHasRedirected(true);
            router.push("/auth/login");
          }
        }
      } catch (error) {
        console.error("Token verification or refresh error:", error);

        // Safely check if error has a `status`
        if (error && typeof error === "object" && "status" in error) {
          const err = error as { status?: number | string };

          if (err.status === 401 || err.status === 'FETCH_ERROR') {
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
