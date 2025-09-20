"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import NextImage from "next/image";

// Interfaces (unchanged)
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
  const [pngDataUrl, setPngDataUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("file");
  const [unlockedDrawings, setUnlockedDrawings] = useState<ViewerFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [usePngForMobile, setUsePngForMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // PNG cache to store converted images
  const [pngCache, setPngCache] = useState<Record<string, string>>({});

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

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };

    setIsMobile(checkIfMobile());
  }, []);

  // Convert SVG to PNG
  const convertSvgToPng = useCallback(
    async (svgContent: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const svgBlob = new Blob([svgContent], {
          type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(svgBlob);

        // Use window.Image instead of Image to avoid conflict with Next.js Image component
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Could not get canvas context"));
            return;
          }

          // Draw white background first
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the SVG
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const dataUrl = canvas.toDataURL("image/png");
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG image"));
        };

        img.src = url;
      });
    },
    []
  );

  // Load SVG from file
  const loadSvg = useCallback(
    async (file: ViewerFile, index: number = 0) => {
      try {
        let text: string;

        // Check if it's an uploaded file (has blob URL)
        if (file.file.startsWith("blob:") || file.file.startsWith("data:")) {
          // For uploaded files, fetch from blob URL
          const res = await fetch(file.file);
          text = await res.text();
        } else {
          // For backend files, use the full URL from the backend response
          const fileUrl = file.file;
          const res = await fetch(fileUrl);

          if (!res.ok) {
            throw new Error(
              `Failed to fetch SVG: ${res.status} ${res.statusText}`
            );
          }

          text = await res.text();
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (!svg) return alert("Invalid SVG file");

        // Store both the element and the original content
        setSvgElement(svg.cloneNode(true) as SVGSVGElement);
        setSvgContent(text);
        setFileName(file.viewName || file.title);
        setActiveFileId(file.id);
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setActiveTab(index);
        
        // Reset PNG view when switching files
        setUsePngForMobile(false);
      } catch (err) {
        console.error("Failed to load SVG:", err);
        alert("Failed to load SVG: " + (err as Error).message);
      }
    },
    []
  );

  // Fetch drawings from backend using access key
  const fetchDrawings = useCallback(
    async (key: string) => {
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
          loadSvg(drawings[0], 0);
        } else {
          alert("No drawings found for this access key");
        }
      } catch (err) {
        console.error("Failed to fetch drawings:", err);
        alert("Invalid access key or failed to fetch drawings");
      } finally {
        setIsLoading(false);
      }
    },
    [loadSvg]
  );

  // Load uploaded file
  const loadUploadedFile = useCallback(async () => {
    if (!fileUrl || !fileNameParam) return;

    try {
      const res = await fetch(fileUrl);
      const text = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg) return alert("Invalid SVG file");

      setSvgElement(svg.cloneNode(true) as SVGSVGElement);
      setSvgContent(text);
      setFileName(fileNameParam);
      setActiveFileId("uploaded-file");
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setUsePngForMobile(false);
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

  // Zoom handlers - fixed to zoom from cursor position
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (!containerRef.current) return;

    const zoomFactor = 1.1;
    const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 10);

    // Get mouse position relative to the container
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the mouse position in the SVG coordinate system
    const mouseXInSvg = (mouseX - offset.x) / scale;
    const mouseYInSvg = (mouseY - offset.y) / scale;

    // Calculate new offset to keep the mouse position fixed
    const newOffsetX = mouseX - mouseXInSvg * newScale;
    const newOffsetY = mouseY - mouseYInSvg * newScale;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    });
  };

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;

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

  // Touch pan handlers - optimized for mobile with proper zoom origin
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialDistance.current = Math.sqrt(dx * dx + dy * dy);
      initialScale.current = scale;

      // Store the midpoint for zoom origin
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      lastPos.current = { x: midX, y: midY };
    }
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (e.touches.length === 1 && dragging.current) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      } else if (e.touches.length === 2 && containerRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (initialDistance.current) {
          const zoomFactor = currentDistance / initialDistance.current;
          const newScale = Math.min(
            Math.max(initialScale.current * zoomFactor, 0.1),
            10
          );

          // Calculate midpoint for zoom origin
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

          // Get container position
          const rect = containerRef.current.getBoundingClientRect();
          const containerX = midX - rect.left;
          const containerY = midY - rect.top;

          // Calculate the touch position in the SVG coordinate system
          const touchXInSvg = (containerX - offset.x) / scale;
          const touchYInSvg = (containerY - offset.y) / scale;

          // Calculate new offset to keep the touch position fixed
          const newOffsetX = containerX - touchXInSvg * newScale;
          const newOffsetY = containerY - touchYInSvg * newScale;

          setScale(newScale);
          setOffset({ x: newOffsetX, y: newOffsetY });
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
      viewerRef.current.requestFullscreen().catch((err) => {
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

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Download PDF (using original SVG for vector quality)
  const downloadPdf = async () => {
    if (!svgContent) return alert("No SVG loaded");

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, "image/svg+xml");
      const originalSvg = doc.querySelector("svg");
      if (!originalSvg) return;

      let width = parseFloat(originalSvg.getAttribute("width") || "210");
      let height = parseFloat(originalSvg.getAttribute("height") || "297");

      if ((!width || !height) && originalSvg.viewBox.baseVal) {
        width = originalSvg.viewBox.baseVal.width || width;
        height = originalSvg.viewBox.baseVal.height || height;
      }

      const pdf = new jsPDF({
        unit: "pt",
        format: [width, height],
        orientation: width > height ? "landscape" : "portrait",
      });

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

  // Download PNG
  const downloadPng = async () => {
    if (!svgContent) return alert("No SVG loaded");

    setIsConverting(true);

    try {
      // Convert SVG to PNG for download
      const pngUrl = await convertSvgToPng(svgContent);
      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = pngUrl;
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

  // Toggle between SVG and PNG view
  const toggleViewMode = async () => {
    if (usePngForMobile) {
      // Switch back to SVG view
      setUsePngForMobile(false);
    } else {
      // Check if we have this file in cache
      if (activeFileId && pngCache[activeFileId]) {
        setPngDataUrl(pngCache[activeFileId]);
        setUsePngForMobile(true);
      } else {
        // Convert to PNG
        setIsConverting(true);
        try {
          const pngUrl = await convertSvgToPng(svgContent);
          setPngDataUrl(pngUrl);
          setUsePngForMobile(true);
          
          // Add to cache if we have a file ID
          if (activeFileId) {
            setPngCache(prev => ({ ...prev, [activeFileId]: pngUrl }));
          }
        } catch (err) {
          console.error("Failed to convert SVG to PNG:", err);
          alert("Failed to convert to PNG: " + (err as Error).message);
        } finally {
          setIsConverting(false);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/tools/drawing")}
          className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Main
        </button>

        <h1 className="text-xl font-semibold text-gray-800 truncate max-w-md mx-4">
          {fileName}
        </h1>

        <div className="w-24"></div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        {/* Available drawings list (only for access key routes) */}
        {!isUploadedFile && unlockedDrawings.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-medium mb-3 text-gray-700">
              Available Drawings
            </h3>
            <div className="flex flex-wrap gap-2">
              {unlockedDrawings.map((f, index) => (
                <button
                  key={f.id}
                  onClick={() => loadSvg(f, index)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === index
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {f.viewName || f.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        {svgContent && (
          <div className="mb-4 bg-white rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  const centerX = rect.width / 2;
                  const centerY = rect.height / 2;

                  const newScale = Math.min(scale + 0.1, 10);
                  const centerXInSvg = (centerX - offset.x) / scale;
                  const centerYInSvg = (centerY - offset.y) / scale;

                  const newOffsetX = centerX - centerXInSvg * newScale;
                  const newOffsetY = centerY - centerYInSvg * newScale;

                  setScale(newScale);
                  setOffset({ x: newOffsetX, y: newOffsetY });
                }}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Zoom in"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>

              <button
                onClick={() => {
                  if (!containerRef.current) return;
                  const rect = containerRef.current.getBoundingClientRect();
                  const centerX = rect.width / 2;
                  const centerY = rect.height / 2;

                  const newScale = Math.max(scale - 0.1, 0.1);
                  const centerXInSvg = (centerX - offset.x) / scale;
                  const centerYInSvg = (centerY - offset.y) / scale;

                  const newOffsetX = centerX - centerXInSvg * newScale;
                  const newOffsetY = centerY - centerYInSvg * newScale;

                  setScale(newScale);
                  setOffset({ x: newOffsetX, y: newOffsetY });
                }}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Zoom out"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 12H6"
                  />
                </svg>
              </button>

              <span className="text-sm font-medium text-gray-600 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
            </div>

            <button
              onClick={resetView}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Reset View
            </button>

            <button
              onClick={toggleFullscreen}
              className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1"
            >
              {isFullscreen ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                    />
                  </svg>
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8V4m0 0h4M3 4l4 4m8 0V4m0 0h-4m4 0l-4 4m-8 8v4m0 0h4m-4 0l4-4m8 4l-4-4m4 4v-4m0 4h-4"
                    />
                  </svg>
                  Fullscreen
                </>
              )}
            </button>

            {isMobile && (
              <button
                onClick={toggleViewMode}
                disabled={isConverting}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {usePngForMobile ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                    View as SVG
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    View as PNG
                  </>
                )}
              </button>
            )}

            <div className="ml-auto flex gap-2">
              <button
                onClick={downloadPdf}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                PDF
              </button>

              <button
                onClick={downloadPng}
                disabled={isConverting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {isConverting ? "Converting..." : "PNG"}
              </button>
            </div>
          </div>
        )}

        {/* Loading indicators */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <span className="text-gray-600">Loading drawings...</span>
            </div>
          </div>
        )}

        {isConverting && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
            <span className="text-blue-700">
              Converting to PNG for better mobile performance...
            </span>
          </div>
        )}

        {/* Viewer */}
        <div
          ref={viewerRef}
          className={`relative bg-white rounded-lg shadow-sm overflow-hidden ${
            isFullscreen
              ? "fixed inset-0 z-50 bg-white"
              : "border border-gray-200 h-[70vh] min-h-[400px]"
          }`}
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
            className={`w-full h-full flex items-center justify-center overflow-hidden ${
              dragging.current ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{ transformOrigin: "0 0" }}
          >
            {usePngForMobile && pngDataUrl ? (
              <NextImage
                src={pngDataUrl}
                alt={fileName}
                className="max-w-full max-h-full"
                style={{
                  transformOrigin: "0 0",
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                }}
                width={800}
                height={600}
                unoptimized={true}
              />
            ) : (
              svgElement && (
                <div
                  style={{
                    transformOrigin: "0 0",
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  }}
                  ref={(el) => {
                    if (el) {
                      while (el.firstChild) el.removeChild(el.firstChild);
                      el.appendChild(svgElement.cloneNode(true));
                    }
                  }}
                />
              )
            )}
          </div>

          {/* Zoom level indicator */}
          {svgContent && !isFullscreen && (
            <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
              {Math.round(scale * 100)}%
            </div>
          )}
        </div>

        {isMobile && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            {usePngForMobile 
              ? "Using PNG view for better performance" 
              : "Using SVG view - Switch to PNG for better performance on mobile devices"}
          </div>
        )}
      </main>

      <style jsx global>{`
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
}