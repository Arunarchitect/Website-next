import { VALUE_PRESETS, hasFactors, type ProcessNode } from "@/app/process/lib/process-utils";

export type Issue = { path: string; message: string };

export type ValidationReport = {
  ok: boolean; // true = no errors (warnings don't block)
  errors: Issue[];
  warnings: Issue[];
  /** The text with ``` fences / chatter stripped. Pass THIS to setSubtreeFromJson. */
  cleaned: string;
};

const KNOWN_KEYS = new Set([
  "id", "label", "description", "type", "width", "height",
  "predecessors", "successors", "assignedPersonIds", "children",
  "important", "value", "area", "valueType", "factor1", "factor2",
]);

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isNonNeg = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Accepts raw JSON, ```json fenced JSON, or JSON surrounded by chatter. */
function extractJson(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

export function validateSubtreeJson(
  text: string,
  nodeId: string,
  root: ProcessNode,
  personIds: string[],
  defaultTypeId: string,
): ValidationReport {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const cleaned = extractJson(text);
  const fail = (): ValidationReport => ({ ok: false, errors, warnings, cleaned });

  // 1 ── parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    errors.push({ path: "(root)", message: `Not valid JSON: ${(e as Error).message}` });
    return fail();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push({ path: "(root)", message: "Must be ONE process object { id, label, ... }, not an array." });
    return fail();
  }
  const top = parsed as ProcessNode;
  if (top.id !== nodeId) {
    errors.push({
      path: "id",
      message: `The top-level id must stay "${nodeId}" (found ${JSON.stringify(top.id)}).`,
    });
    return fail();
  }

  // 2 ── what exists OUTSIDE the edited subtree
  const outsideNodes = new Map<string, ProcessNode>();
  const parentOf = new Map<string, string | null>();
  const oldIds = new Set<string>();
  const collectOld = (n: ProcessNode) => {
    oldIds.add(n.id);
    (n.children ?? []).forEach(collectOld);
  };
  const walkOutside = (n: ProcessNode, parent: string | null) => {
    if (n.id === nodeId) {
      parentOf.set(n.id, parent);
      collectOld(n);
      return;
    }
    outsideNodes.set(n.id, n);
    parentOf.set(n.id, parent);
    (n.children ?? []).forEach((c) => walkOutside(c, n.id));
  };
  walkOutside(root, null);

  // 3 ── walk the new subtree
  const inside = new Map<string, ProcessNode>();
  const personSet = new Set(personIds);

  const walk = (n: unknown, path: string, parent: string | null) => {
    if (!n || typeof n !== "object" || Array.isArray(n)) {
      errors.push({ path, message: "Not an object." });
      return;
    }
    const node = n as Record<string, unknown>;

    if (!isStr(node.id) || node.id.trim() === "") {
      errors.push({ path: `${path}.id`, message: "Missing id (non-empty string)." });
      return;
    }
    const id = node.id;
    if (inside.has(id)) {
      errors.push({ path: `${path}.id`, message: `Duplicate id "${id}" inside this JSON.` });
    } else if (outsideNodes.has(id)) {
      errors.push({
        path: `${path}.id`,
        message: `id "${id}" already belongs to another process in the document. Use a new unique id.`,
      });
    }
    inside.set(id, node as unknown as ProcessNode);
    parentOf.set(id, parent);

    if (!isStr(node.label) || node.label.trim() === "") {
      errors.push({ path: `${path}.label`, message: "Missing label (non-empty string)." });
    } else if (/^\s*\d+(\.\d+)*\.?\s+\S/.test(node.label)) {
      warnings.push({
        path: `${path}.label`,
        message: `"${node.label}" starts with a number. Numbering is automatic; remove it from the label.`,
      });
    }
    if (node.description !== undefined && !isStr(node.description))
      errors.push({ path: `${path}.description`, message: "Must be a string." });
    for (const k of ["successors", "predecessors", "assignedPersonIds"] as const) {
      if (node[k] !== undefined && !isStrArr(node[k]))
        errors.push({ path: `${path}.${k}`, message: "Must be an array of strings." });
    }
    for (const k of ["width", "height"] as const) {
      if (node[k] !== undefined && !isNonNeg(node[k]))
        errors.push({ path: `${path}.${k}`, message: "Must be a non-negative number." });
    }
    if (node.important !== undefined && typeof node.important !== "boolean")
      errors.push({ path: `${path}.important`, message: "Must be true or false." });
    for (const k of ["value", "area", "factor1", "factor2"] as const) {
      if (node[k] !== undefined && !isNonNeg(node[k]))
        errors.push({ path: `${path}.${k}`, message: "Must be a non-negative number (in BASE units)." });
    }
    if (node.valueType !== undefined) {
      if (!isStr(node.valueType) || !VALUE_PRESETS[node.valueType]) {
        errors.push({
          path: `${path}.valueType`,
          message: `Must be one of: ${Object.keys(VALUE_PRESETS).join(", ")}.`,
        });
      }
    }
    if (node.children !== undefined && !Array.isArray(node.children))
      errors.push({ path: `${path}.children`, message: "Must be an array." });

    const unknown = Object.keys(node).filter((k) => !KNOWN_KEYS.has(k));
    if (unknown.length)
      warnings.push({ path, message: `Unknown key(s) will be kept but unused: ${unknown.join(", ")}.` });

    if (isStrArr(node.assignedPersonIds)) {
      node.assignedPersonIds.forEach((pid) => {
        if (!personSet.has(pid))
          warnings.push({ path: `${path}.assignedPersonIds`, message: `Person id "${pid}" does not exist in People.` });
      });
    }

    // value rules
    const kids = Array.isArray(node.children) ? (node.children as unknown[]) : [];
    const isLeaf = kids.length === 0;
    if (!isLeaf) {
      for (const k of ["value", "area", "factor1", "factor2", "valueType"] as const) {
        if (node[k] !== undefined)
          warnings.push({
            path: `${path}.${k}`,
            message: "Parents never store values (their number is the sum of their children). This field is ignored; remove it.",
          });
      }
    } else {
      if (node.area !== undefined)
        warnings.push({ path: `${path}.area`, message: 'Deprecated. Use "value" instead.' });
      const typeId = isStr(node.valueType) && VALUE_PRESETS[node.valueType] ? node.valueType : defaultTypeId;
      const def = VALUE_PRESETS[typeId] ?? VALUE_PRESETS.area;
      const f1 = node.factor1, f2 = node.factor2;
      if ((f1 !== undefined || f2 !== undefined) && !hasFactors(def)) {
        warnings.push({
          path: `${path}.factor1`,
          message: `Type "${def.label}" has no factors. Only Area (Length × Breadth) and Cost (Quantity × Rate) do. Remove factor1/factor2.`,
        });
      }
      if (typeof f1 === "number" && typeof f2 === "number") {
        const v = typeof node.value === "number" ? node.value : typeof node.area === "number" ? node.area : undefined;
        const product = f1 * f2;
        if (v === undefined) {
          warnings.push({ path: `${path}.value`, message: `Both factors are set but "value" is missing. Set value = ${product}.` });
        } else if (Math.abs(product - v) > 1e-6 * Math.max(1, Math.abs(v))) {
          warnings.push({
            path: `${path}.value`,
            message: `value (${v}) ≠ factor1 × factor2 (${product}). The app shows "value", so the factors will look wrong.`,
          });
        }
      }
    }

    kids.forEach((c, i) => walk(c, `${path}.children[${i}]`, id));
  };
  walk(parsed, "(root)", parentOf.get(nodeId) ?? null);

  // 4 ── relations (same-level only, targets must exist)
  const finalNode = (id: string): ProcessNode | undefined => inside.get(id) ?? outsideNodes.get(id);
  const labelOf = (id: string) => finalNode(id)?.label ?? id;

  inside.forEach((node, id) => {
    const base = `"${node.label ?? id}"`;
    for (const k of ["successors", "predecessors"] as const) {
      const list = isStrArr(node[k]) ? node[k]! : [];
      const seen = new Set<string>();
      for (const target of list) {
        const p = `${base}.${k}`;
        if (seen.has(target)) {
          warnings.push({ path: p, message: `"${target}" listed twice.` });
          continue;
        }
        seen.add(target);
        if (target === id) {
          errors.push({ path: p, message: "A process cannot be its own predecessor/successor." });
        } else if (!parentOf.has(target)) {
          errors.push({ path: p, message: `Unknown id "${target}". It must be a sibling id that exists in the document.` });
        } else if (parentOf.get(target) !== parentOf.get(id)) {
          errors.push({
            path: p,
            message: `"${labelOf(target)}" is not a sibling of "${node.label}". Relations are same-level only.`,
          });
        } else {
          const other = finalNode(target);
          const back = k === "successors" ? other?.predecessors : other?.successors;
          if (!back?.includes(id)) {
            warnings.push({
              path: p,
              message: `"${labelOf(target)}" does not list "${node.label}" on its ${k === "successors" ? "predecessors" : "successors"}. Arrows use "successors"; keep both sides in sync.`,
            });
          }
        }
      }
    }
  });

  // 5 ── outside nodes that point at ids this edit removes
  const removed = [...oldIds].filter((id) => !inside.has(id));
  if (removed.length) {
    outsideNodes.forEach((n) => {
      const bad = [...(n.successors ?? []), ...(n.predecessors ?? [])].filter((id) => removed.includes(id));
      if (bad.length)
        warnings.push({
          path: `"${n.label}"`,
          message: `Linked to removed process(es); those links will be cleaned up when you apply.`,
        });
    });
  }

  return { ok: errors.length === 0, errors, warnings, cleaned };
}

/** The prompt for "Copy for AI". */
export function buildAiGuide(opts: {
  nodeId: string;
  nodeLabel: string;
  currentJson: string;
  defaultTypeId: string;
  siblings: { id: string; label: string }[];
  persons: { id: string; name: string }[];
}): string {
  const types = Object.entries(VALUE_PRESETS)
    .map(([id, p]) => {
      const f = p.factorLabels ? `factors: factor1=${p.factorLabels[0]}, factor2=${p.factorLabels[1]}` : "no factors";
      return `  - "${id}": base unit "${p.unit || "none"}", ${f}`;
    })
    .join("\n");

  return `You are editing ONE process (and everything under it) in a hierarchical process diagram.
Do what the USER REQUEST says, then reply with the complete edited JSON object only:
no markdown fences, no commentary, no extra top-level wrapper.

USER REQUEST:
<<WRITE YOUR CHANGE HERE>>

=== NODE SHAPE ===
{
  "id": string,                       // unique in the WHOLE document
  "label": string,                    // required, non-empty
  "description"?: string,
  "important"?: boolean,
  "successors"?: string[],            // ids of SIBLINGS that come after this node
  "predecessors"?: string[],          // ids of SIBLINGS that come before this node
  "assignedPersonIds"?: string[],     // ids from PEOPLE below
  "value"?: number,                   // LEAF ONLY, in the BASE unit of its type
  "valueType"?: string,               // LEAF ONLY, one of the type ids below
  "factor1"?: number, "factor2"?: number,   // LEAF ONLY
  "children"?: [ ...nodes with this same shape ]
}

=== RULES (the JSON is rejected if any of these are broken) ===
1. Keep the top-level "id" EXACTLY "${opts.nodeId}".
2. Every "id" must be unique. Keep existing ids. New nodes need new unique ids like "node-new-1". Never reuse an id that is not in the JSON below.
3. "label" must be a non-empty string. Do NOT put numbers in labels ("1. Design" is wrong; numbering is automatic).
4. Numbers (value, factor1, factor2, width, height) must be non-negative JSON numbers, not strings, not "12 m²".
5. Only LEAF nodes (no children) may have value, valueType, factor1, factor2. Parents never store values; their number is the sum of their children. Delete "value" from any node that gets children.
6. Relations are SAME-LEVEL ONLY: successors/predecessors may only contain ids of siblings (same parent). Never reference a parent, child, or a node in another branch. No self-references.
7. Keep relations symmetric: if A.successors contains B, then B.predecessors must contain A.
8. If you delete a node, also remove its id from every successors/predecessors list.
9. Keep "children" as an array (use [] or omit when empty). Keep array order; it is the display order.
10. Valid JSON only: double quotes, no trailing commas, no comments.

=== VALUES AND UNITS ===
Stored numbers are ALWAYS in the BASE unit of the type, never the displayed unit.
Value types (valueType must be one of these ids; if omitted, the default "${opts.defaultTypeId}" applies):
${types}
- Area base is m². 1 ft² = 0.09290304 m². Cost base is ₹ (1 $ = 83.3333 ₹).
- For Area, factors are in metres: value MUST equal factor1 × factor2 (e.g. 4 × 3 → "value": 12).
- For Cost, value MUST equal factor1 × factor2 (Quantity × Rate).
- If you change a factor, recompute "value". If you change "value" and keep factors, scale both factors by the same k = sqrt(newValue / oldValue).
- Volume, Length, Weight and Count have NO factors; do not add factor1/factor2.
- Do not use the legacy "area" field; use "value".

=== COMMON MISTAKES ===
- Changing the top-level id.
- Value on a parent node.
- value ≠ factor1 × factor2.
- Values in ft² / $ instead of base units.
- Relations to ids that do not exist or are not siblings.
- Duplicate ids when copying a node (give copies new ids and remove their relations).
- Wrapping the reply in \`\`\` fences or adding explanations.

=== CONTEXT (read-only; do not return) ===
Siblings of "${opts.nodeLabel}" (valid relation targets for the top node):
${opts.siblings.length ? opts.siblings.map((s) => `  - ${s.id}  "${s.label}"`).join("\n") : "  (none)"}
PEOPLE (valid assignedPersonIds):
${opts.persons.length ? opts.persons.map((p) => `  - ${p.id}  "${p.name}"`).join("\n") : "  (none)"}

=== EXAMPLE OF A VALID LEAF ===
{ "id": "node-new-1", "label": "Living room", "valueType": "area", "factor1": 5, "factor2": 4, "value": 20, "successors": ["node-new-2"] }

=== CURRENT JSON (edit this) ===
${opts.currentJson}
`;
}