"use client";

import { useEffect, useRef, useState, useCallback, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import "pannellum/build/pannellum.css";
import "pannellum/build/pannellum.js";

import { usePanorama } from "./hooks/usePanorama";
import PannellumViewer, {
  PannellumViewerRef,
} from "./components/PannellumViewer";
import ViewerOverlay from "./components/ViewerOverlay";

export default function PanoramaViewerWithCode() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pannellumViewerRef = useRef<PannellumViewerRef>(null);

  const {
    projectData,
    selectedView,
    uploadedImage,
    loading,
    error,
    currentImageIndex,
    setUploadedImage,
    setError,
    handleViewSelect,
    navigateImages,
    getCurrentImage,
    getCurrentImageName,
    hasImageLoaded,
    hasMultipleImages,
  } = usePanorama(code);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file");
        return;
      }
      setError("");
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result && typeof ev.target.result === "string") {
          setUploadedImage(ev.target.result);
        }
      };
      reader.readAsDataURL(file);
    },
    [setError, setUploadedImage]
  );

  const resetView = useCallback(() => {
    if (pannellumViewerRef.current) {
      pannellumViewerRef.current.resetView();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!viewerContainerRef.current) return;

    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!hasMultipleImages || uploadedImage) return;

      if (e.key === "ArrowLeft") {
        navigateImages("prev");
      } else if (e.key === "ArrowRight") {
        navigateImages("next");
      } else if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [
    hasMultipleImages,
    uploadedImage,
    isFullscreen,
    navigateImages,
    toggleFullscreen,
  ]);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ color: "#333", margin: 0 }}>360° Panorama Viewer</h1>
        <button
          onClick={() => router.push("/tools/panorama")}
          style={{
            padding: "8px 16px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Enter Different Key
        </button>
      </div>

      {/* Upload Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <input
          type="file"
          accept="image/*"
          id="upload"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <label
          htmlFor="upload"
          style={{
            padding: "12px 30px",
            backgroundColor: "#2196F3",
            color: "white",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Upload Your Own 360° Image
        </label>
      </div>

      {error && (
        <p style={{ color: "red", textAlign: "center", marginBottom: "20px" }}>
          {error}
        </p>
      )}

      {/* Project Info */}
      {projectData && !isFullscreen && !hasImageLoaded && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h2>{projectData.project.name}</h2>
          <p>Organization: {projectData.organisation.name}</p>
        </div>
      )}

      {/* Views Selection */}
      {projectData &&
        projectData["360_images"].length > 0 &&
        !isFullscreen &&
        !hasImageLoaded && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            {projectData["360_images"].map((view) => (
              <button
                key={view.id}
                onClick={() => handleViewSelect(view)}
                style={{
                  padding: "8px 16px",
                  backgroundColor:
                    selectedView?.id === view.id ? "#2196F3" : "#f0f0f0",
                  color: selectedView?.id === view.id ? "white" : "#333",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: selectedView?.id === view.id ? "bold" : "normal",
                }}
              >
                {view.view_name}
              </button>
            ))}
          </div>
        )}

      {/* Main Controls */}
      {hasImageLoaded && !isFullscreen && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "15px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={resetView}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Reset View
          </button>
          <button
            onClick={toggleFullscreen}
            style={{
              padding: "10px 20px",
              backgroundColor: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      )}

      {/* Viewer Container - CRITICAL: Make sure this has position: relative */}
      <div
        ref={viewerContainerRef}
        style={{
          position: "relative", // This is essential
          width: "100%",
          height: isFullscreen ? "100vh" : "500px",
          borderRadius: isFullscreen ? "0" : "8px",
          backgroundColor: "#000",
          overflow: "hidden",
          border: isFullscreen ? "none" : "1px solid #ccc",
          margin: isFullscreen ? "0" : "initial",
        }}
      >
        {/* Pannellum Viewer */}
        <PannellumViewer
          ref={pannellumViewerRef}
          imageUrl={getCurrentImage()}
          loading={loading}
        />

        {/* Overlay controls - This should appear on top */}
        <ViewerOverlay
          onReset={resetView}
          onFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          hasImageLoaded={hasImageLoaded}
          getCurrentImageName={getCurrentImageName}
          hasMultipleImages={!!hasMultipleImages}
          projectData={projectData}
          currentImageIndex={currentImageIndex}
          onNavigate={navigateImages}
        />
      </div>

      {/* Image Counter */}
      {hasMultipleImages && !isFullscreen && !uploadedImage && (
        <div style={{ textAlign: "center", marginTop: "10px", color: "#666" }}>
          Image {currentImageIndex + 1} of {projectData!["360_images"].length}
        </div>
      )}

      {/* Instructions */}
      {!isFullscreen && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f9f9f9",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ color: "#333", marginTop: "0" }}>How to navigate:</h3>
          <ul
            style={{
              color: "#666",
              lineHeight: "1.6",
              margin: 0,
              paddingLeft: "20px",
            }}
          >
            <li>Drag to look around the panorama</li>
            <li>Use mouse wheel to zoom in/out</li>
            {hasMultipleImages && !uploadedImage && (
              <li>
                Use arrow keys or navigation buttons to switch between views
              </li>
            )}
            <li>Click fullscreen for immersive experience</li>
            <li>
              Share this link:{" "}
              <code>
                {typeof window !== "undefined" ? window.location.href : ""}
              </code>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
