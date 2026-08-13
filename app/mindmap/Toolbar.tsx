"use client";

import { useRef } from "react";
import { FileSystemFileHandleLike } from "./types";

interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onFileSelected: (file: File, handle?: FileSystemFileHandleLike) => void;
  onSave: () => void;
  onExport: () => void;
  onAddNode: () => void;
  hasFileHandle: boolean;
  fileName: string | null;
  onTogglePanel: () => void;
  onLayoutTree: () => void;
  onLayoutForce: () => void;
  layoutBusy: boolean;
}

export default function Toolbar({
  title,
  onTitleChange,
  onFileSelected,
  onSave,
  onExport,
  onAddNode,
  hasFileHandle,
  fileName,
  onTogglePanel,
  onLayoutTree,
  onLayoutForce,
  layoutBusy,
}: ToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefer the File System Access API so we get a real handle back — that's
  // what lets "Save" overwrite the original file instead of downloading a
  // new copy. Falls back to a plain <input type="file"> everywhere else
  // (Safari, Firefox, mobile browsers).
  const handleImportClick = async () => {
    if (typeof window !== "undefined" && window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
          excludeAcceptAllOption: false,
        });
        const file = await handle.getFile?.();
        if (file) onFileSelected(file, handle);
        return;
      } catch {
        // Picker unsupported at runtime or user cancelled — try the input.
      }
    }
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = "";
  };

  return (
    <header className="mm-toolbar">
      <div className="mm-toolbar-row">
        <div className="mm-brand">
          <span className="mm-brand-dot" aria-hidden="true" />
          <input
            className="mm-title-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled mind map"
            aria-label="Mind map title"
          />
        </div>

        <button type="button" className="mm-panel-toggle" onClick={onTogglePanel} aria-label="Toggle edit panel">
          Edit
        </button>
      </div>

      <div className="mm-toolbar-row mm-toolbar-actions">
        <div className="mm-file-status">
          {fileName ? (
            <>
              <span className="mm-file-dot" data-linked={hasFileHandle} aria-hidden="true" />
              <span className="mm-file-name">{fileName}</span>
            </>
          ) : (
            <span className="mm-file-name mm-file-name-empty">no file loaded</span>
          )}
        </div>

        <div className="mm-actions">
          <button type="button" className="mm-btn" onClick={onAddNode}>
            + Node
          </button>
          <div className="mm-layout-group" role="group" aria-label="Layout mode">
            <button
              type="button"
              className="mm-btn"
              onClick={onLayoutTree}
              disabled={layoutBusy}
              title="Arrange as a hierarchical tree"
            >
              Tree
            </button>
            <button
              type="button"
              className="mm-btn"
              onClick={onLayoutForce}
              disabled={layoutBusy}
              title="Let boxes drift into an organic, force-directed cluster"
            >
              {layoutBusy ? "Settling…" : "Force"}
            </button>
          </div>
          <button type="button" className="mm-btn" onClick={handleImportClick}>
            Import
          </button>
          <button
            type="button"
            className="mm-btn"
            onClick={onSave}
            title={hasFileHandle ? "Overwrite the loaded file" : "No file loaded — downloads a copy instead"}
          >
            {hasFileHandle ? "Save" : "Save As"}
          </button>
          <button type="button" className="mm-btn mm-btn-primary" onClick={onExport}>
            Export
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleInputChange}
          className="mm-hidden-input"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </header>
  );
}
