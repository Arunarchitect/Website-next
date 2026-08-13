"use client";

import { useEffect, useRef, useState } from "react";
import { ProcessContainer } from "@/app/process/components/ProcessContainer";
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

  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  /*
   * viewportRef -> the pannable/zoomable "canvas" area
   *                (used to measure how much screen space
   *                we have available).
   *
   * canvasRef   -> the transformed wrapper around the whole
   *                process tree (used to measure its natural,
   *                unscaled size so we can compute a "fit all"
   *                zoom level).
   */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const warningTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  /* =======================================================
     TOGGLE COMPLETE

     - Leaf node: always allowed. Flips just that node's own id.

     - Parent node that is ALREADY fully complete: allowed to
       uncheck. This clears every leaf underneath it, letting
       you undo a whole branch in one click.

     - Parent node that is NOT yet fully complete: checking it
       directly is blocked. You can't shortcut a branch by
       clicking its parent — every sub-process underneath has
       to be completed first. A warning is shown instead and
       nothing is toggled.
  ======================================================= */

  const showWarning = (message: string) => {
    setWarning(message);

    if (warningTimeout.current) {
      clearTimeout(warningTimeout.current);
    }

    warningTimeout.current = setTimeout(() => {
      setWarning("");
    }, 3200);
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

        if (typeof text !== "string") {
          throw new Error("Unable to read file.");
        }

        const json = JSON.parse(text) as ProcessData;

        if (!json || typeof json !== "object") {
          throw new Error("Invalid JSON.");
        }

        if (!json.title) {
          throw new Error("JSON must contain a title.");
        }

        setData(json);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setCompleted(new Set());
      } catch (err) {
        console.error(err);

        setData(null);
        setError("Invalid JSON file. Please check the file structure.");
      }
    };

    reader.readAsText(file);

    /* Allows selecting the same file again. */
    event.target.value = "";
  };

  /* =======================================================
     ZOOM
  ======================================================= */

  const zoomIn = () => {
    setZoom((value) => Math.min(value * 1.2, 4));
  };

  const zoomOut = () => {
    setZoom((value) => Math.max(value / 1.2, 0.15));
  };

  /*
   * "Fit all" — measures the whole diagram at its natural,
   * unscaled size and picks a zoom level that fits everything
   * inside the visible viewport, centred. This is what the
   * main "Reset" button now does.
   */
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

    if (contentRect.width === 0 || contentRect.height === 0) {
      return;
    }

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

  /*
   * "Reset format" — the plain default view: 100% zoom,
   * centred, no panning. Independent of content size.
   */
  const resetFormatView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  /*
   * Automatically fit the diagram to view whenever a new
   * file is loaded.
   */
  useEffect(() => {
    if (!data) return;

    const frame = requestAnimationFrame(() => {
      fitAllView();
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* =======================================================
     MOUSE WHEEL ZOOM
  ======================================================= */

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const amount = event.deltaY > 0 ? 0.9 : 1.1;

    setZoom((value) => Math.min(Math.max(value * amount, 0.15), 4));
  };

  /* =======================================================
     PAN START / MOVE / END
  ======================================================= */

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    setDragging(true);

    dragStart.current = { x: event.clientX, y: event.clientY };
    panStart.current = { x: pan.x, y: pan.y };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;

    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;

    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  /* =======================================================
     PROGRESS SUMMARY

     Counted at the leaf level — those are the only nodes
     with real, independently-stored completion state.
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

  // countNodes is available if you want a total-node count in the UI too.
  void countNodes;

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main
      className="relative w-full h-[calc(100vh-220px)] min-h-[600px] overflow-hidden bg-gray-100 rounded-xl"
      style={{ userSelect: dragging ? "none" : "auto" }}
    >
      {/* TOOLBAR */}
      <div className="absolute top-4 left-4 right-4 z-[100] flex items-center justify-between gap-4 pointer-events-none">
        {/* TITLE */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-md pointer-events-auto">
          <div className="font-semibold text-gray-800">Process Viewer</div>
          <div className="text-xs text-gray-500 mt-1">
            {data
              ? `Drag to move • Scroll to zoom • ${completedLeaves} / ${totalLeaves} steps completed`
              : "Upload a process JSON file"}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 shadow-md pointer-events-auto">
          {/* UPLOAD */}
          <label className="inline-flex items-center justify-center cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition">
            Upload JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>

          {/* ZOOM OUT */}
          <button
            type="button"
            onClick={zoomOut}
            className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-100 text-lg text-gray-700"
          >
            −
          </button>

          {/* ZOOM LEVEL */}
          <div className="min-w-[55px] text-center text-sm font-medium text-gray-700">
            {Math.round(zoom * 100)}%
          </div>

          {/* ZOOM IN */}
          <button
            type="button"
            onClick={zoomIn}
            className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-100 text-lg text-gray-700"
          >
            +
          </button>

          {/* RESET -> fits the entire diagram in view */}
          <button
            type="button"
            onClick={fitAllView}
            title="Zoom to fit the whole diagram"
            className="px-3 h-9 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm text-gray-700"
          >
            Reset
          </button>

          {/* RESET FORMAT -> back to the plain 100% default view */}
          <button
            type="button"
            onClick={resetFormatView}
            title="Return to the default 100% view"
            className="px-3 h-9 rounded-lg border border-gray-200 hover:bg-gray-100 text-sm text-gray-700"
          >
            Reset Format
          </button>
        </div>
      </div>

      {/* CANVAS */}
      <div
        ref={viewportRef}
        className={`absolute inset-0 overflow-hidden ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* GRID */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* EMPTY STATE */}
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-500">
                No process loaded
              </div>
              <div className="text-sm mt-1 text-gray-400">
                Click &quot;Upload JSON&quot; to begin
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm shadow-md">
            {error}
          </div>
        )}

        {/* WARNING (blocked "check off parent" attempts) */}
        {warning && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-2 text-sm shadow-md max-w-md text-center">
            {warning}
          </div>
        )}

        {/* PROCESS CANVAS */}
        {data && rootNode && (
          <div
            ref={canvasRef}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              /* Large enough to accommodate several top-level processes. */
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
            />
          </div>
        )}
      </div>
    </main>
  );
}