'use client';

import { useEffect } from "react";
import { useAppDispatch } from "@/redux/hooks";
import { setAuth, finishInitialLoad, logout } from "@/redux/features/authSlice";
import { useVerifyMutation, useRefreshTokenMutation } from "@/redux/features/authApiSlice";
import { useRouter } from "next/navigation";

export default function useVerify() {
  const dispatch = useAppDispatch();
  const [verify] = useVerifyMutation();
  const [refreshToken] = useRefreshTokenMutation();
  const router = useRouter();

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
        "/donate",
        "/tools/panorama",
        "/"
      ];

      const isPublic = publicPaths.some(path => currentPath.startsWith(path));

      try {
        if (access) {
          await verify({ token: access }).unwrap();
          dispatch(setAuth());

          if (currentPath.startsWith("/auth/")) {
            router.push("/dashboard");
          }
        } else if (refresh) {
          const response = await refreshToken({ refresh }).unwrap();

          if (response?.access) {
            localStorage.setItem("access", response.access);
          }

          if (response?.refresh) {
            localStorage.setItem("refresh", response.refresh);
          }

          dispatch(setAuth());

          if (currentPath.startsWith("/auth/")) {
            router.push("/dashboard");
          }
        } else {
          dispatch(logout());
          if (!isPublic) {
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

        if (!isPublic) {
          router.push("/auth/login");
        }
      } finally {
        dispatch(finishInitialLoad());
      }
    };

    verifyToken();
  }, [dispatch, verify, refreshToken, router]);
}
