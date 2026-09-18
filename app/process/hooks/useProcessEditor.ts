"use client";

import { useEffect, useRef, useState } from "react";
import {
  Person,
  ProcessData,
  ProcessNode,
  ValueDef,
  ValueScope,
  VALUE_PRESETS,
  findNodeById as findNodeInTree,
  hasAnyValue,
  hasFactors,
  resolveNodeValueDef,
  resolveUnit,
  resolveValueDef,
  unitForType,
  factorFromDisplay,
  migrateProcessData,
  reverseEdgeExists,
  rescaleSubtree,
  scopeHasAnyValue,
  type RescaleResult,
} from "@/app/process/lib/process-utils";
import sampleProcess from "@/app/process/json/process.json";

// ─── Pure tree helpers ───────────────────────────────────────────

export function findNodeById(root: ProcessNode, id: string): ProcessNode | null {
  return findNodeInTree(root, id);
}

export function updateNodeData(
  root: ProcessNode,
  id: string,
  updater: (node: ProcessNode) => ProcessNode
): ProcessNode {
  if (root.id === id) return updater(root);
  if (root.children) {
    return { ...root, children: root.children.map((child) => updateNodeData(child, id, updater)) };
  }
  return root;
}

export function addNodeToTree(
  root: ProcessNode,
  parentId: string | null,
  newNode: ProcessNode,
  position: number
): ProcessNode {
  if (parentId === null) {
    const children = root.children || [];
    const newChildren = [...children];
    newChildren.splice(position, 0, newNode);
    return { ...root, children: newChildren };
  }

  if (root.id === parentId) {
    const children = root.children || [];
    const newChildren = [...children];
    newChildren.splice(position, 0, newNode);
    return { ...root, children: newChildren };
  }

  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => addNodeToTree(child, parentId, newNode, position)),
    };
  }
  return root;
}

function collectIds(node: ProcessNode): string[] {
  const ids = [node.id];
  (node.children ?? []).forEach((child) => ids.push(...collectIds(child)));
  return ids;
}

function removeNodeFromTree(root: ProcessNode, id: string): ProcessNode {
  if (root.children) {
    return {
      ...root,
      children: root.children.filter((c) => c.id !== id).map((c) => removeNodeFromTree(c, id)),
    };
  }
  return root;
}

function stripRelationsToIds(root: ProcessNode, idsToRemove: Set<string>): ProcessNode {
  return {
    ...root,
    successors: root.successors?.filter((s) => !idsToRemove.has(s)),
    predecessors: root.predecessors?.filter((p) => !idsToRemove.has(p)),
    children: root.children?.map((c) => stripRelationsToIds(c, idsToRemove)),
  };
}

function cloneSubtreeWithNewIds(node: ProcessNode): ProcessNode {
  const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  return {
    ...node,
    id: newId,
    successors: undefined,
    predecessors: undefined,
    assignedPersonIds: undefined,
    children: (node.children ?? []).map(cloneSubtreeWithNewIds),
  };
}

function insertNodeAfter(root: ProcessNode, targetId: string, newNode: ProcessNode): ProcessNode {
  if (root.children) {
    const idx = root.children.findIndex((c) => c.id === targetId);
    if (idx !== -1) {
      const newChildren = [...root.children];
      newChildren.splice(idx + 1, 0, newNode);
      return { ...root, children: newChildren };
    }
    return { ...root, children: root.children.map((c) => insertNodeAfter(c, targetId, newNode)) };
  }
  return root;
}

function stripPersonFromTree(root: ProcessNode, personId: string): ProcessNode {
  return {
    ...root,
    assignedPersonIds: root.assignedPersonIds?.filter((pid) => pid !== personId),
    children: root.children?.map((c) => stripPersonFromTree(c, personId)),
  };
}

function isNodeComplete(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return completed.has(node.id);
  return children.every((child) => isNodeComplete(child, completed));
}

function getLeafIds(node: ProcessNode): string[] {
  const children = node.children ?? [];
  if (children.length === 0) return [node.id];
  return children.flatMap(getLeafIds);
}

export type Edge = { from: string; to: string };

// ─── Clipboard payload shape/validation ───────────────────────────
const CLIPBOARD_MARKER = "modelflick-process-node-v1";
const CLIPBOARD_STORAGE_KEY = "modelflick:process-clipboard";

type ClipboardEnvelope = { marker: typeof CLIPBOARD_MARKER; node: ProcessNode };

function isProcessNodeShape(value: unknown): value is ProcessNode {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.label === "string";
}

function parseClipboardEnvelope(text: string): ProcessNode | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as Record<string, unknown>).marker === CLIPBOARD_MARKER &&
      isProcessNodeShape((parsed as Record<string, unknown>).node)
    ) {
      return (parsed as ClipboardEnvelope).node;
    }
  } catch {
    // not JSON, or not ours
  }
  return null;
}

// ─── Editing field addressing ─────────────────────────────────────
export type EditingField =
  | "label"
  | "description"
  | "value"
  | "factor1"
  | "factor2";

// ─── Schema validation ────────────────────────────────────────────
function validateNodeShape(node: unknown, path: string): string | null {
  if (!node || typeof node !== "object") return `${path} is not an object.`;
  const n = node as Record<string, unknown>;

  if (typeof n.id !== "string" || n.id.trim() === "") return `${path}.id is missing or not a string.`;
  if (typeof n.label !== "string" || n.label.trim() === "") return `${path}.label is missing or not a string.`;
  if (n.description !== undefined && typeof n.description !== "string") return `${path}.description must be a string.`;
  if (n.successors !== undefined && !isStringArray(n.successors)) return `${path}.successors must be an array of strings.`;
  if (n.predecessors !== undefined && !isStringArray(n.predecessors)) return `${path}.predecessors must be an array of strings.`;
  if (n.assignedPersonIds !== undefined && !isStringArray(n.assignedPersonIds)) return `${path}.assignedPersonIds must be an array of strings.`;
  if (n.area !== undefined && (typeof n.area !== "number" || !Number.isFinite(n.area) || n.area < 0)) {
    return `${path}.area must be a non-negative number.`;
  }
  if (n.value !== undefined && (typeof n.value !== "number" || !Number.isFinite(n.value) || n.value < 0)) {
    return `${path}.value must be a non-negative number.`;
  }
  if (n.valueType !== undefined) {
    if (typeof n.valueType !== "string") return `${path}.valueType must be a string.`;
    if (!VALUE_PRESETS[n.valueType]) return `${path}.valueType must be a known preset id.`;
  }
  if (n.factor1 !== undefined && (typeof n.factor1 !== "number" || !Number.isFinite(n.factor1) || n.factor1 < 0)) {
    return `${path}.factor1 must be a non-negative number.`;
  }
  if (n.factor2 !== undefined && (typeof n.factor2 !== "number" || !Number.isFinite(n.factor2) || n.factor2 < 0)) {
    return `${path}.factor2 must be a non-negative number.`;
  }

  if (n.children !== undefined) {
    if (!Array.isArray(n.children)) return `${path}.children must be an array.`;
    for (let i = 0; i < n.children.length; i++) {
      const err = validateNodeShape(n.children[i], `${path}.children[${i}]`);
      if (err) return err;
    }
  }
  return null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function validateProcessData(json: unknown): { valid: boolean; error: string | null } {
  if (!json || typeof json !== "object") return { valid: false, error: "File is not a JSON object." };
  const j = json as Record<string, unknown>;

  if (typeof j.title !== "string" || j.title.trim() === "") {
    return { valid: false, error: "Missing required field: title (string)." };
  }
  if (j.description !== undefined && typeof j.description !== "string") {
    return { valid: false, error: "description must be a string." };
  }
  if (j.width !== undefined && typeof j.width !== "number") {
    return { valid: false, error: "width must be a number." };
  }
  if (j.height !== undefined && typeof j.height !== "number") {
    return { valid: false, error: "height must be a number." };
  }
  if (j.children !== undefined) {
    if (!Array.isArray(j.children)) return { valid: false, error: "children must be an array." };
    for (let i = 0; i < j.children.length; i++) {
      const err = validateNodeShape(j.children[i], `children[${i}]`);
      if (err) return { valid: false, error: err };
    }
  }
  if (j.persons !== undefined) {
    if (!Array.isArray(j.persons)) return { valid: false, error: "persons must be an array." };
    for (const p of j.persons as unknown[]) {
      if (!p || typeof p !== "object" || typeof (p as Record<string, unknown>).id !== "string" || typeof (p as Record<string, unknown>).name !== "string") {
        return { valid: false, error: "Each entry in persons must have a string id and name." };
      }
    }
  }
  if (j.completed !== undefined && !isStringArray(j.completed)) {
    return { valid: false, error: "completed must be an array of strings." };
  }
  if (j.edgeStyles !== undefined && (typeof j.edgeStyles !== "object" || j.edgeStyles === null || Array.isArray(j.edgeStyles))) {
    return { valid: false, error: "edgeStyles must be an object keyed by 'fromId->toId'." };
  }

  if (j.valueDef !== undefined) {
    const d = j.valueDef as Record<string, unknown> | null;
    if (!d || typeof d !== "object") {
      return { valid: false, error: "valueDef must be an object." };
    }
    if (typeof d.label !== "string" || d.label.trim() === "") {
      return { valid: false, error: "valueDef.label must be a non-empty string." };
    }
    if (typeof d.unit !== "string") {
      return { valid: false, error: "valueDef.unit must be a string." };
    }
  }
  if (j.displayUnit !== undefined && typeof j.displayUnit !== "string") {
    return { valid: false, error: "displayUnit must be a string." };
  }
  if (j.displayUnits !== undefined) {
    if (typeof j.displayUnits !== "object" || j.displayUnits === null || Array.isArray(j.displayUnits)) {
      return { valid: false, error: "displayUnits must be an object keyed by value type id." };
    }
    for (const [k, v] of Object.entries(j.displayUnits as Record<string, unknown>)) {
      if (typeof v !== "string") return { valid: false, error: `displayUnits.${k} must be a string.` };
    }
  }

  return { valid: true, error: null };
}

// ─── Undo/redo history ────────────────────────────────────────────

type Snapshot = {
  data: ProcessData | null;
  completed: Set<string>;
  persons: Person[];
  edgeStyles: Map<string, { dashed: boolean }>;
};

const MAX_HISTORY = 50;

export function useProcessEditor(initialData: ProcessData) {
  const [data, setData] = useState<ProcessData | null>(initialData);

  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const warningTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [edgeStyles, setEdgeStyles] = useState<Map<string, { dashed: boolean }>>(new Map());
  const [persons, setPersons] = useState<Person[]>(initialData.persons ?? []);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [pendingRelation, setPendingRelation] = useState<{
    fromId: string;
    mode: "successor" | "predecessor";
  } | null>(null);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField>("label");
  const [editingValue, setEditingValue] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProcess, setNewProcess] = useState({ label: "", description: "", position: 0 });
  const [addError, setAddError] = useState("");

  const [showPersonManager, setShowPersonManager] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [assignPopupNodeId, setAssignPopupNodeId] = useState<string | null>(null);

  const [showMetricManager, setShowMetricManager] = useState(false);

  const [showValues, setShowValues] = useState(false);
  const [valueScope, setValueScopeState] = useState<ValueScope>(null);

  const [invalidUpload, setInvalidUpload] = useState<{ filename: string } | null>(null);

  const [loadVersion, setLoadVersion] = useState(0);

  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);

  const dataRef = useRef(data);
  const completedRef = useRef(completed);
  const personsRef = useRef(persons);
  const edgeStylesRef = useRef(edgeStyles);
  const selectedNodeIdRef = useRef(selectedNodeId);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { personsRef.current = persons; }, [persons]);
  useEffect(() => { edgeStylesRef.current = edgeStyles; }, [edgeStyles]);
  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);

  const captureSnapshot = (): Snapshot => ({
    data: dataRef.current ? (JSON.parse(JSON.stringify(dataRef.current)) as ProcessData) : null,
    completed: new Set(completedRef.current),
    persons: personsRef.current.map((p) => ({ ...p })),
    edgeStyles: new Map(Array.from(edgeStylesRef.current.entries()).map(([k, v]) => [k, { ...v }])),
  });

  const applySnapshot = (snap: Snapshot) => {
    setData(snap.data);
    setCompleted(new Set(snap.completed));
    setPersons(snap.persons.map((p) => ({ ...p })));
    setEdgeStyles(new Map(Array.from(snap.edgeStyles.entries()).map(([k, v]) => [k, { ...v }])));
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setPendingRelation(null);
    setEditingNodeId(null);
    setAssignPopupNodeId(null);
  };

  const pushHistory = () => {
    const snap = captureSnapshot();
    const newPast = [...pastRef.current, snap].slice(-MAX_HISTORY);
    pastRef.current = newPast;
    futureRef.current = [];
    setPast(newPast);
    setFuture([]);
  };

  const undo = () => {
    const p = pastRef.current;
    if (p.length === 0) return;
    const previous = p[p.length - 1];
    const newPast = p.slice(0, -1);
    const currentSnap = captureSnapshot();
    const newFuture = [currentSnap, ...futureRef.current];
    pastRef.current = newPast;
    futureRef.current = newFuture;
    setPast(newPast);
    setFuture(newFuture);
    applySnapshot(previous);
  };

  const redo = () => {
    const f = futureRef.current;
    if (f.length === 0) return;
    const next = f[0];
    const newFuture = f.slice(1);
    const currentSnap = captureSnapshot();
    const newPast = [...pastRef.current, currentSnap];
    pastRef.current = newPast;
    futureRef.current = newFuture;
    setPast(newPast);
    setFuture(newFuture);
    applySnapshot(next);
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      const isUndoKey = key === "z" && !e.shiftKey;
      const isRedoKey = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndoKey && !isRedoKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditableField = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isEditableField) return;

      e.preventDefault();
      if (isRedoKey) {
        redoRef.current();
      } else {
        undoRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showWarning = (message: string) => {
    setWarning(message);
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    warningTimeout.current = setTimeout(() => setWarning(""), 3200);
  };

  const rootNode: ProcessNode | null = data
    ? {
      id: "root",
      label: data.title,
      description: data.description,
      type: "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    }
    : null;

  const totalLeaves = rootNode ? getLeafIds(rootNode).length : 0;
  const completedLeaves = completed.size;

  const defaultValueDef: ValueDef = resolveValueDef(data?.valueDef);
  const displayUnits: Record<string, string> = data?.displayUnits ?? {};
  const documentHasValue: boolean = rootNode ? hasAnyValue(rootNode) : false;

  const setDefaultValueType = (presetId: string) => {
    if (!data) return;
    const preset = VALUE_PRESETS[presetId];
    if (!preset) return;
    pushHistory();
    setData({ ...data, valueDef: preset });
  };

  const setDisplayUnitForType = (presetId: string, symbol: string) => {
    if (!data) return;
    pushHistory();
    setData({
      ...data,
      displayUnits: { ...(data.displayUnits ?? {}), [presetId]: symbol },
    });
  };

  const applyValueTypeToAll = (presetId: string) => {
    if (!data) return;
    const preset = VALUE_PRESETS[presetId];
    if (!preset) return;

    pushHistory();

    const rewrite = (node: ProcessNode): ProcessNode => {
      const children = node.children ?? [];
      if (children.length === 0) {
        return { ...node, valueType: presetId };
      }
      return { ...node, children: children.map(rewrite) };
    };

    setData({
      ...data,
      valueDef: preset,
      children: data.children?.map(rewrite),
    });
  };

  const setNodeValueType = (nodeId: string, presetId: string) => {
    if (!data || !rootNode) return;
    if (!VALUE_PRESETS[presetId]) return;

    const node = findNodeById(rootNode, nodeId);
    if (!node) return;
    if ((node.children ?? []).length > 0) return;

    const updated: ProcessNode = { ...node, valueType: presetId };

    const replace = (root: ProcessNode): ProcessNode => {
      if (root.id === nodeId) return updated;
      if (root.children) return { ...root, children: root.children.map(replace) };
      return root;
    };

    pushHistory();
    setData({ ...data, children: data.children ? data.children.map(replace) : undefined });
  };

  const valueScopeRoot: ProcessNode | null = (() => {
    if (!showValues || !valueScope || !rootNode) return null;
    if (valueScope === "root") return rootNode;
    return findNodeById(rootNode, valueScope);
  })();

  const toggleValues = () => {
    if (showValues) {
      setShowValues(false);
      setValueScopeState(null);
    } else {
      setShowValues(true);
      const sel = selectedNodeId;
      setValueScopeState(sel && sel !== "root" ? sel : "root");
    }
  };

  const setValueScope = (scope: ValueScope) => {
    setValueScopeState(scope);
    setShowValues(scope !== null);
  };

  const scopeHasValue = rootNode ? scopeHasAnyValue(rootNode, valueScope) : false;

  const replaceNodeInTree = (nodeId: string, updated: ProcessNode) => {
    if (!data) return;
    const replace = (root: ProcessNode): ProcessNode => {
      if (root.id === nodeId) return updated;
      if (root.children) return { ...root, children: root.children.map(replace) };
      return root;
    };
    pushHistory();
    setData({ ...data, children: data.children ? data.children.map(replace) : undefined });
  };

  const setNodeFactor = (
    nodeId: string,
    which: 1 | 2,
    rawValue: string,
  ) => {
    if (!data || !rootNode) return;

    const node = findNodeById(rootNode, nodeId);
    if (!node) return;
    if ((node.children ?? []).length > 0) return;

    const def = resolveNodeValueDef(node, data.valueDef);
    if (!hasFactors(def)) return;

    const chosen = unitForType(def, data.displayUnits);

    const trimmed = rawValue.trim();
    const parsed = trimmed === "" ? undefined : Number(trimmed);
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0)) return;

    const baseVal = parsed === undefined ? undefined : factorFromDisplay(parsed, def, chosen);

    const nextF1 = which === 1 ? baseVal : node.factor1;
    const nextF2 = which === 2 ? baseVal : node.factor2;

    const updated: ProcessNode = { ...node };
    if (nextF1 === undefined) delete updated.factor1;
    else updated.factor1 = nextF1;
    if (nextF2 === undefined) delete updated.factor2;
    else updated.factor2 = nextF2;

    if (typeof nextF1 === "number" && typeof nextF2 === "number") {
      updated.value = nextF1 * nextF2;
      delete updated.area;
    }

    replaceNodeInTree(nodeId, updated);
  };

  const setNodeValue = (nodeId: string, rawValue: string) => {
    if (!data || !rootNode) return;

    const node = findNodeById(rootNode, nodeId);
    if (!node) return;
    if ((node.children ?? []).length > 0) return;

    const def = resolveNodeValueDef(node, data.valueDef);
    const chosen = unitForType(def, data.displayUnits);

    const trimmed = rawValue.trim();

    if (trimmed === "") {
      const cleared: ProcessNode = { ...node };
      delete cleared.value;
      delete cleared.area;
      delete cleared.factor1;
      delete cleared.factor2;
      replaceNodeInTree(nodeId, cleared);
      return;
    }

    const parsedDisplay = Number(trimmed);
    if (!Number.isFinite(parsedDisplay) || parsedDisplay < 0) return;

    const baseValue = parsedDisplay * resolveUnit(def, chosen).toBase;
    const oldValue = node.value ?? node.area ?? null;

    const f1 = typeof node.factor1 === "number" ? node.factor1 : undefined;
    const f2 = typeof node.factor2 === "number" ? node.factor2 : undefined;

    const updated: ProcessNode = { ...node, value: baseValue };
    delete updated.area;

    if (typeof f1 === "number" && typeof f2 === "number" && oldValue && oldValue > 0) {
      const k = Math.sqrt(baseValue / oldValue);
      updated.factor1 = f1 * k;
      updated.factor2 = f2 * k;
    }

    replaceNodeInTree(nodeId, updated);
  };

  /**
   * Set a subtree's net value to `target` (in the document's base
   * unit — m² for Area). Every leaf under `nodeId` is scaled
   * proportionally so their L:B aspect ratios are preserved.
   *
   * Callers with a display value (e.g. ft²) must convert to base
   * first via `value * resolveUnit(def, chosen).toBase`.
   */
  const setSubtreeValue = (nodeId: string, target: number): RescaleResult => {
    if (!data || !rootNode) {
      return {
        node: {} as ProcessNode,
        applied: false,
        reason: "No document loaded.",
        oldTotal: null,
        newTotal: null,
        leavesChanged: 0,
      };
    }

    const node = findNodeById(rootNode, nodeId);
    if (!node) {
      return {
        node: {} as ProcessNode,
        applied: false,
        reason: "Node not found.",
        oldTotal: null,
        newTotal: null,
        leavesChanged: 0,
      };
    }

    const result = rescaleSubtree(node, target);
    if (!result.applied) return result;

    const replace = (root: ProcessNode): ProcessNode => {
      if (root.id === nodeId) return result.node;
      if (root.children) return { ...root, children: root.children.map(replace) };
      return root;
    };

    pushHistory();
    setData({
      ...data,
      children: data.children ? data.children.map(replace) : undefined,
    });

    return result;
  };

  /**
   * Replace the subtree at `nodeId` with the object parsed from `json`.
   *
   * Used by the "Edit JSON" modal: the user selects a node, the modal
   * shows its JSON, they edit it, and hit Apply. If the JSON is
   * malformed or fails schema validation, nothing changes and an error
   * message is returned so the modal can show it.
   *
   * Rules:
   *   - The JSON must be an object (a ProcessNode).
   *   - Its `id` must match `nodeId` unless the caller explicitly wants
   *     to allow re-keying — we require a match here so references in
   *     `successors`/`predecessors`/`completed` don't silently break.
   *   - The subtree is validated by the same `validateNodeShape` used on
   *     upload, so nothing that couldn't be uploaded can be pasted.
   *   - On success, the tree is replaced and history is pushed so undo
   *     works.
   */
  const setSubtreeFromJson = (
    nodeId: string,
    json: string,
  ): { ok: true } | { ok: false; error: string } => {
    if (!data || !rootNode) {
      return { ok: false, error: "No document loaded." };
    }

    // The root (the synthetic canvas node) can't be replaced — only real
    // nodes in data.children.
    if (nodeId === "root") {
      return { ok: false, error: "The root process can't be replaced." };
    }

    const target = findNodeById(rootNode, nodeId);
    if (!target) {
      return { ok: false, error: "Selected process no longer exists." };
    }

    // 1. Parse.
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? `Invalid JSON: ${err.message}` : "Invalid JSON.",
      };
    }

    // 2. Shape check — must be an object with the same id.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "JSON must be a single process object." };
    }
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
      return { ok: false, error: "JSON must include a string `id`." };
    }
    if (candidate.id !== nodeId) {
      return {
        ok: false,
        error: `The id in the JSON ("${candidate.id}") must match the selected process ("${nodeId}").`,
      };
    }

    // 3. Full schema validation using the same rules as upload.
    const err = validateNodeShape(candidate, "node");
    if (err) {
      return { ok: false, error: err };
    }

    const replacement = candidate as unknown as ProcessNode;

    // 4. Replace in tree.
    const replace = (root: ProcessNode): ProcessNode => {
      if (root.id === nodeId) return replacement;
      if (root.children) return { ...root, children: root.children.map(replace) };
      return root;
    };

    pushHistory();
    setData({
      ...data,
      children: data.children ? data.children.map(replace) : undefined,
    });

    return { ok: true };
  };

  const openEditor = (id: string, field: EditingField, currentValue: string) => {
    setEditingNodeId(id);
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const closeEditor = () => setEditingNodeId(null);

  const updateNode = (id: string, field: EditingField, rawValue: string) => {
    if (!data) return;

    if (id === "root" && (field === "value" || field === "factor1" || field === "factor2")) return;

    if (id === "root") {
      pushHistory();
      setData({ ...data, [field === "label" ? "title" : "description"]: rawValue });
      return;
    }

    if (field === "value") {
      setNodeValue(id, rawValue);
      return;
    }
    if (field === "factor1") {
      setNodeFactor(id, 1, rawValue);
      return;
    }
    if (field === "factor2") {
      setNodeFactor(id, 2, rawValue);
      return;
    }

    const updateTree = (node: ProcessNode): ProcessNode => {
      if (node.id !== id) {
        if (node.children) return { ...node, children: node.children.map(updateTree) };
        return node;
      }
      return { ...node, [field]: rawValue };
    };

    pushHistory();
    setData({ ...data, children: data.children ? data.children.map(updateTree) : undefined });
  };

  const submitEditor = () => {
    if (editingNodeId) {
      const trimmed = editingValue.trim();
      if (editingField === "label" && trimmed === "") return;

      if (editingField === "factor1") {
        setNodeFactor(editingNodeId, 1, trimmed);
      } else if (editingField === "factor2") {
        setNodeFactor(editingNodeId, 2, trimmed);
      } else {
        updateNode(editingNodeId, editingField, trimmed);
      }
    }
    closeEditor();
  };

  const addValueToNode = (nodeId: string) => {
    if (!data || !rootNode) return;
    const node = findNodeById(rootNode, nodeId);
    if (!node) return;
    if ((node.children ?? []).length > 0) return;

    setShowValues(true);
    setValueScopeState(nodeId);
    openEditor(nodeId, "value", "");
  };

  const getParentInfo = () => {
    if (!data) return { parentLabel: "Root", childCount: 0 };
    if (selectedNodeId) {
      const parent = findNodeById(
        { id: "root", label: data.title, description: data.description, type: "process", children: data.children || [] },
        selectedNodeId
      );
      if (parent) return { parentLabel: parent.label, childCount: (parent.children || []).length };
    }
    return { parentLabel: "Root", childCount: (data.children || []).length };
  };

  const handleAddProcess = () => {
    if (!data) {
      setAddError("No process data loaded.");
      return;
    }
    const trimmedLabel = newProcess.label.trim();
    if (!trimmedLabel) {
      setAddError("Title is required.");
      return;
    }

    const parentId = selectedNodeId || null;

    let currentChildren: ProcessNode[] = [];
    if (parentId === null) {
      currentChildren = data.children || [];
    } else {
      const rootRef = { id: "root", label: data.title, description: data.description, type: data.type || "process", children: data.children || [] };
      const parent = findNodeById(rootRef, parentId);
      if (parent) {
        currentChildren = parent.children || [];
      } else {
        setAddError("Selected parent not found.");
        return;
      }
    }

    const pos = Math.min(Math.max(newProcess.position, 0), currentChildren.length);
    const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newNode: ProcessNode = {
      id: newId,
      label: trimmedLabel,
      description: newProcess.description.trim() || undefined,
      children: [],
    };

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children || [],
    };

    const newRoot = addNodeToTree(rootRef, parentId, newNode, pos);

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });

    setShowAddModal(false);
    setNewProcess({ label: "", description: "", position: 0 });
    setAddError("");
  };

  const deleteNode = (id: string) => {
    if (!data || id === "root") return;

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };

    const target = findNodeById(rootRef, id);
    if (!target) return;

    const idsToRemove = new Set(collectIds(target));

    let newRoot = removeNodeFromTree(rootRef, id);
    newRoot = stripRelationsToIds(newRoot, idsToRemove);

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });

    setCompleted((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((rid) => next.delete(rid));
      return next;
    });

    setEdgeStyles((prev) => {
      const next = new Map(prev);
      Array.from(next.keys()).forEach((key) => {
        const [from, to] = key.split("->");
        if (idsToRemove.has(from) || idsToRemove.has(to)) next.delete(key);
      });
      return next;
    });

    setSelectedNodeId(null);
    setSelectedEdge(null);
    setPendingRelation(null);
    if (assignPopupNodeId && idsToRemove.has(assignPopupNodeId)) setAssignPopupNodeId(null);

    if (showValues && valueScope && valueScope !== "root" && idsToRemove.has(valueScope)) {
      setValueScopeState("root");
    }
  };

  const duplicateNode = (id: string) => {
    if (!data || id === "root") return;

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };

    const target = findNodeById(rootRef, id);
    if (!target) return;

    const clone = cloneSubtreeWithNewIds(target);
    clone.label = `${clone.label} (Copy)`;

    const newRoot = insertNodeAfter(rootRef, id, clone);

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });

    setSelectedNodeId(clone.id);
  };

  const writeClipboardFallback = (envelope: ClipboardEnvelope) => {
    try {
      window.localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // localStorage unavailable
    }
  };

  const readClipboardFallback = (): ProcessNode | null => {
    try {
      const raw = window.localStorage.getItem(CLIPBOARD_STORAGE_KEY);
      if (!raw) return null;
      return parseClipboardEnvelope(raw);
    } catch {
      return null;
    }
  };

  const copyNode = async (id: string) => {
    if (!data || id === "root") return;

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };

    const target = findNodeById(rootRef, id);
    if (!target) return;

    const snapshot = JSON.parse(JSON.stringify(target)) as ProcessNode;
    const envelope: ClipboardEnvelope = { marker: CLIPBOARD_MARKER, node: snapshot };
    const payload = JSON.stringify(envelope);

    writeClipboardFallback(envelope);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // Permission denied or unsupported.
    }

    showWarning(`"${target.label}" copied.`);
  };

  const pasteNode = async (parentId: string | null) => {
    if (!data) return;

    let clipboardNode: ProcessNode | null = null;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        const text = await navigator.clipboard.readText();
        clipboardNode = parseClipboardEnvelope(text);
      }
    } catch {
      // fall through
    }

    if (!clipboardNode) {
      clipboardNode = readClipboardFallback();
    }

    if (!clipboardNode) {
      showWarning("Clipboard is empty or doesn't contain a copied process — copy a process first.");
      return;
    }

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };

    const targetParent = parentId ? findNodeById(rootRef, parentId) : rootRef;
    if (!targetParent) {
      showWarning("Target process not found.");
      return;
    }

    const pasted = cloneSubtreeWithNewIds(clipboardNode);
    const position = (targetParent.children ?? []).length;

    const newRoot = addNodeToTree(rootRef, parentId, pasted, position);

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });

    setSelectedNodeId(pasted.id);
  };

  const copyNodeRef = useRef(copyNode);
  const pasteNodeRef = useRef(pasteNode);
  copyNodeRef.current = copyNode;
  pasteNodeRef.current = pasteNode;

  useEffect(() => {
    const handleCopyPasteKeys = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "v") return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditableField = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isEditableField) return;

      const sel = selectedNodeIdRef.current;

      if (key === "c") {
        if (!sel || sel === "root") return;
        e.preventDefault();
        void copyNodeRef.current(sel);
      } else {
        e.preventDefault();
        void pasteNodeRef.current(sel);
      }
    };
    window.addEventListener("keydown", handleCopyPasteKeys);
    return () => window.removeEventListener("keydown", handleCopyPasteKeys);
  }, []);

  const moveNodeInTree = (
    root: ProcessNode,
    targetId: string,
    direction: "up" | "down"
  ): ProcessNode | null => {
    if (!root.children) return null;

    const idx = root.children.findIndex((c) => c.id === targetId);
    if (idx !== -1) {
      const siblings = [...root.children];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= siblings.length) return null;
      [siblings[idx], siblings[targetIdx]] = [siblings[targetIdx], siblings[idx]];
      return { ...root, children: siblings };
    }

    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const newChild = moveNodeInTree(child, targetId, direction);
      if (newChild) {
        const newChildren = [...root.children];
        newChildren[i] = newChild;
        return { ...root, children: newChildren };
      }
    }
    return null;
  };

  const moveNodeUp = (nodeId: string) => {
    if (!data || nodeId === "root") return;
    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };
    const newRoot = moveNodeInTree(rootRef, nodeId, "up");
    if (!newRoot) return;

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });
  };

  const moveNodeDown = (nodeId: string) => {
    if (!data || nodeId === "root") return;
    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };
    const newRoot = moveNodeInTree(rootRef, nodeId, "down");
    if (!newRoot) return;

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });
  };

  const moveNodeToParent = (nodeId: string, newParentId: string) => {
    if (!data || nodeId === "root" || newParentId === nodeId) return;

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };

    const nodeToMove = findNodeById(rootRef, nodeId);
    if (!nodeToMove) return;
    const descendantIds = new Set(collectIds(nodeToMove));
    if (descendantIds.has(newParentId)) {
      showWarning("Cannot move a process into its own subprocess.");
      return;
    }

    let newRoot = removeNodeFromTree(rootRef, nodeId);

    const newParent = findNodeById(newRoot, newParentId);
    if (!newParent) {
      showWarning("New parent not found.");
      return;
    }
    const position = (newParent.children || []).length;
    newRoot = addNodeToTree(newRoot, newParentId, nodeToMove, position);

    pushHistory();
    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });
  };

  const addPerson = () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    const newPerson: Person = {
      id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: trimmed,
    };
    pushHistory();
    setPersons((prev) => [...prev, newPerson]);
    setNewPersonName("");
  };

  const renamePerson = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    pushHistory();
    setPersons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
    );
  };

  const deletePerson = (id: string) => {
    pushHistory();
    setPersons((prev) => prev.filter((p) => p.id !== id));

    if (!data) return;
    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      description: data.description,
      type: data.type || "process",
      width: data.width,
      height: data.height,
      children: data.children ?? [],
    };
    const newRoot = stripPersonFromTree(rootRef, id);

    setData({
      ...data,
      title: newRoot.label,
      description: newRoot.description,
      type: newRoot.type,
      width: newRoot.width,
      height: newRoot.height,
      children: newRoot.children,
    });
  };

  const toggleNodeAssignment = (nodeId: string, personId: string) => {
    if (!data) return;
    pushHistory();
    setData((prev) => {
      if (!prev) return prev;
      const root: ProcessNode = {
        id: "root",
        label: prev.title,
        description: prev.description,
        type: "process",
        width: prev.width,
        height: prev.height,
        children: prev.children ?? [],
      };

      const newRoot = updateNodeData(root, nodeId, (node) => {
        const current = node.assignedPersonIds ?? [];
        const has = current.includes(personId);
        return {
          ...node,
          assignedPersonIds: has ? current.filter((pid) => pid !== personId) : [...current, personId],
        };
      });

      return {
        ...prev,
        title: newRoot.label,
        description: newRoot.description,
        type: newRoot.type,
        width: newRoot.width,
        height: newRoot.height,
        children: newRoot.children,
      };
    });
  };

  const toggleImportant = (nodeId: string) => {
    if (!data) return;
    pushHistory();
    setData((prev) => {
      if (!prev) return prev;
      const root: ProcessNode = {
        id: "root",
        label: prev.title,
        description: prev.description,
        type: "process",
        width: prev.width,
        height: prev.height,
        children: prev.children ?? [],
      };

      const newRoot = updateNodeData(root, nodeId, (node) => ({
        ...node,
        important: !node.important,
      }));

      return {
        ...prev,
        title: newRoot.label,
        description: newRoot.description,
        type: newRoot.type,
        width: newRoot.width,
        height: newRoot.height,
        children: newRoot.children,
      };
    });
  };

  const openAssignPopup = (nodeId: string) => setAssignPopupNodeId(nodeId);
  const closeAssignPopup = () => setAssignPopupNodeId(null);

  const addRelationRaw = (fromId: string, toId: string, mode: "successor" | "predecessor") => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      const root: ProcessNode = {
        id: "root",
        label: prev.title,
        description: prev.description,
        type: "process",
        width: prev.width,
        height: prev.height,
        children: prev.children ?? [],
      };

      let newRoot = root;
      if (mode === "successor") {
        newRoot = updateNodeData(newRoot, fromId, (node) => ({
          ...node,
          successors: node.successors ? Array.from(new Set([...node.successors, toId])) : [toId],
        }));
        newRoot = updateNodeData(newRoot, toId, (node) => ({
          ...node,
          predecessors: node.predecessors ? Array.from(new Set([...node.predecessors, fromId])) : [fromId],
        }));
      } else {
        newRoot = updateNodeData(newRoot, fromId, (node) => ({
          ...node,
          predecessors: node.predecessors ? Array.from(new Set([...node.predecessors, toId])) : [toId],
        }));
        newRoot = updateNodeData(newRoot, toId, (node) => ({
          ...node,
          successors: node.successors ? Array.from(new Set([...node.successors, fromId])) : [fromId],
        }));
      }

      return {
        ...prev,
        title: newRoot.label,
        description: newRoot.description,
        type: newRoot.type,
        width: newRoot.width,
        height: newRoot.height,
        children: newRoot.children,
      };
    });
  };

  const deleteRelationRaw = (edge: Edge) => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      const root: ProcessNode = {
        id: "root",
        label: prev.title,
        description: prev.description,
        type: "process",
        width: prev.width,
        height: prev.height,
        children: prev.children ?? [],
      };

      let newRoot = updateNodeData(root, edge.from, (node) => ({
        ...node,
        successors: node.successors?.filter((s) => s !== edge.to) ?? [],
      }));
      newRoot = updateNodeData(newRoot, edge.to, (node) => ({
        ...node,
        predecessors: node.predecessors?.filter((p) => p !== edge.from) ?? [],
      }));

      return {
        ...prev,
        title: newRoot.label,
        description: newRoot.description,
        type: newRoot.type,
        width: newRoot.width,
        height: newRoot.height,
        children: newRoot.children,
      };
    });
    setSelectedEdge(null);
    const key = `${edge.from}->${edge.to}`;
    setEdgeStyles((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const addRelation = (fromId: string, toId: string, mode: "successor" | "predecessor") => {
    if (fromId === toId) {
      showWarning("A process can't be its own predecessor or successor.");
      return;
    }
    if (!data) return;

    const forwardFrom = mode === "successor" ? fromId : toId;
    const forwardTo = mode === "successor" ? toId : fromId;

    const rootRef: ProcessNode = {
      id: "root",
      label: data.title,
      children: data.children ?? [],
    };
    const completesMutualPair = reverseEdgeExists(rootRef, forwardFrom, forwardTo);

    pushHistory();
    addRelationRaw(fromId, toId, mode);

    if (completesMutualPair) {
      const forwardKey = `${forwardFrom}->${forwardTo}`;
      const reverseKey = `${forwardTo}->${forwardFrom}`;
      setEdgeStyles((prev) => {
        const next = new Map(prev);
        next.set(forwardKey, { dashed: true });
        next.set(reverseKey, { dashed: true });
        return next;
      });
      showWarning("These two processes now reference each other both ways — shown as a dashed loop.");
    }
  };

  const deleteRelation = (edge: Edge) => {
    pushHistory();
    deleteRelationRaw(edge);
  };

  const reverseRelation = () => {
    if (!selectedEdge) return;
    const { from, to } = selectedEdge;
    pushHistory();
    deleteRelationRaw(selectedEdge);
    addRelationRaw(to, from, "successor");
    setSelectedEdge(null);
  };

  const toggleEdgeDashed = () => {
    if (!selectedEdge) return;
    pushHistory();
    const key = `${selectedEdge.from}->${selectedEdge.to}`;
    setEdgeStyles((prev) => {
      const next = new Map(prev);
      const current = next.get(key) || { dashed: false };
      next.set(key, { ...current, dashed: !current.dashed });
      return next;
    });
  };

  const toggleComplete = (node: ProcessNode) => {
    const children = node.children ?? [];
    const isParent = children.length > 0;

    if (isParent) {
      const currentlyComplete = isNodeComplete(node, completed);
      if (currentlyComplete) {
        showWarning(`"${node.label}" is complete because every subprocess under it is checked — uncheck those individually to reopen it.`);
      } else {
        showWarning(`"${node.label}" can't be checked off yet — complete every subprocess underneath it first.`);
      }
      return;
    }

    pushHistory();
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  const loadData = (json: ProcessData) => {
    const migrated = migrateProcessData(json);
    setInvalidUpload(null);
    setData(migrated);
    setCompleted(new Set(migrated.completed ?? []));
    setPersons(migrated.persons ?? []);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setSelectedEdge(null);
    setPendingRelation(null);
    setAssignPopupNodeId(null);
    setEdgeStyles(
      new Map(
        Object.entries(migrated.edgeStyles ?? {}).map(([key, value]) => [key, { dashed: value?.dashed ?? false }])
      )
    );
    setShowValues(false);
    setValueScopeState(null);
    setLoadVersion((v) => v + 1);

    pastRef.current = [];
    futureRef.current = [];
    setPast([]);
    setFuture([]);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setWarning("");
    setInvalidUpload(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string") throw new Error("Unable to read file.");
        const json = JSON.parse(text) as unknown;

        const { valid, error: validationError } = validateProcessData(json);
        if (!valid) {
          setData(null);
          setInvalidUpload({ filename: file.name });
          setError(`"${file.name}" is invalid: ${validationError}`);
          return;
        }

        loadData(json as ProcessData);
      } catch (err) {
        console.error(err);
        setData(null);
        setInvalidUpload({ filename: file.name });
        setError(`"${file.name}" is not a valid process file. Download the sample template below to see the correct format.`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const downloadInvalidUpload = () => {
    if (!invalidUpload) return;

    try {
      const jsonString = JSON.stringify(sampleProcess, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "process.json";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error("Download sample JSON failed:", err);
      setError("Failed to download the sample JSON. Check console for details.");
    }
  };

  const getExportData = () => {
    if (!data) return null;
    return {
      ...data,
      completed: Array.from(completed),
      edgeStyles: Object.fromEntries(edgeStyles.entries()),
      persons,
    };
  };

  const handleSave = () => {
    const exportData = getExportData();
    if (!exportData) {
      setError("No process data to save.");
      return;
    }

    try {
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "process.json";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error("Save JSON failed:", err);
      setError("Failed to save JSON. Check console for details.");
    }
  };

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setPendingRelation(null);

    if (showValues) {
      setValueScopeState("root");
    }
  };

  const handleNodeClick = (id: string, didDrag: boolean) => {
    if (didDrag) return;
    if (pendingRelation) {
      addRelation(pendingRelation.fromId, id, pendingRelation.mode);
      setPendingRelation(null);
      setSelectedNodeId(null);
      return;
    }
    setSelectedEdge(null);
    setSelectedNodeId(id);

    if (showValues) {
      setValueScopeState(id === "root" ? "root" : id);
    }
  };

  const handleSelectEdge = (edge: Edge | null) => {
    setSelectedNodeId(null);
    setSelectedEdge(edge);
  };

  return {
    data, setData, loadData, rootNode,
    loadVersion,
    error, setError, warning,
    completed, edgeStyles,
    selectedNodeId, setSelectedNodeId,
    hoveredNodeId, setHoveredNodeId,
    selectedEdge, setSelectedEdge,
    pendingRelation, setPendingRelation,
    editingNodeId, editingField, editingValue, setEditingValue,
    openEditor, closeEditor, submitEditor,
    showAddModal, setShowAddModal, newProcess, setNewProcess, addError, setAddError,
    handleAddProcess, getParentInfo,
    deleteNode, duplicateNode,
    addRelation, deleteRelation, reverseRelation, toggleEdgeDashed,
    toggleComplete, handleUpload, handleSave, updateNode, getExportData,
    totalLeaves, completedLeaves,
    clearSelection, handleNodeClick, handleSelectEdge,
    // people
    persons, showPersonManager, setShowPersonManager,
    newPersonName, setNewPersonName, addPerson, deletePerson, renamePerson,
    assignPopupNodeId, openAssignPopup, closeAssignPopup, toggleNodeAssignment, toggleImportant,
    // value system
    defaultValueDef, displayUnits, documentHasValue,
    setDefaultValueType, setDisplayUnitForType,
    applyValueTypeToAll, setNodeValueType,
    setNodeFactor, setNodeValue, setSubtreeValue, setSubtreeFromJson,
    showMetricManager, setShowMetricManager,
    showValues, valueScope, valueScopeRoot,
    toggleValues, setValueScope, scopeHasValue,
    addValueToNode,
    // schema validation fallback
    invalidUpload, downloadInvalidUpload,
    // undo / redo
    undo, redo, canUndo, canRedo,
    // move operations
    moveNodeUp, moveNodeDown, moveNodeToParent,
    // copy / paste
    copyNode, pasteNode,
  };
}