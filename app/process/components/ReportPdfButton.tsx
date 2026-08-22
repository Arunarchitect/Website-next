"use client";

import { useState } from "react";
import type { ProcessNode } from "@/app/process/lib/process-utils";

type ReportPdfButtonProps = {
  rootNode: ProcessNode | null;
  completed: Set<string>;
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
const GREEN: [number, number, number] = [30, 130, 60];
const INK: [number, number, number] = [20, 20, 20];

export function ReportPdfButton({ rootNode, completed }: ReportPdfButtonProps) {
  const [open, setOpen] = useState(false);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [indexDepth, setIndexDepth] = useState(2);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeCompletion, setIncludeCompletion] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const maxLevel = rootNode
    ? Math.max(1, ...flattenTree(rootNode).map((e) => e.level))
    : 1;

  const generate = async () => {
    if (!rootNode) return;
    setBusy(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 18;
      const marginTop = 16;
      const marginBottom = 16;
      const contentWidth = pageWidth - marginX * 2;
      const contentBottom = pageHeight - marginBottom;

      const entries = flattenTree(rootNode);
      const idToPath = new Map<string, string>();
      entries.forEach((e) => idToPath.set(e.node.id, e.numberPath.join(".")));

      const lineHeightFor = (fontSize: number) => fontSize * MM_PER_PT * LINE_MULT;

      const wrap = (text: string, fontSize: number, weight: "normal" | "bold", width: number) => {
        doc.setFont("helvetica", weight);
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(text, width) as string[];
      };

      const drawLines = (
        lines: string[],
        x: number,
        yStart: number,
        fontSize: number,
        weight: "normal" | "bold",
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

      // pageOfEntry gets filled by whichever pass runs — first (dry) pass provides
      // the numbers the second (draw) pass needs to print in the TOC.
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

        // ---------- header (title + subtitle, top of page 1, no dedicated page) ----------
        const titleLines = wrap(rootNode.label || "Process Report", 17, "bold", contentWidth);
        const titleHeight = titleLines.length * lineHeightFor(17);
        ensureSpace(titleHeight);
        if (draw) y = drawLines(titleLines, marginX, y, 17, "bold");
        else y += titleHeight;

        if (rootNode.description) {
          const descLines = wrap(rootNode.description, 9.5, "normal", contentWidth);
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

        y += 2.5;
        ensureSpace(2);
        if (draw) {
          doc.setDrawColor(210);
          doc.setLineWidth(0.2);
          doc.line(marginX, y, pageWidth - marginX, y);
          doc.setDrawColor(0);
        }
        y += 4;

        // ---------- table of contents (right under the header, same page) ----------
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

        // ---------- content (flows continuously — breaks only on overflow) ----------
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

          const isLeaf = !(node.children && node.children.length > 0);
          if (includeCompletion && isLeaf) {
            const done = completed.has(node.id);
            const status = done ? "Status: Completed" : "Status: Not completed";
            const sLines = wrap(status, 8.5, "normal", contentWidth);
            const sHeight = sLines.length * lineHeightFor(8.5);
            ensureSpace(sHeight + 0.6);
            if (draw) y = drawLines(sLines, marginX, y, 8.5, "normal", { color: done ? GREEN : GRAY });
            else y += sHeight;
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

      resolvedPageOfEntry = renderDocument(false); // dry run — learn every node's final page number
      renderDocument(true); // real draw — TOC now prints the correct page numbers

      doc.save(`${(rootNode.label || "process").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.pdf`);
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
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4"
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
              Show completion status on leaf tasks
            </label>

            {error && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</div>
            )}

            <div className="flex justify-end gap-2">
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