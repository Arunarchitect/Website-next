"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { durationDays, toDay } from "./scheduling";
import type { Row } from "./scheduling";
import type { Task } from "./data";

type Orientation = "landscape" | "portrait";
type RowStatus = "critical" | "done" | "running" | "";

/**
 * Print / PDF button + print-only report.
 *
 * Screen: a single "Print / PDF" button. Clicking it opens a small popup
 * where the user picks Portrait or Landscape — no permanently visible
 * orientation select.
 *
 * Print: a dedicated report in a portal on <body>. When printing we add
 * `body.printing[-portrait|-landscape]`, and the print stylesheet hides
 * EVERY direct child of <body> except the report.
 *
 * Portrait uses `table-layout: fixed` with percentage column widths so all
 * seven columns always fit the narrower page — nothing overflows.
 */

function statusOf(task: Task, criticalIds: Set<string>): RowStatus {
  // Completed tasks always show as "done", even if they were critical —
  // otherwise the PDF would still paint finished critical work red.
  if (task.completion >= 100 || task.actualFinish) return "done";
  // In-progress next, so "running" isn't masked by the critical flag either.
  if (task.completion > 0 || task.actualStart) return "running";
  // Only then fall back to critical for the remaining (not started) work.
  if (criticalIds.has(task.id)) return "critical";
  return "";
}

export function PrintAct({
  tasks,
  rows,
  criticalIds,
  title,
  projectName,
  floats,
}: {
  tasks: Task[];
  rows: Row[];
  criticalIds: Set<string>;
  title: string;
  projectName?: string;
  /** Optional map of taskId → total float (days). When omitted, the Float
   *  column falls back to "—" for every row. */
  floats?: Map<string, number>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const total = tasks.filter(
    (t) => !tasks.some((c) => c.parentId === t.id)
  ).length;

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          toDay(a.task.scheduleStart) - toDay(b.task.scheduleStart) ||
          toDay(a.task.scheduleFinish) - toDay(b.task.scheduleFinish) ||
          a.wbs.localeCompare(b.wbs, undefined, { numeric: true })
      ),
    [rows]
  );

  const counts = useMemo(() => {
    let crit = 0, done = 0, running = 0;
    for (const r of sorted) {
      const s = statusOf(r.task, criticalIds);
      if (s === "critical") crit++;
      else if (s === "done") done++;
      else if (s === "running") running++;
    }
    return { crit, done, running };
  }, [sorted, criticalIds]);

  // Escape closes the orientation popup.
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  const doPrint = (o: Orientation) => {
    setPickerOpen(false);
    document.body.classList.add("printing", `printing-${o}`);
    const cleanup = () =>
      document.body.classList.remove(
        "printing",
        "printing-portrait",
        "printing-landscape"
      );
    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 500);
    }, 30);
  };

  const printReport =
    typeof document !== "undefined"
      ? createPortal(
          <div className="print-only schedule-print-report">
            <h1>{projectName || title}</h1>
            {projectName && title !== projectName && <h2>{title}</h2>}
            <p className="print-meta">
              Printed {new Date().toLocaleDateString()} · {sorted.length} rows
              &nbsp;({total} activities) · {counts.crit} critical ·{" "}
              {counts.running} in progress · {counts.done} complete
            </p>
            <p className="print-legend">
              <span className="lg crit">Critical</span>
              <span className="lg run">In progress</span>
              <span className="lg done">Complete</span>
            </p>
            {/* Percentage widths + table-layout:fixed ⇒ all columns fit any page */}
            <table>
              <colgroup>
                <col className="col-wbs" />
                <col className="col-name" />
                <col className="col-date" />
                <col className="col-date" />
                <col className="col-days" />
                <col className="col-float" />
                <col className="col-pct" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-wbs">#</th>
                  <th className="col-name">Task</th>
                  <th className="col-date">Start</th>
                  <th className="col-date">Finish</th>
                  <th className="col-days">Days</th>
                  <th className="col-float">Float</th>
                  <th className="col-pct">%</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ task, wbs, depth, hasChildren }) => {
                  const status = statusOf(task, criticalIds);
                  const float = floats?.get(task.id);
                  const floatLabel =
                    hasChildren || float === undefined
                      ? "—"
                      : float === 0
                        ? "0"
                        : `${float}`;
                  return (
                    <tr
                      key={task.id}
                      className={
                        (status ? `st-${status} ` : "") +
                        (hasChildren ? "is-group" : "")
                      }
                    >
                      <td className="col-wbs">{wbs}</td>
                      <td className="col-name">
                        <span style={{ paddingLeft: depth * 12 }}>
                          {task.name}
                          {task.isMilestone ? " ◆" : ""}
                        </span>
                      </td>
                      <td className="col-date">{task.scheduleStart}</td>
                      <td className="col-date">{task.scheduleFinish}</td>
                      <td className="col-days">{durationDays(task)}</td>
                      <td className="col-float">{floatLabel}</td>
                      <td className="col-pct">{task.completion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Single button — orientation is chosen in the popup */}
      <button
        onClick={() => setPickerOpen(true)}
        className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        title={`Print or save as PDF (${total} activities)`}
        data-print-hide
      >
        <svg
          className="h-4 w-4 text-gray-600"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M6 2.5A1.5 1.5 0 0 0 4.5 4v3.05A2.5 2.5 0 0 0 3 9.5v3A1.5 1.5 0 0 0 4.5 14H5v2.5A1.5 1.5 0 0 0 6.5 18h7a1.5 1.5 0 0 0 1.5-1.5V14h.5a1.5 1.5 0 0 0 1.5-1.5v-3a2.5 2.5 0 0 0-1.5-2.45V4A1.5 1.5 0 0 0 14 2.5H6Zm.5 1.5h7v3h-7V4Zm0 11.5v-4h7v4h-7Z" />
        </svg>
        Print / PDF
      </button>

      {/* Orientation picker popup */}
      {pickerOpen && (
        <div
          className="print-orient-popup fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPickerOpen(false)}
          data-print-hide
        >
          <div
            className="w-72 rounded-lg bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-gray-900">
              Print layout
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Choose a page orientation for the PDF report.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => doPrint("portrait")}
                className="flex flex-col items-center gap-1.5 rounded border px-3 py-3 text-xs font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50"
              >
                {/* portrait sheet icon */}
                <svg viewBox="0 0 24 32" className="h-9 w-7" aria-hidden>
                  <rect
                    x="1"
                    y="1"
                    width="22"
                    height="30"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line x1="5" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="5" y1="13" x2="19" y2="13" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="5" y1="18" x2="15" y2="18" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Portrait
              </button>
              <button
                onClick={() => doPrint("landscape")}
                className="flex flex-col items-center gap-1.5 rounded border px-3 py-3 text-xs font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50"
              >
                {/* landscape sheet icon */}
                <svg viewBox="0 0 32 24" className="h-7 w-9" aria-hidden>
                  <rect
                    x="1"
                    y="1"
                    width="30"
                    height="22"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line x1="5" y1="7" x2="27" y2="7" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="5" y1="12" x2="27" y2="12" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="5" y1="17" x2="19" y2="17" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Landscape
              </button>
            </div>
            <button
              onClick={() => setPickerOpen(false)}
              className="mt-3 w-full rounded border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {printReport}

      <style jsx global>{`
        .print-only {
          display: none;
        }
        @page schedule-portrait {
          size: A4 portrait;
          margin: 12mm;
        }
        @page schedule-landscape {
          size: A4 landscape;
          margin: 12mm;
        }
        @media print {
          /* Never leak the popup or app chrome onto paper */
          .print-orient-popup {
            display: none !important;
          }
          body.printing > *:not(.print-only) {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .printing-portrait .schedule-print-report {
            page: schedule-portrait;
          }
          .printing-landscape .schedule-print-report {
            page: schedule-landscape;
          }

          .schedule-print-report {
            font-family: ui-sans-serif, system-ui, sans-serif;
            color: #111;
            font-size: 10px;
          }
          .schedule-print-report h1 {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 1px;
          }
          .schedule-print-report h2 {
            font-size: 12px;
            font-weight: 500;
            color: #444;
            margin: 0 0 4px;
          }
          .schedule-print-report .print-meta {
            font-size: 9px;
            color: #555;
            margin: 0 0 4px;
          }
          .schedule-print-report .print-legend {
            margin: 0 0 8px;
          }
          .schedule-print-report .lg {
            display: inline-block;
            padding: 1px 6px;
            margin-right: 6px;
            border: 1px solid #9ca3af;
            font-size: 8px;
            font-weight: 600;
          }
          .schedule-print-report .lg.crit {
            background: #fee2e2;
            color: #991b1b;
            border-color: #fca5a5;
          }
          .schedule-print-report .lg.run {
            background: #dbeafe;
            color: #1e40af;
            border-color: #93c5fd;
          }
          .schedule-print-report .lg.done {
            background: #dcfce7;
            color: #166534;
            border-color: #86efac;
          }

          /* fixed layout + % widths → nothing overflows the page */
          .schedule-print-report table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .schedule-print-report th {
            text-align: left;
            background: #f3f4f6;
            border: 1px solid #9ca3af;
            padding: 3px 6px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          .schedule-print-report td {
            border: 1px solid #d1d5db;
            padding: 2px 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          /* Landscape: generous px widths */
          .printing-landscape .schedule-print-report .col-wbs {
            width: 44px;
          }
          .printing-landscape .schedule-print-report .col-name {
            width: auto;
          }
          .printing-landscape .schedule-print-report .col-date {
            width: 84px;
          }
          .printing-landscape .schedule-print-report .col-days {
            width: 48px;
            text-align: right;
          }
          .printing-landscape .schedule-print-report .col-float {
            width: 44px;
            text-align: right;
          }
          .printing-landscape .schedule-print-report .col-pct {
            width: 38px;
            text-align: right;
          }

          /* Portrait: compact % widths — all seven columns fit A4 portrait */
          .printing-portrait .schedule-print-report {
            font-size: 9px;
          }
          .printing-portrait .schedule-print-report th {
            font-size: 8px;
            padding: 2px 4px;
          }
          .printing-portrait .schedule-print-report td {
            padding: 1.5px 4px;
          }
          .printing-portrait .schedule-print-report .col-wbs {
            width: 6%;
            font-family: ui-monospace, monospace;
            color: #555;
          }
          .printing-portrait .schedule-print-report .col-name {
            width: 41%;
          }
          .printing-portrait .schedule-print-report .col-date {
            width: 14%;
          }
          .printing-portrait .schedule-print-report .col-days {
            width: 8%;
            text-align: right;
          }
          .printing-portrait .schedule-print-report .col-float {
            width: 8%;
            text-align: right;
          }
          .printing-portrait .schedule-print-report .col-pct {
            width: 9%;
            text-align: right;
          }

          .schedule-print-report .col-wbs {
            font-family: ui-monospace, monospace;
            color: #555;
          }
          .schedule-print-report tr.is-group td {
            font-weight: 600;
            background: #f9fafb;
          }
          .schedule-print-report tr.st-critical td {
            background: #fee2e2;
            color: #991b1b;
          }
          .schedule-print-report tr.st-critical td.col-name {
            font-weight: 600;
          }
          .schedule-print-report tr.st-running td {
            background: #dbeafe;
            color: #1e40af;
          }
          .schedule-print-report tr.st-done td {
            background: #dcfce7;
            color: #166534;
          }
          .schedule-print-report thead {
            display: table-header-group;
          }
          .schedule-print-report tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}