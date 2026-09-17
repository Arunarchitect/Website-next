"use client";

import { useEffect, useRef } from "react";
import {
  Person,
  ProcessNode,
  ValueDef,
  formatValue,
  getColorTheme,
  getLayout,
  getNodeValue,
  isNodeComplete,
  isNodePartial,
  resolveUnit,
} from "@/app/process/lib/process-utils";
import type { EditingField } from "@/app/process/hooks/useProcessEditor";

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
  onEditNode: (id: string, field: EditingField, currentValue: string) => void;

  /** What the leaf numbers mean + their conversion table. */
  valueDef: ValueDef;
  /** Currently-chosen display unit symbol. */
  displayUnit: string;
  /** Whether the value feature is in use anywhere in the doc. */
  valueInUse: boolean;
  /** Whether the sibling set this node belongs to has any value at all. */
  warnIfMissingValue: boolean;

  registerNodeRef: (id: string, el: HTMLDivElement | null) => void;
  activeNodeId: string | null;
  onSelectNode: (id: string) => void;
  /** This node's position in the tree, e.g. [2, 1] for "2nd top-level process, 1st subprocess". Empty for root. */
  numberPath?: number[];
  /** Global person roster, used to resolve assignedPersonIds -> names. */
  persons: Person[];
  /** Opens the assign/unassign popup for this node. */
  onOpenAssignPopup: (nodeId: string) => void;
  /** Node ids currently matching the search box, if any. */
  matchedNodeIds?: Set<string>;
  /** The single match currently focused via next/prev navigation. */
  activeMatchId?: string | null;
};

export function ProcessContainer({
  node,
  level,
  colorIndex,
  completed,
  onToggleComplete,
  onEditNode,
  valueDef,
  displayUnit,
  valueInUse,
  warnIfMissingValue,
  registerNodeRef,
  activeNodeId,
  onSelectNode,
  numberPath = [],
  persons,
  onOpenAssignPopup,
  matchedNodeIds,
  activeMatchId,
}: ProcessContainerProps) {
  const children = node.children ?? [];
  const layout = getLayout(level);
  const color = getColorTheme(level, colorIndex);

  const isCompleted = isNodeComplete(node, completed);
  const isPartial = isNodePartial(node, completed);
  const isParent = children.length > 0;
  const isSearchMatch = matchedNodeIds?.has(node.id) ?? false;
  const isActiveSearchMatch = activeMatchId === node.id;

  const valueResult = getNodeValue(node);

  const ownValue: number | undefined = (() => {
    if (typeof node.value === "number") return node.value;
    if (typeof node.area === "number") return node.area;
    return undefined;
  })();

  // Per child, does it resolve to a number? Used to decide which
  // children get the "no value set" nudge.
  const childResults = children.map((c) => getNodeValue(c));
  const anyChildHasValue = childResults.some((r) => r.value !== null);

  const warnIdsForChild = (index: number): boolean =>
    anyChildHasValue && childResults[index].value === null;

  // Root (level 0) is the canvas container, not a numbered process itself.
  const numberLabel = level > 0 && numberPath.length > 0 ? numberPath.join(".") : null;

  const assignedNames = (node.assignedPersonIds ?? [])
    .map((pid) => persons.find((p) => p.id === pid)?.name)
    .filter((name): name is string => Boolean(name));

  // Long‑press handling for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const startLongPress = (field: EditingField, value: string) => {
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

  const handleTextPointerDown = (e: React.PointerEvent, field: EditingField) => {
    // IMPORTANT: Do NOT stop propagation here.
    // The viewport needs to receive the pointer event for pan/pinch to work.
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      const value =
        field === "label"
          ? node.label
          : field === "description"
            ? node.description ?? ""
            : (() => {
                if (ownValue === undefined) return "";
                const disp = ownValue * resolveUnit(valueDef, displayUnit).fromBase;
                return String(Math.round(disp * 1e6) / 1e6);
              })();
      startLongPress(field, value);
    }
  };

  const handleTextPointerUp = () => cancelLongPress();

  const handleDoubleClick = (field: EditingField, value: string) => {
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
      className={node.important ? "important-pulse" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onSelectNode(node.id);
      }}

      style={{
        position: level === 0 ? undefined : "relative",
        zIndex: level === 0 ? undefined : 10,
        background: color.background,
        border: `1.5px solid ${
          activeNodeId === node.id
            ? "#3b82f6"
            : isSearchMatch
              ? "#EAB308"
              : color.border
        }`,
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
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        boxShadow: [
          activeNodeId === node.id ? "0 0 0 2px rgba(59,130,246,0.5)" : null,
          node.important ? "0 0 0 2px rgba(217,119,6,0.45)" : null,
          isActiveSearchMatch
            ? "0 0 0 3px rgba(234,88,12,0.9)"
            : isSearchMatch
              ? "0 0 0 2px rgba(234,179,8,0.7)"
              : null,
        ].filter(Boolean).join(", ") || "none",
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
          {numberLabel && (
            <span style={{ opacity: 0.55, fontWeight: 700, marginRight: "6px" }}>
              {numberLabel}.
            </span>
          )}
          {node.important && (
            <span
              title="Important"
              style={{ color: "#D97706", marginRight: "5px" }}
            >
              ★
            </span>
          )}
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
            whiteSpace: "pre-wrap",
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

      {/* VALUE — one number per document. Leaf: own value (editable) or a
          nudge if siblings have one. Parent: derived sum (read-only). */}
      {level > 0 && valueInUse && (
        <>
          {!isParent && ownValue !== undefined && (
            <div
              onPointerDown={(e) => handleTextPointerDown(e, "value")}
              onPointerUp={handleTextPointerUp}
              onPointerCancel={handleTextPointerUp}
              onPointerLeave={handleTextPointerUp}
              onDoubleClick={() => {
                const disp = ownValue * resolveUnit(valueDef, displayUnit).fromBase;
                handleDoubleClick("value", String(Math.round(disp * 1e6) / 1e6));
              }}
              style={{
                marginTop: "5px",
                marginLeft: "30px",
                fontSize: "10px",
                lineHeight: 1.3,
                fontWeight: 600,
                color: "#2F6FBF",
                cursor: "text",
                userSelect: "none",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
              }}
              title={`Double-click to edit ${valueDef.label.toLowerCase()}`}
            >
              {formatValue(ownValue, valueDef, displayUnit)}
            </div>
          )}

          {!isParent && ownValue === undefined && warnIfMissingValue && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onEditNode(node.id, "value", "");
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                marginTop: "5px",
                marginLeft: "30px",
                fontSize: "10px",
                lineHeight: 1.3,
                color: "#B45309",
                fontStyle: "italic",
                cursor: "pointer",
                userSelect: "none",
              }}
              title={`Other processes at this level have a ${valueDef.label.toLowerCase()} — click to add one here`}
            >
              ⚠ no {valueDef.label.toLowerCase()} set
            </div>
          )}

          {isParent && valueResult.value !== null && (
            <div
              style={{
                marginTop: "5px",
                marginLeft: "30px",
                fontSize: "10px",
                lineHeight: 1.3,
                fontStyle: "italic",
                color: valueResult.partial ? "#B45309" : "#8B96A5",
                userSelect: "none",
              }}
              title={
                valueResult.partial
                  ? `Sum of subprocesses that have a ${valueDef.label.toLowerCase()} — some here have none`
                  : `Sum of subprocesses' ${valueDef.label.toLowerCase()}`
              }
            >
              Σ {formatValue(valueResult.value, valueDef, displayUnit)}
              {valueResult.partial ? " · partial" : ""}
            </div>
          )}
        </>
      )}

      {/* ASSIGNED PEOPLE (own row, click opens assign popup) — not shown on root */}
      {level > 0 && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenAssignPopup(node.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            marginTop: "5px",
            marginLeft: "30px",
            fontSize: "10px",
            lineHeight: 1.3,
            color: assignedNames.length > 0 ? "#8B96A5" : "#B8C5D6",
            cursor: "pointer",
            userSelect: "none",
            fontStyle: assignedNames.length > 0 ? "normal" : "italic",
          }}
          title="Click to assign or remove people"
        >
          {assignedNames.length > 0 ? assignedNames.join(", ") : "+ assign person"}
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
            gap: level === 0 ? "40px" : "24px",
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
              valueDef={valueDef}
              displayUnit={displayUnit}
              valueInUse={valueInUse}
              warnIfMissingValue={warnIdsForChild(index)}
              registerNodeRef={registerNodeRef}
              activeNodeId={activeNodeId}
              onSelectNode={onSelectNode}
              numberPath={[...numberPath, index + 1]}
              persons={persons}
              onOpenAssignPopup={onOpenAssignPopup}
              matchedNodeIds={matchedNodeIds}
              activeMatchId={activeMatchId}
            />
          ))}
        </div>
      )}
    </div>
  );
}