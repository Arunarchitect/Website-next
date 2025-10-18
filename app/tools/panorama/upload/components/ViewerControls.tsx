'use client';

import { useState, useEffect } from 'react';

interface ViewerControlsProps {
  onReset: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
  showFullscreenControls?: boolean;
}

export default function ViewerControls({ 
  onReset, 
  onFullscreen, 
  isFullscreen, 
  showFullscreenControls = true 
}: ViewerControlsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-hide controls after 2 seconds
  useEffect(() => {
    if (!isHovered) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isHovered]);

  // Show controls when user interacts with the viewer area
  const handleMouseEnter = () => {
    setIsVisible(true);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  if (!showFullscreenControls) return null;

  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Allows events to pass through to 3D viewer
        zIndex: 1000,
        cursor: 'grab' // Show that the area is draggable
      }}
    >
      {/* Title Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '25px',
          zIndex: 1001,
          fontSize: '16px',
          fontWeight: 'bold',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
          pointerEvents: 'none',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      >
        3D Model Viewer
      </div>

      {/* Control Buttons */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 1001,
        display: 'flex',
        gap: '10px',
        pointerEvents: 'none', // Container doesn't block
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}>
        <button
          onClick={onReset}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '45px',
            height: '45px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto' // Only buttons are clickable
          }}
          title="Reset View"
        >
          ↺
        </button>
        <button
          onClick={onFullscreen}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '45px',
            height: '45px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto' // Only buttons are clickable
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? '⤢' : '⤡'}
        </button>
      </div>
    </div>
  );
}