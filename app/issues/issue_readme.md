# Issue Tracker (Modelflick)

BCF-compatible issue tracking for Modelflick. Tracks two kinds of issues side by side in one list, one detail view, and one set of stats:

- **BIM issues** — tied to the IFC model (viewpoint, camera, clipping planes, linked IFC element GUIDs). Maps 1:1 onto a BCF 2.1/3.0 "Topic", so it can be imported/exported to any BCF-compliant tool (BIMcollab, Trimble Connect, Solibri, Navisworks) or a bcfXchange 3.0 server.
- **Design / "Other" issues** — everything that isn't model-linked (documentation, schedule, client sign-off, etc.), with plain file/URL attachments instead of a viewpoint.

Built June–July 2026. Project-name-in-list and @mention support (title/ description) added September 2026.

## Stack

- Frontend: Next.js (`app/issues/`), client components, axios
- Backend: Django REST Framework — a single `Issue` model with a `domain` field (`bim` / `other`), plus `IssueViewpoint` and `IssueComment`
- Styling: `issues.css`, scoped under `.issues-page`, using CSS custom properties for spacing/color/radius (see "Design system" below); `mentionTextarea.css` for the mention-autocomplete widget

## File map

```
app/issues/
├── page.tsx                 # List page: filters, search, sort, stats, pagination, new-issue form
├── [id]/page.tsx             # Detail page: fetches one issue, wires callbacks to IssueDetail
├── IssueCard.tsx              # Compact card used in the list (collapsed row only)
├── IssueDetail.tsx            # Full single-issue view (was the old "expanded" card, now standalone)
├── IssueCardParts.tsx         # Shared building blocks: header, meta, screenshots, comments,
│                                 resolve panel, actions bar, sidebar, modal — used by IssueDetail
├── IssueCardAccessParts.tsx    # ClassificationBadge, ManageAccessPanel (access control UI)
├── issueApi.ts                 # All HTTP calls + Django <-> frontend field mapping
├── issueTypes.ts               # Shared TS types, BCF conversion helpers, constants
├── issueCardHelpers.ts          # useScreenshotUpload hook, linkifyText, shared constants
├── commentTextRenderer.tsx      # Renders @mentions / links inside comment text
├── MentionTextarea.tsx          # Textarea with @mention autocomplete (comments, title, description)
├── mentionTextarea.css           # Styling for the mention suggestion dropdown + chip
├── ExpandableText.tsx           # "show more/less" wrapper for description/comment text
├── imageUtils.ts                 # processImageFile, clipboard/drop image extraction
├── notificationApi.ts            # Notification list/unread-count/mark-read/delete HTTP calls
└── issues.css                    # All styling for the feature
```

## Data model (frontend)

`Issue` is a discriminated union on `domain`:

```ts
type Issue = BimIssue | DesignIssue;
// BimIssue:    domain: "bim"           — bcfGuid, topicType, ifcElements, viewpoint
// DesignIssue: domain: "design"|"other" — category, attachments
```

Shared fields on both: `title`, `description`, `status`, `priority`, `module`, `reportedBy`/`reportedById`, `assignedTo`/`assignedToId`, `project`/ `deliverable`, `projectName`, `organisation`/`organisationId`, `comments`, `linkedDocuments`, `dueDate`, `resolution`, plus the access-control fields below.

- `projectName` (optional `string | null`) — flat display name of the linked project, sourced from the backend's `project_name` field (list/ base serializers) or `project_details.name` (detail serializer). Shown as a meta chip on `IssueCard`. Optional so existing call sites that build a partial `Issue` without it (`getDefaultIssue`, `fromBcfTopic`) still type-check.

`status`: Open / In Progress / Resolved / Closed `priority`: High / Medium / Low `topicType` (BIM only): Clash / Coordinate / Quality / Safety / General / Request / Fault

## Access control

- `classification`: general / public / internal / strategic / confidential — independent of `domain`/`topicType`.
- `GATED_CLASSIFICATIONS` (internal/strategic/confidential) require the viewer to be an org admin, hold an `allowedRole`, be the reporter/assignee, or be explicitly in `sharedWith`.
- `allowedRoles`: narrows a gated classification to specific org roles (org roles: admin/manager/member/client).
- `sharedWith` / `sharedWithDetails`: per-user grant (e.g. a client) that bypasses classification/role entirely.
- `canManageAccess`: server-computed per issue — true for org admins/staff/ superusers regardless of who reported it. Drives whether "Manage Access" shows in the UI.
- Editing access goes through a **dedicated endpoint** (`updateIssueAccess` → `PATCH /issues/issues/:id/access/`), separate from the main issue PATCH, so a plain member's normal edit can never accidentally touch classification/roles/sharedWith, and the access check only fires when someone actually tries to change access.

## @mentions

- `MentionTextarea.tsx` wraps a plain `<textarea>` with `@`-triggered autocomplete against an organisation's member list (`getOrganisationMembers`). Selecting a member inserts a `@[Display Name](userId)` token — the backend's `notifications/services.py::extract_mentioned_user_ids` parses exactly this shape, so keep the two in sync if the format ever changes.
- Originally used only in comments (`MentionTextarea` inside `IssueCardParts.tsx`'s comment box). Now also used for **Title** and **Description** on the new-issue form (`NewIssueForm` in `page.tsx`), so mentioning a teammate at issue-creation time works the same way it does in comments.
  - Title uses `rows={1}` (still a real `<textarea>`, so Enter inserts a newline rather than submitting — same behaviour as before, since the plain `<input>` it replaced had no submit-on-Enter wired either).
  - Description keeps its existing paste-a-screenshot handler (`onPaste={handlePaste}`), passed straight through to `MentionTextarea`.
  - Both pass `organisationId ?? ""` since the form's `organisationId` state is `number | null` — `MentionTextarea` no-ops on a falsy `organisationId` until one is selected.
- Notification side (see "Known issues / active work" below): mentions are parsed and stored, but there's currently no notification generated for a mention placed in an issue's *title/description* — only `notify_mentions` on comments is wired up. Extending `notify_mentions`-equivalent handling to issue create/update is still open.

## Comments

- Text + optional single image per comment (`snapshot`).
- `@mention` autocomplete via `MentionTextarea` (needs `organisationId` to scope the member list).
- Sort toggle (newest/oldest), "show all" beyond the first 3.
- Edit/delete restricted to the comment's author (`isCommentAuthor`, matched against email/full name/username/display name — see `isUserMatch` / `isUserCreator` in `page.tsx` and `IssueDetailPage`).
- All four mutating actions (save edit, resolve, add comment, edit comment) are double-submit-guarded with a `useRef` lock (synchronous, survives double-clicks before React re-renders) plus a paired `useState` to drive the UI (disabled buttons, "Saving…"/"Posting…"/"Resolving…" text).

### Relative comment timestamps

`formatCommentTime()` in `IssueCardParts.tsx` renders comment times (and issue created/updated, and screenshot-history captions) as:

- `< 1 min` → "just now"
- `< 1 hr` → "Xmin ago"
- same calendar day → "Xh ago"
- yesterday → "Yesterday, HH:MMhrs"
- older → "12Jan2026,13:00hrs"

Full local datetime is in the `title` attribute on hover.

## Screenshots / attachments

- BIM issues: one viewpoint snapshot (camera position/direction/up/FOV + clipping planes + snapshot image), stored on `IssueViewpoint`.
- Design issues: `attachments[]` (file/URL) — no longer domain-restricted; `category` field was removed in favor of this being the sole ad-hoc attachment mechanism.
- Every upload site (main issue screenshot, add-comment, resolve panel, edit-comment) goes through the shared `ScreenshotDropzone` component: click to browse, drag-and-drop, or paste (Ctrl/Cmd+V) — all three, in the same control, everywhere.
- Upload/save-in-flight feedback: `ScreenshotDropzone` shows a spinning `ti-loader` icon + "Processing…" while an image is being read/validated; Confirm Resolve / Post Comment / Save show the same spinning icon with "Resolving…" / "Posting…" / "Saving…" while the request is in flight (`.ti-loader` spin animation lives in `issues.css`, respects `prefers-reduced-motion`).
- `ScreenshotHistory` collects every comment snapshot into a collapsible strip on the issue.

## Linked drawings

- Issues can link to one or more `DrawingDocument`s via a `linked_documents` M2M.
- View mode: chips that open the drawing (`onOpenDrawing`, opens `/drawing?openDoc=<id>` in a new tab by default); creator gets an inline unlink (×) button per chip without entering full edit mode.
- Edit mode: full link/unlink editor scoped to the issue's project.

## List page (`page.tsx`)

- Server-side pagination (`getIssuesPaginated`, `PAGE_SIZE = 10`) — the stats strip hits a **separate** `/stats/` endpoint scoped the same way as the list (org/project/domain/deliverable) but *not* filtered by the active stat chips or search, so chip counts don't collapse to just the active chip.
- Stat chips (Open / In Progress / Resolved / Low / Medium / High) are multi-select, OR'd within a group (status vs. priority), AND'd across groups, and drive `status_in`/`priority_in` server params.
- Organisation → Project → Deliverable filter cascade, plus a debounced free-text search and a sort control (created/updated × newest/oldest).
- Filters persist to `sessionStorage` (`issues-filters-v1`) so navigating to an issue and back — or hitting browser back — restores the exact filter state. Cascade-clearing effects compare against the *previous* value (via a ref), not a one-shot boolean, so they survive React 18 Strict Mode's double-invoke on mount without wiping a restored child filter.
- Each `IssueCard` now shows the linked **project name** as a meta chip (see "Data model" and "IssueCard" below) — no extra request per card; it rides along on the existing list payload.
- The new-issue form's Title and Description fields use `MentionTextarea` instead of a plain `<input>`/`<textarea>`, so `@`-mentioning a teammate works at creation time (see "@mentions" above).

## IssueCard (`IssueCard.tsx`)

Compact list row. Meta-row order (left to right): domain badge → classification badge → "(You)" owner badge → module chip → **project name chip** (`ti-folder` icon, from `issue.projectName`) → organisation chip → priority badge → status badge → assignee chip → due-date chip → comment count → linked-drawing chips → "+N more".

## Detail page (`[id]/page.tsx` + `IssueDetail.tsx`)

- Fetches the single issue; 403 shows an access-denied message (no redirect loop, since the user *is* authenticated — just not permitted); 404/other errors show a retry-friendly banner.
- `IssueDetail` owns all the edit-mode state (title/description/status/ priority/assignee/due date, org/project/deliverable rescope, linked drawings, screenshot) and calls back up to the page for every mutation (`onSave`, `onResolve`, `onAddComment`, etc.) — the page re-fetches after each to stay in sync.
- Share button: `navigator.share` on mobile/modern browsers, clipboard fallback otherwise, with a "Copied!" confirmation state.

## Design system (`issues.css`)

Everything is scoped under `.issues-page`, which defines CSS custom properties consumed by the rest of the file:

- **Palette**: warm paper background (`--paper`), blueprint-blue accent (`--blue` / `--blue-deep`), muted status colors (`--green`/`--amber`/ `--red`), all with light "tint" variants for hover/active backgrounds.
- **Type**: `--font-display` (Space Grotesk) for everything, `--font-mono` (IBM Plex Mono) for technical labels — IDs, stat labels, timestamps — standing in for blueprint annotations.
- **Spacing**: `--sp-1` (4px) through `--sp-8` (40px).
- **Radius**: two tokens only — `--radius` (6px, most things) and `--radius-pill` (badges/chips).
- Hover states are border-color/background-tint transitions, not shadow lifts; the one animated element (`stat-card-urgent`) is a static red rail, not a pulsing glow. `.ti-loader` is the only element that actually animates (spin), and it's disabled under `prefers-reduced-motion`.
- Class names were kept identical to the original file throughout the redesign — this is a drop-in stylesheet swap, no TSX changes required.
- `mentionTextarea.css` is a separate, small stylesheet (not scoped under `.issues-page`) for the `@`-mention dropdown (`.mention-suggestions`, `.mention-suggestion-name`/`-email`) and the rendered mention chip (`.mention-chip`).

## Known issues / active work

- **Bug**: toggling "show deleted" issues on the list page has no visible effect despite the count displaying correctly. Likely cause: the domain tab filter conflicting with the deleted toggle. Not yet fixed.
- **Planned**: notification system — notify all org members on issue creation, `@mention` tagging in comments (autocomplete already built; the notification side isn't), priority notification on resolution, read/unread state, deep link to the issue, ability to delete notifications.
  - `notificationApi.ts` now exists and covers list/unread-count/ mark-one-read/mark-all-read/delete/delete-all-read against `/notifications/...` — but nothing in the UI calls it yet (no bell icon / dropdown wired up).
  - `@mentions` typed into a new issue's Title/Description are parsed by the same backend token format as comments, but there's no `notify_mentions`-equivalent call on issue create/update yet — so mentioning someone when *creating* an issue does not currently notify them (only mentioning them in a *comment* does).

## Gotchas worth remembering

- `convertToDjangoPayload` only includes `classification`/`allowedRoles`/ `sharedWith` in a PATCH when they're **explicitly set** on the patch object — never pulled in implicitly — so a plain member's normal edit can't accidentally clear access fields, and the backend's admin-only check on those fields only fires when they're actually being changed.
- `/issues/issues/` returns a DRF-paginated envelope (`{count, next, previous, results}`), not a bare array — `unwrapListResponse()` handles both shapes defensively.
- BIM viewpoint clearing goes through `viewpoint.clear_snapshot: true` rather than sending an empty snapshot, to disambiguate "no change" from "remove the existing snapshot" in a PATCH.
- Screenshot-only PATCHes must **not** include `domain`, or the backend's domain validation rejects them (this was a real 400 bug — see `convertToDjangoPayload`'s `includeDomain` param).
- `projectName` is read-only on the frontend — it's derived from `project_name`/`project_details.name` on the way *in* from Django, and is never sent back out in `convertToDjangoPayload`. Changing an issue's project still goes through `project`/`project_id`; `projectName` just follows along on the next fetch.
- `MentionTextarea`'s inserted token format — `@[Display Name](userId)` — is a hard contract with the backend's `extract_mentioned_user_ids`. If you ever change how mentions render or are inserted client-side, check that parser first, or mentions will silently stop notifying anyone.