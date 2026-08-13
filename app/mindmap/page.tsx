"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  OnSelectionChangeParams,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./mindmap.css";

import Toolbar from "./Toolbar";
import EditPanel from "./EditPanel";
import CustomNode from "./CustomNode";
import {
  computeTreeLayout,
  DEPTH_COLORS,
  downloadJson,
  EDGE_TYPE,
  flowToJson,
  jsonToFlow,
  newNodeId,
  runForceLayout,
  slugify,
} from "./Utils";
import { FileSystemFileHandleLike, MindMapJson, MindMapNodeData } from "./types";

// Defined outside the component so React Flow gets a stable reference.
const nodeTypes = { mindmapNode: CustomNode };

const EMPTY_JSON: MindMapJson = { title: "Untitled mind map", stages: [], relationships: [] };

function MindMapEditor() {
  const [title, setTitle] = useState(EMPTY_JSON.title);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MindMapNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandleLike | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const stopForceRef = useRef<(() => void) | null>(null);
  const { fitView } = useReactFlow();

  // Cancel any running force simulation on unmount so it doesn't keep
  // ticking (and calling setNodes) after the editor is gone.
  useEffect(() => () => stopForceRef.current?.(), []);

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<MindMapNodeData>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes]
  );

  const onRename = useCallback((id: string, label: string) => handleUpdateNode(id, { label }), [handleUpdateNode]);

  const applyJson = useCallback(
    (json: MindMapJson) => {
      const { nodes: newNodes, edges: newEdges } = jsonToFlow(json, onRename);
      setNodes(newNodes);
      setEdges(newEdges);
      setTitle(json.title || "Untitled mind map");
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    },
    [onRename, setNodes, setEdges, fitView]
  );

  const handleFileSelected = useCallback(
    async (file: File, handle?: FileSystemFileHandleLike) => {
      const text = await file.text();
      try {
        const json = JSON.parse(text) as MindMapJson;
        applyJson(json);
        setFileHandle(handle ?? null);
        setFileName(file.name);
      } catch {
        alert("That file isn't valid JSON — nothing was changed.");
      }
    },
    [applyJson]
  );

  const handleSave = useCallback(async () => {
    const json = flowToJson(title, nodes, edges);
    const text = JSON.stringify(json, null, 2);

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        return;
      } catch {
        // fall through to download
      }
    }
    downloadJson(text, fileName || `${slugify(title)}.json`);
  }, [title, nodes, edges, fileHandle, fileName]);

  const handleExport = useCallback(async () => {
    const json = flowToJson(title, nodes, edges);
    const text = JSON.stringify(json, null, 2);

    if (typeof window !== "undefined" && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${slugify(title)}.json`,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        return;
      } catch {
        // user cancelled — fall through to a plain download
      }
    }
    downloadJson(text, `${slugify(title)}.json`);
  }, [title, nodes, edges]);

  const createNode = useCallback(
    (parentId: string | null, position: { x: number; y: number }): Node<MindMapNodeData> => ({
      id: newNodeId(),
      type: "mindmapNode",
      position,
      data: {
        label: "New box",
        color: DEPTH_COLORS[0],
        textColor: "#ffffff",
        fontSize: 13,
        depth: 0,
        parentId,
        onRename,
      },
    }),
    [onRename]
  );

  const handleAddNode = useCallback(() => {
    setNodes((nds) => [...nds, createNode(null, { x: 80 + (nds.length % 6) * 40, y: 80 + (nds.length % 6) * 30 })]);
  }, [createNode, setNodes]);

  const handleAddChild = useCallback(
    (parentId: string) => {
      setNodes((nds) => {
        const parent = nds.find((n) => n.id === parentId);
        const pos = parent ? { x: parent.position.x + 60, y: parent.position.y + 90 } : { x: 100, y: 100 };
        return [...nds, createNode(parentId, pos)];
      });
    },
    [createNode, setNodes]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => {
        const toRemove = new Set<string>([id]);
        let changed = true;
        while (changed) {
          changed = false;
          nds.forEach((n) => {
            if (n.data.parentId && toRemove.has(n.data.parentId) && !toRemove.has(n.id)) {
              toRemove.add(n.id);
              changed = true;
            }
          });
        }
        setEdges((eds) => eds.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target)));
        return nds.filter((n) => !toRemove.has(n.id));
      });
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  const handleUpdateEdge = useCallback(
    (id: string, patch: { color?: string; strokeWidth?: number; direction?: string; label?: string }) => {
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          const direction = patch.direction ?? (e.data?.direction as string) ?? "forward";
          const color = patch.color ?? (e.style?.stroke as string) ?? "#94a3b8";
          const strokeWidth = patch.strokeWidth ?? (e.style?.strokeWidth as number) ?? 1.6;
          const label = patch.label ?? e.label;
          return {
            ...e,
            label,
            data: { ...e.data, direction, relType: e.data?.relType || "related" },
            style: { stroke: color, strokeWidth, strokeDasharray: direction === "backward" ? "6 4" : undefined },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
            markerStart:
              direction === "bidirectional"
                ? { type: MarkerType.ArrowClosed, color, width: 18, height: 18 }
                : undefined,
          };
        })
      );
    },
    [setEdges]
  );

  const handleDeleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelectedEdgeId(null);
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: EDGE_TYPE,
            label: "related",
            style: { stroke: "#94a3b8", strokeWidth: 1.6 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 18, height: 18 },
            data: { direction: "forward", relType: "related" },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
    const nodeId = selNodes[0]?.id ?? null;
    const edgeId = selEdges[0]?.id ?? null;
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(edgeId);
    if (nodeId || edgeId) setPanelOpen(true);
  }, []);

  // Backspace/Delete removes the current selection, with cascade for child boxes.
  // Ignored while typing in an input/select so it never fights with text editing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (selectedNodeId) handleDeleteNode(selectedNodeId);
      else if (selectedEdgeId) handleDeleteEdge(selectedEdgeId);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNodeId, selectedEdgeId, handleDeleteNode, handleDeleteEdge]);

  // Hierarchical, deterministic pass: columns by depth, siblings grouped
  // under their parent. Good for reading a process top-to-bottom.
  const handleLayoutTree = useCallback(() => {
    stopForceRef.current?.();
    setLayoutBusy(false);
    setNodes((nds) => computeTreeLayout(nds));
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [setNodes, fitView]);

  // Obsidian-style organic layout: boxes repel each other, connectors pull
  // like springs, and the whole graph drifts and settles on its own.
  const handleLayoutForce = useCallback(() => {
    stopForceRef.current?.();
    setLayoutBusy(true);
    const stop = runForceLayout(
      nodes,
      edges,
      (positions) => {
        setNodes((nds) => nds.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n)));
      },
      () => {
        setLayoutBusy(false);
        stopForceRef.current = null;
        setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 50);
      }
    );
    stopForceRef.current = stop;
  }, [nodes, edges, setNodes, fitView]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) || null;

  return (
    <div className="mindmap-page">
      <Toolbar
        title={title}
        onTitleChange={setTitle}
        onFileSelected={handleFileSelected}
        onSave={handleSave}
        onExport={handleExport}
        onAddNode={handleAddNode}
        hasFileHandle={!!fileHandle}
        fileName={fileName}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onLayoutTree={handleLayoutTree}
        onLayoutForce={handleLayoutForce}
        layoutBusy={layoutBusy}
      />

      <div className="mm-body">
        <div className="mm-canvas-wrap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            deleteKeyCode={null}
            fitView
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="#d7dbe3" />
            <Controls className="mm-controls" showInteractive={false} />

            <button
              type="button"
              className="mm-minimap-toggle"
              data-open={minimapOpen}
              onClick={() => setMinimapOpen((v) => !v)}
              aria-label={minimapOpen ? "Minimize thumbnail view" : "Show thumbnail view"}
            >
              {minimapOpen ? "–" : "▢"}
            </button>
            {minimapOpen && (
              <MiniMap
                className="mm-minimap"
                pannable
                zoomable
                nodeColor={(n) => (n.data as MindMapNodeData).color}
              />
            )}
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="mm-empty-hint">
              <p>Import a JSON file to load a mind map,</p>
              <p>or press “+ Node” to start one from scratch.</p>
            </div>
          )}
        </div>

        <EditPanel
          node={selectedNode}
          edge={selectedEdge}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onAddChild={handleAddChild}
          onUpdateEdge={handleUpdateEdge}
          onDeleteEdge={handleDeleteEdge}
        />
      </div>
    </div>
  );
}

export default function MindMapPage() {
  return (
    <ReactFlowProvider>
      <MindMapEditor />
    </ReactFlowProvider>
  );
}
