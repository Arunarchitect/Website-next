# Schedule Component — Developer README (Next.js frontend)

A complete reference for the Modelflick Project Work Schedule viewer/editor (`app/schedule`). Covers architecture, data model, every module, key algorithms (CPM, rollup, auto-schedule, working-day math, baseline/actual), the Django sync layer, the project picker, UI features, and extension points.

Backend counterpart: `schedule_django_readme.md`.

---

## 1. Overview

This is a **dependency-aware construction schedule** built as a Next.js 15 App Router page. It renders a full **Gantt chart** plus an **editable table**, computes the **critical path** using CPM, supports an optional **working-day calendar** (weekends + holidays + shutdown ranges), highlights **Now / Next** activities, tracks **planned vs baseline vs actual**, and supports full **CRUD** on activities and their hierarchy.

All scheduling logic (CPM, rollup, auto-schedule, calendar math, variance) runs **client-side**. Persistence is handled by a **Django REST backend**: the page loads the selected schedule and **autosaves** the whole document (debounced) with optimistic locking.

Key capabilities:

- **Org → Project → Schedule picker**; the selection is mirrored into the URL (`?project=&schedule=`)
- Hierarchical work breakdown (phases → activities), collapsible
- Editable table (name, dates, duration, %, actual dates, variance, predecessors, successors)
- Full-screen editor modal for a single activity (incl. baseline + actual dates)
- Row action menu (edit / add child / add sibling / move into / delete)
- Dependency editing (FS / SS / FF / SF with lag)
- CPM with early/late starts, total float, and critical-path highlighting
- **Working-day mode** with a configurable calendar (weekly off, holiday dates, shutdown ranges)
- Automatic **rollup** of group rows from their children (dates, %, baseline, actual)
- **Auto-schedule** — pushes successors later when a link is violated
- **Baseline & actual** — "Set baseline" freezes the plan; the % slider auto-fills actual dates; grey/green/orange bars on the Gantt; **Var** column
- **Compare** panel — baseline vs planned, start/finish variance, project slip
- **Now / Next** strip with a countdown chip and a queue stepper
- **Search** — jump-to-task, expands ancestors, flashes the row
- **Print / PDF** export via `window.print()`
- **JSON import / export**, **Copy JSON**, **Copy for AI**
- Responsive Gantt zoom (elastic fit-to-width + manual zoom)
- **Autosave to Django** with a status badge (Saved / Saving / Unsaved / Out of date …)
- **Conflict detection** (409) when another tab/user saved first
- **Read-only mode** for users without edit rights (currently: clients)

---

## 2. File layout

```
app/schedule/
├── data.ts                 ← Types + demo/seed schedule (tasks, sequences), helpers
├── calendar.ts             ← Pure working-calendar math (defines DAY)
├── scheduling.ts           ← Pure date/hierarchy/baseline helpers (no React)
├── cpm.ts                  ← CPM math + Now/Next + format helpers (no React)
├── api.ts                  ← fetch wrapper + typed Django endpoints (no React)
├── useScheduleSync.ts      ← Load / seed / debounced autosave / conflict hook
├── SyncBadge.tsx           ← Save-status chip + Retry / Reload buttons
├── page.tsx                ← Main page: picker, Gantt, table, wiring, state
├── SearchAct.tsx           ← Searchable jump-to-task dropdown
├── PrintAct.tsx            ← Print / Save-as-PDF button + print stylesheet
├── CalendarUI.tsx          ← Calendar UI (button + modal + chips)
├── ActivityEditor.tsx      ← Edit modal + row action menu
├── BaselineCompare.tsx     ← Baseline vs planned comparison modal
├── ScheduleImport.tsx      ← Upload a .json file → POST /schedules/<id>/import/
├── ScheduleExport.tsx      ← Download JSON / Copy JSON / Copy for AI
└── README.md               ← This file
```

**Dependency direction** (nothing imports from `page.tsx`, and there are no cycles):

```
calendar.ts        ← defines DAY; no imports from the app
    ▲
    ├── scheduling.ts    (imports DAY + holiday helpers)
    ├── cpm.ts           (imports from calendar + scheduling, re-exports DAY)
    ├── CalendarUI.tsx   (imports from calendar + cpm + scheduling)
    ├── BaselineCompare.tsx (imports from scheduling)
    │
data.ts  ◄── api.ts ◄── useScheduleSync.ts ◄── page.tsx  (imports from everything, plus UI components + SyncBadge)
```

- **Pure modules**: `calendar.ts`, `scheduling.ts`, `cpm.ts`, `api.ts` — no React, no DOM state. The first three are unit-testable in Node.
- **UI modules**: `page.tsx` + the components above. All schedule state lives in `page.tsx`; children are presentational.
- **Sync module**: `useScheduleSync.ts` owns *only* the server round-trip (ids, versions, status). It does not own the schedule data; `page.tsx` does.
- **`DAY` lives in `calendar.ts`** and is re-exported by `cpm.ts`.

---

## 3. Data model (`data.ts`)

Field names mirror **IFC4x3** so a later import/export is a 1:1 mapping. They are also exactly the JSON field names the Django API sends and expects (camelCase) — no mapping layer.

### `Task`

| Field | Type | IFC equivalent | Notes |
|---|---|---|---|
| `id` | string | `IfcTask.GlobalId` | Stable, unique, **client-generated**. e.g. `a-plast`. Stored server-side as `task_id` |
| `name` | string | `IfcTask.Name` | Display name |
| `parentId` | string \| null | `IfcRelNests` | Null = top-level |
| `scheduleStart` | `YYYY-MM-DD` | `IfcTaskTime.ScheduleStart` | Current **planned/forecast** start. Inclusive |
| `scheduleFinish` | `YYYY-MM-DD` | `IfcTaskTime.ScheduleFinish` | Current planned/forecast finish. Inclusive. Server rejects finish < start |
| `baselineStart` | `YYYY-MM-DD \| null` (optional) | — (BASELINE work schedule) | Frozen plan. Set by "Set baseline" |
| `baselineFinish` | `YYYY-MM-DD \| null` (optional) | — | Frozen plan |
| `actualStart` | `YYYY-MM-DD \| null` (optional) | `IfcTaskTime.ActualStart` | What really happened |
| `actualFinish` | `YYYY-MM-DD \| null` (optional) | `IfcTaskTime.ActualFinish` | What really happened |
| `completion` | 0–100 | `IfcTaskTime.Completion` | Percent |
| `isMilestone` | boolean | `IfcTask.IsMilestone` | Single-day marker |
| `remarks` | string? | — | Free text, shown on Now/Next |
| `workCode` | string? | — | Source code, e.g. `"7-9"` |
| `linkedElements` | string[]? | `IfcRelAssignsToProcess` | Reserved for future |

The four baseline/actual fields come back as `null` from the server when unset and are optional when sending.

### `Sequence`

| Field | Type | IFC equivalent | Notes |
|---|---|---|---|
| `id` | string | `IfcRelSequence.GlobalId` | Unique |
| `relatingTask` | string | `RelatingProcess` | Predecessor |
| `relatedTask` | string | `RelatedProcess` | Successor |
| `sequenceType` | `FINISH_START` \| `START_START` \| `FINISH_FINISH` \| `START_FINISH` | `SequenceType` | |
| `lagDays` | number | `IfcLagTime` | Negative = lead |

### `WorkSchedule`

```ts
{
  name: string;
  predefinedType: "BASELINE" | "PLANNED" | "ACTUAL";
  tasks: Task[];
  sequences: Sequence[];
}
```

`predefinedType` is a **label only** (see §8 "Planned vs baseline vs actual"). The page always creates schedules as `PLANNED`.

### `demoSchedule` is only a **seed**

`data.ts` exports `demoSchedule` (the SREEKESH programme). `page.tsx` starts with empty `tasks` / `sequences` and fills them from the server. `demoSchedule` is used for:

1. **First-time seeding:** if the selected project has **no schedule** on the server and the user can edit, the hook creates one and uploads `demoSchedule` (+ a default calendar). **Opening an empty project as an editor seeds it with the demo data.**
2. The fallback page heading (`demoSchedule.name`) when no server name is available. The normal heading is the selected schedule's name, then the project name.

After seeding, edits to `data.ts` have **no effect** on an existing server schedule.

### Reference date

`data.ts` uses a hardcoded reference of **2026-10-02**. Tasks whose `scheduleFinish` is earlier are auto-completed (`completion: 100`) **when the seed is built**. Afterwards the stored `completion` values are authoritative.

---

## 4. `calendar.ts` — pure working-calendar math

No React, no DOM. **The lowest-level module — it defines `DAY` and imports nothing from the app.**

### Types

```ts
export interface HolidayDate { id: string; name: string; date: string; }
export interface CalendarRange { id: string; name: string; start: string; end: string; }
export interface WorkingCalendar {
  weekly: Set<number>;   // 0=Sun … 6=Sat — always non-working
  dates: HolidayDate[];  // specific single-day holidays
  ranges: CalendarRange[]; // inclusive shutdown ranges
}
export interface SerializedCalendar { weekly: number[]; dates: HolidayDate[]; ranges: CalendarRange[]; }
```

### Exports

| Export | Signature | Purpose |
|---|---|---|
| `DAY` | `86400000` | Milliseconds per day (single source of truth) |
| `emptyCalendar` | `() => WorkingCalendar` | Default: Sat + Sun off, no dates, no ranges |
| `serialize` / `deserialize` | `WorkingCalendar ⇄ SerializedCalendar` | JSON-safe form — **the wire format sent to / received from Django** (`Set` → array) |
| `isHoliday` | `(dayNumber, cal) => boolean` | Any rule match → holiday |
| `isWorkday` | `(dayNumber, cal) => boolean` | Inverse of `isHoliday` |
| `countWorkdays` | `(startISO, finishISO, cal) => number` | Working days in an inclusive range |
| `nextWorkday` | `(startISO, cal) => string` | First working day at/after a date |
| `prevWorkday` | `(startISO, cal) => string` | Last working day at/before a date |
| `addWorkdays` | `(startISO, n, cal) => string` | Date that is `n` working days after `start` |

**Rule priority:** a day is non-working if it matches **any** of weekly / specific dates / ranges. **Guards:** `nextWorkday` / `prevWorkday` stop after 400 iterations.

---

## 5. `scheduling.ts` — pure date, hierarchy & baseline helpers

No React, no DOM. **Imports `DAY` and holiday helpers from `calendar.ts`.**

| Export | Signature | What it does |
|---|---|---|
| `toDay` | `(iso) => number` | ISO date → day number |
| `toISO` | `(day) => string` | Day number → ISO date |
| `addDays` | `(iso, n) => string` | Shift ISO date by `n` calendar days |
| `durationDays` | `(task) => number` | Inclusive calendar duration (planned dates) |
| `todayISO` | `() => string` | Local today as ISO |
| `flatten` | `(tasks, collapsed) => Row[]` | Tree → visible rows with depth + WBS |
| `descendantIds` | `(tasks, id) => Set` | All descendants |
| `ancestorIds` | `(tasks, id) => Set` | All ancestors |
| `rollup` | `(tasks) => Task[]` | Group dates/%/baseline/actual derived from children |
| `autoSchedule` | `(tasks, seqs) => Task[]` | Forward pass; push successors later |
| `wouldCycle` | `(seqs, pred, succ) => boolean` | Cycle check |
| `setDuration` | `(task, newDays) => Task` | Change days; shifts finish by **calendar** days |
| `durationWorkdays` | `(task, cal?) => number` | Working-day duration (falls back to calendar) |
| `setDurationWithCalendar` | `(task, newDays, cal?) => Task` | Change days; shifts finish by **working** days |
| `hasHolidayInside` | `(task, cal) => boolean` | True if the span touches a holiday |
| `setBaseline` | `(tasks) => Task[]` | Copy every task's planned dates into `baselineStart/Finish` (overwrites) |
| `finishVariance` | `(task) => number \| null` | Days late (+) / early (−) vs baseline finish. Uses `actualFinish` once finished, else `scheduleFinish`. `null` = no baseline |
| `applyProgress` | `(task, pct, today) => Task` | Set `%` and keep actual dates in step (see below) |

### `flatten` — row model

```ts
interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
  wbs: string;   // "1", "1.2", "1.2.3"
}
```

The Gantt left column, table, and selection all operate on `Row[]`. **Sibling order = array order** in `tasks`; the server preserves it via an `order` column.

### `rollup` — summary tasks

Group rows (any task that has children) get:

- `scheduleStart` = earliest child start; `scheduleFinish` = latest child finish
- `completion` = duration-weighted average of children; `isMilestone = false`
- `baselineStart` / `baselineFinish` = earliest / latest child baseline (null if no child has one)
- `actualStart` = earliest child actual start
- `actualFinish` = latest child actual finish, **only once every child has an actual finish**, else null

Called before every render of `rolled`. **Group dates are not editable** — only leaves. Stored group values are overwritten on render, so stale values on the server are harmless.

### `applyProgress` — actual dates follow the % slider

| Change | Effect |
|---|---|
| % goes above 0 | `actualStart = today` if empty |
| % reaches 100 | `actualFinish = today` if empty (never earlier than `actualStart`); `actualStart` filled if missing |
| % drops below 100 | `actualFinish` cleared |
| % back to 0 | `actualStart` and `actualFinish` cleared |

"Today" is the browser's local date. There is no status-date input yet (the backend stores `statusDate`, the frontend does not use it).

### `autoSchedule` — forward pass

Iterative forward pass over the sequence list, repeated until stable (bounded by `tasks.length + 1`). For each violated link, pushes the successor's start later (never earlier). Respects all four sequence types + lag. It only moves **planned** dates; baseline and actual are preserved.

### `wouldCycle` — safety

DFS from `successor` following outgoing links. If it reaches `predecessor`, the link would create a cycle. (The server does **not** check dependency cycles — this is the only guard.)

---

## 6. `cpm.ts` — critical path & Now/Next

No React. **Imports from `data.ts`, `scheduling.ts`, `calendar.ts`; re-exports `DAY`.**

### `computeCpm(tasks, seqs) → CpmResult`

Full **forward pass + backward pass** over the **leaf tasks** (groups are ignored — they inherit from children). Uses **planned** dates only (baseline/actual are not used).

```ts
interface CpmResult {
  earlyStart:   Map<id, number>;
  earlyFinish:  Map<id, number>;
  lateStart:    Map<id, number>;
  lateFinish:   Map<id, number>;
  totalFloat:   Map<id, number>;
  criticalIds:  Set<id>;
  projectStart: number;
  projectFinish: number;
}
```

**Algorithm:**

1. Filter to leaves. Build `pred` / `succ` adjacency.
2. **Topological sort** (Kahn). If a cycle survives, fall back to insertion order.
3. **Forward pass**: `ES = max(manualStart, constraint from each predecessor)`, then `EF = ES + dur - 1`.
4. **Backward pass** (reverse topo): `LF = min(constraint from each successor)`, else `projectFinish`. `LS = LF - dur + 1`.
5. **Total float** = `LS - ES`. Any task with `float ≤ 0` → **critical**.

A task's **manual start date** acts as a floor: links can only push work later, never pull it earlier.

### Sequence-type constraint math

| Type | Forward: `ES_successor ≥` | Backward: `LF_predecessor ≤` |
|---|---|---|
| `FINISH_START` | `EF_pred + 1 + lag` | `LS_succ - 1 - lag` |
| `START_START` | `ES_pred + lag` | `LS_succ - lag + dur_pred` |
| `FINISH_FINISH` | `EF_pred + lag - dur_succ` | `LF_succ - lag` |
| `START_FINISH` | `ES_pred + lag - dur_succ` | `LF_succ - lag + dur_pred` |

### `computeCpmWorkdays(tasks, seqs, cal) → CpmResult`

Snaps every leaf to the working calendar, runs `computeCpm`, converts float to working days. **Deliberately simplified**: correct critical-path membership and reasonable float, but not a full working-day backward pass.

### Other exports

| Export | Purpose |
|---|---|
| `findCurrentAndNext(tasks, cpm, todayDay)` | The single "current" and "next auto" task |
| `upcomingQueue(tasks, cpm, todayDay)` | All leaves with `ES > today`, sorted. Drives the Next-up stepper |
| `daysUntil(task, cpm, todayDay)` | Days from today → task start (0 = today) |
| `humanizeDaysUntil(d)` | "today" / "tomorrow" / "in 5 days" / "next week" / … |
| `fmtDate(dayNumber)` | `"02 Oct 2026"` |
| `describe(task, tasks)` | One-line description for the Now/Next cards |
| `DAY` | Re-exported from `calendar.ts` |

---

## 7. Backend sync layer

### 7.1 `api.ts`

Thin typed `fetch` wrapper around the Django endpoints. No React.

| Export | Endpoint |
|---|---|
| `listMyProjects()` | `GET /api/schedules/projects/` → `MyProject[]` (feeds the picker) |
| `listSchedules(projectId)` | `GET /api/schedules/?project=<id>` → `{ canEdit, results[] }` |
| `getSchedule(id)` | `GET /api/schedules/<id>/` → `ScheduleDoc` |
| `createSchedule(project, name)` | `POST /api/schedules/` (always `PLANNED`) |
| `saveSchedule(id, { version, tasks, sequences, calendar })` | `PUT /api/schedules/<id>/` → `{ version, updatedAt }` |
| `ApiError` | Thrown for non-2xx; has `.status` and `.body` |

```ts
interface MyProject {
  id: number; name: string; clientName: string; organisation: string;
  isCompleted: boolean; role: "admin" | "manager" | "member" | "client";
  canEdit: boolean;
  schedules: { id: number; name: string; predefinedType: string; version: number }[];
}
```

- Base URL: `NEXT_PUBLIC_API_URL` (default `https://api.modelflick.com`), prefixed with `/api`.
- **Auth is in one place — `authHeaders()`.** It reads `localStorage["access"]` and sends `Authorization: JWT <token>`. Adapt to your scheme (`Bearer`, or `{}` for httpOnly cookies — `credentials: "include"` is always set).
- Error messages are extracted from DRF bodies (`detail`, `non_field_errors`, else JSON).
- `saveSchedule` does not send `statusDate` yet; the backend leaves the stored value unchanged when it is omitted.

### 7.2 `useScheduleSync.ts`

```ts
const sync = useScheduleSync({
  projectId, scheduleId, seed, tasks, sequences, calendar /* serialized */, onLoaded,
});
// → { status, canEdit, savedAt, message, saveNow, reload, setVersion, markSaved }
```

The hook does not hold the schedule data — `page.tsx` passes the current `tasks`/`sequences`/serialized `calendar` in, and receives the loaded data through `onLoaded`. If `scheduleId` is set it wins over `projectId`.

**Load flow (once per `scheduleId` / `projectId` change):**

1. **`scheduleId` given** (from the picker or URL): `getSchedule(scheduleId)` → remember `id` + `version` + `canEdit` → `onLoaded` → status `saved` (editable) or `readonly`.
2. **No `scheduleId`, no `projectId`:** status `empty`.
3. **`projectId` only:** `listSchedules(projectId)` → sets `canEdit`.
   - **No schedule exists:** if `canEdit` → `createSchedule` + `saveSchedule(seed)` and `onLoaded(seed)`; else status `empty`.
   - **Schedule exists:** `getSchedule(results[0].id)` → `onLoaded(...)`.
4. Orphan sequences (endpoints that no longer exist) are **pruned on load** with a console warning.
5. Server `calendar` of `null` leaves the page's default calendar in place.

**Save flow (debounced 1500 ms after any change):**

1. Compare current payload (with orphan sequences pruned) to `lastSaved` (key-sorted JSON). No change → nothing.
2. **Pre-flight** (`findPayloadProblem`): duplicate ids, missing dates, finish < start → status `dirty` with a message; **no request is sent**.
3. `PUT` with the remembered `version`. On success store the returned `version`.
4. If edits happened while the request was in flight (`queued`), flush again.
5. **409** → status `conflict` (autosave stops). **400** → status `error`, the exact payload is **paused** (not retried) until it changes. **Other error** → status `error` (retries on next change or via Retry).

**Status machine:**

| Status | Meaning | Autosave |
|---|---|---|
| `loading` | initial fetch / reload | off |
| `saved` | in sync | on |
| `dirty` | local changes waiting for debounce (or blocked by pre-flight) | on |
| `saving` | request in flight | on |
| `error` | last save failed (message shown) | on (retry on next change) |
| `conflict` | version mismatch (another tab/user saved) | **off** — user must Reload |
| `readonly` | loaded, no edit rights | off |
| `empty` | no schedule and cannot create | off |
| `failed` | load failed (auth/network/not found) | off |

**Out-of-band writes:** `setVersion(v)` adopts a version returned by a non-autosave write (JSON import). `markSaved(payload)` records a payload as saved without a `PUT`, so the page does not immediately re-save an import.

**Implementation details worth knowing:**

- **`stableKey()` compares key-sorted JSON.** Postgres `jsonb` reorders object keys; a naive compare would mark the page dirty forever.
- **Strict-mode guard (`startedFor` ref)** keyed on `scheduleId` / `projectId`; without it an empty project would create two schedules in dev.
- **`beforeunload` warning** while status is `dirty`, `saving` or `error`.
- **Refs, not state, for ids/versions/flags** so the debounced callback never closes over stale values.
- The first load is **not** treated as a change.

### 7.3 `SyncBadge.tsx`

Coloured chip with the status text (+ time of last save), **Retry** on `error`, **Reload** on `conflict` / `failed`, and the error message inline. Marked `data-print-hide`.

### 7.4 Conflict behaviour

Two tabs / users editing the same schedule: the second save gets 409 → badge shows **Out of date**. There is **no merge**; **Reload** discards local unsaved edits and fetches the latest. Restores or imports done through the API also invalidate open tabs.

### 7.5 Import / export

- **`ScheduleImport`** (editors only): uploads a `.json` file (same shape as `PUT`) to `POST /api/schedules/<id>/import/` as multipart `file`. The server forces the current version, so an import is always "replace what is there". On success the page replaces local state and calls `sync.setVersion` + `sync.markSaved`.
- **`ScheduleExport`**: Download/Copy JSON of the current tasks/sequences/calendar, and **Copy for AI** (a text rendering of the schedule). Available to everyone, including read-only users. Baseline and actual fields are included because they are part of `Task`.

---

## 8. `page.tsx` — the main page

The only file with **schedule React state**. Everything else is derived.

### Project picker

- On mount, `listMyProjects()` fills `myProjects`.
- If the URL has no `?project=`, the page picks the **first project that already has a schedule** (falling back to the first project) and its first schedule. This avoids landing on an empty project, and avoids an editor accidentally seeding demo data into one.
- `SchedulePicker` is three selects: organisation → project → schedule (the schedule select appears only when the project has more than one). Projects show `· read-only` when `canEdit` is false.
- A "mirror selection into the URL" effect rewrites the address bar with `history.replaceState` (no history entry), so links are shareable. `/schedule` becomes `/schedule?project=2&schedule=3`.
- The picker is also rendered in the **`empty`** and **`failed`** states so a user is never stuck on an empty project.
- `NEXT_PUBLIC_SCHEDULE_PROJECT_ID` is **no longer used** by the page.

### State

| State | Type | Purpose |
|---|---|---|
| `myProjects`, `pickerLoading`, `pickerError` | — | Project list for the picker |
| `projectId`, `scheduleId` | `number \| null` | Current selection (initialised from the URL) |
| `tasks` | `Task[]` | The whole task list (flat). **Starts empty; filled by `onLoaded`** |
| `sequences` | `Sequence[]` | The whole link list. **Starts empty; filled by `onLoaded`** |
| `collapsed` | `Set<string>` | Collapsed group ids |
| `zoom` / `autoFit` | `number` / `boolean` | Pixels per day / fit-to-width |
| `showLinks`, `showCritical` | `boolean` | Toggle dependency arrows / critical highlight |
| `showBaseline` | `boolean` | Toggle baseline + actual bars |
| `compareOpen` | `boolean` | Baseline compare modal |
| `picker`, `menuFor`, `editingId` | — | Open dependency picker / row menu / edit modal |
| `selectedId`, `flashId` | `string \| null` | Selected row / flashing row |
| `nextIdx` | `number` | Index into the upcoming queue |
| `containerW` | `number` | Container width (`ResizeObserver`) |
| `calendar` / `calendarOpen` | — | Holiday rules (stored on the server) / modal |
| `useWorkdays` | `boolean` | Working-day mode (session-only, not persisted) |

### Permission-related values

| Value | Derivation |
|---|---|
| `currentProject` | `myProjects.find(p => p.id === projectId)` |
| `isViewOnly` | `currentProject ? !currentProject.canEdit : false` — follows the server's `canEdit` (so it always matches `EDIT_ROLES`) |
| `readOnly` | `isViewOnly \|\| !sync.canEdit` |
| `ready` | `sync.status` not in `loading` / `empty` / `failed` — gates the `ResizeObserver` effect |
| `SEED` | `{ tasks: demoSchedule.tasks, sequences: demoSchedule.sequences, calendar: serialize(emptyCalendar()) }` |

### Hooks-before-return rule

`page.tsx` returns early for picker error/loading, no projects, no project selected, and sync `loading` / `empty` / `failed`. **Every hook (`useState`, `useMemo`, `useEffect`, the sync hook) must be declared above those early returns** (they sit right after the `links` memo). A hook added below them throws "rendered more hooks than during the previous render". Non-hook helpers and derived constants (`rangeFor`, `handleRowAction`, `hasBaseline`, `lateCount`, countdown classes) live below the gates.

### Read-only mode

When `readOnly`: hidden — row `⋯` menu, ✎ quick-edit, `+ New phase`, **Set baseline**, `Auto-schedule`, Import, Calendar button/modal, `+ predecessor` / `+ successor`, link `×`. Disabled — date inputs (planned and actual), duration input, % slider, link type/lag selects. Viewing, searching, zoom, print, **Compare**, Export and the Working-days toggle still work. This is **UI only**; the server returns 403 on writes from non-editors.

### Derived (memoized)

| Value | Derivation |
|---|---|
| `rolled` | `rollup(tasks)` |
| `rows` | `flatten(rolled, collapsed)` |
| `minDay, maxDay` | Min/max of all task dates |
| `cpm` | `useWorkdays ? computeCpmWorkdays(...) : computeCpm(...)` |
| `current, next` | `findCurrentAndNext(...)` |
| `upcoming` | `upcomingQueue(...)` |
| `fitZoom` | `(containerW - 24) / totalDays` |
| `months, weeks` | Header segments (labels + widths) |
| `links` | SVG path data for every arrow |
| `rowIndexById` | Map task id → row index (for link geometry) |

### Gantt layout

```
┌──────────────┬───────────────────────────────────────────────┐
│  LEFT_COL_W  │  scrollable timeline (ganttWidth px)          │
│  (256 px)    │                                                │
│  Task header │  ┌─── header: months (h-5) ────┐               │
│  (headerH)   │  ├─── header: weeks (h-5) ─────┤  ← shown when │
│              │  ├─── header: days (h-5) ──────┤    zoomed in  │
│  Task list   │  ├─── body (rows.length*28) ───┤               │
│  (rows)      │  │   grid / today / bars / links / bands       │
│              │  └───────────────────────────────┘               │
└──────────────┴───────────────────────────────────────────────┘
```

- **Row height** `ROW_H = 28` px.
- **Header height** `headerH = 20 × (1 + weekRow + dayRow) + 1`. **The left "Task" header and the right timeline header must both use `headerH`** (the number of header rows changes with zoom). A fixed left header makes bars drift away from their rows.
- **Planned bar** 12 px high, offset `+8` within the row.
- **Actual bar** 4 px high at `+3` (above the planned bar): green when on time, orange when it finished after the baseline, 70% opacity while in progress (runs to today).
- **Baseline bar** 4 px high, grey, at `+22` (below the planned bar).
- **Left column is outside the horizontal scroller** → stays fixed.

### Zoom levels & detail

`zoom` (px per day) drives thresholds:

| Zoom (px/day) | Month row | Week row | Day row | Day gridlines |
|---|---|---|---|---|
| `< 4` | ✅ | ❌ | ❌ | ❌ |
| `4 – 6` | ✅ | ✅ | ❌ | ❌ |
| `6 – 14` | ✅ | ✅ | ❌ | ✅ |
| `≥ 14` | ✅ | ✅ | ✅ (numbers at ≥ 12) | ✅ |

`autoFit` forces `zoom = fitZoom` on every resize. Manually moving the slider turns `autoFit` off.

### Holiday shading (working-day mode)

Weekend days → `bg-gray-50` / `bg-gray-100`. Holiday days → `bg-pink-50` / `bg-pink-100` (holiday wins). When working-day mode is off, only weekends are shaded.

### Dependency arrow geometry

Each link is an orthogonal path anchored to bar edges (x1 = right edge of predecessor for FS/FF, left for SS/SF; x2 = left edge of successor for FS/SS, right for FF/SF; y = row centre). Forward links: `M x1 y1 H midX V y2 H x2`. Backward links route via a lane above the successor row. **Critical links are drawn twice** (base SVG + a `z-20` overlay) so the red path is never hidden.

### Table columns

`⋯` · `#` (WBS) · Task · Start · Finish · Dur · Float · % · **Act. start** · **Act. finish** · **Var** · Predecessors · Successors · ✎.

- **Act. start / Act. finish**: date inputs (disabled for groups and read-only users). Editing clamps `actualFinish ≥ actualStart`.
- **Var**: `finishVariance(task)` — red `+Nd` late, green `−Nd` early, `0d` on baseline, `—` no baseline.

### Selection & flash

Clicking a row or bar sets `selectedId` (blue highlight in the left column, table and Gantt body). Search, the stepper and Compare also set `flashId` for ~2.2 s. Selecting a **group row** toggles its collapse.

### CRUD & baseline handlers (in `page.tsx`)

| Handler | Effect |
|---|---|
| `addChild(parentId)` | Create task, expand parent, open editor, select + flash |
| `addSibling(task)` | `addChild(task.parentId ?? null)` |
| `deleteTask(id)` | Recursive: removes task + descendants + touching sequences |
| `updateTask(id, patch)` | Shallow merge into one task |
| `moveTask(id, target)` | Re-parent; expands new parent; selects + flashes |
| `updateDates(id, start, finish)` | Direct set of both planned dates |
| `updateDuration(id, newDays)` | Uses `setDurationWithCalendar`; respects working-day mode |
| `updateCompletion(id, pct)` | `applyProgress` — sets % and auto-fills/clears actual dates |
| `updateActual(id, field, value)` | Sets `actualStart` / `actualFinish` (empty → `null`), clamps finish ≥ start |
| `setBaselineNow()` | After `confirm()`, `setBaseline` over all tasks (overwrites any existing baseline) |
| `handlePick(...)` | Adds a sequence (with `wouldCycle` check) |
| `updateSequence(id, patch)` | Edits type or lag |
| `removeSequence(id)` | Deletes one link |

All mutators use `setTasks(prev => …)` / `setSequences(prev => …)`. **They only change local state; the sync hook notices the change and autosaves.** There is no per-handler API call.

### Cascade cleanup on delete

All descendants removed; every sequence touching a removed id removed; `selectedId`, `flashId`, `picker`, `menuFor`, `editingId` cleared if they pointed at anything removed. (Destructive after confirm: the next autosave replaces the server copy. Server auto snapshots exist but there is no restore UI yet.)

### Header summary line

`<first date> → <last date> · N days total · N critical activities` plus ` · working-day mode`, ` · N late vs baseline` (only when a baseline exists), ` · view-only`.

---

## 9. `BaselineCompare.tsx` — baseline vs planned

`<BaselineCompare tasks onClose onJump? />` — pass the **rolled** task list so group rows carry derived dates. Opened from the header **Compare** button (visible to everyone).

**Definitions:** variance = planned date − baseline date, in days (+ = later than baseline). Compare uses **planned** dates only; it ignores actuals (the table's **Var** column is the one that uses `actualFinish`).

**Summary cards:** project finish (planned vs baseline) · project slip · late count · early count · unchanged (with "N shifted" for tasks that moved but still finish on time, and "N added after baseline"). A red line names the **biggest slip**.

**Table:** WBS · task · baseline start · planned start · start var · baseline finish · planned finish · finish var · duration Δ. Late rows are tinted. Controls: **Changed only** (default on) and **Sort by biggest slip**. Clicking a row calls `onJump` — the page expands ancestors, closes the modal and selects/flashes the row. With no baseline set, the modal says to use **Set baseline** first.

---

## 10. `CalendarUI.tsx` — working-calendar UI

### `<CalendarButton calendar onOpen />`

Small header button with a summary chip (`"2 weekly · 0 single · 1 ranges"`). Marked `data-print-hide`. Hidden in read-only mode.

### `<CalendarModal calendar onChange onClose />`

Full-screen modal with tabs **Weekly off** (chip toggle per weekday), **Specific dates** (date + optional name) and **Shutdown ranges** (start + end + name). Bottom: **Preview strip**, **Reset to default**, **Done**. Escape / backdrop close. Edits flow through `setCalendar` → `calendarSer` → autosave.

### `<CalendarChips calendar />`

Inline read-only chips: `Off: Sat, Sun` (gray), `N holidays` (amber), `N shutdowns` (orange), or "No holidays — every day is a working day".

---

## 11. `SearchAct.tsx` — jump-to-task

- Filters **leaves only** by name, work code, or id; up to 12 results sorted by start date.
- Keyboard: **↑/↓**, **Enter**, **Esc**.
- On pick: `onExpand(ancestorIds)` then `onSelect(id)`; the parent does the scroll-into-view + flash.

```ts
{ tasks: Task[]; onSelect: (id: string) => void; onExpand: (ids: string[]) => void; }
```

---

## 12. `PrintAct.tsx` — print / save as PDF

A button that calls `window.print()` plus a `<style jsx global>` for `@media print`: A4 landscape with 12 mm margins; hides anything with `data-print-hide` plus all `button`, `input[type=range]`, `input[type=checkbox]`; renders `input[type=date]` as plain text; tightens table padding and font; lets scroll containers expand. The user picks **Save as PDF** in the browser dialog.

`data-print-hide` is set on the header button cluster and the zoom bar. The Now/Next strip prints. **The table is wider now (Act. start / Act. finish / Var); check it on A4 landscape and tighten the print stylesheet if it overflows.**

---

## 13. `ActivityEditor.tsx` — edit modal + row menu

### `<ActivityEditorModal task tasks onSave onDelete onClose />`

Scrollable dialog (`max-h-[92vh]`) with fields: Name · Work code · Parent group (hides itself and its descendants) · **Planned** start/finish · **Baseline** start/finish (grey panel; normally set in bulk with "Set baseline") · **Actual** start/finish (green panel; filled automatically by the % slider, editable to correct) · Completion slider · Milestone checkbox · Remarks · two-step Delete.

On save, empty date fields become `null`, and a finish earlier than its start is clamped to the start (the server would otherwise answer 400). **Escape** or backdrop click closes.

### `<RowMenu task tasks onAction onClose />`

Dropdown from the `⋯` cell: **Edit…** · **Add child…** · **Add sibling…** · **Move into…** (inline select of valid parents) · **Delete…** (native `confirm()`, recursive delete).

### `isDescendant(tasks, taskId, candidateParentId)`

True if `candidateParentId` is inside `taskId`'s subtree (or is itself). Used by the modal's parent dropdown and *Move into* to prevent cycles (the server also rejects parent cycles).

```ts
type MoveTarget = { kind: "root" } | { kind: "under"; id: string };

type RowMenuAction =
  | { kind: "edit" } | { kind: "addChild" } | { kind: "addSibling" }
  | { kind: "delete" } | { kind: "move"; target: MoveTarget };
```

---

## 14. Key workflows

### Opening the page

1. `/schedule` loads the project list and picks the first project with a schedule.
2. The URL becomes `/schedule?project=<id>&schedule=<id>`; share that link to open the same schedule.
3. Use the three selects to switch org / project / schedule. Switching reloads the document (unsaved changes are lost; the `beforeunload` guard only covers closing the tab).

### First load of a project with no schedule

1. `listSchedules` returns no schedule.
2. **Editor** (admin / manager / member): a schedule is created and `demoSchedule` is uploaded; the page renders it. Badge: **Saved**.
3. **Client**: "No schedule has been created for this project yet." with the picker above it.

### Planned vs baseline vs actual

1. **Plan** the work as normal (planned dates, links, auto-schedule).
2. When the plan is approved, click **Set baseline** (confirm). Every task's planned dates are copied into `baselineStart/Finish`. Grey baseline bars appear under the planned bars.
3. As work happens, move the **% slider**: `actualStart` / `actualFinish` fill in automatically (see §5). Correct them in the **Act. start / Act. finish** columns or the editor modal if the real dates differ.
4. When the plan moves (delays, re-sequencing, Auto-schedule), only the **planned** dates change — the baseline stays put.
5. Read the result in the **Var** column, the header "N late vs baseline", or open **Compare** for the full table and project slip.
6. Take a **manual snapshot** of the baseline on the server (`POST /schedules/<id>/snapshots/`) as a safety copy — **Set baseline overwrites** the previous baseline and nothing locks it.

`predefinedType` (BASELINE / PLANNED / ACTUAL) is just a label on the schedule; the three views above are layers on **one** schedule, not three schedules.

### Adding a new activity

1. Row menu on the intended parent group → **Add child…**, or header **+ New phase** for a top-level group.
2. New task is created with today as both start and finish, selected, flashed, and the modal opens for naming.
3. Save closes the modal. Badge goes **Unsaved changes… → Saving… → Saved**. A task added after the baseline shows "no baseline" in Compare.

### Adding a dependency

1. In the table, on a leaf, click **+ predecessor** or **+ successor**.
2. A searchable popover lists eligible tasks; duplicates and cycles are hidden.
3. Click a row to add an `FS 0d` link, then change type (`FS/SS/FF/SF`), edit lag, or remove with `×`.

### Changing duration

The **Dur** column is editable: start is preserved and finish shifts. Calendar mode: `finish = start + days - 1`. Working-day mode: start snaps to the next workday and finish advances `days` working days. Duration clamps to ≥ 1.

### Stepping through upcoming work

**Next up** shows the first leaf whose early start is after today; **◀ / ▶** cycle the queue; the chip shows "in N days" (red ≤ 2, amber ≤ 7, gray); **Jump to activity →** scrolls to it.

### Auto-schedule

Calls `autoSchedule(tasks, sequences)` — pushes successors whose start violates a link later. Never pulls work earlier. Planned dates only.

### Working-day mode

Open **Calendar** (editors), configure weekly off days / holidays / shutdown ranges (saved with the schedule), then tick **Working days**. CPM uses `computeCpmWorkdays`, durations show working days, holidays are shaded pink. The checkbox is not persisted.

### Import / export

**Import** replaces the whole schedule from a `.json` file (editors; the server may not take a snapshot if one exists from the last 10 minutes — take a manual snapshot first). **Download / Copy JSON** and **Copy for AI** export the current state.

### Recovering from "Out of date"

Badge shows **Out of date** → someone else saved first. Click **Reload**. Unsaved local edits are discarded.

### Print / PDF

Click **Print / PDF**, choose "Save as PDF". A4 landscape, controls hidden.

---

## 15. Styling conventions

- **Tailwind CSS** throughout. Print stylesheet uses `styled-jsx`.
- Colours:
  - Blue `#3b82f6` — normal task bars, "Now" card
  - Red `#dc2626` — critical bars/arrows, today line, late variance
  - Amber `#f59e0b` — milestones, specific-date holiday chips
  - Orange `#f97316` — shutdown-range chips, **actual bar that finished late**
  - Emerald `#10b981` — "Next up" card, **actual bar (on time)**, early variance
  - Grey (`gray-400`) — **baseline bar**
  - Pink `#fdf2f8` / `#fce7f3` — Gantt holiday shading
  - Gray `#374151` — group (summary) bars
- Sync badge colours: green saved · amber unsaved · blue saving · red error/conflict/failed · gray loading/readonly/empty
- Sizes: `ROW_H = 28`, `LEFT_COL_W = 256`, planned bar 12 px at `+8`, actual bar 4 px at `+3`, baseline bar 4 px at `+22`, indent 14 px (Gantt) / 16 px (table) per depth level

---

## 16. Extension points

### Adding a new field to `Task`

Frontend:

1. Add to the interface in `data.ts` (optional + nullable if the server may return `null`).
2. Add to the factory `T(...)` if it should be seeded.
3. Optionally expose in `ActivityEditorModal` and the table.
4. If it depends on children, extend `rollup`.

**Backend (required, or the field is silently dropped on save):**

5. Field on `ScheduleTask` (+ migration), `TaskIn` serializer, `to_dict()`, and the constructor call in `save_document()`. See the Django README §11. (This is how the baseline/actual fields were added.)

### New sequence type

1. Add to `SequenceType` and `SEQUENCE_TYPES` in `data.ts`.
2. Handle forward + backward cases in `computeCpm`.
3. Handle the forward case in `autoSchedule`.
4. Update anchor logic in `page.tsx` (`pIsStart`, `qIsStart`) if needed.
5. Backend: add to `ScheduleSequence.TYPE_CHOICES` (+ migration).

### Status date ("as of")

The backend stores `statusDate` on the schedule and returns it in the document. To use it: add `statusDate` to `ScheduleDoc` / `saveSchedule` in `api.ts`, pass it through `useScheduleSync` and `page.tsx`, add a date picker in the header, and use it instead of `todayISO()` in `applyProgress` and the in-progress actual bar.

### Lock the baseline

Baseline is currently only protected by convention. To restrict it to admin/manager, add a server-side check (compare incoming baseline values with stored ones in `views.update`/`save_document` and return 403 for non-privileged roles) and hide **Set baseline** for members using `currentProject.role`.

### Full working-day CPM

Replace `computeCpmWorkdays` with working-day arithmetic inside the forward/backward pass (`addWorkdays`, `nextWorkday`, `countWorkdays` are available).

### Forecast from actuals

Make CPM / auto-schedule start remaining work from the status date and honour `actualStart` / `actualFinish`, as P6 and MS Project do.

### Version history UI (backend already supports it)

A "Versions" modal would list snapshots, open one read-only, and offer **Restore** (then `sync.reload()`). Auto-snapshot retention is short (Django README §8.1).

### Separate BASELINE / ACTUAL schedules

The model and API support several schedules per project and the picker already lists them. To use them: add a "New schedule" action that sends `predefinedType`, a "Save as baseline" action that copies the plan into a `BASELINE` schedule, and a diff view matched by task `id`. Not needed for the layered model above.

### Real IFC import/export

| This model | IFC |
|---|---|
| `WorkSchedule` | `IfcWorkSchedule` |
| `Task` | `IfcTask` + `IfcTaskTime` (`ScheduleStart/Finish`, `ActualStart/Finish`, `Completion`) |
| `parentId` | `IfcRelNests` |
| `Sequence` | `IfcRelSequence` |
| `linkedElements` | `IfcRelAssignsToProcess` |
| baseline fields | a separate `IfcWorkSchedule` with `PredefinedType = BASELINE` |

Write a mapper that walks `IfcTask` instances, resolves `IfcRelNests` into `parentId`s, and reads `IfcRelSequence` into `Sequence[]`. An import is just a `PUT`.

---

## 17. Testing checklist

Pure modules (`calendar.ts`, `scheduling.ts`, `cpm.ts`) are unit-testable with Vitest / Jest.

### Calendar

- `countWorkdays("2026-10-01", "2026-10-07", {weekly:{0,6}})` = 5
- `addWorkdays("2026-10-01", 5, {weekly:{0,6}})` = `"2026-10-08"`
- `nextWorkday("2026-10-03", {weekly:{0,6}})` = `"2026-10-05"`
- `isHoliday` inside a `["2026-12-24","2026-12-26"]` range on `"2026-12-25"` = true
- Serialize/deserialize round-trip preserves `weekly`, `dates`, `ranges`

### CPM

- Two-task FS chain → both critical, project duration = sum
- FS with lag=5 → float 5 on the successor
- SS with negative lag → successor starts before predecessor
- Disconnected branches → only the longest is critical

### `computeCpmWorkdays`

- A task spanning a weekend reduces float compared to calendar mode
- Snapping leaves to workdays produces dates that are all working days

### Rollup

- Group with two children → span = min/max, % = weighted avg
- Nested groups → grandchildren propagate upward
- Baseline: group baseline = min child baseline start / max child baseline finish; null when no child has one
- Actual: group `actualFinish` stays null until **all** children have finished

### Baseline / actual

- `setBaseline` copies planned dates into baseline fields on every task
- `finishVariance`: no baseline → `null`; planned finish 3 days after baseline → `3`; uses `actualFinish` when present
- `applyProgress`: 0→40 sets `actualStart = today`; 40→100 sets `actualFinish`; 100→60 clears `actualFinish`; →0 clears both; `actualFinish` never before `actualStart`
- `autoSchedule` and `setDurationWithCalendar` leave baseline/actual untouched

### `autoSchedule`

- Chain where successor start violates FS → pushed later
- FS with lag > 0 → successor pushed by lag
- Never pulls earlier when manual start is already later

### `wouldCycle`

- Self → true; A→B→C then C→A → true; A→B then B→A → true

### `flatten` / collapse

- Collapsed parent hides children; WBS numbering survives hierarchy changes

### `setDuration` / `setDurationWithCalendar`

- Calendar mode: preserves start, `finish = start + days - 1`, clamps to ≥ 1
- Working-day mode: start snaps to next workday, finish advances `days` working days

### UI (manual)

- At every zoom level the bars line up with their left-column rows (header heights match)
- Set baseline → grey bars appear; push a task later → Var shows `+Nd`, header shows "N late vs baseline"; Compare matches
- Slide a task to 100% → actual bar appears; turns orange if it finished after the baseline finish
- Client account: Set baseline, import, inputs and menus are hidden/disabled; Compare and export still work
- Member account: edit controls visible and saves succeed (member is in `EDIT_ROLES`)
- Empty project as a client: message + project picker; switching to another project loads it
- `/schedule` without params redirects (via `replaceState`) to a project that has a schedule

### Sync (manual / integration)

- Fresh project, editor account → schedule created + seeded; badge **Saved**; reload keeps data
- Edit anything → badge cycles Unsaved → Saving → Saved; refresh shows the edit
- Fresh load does **not** immediately show Unsaved (`stableKey` guard)
- Two tabs: edit in A, then in B → B shows **Out of date**; Reload gets A's change
- Stop Django, edit → **Save failed** + Retry; start Django, Retry → **Saved**
- Set a finish before a start → blocked by the pre-flight check with a reason; fix the date → saves
- Baseline/actual values survive a reload (confirms the backend maps the new fields)
- Dev strict mode on an empty project creates exactly **one** schedule

---

## 18. Known limitations / future work

- **Baseline is not locked.** Any editor can overwrite it via **Set baseline**, the editor modal, or a raw `PUT`.
- **No status date in the UI.** Auto-filled actual dates use today's date; the backend `statusDate` is unused by the frontend.
- **Forecast ignores actuals.** CPM and auto-schedule use planned dates only; they do not re-forecast remaining work.
- **Compare is baseline vs planned only** (not vs actual) and is a live view — there is no saved/dated comparison and no per-field change log.
- **No snapshot UI** (list / preview / restore / diff); the backend supports it.
- **No offline mode.** Edits made while the server is unreachable stay in memory only.
- **No merge on conflict.** 409 → Reload (local edits lost).
- **Whole-document autosave.** Every change re-sends the full schedule. Fine for hundreds of tasks.
- **No undo/redo.** Delete is destructive after confirm.
- **Read-only mode is cosmetic**; the server is the real gate.
- **No resource / cost model.** `completion` is the only tracked metric.
- **Bars are not draggable.** Dates are edited via the table.
- **No zoom with ctrl+wheel or pinch.**
- **Print relies on the browser's save-as-PDF**, and the wider table may need print-style tuning.
- **`computeCpmWorkdays` is approximate** (see §6).
- **Milestones are cosmetic** (amber bars; same CPM math).
- **Calendar is one-per-schedule.**
- **`createSchedule` always creates `PLANNED`**, and there is no "New schedule" UI.
- **Switching schedule discards unsaved changes** without a prompt.

---

## 19. Quick reference — constants

| Constant | Value | Where | Meaning |
|---|---|---|---|
| `DAY` | 86400000 | `calendar.ts` (re-exported by `cpm.ts`) | Milliseconds per day |
| `TODAY` | `"2026-10-02"` | `data.ts` | Reference date for auto-completion **of the seed** |
| `ROW_H` | 28 | `page.tsx` | Pixel height of a Gantt/table row |
| `LEFT_COL_W` | 256 | `page.tsx` | Width of the left task column |
| `headerH` | `20 × rows + 1` | `page.tsx` | Timeline/left header height (months + optional week + optional day row) |
| `ZOOM_MIN` / `ZOOM_MAX` | 0.5 / 80 | `page.tsx` | px/day limits |
| `SHOW_DAY_GRID_ABOVE` | 6 | `page.tsx` | px/day threshold for day gridlines |
| `SHOW_DAY_HEADER_ABOVE` | 14 | `page.tsx` | px/day threshold for day numbers |
| `SHOW_WEEK_HEADER_ABOVE` | 4 | `page.tsx` | px/day threshold for week labels |
| `SHOW_WEEK_GRID_ABOVE` | 4 | `page.tsx` | px/day threshold for week gridlines |
| `MIN_MONTH_LABEL_W` | 34 | `page.tsx` | Min px to show a full month label |
| `LINK_ARROW_GAP` / `LINK_LANE_OFFSET` | 6 / 4 | `page.tsx` | Link geometry |
| `HIGHLIGHT_MS` | 2200 | `page.tsx` | Duration of the flash highlight |
| `SEED` | demo data | `page.tsx` | Uploaded once to an empty project |
| `debounceMs` | 1500 | `useScheduleSync.ts` | Autosave debounce |
| `BASE` | env | `api.ts` | `NEXT_PUBLIC_API_URL` (default `https://api.modelflick.com`) + `/api` |

*(Removed: `PROJECT_ID` / `NEXT_PUBLIC_SCHEDULE_PROJECT_ID` — the project now comes from the picker / URL; `CALENDAR_STORAGE_KEY` — the calendar lives on the server.)*

---

## 19b. Environment & setup

`.env.local` (frontend root, next to `package.json`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- `NEXT_PUBLIC_*` values are **baked in at build time**. Restart `npm run dev` after changing them; for Docker/production pass them as build args so they exist during `next build`:
  ```dockerfile
  ARG NEXT_PUBLIC_API_URL
  ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
  ```
- Adapt `authHeaders()` in `api.ts` to your auth scheme.
- Django must allow the Next origin and the `Authorization` header in CORS.
- The user must have an **admin, manager or member** role on a project (or be a superuser) to edit it; **client** is read-only. A project needs at least one schedule — an editor opening an empty project creates and seeds one.

---

## 20. Getting started

```bash
npm install
npm run dev
# → http://localhost:3000/schedule

# type-check only
npx tsc --noEmit

# build
npm run build

# clear Next.js cache if something looks stale
rm -rf .next
```

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "No schedule has been created for this project yet." (non-editor) | The selected project has no schedule. Pick another project in the picker, or have an editor open that project once to seed it |
| "Couldn't load your projects" | `GET /api/schedules/projects/` failed — check auth token / CORS / `NEXT_PUBLIC_API_URL` |
| "You don't have access to any projects yet" | The user has no `ProjectMembership` / `OrganisationMembership` |
| `GET …/schedules/<id>/` 404 | Schedule id wrong, or the user has no role on its project (the API hides existence with 404) |
| 401 | Token missing/expired, or `authHeaders()` prefix wrong (`JWT` vs `Bearer`) |
| 403 on save | User is a client (not in `EDIT_ROLES`); page should be read-only for them |
| Badge **Out of date** | Another tab/user saved first → **Reload** |
| Badge **Save failed** + 400 text | Validation (finish before start, unknown parent, actual/baseline finish before start). Fix and edit again |
| Baseline / actual values vanish after reload | The backend isn't mapping the new fields — run the migration and deploy the updated `models.py` / `serializers.py` / `services.py` |
| Badge stuck on **Unsaved changes…** right after load | Compare-key issue; make sure `stableKey()` (key-sorted) is used and not plain `JSON.stringify` |
| "Rendered more hooks than during the previous render" | A hook was added below the early `return` gates in `page.tsx` — move it above them |
| Gantt width wrong after load | The `ResizeObserver` effect must depend on `ready` |
| Bars drift away from their rows | Left and right header heights differ — both must use `headerH` |
| Two schedules created for one project (dev) | Strict-mode double effect; keep the `startedFor` guard; delete the extra in Django admin |
| URL changes to `?project=…&schedule=…` on load | Intended — the selection is mirrored into the URL for deep-linking |
| **`Module not found: Can't resolve './cpm'` or similar** | Verify the file exists with a resolvable extension (`.ts`, not `.txt`) |
| **`Export X doesn't exist in target module`** | That export genuinely isn't declared — grep: `grep -rn "export function <name>" app/schedule/` |
| **Circular import warning** | `calendar.ts` must import nothing from the app. `DAY` is defined there, not in `cpm.ts` |

---

## 21. Glossary

| Term | Meaning |
|---|---|
| **CPM** | Critical Path Method — forward/backward pass algorithm for float and critical path |
| **ES / EF** | Early Start / Early Finish — earliest possible dates |
| **LS / LF** | Late Start / Late Finish — latest dates without delaying the project |
| **Float** | Slack = `LS - ES`. Zero float = critical |
| **WBS** | Work Breakdown Structure — hierarchical numbering (1, 1.1, 1.1.1) |
| **Rollup** | Deriving a group's dates/%/baseline/actual from its children |
| **FS / SS / FF / SF** | Finish-Start, Start-Start, Finish-Finish, Start-Finish dependency types |
| **Lag / Lead** | Positive delay / negative delay in a link |
| **Leaf** | A task with no children (an actual activity) |
| **Group** | A task with children (a phase/summary) |
| **Milestone** | A single-day marker; rendered as an amber bar |
| **Now** | The activity whose CPM window contains today |
| **Next up** | The next activity whose early start is after today |
| **Planned** | The current schedule dates (`scheduleStart` / `scheduleFinish`); they move as the plan changes |
| **Baseline** | The frozen approved plan (`baselineStart` / `baselineFinish`) used as the reference |
| **Actual** | What really happened (`actualStart` / `actualFinish`) |
| **Variance** | Planned (or actual) finish minus baseline finish, in days; + = late |
| **Slip** | Variance of the project's last finish date |
| **Status date** | The "as of" date for progress reporting (stored on the server; not yet used by the UI) |
| **Working calendar** | Rules defining non-working days (weekly + dates + ranges) |
| **Working-day mode** | CPM and durations respect the working calendar |
| **Seed** | `demoSchedule` uploaded once to an empty project |
| **Optimistic locking** | Saves carry the loaded `version`; the server rejects a stale one with 409 |
| **Snapshot** | Server-side full copy of a schedule at a point in time (restorable via API) |

---

*Last updated: October 2026 — project picker + URL deep-linking, permissions driven by the server's `canEdit` (admin / manager / member edit, client read-only), header-height alignment fix, baseline / actual tracking with auto-filled actual dates and a **Var** column, **Compare** panel, JSON import/export, orphan-sequence pruning and save pre-flight checks. Builds on the Django-backed persistence layer, working-day mode, editable Duration column, Now/Next stepper, and row action menu.*