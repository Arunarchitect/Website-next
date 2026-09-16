# Process Viewer — Architecture Reference

Internal reference doc for `app/process/*`. Read this before touching the
hook, the container, or the page — it explains *why* the code is split the
way it is, not just what each file does.

---

## File map

| File | Owns |
|---|---|
| `lib/process-utils.ts` | Pure data-in/data-out. Types (`ProcessNode`, `ProcessData`), rendering-only helpers (`getColorTheme`, `getLayout`), derived-state helpers (`isNodeComplete`, `isNodePartial`, `getNodeArea`, `formatArea`, `countNodes`, `getLeafIds`), relation sanitation. Zero React, zero state. |
| `hooks/useProcessEditor.ts` | All data-mutating state: the tree (`data`), completion set, edge styles, selection, the inline editor (title/description/**area**), the Add Process modal, delete/duplicate/move, relation add/delete/reverse, schema validation, undo/redo, copy/paste. |
| `components/ProcessContainer.tsx` | Renders one node and recurses into children. Calls callbacks (`onToggleComplete`, `onEditNode`, `onSelectNode`, `registerNodeRef`) but owns no app state. Computes each node's **display number** and **area line** from tree position/content. |
| `components/RelationshipArrows.tsx` | Draws directed arrows between nodes using positions supplied by `page.tsx`. |
| `page.tsx` | Only **view state**: pan, zoom, drag, pointer/wheel handling, node position measurement, PNG/SVG/PDF export, all the modals (save, load, add, edit, person manager, assign popup). Calls `useProcessEditor()` for everything data-related. |

**Why split this way:** "what the diagram *is*" (data model, edits,
relations, area) stays separate from "how you *look at* it" (camera,
rendering, export). The two rarely change together, and this split has held
up through every feature added so far (people, importance flags, area).

---

## Data model

```ts
type ProcessData = {
  title: string;
  description?: string;
  type?: string;
  width?: number;   // optional layout hint, px
  height?: number;  // optional layout hint, px (min-height only)
  completed?: string[];       // leaf IDs that are completed
  edgeStyles?: Record<string, { dashed?: boolean }>;
  persons?: Person[];         // global roster
  children?: ProcessNode[];
};

type ProcessNode = {
  id: string;              // must be unique across the whole tree
  label: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  predecessors?: string[]; // ids of predecessor nodes (same level)
  successors?: string[];   // ids of successor nodes (same level)
  assignedPersonIds?: string[]; // ids into ProcessData.persons — NOT inherited by children
  important?: boolean;
  area?: number;            // LEAF-ONLY explicit area (sqm) — see Area section below
  children?: ProcessNode[];
};

type Person = {
  id: string;
  name: string;
};
```

### Layout hints are advisory, not authoritative

- `width` is preferred, but capped at `maxWidth: 100%` of parent, so a huge stored width cannot overflow.
- `height` is minimum height (`minHeight`), never fixed. Boxes grow with content.

### Ordering

- Visual order follows the `children` array order.
- Relationships are explicit via `predecessors`/`successors`. They are **same-level only**.
- **Labels don't carry numbers.** `"1. Design Challenge Brief"` should just be `"Design Challenge Brief"` — numbering is computed and displayed automatically at render time, never stored in `label`.

---

## Numbering

Process numbers (`1.`, `1.2.`, `2.1.3.`, etc.) are **derived from array
position**, not stored data. Each `ProcessContainer` receives a
`numberPath: number[]` prop — its own index (1-based) appended to its
parent's path — and renders it as a prefix before the label.

- Root (level 0) is the canvas container and isn't numbered itself; numbering starts at its direct children.
- Because the number is computed from position, **adding, deleting, duplicating, or reordering nodes renumbers everything automatically**.
- The number is a pure display prefix. Editing a title via `openEditor`/`updateNode` only ever touches `node.label`.

---

## Completion logic

**Completion state is only stored for leaves** (nodes with no children),
and lives inside `useProcessEditor`:

```ts
const [completed, setCompleted] = useState<Set<string>>(new Set());
```

Parent status is derived every render:

| Function | Meaning |
|---|---|
| `isNodeComplete` | Leaf → in set? Parent → **all** children complete? |
| `isNodePartial` | Parent only. Some but not all descendants have progress. |

### Click behavior

1. **Leaf** → always toggles its own ID in `completed`.
2. **Parent already complete** → allowed; unchecks every leaf underneath.
3. **Parent not complete** → blocked. Shows a warning for ~3.2s.

### Progress counter

`editor.completedLeaves / editor.totalLeaves`, derived inside
`useProcessEditor` from `getLeafIds`.

### Persistence

- `editor.handleSave` exports the current state including `completed: string[]` and `edgeStyles`.
- `editor.handleUpload` rehydrates `completed` and `edgeStyles` from the uploaded JSON if present.
- **`completed` must list leaf ids.** Listing a parent id is silently ignored, since only leaf membership is checked.

---

## Area (zone/space rollup)

**Added to give a process tree a second, optional meaning: a zone made of
spaces, where each space has a floor area and the zone's area is the sum
of its spaces.** Fully opt-in — a document that never sets `area` on any
node renders byte-for-byte the same as before this feature existed.

### The rule

> **Only leaf nodes store `area`. A node with children never stores its
> own area — its area is always the derived sum of whichever of its
> children resolve to a number.**

This mirrors the completion-checkbox pattern (`isNodeComplete` /
`isNodePartial`) deliberately — same "leaf owns the fact, parent derives
it" shape, so the rollup logic is easy to reason about the same way.

### Types & core function (`lib/process-utils.ts`)

```ts
export type ProcessNode = {
  // ...
  area?: number; // leaf-only, sqm
};

export type AreaResult = {
  value: number | null; // null = "this node contributes nothing to area"
  partial: boolean;     // true = "some but not all of this node's children have area"
};

export function getNodeArea(node: ProcessNode): AreaResult {
  const children = node.children ?? [];

  if (children.length === 0) {
    return { value: typeof node.area === "number" ? node.area : null, partial: false };
  }

  const childResults = children.map(getNodeArea);
  const withArea = childResults.filter((r) => r.value !== null);

  if (withArea.length === 0) return { value: null, partial: false };

  const sum = withArea.reduce((total, r) => total + (r.value as number), 0);
  return { value: sum, partial: withArea.length < children.length };
}

export function formatArea(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return `${text} m²`;
}
```

`getNodeArea` is called fresh on every render, same as `isNodeComplete` —
tree sizes here are small (dozens of nodes), so this isn't a perf
concern. If a document ever grows into the hundreds of nodes, memoize
per-node results keyed on node identity before optimizing anything else.

### Mixed-children behavior (important)

If a parent's children are a mix of "has area" and "doesn't":

- **The sum only includes children that resolve to a number.** A child
  with no area is *skipped*, not treated as zero. This means the parent's
  number is never silently understated by an empty sibling — it's a real
  subtotal of what's known.
- `partial: true` flags exactly this situation, so the UI can mark the
  number as incomplete instead of presenting it as final (`Σ 60.5 m² ·
  partial` in amber vs. plain gray when complete).
- Nodes *without* area, when a sibling *does* have area, get a small
  amber `⚠ no area set` marker instead of staying silent — clicking it
  opens the area editor directly. If **no** sibling has area, the node
  renders with nothing extra at all (this is what keeps
  area-less documents visually identical to before the feature existed).

This warning-instead-of-blocking design was a deliberate choice: nothing
about the area feature ever prevents completing or saving a document.
It's an advisory layer on top of the existing tree, not a new
validation gate.

### Editing (`useProcessEditor.ts`)

- `editingField` is now `"label" | "description" | "area"`.
- `openEditor(id, "area", String(node.area ?? ""))` opens the same modal
  used for title/description, with a number input instead.
- `updateNode(id, "area", value)`:
  - empty string → **removes** `area` from the node entirely (so it goes
    back to contributing nothing, rather than storing `0`).
  - non-numeric or negative → input is ignored, prior value kept.
  - valid number → `node.area = parsed`.
  - Calling this with `field: "area"` on `id: "root"` is a no-op — the
    canvas/root never has its own area, only ever a derived total.
- `validateNodeShape` (upload validation) checks `area` is a
  non-negative number when present, same error-message style as the
  other field checks.

### Rendering (`ProcessContainer.tsx`)

Per node, in addition to the existing title/description/assigned-people
rows:

- **Leaf, `area` set** → blue text, `formatArea(node.area)`.
  Double-click (desktop) / long-press (mobile) opens the area editor —
  same interaction pattern as editing title/description.
- **Leaf, no `area`, but a sibling under the same parent has one** →
  faint amber `⚠ no area set`, clickable to add.
- **Leaf, no `area`, no sibling has one either** → nothing rendered.
  This is the "feature not in use here" case.
- **Parent, derived value present** → gray italic `Σ 142.5 m²` (amber +
  `· partial` if `partial: true`). Not directly editable — edit a leaf
  instead; the sum recalculates automatically on the next render.
- Never shown on the root/canvas node (`level > 0` guard, matching the
  existing pattern for the assigned-people row).

The parent component computes, for each set of siblings, whether *any*
child has area before rendering — that's what decides whether the
"no area set" warning shows on the ones that don't:

```ts
const childAreaResults = children.map(getNodeArea);
const anyChildHasArea = childAreaResults.some((r) => r.value !== null);
// passed down per-child as showAreaWarning={anyChildHasArea && childAreaResults[index].value === null}
```

### Toolbar (`page.tsx`)

- Header block shows a document-wide total under the "X / Y steps done"
  line, when the root resolves to a number:
  `rootAreaResult = rootNode ? getNodeArea(rootNode) : null` →
  `"{formatArea(value)} total"` (+ `" (partial)"` if partial).
- Action popup gets an **Edit Area** button, shown only when the
  selected node is a leaf (`children.length === 0`) and isn't `"root"`.
  Parents don't get this button — there's nothing to edit on them, the
  number is always derived.
- Edit modal branches on `editingField`: text input for label, textarea
  for description, `type="number" min={0} step="0.01"` for area, with a
  hint that leaving it empty removes the area.

### What's intentionally NOT built yet

- **Length × breadth.** Only raw `area` exists right now. If/when L×B is
  added: store `length?: number` and `breadth?: number` alongside `area`
  on the leaf, auto-compute `area = length * breadth` when both are
  present, and let a direct edit to `area` clear `length`/`breadth`
  (otherwise a hand-edited area could silently disagree with a stale
  L×B). Validate this in `validateNodeShape` the same way `area` is
  validated now.
- **Cost (`unit × price`).** Explicitly deferred — but the *shape* is
  meant to be reusable: a `getNodeCost` sibling to `getNodeArea` with the
  same `{ value, partial }` result, leaf-only `unitCount`/`unitPrice` (or
  a plain `cost`) fields, same mixed-children skip-not-zero sum, same
  partial flag, same warning-not-block UI treatment. Don't invent a
  different rollup pattern for it — copy this one.
- **Document-level "area plugin" toggle.** Considered and deliberately
  skipped in favor of auto-detect (presence of `area` anywhere = feature
  in use for that subtree). Revisit only if there's a real need to hide
  area numbers on a document that has them stored but doesn't want them
  shown (e.g. exporting a client-facing version).

---

## Relationships (predecessors / successors)

- Relationships are stored on nodes as arrays of IDs.
- **Same-level only** — a node can only relate to siblings under the same parent.
- The UI draws a directed arrow for every `successors` entry. The reverse `predecessors` entries are maintained for data consistency.
- All relation logic (`addRelation`, `deleteRelation`, `reverseRelation`, `toggleEdgeDashed`) lives in `useProcessEditor.ts`.

### Adding a relation

1. Click a node to select it.
2. Click **+ Successor** or **+ Predecessor** (sets `editor.pendingRelation`).
3. Click another node on canvas — `page.tsx`'s `handleNodeClick` forwards to `editor.handleNodeClick`, which creates the relation via `addRelation`.

### Deleting a relation

1. Click the arrow (line or end dot) → `editor.handleSelectEdge`, turns amber.
2. Click **Delete** in the action bar → `editor.deleteRelation`.

### Mutual pairs

If A→B and B→A both exist, `sanitizeProcessRelations` in
`process-utils.ts` marks both edges dashed rather than leaving two
overlapping solid arrows that read as a bug. Self-loops (a node listing
itself) are stripped outright.

---

## Deleting and duplicating a process

Both live in `useProcessEditor.ts`: `editor.deleteNode(id)` /
`editor.duplicateNode(id)`. Neither applies to the root node.

### Delete

1. Select a node, click **Delete**. Native `confirm()` warns if it has subprocesses (they're deleted too).
2. `deleteNode` removes the node and its subtree, then cleans up references everywhere else:
   - strips removed ids from `completed`
   - drops `edgeStyles` entries keyed on removed ids
   - strips removed ids out of every remaining node's `predecessors`/`successors`

### Duplicate

1. Select a node, click **Duplicate**.
2. `duplicateNode` clones the node and its full subtree with fresh ids (`cloneSubtreeWithNewIds`), appends `" (Copy)"` to the label, inserts as the next sibling.
3. `predecessors`/`successors` and `assignedPersonIds` are **dropped** on the clone — those pointed at the *original's* context and copying them verbatim would be wrong. `area` **is** copied (it spreads via `...node`), since a duplicated space plausibly has the same footprint until edited.

---

## Rendering (`ProcessContainer.tsx`)

For each node it renders, top to bottom:

1. **CompletionCheckbox** — checked/indeterminate/locked (derived, not local).
2. **Title** — prefixed with computed number, except at root. Double-click/long-press to edit via modal.
3. **Description** — same editing interaction, if present.
4. **Area** — see Area section above. Not shown on root.
5. **Assigned people** — click opens assign popup. Not shown on root.
6. **Children** — level 0 (top-level processes): horizontal grid. Level 1+: vertical stack.

Gaps: level 0 = `40px`, deeper levels = `24px` (room for arrows).

Colour families assigned at level 0 by `colorIndex = index`, inherited
down. Deeper levels are lightened versions.

---

## Canvas: zoom & pan (`page.tsx`)

- `zoom` (0.15–4) and `pan` (`{x, y}`) are plain state, owned entirely by `page.tsx` — the hook has no view state.
- Tree transformed with a single CSS `translate(...) scale(...)`.
- Mouse wheel zooms **towards the cursor**. Pinch works on touch. Drag pans with Pointer Capture.
- Hovering a node highlights it and its connected arrows (`editor.hoveredNodeId`).

### Buttons

| Button | Behavior |
|---|---|
| Reset | Fits the entire diagram into the viewport (`fitAllView`) |
| Upload | Load a JSON file (`editor.handleUpload`) |
| Save JSON | Download JSON including completed state, relations, area, etc. (`editor.handleSave`) |
| PNG | Export raster image at 3× resolution (`html2canvas`) |
| SVG | Export vector SVG (`html-to-image`) |
| PDF | Dialog for page size (A4/A3/A2) and orientation, then vector PDF via print |

### Action popup (per selected node)

| Button | Behavior |
|---|---|
| Edit Title / Edit Description | Opens the inline editor modal |
| Edit Area | **Leaf only.** Opens the same modal with a number input |
| + Successor / + Predecessor | Starts `pendingRelation`; click another node to link |
| Duplicate | Clones the node and its subtree as the next sibling |
| Delete | Removes the node and its subtree, after confirmation |
| ✕ *(next to a relation chip)* | Deletes just that relation |

---

## Editing

- **Double-click** title, description, or (leaf) area → modal opens via `editor.openEditor`.
- **Long-press** on mobile/pen → same modal.
- Modal has **Done** (`editor.submitEditor`) and **Cancel** (`editor.closeEditor`).
- Area uses a number input (`type="number" min={0} step="0.01"`) instead of text; leaving it empty on submit clears the area rather than being blocked (unlike label, which can't be empty).

---

## Export

Export logic stays in `page.tsx` since it operates on DOM refs
(`printRef`/`canvasRef`), not the data model. Area lines render as
ordinary DOM text, so they're captured by PNG/SVG/PDF export exactly
like title/description — no export-specific code needed for area.

### PNG
`html2canvas` at 3× scale, after fitting the full diagram into view.

### SVG
`html-to-image`, vector output.

### PDF
Dialog: page size (A4/A3/A2), orientation (portrait/landscape). Uses the
browser's print-to-PDF engine, scaled to fit. Text, arrows, numbering,
and area lines remain vector.

---

## Upload flow

1. `editor.handleUpload` reads the file with `FileReader`.
2. `JSON.parse` and validate (`title` required; per-node shape including `area` if present).
3. On success: sets `data`, resets `completed`/`edgeStyles`/selection from the JSON.
4. `page.tsx`'s `useEffect` on `editor.data` triggers `fitAllView()` next frame.
5. On failure: sets `editor.error`, shown as an error banner with a "download sample template" action.
6. File input value is reset so the same file can be re-uploaded.
7. Labels should **not** include manual numbering. `area` on a node with children is simply ignored by `getNodeArea` (it only reads `area` on leaves) — no upload error for it, but it will never show up anywhere, so don't rely on it being preserved round-trip through the UI (it round-trips fine through raw JSON, just never renders or sums).

---

## Mobile support

- **Touch action: none** on canvas to prevent browser scroll/zoom.
- **Pinch** to zoom at midpoint. **One finger drag** to pan.
- **Long press** to edit text (title/description/area).
- Toolbar is responsive and scrolls horizontally if needed.

---

## Extending this

- **Add total nodes stat**: `countNodes(rootNode)` already exists in `process-utils.ts`. Read it in `page.tsx`, drop into the toolbar.
- **Persist completion across reloads**: partially supported via JSON `completed` field already. Could layer `localStorage` on top.
- **New node-level field** (owner, due date, cost — see Area section for the cost plan specifically): add to `ProcessNode` in `process-utils.ts`, render in `ProcessContainer.tsx`, extend `editingField` union + `updateNode` in the hook if it needs inline editing. No other files need touching.
- **Length × breadth**: see "What's intentionally NOT built yet" under Area above — that's the exact spec to follow when this gets picked up.
- **Cost rollup**: see the same section — copy the `getNodeArea`/`AreaResult` shape, don't reinvent it.
- **Drag-to-reorder**: not implemented; node order follows `children` array order (numbering already tracks it automatically). Extend with drag events + a reorder function in `useProcessEditor.ts` alongside `addNodeToTree`.
- **New editing behavior** (bulk-delete, move a node to a different parent): add to `useProcessEditor.ts` alongside `deleteNode`/`duplicateNode`, expose from the hook's return object — `page.tsx` shouldn't touch `data` directly.
- **Custom numbering format**: change the one line in `ProcessContainer.tsx` that renders `numberPath.join(".")`.
- **Document-level toggle for any of the above** (area, cost, etc.): if ever needed, add a boolean to `ProcessData` (e.g. `areaEnabled`), gate the relevant renders on it, add a toolbar switch in `page.tsx`. Not currently implemented anywhere — auto-detect (presence of the field) is the pattern in use.