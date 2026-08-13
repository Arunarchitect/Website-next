"use client";

import { ProcessNode } from "@/app/process/lib/process-utils";

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RelationshipArrowsProps = {
  rootNode: ProcessNode;
  positions: Map<string, NodeRect>;
  selectedNodeId: string | null;
};

export function RelationshipArrows({
  rootNode,
  positions,
  selectedNodeId,
}: RelationshipArrowsProps) {
  // Collect all edges from `successors`
  const edges: { from: string; to: string }[] = [];
  const traverse = (node: ProcessNode) => {
    (node.successors ?? []).forEach((succId) => {
      edges.push({ from: node.id, to: succId });
    });
    (node.children ?? []).forEach(traverse);
  };
  traverse(rootNode);

  /**
   * Find the intersection point of the line from a rectangle's centre
   * to an external point with the rectangle's border.
   * Returns the point on the edge closest to the external point.
   */
  const getAnchorPoint = (
    rect: NodeRect,
    externalPoint: { x: number; y: number }
  ): { x: number; y: number; side: "left" | "right" | "top" | "bottom" } => {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    const dx = externalPoint.x - centerX;
    const dy = externalPoint.y - centerY;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      // Same centre – fallback to centre
      return { x: centerX, y: centerY, side: "right" };
    }

    // Compute t for each edge
    const tLeft = dx !== 0 ? (rect.x - centerX) / dx : -Infinity;
    const tRight = dx !== 0 ? (rect.x + rect.width - centerX) / dx : -Infinity;
    const tTop = dy !== 0 ? (rect.y - centerY) / dy : -Infinity;
    const tBottom = dy !== 0 ? (rect.y + rect.height - centerY) / dy : -Infinity;

    // Find the smallest positive t where the intersection lies on the segment
    let bestT = Infinity;
    let side: "left" | "right" | "top" | "bottom" = "right";
    let bestPoint = { x: centerX, y: centerY };

    const check = (t: number, candidateSide: typeof side, point: { x: number; y: number }) => {
      if (t > 0 && t < bestT && point.x >= rect.x && point.x <= rect.x + rect.width &&
          point.y >= rect.y && point.y <= rect.y + rect.height) {
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

  /**
   * Build an orthogonal stepped path that goes out from the source
   * anchor, makes one turn, and enters the target anchor.
   */
  const buildDockedPath = (
    sourceAnchor: { x: number; y: number },
    targetAnchor: { x: number; y: number },
    sourceCenter: { x: number; y: number },
    targetCenter: { x: number; y: number }
  ) => {
    // Outward direction from source centre to anchor (perpendicular to edge)
    const sourceOutX = sourceAnchor.x - sourceCenter.x;
    const sourceOutY = sourceAnchor.y - sourceCenter.y;
    const sourceOutLen = Math.hypot(sourceOutX, sourceOutY) || 1;
    const sourceOutUnit = { x: sourceOutX / sourceOutLen, y: sourceOutY / sourceOutLen };

    // Inward direction from target anchor to target centre (opposite of outward)
    const targetInX = targetCenter.x - targetAnchor.x;
    const targetInY = targetCenter.y - targetAnchor.y;
    const targetInLen = Math.hypot(targetInX, targetInY) || 1;
    const targetInUnit = { x: targetInX / targetInLen, y: targetInY / targetInLen };

    // How far the arrow goes out before turning
    const exitMargin = 30;
    const enterMargin = 30;

    const pExit = {
      x: sourceAnchor.x + sourceOutUnit.x * exitMargin,
      y: sourceAnchor.y + sourceOutUnit.y * exitMargin,
    };
    const pEnter = {
      x: targetAnchor.x + targetInUnit.x * enterMargin,
      y: targetAnchor.y + targetInUnit.y * enterMargin,
    };

    // Choose a corner for the orthogonal turn
    const corner1 = { x: pEnter.x, y: pExit.y };
    const corner2 = { x: pExit.x, y: pEnter.y };

    // Pick the corner that lies farther from the straight line to avoid overlapping
    const dist1 = Math.hypot(corner1.x - sourceAnchor.x, corner1.y - sourceAnchor.y);
    const dist2 = Math.hypot(corner2.x - sourceAnchor.x, corner2.y - sourceAnchor.y);
    const corner = dist1 >= dist2 ? corner1 : corner2;

    const points = [
      sourceAnchor,
      pExit,
      corner,
      pEnter,
      targetAnchor,
    ];

    // Remove consecutive duplicates
    const cleaned: { x: number; y: number }[] = [];
    for (const p of points) {
      const last = cleaned[cleaned.length - 1];
      if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) {
        cleaned.push(p);
      }
    }

    return cleaned.map((p) => `${p.x},${p.y}`).join(" ");
  };

  const isHighlighted = (edge: { from: string; to: string }) =>
    selectedNodeId !== null &&
    (edge.from === selectedNodeId || edge.to === selectedNodeId);

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
        overflow: "visible",
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
        </marker>
        <marker
          id="arrowhead-highlight"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
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

        const d = buildDockedPath(sourceAnchor, targetAnchor, sourceCenter, targetCenter);
        const highlight = isHighlighted(edge);

        return (
          <g key={`${edge.from}-${edge.to}-${idx}`}>
            <polyline
              points={d}
              fill="none"
              stroke={highlight ? "#3b82f6" : "#64748b"}
              strokeWidth={highlight ? 2.5 : 1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd={highlight ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
            />
            {/* Anchor dots (small circles at connection points) */}
            <circle
              cx={sourceAnchor.x}
              cy={sourceAnchor.y}
              r={3}
              fill={highlight ? "#3b82f6" : "#64748b"}
            />
            <circle
              cx={targetAnchor.x}
              cy={targetAnchor.y}
              r={3}
              fill={highlight ? "#3b82f6" : "#64748b"}
            />
          </g>
        );
      })}
    </svg>
  );
}