'use client';

import { useRef, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';

// Components
import UploadSection from './components/UploadSection';
import ViewerOverlay from './components/ViewerOverlay';
import Instructions from './components/Instructions';

// Hooks
import { useFullscreen } from './hooks/useFullscreen';
import { usePannellumViewer } from './hooks/usePannellumViewer';

export default function PanoramaUploadPage() {
  const router = useRouter();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { resetView } = usePannellumViewer(uploadedImage, viewerRef);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validation
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
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

  const handleFullscreenToggle = () => {
    toggleFullscreen(viewerContainerRef.current || undefined);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#333', margin: 0 }}>Upload 360° Panorama</h1>
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

      {/* Upload Section */}
      <UploadSection 
        onFileUpload={handleFileUpload}
        uploadedImage={uploadedImage}
        error={error}
      />

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

        {/* Use ViewerOverlay (icons inside viewer) */}
        {uploadedImage && (
          <ViewerOverlay 
            onReset={resetView}
            onFullscreen={handleFullscreenToggle}
            isFullscreen={isFullscreen}
            uploadedImage={uploadedImage}
          />
        )}
      </div>

      {/* Instructions */}
      <Instructions isFullscreen={isFullscreen} />
    </div>
  );
}