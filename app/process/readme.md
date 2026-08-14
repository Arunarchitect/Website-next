**Why split this way:**

- `process-utils.ts` has zero React and zero state. Pure data‑in, data‑out. Holds the shared `ProcessNode`/`ProcessData` types and rendering-only helpers (`getColorTheme`, `getLayout`, `isNodeComplete`, `isNodePartial`, `countNodes`, `getLeafIds`).
- `useProcessEditor.ts` is a custom hook that owns **all data-mutating state**: the process tree (`data`), completion set, edge styles, node/edge selection, the inline title/description editor, the "Add Process" modal, node delete/duplicate, and relation add/delete/reverse logic. It also exports the pure tree helpers (`findNodeById`, `updateNodeData`, `addNodeToTree`) so components outside the hook can use them without duplicating logic.
- `ProcessContainer.tsx` renders a node and recurses into children. It calls callbacks (`onToggleComplete`, `onEditNode`, `onSelectNode`, `registerNodeRef`) but never owns app state. It also computes each node's **display number** from its position in the tree — see [Numbering](#numbering) below.
- `RelationshipArrows.tsx` draws the directed arrows between nodes using node positions supplied by `page.tsx`.
- `page.tsx` owns only **view state**: pan, zoom, drag, pointer/wheel handling, node position measurement, and PNG/SVG/PDF export. It calls `useProcessEditor()` for everything data-related and wires the returned state/handlers into the toolbar, canvas, and modals.

This keeps "what the diagram *is*" (data model, edits, relations) separate from "how you *look at* the diagram" (camera, rendering, export) — the two rarely change together.

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
  edgeStyles?: Record<string, { dashed?: boolean }>;
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
- **Labels don't carry numbers.** `"1. Design Challenge Brief"` should just be `"Design Challenge Brief"` — numbering is computed and displayed automatically at render time (see below), never stored in `label`.

---

## Numbering

Process numbers (`1.`, `1.2.`, `2.1.3.`, etc.) are **derived from array position**, not stored data. Each `ProcessContainer` receives a `numberPath: number[]` prop — its own index (1-based) appended to its parent's path — and renders it as a prefix before the label..

- Root (level 0) is the canvas container and isn't numbered itself; numbering starts at its direct children.
- Because the number is computed from position, **adding, deleting, duplicating, or reordering nodes renumbers everything automatically** — there's nothing to keep in sync.
- The number is a pure display prefix. Editing a title via `openEditor`/`updateNode` only ever touches `node.label`; the number is never part of the stored or editable string.

---

## Completion logic

**Completion state is only stored for leaves** (nodes with no children), and lives inside `useProcessEditor`:

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
3. **Parent not complete** → blocked. Shows a warning for ~3.2s (`editor.warning`, set via `showWarning` inside the hook).

### Progress counter

`editor.completedLeaves / editor.totalLeaves`, both derived inside `useProcessEditor` from `getLeafIds`.

### Persistence

- `editor.handleSave` exports the current state including `completed: string[]` and `edgeStyles`.
- `editor.handleUpload` rehydrates `completed` and `edgeStyles` from the uploaded JSON if present.
- **`completed` must list leaf ids.** Listing a parent id (a node with `children`) is silently ignored by `isNodeComplete`/`isNodePartial`, since only leaf membership is checked — a parent shows complete only once *all* of its leaves are in the set.

---

## Relationships (predecessors / successors)

- Relationships are stored on nodes as arrays of IDs.
- They are **same-level only** — a node can only relate to siblings under the same parent.
- The UI draws a directed arrow for every `successors` entry.
- The reverse `predecessors` entries are maintained for data consistency.
- All relation logic (`addRelation`, `deleteRelation`, `reverseRelation`, `toggleEdgeDashed`) lives in `useProcessEditor.ts`.

### Adding a relation

1. Click a node to select it.
2. Click **+ Successor** or **+ Predecessor** in the action bar (sets `editor.pendingRelation`).
3. Click another node on canvas. `page.tsx`'s `handleNodeClick` forwards to `editor.handleNodeClick`, which creates the relation via `addRelation` and clears `pendingRelation`.

### Deleting a relation

1. Click the arrow itself (line or end dot) → `editor.handleSelectEdge`. It turns amber.
2. Click **Delete** in the action bar → `editor.deleteRelation`.

---

## Deleting and duplicating a process

Both live in `useProcessEditor.ts` and are exposed as `editor.deleteNode(id)` / `editor.duplicateNode(id)`. Neither applies to the root node.

### Delete

1. Select a node, click **Delete** in the action bar. A native `confirm()` warns if it has subprocesses (they're deleted too).
2. `deleteNode` removes the node and its whole subtree, then cleans up everywhere else that could reference it:
   - strips the removed ids from `completed`
   - drops any `edgeStyles` entries keyed on the removed ids
   - strips the removed ids out of every remaining node's `predecessors`/`successors`, so no arrow points at something that no longer exists
3. Selection/pending-relation state is cleared afterward.

### Duplicate

1. Select a node, click **Duplicate** in the action bar.
2. `duplicateNode` clones the node and its full subtree with fresh ids (`cloneSubtreeWithNewIds`), appends `" (Copy)"` to the label, and inserts it as the next sibling right after the original.
3. The clone's `predecessors`/`successors` are dropped rather than copied — those arrays point at the *original* node's same-level siblings, and copying them verbatim would draw arrows from the clone to nodes it was never actually meant to connect to. Add new relations for the clone manually if needed.
4. The clone becomes the new selection.

---

## Rendering (`ProcessContainer.tsx`)

For each node it renders:

1. **CompletionCheckbox** — checked/indeterminate/locked (derived, not local).
2. **Title** — prefixed with its computed number (e.g. `2.1.`), except at the root. Double-click (desktop) or long-press (mobile) to edit via modal (`editor.openEditor`) — the number itself isn't editable, only `label`.
3. **Description** — same editing interaction.
4. **Children**:
   - Level 0 (top-level processes): **horizontal grid**.
   - Level 1+: **vertical stack**.

Gaps have been increased to make room for arrows:

- Level 0 gap: `40px`
- Deeper levels: `24px`

Colour families are assigned at level 0 by `colorIndex = index` and inherited down. Deeper levels are lightened versions.

---

## Canvas: zoom & pan (`page.tsx`)

- `zoom` (0.15–4) and `pan` (`{x, y}`) are plain state, owned entirely by `page.tsx` — the hook has no view state.
- The tree is transformed with a single CSS `translate(...) scale(...)`.
- **Mouse wheel** zooms **towards the cursor** (not centre).
- **Pinch** works on touch devices.
- **Drag** pans with Pointer Capture.
- Hovering a node highlights it and its connected arrows (`editor.hoveredNodeId`, still stored in the hook since selection state is shared between the popup UI and the canvas).

### Buttons

| Button | Behavior |
|--------|----------|
| Reset | Fits the entire diagram into the viewport (`fitAllView`, in `page.tsx`) |
| Upload | Load a JSON file (`editor.handleUpload`) |
| Save JSON | Download JSON including completed state and relations (`editor.handleSave`) |
| PNG | Export raster image at 3× resolution (`page.tsx`, uses `html2canvas`) |
| SVG | Export vector SVG (`page.tsx`, uses `html-to-image`) |
| PDF | Opens dialog for page size (A4/A3/A2) and orientation (portrait/landscape), then prints to vector PDF (`page.tsx`) |

### Action popup (per selected node)

| Button | Behavior |
|--------|----------|
| Edit Title / Edit Description | Opens the inline editor modal |
| + Successor / + Predecessor | Starts `pendingRelation`; click another node to link |
| Duplicate | Clones the node and its subtree as the next sibling |
| Delete | Removes the node and its subtree, after confirmation |
| ✕ *(next to a successor/predecessor chip)* | Deletes just that relation |

---

## Editing

- **Double-click** title or description → modal opens via `editor.openEditor`.
- **Long-press** on mobile/pen → same modal.
- Modal has **Done** (`editor.submitEditor`) and **Cancel** (`editor.closeEditor`) buttons.
- Changes update the in-memory JSON (`editor.data`), which can be saved later.

---

## Export

Export logic stays in `page.tsx` since it operates on DOM refs (`printRef`/`canvasRef`), not on the data model.

### PNG

Captures the full diagram after fitting it into view. Uses `html2canvas` at 3× scale.

### SVG

Uses `html-to-image` to produce a vector SVG.

### PDF

Opens a dialog:

- Page size: **A4 / A3 / A2**
- Orientation: **Portrait / Landscape**

Then uses the browser's print-to-PDF engine. The diagram is scaled to fit the chosen page size. Text, arrows, and numbering remain vector.

---

## Upload flow

1. `editor.handleUpload` reads the file with `FileReader`.
2. `JSON.parse` and validate (`title` required).
3. On success: sets `data`, resets `completed`/`edgeStyles`/selection state from the JSON.
4. `page.tsx`'s `useEffect` on `editor.data` triggers `fitAllView()` on the next frame (zoom/pan reset stays a view concern).
5. On failure: sets `editor.error`, shown as an error banner.
6. File input value is reset so the same file can be re-uploaded.
7. Labels in the uploaded JSON should **not** include manual numbering — numbers are computed from `children` order on render regardless of what's in `label`.

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
- **New node-level field** (e.g. owner, due date): add to `ProcessNode` in `process-utils.ts`, render in `ProcessContainer.tsx`, no other changes needed.
- **Drag-to-reorder**: currently not implemented, but node order follows `children` array order (which numbering already tracks automatically); you can extend with drag events, adding a reorder function to `useProcessEditor.ts` alongside `addNodeToTree`.
- **New editing behavior** (e.g. bulk-delete, move a node to a different parent): add it to `useProcessEditor.ts` alongside `deleteNode`/`duplicateNode` and expose it from the hook's return object — `page.tsx` shouldn't need to touch `data` directly.
- **Custom numbering format** (e.g. `Step 1.2` or Roman numerals instead of `1.2.`): change the one line in `ProcessContainer.tsx` that renders `numberPath.join(".")` — the path itself doesn't need to change.