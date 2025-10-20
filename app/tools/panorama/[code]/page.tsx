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
import { ViewerData } from "./types/panorama";

export default function PanoramaViewerWithCode() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDirectionLockEnabled, setIsDirectionLockEnabled] =
    useState<boolean>(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pannellumViewerRef = useRef<PannellumViewerRef>(null);

  // Detect mobile device on component mount
  useEffect(() => {
    const checkDevice = () => {
      const mobileCheck =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      setIsMobileDevice(mobileCheck);
    };
    checkDevice();
  }, []);

  const {
    projectData,
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

  const toggleDirectionLock = useCallback(() => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (!isMobile) {
      alert("Motion control is only available on mobile devices.");
      return;
    }

    // Check if we're on HTTPS
    if (window.location.protocol !== "https:") {
      alert("Motion control requires HTTPS. Please use a secure connection.");
      return;
    }

    if (isDirectionLockEnabled) {
      pannellumViewerRef.current?.disableDirectionLock();
    } else {
      pannellumViewerRef.current?.enableDirectionLock();
    }
  }, [isDirectionLockEnabled]);

  const handleDirectionLockChange = useCallback((enabled: boolean) => {
    console.log("Direction lock changed to:", enabled);
    setIsDirectionLockEnabled(enabled);
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

  // Enhanced navigation that handles motion control with delay
  const handleNavigate = useCallback(
    (direction: "next" | "prev") => {
      // Only disable motion control if it's currently enabled
      if (isDirectionLockEnabled && pannellumViewerRef.current) {
        pannellumViewerRef.current.disableDirectionLock();
        setIsDirectionLockEnabled(false);

        // Add delay to ensure motion control is fully disabled before DOM manipulation
        setTimeout(() => {
          navigateImages(direction);
        }, 100);
      } else {
        // If motion control is not enabled, navigate immediately
        navigateImages(direction);
      }
    },
    [isDirectionLockEnabled, navigateImages]
  );

  // Enhanced view selection that handles motion control with delay
  const handleViewSelectWithControl = useCallback(
    (view: ViewerData) => {
      // Only disable motion control if it's currently enabled
      if (isDirectionLockEnabled && pannellumViewerRef.current) {
        pannellumViewerRef.current.disableDirectionLock();
        setIsDirectionLockEnabled(false);

        // Add delay to ensure motion control is fully disabled before DOM manipulation
        setTimeout(() => {
          handleViewSelect(view);
        }, 100);
      } else {
        // If motion control is not enabled, select immediately
        handleViewSelect(view);
      }
    },
    [isDirectionLockEnabled, handleViewSelect]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen();
      } else if ((e.key === "m" || e.key === "M") && isMobileDevice) {
        // 'M' key to toggle motion control (only on mobile)
        toggleDirectionLock();
      } else if (e.key === "r" || e.key === "R") {
        // 'R' key to reset view
        resetView();
      } else if (e.key === "f" || e.key === "F") {
        // 'F' key to toggle fullscreen
        toggleFullscreen();
      }

      // Only handle arrow keys if we have multiple images and no uploaded image
      if (!hasMultipleImages || uploadedImage) return;

      if (e.key === "ArrowLeft") {
        handleNavigate("prev");
      } else if (e.key === "ArrowRight") {
        handleNavigate("next");
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
    toggleFullscreen,
    toggleDirectionLock,
    resetView,
    handleNavigate,
    isMobileDevice,
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
      {/* Header - Only show when not in fullscreen */}
      {!isFullscreen && (
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
      )}

      {/* Upload Section - Only show when not in fullscreen */}
      {!isFullscreen && (
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
      )}

      {error && !isFullscreen && (
        <p style={{ color: "red", textAlign: "center", marginBottom: "20px" }}>
          {error}
        </p>
      )}

      {/* Project Info and Image Names - Only show when not in fullscreen */}
      {projectData && !isFullscreen && (
        <div style={{ marginBottom: "20px" }}>
          {/* Project Header */}
          <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <h2 style={{ color: "#333", margin: "0 0 5px 0" }}>
              {projectData.project.name}
            </h2>
            <p style={{ color: "#666", margin: 0 }}>
              Organization: {projectData.organisation.name}
            </p>
          </div>

          {/* Image Names as Navigation */}
          {projectData["360_images"].length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {projectData["360_images"].map((view, index) => (
                <button
                  key={view.id}
                  onClick={() => handleViewSelectWithControl(view)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor:
                      currentImageIndex === index ? "#2196F3" : "#f8f9fa",
                    color: currentImageIndex === index ? "white" : "#333",
                    border: "1px solid #dee2e6",
                    borderRadius: "20px",
                    cursor: "pointer",
                    fontWeight: currentImageIndex === index ? "bold" : "normal",
                    fontSize: "14px",
                    transition: "all 0.2s ease",
                    boxShadow:
                      currentImageIndex === index
                        ? "0 2px 8px rgba(33, 150, 243, 0.3)"
                        : "none",
                  }}
                  onMouseOver={(e) => {
                    if (currentImageIndex !== index) {
                      e.currentTarget.style.backgroundColor = "#e9ecef";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (currentImageIndex !== index) {
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  {view.view_name}
                  {hasMultipleImages && (
                    <span
                      style={{
                        marginLeft: "6px",
                        fontSize: "12px",
                        opacity: 0.8,
                      }}
                    >
                      ({index + 1})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Viewer Container */}
      <div
        ref={viewerContainerRef}
        style={{
          position: "relative",
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
          isDirectionLockEnabled={isDirectionLockEnabled}
          onDirectionLockChange={handleDirectionLockChange}
        />

        {/* Overlay controls - All controls are now in the overlay */}
        <ViewerOverlay
          onReset={resetView}
          onFullscreen={toggleFullscreen}
          onDirectionLock={toggleDirectionLock}
          isFullscreen={isFullscreen}
          hasImageLoaded={hasImageLoaded}
          getCurrentImageName={getCurrentImageName}
          hasMultipleImages={!!hasMultipleImages}
          projectData={projectData}
          currentImageIndex={currentImageIndex}
          onNavigate={handleNavigate}
          isDirectionLockEnabled={isDirectionLockEnabled}
          isMobileDevice={isMobileDevice}
        />
      </div>

      {/* Instructions - Only show when not in fullscreen */}
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
              <>
                <li>Click on image names above to switch between views</li>
                <li>Use arrow keys to navigate between images</li>
                <li>
                  Motion control automatically turns off when switching images
                </li>
              </>
            )}
            <li>Use overlay controls for fullscreen and motion control</li>
            <li>
              Keyboard shortcuts:
              <strong> F</strong> - Fullscreen,
              <strong> R</strong> - Reset view
              {isMobileDevice && (
                <>
                  , <strong>M</strong> - Motion control
                </>
              )}
            </li>
            <li>
              Share this link:{" "}
              <code
                style={{
                  backgroundColor: "#e9ecef",
                  padding: "2px 6px",
                  borderRadius: "3px",
                }}
              >
                {typeof window !== "undefined" ? window.location.href : ""}
              </code>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
