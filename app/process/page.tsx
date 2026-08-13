"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { ProcessContainer } from "@/app/process/components/ProcessContainer";
import { RelationshipArrows, Edge } from "@/app/process/components/RelationshipArrows";
import html2canvas from "html2canvas";
import { toSvg } from "html-to-image";
import {
  ProcessData,
  ProcessNode,
  countNodes,
  getLeafIds,
  isNodeComplete,
} from "@/app/process/lib/process-utils";

const DRAG_THRESHOLD = 6; // px of movement before a pointerdown counts as a pan, not a click

export default function Home() {
  const [data, setData] = useState<ProcessData | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [pendingRelation, setPendingRelation] = useState<{
    fromId: string;
    mode: "successor" | "predecessor";
  } | null>(null);

  // PDF export modal state
  const [exportModal, setExportModal] = useState<"pdf" | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<"A4" | "A3" | "A2">("A4");
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("landscape");

  // Arrow style state: key = "from->to", value = { dashed: boolean }
  const [edgeStyles, setEdgeStyles] = useState<Map<string, { dashed: boolean }>>(new Map());

  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false); // tracks if a real drag (past threshold) occurred

  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef({
    distance: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    midpoint: { x: 0, y: 0 },
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);

  const warningTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());

  const registerNodeRef = (id: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const positions = new Map<string, { x: number; y: number; width: number; height: number }>();

    nodeRefs.current.forEach((el, id) => {
      let left = 0;
      let top = 0;
      let current: HTMLElement | null = el;

      while (current && current !== canvas) {
        left += current.offsetLeft;
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }

      positions.set(id, {
        x: left,
        y: top,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    });

    setNodePositions(positions);
  }, [data, completed]);

  const activeNodeId = hoveredNodeId ?? selectedNodeId;

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"label" | "description">("label");
  const [editingValue, setEditingValue] = useState("");

  const openEditor = (id: string, field: "label" | "description", currentValue: string) => {
    setEditingNodeId(id);
    setEditingField(field);
    setEditingValue(currentValue);
  };

  const closeEditor = () => setEditingNodeId(null);

  const submitEditor = () => {
    if (editingNodeId) {
      const trimmed = editingValue.trim();
      if (editingField === "label" && trimmed === "") return;
      updateNode(editingNodeId, editingField, trimmed);
    }
    closeEditor();
  };

  const updateNodeData = (
    root: ProcessNode,
    id: string,
    updater: (node: ProcessNode) => ProcessNode
  ): ProcessNode => {
    if (root.id === id) return updater(root);
    if (root.children) {
      return { ...root, children: root.children.map((child) => updateNodeData(child, id, updater)) };
    }
    return root;
  };

  const findNodeById = (root: ProcessNode, id: string): ProcessNode | null => {
    if (root.id === id) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };

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

  const showWarning = (message: string) => {
    setWarning(message);
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    warningTimeout.current = setTimeout(() => setWarning(""), 3200);
  };

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
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setCompleted(new Set(json.completed ?? []));
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setSelectedEdge(null);
        setPendingRelation(null);
        setEdgeStyles(
  new Map(
    Object.entries(json.edgeStyles ?? {}).map(([key, value]) => [
      key,
      { dashed: value?.dashed ?? false },
    ])
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

  const updateNode = (id: string, field: "label" | "description", value: string) => {
    if (!data) return;

    if (id === "root") {
      setData({
        ...data,
        [field === "label" ? "title" : "description"]: value,
      });
      return;
    }

    const updateTree = (node: ProcessNode): ProcessNode => {
      if (node.id === id) return { ...node, [field]: value };
      if (node.children) return { ...node, children: node.children.map(updateTree) };
      return node;
    };

    setData({
      ...data,
      children: data.children ? data.children.map(updateTree) : undefined,
    });
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

  /* =======================================================
     EXPORT PNG / PDF / SVG
  ======================================================= */
  const getElementForExport = () => printRef.current;

  const captureFullDiagram = async (format: "png" | "svg") => {
    const el = getElementForExport();
    if (!el) {
      setError("Diagram is not ready to export. Please try again.");
      return;
    }

    const prevTransform = el.style.transform;
    const prevTransition = el.style.transition;

    el.style.transition = "none";
    el.style.transform = "none";

    try {
      if (format === "png") {
        const canvas = await html2canvas(el, {
          scale: 3,
          backgroundColor: "#ffffff",
          logging: false,
          useCORS: true,
        });
        const link = document.createElement("a");
        link.download = "workflow.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const dataUrl = await toSvg(el, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });
        const link = document.createElement("a");
        link.download = "workflow.svg";
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error(`Export ${format.toUpperCase()} failed:`, err);
      setError(`Export ${format.toUpperCase()} failed. Check console.`);
    } finally {
      el.style.transform = prevTransform;
      el.style.transition = prevTransition;
    }
  };

  const exportPng = () => captureFullDiagram("png");
  const exportSvg = () => captureFullDiagram("svg");

  const exportPdf = (pageSize: "A4" | "A3" | "A2", orientation: "portrait" | "landscape") => {
    const style = document.createElement("style");
    style.id = "print-page-style";
    style.innerHTML = `
      @page {
        size: ${pageSize} ${orientation};
        margin: 0;
      }
    `;
    document.head.appendChild(style);

    const el = getElementForExport();
    if (el) {
      const prevTransform = el.style.transform;
      const prevTransition = el.style.transition;
      el.style.transition = "none";
      el.style.transform = "none";
      const naturalWidth = el.offsetWidth;
      const naturalHeight = el.offsetHeight;
      el.style.transform = prevTransform;
      el.style.transition = prevTransition;

      const pageSizes: Record<string, { width: number; height: number }> = {
        A4: { width: 794, height: 1123 },
        A3: { width: 1123, height: 1587 },
        A2: { width: 1587, height: 2245 },
      };
      const page = pageSizes[pageSize];
      const pageWidth = orientation === "landscape" ? page.height : page.width;
      const pageHeight = orientation === "landscape" ? page.width : page.height;

      const scaleX = pageWidth / naturalWidth;
      const scaleY = pageHeight / naturalHeight;
      const printScale = Math.min(scaleX, scaleY, 1);
      document.documentElement.style.setProperty("--print-scale", printScale.toString());
    }

    document.body.classList.add("printing");
    window.print();

    window.addEventListener(
      "afterprint",
      () => {
        document.body.classList.remove("printing");
        document.documentElement.style.removeProperty("--print-scale");
        const existingStyle = document.getElementById("print-page-style");
        if (existingStyle) existingStyle.remove();
      },
      { once: true }
    );
  };

  const zoomIn = () => setZoom((v) => Math.min(v * 1.2, 4));
  const zoomOut = () => setZoom((v) => Math.max(v / 1.2, 0.15));

  const fitAllView = () => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;

    const previousTransform = canvas.style.transform;
    canvas.style.transition = "none";
    canvas.style.transform = "translate(-50%, -50%) scale(1)";
    const contentRect = canvas.getBoundingClientRect();
    canvas.style.transform = previousTransform;
    canvas.style.transition = "";

    if (contentRect.width === 0 || contentRect.height === 0) return;

    const viewportRect = viewport.getBoundingClientRect();
    const padding = 72;
    const availableWidth = Math.max(viewportRect.width - padding * 2, 1);
    const availableHeight = Math.max(viewportRect.height - padding * 2, 1);
    const scaleX = availableWidth / contentRect.width;
    const scaleY = availableHeight / contentRect.height;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 4);

    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!data) return;
    const frame = requestAnimationFrame(() => fitAllView());
    return () => cancelAnimationFrame(frame);
  }, [data]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(Math.max(oldZoom * factor, 0.15), 4);
      if (newZoom === oldZoom) return;

      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const ratio = newZoom / oldZoom;
      const oldPan = panRef.current;

      const newPan = {
        x: (mouseX - halfW) * (1 - ratio) + oldPan.x * ratio,
        y: (mouseY - halfH) * (1 - ratio) + oldPan.y * ratio,
      };

      setZoom(newZoom);
      setPan(newPan);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const getMidpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pointers = activePointers.current;

    if (pointers.size === 1) {
      // Don't capture or decide pan-vs-click yet — a plain click (on a node,
      // an edge, or empty canvas) must be allowed to hit its real target.
      // We only commit to "this is a pan" once movement crosses the
      // threshold, in handlePointerMove.
      dragStart.current = { x: event.clientX, y: event.clientY };
      panStart.current = { ...pan };
      didDragRef.current = false;
    } else if (pointers.size === 2) {
      // Second finger down — this is unambiguously a pinch, capture now.
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(false);
      const [p1, p2] = [...pointers.values()];
      pinchStart.current = {
        distance: getDistance(p1, p2),
        zoom: zoom,
        pan: { ...pan },
        midpoint: getMidpoint(p1, p2),
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pointers = activePointers.current;

    if (pointers.size === 1) {
      const dx = event.clientX - dragStart.current.x;
      const dy = event.clientY - dragStart.current.y;

      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // still just a click-in-progress
        // Threshold crossed — this is a real pan, even if it started on a node.
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }

      setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
      didDragRef.current = true; // a drag occurred — suppress the click that follows
    } else if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const newDist = getDistance(p1, p2);
      const oldDist = pinchStart.current.distance;
      if (oldDist === 0) return;

      const ratio = newDist / oldDist;
      const newZoom = Math.min(Math.max(pinchStart.current.zoom * ratio, 0.15), 4);

      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const mid = getMidpoint(p1, p2);
      const localX = mid.x - rect.left;
      const localY = mid.y - rect.top;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const zoomRatio = newZoom / pinchStart.current.zoom;
      const oldPan = pinchStart.current.pan;

      setZoom(newZoom);
      setPan({
        x: (localX - halfW) * (1 - zoomRatio) + oldPan.x * zoomRatio,
        y: (localY - halfH) * (1 - zoomRatio) + oldPan.y * zoomRatio,
      });
      didDragRef.current = true; // pinch also counts as a drag
    }
  };

  const handleHoverMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging || activePointers.current.size > 0) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const nodeEl = element?.closest('[data-node-id]') as HTMLElement | null;
    setHoveredNodeId(nodeEl ? nodeEl.dataset.nodeId ?? null : null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) {
      if (activePointers.current.size === 1) {
        // If one pointer remains, we don't continue panning automatically.
        // The remaining pointer could start a new pan if it moves.
        setDragging(false);
      } else {
        setDragging(false);
      }
    }
  };

  const handleNodeClick = (id: string) => {
    if (didDragRef.current) {
      // This click is the tail end of a real pan (started on this node) — ignore it.
      didDragRef.current = false;
      return;
    }
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
  void countNodes;

  // Clear all selections
  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdge(null);
    setPendingRelation(null);
  };

  return (
    <main
      className="relative w-full h-[calc(100vh-140px)] min-h-[400px] sm:h-[calc(100vh-220px)] sm:min-h-[600px] overflow-hidden bg-gray-100 rounded-xl"
      style={{ userSelect: dragging ? "none" : "auto" }}
    >
      {/* Inline print styles */}
      <style>{`
        @media print {
          body.printing * { visibility: hidden; }
          body.printing [data-print-root],
          body.printing [data-print-root] * { visibility: visible; }
          body.printing [data-print-root] {
            position: absolute;
            left: 0;
            top: 0;
            transform: scale(var(--print-scale, 1));
            transform-origin: top left;
            width: auto;
            height: auto;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* TOOLBAR */}
      <div className="absolute top-2 left-2 right-2 z-[100] flex flex-wrap items-start justify-between gap-2 pointer-events-none sm:top-4 sm:left-4 sm:right-4 sm:gap-4 no-print">
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-md pointer-events-auto sm:px-4 sm:py-3">
          <div className="font-semibold text-gray-800 text-sm sm:text-base">Process Viewer</div>
          <div className="text-xs text-gray-500 mt-1">
            {data
              ? `Drag to move • Pinch/Scroll to zoom • ${completedLeaves} / ${totalLeaves} steps completed`
              : "Upload a process JSON file"}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-xl p-1 sm:p-2 shadow-md pointer-events-auto overflow-x-auto max-w-full">
          <label className="inline-flex items-center justify-center cursor-pointer bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-700 transition sm:px-4 sm:py-2 sm:text-sm">
            Upload
            <input type="file" accept=".json,application/json" onChange={handleUpload} className="hidden" />
          </label>
          <button onClick={zoomOut} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-base text-gray-700 sm:w-9 sm:h-9 sm:text-lg">−</button>
          <div className="min-w-[45px] text-center text-xs font-medium text-gray-700 sm:min-w-[55px] sm:text-sm">{Math.round(zoom * 100)}%</div>
          <button onClick={zoomIn} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-base text-gray-700 sm:w-9 sm:h-9 sm:text-lg">+</button>
          <button onClick={fitAllView} title="Zoom to fit" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">Reset</button>
          <button onClick={handleSave} title="Download JSON" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">Save JSON</button>

          {/* Export buttons */}
          <button onClick={exportPng} title="Export as PNG" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">PNG</button>
          <button onClick={() => setExportModal("pdf")} title="Export as PDF" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">PDF</button>
          <button onClick={exportSvg} title="Export as SVG" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">SVG</button>
        </div>
      </div>

      {/* ACTION POPUP (no overlay) */}
      {(selectedNodeId || selectedEdge) && !pendingRelation && (
        <div
          data-action-popup
          className="absolute top-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-md pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto sm:top-20"
        >
          <button
            onClick={clearSelection}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold"
            title="Dismiss"
          >
            ✕
          </button>

          {selectedNodeId && rootNode && (
            <>
              <span className="text-sm font-medium text-gray-700">
                {findNodeById(rootNode, selectedNodeId)?.label ?? "Selected"}
              </span>
              <button
                onClick={() => openEditor(selectedNodeId, "label", findNodeById(rootNode, selectedNodeId)?.label ?? "")}
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              >
                Edit Title
              </button>
              <button
                onClick={() => openEditor(selectedNodeId, "description", findNodeById(rootNode, selectedNodeId)?.description ?? "")}
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              >
                Edit Description
              </button>

              <button
                onClick={() => setPendingRelation({ fromId: selectedNodeId, mode: "successor" })}
                className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs hover:bg-blue-200"
              >
                + Successor
              </button>
              <button
                onClick={() => setPendingRelation({ fromId: selectedNodeId, mode: "predecessor" })}
                className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs hover:bg-green-200"
              >
                + Predecessor
              </button>

              {findNodeById(rootNode, selectedNodeId)?.successors?.map((succId) => {
                const succNode = findNodeById(rootNode, succId);
                return (
                  <button
                    key={`succ-${succId}`}
                    onClick={() => deleteRelation({ from: selectedNodeId, to: succId })}
                    className="px-1.5 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                    title={`Delete successor: ${succNode?.label ?? succId}`}
                  >
                    ✕ {succNode?.label ?? succId}
                  </button>
                );
              })}

              {findNodeById(rootNode, selectedNodeId)?.predecessors?.map((predId) => {
                const predNode = findNodeById(rootNode, predId);
                return (
                  <button
                    key={`pred-${predId}`}
                    onClick={() => deleteRelation({ from: predId, to: selectedNodeId })}
                    className="px-1.5 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                    title={`Delete predecessor: ${predNode?.label ?? predId}`}
                  >
                    ✕ {predNode?.label ?? predId}
                  </button>
                );
              })}
            </>
          )}

          {selectedEdge && !pendingRelation && (
            <>
              <button
                onClick={() => deleteRelation(selectedEdge)}
                className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
              >
                Delete
              </button>
              <button
                onClick={reverseRelation}
                className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs hover:bg-purple-200"
              >
                Reverse
              </button>
              <button
                onClick={toggleEdgeDashed}
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              >
                Toggle Dashed
              </button>
            </>
          )}
        </div>
      )}

      {/* PENDING RELATION POPUP */}
      {pendingRelation && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-md pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto sm:top-20">
          <span className="text-sm font-medium text-amber-700">
            Select target {pendingRelation.mode === "successor" ? "successor" : "predecessor"}...
          </span>
          <button
            onClick={() => setPendingRelation(null)}
            className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* CANVAS */}
      <div
        ref={viewportRef}
        className={`absolute inset-0 overflow-hidden ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => {
          handlePointerMove(e);
          handleHoverMove(e);
        }}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setHoveredNodeId(null)}
        onClick={() => {
          // Clear selection only if not after a drag
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          clearSelection();
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none hidden sm:block no-print"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {!data && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none no-print">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-500">No process loaded</div>
              <div className="text-sm mt-1 text-gray-400">Click &quot;Upload JSON&quot; to begin</div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm shadow-md no-print">
            {error}
          </div>
        )}

        {warning && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-2 text-sm shadow-md max-w-md text-center no-print">
            {warning}
          </div>
        )}

        {data && rootNode && (
          <div
            ref={(el) => {
              canvasRef.current = el;
              printRef.current = el;
            }}
            data-print-root
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: rootNode.width ? `${rootNode.width}px` : "1700px",
              boxSizing: "border-box",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 0.08s ease-out",
            }}
          >
            <ProcessContainer
              node={rootNode}
              level={0}
              colorIndex={0}
              completed={completed}
              onToggleComplete={toggleComplete}
              onEditNode={openEditor}
              registerNodeRef={registerNodeRef}
              activeNodeId={activeNodeId}
              onSelectNode={handleNodeClick}
            />
            <RelationshipArrows
              rootNode={rootNode}
              positions={nodePositions}
              selectedNodeId={activeNodeId}
              selectedEdge={selectedEdge}
              onSelectEdge={handleSelectEdge}
              edgeStyles={edgeStyles}
            />
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingNodeId && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 no-print" onClick={closeEditor}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Edit {editingField === "label" ? "Title" : "Description"}
            </h3>
            {editingField === "label" ? (
              <input
                autoFocus
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter title"
              />
            ) : (
              <textarea
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                placeholder="Enter description"
              />
            )}
            <div className="flex justify-end gap-2">
              <button onClick={closeEditor} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
              <button onClick={submitEditor} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF EXPORT DIALOG */}
      {exportModal === "pdf" && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/40 no-print" onClick={() => setExportModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">PDF Export Settings</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Page Size</label>
              <div className="flex gap-2">
                {["A4", "A3", "A2"].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPdfPageSize(size as "A4" | "A3" | "A2")}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                      pdfPageSize === size ? "bg-blue-100 border-blue-500 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Orientation</label>
              <div className="flex gap-2">
                {["portrait", "landscape"].map((orient) => (
                  <button
                    key={orient}
                    onClick={() => setPdfOrientation(orient as "portrait" | "landscape")}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                      pdfOrientation === orient ? "bg-blue-100 border-blue-500 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {orient.charAt(0).toUpperCase() + orient.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setExportModal(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setExportModal(null);
                  exportPdf(pdfPageSize, pdfOrientation);
                }}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700"
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}