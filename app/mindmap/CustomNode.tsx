"use client";

import { Handle, NodeProps, Position } from "@xyflow/react";
import { useState } from "react";
import { MindMapNodeData } from "./types";

const SHAPE_ASPECT: Record<string, { width: number; height: number; clipPath?: string }> = {
  circle: { width: 1, height: 1 },
  roundedRectangle: { width: 1.4, height: 1 },
  rectangle: { width: 1.6, height: 1 },
  diamond: { width: 1.2, height: 1.2, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
  hexagon: { width: 1.2, height: 1.1, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" },
};

export default function CustomNode({ id, data, selected }: NodeProps<MindMapNodeData>) {
  const [editing, setEditing] = useState(false);

  const aspect = SHAPE_ASPECT[data.shape] || SHAPE_ASPECT.roundedRectangle;
  const w = data.size * aspect.width;
  const h = data.size * aspect.height;
  const isCircle = data.shape === "circle";

  const handleRename = (newLabel: string) => {
    if (data.onRename && typeof data.onRename === "function") {
      data.onRename(id, newLabel);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRename(e.currentTarget.value);
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  };

  // Full-edge strips for free docking (non-circle shapes)
  const topBottomStrip: React.CSSProperties = {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 24,
    background: "transparent",
    border: "none",
    borderRadius: 0,
    opacity: 0,
    pointerEvents: "all",
    zIndex: 5,
  };

  const leftRightStrip: React.CSSProperties = {
    position: "absolute",
    top: 0,
    width: 24,
    height: "100%",
    background: "transparent",
    border: "none",
    borderRadius: 0,
    opacity: 0,
    pointerEvents: "all",
    zIndex: 5,
  };

  // Small centered handles for circle top/bottom-only docking
  const circleHandle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    width: 28,
    height: 28,
    background: "transparent",
    border: "none",
    borderRadius: "50%",
    opacity: 0,
    pointerEvents: "all",
    zIndex: 5,
  };

  return (
    <div
      className="mm-node"
      style={{
        width: w,
        height: h,
        backgroundColor: data.color,
        color: data.textColor,
        fontSize: data.fontSize,
        borderRadius: data.shape === "circle" ? "50%" : data.shape === "roundedRectangle" ? "12px" : "4px",
        clipPath: aspect.clipPath,
        border: `${data.strokeWidth}px solid ${data.strokeColor}`,
        boxShadow: selected ? "0 0 0 3px rgba(91, 91, 214, 0.5)" : "0 2px 6px rgba(0,0,0,0.15)",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "8px",
        wordBreak: "break-word",
        cursor: "grab",
        position: "relative",
      }}
    >
      {editing ? (
        <input
          className="mm-node-input"
          type="text"
          defaultValue={data.label}
          autoFocus
          onBlur={(e) => handleRename(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            fontSize: "inherit",
            fontFamily: "inherit",
            textAlign: "center",
            outline: "none",
            width: "100%",
            padding: "4px",
          }}
        />
      ) : (
        <span
          className="mm-node-label"
          onDoubleClick={() => setEditing(true)}
          style={{ userSelect: "none", fontWeight: "500", lineHeight: "1.3" }}
        >
          {data.label}
        </span>
      )}

      {/* VISIBLE PLUS SIGN — bottom center for all shapes */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="mm-node-plus"
        style={{
          position: "absolute",
          bottom: -12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: "#5B5BD6",
          border: "2px solid #fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          cursor: "crosshair",
          opacity: selected ? 1 : 0.01,
          transition: "opacity 0.2s, transform 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          pointerEvents: "all",
        }}
      >
        <span style={{ pointerEvents: "none", userSelect: "none", lineHeight: 1, color: "#fff", fontSize: 16, fontWeight: "bold" }}>
          +
        </span>
      </Handle>

      {isCircle ? (
        /* CIRCLE: top/bottom centered handles only */
        <>
          <Handle type="source" position={Position.Top} id="top-source" style={{ ...circleHandle, top: -14 }} />
          <Handle type="target" position={Position.Top} id="top-target" style={{ ...circleHandle, top: -14 }} />
          <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ ...circleHandle, bottom: -14 }} />
          <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ ...circleHandle, bottom: -14 }} />
        </>
      ) : (
        /* ALL OTHER SHAPES: full-edge free docking */
        <>
          <Handle type="source" position={Position.Top} id="top-source" style={{ ...topBottomStrip, top: -12 }} />
          <Handle type="target" position={Position.Top} id="top-target" style={{ ...topBottomStrip, top: -12 }} />
          <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ ...topBottomStrip, bottom: -12 }} />
          <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ ...topBottomStrip, bottom: -12 }} />
          <Handle type="source" position={Position.Left} id="left-source" style={{ ...leftRightStrip, left: -12 }} />
          <Handle type="target" position={Position.Left} id="left-target" style={{ ...leftRightStrip, left: -12 }} />
          <Handle type="source" position={Position.Right} id="right-source" style={{ ...leftRightStrip, right: -12 }} />
          <Handle type="target" position={Position.Right} id="right-target" style={{ ...leftRightStrip, right: -12 }} />
        </>
      )}

      <style>{`
        .mm-node:hover .mm-node-plus {
          opacity: 0.9 !important;
          transform: translateX(-50%) scale(1.05);
        }
        .mm-node:hover .mm-node-plus:hover {
          opacity: 1 !important;
          transform: translateX(-50%) scale(1.15);
        }
      `}</style>
    </div>
  );
}