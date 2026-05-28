"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { useLoginMutation } from "@/redux/features/authApiSlice";
import { toast } from "react-toastify";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuth } from "@/redux/features/authSlice";
import { useAppDispatch } from "@/redux/hooks";
import { OrganisationMembership } from "@/redux/features/membershipApiSlice";

const BASE_URL = process.env.NEXT_PUBLIC_HOST;

// ── Types ─────────────────────────────────────────────────────────────────────

type OrgRole = "admin" | "manager" | "member" | "client" | null;
type AreacalcRole = "admin" | "member" | "customer" | "user" | "anonymous";

interface RoleBundle {
  orgRole: OrgRole;
  areacalcRole: AreacalcRole;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchOrgRole(accessToken: string): Promise<OrgRole> {
  try {
    const res = await fetch(`${BASE_URL}/api/my-memberships/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data: OrganisationMembership[] = await res.json();
    if (!data.length) return null;

    // If user has multiple memberships, pick the highest-privilege role
    const PRIORITY: OrgRole[] = ["admin", "manager", "member", "client"];
    for (const role of PRIORITY) {
      if (data.some((m) => m.role === role)) return role;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAreacalcRole(accessToken: string): Promise<AreacalcRole> {
  try {
    const res = await fetch(`${BASE_URL}/api/areacalc/me/role/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "anonymous";
    const data = await res.json();
    return (data.role as AreacalcRole) ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

// ── Routing table ─────────────────────────────────────────────────────────────
//
//  Priority (high → low):
//  1. Admin/member/manager in BOTH apps        → /mainadmin
//  2. User/customer in BOTH apps               → /mainuser
//  3. Org: admin/manager only                  → /new/dash/dashadmin
//  4. Org: member only                         → /new/dash/dashnormal
//  5. Org: client only                         → /new/dash/dashclient
//  6. Areacalc only (any role)                 → /tools/areacalc
//  7. No role anywhere                         → /new/dash/dashnormal

function resolveDestination({ orgRole, areacalcRole }: RoleBundle): string {
  const isOrgPrivileged   = orgRole === "admin" || orgRole === "manager" || orgRole === "member";
  const isOrgLow          = orgRole === "client";
  const isAreacalcPriv    = areacalcRole === "admin" || areacalcRole === "member";
  const isAreacalcLow     = areacalcRole === "customer" || areacalcRole === "user";
  const hasOrgRole        = orgRole !== null;
  const hasAreacalcRole   = areacalcRole !== "anonymous";

  // ── Cross-app combinations ───────────────────────────────
  // Both privileged → main admin hub
  if (isOrgPrivileged && isAreacalcPriv)    return "/main/admin";

  // Both low-privilege → main user hub
  if (hasOrgRole && isAreacalcLow)          return "/main/user";
  if (isOrgLow && hasAreacalcRole)          return "/main/user";

  // ── Org-only ─────────────────────────────────────────────
  if (orgRole === "admin" || orgRole === "manager") return "/new/dash/dashadmin";
  if (orgRole === "member")                          return "/new/dash/dashnormal";
  if (orgRole === "client")                          return "/main/client";

  // ── Areacalc-only ─────────────────────────────────────────
  if (hasAreacalcRole)                               return "/tools/areacalc";

  // ── Fallback ──────────────────────────────────────────────
  return "/new/dash/dashnormal";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

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
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        dispatch(setAuth());

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