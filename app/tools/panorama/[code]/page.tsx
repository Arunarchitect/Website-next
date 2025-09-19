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
    }
  ) => PannellumViewer;
};

interface PannellumViewer {
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setHfov: (hfov: number) => void;
}

interface ViewerData {
  id: number;
  view_name: string;
  image_360: string;
  view_date: string;
}

interface ProjectData {
  project: string;
  organisation: string;
  views: ViewerData[];
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
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<PannellumViewer | null>(null);

  // Extract access key from URL
  useEffect(() => {
    if (code) {
      setAccessKey(code);
      fetchProjectData(code);
    }
  }, [code]);

  // Fetch project data when access key is submitted
  const fetchProjectData = async (key: string) => {
    if (!key.trim()) {
      setError('Please enter an access key');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`https://api.modelflick.com/api/viewer/public/${key}/`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid access key');
        }
        throw new Error('Failed to fetch project data');
      }
      
      const data: ProjectData = await response.json();
      setProjectData(data);
      
      // Automatically select the first view if available
      if (data.views.length > 0) {
        setSelectedView(data.views[0]);
        setUploadedImage(null); // Clear any uploaded image
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
    setUploadedImage(null); // Clear any uploaded image
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === 'string') {
        setUploadedImage(ev.target.result);
        setSelectedView(null); // Clear any selected view from access key
        setProjectData(null); // Clear project data
      }
    };
    reader.readAsDataURL(file);
  };

  const resetView = () => {
    if (viewerInstance.current) {
      viewerInstance.current.setYaw(0);
      viewerInstance.current.setPitch(0);
      viewerInstance.current.setHfov(100);
    }
  };

  const toggleFullscreen = () => {
    if (!viewerRef.current) return;
    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen().catch((e) => console.error(e));
    } else {
      document.exitFullscreen();
    }
  };

  // Get the current image to display - wrapped in useCallback
  const getCurrentImage = useCallback(() => {
    return uploadedImage || selectedView?.image_360 || null;
  }, [uploadedImage, selectedView]);

  // Initialize/update the panorama viewer when the image changes
  useEffect(() => {
    const currentImage = getCurrentImage();
    if (!currentImage || !viewerRef.current) return;

    // Destroy existing viewer if it exists
    if (viewerInstance.current && viewerRef.current) {
      viewerRef.current.innerHTML = '';
    }

    viewerInstance.current = pannellum.viewer(viewerRef.current, {
      type: 'equirectangular',
      panorama: currentImage,
      autoLoad: true,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      compass: false,
    });
  }, [getCurrentImage]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '20px' }}>
        360° Panorama Viewer
      </h1>

      {/* Tab Selection */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('accessKey')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'accessKey' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'accessKey' ? 'white' : '#333',
            border: 'none',
            borderRadius: '6px 0 0 6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Access Key
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'upload' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'upload' ? 'white' : '#333',
            border: 'none',
            borderRadius: '0 6px 6px 0',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Upload Image
        </button>
      </div>

      {/* Access Key Input */}
      {activeTab === 'accessKey' && (
        <div style={{ marginBottom: '20px' }}>
          <form onSubmit={handleAccessKeySubmit} style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="text"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Enter access key (e.g., 1234)"
              style={{
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                width: '250px',
                fontSize: '16px'
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: loading ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              {loading ? 'Loading...' : 'Load Project'}
            </button>
          </form>
          
          {/* Example access key hint */}
          <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginTop: '8px' }}>
            Example: Try access key &quot;1234&quot; to load sample project
          </p>
        </div>
      )}

      {/* File Upload */}
      {activeTab === 'upload' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload} 
            id="upload" 
            style={{ display: 'none' }} 
          />
          <label
            htmlFor="upload"
            style={{
              padding: '12px 30px',
              backgroundColor: '#2196F3',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
          >
            Upload 360° Image
          </label>
        </div>
      )}
      
      {error && (
        <p style={{ color: 'red', textAlign: 'center', marginTop: '10px' }}>
          {error}
        </p>
      )}

      {/* Project Info */}
      {projectData && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#333', margin: '0' }}>{projectData.project}</h2>
          <p style={{ color: '#666', margin: '5px 0 15px 0' }}>
            Organization: {projectData.organisation}
          </p>
        </div>
      )}

      {/* Views Selection */}
      {projectData && projectData.views.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '10px', color: '#333', textAlign: 'center' }}>Select a View:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {projectData.views.map((view) => (
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
                  fontWeight: selectedView?.id === view.id ? 'bold' : 'normal',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  if (selectedView?.id !== view.id) {
                    e.currentTarget.style.backgroundColor = '#e0e0e0';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedView?.id !== view.id) {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }
                }}
              >
                {view.view_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current Image Info */}
      {uploadedImage && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Viewing uploaded image
          </p>
        </div>
      )}

      {/* Controls */}
      {(selectedView || uploadedImage) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
          <button
            onClick={resetView}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1976D2')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2196F3')}
          >
            Reset View
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              padding: '10px 20px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
              transition: 'background-color 0.2s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FB8C00')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FF9800')}
          >
            Fullscreen
          </button>
        </div>
      )}

      {/* Viewer */}
      <div
        ref={viewerRef}
        style={{
          width: '100%',
          height: '500px',
          borderRadius: '8px',
          boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
          border: '1px solid #ccc',
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {!getCurrentImage() && !loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              color: '#999',
              textAlign: 'center',
              fontSize: '16px',
              padding: '10px',
            }}
          >
            {activeTab === 'accessKey' 
              ? 'Enter an access key to load project views' 
              : 'Upload a 360° image to start viewing'}
          </div>
        )}
        
        {loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              color: '#999',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                border: '4px solid #f3f3f3', 
                borderTop: '4px solid #4CAF50', 
                borderRadius: '50%', 
                width: '40px', 
                height: '40px', 
                animation: 'spin 1s linear infinite',
                margin: '0 auto 10px' 
              }}></div>
              Loading...
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h3 style={{ color: '#333', marginTop: '0' }}>How to use:</h3>
        <ol style={{ color: '#666', lineHeight: '1.6' }}>
          <li>Use the <strong>Access Key</strong> tab to load projects from the server</li>
          <li>Use the <strong>Upload Image</strong> tab to upload your own 360° images</li>
          <li>Use your mouse to drag and explore the panorama</li>
          <li>Use the mouse wheel to zoom in and out</li>
          <li>Click the <strong>Reset View</strong> button to return to the initial view</li>
          <li>Click the <strong>Fullscreen</strong> button for an immersive experience</li>
          <li>You can also directly access panoramas by URL: <code>/tools/panorama/your-access-key</code></li>
        </ol>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}