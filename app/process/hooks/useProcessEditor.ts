"use client";

import { useRef, useState } from "react";
import { Person, ProcessData, ProcessNode } from "@/app/process/lib/process-utils";

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

  // ─── People ────────────────────────────────────────────────
  const addPerson = () => {
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    const newPerson: Person = {
      id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: trimmed,
    };
    setPersons((prev) => [...prev, newPerson]);
    setNewPersonName("");
  };

  const deletePerson = (id: string) => {
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
  const addRelation = (fromId: string, toId: string, mode: "successor" | "predecessor") => {
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

  const deleteRelation = (edge: Edge) => {
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

  const reverseRelation = () => {
    if (!selectedEdge) return;
    const { from, to } = selectedEdge;
    deleteRelation(selectedEdge);
    addRelation(to, from, "successor");
    setSelectedEdge(null);
  };

  const toggleEdgeDashed = () => {
    if (!selectedEdge) return;
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
      if (!currentlyComplete) {
        showWarning(`"${node.label}" can't be checked off yet — complete every subprocess underneath it first.`);
        return;
      }
    }

    setCompleted((prev) => {
      const next = new Set(prev);
      const leafIds = getLeafIds(node);
      const currentlyComplete = isNodeComplete(node, prev);
      if (currentlyComplete) {
        leafIds.forEach((id) => next.delete(id));
      } else {
        leafIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // ─── Upload / Save ─────────────────────────────────────────
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setWarning("");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string") throw new Error("Unable to read file.");
        const json = JSON.parse(text) as ProcessData;
        if (!json || typeof json !== "object") throw new Error("Invalid JSON.");
        if (!json.title) throw new Error("JSON must contain a title.");

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
      } catch (err) {
        console.error(err);
        setData(null);
        setError("Invalid JSON file. Please check the file structure.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleSave = () => {
    if (!data) {
      setError("No process data to save.");
      return;
    }

    try {
      const exportData = {
        ...data,
        completed: Array.from(completed),
        edgeStyles: Object.fromEntries(edgeStyles.entries()),
        persons,
      };

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
    data, setData, rootNode,
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
    toggleComplete, handleUpload, handleSave, updateNode,
    totalLeaves, completedLeaves,
    clearSelection, handleNodeClick, handleSelectEdge,
    // people
    persons, showPersonManager, setShowPersonManager,
    newPersonName, setNewPersonName, addPerson, deletePerson,
    assignPopupNodeId, openAssignPopup, closeAssignPopup, toggleNodeAssignment,
  };
}