"use client";

import { useState, useRef, ChangeEvent } from "react";
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { svgFiles, accessKeys, ViewerFile, ProjectAccessKey } from "./data"; // adjust path if needed

export default function SvgViewerWithZoomPan() {
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [fileName, setFileName] = useState<string>("file");
  const [accessKey, setAccessKey] = useState<string>("");
  const [unlockedDrawings, setUnlockedDrawings] = useState<ViewerFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<ViewerFile[]>([]);

  // Transform state for pan & zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load SVG from file
  const loadSvg = async (file: ViewerFile) => {
    try {
      const res = await fetch(`/${file.file}`);
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return alert("Invalid SVG file");
      setSvgElement(svg.cloneNode(true) as SVGSVGElement);
      setFileName(file.title);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } catch (err) {
      alert("Failed to load SVG: " + err);
    }
  };

  // Unlock drawings using access key
  const handleUnlock = () => {
    const key: ProjectAccessKey | undefined = accessKeys.find(
      (k) => k.accessKey === accessKey
    );
    if (!key) return alert("Invalid access key");

    const drawings = svgFiles.filter(
      (f) => f.projectId === key.projectId && f.organisationId === key.organisationId
    );
    setUnlockedDrawings(drawings);
  };

  // Handle file upload
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
        if (!svg) return alert("Invalid SVG file");

        const uploadedFile: ViewerFile = {
          id: `uploaded-${Date.now()}`,
          userId: "u1",
          organisationId: "org1",
          projectId: "p1",
          viewName: file.name.replace(/\.svg$/i, ""),
          viewDate: new Date().toISOString().slice(0, 10),
          file: URL.createObjectURL(file),
          title: file.name.replace(/\.svg$/i, ""),
          createdAt: new Date().toISOString(),
        };

        setUploadedFiles((prev) => [uploadedFile, ...prev]);
        loadSvg(uploadedFile);
      }
    };
    reader.readAsText(file);
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 10));
  };

  // Drag pan
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

  // Download PDF
  const downloadPdf = () => {
    if (!svgElement) return alert("No SVG loaded");
    let width = parseFloat(svgElement.getAttribute("width") || "210");
    let height = parseFloat(svgElement.getAttribute("height") || "297");
    if ((!width || !height) && svgElement.viewBox.baseVal) {
      width = svgElement.viewBox.baseVal.width || width;
      height = svgElement.viewBox.baseVal.height || height;
    }
    const pdf = new jsPDF({
      unit: "pt",
      format: [width, height],
      orientation: width > height ? "landscape" : "portrait",
    });
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.style.transformOrigin = "0 0";
    clonedSvg.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
    pdf.svg(clonedSvg, { x: 0, y: 0, width, height })
      .then(() => pdf.save(`${fileName}.pdf`))
      .catch((e) => alert("Error exporting PDF: " + e.message));
  };

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>SVG Viewer with Zoom, Pan & Download</h2>

      {/* Access Key */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Enter access key"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
        />
        <button onClick={handleUnlock}>Unlock</button>
      </div>

      {/* Upload */}
      <div style={{ marginBottom: 10 }}>
        <input
          id="file-input"
          type="file"
          accept=".svg"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <button onClick={() => document.getElementById("file-input")?.click()}>
          Upload SVG
        </button>
      </div>

      {/* Available drawings */}
      <div style={{ marginBottom: 10 }}>
        {[...uploadedFiles, ...unlockedDrawings].map((f) => (
          <div key={f.id}>
            <button
              onClick={() => loadSvg(f)}
              style={{ margin: "2px", cursor: "pointer" }}
            >
              {f.title}
            </button>
          </div>
        ))}
      </div>

      {/* Viewer */}
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
