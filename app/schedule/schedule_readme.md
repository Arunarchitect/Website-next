# Schedule Component — Developer README (Next.js frontend)

A complete reference for the Modelflick Project Work Schedule viewer/editor (`app/schedule`). Covers architecture, data model, every module, key algorithms (CPM, rollup, auto-schedule, working-day math, baseline/actual), the scheduling rules, the Django sync layer, the project picker, undo/redo, UI features, and extension points.

Backend counterpart: `schedule_django_readme.md`.

---

## 1. Overview

This is a **dependency-aware construction schedule** built as a Next.js 15 App Router page. It renders a full **Gantt chart** plus an **editable table**, computes the **critical path** using CPM, supports an optional **working-day calendar** (weekends + holidays + shutdown ranges), highlights **Now / Next** activities, tracks **planned vs baseline vs actual**, and supports full **CRUD** on activities and their hierarchy.

All scheduling logic (CPM, rollup, auto-schedule, calendar math, variance) runs **client-side**. Persistence is handled by a **Django REST backend**: the page loads the selected schedule and **autosaves** the whole document (debounced) with optimistic locking.

Key capabilities:

- **Org → Project → Schedule picker**; the selection is mirrored into the URL (`?project=&schedule=`)
- Hierarchical work breakdown (phases → activities), collapsible
- Editable table (name, dates, duration, %, actual dates, variance, predecessors, successors)
- Activity editor modal with a **draft model**: nothing is applied until **Save**; Cancel / Esc / backdrop discards everything (including link edits)
- **Group (header) rows are fully derived** from their children and locked in the table and the editor
- **Baseline editing is admin-only** (UI); baseline of groups is derived
- Row action menu (edit / add child / add sibling / copy JSON / move into / delete)
- Dependency editing (FS / SS / FF / SF with lag)
- CPM with early/late starts, total float, and critical-path highlighting
- **Working-day mode** with a configurable calendar (weekly off, holiday dates, shutdown ranges)
- **Auto-schedule** (holiday-aware) that also **normalises inconsistent data**: completed tasks never sit in the future, future "actual starts" are dropped, in-progress tasks' planned dates follow their actual start
- **Completion rule**: a task can only reach 100% when all its predecessors are 100%
- **Baseline & actual** — "Set baseline" freezes the plan; the % slider auto-fills actual dates; grey/green/orange bars on the Gantt; **Var** column
- **Compare** panel — baseline vs planned, start/finish variance, project slip
- **Now / Next** strip with a countdown chip and a queue stepper
- **Search** — jump-to-task, expands ancestors, flashes the row
- **Undo / Redo** (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, header buttons) over tasks, sequences and calendar
- **Print / PDF** export via `window.print()`
- **JSON import / export**, **Copy JSON**, **Copy for AI**, **Paste JSON** (whole schedule or only the ticked rows), ODS export
- Responsive Gantt zoom (elastic fit-to-width + manual zoom), long-press to edit on touch
- **Autosave to Django** with a status badge (Saved / Saving / Unsaved / Out of date …)
- **Conflict detection** (409) when another tab/user saved first
- **Read-only mode** for users without edit rights (currently: clients)

---

## 2. File layout

```
app/schedule/
├── data.ts                 ← Types + demo/seed schedule (tasks, sequences), helpers
├── calendar.ts             ← Pure working-calendar math (defines DAY)
├── scheduling.ts           ← Pure date/hierarchy/baseline/auto-schedule helpers (no React)
├── cpm.ts                  ← CPM math + Now/Next + format helpers (no React)
├── api.ts                  ← fetch wrapper + typed Django endpoints (no React)
├── useScheduleSync.ts      ← Load / seed / debounced autosave / conflict hook
├── useUndo.ts              ← Undo/redo history hook (snapshots of tasks/sequences/calendar)
├── SyncBadge.tsx           ← Save-status chip + Retry / Reload buttons
├── page.tsx                ← Route entry for /schedule
├── ScheduleView.tsx        ← Main view: picker, Gantt, table, wiring, ALL schedule state
├── SchedulePicker.tsx      ← Org → project → schedule selects
├── SearchAct.tsx           ← Searchable jump-to-task dropdown
├── PrintAct.tsx            ← Print / Save-as-PDF button + print stylesheet
├── CalendarUI.tsx          ← Calendar UI (button + modal + chips)
├── ActivityEditor.tsx      ← Edit modal (draft + Save) + row action menu
├── TaskPicker.tsx          ← Predecessor / successor popover in the table
├── BaselineCompare.tsx     ← Baseline vs planned comparison modal
├── JsonTool.tsx            ← Paste JSON modal, Copy-for-AI, applySelection
├── ScheduleImport.tsx      ← Upload a .json file → POST /schedules/<id>/import/
├── ScheduleExport.tsx      ← Download JSON / Copy JSON / Copy for AI
├── ScheduleExportODS.tsx   ← ODS export of the visible rows
└── README.md               ← This file
```

**Dependency direction** (nothing imports from `ScheduleView.tsx`, and there are no cycles):

```
calendar.ts        ← defines DAY; no imports from the app
    ▲
    ├── scheduling.ts    (imports DAY + holiday helpers)
    ├── cpm.ts           (imports from calendar + scheduling, re-exports DAY)
    ├── CalendarUI.tsx   (imports from calendar + cpm + scheduling)
    ├── BaselineCompare.tsx (imports from scheduling)
    ├── ActivityEditor.tsx  (imports from data + scheduling + calendar)
    ├── useUndo.ts       (imports types from data + calendar)
    │
data.ts  ◄── api.ts ◄── useScheduleSync.ts ◄── ScheduleView.tsx  (imports from everything, plus UI components + SyncBadge)
```

- **Pure modules**: `calendar.ts`, `scheduling.ts`, `cpm.ts`, `api.ts` — no React, no DOM state. The first three are unit-testable in Node.
- **UI modules**: `ScheduleView.tsx` + the components above. All schedule state lives in `ScheduleView.tsx`; children are presentational (the editor keeps only a local *draft*).
- **Sync module**: `useScheduleSync.ts` owns *only* the server round-trip (ids, versions, status). It does not own the schedule data; `ScheduleView.tsx` does.
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
| `baselineStart` | `YYYY-MM-DD \| null` (optional) | — (BASELINE work schedule) | Frozen plan. Set by "Set baseline" (admin) |
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

`predefinedType` is a **label only** (see §14 "Planned vs baseline vs actual"). The page always creates schedules as `PLANNED`.

### `demoSchedule` is only a **seed**

`data.ts` exports `demoSchedule` (the SREEKESH programme). `ScheduleView.tsx` starts with empty `tasks` / `sequences` and fills them from the server. `demoSchedule` is used for:

1. **First-time seeding:** `makeSeed()` creates a basic template (one empty phase + default calendar) when the user clicks **+ Create schedule** on a project with no schedule. (The hook can also upload `demoSchedule`; see `useScheduleSync`.)
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

## 5. `scheduling.ts` — pure date, hierarchy, baseline & auto-schedule helpers

No React, no DOM. **Imports `DAY` and holiday helpers from `calendar.ts`.**

| Export | Signature | What it does |
|---|---|---|
| `toDay` | `(iso) => number` | ISO date → day number |
| `toISO` | `(day) => string` | Day number → ISO date |
| `addDays` | `(iso, n) => string` | Shift ISO date by `n` calendar days |
| `durationDays` | `(task) => number` | Inclusive calendar duration (planned dates) |
| `todayISO` | `() => string` | Local today as ISO |
| `flatten` | `(tasks, collapsed) => Row[]` | Tree → visible rows with depth + WBS |
| `descendantIds` / `ancestorIds` | `(tasks, id) => Set` | All descendants / ancestors |
| `rollup` | `(tasks) => Task[]` | Group dates/%/baseline/actual derived from children |
| `setBaseline` | `(tasks) => Task[]` | Copy every task's planned dates into `baselineStart/Finish` (overwrites) |
| `finishVariance` | `(task) => number \| null` | Days late (+) / early (−) vs baseline finish. Uses `actualFinish` once finished, else `scheduleFinish`. `null` = no baseline |
| `applyProgress` | `(task, pct, today) => Task` | Set `%` and keep actual dates in step |
| `completionBlocker` | `(id, pct, tasks, seqs) => string \| null` | Completion rule; returns an error message or `null` |
| `autoSchedule` | `(tasks, seqs, compress?) => Task[]` | Calendar-day auto-schedule (ignores holidays) |
| `autoScheduleWorkdays` | `(tasks, seqs, cal, compress?) => Task[]` | **Holiday-aware** auto-schedule (what the button uses) |
| `wouldCycle` | `(seqs, pred, succ) => boolean` | Cycle check |
| `setDuration` | `(task, newDays) => Task` | Change days; shifts finish by **calendar** days |
| `durationWorkdays` | `(task, cal?) => number` | Working-day duration (falls back to calendar) |
| `setDurationWithCalendar` | `(task, newDays, cal?) => Task` | Change days; shifts finish by **working** days |
| `hasHolidayInside` | `(task, cal) => boolean` | True if the span touches a holiday |
| `snapRangeToWorkdays` | `(start, finish, cal) => {start, finish}` | Start snaps forward, finish snaps back to working days |
| `isoWeek` | `(date) => number` | ISO week number (Gantt week labels) |

Internal (not exported): `isLocked`, `effStart` / `effFinish`, `topoOrder`, `finalizeCompleted`.

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

### `rollup` — group (header) rows

Group rows (any task that has children) get:

- `scheduleStart` = earliest child start; `scheduleFinish` = latest child finish
- `completion` = duration-weighted average of children; `isMilestone = false`
- `baselineStart` / `baselineFinish` = earliest / latest child baseline (null if no child has one)
- `actualStart` = earliest child actual start
- `actualFinish` = latest child actual finish, **only once every child has an actual finish**, else null

So a group is "actual" only when all its children are finished; otherwise it shows the planned/in-progress picture.

`rollup` runs before every render (`rolled`) and at the end of both auto-schedule functions, so Auto-schedule writes the derived group dates into the stored tasks. The stored group values are otherwise stale — the UI always reads `rolled`.

**Group rows are not editable** (see §13): their dates, duration, %, baseline, actuals, milestone flag and links are locked in the table and in the editor. Only name, work code, remarks and parent can change.

**A group that loses its last child** (delete or move) becomes a leaf. `freezeIfLeaf()` in `ScheduleView.tsx` copies the rolled dates / baseline / actuals / % into the stored task at that moment, so it does not snap back to stale stored values.

### `applyProgress` — actual dates follow the % slider

| Change | Effect |
|---|---|
| % goes above 0 | `actualStart = today` if empty |
| % reaches 100 | `actualFinish = today` if empty (never earlier than `actualStart`); `actualStart` filled if missing |
| % drops below 100 | `actualFinish` cleared |
| % back to 0 | `actualStart` and `actualFinish` cleared |

"Today" is the browser's local date. There is no status-date input yet (the backend stores `statusDate`, the frontend does not use it).

### `completionBlocker` — the completion rule

- Going to **100%** is blocked while any **predecessor** is below 100%.
- Dropping **below 100%** is blocked while any **successor** is already 100%.

Used by the % slider (`updateCompletion`) and by `updateTask` (the editor's Save). When blocked, a toast shows the reason; in the editor flow the other edits are still applied and only the % change is ignored.

### Auto-schedule

Both variants share the same shape. The **Auto-schedule** button always calls `autoScheduleWorkdays` and switches working-day mode on, so durations and holiday shading match the result.

1. **Normalise** with `finalizeCompleted()` (rules below).
2. Take the leaf tasks and order them topologically (Kahn; loops are appended so nothing is dropped).
3. **Locked** tasks are never moved by links: anything with an `actualStart`, an `actualFinish` or `completion > 0`. Groups are never moved (they roll up).
4. For each unlocked task: target start = the latest date its predecessor links allow (predecessors use their **actual** dates when present). No predecessor → the **anchor**. The result is never earlier than the anchor.
   - **Anchor** = the later of the earliest leaf start and **today** (snapped to a working day in the workday variant).
   - `compress = true` (default): tasks sit exactly at their earliest start. `compress = false`: tasks are only pushed later.
5. **Workday variant:** every start snaps forward to the next working day, and a task keeps its length in **working days** (a task crossing a holiday is stretched over it).
6. Return `rollup(...)` so group rows follow.

Only **planned** dates move; baseline and actual are preserved (except for the normalisations below).

#### `finalizeCompleted()` — data normalisation (runs first)

| Situation (leaf tasks only) | What happens |
|---|---|
| `< 100%`, **actual start in the future**, no actual finish | Actual start is dropped (set to today instead if `% > 0`). With `0%` the task is now unlocked, so it is rescheduled — today at the earliest, later if a predecessor clashes |
| `< 100%`, started (actual start ≤ today), no actual finish | Planned **start = actual start**, same length (working days in the workday variant), planned finish never before today. Successors are then pulled/pushed from the real dates |
| `100%` | `actualFinish` filled if missing (planned finish if ≤ today, else today) and **clamped to ≤ today**; `actualStart` filled if missing and pulled to ≤ `actualFinish`; planned finish **clamped to ≤ today**, planned start ≤ planned finish |

So a completed task can never carry a future finish, and an in-progress task can never sit frozen at stale future planned dates. The workday variant passes the calendar into `finalizeCompleted`.

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
// → { status, canEdit, savedAt, message, saveNow, reload, setVersion, markSaved, createAndSeed }
```

The hook does not hold the schedule data — `ScheduleView.tsx` passes the current `tasks`/`sequences`/serialized `calendar` in, and receives the loaded data through `onLoaded`. If `scheduleId` is set it wins over `projectId`.

**Load flow (once per `scheduleId` / `projectId` change):**

1. **`scheduleId` given** (from the picker or URL): `getSchedule(scheduleId)` → remember `id` + `version` + `canEdit` → `onLoaded` → status `saved` (editable) or `readonly`.
2. **No `scheduleId`, no `projectId`:** status `empty`.
3. **`projectId` only:** `listSchedules(projectId)` → sets `canEdit`.
   - **No schedule exists:** status `empty`; an editor can click **+ Create schedule** (`createAndSeed`) which creates one and uploads the seed.
   - **Schedule exists:** `getSchedule(results[0].id)` → `onLoaded(...)`.
4. Orphan sequences (endpoints that no longer exist) are **pruned on load** with a console warning.
5. Server `calendar` of `null` resets the page to the default calendar (so a previous schedule's holidays never leak).

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
| `empty` | no schedule and cannot create / not created yet | off |
| `failed` | load failed (auth/network/not found) | off |

**Out-of-band writes:** `setVersion(v)` adopts a version returned by a non-autosave write (JSON import). `markSaved(payload)` records a payload as saved without a `PUT`, so the page does not immediately re-save an import.

**Implementation details worth knowing:**

- **`stableKey()` compares key-sorted JSON.** Postgres `jsonb` reorders object keys; a naive compare would mark the page dirty forever.
- **Strict-mode guard (`startedFor` ref)** keyed on `scheduleId` / `projectId`; without it an empty project would create two schedules in dev.
- **`beforeunload` warning** while status is `dirty`, `saving` or `error`.
- **Refs, not state, for ids/versions/flags** so the debounced callback never closes over stale values.
- The first load is **not** treated as a change.
- **An undo is a normal state change**, so autosave persists it.

### 7.3 `SyncBadge.tsx`

Coloured chip with the status text (+ time of last save), **Retry** on `error`, **Reload** on `conflict` / `failed`, and the error message inline. Marked `data-print-hide`.

### 7.4 Conflict behaviour

Two tabs / users editing the same schedule: the second save gets 409 → badge shows **Out of date**. There is **no merge**; **Reload** discards local unsaved edits and fetches the latest. Restores or imports done through the API also invalidate open tabs.

### 7.5 Import / export

- **`ScheduleImport`** (editors only): uploads a `.json` file (same shape as `PUT`) to `POST /api/schedules/<id>/import/` as multipart `file`. The server forces the current version, so an import is always "replace what is there". On success the page replaces local state, clears undo history, and calls `sync.setVersion` + `sync.markSaved`.
- **`ScheduleExport`**: Download/Copy JSON of the current tasks/sequences/calendar, and **Copy for AI** (a text rendering of the schedule). Available to everyone, including read-only users. Baseline and actual fields are included because they are part of `Task`.
- **`ScheduleExportODS`**: exports the visible rows (with critical flags) as an ODS file.
- **`JsonTool`**: `PasteJsonModal` validates a pasted task/phase JSON and applies it (`applySelection`); with `restrictTo` it only touches the ticked rows. `copyTasksForAi` copies the ticked rows (optionally with descendants) as JSON.

---

## 8. `ScheduleView.tsx` — the main view

The only file with **schedule React state**. Everything else is derived. (`page.tsx` just renders it.)

### Project picker

- On mount, `listMyProjects()` fills `myProjects`.
- If the URL has no `?project=`, the page picks the **first project that already has a schedule** (falling back to the first project) and its first schedule. This avoids landing on an empty project.
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
| `showLinks`, `showCritical`, `showBaseline` | `boolean` | Toggle dependency arrows / critical highlight / baseline + actual bars |
| `ganttOpen` | `boolean` | Show/hide the whole Gantt section |
| `compareOpen` | `boolean` | Baseline compare modal |
| `picker`, `menuFor`, `editingId` | — | Open dependency picker / row menu / edit modal |
| `selectedId`, `flashId` | `string \| null` | Selected row / flashing row |
| `checkedIds`, `includeChildren` | `Set` / `boolean` | Row ticks for Copy selected / Paste into selection |
| `pasteOpen`, `scopedPasteOpen` | `boolean` | Paste JSON modals |
| `copiedMsg` | `string \| null` | Toast text (also used for completion-rule errors and Undone/Redone) |
| `nextIdx` | `number` | Index into the upcoming queue |
| `containerW`, `leftW` | `number` | Container width (`ResizeObserver`); left column width (256, or 128 below 640 px) |
| `calendar` / `calendarOpen` | — | Holiday rules (stored on the server) / modal |
| `useWorkdays` | `boolean` | Working-day mode (session-only, not persisted; Auto-schedule turns it on) |

### Permission-related values

| Value | Derivation |
|---|---|
| `currentProject` | `myProjects.find(p => p.id === projectId)` |
| `isViewOnly` | `currentProject ? !currentProject.canEdit : false` — follows the server's `canEdit` (so it always matches `EDIT_ROLES`) |
| `isAdmin` | `currentProject?.role === "admin"` |
| `readOnly` | `isViewOnly \|\| !sync.canEdit` |
| `ready` | `sync.status` not in `loading` / `empty` / `failed` — gates the `ResizeObserver` effect and the undo shortcut |

### Hooks-before-return rule

`ScheduleView.tsx` returns early for picker error/loading, no projects, no project selected, and sync `loading` / `empty` / `failed`. **Every hook (`useState`, `useMemo`, `useEffect`, `useCallback`, the sync and undo hooks) must be declared above those early returns** (they sit right after the `links` memo). A hook added below them throws "rendered more hooks than during the previous render". Non-hook helpers and derived constants (`rangeFor`, `handleRowAction`, `hasBaseline`, `lateCount`, countdown classes) live below the gates.

### Read-only mode

When `readOnly`: hidden — row `⋯` menu, ✎ quick-edit, `+ New phase`, **Set baseline**, `Auto-schedule`, Undo/Redo, Import, Calendar button/modal, `+ predecessor` / `+ successor`, link `×`, row ticks. Disabled — date inputs (planned and actual), duration input, % slider, link type/lag selects. Viewing, searching, zoom, print, **Compare**, Export and the Working-days toggle still work. This is **UI only**; the server returns 403 on writes from non-editors.

### Derived (memoized)

| Value | Derivation |
|---|---|
| `rolled` | `rollup(tasks)` |
| `rows` | `flatten(rolled, collapsed)` |
| `minDay, maxDay` | Min/max of all task dates |
| `cpm` | `useWorkdays ? computeCpmWorkdays(...) : computeCpm(...)` |
| `current, next` | `findCurrentAndNext(...)` |
| `upcoming` | `upcomingQueue(...)` |
| `fitZoom` | `max(320, containerW - 24) / totalDays` |
| `months, weeks` | Header segments (labels + widths) |
| `links` | SVG path data for every arrow |
| `rowIndexById` | Map task id → row index (for link geometry) |
| `editingTask` | **`rolled.find(...)`** — the editor receives the rolled task so a group shows its derived values |

### Gantt layout

```
┌──────────────┬───────────────────────────────────────────────┐
│  leftW       │  scrollable timeline (ganttWidth px)          │
│  (256 / 128) │                                                │
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
- **Baseline bar** 4 px high, grey, at `+22` (below the planned bar). **These thin grey bars are the baseline;** when a bar sits to the right of the planned bar, the task is forecast earlier than baseline.
- **Left column is outside the horizontal scroller** → stays fixed.
- **Touch:** long-press (400 ms, 10 px drift tolerance) on a row or bar opens the editor; the click that follows a long press is swallowed.

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

`☐` · `⋯` · `#` (WBS) · Task · Start · Finish · Dur · Float · % · **Act. start** · **Act. finish** · **Var** · Predecessors · Successors · ✎.

- **Groups:** start, finish, actual dates and % are disabled; Dur shows plain text; no + predecessor/successor buttons.
- **Act. start / Act. finish**: date inputs (disabled for groups and read-only users). Editing clamps `actualFinish ≥ actualStart`.
- **Var**: `finishVariance(task)` — red `+Nd` late, green `−Nd` early, `0d` on baseline, `—` no baseline.

### Selection & flash

Clicking a row or bar sets `selectedId` (blue highlight in the left column, table and Gantt body). Search, the stepper and Compare also set `flashId` for ~2.2 s. Selecting a **group row** toggles its collapse. On small screens a floating action bar appears for the selected row (Edit / + Child / ✕).

### CRUD & baseline handlers (in `ScheduleView.tsx`)

| Handler | Effect |
|---|---|
| `addChild(parentId)` | Create task, expand parent, open editor, select + flash |
| `addSibling(task)` | `addChild(task.parentId ?? null)` |
| `deleteTask(id)` | Recursive: removes task + descendants + touching sequences; **`freezeIfLeaf`** the parent if it just lost its last child |
| `updateTask(id, patch)` | Shallow merge; a changed `completion` goes through `completionBlocker` (blocked % is dropped, other edits kept) |
| `moveTask(id, target)` | Re-parent; expands new parent; **`freezeIfLeaf`** the old parent; selects + flashes |
| `updateDates(id, start, finish)` | Direct set of both planned dates; snaps to working days in working-day mode |
| `updateDuration(id, newDays)` | Uses `setDurationWithCalendar`; respects working-day mode |
| `updateCompletion(id, pct)` | `completionBlocker` then `applyProgress` — sets % and auto-fills/clears actual dates |
| `updateActual(id, field, value)` | Sets `actualStart` / `actualFinish` (empty → `null`), clamps finish ≥ start |
| `setBaselineNow()` | **Admin only.** After `confirm()`, `setBaseline` over all tasks (overwrites any existing baseline) |
| `runAutoSchedule()` | Turns working-day mode on and runs `autoScheduleWorkdays` |
| `handlePick(...)` | Adds a sequence (with `wouldCycle` check) |
| `updateSequence(id, patch)` / `removeSequence(id)` | Edit / delete one link |
| `onApplyLinks(next)` | Replaces all links touching the edited task with the editor's draft list (called once, on Save) |

All mutators use `setTasks(prev => …)` / `setSequences(prev => …)`. **They only change local state; the sync hook notices the change and autosaves.** There is no per-handler API call.

### Cascade cleanup on delete

All descendants removed; every sequence touching a removed id removed; `selectedId`, `flashId`, `picker`, `menuFor`, `editingId` cleared if they pointed at anything removed. Destructive after confirm (the next autosave replaces the server copy) — but **Undo** now restores it, and server auto-snapshots exist (no restore UI yet).

### Header summary line

`<first date> → <last date> · N days total · N critical activities` plus ` · working-day mode`, ` · N late vs baseline` (only when a baseline exists), ` · view-only`.

---

## 9. `useUndo.ts` — undo / redo

A hook that watches the schedule state instead of wrapping every setter, so every existing action is covered (slider, delete, move, Auto-schedule, paste JSON, editor Save, calendar edits).

```ts
const undo = useUndo({ tasks, sequences, calendar, apply });
// → { undo(), redo(), clear(), canUndo, canRedo }
```

- **Snapshots** are `{ tasks, sequences, calendar }` (references — the state is immutable, so this is cheap).
- **Coalescing:** changes within 400 ms merge into one undo step (a slider drag = one step). History limit: 100.
- **Redo** is cleared when a new change is made after an undo.
- `apply(snap)` restores the three pieces of state; the hook records the restored snapshot as "last" so the observer does not log the undo itself as a change.
- **Autosave persists an undo** (it is an ordinary state change).
- **`clear()`** is called when a schedule is loaded (`handleLoaded`) and after a JSON import. History is in memory only: lost on refresh, when switching schedules, and after Import.
- Not tracked: `useWorkdays`. Undoing Auto-schedule restores the dates but leaves working-day mode on.

**Keyboard:** `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` redo. Ignored while typing in text/number/date/textarea fields (native text undo wins — sliders, checkboxes and buttons still trigger schedule undo), and while any modal (editor, paste, calendar, compare) is open. A short toast shows "Undone" / "Redone". Header **↶ Undo / ↷ Redo** buttons mirror it. Hidden in read-only mode.

**Gotcha:** if `useScheduleSync` calls `onLoaded` after a save (for example to refresh the version), `handleLoaded` clears the history. If undo seems to reset right after saving, make the sync hook skip `onLoaded` for its own saves.

---

## 10. `BaselineCompare.tsx` — baseline vs planned

`<BaselineCompare tasks onClose onJump? />` — pass the **rolled** task list so group rows carry derived dates. Opened from the header **Compare** button (visible to everyone).

**Definitions:** variance = planned date − baseline date, in days (+ = later than baseline). Compare uses **planned** dates only; it ignores actuals (the table's **Var** column is the one that uses `actualFinish`).

**Summary cards:** project finish (planned vs baseline) · project slip · late count · early count · unchanged (with "N shifted" for tasks that moved but still finish on time, and "N added after baseline"). A red line names the **biggest slip**.

**Table:** WBS · task · baseline start · planned start · start var · baseline finish · planned finish · finish var · duration Δ. Late rows are tinted. Controls: **Changed only** (default on) and **Sort by biggest slip**. Clicking a row calls `onJump` — the page expands ancestors, closes the modal and selects/flashes the row. With no baseline set, the modal says to use **Set baseline** first.

---

## 11. `CalendarUI.tsx` — working-calendar UI

### `<CalendarButton calendar onOpen />`

Small header button with a summary chip (`"2 weekly · 0 single · 1 ranges"`). Marked `data-print-hide`. Hidden in read-only mode.

### `<CalendarModal calendar onChange onClose />`

Full-screen modal with tabs **Weekly off** (chip toggle per weekday), **Specific dates** (date + optional name) and **Shutdown ranges** (start + end + name). Bottom: **Preview strip**, **Reset to default**, **Done**. Escape / backdrop close. Edits flow through `setCalendar` → `calendarSer` → autosave.

### `<CalendarChips calendar />`

Inline read-only chips: `Off: Sat, Sun` (gray), `N holidays` (amber), `N shutdowns` (orange), or "No holidays — every day is a working day".

---

## 12. `SearchAct.tsx` & `PrintAct.tsx`

### `SearchAct` — jump-to-task

- Filters **leaves only** by name, work code, or id; up to 12 results sorted by start date.
- Keyboard: **↑/↓**, **Enter**, **Esc**.
- On pick: `onExpand(ancestorIds)` then `onSelect(id)`; the parent does the scroll-into-view + flash.

```ts
{ tasks: Task[]; onSelect: (id: string) => void; onExpand: (ids: string[]) => void; }
```

### `PrintAct` — print / save as PDF

A button that calls `window.print()` plus a `<style jsx global>` for `@media print`: A4 landscape with 12 mm margins; hides anything with `data-print-hide` plus all `button`, `input[type=range]`, `input[type=checkbox]`; renders `input[type=date]` as plain text; tightens table padding and font; lets scroll containers expand. The user picks **Save as PDF** in the browser dialog.

`data-print-hide` is set on the header button cluster, the zoom bar and the mobile action bar. The Now/Next strip prints. **The table is wide (Act. start / Act. finish / Var); check it on A4 landscape and tighten the print stylesheet if it overflows.**

---

## 13. `ActivityEditor.tsx` — edit modal + row menu

### `<ActivityEditorModal … />`

```ts
{
  task: Task;                       // pass the ROLLED task (groups show derived values)
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkingCalendar;
  useWorkdays: boolean;
  isAdmin: boolean;                 // gates baseline editing
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
  onApplyLinks?: (next: Sequence[]) => void;   // called once on Save with this task's edited links
}
```

Scrollable dialog (`max-h-[92vh]`) with fields: Name · Work code · Parent group (hides itself and its descendants) · **Planned** start / duration / finish · Predecessors / Successors editors · **Baseline** start/finish · **Actual** start/finish · Completion slider · Milestone checkbox · Remarks · two-step Delete.

**Draft model — nothing applies until Save.** All fields and the link lists are local state. **Cancel, Esc, ✕ and a backdrop click discard everything**, including added/removed/edited predecessors and successors. Only **Delete** acts immediately (after its two-step confirm). On Save, `onSave` is called with the task patch and, if the links actually changed, `onApplyLinks(draftLinks)` replaces every link touching this task in one update. The link editors check cycles against the *draft* (other links + the edited ones).

**Group (header) tasks** (`isGroup = tasks.some(t => t.parentId === task.id)`):

- Start, duration, finish, baseline, actual, completion and milestone are all disabled; link editors are hidden; an amber note explains the values are derived.
- `save()` sends **only** `name`, `workCode`, `remarks`, `parentId`, so stale derived values are never written back.

**Baseline is admin-only:** inputs are enabled only when `isAdmin && !isGroup`; non-admins see "Only admins can edit the baseline." and `save()` never sends `baselineStart/Finish` for them. (UI only — enforce on the server too, §16.)

**Save-time normalisation** for leaves:

- Finish is recomputed from start + duration (working days in working-day mode, start snapped forward) so the saved values agree even if the user clicked Save mid-edit.
- Empty baseline/actual dates become `null`; a finish before its start is clamped to the start.
- For a **completed** task (`≥ 100%`): actual finish and planned finish are clamped to ≤ today, actual start ≤ actual finish, planned start ≤ planned finish.
- `completion` is clamped to 0–100 (the completion rule is then enforced by `updateTask`).

**Input components (fixes for typing bugs):**

- **`DateField`** — a native `type="date"` fires `onChange` on partial years (`0002`, `0020`, `0202`…), which used to recompute and snap on every keystroke. `DateField` keeps a local draft, commits only plausible full dates (year 1900–2200, `YYYY-MM-DD`), supports `allowEmpty` for optional dates, and does not resync from the saved value while focused.
- **`NumberInput`** — a text input that keeps the raw typed string, so you can backspace to empty and type a new number. It ignores empty / `-` while typing, selects the content on focus, applies live via `onChange` (valid numbers only) and finalises on blur / Enter; Esc reverts the field (and does not close the modal). Used for **Duration** and the **lag** fields.

### `<RowMenu task tasks onAction onClose />`

Dropdown from the `⋯` cell: **Edit…** · **Add child…** · **Add sibling…** · **Copy JSON for AI** · **Move into…** (inline searchable parent picker) · **Delete…** (native `confirm()`, recursive delete).

### `isDescendant(tasks, taskId, candidateParentId)`

True if `candidateParentId` is inside `taskId`'s subtree (or is itself). Used by the modal's parent picker and *Move into* to prevent cycles (the server also rejects parent cycles).

```ts
type MoveTarget = { kind: "root" } | { kind: "under"; id: string };

type RowMenuAction =
  | { kind: "edit" } | { kind: "addChild" } | { kind: "addSibling" }
  | { kind: "copyJson" } | { kind: "delete" } | { kind: "move"; target: MoveTarget };
```

---

## 14. Key workflows

### Opening the page

1. `/schedule` loads the project list and picks the first project with a schedule.
2. The URL becomes `/schedule?project=<id>&schedule=<id>`; share that link to open the same schedule.
3. Use the three selects to switch org / project / schedule. Switching reloads the document (unsaved changes are lost; the `beforeunload` guard only covers closing the tab). Undo history is cleared.

### First load of a project with no schedule

1. `listSchedules` returns no schedule → status `empty`.
2. **Editor** (admin / manager / member): the page shows **+ Create schedule**, which creates a schedule and uploads the basic seed (one empty phase + default calendar).
3. **Client**: "No schedule has been created for this project yet." with the picker above it.

### Planned vs baseline vs actual

1. **Plan** the work as normal (planned dates, links, auto-schedule).
2. When the plan is approved, an **admin** clicks **Set baseline** (confirm). Every task's planned dates are copied into `baselineStart/Finish`. Grey baseline bars appear under the planned bars.
3. As work happens, move the **% slider**: `actualStart` / `actualFinish` fill in automatically (see §5). Correct them in the **Act. start / Act. finish** columns or the editor modal if the real dates differ.
4. When the plan moves (delays, re-sequencing, Auto-schedule), only the **planned** dates change — the baseline stays put.
5. Read the result in the **Var** column, the header "N late vs baseline", or open **Compare** for the full table and project slip.
6. Take a **manual snapshot** of the baseline on the server (`POST /schedules/<id>/snapshots/`) as a safety copy — **Set baseline overwrites** the previous baseline and nothing locks it server-side.

`predefinedType` (BASELINE / PLANNED / ACTUAL) is just a label on the schedule; the three views above are layers on **one** schedule, not three schedules.

### Adding a new activity

1. Row menu on the intended parent group → **Add child…**, or header **+ New phase** for a top-level group.
2. New task is created with today as both start and finish, selected, flashed, and the modal opens for naming.
3. Save closes the modal. Badge goes **Unsaved changes… → Saving… → Saved**. A task added after the baseline shows "no baseline" in Compare.

### Adding a dependency

1. In the table, on a leaf, click **+ predecessor** or **+ successor** (applies immediately), **or** use the editor's link panels (applied on Save).
2. A searchable popover lists eligible tasks; duplicates, groups and cycles are hidden.
3. Click a row to add an `FS 0d` link, then change type (`FS/SS/FF/SF`), edit lag, or remove with `×`.

### Changing duration

The **Dur** column is editable: start is preserved and finish shifts. Calendar mode: `finish = start + days - 1`. Working-day mode: start snaps to the next workday and finish advances `days` working days. Duration clamps to ≥ 1.

### Stepping through upcoming work

**Next up** shows the first leaf whose early start is after today; **◀ / ▶** cycle the queue; the chip shows "in N days" (red ≤ 2, amber ≤ 7, gray); **Jump to activity →** scrolls to it.

### Auto-schedule

Click **Auto-schedule**: working-day mode switches on, the data is normalised (completed tasks ≤ today, future actual starts dropped, in-progress tasks follow their actual start), unfinished unlocked tasks are placed at the earliest date their predecessors allow (today at the earliest), and group rows re-derive. It never pulls a started or finished task around. Use **Undo** if you don't like the result.

### Working-day mode

Open **Calendar** (editors), configure weekly off days / holidays / shutdown ranges (saved with the schedule), then tick **Working days**. CPM uses `computeCpmWorkdays`, durations show working days, holidays are shaded pink. The checkbox is not persisted.

### Import / export

**Import** replaces the whole schedule from a `.json` file (editors; the server may not take a snapshot if one exists from the last 10 minutes — take a manual snapshot first). **Download / Copy JSON**, **Copy for AI**, and **ODS** export the current state. **Copy selected / Paste into selection / Paste JSON** round-trip edits through an AI.

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
- Sizes: `ROW_H = 28`, `LEFT_COL_W = 256` (128 on phones), planned bar 12 px at `+8`, actual bar 4 px at `+3`, baseline bar 4 px at `+22`, indent 14 px (Gantt) / 16 px (table) per depth level

---

## 16. Extension points

### Adding a new field to `Task`

Frontend:

1. Add to the interface in `data.ts` (optional + nullable if the server may return `null`).
2. Add to the factory `T(...)` if it should be seeded.
3. Optionally expose in `ActivityEditorModal` and the table (and add it to the group-only `save()` branch only if it is editable on groups).
4. If it depends on children, extend `rollup`.

**Backend (required, or the field is silently dropped on save):**

5. Field on `ScheduleTask` (+ migration), `TaskIn` serializer, `to_dict()`, and the constructor call in `save_document()`. See the Django README §11.

### New sequence type

1. Add to `SequenceType` and `SEQUENCE_TYPES` in `data.ts`.
2. Handle forward + backward cases in `computeCpm`.
3. Handle the forward case in `autoSchedule` and `autoScheduleWorkdays`.
4. Update anchor logic in `ScheduleView.tsx` (`pIsStart`, `qIsStart`) if needed.
5. Backend: add to `ScheduleSequence.TYPE_CHOICES` (+ migration).

### Status date ("as of")

The backend stores `statusDate` on the schedule and returns it in the document. To use it: add `statusDate` to `ScheduleDoc` / `saveSchedule` in `api.ts`, pass it through `useScheduleSync` and `ScheduleView.tsx`, add a date picker in the header, and use it instead of `todayISO()` in `applyProgress`, `finalizeCompleted` and the in-progress actual bar.

### Enforce the baseline lock on the server

The UI already limits baseline editing to admins (**Set baseline**, the editor fields). It is **not** enforced server-side, so a non-admin can still change it via the API, **Paste JSON / Paste into selection / Import**, or a raw `PUT`. To close the gap: in Django, compare incoming `baselineStart` / `baselineFinish` with the stored values in `views.update` / `save_document` and return 403 (or ignore the change) for non-admin roles; optionally strip baseline fields for non-admins in `applySelection` (`JsonTool.tsx`) as well.

### Remaining-duration forecast

Currently an in-progress task keeps its original length from its actual start. A refinement is to forecast the finish from the **remaining** work, e.g. `ceil(duration × (1 − completion/100))` working days from today.

### Full working-day CPM

Replace `computeCpmWorkdays` with working-day arithmetic inside the forward/backward pass (`addWorkdays`, `nextWorkday`, `countWorkdays` are available).

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
- `setDurationWithCalendar` leaves baseline/actual untouched

### Completion rule

- `completionBlocker`: 100% with an unfinished predecessor → message; below 100% with a 100% successor → message; otherwise `null`

### Auto-schedule & normalisation

- Chain where successor start violates FS → pushed later; FS with lag > 0 → pushed by lag
- Locked tasks (actual start / progress) are never moved by links
- **Completed task** with a future planned finish or future actual finish → both clamped to today; actual start pulled to ≤ actual finish
- **0% task with a future actual start** → actual start cleared; task lands on today (or after its predecessor)
- **In-progress task** (actual start today, planned dates in the future) → planned start = actual start, same length, finish ≥ today; successors follow
- Workday variant: all starts are working days; a task over a holiday is stretched
- Group rows re-derive after Auto-schedule
- Baseline is preserved

### `wouldCycle`

- Self → true; A→B→C then C→A → true; A→B then B→A → true

### `flatten` / collapse

- Collapsed parent hides children; WBS numbering survives hierarchy changes

### `setDuration` / `setDurationWithCalendar`

- Calendar mode: preserves start, `finish = start + days - 1`, clamps to ≥ 1
- Working-day mode: start snaps to next workday, finish advances `days` working days

### Undo / redo

- Change a task, press Ctrl+Z → restored; Ctrl+Shift+Z → reapplied
- A slider drag produces one undo step
- Typing in a text/date/number field → Ctrl+Z is the browser's text undo, not the schedule's
- Delete a phase, then Undo → phase, children and links return and autosave persists them
- After switching schedule or Import, Undo is disabled

### UI (manual)

- At every zoom level the bars line up with their left-column rows (header heights match)
- Set baseline (admin) → grey bars appear; push a task later → Var shows `+Nd`, header shows "N late vs baseline"; Compare matches
- Slide a task to 100% → actual bar appears; turns orange if it finished after the baseline finish; blocked with a toast if a predecessor is below 100%
- **Group row in the editor:** date/duration/baseline/actual/% fields are disabled, links hidden, only name/code/remarks/parent save
- **Editor draft:** delete a successor, press Cancel → the link is still there; delete it, press Save → it is gone
- **Editor inputs:** type a full date like `15-10-2026` without it jumping; backspace the duration to empty, type `7` → finish updates
- **Non-admin** (member/manager): baseline fields disabled in the editor and the header has no **Set baseline**
- Client account: Set baseline, import, inputs, menus and Undo/Redo are hidden/disabled; Compare and export still work
- Empty project as a client: message + project picker; switching to another project loads it
- `/schedule` without params redirects (via `replaceState`) to a project that has a schedule

### Sync (manual / integration)

- Fresh project, editor account → **+ Create schedule** creates and seeds it; badge **Saved**; reload keeps data
- Edit anything → badge cycles Unsaved → Saving → Saved; refresh shows the edit
- Fresh load does **not** immediately show Unsaved (`stableKey` guard)
- Two tabs: edit in A, then in B → B shows **Out of date**; Reload gets A's change
- Stop Django, edit → **Save failed** + Retry; start Django, Retry → **Saved**
- Set a finish before a start → blocked by the pre-flight check with a reason; fix the date → saves
- Baseline/actual values survive a reload (confirms the backend maps the new fields)
- Dev strict mode on an empty project creates exactly **one** schedule

---

## 18. Known limitations / future work

- **Baseline is not locked server-side.** The UI limits it to admins, but any editor can still change it via the API, Paste JSON or Import (see §16).
- **No status date in the UI.** Auto-filled actual dates use today's date; the backend `statusDate` is unused by the frontend.
- **Forecast ignores remaining work.** Auto-schedule keeps an in-progress task's full original length from its actual start; CPM uses planned dates only.
- **Compare is baseline vs planned only** (not vs actual) and is a live view — there is no saved/dated comparison and no per-field change log.
- **No snapshot UI** (list / preview / restore / diff); the backend supports it.
- **Undo history is in memory only** (lost on refresh / schedule switch / import) and does not cover the working-days toggle.
- **No offline mode.** Edits made while the server is unreachable stay in memory only.
- **No merge on conflict.** 409 → Reload (local edits lost).
- **Whole-document autosave.** Every change re-sends the full schedule. Fine for hundreds of tasks.
- **Read-only mode is cosmetic**; the server is the real gate.
- **Group rows are derived and locked**, so a group cannot carry its own manual dates.
- **No resource / cost model.** `completion` is the only tracked metric.
- **Bars are not draggable.** Dates are edited via the table or the editor.
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
| `ROW_H` | 28 | `ScheduleView.tsx` | Pixel height of a Gantt/table row |
| `LEFT_COL_W` / `LEFT_COL_W_MOBILE` | 256 / 128 | `ScheduleView.tsx` | Width of the left task column (desktop / below 640 px) |
| `headerH` | `20 × rows + 1` | `ScheduleView.tsx` | Timeline/left header height (months + optional week + optional day row) |
| `ZOOM_MIN` / `ZOOM_MAX` | 0.5 / 80 | `ScheduleView.tsx` | px/day limits |
| `SHOW_DAY_GRID_ABOVE` | 6 | `ScheduleView.tsx` | px/day threshold for day gridlines |
| `SHOW_DAY_HEADER_ABOVE` | 14 | `ScheduleView.tsx` | px/day threshold for day numbers |
| `SHOW_WEEK_HEADER_ABOVE` | 4 | `ScheduleView.tsx` | px/day threshold for week labels |
| `SHOW_WEEK_GRID_ABOVE` | 4 | `ScheduleView.tsx` | px/day threshold for week gridlines |
| `MIN_MONTH_LABEL_W` | 34 | `ScheduleView.tsx` | Min px to show a full month label |
| `LINK_ARROW_GAP` / `LINK_LANE_OFFSET` | 6 / 4 | `ScheduleView.tsx` | Link geometry |
| `HIGHLIGHT_MS` | 2200 | `ScheduleView.tsx` | Duration of the flash highlight |
| `LONG_PRESS_MS` / `MOVE_TOLERANCE` | 400 / 10 | `ScheduleView.tsx` | Touch long-press tuning |
| `debounceMs` | 1500 | `useScheduleSync.ts` | Autosave debounce |
| `coalesceMs` / `limit` | 400 / 100 | `useUndo.ts` | Undo merge window / max history |
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
- The user must have an **admin, manager or member** role on a project (or be a superuser) to edit it; **client** is read-only; only **admin** can set or edit the baseline (UI). A project needs at least one schedule — an editor opening an empty project can create one.

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
| "No schedule has been created for this project yet." (non-editor) | The selected project has no schedule. Pick another project in the picker, or have an editor create one |
| "Couldn't load your projects" | `GET /api/schedules/projects/` failed — check auth token / CORS / `NEXT_PUBLIC_API_URL` |
| "You don't have access to any projects yet" | The user has no `ProjectMembership` / `OrganisationMembership` |
| `GET …/schedules/<id>/` 404 | Schedule id wrong, or the user has no role on its project (the API hides existence with 404) |
| 401 | Token missing/expired, or `authHeaders()` prefix wrong (`JWT` vs `Bearer`) |
| 403 on save | User is a client (not in `EDIT_ROLES`); page should be read-only for them |
| Badge **Out of date** | Another tab/user saved first → **Reload** |
| Badge **Save failed** + 400 text | Validation (finish before start, unknown parent, actual/baseline finish before start). Fix and edit again |
| Baseline / actual values vanish after reload | The backend isn't mapping the new fields — run the migration and deploy the updated `models.py` / `serializers.py` / `services.py` |
| Badge stuck on **Unsaved changes…** right after load | Compare-key issue; make sure `stableKey()` (key-sorted) is used and not plain `JSON.stringify` |
| "Rendered more hooks than during the previous render" | A hook was added below the early `return` gates in `ScheduleView.tsx` — move it above them |
| Gantt width wrong after load | The `ResizeObserver` effect must depend on `ready` |
| Bars drift away from their rows | Left and right header heights differ — both must use `headerH` |
| Two schedules created for one project (dev) | Strict-mode double effect; keep the `startedFor` guard; delete the extra in Django admin |
| URL changes to `?project=…&schedule=…` on load | Intended — the selection is mirrored into the URL for deep-linking |
| Thin grey bars under the task bars | Baseline bars (Show baseline & actual toggle). A grey bar to the right of a planned bar = forecast earlier than baseline |
| Completed task shows a future date | Run **Auto-schedule** (it clamps completed tasks to today) or save the task in the editor |
| Task with a future "actual start" never moves | Run **Auto-schedule** — the future actual start is dropped and the task is rescheduled |
| In-progress task stuck at old future planned dates | Run **Auto-schedule** — planned start follows the actual start |
| Group row dates look stale in the editor | Pass the **rolled** task (`rolled.find`) to `ActivityEditorModal`, not the stored one |
| TypeScript: missing `isAdmin` prop on `ActivityEditorModal` | Pass `isAdmin={isAdmin}`; the modal also takes `onApplyLinks` and no longer takes `onAddSequence` / `onUpdateSequence` / `onRemoveSequence` |
| Editor date jumps to a random year while typing | Use `DateField` (commits only plausible full dates) instead of a raw `type="date"` `onChange` |
| Can't backspace the duration to empty | Use `NumberInput` (text input with raw draft) instead of `type="number"` |
| Link changes in the editor apply without Save | Links must be edited via the draft (`draftLinks`) and applied through `onApplyLinks` |
| Undo history resets right after saving | `useScheduleSync` is calling `onLoaded` after its own save; skip it there |
| Ctrl+Z does nothing | Focus is in a text/number/date field (browser undo), a modal is open, or the user is read-only |
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
| **Group / header** | A task with children (a phase/summary); fully derived and locked |
| **Locked task** | A task with an actual start/finish or progress > 0; Auto-schedule never moves it via links |
| **Milestone** | A single-day marker; rendered as an amber bar |
| **Now** | The activity whose CPM window contains today |
| **Next up** | The next activity whose early start is after today |
| **Planned** | The current schedule dates (`scheduleStart` / `scheduleFinish`); they move as the plan changes |
| **Baseline** | The frozen approved plan (`baselineStart` / `baselineFinish`) used as the reference; admin-only to edit |
| **Actual** | What really happened (`actualStart` / `actualFinish`) |
| **Variance** | Planned (or actual) finish minus baseline finish, in days; + = late |
| **Slip** | Variance of the project's last finish date |
| **Status date** | The "as of" date for progress reporting (stored on the server; not yet used by the UI) |
| **Working calendar** | Rules defining non-working days (weekly + dates + ranges) |
| **Working-day mode** | CPM and durations respect the working calendar |
| **Draft (editor)** | The editor's local copy of fields and links; applied only on Save |
| **Seed** | Initial content uploaded when an editor creates a schedule |
| **Optimistic locking** | Saves carry the loaded `version`; the server rejects a stale one with 409 |
| **Snapshot** | Server-side full copy of a schedule at a point in time (restorable via API) |

---

*Last updated: October 2026 — group/header rows fully derived and locked (table + editor, `freezeIfLeaf` on delete/move), admin-only baseline editing in the UI, holiday-aware Auto-schedule that normalises completed / future-actual / in-progress tasks, completion rule (100% needs 100% predecessors), activity editor draft model (Save-only, `DateField` / `NumberInput`, links applied via `onApplyLinks`), undo/redo (`useUndo`), plus project picker + URL deep-linking, server-driven permissions (admin / manager / member edit, client read-only), baseline / actual tracking with a **Var** column, **Compare** panel, JSON import/export, orphan-sequence pruning and save pre-flight checks. Builds on the Django-backed persistence layer, working-day mode, editable Duration column, Now/Next stepper, and row action menu.*