// areadata-json.ts
//
// JSON bridge between AreaCalc and the Process Editor.
//
// The Process Editor clipboard envelope looks like:
//   {
//     marker: "modelflick-process-node-v1",
//     node: { id, label, description?, children?, value?, factor1?, factor2?, valueType?, ... }
//   }
//
// We map:
//   Process node        ↔  AreaCalc SpaceInstance
//   ────────────────────────────────────────────
//   node.label          ↔  space.name
//   node.description    ↔  space.description
//   node.value          ↔  area hint (parents) or L×B (leaves)
//   node.factor1        ↔  space.L    (LEAVES ONLY — never written on parents)
//   node.factor2        ↔  space.B    (LEAVES ONLY — never written on parents)
//   node.children[]     ↔  space.subSpaces[]
//   node.valueType      ↔  always "area"
//   node.id             ↔  space.instanceId
//
// Rationale for the leaf-only rule:
//   A node with children has a derived value (Σ of its children) in the
//   Process Editor. Printing L × B on a parent confuses reports that
//   compare the two — the L×B describes the room's own footprint, while
//   the value describes the rolled-up area of everything inside it.
//   Keeping the fields absent on parents makes the intent unambiguous.
//   The parent's own footprint is still recoverable from `value` alone
//   if anyone ever wants to reconstruct it from the JSON alone.

import {
  FLOORS,
  calcSpaceArea,
  uid,
  type CategoryKey,
  type SpaceInstance,
  type SubSpaceInstance,
} from "./areadata";

/* ─── Types (mirroring the Process Editor) ───────────────────── */

export type ProcessNode = {
  id: string;
  label: string;
  description?: string;
  children?: ProcessNode[];
  value?: number;
  factor1?: number;
  factor2?: number;
  valueType?: string;
};

export type ProcessEnvelope = {
  marker: "modelflick-process-node-v1";
  node: ProcessNode;
};

export const PROCESS_MARKER = "modelflick-process-node-v1";

/* ─── Export: AreaCalc → Process Editor ──────────────────────── */

function subToNode(sub: SubSpaceInstance): ProcessNode {
  // Sub-spaces are always leaves.
  const L = typeof sub.L === "number" && sub.L > 0 ? sub.L : 0;
  const B = typeof sub.B === "number" && sub.B > 0 ? sub.B : 0;
  const value = L && B ? +(L * B).toFixed(4) : undefined;

  const node: ProcessNode = {
    id: sub.instanceId || uid(),
    label: sub.name || "Sub-space",
    valueType: "area",
    children: [],
  };
  if (sub.description) node.description = sub.description;
  if (value !== undefined) node.value = value;
  if (L) node.factor1 = L;
  if (B) node.factor2 = B;
  return node;
}

function spaceToNode(space: SpaceInstance): ProcessNode {
  const children = space.subSpaces ?? [];
  const isParent = children.length > 0;

  const L = typeof space.L === "number" && space.L > 0 ? space.L : 0;
  const B = typeof space.B === "number" && space.B > 0 ? space.B : 0;

  const node: ProcessNode = {
    id: space.instanceId || uid(),
    label: space.name || "Space",
    valueType: "area",
  };
  if (space.description) node.description = space.description;

  if (isParent) {
    // Parents: no factor1 / factor2. Their value is the rolled-up total
    // of everything beneath them (matches calcSpaceArea). We keep the
    // `value` field as a hint for anyone reading the JSON directly —
    // the Process Editor ignores it and derives its own sum from the
    // children, so it never conflicts with what's rendered.
    const total = +(calcSpaceArea(space) || 0).toFixed(4);
    node.children = children.map(subToNode);
    node.value = total;
  } else {
    // Leaves: value = L × B, and the factors are kept so the Process
    // Editor can display "Length × Breadth" and let the user edit
    // either dimension to recompute.
    const value = L && B ? +(L * B).toFixed(4) : undefined;
    node.children = [];
    if (value !== undefined) node.value = value;
    if (L) node.factor1 = L;
    if (B) node.factor2 = B;
  }

  return node;
}

/** Wrap the entire set of spaces in a single root node and envelope it. */
export function spacesToEnvelope(
  projectName: string,
  spaces: SpaceInstance[],
): ProcessEnvelope {
  // The root is a parent by definition, so it never carries factors.
  const node: ProcessNode = {
    id: uid(),
    label: projectName || "Untitled Project",
    valueType: "area",
    children: spaces.map(spaceToNode),
  };
  return { marker: PROCESS_MARKER, node };
}

export function spacesToJsonString(
  projectName: string,
  spaces: SpaceInstance[],
): string {
  return JSON.stringify(spacesToEnvelope(projectName, spaces), null, 2);
}

/* ─── Import: Process Editor → AreaCalc ──────────────────────── */

function nodeToSub(node: ProcessNode): SubSpaceInstance {
  const L = typeof node.factor1 === "number" && node.factor1 > 0 ? node.factor1 : 8;
  const B = typeof node.factor2 === "number" && node.factor2 > 0 ? node.factor2 : 6;
  return {
    instanceId: node.id || uid(),
    templateId: "custom",
    name: node.label || "Sub-space",
    L,
    B,
    description: node.description ?? "",
  };
}

function nodeToSpace(node: ProcessNode, floor: number): SpaceInstance {
  // When a parent node doesn't carry factor1/factor2 (which is now the
  // default for our exports), we still need to give AreaCalc a sensible
  // L and B for the parent's own footprint. Derive it from the node's
  // own value if present; otherwise fall back to 10 × 10.
  const L =
    typeof node.factor1 === "number" && node.factor1 > 0
      ? node.factor1
      : 10;
  const B =
    typeof node.factor2 === "number" && node.factor2 > 0
      ? node.factor2
      : 10;

  const subs = (node.children ?? []).map(nodeToSub);

  return {
    instanceId: node.id || uid(),
    templateId: "custom",
    name: node.label || "Space",
    category: "residence" as CategoryKey,
    L,
    B,
    floor,
    icon: "📐",
    isCustom: true,
    description: node.description ?? "",
    subSpaces: subs,
  };
}

export type ParsedImport =
  | { ok: true; projectName: string; spaces: SpaceInstance[] }
  | { ok: false; error: string };

/**
 * Accepts either the raw envelope, a bare node, or an object with a
 * `spaces` array — because people paste all sorts of things.
 */
export function parseProcessJson(text: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That doesn't look like valid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "JSON must be an object." };
  }

  const obj = parsed as Record<string, unknown>;

  // Case 1: the envelope
  if (obj.marker === PROCESS_MARKER && obj.node && typeof obj.node === "object") {
    const root = obj.node as ProcessNode;
    const children = Array.isArray(root.children) ? root.children : [];
    if (children.length === 0) {
      return {
        ok: true,
        projectName: root.label || "Imported Project",
        spaces: [nodeToSpace(root, 0)],
      };
    }
    return {
      ok: true,
      projectName: root.label || "Imported Project",
      spaces: children.map((child) => nodeToSpace(child, 0)),
    };
  }

  // Case 2: a bare node (no envelope)
  if (typeof obj.id === "string" && typeof obj.label === "string") {
    const root = obj as unknown as ProcessNode;
    const children = Array.isArray(root.children) ? root.children : [];
    if (children.length === 0) {
      return {
        ok: true,
        projectName: root.label || "Imported Project",
        spaces: [nodeToSpace(root, 0)],
      };
    }
    return {
      ok: true,
      projectName: root.label || "Imported Project",
      spaces: children.map((child) => nodeToSpace(child, 0)),
    };
  }

  // Case 3: someone pasted an AreaCalc `spaces` array directly
  if (Array.isArray(obj.spaces)) {
    const spaces = (obj.spaces as unknown[]).map((s) => {
      const sp = s as Partial<SpaceInstance>;
      return {
        instanceId: sp.instanceId || uid(),
        templateId: sp.templateId || "custom",
        name: sp.name || "Space",
        category: (sp.category as CategoryKey) || "residence",
        L: typeof sp.L === "number" ? sp.L : 10,
        B: typeof sp.B === "number" ? sp.B : 10,
        floor:
          typeof sp.floor === "number" && FLOORS.includes(sp.floor)
            ? sp.floor
            : 0,
        icon: sp.icon || "📐",
        isCustom: sp.isCustom ?? true,
        description: sp.description ?? "",
        subSpaces: Array.isArray(sp.subSpaces) ? sp.subSpaces : [],
        projectSpaceDbId: sp.projectSpaceDbId,
      } satisfies SpaceInstance;
    });
    return {
      ok: true,
      projectName:
        typeof obj.projectName === "string"
          ? obj.projectName
          : "Imported Project",
      spaces,
    };
  }

  return {
    ok: false,
    error:
      "JSON doesn't match a Process Editor node, an envelope, or an AreaCalc spaces array.",
  };
}

/* ─── Duplicate detection + import modes ─────────────────────── */

export type DuplicatePolicy = "keep" | "merge" | "skip";

/**
 * Two spaces are "the same" when their name, description, dimensions,
 * floor and sub-space names all match. instanceId is ignored on
 * purpose — that's what lets us spot the "same node pasted twice" case.
 */
export function spacesLookIdentical(a: SpaceInstance, b: SpaceInstance): boolean {
  if ((a.name ?? "").trim().toLowerCase() !== (b.name ?? "").trim().toLowerCase())
    return false;
  if ((a.description ?? "").trim() !== (b.description ?? "").trim()) return false;
  if (Math.abs((a.L ?? 0) - (b.L ?? 0)) > 1e-6) return false;
  if (Math.abs((a.B ?? 0) - (b.B ?? 0)) > 1e-6) return false;
  if ((a.floor ?? 0) !== (b.floor ?? 0)) return false;
  if (a.subSpaces.length !== b.subSpaces.length) return false;
  for (let i = 0; i < a.subSpaces.length; i++) {
    const sa = a.subSpaces[i];
    const sb = b.subSpaces[i];
    if ((sa.name ?? "").trim().toLowerCase() !== (sb.name ?? "").trim().toLowerCase())
      return false;
    if (Math.abs((sa.L ?? 0) - (sb.L ?? 0)) > 1e-6) return false;
    if (Math.abs((sa.B ?? 0) - (sb.B ?? 0)) > 1e-6) return false;
  }
  return true;
}

/**
 * Given an incoming list of spaces and a mode, produce the merged list
 * and a report of what happened.
 *
 *   "replace" → the incoming list replaces the existing list entirely.
 *   "append"  → the incoming list is concatenated onto the existing
 *               list, with NO dedup.
 *   "merge"   → incoming spaces that are identical (by content, not id)
 *               to an existing one are dropped; new ones are appended.
 */
export type ImportMode = "replace" | "append" | "merge";

export type MergeReport = {
  result: SpaceInstance[];
  added: number;
  duplicatesSkipped: number;
  replaced: boolean;
};

export function mergeSpaces(
  existing: SpaceInstance[],
  incoming: SpaceInstance[],
  mode: ImportMode,
): MergeReport {
  if (mode === "replace") {
    return {
      result: incoming,
      added: incoming.length,
      duplicatesSkipped: 0,
      replaced: true,
    };
  }

  if (mode === "append") {
    return {
      result: [...existing, ...incoming],
      added: incoming.length,
      duplicatesSkipped: 0,
      replaced: false,
    };
  }

  // merge — keep existing untouched, skip incoming that match any
  // existing or any earlier-accepted incoming.
  const kept: SpaceInstance[] = [...existing];
  let added = 0;
  let skipped = 0;

  for (const inc of incoming) {
    const isDup = kept.some((k) => spacesLookIdentical(k, inc));
    if (isDup) {
      skipped++;
      continue;
    }
    kept.push(inc);
    added++;
  }

  return {
    result: kept,
    added,
    duplicatesSkipped: skipped,
    replaced: false,
  };
}

/** How many of the incoming spaces look identical to something in `existing`? */
export function countIncomingDuplicates(
  existing: SpaceInstance[],
  incoming: SpaceInstance[],
): number {
  let count = 0;
  for (const inc of incoming) {
    if (existing.some((k) => spacesLookIdentical(k, inc))) count++;
  }
  return count;
}

/** How many duplicates exist *within* the incoming list itself? */
export function countInternalDuplicates(incoming: SpaceInstance[]): number {
  let count = 0;
  for (let i = 0; i < incoming.length; i++) {
    for (let j = i + 1; j < incoming.length; j++) {
      if (spacesLookIdentical(incoming[i], incoming[j])) {
        count++;
        break;
      }
    }
  }
  return count;
}