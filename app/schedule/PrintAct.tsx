"use client";

import type { Task } from "./data";

/**
 * Print / PDF button.
 *
 * Strategy: trigger window.print() with a print-only stylesheet that hides
 * everything marked `data-print-hide` and cleans up the layout. Users then
 * choose "Save as PDF" in the browser's print dialog — no extra dependency.
 *
 * Renders a small button. Pass `tasks` so we can compute a couple of summary
 * numbers for the printed header; if you don't need them, pass an empty array.
 */
export function PrintAct({ tasks }: { tasks: Task[] }) {
  const total = tasks.filter((t) => {
    const hasKids = tasks.some((c) => c.parentId === t.id);
    return !hasKids;
  }).length;

  const handlePrint = () => {
    // Give the browser a tick to apply the print styles before opening dialog
    document.body.classList.add("printing");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("printing");
    }, 30);
  };

  return (
    <>
      <button
        onClick={handlePrint}
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

      {/* Print-only stylesheet. Everything with [data-print-hide] is hidden;
          the main <main> is scaled to fill A4 landscape; the Gantt section
          is allowed to break across pages. */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          body {
            background: white !important;
          }
          [data-print-hide],
          button,
          input[type="range"],
          input[type="checkbox"] {
            display: none !important;
          }
          /* Keep date inputs readable in print — render as plain text */
          input[type="date"] {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            appearance: none;
            -webkit-appearance: none;
            color: #111;
          }
          /* Tighten table spacing */
          table {
            font-size: 10px !important;
          }
          th,
          td {
            padding: 2px 4px !important;
          }
          /* Force section breaks before the table when printing from the page */
          section {
            break-inside: avoid;
          }
          /* Gantt scroll containers should expand, not clip */
          .overflow-x-auto,
          .overflow-y-auto {
            overflow: visible !important;
          }
          /* Slight scale-down so the Gantt fits width-wise */
          main {
            max-width: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </>
  );
}