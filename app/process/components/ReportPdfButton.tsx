"use client";

import { useMemo, useState } from "react";
import type { ProcessNode, Person } from "@/app/process/lib/process-utils";
import {
  getNodeValue,
  groupLeavesByType,
  allRows,
  findNodeById,
  VALUE_PRESETS,
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

const SQFT_PER_SQM = 10.7639104;
const MM_PER_PT = 0.3528;
const LINE_MULT = 1.15;

const RED: [number, number, number] = [190, 30, 30];
const GRAY: [number, number, number] = [110, 110, 110];
const LIGHT_GRAY: [number, number, number] = [160, 160, 160];
const GREEN: [number, number, number] = [30, 130, 60];
const TEAL: [number, number, number] = [15, 118, 110];
const INK: [number, number, number] = [20, 20, 20];
const AMBER: [number, number, number] = [180, 83, 9];
const RULE_GRAY: [number, number, number] = [200, 200, 200];

/* ─── Formatting helpers ─────────────────────────────────────── */

function roundTo(n: number, p: number): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

function fmtNum(n: number, p = 1): string {
  const r = roundTo(n, p);
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(p);
}

function fmtAreaPair(sqm: number, unit: ReportUnit, p = 1): string {
  if (unit === "sqft") {
    return `${fmtNum(sqm * SQFT_PER_SQM, p)} sqft (${fmtNum(sqm, p)} m²)`;
  }
  return `${fmtNum(sqm, p)} m² (${fmtNum(sqm * SQFT_PER_SQM, p)} sqft)`;
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
 * Given a leaf node and the report's chosen unit ("sqft" | "sqm"),
 * return the factor symbol that applies (e.g. "ft" for sqft, "m" for
 * sqm, "" for value types without factors).
 */
function factorSymbolForLeaf(
  leaf: ProcessNode,
  reportUnit: ReportUnit,
): string {
  const defId = leaf.valueType;
  const def =
    defId && VALUE_PRESETS[defId] ? VALUE_PRESETS[defId] : VALUE_PRESETS.area;
  if (!def.factorLabels) return "";

  const chosen =
    def.id === "area"
      ? reportUnit === "sqft"
        ? "ft²"
        : "m²"
      : def.unit;

  const opt = def.units.find((u) => u.symbol === chosen) ?? def.units[0];
  return opt.factorSymbol ?? def.factorUnit ?? "";
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
                      sqft (m² in brackets)
                    </button>
                    <button
                      onClick={() => setSpaceUnit("sqm")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${
                        spaceUnit === "sqm"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      m² (sqft in brackets)
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
      color?: [number, number, number];
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
        const color: [number, number, number] = important
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
      const titleColor: [number, number, number] = important ? RED : INK;
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
        const assignedColor: [number, number, number] = hasAssignees ? TEAL : LIGHT_GRAY;
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
 * is scoped to. For a compound → House / House 2, that's two blocks.
 * Each block gets its own wall / circulation / gross / cost.
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
 * circulation are applied once to the grand total rather than per
 * top-level branch. Returns a single-element array so the summary
 * table and totals keep the same shape.
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
  } = opts;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const marginTop = 16;
  const marginBottom = 18;
  const contentWidth = pageWidth - marginX * 2;
  const contentBottom = pageHeight - marginBottom;

  const lineHeightFor = (fontSize: number) => fontSize * MM_PER_PT * LINE_MULT;

  let page = 1;
  let y = marginTop;

  const drawFooter = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(140);
    doc.text(
      `www.modelflick.com   ·   Page ${page} of ${doc.getNumberOfPages()}`,
      pageWidth / 2,
      pageHeight - 9,
      { align: "center" }
    );
    doc.setTextColor(...INK);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > contentBottom) {
      drawFooter();
      doc.addPage();
      page += 1;
      y = marginTop;
    }
  };

  const setFont = (weight: "normal" | "bold" | "italic", size: number) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
  };

  const text = (
    str: string,
    x: number,
    yy: number,
    opts2: {
      weight?: "normal" | "bold" | "italic";
      size?: number;
      color?: [number, number, number];
      align?: "left" | "center" | "right";
    } = {}
  ) => {
    setFont(opts2.weight ?? "normal", opts2.size ?? 10);
    doc.setTextColor(...(opts2.color ?? INK));
    doc.text(
      str,
      x,
      yy,
      opts2.align === "center"
        ? { align: "center" }
        : opts2.align === "right"
          ? { align: "right" }
          : undefined
    );
    doc.setTextColor(...INK);
  };

  const rule = (
    yy: number,
    thickness = 0.2,
    color: [number, number, number] = RULE_GRAY
  ) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(thickness);
    doc.line(marginX, yy, pageWidth - marginX, yy);
    doc.setDrawColor(0);
  };

  /* ── Compute all numbers up front ─────────────────────────── */

  const blocks =
    blockMode === "one-block"
      ? computeOneBlock(rootNode, wallPct, circPct, showCost, ratePerSqft)
      : computeBlocks(rootNode, wallPct, circPct, showCost, ratePerSqft);

  const totalNetSqm = blocks.reduce((a, b) => a + b.netSqm, 0);
  const totalWallSqm = blocks.reduce((a, b) => a + b.wallSqm, 0);
  const totalCircSqm = blocks.reduce((a, b) => a + b.circSqm, 0);
  const totalGrossSqm = blocks.reduce((a, b) => a + b.grossSqm, 0);
  const totalGrossSqft = totalGrossSqm * SQFT_PER_SQM;
  const totalCost =
    showCost && ratePerSqft !== null ? totalGrossSqft * ratePerSqft : null;

  /* ── Cover page ───────────────────────────────────────────── */

  y += 4;
  text("SPACE REQUIREMENT", marginX, y, { weight: "bold", size: 20, color: INK });
  y += lineHeightFor(20) + 1;

  text(rootNode.label || "Untitled", marginX, y, {
    weight: "bold",
    size: 15,
    color: INK,
  });
  y += lineHeightFor(15) + 1;

  if (rootNode.description) {
    const descLines = doc.splitTextToSize(
      rootNode.description,
      contentWidth
    ) as string[];
    setFont("normal", 9.5);
    doc.setTextColor(...GRAY);
    descLines.forEach((line) => {
      doc.text(line, marginX, y);
      y += lineHeightFor(9.5);
    });
    doc.setTextColor(...INK);
    y += 0.6;
  }

  text(
    `Generated ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    marginX,
    y,
    { weight: "italic", size: 8.5, color: GRAY }
  );
  y += lineHeightFor(8.5) + 3;

  rule(y);
  y += 3;

  /* ── Cover: summary table ─────────────────────────────────── */

  if (includeCoverTotals) {
    text(
      blockMode === "one-block" ? "SUMMARY" : "SUMMARY BY BLOCK",
      marginX,
      y,
      { size: 11, weight: "bold", color: INK }
    );
    y += lineHeightFor(11) + 1.5;

    const colBlockX = marginX;
    const colNetX = marginX + contentWidth * 0.34;
    const colWallX = marginX + contentWidth * 0.5;
    const colCircX = marginX + contentWidth * 0.62;
    const colGrossX = marginX + contentWidth * 0.74;
    const colCostX = pageWidth - marginX;

    const showCostCol = showCost && ratePerSqft !== null;
    const showTotalRow = blocks.length > 1;

    text("BLOCK", colBlockX, y, { size: 8, weight: "bold", color: GRAY });
    text("NET", colNetX, y, { size: 8, weight: "bold", color: GRAY });
    if (wallPct !== null)
      text("WALL", colWallX, y, { size: 8, weight: "bold", color: GRAY });
    if (circPct !== null)
      text("CIRC", colCircX, y, { size: 8, weight: "bold", color: GRAY });
    text("GROSS", colGrossX, y, { size: 8, weight: "bold", color: GRAY });
    if (showCostCol)
      text("COST", colCostX, y, {
        size: 8,
        weight: "bold",
        color: GRAY,
        align: "right",
      });
    y += lineHeightFor(8) + 0.8;
    rule(y);
    y += 2.5;

    for (const b of blocks) {
      ensureSpace(6);
      const rowTop = y;

      text(b.node.label, colBlockX, rowTop, {
        size: 9.5,
        weight: "normal",
        color: INK,
      });
      text(fmtNum(b.netSqm * SQFT_PER_SQM, 0), colNetX, rowTop, {
        size: 9.5,
        weight: "normal",
        color: INK,
      });
      if (wallPct !== null) {
        text(fmtNum(b.wallSqm * SQFT_PER_SQM, 0), colWallX, rowTop, {
          size: 9.5,
          weight: "normal",
          color: GRAY,
        });
      }
      if (circPct !== null) {
        text(fmtNum(b.circSqm * SQFT_PER_SQM, 0), colCircX, rowTop, {
          size: 9.5,
          weight: "normal",
          color: GRAY,
        });
      }
      text(fmtNum(b.grossSqm * SQFT_PER_SQM, 0), colGrossX, rowTop, {
        size: 9.5,
        weight: "bold",
        color: INK,
      });
      if (showCostCol && b.cost !== null) {
        text(fmtCost(b.cost, currency), colCostX, rowTop, {
          size: 9.5,
          weight: "normal",
          color: AMBER,
          align: "right",
        });
      }
      y = rowTop + lineHeightFor(9.5) + 1;
    }

    if (showTotalRow) {
      y += 0.5;
      rule(y);
      y += 2;
      ensureSpace(6);
      const totalTop = y;

      text("Total (all blocks)", colBlockX, totalTop, {
        size: 9.5,
        weight: "bold",
        color: INK,
      });
      text(fmtNum(totalNetSqm * SQFT_PER_SQM, 0), colNetX, totalTop, {
        size: 9.5,
        weight: "bold",
        color: INK,
      });
      if (wallPct !== null) {
        text(fmtNum(totalWallSqm * SQFT_PER_SQM, 0), colWallX, totalTop, {
          size: 9.5,
          weight: "bold",
          color: GRAY,
        });
      }
      if (circPct !== null) {
        text(fmtNum(totalCircSqm * SQFT_PER_SQM, 0), colCircX, totalTop, {
          size: 9.5,
          weight: "bold",
          color: GRAY,
        });
      }
      text(fmtNum(totalGrossSqm * SQFT_PER_SQM, 0), colGrossX, totalTop, {
        size: 9.5,
        weight: "bold",
        color: GREEN,
      });
      if (showCostCol && totalCost !== null) {
        text(fmtCost(totalCost, currency), colCostX, totalTop, {
          size: 9.5,
          weight: "bold",
          color: AMBER,
          align: "right",
        });
      }
      y = totalTop + lineHeightFor(9.5) + 2;
    }

    const hint =
      blocks.length > 1
        ? [
            wallPct !== null ? `Wall = ${wallPct}% of each block's net` : "",
            circPct !== null
              ? `Circulation = ${circPct}% of each block's net`
              : "",
          ]
            .filter(Boolean)
            .join("  ·  ")
        : [
            wallPct !== null ? `Wall = ${wallPct}% of net` : "",
            circPct !== null ? `Circulation = ${circPct}% of net` : "",
          ]
            .filter(Boolean)
            .join("  ·  ");

    if (hint) {
      ensureSpace(4);
      text(hint, marginX, y, { size: 7.5, weight: "italic", color: GRAY });
      y += lineHeightFor(7.5) + 2;
    }

    y += 1;
    rule(y);
    y += 4;
  }

  /* ── Area breakdown by type ───────────────────────────────── */

  if (includeBreakdown) {
    const groups = groupLeavesByType(rootNode, "area");
    if (groups.size > 0) {
      ensureSpace(12);

      text("AREA BREAKDOWN BY TYPE", marginX, y, {
        size: 11,
        weight: "bold",
        color: INK,
      });
      y += lineHeightFor(11) + 1.5;

      const colLabelX = marginX;
      const colAreaX = marginX + contentWidth * 0.5;
      const colPctX = marginX + contentWidth * 0.8;

      text("TYPE", colLabelX, y, { size: 8, weight: "bold", color: GRAY });
      text(`AREA (${unit})`, colAreaX, y, { size: 8, weight: "bold", color: GRAY });
      text("% OF NET", colPctX, y, { size: 8, weight: "bold", color: GRAY });
      y += lineHeightFor(8) + 0.8;
      rule(y);
      y += 2.5;

      const typeTotal = Array.from(groups.values()).reduce(
        (a, b) => a + b.total,
        0
      );
      for (const [typeId, { total }] of groups.entries()) {
        const preset = VALUE_PRESETS[typeId];
        const label = preset?.label ?? typeId;

        ensureSpace(6);
        text(label, colLabelX, y, { size: 10, weight: "normal", color: INK });
        text(fmtAreaPair(total, unit, 1), colAreaX, y, {
          size: 10,
          weight: "normal",
          color: INK,
        });
        const pct = typeTotal > 0 ? (total / typeTotal) * 100 : 0;
        text(`${pct.toFixed(1)}%`, colPctX, y, {
          size: 10,
          weight: "normal",
          color: INK,
        });
        y += lineHeightFor(10) + 1;
      }

      y += 0.8;
      rule(y);
      y += 2.5;

      text("Net Carpet Total", colLabelX, y, {
        size: 10,
        weight: "bold",
        color: INK,
      });
      text(fmtAreaPair(typeTotal, unit, 1), colAreaX, y, {
        size: 10,
        weight: "bold",
        color: INK,
      });
      y += lineHeightFor(10) + 3;
    }
  }

  /* ── Detailed space table ─────────────────────────────────── */

  const rows = allRows(rootNode).filter(({ node }) => {
    const v = getNodeValue(node).value;
    return v !== null;
  });

  if (rows.length > 0) {
    const showNotes = includeNotesColumn;
    const showDims = includeDimensions;

    const colSpaceX = marginX;
    const colSpaceW = showDims
      ? contentWidth * (showNotes ? 0.34 : 0.42)
      : contentWidth * (showNotes ? 0.5 : 0.6);
    const colDimsX = colSpaceX + colSpaceW;
    const colDimsW = showDims ? contentWidth * 0.2 : 0;
    const colAreaX = colDimsX + colDimsW;
    const colAreaW = contentWidth * (showNotes ? 0.2 : 0.4);
    const colNotesX = colAreaX + colAreaW;

    // DIMENSIONS heading with unit. Grab the first leaf's factor symbol
    // for the current report unit — e.g. "(ft)" when the report is in
    // sqft for an Area preset, "(m)" when in sqm.
    const firstLeaf = rows.find((r) => r.isLeaf)?.node;
    const dimUnit = firstLeaf ? factorSymbolForLeaf(firstLeaf, unit) : "";
    const dimsHeader = dimUnit ? `DIMENSIONS (${dimUnit})` : "DIMENSIONS";

    ensureSpace(14);
    text("DETAILED SPACE REQUIREMENT", marginX, y, {
      size: 11,
      weight: "bold",
      color: INK,
    });
    y += lineHeightFor(11) + 1.5;

    text("SPACE / ROOM", colSpaceX, y, { size: 8, weight: "bold", color: GRAY });
    if (showDims)
      text(dimsHeader, colDimsX, y, { size: 8, weight: "bold", color: GRAY });
    text(`AREA (${unit})`, colAreaX, y, { size: 8, weight: "bold", color: GRAY });
    if (showNotes)
      text("NOTES", colNotesX, y, { size: 8, weight: "bold", color: GRAY });
    y += lineHeightFor(8) + 0.8;
    rule(y);
    y += 2.5;

    for (const { node, path, depth, isLeaf } of rows) {
      const v = getNodeValue(node).value ?? 0;
      const indent = Math.min(depth - 1, 3) * 4;

      const displayName = `${path.join(".")}  ${node.label}`;

      // Option A: only leaves print their L × B.
      const dimsText =
        showDims &&
        isLeaf &&
        node.factor1 !== undefined &&
        node.factor2 !== undefined
          ? `${fmtNum(node.factor1, 1)} × ${fmtNum(node.factor2, 1)}`
          : "";

      const notesText = (node.description ?? "").trim();

      const nameLines = doc.splitTextToSize(
        displayName,
        colSpaceW - indent - 2
      ) as string[];
      const notesLines =
        showNotes && notesText
          ? (doc.splitTextToSize(
              notesText,
              contentWidth - colNotesX - 2
            ) as string[])
          : [];
      const dimsLines =
        showDims && dimsText
          ? (doc.splitTextToSize(dimsText, colDimsW - 2) as string[])
          : [];
      const areaLines = doc.splitTextToSize(
        fmtAreaPair(v, unit, 1),
        contentWidth - colAreaX - (showNotes ? colAreaW : 0) - 2
      ) as string[];

      const rowLines = Math.max(
        nameLines.length,
        notesLines.length || 1,
        dimsLines.length || 1,
        areaLines.length || 1
      );
      const rowHeight = rowLines * lineHeightFor(9.5) + 1.5;

      ensureSpace(rowHeight);
      const rowTop = y;

      setFont(isLeaf ? "normal" : "bold", 9.5);
      doc.setTextColor(...INK);
      nameLines.forEach((line, i) => {
        doc.text(line, colSpaceX + indent, rowTop + i * lineHeightFor(9.5));
      });

      if (showDims) {
        setFont("normal", 9);
        doc.setTextColor(...GRAY);
        dimsLines.forEach((line, i) => {
          doc.text(line, colDimsX, rowTop + i * lineHeightFor(9.5));
        });
      }

      setFont(isLeaf ? "normal" : "bold", 9.5);
      doc.setTextColor(...INK);
      areaLines.forEach((line, i) => {
        doc.text(line, colAreaX, rowTop + i * lineHeightFor(9.5));
      });

      if (showNotes) {
        setFont("normal", 8.5);
        doc.setTextColor(...GRAY);
        notesLines.forEach((line, i) => {
          doc.text(line, colNotesX, rowTop + i * lineHeightFor(9.5));
        });
      }

      doc.setTextColor(...INK);
      y = rowTop + rowHeight;

      if (y < contentBottom - 3) {
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.15);
        doc.line(marginX, y - 0.8, pageWidth - marginX, y - 0.8);
        doc.setDrawColor(0);
      }
    }

    y += 2;
    rule(y);
    y += 2;

    ensureSpace(6);
    setFont("bold", 10);
    doc.setTextColor(...INK);
    doc.text("Total Net Carpet Area", colSpaceX, y);
    doc.text(fmtAreaPair(totalNetSqm, unit, 1), colAreaX, y);
    y += lineHeightFor(10) + 3;
  }

  /* ── Footnote ─────────────────────────────────────────────── */

  ensureSpace(18);
  rule(y, 0.2, [220, 220, 220]);
  y += 3;
  text("NOTE", marginX, y, { size: 8, weight: "bold", color: GRAY });
  y += lineHeightFor(8) + 0.5;
  const footnote =
    "This is a preliminary space requirement and area estimate prepared for " +
    "architectural discussion and future reference. All dimensions and areas " +
    "are indicative. Final areas may vary after design development, structural " +
    "planning, services coordination, statutory approvals, and site-specific " +
    "conditions.";
  setFont("italic", 8);
  doc.setTextColor(...GRAY);
  const fnLines = doc.splitTextToSize(footnote, contentWidth) as string[];
  fnLines.forEach((line) => {
    ensureSpace(lineHeightFor(8));
    doc.text(line, marginX, y);
    y += lineHeightFor(8);
  });
  doc.setTextColor(...INK);

  drawFooter();
}