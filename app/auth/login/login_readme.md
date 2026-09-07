# Login & Redirect Logic

Documents how login works and how users get routed to their landing page after authenticating.

## File Chain

```
app/auth/login/page.tsx        → reads ?next= from URL, passes to LoginForm (unused downstream — see Notes)
  └─ components/forms/LoginForm.tsx → renders form, computes safeNext (unused — see Notes)
       └─ hooks/useLogin.ts        → actual auth + redirect logic lives here
            └─ lib/resolveUserDestination.ts → role-based destination resolver
```

## Flow

1. User submits email/password via `LoginForm`.
2. `useLogin`'s `onSubmit` calls the login mutation. On success:
   - Tokens stored in `localStorage` (`access`, `refresh`).
   - User profile fetched (`fetchUserProfile`) and dispatched to Redux (`setAuth`); falls back to a minimal user object if the profile fetch fails.
   - Success toast shown.
3. **Redirect decision** (in `useLogin`, reads `next` via `useSearchParams()` directly from the URL — *not* from the `LoginForm` prop):
   - If `?next=<path>` is present in the URL → validated as relative (`startsWith("/")`, else `"/"`) → redirect there after 3s. **Skips all role checks.**
   - Otherwise → fetch `orgRole` + `areacalcRole` in parallel → `resolveDestination()` computes the landing page → redirect there after 3s.
4. On failure, error toasts are shown based on HTTP status (400 / 401 / 500 / network error / other).

## Role Types

```ts
type OrgRole = "admin" | "manager" | "member" | "client" | null;
type AreacalcRole = "admin" | "member" | "customer" | "user" | "anonymous";
```

- `orgRole` comes from `/api/my-memberships/` — highest-priority role wins if a user has multiple org memberships (priority order: `admin` > `manager` > `member` > `client`). `null` if no membership.
- `areacalcRole` comes from `/api/areacalc/me/role/` — a separate, tool-specific role. Defaults to `"anonymous"` if the fetch fails or returns nothing.

## Destination Resolution (`resolveDestination`)

Rules are checked **in order**, first match wins:

| # | Condition | Destination |
|---|---|---|
| 1 | `orgRole` is `admin` or `manager` | `/main/admin` |
| 2 | org privileged (`admin`/`manager`/`member`) **and** areacalc privileged (`admin`/`member`) | `/main/admin` |
| 3 | has any `orgRole` **and** `areacalcRole` is low (`customer`/`user`) | `/main/user` |
| 4 | `orgRole` is `client` **and** has any non-anonymous `areacalcRole` | `/main/user` |
| 5 | `orgRole` is `member` (only reached if areacalc is `anonymous`) | `/main/member` |
| 6 | `orgRole` is `client` (only reached if areacalc is `anonymous`) | `/main/client` |
| 7 | no `orgRole`, but has a real `areacalcRole` | `/tools/areacalc` |
| 8 | no `orgRole` and no `areacalcRole` (fully roleless user) | `/main/user` |

### Plain-English summary
- **Org admin/manager** → always `/main/admin`, regardless of areacalc role.
- **Org client** → `/main/user` if they have *any* areacalc role; `/main/client` only if they have zero areacalc footprint.
- **Org member** → `/main/admin` if also areacalc-privileged, `/main/user` if areacalc-low, `/main/member` if no areacalc role at all.
- **No org, has areacalc role** → `/tools/areacalc`.
- **No org, no areacalc role** → `/main/user` (default fallback for fully new/roleless users).

## Known Quirks / Things to Revisit

- **`next` prop in `LoginForm` is dead code.** The page passes `next` down as a prop, `LoginForm` computes `safeNext` and stuffs it into a hidden form field — but `useLogin` never reads it from there. It reads `next` independently via its own `useSearchParams()` call. The prop/hidden-field path can be removed, or wired up properly if there was a reason for it (e.g. server-side form submission).
- **`?next=` bypasses role-based routing entirely.** If a link with `?next=/some/protected/page` is shared, the user lands there post-login with no `orgRole`/`areacalcRole` check. Not an open-redirect risk (relative-path validated), but any route relying on this redirect *alone* for access control has a gap — protected pages should independently verify role/permission server-side.
- **Rule 4 is broad.** Any org `client` with *any* areacalc role (even the lowest tier) is routed to `/main/user`, not `/main/client`. `/main/client` is only reached by clients with zero areacalc account. Confirm this matches intent — if `/main/client` was meant to be the default client landing page, rule 4 may need narrowing (e.g. only areacalc-privileged clients should redirect to `/main/user`).
- **`isOrgLow` and `isAreacalcLow` variables are computed but unused** in the actual branching logic — dead code, safe to remove or worth double-checking no rule was meant to use them instead of `hasOrgRole`/`hasAreacalcRole`.
- **`/main/user` now serves two different populations**: users with a low-tier role, and users with *no* role at all. Since this page render assumes some account/role context, confirm it degrades gracefully (no broken widgets, no empty org name, etc.) for a fully roleless visitor — or consider prompting those users to join an org / request access instead of showing the standard dashboard.
- **3-second `setTimeout` before redirect** in both branches — intentional (lets the success toast show) but means a ~3s delay before navigation even though auth state is already set.