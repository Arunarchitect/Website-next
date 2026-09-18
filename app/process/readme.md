# Process Viewer — Architecture Reference

Internal reference doc for `app/process/*`. Read this before touching the hook, the container, or the page — it explains *why* the code is split the way it is, not just what each file does.

---

## File map

| File | Owns |
|---|---|
| `lib/process-utils.ts` | Pure data-in/data-out. Types (`ProcessNode`, `ProcessData`, `ValueDef`, `UnitOption`, `ValueResult`, `RescaleResult`, `ValueScope`), rendering-only helpers (`getColorTheme`, `getLayout`), derived-state helpers (`isNodeComplete`, `isNodePartial`, `getNodeValue`, `formatValue`, `resolveValueDef`, `resolveNodeValueDef`, `resolveUnit`, `unitForType`, `toDisplay`, `toBase`, `factorToDisplay`, `factorFromDisplay`, `hasFactors`, `computeValueFromFactors`, `hasAnyValue`, `countNodes`, `getLeafIds`, `findNodeById`), the preset catalog (`VALUE_PRESETS`), migration (`migrateProcessData`, `migrateNodeValue`, `migrateDisplayUnits`), relation sanitation, scope helpers (`isNodeInValueScope`, `scopeHasAnyValue`), the subtree rescaler (`rescaleSubtree`), and report helpers (`formatAreaPair`, `leafRows`, `allRows`, `groupLeavesByType`). Zero React, zero state. |
| `lib/ifc-generator.ts` | Pure data-in/string-out. Turns any `ProcessNode` subtree into an IFC4X3 STEP file, one `IFCSPACE` per real room, arranged in a per-storey shelf-packer grid. Zero React, zero state, no dependencies. |
| `hooks/useProcessEditor.ts` | All data-mutating state: the tree (`data`), completion set, edge styles, selection, the inline editor (title / description / **value** / **factor1** / **factor2**), the Add Process modal, delete/duplicate/move, relation add/delete/reverse, schema validation, undo/redo, copy/paste, the document-level value system (`valueDef`, `displayUnits`, `setValueDef`, `setDisplayUnitForType`), the per-node value type (`setNodeValueType`, `applyValueTypeToAll`), and the subtree rescale (`setSubtreeValue`). |
| `components/ProcessContainer.tsx` | Renders one node and recurses into children. Calls callbacks (`onToggleComplete`, `onEditNode`, `onSelectNode`, `registerNodeRef`) but owns no app state. Computes each node's **display number** and **value line** from tree position/content. |
| `components/RelationshipArrows.tsx` | Draws directed arrows between nodes using positions supplied by `page.tsx`. |
| `components/ReportPdfButton.tsx` | The PDF export dialog. Two modes: **Process report** (per-node headings, table of contents, checkboxes, assigned people) and **Space / Area report** (cover totals, area breakdown by type, detailed space table). Owns the "space report scope" picker, the "blocks vs one block" toggle, wall/circulation/cost inputs, and unit selection. All jsPDF logic lives here. |
| `page.tsx` | Only **view state**: pan, zoom, drag, pointer/wheel handling, node position measurement, PNG/SVG/PDF export buttons, IFC export button, all the modals (save, load, add, edit, person manager, assign popup, value panel, override-sum modal). Calls `useProcessEditor()` for everything data-related. |

**Why split this way:** "what the diagram *is*" (data model, edits, relations, the value system, the IFC writer) stays separate from "how you *look at* it" (camera, rendering, PDF/IFC export). The two rarely change together, and this split has held up through every feature added so far (people, importance flags, area, the single-value system with unit switching, per-node value types, subtree rescaling, IFC export).

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

  /** Default value type for leaves that haven't picked one. */
  valueDef?: ValueDef;

  /** Per-value-type display unit, e.g. { area: "ft²", cost: "$" }. */
  displayUnits?: Record<string, string>;

  /** @deprecated legacy single display unit. Migrated to displayUnits on load. */
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
   * LEAF-ONLY. One number, in the leaf's value type's BASE unit
   * (see ProcessData.valueDef). Parents never store their own value —
   * theirs is always the derived sum of whichever children resolve to a
   * number.
   */
  value?: number;

  /** @deprecated legacy alias for `value`. Migrated on load. */
  area?: number;

  /**
   * LEAF-ONLY. Which value type this leaf uses — a preset id from
   * VALUE_PRESETS ("area" | "cost" | "volume" | "length" | "weight" |
   * "count"). When absent, the document's `valueDef` is used. Present
   * only on leaves that have been individually typed.
   */
  valueType?: string;

  /**
   * LEAF-ONLY. Two optional factors whose product yields `value`.
   * Rendered with the factor labels/unit of the leaf's value type:
   * Length × Breadth for Area, Quantity × Rate for Cost, etc.
   */
  factor1?: number;
  factor2?: number;

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

## Value (one number per document, with units and optional two-factor definition)

**Added to give a process tree one optional numeric meaning — a zone made of spaces, a budget made of line items, a distance made of segments — where each leaf carries a number and the parent's number is the sum of its leaves. The document decides what that number *is* and how to display it.** Fully opt-in — a document that never sets `value` on any node renders byte-for-byte the same as before this feature existed.

### The rule

> **Only leaf nodes store `value`. A node with children never stores its own value — its value is always the derived sum of whichever of its children resolve to a number.**

This mirrors the completion-checkbox pattern (`isNodeComplete` / `isNodePartial`) deliberately — same "leaf owns the fact, parent derives it" shape, so the rollup logic is easy to reason about the same way.

### The document decides what the number means

Rather than each node declaring *its own* metric (area vs cost vs length), the document carries a **default** `valueDef` that says what every untyped leaf number means. An individual leaf can override it with its own `valueType`, which is what lets one branch be Area and another be Cost within the same document.

```ts
export type UnitOption = {
  symbol: string;   // e.g. "m²", "ft²"
  fromBase: number; // multiply a base value by this to get the display value
  toBase: number;   // multiply a display value by this to get back to base

  /** Factor symbol for this display unit, e.g. "m", "ft". */
  factorSymbol?: string;
  /** Display factor value = base factor value × this. */
  factorFromBase?: number;
  /** Base factor value = display factor value × this. */
  factorToBase?: number;
};

export type ValueDef = {
  id?: string;                        // preset id, e.g. "area"
  label: string;                      // "Area", "Cost", "Length", ...
  unit: string;                       // base unit symbol — what stored values are in
  unitPosition?: "prefix" | "suffix"; // default suffix ("12 m²"); prefix for "₹12"
  precision?: number;                 // decimals, default 2
  units: UnitOption[];                // all display units this def supports
  factorLabels?: [string, string];    // ["Length", "Breadth"] for Area, ["Quantity", "Rate"] for Cost
  factorUnit?: string;                // default factor unit symbol
};

export type ValueResult = {
  value: number | null; // null = "this node contributes nothing to the sum"
  partial: boolean;     // true = "some but not all of this node's children have a value"
};
```

### Base unit vs display unit (the invariant)

> **Stored values are ALWAYS in the leaf's value type's base unit (`valueDef.unit`). The currently-displayed unit is `ProcessData.displayUnits[valueTypeId]` — a purely cosmetic string. Switching display units converts on the fly and never rewrites anything on disk.**

That's what makes the unit switcher lossless: flipping from `m²` to `ft²` and back leaves the stored numbers bit-for-bit identical. It also means a document round-trips through save/load in whatever display unit was last selected, without ever touching the underlying numbers.

### Presets + resolution

`VALUE_PRESETS` in `process-utils.ts` ships six ready-made types, each with its own conversion table:

| Preset id | Label | Base unit | Display units | Factors |
|---|---|---|---|---|
| `area` | Area | `m²` | `m²`, `ft²`, `yd²` | Length × Breadth (m base) |
| `volume` | Volume | `m³` | `m³`, `ft³`, `L` | *(none — three dimensions needed)* |
| `length` | Length | `m` | `m`, `ft`, `cm`, `mm` | *(none)* |
| `cost` | Cost | `₹` | `₹`, `$`, `€`, `AED` (prefix) | Quantity × Rate |
| `weight` | Weight | `kg` | `kg`, `lb`, `t` | *(none)* |
| `count` | Count | *(unitless)* | *(unitless)* | *(none)* |

The default when a document doesn't declare anything is `area` (m² base, m²/ft²/yd² display).

```ts
export function resolveValueDef(def: ValueDef | undefined): ValueDef {
  return def ?? DEFAULT_VALUE_DEF;
}

/** Resolve the ValueDef a node should use. Priority:
 *    1. node.valueType (must be a known preset id)
 *    2. document def (data.valueDef)
 *    3. DEFAULT_VALUE_DEF
 */
export function resolveNodeValueDef(
  node: ProcessNode,
  documentDef: ValueDef | undefined,
): ValueDef {
  if (node.valueType && VALUE_PRESETS[node.valueType]) {
    return VALUE_PRESETS[node.valueType];
  }
  return resolveValueDef(documentDef);
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

Resolution order for the display unit: **chosen symbol if it matches one of `def.units` → the base unit → the first unit in the list**. Never throws; an unknown `displayUnits[id]` string silently renders in the base unit.

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

export function formatFactor(
  baseFactor: number,
  def: ValueDef,
  chosenSymbol?: string,
): string {
  const display = factorToDisplay(baseFactor, def, chosenSymbol);
  const rounded = Math.round(display * 1e6) / 1e6;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded);
  const u = resolveUnit(def, chosenSymbol).factorSymbol ?? def.factorUnit ?? "";
  return u ? `${text} ${u}` : text;
}

export function hasAnyValue(root: ProcessNode): boolean {
  if (typeof root.value === "number") return true;
  if (typeof root.area === "number") return true;
  for (const child of root.children ?? []) {
    if (hasAnyValue(child)) return true;
  }
  return false;
}
```

`getNodeValue` is called fresh on every render, same as `isNodeComplete` — tree sizes here are small (dozens of nodes), so this isn't a perf concern. If a document ever grows into the hundreds of nodes, memoize per-node results keyed on node identity before optimizing anything else.

### Two-factor leaves (Length × Breadth, Quantity × Rate)

A leaf whose value type has `factorLabels` can carry two factor numbers. When both are present, `value = factor1 × factor2` (both in base units).

- **Both factors present** → `value` auto-computes; the editor displays the factors under the value, and editing either one recomputes the main value.
- **Only one factor present** → `value` stays whatever it was; the factor is stored but doesn't compute a new value until the second factor is filled in.
- **Editing `value` directly** while both factors exist → the factors are **scaled proportionally** by `k = sqrt(newValue / oldValue)` so their product matches the new value and their aspect ratio (`factor1 : factor2`) is preserved.
  - Example: `4 × 3 = 12`, user types `15`. `k = sqrt(15/12) = 1.1180`. New factors: `4 × 1.1180 = 4.472`, `3 × 1.1180 = 3.354`. Product `= 15.000` ✓
- **Unit conversion for factors** uses the length conversion, not the area one. Switching the document from m² to ft² displays factors in ft (multiply by `3.2808399`), not in ft² (which would be `10.7639104`).

### Per-node value type (`valueType`)

A leaf can override the document's default value type by setting `valueType` to a preset id. The editor exposes a dropdown on the selected leaf, and the value panel has an "Apply to all" section that rewrites every leaf's type in one click.

This is what makes a mixed document possible: one branch can be Area, another Cost, and they roll up independently. The Report PDF's space report groups by type so the two never mix in a total.

### Subtree rescale (override sum)

`rescaleSubtree(node, target)` walks a node's subtree, and for every leaf that has a value, multiplies its `value` by `target / oldTotal` and its factors by `sqrt(target / oldTotal)`. The result: the subtree's `getNodeValue()` equals the target, and every leaf keeps its aspect ratio.

The hook exposes this as `setSubtreeValue(nodeId, baseTarget)`. The page exposes it as an **Override sum** button on any parent node: the user types a new total in the current display unit, and the hook converts to base and rescales.

Refusals:

- Subtree sums to `null` → "This subtree has no values to scale."
- Subtree sums to `0` → "Current total is zero — nothing to scale."
- Negative or non-finite target → "Target must be a non-negative number."

### Mixed-children behavior (important)

If a parent's children are a mix of "has value" and "doesn't":

- **The sum only includes children that resolve to a number.** A child with no value is *skipped*, not treated as zero. This means the parent's number is never silently understated by an empty sibling — it's a real subtotal of what's known.
- `partial: true` flags exactly this situation, so the UI can mark the number as incomplete instead of presenting it as final (`Σ 651.27 ft² · partial` in amber vs. plain gray when complete).
- Nodes *without* a value, when a sibling *does* have one, get a small amber `⚠ no <label> set` marker instead of staying silent — clicking it opens the value editor directly. If **no** sibling has a value, the node renders with nothing extra at all (this is what keeps value-less documents visually identical to before the feature existed).

This warning-instead-of-blocking design was a deliberate choice: nothing about the value feature ever prevents completing or saving a document. It's an advisory layer on top of the existing tree, not a new validation gate.

### Editing (`useProcessEditor.ts`)

- `editingField` is `"label" | "description" | "value" | "factor1" | "factor2"`.
- `openEditor(id, "value", displayString)` opens the same modal used for title/description, with a number input instead. **The value passed in is the display value** (converted from base at the call site using `resolveUnit(def, displayUnit).fromBase`) so the user sees the number in the unit currently on screen.
- `updateNode(id, "value", input)`:
  - empty string → **removes** `value` **and both factors** from the node entirely (so it goes back to contributing nothing, rather than storing `0`).
  - non-numeric or negative → input is ignored, prior value kept.
  - valid number → **converted back to base** via `parsed * resolveUnit(def, chosen).toBase`. If the leaf already had both factors, they're scaled by `sqrt(newBaseValue / oldValue)` so their product matches the new value.
  - Calling this with `field: "value"` on `id: "root"` is a no-op — the canvas/root never has its own value, only ever a derived total.
  - Calling this on a node that has children is also a no-op — parents never own a value.
- `updateNode(id, "factor1" | "factor2", input)`:
  - empty string → drops that factor only.
  - valid number → converted back to base via `factorFromDisplay`, then stored. If both factors are present after this edit, `value = factor1 × factor2`.
- `setValueDef(def)` swaps the whole document to a different default meaning. It also **resets `displayUnits[def.id]` to `def.unit`** so we never end up showing a symbol that doesn't exist in the new def's unit list.
- `setDisplayUnitForType(presetId, symbol)` changes one value type's display unit — nothing else is touched.
- `setNodeValueType(nodeId, presetId)` sets one leaf's override. Passing `""` clears the override and falls back to the document default.
- `applyValueTypeToAll(presetId)` rewrites every leaf's `valueType` in one pass and updates the document's default.
- `setSubtreeValue(nodeId, baseTarget)` runs `rescaleSubtree` and replaces the node in the tree.
- `validateNodeShape` (upload validation) checks `value`, `factor1`, `factor2` are non-negative finite numbers when present, and that `valueType` is a known preset id.

### Rendering (`ProcessContainer.tsx`)

Per node, in addition to the existing title/description/assigned-people rows:

- **Leaf, `value` set** → blue text, `formatValue(ownValue, valueDef, displayUnit)`. Double-click (desktop) / long-press (mobile) opens the value editor — same interaction pattern as editing title/description. The editor opens showing the value **in the current display unit**, not the stored base value.
- **Leaf, `value` set, value type has factors** → two small editable lines underneath: `Length: 4.472 m` and `Breadth: 3.354 m`. Editing either recomputes the value.
- **Leaf, no `value`, but a sibling under the same parent has one** → faint amber `⚠ no <label> set`, clickable to add.
- **Leaf, no `value`, no sibling has one either** → a faint blue `+ add <label>` line. Clicking it opens the value editor with an empty input.
- **Parent, derived value present** → gray italic `Σ 651.27 ft²` (amber + `· partial` if `partial: true`). Not directly editable — edit a leaf instead; the sum recalculates automatically on the next render.
- Never shown on the root/canvas node (`level > 0` guard, matching the existing pattern for the assigned-people row).
- The whole block is gated on `valuesVisible && inValueScope` — the value lines only render inside the current scope (see "Value scope" below).

The parent component computes, for each set of siblings, whether *any* child has a value before rendering — that's what decides whether the "no value set" warning shows on the ones that don't:

```ts
const childResults = children.map((c) => getNodeValue(c));
const anyChildHasValue = childResults.some((r) => r.value !== null);
// passed down per-child as warnIfMissingValue={anyChildHasValue && childResults[index].value === null}
```

### Value scope

The value feature can be **scoped to a subtree**, not just the whole document. `ValueScope = string | null`:

- `"root"` → values visible everywhere.
- a node id → values visible only on that node and its descendants.
- `null` → values hidden everywhere.

The toolbar **Values** button toggles scope on/off; clicking a node while the toggle is on moves the scope to that node. A small floating chip at the bottom of the canvas shows the current scope and offers a "show all" shortcut.

This is what makes the "only this branch is quantified" workflow possible — a mixed document can be inspected one branch at a time without the clutter of other values.

### Toolbar (`page.tsx`)

- Header block shows the document-wide total under the "X / Y steps done" line, when the root resolves to a number and `documentHasValue` is true:
  `{editor.valueDef.label}: {formatValue(rootValueResult.value, editor.valueDef, editor.displayUnit)}` (+ `" (partial)"` if partial).
- Action popup gets an **Edit &lt;Label&gt;** button (e.g. "Edit Area", "Edit Cost"), shown only when the selected node is a leaf (`children.length === 0`), isn't `"root"`, and the document actually uses values. Parents don't get this button — there's nothing to edit on them, the number is always derived. Next to it, a **value type dropdown** picks the leaf's override.
- Action popup gets an **Override sum** button on any parent node — sets a new total for the subtree and rescales every leaf under it.
- Edit modal branches on `editingField`: text input for label, textarea for description, `type="number" min={0} step="0.01"` for value / factor1 / factor2. The current display unit's symbol shows alongside the input, and a hint says that leaving it empty removes the value (or the factor) from that node.
- Toolbar has a **Values** toggle and a **Units** button (opens the value panel).

### Value panel — the unit switcher (`page.tsx`)

A small modal, opened by the **Units** button, with three sections:

1. **"Default type (for new leaves)"** — a chip per entry in `VALUE_PRESETS`. Clicking a chip calls `editor.setDefaultValueType(preset)`. New leaves inherit it; existing leaves with their own `valueType` keep theirs.
2. **"Display unit per type"** — a `<select>` per preset, listing every unit in that preset's `units` array. Changing one calls `editor.setDisplayUnitForType(presetId, symbol)`. Every number of that type on screen, including all parent Σ lines and the header total, re-renders instantly.
3. **"Apply to all processes"** — one button per preset that rewrites every leaf's `valueType` in one pass. Confirmed first via `window.confirm`.

The panel does **not** write to any node's stored numbers — it only writes to `ProcessData.valueDef`, `ProcessData.displayUnits`, and leaf `valueType` overrides. Everything else is derived at render time.

### Report PDF (`ReportPdfButton.tsx`)

A separate dialog with two modes:

- **Process report** — walks the full tree, filters by person or include/exclude list, draws a table of contents and per-node headings with completion checkboxes, descriptions, and assigned people.
- **Space / Area report** — a fully formatted estimate:
  - Cover: title, generated date, then a **Summary by Block** table.
  - Area breakdown by type (grouped by `valueType`).
  - Detailed space table: one row per node (parents shown too, with `—` under Dimensions since their number is derived), showing number path, label, dimensions (L × B for leaves only), area in both units, and notes.

**Scope picker**: the report can cover the whole document, or just the currently-selected node's subtree. Defaults to the selection.

**Blocks vs one block**: the "Treat the hierarchy as" toggle decides whether each top-level child of the scope is its own block (with its own wall/circulation/cost) or the whole scope is one block.

**Wall %, Circulation %, Cost rate, Currency** — inputs default to 10%, 15%, off, `Rs.`. Blank = feature off; `0` = feature on but zero.

**Unit picker**: sqft or m², applied to the whole report.

### What's intentionally NOT built yet

- **Length × breadth on Volume / Length / Weight.** Only Area and Cost have factor pairs right now. Adding more is a matter of extending the preset's `factorLabels` and providing conversion factors for the leaf's dimensions; the storage model (`factor1`/`factor2` on the leaf) is already generic.
- **Custom value types beyond the six presets.** The preset catalog is currently hard-coded in `VALUE_PRESETS`. A "Custom..." option in the panel that lets the user name a new type and set base/display units would go here.
- **Currency exchange-rate syncing.** The cost preset's `$`/`€`/`AED` conversion factors are fixed constants. A live FX lookup or per-document override table would go here.
- **Document-level "value plugin" toggle.** Considered and deliberately skipped in favor of auto-detect (presence of a `value` or `area` anywhere = feature in use for that document).

### Migration from the legacy `area` field

Before the value system existed, leaves stored `area?: number` directly and everything was hard-coded to m². Files saved in that shape still load: `migrateProcessData` (called on every load by `editor.loadData`) walks the tree and rewrites `area: 42.5` → `value: 42.5` on each node. The document's `valueDef` defaults to the `area` preset, so the numbers show up as m² exactly as they used to. No manual migration needed.

The `area` field is still declared on `ProcessNode` (marked `@deprecated`) so old TypeScript that imports it keeps compiling, and `getNodeArea`/`formatArea` are still exported as aliases for `getNodeValue`/`formatValue` for the same reason.

`displayUnit` (singular) is also still declared (marked `@deprecated`); on load, `migrateDisplayUnits` moves it into `displayUnits: { area: "<old>" }` since pre-change documents were always Area.

---

## IFC export (`lib/ifc-generator.ts`)

`generateIfc(data, rootNode)` turns any `ProcessNode` subtree into a text `IFC4X3_ADD2` STEP file, ready to open in any IFC viewer (Bonsai/BlenderBIM, BIM Vision, Solibri, IFC.js, Revit IFC).

### What it emits

- One `IFCPROJECT` → one `IFCSITE` → one `IFCBUILDING` → one `IFCBUILDINGSTOREY` per floor → one `IFCSPACE` per real room.
- Each space has proper `IFCEXTRUDEDAREASOLID` box geometry (rectangle profile `factor1 × factor2`, extruded upward by `STOREY_HEIGHT_M = 3 m`).
- Walls and slabs are not emitted — spatial-only model.
- Each space carries an `IFCPROPERTYSET` with the room's area as an `IFCPROPERTYSINGLEVALUE`.
- Storey-to-space relationships are emitted **both** as `IFCRELCONTAINEDINSPATIALSTRUCTURE` (IFC4X3 canonical) and `IFCRELAGGREGATES` (what most viewers walk to build the model tree). Emitting both is harmless and maximizes compatibility.

### How storeys are decided

The generator inspects the passed root:

- **Root's direct children are parents** (i.e. the subtree is at least three levels deep) → each direct child becomes one `IFCBUILDINGSTOREY`. This is the "Building → Ground/First/Second → rooms" shape.
- **Root's direct children are leaves** → the whole subtree becomes a single storey named after the root. This is the "Ground Floor → rooms" shape you get when exporting a floor's subtree.

The `subtreeIsDeep()` check decides which interpretation applies; no flag or configuration is needed.

### Real-room filter

A leaf becomes an `IFCSPACE` **only if it carries `factor1`, `factor2`, or a numeric `value`**. Leaves with none of those are treated as notes / checklist items and skipped. A top-level branch that ends up with zero real rooms after the filter is dropped entirely — so a branch like "Regulatory Classification & Technical Review" whose children have no dimensions never becomes a fake floor.

### Layout

Rooms within a floor are placed by a **shelf packer**: left-to-right until the current row would exceed `sqrt(total area)` in width, then wrapped to the next row. Each room uses its **own** `factor1 × factor2`, so unlike a uniform grid, small rooms touch their neighbours without an artificial gap.

`STOREY_HEIGHT_M = 3.0` controls both the spacing between storeys and each space's extrusion height.

### Schema

`IFC4X3_ADD2`. Backwards-compatible with IFC4 for every entity emitted; all argument positions match. The switch to IFC4X3 mainly affects the schema name in the header.

### Safety nets

- `ifcString()` escapes `\`, `'`, `\n`, `\r`, `\t`, and strips control characters. Throws on unencodable input.
- `n6()` formats every number with a decimal point — never exponent notation, never `NaN`, never `Infinity`.
- `validateSpatialLine()` re-parses each `IFCPROJECT`, `IFCSITE`, `IFCBUILDING`, `IFCBUILDINGSTOREY` line and confirms `LongName` (attribute index 5) is a string or `$`, not a `#` reference. If it isn't, the export throws with the exact entity name and offending value — instead of the viewer failing mysteriously on load.

### Button (`page.tsx`)

The **Export IFC** button uses the currently-selected node as the scope. If nothing is selected, it exports the whole document. The filename is derived from the scope's label (`ground-floor.ifc`, `house-complex.ifc`).

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
   - if the value scope pointed at a removed node, falls back to `"root"` so values stay visible

### Duplicate

1. Select a node, click **Duplicate**.
2. `duplicateNode` clones the node and its full subtree with fresh ids (`cloneSubtreeWithNewIds`), appends `" (Copy)"` to the label, inserts as the next sibling.
3. `predecessors`/`successors` and `assignedPersonIds` are **dropped** on the clone — those pointed at the *original's* context and copying them verbatim would be wrong. `value`, `factor1`, `factor2`, and `valueType` **are** copied (they spread via `...node`), since a duplicated space plausibly has the same footprint and meaning until edited.

---

## Rendering (`ProcessContainer.tsx`)

For each node it renders, top to bottom:

1. **CompletionCheckbox** — checked/indeterminate/locked (derived, not local).
2. **Title** — prefixed with computed number, except at root. Double-click/long-press to edit via modal.
3. **Description** — same editing interaction, if present.
4. **Value** — see Value section above. Not shown on root, and only shown when the node is inside the current value scope.
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
- The node-position measurement effect (`useLayoutEffect`) compares the new positions map against the previous one and skips the state write when nothing moved — without that guard, `setNodePositions` triggers a re-render on every frame and React throws "Maximum update depth exceeded".

### Buttons

| Button | Behavior |
|---|---|
| Reset | Fits the entire diagram into the viewport (`fitAllView`) |
| Upload | Load a JSON file (`editor.handleUpload`) |
| Save JSON | Download JSON including completed state, relations, value, etc. (`editor.handleSave`) |
| PNG | Export raster image at 3× resolution (`html2canvas`) |
| SVG | Export vector SVG (`html-to-image`) |
| PDF | Dialog for page size (A4/A3/A2) and orientation, then vector PDF via print |
| Report PDF | Two-mode PDF report (Process report or Space / Area report) |
| Export IFC | Exports the selected subtree (or the whole document) as an IFC4X3 file |
| Values | Toggles the value scope on/off; clicking a node while on moves the scope |
| Units | Opens the value panel — pick default type, per-type display unit, apply to all |
| + Add | Opens the Add Process modal |
| People | Opens the People manager |

### Action popup (per selected node)

| Button | Behavior |
|---|---|
| Edit Title / Edit Description | Opens the inline editor modal |
| Edit &lt;Label&gt; | **Leaf only, and only when the doc uses values.** Opens the same modal with a number input (in the current display unit) |
| Value type dropdown | **Leaf only.** Overrides the leaf's `valueType` |
| Override sum | **Parent only.** Sets a new total for the subtree, rescales every leaf proportionally |
| + Successor / + Predecessor | Starts `pendingRelation`; click another node to link |
| Duplicate | Clones the node and its subtree as the next sibling |
| Delete | Removes the node and its subtree, after confirmation |
| ✕ *(next to a relation chip)* | Deletes just that relation |

---

## Editing

- **Double-click** title, description, (leaf) value, or (leaf) factor → modal opens via `editor.openEditor`.
- **Long-press** on mobile/pen → same modal.
- Modal has **Done** (`editor.submitEditor`) and **Cancel** (`editor.closeEditor`).
- Value and factors use a number input (`type="number" min={0} step="0.01"`) instead of text; leaving it empty on submit clears that field rather than being blocked (unlike label, which can't be empty). The input shows the number **in the current display unit** for the value and its factor unit for factors; `updateNode` converts it back to base before storing.

---

## The value system in one diagram

```
                    ┌────────────────────────────────────────┐
                    │ ProcessData                            │
                    │                                        │
                    │  valueDef:   { label, unit, ...        │  ← default meaning
                    │                units: [m², ft², …] }   │
                    │  displayUnits: { area: "ft²" }         │  ← how to show it
                    └────────────────────────────────────────┘
                                    │
                                    ▼
              ┌────────────────────────────────────────────────┐
              │ leaf.valueType = "area"                        │  ← per-leaf override
              │ leaf.value = 42.5                              │  ← ALWAYS base unit (m²)
              │ leaf.factor1 = 8.5                             │
              │ leaf.factor2 = 5                               │
              │                                                │
              │ render → 42.5 × 10.7639104 = 457.47            │  ← converted at render time
              │        → "457.47 ft²"                          │
              │        → "Length: 27.89 ft"                    │  ← factor unit converts too
              │        → "Breadth: 16.40 ft"                   │
              └────────────────────────────────────────────────┘
                                    │
                                    ▼
              ┌────────────────────────────────────────────────┐
              │ parent.getNodeValue() = 60.5 (m²)               │  ← sum in BASE units
              │                                                │
              │ render → 60.5 × 10.7639104 = 651.27            │
              │        → "Σ 651.27 ft²"                        │
              └────────────────────────────────────────────────┘
```

**Stored numbers never change** when the display unit changes. Only `displayUnits[id]` on the document changes. That's what makes the switcher lossless and reversible.

---

## Export

Export logic stays in `page.tsx` since it operates on DOM refs (`printRef`/`canvasRef`), not the data model. Value lines render as ordinary DOM text (already converted to the current display unit), so they're captured by PNG/SVG/PDF export exactly like title/description — no export-specific code needed. Whatever unit is on screen when the export button is clicked is what ends up in the file.

### PNG
`html2canvas` at 3× scale, after fitting the full diagram into view.

### SVG
`html-to-image`, vector output.

### PDF
Dialog: page size (A4/A3/A2), orientation (portrait/landscape). Uses the browser's print-to-PDF engine, scaled to fit. Text, arrows, numbering, and value lines remain vector.

### IFC
See the IFC section above.

---

## Upload flow

1. `editor.handleUpload` reads the file with `FileReader`.
2. `JSON.parse` and validate:
   - `title` required.
   - Per-node shape including `value`, `factor1`, `factor2` (all must be non-negative finite numbers if present), legacy `area` (same rules), and `valueType` (must be a known preset id if present).
   - Document-level `valueDef` (needs string `label` and `unit`; if `units` is present, each entry needs string `symbol`, number `fromBase`, number `toBase`).
   - Document-level `displayUnits` (an object of string values) and legacy `displayUnit` (string).
3. On success: `migrateProcessData` rewrites any legacy `area` → `value` and moves a legacy `displayUnit` → `displayUnits: { area: "<old>" }`. Then `setData` runs and `completed`/`edgeStyles`/`persons`/`displayUnits`/`valueDef` are rehydrated from the JSON.
4. `page.tsx`'s `useEffect` on `editor.loadVersion` triggers `fitAllView()` on the next frame.
5. On failure: sets `editor.error`, shown as an error banner with a "download sample template" action.
6. File input value is reset so the same file can be re-uploaded.
7. Labels should **not** include manual numbering. `value` on a node with children is simply ignored by `getNodeValue` (it only reads leaves) — no upload error for it, but it will never show up anywhere.

---

## Mobile support

- **Touch action: none** on canvas to prevent browser scroll/zoom.
- **Pinch** to zoom at midpoint. **One finger drag** to pan.
- **Long press** to edit text (title/description/value/factor).
- Toolbar is responsive and scrolls horizontally if needed.

---

## Extending this

- **Add total nodes stat**: `countNodes(rootNode)` already exists in `process-utils.ts`. Read it in `page.tsx`, drop into the toolbar.
- **Persist completion across reloads**: partially supported via JSON `completed` field already. Could layer `localStorage` on top.
- **New node-level field** (owner, due date, notes): add to `ProcessNode` in `process-utils.ts`, render in `ProcessContainer.tsx`, extend the `editingField` union + `updateNode` in the hook if it needs inline editing. No other files need touching.
- **New value preset** (e.g. "Temperature", "Flow rate"): add an entry to `VALUE_PRESETS` in `process-utils.ts` with its `label`, `unit`, `units` array, and (optionally) `factorLabels` + `factorUnit`. It immediately appears as a chip in the value panel and in the per-leaf type dropdown.
- **Custom value type from the UI** (name it + set base/display units on the fly): add a "Custom..." option to the value panel that builds a `ValueDef` from user input and passes it to `editor.setDefaultValueType`. Deferred until there's a real need.
- **Walls / slabs / openings in the IFC export**: extend `ifc-generator.ts` to emit `IFCWALLSTANDARDCASE` and `IFCOPENINGELEMENT`. About 10× more code than the current spatial-only export.
- **Per-node multi-metric** (two parallel numbers on the same node): this is a different model. Would be `metrics: Record<string, number>` on the node plus a `metricDefs: MetricDef[]` on the document, with `getNodeMetric(node, id)` as the rollup. Deferred — the single-value-with-per-leaf-type model covers the common case.
- **Drag-to-reorder**: not implemented; node order follows `children` array order (numbering already tracks it automatically). Extend with drag events + a reorder function in `useProcessEditor.ts` alongside `addNodeToTree`.
- **New editing behavior** (bulk-delete, move a node to a different parent): add to `useProcessEditor.ts` alongside `deleteNode`/`duplicateNode`, expose from the hook's return object — `page.tsx` shouldn't touch `data` directly.
- **Custom numbering format**: change the one line in `ProcessContainer.tsx` that renders `numberPath.join(".")`.
- **Live currency exchange rates**: the cost preset's conversion factors are static. Replace with a lookup against a rates table stored on the document, or fetched once at load. Deferred — the model already supports it via `ValueDef.units`, only the numbers need to come from somewhere else.
- **Richer PDF report layouts**: the space report currently emits a summary-by-block table and a flat detailed table. A per-block detailed section (Block heading, then its rooms) would be a small extension to `renderSpaceReport`. Deferred.