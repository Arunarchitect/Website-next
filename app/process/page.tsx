"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { ProcessContainer } from "@/app/process/components/ProcessContainer";
import { RelationshipArrows, Edge } from "@/app/process/components/RelationshipArrows";
import html2canvas from "html2canvas";
import { toSvg } from "html-to-image";
import { useProcessEditor, findNodeById } from "@/app/process/hooks/useProcessEditor";

const DRAG_THRESHOLD = 6;

export default function Home() {
  // ─── Editing logic (data, relations, modals, upload/save) lives in the hook ───
  const editor = useProcessEditor({
    title: "Untitled Workflow",
    description: "Start building your process by adding nodes.",
    type: "process",
    width: 1700,
    height: 220,
    children: [],
    completed: [],
    edgeStyles: {},
  });

  // ─── View state (pan/zoom/drag, export) ────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const [exportModal, setExportModal] = useState<"pdf" | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<"A4" | "A3" | "A2">("A4");
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("landscape");

  // ─── Refs ──────────────────────────────────────────────────────
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

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
    if (!canvas || !editor.data) return;

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
  }, [editor.data, editor.completed]);

  const activeNodeId = editor.hoveredNodeId ?? editor.selectedNodeId;

  // ─── Export Functions ──────────────────────────────────────────
  const getElementForExport = () => printRef.current;

  const captureFullDiagram = async (format: "png" | "svg") => {
    const el = getElementForExport();
    if (!el) {
      editor.setError("Diagram is not ready to export. Please try again.");
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
      editor.setError(`Export ${format.toUpperCase()} failed. Check console.`);
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

  // ─── Zoom / Pan ─────────────────────────────────────────────────
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
    if (!editor.data) return;
    const frame = requestAnimationFrame(() => fitAllView());
    return () => cancelAnimationFrame(frame);
  }, [editor.data]);

  // ─── Pan / Zoom / Pointer Handlers ──────────────────────────────
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
      dragStart.current = { x: event.clientX, y: event.clientY };
      panStart.current = { ...pan };
      didDragRef.current = false;
    } else if (pointers.size === 2) {
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
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }

      setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
      didDragRef.current = true;
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
      didDragRef.current = true;
    }
  };

  const handleHoverMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging || activePointers.current.size > 0) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const nodeEl = element?.closest('[data-node-id]') as HTMLElement | null;
    editor.setHoveredNodeId(nodeEl ? nodeEl.dataset.nodeId ?? null : null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) {
      setDragging(false);
    }
  };

  const handleNodeClick = (id: string) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    editor.handleNodeClick(id, false);
  };

  const rootNode = editor.rootNode;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <main
      className="relative w-full h-[calc(100vh-140px)] min-h-[400px] sm:h-[calc(100vh-220px)] sm:min-h-[600px] overflow-hidden bg-gray-100 rounded-xl"
      style={{ userSelect: dragging ? "none" : "auto" }}
    >
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
            {editor.data
              ? `Drag to move • Pinch/Scroll to zoom • ${editor.completedLeaves} / ${editor.totalLeaves} steps completed`
              : "Upload a process JSON file"}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-white border border-gray-200 rounded-xl p-1 sm:p-2 shadow-md pointer-events-auto overflow-x-auto max-w-full">
          <label className="inline-flex items-center justify-center cursor-pointer bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-700 transition sm:px-4 sm:py-2 sm:text-sm">
            Upload
            <input type="file" accept=".json,application/json" onChange={editor.handleUpload} className="hidden" />
          </label>
          <button onClick={zoomOut} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-base text-gray-700 sm:w-9 sm:h-9 sm:text-lg">−</button>
          <div className="min-w-[45px] text-center text-xs font-medium text-gray-700 sm:min-w-[55px] sm:text-sm">{Math.round(zoom * 100)}%</div>
          <button onClick={zoomIn} className="w-7 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-base text-gray-700 sm:w-9 sm:h-9 sm:text-lg">+</button>
          <button onClick={fitAllView} title="Zoom to fit" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">Reset</button>
          <button onClick={editor.handleSave} title="Download JSON" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">Save JSON</button>

          <button
            onClick={() => editor.setShowAddModal(true)}
            title="Add a new process node"
            className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm bg-blue-50 border-blue-300 hover:bg-blue-100"
          >
            + Add Process
          </button>

          <button onClick={exportPng} title="Export as PNG" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">PNG</button>
          <button onClick={() => setExportModal("pdf")} title="Export as PDF" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">PDF</button>
          <button onClick={exportSvg} title="Export as SVG" className="px-2 h-7 rounded-lg border border-gray-200 hover:bg-gray-100 text-xs text-gray-700 sm:px-3 sm:h-9 sm:text-sm">SVG</button>
        </div>
      </div>

      {/* ACTION POPUP */}
      {(editor.selectedNodeId || editor.selectedEdge) && !editor.pendingRelation && (
        <div
          data-action-popup
          className="absolute top-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-md pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto sm:top-20"
        >
          <button
            onClick={editor.clearSelection}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold"
            title="Dismiss"
          >
            ✕
          </button>

          {editor.selectedNodeId && rootNode && (
            <>
              <span className="text-sm font-medium text-gray-700">
                {findNodeById(rootNode, editor.selectedNodeId)?.label ?? "Selected"}
              </span>
              <button
                onClick={() =>
                  editor.openEditor(editor.selectedNodeId!, "label", findNodeById(rootNode, editor.selectedNodeId!)?.label ?? "")
                }
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              >
                Edit Title
              </button>
              <button
                onClick={() =>
                  editor.openEditor(
                    editor.selectedNodeId!,
                    "description",
                    findNodeById(rootNode, editor.selectedNodeId!)?.description ?? ""
                  )
                }
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              >
                Edit Description
              </button>

              <button
                onClick={() => editor.setPendingRelation({ fromId: editor.selectedNodeId!, mode: "successor" })}
                className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs hover:bg-blue-200"
              >
                + Successor
              </button>
              <button
                onClick={() => editor.setPendingRelation({ fromId: editor.selectedNodeId!, mode: "predecessor" })}
                className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs hover:bg-green-200"
              >
                + Predecessor
              </button>

              {editor.selectedNodeId !== "root" && (
                <>
                  <button
                    onClick={() => editor.duplicateNode(editor.selectedNodeId!)}
                    className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs hover:bg-indigo-200"
                    title="Duplicate this process and its subprocesses"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => {
                      const node = findNodeById(rootNode, editor.selectedNodeId!);
                      const childCount = node?.children?.length ?? 0;
                      const msg = childCount > 0
                        ? `Delete "${node?.label}" and its ${childCount} subprocess${childCount > 1 ? "es" : ""}?`
                        : `Delete "${node?.label}"?`;
                      if (window.confirm(msg)) editor.deleteNode(editor.selectedNodeId!);
                    }}
                    className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                    title="Delete this process (and any subprocesses)"
                  >
                    Delete
                  </button>
                </>
              )}

              {findNodeById(rootNode, editor.selectedNodeId)?.successors?.map((succId) => {
                const succNode = findNodeById(rootNode, succId);
                return (
                  <button
                    key={`succ-${succId}`}
                    onClick={() => editor.deleteRelation({ from: editor.selectedNodeId!, to: succId })}
                    className="px-1.5 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                    title={`Delete successor: ${succNode?.label ?? succId}`}
                  >
                    ✕ {succNode?.label ?? succId}
                  </button>
                );
              })}

              {findNodeById(rootNode, editor.selectedNodeId)?.predecessors?.map((predId) => {
                const predNode = findNodeById(rootNode, predId);
                return (
                  <button
                    key={`pred-${predId}`}
                    onClick={() => editor.deleteRelation({ from: predId, to: editor.selectedNodeId! })}
                    className="px-1.5 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                    title={`Delete predecessor: ${predNode?.label ?? predId}`}
                  >
                    ✕ {predNode?.label ?? predId}
                  </button>
                );
              })}
            </>
          )}

          {editor.selectedEdge && !editor.pendingRelation && (
            <>
              <button
                onClick={() => editor.deleteRelation(editor.selectedEdge!)}
                className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
              >
                Delete
              </button>
              <button
                onClick={editor.reverseRelation}
                className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs hover:bg-purple-200"
              >
                Reverse
              </button>
              <button
                onClick={editor.toggleEdgeDashed}
                className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200"
              >
                Toggle Dashed
              </button>
            </>
          )}
        </div>
      )}

      {/* PENDING RELATION POPUP */}
      {editor.pendingRelation && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-md pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto sm:top-20">
          <span className="text-sm font-medium text-amber-700">
            Select target {editor.pendingRelation.mode === "successor" ? "successor" : "predecessor"}...
          </span>
          <button
            onClick={() => editor.setPendingRelation(null)}
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
        onPointerLeave={() => editor.setHoveredNodeId(null)}
        onClick={() => {
          if (didDragRef.current) {
            didDragRef.current = false;
            return;
          }
          editor.clearSelection();
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none hidden sm:block no-print"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {editor.error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-red-50 text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm shadow-md no-print">
            {editor.error}
          </div>
        )}

        {editor.warning && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-2 text-sm shadow-md max-w-md text-center no-print">
            {editor.warning}
          </div>
        )}

        {editor.data && rootNode && (
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
              completed={editor.completed}
              onToggleComplete={editor.toggleComplete}
              onEditNode={editor.openEditor}
              registerNodeRef={registerNodeRef}
              activeNodeId={activeNodeId}
              onSelectNode={handleNodeClick}
            />
            <RelationshipArrows
              rootNode={rootNode}
              positions={nodePositions}
              selectedNodeId={activeNodeId}
              selectedEdge={editor.selectedEdge}
              onSelectEdge={editor.handleSelectEdge}
              edgeStyles={editor.edgeStyles}
            />
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editor.editingNodeId && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 no-print" onClick={editor.closeEditor}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Edit {editor.editingField === "label" ? "Title" : "Description"}
            </h3>
            {editor.editingField === "label" ? (
              <input
                autoFocus
                type="text"
                value={editor.editingValue}
                onChange={(e) => editor.setEditingValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter title"
              />
            ) : (
              <textarea
                autoFocus
                value={editor.editingValue}
                onChange={(e) => editor.setEditingValue(e.target.value)}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                placeholder="Enter description"
              />
            )}
            <div className="flex justify-end gap-2">
              <button onClick={editor.closeEditor} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
              <button onClick={editor.submitEditor} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PROCESS MODAL */}
      {editor.showAddModal && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 no-print"
          onClick={() => {
            editor.setShowAddModal(false);
            editor.setAddError("");
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Add New Process</h3>

            {editor.addError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                {editor.addError}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={editor.newProcess.label}
                onChange={(e) => editor.setNewProcess({ ...editor.newProcess, label: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Site Analysis"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editor.newProcess.description}
                onChange={(e) => editor.setNewProcess({ ...editor.newProcess, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                placeholder="Brief description of the process"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position (order)
              </label>
              <div className="text-xs text-gray-500 mb-1">
                Parent: <strong>{editor.getParentInfo().parentLabel}</strong> &nbsp;|&nbsp; Current siblings: {editor.getParentInfo().childCount}
              </div>
              <input
                type="number"
                min={0}
                max={editor.getParentInfo().childCount}
                value={editor.newProcess.position}
                onChange={(e) =>
                  editor.setNewProcess({
                    ...editor.newProcess,
                    position: Math.min(Math.max(Number(e.target.value) || 0, 0), editor.getParentInfo().childCount),
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-400 mt-1">
                0 = first, {editor.getParentInfo().childCount} = last (append)
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  editor.setShowAddModal(false);
                  editor.setAddError("");
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={editor.handleAddProcess}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Add Process
              </button>
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
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium ${pdfPageSize === size ? "bg-blue-100 border-blue-500 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
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
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium ${pdfOrientation === orient ? "bg-blue-100 border-blue-500 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
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