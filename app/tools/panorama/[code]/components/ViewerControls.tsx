'use client';

import { ChangeEvent } from 'react';
import { ViewerData } from '../types/panorama';

interface ViewerControlsProps {
  projectData: { 
    project: { name: string };
    organisation: { name: string };
    "360_images": ViewerData[];
  } | null;
  selectedView: ViewerData | null;
  currentImageIndex: number;
  isFullscreen: boolean;
  hasMultipleImages: boolean;
  hasImageLoaded: boolean;
  onViewSelect: (view: ViewerData) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
  onEnterDifferentKey: () => void;
  getCurrentImageName: () => string;
  error?: string;
}

export default function ViewerControls({
  projectData,
  selectedView,
  currentImageIndex,
  isFullscreen,
  hasMultipleImages,
  hasImageLoaded,
  onViewSelect,
  onFileUpload,
  onNavigate,
  onResetView,
  onToggleFullscreen,
  onEnterDifferentKey,
  getCurrentImageName,
  error
}: ViewerControlsProps) {
  
  // External Controls Component (displayed outside the viewer)
  const ExternalControls = () => (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#333', margin: 0 }}>360° Panorama Viewer</h1>
        <button 
          onClick={onEnterDifferentKey}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: 'bold' 
          }}
        >
          Enter Different Key
        </button>
      </div>

      {/* Upload Section */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <input type="file" accept="image/*" id="upload" onChange={onFileUpload} style={{ display: 'none' }} />
        <label htmlFor="upload" style={{ 
          padding: '12px 30px', 
          backgroundColor: '#2196F3', 
          color: 'white', 
          borderRadius: '6px', 
          cursor: 'pointer', 
          fontWeight: 'bold' 
        }}>
          Upload Your Own 360° Image
        </label>
      </div>

      {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{error}</p>}

      {/* Project Info - Only show when viewing project images, not uploaded images */}
      {projectData && !isFullscreen && !hasImageLoaded && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2>{projectData.project.name}</h2>
          <p>Organization: {projectData.organisation.name}</p>
        </div>
      )}

      {/* Views Selection - Only show when viewing project images, not uploaded images */}
      {projectData && projectData["360_images"].length > 0 && !isFullscreen && !hasImageLoaded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          {projectData["360_images"].map((view) => (
            <button 
              key={view.id} 
              onClick={() => onViewSelect(view)}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: selectedView?.id === view.id ? '#2196F3' : '#f0f0f0', 
                color: selectedView?.id === view.id ? 'white' : '#333', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: selectedView?.id === view.id ? 'bold' : 'normal' 
              }}
            >
              {view.view_name}
            </button>
          ))}
        </div>
      )}

      {/* Main Controls - Show when any image is loaded */}
      {hasImageLoaded && !isFullscreen && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
          <button 
            onClick={onResetView} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            Reset View
          </button>
          <button 
            onClick={onToggleFullscreen} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#FF9800', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      )}
    </>
  );

  // Overlay Controls Component (displayed inside the viewer)
  const OverlayControls = () => (
    <>
      {/* Navigation Arrows */}
      {hasMultipleImages && projectData && hasImageLoaded && (
        <>
          <button
            onClick={() => onNavigate('prev')}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: isFullscreen ? '70px' : '50px',
              height: isFullscreen ? '70px' : '50px',
              cursor: 'pointer',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isFullscreen ? '32px' : '24px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              pointerEvents: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            ‹
          </button>
          <button
            onClick={() => onNavigate('next')}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: isFullscreen ? '70px' : '50px',
              height: isFullscreen ? '70px' : '50px',
              cursor: 'pointer',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isFullscreen ? '32px' : '24px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease',
              pointerEvents: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Title Overlay */}
      {hasImageLoaded && (
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
            zIndex: 1001,
            fontSize: isFullscreen ? '20px' : '16px',
            fontWeight: 'bold',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
            maxWidth: '90%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          {getCurrentImageName()}
          {hasMultipleImages && projectData && (
            <span style={{ 
              marginLeft: '15px', 
              fontSize: isFullscreen ? '18px' : '14px', 
              opacity: 0.9,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 12px',
              borderRadius: '12px'
            }}>
              {currentImageIndex + 1} / {projectData["360_images"].length}
            </span>
          )}
        </div>
      )}

      {/* Control Buttons Overlay */}
      {hasImageLoaded && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1001,
          display: 'flex',
          gap: '10px',
          pointerEvents: 'auto'
        }}>
          <button
            onClick={onResetView}
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
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            title="Reset View"
          >
            ↺
          </button>
          <button
            onClick={onToggleFullscreen}
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
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? '⤢' : '⤡'}
          </button>
        </div>
      )}
    </>
  );

  return {
    OverlayControls: <OverlayControls />,
    ExternalControls: <ExternalControls />
  };
}