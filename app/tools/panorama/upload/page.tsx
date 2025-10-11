// tools/panorama/upload/page.tsx - Dedicated upload page

'use client';

import { useEffect, useRef, useState, ChangeEvent} from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';
import { useRouter } from 'next/navigation';

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

export default function PanoramaUploadPage() {
  const router = useRouter();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<PannellumViewer | null>(null);

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

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    // Check file size (optional)
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size too large. Please upload an image smaller than 50MB.');
      return;
    }
    
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === 'string') {
        setUploadedImage(ev.target.result);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file. Please try again.');
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
    if (!viewerContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  // Initialize Pannellum viewer
  useEffect(() => {
    if (!uploadedImage || !viewerRef.current) return;

    if (viewerInstance.current) {
      viewerInstance.current.destroy();
      viewerInstance.current = null;
    }

    viewerRef.current.innerHTML = '';

    viewerInstance.current = pannellum.viewer(viewerRef.current, {
      type: 'equirectangular',
      panorama: uploadedImage,
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
  }, [uploadedImage]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#333', margin: 0 }}>Upload 360° Panorama</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
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
            Access Key
          </button>
        </div>
      </div>

      {/* Upload Section */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '30px', 
        borderRadius: '12px', 
        marginBottom: '20px',
        textAlign: 'center',
        border: '2px dashed #dee2e6'
      }}>
        <h3 style={{ color: '#495057', marginBottom: '15px' }}>Upload Your 360° Image</h3>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Supported formats: JPEG equirectangular images
        </p>
        
        <input 
          type="file" 
          accept="image/*" 
          id="upload" 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
        />
        <label 
          htmlFor="upload" 
          style={{ 
            padding: '15px 40px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            fontSize: '16px',
            display: 'inline-block'
          }}
        >
          Choose 360° Image
        </label>
        
        {uploadedImage && (
          <p style={{ color: '#28a745', marginTop: '15px', fontWeight: 'bold' }}>
            ✓ Image loaded successfully!
          </p>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Controls */}
      {uploadedImage && !isFullscreen && (
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
          {!uploadedImage && (
            <div style={{ color: '#999', textAlign: 'center', lineHeight: isFullscreen ? '100vh' : '500px' }}>
              Upload a 360° image to start viewing
            </div>
          )}
        </div>

        {/* Title Overlay */}
        {uploadedImage && (
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
              pointerEvents: 'none',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            Uploaded Image
          </div>
        )}

        {/* Control Buttons */}
        {uploadedImage && (
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

      {/* Instructions */}
      {!isFullscreen && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <h3 style={{ color: '#333', marginTop: '0' }}>How to use:</h3>
          <ul style={{ color: '#666', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
            <li>Click `&quot;`Choose 360° Image`&quot;` to upload your panorama</li>
            <li>Drag to look around the panorama</li>
            <li>Use mouse wheel to zoom in/out</li>
            <li>Click fullscreen for immersive experience</li>
            <li>Supported: equirectangular 360° images</li>
          </ul>
        </div>
      )}
    </div>
  );
}