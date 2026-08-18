"use client";

import "./page.css";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ProcessContainer } from "@/app/process/components/ProcessContainer";
import { RelationshipArrows } from "@/app/process/components/RelationshipArrows";
import { UploadButton, ExportButtons } from "@/app/process/components/transfer";
import { useProcessEditor, findNodeById } from "@/app/process/hooks/useProcessEditor";
import { useCloudSync } from "@/app/process/hooks/useCloudSync";
import { useAutosave } from "@/app/process/hooks/useAutoSave";
import type { ProcessNode } from "@/app/process/lib/process-utils";

const DRAG_THRESHOLD = 6;

// ─── Shared button style tokens ───
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
const btnGhost = `${btnBase} text-gray-600 hover:bg-gray-100`;
const btnOutline = `${btnBase} border border-gray-200 text-gray-700 hover:bg-gray-50`;
const btnPrimary = `${btnBase} bg-indigo-600 text-white hover:bg-indigo-500`;
const btnDanger = `${btnBase} bg-red-50 text-red-600 hover:bg-red-100`;
const inputBase =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition";

// ─── Small inline icons ───
const IconWrap = ({ children }: { children: React.ReactNode }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const IconUsers = () => (
  <IconWrap><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></IconWrap>
);
const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
);
const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);
const IconUndo = () => (
  <IconWrap><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></IconWrap>
);
const IconRedo = () => (
  <IconWrap><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></IconWrap>
);
const IconArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
);
const IconArrowDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);

export default function ProcessWorkflowEditor({ masterword }: { masterword?: string }) {
  // ─── Editing logic ───
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

  // ─── Cloud sync + autosave ───
  const cloud = useCloudSync(editor.loadData, masterword);
  const autosave = useAutosave(editor.getExportData, cloud.saveToCloud);

  // Save popup state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"local" | "server">("server");
  const [passphrase, setPassphrase] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveFormError, setSaveFormError] = useState("");

  // Admin options
  const [showAdminMaster, setShowAdminMaster] = useState(false);
  const [wantMaster, setWantMaster] = useState(false);
  const [masterKeyInput, setMasterKeyInput] = useState("");

  // Autosave prompt
  const [autosavePromptOpen, setAutosavePromptOpen] = useState(false);
  const [autosavePassphraseInput, setAutosavePassphraseInput] = useState("");

  // People manager
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState("");

  const [filterPersonId, setFilterPersonId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const startRenamePerson = (id: string, currentName: string) => {
    setEditingPersonId(id);
    setEditingPersonName(currentName);
  };

  const commitRenamePerson = () => {
    if (editingPersonId) {
      editor.renamePerson(editingPersonId, editingPersonName);
    }
    setEditingPersonId(null);
    setEditingPersonName("");
  };

  const cancelRenamePerson = () => {
    setEditingPersonId(null);
    setEditingPersonName("");
  };

  // Loaded doc id
  const [loadedDocId, setLoadedDocId] = useState<string | null>(null);

  // Load dropdown
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const loadBtnRef = useRef<HTMLButtonElement | null>(null);
  const [loadMenuPos, setLoadMenuPos] = useState({ top: 0, left: 0, width: 288 });

  const toggleLoadMenu = () => {
    if (!loadMenuOpen && loadBtnRef.current) {
      const rect = loadBtnRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 8;
      const width = Math.min(288, viewportWidth - margin * 2);
      let left = rect.left;
      if (left + width + margin > viewportWidth) {
        left = viewportWidth - width - margin;
      }
      if (left < margin) left = margin;
      setLoadMenuPos({ top: rect.bottom + 6, left, width });
    }
    setLoadMenuOpen((v) => !v);
  };

  const loadMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        loadMenuRef.current &&
        !loadMenuRef.current.contains(target) &&
        loadBtnRef.current &&
        !loadBtnRef.current.contains(target)
      ) {
        setLoadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [loadMenuOpen]);

  // Toolbar scroll
  const toolbarScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateToolbarScrollState = () => {
    const el = toolbarScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateToolbarScrollState();
    const el = toolbarScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateToolbarScrollState, { passive: true });
    window.addEventListener("resize", updateToolbarScrollState);
    return () => {
      el.removeEventListener("scroll", updateToolbarScrollState);
      window.removeEventListener("resize", updateToolbarScrollState);
    };
  }, [editor.data]);

  const scrollToolbar = (dir: "left" | "right") => {
    toolbarScrollRef.current?.scrollBy({ left: dir === "left" ? -140 : 140, behavior: "smooth" });
  };

  const openSaveModal = () => {
    setSaveTitle(editor.data?.title || "");
    setSaveFormError("");
    setShowAdminMaster(false);
    setWantMaster(false);
    setMasterKeyInput("");
    setSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    if (saveMode === "local") {
      editor.handleSave();
      setSaveModalOpen(false);
      return;
    }

    if (!passphrase.trim()) {
      setSaveFormError("Enter your passphrase to save to the server.");
      return;
    }
    const exportData = editor.getExportData();
    if (!exportData) {
      setSaveFormError("No process data to save.");
      return;
    }
    if (wantMaster && !masterKeyInput.trim()) {
      setSaveFormError("Enter this group's master key to set this as its default workflow.");
      return;
    }

    setSaveBusy(true);
    setSaveFormError("");
    try {
      await cloud.saveToCloud({
        passphrase: passphrase.trim(),
        title: saveTitle.trim(),
        is_master: wantMaster,
        master_key: wantMaster ? masterKeyInput.trim() : undefined,
        data: exportData,
      });
      autosave.enable(passphrase.trim());
      setSaveModalOpen(false);
    } catch (err: unknown) {
      setSaveFormError(err instanceof Error ? err.message : "Failed to save to server.");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleEnableAutosave = async () => {
    if (!autosavePassphraseInput.trim()) return;
    const ok = await autosave.verifyAndEnable(autosavePassphraseInput);
    if (ok) {
      setAutosavePromptOpen(false);
      setAutosavePassphraseInput("");
    }
  };

  // ─── View state ───
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

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

  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener("wheel", preventBrowserZoom, { passive: false });
    return () => document.removeEventListener("wheel", preventBrowserZoom);
  }, []);

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

  // ─── Zoom / Pan ───
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.loadVersion]);

  // ─── Pointer handlers ───
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

  // ─── Handle node click (including move mode) ───
  const handleNodeClick = (id: string) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    // If move-to-parent mode is active, use this click as target
    if (moveParentMode) {
      if (id !== moveParentMode) {
        editor.moveNodeToParent(moveParentMode, id);
      }
      setMoveParentMode(null);
      return;
    }

    editor.handleNodeClick(id, false);
  };

  // ─── Helper: get parent and index of a node ───
  const getNodeParentAndIndex = (nodeId: string) => {
    const search = (node: ProcessNode, targetId: string): { parent: ProcessNode; index: number } | null => {
      if (!node.children) return null;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.id === targetId) {
          return { parent: node, index: i };
        }
        const found = search(child, targetId);
        if (found) return found;
      }
      return null;
    };
    return rootNode ? search(rootNode, nodeId) : null;
  };

  // ─── State for move-to-parent mode ───
  const [moveParentMode, setMoveParentMode] = useState<string | null>(null);

  const rootNode = editor.rootNode;
  const displayGroup = masterword?.trim() || "Ungrouped";

  // Helper: collect tasks assigned to a person, in depth-first tree order
  const getPersonTasks = (personId: string): ProcessNode[] => {
    if (!rootNode) return [];

    const tasks: ProcessNode[] = [];

    const traverse = (node: ProcessNode) => {
      // Exclude the root container itself from “tasks”
      if (node.id !== "root" && node.assignedPersonIds?.includes(personId)) {
        tasks.push(node);
      }
      (node.children ?? []).forEach(traverse);
    };

    traverse(rootNode);
    return tasks;
  };

  // Helper: whether a node (task) is fully complete
  const isNodeFullyComplete = (node: ProcessNode): boolean => {
    const children = node.children ?? [];
    if (children.length === 0) {
      return editor.completed.has(node.id);
    }
    return children.every(isNodeFullyComplete);
  };

  // Compute the label for the node being moved (safe even if rootNode is null)
  const moveParentLabel = moveParentMode && rootNode ? findNodeById(rootNode, moveParentMode)?.label : null;

  // ─── Render ───
  return (
    <div
      className="flex flex-col w-full h-[calc(100vh-140px)] min-h-[400px] sm:h-[calc(100vh-220px)] sm:min-h-[600px]"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {/* INITIAL LOADING OVERLAY */}
      {cloud.initialLoading && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Loading workflow…</p>
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-0.5 pb-2 sm:gap-3 sm:pb-3 no-print shrink-0">
        <div className="bg-white border border-gray-200/70 rounded-2xl px-3.5 py-2.5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:px-4 sm:py-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="font-semibold text-gray-900 text-sm sm:text-base tracking-tight shrink-0">Process Viewer</div>
            {editor.data?.title && (
              <span
                title={editor.data.title}
                className="text-[10px] sm:text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md truncate max-w-[110px] sm:max-w-[200px]"
              >
                {editor.data.title}
              </span>
            )}
            <span
              title={`Scoped to group: ${displayGroup}`}
              className="text-[10px] sm:text-[11px] font-medium text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full shrink-0"
            >
              group: {displayGroup}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {editor.data
              ? `${editor.completedLeaves} / ${editor.totalLeaves} steps done`
              : "Upload a process JSON file"}
          </div>
        </div>

        {/* Action bar */}
        <div className="relative max-w-full">
          <div className="bg-white border border-gray-200/70 rounded-2xl shadow-[0_2px_16px_rgba(15,23,42,0.06)] overflow-hidden">
            <div
              ref={toolbarScrollRef}
              className="flex items-center gap-1 p-1.5 overflow-x-auto no-scrollbar scroll-smooth"
              style={{ touchAction: "pan-x" }}
            >
              <UploadButton onUpload={editor.handleUpload} />

              <div className="flex items-center gap-0.5 mx-0.5 shrink-0">
                <button onClick={zoomOut} title="Zoom out" className={`${btnGhost} w-8 h-8 text-base sm:w-9 sm:h-9`}>−</button>
                <div className="min-w-[34px] text-center text-[11px] font-medium text-gray-500 sm:min-w-[40px] sm:text-xs">{Math.round(zoom * 100)}%</div>
                <button onClick={zoomIn} title="Zoom in" className={`${btnGhost} w-8 h-8 text-base sm:w-9 sm:h-9`}>+</button>
              </div>

              <button onClick={fitAllView} title="Fit to screen" className={`${btnGhost} h-8 px-2 text-xs shrink-0 sm:h-9 sm:px-2.5 sm:text-sm`}>
                Fit
              </button>

              <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={editor.undo}
                  disabled={!editor.canUndo}
                  title="Undo (Ctrl+Z)"
                  className={`${btnGhost} w-8 h-8 sm:w-9 sm:h-9`}
                >
                  <IconUndo />
                </button>
                <button
                  onClick={editor.redo}
                  disabled={!editor.canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  className={`${btnGhost} w-8 h-8 sm:w-9 sm:h-9`}
                >
                  <IconRedo />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />

              <button onClick={openSaveModal} title="Save this workflow" className={`${btnOutline} h-8 px-2.5 text-xs shrink-0 sm:h-9 sm:px-3 sm:text-sm`}>
                Save
              </button>

              <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />

              <div className="relative shrink-0">
                <button
                  ref={loadBtnRef}
                  onClick={toggleLoadMenu}
                  title="Load a saved workflow from the server"
                  className={`${btnGhost} h-8 px-2 text-xs sm:h-9 sm:px-2.5 sm:text-sm`}
                >
                  Load ▾
                </button>

                {loadMenuOpen &&
                  createPortal(
                    <div
                      ref={loadMenuRef}
                      style={{
                        position: "fixed",
                        top: loadMenuPos.top,
                        left: loadMenuPos.left,
                        width: loadMenuPos.width,
                        zIndex: 500,
                      }}
                      className="max-h-80 overflow-y-auto bg-white border border-gray-200/70 rounded-xl shadow-[0_8px_30px_rgba(15,23,42,0.12)] p-1.5"
                    >
                      {cloud.cloudError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 mb-1.5">
                          {cloud.cloudError}
                        </div>
                      )}

                      {cloud.cloudLoading && (
                        <div className="text-xs text-gray-400 text-center py-3">Loading…</div>
                      )}

                      {!cloud.cloudLoading && cloud.cloudList.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-4">No saved workflows yet.</div>
                      )}

                      {!cloud.cloudLoading &&
                        cloud.cloudList.map((doc) => {
                          const isCurrent = loadedDocId ? String(doc.id) === loadedDocId : doc.is_master;
                          return (
                            <button
                              key={doc.id}
                              onClick={async () => {
                                try {
                                  await cloud.loadCloudDoc(doc.id);
                                  setLoadedDocId(String(doc.id));
                                  setLoadMenuOpen(false);
                                } catch {
                                  // cloudError is already set by the hook; keep menu open so it's visible
                                }
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg flex flex-col gap-0.5 ${isCurrent ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : "hover:bg-gray-50"
                                }`}
                            >
                              <span className="text-sm text-gray-800 flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{doc.title || "Untitled Workflow"}</span>
                                {doc.is_master && (
                                  <span className="shrink-0 text-[10px] font-medium text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                                    master
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="shrink-0 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    current
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {doc.person_name ? `${doc.person_name} · ` : ""}
                                {new Date(doc.updated_at).toLocaleString()}
                              </span>
                            </button>
                          );
                        })}
                    </div>,
                    document.body
                  )}
              </div>

              <button
                onClick={() => {
                  if (autosave.enabled) {
                    autosave.disable();
                  } else {
                    setAutosavePromptOpen(true);
                  }
                }}
                title={
                  autosave.enabled
                    ? autosave.lastSavedAt
                      ? `Autosaving — last saved ${autosave.lastSavedAt.toLocaleTimeString()}`
                      : "Autosave on — waiting for first save"
                    : "Autosave every 5 minutes to the server"
                }
                className={`${btnBase} h-8 px-2 text-[11px] shrink-0 sm:h-9 sm:px-2.5 sm:text-xs ${autosave.enabled
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                {autosave.enabled ? "Auto: On" : "Autosave"}
              </button>

              <button
                onClick={() => editor.setShowAddModal(true)}
                title="Add a new process node"
                className={`${btnBase} h-8 px-2.5 text-xs shrink-0 sm:h-9 sm:px-3 sm:text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
              >
                + Add
              </button>

              <button
                onClick={() => editor.setShowPersonManager(true)}
                title="Manage people"
                className={`${btnGhost} w-8 h-8 shrink-0 sm:w-9 sm:h-9`}
              >
                <IconUsers />
              </button>

              <div className="w-px h-6 bg-gray-200 mx-0.5 shrink-0" />

              <ExportButtons printRef={printRef} setError={editor.setError} />
            </div>
          </div>

          {canScrollLeft && (
            <button
              onClick={() => scrollToolbar("left")}
              className="sm:hidden absolute left-0 top-0 bottom-0 flex items-center pl-1 pr-3 rounded-l-2xl bg-gradient-to-r from-white via-white/90 to-transparent text-gray-500"
              aria-label="Scroll toolbar left"
            >
              <IconChevronLeft />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scrollToolbar("right")}
              className="sm:hidden absolute right-0 top-0 bottom-0 flex items-center pr-1 pl-3 rounded-r-2xl bg-gradient-to-l from-white via-white/90 to-transparent text-gray-500"
              aria-label="Scroll toolbar right"
            >
              <IconChevronRight />
            </button>
          )}
        </div>
      </div>

      {/* CANVAS BOX */}
      <main
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-gray-50 rounded-2xl"
        style={{ userSelect: dragging ? "none" : "auto" }}
      >
        {/* ACTION POPUP */}
        {(editor.selectedNodeId || editor.selectedEdge) && !editor.pendingRelation && !moveParentMode && (
          <div
            data-action-popup
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-1.5 bg-white/95 backdrop-blur border border-gray-200/70 rounded-xl p-2 shadow-[0_4px_20px_rgba(15,23,42,0.1)] pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto"
          >
            <button
              onClick={editor.clearSelection}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold shrink-0"
              title="Dismiss"
            >
              ✕
            </button>

            {editor.selectedNodeId && rootNode && (
              <>
                <span className="text-sm font-medium text-gray-800 px-1">
                  {findNodeById(rootNode, editor.selectedNodeId)?.label ?? "Selected"}
                </span>
                <button
                  onClick={() =>
                    editor.openEditor(editor.selectedNodeId!, "label", findNodeById(rootNode, editor.selectedNodeId!)?.label ?? "")
                  }
                  className={`${btnGhost} h-7 px-2 text-xs`}
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
                  className={`${btnGhost} h-7 px-2 text-xs`}
                >
                  Edit Description
                </button>

                <button
                  onClick={() => editor.setPendingRelation({ fromId: editor.selectedNodeId!, mode: "successor" })}
                  className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-colors"
                >
                  + Successor
                </button>
                <button
                  onClick={() => editor.setPendingRelation({ fromId: editor.selectedNodeId!, mode: "predecessor" })}
                  className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs hover:bg-emerald-100 transition-colors"
                >
                  + Predecessor
                </button>

                {editor.selectedNodeId !== "root" && (
                  <>
                    {/* ─── ORDER CHANGE TOOLS ─── */}
                    <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg px-1 py-0.5">
                      <button
                        onClick={() => editor.moveNodeUp(editor.selectedNodeId!)}
                        disabled={!getNodeParentAndIndex(editor.selectedNodeId!) || getNodeParentAndIndex(editor.selectedNodeId!)!.index === 0}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up among siblings"
                      >
                        <IconArrowUp />
                      </button>
                      <button
                        onClick={() => editor.moveNodeDown(editor.selectedNodeId!)}
                        disabled={
                          !getNodeParentAndIndex(editor.selectedNodeId!) ||
                          getNodeParentAndIndex(editor.selectedNodeId!)!.index >=
                          (getNodeParentAndIndex(editor.selectedNodeId!)!.parent?.children?.length ?? 0) - 1
                        }
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down among siblings"
                      >
                        <IconArrowDown />
                      </button>
                    </div>

                    {/* ─── MOVE TO PARENT TOOL ─── */}
                    <button
                      onClick={() => setMoveParentMode(editor.selectedNodeId!)}
                      className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs hover:bg-violet-100 transition-colors"
                      title="Move this process under a different parent"
                    >
                      Move To…
                    </button>

                    <button
                      onClick={() => editor.openAssignPopup(editor.selectedNodeId!)}
                      className="px-2 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs hover:bg-teal-100 transition-colors"
                      title="Assign or remove people for this process"
                    >
                      Assign People
                    </button>
                    <button
                      onClick={() => editor.duplicateNode(editor.selectedNodeId!)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs hover:bg-indigo-100 transition-colors"
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
                      className={`${btnDanger} h-7 px-2 text-xs`}
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
                      className="px-1.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs hover:bg-red-100 transition-colors"
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
                      className="px-1.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs hover:bg-red-100 transition-colors"
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
                <button onClick={() => editor.deleteRelation(editor.selectedEdge!)} className={`${btnDanger} h-7 px-2 text-xs`}>
                  Delete
                </button>
                <button
                  onClick={editor.reverseRelation}
                  className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs hover:bg-purple-100 transition-colors"
                >
                  Reverse
                </button>
                <button onClick={editor.toggleEdgeDashed} className={`${btnGhost} h-7 px-2 text-xs`}>
                  Toggle Dashed
                </button>
              </>
            )}
          </div>
        )}

        {/* MOVE-TO-PARENT MODE POPUP */}
        {moveParentMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-white/95 backdrop-blur border border-gray-200/70 rounded-xl p-2 shadow-[0_4px_20px_rgba(15,23,42,0.1)] pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto">
            <span className="text-sm font-medium text-violet-700 px-1">
              Click the new parent node for “{moveParentLabel ?? "this process"}”…
            </span>
            <button onClick={() => setMoveParentMode(null)} className={`${btnGhost} h-7 px-2 text-xs`}>
              Cancel
            </button>
          </div>
        )}

        {/* PENDING RELATION POPUP */}
        {editor.pendingRelation && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 bg-white/95 backdrop-blur border border-gray-200/70 rounded-xl p-2 shadow-[0_4px_20px_rgba(15,23,42,0.1)] pointer-events-auto no-print flex-wrap max-w-[95vw] overflow-x-auto">
            <span className="text-sm font-medium text-amber-700 px-1">
              Select target {editor.pendingRelation.mode === "successor" ? "successor" : "predecessor"}...
            </span>
            <button onClick={() => editor.setPendingRelation(null)} className={`${btnGhost} h-7 px-2 text-xs`}>
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
            if (moveParentMode) {
              setMoveParentMode(null);
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[110] bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 text-sm shadow-md no-print max-w-[90vw] sm:max-w-md">
              <div className="flex items-start gap-2">
                <span className="flex-1">{editor.error}</span>
              </div>
              {editor.invalidUpload && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={editor.downloadInvalidUpload}
                    className="shrink-0 text-xs font-medium bg-white border border-red-200 text-red-700 rounded-lg px-2.5 py-1 hover:bg-red-100 transition-colors"
                    title="Download a correctly formatted sample file"
                  >
                    Download sample template
                  </button>
                </div>
              )}
            </div>
          )}

          {editor.warning && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[110] bg-amber-50 text-amber-700 border border-amber-200 rounded-xl px-4 py-2 text-sm shadow-md max-w-md text-center no-print">
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
                persons={editor.persons}
                onOpenAssignPopup={editor.openAssignPopup}
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
      </main>

      {/* EDIT MODAL */}
      {editor.editingNodeId && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print" onClick={editor.closeEditor}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">
              Edit {editor.editingField === "label" ? "Title" : "Description"}
            </h3>
            {editor.editingField === "label" ? (
              <input
                autoFocus
                type="text"
                value={editor.editingValue}
                onChange={(e) => editor.setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") editor.submitEditor();
                }}
                className={`${inputBase} mb-4`}
                placeholder="Enter title"
              />
            ) : (
              <textarea
                autoFocus
                value={editor.editingValue}
                onChange={(e) => editor.setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    editor.submitEditor();
                  }
                }}
                rows={5}
                className={`${inputBase} mb-4 resize-vertical`}
                placeholder="Enter description"
              />
            )}
            <div className="flex justify-end gap-2">
              <button onClick={editor.closeEditor} className={`${btnOutline} h-10 px-4 text-sm`}>Cancel</button>
              <button onClick={editor.submitEditor} className={`${btnPrimary} h-10 px-4 text-sm`}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PROCESS MODAL */}
      {editor.showAddModal && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={() => {
            editor.setShowAddModal(false);
            editor.setAddError("");
          }}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">Add New Process</h3>

            {editor.addError && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">
                {editor.addError}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={editor.newProcess.label}
                onChange={(e) => editor.setNewProcess({ ...editor.newProcess, label: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") editor.handleAddProcess();
                }}
                className={inputBase}
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
                className={`${inputBase} resize-vertical`}
                placeholder="Brief description of the process"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position (order)
              </label>
              <div className="text-xs text-gray-500 mb-1.5">
                Parent: <strong className="text-gray-700">{editor.getParentInfo().parentLabel}</strong> &nbsp;|&nbsp; Current siblings: {editor.getParentInfo().childCount}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") editor.handleAddProcess();
                }}
                className={inputBase}
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
                className={`${btnOutline} h-10 px-4 text-sm`}
              >
                Cancel
              </button>
              <button onClick={editor.handleAddProcess} className={`${btnPrimary} h-10 px-4 text-sm`}>
                Add Process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERSON MANAGER MODAL */}
      {editor.showPersonManager && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={() => {
            cancelRenamePerson();
            editor.setShowPersonManager(false);
          }}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">People</h3>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={editor.newPersonName}
                onChange={(e) => editor.setNewPersonName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") editor.addPerson();
                }}
                placeholder="Add a person's name"
                className={`${inputBase} flex-1`}
                autoFocus
              />
              <button onClick={editor.addPerson} className={`${btnPrimary} h-10 px-4 text-sm shrink-0`}>
                Add
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
              {editor.persons.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-6">No people yet.</div>
              )}
              {editor.persons.map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50">
                  {editingPersonId === person.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingPersonName}
                      onChange={(e) => setEditingPersonName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRenamePerson();
                        if (e.key === "Escape") cancelRenamePerson();
                      }}
                      onBlur={commitRenamePerson}
                      className="flex-1 min-w-0 text-sm text-gray-800 bg-white border border-indigo-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRenamePerson(person.id, person.name)}
                      className="flex-1 min-w-0 text-left text-sm text-gray-700 hover:text-indigo-700 truncate"
                      title="Click to rename"
                    >
                      {person.name}
                    </button>
                  )}

                  {/* ─── NEW: Filter tasks button ─── */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = filterPersonId === person.id ? null : person.id;
                      setFilterPersonId(next);
                      setExpandedTaskIds(new Set()); // reset expanded rows when switching filter
                    }}
                    className={`shrink-0 text-xs font-medium px-2 py-1 rounded-md transition-colors ${filterPersonId === person.id
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-500 hover:bg-gray-100"
                      }`}
                    title="Filter tasks assigned to this person"
                  >
                    Tasks
                  </button>

                  <button
                    onClick={() => {
                      if (filterPersonId === person.id) {
                        setFilterPersonId(null);
                        setExpandedTaskIds(new Set());
                      }
                      editor.deletePerson(person.id);
                    }}
                    className="shrink-0 text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* ─── NEW: Filtered task list for selected person ─── */}
            {filterPersonId && (
              <div className="mt-4 border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800">
                    Tasks assigned to {editor.persons.find((p) => p.id === filterPersonId)?.name ?? "person"}
                  </h4>
                  <button
                    onClick={() => setFilterPersonId(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>

                {(() => {
                  const tasks = getPersonTasks(filterPersonId);
                  const completedCount = tasks.filter((t) => isNodeFullyComplete(t)).length;
                  const totalCount = tasks.length;

                  return (
                    <>
                      {/* Summary line */}
                      <div className="mb-3 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-3 py-1.5">
                        {completedCount} / {totalCount} task{totalCount === 1 ? "" : "s"} completed
                      </div>

                      {totalCount === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-4">No tasks assigned.</div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                          {tasks.map((task) => {
                            const isComplete = isNodeFullyComplete(task);
                            const isExpanded = expandedTaskIds.has(task.id);

                            return (
                              <div
                                key={task.id}
                                className={`rounded-lg bg-gray-50 border ${isComplete ? "border-emerald-200" : "border-gray-100"
                                  }`}
                              >
                                <div className="flex items-center justify-between px-2.5 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedTaskIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(task.id)) next.delete(task.id);
                                        else next.add(task.id);
                                        return next;
                                      });
                                    }}
                                    className="flex-1 min-w-0 text-left text-sm text-gray-700 hover:text-indigo-700 flex items-center gap-1.5"
                                  >
                                    {/* Completion indicator */}
                                    <span
                                      className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${isComplete
                                          ? "bg-emerald-500 text-white"
                                          : "bg-gray-200 text-gray-400"
                                        }`}
                                      title={isComplete ? "Completed" : "Not completed"}
                                    >
                                      {isComplete ? "✓" : "○"}
                                    </span>

                                    {/* Expand arrow */}
                                    <span className="text-xs text-gray-400">
                                      {isExpanded ? "▾" : "▸"}
                                    </span>

                                    <span className="truncate">{task.label}</span>
                                  </button>
                                </div>

                                {isExpanded && task.description && (
                                  <div className="px-2.5 pb-2 pt-0.5 text-xs text-gray-500 whitespace-pre-wrap">
                                    {task.description}
                                  </div>
                                )}
                                {isExpanded && !task.description && (
                                  <div className="px-2.5 pb-2 pt-0.5 text-xs text-gray-400 italic">
                                    No description
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  cancelRenamePerson();
                  editor.setShowPersonManager(false);
                }}
                className={`${btnOutline} h-10 px-4 text-sm`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN PEOPLE TO NODE POPUP */}
      {editor.assignPopupNodeId && rootNode && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={editor.closeAssignPopup}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-semibold mb-1 text-gray-900">Assign people</h3>
            <p className="text-xs text-gray-500 mb-4">
              {findNodeById(rootNode, editor.assignPopupNodeId)?.label ?? "This process"} — subprocesses are assigned separately.
            </p>

            {editor.persons.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">
                No people yet. Add some from the people button in the toolbar.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
                {editor.persons.map((person) => {
                  const node = findNodeById(rootNode, editor.assignPopupNodeId!);
                  const isAssigned = node?.assignedPersonIds?.includes(person.id) ?? false;
                  return (
                    <button
                      key={person.id}
                      onClick={() => editor.toggleNodeAssignment(editor.assignPopupNodeId!, person.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${isAssigned ? "bg-indigo-50 text-indigo-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      <span>{person.name}</span>
                      {isAssigned && <span className="text-xs">✓ assigned</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={editor.closeAssignPopup} className={`${btnOutline} h-10 px-4 text-sm`}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE DIALOG */}
      {saveModalOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={() => setSaveModalOpen(false)}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">Save Workflow</h3>

            <div className="mb-4 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              Saving into group <strong>{displayGroup}</strong>. A document can only belong to one group at a time — saving here moves it into this group.
            </div>

            <div className="flex gap-2 mb-4 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setSaveMode("local")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${saveMode === "local" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                My device
              </button>
              <button
                onClick={() => setSaveMode("server")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${saveMode === "server" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                Server
              </button>
            </div>

            {saveMode === "local" && (
              <p className="text-sm text-gray-500 mb-4">
                Downloads a <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">process.json</code> file to your computer.
              </p>
            )}

            {saveMode === "server" && (
              <>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your passphrase *</label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmSave();
                    }}
                    className={inputBase}
                    placeholder="Only you should know this"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Don&apos;t have one? Ask your admin to set one up for you.
                  </p>
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title - edit title in the workflow to save</label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirmSave();
                    }}
                    className={inputBase}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdminMaster((v) => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 mb-4"
                >
                  {showAdminMaster ? "Hide admin options" : "Admin options"}
                </button>

                {showAdminMaster && (
                  <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={wantMaster}
                        onChange={(e) => setWantMaster(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Set as the default workflow for group &quot;{displayGroup}&quot;
                    </label>
                    {wantMaster && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          This group&apos;s master key
                        </label>
                        <input
                          type="password"
                          value={masterKeyInput}
                          onChange={(e) => setMasterKeyInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirmSave();
                          }}
                          className={inputBase}
                          placeholder="Required to change the master workflow"
                        />
                      </div>
                    )}
                  </div>
                )}

                {saveFormError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{saveFormError}</div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setSaveModalOpen(false)} className={`${btnOutline} h-10 px-4 text-sm`}>
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saveBusy}
                className={`${btnPrimary} h-10 px-4 text-sm`}
              >
                {saveBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOSAVE PASSPHRASE PROMPT */}
      {autosavePromptOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={() => setAutosavePromptOpen(false)}
        >
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-sm mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900">Enable Autosave</h3>
            <p className="text-sm text-gray-500 mb-4">
              Saves to the server automatically every 5 minutes under this passphrase — no further prompts.
            </p>
            <input
              type="password"
              value={autosavePassphraseInput}
              onChange={(e) => setAutosavePassphraseInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnableAutosave();
              }}
              className={`${inputBase} mb-2`}
              placeholder="Your passphrase"
              autoFocus
            />
            {autosave.verifyError && (
              <div className="mb-2 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{autosave.verifyError}</div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setAutosavePromptOpen(false)} className={`${btnOutline} h-10 px-4 text-sm`}>
                Cancel
              </button>
              <button
                onClick={handleEnableAutosave}
                disabled={autosave.verifying}
                className={`${btnPrimary} h-10 px-4 text-sm`}
              >
                {autosave.verifying ? "Checking…" : "Enable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}