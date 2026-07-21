// hooks/useLogin.ts
"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { useLoginMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuth } from "@/redux/features/authSlice";
import { useAppDispatch } from "@/redux/hooks";
import {
  fetchOrgRole,
  fetchAreacalcRole,
  resolveDestination,
} from "@/lib/resolveUserDestination";

const BASE_URL = process.env.NEXT_PUBLIC_HOST;

// Fetch user profile
async function fetchUserProfile(accessToken: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/users/me/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("[fetchUserProfile] Error:", error);
    return null;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────
export default function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const { email, password } = formData;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    login({ email, password })
      .unwrap()
      .then(async (data) => {
        // Store tokens
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);

        // Fetch user profile
        const userData = await fetchUserProfile(data.access);

        if (userData) {
          dispatch(setAuth({ user: userData, token: data.access }));
          localStorage.setItem("user", JSON.stringify(userData));
        } else {
          const minimalUser = {
            id: 0,
            email,
            username: email.split("@")[0],
            full_name: email.split("@")[0],
            display_name: email.split("@")[0],
          };
          dispatch(setAuth({ user: minimalUser, token: data.access }));
          localStorage.setItem("user", JSON.stringify(minimalUser));
        }

        toast.success("Logged in successfully", {
          autoClose: 3000,
          pauseOnHover: true,
        });

        // ?next= skips all role checks
        const next = searchParams.get("next");
        if (next) {
          const destination = next.startsWith("/") ? next : "/";
          setTimeout(() => router.push(destination), 3000);
          return;
        }

        // Fetch both roles in parallel
        const [orgRole, areacalcRole] = await Promise.all([
          fetchOrgRole(data.access),
          fetchAreacalcRole(data.access),
        ]);

        // Resolve destination based on roles — single source of truth
        const destination = resolveDestination({ orgRole, areacalcRole });
        setTimeout(() => router.push(destination), 3000);
      })
      .catch((error) => {
        const toastOptions = { autoClose: 5000, pauseOnHover: true };
        if (error.status === 400) {
          toast.error(error.data?.detail || "Invalid request format", toastOptions);
        } else if (error.status === 401) {
          toast.error(error.data?.detail || "Invalid credentials", toastOptions);
        } else if (error.status === 500) {
          toast.error("Server error - please try again later", toastOptions);
        } else if (error.status === "FETCH_ERROR" || !error.status) {
          toast.error("Network error - please check your connection", toastOptions);
        } else {
          toast.error("Login failed - please try again", toastOptions);
        }
      });
  };

  return { email, password, isLoading, onChange, onSubmit };
}