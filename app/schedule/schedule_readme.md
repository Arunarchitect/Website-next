# Schedule Component — Developer README (Next.js frontend)

A complete reference for the SREEKESH Project Work Schedule viewer/editor. Covers architecture, data model, every module, key algorithms (CPM, rollup, auto-schedule, working-day math), the Django sync layer, UI features, and extension points.

Backend counterpart: `schedule_django_readme.md`.

---

## 1. Overview

This is a **dependency-aware construction schedule** built as a Next.js 15 App Router page. It renders a full **Gantt chart** plus an **editable table**, computes the **critical path** using CPM, supports an optional **working-day calendar** (weekends + holidays + shutdown ranges), highlights **Now / Next** activities, and supports full **CRUD** on activities and their hierarchy.

All scheduling logic (CPM, rollup, auto-schedule, calendar math) runs **client-side**. Persistence is handled by a **Django REST backend**: the page loads the schedule on mount and **autosaves** the whole document (debounced) with optimistic locking.

Key capabilities:

- Hierarchical work breakdown (phases → activities), collapsible
- Editable table (name, dates, duration, %, predecessors, successors)
- Full-screen editor modal for a single activity
- Row action menu (edit / add child / add sibling / move into / delete)
- Dependency editing (FS / SS / FF / SF with lag)
- CPM with early/late starts, total float, and critical-path highlighting
- **Working-day mode** with a configurable calendar (weekly off, holiday dates, shutdown ranges)
- Automatic **rollup** of group rows from their children
- **Auto-schedule** — pushes successors later when a link is violated
- **Now / Next** strip with a countdown chip and a queue stepper
- **Search** — jump-to-task, expands ancestors, flashes the row
- **Print / PDF** export via `window.print()`
- **Duration edit** — changing days shifts the finish date; start stays
- Responsive Gantt zoom (elastic fit-to-width + manual zoom)
- **Autosave to Django** with a status badge (Saved / Saving / Unsaved / Out of date …)
- **Conflict detection** (409) when another tab/user saved first
- **Read-only mode** for users without edit rights (members / clients)

---

## 2. File layout

```
app/schedule/
├── data.ts                 ← Types + demo/seed schedule (tasks, sequences), helpers
├── calendar.ts             ← Pure working-calendar math (defines DAY)
├── scheduling.ts           ← Pure date/hierarchy helpers (no React)
├── cpm.ts                  ← CPM math + Now/Next + format helpers (no React)
├── api.ts                  ← fetch wrapper + typed Django endpoints (no React)
├── useScheduleSync.ts      ← Load / seed / debounced autosave / conflict hook
├── SyncBadge.tsx           ← Save-status chip + Retry / Reload buttons
├── page.tsx                ← Main page: Gantt, table, wiring, state
├── SearchAct.tsx           ← Searchable jump-to-task dropdown
├── PrintAct.tsx            ← Print / Save-as-PDF button + print stylesheet
├── Calendar.tsx            ← Calendar UI (button + modal + chips)
├── ActivityEditor.tsx      ← Edit modal + row action menu
└── README.md               ← This file
```

**Dependency direction** (nothing imports from `page.tsx`, and there are no cycles):

```
calendar.ts        ← defines DAY; no imports from the app
    ▲
    ├── scheduling.ts    (imports DAY + holiday helpers)
    ├── cpm.ts           (imports from calendar + scheduling, re-exports DAY)
    ├── Calendar.tsx     (imports from calendar + cpm + scheduling)
    │
data.ts  ◄── api.ts ◄── useScheduleSync.ts ◄── page.tsx  (imports from everything, plus UI components + SyncBadge)
```

- **Pure modules**: `calendar.ts`, `scheduling.ts`, `cpm.ts`, `api.ts` — no React, no DOM state. The first three are unit-testable in Node.
- **UI modules**: `page.tsx` + `Calendar.tsx`, `SearchAct.tsx`, `PrintAct.tsx`, `ActivityEditor.tsx`, `SyncBadge.tsx`. All schedule state lives in `page.tsx`; children are presentational.
- **Sync module**: `useScheduleSync.ts` owns *only* the server round-trip (ids, versions, status). It does not own the schedule data; `page.tsx` does.
- **`DAY` lives in `calendar.ts`** and is re-exported by `cpm.ts` so both `import { DAY } from "./cpm"` and `import { DAY } from "./calendar"` work.

---

## 3. Data model (`data.ts`)

Field names mirror **IFC4x3** so a later import/export is a 1:1 mapping. They are also exactly the JSON field names the Django API sends and expects (camelCase) — no mapping layer.

### `Task`

| Field | Type | IFC equivalent | Notes |
|---|---|---|---|
| `id` | string | `IfcTask.GlobalId` | Stable, unique, **client-generated**. e.g. `a-plast`. Stored server-side as `task_id` |
| `name` | string | `IfcTask.Name` | Display name |
| `parentId` | string \| null | `IfcRelNests` | Null = top-level |
| `scheduleStart` | `YYYY-MM-DD` | `IfcTaskTime.ScheduleStart` | Inclusive |
| `scheduleFinish` | `YYYY-MM-DD` | `IfcTaskTime.ScheduleFinish` | Inclusive. Server rejects finish < start |
| `completion` | 0–100 | `IfcTaskTime.Completion` | Percent |
| `isMilestone` | boolean | `IfcTask.IsMilestone` | Single-day marker |
| `remarks` | string? | — | Free text, shown on Now/Next |
| `workCode` | string? | — | Source code, e.g. `"7-9"` |
| `linkedElements` | string[]? | `IfcRelAssignsToProcess` | Reserved for future |

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

### `demoSchedule` is now only a **seed**

`data.ts` still exports `demoSchedule` (the SREEKESH programme). It is **no longer the initial state**. `page.tsx` starts with empty `tasks` / `sequences` and fills them from the server. `demoSchedule` is used for two things only:

1. **First-time seeding:** if the project has no schedule on the server and the user can edit, the hook creates one and uploads `demoSchedule` (+ a default calendar).
2. The static page heading (`demoSchedule.name`) — the server-side `Schedule.name` is not displayed yet.

After seeding, edits to `data.ts` have **no effect** on an existing server schedule.

### Reference date

`data.ts` uses a hardcoded reference of **2026-10-02**. Tasks whose `scheduleFinish` is earlier are auto-completed (`completion: 100`) **when the seed is built**. This only matters for the first upload; afterwards the stored `completion` values are authoritative. Change `TODAY` / `TODAY_DAY` in `data.ts` only if you re-seed.

---

## 4. `calendar.ts` — pure working-calendar math

No React, no DOM. **This is the lowest-level module — it defines `DAY` and imports nothing from the app.**

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

**Rule priority:** a day is non-working if it matches **any** of weekly / specific dates / ranges. No exceptions.

**Guards:** `nextWorkday` / `prevWorkday` stop after 400 iterations to prevent infinite loops if the calendar marks everything off.

---

## 5. `scheduling.ts` — pure date & hierarchy helpers

No React, no DOM. **Imports `DAY` and holiday helpers from `calendar.ts`.**

| Export | Signature | What it does |
|---|---|---|
| `toDay` | `(iso) => number` | ISO date → day number |
| `toISO` | `(day) => string` | Day number → ISO date |
| `addDays` | `(iso, n) => string` | Shift ISO date by `n` calendar days |
| `durationDays` | `(task) => number` | Inclusive calendar duration |
| `todayISO` | `() => string` | Local today as ISO |
| `flatten` | `(tasks, collapsed) => Row[]` | Tree → visible rows with depth + WBS |
| `descendantIds` | `(tasks, id) => Set` | All descendants |
| `ancestorIds` | `(tasks, id) => Set` | All ancestors |
| `rollup` | `(tasks) => Task[]` | Group dates/% derived from children |
| `autoSchedule` | `(tasks, seqs) => Task[]` | Forward pass; push successors later |
| `wouldCycle` | `(seqs, pred, succ) => boolean` | Cycle check |
| `setDuration` | `(task, newDays) => Task` | Change days; shifts finish by **calendar** days |
| `durationWorkdays` | `(task, cal?) => number` | Working-day duration (falls back to calendar) |
| `setDurationWithCalendar` | `(task, newDays, cal?) => Task` | Change days; shifts finish by **working** days |
| `hasHolidayInside` | `(task, cal) => boolean` | True if the span touches a holiday |

### `flatten` — row model

```ts
interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
  wbs: string;   // "1", "1.2", "1.2.3"
}
```

The Gantt left column, table, and selection all operate on `Row[]`. `wbs` is regenerated on every flatten so it always reflects current hierarchy. **Sibling order = array order** in `tasks`; the server preserves it via an `order` column.

### `rollup` — summary tasks

Group rows (any task that has children) get:

- `scheduleStart` = earliest child start
- `scheduleFinish` = latest child finish
- `completion` = duration-weighted average of children
- `isMilestone = false`

Called automatically before every render of `rolled`. **Group dates are not editable** — only leaves. Stored group dates are overwritten on render, so stale values on the server are harmless.

### `autoSchedule` — forward pass

Iterative forward pass over the sequence list, repeated until stable (bounded by `tasks.length + 1` iterations). For each violated link, pushes the successor's start later (never earlier). Respects all four sequence types + lag. Triggered by the **Auto-schedule** button.

### `wouldCycle` — safety

DFS from `successor` following outgoing links. If it reaches `predecessor`, the link would create a cycle. Used by every add-link path. (The server does **not** check dependency cycles — this is the only guard.)

### Duration helpers

- `setDuration(task, newDays)` — **calendar-day** behaviour: `finish = start + newDays - 1`.
- `setDurationWithCalendar(task, newDays, cal?)` — **working-day** behaviour: snaps start to next workday, then advances `newDays` working days. Passing `cal = undefined` falls back to calendar-day behaviour.

---

## 6. `cpm.ts` — critical path & Now/Next

No React. **Imports from `data.ts`, `scheduling.ts`, `calendar.ts`; re-exports `DAY` from `calendar.ts`.**

### `computeCpm(tasks, seqs) → CpmResult`

Full **forward pass + backward pass** over the **leaf tasks** (groups are ignored — they inherit from children).

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
2. **Topological sort** (Kahn). If a cycle survives (shouldn't — `wouldCycle` prevents them), fall back to insertion order.
3. **Forward pass**: `ES = max(manualStart, constraint from each predecessor)`, then `EF = ES + dur - 1`.
4. **Backward pass** (reverse topo): `LF = min(constraint from each successor)`, else `projectFinish`. `LS = LF - dur + 1`.
5. **Total float** = `LS - ES`. Any task with `float ≤ 0` → **critical**.

A task's **manual start date** acts as a floor: `ES = max(manual, computed)`. So links can only push work later, never pull it earlier.

### Sequence-type constraint math

| Type | Forward: `ES_successor ≥` | Backward: `LF_predecessor ≤` |
|---|---|---|
| `FINISH_START` | `EF_pred + 1 + lag` | `LS_succ - 1 - lag` |
| `START_START` | `ES_pred + lag` | `LS_succ - lag + dur_pred` |
| `FINISH_FINISH` | `EF_pred + lag - dur_succ` | `LF_succ - lag` |
| `START_FINISH` | `ES_pred + lag - dur_succ` | `LF_succ - lag + dur_pred` |

`lag` may be negative (a **lead**).

### `computeCpmWorkdays(tasks, seqs, cal) → CpmResult`

Working-day version of CPM.

**Strategy:**

1. Snap every leaf task's dates to the working calendar:
   - Start = `nextWorkday(task.scheduleStart, cal)`
   - Preserve the working-day count: `wd = countWorkdays(snappedStart, task.scheduleFinish, cal)`
   - Finish = `addWorkdays(snappedStart, wd, cal)`
2. Run the standard `computeCpm` on the snapped tasks.
3. Convert float from calendar days to working days per task.

**Accuracy note:** this is a **deliberately simplified** approach — not a full working-day backward pass. It gives correct critical-path **membership** and reasonable working-day **float** for typical construction schedules. For schedules with long shutdowns *inside* chains, a full working-day forward/backward pass would be more accurate.

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
| `listSchedules(projectId)` | `GET /api/schedules/?project=<id>` → `{ canEdit, results[] }` |
| `getSchedule(id)` | `GET /api/schedules/<id>/` → `ScheduleDoc` |
| `createSchedule(project, name)` | `POST /api/schedules/` |
| `saveSchedule(id, { version, tasks, sequences, calendar })` | `PUT /api/schedules/<id>/` → `{ version, updatedAt }` |
| `ApiError` | Thrown for non-2xx; has `.status` and `.body` |

- Base URL: `NEXT_PUBLIC_API_URL` (default `https://api.modelflick.com`), prefixed with `/api`.
- **Auth is in one place — `authHeaders()`.** It currently reads `localStorage["access"]` and sends `Authorization: JWT <token>`. Adapt to your scheme (`Bearer`, or return `{}` for httpOnly cookies — `credentials: "include"` is always set).
- Error messages are extracted from DRF bodies (`detail`, `non_field_errors`, else JSON).

### 7.2 `useScheduleSync.ts`

```ts
const sync = useScheduleSync({
  projectId, seed, tasks, sequences, calendar /* serialized */, onLoaded,
});
// → { status, canEdit, savedAt, message, saveNow, reload }
```

The hook does not hold the schedule data — `page.tsx` passes the current `tasks`/`sequences`/serialized `calendar` in, and receives the loaded data through `onLoaded`.

**Load flow (on mount, once per project id):**

1. `listSchedules(projectId)` → sets `canEdit`.
2. **No schedule exists:** if `canEdit` → `createSchedule` + `saveSchedule(seed)` and call `onLoaded(seed)`; else status `empty`.
3. **Schedule exists:** `getSchedule(results[0].id)` → remember `id` + `version` → `onLoaded(...)`. Status `saved` (editable) or `readonly`.
4. Server `calendar` of `null` falls back to the seed's default calendar.

**Save flow (debounced 1500 ms after any change):**

1. Compare current payload to `lastSaved` (key-sorted JSON). No change → nothing.
2. `PUT` with the remembered `version`. On success store the returned `version`.
3. If edits happened while the request was in flight (`queued`), flush again.
4. **409** → status `conflict` (autosave stops). **Other error** → status `error` (retries on next change or via the Retry button).

**Status machine:**

| Status | Meaning | Autosave |
|---|---|---|
| `loading` | initial fetch / reload | off |
| `saved` | in sync | on |
| `dirty` | local changes waiting for debounce | on |
| `saving` | request in flight | on |
| `error` | last save failed (message shown) | on (retry on next change) |
| `conflict` | version mismatch (another tab/user saved) | **off** — user must Reload |
| `readonly` | loaded, no edit rights | off |
| `empty` | no schedule and cannot create | off |
| `failed` | load failed (auth/network/bad project id) | off |

**Implementation details worth knowing:**

- **`stableKey()` compares key-sorted JSON.** Postgres `jsonb` reorders object keys, so the calendar returned by the server can serialize differently from what was sent. A naive `JSON.stringify` compare would mark the page dirty immediately after every load and save forever.
- **Strict-mode guard (`startedFor` ref).** React dev strict mode runs effects twice; without the guard, an empty project would create two schedules.
- **`beforeunload` warning** while status is `dirty`, `saving` or `error`.
- **Refs, not state, for ids/versions/flags** so the debounced callback never closes over stale values.
- The first load is **not** treated as a change: `lastSaved` is set to the loaded payload before `onLoaded` runs.

### 7.3 `SyncBadge.tsx`

Coloured chip with the status text (+ time of last save), **Retry** on `error`, **Reload** on `conflict` / `failed`, and the error message inline. Marked `data-print-hide`.

### 7.4 Conflict behaviour

Two tabs / users editing the same schedule: the second save gets 409 → badge shows **Out of date**. There is **no merge**; **Reload** discards local unsaved edits and fetches the latest. Open tabs also conflict with restores done through the API.

---

## 8. `page.tsx` — the main page

The only file with **schedule React state**. Everything else is derived.

### State

| State | Type | Purpose |
|---|---|---|
| `tasks` | `Task[]` | The whole task list (flat). **Starts empty; filled by `onLoaded`** |
| `sequences` | `Sequence[]` | The whole link list. **Starts empty; filled by `onLoaded`** |
| `collapsed` | `Set<string>` | Collapsed group ids |
| `zoom` | `number` | Pixels per day |
| `autoFit` | `boolean` | If true, `zoom` recalculated to fit width |
| `showLinks` | `boolean` | Toggle dependency arrows |
| `showCritical` | `boolean` | Toggle critical-path highlight |
| `picker` | `{ taskId, mode } \| null` | Which dependency picker is open |
| `menuFor` | `string \| null` | Which row action menu is open |
| `editingId` | `string \| null` | Which task is in the edit modal |
| `selectedId` | `string \| null` | Currently selected row |
| `flashId` | `string \| null` | Row currently flashing (picked) |
| `nextIdx` | `number` | Index into the upcoming queue |
| `containerW` | `number` | Container width (tracked by `ResizeObserver`) |
| `calendar` | `WorkingCalendar` | Holiday rules. **Stored on the server with the schedule** (no longer `localStorage`) |
| `calendarOpen` | `boolean` | Is the calendar modal open |
| `useWorkdays` | `boolean` | Is working-day mode enabled (session-only, not persisted) |

### Sync-related values

| Value | Derivation |
|---|---|
| `calendarSer` | `useMemo(() => serialize(calendar), [calendar])` — the serialized form passed to the hook (memoised so identity is stable) |
| `sync` | `useScheduleSync({...})` |
| `readOnly` | `!sync.canEdit` |
| `ready` | `sync.status` not in `loading` / `empty` / `failed` — gates the `ResizeObserver` effect, because the Gantt isn't mounted while loading |
| `PROJECT_ID` | `Number(process.env.NEXT_PUBLIC_SCHEDULE_PROJECT_ID)` |
| `SEED` | `{ tasks: demoSchedule.tasks, sequences: demoSchedule.sequences, calendar: serialize(emptyCalendar()) }` (module-level constant) |

### Hooks-before-return rule

`page.tsx` returns early for `loading` / `empty` / `failed`. **Every hook (`useState`, `useMemo`, `useEffect`, the sync hook) must be declared above those early returns** (they sit right after the `links` memo). Any hook added below them breaks React's rules and will throw "rendered more hooks than during the previous render" when the status changes. Non-hook helpers (`rangeFor`, `handleRowAction`, countdown classes) live below the gates.

### Read-only mode

When `readOnly`: hidden — row `⋯` menu, ✎ quick-edit, `+ New phase`, `Auto-schedule`, Calendar button/modal, `+ predecessor` / `+ successor`, link `×`. Disabled — date inputs, duration input, % slider, link type/lag selects. Viewing, searching, zoom, print and the Working-days toggle still work. This is **UI only**; the server returns 403 on writes from non-editors.

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
│  Task list   │  ┌─── header: months (h-5) ────┐               │
│  (rows)      │  ├─── header: weeks (h-5) ─────┤               │
│              │  ├─── header: days (h-5) ──────┤               │
│              │  ├─── body (rows.length*28) ───┤               │
│              │  │   grid / today / bars / links / bands       │
│              │  └───────────────────────────────┘               │
└──────────────┴───────────────────────────────────────────────┘
```

- **Row height** `ROW_H = 28` px.
- **Bar height** 12 px, offset `+8` within row → visually centered.
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

When `useWorkdays` is on:

- Weekend days → `bg-gray-50` / `bg-gray-100`
- Holiday days (weekday + matched rule) → `bg-pink-50` / `bg-pink-100`
- Holiday takes precedence over weekend for the pink tint

When off, only weekends are shaded.

### Dependency arrow geometry

Each link is an orthogonal path anchored to bar edges:

- **x1** — right edge of predecessor bar for FS/FF; left edge for SS/SF (+ gap)
- **x2** — left edge of successor bar for FS/SS; right edge for FF/SF (− gap)
- **y1, y2** — vertical center of each row

**Forward links** (`x2 ≥ x1`): `M x1 y1 H midX V y2 H x2`

**Backward links** (`x2 < x1`, e.g. negative lead): routed via a lane just above the successor row.

**Critical links are drawn twice** — once in the base SVG (under bars) and once in an overlay SVG at `z-20` — so the red path is never hidden.

### Selection & flash

- Clicking a row or bar sets `selectedId` → blue highlight in the left column, the table, and a blue band across the Gantt body.
- Picking from search or the stepper also sets `flashId` for ~2.2 s → yellow pulse band, auto-cleared.
- Selecting a **group row** toggles its collapse.

### CRUD handlers (in `page.tsx`)

| Handler | Effect |
|---|---|
| `addChild(parentId)` | Create task, expand parent, open editor, select + flash |
| `addSibling(task)` | `addChild(task.parentId ?? null)` |
| `deleteTask(id)` | Recursive: removes task + descendants + touching sequences |
| `updateTask(id, patch)` | Shallow merge into one task |
| `moveTask(id, target)` | Re-parent; expands new parent; selects + flashes |
| `updateDates(id, start, finish)` | Direct set of both dates |
| `updateDuration(id, newDays)` | Uses `setDurationWithCalendar`; respects working-day mode |
| `updateCompletion(id, pct)` | Clamped 0–100 |
| `handlePick(...)` | Adds a sequence (with `wouldCycle` check) |
| `updateSequence(id, patch)` | Edits type or lag |
| `removeSequence(id)` | Deletes one link |

All mutators use `setTasks(prev => …)` / `setSequences(prev => …)` — pure functional updates. **They only change local state; the sync hook notices the change and autosaves.** There is no per-handler API call.

### Cascade cleanup on delete

When a task is deleted:

- All descendants (stack-walk) removed from `tasks`
- Every sequence touching a removed id removed from `sequences`
- `selectedId`, `flashId`, `picker`, `menuFor`, `editingId` cleared if they pointed at anything removed

(Deletion is destructive after confirm: the next autosave replaces the server copy. The server keeps throttled auto snapshots, but there is no restore UI yet.)

---

## 9. `Calendar.tsx` — working-calendar UI

Three named exports:

### `<CalendarButton calendar onOpen />`

Small header button. Shows a summary chip (`"2 weekly · 0 single · 1 ranges"`). Marked `data-print-hide`. Hidden in read-only mode.

### `<CalendarModal calendar onChange onClose />`

Full-screen modal with three tabs:

| Tab | Controls |
|---|---|
| **Weekly off** | Chip toggle for each weekday. Red = off. Default Sat + Sun. |
| **Specific dates** | Add a single date + optional name (e.g. "Diwali"). Sorted list, Remove buttons. |
| **Shutdown ranges** | Add start + end + name (e.g. "Onam"). Sorted by start. Remove buttons. |

Bottom of the modal:

- **Preview strip** — always visible; shows working/non-working days for the current month so you can see the impact of edits.
- **Reset to default** — wipes everything back to Sat + Sun off.
- **Done** — closes.

Escape closes; clicking the backdrop closes; clicking inside doesn't. Calendar edits flow through `setCalendar` → `calendarSer` → autosave like any other change.

### `<CalendarChips calendar />`

Inline read-only chips for the header:

- `Off: Sat, Sun` (gray) if any weekly days are off
- `N holidays` (amber) if there are specific dates
- `N shutdowns` (orange) if there are ranges

Or "No holidays — every day is a working day" if nothing is configured.

---

## 10. `SearchAct.tsx` — jump-to-task

- Search box in the header. Filters **leaves only** by name, work code, or id.
- Up to 12 results, sorted by start date.
- Keyboard: **↑/↓** to move, **Enter** to pick, **Esc** to close.
- On pick: calls `onExpand(ancestorIds)` to un-collapse the path, then `onSelect(id)`.
- The parent does the scroll-into-view + flash.

Props:

```ts
{
  tasks: Task[];
  onSelect: (id: string) => void;
  onExpand: (ids: string[]) => void;
}
```

---

## 11. `PrintAct.tsx` — print / save as PDF

- A button that calls `window.print()`.
- Adds a `<style jsx global>` that, in `@media print`:
  - Sets **A4 landscape** with 12 mm margins
  - Hides anything with `data-print-hide` plus all `button`, `input[type=range]`, `input[type=checkbox]`
  - Renders `input[type=date]` as plain text
  - Tightens table padding and font size
  - Lets scroll containers expand so the whole Gantt prints

The user picks **"Save as PDF"** in the browser dialog — no external dependency.

Elements marked with `data-print-hide` in `page.tsx`: the header button cluster (sync badge / search / calendar / working-days checkbox / print / new phase / expand / collapse / auto-schedule) and the zoom bar. The Now/Next strip is **not** hidden — it's useful printed context.

---

## 12. `ActivityEditor.tsx` — edit modal + row menu

### `<ActivityEditorModal task tasks onSave onDelete onClose />`

Full-screen dialog with fields:

- Name
- Work code
- Parent group (dropdown; **hides itself and all descendants**)
- Start / Finish (native date inputs)
- Completion slider
- Milestone checkbox
- Remarks textarea
- Two-step Delete confirmation

**Escape** or backdrop click closes; clicks inside don't.

### `<RowMenu task tasks onAction onClose />`

Small dropdown from the `⋯` cell in the table. Actions:

| Action | Effect |
|---|---|
| Edit… | Opens the modal |
| Add child… | `addChild(task.id)` |
| Add sibling… | `addSibling(task)` |
| Move into… | Inline `<select>` of valid parents; picking re-parents |
| Delete… | Native `confirm()`, then recursive delete |

### `isDescendant(tasks, taskId, candidateParentId)`

Exported pure helper. True if `candidateParentId` is inside `taskId`'s subtree (or is itself). Used by **both** the modal's parent dropdown and the row menu's *Move into* to prevent cycles at the UI level (the server also rejects parent cycles).

### `MoveTarget` and `RowMenuAction`

```ts
type MoveTarget = { kind: "root" } | { kind: "under"; id: string };

type RowMenuAction =
  | { kind: "edit" }
  | { kind: "addChild" }
  | { kind: "addSibling" }
  | { kind: "delete" }
  | { kind: "move"; target: MoveTarget };
```

---

## 13. Key workflows

### First load of a brand-new project

1. Page mounts → `listSchedules` returns no schedule.
2. If the user is admin/manager: schedule is created and `demoSchedule` is uploaded; the page renders it. Badge: **Saved**.
3. If the user is a member/client: page shows "No schedule has been created for this project yet."

### Adding a new activity

1. Row menu on the intended parent group → **Add child…**, or header **+ New phase** for a top-level group.
2. New task is created with today as both start and finish, selected, flashed, and the modal opens for naming.
3. Save closes the modal; the task stays selected. Badge goes **Unsaved changes… → Saving… → Saved**.

### Adding a dependency

1. In the table, on a leaf, click **+ predecessor** or **+ successor**.
2. A searchable popover opens listing eligible tasks. Duplicates and cycles are hidden.
3. Click any row to add a `FS 0d` link.
4. Inline chip appears — change type (`FS/SS/FF/SF`), edit lag, or remove with `×`.

### Changing duration

The **Dur** column is editable. Typing a new value:

- Preserves `scheduleStart`
- Shifts `scheduleFinish` by the same delta
- In **calendar mode**: `finish = start + days - 1`
- In **working-day mode**: start snaps to next workday, finish advances `days` working days

Duration clamps to ≥ 1. Recomputes bar width, arrows, float, CPM, Now/Next immediately.

### Stepping through upcoming work

- **Next up** card shows the first leaf whose early start is after today.
- **◀ / ▶** cycles through the whole queue from `upcomingQueue`.
- Chip shows "in N days" / "tomorrow" / "today" — colour-coded red (≤2), amber (≤7), gray.
- **Jump to activity →** scrolls to it in the table.
- **Next activity ▶** advances the stepper.

### Auto-schedule

Calls `autoSchedule(tasks, sequences)` — walks the sequence list, pushes any successor whose start violates a link later. Mutates `tasks` (then autosaves). Never pulls work earlier.

### Working-day mode

1. Click **Calendar** in the header to open the modal (editors only).
2. Configure weekly off days, holiday dates, and shutdown ranges.
3. Rules are saved **to the server with the schedule** (autosave) and shared by everyone on that schedule.
4. Check **Working days** in the header.
5. Now: CPM uses `computeCpmWorkdays`, durations in the table reflect working days, Gantt body shows pink bands on holidays, and duration edits respect the calendar.

The **Working days** checkbox itself is not persisted — turn it on each session. The old `localStorage` key `schedule.calendar.v1` is no longer read or written.

### Recovering from "Out of date"

Badge shows **Out of date** → someone else saved first. Click **Reload** to fetch the latest. Your unsaved local edits are discarded.

### Print / PDF

Click **Print / PDF**. The browser opens the print dialog with:

- A4 landscape
- Only the useful parts visible (Gantt + Now/Next + table)
- All controls and scrollbars hidden
- Tables tightened for print legibility

Choose "Save as PDF" from the destination dropdown to save.

---

## 14. Styling conventions

- **Tailwind CSS** throughout. Print stylesheet uses `styled-jsx`.
- Colours:
  - Blue `#3b82f6` — normal task bars, "Now" card
  - Red `#dc2626` — critical bars, critical arrows, today line
  - Amber `#f59e0b` — milestones, specific-date holiday chips
  - Orange `#f97316` — shutdown-range chips
  - Pink `#fdf2f8` / `#fce7f3` — Gantt holiday shading
  - Gray `#374151` — group (summary) bars
  - Green `#10b981` — "Next up" card
- Sync badge colours: green saved · amber unsaved · blue saving · red error/conflict/failed · gray loading/readonly/empty
- Sizes:
  - `ROW_H = 28` px
  - `LEFT_COL_W = 256` px
  - Bar height 12 px, top offset 8
  - Left indent 14 px (Gantt), 16 px (table) per depth level

---

## 15. Extension points

### Adding a new field to `Task`

Frontend:

1. Add to the interface in `data.ts`.
2. Add to the factory `T(...)` if it should be seeded.
3. Optionally expose in `ActivityEditorModal`.
4. Optionally display in the table (`<th>` + `<td>`).
5. `rollup` / `computeCpm` don't need changes unless the field affects dates or hierarchy.

**Backend (required, or the field is silently dropped on save):**

6. Add a field to `ScheduleTask` (+ migration), the `TaskIn` serializer, `ScheduleTask.to_dict()`, and the constructor call in `save_document()`. See the Django README §11.

### New sequence type

1. Add to `SequenceType` in `data.ts`.
2. Add to `SEQUENCE_TYPES` for the UI label.
3. Handle forward + backward cases in `computeCpm` (`cpm.ts`).
4. Handle the forward case in `autoSchedule` (`scheduling.ts`).
5. Update anchor logic in `page.tsx` (`pIsStart`, `qIsStart`) if the new type anchors differently.
6. Backend: add to `ScheduleSequence.TYPE_CHOICES` (+ migration).

### Full working-day CPM

Replace `computeCpmWorkdays` with a version that does working-day arithmetic inside the forward/backward pass. `calendar.ts` already exposes `addWorkdays`, `nextWorkday`, and `countWorkdays` for that.

### Version history UI (backend already supports it)

The Django API exposes snapshot list / read / create / restore. A "Versions" modal would: list snapshots, open one read-only (render the same Gantt from `snapshot.tasks`/`sequences` with all editing disabled and a banner), and offer **Restore** (then replace local state with the returned document and update the version in the hook — easiest is to call `sync.reload()`). Note the backend's auto-snapshot retention is short; see the Django README §8.1 / §10.

### Schedule selector

The model supports several schedules per project (BASELINE / PLANNED / ACTUAL). The hook currently loads `results[0]`; add a selector and pass the chosen id.

### Real IFC import/export

Field names align with IFC4x3:

| This model | IFC |
|---|---|
| `WorkSchedule` | `IfcWorkSchedule` |
| `Task` | `IfcTask` + `IfcTaskTime` |
| `parentId` | `IfcRelNests` |
| `Sequence` | `IfcRelSequence` |
| `linkedElements` | `IfcRelAssignsToProcess` |

Write a mapper that walks `IfcTask` instances, resolves `IfcRelNests` into `parentId`s, and reads `IfcRelSequence` into your `Sequence[]`. Everything else works unchanged (an import is just a `PUT`).

---

## 16. Testing checklist

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

### `autoSchedule`

- Chain where successor start violates FS → pushed later
- FS with lag > 0 → successor pushed by lag
- Never pulls earlier when manual start is already later

### `wouldCycle`

- Self → true
- A→B→C, add C→A → true
- A→B, add B→A → true

### `flatten` / collapse

- Collapsed parent hides children
- WBS numbering survives hierarchy changes

### `setDuration` / `setDurationWithCalendar`

- Calendar mode: preserves start, `finish = start + days - 1`, clamps to ≥ 1
- Working-day mode: start snaps to next workday, finish advances `days` working days

### Sync (manual / integration)

- Fresh project, editor account → schedule created + seeded; badge **Saved**; reload keeps data
- Edit anything → badge cycles Unsaved → Saving → Saved; refresh shows the edit
- Fresh load does **not** immediately show Unsaved (guards the `stableKey` / jsonb reorder issue)
- Two tabs: edit in A, then edit in B → B shows **Out of date**; Reload gets A's change
- Member/client account → inputs disabled, edit controls hidden, no autosave requests fired
- Stop Django, edit → badge **Save failed** + Retry; start Django, Retry → **Saved**
- Set a finish before a start → **Save failed** with the reason; fix the date → saves
- Missing/incorrect `NEXT_PUBLIC_SCHEDULE_PROJECT_ID` → "Couldn't load the schedule" with a clear message
- Dev strict mode on an empty project creates exactly **one** schedule

---

## 17. Known limitations / future work

- **No offline mode.** Edits made while the server is unreachable stay in memory only; closing the tab triggers the browser's "unsaved changes" prompt.
- **No merge on conflict.** 409 → Reload (local edits lost).
- **Whole-document autosave.** Every change re-sends the full schedule. Fine for hundreds of tasks.
- **No undo/redo.** Delete is destructive after confirm (server auto snapshots exist but no restore UI yet).
- **No version-history UI** (backend supports snapshots).
- **Page heading is static** (`demoSchedule.name`), not the server's `Schedule.name`.
- **Loads the first schedule of the project** (`results[0]`); no selector.
- **Read-only mode is cosmetic**; the server is the real gate.
- **No resource / cost model.** `completion` is the only tracked metric.
- **Bars are not draggable.** Dates are edited via the table.
- **No zoom with ctrl+wheel or pinch.** Only the slider / +− buttons.
- **Print relies on the browser's save-as-PDF.** jsPDF + html2canvas would give byte-identical output.
- **`computeCpmWorkdays` is approximate.** It snaps dates and converts float, but the pass itself is on calendar days.
- **Milestones are cosmetic.** Rendered as amber bars; same CPM math as regular tasks.
- **No baseline comparison.** Would need a second schedule (BASELINE) and a diff view.
- **Calendar is one-per-schedule.** Per-group or per-resource calendars would need a `calendarId` field on `Task`.

---

## 18. Quick reference — constants

| Constant | Value | Where | Meaning |
|---|---|---|---|
| `DAY` | 86400000 | `calendar.ts` (re-exported by `cpm.ts`) | Milliseconds per day |
| `TODAY` | `"2026-10-02"` | `data.ts` | Reference date for auto-completion **of the seed** |
| `ROW_H` | 28 | `page.tsx` | Pixel height of a Gantt/table row |
| `LEFT_COL_W` | 256 | `page.tsx` | Width of the left task column |
| `ZOOM_MIN` | 0.5 | `page.tsx` | Min px/day |
| `ZOOM_MAX` | 80 | `page.tsx` | Max px/day |
| `SHOW_DAY_GRID_ABOVE` | 6 | `page.tsx` | px/day threshold for day gridlines |
| `SHOW_DAY_HEADER_ABOVE` | 14 | `page.tsx` | px/day threshold for day numbers |
| `SHOW_WEEK_HEADER_ABOVE` | 4 | `page.tsx` | px/day threshold for week labels |
| `SHOW_WEEK_GRID_ABOVE` | 4 | `page.tsx` | px/day threshold for week gridlines |
| `MIN_MONTH_LABEL_W` | 34 | `page.tsx` | Min px to show a full month label |
| `LINK_ARROW_GAP` | 6 | `page.tsx` | Gap between bar edge and arrow start |
| `LINK_LANE_OFFSET` | 4 | `page.tsx` | Vertical lane offset for backward links |
| `HIGHLIGHT_MS` | 2200 | `page.tsx` | Duration of the flash highlight |
| `PROJECT_ID` | env | `page.tsx` | `Number(NEXT_PUBLIC_SCHEDULE_PROJECT_ID)` — Django `Project` id |
| `SEED` | demo data | `page.tsx` | Uploaded once to an empty project |
| `debounceMs` | 1500 | `useScheduleSync.ts` | Autosave debounce |
| `BASE` | env | `api.ts` | `NEXT_PUBLIC_API_URL` (default `https://api.modelflick.com`) + `/api` |

*(Removed: `CALENDAR_STORAGE_KEY` — the calendar is no longer stored in `localStorage`.)*

---

## 19. Environment & setup

`.env.local` (frontend root, next to `package.json`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SCHEDULE_PROJECT_ID=<Django Project id>
```

- `NEXT_PUBLIC_*` values are **baked in at build time**. Restart `npm run dev` after changing them; for Docker/production, pass them as build args so they exist during `next build`:
  ```dockerfile
  ARG NEXT_PUBLIC_API_URL
  ARG NEXT_PUBLIC_SCHEDULE_PROJECT_ID
  ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
  ENV NEXT_PUBLIC_SCHEDULE_PROJECT_ID=$NEXT_PUBLIC_SCHEDULE_PROJECT_ID
  ```
- Adapt `authHeaders()` in `api.ts` to your auth scheme.
- Django must allow the Next origin and the `Authorization` header in CORS.
- The user must have an **admin or manager** role on the project (or be a superuser) to create/seed the first schedule.

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
| `GET …/schedules/?project=NaN` 404 | `NEXT_PUBLIC_SCHEDULE_PROJECT_ID` not set / not picked up. File must be `.env.local` in the frontend root, exact variable name, then **restart dev server** (or rebuild the image) |
| "Couldn't load the schedule: NEXT_PUBLIC_SCHEDULE_PROJECT_ID is not set…" | Same as above (the hook's guard message) |
| `GET …/schedules/?project=1` 404 | Project id doesn't exist, or the logged-in user has no membership on it (the API hides existence with 404). Check in Django shell. Also verify `path("api/", include("schedule.urls"))` |
| 401 | Token missing/expired, or `authHeaders()` prefix wrong (`JWT` vs `Bearer`) |
| 403 on save | User is a member/client; page should be read-only for them |
| Badge **Out of date** | Another tab/user saved first → **Reload** |
| Badge **Save failed** + 400 text | Validation (finish before start, unknown parent). Fix and edit again |
| Badge stuck on **Unsaved changes…** right after load | Compare-key issue; make sure `stableKey()` (key-sorted) is used and not plain `JSON.stringify` |
| "Rendered more hooks than during the previous render" | A hook was added below the early `return` gates in `page.tsx` — move it above them |
| Gantt width wrong after load | The `ResizeObserver` effect must depend on `ready` |
| Two schedules created for one project (dev) | Strict-mode double effect; keep the `startedFor` guard in the hook; delete the extra in Django admin |
| **If you see `Module not found: Can't resolve './cpm'` or similar** | Verify the file exists with a resolvable extension (`.ts`, not `.txt`) |
| **If you see `Export X doesn't exist in target module`** | That export genuinely isn't declared — grep: `grep -rn "export function <name>" app/schedule/` |
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
| **Rollup** | Deriving a group's dates/% from its children |
| **FS / SS / FF / SF** | Finish-Start, Start-Start, Finish-Finish, Start-Finish dependency types |
| **Lag / Lead** | Positive delay / negative delay in a link |
| **Leaf** | A task with no children (an actual activity) |
| **Group** | A task with children (a phase/summary) |
| **Milestone** | A single-day marker; rendered as a diamond/amber bar |
| **Now** | The activity whose CPM window contains today |
| **Next up** | The next activity whose early start is after today |
| **Working calendar** | Rules defining non-working days (weekly + dates + ranges) |
| **Working-day mode** | When enabled, CPM and durations respect the working calendar |
| **Seed** | `demoSchedule` uploaded once to an empty project |
| **Optimistic locking** | Saves carry the loaded `version`; the server rejects a stale one with 409 |
| **Snapshot** | Server-side full copy of a schedule at a point in time (restorable via API) |

---

*Last updated: Django-backed persistence (`api.ts` / `useScheduleSync.ts` / `SyncBadge.tsx`), calendar stored server-side, read-only mode, optimistic-locking conflicts; builds on the multi-file split (`calendar.ts` / `scheduling.ts` / `cpm.ts` / `page.tsx` + the four UI components), working-day mode, editable Duration column, Now/Next stepper, and row action menu.*