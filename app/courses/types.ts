// types.ts
export interface Video {
  id: string;
  title: string;
  category: string;
  type: string;
  youtubeUrl: string;
  thumbnail: string;
  instagramUrl?: string; // Add optional Instagram URL
}

export interface Playlist {
  id: string;
  title: string;
  videos: string[];
}