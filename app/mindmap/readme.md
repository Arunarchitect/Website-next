# Mind Map Editor

A single-page mind-mapping tool built on [React Flow](https://reactflow.dev) (`@xyflow/react`). Import/export a plain JSON file — everything else (positions, physics, connecting, styling) happens live in the browser.

---

## File Map

| File | Role |
|------|------|
| `MindMapEditor.tsx` | Main component — owns all state (nodes, edges, title, selection, physics), wires every event handler, renders `<ReactFlow>`. |
| `types.ts` | TypeScript interfaces for the JSON file and React Flow node/edge data. |
| `Utils.ts` | Everything that isn't a React component: JSON ↔ React Flow conversion, layout algorithms, edge-styling helpers, constants. |
| `CustomNode.tsx` | Node rendering — shape, label (double-click to rename), and the "+" connect handle with free-docking support. |
| `FloatingEdge.tsx` | Edge rendering — computes boundary intersection for free docking, draws the bezier curve, shows the direction/style chip. |
| `EditPanel.tsx` | Right sidebar — every field for the currently selected box or line. |
| `Toolbar.tsx` | Top bar — title, import/save/export, add node, layout buttons (Tree / Force / Radial). |
| `mindmap.css` | All styling, scoped under `.mindmap-page` so it won't leak into the rest of your app. |

**Data flow:** `JSON → jsonToFlow() → React Flow → flowToJson() → JSON`

---

## The JSON File

```json
{
  "_readme": ["Format docs..."],
  "title": "My Map",
  "stages": [
    { "id": "idea", "label": "Idea", "parentId": null, "color": "#5B5BD6", "shape": "circle" },
    { "id": "research", "label": "Market research", "parentId": "idea" }
  ],
  "relationships": [
    { "source": "research", "target": "idea", "label": "informs", "direction": "backward" }
  ]
}
```

### `stages` — the boxes
- Only `id` and `label` are required.
- `parentId` drives the hierarchy (Tree layout and depth-based default coloring) — set it to another stage's `id`, or `null` for a top-level box.
- **Positions are never stored.** Every time a file is opened, `computeTreeLayout` recalculates `x`/`y` from scratch based on the parent/child structure. This is why you can hand-edit `parentId` in a text editor and the map will re-arrange itself correctly on next import.
- `size` is intentionally omitted unless you've manually resized a box — that's what lets boxes keep auto-fitting their label as you rename them.

### `relationships` — the lines
- You only need to list one explicitly if you want it labeled, styled, reversed, or if it connects two boxes that **aren't** parent/child.
- Plain parent→child lines are added automatically (`jsonToFlow`'s implicit-edge pass).

### `_readme`
- An array of strings written into the file on every save so it explains its own format if someone opens it in a text editor. The app ignores this field on import.

---

## Nodes: Shape, Size, Connecting

### Shape & Stroke
Each box has:
- `shape`: `circle` | `roundedRectangle` | `rectangle` | `diamond` | `hexagon`
- `strokeColor`, `strokeWidth`

`CustomNode.tsx` turns these into CSS: circle/rectangle variants use `border-radius`, diamond/hexagon use `clip-path` polygons. All shapes still share one underlying `size` number (used for layout spacing/collision) — an aspect-ratio table (`SHAPE_ASPECT` in `CustomNode.tsx`) just decides how that size renders width vs. height per shape.

### Size
`data.size` is the box's footprint in pixels. While `data.autoSize` is `true` (the default), `estimateNodeSize()` recalculates it from the label's length every time you rename the box — a one-word box and a full-sentence box don't compete for the same circle.

The moment you drag the size slider (or the ± buttons) in the edit panel, `autoSize` flips to `false` and the box keeps that exact size from then on, including through save/reload (only non-auto sizes get written to the JSON).

### Connecting / Creating — Free Docking System
Each box has one visible affordance: a small "+" circle at its bottom edge (hidden until you hover or select the box). Click-drag from it:

- **Onto empty canvas** → `onConnectEnd` in `MindMapEditor.tsx` sees the drag ended without landing on a handle, creates a new box at the drop point via `createNode()`, and connects the two.
- **Onto another box** → The connection docks at the exact point where you release the mouse on the target box's edge. The edge automatically calculates where it intersects the target node's boundary, giving you free docking anywhere on the shape's perimeter — not just predefined points.

This works because `CustomNode.tsx` has invisible handles on all sides (top, bottom, left, right) with `pointerEvents: "all"` that catch connections anywhere on the node.

---

## Edges: How the Curve Gets Drawn

`FloatingEdge.tsx` is a **custom edge renderer**, registered as `edgeTypes={{ floating: FloatingEdge }}` on `<ReactFlow>`. Every edge object has `type: "floating"` (hardcoded in `Utils.ts`), which tells React Flow to render it using this component instead of a built-in one.

What it does, each render:

1. `useInternalNode(source)` / `useInternalNode(target)` — reads each box's real, currently-measured position and size (`node.internals.positionAbsolute`, `node.measured.width/height`).
2. `getBoxIntersection()` — finds where the straight line between the two boxes' centers crosses each box's bounding rectangle. That becomes the edge's actual start/end point, so the line touches the visible shape wherever it happens to be — no matter which shape, and it updates live as you drag boxes around. (For diamond/hexagon this is a close approximation using the bounding box, not the exact clipped outline.)
3. `getBezierPath()` — turns those two points into a curved SVG path with dynamic curvature based on the relative positions of the nodes.
4. `<BaseEdge>` draws that path with the edge's `style` (color/thickness/dash pattern) and `markerEnd`/`markerStart` (the arrowheads) — both of which are set per-edge back in `Utils.ts` whenever you change direction/color/style.
5. `<EdgeLabelRenderer>` floats the little pill (`.mm-edge-chip`) at the path's midpoint, with:
   - The label text (defaults to `"related"` if not specified)
   - **⟳** — Cycle through connection directions (`forward` → `backward` → `bidirectional` → `forward`)
   - **⚡** — Cycle through line styles (`solid` → `dashed` → `dotted` → `solid`)
   - **✕** — Remove/undock the connection

> ⚠️ If `edgeTypes` doesn't register `"floating"`, React Flow doesn't fall back to a plain line — it skips drawing the edge entirely and logs a warning. That's the failure mode this file exists to prevent.

---

## Layout: Tree vs. Force vs. Radial

All layout modes live in `Utils.ts` and only ever move boxes — they never touch the JSON.

### Tree (`computeTreeLayout`)
Deterministic, one shot. Groups boxes into columns by depth (root at `x=0`), orders each column by where its parent landed, and spaces everything by each box's own `size` so bigger boxes don't overlap. Runs instantly, no animation.

### Force (`createForceEngine` / `runForceLayout`)
A live [d3-force](https://d3js.org/d3-force) simulation: every box repels every other box (`forceManyBody`), every connector pulls like a spring (`forceLink`), boxes can't overlap (`forceCollide`, sized to `data.size`). `runForceLayout` is the one-shot version the "Force" toolbar button calls — release the whole graph, let it drift, settle, stop.

### Radial (`computeRadialLayout`)
Places the root at the center and arranges each node's children in a circle around it. Every subtree gets an angular "slice" of the circle proportional to how many leaf nodes it contains, so dense branches get more room and the whole thing stays visually balanced. Produces the classic hub-and-spoke mind-map look.

### Live Drag Repulsion
Once you've pressed "Force," `physicsMode` stays on. Grabbing a box afterward (`onNodeDragStart`) spins up a fresh `createForceEngine` seeded from the current graph and **pins** the dragged box to the cursor (`engine.pin`) — its position is fixed, but everything else keeps reacting through the same repel/spring/collide forces, so the rest of the map visibly pushes out of the way. Letting go (`onNodeDragStop`) calls `engine.unpin`, which sets the simulation's target energy back to zero and lets it settle on its own.

---

## Editing a Selection

`MindMapEditor.tsx` tracks `selectedNodeId` / `selectedEdgeId` via React Flow's `onSelectionChange`. Whichever is set gets passed into `EditPanel.tsx`, which renders the matching set of fields and calls back up through `onUpdateNode` / `onUpdateEdge` — both of which just merge a patch into that node/edge's `data` (or, for edges, run it through `applyEdgeStyle` in `Utils.ts` so the direction/color/width/dash-pattern stay in sync no matter whether the change came from the panel or from clicking the edge chip).

---

## Quick Start

```bash
# Install dependencies
npm install @xyflow/react d3-force
npm install -D @types/d3-force

# Run development server
npm run dev
```

The editor will be available at `http://localhost:3000/mindmap`.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect from plus sign | Make sure `CustomNode.tsx` has `pointerEvents: "all"` on all handles and `connectionMode={ConnectionMode.Loose}` is set on `<ReactFlow>`. |
| Edges/arrows invisible | Check the browser console for `Edge type "floating" not found`. That means `FloatingEdge.tsx` either isn't saved in the same folder as the others, or `edgeTypes` isn't passed to `<ReactFlow>` in `MindMapEditor.tsx`. |
| Boxes won't drag | Make sure `CustomNode.tsx` only has the small `.mm-node-plus` element carrying a `Handle`, not a full-body one — a handle covering the whole shape intercepts every click before React Flow's own node-drag logic sees it. |
| Connections attaching wrong | The free-docking system uses boundary intersection calculations. Make sure `getBoxIntersection()` in `FloatingEdge.tsx` is using the correct node dimensions from `useInternalNode()`. |
| `d3-force` errors | `npm install d3-force` (and `@types/d3-force` if you're strict about types) if it's not already a dependency. |
| Can't undock connections | Make sure the ✕ button in `FloatingEdge.tsx` has `onClick` that filters the edge out of the edges array using `setEdges`. |
| Connections won't land on a box | `connectionMode` on `<ReactFlow>` needs to be `ConnectionMode.Loose`. |
| Stroke color errors | Ensure `strokeColor` has a default value in `createNode()` and `jsonToFlow()`. |
| `onRename is not a function` | Check that `onRename` is passed to `createNode()` and `jsonToFlow()` before being used in `CustomNode.tsx`. |

---

Built with ❤️ for visual thinkers
