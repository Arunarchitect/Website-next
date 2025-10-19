"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ProjectData } from "../types/panorama";

interface ViewerOverlayProps {
  onReset: () => void;
  onFullscreen: () => void;
  onDirectionLock: () => void;
  isFullscreen: boolean;
  hasImageLoaded: boolean;
  getCurrentImageName: () => string;
  hasMultipleImages?: boolean;
  projectData?: ProjectData | null;
  currentImageIndex?: number;
  onNavigate?: (direction: "next" | "prev") => void;
  isDirectionLockEnabled?: boolean;
  isMobileDevice?: boolean;
}

export default function ViewerOverlay({
  onReset,
  onFullscreen,
  onDirectionLock,
  isFullscreen,
  hasImageLoaded,
  getCurrentImageName,
  hasMultipleImages = false,
  projectData,
  currentImageIndex = 0,
  onNavigate,
  isDirectionLockEnabled = false,
  isMobileDevice = false,
}: ViewerOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Show controls and reset the hide timer
  const showControls = useCallback(() => {
    setIsVisible(true);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to hide after 3 seconds
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 1500);
  }, []);

  // Show controls when user interacts with the viewer
  useEffect(() => {
    const handleMouseMove = () => {
      showControls();
    };

    const handleTouchStart = () => {
      showControls();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchstart", handleTouchStart);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, [showControls]);

  // Show controls initially and set up auto-hide
  useEffect(() => {
    showControls();
  }, [showControls]);

  if (!hasImageLoaded) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      {/* Navigation Arrows */}
      {hasMultipleImages && onNavigate && (
        <>
          <button
            onClick={() => onNavigate("prev")}
            style={{
              position: "absolute",
              left: isMobileDevice ? "10px" : "20px",
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              // Smaller on mobile
              width: isMobileDevice 
                ? "35px" 
                : (isFullscreen ? "70px" : "50px"),
              height: isMobileDevice 
                ? "35px" 
                : (isFullscreen ? "70px" : "50px"),
              cursor: "pointer",
              zIndex: 1002,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Smaller font on mobile
              fontSize: isMobileDevice 
                ? "16px" 
                : (isFullscreen ? "32px" : "24px"),
              fontWeight: "bold",
              pointerEvents: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
            title="Previous Image"
          >
            ‹
          </button>
          <button
            onClick={() => onNavigate("next")}
            style={{
              position: "absolute",
              right: isMobileDevice ? "10px" : "20px",
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              color: "white",
              border: "none",
              borderRadius: "50%",
              // Smaller on mobile
              width: isMobileDevice 
                ? "35px" 
                : (isFullscreen ? "70px" : "50px"),
              height: isMobileDevice 
                ? "35px" 
                : (isFullscreen ? "70px" : "50px"),
              cursor: "pointer",
              zIndex: 1002,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Smaller font on mobile
              fontSize: isMobileDevice 
                ? "16px" 
                : (isFullscreen ? "32px" : "24px"),
              fontWeight: "bold",
              pointerEvents: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
            title="Next Image"
          >
            ›
          </button>
        </>
      )}

      {/* Title Overlay */}
      <div
        style={{
          position: "absolute",
          top: isMobileDevice ? "10px" : "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          color: "white",
          // Smaller padding on mobile
          padding: isMobileDevice 
            ? "8px 16px" 
            : (isFullscreen ? "16px 32px" : "12px 24px"),
          borderRadius: "25px",
          zIndex: 1002,
          // Smaller font on mobile
          fontSize: isMobileDevice 
            ? "12px" 
            : (isFullscreen ? "20px" : "16px"),
          fontWeight: "bold",
          backdropFilter: "blur(10px)",
          textAlign: "center",
          pointerEvents: "none",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
          maxWidth: "90%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {getCurrentImageName()}
        {hasMultipleImages && projectData && (
          <span
            style={{
              marginLeft: "8px",
              // Smaller font on mobile
              fontSize: isMobileDevice 
                ? "10px" 
                : (isFullscreen ? "18px" : "14px"),
              opacity: 0.9,
              backgroundColor: "rgba(255, 255, 255, 0.2)",
              padding: isMobileDevice ? "2px 6px" : "4px 12px",
              borderRadius: "12px",
            }}
          >
            {currentImageIndex + 1} / {projectData["360_images"].length}
          </span>
        )}
      </div>

      {/* Control Buttons */}
      <div
        style={{
          position: "absolute",
          bottom: isMobileDevice ? "10px" : "20px",
          right: isMobileDevice ? "10px" : "20px",
          zIndex: 1002,
          display: "flex",
          gap: isMobileDevice ? "6px" : "10px",
          pointerEvents: "none",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {/* Direction Lock Button */}
        <button
          onClick={onDirectionLock}
          style={{
            backgroundColor: isDirectionLockEnabled
              ? "#4CAF50"
              : "rgba(0, 0, 0, 0.8)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            // Smaller on mobile
            width: isMobileDevice 
              ? "30px" 
              : (isFullscreen ? "60px" : "45px"),
            height: isMobileDevice 
              ? "30px" 
              : (isFullscreen ? "60px" : "45px"),
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Smaller font on mobile
            fontSize: isMobileDevice 
              ? "12px" 
              : (isFullscreen ? "18px" : "14px"),
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            pointerEvents: "auto",
            opacity: isMobileDevice ? 1 : 0.6,
          }}
          title={
            isMobileDevice
              ? isDirectionLockEnabled
                ? "Disable Motion Control"
                : "Enable Motion Control"
              : "Motion control only available on mobile devices"
          }
        >
          📱
        </button>
        <button
          onClick={onReset}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            // Smaller on mobile
            width: isMobileDevice 
              ? "30px" 
              : (isFullscreen ? "60px" : "45px"),
            height: isMobileDevice 
              ? "30px" 
              : (isFullscreen ? "60px" : "45px"),
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Smaller font on mobile
            fontSize: isMobileDevice 
              ? "12px" 
              : (isFullscreen ? "18px" : "14px"),
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            pointerEvents: "auto",
          }}
          title="Reset View"
        >
          ↺
        </button>
        <button
          onClick={onFullscreen}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            border: "none",
            borderRadius: "50%",
            // Smaller on mobile
            width: isMobileDevice 
              ? "30px" 
              : (isFullscreen ? "60px" : "45px"),
            height: isMobileDevice 
              ? "30px" 
              : (isFullscreen ? "60px" : "45px"),
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Smaller font on mobile
            fontSize: isMobileDevice 
              ? "12px" 
              : (isFullscreen ? "18px" : "14px"),
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            pointerEvents: "auto",
          }}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? "⤢" : "⤡"}
        </button>
      </div>

      {/* Instructions Overlay (only in fullscreen) */}
      {isFullscreen && isVisible && (
        <div
          style={{
            position: "absolute",
            bottom: isMobileDevice ? "60px" : "80px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: isMobileDevice ? "6px 12px" : "10px 20px",
            borderRadius: "8px",
            zIndex: 1002,
            // Smaller font on mobile
            fontSize: isMobileDevice ? "10px" : "14px",
            textAlign: "center",
            pointerEvents: "none",
            backdropFilter: "blur(10px)",
          }}
        >
          Move mouse to show controls
          {hasMultipleImages && " • Use arrow keys to navigate"}
          {isDirectionLockEnabled && isMobileDevice && " • Move device to look around"}
        </div>
      )}
    </div>
  );
}