// hooks/useLogin.ts
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
    console.log('🔍 [fetchOrgRole] Fetching organisation memberships...');
    const res = await fetch(`${BASE_URL}/api/my-memberships/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.log(`❌ [fetchOrgRole] Failed with status: ${res.status}`);
      return null;
    }
    const data: OrganisationMembership[] = await res.json();
    console.log('✅ [fetchOrgRole] Raw memberships data:', JSON.stringify(data, null, 2));
    
    if (!data.length) {
      console.log('⚠️ [fetchOrgRole] No memberships found');
      return null;
    }

    const PRIORITY: OrgRole[] = ["admin", "manager", "member", "client"];
    for (const role of PRIORITY) {
      if (data.some((m) => m.role === role)) {
        console.log(`✅ [fetchOrgRole] Found role: "${role}"`);
        return role;
      }
    }
    console.log('⚠️ [fetchOrgRole] No matching role found in priority list');
    return null;
  } catch (error) {
    console.error('❌ [fetchOrgRole] Error:', error);
    return null;
  }
}

async function fetchAreacalcRole(accessToken: string): Promise<AreacalcRole> {
  try {
    console.log('🔍 [fetchAreacalcRole] Fetching Areacalc role...');
    const res = await fetch(`${BASE_URL}/api/areacalc/me/role/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.log(`❌ [fetchAreacalcRole] Failed with status: ${res.status}`);
      return "anonymous";
    }
    const data = await res.json();
    console.log('✅ [fetchAreacalcRole] Raw API response:', data);
    
    // ✅ The API returns: { authenticated, role, can_save_custom_templates }
    // Use the role from API, default to 'anonymous'
    const role = (data.role as AreacalcRole) ?? "anonymous";
    console.log(`✅ [fetchAreacalcRole] Found role: "${role}"`);
    return role;
  } catch (error) {
    console.error('❌ [fetchAreacalcRole] Error:', error);
    return "anonymous";
  }
}

// Fetch user profile
async function fetchUserProfile(accessToken: string) {
  try {
    console.log('🔍 [fetchUserProfile] Fetching user profile...');
    const res = await fetch(`${BASE_URL}/api/users/me/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.log(`❌ [fetchUserProfile] Failed with status: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log('✅ [fetchUserProfile] User data:', {
      id: data.id,
      email: data.email,
      full_name: data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
    });
    return data;
  } catch (error) {
    console.error('❌ [fetchUserProfile] Error:', error);
    return null;
  }
}

// ── Routing table ─────────────────────────────────────────────────────────────
// Priority: Organisation roles > Areacalc roles > Default user page

function resolveDestination({ orgRole, areacalcRole }: RoleBundle): string {
  console.log('📍 [resolveDestination] Input:', { orgRole, areacalcRole });
  
  const hasAreacalcRole = areacalcRole !== "anonymous";
  const hasOrgRole = orgRole !== null;

  console.log('📍 [resolveDestination] Evaluated flags:', {
    hasAreacalcRole,
    hasOrgRole,
    orgRole
  });

  let destination: string;

  // ✅ PRIORITY 1: ORGANISATION ROLES (Highest priority)
  if (hasOrgRole) {
    if (orgRole === "admin" || orgRole === "manager") {
      destination = "/main/admin";
      console.log('📍 [resolveDestination] → Organisation Admin/Manager → /main/admin');
    } 
    else if (orgRole === "client") {
      destination = "/main/client";
      console.log('📍 [resolveDestination] → Organisation Client → /main/client');
    } 
    else if (orgRole === "member") {
      // ✅ UPDATED: Redirect to /main/member instead of /main/user
      destination = "/main/member";
      console.log('📍 [resolveDestination] → Organisation Member → /main/member');
    } 
    else {
      // Fallback for any other org role
      destination = "/main/member";
      console.log('📍 [resolveDestination] → Unknown org role → /main/member');
    }
  } 
  
  // ✅ PRIORITY 2: AREACALC ROLES (Only if no organisation role)
  else if (hasAreacalcRole) {
    if (areacalcRole === "admin" || areacalcRole === "member") {
      destination = "/main/admin";
      console.log('📍 [resolveDestination] → Areacalc Admin/Member (no org) → /main/admin');
    } 
    else {
      destination = "/main/member";
      console.log('📍 [resolveDestination] → Areacalc Customer/User (no org) → /main/member');
    }
  } 
  
  // ✅ PRIORITY 3: NO ROLES AT ALL
  else {
    destination = "/main/member";
    console.log('📍 [resolveDestination] → No roles found → /main/member');
  }

  console.log(`📍 [resolveDestination] → Final destination: "${destination}"`);
  return destination;
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

    console.log('📤 [useLogin] Login attempt for:', email);

    login({ email, password })
      .unwrap()
      .then(async (data) => {
        console.log('✅ [useLogin] Login successful, storing tokens...');
        
        // Store tokens
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);

        // Fetch user profile
        const userData = await fetchUserProfile(data.access);
        
        if (userData) {
          // Store user in Redux
          dispatch(setAuth({
            user: userData,
            token: data.access
          }));
          
          // Also store in localStorage as fallback
          localStorage.setItem('user', JSON.stringify(userData));
          console.log('✅ [useLogin] User stored in Redux and localStorage');
        } else {
          // Fallback: create minimal user from token or email
          const minimalUser = {
            id: 0,
            email: email,
            username: email.split('@')[0],
            full_name: email.split('@')[0],
            display_name: email.split('@')[0],
          };
          dispatch(setAuth({
            user: minimalUser,
            token: data.access
          }));
          localStorage.setItem('user', JSON.stringify(minimalUser));
          console.log('⚠️ [useLogin] Using minimal user fallback');
        }

        toast.success("Logged in successfully", {
          autoClose: 3000,
          pauseOnHover: true,
        });

        // ?next= skips all role checks
        const next = searchParams.get("next");
        if (next) {
          const destination = next.startsWith("/") ? next : "/";
          console.log(`📍 [useLogin] Using next param: "${destination}"`);
          setTimeout(() => router.push(destination), 3000);
          return;
        }

        console.log('🔄 [useLogin] Fetching roles for redirection...');
        
        // Fetch both roles in parallel
        const [orgRole, areacalcRole] = await Promise.all([
          fetchOrgRole(data.access),
          fetchAreacalcRole(data.access),
        ]);

        console.log('📊 [useLogin] Final roles:', { orgRole, areacalcRole });

        // Resolve destination based on roles
        const destination = resolveDestination({ orgRole, areacalcRole });
        console.log(`🚀 [useLogin] Redirecting to: "${destination}" in 3 seconds...`);
        
        setTimeout(() => router.push(destination), 3000);
      })
      .catch((error) => {
        console.error('❌ [useLogin] Login failed:', error);
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