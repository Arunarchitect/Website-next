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
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<PannellumViewer | null>(null);

  // Automatically set access key from URL
  useEffect(() => {
    if (code) {
      setAccessKey(code);
      fetchProjectData(code);
    }
  }, [code]);

  // Fetch project data
  const fetchProjectData = async (key: string) => {
    if (!key.trim()) {
      setError('Please enter an access key');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`https://api.modelflick.com/api/viewer/public/360-images/${key}/`);
      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid access key');
        throw new Error('Failed to fetch project data');
      }
      const data: ProjectData = await response.json();
      setProjectData(data);
      if (data["360_images"].length > 0) {
        setSelectedView(data["360_images"][0]);
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
      viewerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const getCurrentImage = useCallback(() => uploadedImage || selectedView?.image_360 || null, [uploadedImage, selectedView]);

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
    });

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
    };
  }, [getCurrentImage]);

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
      {projectData && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2>{projectData.project.name}</h2>
          <p>Organization: {projectData.organisation.name}</p>
        </div>
      )}

      {/* Views Selection */}
      {projectData && projectData["360_images"].length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          {projectData["360_images"].map((view) => (
            <button key={view.id} onClick={() => handleViewSelect(view)} style={{ padding: '8px 16px', backgroundColor: selectedView?.id === view.id ? '#2196F3' : '#f0f0f0', color: selectedView?.id === view.id ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedView?.id === view.id ? 'bold' : 'normal' }}>
              {view.view_name}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      {(uploadedImage || selectedView) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
          <button onClick={resetView} style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Reset View</button>
          <button onClick={toggleFullscreen} style={{ padding: '10px 20px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Fullscreen</button>
        </div>
      )}

      {/* Viewer */}
      <div ref={viewerRef} style={{ width: '100%', height: '500px', borderRadius: '8px', backgroundColor: '#000', overflow: 'hidden', border: '1px solid #ccc' }}>
        {!getCurrentImage() && !loading && <div style={{ color: '#999', textAlign: 'center', lineHeight: '500px' }}>{activeTab === 'accessKey' ? 'Enter an access key to load project views' : 'Upload a 360° image to start viewing'}</div>}
        {loading && <div style={{ color: '#999', textAlign: 'center', lineHeight: '500px' }}>Loading...</div>}
      </div>
    </div>
  );
}
