"use client";

import { useMemo, useState } from "react";
import type { ProcessNode, Person, ValueDef } from "@/app/process/lib/process-utils";
import {
  getNodeValue,
  groupLeavesByType,
  allRows,
  findNodeById,
  VALUE_PRESETS,
  resolveUnit,
} from "@/app/process/lib/process-utils";

type ReportPdfButtonProps = {
  rootNode: ProcessNode | null;
  /** Currently-selected node id on the canvas ("root" or a real id). */
  selectedNodeId?: string | null;
  completed: Set<string>;
  persons: Person[];
};

type FlatEntry = { node: ProcessNode; level: number; numberPath: number[] };
type ReportMode = "process" | "space";
type ReportUnit = "sqft" | "sqm";
type BlockMode = "blocks" | "one-block";

type RGB = [number, number, number];

const SQFT_PER_SQM = 10.7639104;
const MM_PER_PT = 0.3528;
const LINE_MULT = 1.15;

const RED: RGB = [190, 30, 30];
const GRAY: RGB = [110, 110, 110];
const LIGHT_GRAY: RGB = [160, 160, 160];
const GREEN: RGB = [30, 130, 60];
const TEAL: RGB = [15, 118, 110];
const INK: RGB = [20, 20, 20];
const AMBER: RGB = [180, 83, 9];
const RULE_GRAY: RGB = [200, 200, 200];

/* ─── Formatting helpers ─────────────────────────────────────── */

function roundTo(n: number, p: number): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

function fmtNum(n: number, p = 1): string {
  const r = roundTo(n, p);
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(p);
}

function fmtRate(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

function fmtCost(amount: number, symbol: string): string {
  if (amount >= 1e7) return `${symbol} ${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `${symbol} ${(amount / 1e5).toFixed(2)} L`;
  return `${symbol} ${fmtRate(amount)}`;
}

/**
 * Resolve the ValueDef a given leaf renders under, the same way the
 * rest of the app does: the leaf's own `valueType` if it has one,
 * otherwise fall back to the Area preset (this report is area-first).
 */
function resolveLeafDef(leaf: ProcessNode): ValueDef {
  const defId = leaf.valueType;
  return defId && VALUE_PRESETS[defId] ? VALUE_PRESETS[defId] : VALUE_PRESETS.area;
}

/**
 * Which unit symbol a leaf's value/factors should be displayed in for
 * this report. For Area-type leaves this follows the report-wide
 * sqft/sqm toggle; other value types just use their own base unit
 * (the space report doesn't offer a unit picker for those).
 */
function chosenSymbolForLeaf(def: ValueDef, reportUnit: ReportUnit): string {
  return def.id === "area" ? (reportUnit === "sqft" ? "ft²" : "m²") : def.unit;
}

/**
 * Given a leaf node and the report's chosen unit ("sqft" | "sqm"),
 * return the factor symbol that applies (e.g. "ft" for sqft, "m" for
 * sqm, "" for value types without factors).
 */
function factorSymbolForLeaf(leaf: ProcessNode, reportUnit: ReportUnit): string {
  const def = resolveLeafDef(leaf);
  if (!def.factorLabels) return "";
  const chosen = chosenSymbolForLeaf(def, reportUnit);
  const opt = resolveUnit(def, chosen);
  return opt.factorSymbol ?? def.factorUnit ?? "";
}

/**
 * Convert a leaf's stored factor1/factor2 (always in the value type's
 * BASE unit, e.g. metres) into the unit this report is displaying —
 * e.g. feet when the report unit is sqft.
 */
function displayFactorsForLeaf(
  leaf: ProcessNode,
  reportUnit: ReportUnit
): { f1: number | null; f2: number | null } {
  if (leaf.factor1 === undefined || leaf.factor2 === undefined) {
    return { f1: null, f2: null };
  }
  const def = resolveLeafDef(leaf);
  if (!def.factorLabels) {
    return { f1: leaf.factor1, f2: leaf.factor2 };
  }
  const chosen = chosenSymbolForLeaf(def, reportUnit);
  const opt = resolveUnit(def, chosen);
  const k = opt.factorFromBase ?? 1;
  return { f1: leaf.factor1 * k, f2: leaf.factor2 * k };
}

/* ─── Tree helpers ───────────────────────────────────────────── */

function flattenTree(root: ProcessNode): FlatEntry[] {
  const out: FlatEntry[] = [];
  const walk = (node: ProcessNode, level: number, numberPath: number[]) => {
    (node.children ?? []).forEach((child, i) => {
      const path = [...numberPath, i + 1];
      out.push({ node: child, level, numberPath: path });
      walk(child, level + 1, path);
    });
  };
  walk(root, 1, []);
  return out;
}

type SelectEntry = { node: ProcessNode; level: number; ancestorExcluded: boolean };

function flattenForSelection(root: ProcessNode, excluded: Set<string>): SelectEntry[] {
  const out: SelectEntry[] = [];
  const walk = (node: ProcessNode, level: number, ancestorExcluded: boolean) => {
    (node.children ?? []).forEach((child) => {
      const selfExcluded = excluded.has(child.id);
      out.push({ node: child, level, ancestorExcluded });
      walk(child, level + 1, ancestorExcluded || selfExcluded);
    });
  };
  walk(root, 0, false);
  return out;
}

function collectSubtreeIds(node: ProcessNode): string[] {
  const ids: string[] = [node.id];
  (node.children ?? []).forEach((c) => ids.push(...collectSubtreeIds(c)));
  return ids;
}

function isNodeComplete(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return completed.has(node.id);
  return children.every((c) => isNodeComplete(c, completed));
}

function headingStyle(level: number) {
  if (level === 1) return { size: 14, weight: "bold" as const, gapBefore: 5, gapAfter: 1.5 };
  if (level === 2) return { size: 12, weight: "bold" as const, gapBefore: 3.5, gapAfter: 1 };
  if (level === 3) return { size: 10.5, weight: "bold" as const, gapBefore: 2.5, gapAfter: 0.8 };
  return { size: 10, weight: "normal" as const, gapBefore: 2, gapAfter: 0.6 };
}

/* ─── Component ──────────────────────────────────────────────── */

export function ReportPdfButton({
  rootNode,
  selectedNodeId,
  completed,
  persons,
}: ReportPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ReportMode>("process");

  // Process report options
  const [includeIndex, setIncludeIndex] = useState(true);
  const [indexDepth, setIndexDepth] = useState(2);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeCompletion, setIncludeCompletion] = useState(true);
  const [includeAssigned, setIncludeAssigned] = useState(true);
  const [filterPersonIds, setFilterPersonIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [excludeSearch, setExcludeSearch] = useState("");
  const [showExcludePanel, setShowExcludePanel] = useState(false);
  const [useOriginalHeader, setUseOriginalHeader] = useState(true);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  // Space report options
  const [spaceUnit, setSpaceUnit] = useState<ReportUnit>("sqft");
  const [includeCoverTotals, setIncludeCoverTotals] = useState(true);
  const [includeBreakdown, setIncludeBreakdown] = useState(true);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [includeNotesColumn, setIncludeNotesColumn] = useState(true);
  const [customNote, setCustomNote] = useState("");

  // Cost toggle + inputs
  const [showCost, setShowCost] = useState(false);
  const [rateInput, setRateInput] = useState<string>("");
  const [currencySymbol, setCurrencySymbol] = useState<string>("Rs.");

  // Wall / circulation — default 10% and 15%. Blank = off. "0" = zero.
  const [wallPctInput, setWallPctInput] = useState<string>("10");
  const [circPctInput, setCircPctInput] = useState<string>("15");

  // Which subtree the Space report runs against.
  //   "root"    → the whole document
  //   <node id> → that node and everything under it
  const [reportScopeId, setReportScopeId] = useState<string>("root");

  // How the report treats the tree:
  //   "blocks"    → each top-level child of the scope root is its own block
  //                 with its own wall / circulation / cost.
  //   "one-block" → the whole scope is one block; wall and circulation are
  //                 applied once to the grand total.
  const [blockMode, setBlockMode] = useState<BlockMode>("blocks");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const maxLevel = rootNode
    ? Math.max(1, ...flattenTree(rootNode).map((e) => e.level))
    : 1;

  const togglePersonFilter = (id: string) => {
    setFilterPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExcluded = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectionEntries = useMemo(
    () => (rootNode ? flattenForSelection(rootNode, excludedIds) : []),
    [rootNode, excludedIds]
  );

  const visibleSelectionEntries = useMemo(() => {
    const term = excludeSearch.trim().toLowerCase();
    if (!term) return selectionEntries;
    return selectionEntries.filter(
      (e) =>
        e.node.label.toLowerCase().includes(term) ||
        (e.node.description ?? "").toLowerCase().includes(term)
    );
  }, [selectionEntries, excludeSearch]);

  const selectAll = () => setExcludedIds(new Set());
  const unselectAll = () => setExcludedIds(new Set(selectionEntries.map((e) => e.node.id)));

  const includeSubtree = (node: ProcessNode) => {
    const ids = collectSubtreeIds(node);
    setExcludedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const excludeSubtree = (node: ProcessNode) => {
    const ids = collectSubtreeIds(node);
    setExcludedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  /* ─── Generate ───────────────────────────────────────────── */

  const generate = async () => {
    if (!rootNode) return;
    setBusy(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({ unit: "mm", format: "a4" });

      // The node the Space report should run against.
      const scopeNode =
        reportScopeId === "root"
          ? rootNode
          : findNodeById(rootNode, reportScopeId) ?? rootNode;

      if (mode === "space") {
        const wallPct = wallPctInput.trim() === "" ? null : Number(wallPctInput);
        const circPct = circPctInput.trim() === "" ? null : Number(circPctInput);
        const rate = !showCost || rateInput.trim() === "" ? null : Number(rateInput);

        renderSpaceReport(doc, scopeNode, {
          unit: spaceUnit,
          includeCoverTotals,
          includeBreakdown,
          includeDimensions,
          includeNotesColumn,
          wallPct:
            wallPct !== null && Number.isFinite(wallPct) && wallPct >= 0
              ? wallPct
              : null,
          circPct:
            circPct !== null && Number.isFinite(circPct) && circPct >= 0
              ? circPct
              : null,
          showCost,
          ratePerSqft:
            rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null,
          currency: currencySymbol.trim() || "Rs.",
          blockMode,
          customNote,
        });
      } else {
        // The Process report ignores scope; it always reports the whole
        // document with its own include/exclude filter.
        renderProcessReport(doc, rootNode, {
          includeIndex,
          indexDepth,
          includeDescriptions,
          includeCompletion,
          includeAssigned,
          filterPersonIds,
          excludedIds,
          persons,
          useOriginalHeader,
          customTitle,
          customDescription,
          completed,
        });
      }

      const base = (scopeNode.label || "report")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      const suffix = mode === "space" ? "-space-report.pdf" : "-report.pdf";
      doc.save(base + suffix);
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate PDF.");
    } finally {
      setBusy(false);
    }
  };

  /* ─── JSX ────────────────────────────────────────────────── */

  return (
    <>
      <button
        onClick={() => {
          setError("");
          setExcludeSearch("");
          setCustomTitle(rootNode?.label ?? "");
          setCustomDescription(rootNode?.description ?? "");
          setWallPctInput("10");
          setCircPctInput("15");
          setBlockMode("blocks");
          setReportScopeId(
            selectedNodeId && selectedNodeId !== "root" ? selectedNodeId : "root"
          );
          setOpen(true);
        }}
        title="Export a formatted PDF report"
        className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm rounded-lg font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0"
      >
        Report PDF
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold mb-3 text-gray-900">
              Export PDF Report
            </h3>

            {/* Mode picker */}
            <div className="flex gap-2 bg-gray-100 rounded-xl p-1 mb-4">
              <button
                onClick={() => setMode("process")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "process"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Process report
              </button>
              <button
                onClick={() => setMode("space")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "space"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Space / Area report
              </button>
            </div>

            {/* ─── SPACE REPORT OPTIONS ─── */}
            {mode === "space" && (
              <>
                <p className="text-xs text-gray-500 mb-4">
                  A formatted estimate. Uses each node&apos;s{" "}
                  <span className="font-medium">value</span> as its area — parents show
                  the Σ of their children.
                </p>

                {/* Scope picker — which subtree the report covers. */}
                {rootNode && (rootNode.children?.length ?? 0) > 1 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Report covers
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNodeId && selectedNodeId !== "root" && (
                        <button
                          type="button"
                          onClick={() => setReportScopeId(selectedNodeId)}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            reportScopeId === selectedNodeId
                              ? "bg-indigo-600 text-white"
                              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          }`}
                          title="Report only the selected node and its subprocesses"
                        >
                          Selected:{" "}
                          {findNodeById(rootNode, selectedNodeId)?.label ?? "node"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setReportScopeId("root")}
                        className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                          reportScopeId === "root"
                            ? "bg-indigo-600 text-white"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                        title="Report the whole document"
                      >
                        Whole document
                      </button>
                      {(rootNode.children ?? [])
                        .filter((c) => c.id !== selectedNodeId)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setReportScopeId(c.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                              reportScopeId === c.id
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Only the picked subtree is included in the report.
                    </p>
                  </div>
                )}

                {/* Block mode picker */}
                {rootNode && (rootNode.children?.length ?? 0) > 1 && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Treat the hierarchy as
                    </label>
                    <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => setBlockMode("blocks")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                          blockMode === "blocks"
                            ? "bg-white shadow-sm text-gray-900"
                            : "text-gray-500"
                        }`}
                        title="Each top-level branch is its own block, with its own wall / circulation / cost"
                      >
                        Separate blocks
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockMode("one-block")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                          blockMode === "one-block"
                            ? "bg-white shadow-sm text-gray-900"
                            : "text-gray-500"
                        }`}
                        title="Treat the whole scope as one block; wall and circulation applied once"
                      >
                        One block
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {blockMode === "blocks"
                        ? "Each top-level branch gets its own wall and circulation."
                        : "The whole scope is a single unit; wall and circulation apply to the grand total."}
                    </p>
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit for this report
                  </label>
                  <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setSpaceUnit("sqft")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                        spaceUnit === "sqft"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      sqft (m² alongside)
                    </button>
                    <button
                      onClick={() => setSpaceUnit("sqm")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                        spaceUnit === "sqm"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      m² (sqft alongside)
                    </button>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Wall allowance %
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={wallPctInput}
                      onChange={(e) => setWallPctInput(e.target.value)}
                      placeholder="Blank to skip"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Default 10%. Blank = off.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Circulation %
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={circPctInput}
                      onChange={(e) => setCircPctInput(e.target.value)}
                      placeholder="Blank to skip"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Default 15%. Blank = off.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showCost}
                    onChange={(e) => setShowCost(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show estimated construction cost
                </label>

                {showCost && (
                  <div className="mb-3 ml-6 grid grid-cols-[1fr_2fr] gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        placeholder="Rs."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Rate per sqft
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        placeholder="e.g. 2500"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Custom note (optional)
                  </label>
                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    rows={3}
                    placeholder="e.g. Revision 2 — areas updated after client meeting. Prepared for ..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Shown as a highlighted note on the first page. Line breaks are kept.
                  </p>
                </div>

                <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeCoverTotals}
                    onChange={(e) => setIncludeCoverTotals(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Include summary by block
                </label>
                <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeBreakdown}
                    onChange={(e) => setIncludeBreakdown(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Include area breakdown by type
                </label>
                <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeDimensions}
                    onChange={(e) => setIncludeDimensions(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show dimensions (L × B, leaves only)
                </label>
                <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeNotesColumn}
                    onChange={(e) => setIncludeNotesColumn(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show notes column
                </label>
              </>
            )}

            {/* ─── PROCESS REPORT OPTIONS ─── */}
            {mode === "process" && (
              <>
                <div className="mb-4 pt-1">
                  <label className="flex items-center gap-2 mb-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={useOriginalHeader}
                      onChange={(e) => setUseOriginalHeader(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Use original title &amp; description
                  </label>

                  {!useOriginalHeader && (
                    <div className="ml-6 flex flex-col gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Custom report title
                        </label>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="e.g. Q3 Review — Design Challenge"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Custom report description
                        </label>
                        <textarea
                          value={customDescription}
                          onChange={(e) => setCustomDescription(e.target.value)}
                          rows={2}
                          placeholder="Optional subtitle or note shown under the title"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Leave either field blank to fall back to the original value
                        for that field only.
                      </p>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeIndex}
                    onChange={(e) => setIncludeIndex(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Include table of contents
                </label>

                {includeIndex && (
                  <div className="mb-3 ml-6">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Include levels up to
                    </label>
                    <select
                      value={indexDepth}
                      onChange={(e) => setIndexDepth(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800"
                    >
                      {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => (
                        <option key={lvl} value={lvl}>
                          Level {lvl} {lvl === 1 ? "(top-level only)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeDescriptions}
                    onChange={(e) => setIncludeDescriptions(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Include descriptions
                </label>

                <label className="flex items-center gap-2 mb-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeCompletion}
                    onChange={(e) => setIncludeCompletion(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Show completion status checkbox
                </label>

                <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={includeAssigned}
                    onChange={(e) => setIncludeAssigned(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Include &quot;Assigned: …&quot; labels
                </label>

                <div className="mb-2 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      type="button"
                      onClick={() => setShowExcludePanel((v) => !v)}
                      className="text-sm font-medium text-gray-700 flex items-center gap-1"
                    >
                      {showExcludePanel ? "▾" : "▸"} Include / Exclude processes
                      {excludedIds.size > 0 && (
                        <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                          {excludedIds.size} excluded
                        </span>
                      )}
                    </button>
                  </div>

                  {showExcludePanel && (
                    <>
                      <p className="text-xs text-gray-400 mb-2">
                        Uncheck a process to leave its own heading and content out of
                        the report. Its numbering slot is preserved for any of its
                        subprocesses that stay checked.
                      </p>

                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={excludeSearch}
                          onChange={(e) => setExcludeSearch(e.target.value)}
                          placeholder="Search processes to include/exclude…"
                          className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                        />
                        {excludeSearch && (
                          <button
                            type="button"
                            onClick={() => setExcludeSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold"
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={selectAll}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Select all
                        </button>
                        <span className="text-gray-200">|</span>
                        <button
                          type="button"
                          onClick={unselectAll}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          Unselect all
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 border border-gray-100 rounded-lg p-2">
                        {visibleSelectionEntries.length === 0 && (
                          <div className="text-xs text-gray-400 italic px-2 py-3">
                            No processes match &ldquo;{excludeSearch}&rdquo;.
                          </div>
                        )}

                        {visibleSelectionEntries.map(({ node, level, ancestorExcluded }) => {
                          const selfExcluded = excludedIds.has(node.id);
                          const keptDespiteParent = ancestorExcluded && !selfExcluded;
                          const hasChildren = (node.children?.length ?? 0) > 0;
                          return (
                            <div
                              key={node.id}
                              style={{ paddingLeft: level * 14 }}
                              className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-gray-50"
                            >
                              <label
                                className={`flex items-center gap-2 flex-1 min-w-0 text-sm cursor-pointer ${
                                  selfExcluded
                                    ? "text-red-500"
                                    : keptDespiteParent
                                      ? "text-teal-700"
                                      : "text-gray-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!selfExcluded}
                                  onChange={() => toggleExcluded(node.id)}
                                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 shrink-0"
                                />
                                <span className="truncate">{node.label}</span>
                                {keptDespiteParent && (
                                  <span className="shrink-0 text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                                    kept — parent excluded
                                  </span>
                                )}
                              </label>

                              {hasChildren && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => includeSubtree(node)}
                                    title={`Include "${node.label}" and every subprocess beneath it`}
                                    className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded"
                                  >
                                    All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => excludeSubtree(node)}
                                    title={`Exclude "${node.label}" and every subprocess beneath it`}
                                    className="text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1.5 py-0.5 rounded"
                                  >
                                    None
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="mb-2 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Filter by assigned person (optional)
                    </label>
                    {filterPersonIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterPersonIds(new Set())}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    Leave empty to include everything. Select one or more to only print
                    processes directly assigned to them.
                  </p>

                  {persons.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2">No people added yet.</div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                      {persons.map((p) => (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm cursor-pointer ${
                            filterPersonIds.has(p.id)
                              ? "bg-teal-50 text-teal-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={filterPersonIds.has(p.id)}
                            onChange={() => togglePersonFilter(p.id)}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="mt-3 mb-1 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-10 px-4 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={generate}
                disabled={busy || !rootNode}
                className="h-10 px-4 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? "Generating…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   Renderers
   ============================================================ */

type ProcessReportOpts = {
  includeIndex: boolean;
  indexDepth: number;
  includeDescriptions: boolean;
  includeCompletion: boolean;
  includeAssigned: boolean;
  filterPersonIds: Set<string>;
  excludedIds: Set<string>;
  persons: Person[];
  useOriginalHeader: boolean;
  customTitle: string;
  customDescription: string;
  completed: Set<string>;
};

function renderProcessReport(
  doc: import("jspdf").jsPDF,
  rootNode: ProcessNode,
  opts: ProcessReportOpts
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 16;
  const marginBottom = 16;
  const contentWidth = pageWidth - marginX * 2;
  const contentBottom = pageHeight - marginBottom;

  const {
    includeIndex,
    indexDepth,
    includeDescriptions,
    includeCompletion,
    includeAssigned,
    filterPersonIds,
    excludedIds,
    persons,
    useOriginalHeader,
    customTitle,
    customDescription,
    completed,
  } = opts;

  const allEntries = flattenTree(rootNode);
  const idToPath = new Map<string, string>();
  allEntries.forEach((e) => idToPath.set(e.node.id, e.numberPath.join(".")));

  const isFiltering = filterPersonIds.size > 0;

  const entries = allEntries.filter((e) => {
    if (excludedIds.has(e.node.id)) return false;
    if (
      isFiltering &&
      !(e.node.assignedPersonIds ?? []).some((pid) => filterPersonIds.has(pid))
    ) {
      return false;
    }
    return true;
  });

  const filterNames = persons.filter((p) => filterPersonIds.has(p.id)).map((p) => p.name);
  const noMatches = isFiltering && entries.length === 0;

  const headerTitle = useOriginalHeader
    ? rootNode.label || "Process Report"
    : customTitle.trim() || rootNode.label || "Process Report";
  const headerDescription = useOriginalHeader
    ? rootNode.description
    : customDescription.trim();

  const lineHeightFor = (fontSize: number) => fontSize * MM_PER_PT * LINE_MULT;

  const wrap = (
    text: string,
    fontSize: number,
    weight: "normal" | "bold" | "italic",
    width: number
  ) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text, width) as string[];
  };

  const drawLines = (
    lines: string[],
    x: number,
    yStart: number,
    fontSize: number,
    weight: "normal" | "bold" | "italic",
    opts2: {
      color?: RGB;
      underline?: boolean;
      align?: "left" | "center";
    } = {}
  ) => {
    let y = yStart;
    doc.setFont("helvetica", weight);
    doc.setFontSize(fontSize);
    const [r, g, b] = opts2.color ?? INK;
    doc.setTextColor(r, g, b);
    lines.forEach((line) => {
      const drawX = opts2.align === "center" ? pageWidth / 2 : x;
      doc.text(line, drawX, y, opts2.align === "center" ? { align: "center" } : undefined);
      if (opts2.underline) {
        const w = doc.getTextWidth(line);
        const startX = opts2.align === "center" ? drawX - w / 2 : x;
        const underlineY = y + fontSize * MM_PER_PT * 0.12;
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.15);
        doc.line(startX, underlineY, startX + w, underlineY);
      }
      y += lineHeightFor(fontSize);
    });
    doc.setTextColor(...INK);
    doc.setDrawColor(0);
    return y;
  };

  let resolvedPageOfEntry = new Map<string, number>();

  const renderDocument = (draw: boolean) => {
    let page = 1;
    let y = marginTop;
    const pageOfEntry = new Map<string, number>();

    const drawFooter = (num: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(140);
      doc.text(String(num), pageWidth / 2, pageHeight - 9, { align: "center" });
      doc.setTextColor(...INK);
    };

    const ensureSpace = (needed: number) => {
      if (y + needed > contentBottom) {
        if (draw) {
          drawFooter(page);
          doc.addPage();
        }
        page += 1;
        y = marginTop;
      }
    };

    // Header
    const titleLines = wrap(headerTitle, 17, "bold", contentWidth);
    const titleHeight = titleLines.length * lineHeightFor(17);
    ensureSpace(titleHeight);
    if (draw) y = drawLines(titleLines, marginX, y, 17, "bold");
    else y += titleHeight;

    if (isFiltering) {
      const filterLine = `Filtered for: ${filterNames.join(", ")}`;
      const filterLines = wrap(filterLine, 11, "italic", contentWidth);
      const filterHeight = filterLines.length * lineHeightFor(11);
      ensureSpace(filterHeight + 0.5);
      y += 0.5;
      if (draw) y = drawLines(filterLines, marginX, y, 11, "italic", { color: TEAL });
      else y += filterHeight;
    }

    if (headerDescription) {
      const descLines = wrap(headerDescription, 9.5, "normal", contentWidth);
      const descHeight = descLines.length * lineHeightFor(9.5);
      ensureSpace(descHeight + 1);
      y += 1;
      if (draw) y = drawLines(descLines, marginX, y, 9.5, "normal", { color: GRAY });
      else y += descHeight;
    }

    const genLine = `Generated ${new Date().toLocaleDateString()}`;
    ensureSpace(lineHeightFor(8));
    if (draw) y = drawLines([genLine], marginX, y, 8, "normal", { color: GRAY });
    else y += lineHeightFor(8);

    if (includeCompletion) {
      const legendText =
        "Checked box legend: a checked box means the process has been completed / selected or have been supervised; a blank box means it has not been addressed.";
      const legendLines = wrap(legendText, 8.5, "italic", contentWidth);
      const legendHeight = legendLines.length * lineHeightFor(8.5);
      ensureSpace(legendHeight + 1);
      y += 1;
      if (draw) y = drawLines(legendLines, marginX, y, 8.5, "italic", { color: GRAY });
      else y += legendHeight;
    }

    y += 2.5;
    ensureSpace(2);
    if (draw) {
      doc.setDrawColor(210);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageWidth - marginX, y);
      doc.setDrawColor(0);
    }
    y += 4;

    if (includeIndex) {
      const tocLines = wrap("Table of Contents", 12, "bold", contentWidth);
      const tocHeight = tocLines.length * lineHeightFor(12);
      ensureSpace(tocHeight + 1);
      if (draw) y = drawLines(tocLines, marginX, y, 12, "bold");
      else y += tocHeight;
      y += 2;

      const tocEntries = entries.filter((e) => e.level <= indexDepth);
      for (const e of tocEntries) {
        const important = !!e.node.important;
        const fontSize = e.level === 1 ? 10 : 9;
        const weight: "normal" | "bold" = e.level === 1 ? "bold" : "normal";
        const indent = (e.level - 1) * 5;
        const color: RGB = important
          ? RED
          : e.level === 1
            ? INK
            : [70, 70, 70];
        const label = `${e.numberPath.join(".")}  ${e.node.label}`;
        const labelLines = wrap(label, fontSize, weight, contentWidth - indent - 12);
        const rowHeight = labelLines.length * lineHeightFor(fontSize);
        ensureSpace(rowHeight + 0.5);

        if (draw) {
          const pageStr = String(resolvedPageOfEntry.get(e.node.id) ?? "");
          doc.setFont("helvetica", weight);
          doc.setFontSize(fontSize);
          doc.setTextColor(...color);
          labelLines.forEach((line, i) => {
            doc.text(line, marginX + indent, y);
            if (important) {
              const w = doc.getTextWidth(line);
              const underlineY = y + fontSize * MM_PER_PT * 0.12;
              doc.setDrawColor(...color);
              doc.setLineWidth(0.15);
              doc.line(marginX + indent, underlineY, marginX + indent + w, underlineY);
            }
            if (i === labelLines.length - 1 && pageStr) {
              doc.text(pageStr, pageWidth - marginX, y, { align: "right" });
            }
            y += lineHeightFor(fontSize);
          });
          doc.setDrawColor(0);
          doc.setTextColor(...INK);
        } else {
          y += rowHeight;
        }
        y += 0.5;
      }

      y += 3;
      ensureSpace(2);
      if (draw) {
        doc.setDrawColor(210);
        doc.setLineWidth(0.2);
        doc.line(marginX, y, pageWidth - marginX, y);
        doc.setDrawColor(0);
      }
      y += 4;
    }

    if (noMatches) {
      const notice = `No processes are currently assigned to ${filterNames.join(", ")}.`;
      const nLines = wrap(notice, 10, "italic", contentWidth);
      const nHeight = nLines.length * lineHeightFor(10);
      ensureSpace(nHeight + 3);
      if (draw) y = drawLines(nLines, marginX, y, 10, "italic", { color: GRAY });
      else y += nHeight;
      y += 3;
    }

    for (const entry of entries) {
      const { node, level } = entry;
      const style = headingStyle(level);
      const important = !!node.important;
      const titleColor: RGB = important ? RED : INK;
      const nodeTitleText = `${entry.numberPath.join(".")}  ${node.label}`;
      const nodeTitleLines = wrap(nodeTitleText, style.size, style.weight, contentWidth);
      const nodeTitleHeight = nodeTitleLines.length * lineHeightFor(style.size);

      ensureSpace(style.gapBefore + nodeTitleHeight);
      y += style.gapBefore;

      if (draw) {
        y = drawLines(nodeTitleLines, marginX, y, style.size, style.weight, {
          color: titleColor,
          underline: important,
        });
      } else {
        y += nodeTitleHeight;
      }

      pageOfEntry.set(node.id, page);
      y += style.gapAfter;

      if (includeCompletion) {
        const done = isNodeComplete(node, completed);
        const label = done ? "Checked" : "Not checked";
        const fontSize = 8.5;
        const boxSize = fontSize * MM_PER_PT * 0.95;
        const rowHeight = Math.max(lineHeightFor(fontSize), boxSize);

        ensureSpace(rowHeight + 0.6);

        if (draw) {
          const boxX = marginX;
          const boxY = y - boxSize * 0.85;

          if (done) {
            doc.setFillColor(...GREEN);
            doc.setDrawColor(...GREEN);
            doc.setLineWidth(0.25);
            doc.rect(boxX, boxY, boxSize, boxSize, "FD");
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.4);
            doc.line(
              boxX + boxSize * 0.22,
              boxY + boxSize * 0.55,
              boxX + boxSize * 0.42,
              boxY + boxSize * 0.76
            );
            doc.line(
              boxX + boxSize * 0.42,
              boxY + boxSize * 0.76,
              boxX + boxSize * 0.8,
              boxY + boxSize * 0.22
            );
          } else {
            doc.setDrawColor(...GRAY);
            doc.setLineWidth(0.25);
            doc.rect(boxX, boxY, boxSize, boxSize, "D");
          }
          doc.setDrawColor(0);
          doc.setLineWidth(0.2);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(fontSize);
          doc.setTextColor(...(done ? GREEN : GRAY));
          doc.text(label, boxX + boxSize + 2, y);
          doc.setTextColor(...INK);

          y += rowHeight;
        } else {
          y += rowHeight;
        }
        y += 0.6;
      }

      if (includeDescriptions && node.description) {
        const dLines = wrap(node.description, 9.5, "normal", contentWidth);
        for (const line of dLines) {
          ensureSpace(lineHeightFor(9.5));
          if (draw) {
            y = drawLines([line], marginX, y, 9.5, "normal", {
              color: important ? RED : [80, 80, 80],
              underline: important,
            });
          } else {
            y += lineHeightFor(9.5);
          }
        }
        y += 1;
      }

      if (includeAssigned) {
        const assignedNames = (node.assignedPersonIds ?? [])
          .map((pid) => persons.find((p) => p.id === pid)?.name)
          .filter((n): n is string => Boolean(n));
        const hasAssignees = assignedNames.length > 0;
        const assignedText = hasAssignees
          ? `Assigned: ${assignedNames.join(", ")}`
          : "Assigned: None";
        const assignedWeight: "normal" | "italic" = hasAssignees ? "normal" : "italic";
        const assignedColor: RGB = hasAssignees ? TEAL : LIGHT_GRAY;
        const aLines = wrap(assignedText, 8.5, assignedWeight, contentWidth);
        const aHeight = aLines.length * lineHeightFor(8.5);
        ensureSpace(aHeight + 0.4);
        if (draw) y = drawLines(aLines, marginX, y, 8.5, assignedWeight, { color: assignedColor });
        else y += aHeight;
        y += 0.4;
      }

      if (node.predecessors && node.predecessors.length > 0) {
        const refs = node.predecessors
          .map((pid) => idToPath.get(pid))
          .filter((v): v is string => Boolean(v));
        if (refs.length > 0) {
          const predText = `Predecessors: ${refs.join(", ")}`;
          const pLines = wrap(predText, 8.5, "normal", contentWidth);
          const pHeight = pLines.length * lineHeightFor(8.5);
          ensureSpace(pHeight + 0.4);
          if (draw) y = drawLines(pLines, marginX, y, 8.5, "normal", { color: GRAY });
          else y += pHeight;
          y += 0.4;
        }
      }
    }

    if (draw) drawFooter(page);
    return pageOfEntry;
  };

  resolvedPageOfEntry = renderDocument(false);
  renderDocument(true);
}

/* ─── Space / Area report ────────────────────────────────────── */

type SpaceReportOpts = {
  unit: ReportUnit;
  includeCoverTotals: boolean;
  includeBreakdown: boolean;
  includeDimensions: boolean;
  includeNotesColumn: boolean;
  wallPct: number | null;
  circPct: number | null;
  showCost: boolean;
  ratePerSqft: number | null;
  currency: string;
  blockMode: BlockMode;
  customNote: string;
};

type BlockStats = {
  node: ProcessNode;
  netSqm: number;
  wallSqm: number;
  circSqm: number;
  grossSqm: number;
  grossSqft: number;
  cost: number | null;
};

/**
 * Compute one BlockStats per top-level child of the scope root.
 * A "block" is whatever sits directly under the node the report
 * is scoped to. Each block gets its own wall / circulation / gross / cost.
 */
function computeBlocks(
  scopeRoot: ProcessNode,
  wallPct: number | null,
  circPct: number | null,
  showCost: boolean,
  ratePerSqft: number | null
): BlockStats[] {
  const children = scopeRoot.children ?? [];
  const blocks = children.length > 0 ? children : [scopeRoot];

  return blocks.map((block) => {
    const netSqm = getNodeValue(block).value ?? 0;
    const wallSqm = wallPct !== null ? netSqm * (wallPct / 100) : 0;
    const circSqm = circPct !== null ? netSqm * (circPct / 100) : 0;
    const grossSqm = netSqm + wallSqm + circSqm;
    const grossSqft = grossSqm * SQFT_PER_SQM;
    const cost =
      showCost && ratePerSqft !== null ? grossSqft * ratePerSqft : null;
    return { node: block, netSqm, wallSqm, circSqm, grossSqm, grossSqft, cost };
  });
}

/**
 * "one-block" mode: the whole scope is a single block. Wall and
 * circulation are applied once to the grand total.
 */
function computeOneBlock(
  scopeRoot: ProcessNode,
  wallPct: number | null,
  circPct: number | null,
  showCost: boolean,
  ratePerSqft: number | null
): BlockStats[] {
  const netSqm = getNodeValue(scopeRoot).value ?? 0;
  const wallSqm = wallPct !== null ? netSqm * (wallPct / 100) : 0;
  const circSqm = circPct !== null ? netSqm * (circPct / 100) : 0;
  const grossSqm = netSqm + wallSqm + circSqm;
  const grossSqft = grossSqm * SQFT_PER_SQM;
  const cost =
    showCost && ratePerSqft !== null ? grossSqft * ratePerSqft : null;
  return [
    { node: scopeRoot, netSqm, wallSqm, circSqm, grossSqm, grossSqft, cost },
  ];
}

/* Palette + layout constants for the space report */
const NAVY: RGB = [30, 41, 59];
const ACCENT: RGB = [67, 56, 202];
const BAND_FILL: RGB = [233, 236, 245];
const CARD_FILL: RGB = [244, 245, 250];
const HAIRLINE: RGB = [228, 230, 236];
const WHITE: RGB = [255, 255, 255];

type Col = { x: number; w: number; label: string; align: "left" | "right" };

function renderSpaceReport(
  doc: import("jspdf").jsPDF,
  rootNode: ProcessNode,
  opts: SpaceReportOpts
): void {
  const {
    unit,
    includeCoverTotals,
    includeBreakdown,
    includeDimensions,
    includeNotesColumn,
    wallPct,
    circPct,
    showCost,
    ratePerSqft,
    currency,
    blockMode,
    customNote,
  } = opts;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const marginTop = 16;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2;
  const contentBottom = pageHeight - marginBottom;
  const runningHeaderH = 9;

  /* ── Small helpers ────────────────────────────────────────── */

  /** Line height in mm for a font size in pt. */
  const lh = (size: number, mult = 1.18) => size * MM_PER_PT * mult;
  /** Distance from the top of a line box to its baseline. */
  const ascent = (size: number) => size * MM_PER_PT * 0.78;

  const unitLabel = unit === "sqft" ? "sqft" : "m²";
  const altLabel = unit === "sqft" ? "m²" : "sqft";
  const toUnit = (sqm: number) => (unit === "sqft" ? sqm * SQFT_PER_SQM : sqm);
  const toAlt = (sqm: number) => (unit === "sqft" ? sqm : sqm * SQFT_PER_SQM);

  const nf = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const fmtArea = (n: number) => nf.format(roundTo(n, 1));
  const fmtArea0 = (n: number) => nf0.format(Math.round(n));

  type Weight = "normal" | "bold" | "italic";

  const setFont = (weight: Weight, size: number) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
  };

  const txt = (
    str: string,
    x: number,
    yy: number,
    o: { weight?: Weight; size?: number; color?: RGB; align?: "left" | "center" | "right" } = {}
  ) => {
    setFont(o.weight ?? "normal", o.size ?? 10);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(str, x, yy, o.align && o.align !== "left" ? { align: o.align } : undefined);
    doc.setTextColor(...INK);
  };

  /** Wrap text to a width. Sets the font FIRST so measuring is accurate. */
  const wrap = (str: string, size: number, weight: Weight, width: number): string[] => {
    setFont(weight, size);
    return doc.splitTextToSize(str, Math.max(width, 5)) as string[];
  };

  /** Clamp wrapped lines to `max` lines, ending the last with "...". */
  const clampLines = (
    lines: string[],
    max: number,
    width: number,
    size: number,
    weight: Weight
  ): string[] => {
    if (lines.length <= max) return lines;
    const out = lines.slice(0, max);
    setFont(weight, size);
    let last = out[max - 1];
    while (last.length > 1 && doc.getTextWidth(last + "...") > width) {
      last = last.slice(0, -1).trimEnd();
    }
    out[max - 1] = last + "...";
    return out;
  };

  const rule = (yy: number, x1 = marginX, x2 = pageWidth - marginX, thickness = 0.2, color: RGB = RULE_GRAY) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(thickness);
    doc.line(x1, yy, x2, yy);
    doc.setDrawColor(0);
  };

  const fillRect = (x: number, yy: number, w: number, h: number, color: RGB, radius = 0) => {
    doc.setFillColor(...color);
    if (radius > 0) doc.roundedRect(x, yy, w, h, radius, radius, "F");
    else doc.rect(x, yy, w, h, "F");
  };

  /* ── Page handling ────────────────────────────────────────── */

  let y = marginTop;
  let onNewPage: (() => void) | null = null;

  const drawRunningHeader = () => {
    const title = rootNode.label || "Space Requirement";
    setFont("normal", 7.5);
    let shown = title;
    while (shown.length > 4 && doc.getTextWidth(shown) > contentWidth * 0.65) {
      shown = shown.slice(0, -1);
    }
    if (shown !== title) shown = shown.trimEnd() + "...";
    txt(shown, marginX, marginTop - 2, { size: 7.5, color: GRAY });
    txt("SPACE REQUIREMENT", pageWidth - marginX, marginTop - 2, {
      size: 7.5,
      weight: "bold",
      color: GRAY,
      align: "right",
    });
    rule(marginTop, marginX, pageWidth - marginX, 0.25, RULE_GRAY);
  };

  const newPage = () => {
    doc.addPage();
    y = marginTop + runningHeaderH - 2;
    drawRunningHeader();
    if (onNewPage) onNewPage();
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > contentBottom) newPage();
  };

  /* ── Table helpers ────────────────────────────────────────── */

  const CELL_PAD = 1.8;
  const HEADER_H = 7;

  const cellX = (c: Col) => (c.align === "right" ? c.x + c.w - CELL_PAD : c.x + CELL_PAD);

  const bandHeader = (cols: Col[]) => {
    fillRect(marginX, y, contentWidth, HEADER_H, NAVY);
    for (const c of cols) {
      txt(c.label, cellX(c), y + HEADER_H / 2 + 1.05, {
        size: 6.8,
        weight: "bold",
        color: WHITE,
        align: c.align,
      });
    }
    y += HEADER_H;
  };

  const sectionTitle = (label: string, sub?: string) => {
    ensureSpace(14);
    fillRect(marginX, y - 0.2, 1.2, 4.6, ACCENT);
    txt(label, marginX + 3.2, y + 3.4, { size: 10, weight: "bold", color: NAVY });
    if (sub) {
      txt(sub, pageWidth - marginX, y + 3.4, {
        size: 7.5,
        weight: "italic",
        color: GRAY,
        align: "right",
      });
    }
    y += 7.5;
  };

  /* ── Compute all numbers up front ─────────────────────────── */

  const blocks =
    blockMode === "one-block"
      ? computeOneBlock(rootNode, wallPct, circPct, showCost, ratePerSqft)
      : computeBlocks(rootNode, wallPct, circPct, showCost, ratePerSqft);

  const displayBlocks = blocks.filter((b) => b.netSqm > 0).length > 0
    ? blocks.filter((b) => b.netSqm > 0)
    : blocks;

  const totalNetSqm = blocks.reduce((a, b) => a + b.netSqm, 0);
  const totalWallSqm = blocks.reduce((a, b) => a + b.wallSqm, 0);
  const totalCircSqm = blocks.reduce((a, b) => a + b.circSqm, 0);
  const totalGrossSqm = blocks.reduce((a, b) => a + b.grossSqm, 0);
  const totalGrossSqft = totalGrossSqm * SQFT_PER_SQM;
  const showCostCol = showCost && ratePerSqft !== null;
  const totalCost = showCostCol ? totalGrossSqft * (ratePerSqft as number) : null;

  /* ════════════════════════════════════════════════════════════
     COVER BLOCK
     ════════════════════════════════════════════════════════════ */

  fillRect(marginX, y - 6, 22, 1.4, ACCENT);
  txt("SPACE REQUIREMENT STATEMENT", marginX, y + 0.4, {
    size: 8,
    weight: "bold",
    color: ACCENT,
  });
  txt(
    `Generated ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    pageWidth - marginX,
    y + 0.4,
    { size: 7.5, weight: "italic", color: GRAY, align: "right" }
  );
  y += 6.5;

  const titleLines = wrap(rootNode.label || "Untitled", 18, "bold", contentWidth);
  for (const line of titleLines) {
    txt(line, marginX, y + ascent(18) - 1.5, { size: 18, weight: "bold", color: NAVY });
    y += lh(18, 1.12);
  }
  y += 1;

  if (rootNode.description) {
    const dLines = wrap(rootNode.description, 8.8, "normal", contentWidth);
    for (const line of dLines) {
      txt(line, marginX, y + ascent(8.8), { size: 8.8, color: GRAY });
      y += lh(8.8, 1.25);
    }
    y += 1.5;
  }

  // Assumptions strip
  const assumptions: string[] = [
    `Unit: ${unitLabel} (${altLabel} alongside)`,
    wallPct !== null ? `Wall allowance ${wallPct}%` : "",
    circPct !== null ? `Circulation ${circPct}%` : "",
    showCostCol ? `Rate ${currency} ${fmtRate(ratePerSqft as number)} / sqft` : "",
    blockMode === "one-block" ? "Single block" : "",
  ].filter(Boolean);
  txt(assumptions.join("   |   "), marginX, y + ascent(7.5), {
    size: 7.5,
    color: GRAY,
  });
  y += lh(7.5) + 2.5;

  rule(y, marginX, pageWidth - marginX, 0.3, RULE_GRAY);
  y += 5;

  /* ── Custom note (user-entered at export time) ─────────────── */

  const noteText = customNote.trim();
  if (noteText) {
    const noteSize = 8.6;
    const noteLines: string[] = [];
    noteText.split(/\r?\n/).forEach((para) => {
      if (para.trim() === "") noteLines.push("");
      else noteLines.push(...wrap(para, noteSize, "normal", contentWidth - 12));
    });
    const boxH = noteLines.length * lh(noteSize, 1.25) + 11;
    ensureSpace(boxH + 4);
    fillRect(marginX, y, contentWidth, boxH, [255, 250, 235], 1.8);
    fillRect(marginX, y + 2.5, 0.9, boxH - 5, AMBER);
    txt("NOTE", marginX + 5, y + 5.2, { size: 7, weight: "bold", color: AMBER });
    noteLines.forEach((line, i) => {
      txt(line, marginX + 5, y + 10 + i * lh(noteSize, 1.25), { size: noteSize, color: INK });
    });
    y += boxH + 5;
  }

  /* ── KPI cards ─────────────────────────────────────────────── */

  if (includeCoverTotals) {
    type Kpi = { label: string; value: string; sub: string; color: RGB };
    const kpis: Kpi[] = [
      {
        label: "NET CARPET AREA",
        value: `${fmtArea0(toUnit(totalNetSqm))} ${unitLabel}`,
        sub: `${fmtArea0(toAlt(totalNetSqm))} ${altLabel}`,
        color: NAVY,
      },
      {
        label: wallPct !== null || circPct !== null ? "GROSS BUILT-UP AREA" : "TOTAL AREA",
        value: `${fmtArea0(toUnit(totalGrossSqm))} ${unitLabel}`,
        sub: `${fmtArea0(toAlt(totalGrossSqm))} ${altLabel}`,
        color: ACCENT,
      },
    ];
    if (showCostCol && totalCost !== null) {
      kpis.push({
        label: "ESTIMATED COST",
        value: fmtCost(totalCost, currency),
        sub: `@ ${currency} ${fmtRate(ratePerSqft as number)} per sqft`,
        color: AMBER,
      });
    }

    const gap = 4;
    const cardW = (contentWidth - gap * (kpis.length - 1)) / kpis.length;
    const cardH = 21;
    ensureSpace(cardH + 6);
    kpis.forEach((k, i) => {
      const cx = marginX + i * (cardW + gap);
      fillRect(cx, y, cardW, cardH, CARD_FILL, 1.8);
      fillRect(cx, y + 3, 0.9, cardH - 6, k.color);
      txt(k.label, cx + 5, y + 6, { size: 6.8, weight: "bold", color: GRAY });
      txt(k.value, cx + 5, y + 13.2, { size: 14, weight: "bold", color: k.color });
      txt(k.sub, cx + 5, y + 18, { size: 7.5, color: GRAY });
    });
    y += cardH + 7;

    /* ── Summary by block ─────────────────────────────────────── */

    sectionTitle(blockMode === "one-block" ? "SUMMARY" : "SUMMARY BY BLOCK", `Areas in ${unitLabel}`);

    const numW = 24;
    const costW = showCostCol ? 30 : 0;
    const nNumeric =
      1 + (wallPct !== null ? 1 : 0) + (circPct !== null ? 1 : 0) + 1; // net, wall?, circ?, gross
    const blockW = contentWidth - numW * nNumeric - costW;

    const cols: Col[] = [];
    let cx = marginX;
    cols.push({ x: cx, w: blockW, label: "BLOCK", align: "left" });
    cx += blockW;
    const netCol: Col = { x: cx, w: numW, label: "NET", align: "right" };
    cols.push(netCol);
    cx += numW;
    let wallCol: Col | null = null;
    if (wallPct !== null) {
      wallCol = { x: cx, w: numW, label: "WALL", align: "right" };
      cols.push(wallCol);
      cx += numW;
    }
    let circCol: Col | null = null;
    if (circPct !== null) {
      circCol = { x: cx, w: numW, label: "CIRC.", align: "right" };
      cols.push(circCol);
      cx += numW;
    }
    const grossCol: Col = { x: cx, w: numW, label: "GROSS", align: "right" };
    cols.push(grossCol);
    cx += numW;
    let costCol: Col | null = null;
    if (showCostCol) {
      costCol = { x: cx, w: costW, label: "EST. COST", align: "right" };
      cols.push(costCol);
    }

    const drawSummaryHeader = () => bandHeader(cols);
    ensureSpace(HEADER_H + 10);
    drawSummaryHeader();
    onNewPage = drawSummaryHeader;

    for (const b of displayBlocks) {
      const nameLines = wrap(b.node.label, 9, "normal", blockW - CELL_PAD * 2);
      const rowH = nameLines.length * lh(9, 1.15) + 4;
      ensureSpace(rowH);
      const base = y + 2 + ascent(9);
      nameLines.forEach((line, i) => {
        txt(line, cellX(cols[0]), base + i * lh(9, 1.15), {
          size: 9,
          weight: b.node.important ? "bold" : "normal",
          color: b.node.important ? RED : INK,
        });
      });
      txt(fmtArea0(toUnit(b.netSqm)), cellX(netCol), base, { size: 9, align: "right" });
      if (wallCol)
        txt(fmtArea0(toUnit(b.wallSqm)), cellX(wallCol), base, {
          size: 9,
          color: GRAY,
          align: "right",
        });
      if (circCol)
        txt(fmtArea0(toUnit(b.circSqm)), cellX(circCol), base, {
          size: 9,
          color: GRAY,
          align: "right",
        });
      txt(fmtArea0(toUnit(b.grossSqm)), cellX(grossCol), base, {
        size: 9,
        weight: "bold",
        align: "right",
      });
      if (costCol && b.cost !== null)
        txt(fmtCost(b.cost, currency), cellX(costCol), base, {
          size: 9,
          color: AMBER,
          align: "right",
        });
      y += rowH;
      rule(y, marginX, pageWidth - marginX, 0.15, HAIRLINE);
    }

    if (displayBlocks.length > 1) {
      const rowH = 7.5;
      ensureSpace(rowH);
      fillRect(marginX, y, contentWidth, rowH, BAND_FILL);
      const base = y + rowH / 2 + 1.1;
      txt("Total", cellX(cols[0]), base, { size: 9, weight: "bold", color: NAVY });
      txt(fmtArea0(toUnit(totalNetSqm)), cellX(netCol), base, {
        size: 9,
        weight: "bold",
        color: NAVY,
        align: "right",
      });
      if (wallCol)
        txt(fmtArea0(toUnit(totalWallSqm)), cellX(wallCol), base, {
          size: 9,
          weight: "bold",
          color: NAVY,
          align: "right",
        });
      if (circCol)
        txt(fmtArea0(toUnit(totalCircSqm)), cellX(circCol), base, {
          size: 9,
          weight: "bold",
          color: NAVY,
          align: "right",
        });
      txt(fmtArea0(toUnit(totalGrossSqm)), cellX(grossCol), base, {
        size: 9,
        weight: "bold",
        color: ACCENT,
        align: "right",
      });
      if (costCol && totalCost !== null)
        txt(fmtCost(totalCost, currency), cellX(costCol), base, {
          size: 9,
          weight: "bold",
          color: AMBER,
          align: "right",
        });
      y += rowH;
    }
    onNewPage = null;

    const hintParts = [
      wallPct !== null
        ? `Wall = ${wallPct}% of ${blockMode === "one-block" ? "net area" : "each block's net"}`
        : "",
      circPct !== null
        ? `Circulation = ${circPct}% of ${blockMode === "one-block" ? "net area" : "each block's net"}`
        : "",
      "Gross = Net + Wall + Circulation",
    ].filter(Boolean);
    y += 2;
    ensureSpace(5);
    txt(hintParts.join("   |   "), marginX, y + ascent(7), {
      size: 7,
      weight: "italic",
      color: GRAY,
    });
    y += lh(7) + 5;
  }

  /* ════════════════════════════════════════════════════════════
     AREA BREAKDOWN BY TYPE
     ════════════════════════════════════════════════════════════ */

  if (includeBreakdown) {
    const groups = groupLeavesByType(rootNode, "area");
    if (groups.size > 0) {
      ensureSpace(30);
      sectionTitle("AREA BREAKDOWN BY TYPE");

      const typeTotal = Array.from(groups.values()).reduce((a, b) => a + b.total, 0);

      const shareW = 58;
      const aW = 28;
      const bW = 26;
      const typeW = contentWidth - shareW - aW - bW;
      const cols: Col[] = [
        { x: marginX, w: typeW, label: "TYPE", align: "left" },
        { x: marginX + typeW, w: aW, label: `AREA (${unitLabel})`, align: "right" },
        { x: marginX + typeW + aW, w: bW, label: `AREA (${altLabel})`, align: "right" },
        { x: marginX + typeW + aW + bW, w: shareW, label: "SHARE OF NET", align: "left" },
      ];
      bandHeader(cols);

      for (const [typeId, { total }] of groups.entries()) {
        const preset = VALUE_PRESETS[typeId];
        const label = preset?.label ?? typeId;
        const rowH = 7;
        ensureSpace(rowH);
        const base = y + rowH / 2 + 1.1;
        txt(label, cellX(cols[0]), base, { size: 9 });
        txt(fmtArea(toUnit(total)), cellX(cols[1]), base, { size: 9, align: "right" });
        txt(fmtArea(toAlt(total)), cellX(cols[2]), base, {
          size: 8.5,
          color: GRAY,
          align: "right",
        });

        const pct = typeTotal > 0 ? (total / typeTotal) * 100 : 0;
        const barX = cols[3].x + CELL_PAD + 1;
        const barW = shareW - 22;
        fillRect(barX, y + rowH / 2 - 1.1, barW, 2.2, [225, 228, 238], 1.1);
        if (pct > 0) fillRect(barX, y + rowH / 2 - 1.1, Math.max(barW * (pct / 100), 1.4), 2.2, ACCENT, 1.1);
        txt(`${pct.toFixed(1)}%`, cols[3].x + shareW - CELL_PAD, base, {
          size: 8.5,
          color: INK,
          align: "right",
        });

        y += rowH;
        rule(y, marginX, pageWidth - marginX, 0.15, HAIRLINE);
      }

      // Total
      const rowH = 7.5;
      ensureSpace(rowH);
      fillRect(marginX, y, contentWidth, rowH, BAND_FILL);
      const base = y + rowH / 2 + 1.1;
      txt("Net Carpet Total", cellX(cols[0]), base, { size: 9, weight: "bold", color: NAVY });
      txt(fmtArea(toUnit(typeTotal)), cellX(cols[1]), base, {
        size: 9,
        weight: "bold",
        color: NAVY,
        align: "right",
      });
      txt(fmtArea(toAlt(typeTotal)), cellX(cols[2]), base, {
        size: 8.5,
        weight: "bold",
        color: GRAY,
        align: "right",
      });
      y += rowH + 7;
    }
  }

  /* ════════════════════════════════════════════════════════════
     DETAILED SPACE TABLE
     ════════════════════════════════════════════════════════════ */

  const rows = allRows(rootNode).filter(({ node }) => getNodeValue(node).value !== null);

  if (rows.length > 0) {
    const showDims = includeDimensions;
    const showNotes = includeNotesColumn;

    const numW = 13;
    const dimsW = showDims ? 22 : 0;
    const a1W = 21;
    const a2W = 19;
    const notesW = showNotes ? 62 : 0;
    const spaceW = contentWidth - numW - dimsW - a1W - a2W - notesW;

    let cx = marginX;
    const numCol: Col = { x: cx, w: numW, label: "NO.", align: "left" };
    cx += numW;
    const spaceCol: Col = { x: cx, w: spaceW, label: "SPACE / ROOM", align: "left" };
    cx += spaceW;
    const dimsCol: Col = { x: cx, w: dimsW, label: "", align: "right" };
    cx += dimsW;
    const a1Col: Col = { x: cx, w: a1W, label: `AREA (${unitLabel})`, align: "right" };
    cx += a1W;
    const a2Col: Col = { x: cx, w: a2W, label: `AREA (${altLabel})`, align: "right" };
    cx += a2W;
    const notesCol: Col = { x: cx, w: notesW, label: "NOTES", align: "left" };

    const firstLeaf = rows.find((r) => r.isLeaf)?.node;
    const dimUnit = firstLeaf ? factorSymbolForLeaf(firstLeaf, unit) : "";
    dimsCol.label = dimUnit ? `L x B (${dimUnit})` : "L x B";

    const headerCols: Col[] = [numCol, spaceCol];
    if (showDims) headerCols.push(dimsCol);
    headerCols.push(a1Col, a2Col);
    if (showNotes) headerCols.push(notesCol);

    // Make sure the section title, the column header and a couple of
    // rows land together rather than orphaning the title.
    ensureSpace(30);
    sectionTitle(
      "DETAILED SPACE REQUIREMENT",
      rows.some((r) => r.node.important) ? "Red = marked important" : undefined
    );
    const drawDetailHeader = () => bandHeader(headerCols);
    drawDetailHeader();
    onNewPage = drawDetailHeader;

    const PAD_Y = 1.7;

    rows.forEach(({ node, path, depth, isLeaf }, idx) => {
      const v = getNodeValue(node).value ?? 0;
      const isTop = depth === 1;
      const isGroup = !isLeaf;
      const important = !!node.important;

      const nameSize = isTop ? 9 : 8.5;
      const nameWeight: Weight = isGroup ? "bold" : "normal";
      const notesSize = 6.8;
      const indent = Math.min(Math.max(depth - 1, 0), 3) * 3;

      const nameLines = wrap(node.label, nameSize, nameWeight, spaceW - indent - CELL_PAD * 2);

      const dimsText = (() => {
        if (!showDims || !isLeaf) return "";
        const { f1, f2 } = displayFactorsForLeaf(node, unit);
        return f1 !== null && f2 !== null ? `${fmtNum(f1, 1)} x ${fmtNum(f2, 1)}` : "";
      })();

      let notesLines: string[] = [];
      if (showNotes) {
        const notesText = (node.description ?? "").trim();
        if (notesText) {
          notesLines = wrap(notesText, notesSize, "normal", notesW - CELL_PAD * 2);
          if (isGroup) {
            notesLines = clampLines(notesLines, 2, notesW - CELL_PAD * 2, notesSize, "normal");
          }
        }
      }

      const nameH = nameLines.length * lh(nameSize, 1.15);
      const notesH = notesLines.length * lh(notesSize, 1.2);
      const rowH = Math.max(nameH, notesH, lh(nameSize, 1.15)) + PAD_Y * 2;

      // Keep a group heading together with at least its first child row.
      ensureSpace(isGroup ? rowH + 12 : rowH);

      if (isTop && idx > 0) y += 1.5;

      if (isTop) {
        fillRect(marginX, y, contentWidth, rowH, BAND_FILL);
      }
      if (important) {
        fillRect(marginX, y, 0.9, rowH, RED);
      }

      const base = y + PAD_Y + ascent(nameSize);
      const textColor: RGB = important ? RED : isTop ? NAVY : INK;

      // No.
      txt(path.join("."), cellX(numCol), base, {
        size: 7.8,
        weight: isGroup ? "bold" : "normal",
        color: important ? RED : isTop ? NAVY : GRAY,
      });

      // Name
      nameLines.forEach((line, i) => {
        txt(line, spaceCol.x + CELL_PAD + indent, base + i * lh(nameSize, 1.15), {
          size: nameSize,
          weight: nameWeight,
          color: textColor,
        });
      });

      // Dimensions
      if (showDims && dimsText) {
        txt(dimsText, cellX(dimsCol), base, { size: 7.8, color: GRAY, align: "right" });
      }

      // Areas
      txt(fmtArea(toUnit(v)), cellX(a1Col), base, {
        size: nameSize,
        weight: isGroup ? "bold" : "normal",
        color: textColor,
        align: "right",
      });
      txt(fmtArea(toAlt(v)), cellX(a2Col), base, {
        size: 7.8,
        weight: isGroup ? "bold" : "normal",
        color: important ? RED : GRAY,
        align: "right",
      });

      // Notes
      if (showNotes) {
        notesLines.forEach((line, i) => {
          txt(line, notesCol.x + CELL_PAD, base + i * lh(notesSize, 1.2), {
            size: notesSize,
            color: important ? RED : isTop ? [70, 75, 90] : GRAY,
          });
        });
      }

      y += rowH;

      if (!isTop) rule(y, marginX, pageWidth - marginX, 0.12, HAIRLINE);
    });

    // Grand total bar
    const totH = 8.5;
    ensureSpace(totH + 2);
    y += 1;
    fillRect(marginX, y, contentWidth, totH, NAVY);
    const tb = y + totH / 2 + 1.2;
    txt("TOTAL NET CARPET AREA", spaceCol.x - numW + CELL_PAD, tb, {
      size: 8.5,
      weight: "bold",
      color: WHITE,
    });
    txt(fmtArea(toUnit(totalNetSqm)), cellX(a1Col), tb, {
      size: 9,
      weight: "bold",
      color: WHITE,
      align: "right",
    });
    txt(fmtArea(toAlt(totalNetSqm)), cellX(a2Col), tb, {
      size: 8,
      weight: "bold",
      color: [200, 205, 225],
      align: "right",
    });
    y += totH + 6;
    onNewPage = null;
  }

  /* ════════════════════════════════════════════════════════════
     FOOTNOTE
     ════════════════════════════════════════════════════════════ */

  const footnote =
    "This is a preliminary space requirement and area estimate prepared for " +
    "architectural discussion and future reference. All dimensions and areas " +
    "are indicative. Final areas may vary after design development, structural " +
    "planning, services coordination, statutory approvals, and site-specific " +
    "conditions.";
  const fnLines = wrap(footnote, 7.5, "italic", contentWidth - 8);
  const fnH = fnLines.length * lh(7.5, 1.25) + 11;
  ensureSpace(fnH + 2);
  fillRect(marginX, y, contentWidth, fnH, CARD_FILL, 1.8);
  txt("NOTE", marginX + 4, y + 5, { size: 7, weight: "bold", color: GRAY });
  fnLines.forEach((line, i) => {
    txt(line, marginX + 4, y + 9.4 + i * lh(7.5, 1.25), {
      size: 7.5,
      weight: "italic",
      color: GRAY,
    });
  });
  y += fnH;

  /* ════════════════════════════════════════════════════════════
     FOOTERS (drawn last so "Page x of N" is correct)
     ════════════════════════════════════════════════════════════ */

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    rule(pageHeight - 12, marginX, pageWidth - marginX, 0.2, RULE_GRAY);
    txt("www.modelflick.com", marginX, pageHeight - 8, { size: 7.5, color: GRAY });
    txt(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      size: 7.5,
      color: GRAY,
      align: "right",
    });
  }
}