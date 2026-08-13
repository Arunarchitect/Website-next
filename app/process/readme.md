# Process Viewer (Updated)

An interactive, pannable/zoomable tree diagram for visualizing a nested process (process → subprocess → sub-subprocess…), loaded from a JSON file, with:

- per-leaf completion tracking
- **predecessor/successor relationships** drawn as curved arrows
- **inline editing** of node titles/descriptions
- **relation management** (add/delete arrows)
- **export** to PNG, SVG, or vector PDF
- full **mobile/touch support** (pinch zoom, long-press edit)

---

## File structure

```
app/page.tsx                     Home — owns all state, toolbar, canvas, modals
components/ProcessContainer.tsx  CompletionCheckbox + ProcessContainer (rendering, editing, selection)
components/RelationshipArrows.tsx  SVG curved arrows for predecessor/successor relations
lib/process-utils.ts             Types, tree math, colors, sizing (no React)
```

**Why split this way:**

- `process-utils.ts` has zero React and zero state. Pure data‑in, data‑out.
- `ProcessContainer.tsx` renders a node and recurses into children. It calls callbacks (`onToggleComplete`, `onEditNode`, `onSelectNode`, `registerNodeRef`) but never owns app state.
- `RelationshipArrows.tsx` draws the directed arrows between nodes using node positions supplied by `page.tsx`.
- `page.tsx` owns all global state: upload, zoom, pan, completed set, selection, relation editing, export.

---

## Data model

```ts
type ProcessData = {
  title: string;
  description?: string;
  type?: string;
  width?: number;   // optional layout hint, px
  height?: number;  // optional layout hint, px (min-height only)
  completed?: string[]; // leaf IDs that are completed
  children?: ProcessNode[];
};

type ProcessNode = {
  id: string;           // must be unique across the whole tree
  label: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  predecessors?: string[]; // ids of predecessor nodes (same level)
  successors?: string[];   // ids of successor nodes (same level)
  children?: ProcessNode[];
};
```

### Layout hints are advisory, not authoritative

- `width` is preferred, but capped at `maxWidth: 100%` of parent, so a huge stored width cannot overflow.
- `height` is minimum height (`minHeight`), never fixed. Boxes grow with content.

### Ordering

- Visual order follows the `children` array order.
- Relationships are explicit via `predecessors`/`successors`. They are **same-level only**.

---

## Completion logic

**Completion state is only stored for leaves** (nodes with no children).

```ts
const [completed, setCompleted] = useState<Set<string>>(new Set());
```

Parent status is derived every render:

| Function          | Meaning                                                            |
|--------------------|---------------------------------------------------------------------|
| `isNodeComplete`   | Leaf → in set? Parent → **all** children complete?                  |
| `isNodePartial`    | Parent only. Some but not all descendants have progress.            |

### Click behavior

1. **Leaf** → always toggles its own ID in `completed`.
2. **Parent already complete** → allowed; unchecks every leaf underneath.
3. **Parent not complete** → blocked. Shows a warning for ~3.2s.

### Progress counter

`completedLeaves / totalLeaves` computed from `getLeafIds`.

### Persistence

- `Save JSON` exports the current state including `completed: string[]`.
- On upload, if JSON contains `completed`, it is rehydrated into the set.

---

## Relationships (predecessors / successors)

- Relationships are stored on nodes as arrays of IDs.
- They are **same-level only** — a node can only relate to siblings under the same parent.
- The UI draws a directed arrow for every `successors` entry.
- The reverse `predecessors` entries are maintained for data consistency.

### Adding a relation

1. Click a node to select it.
2. Click **Add Successor** or **Add Predecessor** in the action bar.
3. Click another node on canvas. The relation is created, and an arrow appears.

### Deleting a relation

1. Click the arrow itself (line or end dot). It turns amber.
2. Click **Delete Selected Arrow** in the action bar.

---

## Rendering (`ProcessContainer.tsx`)

For each node it renders:

1. **CompletionCheckbox** — checked/indeterminate/locked (derived, not local).
2. **Title** — double-click (desktop) or long-press (mobile) to edit via modal.
3. **Description** — same editing interaction.
4. **Children**:
   - Level 0 (top-level processes): **horizontal grid**.
   - Level 1+: **vertical stack**.

Gaps have been increased to make room for arrows:

- Level 0 gap: `40px`
- Deeper levels: `24px`

Colour families are assigned at level 0 by `colorIndex = index` and inherited down. Deeper levels are lightened versions.

---

## Canvas: zoom & pan

- `zoom` (0.15–4) and `pan` (`{x, y}`) are plain state.
- The tree is transformed with a single CSS `translate(...) scale(...)`.
- **Mouse wheel** zooms **towards the cursor** (not centre).
- **Pinch** works on touch devices.
- **Drag** pans with Pointer Capture.
- Hovering a node highlights it and its connected arrows.

### Buttons

| Button | Behavior |
|--------|----------|
| Reset | Fits the entire diagram into the viewport |
| Upload | Load a JSON file |
| Save JSON | Download JSON including completed state and relations |
| PNG | Export raster image at 3× resolution |
| SVG | Export vector SVG |
| PDF | Opens dialog for page size (A4/A3/A2) and orientation (portrait/landscape), then prints to vector PDF |

---

## Editing

- **Double-click** title or description → modal opens with input/textarea.
- **Long-press** on mobile/pen → same modal.
- Modal has **Done** and **Cancel** buttons.
- Changes update the in-memory JSON, which can be saved later.

---

## Export

### PNG

Captures the full diagram after fitting it into view. Uses `html2canvas` at 3× scale.

### SVG

Uses `html-to-image` to produce a vector SVG.

### PDF

Opens a dialog:

- Page size: **A4 / A3 / A2**
- Orientation: **Portrait / Landscape**

Then uses the browser's print-to-PDF engine. The diagram is scaled to fit the chosen page size. Text and arrows remain vector.

---

## Upload flow

1. Read file with `FileReader`.
2. `JSON.parse` and validate (`title` required).
3. On success: set data, reset zoom/pan/completed, load `completed` if present.
4. Trigger `fitAllView()` on next frame.
5. On failure: show error banner.
6. File input value is reset so the same file can be re-uploaded.

---

## Mobile support

- **Touch action: none** on canvas to prevent browser scroll/zoom.
- **Pinch** to zoom at midpoint.
- **One finger drag** to pan.
- **Long press** to edit text.
- Toolbar is responsive and scrolls horizontally if needed.

---

## Extending this

- **Add total nodes stat**: `countNodes(rootNode)` already exists in `process-utils.ts`. Just read it in `page.tsx` and drop it into the toolbar.
- **Persist completion across reloads**: already partially supported via JSON `completed` field. Could also use `localStorage`.
- **New node-level field** (e.g. owner, due date): add to `ProcessNode`, render in `ProcessContainer.tsx`, no other changes needed.
- **Drag-to-reorder**: currently not implemented, but node order follows `children` array order; you can extend with drag events and update the array.