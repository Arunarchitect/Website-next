// tools/panorama/[code]/page.tsx - For direct access via URL

'use client';

import { useEffect, useRef, useState, ChangeEvent, useCallback } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';
import { useParams, useRouter } from 'next/navigation';

// Type definitions for pannellum
declare const pannellum: {
  viewer: (
    container: HTMLDivElement,
    config: {
      type: 'equirectangular';
      panorama: string;
      autoLoad?: boolean;
      showZoomCtrl?: boolean;
      mouseZoom?: boolean;
      draggable?: boolean;
      compass?: boolean;
      showControls?: boolean;
      showFullscreenCtrl?: boolean;
    }
  ) => PannellumViewer;
};

interface PannellumViewer {
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setHfov: (hfov: number) => void;
  destroy: () => void;
}

interface ViewerData {
  id: number;
  view_name: string;
  image_360: string;
  view_date: string;
}

interface ProjectData {
  project: {
    id: number;
    name: string;
  };
  organisation: {
    id: number;
    name: string;
  };
  "360_images": ViewerData[];
}

export default function PanoramaViewerWithCode() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedView, setSelectedView] = useState<ViewerData | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<PannellumViewer | null>(null);

  // Automatically fetch project data when code changes
  useEffect(() => {
    if (code) {
      fetchProjectData(code);
    }
  }, [code]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Fetch project data
  const fetchProjectData = async (key: string) => {
    setLoading(true);
    setError('');
    try {
      // Use your preferred API endpoint
      const response = await fetch(`https://api.modelflick.com/api/viewer/public/360-images/${key}/`);
      // For local development, use:
      // const response = await fetch(`http://localhost:8000/api/viewer/public/360-images/${key}/`);
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid access key');
        throw new Error('Failed to fetch project data');
      }
      const data: ProjectData = await response.json();
      setProjectData(data);
      if (data["360_images"].length > 0) {
        setSelectedView(data["360_images"][0]);
        setCurrentImageIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSelect = (view: ViewerData) => {
    setSelectedView(view);
    setUploadedImage(null);
    if (projectData) {
      const index = projectData["360_images"].findIndex(v => v.id === view.id);
      setCurrentImageIndex(index);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === 'string') {
        setUploadedImage(ev.target.result);
        setSelectedView(null);
        setProjectData(null);
        setCurrentImageIndex(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const navigateImages = useCallback((direction: 'next' | 'prev') => {
    if (!projectData || projectData["360_images"].length <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentImageIndex + 1) % projectData["360_images"].length;
    } else {
      newIndex = (currentImageIndex - 1 + projectData["360_images"].length) % projectData["360_images"].length;
    }

    setCurrentImageIndex(newIndex);
    setSelectedView(projectData["360_images"][newIndex]);
  }, [projectData, currentImageIndex]);

  const resetView = () => {
    if (viewerInstance.current) {
      viewerInstance.current.setYaw(0);
      viewerInstance.current.setPitch(0);
      viewerInstance.current.setHfov(100);
    }
  };

  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const getCurrentImage = useCallback(() => uploadedImage || selectedView?.image_360 || null, [uploadedImage, selectedView]);

  const getCurrentImageName = () => {
    if (uploadedImage) return 'Uploaded Image';
    if (selectedView) return selectedView.view_name;
    return '';
  };

  // Initialize Pannellum viewer
  useEffect(() => {
    const currentImage = getCurrentImage();
    if (!currentImage || !viewerRef.current) return;

    if (viewerInstance.current) {
      viewerInstance.current.destroy();
      viewerInstance.current = null;
    }

    viewerRef.current.innerHTML = '';

    viewerInstance.current = pannellum.viewer(viewerRef.current, {
      type: 'equirectangular',
      panorama: currentImage,
      autoLoad: true,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      compass: false,
      showControls: false,
      showFullscreenCtrl: false,
    });

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
    };
  }, [getCurrentImage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!projectData || projectData["360_images"].length <= 1) return;
      
      if (e.key === 'ArrowLeft') {
        navigateImages('prev');
      } else if (e.key === 'ArrowRight') {
        navigateImages('next');
      } else if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [projectData, currentImageIndex, isFullscreen, navigateImages]);

  const hasMultipleImages = projectData && projectData["360_images"].length > 1;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#333', margin: 0 }}>360° Panorama Viewer</h1>
        <button 
          onClick={() => router.push('/tools/panorama')}
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
        <input type="file" accept="image/*" id="upload" onChange={handleFileUpload} style={{ display: 'none' }} />
        <label htmlFor="upload" style={{ padding: '12px 30px', backgroundColor: '#2196F3', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          Upload Your Own 360° Image
        </label>
      </div>

      {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{error}</p>}

      {/* Project Info */}
      {projectData && !isFullscreen && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2>{projectData.project.name}</h2>
          <p>Organization: {projectData.organisation.name}</p>
        </div>
      )}

      {/* Views Selection */}
      {projectData && projectData["360_images"].length > 0 && !isFullscreen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          {projectData["360_images"].map((view) => (
            <button 
              key={view.id} 
              onClick={() => handleViewSelect(view)}
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

      {/* Controls */}
      {(uploadedImage || selectedView) && !isFullscreen && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
          <button onClick={resetView} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Reset View
          </button>
          <button onClick={toggleFullscreen} style={{ padding: '10px 20px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      )}

      {/* Viewer Container */}
      <div 
        ref={viewerContainerRef}
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: isFullscreen ? '100vh' : '500px', 
          borderRadius: isFullscreen ? '0' : '8px', 
          backgroundColor: '#000', 
          overflow: 'hidden', 
          border: isFullscreen ? 'none' : '1px solid #ccc',
          margin: isFullscreen ? '0' : 'initial'
        }}
      >
        {/* Pannellum Viewer */}
        <div 
          ref={viewerRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            position: 'relative',
            zIndex: 1
          }}
        >
          {!getCurrentImage() && !loading && (
            <div style={{ color: '#999', textAlign: 'center', lineHeight: isFullscreen ? '100vh' : '500px' }}>
              {loading ? 'Loading...' : 'No image loaded'}
            </div>
          )}
          {loading && (
            <div style={{ color: '#999', textAlign: 'center', lineHeight: isFullscreen ? '100vh' : '500px' }}>
              Loading panorama...
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        {hasMultipleImages && (
          <>
            <button
              onClick={() => navigateImages('prev')}
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
              onClick={() => navigateImages('next')}
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
        {(uploadedImage || selectedView) && (
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
            {hasMultipleImages && (
              <span style={{ 
                marginLeft: '15px', 
                fontSize: isFullscreen ? '18px' : '14px', 
                opacity: 0.9,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                padding: '4px 12px',
                borderRadius: '12px'
              }}>
                {currentImageIndex + 1} / {projectData!["360_images"].length}
              </span>
            )}
          </div>
        )}

        {/* Control Buttons */}
        {(uploadedImage || selectedView) && (
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
              onClick={resetView}
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
              onClick={toggleFullscreen}
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
      </div>

      {/* Image Counter */}
      {hasMultipleImages && !isFullscreen && (
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
          Image {currentImageIndex + 1} of {projectData!["360_images"].length}
        </div>
      )}

      {/* Instructions */}
      {!isFullscreen && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h3 style={{ color: '#333', marginTop: '0' }}>How to navigate:</h3>
          <ul style={{ color: '#666', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
            <li>Drag to look around the panorama</li>
            <li>Use mouse wheel to zoom in/out</li>
            {hasMultipleImages && <li>Use arrow keys or navigation buttons to switch between views</li>}
            <li>Click fullscreen for immersive experience</li>
            <li>Share this link: <code>{typeof window !== 'undefined' ? window.location.href : ''}</code></li>
          </ul>
        </div>
      )}
    </div>
  );
}