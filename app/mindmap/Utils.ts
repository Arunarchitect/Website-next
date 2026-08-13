import { Edge, MarkerType, Node } from "@xyflow/react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  Simulation,
} from "d3-force";
import { MindMapJson, MindMapNodeData, NodeShape } from "./types";

// Cycled by node depth (distance from its topmost ancestor) so a freshly
// imported map reads like a map — related tiers share a family of hue.
export const DEPTH_COLORS = [
  "#5B5BD6", // indigo — root / stage 0
  "#14B8A6", // teal
  "#F59E0B", // amber
  "#F43F5E", // rose
  "#8B5CF6", // violet
  "#0EA5A5", // cyan
];

// Offered as quick-pick swatches for connector lines.
export const DIRECTION_COLORS = {
  neutral: "#94A3B8",
  indigo: "#5B5BD6",
  teal: "#14B8A6",
  amber: "#F59E0B",
  rose: "#F43F5E",
};

export const EDGE_TYPE = "floating";

// Shapes offered in the edit panel, plus their default aspect ratio relative
// to a node's "size" (its layout footprint — kept identical across shapes so
// Tree/Force layout math never needs to know about shape geometry).
export const NODE_SHAPES: { id: NodeShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "roundedRectangle", label: "Rounded rectangle" },
  { id: "rectangle", label: "Rectangle" },
  { id: "diamond", label: "Diamond" },
  { id: "hexagon", label: "Hexagon" },
];

export const LINE_STYLES: { id: "solid" | "dashed" | "dotted"; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
];

export const MIN_NODE_SIZE = 60;
export const MAX_NODE_SIZE = 260;
export const NODE_SIZE_STEP = 12;

const README_LINES = [
  "MIND MAP FILE FORMAT — safe to edit by hand.",
  "title: shown at the top of the editor.",
  "stages: the boxes. Each needs a unique 'id' and a 'label'. Set 'parentId' to another stage's 'id' to nest it under that stage, or null to keep it top-level. That's the only thing that drives layout — positions are never stored here, they're generated fresh every time the file is opened.",
  "Optional per stage: 'color' (fill, hex like '#5B5BD6'), 'textColor' (hex), 'fontSize' (px), 'shape' (one of 'circle' | 'roundedRectangle' | 'rectangle' | 'diamond' | 'hexagon'), 'strokeColor' (hex or rgba), 'strokeWidth' (px).",
  "'size' (px, the box's footprint) is optional and usually best left out — the app auto-fits the box to its label. Only include it if you want to force an exact size; once present it overrides auto-sizing until removed.",
  "relationships: the connector lines. Each needs 'source' and 'target' (stage ids). Optional: 'label', 'direction' ('forward' | 'backward' | 'bidirectional'), 'color' (hex), 'strokeWidth', 'lineStyle' ('solid' | 'dashed' | 'dotted').",
  "You don't have to list a relationship for every parent/child pair — any stage with a 'parentId' gets a default connecting line automatically. Only add one to 'relationships' when you want it labeled, styled, or connecting boxes that aren't parent/child.",
  "Easiest way to edit: open this file with Import in the app and use the editor UI — it writes valid JSON back out, comment included.",
];

export function newNodeId(): string {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "mind-map";
}

export function downloadJson(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// A circle sized to roughly fit its label, so a one-word box and a
// full-sentence box don't compete for the same footprint.
export function estimateNodeSize(label: string): number {
  const len = (label || "").trim().length || 1;
  const size = 82 + Math.sqrt(len) * 13;
  return Math.round(Math.min(MAX_NODE_SIZE, Math.max(MIN_NODE_SIZE, size)));
}

export function clampNodeSize(size: number): number {
  return Math.round(Math.min(MAX_NODE_SIZE, Math.max(MIN_NODE_SIZE, size)));
}

// ---- JSON -> React Flow -------------------------------------------------

function depthOf(id: string, byId: Map<string, { parentId?: string | null }>, seen = new Set<string>()): number {
  const stage = byId.get(id);
  if (!stage || !stage.parentId || !byId.has(stage.parentId) || seen.has(id)) return 0;
  seen.add(id);
  return 1 + depthOf(stage.parentId, byId, seen);
}

function lineDash(lineStyle: string | undefined): string | undefined {
  if (lineStyle === "dashed") return "7 5";
  if (lineStyle === "dotted") return "1.5 5";
  return undefined;
}

export interface EdgeCallbacks {
  onRename: (id: string, label: string) => void;
  onCycleDirection: (id: string) => void;
  onCycleStyle: (id: string) => void;
}

export function jsonToFlow(
  json: MindMapJson,
  callbacks: EdgeCallbacks
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  const stages = json.stages || [];
  const byId = new Map(stages.map((s) => [s.id, s]));

  const nodes: Node<MindMapNodeData>[] = stages.map((s) => {
    const depth = depthOf(s.id, byId);
    const label = s.label ?? "Untitled";
    return {
      id: s.id,
      type: "mindmapNode",
      position: { x: 0, y: 0 },
      data: {
        label,
        color: s.color ?? DEPTH_COLORS[depth % DEPTH_COLORS.length],
        textColor: s.textColor ?? "#ffffff",
        fontSize: s.fontSize ?? 13,
        size: s.size != null ? clampNodeSize(s.size) : estimateNodeSize(label),
        autoSize: s.size == null,
        shape: s.shape ?? "roundedRectangle",
        strokeColor: s.strokeColor ?? "rgba(255,255,255,0.55)",
        strokeWidth: s.strokeWidth ?? 2,
        depth,
        parentId: s.parentId ?? null,
        onRename: callbacks.onRename,  // <-- This must be set correctly
      },
    };
  });

  const relationships = json.relationships || [];
  const covered = new Set(relationships.map((r) => `${r.source}->${r.target}`));

  const buildEdge = (
    id: string,
    source: string,
    target: string,
    label: string,
    direction: string,
    color: string,
    strokeWidth: number,
    lineStyle: string
  ): Edge => ({
    id,
    source,
    target,
    type: EDGE_TYPE,
    label,
    data: {
      direction,
      lineStyle,
      onCycleDirection: callbacks.onCycleDirection,
      onCycleStyle: callbacks.onCycleStyle,
    },
    style: { stroke: color, strokeWidth, strokeDasharray: lineDash(lineStyle) },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
    markerStart: direction === "bidirectional" ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 } : undefined,
  });

  const edges: Edge[] = relationships.map((r, i) =>
    buildEdge(
      r.id || `e-${r.source}-${r.target}-${i}`,
      r.source,
      r.target,
      r.label || "",
      r.direction || "forward",
      r.color || DIRECTION_COLORS.neutral,
      r.strokeWidth || 1.6,
      r.lineStyle || "solid"
    )
  );

  // Fill in an implicit parent -> child line for any hierarchy relationship
  // the JSON didn't already spell out, so nothing appears as a floating box.
  stages.forEach((s) => {
    if (!s.parentId || !byId.has(s.parentId)) return;
    const key = `${s.parentId}->${s.id}`;
    if (covered.has(key)) return;
    covered.add(key);
    edges.push(
      buildEdge(`implicit-${s.parentId}-${s.id}`, s.parentId, s.id, "", "forward", DIRECTION_COLORS.neutral, 1.6, "solid")
    );
  });

  return { nodes: computeTreeLayout(nodes), edges };
}
// ---- React Flow -> JSON -------------------------------------------------

export function flowToJson(title: string, nodes: Node<MindMapNodeData>[], edges: Edge[]): MindMapJson {
  return {
    _readme: README_LINES,
    title,
    stages: nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      color: n.data.color,
      textColor: n.data.textColor,
      fontSize: n.data.fontSize,
      parentId: n.data.parentId,
      shape: n.data.shape,
      strokeColor: n.data.strokeColor,
      strokeWidth: n.data.strokeWidth,
      // Only pin the size down once the user has manually resized the box —
      // otherwise leave it out so it keeps auto-fitting the label next time.
      ...(n.data.autoSize ? {} : { size: n.data.size }),
    })),
    // Every visible connector — including ones auto-added for a parent/child
    // pair on import — is written back out explicitly, so any styling or
    // reversing the user did is never lost on the next save.
    relationships: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : "",
      direction: ((e.data?.direction as string) || "forward") as "forward" | "backward" | "bidirectional",
      color: (e.style?.stroke as string) || DIRECTION_COLORS.neutral,
      strokeWidth: (e.style?.strokeWidth as number) || 1.6,
      lineStyle: ((e.data?.lineStyle as string) || "solid") as "solid" | "dashed" | "dotted",
    })),
  };
}

// ---- Edge direction / style cycling -------------------------------------

export function nextDirection(current: string): "forward" | "backward" | "bidirectional" {
  if (current === "forward") return "backward";
  if (current === "backward") return "bidirectional";
  return "forward";
}

export function nextLineStyle(current: string): "solid" | "dashed" | "dotted" {
  if (current === "solid") return "dashed";
  if (current === "dashed") return "dotted";
  return "solid";
}

export interface EdgeStylePatch {
  direction?: string;
  color?: string;
  strokeWidth?: number;
  lineStyle?: string;
  label?: string;
}

// Central place that turns a patch (from the quick-click chip or the side
// panel — same shape either way) into the edge's rendered style, keeping
// both entry points in sync and preserving the callbacks stashed in data.
export function applyEdgeStyle(edge: Edge, patch: EdgeStylePatch): Edge {
  const direction = patch.direction ?? (edge.data?.direction as string) ?? "forward";
  const lineStyle = patch.lineStyle ?? (edge.data?.lineStyle as string) ?? "solid";
  const color = patch.color ?? (edge.style?.stroke as string) ?? DIRECTION_COLORS.neutral;
  const strokeWidth = patch.strokeWidth ?? (edge.style?.strokeWidth as number) ?? 1.6;
  const label = patch.label ?? edge.label;

  return {
    ...edge,
    label,
    data: { ...edge.data, direction, lineStyle },
    style: { stroke: color, strokeWidth, strokeDasharray: lineDash(lineStyle) },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
    markerStart: direction === "bidirectional" ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 } : undefined,
  };
}

// ---- Edge anchor fanning ---------------------------------------------------
//
// Prevents multiple edges on the same node from all landing at the same
// spot (which happens naturally in Tree layout, since parent/child sit
// almost purely left/right of each other, so every center-to-center line
// crosses near the same point on each box). For each node, every edge
// touching it gets sorted by its real bearing to the other node, then
// nudged apart by a small angular step so they spread around the box
// perimeter instead of bunching.

export interface EdgeFanAngles {
  sourceAngle: number;
  targetAngle: number;
}

const FAN_STEP = 0.14; // ~8° between adjacent edges
const FAN_MAX = 0.9; // ~50° total spread cap, so many edges don't wrap around

function angleToward(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function computeEdgeFanAngles(
  nodes: Node<MindMapNodeData>[],
  edges: Edge[]
): Map<string, EdgeFanAngles> {
  const centerById = new Map(
    nodes.map((n) => [n.id, { x: n.position.x + n.data.size / 2, y: n.position.y + n.data.size / 2 }])
  );

  const byNode = new Map<string, { edgeId: string; otherId: string }[]>();
  edges.forEach((e) => {
    if (!byNode.has(e.source)) byNode.set(e.source, []);
    byNode.get(e.source)!.push({ edgeId: e.id, otherId: e.target });
    if (!byNode.has(e.target)) byNode.set(e.target, []);
    byNode.get(e.target)!.push({ edgeId: e.id, otherId: e.source });
  });

  const angleAtNodeForEdge = new Map<string, number>();

  byNode.forEach((items, nodeId) => {
    const center = centerById.get(nodeId);
    if (!center) return;

    const withAngles = items
      .map((it) => {
        const otherCenter = centerById.get(it.otherId);
        if (!otherCenter) return null;
        return { edgeId: it.edgeId, angle: angleToward(center, otherCenter) };
      })
      .filter((v): v is { edgeId: string; angle: number } => v !== null)
      .sort((a, b) => a.angle - b.angle);

    const count = withAngles.length;
    const step = count > 1 ? Math.min(FAN_STEP, FAN_MAX / (count - 1)) : 0;
    const mid = (count - 1) / 2;

    withAngles.forEach((it, idx) => {
      angleAtNodeForEdge.set(`${nodeId}|${it.edgeId}`, it.angle + (idx - mid) * step);
    });
  });

  const result = new Map<string, EdgeFanAngles>();
  edges.forEach((e) => {
    result.set(e.id, {
      sourceAngle: angleAtNodeForEdge.get(`${e.source}|${e.id}`) ?? 0,
      targetAngle: angleAtNodeForEdge.get(`${e.target}|${e.id}`) ?? Math.PI,
    });
  });

  return result;
}

// ---- Layout modes ---------------------------------------------------------
//
// "Tree" is a deterministic, one-shot pass: nodes are grouped into columns
// by depth (root at x=0) and ordered within each column by their parent's
// row, spaced according to each node's own size so bigger labels don't
// overlap their neighbors.
//
// "Force" mimics Obsidian's graph view: every box repels every other box,
// every connector acts like a spring, and the whole thing is released and
// left to drift until it settles into an organic, non-hierarchical cluster.
// While force mode is active, dragging a box keeps the simulation "warm" —
// see createForceEngine below — so every other box reacts and repels away
// from the one being moved, instead of sitting frozen.

const COLUMN_GAP = 140;
const SIBLING_GAP = 28;

interface TreeNode {
  id: string;
  node: Node<MindMapNodeData>;
  children: TreeNode[];
  width: number;      // total width of this subtree
  x: number;          // relative x within its subtree
  y: number;          // relative y within its subtree
}

function buildTree(nodes: Node<MindMapNodeData>[]): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, Node<MindMapNodeData>[]>();
  
  nodes.forEach((n) => {
    const pid = n.data.parentId;
    if (pid && byId.has(pid)) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(n);
    }
  });

  const makeTree = (node: Node<MindMapNodeData>): TreeNode => ({
    id: node.id,
    node,
    children: (childrenMap.get(node.id) || []).map(makeTree),
    width: 0,
    x: 0,
    y: 0,
  });

  return nodes.filter((n) => !n.data.parentId || !byId.has(n.data.parentId)).map(makeTree);
}

function layoutTreeRecursive(tree: TreeNode, depth: number): void {
  const size = tree.node.data.size;
  
  if (tree.children.length === 0) {
    tree.width = size;
    tree.x = 0;
    tree.y = 0;
    return;
  }

  // Layout all children first
  let totalChildrenWidth = 0;
  tree.children.forEach((child, i) => {
    layoutTreeRecursive(child, depth + 1);
    totalChildrenWidth += child.width;
    if (i < tree.children.length - 1) totalChildrenWidth += SIBLING_GAP;
  });

  // Position children side by side
  let cursor = -totalChildrenWidth / 2;
  tree.children.forEach((child) => {
    child.x = cursor + child.width / 2;
    child.y = COLUMN_GAP;
    cursor += child.width + SIBLING_GAP;
  });

  // Parent sits centered above its children
  const firstChild = tree.children[0];
  const lastChild = tree.children[tree.children.length - 1];
  const childrenCenter = (firstChild.x + lastChild.x) / 2;
  
  tree.x = childrenCenter;
  tree.y = 0;
  tree.width = Math.max(size, totalChildrenWidth);
}

function flattenTreePositions(
  tree: TreeNode,
  offsetX: number,
  offsetY: number,
  map: Map<string, { x: number; y: number }>
): void {
  map.set(tree.id, { x: offsetX + tree.x, y: offsetY + tree.y });
  tree.children.forEach((child) => {
    flattenTreePositions(child, offsetX + tree.x, offsetY + tree.y + COLUMN_GAP, map);
  });
}

export function computeTreeLayout(nodes: Node<MindMapNodeData>[]): Node<MindMapNodeData>[] {
  if (nodes.length === 0) return nodes;

  const trees = buildTree(nodes);
  const positioned = new Map<string, { x: number; y: number }>();
  
  let xCursor = 0;
  trees.forEach((tree) => {
    layoutTreeRecursive(tree, 0);
    // Shift each independent tree to the right so they don't overlap
    flattenTreePositions(tree, xCursor, 0, positioned);
    xCursor += tree.width + COLUMN_GAP * 2;
  });

  return nodes.map((n) => ({ ...n, position: positioned.get(n.id) ?? n.position }));
}

interface SimNode {
  id: string;
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
}

export interface ForceEngine {
  /** Wake the simulation back up. alphaTarget keeps it warm (e.g. while a
   * drag is in progress); leave it at 0 to let it cool down and stop. */
  restart: (alphaTarget?: number) => void;
  /** Pin a node to an exact position (used while it's being dragged) so the
   * rest of the graph reacts to it without the pinned node itself drifting. */
  pin: (id: string, x: number, y: number) => void;
  /** Release a pinned node and let the simulation cool back down to rest. */
  unpin: (id: string) => void;
  stop: () => void;
}

// A persistent force simulation, separate from the one-shot runForceLayout
// below. Lets the caller "pin" whichever node the user is currently
// dragging while everything else keeps repelling/springing around it —
// this is what powers the organic repulsion when you drag a box in Force
// mode.
export function createForceEngine(
  nodes: Node<MindMapNodeData>[],
  edges: Edge[],
  onTick: (positions: Map<string, { x: number; y: number }>) => void,
  onEnd?: () => void
): ForceEngine {
  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
  }));
  const sizeById = new Map(nodes.map((n) => [n.id, n.data.size]));
  const simLinks = edges.map((e) => ({ source: e.source, target: e.target }));

  const simulation: Simulation<SimNode, undefined> = forceSimulation(simNodes)
    .force("charge", forceManyBody().strength(-420))
    .force(
      "link",
      forceLink(simLinks)
        .id((d) => (d as unknown as SimNode).id)
        .distance(170)
        .strength(0.5)
    )
    .force("center", forceCenter(0, 0))
    .force(
      "collide",
      forceCollide((d) => (sizeById.get((d as unknown as SimNode).id) ?? 104) / 2 + 24)
    )
    .alpha(1)
    .alphaDecay(0.025);

  simulation.on("tick", () => {
    const positions = new Map<string, { x: number; y: number }>();
    simNodes.forEach((n) => positions.set(n.id, { x: n.x, y: n.y }));
    onTick(positions);
  });
  if (onEnd) simulation.on("end", onEnd);

  const findNode = (id: string) => simNodes.find((n) => n.id === id);

  return {
    restart(alphaTarget = 0) {
      simulation.alphaTarget(alphaTarget).restart();
    },
    pin(id, x, y) {
      const n = findNode(id);
      if (!n) return;
      n.fx = x;
      n.fy = y;
      n.x = x;
      n.y = y;
    },
    unpin(id) {
      const n = findNode(id);
      if (n) {
        n.fx = null;
        n.fy = null;
      }
      simulation.alphaTarget(0);
    },
    stop() {
      simulation.stop();
    },
  };
}

// ---- Radial layout ---------------------------------------------------------
//
// Places the root at the center and arranges each node's children in a
// circle around it — every subtree gets an angular "slice" of the circle
// proportional to how many leaf nodes it contains, so dense branches get
// more room and the whole thing stays visually balanced. Produces the
// classic hub-and-spoke mind-map look, as opposed to Tree's strict
// left-to-right columns.

const RADIAL_RADIUS_STEP = 190;

function countLeaves(id: string, childrenMap: Map<string, Node<MindMapNodeData>[]>): number {
  const kids = childrenMap.get(id) || [];
  if (kids.length === 0) return 1;
  return kids.reduce((sum, k) => sum + countLeaves(k.id, childrenMap), 0);
}

export function computeRadialLayout(nodes: Node<MindMapNodeData>[]): Node<MindMapNodeData>[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map<string, Node<MindMapNodeData>[]>();
  nodes.forEach((n) => {
    const pid = n.data.parentId;
    if (pid && byId.has(pid)) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(n);
    }
  });

  // Nodes with no parent (or a parent that isn't in this map) are treated
  // as separate tree roots, each getting its own full circle of children.
  const roots = nodes.filter((n) => !n.data.parentId || !byId.has(n.data.parentId));

  const positioned = new Map<string, { x: number; y: number }>();

  function placeSubtree(nodeId: string, x: number, y: number, angleStart: number, angleEnd: number) {
    positioned.set(nodeId, { x, y });
    const kids = childrenMap.get(nodeId) || [];
    if (kids.length === 0) return;

    const leafCounts = kids.map((k) => countLeaves(k.id, childrenMap));
    const total = leafCounts.reduce((a, b) => a + b, 0);

    let cursor = angleStart;
    kids.forEach((k, i) => {
      const share = leafCounts[i] / total;
      const start = cursor;
      const end = cursor + share * (angleEnd - angleStart);
      const mid = (start + end) / 2;
      const kx = x + RADIAL_RADIUS_STEP * Math.cos(mid);
      const ky = y + RADIAL_RADIUS_STEP * Math.sin(mid);
      placeSubtree(k.id, kx, ky, start, end);
      cursor = end;
    });
  }

  if (roots.length <= 1) {
    if (roots[0]) placeSubtree(roots[0].id, 0, 0, 0, Math.PI * 2);
  } else {
    // Multiple independent trees — space their centers apart in a row so
    // their circles don't overlap.
    const ROOT_GAP = 700;
    roots.forEach((r, i) => placeSubtree(r.id, i * ROOT_GAP, 0, 0, Math.PI * 2));
  }

  return nodes.map((n) => ({ ...n, position: positioned.get(n.id) ?? n.position }));
}

// One-shot pass used by the "Force" toolbar button: releases the whole
// graph and lets it drift until it settles, then calls onEnd.
export function runForceLayout(
  nodes: Node<MindMapNodeData>[],
  edges: Edge[],
  onTick: (positions: Map<string, { x: number; y: number }>) => void,
  onEnd: () => void
): () => void {
  const engine = createForceEngine(nodes, edges, onTick, onEnd);
  engine.restart(0);
  return () => engine.stop();
}