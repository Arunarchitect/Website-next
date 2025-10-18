import { useEffect, useRef } from 'react';
import { PannellumViewer } from '../types';

// Define proper types for pannellum configuration
interface PannellumConfig {
  type: 'equirectangular';
  panorama: string;
  autoLoad: boolean;
  showZoomCtrl: boolean;
  mouseZoom: boolean;
  draggable: boolean;
  compass: boolean;
  showControls: boolean;
  showFullscreenCtrl: boolean;
}

// Extend the Window interface to include pannellum
declare global {
  interface Window {
    pannellum: {
      viewer: (container: HTMLElement, config: PannellumConfig) => PannellumViewer;
    };
  }
}

export function usePannellumViewer(
  uploadedImage: string | null, 
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const viewerInstance = useRef<PannellumViewer | null>(null);

  useEffect(() => {
    if (!uploadedImage || !containerRef.current) return;

    // Clean up previous instance
    if (viewerInstance.current) {
      viewerInstance.current.destroy();
      viewerInstance.current = null;
    }

    // Clear container
    containerRef.current.innerHTML = '';

    // Initialize new viewer with proper type checking
    if (window.pannellum) {
      const config: PannellumConfig = {
        type: 'equirectangular',
        panorama: uploadedImage,
        autoLoad: true,
        showZoomCtrl: true,
        mouseZoom: true,
        draggable: true,
        compass: false,
        showControls: false,
        showFullscreenCtrl: false,
      };

      viewerInstance.current = window.pannellum.viewer(containerRef.current, config);
    }

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
    };
  }, [uploadedImage, containerRef]);

  const resetView = () => {
    if (viewerInstance.current) {
      viewerInstance.current.setYaw(0);
      viewerInstance.current.setPitch(0);
      viewerInstance.current.setHfov(100);
    }
  };

  return { resetView };
}