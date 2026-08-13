// Shape of the JSON file the mind map is imported from / exported to.
// "stages" are the boxes, "relationships" are the connector lines.
// Positions are never stored here — the editor lays everything out itself
// every time a file is opened (see Utils.ts: computeTreeLayout).

export type NodeShape = "circle" | "roundedRectangle" | "rectangle" | "diamond" | "hexagon";

export interface MindMapNodeJson {
  id: string;
  label: string;
  color?: string;
  textColor?: string;
  fontSize?: number;
  parentId?: string | null;
  // Visual shape of the box. Defaults to "circle" if omitted.
  shape?: NodeShape;
  // Diameter/footprint in px. Omit this to let the app keep auto-sizing the
  // box to fit its label as the label changes; include it only once you've
  // manually resized the box and want that exact size to stick.
  size?: number;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface MindMapRelationshipJson {
  id?: string;
  source: string;
  target: string;
  label?: string;
  direction?: "forward" | "backward" | "bidirectional";
  color?: string;
  strokeWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
}

export interface MindMapJson {
  // Purely informational — the app ignores this on import. Present so the
  // file explains its own fields when someone opens it in a text editor.
  _readme?: string[];
  title: string;
  stages: MindMapNodeJson[];
  relationships: MindMapRelationshipJson[];
}

// Data carried on every React Flow node.
export interface MindMapNodeData extends Record<string, unknown> {
  label: string;
  color: string;
  textColor: string;
  fontSize: number;
  size: number; // circle/box footprint in px
  // True until the user manually resizes the box; while true, the size is
  // recomputed from the label whenever it's renamed. Manually resizing sets
  // this to false so the app stops overriding the chosen size.
  autoSize: boolean;
  shape: NodeShape;
  strokeColor: string;
  strokeWidth: number;
  depth: number;
  parentId: string | null;
  onRename: (id: string, label: string) => void;
}

// Data carried on every React Flow edge.
export interface MindMapEdgeData extends Record<string, unknown> {
  direction: "forward" | "backward" | "bidirectional";
  lineStyle: "solid" | "dashed" | "dotted";
  onCycleDirection: (id: string) => void;
  onCycleStyle: (id: string) => void;
}

// Minimal shape we rely on from the File System Access API, kept loose
// so this file compiles even in browsers/TS libs that don't define it.
export interface FileSystemFileHandleLike {
  name?: string;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile?: () => Promise<File>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: { description: string; accept: Record<string, string[]> }[];
      excludeAcceptAllOption?: boolean;
      multiple?: boolean;
    }) => Promise<FileSystemFileHandleLike[]>;
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandleLike>;
  }
}
