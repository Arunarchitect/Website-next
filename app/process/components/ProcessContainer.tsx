"use client";

import { useEffect, useRef } from "react";
import {
  ProcessNode,
  getColorTheme,
  getLayout,
  isNodeComplete,
  isNodePartial,
} from "@/app/process/lib/process-utils";

/* =========================================================
   COMPLETION CHECKBOX
========================================================= */

type CompletionCheckboxProps = {
  checked: boolean;
  indeterminate: boolean;
  locked: boolean;
  onToggle: () => void;
};

export function CompletionCheckbox({
  checked,
  indeterminate,
  locked,
  onToggle,
}: CompletionCheckboxProps) {
  const borderColor = checked ? "#2F9E58" : indeterminate ? "#7FBF93" : "#B8C5D6";

  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={
        checked
          ? "Mark as incomplete"
          : locked
          ? "Complete all subprocesses first"
          : "Mark as complete"
      }
      title={locked && !checked ? "Complete all subprocesses first" : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={{
        flexShrink: 0,
        width: "22px",
        height: "22px",
        marginTop: "2px",
        borderRadius: "6px",
        border: `1.5px solid ${borderColor}`,
        background: checked ? "#2F9E58" : "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: locked && !checked ? "not-allowed" : "pointer",
        padding: 0,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      {checked && (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 8.5L6.5 12L13 4.5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {!checked && indeterminate && (
        <div
          style={{
            width: "10px",
            height: "2.5px",
            borderRadius: "2px",
            background: "#2F9E58",
          }}
        />
      )}
    </button>
  );
}

/* =========================================================
   PROCESS CONTAINER
========================================================= */

type ProcessContainerProps = {
  node: ProcessNode;
  level: number;
  colorIndex: number;
  completed: Set<string>;
  onToggleComplete: (node: ProcessNode) => void;
  onEditNode: (
    id: string,
    field: "label" | "description",
    currentValue: string
  ) => void;
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void;
  activeNodeId: string | null;
  onSelectNode: (id: string) => void;
};

export function ProcessContainer({
  node,
  level,
  colorIndex,
  completed,
  onToggleComplete,
  onEditNode,
  registerNodeRef,
  activeNodeId,
  onSelectNode,
}: ProcessContainerProps) {
  const children = node.children ?? [];
  const layout = getLayout(level);
  const color = getColorTheme(level, colorIndex);

  const isCompleted = isNodeComplete(node, completed);
  const isPartial = isNodePartial(node, completed);
  const isParent = children.length > 0;

  // Long‑press handling for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const startLongPress = (field: "label" | "description", value: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onEditNode(node.id, field, value);
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => cancelLongPress, []);

  const handleTextPointerDown = (
    e: React.PointerEvent,
    field: "label" | "description"
  ) => {
    e.stopPropagation();
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      startLongPress(field, field === "label" ? node.label : node.description ?? "");
    }
  };

  const handleTextPointerUp = () => cancelLongPress();

  const handleDoubleClick = (field: "label" | "description", value: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onEditNode(node.id, field, value);
  };

  return (
    <div
      ref={(el) => registerNodeRef(node.id, el)}
      data-node-id={node.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelectNode(node.id);
      }}
      style={{
        background: color.background,
        border: `1.5px solid ${activeNodeId === node.id ? "#3b82f6" : color.border}`,
        outline: isCompleted ? "2px solid #2F9E58" : "none",
        outlineOffset: "2px",
        borderRadius: level === 0 ? "18px" : "14px",
        height: "fit-content",
        minHeight: node.height ? `${node.height}px` : undefined,
        width: level === 0 ? "100%" : node.width ? `${node.width}px` : "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        padding: layout.padding,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow:
          activeNodeId === node.id
            ? "0 0 0 2px rgba(59,130,246,0.5)"
            : "none",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      {/* TITLE ROW */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <CompletionCheckbox
          checked={isCompleted}
          indeterminate={isPartial}
          locked={isParent}
          onToggle={() => onToggleComplete(node)}
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            color: color.title,
            fontSize: layout.titleSize,
            fontWeight: 600,
            lineHeight: 1.25,
            textAlign: "left",
            whiteSpace: "normal",
            overflowWrap: "break-word",
            wordBreak: "normal",
            hyphens: "auto",
            cursor: "text",
            border: "1px solid transparent",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          onPointerDown={(e) => handleTextPointerDown(e, "label")}
          onPointerUp={handleTextPointerUp}
          onPointerCancel={handleTextPointerUp}
          onPointerLeave={handleTextPointerUp}
          onDoubleClick={() => handleDoubleClick("label", node.label)}
        >
          {node.label}
        </div>
      </div>

      {/* DESCRIPTION */}
      {node.description && (
        <div
          style={{
            marginTop: "7px",
            marginLeft: "30px",
            color: color.description,
            fontSize: layout.descriptionSize,
            lineHeight: 1.4,
            textAlign: "left",
            whiteSpace: "normal",
            overflowWrap: "break-word",
            wordBreak: "normal",
            hyphens: "auto",
            minWidth: 0,
            cursor: "text",
            border: "1px solid transparent",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          onPointerDown={(e) => handleTextPointerDown(e, "description")}
          onPointerUp={handleTextPointerUp}
          onPointerCancel={handleTextPointerUp}
          onPointerLeave={handleTextPointerUp}
          onDoubleClick={() => handleDoubleClick("description", node.description ?? "")}
        >
          {node.description}
        </div>
      )}

      {/* CHILDREN */}
      {children.length > 0 && (
        <div
          style={{
            marginTop: "16px",
            display: level === 0 ? "grid" : "flex",
            gridTemplateColumns:
              level === 0
                ? `repeat(${children.length}, minmax(0, 1fr))`
                : undefined,
            flexDirection: level === 0 ? undefined : "column",
            gap: "12px",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            alignItems: "stretch",
            boxSizing: "border-box",
          }}
        >
          {children.map((child, index) => (
            <ProcessContainer
              key={child.id}
              node={child}
              level={level + 1}
              colorIndex={level === 0 ? index : colorIndex}
              completed={completed}
              onToggleComplete={onToggleComplete}
              onEditNode={onEditNode}
              registerNodeRef={registerNodeRef}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}