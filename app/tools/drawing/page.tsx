"use client";

import { useState, useRef, ChangeEvent } from "react";
import jsPDF from "jspdf";
import Image from "next/image";

export default function FileViewerPage() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("file");
  const [pdfScale, setPdfScale] = useState<number>(2); // resolution multiplier

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // File upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/svg+xml") {
      alert("Please upload a valid SVG file");
      return;
    }

    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setFileName(file.name.replace(/\.svg$/i, ""));
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleClear = () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
  };

  // Zoom / Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.min(Math.max(prev * factor, 0.1), 10));
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    dragging.current = true;
    if ("touches" in e)
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    else lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging.current) return;
    let x = 0,
      y = 0;
    if ("touches" in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    const dx = x - lastPos.current.x;
    const dy = y - lastPos.current.y;
    lastPos.current = { x, y };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  // Download PDF (rasterized)
  const handleDownloadPDF = () => {
    if (!svgContainerRef.current || !fileUrl) return;

    const img = new Image();
    img.src = fileUrl;
    img.onload = () => {
      const svgEl = svgContainerRef.current!.querySelector("svg"); // fixed to const
      let width = 0,
        height = 0;

      if (svgEl) {
        const viewBox = svgEl.getAttribute("viewBox");
        if (viewBox) {
          const parts = viewBox.split(" ");
          width = parseFloat(parts[2]);
          height = parseFloat(parts[3]);
        } else {
          width = parseFloat(svgEl.getAttribute("width") || "800");
          height = parseFloat(svgEl.getAttribute("height") || "600");
        }
      } else {
        width = img.width;
        height = img.height;
      }

      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      const canvas = document.createElement("canvas");
      canvas.width = scaledWidth * pdfScale;
      canvas.height = scaledHeight * pdfScale;

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(
        scale * pdfScale,
        0,
        0,
        scale * pdfScale,
        offset.x * pdfScale,
        offset.y * pdfScale
      );
      ctx.drawImage(img, 0, 0, width, height);

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      const dataURL = canvas.toDataURL("image/png");
      pdf.addImage(dataURL, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${fileName}.pdf`);
    };
  };

  // Download original SVG
  const handleDownloadSVG = () => {
    if (!fileUrl) return;
    fetch(fileUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.svg`;
        link.click();
      });
  };

  return (
    <div style={{ padding: "1rem", textAlign: "center" }}>
      <h1 style={{ marginBottom: "1rem" }}>Upload SVG</h1>

      <input
        id="file-upload"
        type="file"
        accept=".svg"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <button
        style={{
          padding: "0.5rem 1rem",
          marginRight: "1rem",
          cursor: "pointer",
        }}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        Select File
      </button>

      {fileUrl && (
        <>
          <button
            style={{
              padding: "0.5rem 1rem",
              marginLeft: "0.5rem",
              cursor: "pointer",
            }}
            onClick={handleClear}
          >
            Clear
          </button>

          <input
            type="number"
            value={pdfScale}
            min={1}
            max={10}
            style={{ width: "60px", marginLeft: "0.5rem" }}
            onChange={(e) => setPdfScale(Number(e.target.value))}
            title="Set PDF resolution multiplier"
          />

          <button
            style={{
              padding: "0.5rem 1rem",
              cursor: "pointer",
              marginLeft: "0.5rem",
            }}
            onClick={handleDownloadPDF}
          >
            Download as PDF
          </button>

          <button
            style={{
              padding: "0.5rem 1rem",
              cursor: "pointer",
              marginLeft: "0.5rem",
            }}
            onClick={handleDownloadSVG}
          >
            Download as SVG
          </button>
        </>
      )}

      <p style={{ marginTop: "0.5rem", color: "#666" }}>
        Select an SVG file to view. Use mouse/touch to zoom & pan. PDF will
        match SVG&apos;s natural size.
      </p>

      {fileUrl && (
        <div
          ref={svgContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          style={{
            marginTop: "1rem",
            width: "100%",
            height: "80vh",
            overflow: "hidden",
            border: "1px solid #ccc",
            touchAction: "none",
            position: "relative",
          }}
        >
          {/* Using next/image for optimization */}
          <Image
            src={fileUrl}
            alt="SVG"
            fill
            style={{
              objectFit: "contain",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}
