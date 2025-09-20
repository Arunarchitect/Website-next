"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { useParams, useSearchParams, useRouter } from "next/navigation";

// Interfaces (same as before)
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Organisation {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  organisationId: string;
}

export interface ViewerFile {
  id: string;
  userId: string;
  organisationId: string;
  projectId: string;
  viewName: string;
  viewDate: string;
  file: string;
  file_url?: string;
  title: string;
  description?: string;
  tags?: string[];
  createdAt: string;
}

export interface ProjectAccessKey {
  id: string;
  organisationId: string;
  projectId: string;
  accessKey: string;
}

interface BackendResponse {
  project: {
    id: number;
    name: string;
  };
  organisation: {
    id: number;
    name: string;
  };
  svg_files: Array<{
    id: number;
    user: number;
    organisation: number;
    project: number;
    view_name: string;
    view_date: string;
    file: string;
    file_url: string;
    description: string;
    tags: string[];
    tag_names: string[];
    created_at: string;
  }>;
}

export default function SvgViewerWithZoomPan() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const accessKey = params.accessKey as string;
  
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("file");
  const [unlockedDrawings, setUnlockedDrawings] = useState<ViewerFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Transform state for pan & zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  // Check if this is an uploaded file (ID starts with "uploaded-")
  const isUploadedFile = accessKey.startsWith("uploaded-");
  const fileUrl = searchParams.get("file");
  const fileNameParam = searchParams.get("name");

  // Load SVG from file
  const loadSvg = useCallback(async (file: ViewerFile) => {
    try {
      let text: string;

      // Check if it's an uploaded file (has blob URL)
      if (file.file.startsWith("blob:") || file.file.startsWith("data:")) {
        // For uploaded files, fetch from blob URL
        const res = await fetch(file.file);
        text = await res.text();
      } else {
        // For backend files, use the full URL from the backend response
        const fileUrl = file.file; // This should be the full URL like "http://localhost:8000/media/..."
        const res = await fetch(fileUrl);

        if (!res.ok) {
          throw new Error(
            `Failed to fetch SVG: ${res.status} ${res.statusText}`
          );
        }

        text = await res.text();
      }

      // Optimize SVG for mobile if it's too large
      const optimizedSvgText = optimizeSvgForMobile(text);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(optimizedSvgText, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return alert("Invalid SVG file");

      // Store both the element and the original content
      setSvgElement(svg.cloneNode(true) as SVGSVGElement);
      setSvgContent(optimizedSvgText);
      setFileName(file.viewName || file.title);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } catch (err) {
      console.error("Failed to load SVG:", err);
      alert("Failed to load SVG: " + (err as Error).message);
    }
  }, []);

  // Simple SVG optimization for mobile
  const optimizeSvgForMobile = (svgText: string): string => {
    // For very large SVGs, we might need to simplify them
    // This is a basic implementation - you might want to expand it
    if (svgText.length > 500000) { // If SVG is larger than 500KB
      console.warn("Large SVG detected, consider optimizing it for better mobile performance");
    }
    
    return svgText;
  };

  // Fetch drawings from backend using access key
  const fetchDrawings = useCallback(async (key: string) => {
    if (!key.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.modelflick.com/api/viewer/public/svg-files/${key}/`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: BackendResponse = await response.json();

      // Convert backend response to ViewerFile format
      const drawings: ViewerFile[] = data.svg_files.map((svgFile) => ({
        id: svgFile.id.toString(),
        userId: svgFile.user.toString(),
        organisationId: svgFile.organisation.toString(),
        projectId: svgFile.project.toString(),
        viewName: svgFile.view_name,
        viewDate: svgFile.view_date,
        file: svgFile.file,
        file_url: svgFile.file_url,
        title: svgFile.view_name,
        description: svgFile.description,
        tags: svgFile.tag_names.length > 0 ? svgFile.tag_names : svgFile.tags,
        createdAt: svgFile.created_at,
      }));

      setUnlockedDrawings(drawings);

      if (drawings.length > 0) {
        // Automatically load the first drawing
        loadSvg(drawings[0]);
      } else {
        alert("No drawings found for this access key");
      }
    } catch (err) {
      console.error("Failed to fetch drawings:", err);
      alert("Invalid access key or failed to fetch drawings");
    } finally {
      setIsLoading(false);
    }
  }, [loadSvg]);

  // Load uploaded file
  const loadUploadedFile = useCallback(async () => {
    if (!fileUrl || !fileNameParam) return;
    
    try {
      const res = await fetch(fileUrl);
      const text = await res.text();
      
      // Optimize SVG for mobile
      const optimizedSvgText = optimizeSvgForMobile(text);
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(optimizedSvgText, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return alert("Invalid SVG file");

      setSvgElement(svg.cloneNode(true) as SVGSVGElement);
      setSvgContent(optimizedSvgText);
      setFileName(fileNameParam);
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } catch (err) {
      console.error("Failed to load uploaded SVG:", err);
      alert("Failed to load SVG: " + (err as Error).message);
    }
  }, [fileUrl, fileNameParam]);

  // Initialize based on route type
  useEffect(() => {
    if (isUploadedFile) {
      loadUploadedFile();
    } else {
      fetchDrawings(accessKey);
    }
  }, [accessKey, isUploadedFile, loadUploadedFile, fetchDrawings]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    
    // Use requestAnimationFrame for smoother zooming
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      setScale((prev) => Math.min(Math.max(prev * delta, 0.1), 10));
    });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    
    // Use requestAnimationFrame for smoother panning
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    });
  };
  
  const handleMouseUp = () => {
    dragging.current = false;
  };

  // Touch pan handlers - optimized for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single finger touch for panning
      dragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // Two finger touch for pinch-to-zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialScale.current = scale;
    }
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Use requestAnimationFrame for smoother performance on mobile
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (e.touches.length === 1 && dragging.current) {
        // Single finger panning
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (e.touches.length === 2) {
        // Two finger pinch-to-zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (initialDistance.current) {
          const zoomFactor = currentDistance / initialDistance.current;
          setScale(initialScale.current * zoomFactor);
        }
      }
    });
    
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    dragging.current = false;
    initialDistance.current = 0;
  };

  // Reset view
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!viewerRef.current) return;
    
    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

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
        height,
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
      const svgBlob = new Blob([svgContent], {
        type: "image/svg+xml;charset=utf-8",
      });
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
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Set canvas dimensions to match the image
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image on canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Create download link
      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL("image/png");
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
      {/* Back button to return to main page */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button 
          onClick={() => router.push('/tools/drawing')}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          ← Back to Main
        </button>
        <h2 style={{ margin: 0 }}>SVG Viewer - {fileName}</h2>
        <div style={{ width: "100px" }}></div> {/* Spacer for alignment */}
      </div>

      {/* Available drawings list (only for access key routes) */}
      {!isUploadedFile && unlockedDrawings.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <h3>Available Drawings</h3>
          {unlockedDrawings.map((f) => (
            <div key={f.id}>
              <button
                onClick={() => loadSvg(f)}
                style={{ 
                  margin: "2px", 
                  cursor: "pointer",
                  backgroundColor: fileName === (f.viewName || f.title) ? "#ddd" : "transparent"
                }}
              >
                {f.viewName || f.title}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {svgElement && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setScale((s) => Math.min(s + 0.1, 10))}>
            Zoom In
          </button>
          <button onClick={() => setScale((s) => Math.max(s - 0.1, 0.1))}>
            Zoom Out
          </button>
          <button onClick={resetView}>Reset View</button>
          <button onClick={toggleFullscreen}>
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && <p>Loading drawings...</p>}

      {/* Viewer */}
      <div
        ref={viewerRef}
        style={{
          position: isFullscreen ? "fixed" : "relative",
          top: isFullscreen ? 0 : "auto",
          left: isFullscreen ? 0 : "auto",
          width: isFullscreen ? "100vw" : "auto",
          height: isFullscreen ? "100vh" : "auto",
          zIndex: isFullscreen ? 9999 : "auto",
          backgroundColor: isFullscreen ? "white" : "transparent",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
            border: "1px solid #ccc",
            margin: "auto",
            maxWidth: isFullscreen ? "100%" : "80vw",
            maxHeight: isFullscreen ? "100%" : "60vh",
            overflow: "hidden",
            cursor: dragging.current ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
            backgroundColor: "#f9f9f9",
            // Force GPU acceleration for smoother performance
            transform: "translateZ(0)",
            willChange: "transform",
          }}
        >
          {svgElement && (
            <div
              style={{
                transformOrigin: "0 0",
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                display: "inline-block",
                // Force GPU acceleration for smoother performance
                willChange: "transform",
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
      </div>

      {svgElement && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={downloadPdf}
            style={{
              marginRight: 10,
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
            disabled={isConverting}
          >
            Download as Vector PDF
          </button>
          <button
            onClick={downloadPng}
            style={{
              marginRight: 10,
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
            disabled={isConverting}
          >
            {isConverting ? "Converting..." : "Download as PNG"}
          </button>
        </div>
      )}
    </div>
  );
}