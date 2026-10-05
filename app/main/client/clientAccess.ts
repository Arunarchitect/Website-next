// app/main/client/clientAccess.ts
// Guard for /main/client. Reuses clientApi.ts (token refresh, logging, etc.)
import {
  getCurrentUser,
  getOrganisationMemberships,
  getAreacalcRole,
} from './clientApi';

const LOGIN_PATH = '/login';

type OrgRole = 'admin' | 'manager' | 'member' | 'client';
const ROLE_PRIORITY: OrgRole[] = ['admin', 'manager', 'member', 'client'];

export type ClientAccessResult =
  | { allowed: true }
  | { allowed: false; redirectTo: string };

// Stay on /main/client only if the user is a Client of at least one org.
// Otherwise send them where the login rules would.
export async function checkClientAccess(): Promise<ClientAccessResult> {
  // Not signed in at all
  const user = await getCurrentUser();
  if (!user) return { allowed: false, redirectTo: LOGIN_PATH };

  const memberships = await getOrganisationMemberships();
  const roles = memberships
    .map((m) => String(m.role ?? '').toLowerCase())
    .filter((r): r is OrgRole => ROLE_PRIORITY.includes(r as OrgRole));

  console.log('[client guard] membership roles:', roles);

  if (roles.includes('client')) return { allowed: true };

  const top = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;

  if (top === 'admin' || top === 'manager') {
    return { allowed: false, redirectTo: '/main/admin' };
  }

  const areacalcRole = await getAreacalcRole(); // 'anonymous' on failure
  const hasAreacalc = !!areacalcRole && areacalcRole !== 'anonymous';

  if (top === 'member') {
    if (areacalcRole === 'admin' || areacalcRole === 'member') {
      return { allowed: false, redirectTo: '/main/admin' };
    }
    return {
      allowed: false,
      redirectTo: hasAreacalc ? '/main/user' : '/main/member',
    };
  }

  // No org membership at all
  return {
    allowed: false,
    redirectTo: hasAreacalc ? '/tools/areacalc' : '/main/user',
  };
}