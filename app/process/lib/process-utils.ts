/* =========================================================
   TYPES
========================================================= */

export type Person = {
  id: string;
  name: string;
};

export type ProcessNode = {
  id: string;
  label: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  predecessors?: string[];  // ids of predecessor nodes (same level)
  successors?: string[];    // ids of successor nodes (same level)
  assignedPersonIds?: string[]; // ids into ProcessData.persons — NOT inherited by children
  children?: ProcessNode[];
};

export type ProcessData = {
  title: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  completed?: string[];
  edgeStyles?: Record<string, { dashed?: boolean }>;
  persons?: Person[]; // global roster, referenced by ProcessNode.assignedPersonIds
  children?: ProcessNode[];
};

export type ColorTheme = {
  background: string;
  border: string;
  title: string;
  description: string;
};

/* =========================================================
   TREE HELPERS
========================================================= */

export function countNodes(node: ProcessNode): number {
  const children = node.children ?? [];
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}

export function getLeafIds(node: ProcessNode): string[] {
  const children = node.children ?? [];
  if (children.length === 0) return [node.id];
  return children.flatMap(getLeafIds);
}

export function isNodeComplete(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return completed.has(node.id);
  return children.every((child) => isNodeComplete(child, completed));
}

export function isNodePartial(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return false;
  const anyProgress = children.some(
    (child) => isNodeComplete(child, completed) || isNodePartial(child, completed)
  );
  const allComplete = children.every((child) => isNodeComplete(child, completed));
  return anyProgress && !allComplete;
}

/* =========================================================
   RELATION SANITIZATION
   ---------------------------------------------------------
   The ProcessNode/ProcessData types above only guarantee *shape*
   (id/label are strings, successors/predecessors are string arrays,
   etc). They can't express graph-level rules like "a node can't be its
   own successor" or "two nodes pointing at each other should read as a
   loop, not a rendering glitch." That's handled here instead.
========================================================= */

export type SanitizeResult = {
  data: ProcessData;
  notes: string[];
};

function collectAllNodes(node: ProcessNode, acc: ProcessNode[]) {
  acc.push(node);
  (node.children ?? []).forEach((c) => collectAllNodes(c, acc));
}

/**
 * Cleans up two specific relation problems that the TypeScript shape
 * can't catch on its own:
 *
 * 1. SELF-LOOPS — a node listing its own id in its own `successors` or
 *    `predecessors`. This is always a data bug (a node can't be its own
 *    predecessor/successor) and the offending id is stripped out.
 *
 * 2. MUTUAL PAIRS — two *different* nodes that reference each other in
 *    both directions (A is a successor of B *and* B is a successor of
 *    A). This is a legitimate pattern — e.g. an iterative feedback loop
 *    between two stages — but rendered as two overlapping solid arrows
 *    it just looks like a bug. Both directions get
 *    `edgeStyles[...].dashed = true` so the loop reads as intentional.
 *
 * Pure function — returns a new ProcessData (the input is never
 * mutated) plus a list of human-readable notes describing what changed,
 * so the caller can surface them instead of silently rewriting the
 * user's file.
 */
export function sanitizeProcessRelations(data: ProcessData): SanitizeResult {
  const notes: string[] = [];
  const rootChildren = data.children ?? [];

  // ── Pass 1: strip self-loops ──────────────────────────────────────
  const stripSelfLoops = (node: ProcessNode): ProcessNode => {
    const successors = (node.successors ?? []).filter((id) => id !== node.id);
    const predecessors = (node.predecessors ?? []).filter((id) => id !== node.id);

    if (node.successors && node.successors.length !== successors.length) {
      notes.push(`"${node.label}" listed itself as its own successor — removed.`);
    }
    if (node.predecessors && node.predecessors.length !== predecessors.length) {
      notes.push(`"${node.label}" listed itself as its own predecessor — removed.`);
    }

    return {
      ...node,
      successors: node.successors ? successors : undefined,
      predecessors: node.predecessors ? predecessors : undefined,
      children: node.children?.map(stripSelfLoops),
    };
  };

  const cleanedChildren = rootChildren.map(stripSelfLoops);

  // ── Pass 2: find mutual pairs across the *cleaned* tree ─────────────
  const allNodes: ProcessNode[] = [];
  cleanedChildren.forEach((c) => collectAllNodes(c, allNodes));
  const nodesById = new Map(allNodes.map((n) => [n.id, n]));

  const edgeSet = new Set<string>(); // "from->to"
  allNodes.forEach((n) => {
    (n.successors ?? []).forEach((to) => edgeSet.add(`${n.id}->${to}`));
  });

  const newEdgeStyles: Record<string, { dashed?: boolean }> = { ...(data.edgeStyles ?? {}) };
  const seenPairs = new Set<string>();

  edgeSet.forEach((key) => {
    const [from, to] = key.split("->");
    const reverseKey = `${to}->${from}`;
    if (!edgeSet.has(reverseKey)) return; // one-directional, nothing to do

    const pairKey = [from, to].sort().join("|");
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    const alreadyDashedBothWays = newEdgeStyles[key]?.dashed && newEdgeStyles[reverseKey]?.dashed;
    if (!alreadyDashedBothWays) {
      newEdgeStyles[key] = { ...newEdgeStyles[key], dashed: true };
      newEdgeStyles[reverseKey] = { ...newEdgeStyles[reverseKey], dashed: true };
      const fromLabel = nodesById.get(from)?.label ?? from;
      const toLabel = nodesById.get(to)?.label ?? to;
      notes.push(`"${fromLabel}" and "${toLabel}" reference each other — shown as a dashed loop.`);
    }
  });

  return {
    data: { ...data, children: cleanedChildren, edgeStyles: newEdgeStyles },
    notes,
  };
}

/**
 * Given a single from/to pair, tells you whether the *reverse* edge
 * (to -> from) already exists somewhere in the tree. Used by the editor
 * to decide, at the moment a relation is drawn interactively, whether it
 * just completed a mutual pair and should be dashed immediately rather
 * than waiting for the next sanitize pass.
 */
export function reverseEdgeExists(root: ProcessNode, fromId: string, toId: string): boolean {
  const findNode = (node: ProcessNode, id: string): ProcessNode | null => {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  };
  const toNode = findNode(root, toId);
  return !!toNode?.successors?.includes(fromId);
}

/* =========================================================
   COLOUR THEMES
========================================================= */

export function getColorTheme(level: number, colorIndex: number): ColorTheme {
  if (level === 0) {
    return {
      background: "#F3F6FA",
      border: "#B8C5D6",
      title: "#26364A",
      description: "#536273",
    };
  }

  const themes: ColorTheme[] = [
    { background: "#EEF7F0", border: "#B8D8BD", title: "#315C38", description: "#55725A" },
    { background: "#FFF5E8", border: "#E8C79A", title: "#754C20", description: "#80684B" },
    { background: "#F5F0FA", border: "#D1BDE2", title: "#5A3D70", description: "#725D83" },
    { background: "#EEF5FB", border: "#B8D2E8", title: "#315878", description: "#59748C" },
    { background: "#FBEFF2", border: "#E4BBC5", title: "#713D4A", description: "#805E66" },
    { background: "#FFF9E8", border: "#E6D49A", title: "#705E22", description: "#7C7048" },
  ];

  const base = themes[colorIndex % themes.length];

  if (level === 1) return base;

  if (level === 2) {
    return {
      background: lighten(base.background, 0.45),
      border: lighten(base.border, 0.15),
      title: base.title,
      description: base.description,
    };
  }

  return {
    background: lighten(base.background, 0.65),
    border: lighten(base.border, 0.3),
    title: base.title,
    description: base.description,
  };
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  return `rgb(${newR}, ${newG}, ${newB})`;
}

/* =========================================================
   TEXT SIZING
========================================================= */

export function getLayout(level: number) {
  const layouts = [
    { titleSize: "26px", descriptionSize: "15px", padding: "26px" },
    { titleSize: "19px", descriptionSize: "12px", padding: "16px" },
    { titleSize: "16px", descriptionSize: "11px", padding: "13px" },
    { titleSize: "14px", descriptionSize: "10px", padding: "11px" },
  ];
  return layouts[Math.min(level, layouts.length - 1)];
}