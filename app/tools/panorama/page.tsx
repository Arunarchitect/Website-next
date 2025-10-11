// panorama/page.tsx

'use client';

import { useEffect, useRef, useState, ChangeEvent, useCallback } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';
import { useParams } from 'next/navigation';

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
  const code = params.code as string;

  const [accessKey, setAccessKey] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedView, setSelectedView] = useState<ViewerData | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'accessKey' | 'upload'>('accessKey');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  
  const viewerInstance = useRef<PannellumViewer | null>(null);

  // Automatically set access key from URL
  useEffect(() => {
    if (code) {
      setAccessKey(code);
      fetchProjectData(code);
    }
  }, [code]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = !!document.fullscreenElement;
      setIsFullscreen(fullscreenElement);
      
      // Force re-render of custom controls
      if (navigationRef.current) {
        navigationRef.current.style.display = 'none';
        setTimeout(() => {
          if (navigationRef.current) {
            navigationRef.current.style.display = 'block';
          }
        }, 10);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Fetch project data
  const fetchProjectData = async (key: string) => {
    if (!key.trim()) {
      setError('Please enter an access key');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/api/viewer/public/360-images/${key}/`);
      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid access key');
        throw new Error('Failed to fetch project data');
      }
      const data: ProjectData = await response.json();
      setProjectData(data);
      if (data["360_images"].length > 0) {
        setSelectedView(data["360_images"][0]);
        setCurrentImageIndex(0);
        setUploadedImage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAccessKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjectData(accessKey);
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

  const navigateImages = (direction: 'next' | 'prev') => {
    if (!projectData || projectData["360_images"].length <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentImageIndex + 1) % projectData["360_images"].length;
    } else {
      newIndex = (currentImageIndex - 1 + projectData["360_images"].length) % projectData["360_images"].length;
    }

    setCurrentImageIndex(newIndex);
    setSelectedView(projectData["360_images"][newIndex]);
  };

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

  useEffect(() => {
    const currentImage = getCurrentImage();
    if (!currentImage || !viewerRef.current) return;

    if (viewerInstance.current) {
      viewerInstance.current.destroy();
      viewerInstance.current = null;
    }

    viewerRef.current.innerHTML = '';

    // Initialize pannellum with custom configuration
    viewerInstance.current = pannellum.viewer(viewerRef.current, {
      type: 'equirectangular',
      panorama: currentImage,
      autoLoad: true,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      compass: false,
      showControls: false, // Hide pannellum's default controls
      showFullscreenCtrl: false, // Hide pannellum's fullscreen button
    });

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
    };
  }, [getCurrentImage]);

  // Add keyboard navigation
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
  }, [projectData, currentImageIndex, isFullscreen]);

  const hasMultipleImages = projectData && projectData["360_images"].length > 1;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '20px' }}>360° Panorama Viewer</h1>

      {/* Tab Selection */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('accessKey')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'accessKey' ? '#4CAF50' : '#f0f0f0', color: activeTab === 'accessKey' ? 'white' : '#333', border: 'none', borderRadius: '6px 0 0 6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Access Key
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'upload' ? '#4CAF50' : '#f0f0f0', color: activeTab === 'upload' ? 'white' : '#333', border: 'none', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Upload Image
        </button>
      </div>

      {/* Access Key Input */}
      {activeTab === 'accessKey' && (
        <form onSubmit={handleAccessKeySubmit} style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="Enter access key (e.g., anil)"
            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px', width: '250px', fontSize: '16px' }}
          />
          <button type="submit" disabled={loading} style={{ padding: '10px 20px', backgroundColor: loading ? '#ccc' : '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Loading...' : 'Load Project'}
          </button>
        </form>
      )}

      {/* Upload Image */}
      {activeTab === 'upload' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <input type="file" accept="image/*" id="upload" onChange={handleFileUpload} style={{ display: 'none' }} />
          <label htmlFor="upload" style={{ padding: '12px 30px', backgroundColor: '#2196F3', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Upload 360° Image
          </label>
        </div>
      )}

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
            <button key={view.id} onClick={() => handleViewSelect(view)} style={{ padding: '8px 16px', backgroundColor: selectedView?.id === view.id ? '#2196F3' : '#f0f0f0', color: selectedView?.id === view.id ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedView?.id === view.id ? 'bold' : 'normal' }}>
              {view.view_name}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      {(uploadedImage || selectedView) && !isFullscreen && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
          <button onClick={resetView} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Reset View</button>
          <button onClick={toggleFullscreen} style={{ padding: '10px 20px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      )}

      {/* Main Viewer Container - This will go fullscreen */}
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
              {activeTab === 'accessKey' ? 'Enter an access key to load project views' : 'Upload a 360° image to start viewing'}
            </div>
          )}
          {loading && (
            <div style={{ color: '#999', textAlign: 'center', lineHeight: isFullscreen ? '100vh' : '500px' }}>
              Loading...
            </div>
          )}
        </div>

        {/* Custom Navigation Arrows - Higher z-index */}
        {hasMultipleImages && (
          <div ref={navigationRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, pointerEvents: 'none' }}>
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
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
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
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            >
              ›
            </button>
          </div>
        )}

        {/* Custom Title Overlay - Higher z-index */}
        {(uploadedImage || selectedView) && (
          <div
            ref={overlayRef}
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: isFullscreen ? '16px 32px' : '12px 24px',
              borderRadius: '25px',
              zIndex: 1001, // Higher than navigation
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

        {/* Custom Fullscreen Controls */}
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
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
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
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 152, 0, 0.9)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? '⤢' : '⤡'}
            </button>
          </div>
        )}
      </div>

      {/* Image Counter for Multiple Images */}
      {hasMultipleImages && !isFullscreen && (
        <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
          Image {currentImageIndex + 1} of {projectData!["360_images"].length}
        </div>
      )}

      {/* Keyboard Navigation Info */}
      {hasMultipleImages && !isFullscreen && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '15px', 
          color: '#666', 
          fontSize: '14px',
          fontStyle: 'italic'
        }}>
          Tip: Use the navigation buttons or keyboard arrow keys to switch between views
        </div>
      )}
    </div>
  );
}