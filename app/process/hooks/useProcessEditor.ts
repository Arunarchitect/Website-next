"use client";

import { useEffect, useRef, useState } from "react";
import {
  Person,
  ProcessData,
  ProcessNode,
  reverseEdgeExists,
} from "@/app/process/lib/process-utils";
import sampleProcess from "@/app/process/json/process.json";

// ─── Pure tree helpers ───────────────────────────────────────────

export function findNodeById(root: ProcessNode, id: string): ProcessNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
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
    // assignedPersonIds intentionally NOT copied — see README note on duplicate
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
  const [editingField, setEditingField] = useState<"label" | "description">("label");
  const [editingValue, setEditingValue] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProcess, setNewProcess] = useState({ label: "", description: "", position: 0 });
  const [addError, setAddError] = useState("");

  // ─── People ────────────────────────────────────────────────
  const [showPersonManager, setShowPersonManager] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [assignPopupNodeId, setAssignPopupNodeId] = useState<string | null>(null);

  // ─── Invalid-upload fallback ─────────────────────────────────
  const [invalidUpload, setInvalidUpload] = useState<{ filename: string } | null>(null);

  // ─── Load tracking ───────────────────────────────────────────
  const [loadVersion, setLoadVersion] = useState(0);

  // ─── Undo / redo history ──────────────────────────────────────
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);

  const dataRef = useRef(data);
  const completedRef = useRef(completed);
  const personsRef = useRef(persons);
  const edgeStylesRef = useRef(edgeStyles);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { personsRef.current = persons; }, [persons]);
  useEffect(() => { edgeStylesRef.current = edgeStyles; }, [edgeStyles]);

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

  // ─── Inline editor (title / description) ──────────────────────
  const openEditor = (id: string, field: "label" | "description", currentValue: string) => {
    setEditingNodeId(id);
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const closeEditor = () => setEditingNodeId(null);

  const updateNode = (id: string, field: "label" | "description", value: string) => {
    if (!data) return;
    pushHistory();

    if (id === "root") {
      setData({ ...data, [field === "label" ? "title" : "description"]: value });
      return;
    }

    const updateTree = (node: ProcessNode): ProcessNode => {
      if (node.id === id) return { ...node, [field]: value };
      if (node.children) return { ...node, children: node.children.map(updateTree) };
      return node;
    };

    setData({ ...data, children: data.children ? data.children.map(updateTree) : undefined });
  };

  const submitEditor = () => {
    if (editingNodeId) {
      const trimmed = editingValue.trim();
      if (editingField === "label" && trimmed === "") return;
      updateNode(editingNodeId, editingField, trimmed);
    }
    closeEditor();
  };

  // ─── Add process ────────────────────────────────────────────
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

  // ─── Delete / duplicate ────────────────────────────────────
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

  // ─── Move node up/down among siblings ──────────────────────────
  // Helper: recursively swap a node with its previous/next sibling.
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
      if (targetIdx < 0 || targetIdx >= siblings.length) return null; // already at boundary
      [siblings[idx], siblings[targetIdx]] = [siblings[targetIdx], siblings[idx]];
      return { ...root, children: siblings };
    }

    // not found directly, search deeper
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
    if (!newRoot) return; // already at top

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
    if (!newRoot) return; // already at bottom

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

  // ─── Move node to a different parent ───────────────────────────
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

    // Prevent moving a node into its own descendant
    const nodeToMove = findNodeById(rootRef, nodeId);
    if (!nodeToMove) return;
    const descendantIds = new Set(collectIds(nodeToMove));
    if (descendantIds.has(newParentId)) {
      showWarning("Cannot move a process into its own subprocess.");
      return;
    }

    // Find current parent and remove node
    let newRoot = removeNodeFromTree(rootRef, nodeId);

    // Add node to new parent (append to end)
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

  // ─── People ────────────────────────────────────────────────
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

  const openAssignPopup = (nodeId: string) => setAssignPopupNodeId(nodeId);
  const closeAssignPopup = () => setAssignPopupNodeId(null);

  // ─── Relations ─────────────────────────────────────────────
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

  // ─── Completion ────────────────────────────────────────────
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

  // ─── Load / Upload / Save ───────────────────────────────────
  const loadData = (json: ProcessData) => {
    setInvalidUpload(null);
    setData(json);
    setCompleted(new Set(json.completed ?? []));
    setPersons(json.persons ?? []);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    setSelectedEdge(null);
    setPendingRelation(null);
    setAssignPopupNodeId(null);
    setEdgeStyles(
      new Map(
        Object.entries(json.edgeStyles ?? {}).map(([key, value]) => [key, { dashed: value?.dashed ?? false }])
      )
    );
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
    assignPopupNodeId, openAssignPopup, closeAssignPopup, toggleNodeAssignment,
    // schema validation fallback
    invalidUpload, downloadInvalidUpload,
    // undo / redo
    undo, redo, canUndo, canRedo,
    // new: move operations
    moveNodeUp, moveNodeDown, moveNodeToParent,
  };
}