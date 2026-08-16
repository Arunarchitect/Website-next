"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import { toSvg } from "html-to-image";

/* ------------------------------------------------------------------ */
/*  Shared button style tokens                                        */
/* ------------------------------------------------------------------ */

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
const btnGhost = `${btnBase} text-gray-600 hover:bg-gray-100`;
const btnOutline = `${btnBase} border border-gray-200 text-gray-700 hover:bg-gray-50`;
const btnPrimary = `${btnBase} bg-indigo-600 text-white hover:bg-indigo-500`;

/* ------------------------------------------------------------------ */
/*  Measurement helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * The container's own scrollWidth/scrollHeight/offsetWidth/offsetHeight
 * only account for normal-flow content — they do NOT grow to fit
 * absolutely-positioned children (which is how the diagram nodes and
 * RelationshipArrows overlay are laid out).
 *
 * html2canvas doesn't have this problem because it walks the whole DOM
 * tree and paints based on each descendant's real position, which is why
 * PNG export has always been accurate.
 *
 * For SVG/PDF we have to measure that same true extent ourselves: union
 * the bounding box of every descendant relative to the container's own
 * top-left corner.
 */
const measureFullContentSize = (el: HTMLElement) => {
  const elRect = el.getBoundingClientRect();

  let minLeft = 0;
  let minTop = 0;
  let maxRight = elRect.width;
  let maxBottom = elRect.height;

  el.querySelectorAll<HTMLElement>("*").forEach((node) => {
    const rect = node.getBoundingClientRect();
    const left = rect.left - elRect.left;
    const top = rect.top - elRect.top;
    const right = rect.right - elRect.left;
    const bottom = rect.bottom - elRect.top;

    if (left < minLeft) minLeft = left;
    if (top < minTop) minTop = top;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  });

  return {
    width: Math.ceil(maxRight - minLeft),
    height: Math.ceil(maxBottom - minTop),
    offsetX: minLeft,
    offsetY: minTop,
  };
};

/**
 * Walks up from `start` and temporarily forces `overflow: visible` on any
 * ancestor that's currently clipping (e.g. the pan/zoom viewport and the
 * <main> box are both `overflow: hidden`, sized to the visible screen).
 *
 * html2canvas ignores ancestor clipping when capturing a specific element,
 * which is why PNG export doesn't need this — but toSvg() and the browser's
 * native print pipeline both respect real layout/clipping, so once the
 * diagram's transform is reset to 100% zoom, anything beyond the visible
 * viewport would otherwise get cut off.
 *
 * Returns a function that restores the original inline overflow values.
 */
const unclipAncestors = (start: HTMLElement) => {
  const restore: Array<() => void> = [];
  let node: HTMLElement | null = start.parentElement;

  while (node && node !== document.body) {
    const computed = window.getComputedStyle(node);
    if (
      computed.overflow !== "visible" ||
      computed.overflowX !== "visible" ||
      computed.overflowY !== "visible"
    ) {
      const prevOverflow = node.style.overflow;
      const prevOverflowX = node.style.overflowX;
      const prevOverflowY = node.style.overflowY;

      node.style.overflow = "visible";
      node.style.overflowX = "visible";
      node.style.overflowY = "visible";

      const target = node;
      restore.push(() => {
        target.style.overflow = prevOverflow;
        target.style.overflowX = prevOverflowX;
        target.style.overflowY = prevOverflowY;
      });
    }

    node = node.parentElement;
  }

  return () => restore.forEach((fn) => fn());
};

/**
 * Prepares the diagram root for SVG/PDF export:
 * - Resets the pan/zoom transform
 * - Neutralizes the centering left/top so content starts at 0,0
 * - Disables transition for consistent measuring
 *
 * Returns a function that restores the original inline styles.
 */
const prepareElementForExport = (el: HTMLElement) => {
  const prev = {
    transform: el.style.transform,
    transition: el.style.transition,
    left: el.style.left,
    top: el.style.top,
  };

  el.style.transition = "none";
  el.style.transform = "none";
  el.style.left = "0";
  el.style.top = "0";

  return () => {
    el.style.transform = prev.transform;
    el.style.transition = prev.transition;
    el.style.left = prev.left;
    el.style.top = prev.top;
  };
};

/* ------------------------------------------------------------------ */
/*  Upload                                                            */
/* ------------------------------------------------------------------ */

interface UploadButtonProps {
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadButton({ onUpload }: UploadButtonProps) {
  return (
    <label
      className={`${btnPrimary} h-8 px-2.5 text-xs cursor-pointer shrink-0 sm:h-9 sm:px-3 sm:text-sm`}
      title="Upload a process JSON file"
    >
      Upload
      <input
        type="file"
        accept=".json,application/json"
        onChange={onUpload}
        className="hidden"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Export buttons                                                    */
/* ------------------------------------------------------------------ */

interface ExportButtonsProps {
  printRef: React.RefObject<HTMLDivElement | null>;
  setError: (message: string) => void;
}

export function ExportButtons({ printRef, setError }: ExportButtonsProps) {
  const [exportModal, setExportModal] = useState<"pdf" | null>(null);
  const [pdfPageSize, setPdfPageSize] = useState<"A4" | "A3" | "A2">("A4");
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">(
    "landscape"
  );

  const getElementForExport = () => printRef.current;

  const captureFullDiagram = async (format: "png" | "svg") => {
    const el = getElementForExport();
    if (!el) {
      setError("Diagram is not ready to export. Please try again.");
      return;
    }

    const restoreElement = prepareElementForExport(el);

    try {
      if (format === "png") {
        const canvas = await html2canvas(el, {
          scale: 3,
          backgroundColor: "#ffffff",
          logging: false,
          useCORS: true,
        });

        const link = document.createElement("a");
        link.download = "workflow.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        // SVG needs the full measured content size, not the root container
        // size. The root may be 1700px wide while absolute children extend
        // much further.
        const { width, height } = measureFullContentSize(el);

        const restoreAncestors = unclipAncestors(el);
        try {
          const dataUrl = await toSvg(el, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
            width,
            height,
          });

          const link = document.createElement("a");
          link.download = "workflow.svg";
          link.href = dataUrl;
          link.click();
        } finally {
          restoreAncestors();
        }
      }
    } catch (err) {
      console.error(`Export ${format.toUpperCase()} failed:`, err);
      setError(`Export ${format.toUpperCase()} failed. Check console.`);
    } finally {
      restoreElement();
    }
  };

  const exportPng = () => captureFullDiagram("png");
  const exportSvg = () => captureFullDiagram("svg");

  const exportPdf = (
    pageSize: "A4" | "A3" | "A2",
    orientation: "portrait" | "landscape"
  ) => {
    const style = document.createElement("style");
    style.id = "print-page-style";
    style.innerHTML = `
      @page {
        size: ${pageSize} ${orientation};
        margin: 0;
      }
    `;
    document.head.appendChild(style);

    const el = getElementForExport();
    if (!el) {
      style.remove();
      setError("Diagram is not ready to export. Please try again.");
      return;
    }

    const restoreElement = prepareElementForExport(el);
    const restoreAncestors = unclipAncestors(el);

    // Measure the full diagram, not just the root container.
    const { width: naturalWidth, height: naturalHeight } =
      measureFullContentSize(el);

    const pageSizes: Record<string, { width: number; height: number }> = {
      A4: { width: 794, height: 1123 },
      A3: { width: 1123, height: 1587 },
      A2: { width: 1587, height: 2245 },
    };

    const page = pageSizes[pageSize];
    const pageWidth = orientation === "landscape" ? page.height : page.width;
    const pageHeight = orientation === "landscape" ? page.width : page.height;

    const scaleX = pageWidth / naturalWidth;
    const scaleY = pageHeight / naturalHeight;
    const printScale = Math.min(scaleX, scaleY, 1);

    document.documentElement.style.setProperty(
      "--print-scale",
      printScale.toString()
    );

    document.body.classList.add("printing");
    window.print();

    window.addEventListener(
      "afterprint",
      () => {
        document.body.classList.remove("printing");
        document.documentElement.style.removeProperty("--print-scale");
        const existingStyle = document.getElementById("print-page-style");
        if (existingStyle) existingStyle.remove();

        // Restore the live pan/zoom and ancestor clipping.
        restoreElement();
        restoreAncestors();
      },
      { once: true }
    );
  };

  return (
    <>
      <button
        onClick={exportPng}
        title="Export as PNG"
        className={`${btnGhost} h-8 px-2 text-xs shrink-0 sm:h-9 sm:px-2.5 sm:text-sm`}
      >
        PNG
      </button>

      <button
        onClick={() => setExportModal("pdf")}
        title="Export as PDF"
        className={`${btnGhost} h-8 px-2 text-xs shrink-0 sm:h-9 sm:px-2.5 sm:text-sm`}
      >
        PDF
      </button>

      <button
        onClick={exportSvg}
        title="Export as SVG"
        className={`${btnGhost} h-8 px-2 text-xs shrink-0 sm:h-9 sm:px-2.5 sm:text-sm`}
      >
        SVG
      </button>

      {/* PDF EXPORT DIALOG */}
      {exportModal === "pdf" && (
        <div
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm no-print"
          onClick={() => setExportModal(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md mx-0 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900">
              PDF Export Settings
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page Size
              </label>
              <div className="flex gap-2">
                {["A4", "A3", "A2"].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPdfPageSize(size as "A4" | "A3" | "A2")}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      pdfPageSize === size
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orientation
              </label>
              <div className="flex gap-2">
                {["portrait", "landscape"].map((orient) => (
                  <button
                    key={orient}
                    onClick={() =>
                      setPdfOrientation(orient as "portrait" | "landscape")
                    }
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      pdfOrientation === orient
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {orient.charAt(0).toUpperCase() + orient.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setExportModal(null)}
                className={`${btnOutline} h-10 px-4 text-sm`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setExportModal(null);
                  exportPdf(pdfPageSize, pdfOrientation);
                }}
                className={`${btnPrimary} h-10 px-4 text-sm`}
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}