'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ViewerOverlayProps {
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  uploadedImage: string | null;
}

export default function ViewerOverlay({ 
  onReset, 
  onFullscreen, 
  isFullscreen, 
  uploadedImage 
}: ViewerOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Show controls and reset the hide timer
  const showControls = useCallback(() => {
    setIsVisible(true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Set new timeout to hide after 2 seconds
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 2000);
  }, []);

  // Show controls when user interacts with border areas
  const handleBorderInteraction = useCallback(() => {
    showControls();
  }, [showControls]);

  // Also show controls when hovering over buttons (so they don't disappear while using them)
  const handleButtonInteraction = useCallback(() => {
    showControls();
  }, [showControls]);

  // Handle reset button click
  const handleResetClick = useCallback(() => {
    onReset();
    showControls();
  }, [onReset, showControls]);

  // Handle fullscreen button click
  const handleFullscreenClick = useCallback(() => {
    onFullscreen();
    showControls();
  }, [onFullscreen, showControls]);

  if (!uploadedImage) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 1000
    }}>
      {/* Border Hover Zones */}
      
      {/* Top Border - 50px tall */}
      <div 
        onMouseEnter={handleBorderInteraction}
        onTouchStart={handleBorderInteraction}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '50px',
          pointerEvents: 'auto',
          zIndex: 1001,
          cursor: 'default'
        }}
        role="presentation"
      />
      
      {/* Bottom Border - 80px tall (higher for easier access to buttons) */}
      <div 
        onMouseEnter={handleBorderInteraction}
        onTouchStart={handleBorderInteraction}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '80px',
          pointerEvents: 'auto',
          zIndex: 1001,
          cursor: 'default'
        }}
        role="presentation"
      />
      
      {/* Left Border - 40px wide */}
      <div 
        onMouseEnter={handleBorderInteraction}
        onTouchStart={handleBorderInteraction}
        style={{
          position: 'absolute',
          top: '50px',
          left: 0,
          width: '40px',
          height: 'calc(100% - 130px)', // Subtract top and bottom borders
          pointerEvents: 'auto',
          zIndex: 1001,
          cursor: 'default'
        }}
        role="presentation"
      />
      
      {/* Right Border - 80px wide (wider for easier access to buttons) */}
      <div 
        onMouseEnter={handleBorderInteraction}
        onTouchStart={handleBorderInteraction}
        style={{
          position: 'absolute',
          top: '50px',
          right: 0,
          width: '80px',
          height: 'calc(100% - 130px)', // Subtract top and bottom borders
          pointerEvents: 'auto',
          zIndex: 1001,
          cursor: 'default'
        }}
        role="presentation"
      />

      {/* Title Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: isFullscreen ? '16px 32px' : '12px 24px',
          borderRadius: '25px',
          zIndex: 1002,
          fontSize: isFullscreen ? '20px' : '16px',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
          pointerEvents: 'none',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
        aria-label="Uploaded Image Viewer"
      >
        Uploaded Image
      </div>

      {/* Control Buttons */}
      <div 
        onMouseEnter={handleButtonInteraction}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1002,
          display: 'flex',
          gap: '10px',
          pointerEvents: 'none',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
        role="toolbar"
        aria-label="Viewer Controls"
      >
        <button
          onClick={handleResetClick}
          onMouseEnter={handleButtonInteraction}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: isFullscreen ? '60px' : '45px',
            height: isFullscreen ? '60px' : '45px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isFullscreen ? '18px' : '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto'
          }}
          title="Reset View"
          type="button"
          aria-label="Reset view to initial position"
        >
          ↺
        </button>
        <button
          onClick={handleFullscreenClick}
          onMouseEnter={handleButtonInteraction}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: isFullscreen ? '60px' : '45px',
            height: isFullscreen ? '60px' : '45px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isFullscreen ? '18px' : '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto'
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          type="button"
          aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
        >
          {isFullscreen ? '⤢' : '⤡'}
        </button>
      </div>
    </div>
  );
}