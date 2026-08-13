"use client";

import { ProcessNode } from "@/app/process/lib/process-utils";

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Edge = { from: string; to: string };

export type EdgeStyle = {
  dashed?: boolean;
};

type RelationshipArrowsProps = {
  rootNode: ProcessNode;
  positions: Map<string, NodeRect>;
  selectedNodeId: string | null;
  selectedEdge: Edge | null;
  onSelectEdge: (edge: Edge | null) => void;
  edgeStyles?: Map<string, EdgeStyle>;
};

export function RelationshipArrows({
  rootNode,
  positions,
  selectedNodeId,
  selectedEdge,
  onSelectEdge,
  edgeStyles = new Map(),
}: RelationshipArrowsProps) {
  const edges: Edge[] = [];
  const traverse = (node: ProcessNode) => {
    (node.successors ?? []).forEach((succId) => {
      edges.push({ from: node.id, to: succId });
    });
    (node.children ?? []).forEach(traverse);
  };
  traverse(rootNode);

  const getAnchorPoint = (
    rect: NodeRect,
    externalPoint: { x: number; y: number }
  ): { x: number; y: number; side: "left" | "right" | "top" | "bottom" } => {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const dx = externalPoint.x - centerX;
    const dy = externalPoint.y - centerY;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      return { x: centerX, y: centerY, side: "right" };
    }

    const tLeft = dx !== 0 ? (rect.x - centerX) / dx : -Infinity;
    const tRight = dx !== 0 ? (rect.x + rect.width - centerX) / dx : -Infinity;
    const tTop = dy !== 0 ? (rect.y - centerY) / dy : -Infinity;
    const tBottom = dy !== 0 ? (rect.y + rect.height - centerY) / dy : -Infinity;

    let bestT = Infinity;
    let side: "left" | "right" | "top" | "bottom" = "right";
    let bestPoint = { x: centerX, y: centerY };

    const check = (
      t: number,
      candidateSide: typeof side,
      point: { x: number; y: number }
    ) => {
      if (
        t > 0 &&
        t < bestT &&
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
      ) {
        bestT = t;
        side = candidateSide;
        bestPoint = point;
      }
    };

    if (tLeft !== -Infinity) check(tLeft, "left", { x: rect.x, y: centerY + tLeft * dy });
    if (tRight !== -Infinity) check(tRight, "right", { x: rect.x + rect.width, y: centerY + tRight * dy });
    if (tTop !== -Infinity) check(tTop, "top", { x: centerX + tTop * dx, y: rect.y });
    if (tBottom !== -Infinity) check(tBottom, "bottom", { x: centerX + tBottom * dx, y: rect.y + rect.height });

    return { ...bestPoint, side };
  };

  const buildBezierPath = (
    source: { x: number; y: number },
    target: { x: number; y: number }
  ) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.hypot(dx, dy) || 1;

    const nx = -dy / dist;
    const ny = dx / dist;

    const offset = Math.min(dist * 0.4, 80);

    const cp1 = {
      x: source.x + dx * 0.25 + nx * offset,
      y: source.y + dy * 0.25 + ny * offset,
    };
    const cp2 = {
      x: source.x + dx * 0.75 + nx * offset,
      y: source.y + dy * 0.75 + ny * offset,
    };

    return `M ${source.x} ${source.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${target.x} ${target.y}`;
  };

  const isHighlightedByNode = (edge: Edge) =>
    selectedNodeId !== null &&
    (edge.from === selectedNodeId || edge.to === selectedNodeId);

  const isEdgeSelected = (edge: Edge) =>
    selectedEdge !== null &&
    edge.from === selectedEdge.from &&
    edge.to === selectedEdge.to;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        overflow: "visible",
      }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
        </marker>
        <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
        </marker>
        <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
        </marker>
      </defs>

      {edges.map((edge, idx) => {
        const sourceRect = positions.get(edge.from);
        const targetRect = positions.get(edge.to);
        if (!sourceRect || !targetRect) return null;

        const sourceCenter = {
          x: sourceRect.x + sourceRect.width / 2,
          y: sourceRect.y + sourceRect.height / 2,
        };
        const targetCenter = {
          x: targetRect.x + targetRect.width / 2,
          y: targetRect.y + targetRect.height / 2,
        };

        const sourceAnchor = getAnchorPoint(sourceRect, targetCenter);
        const targetAnchor = getAnchorPoint(targetRect, sourceCenter);

        const d = buildBezierPath(sourceAnchor, targetAnchor);
        const nodeHighlight = isHighlightedByNode(edge);
        const edgeSelected = isEdgeSelected(edge);

        const edgeKey = `${edge.from}->${edge.to}`;
        const style = edgeStyles.get(edgeKey) || {};
        const isDashed = style.dashed === true;

        let stroke = "#64748b";
        let strokeWidth = 2;
        let marker = "url(#arrowhead)";
        let outlineStroke = "#ffffff";
        let outlineWidth = 3.5;

        if (edgeSelected) {
          stroke = "#f59e0b";
          strokeWidth = 3;
          marker = "url(#arrowhead-selected)";
          outlineStroke = "#fff";
          outlineWidth = 4.5;
        } else if (nodeHighlight) {
          stroke = "#3b82f6";
          strokeWidth = 2.5;
          marker = "url(#arrowhead-highlight)";
          outlineStroke = "#fff";
          outlineWidth = 4;
        }

        return (
          <g key={`${edge.from}-${edge.to}-${idx}`}>
            {/* Outline for contrast */}
            <path
              d={d}
              fill="none"
              stroke={outlineStroke}
              strokeWidth={outlineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            {/* Main arrow */}
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={marker}
              strokeDasharray={isDashed ? "6 4" : undefined}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edgeSelected ? null : edge);
              }}
            />
            {/* Anchor dots */}
            <circle
              cx={sourceAnchor.x}
              cy={sourceAnchor.y}
              r={2.5}
              fill={edgeSelected ? "#f59e0b" : nodeHighlight ? "#3b82f6" : "#64748b"}
              stroke="#fff"
              strokeWidth={1}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edgeSelected ? null : edge);
              }}
            />
            <circle
              cx={targetAnchor.x}
              cy={targetAnchor.y}
              r={2.5}
              fill={edgeSelected ? "#f59e0b" : nodeHighlight ? "#3b82f6" : "#64748b"}
              stroke="#fff"
              strokeWidth={1}
              style={{ pointerEvents: "all", cursor: "pointer" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edgeSelected ? null : edge);
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}