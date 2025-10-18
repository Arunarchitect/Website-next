export interface PannellumViewer {
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setHfov: (hfov: number) => void;
  destroy: () => void;
}

export interface ViewerConfig {
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

declare global {
  const pannellum: {
    viewer: (container: HTMLDivElement, config: ViewerConfig) => PannellumViewer;
  };
}