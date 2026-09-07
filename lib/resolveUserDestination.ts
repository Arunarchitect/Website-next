import { OrganisationMembership } from "@/redux/features/membershipApiSlice";

const BASE_URL = process.env.NEXT_PUBLIC_HOST;

type OrgRole = "admin" | "manager" | "member" | "client" | null;
type AreacalcRole = "admin" | "member" | "customer" | "user" | "anonymous";

interface RoleBundle {
  orgRole: OrgRole;
  areacalcRole: AreacalcRole;
}

export async function fetchOrgRole(accessToken: string): Promise<OrgRole> {
  try {
    const res = await fetch(`${BASE_URL}/api/my-memberships/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data: OrganisationMembership[] = await res.json();
    if (!data.length) return null;

    const PRIORITY: OrgRole[] = ["admin", "manager", "member", "client"];
    for (const role of PRIORITY) {
      if (data.some((m) => m.role === role)) return role;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchAreacalcRole(accessToken: string): Promise<AreacalcRole> {
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

export function resolveDestination({ orgRole, areacalcRole }: RoleBundle): string {
  const isOrgPrivileged = orgRole === "admin" || orgRole === "manager" || orgRole === "member";
  const isOrgLow        = orgRole === "client";
  const isAreacalcPriv  = areacalcRole === "admin" || areacalcRole === "member";
  const isAreacalcLow   = areacalcRole === "customer" || areacalcRole === "user";
  const hasOrgRole      = orgRole !== null;
  const hasAreacalcRole = areacalcRole !== "anonymous";

  // Org admin/manager always land in /main/admin, regardless of areacalc role
  if (orgRole === "admin" || orgRole === "manager") return "/main/admin";

  if (isOrgPrivileged && isAreacalcPriv) return "/main/admin"; // org member + areacalc priv
  if (hasOrgRole && isAreacalcLow)       return "/main/user";
  if (isOrgLow && hasAreacalcRole)       return "/main/user";

  if (orgRole === "member")               return "/main/member";
  if (orgRole === "client")               return "/main/client";

  if (hasAreacalcRole)                    return "/tools/areacalc";

  return "/main/user";
}