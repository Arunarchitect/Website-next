'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { PannellumViewer as PannellumViewerType } from '../types/panorama';

interface PannellumViewerProps {
  imageUrl: string | null;
  loading: boolean;
}

export interface PannellumViewerRef {
  resetView: () => void;
}

const PannellumViewer = forwardRef<PannellumViewerRef, PannellumViewerProps>(
  ({ imageUrl, loading }, ref) => {
    const viewerRef = useRef<HTMLDivElement>(null);
    const viewerInstance = useRef<PannellumViewerType | null>(null);

    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (viewerInstance.current) {
          viewerInstance.current.setYaw(0);
          viewerInstance.current.setPitch(0);
          viewerInstance.current.setHfov(100);
        }
      }
    }));

    useEffect(() => {
      if (!imageUrl || !viewerRef.current) return;

      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }

      if (viewerRef.current) {
        viewerRef.current.innerHTML = '';
      }

      // pannellum is available globally when the library is loaded
      viewerInstance.current = pannellum.viewer(viewerRef.current, {
        type: 'equirectangular',
        panorama: imageUrl,
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
    }, [imageUrl]);

    return (
      <div 
        ref={viewerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'relative',
          zIndex: 1
        }}
      >
        {!imageUrl && !loading && (
          <div style={{ 
            color: '#999', 
            textAlign: 'center', 
            lineHeight: '500px',
            width: '100%',
            height: '100%'
          }}>
            No image loaded
          </div>
        )}
        {loading && (
          <div style={{ 
            color: '#999', 
            textAlign: 'center', 
            lineHeight: '500px',
            width: '100%',
            height: '100%'
          }}>
            Loading panorama...
          </div>
        )}
      </div>
    );
  }
);

PannellumViewer.displayName = 'PannellumViewer';

export default PannellumViewer;