"use client";

import { useState, useRef, ChangeEvent } from "react";
import { jsPDF } from "jspdf";
import "svg2pdf.js";

export default function SvgViewerWithZoomPan() {
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [fileName, setFileName] = useState<string>("file");

  // Transform state for pan & zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Load SVG from file input
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/svg+xml") {
      alert("Please upload a valid SVG file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) {
          alert("Invalid SVG file");
          return;
        }
        setSvgElement(svg.cloneNode(true) as SVGSVGElement);
        setFileName(file.name.replace(/\.svg$/i, ""));
        // Reset zoom & pan on new file
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    reader.readAsText(file);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 10));
  };

  // Drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  // Download PDF vector using svg2pdf.js
  const downloadPdf = () => {
    if (!svgElement) return alert("Please upload an SVG first.");

    let width = parseFloat(svgElement.getAttribute("width") || "210");
    let height = parseFloat(svgElement.getAttribute("height") || "297");

    if ((!width || !height) && svgElement.viewBox.baseVal) {
      width = svgElement.viewBox.baseVal.width || width;
      height = svgElement.viewBox.baseVal.height || height;
    }

    // Create a fresh jsPDF instance
    const pdf = new jsPDF({
      unit: "pt",
      format: [width, height],
      orientation: width > height ? "landscape" : "portrait",
    });

    // Clone SVG to apply transform without affecting original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

    // Apply current pan and zoom as transform attribute on SVG root
    const currentTransform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
    clonedSvg.style.transformOrigin = "0 0";
    clonedSvg.style.transform = currentTransform;

    pdf
      .svg(clonedSvg, { x: 0, y: 0, width, height })
      .then(() => pdf.save(`${fileName}.pdf`))
      .catch((e) => alert("Error exporting PDF: " + e.message));
  };

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>SVG Viewer with Zoom, Pan & Vector PDF Export</h2>

      <input
        id="file-input"
        type="file"
        accept=".svg"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />
      <button onClick={() => document.getElementById("file-input")?.click()} style={{ marginBottom: 20 }}>
        Upload SVG
      </button>

      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          border: "1px solid #ccc",
          margin: "auto",
          maxWidth: "80vw",
          maxHeight: "60vh",
          overflow: "hidden",
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
          backgroundColor: "#f9f9f9",
        }}
      >
        {svgElement && (
          <div
            style={{
              transformOrigin: "0 0",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              display: "inline-block",
            }}
            ref={(el) => {
              if (el) {
                // Clear previous SVG
                while (el.firstChild) el.removeChild(el.firstChild);
                el.appendChild(svgElement);
              }
            }}
          />
        )}
      </div>

      {svgElement && (
        <button
          onClick={downloadPdf}
          style={{ marginTop: 20, padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Download PDF
        </button>
      )}
    </div>
  );
}
