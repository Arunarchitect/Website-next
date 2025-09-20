"use client";

import { useState, useRef, ChangeEvent } from "react";
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { svgFiles, accessKeys, ViewerFile, ProjectAccessKey } from "./data"; // adjust path if needed

export default function SvgViewerWithZoomPan() {
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("file");
  const [accessKey, setAccessKey] = useState<string>("");
  const [unlockedDrawings, setUnlockedDrawings] = useState<ViewerFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<ViewerFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  // Transform state for pan & zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load SVG from file
  const loadSvg = async (file: ViewerFile) => {
    try {
      let text: string;
      
      // Check if it's an uploaded file (has blob URL)
      if (file.file.startsWith('blob:') || file.file.startsWith('data:')) {
        // For uploaded files, fetch from blob URL
        const res = await fetch(file.file);
        text = await res.text();
      } else {
        // For pre-defined files, fetch from server path
        const res = await fetch(`/${file.file}`);
        text = await res.text();
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return alert("Invalid SVG file");
      
      // Store both the element and the original content
      setSvgElement(svg.cloneNode(true) as SVGSVGElement);
      setSvgContent(text);
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

  // Handle file upload - FIXED VERSION
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
        setSvgContent(text);
        
        // Create a clone of the SVG element for display
        setSvgElement(svg.cloneNode(true) as SVGSVGElement);
        setFileName(file.name.replace(/\.svg$/i, ""));
        setScale(1);
        setOffset({ x: 0, y: 0 });
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

  // Reset view
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Download PDF (fixed text distortion)
  const downloadPdf = async () => {
    if (!svgElement || !svgContent) return alert("No SVG loaded");
    
    try {
      // Create a new SVG element from the original content
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const originalSvg = doc.querySelector("svg");
      if (!originalSvg) return;
      
      // Get dimensions
      let width = parseFloat(originalSvg.getAttribute("width") || "210");
      let height = parseFloat(originalSvg.getAttribute("height") || "297");
      
      if ((!width || !height) && originalSvg.viewBox.baseVal) {
        width = originalSvg.viewBox.baseVal.width || width;
        height = originalSvg.viewBox.baseVal.height || height;
      }
      
      // Create PDF
      const pdf = new jsPDF({
        unit: "pt",
        format: [width, height],
        orientation: width > height ? "landscape" : "portrait",
      });
      
      // Add SVG to PDF (using original, untransformed SVG)
      await pdf.svg(originalSvg, { 
        x: 0, 
        y: 0, 
        width, 
        height 
      });
      
      pdf.save(`${fileName}.pdf`);
    } catch (e) {
      alert("Error exporting PDF: " + (e as Error).message);
    }
  };

  // Download PNG directly
  const downloadPng = async () => {
    if (!svgElement || !svgContent) return alert("No SVG loaded");
    
    setIsConverting(true);
    
    try {
      // Create an image from the SVG data
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      // Wait for image to load
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      
      URL.revokeObjectURL(url);
      
      // Create a canvas with the correct dimensions
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      
      // Set canvas dimensions to match the image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image on canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Error exporting PNG:", e);
      alert("Error exporting PNG: " + (e as Error).message);
    } finally {
      setIsConverting(false);
    }
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

      {/* Controls */}
      {svgElement && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setScale(s => Math.min(s + 0.1, 10))}>Zoom In</button>
          <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}>Zoom Out</button>
          <button onClick={resetView}>Reset View</button>
        </div>
      )}

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
                el.appendChild(svgElement.cloneNode(true));
              }
            }}
          />
        )}
      </div>

      {svgElement && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={downloadPdf}
            style={{ marginRight: 10, padding: "0.5rem 1rem", cursor: "pointer" }}
            disabled={isConverting}
          >
            Download as Vector PDF
          </button>
          <button
            onClick={downloadPng}
            style={{ marginRight: 10, padding: "0.5rem 1rem", cursor: "pointer" }}
            disabled={isConverting}
          >
            {isConverting ? "Converting..." : "Download as PNG"}
          </button>
        </div>
      )}
    </div>
  );
}