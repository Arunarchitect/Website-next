"use client";

import { Edge, Node } from "@xyflow/react";
import { MindMapNodeData } from "./types";
import {
  DEPTH_COLORS,
  DIRECTION_COLORS,
  EdgeStylePatch,
  LINE_STYLES,
  MAX_NODE_SIZE,
  MIN_NODE_SIZE,
  NODE_SHAPES,
} from "./Utils";

interface EditPanelProps {
  node: Node<MindMapNodeData> | null;
  edge: Edge | null;
  open: boolean;
  onClose: () => void;
  onUpdateNode: (id: string, patch: Partial<MindMapNodeData>) => void;
  onDeleteNode: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onUpdateEdge: (id: string, patch: EdgeStylePatch) => void;
  onDeleteEdge: (id: string) => void;
}

const SWATCHES = [...DEPTH_COLORS, "#ef4444", "#111827", "#ffffff"];
const STROKE_SWATCHES = ["rgba(255,255,255,0.55)", "#ffffff", "#111827", "#5B5BD6", "#F43F5E", "transparent"];

export default function EditPanel({
  node,
  edge,
  open,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onAddChild,
  onUpdateEdge,
  onDeleteEdge,
}: EditPanelProps) {
  return (
    <aside className={`mm-panel${open ? " mm-panel-open" : ""}`}>
      <div className="mm-panel-header">
        <span>Edit</span>
        <button className="mm-panel-close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      {!node && !edge && (
        <p className="mm-panel-empty">Select a box or a connection line to edit its style.</p>
      )}

      {node && (
        <div className="mm-panel-section">
          <label className="mm-field-label">Label</label>
          <input
            className="mm-field-input"
            value={node.data.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
          />

          <label className="mm-field-label">Shape</label>
          <select
            className="mm-field-input"
            value={node.data.shape}
            onChange={(e) => onUpdateNode(node.id, { shape: e.target.value as MindMapNodeData["shape"] })}
          >
            {NODE_SHAPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="mm-field-label">Size ({node.data.size}px)</label>
          <div className="mm-size-row">
            <button
              type="button"
              className="mm-btn mm-btn-icon"
              onClick={() =>
                onUpdateNode(node.id, {
                  size: Math.max(MIN_NODE_SIZE, node.data.size - 12),
                  autoSize: false,
                })
              }
              aria-label="Decrease size"
            >
              –
            </button>
            <input
              type="range"
              min={MIN_NODE_SIZE}
              max={MAX_NODE_SIZE}
              value={node.data.size}
              onChange={(e) => onUpdateNode(node.id, { size: Number(e.target.value), autoSize: false })}
            />
            <button
              type="button"
              className="mm-btn mm-btn-icon"
              onClick={() =>
                onUpdateNode(node.id, {
                  size: Math.min(MAX_NODE_SIZE, node.data.size + 12),
                  autoSize: false,
                })
              }
              aria-label="Increase size"
            >
              +
            </button>
          </div>
          {!node.data.autoSize && (
            <button
              type="button"
              className="mm-link-btn"
              onClick={() => onUpdateNode(node.id, { autoSize: true })}
            >
              Reset to auto-size
            </button>
          )}

          <label className="mm-field-label">Fill color</label>
          <div className="mm-swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                className={`mm-swatch${node.data.color === c ? " mm-swatch-active" : ""}`}
                style={{ background: c }}
                onClick={() => onUpdateNode(node.id, { color: c })}
                aria-label={`Set color ${c}`}
              />
            ))}
            <input
              type="color"
              value={node.data.color}
              onChange={(e) => onUpdateNode(node.id, { color: e.target.value })}
              className="mm-color-input"
              aria-label="Custom fill color"
            />
          </div>

          <label className="mm-field-label">Stroke</label>
          <div className="mm-swatches">
            {STROKE_SWATCHES.map((c) => (
              <button
                key={c}
                className={`mm-swatch${node.data.strokeColor === c ? " mm-swatch-active" : ""}`}
                style={{ background: c === "transparent" ? "#fff" : c, borderStyle: c === "transparent" ? "dashed" : "solid" }}
                onClick={() => onUpdateNode(node.id, { strokeColor: c })}
                aria-label={`Set stroke ${c}`}
              />
            ))}
            <input
              type="color"
              value={node.data.strokeColor?.startsWith("#") ? node.data.strokeColor : "#ffffff"}
              onChange={(e) => onUpdateNode(node.id, { strokeColor: e.target.value })}
              className="mm-color-input"
              aria-label="Custom stroke color"
            />
          </div>

          <label className="mm-field-label">Stroke width ({node.data.strokeWidth}px)</label>
          <input
            type="range"
            min={0}
            max={8}
            step={0.5}
            value={node.data.strokeWidth}
            onChange={(e) => onUpdateNode(node.id, { strokeWidth: Number(e.target.value) })}
          />

          <label className="mm-field-label">Text color</label>
          <input
            type="color"
            value={node.data.textColor}
            onChange={(e) => onUpdateNode(node.id, { textColor: e.target.value })}
            className="mm-color-input"
          />

          <label className="mm-field-label">Font size ({node.data.fontSize}px)</label>
          <input
            type="range"
            min={10}
            max={22}
            value={node.data.fontSize}
            onChange={(e) => onUpdateNode(node.id, { fontSize: Number(e.target.value) })}
          />

          <div className="mm-panel-actions">
            <button className="mm-btn" onClick={() => onAddChild(node.id)}>
              + Add child
            </button>
            <button className="mm-btn mm-btn-danger" onClick={() => onDeleteNode(node.id)}>
              Delete box
            </button>
          </div>
        </div>
      )}

      {edge && (
        <div className="mm-panel-section">
          <label className="mm-field-label">Label</label>
          <input
            className="mm-field-input"
            value={typeof edge.label === "string" ? edge.label : ""}
            onChange={(e) => onUpdateEdge(edge.id, { label: e.target.value })}
          />

          <label className="mm-field-label">Direction</label>
          <select
            className="mm-field-input"
            value={(edge.data?.direction as string) || "forward"}
            onChange={(e) => onUpdateEdge(edge.id, { direction: e.target.value })}
          >
            <option value="forward">Forward</option>
            <option value="backward">Backward / feedback</option>
            <option value="bidirectional">Bidirectional</option>
          </select>

          <label className="mm-field-label">Line style</label>
          <select
            className="mm-field-input"
            value={(edge.data?.lineStyle as string) || "solid"}
            onChange={(e) => onUpdateEdge(edge.id, { lineStyle: e.target.value })}
          >
            {LINE_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <label className="mm-field-label">Line color</label>
          <div className="mm-swatches">
            {Object.values(DIRECTION_COLORS).map((c) => (
              <button
                key={c}
                className="mm-swatch"
                style={{ background: c }}
                onClick={() => onUpdateEdge(edge.id, { color: c })}
                aria-label={`Set line color ${c}`}
              />
            ))}
            <input
              type="color"
              value={(edge.style?.stroke as string) || "#94a3b8"}
              onChange={(e) => onUpdateEdge(edge.id, { color: e.target.value })}
              className="mm-color-input"
            />
          </div>

          <label className="mm-field-label">
            Thickness ({(edge.style?.strokeWidth as number) || 1.6}px)
          </label>
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={(edge.style?.strokeWidth as number) || 1.6}
            onChange={(e) => onUpdateEdge(edge.id, { strokeWidth: Number(e.target.value) })}
          />

          <div className="mm-panel-actions">
            <button className="mm-btn mm-btn-danger" onClick={() => onDeleteEdge(edge.id)}>
              Delete connection
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}