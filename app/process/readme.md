# Process Viewer — Architecture Reference

Internal reference doc for `app/process/*`. Read this before touching the hook, the container, or the page — it explains *why* the code is split the way it is, not just what each file does.

---

## File map

| File | Owns |
|---|---|
| `lib/process-utils.ts` | Pure data-in/data-out. Types (`ProcessNode`, `ProcessData`, `ValueDef`, `UnitOption`, `ValueResult`), rendering-only helpers (`getColorTheme`, `getLayout`), derived-state helpers (`isNodeComplete`, `isNodePartial`, `getNodeValue`, `formatValue`, `resolveValueDef`, `resolveUnit`, `toDisplay`, `toBase`, `hasAnyValue`, `countNodes`, `getLeafIds`), the preset catalog (`VALUE_PRESETS`), migration (`migrateProcessData`), relation sanitation. Zero React, zero state. |
| `hooks/useProcessEditor.ts` | All data-mutating state: the tree (`data`), completion set, edge styles, selection, the inline editor (title / description / **value**), the Add Process modal, delete/duplicate/move, relation add/delete/reverse, schema validation, undo/redo, copy/paste, and the document-level value system (`valueDef`, `displayUnit`, `setValueDef`, `setDisplayUnit`). |
| `components/ProcessContainer.tsx` | Renders one node and recurses into children. Calls callbacks (`onToggleComplete`, `onEditNode`, `onSelectNode`, `registerNodeRef`) but owns no app state. Computes each node's **display number** and **value line** from tree position/content. |
| `components/RelationshipArrows.tsx` | Draws directed arrows between nodes using positions supplied by `page.tsx`. |
| `page.tsx` | Only **view state**: pan, zoom, drag, pointer/wheel handling, node position measurement, PNG/SVG/PDF export, all the modals (save, load, add, edit, person manager, assign popup, value panel). Calls `useProcessEditor()` for everything data-related. |

**Why split this way:** "what the diagram *is*" (data model, edits, relations, the value system) stays separate from "how you *look at* it" (camera, rendering, export). The two rarely change together, and this split has held up through every feature added so far (people, importance flags, area, and the single-value system with unit switching).

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

  /**
   * What the leaf numbers mean, and their conversion table.
   * One per document. See the Value section below.
   */
  valueDef?: ValueDef;

  /**
   * Which display unit is currently selected. Purely cosmetic — stored
   * values are always in `valueDef.unit` (the base unit). Missing/unknown
   * falls back to the base.
   */
  displayUnit?: string;

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

  /**
   * LEAF-ONLY. One number, in the document's BASE unit (see
   * ProcessData.valueDef). Parents never store their own value — theirs is
   * always the derived sum of whichever children resolve to a number.
   */
  value?: number;

  /** @deprecated legacy alias for `value`. Migrated on load. */
  area?: number;

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

Process numbers (`1.`, `1.2.`, `2.1.3.`, etc.) are **derived from array position**, not stored data. Each `ProcessContainer` receives a `numberPath: number[]` prop — its own index (1-based) appended to its parent's path — and renders it as a prefix before the label.

- Root (level 0) is the canvas container and isn't numbered itself; numbering starts at its direct children.
- Because the number is computed from position, **adding, deleting, duplicating, or reordering nodes renumbers everything automatically**.
- The number is a pure display prefix. Editing a title via `openEditor`/`updateNode` only ever touches `node.label`.

---

## Completion logic

**Completion state is only stored for leaves** (nodes with no children), and lives inside `useProcessEditor`:

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

`editor.completedLeaves / editor.totalLeaves`, derived inside `useProcessEditor` from `getLeafIds`.

### Persistence

- `editor.handleSave` exports the current state including `completed: string[]` and `edgeStyles`.
- `editor.handleUpload` rehydrates `completed` and `edgeStyles` from the uploaded JSON if present.
- **`completed` must list leaf ids.** Listing a parent id is silently ignored, since only leaf membership is checked.

---

## Value (one number per document, with units)

**Added to give a process tree one optional numeric meaning — a zone made of spaces, a budget made of line items, a distance made of segments — where each leaf carries a number and the parent's number is the sum of its leaves. The document decides what that number *is* and how to display it.** Fully opt-in — a document that never sets `value` on any node renders byte-for-byte the same as before this feature existed.

### The rule

> **Only leaf nodes store `value`. A node with children never stores its own value — its value is always the derived sum of whichever of its children resolve to a number.**

This mirrors the completion-checkbox pattern (`isNodeComplete` / `isNodePartial`) deliberately — same "leaf owns the fact, parent derives it" shape, so the rollup logic is easy to reason about the same way.

### The document decides what the number means

Rather than each node declaring *its own* metric (area vs cost vs length), the document carries **one** `valueDef` that says what every leaf number means across the whole tree. That keeps unit mismatches structurally impossible — there's only one unit in play per document, chosen once.

```ts
export type UnitOption = {
  symbol: string;   // e.g. "m²", "ft²"
  fromBase: number; // multiply a base value by this to get the display value
  toBase: number;   // multiply a display value by this to get back to base
};

export type ValueDef = {
  label: string;                    // "Area", "Cost", "Length", ...
  unit: string;                     // base unit symbol — what stored values are in
  unitPosition?: "prefix" | "suffix"; // default suffix ("12 m²"); prefix for "₹12"
  precision?: number;               // decimals, default 2
  units: UnitOption[];              // all display units this def supports
};

export type ValueResult = {
  value: number | null; // null = "this node contributes nothing to the sum"
  partial: boolean;     // true = "some but not all of this node's children have a value"
};
```

### Base unit vs display unit (the invariant)

> **Stored values are ALWAYS in `valueDef.unit` (the base unit). The currently-displayed unit is `ProcessData.displayUnit` — a purely cosmetic string. Switching display units converts on the fly and never rewrites anything on disk.**

That's what makes the unit switcher lossless: flipping from `m²` to `ft²` and back leaves the stored numbers bit-for-bit identical. It also means a document round-trips through save/load in whatever display unit was last selected, without ever touching the underlying numbers.

### Presets + resolution

`VALUE_PRESETS` in `process-utils.ts` ships six ready-made types, each with its own conversion table:

| Preset id | Label | Base unit | Display units |
|---|---|---|---|
| `area` | Area | `m²` | `m²`, `ft²`, `yd²` |
| `volume` | Volume | `m³` | `m³`, `ft³`, `L` |
| `length` | Length | `m` | `m`, `ft`, `cm`, `mm` |
| `cost` | Cost | `₹` | `₹`, `$`, `€`, `AED` (prefix) |
| `weight` | Weight | `kg` | `kg`, `lb`, `t` |
| `count` | Count | *(unitless)* | *(unitless)* |

The default when a document doesn't declare anything is `area` (m² base, m²/ft²/yd² display).

```ts
export function resolveValueDef(def: ValueDef | undefined): ValueDef {
  return def ?? DEFAULT_VALUE_DEF;
}

export function resolveUnit(def: ValueDef, chosenSymbol?: string): UnitOption {
  if (def.units.length === 0) return base(def.unit);
  if (chosenSymbol) {
    const match = def.units.find((u) => u.symbol === chosenSymbol);
    if (match) return match;
  }
  const baseOpt = def.units.find((u) => u.symbol === def.unit);
  return baseOpt ?? def.units[0];
}
```

Resolution order for the display unit: **chosen symbol if it matches one of `def.units` → the base unit → the first unit in the list**. Never throws; an unknown `displayUnit` string silently renders in the base unit.

### Core functions (`lib/process-utils.ts`)

```ts
export function getNodeValue(node: ProcessNode): ValueResult {
  const children = node.children ?? [];

  if (children.length === 0) {
    const v = node.value ?? node.area; // legacy fallback
    return { value: typeof v === "number" ? v : null, partial: false };
  }

  const childResults = children.map(getNodeValue);
  const withValue = childResults.filter((r) => r.value !== null);

  if (withValue.length === 0) return { value: null, partial: false };

  const sum = withValue.reduce((total, r) => total + (r.value as number), 0);
  return { value: sum, partial: withValue.length < children.length };
}

export function formatValue(
  baseValue: number,
  def: ValueDef,
  chosenSymbol?: string,
): string {
  const opt = resolveUnit(def, chosenSymbol);
  const display = baseValue * opt.fromBase;
  const p = def.precision ?? 2;
  const factor = 10 ** p;
  const rounded = Math.round(display * factor) / factor;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(p);
  const u = opt.symbol;
  if (!u) return text;
  return def.unitPosition === "prefix" ? `${u}${text}` : `${text} ${u}`;
}

export function hasAnyValue(root: ProcessNode): boolean {
  // True if any node carries a `value` (or a legacy `area`).
}
```

`getNodeValue` is called fresh on every render, same as `isNodeComplete` — tree sizes here are small (dozens of nodes), so this isn't a perf concern. If a document ever grows into the hundreds of nodes, memoize per-node results keyed on node identity before optimizing anything else.

### Mixed-children behavior (important)

If a parent's children are a mix of "has value" and "doesn't":

- **The sum only includes children that resolve to a number.** A child with no value is *skipped*, not treated as zero. This means the parent's number is never silently understated by an empty sibling — it's a real subtotal of what's known.
- `partial: true` flags exactly this situation, so the UI can mark the number as incomplete instead of presenting it as final (`Σ 651.27 ft² · partial` in amber vs. plain gray when complete).
- Nodes *without* a value, when a sibling *does* have one, get a small amber `⚠ no <label> set` marker instead of staying silent — clicking it opens the value editor directly. If **no** sibling has a value, the node renders with nothing extra at all (this is what keeps value-less documents visually identical to before the feature existed).

This warning-instead-of-blocking design was a deliberate choice: nothing about the value feature ever prevents completing or saving a document. It's an advisory layer on top of the existing tree, not a new validation gate.

### Editing (`useProcessEditor.ts`)

- `editingField` is now `"label" | "description" | "value"`.
- `openEditor(id, "value", displayString)` opens the same modal used for title/description, with a number input instead. **The value passed in is the display value** (converted from base at the call site using `resolveUnit(def, displayUnit).fromBase`) so the user sees the number in the unit currently on screen.
- `updateNode(id, "value", input)`:
  - empty string → **removes** `value` from the node entirely (so it goes back to contributing nothing, rather than storing `0`).
  - non-numeric or negative → input is ignored, prior value kept.
  - valid number → **converted back to base** via `parsed * resolveUnit(def, chosen).toBase` and stored. This is the one place the display→base conversion happens in data-land; everything else converts at render time.
  - Calling this with `field: "value"` on `id: "root"` is a no-op — the canvas/root never has its own value, only ever a derived total.
  - Calling this on a node that has children is also a no-op — parents never own a value.
- `setValueDef(def)` swaps the whole document to a different meaning. It also **resets `displayUnit` to `def.unit`** so we never end up showing a symbol that doesn't exist in the new def's unit list.
- `setDisplayUnit(symbol)` changes the display unit only — nothing else is touched.
- `validateNodeShape` (upload validation) checks `value` is a non-negative finite number when present, same error-message style as the other field checks.

### Rendering (`ProcessContainer.tsx`)

Per node, in addition to the existing title/description/assigned-people rows:

- **Leaf, `value` set** → blue text, `formatValue(ownValue, valueDef, displayUnit)`. Double-click (desktop) / long-press (mobile) opens the value editor — same interaction pattern as editing title/description. The editor opens showing the value **in the current display unit**, not the stored base value.
- **Leaf, no `value`, but a sibling under the same parent has one** → faint amber `⚠ no <label> set`, clickable to add.
- **Leaf, no `value`, no sibling has one either** → nothing rendered. This is the "feature not in use here" case.
- **Parent, derived value present** → gray italic `Σ 651.27 ft²` (amber + `· partial` if `partial: true`). Not directly editable — edit a leaf instead; the sum recalculates automatically on the next render.
- Never shown on the root/canvas node (`level > 0` guard, matching the existing pattern for the assigned-people row).
- The whole block is also gated on `valueInUse` — a document where `hasAnyValue(rootNode)` is `false` renders no value lines at all, anywhere.

The parent component computes, for each set of siblings, whether *any* child has a value before rendering — that's what decides whether the "no value set" warning shows on the ones that don't:

```ts
const childResults = children.map((c) => getNodeValue(c));
const anyChildHasValue = childResults.some((r) => r.value !== null);
// passed down per-child as warnIfMissingValue={anyChildHasValue && childResults[index].value === null}
```

### Toolbar (`page.tsx`)

- Header block shows a document-wide total under the "X / Y steps done" line, when the root resolves to a number and `documentHasValue` is true:
  `{editor.valueDef.label}: {formatValue(rootValueResult.value, editor.valueDef, editor.displayUnit)}` (+ `" (partial)"` if partial).
- Action popup gets an **Edit &lt;Label&gt;** button (e.g. "Edit Area", "Edit Cost"), shown only when the selected node is a leaf (`children.length === 0`), isn't `"root"`, and the document actually uses values. Parents don't get this button — there's nothing to edit on them, the number is always derived.
- Edit modal branches on `editingField`: text input for label, textarea for description, `type="number" min={0} step="0.01"` for value, with the current display unit's symbol shown alongside the input and a hint that leaving it empty removes the value.
- Toolbar has a **Value** button (next to **+ Add**) that opens the value panel.

### Value panel — the unit switcher (`page.tsx`)

A small modal, opened by the **Value** button, with two controls:

1. **"What it is"** — a chip per entry in `VALUE_PRESETS`. Clicking a chip calls `editor.setValueDef(preset)` and the whole document reinterprets itself (Area ↔ Volume ↔ Length ↔ Cost ↔ Weight ↔ Count). The stored numbers don't change; only their meaning does. `displayUnit` resets to the new base.
2. **"Show it in"** — a `<select>` listing every unit in the current `valueDef.units`. Changing it calls `editor.setDisplayUnit(symbol)`. Every number on screen, including all parent Σ lines and the header total, re-renders instantly.

A hint below the dropdown always reads *"Stored values are in `<base unit>`"* to make the invariant visible to the user.

The panel does **not** write to any node's stored numbers — it only writes to `ProcessData.valueDef` and `ProcessData.displayUnit`. Everything else is derived at render time.

### What's intentionally NOT built yet

- **Per-node metric overrides.** A node can only carry *one* value, and it always means what the document says it means. If a node ever needs to carry *two* parallel numbers (e.g. both area and cost on the same space), that's a different model — it would be `metrics: Record<string, number>` keyed by metric id, with a parallel `metricDefs` array. Deferred until there's a real need.
- **Custom value types beyond the six presets.** The preset catalog is currently hard-coded in `VALUE_PRESETS`. A "Custom..." option in the panel that lets the user name a new type and set base/display units would go here. Deferred — six presets cover the obvious cases, and a document can always declare its own `valueDef` in JSON.
- **Currency exchange-rate syncing.** The cost preset's `$`/`€`/`AED` conversion factors are fixed constants. A live FX lookup or per-document override table would go here. Deferred — the point is the *shape* (base currency, convert on display), not FX accuracy.
- **Length × breadth.** Only a raw value exists right now. If/when L×B is added: store `length?: number` and `breadth?: number` alongside `value` on the leaf, auto-compute `value = length * breadth` when both are present, and let a direct edit to `value` clear `length`/`breadth` (otherwise a hand-edited value could silently disagree with a stale L×B). Validate this in `validateNodeShape` the same way `value` is validated now.
- **Document-level "value plugin" toggle.** Considered and deliberately skipped in favor of auto-detect (presence of a `value` or `area` anywhere = feature in use for that document). Revisit only if there's a real need to hide value numbers on a document that has them stored but doesn't want them shown (e.g. exporting a client-facing version).

### Migration from the legacy `area` field

Before the value system existed, leaves stored `area?: number` directly and everything was hard-coded to m². Files saved in that shape still load: `migrateProcessData` (called on every load by `editor.loadData`) walks the tree and rewrites `area: 42.5` → `value: 42.5` on each node. The document's `valueDef` defaults to the `area` preset, so the numbers show up as m² exactly as they used to. No manual migration needed.

The `area` field is still declared on `ProcessNode` (marked `@deprecated`) so old TypeScript that imports it keeps compiling, and `getNodeArea`/`formatArea` are still exported as aliases for `getNodeValue`/`formatValue` for the same reason. Both are pure pass-throughs — there's no duplicate logic to maintain.

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

If A→B and B→A both exist, `sanitizeProcessRelations` in `process-utils.ts` marks both edges dashed rather than leaving two overlapping solid arrows that read as a bug. Self-loops (a node listing itself) are stripped outright.

---

## Deleting and duplicating a process

Both live in `useProcessEditor.ts`: `editor.deleteNode(id)` / `editor.duplicateNode(id)`. Neither applies to the root node.

### Delete

1. Select a node, click **Delete**. Native `confirm()` warns if it has subprocesses (they're deleted too).
2. `deleteNode` removes the node and its subtree, then cleans up references everywhere else:
   - strips removed ids from `completed`
   - drops `edgeStyles` entries keyed on removed ids
   - strips removed ids out of every remaining node's `predecessors`/`successors`

### Duplicate

1. Select a node, click **Duplicate**.
2. `duplicateNode` clones the node and its full subtree with fresh ids (`cloneSubtreeWithNewIds`), appends `" (Copy)"` to the label, inserts as the next sibling.
3. `predecessors`/`successors` and `assignedPersonIds` are **dropped** on the clone — those pointed at the *original's* context and copying them verbatim would be wrong. `value` **is** copied (it spreads via `...node`), since a duplicated space plausibly has the same footprint until edited.

---

## Rendering (`ProcessContainer.tsx`)

For each node it renders, top to bottom:

1. **CompletionCheckbox** — checked/indeterminate/locked (derived, not local).
2. **Title** — prefixed with computed number, except at root. Double-click/long-press to edit via modal.
3. **Description** — same editing interaction, if present.
4. **Value** — see Value section above. Not shown on root, and only shown at all when the document uses values.
5. **Assigned people** — click opens assign popup. Not shown on root.
6. **Children** — level 0 (top-level processes): horizontal grid. Level 1+: vertical stack.

Gaps: level 0 = `40px`, deeper levels = `24px` (room for arrows).

Colour families assigned at level 0 by `colorIndex = index`, inherited down. Deeper levels are lightened versions.

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
| Save JSON | Download JSON including completed state, relations, value, etc. (`editor.handleSave`) |
| PNG | Export raster image at 3× resolution (`html2canvas`) |
| SVG | Export vector SVG (`html-to-image`) |
| PDF | Dialog for page size (A4/A3/A2) and orientation, then vector PDF via print |
| Value | Opens the value panel — pick what the number means + which unit to show it in |

### Action popup (per selected node)

| Button | Behavior |
|---|---|
| Edit Title / Edit Description | Opens the inline editor modal |
| Edit &lt;Label&gt; | **Leaf only, and only when the doc uses values.** Opens the same modal with a number input (in the current display unit) |
| + Successor / + Predecessor | Starts `pendingRelation`; click another node to link |
| Duplicate | Clones the node and its subtree as the next sibling |
| Delete | Removes the node and its subtree, after confirmation |
| ✕ *(next to a relation chip)* | Deletes just that relation |

---

## Editing

- **Double-click** title, description, or (leaf) value → modal opens via `editor.openEditor`.
- **Long-press** on mobile/pen → same modal.
- Modal has **Done** (`editor.submitEditor`) and **Cancel** (`editor.closeEditor`).
- Value uses a number input (`type="number" min={0} step="0.01"`) instead of text; leaving it empty on submit clears the value rather than being blocked (unlike label, which can't be empty). The input shows the number **in the current display unit**, and `updateNode` converts it back to the base unit before storing.

---

## The value system in one diagram

```
                    ┌───────────────────────────────────┐
                    │ ProcessData                        │
                    │                                    │
                    │  valueDef:   { label, unit, ...    │  ← "what it is"
                    │                units: [m², ft², …] } │
                    │  displayUnit: "ft²"                │  ← "how to show it"
                    └───────────────────────────────────┘
                                    │
                                    ▼
              ┌────────────────────────────────────────┐
              │ leaf.value = 42.5                      │  ← ALWAYS base unit (m²)
              │                                        │
              │ render → 42.5 × 10.7639104 = 457.47    │  ← converted at render time
              │        → "457.47 ft²"                  │
              └────────────────────────────────────────┘
                                    │
                                    ▼
              ┌────────────────────────────────────────┐
              │ parent.getNodeValue() = 60.5 (m²)       │  ← sum in BASE units
              │                                        │
              │ render → 60.5 × 10.7639104 = 651.27    │
              │        → "Σ 651.27 ft²"                │
              └────────────────────────────────────────┘
```

**Stored numbers never change** when the display unit changes. Only `displayUnit` on the document changes. That's what makes the switcher lossless and reversible.

---

## Export

Export logic stays in `page.tsx` since it operates on DOM refs (`printRef`/`canvasRef`), not the data model. Value lines render as ordinary DOM text (already converted to the current display unit), so they're captured by PNG/SVG/PDF export exactly like title/description — no export-specific code needed. Whatever unit is on screen when the export button is clicked is what ends up in the file.

### PNG
`html2canvas` at 3× scale, after fitting the full diagram into view.

### SVG
`html-to-image`, vector output.

### PDF
Dialog: page size (A4/A3/A2), orientation (portrait/landscape). Uses the browser's print-to-PDF engine, scaled to fit. Text, arrows, numbering, and value lines remain vector.

---

## Upload flow

1. `editor.handleUpload` reads the file with `FileReader`.
2. `JSON.parse` and validate:
   - `title` required.
   - Per-node shape including `value` (must be a non-negative finite number if present) and legacy `area` (same rules).
   - Document-level `valueDef` (needs string `label` and `unit`; if `units` is present, each entry needs string `symbol`, number `fromBase`, number `toBase`).
   - Document-level `displayUnit` (string if present).
3. On success: `migrateProcessData` rewrites any legacy `area` → `value`, then `setData` runs and `completed`/`edgeStyles`/`persons`/`displayUnit`/`valueDef` are rehydrated from the JSON.
4. `page.tsx`'s `useEffect` on `editor.loadVersion` triggers `fitAllView()` on the next frame.
5. On failure: sets `editor.error`, shown as an error banner with a "download sample template" action.
6. File input value is reset so the same file can be re-uploaded.
7. Labels should **not** include manual numbering. `value` on a node with children is simply ignored by `getNodeValue` (it only reads leaves) — no upload error for it, but it will never show up anywhere, so don't rely on it being preserved round-trip through the UI (it round-trips fine through raw JSON, just never renders or sums).

---

## Mobile support

- **Touch action: none** on canvas to prevent browser scroll/zoom.
- **Pinch** to zoom at midpoint. **One finger drag** to pan.
- **Long press** to edit text (title/description/value).
- Toolbar is responsive and scrolls horizontally if needed.

---

## Extending this

- **Add total nodes stat**: `countNodes(rootNode)` already exists in `process-utils.ts`. Read it in `page.tsx`, drop into the toolbar.
- **Persist completion across reloads**: partially supported via JSON `completed` field already. Could layer `localStorage` on top.
- **New node-level field** (owner, due date, notes): add to `ProcessNode` in `process-utils.ts`, render in `ProcessContainer.tsx`, extend the `editingField` union + `updateNode` in the hook if it needs inline editing. No other files need touching.
- **New value preset** (e.g. "Temperature", "Flow rate"): add an entry to `VALUE_PRESETS` in `process-utils.ts` with its `label`, `unit`, and `units` array. It immediately appears as a chip in the value panel — no changes to `page.tsx` or `ProcessContainer.tsx` needed.
- **Custom value type from the UI** (name it + set base/display units on the fly): add a "Custom..." option to the value panel that builds a `ValueDef` from user input and passes it to `editor.setValueDef`. Deferred until there's a real need.
- **Length × breadth**: see "What's intentionally NOT built yet" under Value above — that's the exact spec to follow when this gets picked up.
- **Per-node multi-metric** (two parallel numbers on the same node): this is a different model. Would be `metrics: Record<string, number>` on the node plus a `metricDefs: MetricDef[]` on the document, with `getNodeMetric(node, id)` as the rollup. Deferred — the single-value model covers the common case.
- **Drag-to-reorder**: not implemented; node order follows `children` array order (numbering already tracks it automatically). Extend with drag events + a reorder function in `useProcessEditor.ts` alongside `addNodeToTree`.
- **New editing behavior** (bulk-delete, move a node to a different parent): add to `useProcessEditor.ts` alongside `deleteNode`/`duplicateNode`, expose from the hook's return object — `page.tsx` shouldn't touch `data` directly.
- **Custom numbering format**: change the one line in `ProcessContainer.tsx` that renders `numberPath.join(".")`.
- **Document-level toggle for any of the above** (value, cost, etc.): if ever needed, add a boolean to `ProcessData` (e.g. `valueEnabled`), gate the relevant renders on it, add a toolbar switch in `page.tsx`. Not currently implemented anywhere — auto-detect (presence of the field) is the pattern in use.
- **Live currency exchange rates**: the cost preset's conversion factors are static. Replace with a lookup against a rates table stored on the document, or fetched once at load. Deferred — the model already supports it via `ValueDef.units`, only the numbers need to come from somewhere else.