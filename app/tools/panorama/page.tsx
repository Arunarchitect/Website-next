'use client';

import { useEffect, useRef, useState, ChangeEvent } from 'react';
import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';

declare const pannellum: any;

export default function PanoramaViewer() {
  const [image, setImage] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null); // Store the viewer instance

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && typeof ev.target.result === 'string') {
        setImage(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset the camera/view
  const resetView = () => {
    if (viewerInstance.current) {
      viewerInstance.current.setYaw(0);
      viewerInstance.current.setPitch(0);
      viewerInstance.current.setHfov(100); // Optional: reset zoom
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

  useEffect(() => {
    if (!image || !viewerRef.current) return;

    // Initialize viewer and store instance
    viewerInstance.current = pannellum.viewer(viewerRef.current, {
      type: 'equirectangular',
      panorama: image,
      autoLoad: true,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      compass: false,
    });
  }, [image]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '20px' }}>
        360° Panorama Viewer
      </h1>

      {/* File Upload */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}>
        <input type="file" accept="image/*" onChange={handleFileUpload} id="upload" style={{ display: 'none' }} />
        <label htmlFor="upload" style={{
          padding: '12px 30px',
          backgroundColor: '#4CAF50',
          color: 'white',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          transition: 'background-color 0.2s ease'
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4CAF50')}
        >
          Upload 360° Image
        </label>
      </div>

      {/* Controls */}
      {image && (
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
              transition: 'background-color 0.2s ease'
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
              transition: 'background-color 0.2s ease'
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
          backgroundColor: '#000'
        }}
      >
        {!image && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: '#999',
            textAlign: 'center',
            fontSize: '16px',
            padding: '10px'
          }}>
            Upload a 360° image to start viewing
          </div>
        )}
      </div>
    </div>
  );
}
