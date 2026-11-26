# app/bills — Billing UI (frontend)

Next.js (App Router) pages for staff to manage bills and for clients to
view them. Backend reference: `feecalc/BILLS_README.md`. The visual style
reuses the `C` colour tokens from `app/feecalc/feeCalcTypes.ts`, with inline
styles like the rest of `app/feecalc`.

---

## 1. Routes

| Route | File | Audience |
|---|---|---|
| `/bills` | `page.tsx` | Staff (org-wide admin or manager): tab hub |
| `/bills/my` | `my/page.tsx` | Clients: their issued bills with PDF download |

## 2. Files

| File | Purpose |
|---|---|
| `page.tsx` | Sign-in check, organisation picker, tabs (Bills, Bill templates, Members). |
| `BillsTab.tsx` | Project, then fee calculation, then instalments (stages), then bills; create, issue, cancel, delete, record payment, download. |
| `TemplatesTab.tsx` | Upload SVG template, preview PDF, delete, token list. |
| `MembersTab.tsx` | List, add by email, change role, remove (org-wide admins only). |
| `billsApi.ts` | **Every** backend call, auth, token refresh, types. |
| `ui.tsx` | `Card`, `Btn`, `Msg`, `Field`, `StatusPill`, `money()`, `errText()`, shared input style. |
| `my/page.tsx` | Client portal. |

Convention: **components never call `fetch`.** Add or change endpoints only in
`billsApi.ts`.

---

## 3. Data flow (Bills tab)

1. `page.tsx` loads orgs where the user is admin or manager
   (`fetchAdminOrganisations` from `app/feecalc/create/feeCalcAdminApi.ts`).
2. `BillsTab` loads the org's projects from
   `/api/organisations/<id>/projects/` (org-scoped). Do **not** use the
   unscoped `/api/projects/`, which returns every org's projects.
3. Choosing a project calls `fetchProjectFeeCalcs`:
   `GET /api/feecalc/project-calculations/?project=<id>`. If a calculation
   has no nested `instalments`, they are loaded from
   `/api/feecalc/instalments/?fee_calculation=<id>`.
4. Each instalment (`InstalmentBlock`) loads its bills from
   `/api/feecalc/bills/?instalment=<id>`.
5. Actions call `billsApi`, then re-fetch the instalment's bills. The
   instalment's own totals (invoiced, paid) come from the calculation payload
   and **do not refresh after an action until the project is re-selected**.
   Improvement: pass a reload callback down from `BillsTab`.

### Creating a bill
`NewBillForm` posts `multipart/form-data` to `POST /bills/`:
`instalment`, either `template` or `pdf_file`, optional `amount`,
and `issue` (`"true"` or `"false"`). Blank amount means the remaining
un-billed amount, enforced by the backend.

### Sending to a client by email
There is no send feature. Use **Download** on the bill, then attach the PDF
in your own mail app.

---

## 4. Auth

`billsApi.ts` reads the token from `localStorage.access`, falling back to
`access_token`, `token`, then `sessionStorage.access`. On a 401 it posts the
stored `refresh` token to `/api/jwt/refresh/` once, stores the new `access`
and retries. `NEXT_PUBLIC_HOST` is the API base URL (empty means same origin).
PDFs are fetched with the bearer token and opened or downloaded as blobs.
There is no public PDF URL, by design.

Pages treat "no token" as signed out and link to `/login`. Authorisation is
enforced by the backend: the UI shows tabs the user may not be allowed to use
(for example Members for a manager), and the API's error is shown inline.

---

## 5. API contract used by the UI

| Function in `billsApi.ts` | Endpoint |
|---|---|
| `fetchOrgProjects` | `GET /api/organisations/{org}/projects/` |
| `fetchProjectFeeCalcs` | `GET /api/feecalc/project-calculations/?project=` (+ `/instalments/?fee_calculation=` fallback) |
| `fetchBills` | `GET /api/feecalc/bills/?instalment=` |
| `createBill` | `POST /api/feecalc/bills/` |
| `issueBill`, `cancelBill` | `POST /api/feecalc/bills/{id}/issue\|cancel/` |
| `deleteBill` | `DELETE /api/feecalc/bills/{id}/` |
| `recordPayment` | `POST /api/feecalc/bills/{id}/record-payment/` |
| `downloadBill` | `GET /api/feecalc/bills/{id}/download/` |
| `fetchMyBills` | `GET /api/feecalc/my-bills/` |
| `fetchTemplates`, `uploadTemplate`, `deleteTemplate`, `previewTemplate`, `fetchTokens` | `/api/feecalc/bill-templates/...` |
| `fetchMembers`, `addMember`, `updateMember`, `removeMember` | `/api/org-admin/...` |

Lists accept both plain arrays and DRF `{results: []}` pagination.

### Not yet verified against the backend serializers
These shapes were written defensively and may need adjusting:
- `Instalment` names (`stage_name`, `name`, `label`) and money fields
  (`invoiced_amount`, `paid_amount`).
- Whether `project-calculations` nests `instalments` and honours `?project=`.
- Bill fields `paid_amount`, `balance`, `currency` (the UI hides them if absent)
  and the exact status strings (the pill handles draft, issued, paid, partial,
  cancelled).
- Template upload field set (`organisation`, `name`, `svg_file`).
- Member shape (`user_email` or `email` or `user.email`).
- `ClientBillSerializer` fields used by `my/page.tsx` (`project_name`, `currency`).

When one is confirmed, tighten the matching type in `billsApi.ts` and delete
the fallback.

---

## 6. Behaviour notes

- Draft bills show **Issue**; issued bills show **Record payment**; anything
  not cancelled shows **Cancel**. The backend is the authority: it refuses
  invalid transitions and the message is shown inline.
- **Cancel** and **Delete** are refused by the backend once a payment exists.
- Destructive actions use `window.confirm`.
- Currency formatting uses `Intl.NumberFormat("en-IN")`, defaulting to INR.
- Inputs have `id` and `name` attributes (kept consistent with the quote builder
  to avoid DevTools autofill warnings).

---

## 7. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Fee calculation card is empty or says "no payment stages" | The calculation is still `draft`. Instalments are only created by `confirm()`. Confirm it (`POST /api/feecalc/project-calculations/{id}/confirm/`), or check **Fee instalments** in the Django admin. |
| `404` on `/api/org-admin/...` | `project/urls.py` is missing the two `org-admin/` routes or `org_admin_views.py` is missing. |
| `404` on `/project-calculations/` before | The route name is `project-calculations`, not `project-fee-calculations`. |
| `401` in the console | Not logged in on that origin, or the token expired and refresh failed. `localStorage` is per origin: test on the Next.js site, not on `:8000`. Opening an API URL directly in a tab sends no token. |
| Template error: "cairosvg is not installed" | Add `cairosvg` and `defusedxml` to `requirements.txt`, rebuild the image with `--no-cache`. |
| Preview or PDF text missing or wrong font | Only DejaVu and Liberation fonts exist in the container. Complex scripts must be converted to paths. |
| `400 ... exceeds` on create | The sum of non-cancelled bills would exceed the instalment amount. |
| Members tab empty | Not an org-wide admin of that org. |

Use the browser **Network** tab to see what the page actually received.
Copy the response JSON from there when asking for help.

---

## 8. Extending

- **New tab:** add an entry to `TABS` in `page.tsx` and a component that
  takes `orgId`.
- **New endpoint:** add the function and type to `billsApi.ts`, then use it.
- **Regenerate button:** the API has `POST /bills/{id}/regenerate/` (optional
  `template`). There is no button yet. Add one in `BillRow` for draft bills.
- **Payment details:** `recordPayment` already accepts `paid_on`, `method` and
  `remarks`. The form only sends `amount` and `reference`.
- **Refresh totals after actions:** lift a `reload` from `BillsTab` into
  `InstalmentBlock` (see §3, step 5).

## 9. Planned (not built)
Fee templates, member rates and discounts tabs; a link to proposals
(`/feecalc/create` is linked in the header); a "confirm calculation" and
"generate stages" action inside the Bills tab; void or correct payments.