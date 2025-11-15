export interface Category {
  id: string;
  name: string;
  description?: string;
  video_count?: number;
}

export interface Playlist {
  id: string;
  title: string;
  video_count?: number;
}

export interface Video {
  id: string;
  title: string;
  category: Category | string; // Can be object or string ID
  type: 'reel' | 'video';
  youtube_url: string;
  thumbnail: string;
  instagram_url: string;
  playlists: Playlist[] | string[]; // Can be objects or string IDs
}

export interface ApiResponse<T> {
  count: number;
  videos: T[];
}

export interface CoverVideo {
  playlist_id: string;
  playlist_title: string;
  cover_video: Video;
}