/* =========================================================
   TYPES
========================================================= */

export type Person = {
  id: string;
  name: string;
};

export type ProcessNode = {
  id: string;
  label: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  predecessors?: string[];  // ids of predecessor nodes (same level)
  successors?: string[];    // ids of successor nodes (same level)
  assignedPersonIds?: string[]; // ids into ProcessData.persons — NOT inherited by children
  children?: ProcessNode[];
};

export type ProcessData = {
  title: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
  completed?: string[];
  edgeStyles?: Record<string, { dashed?: boolean }>;
  persons?: Person[]; // global roster, referenced by ProcessNode.assignedPersonIds
  children?: ProcessNode[];
};

export type ColorTheme = {
  background: string;
  border: string;
  title: string;
  description: string;
};

/* =========================================================
   TREE HELPERS
========================================================= */

export function countNodes(node: ProcessNode): number {
  const children = node.children ?? [];
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}

export function getLeafIds(node: ProcessNode): string[] {
  const children = node.children ?? [];
  if (children.length === 0) return [node.id];
  return children.flatMap(getLeafIds);
}

export function isNodeComplete(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return completed.has(node.id);
  return children.every((child) => isNodeComplete(child, completed));
}

export function isNodePartial(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return false;
  const anyProgress = children.some(
    (child) => isNodeComplete(child, completed) || isNodePartial(child, completed)
  );
  const allComplete = children.every((child) => isNodeComplete(child, completed));
  return anyProgress && !allComplete;
}

/* =========================================================
   COLOUR THEMES
========================================================= */

export function getColorTheme(level: number, colorIndex: number): ColorTheme {
  if (level === 0) {
    return {
      background: "#F3F6FA",
      border: "#B8C5D6",
      title: "#26364A",
      description: "#536273",
    };
  }

  const themes: ColorTheme[] = [
    { background: "#EEF7F0", border: "#B8D8BD", title: "#315C38", description: "#55725A" },
    { background: "#FFF5E8", border: "#E8C79A", title: "#754C20", description: "#80684B" },
    { background: "#F5F0FA", border: "#D1BDE2", title: "#5A3D70", description: "#725D83" },
    { background: "#EEF5FB", border: "#B8D2E8", title: "#315878", description: "#59748C" },
    { background: "#FBEFF2", border: "#E4BBC5", title: "#713D4A", description: "#805E66" },
    { background: "#FFF9E8", border: "#E6D49A", title: "#705E22", description: "#7C7048" },
  ];

  const base = themes[colorIndex % themes.length];

  if (level === 1) return base;

  if (level === 2) {
    return {
      background: lighten(base.background, 0.45),
      border: lighten(base.border, 0.15),
      title: base.title,
      description: base.description,
    };
  }

  return {
    background: lighten(base.background, 0.65),
    border: lighten(base.border, 0.3),
    title: base.title,
    description: base.description,
  };
}

function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);
  return `rgb(${newR}, ${newG}, ${newB})`;
}

/* =========================================================
   TEXT SIZING
========================================================= */

export function getLayout(level: number) {
  const layouts = [
    { titleSize: "26px", descriptionSize: "15px", padding: "26px" },
    { titleSize: "19px", descriptionSize: "12px", padding: "16px" },
    { titleSize: "16px", descriptionSize: "11px", padding: "13px" },
    { titleSize: "14px", descriptionSize: "10px", padding: "11px" },
  ];
  return layouts[Math.min(level, layouts.length - 1)];
}