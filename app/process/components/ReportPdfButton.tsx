"use client";

import { useMemo, useState } from "react";
import type { ProcessNode, Person } from "@/app/process/lib/process-utils";

type ReportPdfButtonProps = {
  rootNode: ProcessNode | null;
  completed: Set<string>;
  persons: Person[];
};

type FlatEntry = { node: ProcessNode; level: number; numberPath: number[] };

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

// Removes any node whose id is in `excluded`, and — since we never recurse
// into a removed node's children — everything underneath it comes along for
// free. This is also why excluding a deep subprocess only drops that branch,
// not its ancestors.
function pruneExcluded(node: ProcessNode, excluded: Set<string>): ProcessNode {
  const children = (node.children ?? [])
    .filter((c) => !excluded.has(c.id))
    .map((c) => pruneExcluded(c, excluded));
  return { ...node, children };
}

// Flat list used purely to render the checkbox tree in the modal. Tracks
// whether an ancestor is already excluded so we can gray the row out —
// toggling it wouldn't change anything since its parent branch is gone.
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

// A node is "complete" if it has no children and is in the completed set,
// or if it has children and every one of them is complete. This lets the
// checkbox appear on top-level / parent nodes too, not just leaf tasks.
function isNodeComplete(node: ProcessNode, completed: Set<string>): boolean {
  const children = node.children ?? [];
  if (children.length === 0) return completed.has(node.id);
  return children.every((c) => isNodeComplete(c, completed));
}

const MM_PER_PT = 0.3528;
const LINE_MULT = 1.15;

function headingStyle(level: number) {
  if (level === 1) return { size: 14, weight: "bold" as const, gapBefore: 5, gapAfter: 1.5 };
  if (level === 2) return { size: 12, weight: "bold" as const, gapBefore: 3.5, gapAfter: 1 };
  if (level === 3) return { size: 10.5, weight: "bold" as const, gapBefore: 2.5, gapAfter: 0.8 };
  return { size: 10, weight: "normal" as const, gapBefore: 2, gapAfter: 0.6 };
}

const RED: [number, number, number] = [190, 30, 30];
const GRAY: [number, number, number] = [110, 110, 110];
const LIGHT_GRAY: [number, number, number] = [160, 160, 160];
const GREEN: [number, number, number] = [30, 130, 60];
const TEAL: [number, number, number] = [15, 118, 110];
const INK: [number, number, number] = [20, 20, 20];

export function ReportPdfButton({ rootNode, completed, persons }: ReportPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [indexDepth, setIndexDepth] = useState(2);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeCompletion, setIncludeCompletion] = useState(true);
  const [filterPersonIds, setFilterPersonIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [showExcludePanel, setShowExcludePanel] = useState(false);
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

  const generate = async () => {
    if (!rootNode) return;
    setBusy(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");

      // Cut out excluded branches before anything else touches the tree —
      // numbering, TOC, and predecessor lookups all run against this pruned
      // copy, so gaps close up automatically.
      const effectiveRoot = excludedIds.size > 0 ? pruneExcluded(rootNode, excludedIds) : rootNode;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 18;
      const marginTop = 16;
      const marginBottom = 16;
      const contentWidth = pageWidth - marginX * 2;
      const contentBottom = pageHeight - marginBottom;

      const allEntries = flattenTree(effectiveRoot);
      const idToPath = new Map<string, string>();
      allEntries.forEach((e) => idToPath.set(e.node.id, e.numberPath.join(".")));

      const isFiltering = filterPersonIds.size > 0;

      // When filtering, keep ONLY nodes directly assigned to one of the selected
      // people — no parent/ancestor headings are pulled in for context anymore.
      const entries = isFiltering
        ? allEntries.filter((e) => (e.node.assignedPersonIds ?? []).some((pid) => filterPersonIds.has(pid)))
        : allEntries;

      const filterNames = persons.filter((p) => filterPersonIds.has(p.id)).map((p) => p.name);
      const noMatches = isFiltering && entries.length === 0;

      const lineHeightFor = (fontSize: number) => fontSize * MM_PER_PT * LINE_MULT;

      const wrap = (text: string, fontSize: number, weight: "normal" | "bold" | "italic", width: number) => {
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
        opts: { color?: [number, number, number]; underline?: boolean; align?: "left" | "center" } = {}
      ) => {
        let y = yStart;
        doc.setFont("helvetica", weight);
        doc.setFontSize(fontSize);
        const [r, g, b] = opts.color ?? INK;
        doc.setTextColor(r, g, b);
        lines.forEach((line) => {
          const drawX = opts.align === "center" ? pageWidth / 2 : x;
          doc.text(line, drawX, y, opts.align === "center" ? { align: "center" } : undefined);
          if (opts.underline) {
            const w = doc.getTextWidth(line);
            const startX = opts.align === "center" ? drawX - w / 2 : x;
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

        // ---------- header ----------
        const titleLines = wrap(effectiveRoot.label || "Process Report", 17, "bold", contentWidth);
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

        if (effectiveRoot.description) {
          const descLines = wrap(effectiveRoot.description, 9.5, "normal", contentWidth);
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

        // ---------- completion legend ----------
        if (includeCompletion) {
          const legendText = "Completion status: a blank box means not completed; a checked box means completed.";
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

        // ---------- table of contents ----------
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
            const color: [number, number, number] = important ? RED : e.level === 1 ? INK : [70, 70, 70];
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
                  const labelWidth = doc.getTextWidth(line);
                  const pageNumWidth = doc.getTextWidth(pageStr);
                  const dotsStart = marginX + indent + labelWidth + 2;
                  const dotsEnd = pageWidth - marginX - pageNumWidth - 2;
                  if (dotsEnd > dotsStart) {
                    doc.setTextColor(180);
                    doc.text(".".repeat(Math.max(0, Math.floor((dotsEnd - dotsStart) / 1.2))), dotsStart, y);
                    doc.setTextColor(...color);
                  }
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

        // ---------- "no tasks assigned" notice ----------
        if (noMatches) {
          const notice = `No processes are currently assigned to ${filterNames.join(", ")}.`;
          const nLines = wrap(notice, 10, "italic", contentWidth);
          const nHeight = nLines.length * lineHeightFor(10);
          ensureSpace(nHeight + 3);
          if (draw) y = drawLines(nLines, marginX, y, 10, "italic", { color: GRAY });
          else y += nHeight;
          y += 3;
        }

        // ---------- content ----------
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

          // ---------- completion checkbox (shown on every node, parent or leaf) ----------
          if (includeCompletion) {
            const done = isNodeComplete(node, completed);
            const label = "Status of completion";
            const fontSize = 8.5;
            const boxSize = fontSize * MM_PER_PT * 0.95; // roughly matches text cap-height
            const rowHeight = Math.max(lineHeightFor(fontSize), boxSize);

            ensureSpace(rowHeight + 0.6);

            if (draw) {
              const boxX = marginX;
              const boxY = y - boxSize * 0.85; // align box top with the text's cap-height

              if (done) {
                doc.setFillColor(...GREEN);
                doc.setDrawColor(...GREEN);
                doc.setLineWidth(0.25);
                doc.rect(boxX, boxY, boxSize, boxSize, "FD");

                // tick mark, drawn in white on top of the filled box
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.4);
                doc.line(boxX + boxSize * 0.22, boxY + boxSize * 0.55, boxX + boxSize * 0.42, boxY + boxSize * 0.76);
                doc.line(boxX + boxSize * 0.42, boxY + boxSize * 0.76, boxX + boxSize * 0.8, boxY + boxSize * 0.22);
              } else {
                doc.setDrawColor(...GRAY);
                doc.setLineWidth(0.25);
                doc.rect(boxX, boxY, boxSize, boxSize, "D"); // blank/empty box
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

          const assignedNames = (node.assignedPersonIds ?? [])
            .map((pid) => persons.find((p) => p.id === pid)?.name)
            .filter((n): n is string => Boolean(n));
          const hasAssignees = assignedNames.length > 0;
          const assignedText = hasAssignees ? `Assigned: ${assignedNames.join(", ")}` : "Assigned: None";
          const assignedWeight: "normal" | "italic" = hasAssignees ? "normal" : "italic";
          const assignedColor: [number, number, number] = hasAssignees ? TEAL : LIGHT_GRAY;
          const aLines = wrap(assignedText, 8.5, assignedWeight, contentWidth);
          const aHeight = aLines.length * lineHeightFor(8.5);
          ensureSpace(aHeight + 0.4);
          if (draw) y = drawLines(aLines, marginX, y, 8.5, assignedWeight, { color: assignedColor });
          else y += aHeight;
          y += 0.4;

          if (node.predecessors && node.predecessors.length > 0) {
            const refs = node.predecessors.map((pid) => idToPath.get(pid)).filter((v): v is string => Boolean(v));
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

      const filenameBase = isFiltering
        ? `${effectiveRoot.label || "process"}-${filterNames.join("-")}`
        : effectiveRoot.label || "process";
      doc.save(`${filenameBase.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.pdf`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">Export PDF Report</h3>

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
                <label className="block text-xs font-medium text-gray-700 mb-1">Include levels up to</label>
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

            <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeCompletion}
                onChange={(e) => setIncludeCompletion(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show completion status checkbox
            </label>

            {/* ─── Exclude processes ─── */}
            <div className="mb-2 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  type="button"
                  onClick={() => setShowExcludePanel((v) => !v)}
                  className="text-sm font-medium text-gray-700 flex items-center gap-1"
                >
                  {showExcludePanel ? "▾" : "▸"} Exclude processes
                  {excludedIds.size > 0 && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      {excludedIds.size} excluded
                    </span>
                  )}
                </button>
                {excludedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setExcludedIds(new Set())}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>

              {showExcludePanel && (
                <>
                  <p className="text-xs text-gray-400 mb-2">
                    Uncheck a process to leave it out of the report. Its subprocesses are left out too. Numbers re-adjust automatically.
                  </p>
                  <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 border border-gray-100 rounded-lg p-2">
                    {selectionEntries.map(({ node, level, ancestorExcluded }) => {
                      const selfExcluded = excludedIds.has(node.id);
                      const effectivelyExcluded = ancestorExcluded || selfExcluded;
                      return (
                        <label
                          key={node.id}
                          style={{ paddingLeft: level * 14 }}
                          className={`flex items-center gap-2 px-1.5 py-1 rounded-md text-sm ${
                            ancestorExcluded
                              ? "text-gray-300 cursor-not-allowed"
                              : effectivelyExcluded
                              ? "text-red-500 cursor-pointer hover:bg-gray-50"
                              : "text-gray-700 cursor-pointer hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!effectivelyExcluded}
                            disabled={ancestorExcluded}
                            onChange={() => toggleExcluded(node.id)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-40"
                          />
                          <span className="truncate">{node.label}</span>
                        </label>
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
                Leave empty to include everything. Select one or more to only print processes directly assigned to them — parent sections are not included.
              </p>

              {persons.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">No people added yet.</div>
              ) : (
                <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                  {persons.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm cursor-pointer ${
                        filterPersonIds.has(p.id) ? "bg-teal-50 text-teal-700" : "text-gray-700 hover:bg-gray-50"
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

            {error && (
              <div className="mt-3 mb-1 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</div>
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