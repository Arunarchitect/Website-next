# Guest Drawing Access — How It Works

Lets people without a Modelflick login view drawings/documents via a shared
code, at three different scopes: an entire project, a single deliverable, or
one specific drawing.

---

## 1. The three scopes

| Scope | Code lives on | Visibility rule | Bypasses private/archived? |
|---|---|---|---|
| **Project** | `ProjectAccessKey` (viewer app) | only `is_private=False, status='published'` drawings in that project | No |
| **Deliverable** | `DeliverableAccessKey` (viewer app) | only `is_private=False, status='published'` drawings in that deliverable | No |
| **Drawing** | `DrawingDocument.guest_access_code` | that one drawing, regardless of privacy/status | **Yes** |

The per-drawing code is intentionally the odd one out — it's a direct share
link for a specific file and ignores every other access rule.

---

## 2. Backend

### Models — `drawings/models.py`

```python
DrawingDocument.guest_access_code   # unique, nullable CharField(32)
DrawingDocument.generate_guest_access_code()   # mints a 12-char hex code, saves, returns it
DrawingDocument.revoke_guest_access_code()     # clears the code

DrawingDocument.guest_visible_for_project_key(access_key)      # -> queryset
DrawingDocument.guest_visible_for_deliverable_key(access_key)  # -> queryset
DrawingDocument.guest_visible_for_drawing_code(code)           # -> queryset
```

`ProjectAccessKey` and `DeliverableAccessKey` live in the **viewer app**, not
`drawings` — they're reused models, not new ones added for this feature.

### Views — `drawings/views.py`

All three are `permission_classes = [AllowAny]`:

```python
GuestProjectDrawingsView       # GET /api/drawings/public/project/<access_code>/
GuestDeliverableDrawingsView   # GET /api/drawings/public/deliverable/<access_code>/
GuestDrawingDetailView         # GET /api/drawings/public/drawing/<code>/
```

⚠️ **Known inconsistency:** `GuestDeliverableDrawingsView` explicitly checks
`DeliverableAccessKey.objects.filter(...).exists()` and returns **404** if
not found. `GuestProjectDrawingsView` does **not** — an invalid project code
returns **200 with an empty list**, not a 404. This matters because of how
the frontend resolves codes (see §3.1) — it breaks the fallback chain. Still
unfixed — see §7.1.

### URLs — `drawings/urls.py`

```python
path('public/project/<str:access_code>/', GuestProjectDrawingsView.as_view()),
path('public/deliverable/<str:access_code>/', GuestDeliverableDrawingsView.as_view()),
path('public/drawing/<str:code>/', GuestDrawingDetailView.as_view()),
```

Note the prefix is `public/`, not `guest/` — some docstrings in `views.py`
say `guest/`, those are stale comments, ignore them.

### Admin — `drawings/admin.py`

`guest_access_code` is **not directly editable** in admin. Instead:

- Select document(s) in the list view →
  **"Generate guest link for selected"** action → mints/regenerates the code,
  shows the resulting `/drawing/<code>` URL(s) in the success banner.
- **"Revoke guest link for selected"** action clears it.
- The change form shows the current code (read-only) and a rendered
  `/drawing/<code>` link once one exists.
- List view has a ✓ Active / — badge column so you can see at a glance
  which docs currently have a live guest link.

To generate one outside admin (e.g. for local testing), Django shell works
directly:

```python
doc = DrawingDocument.objects.get(pk=123)
code = doc.generate_guest_access_code()
```

This is still the only way to mint a code *from admin*. As of §2.1 below,
it's no longer the only way overall — a logged-in user can now mint their
own link for a document they can access, from inside the app itself.

### 2.1 In-app link creation — `guest_link` action on `DrawingDocumentViewSet`

New addition: authenticated users no longer need Django admin to create or
revoke a per-drawing guest link.

```
POST   /drawings/documents/<id>/guest-link/    — create (or return existing) code
DELETE /drawings/documents/<id>/guest-link/    — revoke the code
```

- Implemented as a `@action` on `DrawingDocumentViewSet`, so it reuses
  `get_object()` — meaning the **existing permission chain already applies**:
  `IsAuthenticated` + `CanAccessDocumentPermission` (see §5.2). A user who
  can't access a document can't mint a share link for it either; no new
  permission logic was written for this endpoint.
- `POST` calls `generate_guest_access_code()` if no code exists yet,
  otherwise just returns the existing one — idempotent, doesn't rotate an
  already-active link.
- `DELETE` calls `revoke_guest_access_code()`.
- Both log a `DocumentAccessLog(action='share')` — `'share'` was already a
  defined choice on that model but unused until now.

This only mints/revokes the **drawing-scope** code (§1). Project- and
deliverable-scope `AccessKey` records are unaffected and still
admin/viewer-app-managed.

---

## 3. Frontend

### File map

```
app/drawing/
├── page.tsx                          # main authenticated document browser;
│                                      # renders <GuestAccessGate /> instead
│                                      # if the current user is a guest.
│                                      # canUpload is now derived from
│                                      # getMyMemberships(), not
│                                      # currentUser.roles — see §5.5.
│                                      # Status (draft/published/archived)
│                                      # filter shown only to admin/manager/
│                                      # member; clients are hardcoded to
│                                      # published — see §5.6.
├── [code]/page.tsx                   # direct single-drawing link
│                                      # (/drawing/<code>)
├── guestApi.ts                       # unauthenticated axios client + the
│                                      # 3 guest fetch functions + resolver
├── drawingApi.ts                     # authenticated client, getCurrentUser,
│                                      # createGuestLink, revokeGuestLink,
│                                      # buildGuestLinkUrl, getMyMemberships
│                                      # (see §5.5)
└── components/
    ├── GuestAccessGate.tsx           # the access-code entry form
    ├── GuestDocumentGrid.tsx         # renders resolved docs, w/ filters
    ├── DocumentViewer.tsx            # shared viewer, takes guestMode prop;
    │                                 # now has a Share button (hidden in
    │                                 # guestMode)
    └── ShareLinkModal.tsx            # new — create/copy/revoke a guest link
```

### 3.1 How a typed code gets resolved — `guestApi.ts`

There is **no backend "what type is this code" endpoint.** The frontend
just tries all three guest endpoints in sequence and uses whichever one
succeeds first:

```
resolveGuestAccessCode(code)
  1. GET /api/drawings/public/project/<code>/       — try project scope
  2. GET /api/drawings/public/deliverable/<code>/    — try deliverable scope
  3. GET /api/drawings/public/drawing/<code>/        — try drawing scope
  → first 2xx wins; if all three fail, throw "doesn't match any shared drawings"
```

This means a single-drawing code takes up to 3 round trips to resolve
(fails project, fails deliverable, succeeds on drawing) — a latency detail,
not a bug.

`guestClient` is a **separate axios instance** from the authenticated
`apiClient` in `drawingApi.ts` — no `Authorization` header, no 401-refresh
interceptor. This is deliberate: a guest may still be carrying a stale token
in localStorage from a previous logged-in session on the same browser, and
that must never leak into guest requests.

### 3.2 Who sees the gate — `page.tsx`

```ts
const isGuest = currentUser?.id === 0;
```

`getCurrentUser()` (in `drawingApi.ts`) returns a synthetic
`{ id: 0, name: 'Guest', ... }` object whenever no auth token is found in
`localStorage`/`sessionStorage`. If `isGuest`, the whole authenticated
browser (org/project/deliverable filters, upload form, etc.) is skipped
entirely and only `<GuestAccessGate />` renders.

### 3.3 The form — `GuestAccessGate.tsx`

Plain controlled input → `handleSubmit` → `resolveGuestAccessCode(code)` →
based on `result.type`, calls the matching fetch function
(`getProjectGuestDocuments` / `getDeliverableGuestDocuments` /
`getGuestDrawing`) → sets `documents` state → switches to rendering
`<GuestDocumentGrid documents={docs} heading={...} />`.

### 3.4 The grid — `GuestDocumentGrid.tsx`

- Builds "filter by deliverable" / "filter by file type" dropdowns from
  whatever documents came back (only shown if there's more than one value).
- **DXF files are not hidden or filtered out of the grid.** A project or
  deliverable code that resolves to a mix of PDFs, images, and DXFs shows
  all of them as cards, side by side. The only difference is what happens
  on interaction:
  - `handleCardClick(doc)` — if `file_type === 'dxf'`, calls `guestDownload(doc)`
    immediately instead of opening `DocumentViewer` (DXF has no in-browser
    preview).
  - The action button label swaps to `'Download'` for DXF vs `'Fast View'`
    for everything else — same underlying `guestDownload` call either way.
  - Thumbnail area: PDF gets `PdfThumbnail`; DXF has no thumbnail generator,
    so it falls through to the generic file-icon placeholder like any other
    type without a preview image.
- Everything non-DXF opens `DocumentViewer` with `guestMode` set, which
  hides the favorite button (guests have no account to persist favorites
  against).

### 3.5 Direct single-drawing link — `[code]/page.tsx`

Separate route, `/drawing/<code>`. Skips the form entirely — calls
`getGuestDrawing(code)` on mount.

**Updated behavior:** this route now branches on `file_type`, matching what
the grid already does, instead of unconditionally handing every document to
`DocumentViewer`:

- **Non-DXF** (`pdf`, `image`, `document`, `ifc`): renders straight into
  `DocumentViewer`, `guestMode=true` — unchanged from before.
- **DXF**: skips `DocumentViewer` entirely. Triggers `guestDownload(doc)`
  automatically on load, and renders a dedicated state (reusing the
  `documents-empty` / `documents-retry-btn` CSS classes from the grid)
  explaining that DXF can't be previewed, with a manual **Download** button
  as the reliable fallback — auto-download via a synthetic click on page
  load can get silently blocked by some browsers, so the visible button is
  the path that's guaranteed to work.

This is what both an admin-generated per-drawing link *and* a link minted
through the new in-app Share button (§3.6) point to.

### 3.6 Sharing a drawing as a logged-in user — new

Logged-in users can now create a per-drawing guest link from inside the
viewer itself, without going through Django admin.

- **`DocumentViewer.tsx`** — new Share button next to Favorite. **Hidden
  when `guestMode` is set** — a guest viewing a shared drawing can't mint
  further share links from inside it.
- **`ShareLinkModal.tsx`** (new) — opened by the Share button:
  - If the document has no `guest_access_code` yet: shows "Create shareable
    link" → calls `createGuestLink(doc.id)` → `POST
    /drawings/documents/<id>/guest-link/`.
  - If a code already exists: shows the full URL (via
    `buildGuestLinkUrl(code)`), a Copy button, and a Revoke button →
    `revokeGuestLink(doc.id)` → `DELETE
    /drawings/documents/<id>/guest-link/`.
- **`drawingApi.ts`** — added `createGuestLink`, `revokeGuestLink`,
  `buildGuestLinkUrl`.
- **Serializer** — `guest_access_code` was added to the **detail**
  serializer only (`DrawingDocumentSerializer`), read-only, so
  `getDocument(id)` returns the current code if one exists. It's absent
  from the list serializer, matching the existing pattern where the list
  serializer is a trimmed read-only view (§5.4).
- **Permissions** — no new permission class was written. The action reuses
  `get_object()`, so `CanAccessDocumentPermission` (§5.2) already governs
  who's allowed to share a given document — same rule as viewing/downloading
  it.

Flow, end to end:

```
Logged-in user → opens a drawing → DocumentViewer → Share button
  → ShareLinkModal → "Create shareable link"
  → POST /drawings/documents/<id>/guest-link/
  → doc.guest_access_code set (or existing one returned)
  → DocumentAccessLog(action='share') recorded
  → modal shows https://modelflick.com/drawing/<code> + Copy + Revoke
```

To kill a link later: reopen the same drawing, Share button, Revoke in the
same modal — no trip to Django admin required for either step, though admin
still works identically as a fallback (§2 Admin section is unchanged).

### 3.7 Downloading as a guest — `guestDownload`

Guests never hit the authenticated `/documents/<id>/download/` action (it
checks `canAccessDocument` against a real `UserContext`, which a guest
doesn't have). Instead `guestDownload` just opens `doc.file_url` directly
in a new tab (`target="_blank"`) via a synthetic `<a>` click — no permission
check, no access log entry.

⚠️ Note this opens the file rather than forcing a save dialog. Whether a
DXF (plain text/XML-ish) opens inline in the new tab instead of downloading
depends entirely on the `Content-Disposition` header the file storage
backend sends for that file type — if it's not already `attachment` for
DXF, that's a one-line backend header fix, not a frontend change.

---

## 4. End-to-end flows

**Password-gated project view** (what a client with a project-wide code
sees at `modelflick.com/drawing`):

```
User visits /drawing → not logged in (isGuest) → GuestAccessGate shown
  → types code → resolveGuestAccessCode
  → GET /api/drawings/public/project/<code>/  → 200, list of docs
  → GuestAccessGate stores docs + "Project Documents" heading
  → renders GuestDocumentGrid
  → PDFs/images open in DocumentViewer on click; DXFs download directly
    (all types shown as cards in the same grid — see §3.4)
```

**Direct drawing share link (admin-generated or self-serve via Share button):**

```
Link created either via:
  (a) Admin selects a drawing → "Generate guest link for selected", or
  (b) Logged-in user → DocumentViewer → Share → "Create shareable link"
  → doc.guest_access_code set, e.g. "a1b2c3d4e5f6"
  → share URL: https://modelflick.com/drawing/a1b2c3d4e5f6
  → visitor opens it → [code]/page.tsx → getGuestDrawing(code)
  → GET /api/drawings/public/drawing/a1b2c3d4e5f6/ → 200
  → non-DXF: DocumentViewer renders directly, guestMode=true
  → DXF: auto-download fires + dedicated "can't preview, download here"
    state renders instead of the viewer
```

---

## 5. Logged-in (authenticated) user access

Guests aren't the only path through this code — logged-in users browse the
*same* `DrawingDocument` records through a parallel, fully authenticated
stack. Worth knowing both, since bugs in one privacy rule (`is_private`,
`allowed_roles`, org membership) can affect both paths differently.

### 5.1 Frontend — `app/drawing/page.tsx`

```
getCurrentUser() → not guest (id !== 0)
  → loads organisations/projects/deliverables (cascading filters)
  → loadDocuments() → getDocuments(filters) → GET /api/drawings/documents/?...
  → renders documents-grid with pagination
```

`getDocuments` (in `drawingApi.ts`) hits the DRF ViewSet's paginated `list`
action with query params: `organisation_id`, `project_id`, `deliverable_id`,
`search`, `show_private`, `ordering`, `page`, `page_size`.

**Viewing a doc:** `handleViewDocument(doc)` → client-side
`canAccessDocument(doc, currentUser)` check (see 5.3) → if it passes,
`getDocument(doc.id)` → `GET /drawings/documents/<id>/` (detail serializer,
now including `guest_access_code` — see §3.6) → opens
`<DocumentViewer document={fullDoc} ... />` — **no** `guestMode` prop, so
both the Favorite button and the new Share button are shown.

**Downloading:** `downloadDocument(doc)` → same client-side
`canAccessDocument` check → `fetch` with a Bearer token to
`GET /drawings/documents/<id>/download/` → server re-checks access (5.2)
→ `FileResponse` as an attachment.

**Favoriting:** `handleToggleFavorite(id)` → `POST
/drawings/documents/<id>/toggle-favorite/` → creates/deletes a
`DocumentFavorite` row, logs a `DocumentAccessLog(action='edit')`.

**Sharing:** `handleShare(doc)` → opens `ShareLinkModal` → `createGuestLink`
/ `revokeGuestLink` (§3.6) → logs `DocumentAccessLog(action='share')`.

**Create / edit / delete:** `DocumentForm.tsx` → `createDocument` /
`updateDocument` / `deleteDocument` → `POST` / `PATCH` / `DELETE` on
`/drawings/documents/...`, using multipart `FormData` (tags and
`allowed_roles` sent as repeated fields, not JSON — see the comment in
`DocumentForm.handleSubmit`). The org/project/deliverable dropdowns in the
form are populated via `getOrganisations` / `getProjects` /
`getDeliverables`, which are membership-scoped on the backend (see
`DrawingOrganisationListView` etc. in `views.py`). These three buttons are
only rendered at all when `canUpload` is true — see §5.5.

⚠️ Note: `DocumentViewer.tsx` never actually calls the DRF `view` action
(`GET /drawings/documents/<id>/view/`) — it fetches the file straight from
`doc.file_url` via `fetch(..., { credentials: 'include' })` and builds a
blob URL itself. The `view` action in `views.py` appears currently unused
by the frontend; `download` is the one path that's actually wired up
server-side.

### 5.2 Backend — `DrawingDocumentViewSet` (`views.py`)

`permission_classes = [IsAuthenticated, CanAccessDocumentPermission]`
(`permissions.py`):

- `has_permission` — just `IsAuthenticated`; every logged-in user passes
  for `list`/`create`, filtering happens in `get_queryset` instead.
- `has_object_permission` (retrieve/update/delete/detail actions,
  **including the new `guest_link` action** — see §2.1) —
  **same three-step logic as `_can_access_document` below**, duplicated
  as its own permission class:
  1. org membership check — not in the doc's org → denied outright, before any privacy check
  2. `is_private=False` → allowed
  3. else: `drawing_private_role` in the user's roles → allowed
  4. else: allowed only if the user's roles overlap `document.allowed_roles`

⚠️ There's a third, near-identical permission class in the same file —
`IsDrawingAdminOrReadOnly` (read allowed for any authenticated user, write
requires an `admin` org membership) — but it's **not** in
`DrawingDocumentViewSet.permission_classes`. Either it's meant for a
different viewset that isn't shown here, or it's dead code / a permission
gap where admin-only write enforcement was intended but never wired up.
Worth deciding whether `guest_link` (which effectively grants *anyone with
the URL* read/download access, bypassing privacy entirely per §1) should
require this stricter admin-only permission instead of the standard
read-level check it currently inherits — right now, any user who can merely
*view* a private document can also mint a public bypass link for it.

`get_queryset()` layers, in order:
1. **Hard org boundary** — always applied: `deliverable__project__organisation_id__in=<user's org ids>`. A user can never see another org's documents, full stop, regardless of any other query param.
2. **Privacy filter** — unless the user has role `drawing_private_role` in *any* org membership, restrict to `is_private=False` **or** `is_private=True` docs where the user's roles overlap `allowed_roles`. Done in Python (not a DB `__overlap` lookup) because `allowed_roles` is a plain `JSONField`, not `ArrayField`.
3. Then the usual query-param narrowing (org/project/deliverable/file_type/status/search/is_favorite/show_private).

`download` and `view` actions both separately call `_can_access_document(user, document)` — same four-step logic as `CanAccessDocumentPermission.has_object_permission` above, just re-implemented as a plain method instead of reused from the permission class.

So privacy enforcement exists **three times** server-side: the queryset
filter (what shows up in listings), the `CanAccessDocumentPermission`
object check (retrieve/update/delete/guest-link), and `_can_access_document`
again inside `download`/`view` (so a stale/cached doc reference can't
bypass privacy by hitting the action directly). All three encode the same
rule independently rather than sharing one implementation — worth
consolidating if the rule ever changes, since right now it'd need updating
in three places.

### 5.3 Frontend-side access check — `canAccessDocument` (`drawingApi.ts`)

```ts
canAccessDocument(doc, user):
  user.organisationIds.includes(doc.organisation_id)   // must be a member
  && (!doc.is_private
      || user.hasDrawingPrivateAccess
      || doc.allowed_roles.some(r => user.roles.includes(r)))
```

This mirrors `_can_access_document` on the backend, but it's **UX only** —
it just disables the View/Download buttons in the grid. The real
enforcement is always the backend checks in 5.2; a user could never get a
document they're not entitled to just by bypassing this client check.

⚠️ `user.hasDrawingPrivateAccess` here is set from `roles.includes('drawing_private_role')`
inside `getCurrentUser()`, where `roles` comes straight off `/users/me/`.
This is the **same unreliable field** that `canUpload` used to be built on
(see §5.5) — `/users/me/` almost certainly doesn't return real
`OrganisationMembership` roles, so this badge/gate can silently read wrong
for a user who does hold `drawing_private_role` via `/my-memberships/`.
Only `canUpload` has been moved off this field so far; `hasDrawingPrivateAccess`
has not — see §7.7.

### 5.4 Serializers — `serializers.py`

`get_serializer_class()` on the ViewSet picks between two:

| | `DrawingDocumentSerializer` (detail/create/update) | `DrawingDocumentListSerializer` (list) |
|---|---|---|
| `file` field | included, write-only (upload) | absent entirely |
| `uploaded_by` | included (read-only id) | absent — only `uploaded_by_name` |
| `deliverable_id` | writable `PrimaryKeyRelatedField` | absent (list serializer has no write path) |
| `guest_access_code` | included, read-only (new) | absent |
| Everything else | same (`is_favorite`, `file_size_display`, org/project/deliverable names, tags, privacy fields, timestamps) | same |

So the list serializer is genuinely a trimmed read-only view — it can't be
used for writes, which is why `DocumentForm.tsx` always posts to the plain
detail endpoint regardless of create vs. edit.

**`to_internal_value` override** on `DrawingDocumentSerializer` exists
specifically to handle `tags`/`allowed_roles` arriving as repeated
multipart fields (matching the `form.append('tags', tag)` pattern in
`DocumentForm.tsx` — see §5.1). It pulls them out of the incoming
`QueryDict` by hand (`getlist`), tries `json.loads` as a fallback for a
single JSON-encoded value, then re-validates them through the normal
field before handing off to `super().to_internal_value()`. The comment in
the code notes this replaced an earlier approach that tried writing a
Python list back into the `QueryDict` directly, which didn't round-trip
correctly and produced "Value must be valid JSON" errors — worth knowing
if that error resurfaces, since the fix is specifically about *not*
touching `QueryDict.__setitem__` for list values.

`validate_file` enforces `MAX_DOCUMENT_SIZE` and, if set,
`ALLOWED_DOCUMENT_EXTENSIONS` from Django settings — neither value is
shown in what's been pasted, so check `settings.py` for the actual limits
in effect.

### 5.5 `canUpload` — role gating fixed to use `/my-memberships/`

**New.** `page.tsx`'s `canUpload` flag (which gates the New Document /
Edit / Delete buttons in the header, and the "Create your first document"
empty-state button) used to be computed straight off `currentUser.roles`:

```ts
// old — unreliable
const canUpload = currentUser.roles.some(r => ['admin','manager','member'].includes(r));
```

That field comes from `getCurrentUser()` → `GET /users/me/`, which does
**not** reliably reflect real `OrganisationMembership` roles (it likely
reflects Django auth groups or an empty/unrelated field instead) — so an
actual org admin could see `canUpload === false`. `hasDrawingPrivateAccess`
(§5.3) was built on the same field and has the same problem, just less
visible since nobody noticed the badge was missing.

**Fix:** `canUpload` is now derived from `/my-memberships/` — the same
`OrganisationMembership`-backed endpoint `userApi.ts`'s
`getOrganisationMemberships()` already calls elsewhere in the app — instead
of `/users/me/`.

- **`drawingApi.ts`** — added:
  ```ts
  export interface RawMembership {
    id: number;
    organisation: number;
    role: string;
    project: number | null;
  }

  export const getMyMemberships = async (): Promise<RawMembership[]> => {
    try {
      const response = await apiClient.get('/my-memberships/');
      return response.data;
    } catch (error) {
      console.error('Error fetching memberships:', error);
      return [];
    }
  };
  ```
- **`page.tsx`** — added `memberships` / `membershipsLoaded` state, fetched
  once `currentUser` is known and isn't a guest. `canUpload` is now:
  ```ts
  const UPLOAD_ROLES = ["admin", "manager", "member"];

  const canUpload = useMemo(
    () => membershipsLoaded && memberships.some((m) => UPLOAD_ROLES.includes(m.role)),
    [membershipsLoaded, memberships]
  );
  ```
  It defaults to `false` until memberships have actually loaded, so the
  upload/edit/delete controls don't flash on for a user who turns out not
  to qualify.
- This is **UX-only**, same caveat as §5.3 — it just shows/hides buttons.
  Server-side, `create`/`update`/`delete` on `DrawingDocumentViewSet` still
  go through whatever permission class is actually wired up there (§5.2)
  regardless of what the frontend computes.
- `hasDrawingPrivateAccess` has **not** been migrated yet and still reads
  the same unreliable `/users/me/` field — see §7.7.

### 5.6 Status filter (`draft` / `published` / `archived`) — client-locked

**New.** The filter row in `page.tsx` (Organisation / Project / Deliverable /
Sort) gained a **Status** dropdown — but only for roles that should be able
to see unpublished work:

- Reuses the same role check as `canUpload` (§5.5) — `hasElevatedRole`,
  true when `/my-memberships/` contains an `admin`, `manager`, or `member`
  row. A **client** membership (or no qualifying membership at all) means
  `hasElevatedRole` is `false`.
- **Admin / manager / member** — `canFilterByStatus` is `true`. The Status
  dropdown renders (`All Statuses` / `Draft` / `Published` / `Archived`)
  next to Sort, and `selectedStatus` is passed straight through to
  `getDocuments({ status })` → appended as a `status` query param on
  `GET /drawings/documents/`.
- **Client** — `canFilterByStatus` is `false`. The dropdown isn't rendered
  at all, and `loadDocuments` doesn't fall back to "no filter" — it
  hardcodes `effectiveStatus = "published"` and sends that regardless of
  whatever `selectedStatus` holds:

  ```ts
  const effectiveStatus = canFilterByStatus ? selectedStatus : "published";
  ```

  So a client is locked to published documents at the fetch call, not just
  by hiding a control — the same "UI convenience, not the real boundary"
  pattern as §5.3/§5.5. The actual enforcement of who can see `draft`/
  `archived` documents at all is still whatever `get_queryset()` /
  `status` filtering does server-side (§5.2); this just stops a client
  from ever *asking* for a non-published status in the first place.
- Same loaded-state caution as §5.5: until `membershipsLoaded` is `true`,
  `hasElevatedRole` (and therefore `canFilterByStatus`) defaults to
  `false`, so an admin/manager/member's very first document load is
  briefly restricted to `published` too, then automatically refetches
  once their membership role comes back — this is deliberate, not a bug.
- `clearFilters` resets `selectedStatus` to `undefined` (`All Statuses`);
  `hasActiveFilters` only counts it while `canFilterByStatus` is true, so a
  client never shows a stray "clear filters" state for a filter they can't
  see or change.
- Assumes the backend list endpoint already accepts a `status` query param
  (§5.2 lists `status` among the "usual query-param narrowing" applied in
  `get_queryset()`) — no backend change was made alongside this; confirm
  that's actually wired up if documents don't filter as expected.

### 5.7 Guest vs logged-in, side by side

| | Guest | Logged-in |
|---|---|---|
| Auth | none (`AllowAny`, code-based) | `IsAuthenticated` + `CanAccessDocumentPermission` |
| Listing | `guest_visible_for_*_key()` — public+published only, or single doc via `guest_access_code` | `get_queryset()` — org-scoped, privacy/role-aware, full filter/search/pagination |
| Detail fetch | `GuestDrawingDetailView` | `DrawingDocumentViewSet.retrieve` |
| Download | direct `<a>` to `file_url`, no check, no log | `download` action, re-checks access, logs `DocumentAccessLog` |
| Favorites | hidden (`guestMode`) | full toggle support |
| Share (mint/revoke guest link) | hidden — guests can't create further guest links | `guest_link` action, logs `DocumentAccessLog(action='share')` |
| Viewer component | `DocumentViewer` with `guestMode` | `DocumentViewer` without `guestMode` |
| DXF handling | grid & direct-link page both skip the viewer, download directly | opens normally in whatever the browser does with the downloaded file (no in-app DXF viewer for anyone) |

---

## 6. DXF handling summary

DXF gets special-cased at every guest entry point because there's no
in-browser DXF preview anywhere in the app — not a guest-only limitation.

| Entry point | Behavior for DXF |
|---|---|
| `GuestDocumentGrid` (project/deliverable code) | Shown as a normal card alongside PDFs/images; click or action button triggers `guestDownload` instead of opening `DocumentViewer` |
| `[code]/page.tsx` (direct/single-drawing link) | Auto-triggers `guestDownload` on load; renders a "can't preview, here's a download button" state instead of `DocumentViewer` |
| `DocumentViewer` | Never receives a DXF document in guest flows — both entry points route around it |

DXF is **not** filtered out of listings at any level (backend querysets,
`GuestDocumentGrid`) — it's visible, just not previewable. If you want DXF
hidden from a scope entirely rather than shown-but-download-only, that
would need a new explicit filter (backend `guest_visible_for_*_key()` or
frontend `filteredDocuments`) — nothing currently does this.

---

## 7. Known issues / TODO

1. **Fix `GuestProjectDrawingsView` to 404 on an invalid key**, matching
   `GuestDeliverableDrawingsView`'s pattern:

   ```python
   class GuestProjectDrawingsView(APIView):
       permission_classes = [AllowAny]

       def get(self, request, access_code):
           from viewer.models import ProjectAccessKey
           if not ProjectAccessKey.objects.filter(access_key=access_code).exists():
               return Response({'error': 'Invalid access code'}, status=404)
           queryset = DrawingDocument.guest_visible_for_project_key(access_code)...
   ```

   Without this, an invalid project-scoped code returns `200, []` instead
   of a real failure, which stops `resolveGuestAccessCode`'s fallback chain
   early — a code that's actually valid for the deliverable or drawing
   scope never gets checked if it first "succeeds" (with zero results)
   against the project endpoint. **Still open — unaffected by the Share
   feature work.**

2. **No rate limiting** on any of the three guest endpoints
   (`AllowAny`, no `throttle_classes`). Codes are 12-char hex
   (`uuid.uuid4().hex[:12]`), so brute-forcing is impractical, but there's
   currently nothing stopping scripted probing either.

3. **No expiry** on any guest code — once generated, a link is valid
   forever until manually revoked (now from either admin or the in-app
   Share modal — see §3.6).

4. **No access logging** for guest views/downloads — `DocumentAccessLog`
   entries are only created on the authenticated `view`/`download`/
   `toggle-favorite`/**`share`** actions, so there's still no audit trail
   for what a guest actually does once they're in — only that a link was
   created or revoked by a logged-in user.

5. Consider collapsing the 3-endpoint guessing chain into one backend
   endpoint that takes the code and returns `{ type, docs }` directly —
   would cut guest login latency from up to 3 round trips down to 1.

6. **New:** `guest_link` creation currently only requires the same
   permission as *viewing* a document (§5.2). Since a minted link fully
   bypasses privacy for that one file (§1), anyone who can view a private
   document can also generate a public, unauthenticated, non-expiring link
   to it. Worth deciding if this should require a stricter permission (e.g.
   `IsDrawingAdminOrReadOnly`'s admin check, currently unused elsewhere —
   see §5.2) before it's exposed more widely than it is today.

7. **New:** `hasDrawingPrivateAccess` (`drawingApi.ts` → `getCurrentUser()`,
   used in §5.3's `canAccessDocument`) still derives from
   `roles.includes('drawing_private_role')` on `/users/me/`'s `roles`
   field — the same field that made `canUpload` unreliable before the
   §5.5 fix. It hasn't been migrated to `/my-memberships/` yet. Until it
   is, a user who actually holds `drawing_private_role` via a real
   `OrganisationMembership` row may still be denied client-side access to
   private documents they're entitled to see (server-side enforcement in
   §5.2 is unaffected either way, since it reads membership roles directly
   rather than trusting this frontend field).