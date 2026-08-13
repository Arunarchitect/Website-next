/* =========================================================
   TYPES
========================================================= */

export type ProcessNode = {
  id: string;
  label: string;
  description?: string;
  type?: string;
  /*
   * Optional layout hints, in pixels.
   *
   * width  -> preferred/basis width. Always rendered with
   *           maxWidth: 100% of the parent as well, so a box
   *           can never visually escape its parent even if
   *           the stored value is "wrong" or too large.
   *
   * height -> preferred MINIMUM height. The box still grows
   *           automatically to fit its content/children, so
   *           this can never cause text or child nodes to be
   *           clipped.
   */
  width?: number;
  height?: number;
  children?: ProcessNode[];
};

export type ProcessData = {
  title: string;
  description?: string;
  type?: string;
  width?: number;
  height?: number;
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

   Completion is only ever stored for LEAF nodes (nodes with
   no children). A node with children is considered complete
   when every one of its children is complete, all the way
   down — so parents auto-check once every sub-process under
   them is checked, and never store their own separate state.
========================================================= */

export function countNodes(node: ProcessNode): number {
  const children = node.children ?? [];

  return (
    1 + children.reduce((total, child) => total + countNodes(child), 0)
  );
}

export function getLeafIds(node: ProcessNode): string[] {
  const children = node.children ?? [];

  if (children.length === 0) {
    return [node.id];
  }

  return children.flatMap(getLeafIds);
}

export function isNodeComplete(
  node: ProcessNode,
  completed: Set<string>
): boolean {
  const children = node.children ?? [];

  if (children.length === 0) {
    return completed.has(node.id);
  }

  return children.every((child) => isNodeComplete(child, completed));
}

export function isNodePartial(
  node: ProcessNode,
  completed: Set<string>
): boolean {
  const children = node.children ?? [];

  if (children.length === 0) {
    return false;
  }

  const anyProgress = children.some(
    (child) =>
      isNodeComplete(child, completed) || isNodePartial(child, completed)
  );

  const allComplete = children.every((child) =>
    isNodeComplete(child, completed)
  );

  return anyProgress && !allComplete;
}

/* =========================================================
   COLOUR THEMES
========================================================= */

export function getColorTheme(level: number, colorIndex: number): ColorTheme {
  /* ROOT */
  if (level === 0) {
    return {
      background: "#F3F6FA",
      border: "#B8C5D6",
      title: "#26364A",
      description: "#536273",
    };
  }

  /* TOP LEVEL COLOUR FAMILIES */
  const themes: ColorTheme[] = [
    /* GREEN */
    {
      background: "#EEF7F0",
      border: "#B8D8BD",
      title: "#315C38",
      description: "#55725A",
    },
    /* ORANGE */
    {
      background: "#FFF5E8",
      border: "#E8C79A",
      title: "#754C20",
      description: "#80684B",
    },
    /* PURPLE */
    {
      background: "#F5F0FA",
      border: "#D1BDE2",
      title: "#5A3D70",
      description: "#725D83",
    },
    /* BLUE */
    {
      background: "#EEF5FB",
      border: "#B8D2E8",
      title: "#315878",
      description: "#59748C",
    },
    /* PINK */
    {
      background: "#FBEFF2",
      border: "#E4BBC5",
      title: "#713D4A",
      description: "#805E66",
    },
    /* YELLOW */
    {
      background: "#FFF9E8",
      border: "#E6D49A",
      title: "#705E22",
      description: "#7C7048",
    },
  ];

  const base = themes[colorIndex % themes.length];

  /* LEVEL 1 — main process uses base colour */
  if (level === 1) {
    return base;
  }

  /* LEVEL 2 — lighter version of parent */
  if (level === 2) {
    return {
      background: lighten(base.background, 0.45),
      border: lighten(base.border, 0.15),
      title: base.title,
      description: base.description,
    };
  }

  /* LEVEL 3+ */
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
    /* LEVEL 0 — DESIGN PROCESS */
    {
      titleSize: "26px",
      descriptionSize: "15px",
      padding: "26px",
    },
    /* LEVEL 1 — PROCESS */
    {
      titleSize: "19px",
      descriptionSize: "12px",
      padding: "16px",
    },
    /* LEVEL 2 — SUBPROCESS */
    {
      titleSize: "16px",
      descriptionSize: "11px",
      padding: "13px",
    },
    /* LEVEL 3 — SUB-SUBPROCESS */
    {
      titleSize: "14px",
      descriptionSize: "10px",
      padding: "11px",
    },
  ];

  return layouts[Math.min(level, layouts.length - 1)];
}