export interface ViewerData {
  id: number;
  view_name: string;
  image_360: string;
  view_date: string;
}

export interface ProjectData {
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

export interface PannellumViewer {
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setHfov: (hfov: number) => void;
  destroy: () => void;
}

// Remove the global declaration entirely
// The pannellum global is already available when the library is loaded