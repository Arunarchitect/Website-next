// types.ts
export interface Video {
  id: string;
  title: string;
  category: string;
  type: 'video' | 'reel';
  youtubeUrl: string;
  thumbnail: string;
  instagramUrl?: string;
  playlists: string[]; // ✅ new field
}

export interface Playlist {
  id: string;
  title: string;
}
