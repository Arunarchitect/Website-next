# Drawings App: How It Works

Drawings/documents for Modelflick. Two audiences:

- **Logged-in users** browse, upload, share and manage drawings (§5).
- **Guests** (no login) view drawings through a shared code (§1-§4).

Backend: Django REST Framework, app `drawings`. Frontend: Next.js, `app/drawing/`.
Last updated after: in-app Share button, **bulk share / revoke / print**, client
project-scoping, status filter, **mobile-minimal viewer toolbar** (direct link).

---

## 1. The three guest scopes

| Scope | Code lives on | Visibility rule | Bypasses private/archived? |
|---|---|---|---|
| **Project** | `ProjectAccessKey` (viewer app) | only `is_private=False, status='published'` drawings in that project | No |
| **Deliverable** | `DeliverableAccessKey` (viewer app) | only `is_private=False, status='published'` drawings in that deliverable | No |
| **Drawing** | `DrawingDocument.guest_access_code` | that one drawing, regardless of privacy/status | **Yes** |

The per-drawing code is intentionally the odd one out: it's a direct share
link for one file and ignores every other access rule. It is also the **only**
scope a logged-in user can create from inside the app (§2.1, §2.2, §3.6, §3.8).
Project and deliverable keys are still admin/viewer-app-managed.

---

## 2. Backend

### Models: `drawings/models.py`

```python
DrawingDocument.guest_access_code   # unique, nullable CharField(32)
DrawingDocument.generate_guest_access_code()   # mints a 12-char hex code, saves, returns it
DrawingDocument.revoke_guest_access_code()     # clears the code (sets None)

DrawingDocument.guest_visible_for_project_key(access_key)      # -> queryset
DrawingDocument.guest_visible_for_deliverable_key(access_key)  # -> queryset
DrawingDocument.guest_visible_for_drawing_code(code)           # -> queryset
```

Useful `DrawingDocument` properties (used by serializers and the bulk endpoints):
`organisation`, `project`, `deliverable_name`, `project_name`, `project_id`,
`organisation_name`, `organisation_id`, `uploaded_by_name`, `file_size_display`.

`DocumentAccessLog.action` choices: `view`, `download`, `share`, `edit`, `delete`.
`share` is written by every guest-link create/revoke, single or bulk.

`ProjectAccessKey` / `DeliverableAccessKey` live in the **viewer app**, not
`drawings`.

### Guest views: `drawings/views.py`

All `permission_classes = [AllowAny]`:

```python
GuestProjectDrawingsView       # GET /api/drawings/public/project/<access_code>/
GuestDeliverableDrawingsView   # GET /api/drawings/public/deliverable/<access_code>/
GuestDrawingDetailView         # GET /api/drawings/public/drawing/<code>/
```

Both the project and deliverable views return **404 on an unknown key**. This
matters because the frontend resolves a typed code by trying all three
endpoints in order (§3.1): a `200 []` from the project endpoint would stop the
chain early. (The project view used to return `200 []`; fixed.)

### URLs: `drawings/urls.py`

```python
router.register(r'documents', DrawingDocumentViewSet, basename='drawing-document')
...
path('public/project/<str:access_code>/', GuestProjectDrawingsView.as_view()),
path('public/deliverable/<str:access_code>/', GuestDeliverableDrawingsView.as_view()),
path('public/drawing/<str:code>/', GuestDrawingDetailView.as_view()),
```

The prefix is `public/`, not `guest/`. The router picks up every `@action`
automatically, so new actions on the viewset need **no** `urls.py` change.

### Admin: `drawings/admin.py`

`guest_access_code` is not directly editable. Instead:

- Select document(s) → **"Generate guest link for selected"** (mints/regenerates,
  shows `/drawing/<code>` URLs in the banner) or **"Revoke guest link for selected"**.
- Change form shows the current code (read-only) and a rendered link.
- List view has a ✓ Active / — badge column.

Admin still works as a fallback for everything the in-app tools do.

### 2.1 Single-drawing link: `guest_link` action

```
POST   /drawings/documents/<id>/guest-link/    create (or return existing) code
DELETE /drawings/documents/<id>/guest-link/    revoke
```

- `@action(detail=True)`, so it reuses `get_object()` and the full permission
  chain: `IsAuthenticated` + `get_queryset()` + `CanAccessDocumentPermission`.
- `POST` is idempotent: returns the existing code, doesn't rotate it. To rotate,
  Revoke then Create.
- Both log `DocumentAccessLog(action='share')`; POST logs only when a code is
  actually minted.

### 2.2 Bulk actions: `DrawingDocumentViewSet` (`detail=False`)

Three list-level actions back the bulk Share modal (§3.8). All use
`permission_classes=[IsAuthenticated]` and scope every id through
**`self.get_queryset()`**, so org boundary, client project-scoping,
draft/published rules and privacy rules all apply. Ids the user can't access
are silently dropped and reported in `skipped`.

| Endpoint | Body / query | Does | Returns |
|---|---|---|---|
| `POST /drawings/documents/bulk-guest-link/` | `{"ids": [..]}` (max 300) | mints missing codes, returns existing ones; logs `share` only for newly minted | `{links: [{id,title,code,project_name,deliverable_name,is_private}], skipped}` |
| `GET /drawings/documents/guest-links/` | same filters as list (`organisation_id`, `project_id`, `deliverable_id`, `status`, `search`, `show_private`) | every accessible drawing matching the filters that **already has** a link. Not paginated | `{links: [...]}` |
| `POST /drawings/documents/bulk-revoke-guest-link/` | `{"ids": [..]}` (max 300) | revokes the code on each accessible drawing that has one; logs `share` per drawing | `{revoked: [ids], skipped}` |

Notes:

- Because these use the list-level permission (not `get_object()`), there is no
  object-permission check; `get_queryset()` is the only gate. Keep it that way
  or add an explicit check if `get_queryset()` ever loosens.
- Writes run inside `transaction.atomic()`; logs are `bulk_create`d.
- An **optional, commented-out block** in `bulk_guest_link` restricts minting to
  org-wide admin/manager/member (`_full_access_org_ids`). Enable it to stop
  project-scoped clients from minting links (§7.6).

---

## 3. Frontend

### File map

```
app/drawing/
├── page.tsx                  # authenticated document browser; renders
│                             # <GuestAccessGate /> if the user is a guest.
│                             # Header has a Share button (bulk, §3.8).
│                             # canUpload / canFilterByStatus come from
│                             # getMyMemberships() (§5.5, §5.6).
├── [code]/page.tsx           # direct single-drawing link (/drawing/<code>);
│                             # passes hideActionsOnMobile to the viewer (§3.5)
├── guestApi.ts               # unauthenticated axios client + 3 guest fetches + resolver
├── drawingApi.ts             # authenticated client + all logged-in API calls
├── types.ts                  # shared types (its `DocumentFilters` is stale: no
│                             # status/ordering. Use the one in drawingApi.ts, §7.14)
├── styles.css
└── components/
    ├── GuestAccessGate.tsx   # access-code entry form
    ├── GuestDocumentGrid.tsx # renders resolved guest docs, with filters
    ├── DocumentViewer.tsx    # shared viewer, guestMode prop; Share button
    │                         # (hidden in guestMode) opens ShareLinkModal;
    │                         # hideActionsOnMobile prop (§3.6b)
    ├── ShareLinkModal.tsx    # create/copy/revoke ONE drawing's link
    ├── BulkShareModal.tsx    # checklist + Print PDF (clickable links) + Revoke links (§3.8)
    ├── DocumentForm.tsx      # create/edit drawing
    └── PdfThumbnail.tsx
```

### 3.1 How a typed code gets resolved: `guestApi.ts`

No backend "what type is this code" endpoint. The frontend tries all three in order:

```
resolveGuestAccessCode(code)
  1. GET /api/drawings/public/project/<code>/
  2. GET /api/drawings/public/deliverable/<code>/
  3. GET /api/drawings/public/drawing/<code>/
  → first 2xx wins; all fail → "doesn't match any shared drawings"
```

A single-drawing code can take 3 round trips (latency, not a bug).

Two details of the resolver: each attempt downloads the **full document
list/detail** (it only cares that the call succeeds), and `GuestAccessGate` then
fetches the same data again, so a typed code costs one extra request. The
`catch {}` blocks also swallow every error type, not just 404, so a network
failure reads as "doesn't match any shared drawings".

`guestClient` is a **separate axios instance** from `apiClient`: no
`Authorization` header, no 401-refresh interceptor. Deliberate, so a stale token
from a previous login on the same browser never leaks into guest requests.

### 3.2 Who sees the gate: `page.tsx`

```ts
const isGuest = currentUser?.id === 0;
```

`getCurrentUser()` returns a synthetic `{ id: 0, name: 'Guest', ... }` when no
auth token is found. If `isGuest`, only `<GuestAccessGate />` renders; the
document browser, Share button and `BulkShareModal` are never mounted (the
`isGuest` branch returns before them).

### 3.3 The form: `GuestAccessGate.tsx`

Controlled input → `resolveGuestAccessCode(code)` → matching fetch
(`getProjectGuestDocuments` / `getDeliverableGuestDocuments` / `getGuestDrawing`)
→ `<GuestDocumentGrid documents={docs} heading={...} />`.

### 3.4 The grid: `GuestDocumentGrid.tsx`

- Deliverable / file-type filter dropdowns built from returned docs (shown only
  if more than one value).
- **DXF is never hidden**, only handled differently: clicking a DXF card (or its
  button, labelled `Download`) calls `guestDownload(doc)` instead of opening
  `DocumentViewer`. DXF has no thumbnail generator, so it shows the generic icon.
- Everything non-DXF opens `DocumentViewer` with `guestMode` (hides Favorite and Share).
  The grid does **not** pass `hideActionsOnMobile`, so Close stays available on
  mobile and users can return to the list.

### 3.5 Direct single-drawing link: `[code]/page.tsx`

`/drawing/<code>` skips the form and calls `getGuestDrawing(code)` on mount.
Branches on `file_type`:

- **Non-DXF** (`pdf`, `image`, `document`, `ifc`): `DocumentViewer` with
  `guestMode` and `hideActionsOnMobile`. On phones (≤780px) the toolbar shows
  only **Fast View / Download**; desktop keeps Print, Fast View and Close. This
  is the only page that passes `hideActionsOnMobile`, because the viewer is the
  whole page and there is nothing to close back to. The guest grid and the
  logged-in viewer keep Close on mobile so users aren't trapped.
- **DXF**: skips the viewer, auto-calls `guestDownload(doc)`, and shows a
  "can't preview" state with a manual **Download** button (auto-download can be
  silently blocked by browsers; the button is the guaranteed path). The
  apostrophe in that message must be `&apos;` (a previous version was garbled).

Every link from admin, the single Share modal and the bulk modal points here.

### 3.6 Sharing ONE drawing: `DocumentViewer` + `ShareLinkModal`

- `DocumentViewer.tsx`: Share button next to Favorite; hidden when `guestMode`.
- `ShareLinkModal.tsx`:
  - No code yet → "Create shareable link" → `createGuestLink(id)`.
  - Code exists → full URL (`buildGuestLinkUrl`), Copy, Revoke → `revokeGuestLink(id)`.
- Detail serializer includes read-only `guest_access_code`; the **list**
  serializer does not (which is why the bulk modal needs `GET guest-links/`, §2.2).
- Permissions: reuses `get_object()`; same rule as viewing the document.
- `ShareLinkModal` props: `documentId, documentTitle, initialCode, onClose,
  onCodeChange`. It reuses form-modal CSS classes (`document-form-modal`,
  `form-input`, `btn-*`) and renders at `zIndex: 1100`.
- `DocumentViewer` keeps the code in local state (`guestCode`) synced from
  `doc.guest_access_code`. `page.tsx` always opens the viewer through
  `getDocument(id)` (detail serializer), so reopening a drawing after a bulk
  generate/revoke picks up the new state. The Share icon switches to
  `ti-link` when a code exists.
- The viewer's Share button is **not** role-gated (visible to any logged-in
  user), same as the header Share button. See §7.6 if you restrict sharing.

### 3.6b `DocumentViewer.tsx` capabilities

- **PDF:** `react-pdf` continuous scroll, worker loaded from unpkg
  (`pdfjs-dist@<installed version>`), zoom 50-600% (± buttons, typed %, Ctrl/Cmd+wheel,
  `+`/`-`/`0` keys), mouse drag-pan, touch pan + pinch-zoom, and print via hidden
  iframe (blob URL).
- **Fast View** link (PDF **and image**) opens `file_url` in a new tab. With
  `hideActionsOnMobile`, at ≤780px Print and Close are hidden and the label
  becomes "Fast View / Download" (see §3.5). This only opens the file; it does
  not force a download (§7.15).
- **Image:** blob URL rendered with `next/image` (`unoptimized`, `fill`).
- **DXF:** placeholder card with a "Download DXF File" button (`onDownload`).
  Logged-in users see this inside the viewer; guest flows bypass the viewer (§6).
- **Loading:** PDF/image are fetched via `fetch(getFullFileUrl(doc.file_url),
  { credentials: 'include' })` into a blob, i.e. straight from the media URL,
  **not** through the authenticated `view` action (see §7.12).
- Props: `document, isOpen, onClose, onFavoriteToggle, onDownload, guestMode?,
  hideActionsOnMobile?`. Locks body scroll while open; Escape closes.
- **Mobile-minimal mode** (`hideActionsOnMobile`): the controls container gets
  `document-viewer-mobile-minimal`; Print and Close get
  `document-viewer-hide-on-mobile`; the Fast View anchor renders two labels
  (`document-viewer-label-desktop` / `document-viewer-label-mobile`) and CSS
  swaps them at ≤780px. The CSS lives in `styles.css` under "VIEWER - MOBILE
  MINIMAL ACTIONS", with a matching override inside the ≤480px block so the
  label swap still works there. Escape still closes the viewer regardless.

### 3.7 Guest download: `guestDownload`

Guests never hit the authenticated `/documents/<id>/download/` (needs a real
`UserContext`). `guestDownload` opens `doc.file_url` in a new tab via a
synthetic `<a>` click: no permission check, no access log.

Whether a DXF downloads or opens inline depends on the storage backend's
`Content-Disposition`; forcing `attachment` is a backend header fix, not a
frontend change.

### 3.8 Sharing MANY drawings: `BulkShareModal.tsx` (new)

Opened by the **Share** button in the `page.tsx` header (visible to every
logged-in user; the server scopes what they can share).

**On open** it loads, in parallel with the current page filters:
1. **All** drawings matching the filters (loops `getDocuments` at
   `pageSize=100`, the backend max, up to 50 pages), not just the visible page.
2. `getActiveGuestLinks(filters)` → which of them already have a link (non-fatal
   if it fails: no "shared" badges and Revoke stays disabled).

**UI**
- Checklist grouped by project, with per-project "select all"; per-drawing
  badges: green **shared** (has a link), amber **private**.
- Search box; **All / None** quick-select. Footer shows `N selected`.

**Two actions**

| Button | Behaviour |
|---|---|
| **Print PDF** | `bulkCreateGuestLinks(selectedIds)` (mints any missing links, returns existing ones) → `downloadPdf(links)` → A4 portrait PDF with clickable links. Enabled when ≥1 drawing is selected. |
| **Revoke links** | confirm → `bulkRevokeGuestLinks(selected ids that have a link)` → badges update; anyone holding those links loses access immediately. Enabled when ≥1 selected drawing has a link. |

A private-drawing warning shows when any selected drawing is private (links
bypass privacy and never expire). Max 300 drawings per call.

**Print PDF** (`downloadPdf`, needs `npm i jspdf`): builds a real A4 portrait
PDF client-side with jsPDF, grouped by project (sorted), then deliverable, then
title. Each row: `#`, title + deliverable, and the full `/drawing/<code>` URL as
blue underlined text with a **true link annotation** (clickable in every PDF
viewer). Project headings stay with their first row across page breaks. The file
downloads as `shared-drawings-YYYY-MM-DD.pdf`; the user prints it from the PDF
viewer. jsPDF's built-in fonts are Latin-1 only, so non-Latin characters in
titles print as `?`. (The earlier HTML/iframe print path was removed: "Save as
PDF" from a browser print dialog doesn't reliably keep links.)

**Filter contract.** The modal takes the *same* filters `loadDocuments` uses
(`organisationId, projectId, deliverableId, search, showPrivate, ordering,
status`). `page.tsx` computes `effectiveStatus` **once at component level** and
passes it to both, so clients stay locked to `published` in the modal too. The
frontend uses camelCase (`DocumentFilters`); `getDocuments` /
`getActiveGuestLinks` translate to the snake_case query params the backend
reads.

### 3.9 `drawingApi.ts`: guest-link related exports

```ts
createGuestLink(id)           // POST   /drawings/documents/<id>/guest-link/
revokeGuestLink(id)           // DELETE /drawings/documents/<id>/guest-link/
buildGuestLinkUrl(code)       // `${origin}/drawing/${code}`
bulkCreateGuestLinks(ids)     // POST   /drawings/documents/bulk-guest-link/
getActiveGuestLinks(filters)  // GET    /drawings/documents/guest-links/?...
bulkRevokeGuestLinks(ids)     // POST   /drawings/documents/bulk-revoke-guest-link/
interface BulkLink { id, title, code, project_name, deliverable_name, is_private }
getMyMemberships()            // GET    /my-memberships/  (see §5.5)
```

---

## 4. End-to-end flows

**Project/deliverable code (client at `/drawing`):**

```
/drawing → not logged in → GuestAccessGate
  → code → resolveGuestAccessCode → GET public/project/<code>/ → 200 docs
  → GuestDocumentGrid; PDFs/images open in DocumentViewer, DXFs download
```

**Single drawing (admin, Share button, or bulk):**

```
Link created via admin action, ShareLinkModal, or BulkShareModal
  → doc.guest_access_code e.g. "a1b2c3d4e5f6"
  → https://modelflick.com/drawing/a1b2c3d4e5f6
  → [code]/page.tsx → GET public/drawing/<code>/
  → non-DXF: DocumentViewer (guestMode, hideActionsOnMobile)
             desktop: Print / Fast View / Close · mobile: Fast View / Download only
  → DXF: auto-download + fallback button
```

**Bulk share + print (logged-in):**

```
/drawing → Share → BulkShareModal loads all filtered drawings + existing links
  → tick drawings (grouped by project)
  → Print PDF → POST bulk-guest-link/ (mints missing) → clickable A4 PDF downloads
  → later: reopen, tick shared drawings (green badge) → Revoke links
```

---

## 5. Logged-in user access

Logged-in users browse the *same* `DrawingDocument` records through a separate
authenticated stack. A bug in one privacy rule (`is_private`, `allowed_roles`,
org/project scoping) can affect the two paths differently.

### 5.1 Frontend: `page.tsx`

```
getCurrentUser() → not guest → load organisations/projects/deliverables (cascading)
  → loadDocuments() → GET /api/drawings/documents/?...   (paginated)
```

`getDocuments` params: `organisation_id`, `project_id`, `deliverable_id`,
`search`, `show_private`, `ordering`, `status`, `page`, `page_size`.

- **View:** `handleViewDocument` → client `canAccessDocument` → `getDocument(id)`
  (detail serializer) → `DocumentViewer` (no `guestMode`: Favorite + Share shown).
- **Download:** `downloadDocument` → `canAccessDocument` → Bearer `fetch` of
  `/documents/<id>/download/` → server re-checks → `FileResponse` attachment.
- **Favorite:** `POST toggle-favorite/` → row create/delete + `edit` log.
- **Share one:** inside `DocumentViewer` → `ShareLinkModal` (§3.6). `page.tsx`
  does not handle it. **Share many:** header button → `BulkShareModal` (§3.8).
- **Create / edit / delete:** `DocumentForm.tsx` → multipart `FormData`
  (`tags`, `allowed_roles` as repeated fields, not JSON). Buttons render only
  when `canUpload` (§5.5).

⚠️ `DocumentViewer.tsx` never calls the DRF `view` action; it fetches
`doc.file_url` directly and builds a blob URL. The `view` action is currently
unused by the frontend.

⚠️ Privacy counts: `loadDocuments` requests `pageSize: 1000` for the
Public/Private badges, but the backend caps `page_size` at 100, so those
counts only cover the first 100 matching drawings (§7.8).

### 5.2 Backend: `DrawingDocumentViewSet` (`views.py`)

`permission_classes = [IsAuthenticated, CanAccessDocumentPermission]`.
The bulk actions override this with `[IsAuthenticated]` (§2.2).

`get_queryset()` layers, in order:

1. **Hard org boundary:** `deliverable__project__organisation_id__in=<user's orgs>`.
2. **Client project-scoping, per organisation.** Orgs where the user has an
   org-wide (`project=None`) admin/manager/member membership show every
   project. Any other org the user belongs to is narrowed to projects they're
   explicitly linked to (via `OrganisationMembership.project` **or**
   `ProjectMembership(role='client')`) **and `status='published'`**. See
   `_full_access_org_ids()` / `_client_project_ids()`. Evaluated per org: an
   admin in org A who is a client in org B is still restricted in B.
3. **Privacy filter:** unless the user has `drawing_private_role` in any
   membership, restrict to `is_private=False` or private docs whose
   `allowed_roles` overlap the user's roles. Done in Python (not `__overlap`)
   because `allowed_roles` is a plain `JSONField`.
4. **Query-param narrowing:** `organisation_id`, `project_id`,
   `deliverable_id`, `file_type`, `status`, `is_favorite`, `show_private`, `search`.

`download` / `view` re-check with `_can_access_document(user, doc)`, which
mirrors steps 1-3 (org, client project + published, privacy).

⚠️ **Rule duplicated in three places** (queryset, `_can_access_document`,
`CanAccessDocumentPermission.has_object_permission`). The permission class in
`permissions.py` has only the org + privacy checks: it does **not** include the
client project/published scoping. `get_object()` runs `get_queryset()` first, so
retrieve/update/delete/`guest_link` are still protected by step 2, but the
permission class alone is weaker than the other two. Consolidate into one shared
function if the rule changes.

`IsDrawingAdminOrReadOnly` exists in `permissions.py` but is **not wired to any
view here** (dead code, or an intended admin-only write gate that was never applied).

Dropdown endpoints (`DrawingOrganisationListView`, `DrawingProjectListView`,
`DrawingDeliverableListView`) apply the same per-org full-access vs
client-project logic, so a client only sees their own orgs/projects/deliverables.

### 5.3 Frontend access check: `canAccessDocument` (`drawingApi.ts`)

```ts
user.organisationIds.includes(doc.organisation_id)
  && (!doc.is_private || user.hasDrawingPrivateAccess
      || doc.allowed_roles.some(r => user.roles.includes(r)))
```

UX only: disables View/Download buttons. Real enforcement is §5.2.

⚠️ `hasDrawingPrivateAccess` and `user.roles` come from `/users/me/`, which does
not reliably reflect `OrganisationMembership` roles. Not yet migrated to
`/my-memberships/` (§7.7).

### 5.4 Serializers: `serializers.py`

| | `DrawingDocumentSerializer` (detail/create/update) | `DrawingDocumentListSerializer` (list) |
|---|---|---|
| `file` | included, write-only | absent |
| `uploaded_by` | included (read-only id) | absent, only `uploaded_by_name` |
| `deliverable_id` | writable `PrimaryKeyRelatedField` | present, **read-only** (resolved from the model's FK attribute) |
| `guest_access_code` | included, read-only | **absent** |
| `created_at` / `updated_at` | included | absent (only `uploaded_at`) |
| Rest | same (`is_favorite`, `file_size_display`, org/project/deliverable names, tags, privacy fields) | same |

`guest_access_code` is in the detail serializer's `read_only_fields`; it can
only change through the guest-link actions, never a create/update payload.
Guest project/deliverable endpoints use the **list** serializer (no context, so
`is_favorite` is always false); `GuestDrawingDetailView` uses the **detail**
serializer, so a guest with a drawing code also receives `allowed_roles`,
`uploaded_by` (user id) and `guest_access_code` (§7.13).

`DocumentForm.tsx` always posts to the detail endpoint. The
`to_internal_value` override pulls `tags`/`allowed_roles` out of the multipart
`QueryDict` with `getlist` (JSON fallback for a single encoded value). Don't
write Python lists back into `QueryDict` (`__setitem__`); that caused "Value must
be valid JSON" errors. `validate_file` enforces `MAX_DOCUMENT_SIZE` and
`ALLOWED_DOCUMENT_EXTENSIONS` from `settings.py`.

### 5.5 `canUpload`: role gating via `/my-memberships/`

`canUpload` gates New Document / Edit / Delete and the empty-state create
button. It is derived from `getMyMemberships()` (`GET /my-memberships/`, real
`OrganisationMembership` rows), **not** `currentUser.roles`:

```ts
const UPLOAD_ROLES = ["admin", "manager", "member"];
const hasElevatedRole = useMemo(
  () => membershipsLoaded && memberships.some((m) => UPLOAD_ROLES.includes(m.role)),
  [membershipsLoaded, memberships]
);
const canUpload = hasElevatedRole;
```

Defaults to `false` until memberships load (no flash of controls). UX-only;
the server enforces real permissions.

### 5.6 Status filter (`draft` / `published` / `archived`): client-locked

Status dropdown renders only when `canFilterByStatus` (= `hasElevatedRole`).
Clients are forced to `published`, computed once at component level:

```ts
const effectiveStatus = canFilterByStatus ? selectedStatus : "published";
```

Used by `loadDocuments` **and** `BulkShareModal`. Server-side, clients are
independently limited to published in `get_queryset()`. Until memberships load,
`canFilterByStatus` is false, so an elevated user's first load is briefly
`published`-only, then refetches (deliberate). `clearFilters` resets
`selectedStatus`; `hasActiveFilters` only counts it when `canFilterByStatus`.

### 5.7 Guest vs logged-in

| | Guest | Logged-in |
|---|---|---|
| Auth | none (`AllowAny`, code-based) | `IsAuthenticated` + `CanAccessDocumentPermission` |
| Listing | `guest_visible_for_*_key()`: public+published only, or one doc via `guest_access_code` | `get_queryset()`: org-scoped, client-scoped, privacy/role-aware, filter/search/pagination |
| Detail | `GuestDrawingDetailView` | `DrawingDocumentViewSet.retrieve` |
| Download | direct `<a>` to `file_url`, no check, no log | `download` action, re-checks access, logs |
| Favorites | hidden (`guestMode`) | full |
| Share (mint/revoke link) | hidden | single: `guest_link`; bulk: `bulk-guest-link` / `bulk-revoke-guest-link`; all log `share` |
| Viewer | `DocumentViewer` + `guestMode` (direct link also `hideActionsOnMobile`) | `DocumentViewer` |
| DXF | grid & direct link skip the viewer, download directly | opens `DocumentViewer`, which shows a DXF placeholder + "Download DXF File" button (no in-app DXF preview for anyone) |

---

## 6. DXF handling summary

No in-browser DXF preview exists anywhere, so DXF is special-cased at every
guest entry point.

| Entry point | Behaviour |
|---|---|
| `GuestDocumentGrid` | normal card; click/button → `guestDownload` |
| `[code]/page.tsx` | auto `guestDownload` + "can't preview" state with Download button |
| `DocumentViewer` | never receives a DXF in guest flows; logged-in users get a placeholder card + download button |

DXF is not filtered out of any listing. Hiding it from a scope would need an
explicit filter (`guest_visible_for_*_key()` or the grid's `filteredDocuments`).

---

## 7. Known issues / TODO

1. ~~`GuestProjectDrawingsView` 200-on-invalid-key~~ **Fixed:** returns 404,
   matching the deliverable view.

2. **No rate limiting** on the three guest endpoints (`AllowAny`, no
   `throttle_classes`). 12-char hex codes make brute force impractical, but
   nothing stops scripted probing.

3. **No expiry** on any guest code. Valid until manually revoked (admin, single
   Share modal, or bulk Revoke).

4. **No access logging for guest views/downloads.** `DocumentAccessLog` is only
   written by authenticated actions (incl. `share`). No audit trail of what a
   guest does.

5. **3-endpoint guessing chain** for typed codes: could collapse into one
   endpoint returning `{ type, docs }` (up to 3 round trips → 1).

6. **Who may mint links (worse with bulk).** `guest_link`, `bulk_guest_link`
   only require *view* access. A minted link bypasses privacy and status for
   that file, so anyone who can view a private drawing can mint permanent public
   links for up to 300 at once, and a project-scoped **client** can mint links
   that keep working after the drawing is unpublished/archived. The modal only
   warns. Fix options: enable the commented block in `bulk_guest_link`
   (org-wide roles only); require `drawing_private_role`/`admin` for private
   drawings; or wire `IsDrawingAdminOrReadOnly`. Also hide the Share button with
   `hasElevatedRole` if you restrict it.

7. **`hasDrawingPrivateAccess` / `user.roles`** still come from `/users/me/`
   (unreliable). A user with `drawing_private_role` via a real membership may be
   denied client-side access to private docs they're entitled to. Server side is
   unaffected. Migrate to `/my-memberships/`.

8. **Privacy count badges undercount.** `page.tsx` asks for `pageSize: 1000`;
   backend `max_page_size` is 100, so Public/Private counts cover only the first
   100 results. Use a count endpoint or loop pages.

9. **Bulk limits:** 300 ids per generate/revoke call; the modal loads at most
   50 pages × 100 = 5000 drawings. `GET guest-links/` is unpaginated. Fine at
   current scale; paginate or cap if drawing counts grow.

10. **Permission class gap:** `CanAccessDocumentPermission` lacks the client
    project/published scoping present in `get_queryset()` and
    `_can_access_document` (§5.2). Currently masked by `get_queryset()`; worth
    consolidating.

11. **Print PDF is a download, not a print dialog.** The user prints the PDF from their viewer. It needs the
    `jspdf` npm package, and titles with non-Latin characters print as `?`
    (embed a Unicode font in `downloadPdf` if that matters).

12. **Media files are fetched by plain URL.** `DocumentViewer` and `guestDownload`
    fetch `doc.file_url` (`/media/drawings/<org>/<project>/<deliverable>/<name>_<timestamp>_<6 hex>.<ext>`)
    directly, not through an authenticated view. Assuming `/media/` is served
    statically (verify in nginx/Django config), privacy is enforced on the
    **API** (listings, detail, share links) but not on the file itself. Two
    consequences: a private drawing's file is reachable by anyone who learns its
    URL, and **revoking a guest link stops the `/drawing/<code>` page but not a
    `file_url` someone already saw**. Fix by serving media through an
    access-checked view or signed/expiring URLs.

13. **Guest drawing-detail response is over-broad.** `GuestDrawingDetailView`
    uses the full `DrawingDocumentSerializer`, so guests also get
    `allowed_roles`, `uploaded_by` (numeric user id) and internal ids. Use a
    guest-specific serializer with only what the viewer needs.

14. **Stale duplicate types.** `types.ts` defines a `DocumentFilters` without
    `status`/`ordering` and a `Project.location` field the API doesn't return.
    Import `DocumentFilters` from `drawingApi.ts` (as `BulkShareModal` does) and
    remove or sync the copy in `types.ts`.

15. **"Fast View / Download" doesn't force a download.** On mobile it opens
    `file_url` in a new tab and the user saves from the browser menu. A real
    forced download needs a `Content-Disposition: attachment` header from the
    backend (see §3.7).