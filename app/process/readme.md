# Process Viewer

An interactive, pannable/zoomable tree diagram for visualizing a nested
process (process → subprocess → sub-subprocess…), loaded from a JSON file,
with per-leaf completion tracking.

## File structure

```
app/page.tsx                     Home — owns all state, toolbar, canvas
components/ProcessContainer.tsx  CompletionCheckbox + ProcessContainer (pure rendering)
lib/process-utils.ts             Types, tree math, colors, sizing (no React)
```

**Why split this way:** `process-utils.ts` has zero React and zero state —
it's just data in, data out, so it's the easiest place to reason about or
unit-test the completion logic. `ProcessContainer.tsx` renders a node and
recurses into its children, but never touches state directly — it only
calls `onToggleComplete(node)` and lets the parent decide what happens.
`page.tsx` is the only file that owns `useState`/`useRef` — uploading,
zoom, pan, and the completed-leaf set all live there.

---

## Data model

A JSON file uploaded by the user has this shape:

```ts
type ProcessData = {
  title: string;
  description?: string;
  width?: number;   // optional layout hint, px
  height?: number;  // optional layout hint, px (min-height only)
  children?: ProcessNode[];
};

type ProcessNode = {
  id: string;        // must be unique across the whole tree
  label: string;
  description?: string;
  width?: number;
  height?: number;
  children?: ProcessNode[];
};
```

`ProcessData` (the uploaded file) is wrapped into a synthetic root
`ProcessNode` with `id: "root"` inside `page.tsx`, so the rest of the app
only ever deals with one node type.

### Layout hints are advisory, not authoritative

- `width` is a *preferred* size, but every node is also capped at
  `maxWidth: 100%` of its parent, so a bad/huge stored width can never make
  a box overflow its container.
- `height` is a *minimum* height (`minHeight`), never a fixed height — the
  box always grows with its content, so text or children can never be
  clipped.

This means the JSON can be sloppy about sizing without breaking the
diagram.

---

## Completion logic (the part worth remembering)

**Completion state is only ever stored for leaf nodes** (nodes with no
`children`). It lives in a single `Set<string>` of leaf IDs, in
`page.tsx`:

```ts
const [completed, setCompleted] = useState<Set<string>>(new Set());
```

Parent nodes **never** get their own entry in that set. Instead, a
parent's status is *derived* every render by walking its subtree:

| Function          | Meaning                                                            |
|--------------------|---------------------------------------------------------------------|
| `isNodeComplete`   | Leaf → is it in the set? Parent → are **all** children complete?    |
| `isNodePartial`    | Parent only. True if *some but not all* descendants have progress.  |

This derivation is what makes the checkbox UI (checked / indeterminate /
unchecked) "just work" without ever getting out of sync with its children
— there is nothing to keep in sync, because the parent state doesn't
exist independently.

### Click behavior (`toggleComplete` in `page.tsx`)

1. **Click a leaf** → always allowed. Adds/removes that one leaf's `id`
   from the `completed` set.
2. **Click a parent that is already 100% complete** → allowed, and
   unchecks *every leaf underneath it* in one action (undo a whole
   branch).
3. **Click a parent that is not yet 100% complete** → blocked. Nothing is
   toggled; instead a temporary warning banner is shown
   ("`X` can't be checked off yet — complete every subprocess underneath
   it first.") for ~3.2 seconds via `showWarning`.

The intent: you can't shortcut a branch by checking its parent — every
subprocess underneath has to be completed individually first — but once
it's fully complete, checking/unchecking the parent is a convenient
bulk-toggle.

### Progress counter

The toolbar shows `completedLeaves / totalLeaves`, both computed from
leaves only (`getLeafIds`), since leaves are the only nodes with "real"
independent state. `countNodes` (counts every node, not just leaves) is
kept in `process-utils.ts` for future use but isn't currently displayed.

---

## Rendering (`ProcessContainer.tsx`)

`ProcessContainer` is a single recursive component. For each node it
renders:

1. A checkbox row (`CompletionCheckbox`) — checked/indeterminate/locked
   are all derived props, not local state.
2. An optional description.
3. Its children, laid out differently depending on depth:
   - **Level 0** (the root's direct children — the top-level processes):
     arranged **horizontally** in a CSS grid, one column per child.
   - **Level 1+** (everything deeper): stacked **vertically** with flexbox.

Each top-level process (level 0's children) is assigned its own color
family (`colorIndex = index` at level 0), and every node below it inherits
that same `colorIndex` so a whole branch stays visually grouped. Deeper
levels just get progressively lighter versions of the same base color
(`lighten()` in `process-utils.ts`).

Text size and padding shrink with depth via `getLayout(level)` — level 0
is the largest/boldest, level 3+ is the smallest, and anything past index
3 in `getLayout`'s array reuses the level-3 sizing.

---

## Canvas: zoom & pan (`page.tsx`)

- `zoom` (number, 0.15–4) and `pan` (`{x, y}` in px) are plain state.
- The whole tree renders once, absolutely positioned and centered, inside
  a wrapper (`canvasRef`) that gets a single combined
  `translate(...) scale(...)` transform — panning and zooming don't
  re-layout anything, they're pure CSS transforms.
- **Mouse wheel** (`handleWheel`) multiplies zoom by 0.9/1.1 per tick.
- **Drag to pan** (`handlePointerDown/Move/Up`) tracks the pointer delta
  from where the drag started and adds it to the pan value that was
  active when the drag began (`panStart.current`), using native Pointer
  Capture so dragging keeps working even if the cursor leaves the canvas.

### "Reset" vs "Reset Format"

These are two different, intentionally separate behaviors:

- **Reset** (`fitAllView`) — measures the diagram's *natural, unscaled*
  size (by briefly forcing `scale(1)`, measuring, then restoring) against
  the visible viewport size, and picks the largest zoom that fits it all
  with padding. This runs automatically once, on a `requestAnimationFrame`,
  every time a new file is uploaded.
- **Reset Format** (`resetFormatView`) — ignores content size entirely and
  just goes back to the plain default: `zoom = 1`, `pan = {0, 0}`.

---

## Upload flow (`handleUpload` in `page.tsx`)

1. Reads the selected file as text via `FileReader`.
2. `JSON.parse`s it and does minimal validation (must be an object, must
   have a `title`) — anything else throws and is caught.
3. On success: sets `data`, resets `zoom`/`pan`/`completed` for a clean
   slate, and the `useEffect` on `data` triggers `fitAllView()` on the
   next frame.
4. On failure: clears `data` and shows an inline error banner
   ("Invalid JSON file...").
5. The file input's value is reset after reading so the same file can be
   re-uploaded (e.g. after editing it) and still fire `onChange`.

---

## Extending this

- **Add a "total nodes" stat**: `countNodes(rootNode)` already exists in
  `process-utils.ts` — just read it in `page.tsx` (it's currently computed
  but unused/void'd) and drop it into the toolbar string.
- **Persist completion across reloads**: serialize `Array.from(completed)`
  to `localStorage`/a backend on change, and rehydrate into a `Set` on
  load — the rest of the completion logic needs no changes since it's all
  derived from that one set.
- **New node-level field** (e.g. an owner or due date): add it to
  `ProcessNode` in `process-utils.ts`, then render it inside
  `ProcessContainer.tsx` — no changes needed to `page.tsx` or the
  completion logic.