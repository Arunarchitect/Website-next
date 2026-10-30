# Course module — Frontend (Next.js)

Public course pages and a staff-only course editor, built on the Django `opencourse` API (see the backend README).

- Next.js 15 (App Router, Turbopack), React, TypeScript
- Fonts: Space Grotesk (display) and IBM Plex Mono (mono) via `next/font/google`
- Styling: scoped CSS (`<style>` blocks per page, plus `adminedit.css` for the editor). No Tailwind in these pages.

---

## 1. Folder layout

```
app/course/
├─ page.tsx                       Course index (server component)
├─ types.ts                       Shared types: content blocks, references, Course/Module/Chapter
├─ api/
│  ├─ courseApi.ts                Public read API + pure helpers
│  └─ adminApi.ts                 Staff API (list/get/save), editable model, payload builder
├─ components/
│  ├─ ChapterContent.tsx          Renders ContentBlock[] + references
│  ├─ VideoPlayer.tsx             Video + subtitles
│  └─ CertificateVerifier.tsx     Certificate lookup widget on the index page
├─ [courseSlug]/
│  ├─ page.tsx                    Course overview (CLIENT component)
│  └─ [chapterSlug]/page.tsx      Chapter page (server component)
└─ adminedit/
   ├─ page.tsx                    Staff editor (client component)
   ├─ editors.tsx                 Reusable form pieces (blocks, references, subtitles, inline markup)
   ├─ aiJson.ts                   Export/import JSON for AI enhancement
   ├─ AiJsonTools.tsx             Toolbar buttons + paste modal for the above
   └─ adminedit.css               Editor styles
```

`VideoPlayer.tsx` and `CertificateVerifier.tsx` were not part of the files reviewed when this README was written. Check them directly before changing them.

**Routing note:** `/course/adminedit` is a static segment and wins over `[courseSlug]`. That is why the backend rejects `adminedit` as a course slug.

---

## 2. Environment

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Django base URL. Both API clients append `/api/opencourse`. |

The backend must allow CORS from the frontend origin, including the `Authorization` header for the admin editor.

---

## 3. Data flow

### Public pages

| Page | Fetches | Notes |
|---|---|---|
| `/course` | `getCourses()` | Uses `totalChapterCount` for the card meta. |
| `/course/[courseSlug]` | `getCourseBySlug()` | Client component. Reads `params` in a `useEffect`. Shows preface, modules, progress. |
| `/course/[courseSlug]/[chapterSlug]` | `getCourseBySlug()` **and** `getChapterContent()` in parallel | See the gotcha below. |

All fetches use `cache: "no-store"` (progress is per user, and editor changes should show immediately).

### ⚠ Outline vs. full chapter (important)

The course endpoint returns an **outline**: chapters **without `content` and `references`** (the backend defers those fields for speed). The chapter page therefore needs two calls:

- the outline (`getCourseBySlug`) for navigation, module label and progress;
- the full chapter (`getChapterContent`) for `video`, `content`, `references`.

The page merges them (`{ ...outlineChapter, ...detail }`). If you add a new chapter field that the outline omits, read it from the detail response. Reading it from the outline is the bug that previously made every chapter look like "text/notes only".

### Auth (public side)

Progress (`completed`) is computed by the backend per authenticated user. The frontend only reads it. Marking a chapter complete or incomplete is a separate backend endpoint. The component that calls it was not part of the files reviewed.

---

## 4. Content model (`types.ts`)

A chapter body (and each preface section) is a `ContentBlock[]`:

| Block `type` | Fields |
|---|---|
| `heading` | `level` (2 or 3), `text`, optional `id` (anchor) |
| `paragraph` | `runs: InlineRun[]` |
| `list` | `ordered?`, `items: InlineRun[][]` |
| `callout` | `variant?` (`note`, `tip`, `warning`), `title?`, `runs` |
| `image` | `src`, `alt`, optional `caption`, `source`, `width`, `height` |
| `divider` | none |

Inline runs (`InlineRun`):

| Run `type` | Fields |
|---|---|
| `text`, `bold`, `italic`, `highlight`, `code` | `text` |
| `link` | `text`, `href` |
| `ref` | `refId`, which points to a `Reference.id` in the same chapter or preface |

References: `{ id, style?: "apa" | "mla", text, url? }`. Citation numbers `[1]`, `[2]` follow the **order of the references array**. A `ref` run with an unknown id renders nothing.

### Adding a new block type (checklist)

1. `types.ts`: add it to `ContentBlock`.
2. `components/ChapterContent.tsx`: render it.
3. `adminedit/editors.tsx`: add it to `BLOCK_TYPES`, `newBlock()` and `BlockBody()`.
4. `adminedit/aiJson.ts`: add it to `BLOCK_TYPES`, `checkBlocks()` and the `INSTRUCTIONS` text.
5. **Backend** `models.py`: add it to `BLOCK_TYPES`, otherwise saving fails validation.

---

## 5. Staff editor (`/course/adminedit`)

Access: the API must return 200 for the staff endpoints (Django `is_staff` user). A 401 or 403 shows "Staff only".

### How auth works

`adminApi.ts` reads the token from `localStorage` (tries `access`, `accessToken`, `access_token`, `token`) and sends `Authorization: <AUTH_SCHEME> <token>`.
**`AUTH_SCHEME` is `"Bearer"`.** Change it to `"JWT"` if your Djoser setup uses that. Keep both settings in step with the rest of the app.

### Editing model

- `AdminCourse` → `AdminModule` → `AdminChapter`. Each node has a client-only `_key` (stable React key) and an optional server `id`.
- **No `id` = new item** (created on save). Items with an `id` are updated in place, so learner progress is kept.
- Order comes from **array position**. Use the ▲ ▼ buttons. The backend renumbers on save.
- Slugs auto-follow titles **only for unsaved items**. Changing the slug of a saved item changes its URL.
- Validation before save (client-side): required titles and slugs, slug charset (`letters, digits, - _`), max 50 chars, no duplicate module slugs, and chapter slugs unique across the whole course.
- Removing a chapter or module and saving deletes it and its learner progress. There is **no delete-course button** by design; only "Discard new course" for an unsaved new course.

### Toolbar and shortcuts

| Action | Shortcut |
|---|---|
| Save | `Ctrl/Cmd + S` |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` |

### Undo / redo (how it works)

- `courseRef` is the source of truth for edits; React state is only for rendering.
- Each `edit(fn)` clones the course, applies `fn`, and pushes the previous version to the `past` stack.
- Edits within **800 ms** (`COALESCE_MS`) merge into one step, so typing a sentence is one undo step.
- Max **100** steps (`MAX_HISTORY`).
- A redo stack is cleared by any new edit.
- After undo or redo, "Unsaved changes" is recomputed by comparing against the last saved JSON.
- If undo removes the selected module or chapter, the selection falls back to Course settings.
- **Save clears history.** The server returns new ids, and restoring older snapshots would create duplicates.
- The raw-JSON textareas (class `ae-raw`) keep the browser's native undo.

### Inline markup in text boxes

Paragraphs, list items and callouts are edited as text and converted to runs:

```
**bold**  *italic*  ==highlight==  `code`  [text](https://url)  {{ref:reference-id}}
```

Use `\` to escape special characters. The conversion lives in `editors.tsx` (`markupToRuns` / `runsToMarkup`).

### AI JSON workflow (`aiJson.ts`, `AiJsonTools.tsx`)

1. Select a chapter, then click **⧉ Chapter JSON** (or **⧉ Course JSON**). It copies JSON including an `_instructions` field for the AI.
2. Give it to an AI. Ask for the **same structure back**.
3. Click **⇩ Paste AI JSON**, choose chapter or course scope, paste, and click **Apply to editor**.
4. Review, then **Save**.

Behaviour to know:

- ```` ```json ```` fences and text around the JSON are stripped.
- Validation runs as a dry run on a copy; on error nothing changes in the editor.
- **Matching is by slug.** Existing slugs are never changed. Unknown module or chapter slugs are **added as new**.
- Items missing from the pasted JSON are **not deleted**. Reordering is **not** applied.
- Chapter scope accepts either `{ "scope": "chapter", "chapter": {...} }` or a bare chapter object.
- Course scope also replaces the preface (if a non-empty one is provided).
- The JSON is only checked structurally (block types, required fields). It does not check that `ref` ids exist, so check references after importing.

---

## 6. Page layout conventions

- Index and overview pages "break out" of the global layout wrapper (`max-w-7xl` + `my-8`) with `width: 100vw; margin-left: calc(50% - 50vw); margin-top/bottom: -2rem`, and add `body:has(.page) { overflow-x: clip }` to avoid horizontal scroll. If you change `layout.tsx`, re-check these.
- The editor toolbar is `position: sticky; top: 0`. If the site navbar overlaps it, change `top` in `.ae-bar` (and `.ae-side` `top`).
- Design tokens are repeated as CSS variables on each page root: `--paper #F7F5EF`, `--ink #1E1E1A`, `--blue #2C5F8A`, `--blue-deep #17324A`, `--slate #6E6B62`, `--line #DFDACB`, `--green #2f7a4f`. `ChapterContent` relies on these being defined by its parent page.
- Editor classes are prefixed `ae-`. Chapter content classes are prefixed `cc-`.

---

## 7. Common problems

| Symptom | Cause / fix |
|---|---|
| Chapter shows "No video for this lesson — text/notes only" although data exists | Page is reading the outline. Make sure it calls `getChapterContent()` (section 3). Check `GET /api/opencourse/courses/<course>/chapters/<chapter>/` in the browser. |
| Build error: `Export BlocksEditor doesn't exist in target module` | `editors.tsx` accidentally contains the page code and imports itself. `editors.tsx` must only export the editor components; `page.tsx` imports from it. |
| "Staff only" screen although logged in | Token not found in `localStorage`, wrong `AUTH_SCHEME`, or the user lacks `is_staff`. |
| "Couldn’t reach the API" | Wrong `NEXT_PUBLIC_API_URL`, backend down, or CORS. |
| Save error mentions duplicate slug | Chapter slugs must be unique across the **whole course**, not only within a module. |
| Save error "block N: missing or invalid 'type'" | A block has a type the backend does not allow (section 4 checklist). |
| AI import says "slug required" | The AI removed or renamed slugs. Re-run with the instructions kept intact. |
| Undo does nothing after saving | Expected: history is cleared on save. |

---

## 8. Local development

```bash
npm install
# .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Public pages: `/course`. Editor: `/course/adminedit` (log in as a staff user first).