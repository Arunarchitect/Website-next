"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { ProcessContainer } from "@/app/process/components/ProcessContainer";
import { RelationshipArrows } from "@/app/process/components/RelationshipArrows";
import {
  ProcessData,
  ProcessNode,
  countNodes,
  getLeafIds,
  isNodeComplete,
} from "@/app/process/lib/process-utils";

export default function Home() {
  const [data, setData] = useState<ProcessData | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  // Selection states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // Multi‑touch refs
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef({
    distance: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    midpoint: { x: 0, y: 0 },
  });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const warningTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Refs for latest zoom/pan
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

  // Map of node id -> DOM element (for arrow positioning)
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [nodePositions, setNodePositions] = useState<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map());

  const registerNodeRef = (id: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
  };

  // Compute node rectangles relative to canvas container
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const positions = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();

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

  // The effective highlighted node: hover takes precedence over selected
  const activeNodeId = hoveredNodeId ?? selectedNodeId;

  // Edit modal state
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

  /* =======================================================
     TOGGLE COMPLETE
  ======================================================= */
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
        showWarning(
          `"${node.label}" can't be checked off yet — complete every subprocess underneath it first.`
        );
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

  /* =======================================================
     JSON UPLOAD
  ======================================================= */
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
        setCompleted(new Set());
        setSelectedNodeId(null);
        setHoveredNodeId(null);
      } catch (err) {
        console.error(err);
        setData(null);
        setError("Invalid JSON file. Please check the file structure.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  /* =======================================================
     UPDATE NODE TEXT
  ======================================================= */
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

  /* =======================================================
     SAVE JSON
  ======================================================= */
  const handleSave = () => {
    if (!data) return;
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "process.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* =======================================================
     ZOOM
  ======================================================= */
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

  /* =======================================================
     MOUSE WHEEL ZOOM (native non‑passive)
  ======================================================= */
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

  /* =======================================================
     TOUCH / POINTER
  ======================================================= */
  const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const getMidpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = activePointers.current;

    if (pointers.size === 1) {
      setDragging(true);
      dragStart.current = { x: event.clientX, y: event.clientY };
      panStart.current = { ...pan };
    } else if (pointers.size === 2) {
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
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = activePointers.current;

    if (pointers.size === 1 && dragging) {
      const dx = event.clientX - dragStart.current.x;
      const dy = event.clientY - dragStart.current.y;
      setPan({
        x: panStart.current.x + dx,
        y: panStart.current.y + dy,
      });
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
    }
  };

  // Hover detection (pointer is not down)
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
        const remaining = [...activePointers.current.values()][0];
        setDragging(true);
        dragStart.current = { x: remaining.x, y: remaining.y };
        panStart.current = { ...pan };
      } else {
        setDragging(false);
      }
    }
  };

  /* =======================================================
     PROGRESS SUMMARY
  ======================================================= */
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

  return (
    <main
      className="relative w-full h-[calc(100vh-140px)] min-h-[400px] sm:h-[calc(100vh-220px)] sm:min-h-[600px] overflow-hidden bg-gray-100 rounded-xl"
      style={{ userSelect: dragging ? "none" : "auto" }}
    >
      {/* TOOLBAR */}
      <div className="absolute top-2 left-2 right-2 z-[100] flex flex-wrap items-start justify-between gap-2 pointer-events-none sm:top-4 sm:left-4 sm:right-4 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-md pointer-events-auto sm:px-4 sm:py-3">
          <div className="font-semibold text-gray-800 text-sm sm:text-base">
            Process Viewer
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data
              ? `Drag to move • Pinch/Scroll to zoom • ${completedLeaves} / ${totalLeaves} steps completed`
              : "Upload a process JSON file"}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-xl p-1 sm:p-2 shadow-md pointer-events-auto overflow-x-auto max-w-full">
          <label className="inline-flex items-center justify-center cursor-pointer bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-700 transition sm:px-4 sm:py-2 sm:text-sm">
            Upload
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          <button onClick={zoomOut} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-base text-gray-700 sm:w-9 sm:h-9 sm:text-lg">−</button>
          <div className="min-w-[45px] text-center text-xs font-medium text-gray-700 sm:min-w-[55px] sm:text-sm">{Math.round(zoom * 100)}%</div>
          <button onClick={zoomIn} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-base text-gray-700 sm:w-9 sm:h-9 sm:text-lg">+</button>
          <button onClick={fitAllView} title="Zoom to fit" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">Reset</button>
          <button onClick={handleSave} title="Download JSON" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">Save</button>
        </div>
      </div>

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
      >
        <div
          className="absolute inset-0 pointer-events-none hidden sm:block"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {!data && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-500">No process loaded</div>
              <div className="text-sm mt-1 text-gray-400">Click &quot;Upload JSON&quot; to begin</div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm shadow-md">
            {error}
          </div>
        )}

        {warning && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-2 text-sm shadow-md max-w-md text-center">
            {warning}
          </div>
        )}

        {data && rootNode && (
          <div
            ref={canvasRef}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: rootNode.width ? `${rootNode.width}px` : "1700px",
              boxSizing: "border-box",
              transform: `
                translate(
                  calc(-50% + ${pan.x}px),
                  calc(-50% + ${pan.y}px)
                )
                scale(${zoom})
              `,
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
              onSelectNode={setSelectedNodeId}
            />
            <RelationshipArrows
              rootNode={rootNode}
              positions={nodePositions}
              selectedNodeId={activeNodeId}
            />
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingNodeId && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={closeEditor}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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
              <button
                type="button"
                onClick={closeEditor}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEditor}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}