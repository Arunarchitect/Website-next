"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  useInternalNode,
  useReactFlow,
} from "@xyflow/react";
import { MindMapEdgeData } from "./types";

// Find where a line from center to target crosses the bounding box of a node
function getBoxIntersection(
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const dx = targetX - nodeX;
  const dy = targetY - nodeY;
  
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: nodeX, y: nodeY };
  }

  const halfW = nodeWidth / 2;
  const halfH = nodeHeight / 2;
  
  let t = Infinity;
  
  // Check all four edges
  if (dx > 0) {
    const tRight = halfW / dx;
    const yRight = nodeY + dy * tRight;
    if (yRight >= nodeY - halfH && yRight <= nodeY + halfH) {
      t = Math.min(t, tRight);
    }
  }
  
  if (dx < 0) {
    const tLeft = -halfW / dx;
    const yLeft = nodeY + dy * tLeft;
    if (yLeft >= nodeY - halfH && yLeft <= nodeY + halfH) {
      t = Math.min(t, tLeft);
    }
  }
  
  if (dy > 0) {
    const tBottom = halfH / dy;
    const xBottom = nodeX + dx * tBottom;
    if (xBottom >= nodeX - halfW && xBottom <= nodeX + halfW) {
      t = Math.min(t, tBottom);
    }
  }
  
  if (dy < 0) {
    const tTop = -halfH / dy;
    const xTop = nodeX + dx * tTop;
    if (xTop >= nodeX - halfW && xTop <= nodeX + halfW) {
      t = Math.min(t, tTop);
    }
  }
  
  if (t === Infinity) {
    const radius = Math.min(halfW, halfH);
    const scale = radius / Math.sqrt(dx * dx + dy * dy);
    return {
      x: nodeX + dx * scale,
      y: nodeY + dy * scale,
    };
  }
  
  return {
    x: nodeX + dx * t,
    y: nodeY + dy * t,
  };
}

// Get the actual attachment point on a node's boundary
function getNodeAttachmentPoint(
  node: any,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  if (!node) return { x: 0, y: 0 };
  
  const pos = node.internals?.positionAbsolute || node.position;
  const width = node.measured?.width || node.width || 100;
  const height = node.measured?.height || node.height || 100;
  
  const centerX = pos.x + width / 2;
  const centerY = pos.y + height / 2;
  
  return getBoxIntersection(centerX, centerY, width, height, targetX, targetY);
}

export default function FloatingEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  style,
  markerEnd,
  markerStart,
  data,
}: EdgeProps<MindMapEdgeData>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const { setEdges } = useReactFlow();

  // Calculate attachment points on the node boundaries
  const sourcePoint = getNodeAttachmentPoint(sourceNode, targetX, targetY);
  const targetPoint = getNodeAttachmentPoint(targetNode, sourceX, sourceY);

  // Use fan angles if available
  const sourceAngle = (data as any)?.sourceAngle ?? 0;
  const targetAngle = (data as any)?.targetAngle ?? Math.PI;

  // Apply angular offsets for fanning
  const offsetX1 = Math.cos(sourceAngle) * 4;
  const offsetY1 = Math.sin(sourceAngle) * 4;
  const offsetX2 = Math.cos(targetAngle) * 4;
  const offsetY2 = Math.sin(targetAngle) * 4;

  // Calculate curvature based on relative positions
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(0.4, 0.15 + distance / 2000);

  // Generate the bezier path
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sourcePoint.x + offsetX1,
    sourceY: sourcePoint.y + offsetY1,
    sourcePosition: undefined,
    targetX: targetPoint.x + offsetX2,
    targetY: targetPoint.y + offsetY2,
    targetPosition: undefined,
    curvature,
  });

  const showLabel = label && typeof label === "string" && label.trim().length > 0;

  // Handle undock (delete edge)
  const handleUndock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove this connection?")) {
      setEdges((edges) => edges.filter((edge) => edge.id !== id));
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      
      {/* Edge label with undock button */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: "rgba(255,255,255,0.92)",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: "500",
            color: "#1e293b",
            border: "1px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            pointerEvents: "all",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            userSelect: "none",
            whiteSpace: "nowrap",
            backdropFilter: "blur(4px)",
          }}
          className="mm-edge-chip"
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
          }}
        >
          <span>{label || "related"}</span>
          
          {/* Direction cycle button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data?.onCycleDirection?.(id);
            }}
            style={{
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              fontSize: "12px",
              color: "#64748b",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
            title="Cycle direction"
          >
            ⟳
          </button>
          
          {/* Style cycle button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data?.onCycleStyle?.(id);
            }}
            style={{
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              fontSize: "12px",
              color: "#64748b",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
            title="Cycle line style"
          >
            ⚡
          </button>
          
          {/* Undock/Delete button */}
          <button
            type="button"
            onClick={handleUndock}
            style={{
              background: "none",
              border: "none",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: "12px",
              color: "#ef4444",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fef2f2";
              e.currentTarget.style.color = "#dc2626";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "#ef4444";
            }}
            title="Remove connection"
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}