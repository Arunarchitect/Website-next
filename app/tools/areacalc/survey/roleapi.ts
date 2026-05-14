const BASE = process.env.NEXT_PUBLIC_HOST;

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access") ?? "";
}

export type AreacalcRole = "anonymous" | "user" | "customer" | "member" | "admin";

export interface MyRoleResponse {
  authenticated: boolean;
  role: AreacalcRole;
  user_id?: number;
  email?: string;
  profile_exists?: boolean;
  profile_role?: string | null;
  can_save_custom_templates: boolean;
}

export async function fetchMyRole(): Promise<MyRoleResponse> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/areacalc/me/role/`, {
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : {},
  });
  if (!res.ok) throw new Error(`Role fetch failed: ${res.status}`);
  return res.json() as Promise<MyRoleResponse>;
}

export function canAccessSurvey(role: AreacalcRole): boolean {
  return role === "member" || role === "admin";
}