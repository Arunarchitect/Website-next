"use client";

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
  const borderColor = checked
    ? "#2F9E58"
    : indeterminate
    ? "#7FBF93"
    : "#B8C5D6";

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
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
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
};

export function ProcessContainer({
  node,
  level,
  colorIndex,
  completed,
  onToggleComplete,
}: ProcessContainerProps) {
  const children = node.children ?? [];

  const layout = getLayout(level);
  const color = getColorTheme(level, colorIndex);

  const isCompleted = isNodeComplete(node, completed);
  const isPartial = isNodePartial(node, completed);
  const isParent = children.length > 0;

  return (
    <div
      style={{
        background: color.background,
        border: `1.5px solid ${color.border}`,
        outline: isCompleted ? "2px solid #2F9E58" : "none",
        outlineOffset: "2px",
        borderRadius: level === 0 ? "18px" : "14px",

        /*
         * VERY IMPORTANT:
         *
         * Parent height is determined by its content, and
         * `minHeight` (from the JSON, when present) only ever
         * makes the box taller than it would otherwise be —
         * it never shrinks or clips content.
         */
        height: "fit-content",
        minHeight: node.height ? `${node.height}px` : undefined,

        /*
         * STRICT CONTAINMENT RULE:
         *
         * A node's width can be suggested via node.width, but
         * it is always capped at 100% of its parent's content
         * box. Combined with `overflow: hidden` below, a child
         * rectangle can never extend past its parent's edges,
         * no matter what width/height values are stored in the
         * JSON.
         */
        width: level === 0 ? "100%" : node.width ? `${node.width}px` : "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        padding: layout.padding,

        /* Prevent children from visually escaping. */
        overflow: "hidden",
      }}
    >
      {/* TITLE ROW (checkbox + title) */}
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
          }}
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
          }}
        >
          {node.description}
        </div>
      )}

      {/* CHILDREN */}
      {children.length > 0 && (
        <div
          style={{
            marginTop: "16px",

            /*
             * LEVEL 0: top-level processes are arranged horizontally.
             * LEVEL 1+: subprocesses are stacked vertically inside parent.
             */
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
              /* Every top-level process gets its own colour family. */
              colorIndex={level === 0 ? index : colorIndex}
              completed={completed}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}