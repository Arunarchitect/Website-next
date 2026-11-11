"use client";

import { Fragment, useMemo, useState } from "react";
import { EstimateItem } from "../types";
import { EstimatePdfMeta, generateEstimatePdf } from "../estimatePdf";

interface TreeNode {
  item: EstimateItem;
  children: TreeNode[];
}

export const formatINR = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatQty = (n: number | null): string => {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
};

const buildTree = (items: EstimateItem[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  items.forEach((item) => map.set(item.hierarchy, { item, children: [] }));
  const roots: TreeNode[] = [];
  items.forEach((item) => {
    const node = map.get(item.hierarchy)!;
    const parent = item.parent ? map.get(item.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
};

const collectVisible = (nodes: TreeNode[], expanded: Set<string>, out: EstimateItem[]) => {
  nodes.forEach((n) => {
    out.push(n.item);
    if (n.children.length > 0 && expanded.has(n.item.hierarchy)) {
      collectVisible(n.children, expanded, out);
    }
  });
};

const Chevron = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

const PrinterIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" />
  </svg>
);

interface Props {
  items: EstimateItem[];
  total: number;
  meta: EstimatePdfMeta;
}

export default function EstimateTree({ items, total, meta }: Props) {
  const roots = useMemo(() => buildTree(items), [items]);

  const parentKeys = useMemo(
    () => new Set(items.filter((i) => i.parent !== null).map((i) => i.parent as string)),
    [items]
  );

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(roots.filter((r) => r.children.length > 0).map((r) => r.item.hierarchy))
  );
  const [printing, setPrinting] = useState(false);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const expandAll = () => setExpanded(new Set(parentKeys));
  const collapseAll = () =>
    setExpanded(new Set(roots.filter((r) => r.children.length > 0).map((r) => r.item.hierarchy)));

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const rows: EstimateItem[] = [];
      collectVisible(roots, expanded, rows);
      const detailed = Array.from(parentKeys).every((k) => expanded.has(k));
      await generateEstimatePdf(meta, rows, total, detailed);
    } catch (e) {
      console.error("PDF export failed:", e);
      window.alert("Could not generate the PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const renderNode = (node: TreeNode) => {
    const it = node.item;
    const hasKids = node.children.length > 0;
    const open = expanded.has(it.hierarchy);
    const showMeta = !it.is_sum;

    const qty = showMeta ? formatQty(it.quantity) : "";
    const rate = showMeta && it.rate ? formatINR(it.rate) : "";
    const rowTotal = it.total ? formatINR(it.total) : "–";

    return (
      <Fragment key={it.hierarchy}>
        <div
          className={`est-row ${it.is_sum ? "est-row-sum" : "est-row-leaf"} est-lvl-${Math.min(it.level, 3)} ${
            hasKids ? "est-row-clickable" : ""
          }`}
          role="row"
          onClick={hasKids ? () => toggle(it.hierarchy) : undefined}
        >
          <div className="est-cell est-id">{it.identification}</div>

          <div className="est-cell est-name" style={{ paddingLeft: `calc(var(--est-indent) * ${it.level})` }}>
            {hasKids ? (
              <button
                type="button"
                className="est-toggle"
                aria-expanded={open}
                aria-label={open ? "Collapse" : "Expand"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(it.hierarchy);
                }}
              >
                <Chevron />
              </button>
            ) : (
              <span className="est-toggle-spacer" />
            )}
            <span className="est-idtag">{it.identification}</span>
            <span className="est-name-text" title={it.description || it.name}>
              {it.name}
            </span>
          </div>

          <div className={`est-cell est-qty ${qty ? "" : "est-empty"}`} data-label="Qty">
            {qty || "–"}
          </div>
          <div className={`est-cell est-unit ${showMeta && it.unit ? "" : "est-empty"}`} data-label="Unit">
            {showMeta && it.unit ? it.unit : "–"}
          </div>
          <div className={`est-cell est-rate ${rate ? "" : "est-empty"}`} data-label="Rate">
            {rate || "–"}
          </div>
          <div className="est-cell est-total">{rowTotal}</div>
        </div>

        {hasKids && open && node.children.map(renderNode)}
      </Fragment>
    );
  };

  return (
    <div className="est-tree">
      <div className="est-tree-toolbar">
        <button type="button" className="est-btn est-btn-sm" onClick={expandAll}>
          Expand all
        </button>
        <button type="button" className="est-btn est-btn-sm" onClick={collapseAll}>
          Collapse
        </button>
        <button
          type="button"
          className="est-btn est-btn-sm est-print-btn"
          onClick={handlePrint}
          disabled={printing}
        >
          <PrinterIcon /> {printing ? "Preparing…" : "Print PDF"}
        </button>
      </div>

      <div className="est-table-scroll">
        <div className="est-table" role="table">
          <div className="est-row est-head" role="row">
            <div className="est-cell est-id">ID</div>
            <div className="est-cell est-name">Name</div>
            <div className="est-cell est-qty">Qty</div>
            <div className="est-cell est-unit">Unit</div>
            <div className="est-cell est-rate">Rate (INR)</div>
            <div className="est-cell est-total">Total (INR)</div>
          </div>

          {roots.map(renderNode)}

          <div className="est-row est-foot" role="row">
            <div className="est-cell est-id" />
            <div className="est-cell est-name">
              <span className="est-toggle-spacer" />
              <span className="est-name-text">Grand total</span>
            </div>
            <div className="est-cell est-qty est-empty" />
            <div className="est-cell est-unit est-empty" />
            <div className="est-cell est-rate est-empty" />
            <div className="est-cell est-total">₹ {formatINR(total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}