// data.ts
import { Video, Playlist } from './types';

export const videoData: Video[] = [
  {
    id: 'Oz7wdg5fxcg',
    title: 'What is OpenBIM',
    category: 'Reels',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/Oz7wdg5fxcg',
    thumbnail: 'https://img.youtube.com/vi/Oz7wdg5fxcg/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet'
  },
  {
    id: 'QqAvLkQwaek',
    title: 'What is BIM in reality?',
    category: 'Reels',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/QqAvLkQwaek',
    thumbnail: 'https://img.youtube.com/vi/QqAvLkQwaek/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet'
  },
  {
    id: 'DKrXsRJeM3w',
    title: 'Go #OpenSource  Go #OpenBIM',
    category: 'Reels',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/DKrXsRJeM3w',
    thumbnail: 'https://img.youtube.com/vi/DKrXsRJeM3w/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet'
  },
  {
    id: 'ixMdxWLG-Lc',
    title: 'How to Install Inkscape',
    category: 'Courses',
    type: 'video',
    youtubeUrl: 'https://youtu.be/ixMdxWLG-Lc',
    thumbnail: 'https://img.youtube.com/vi/ixMdxWLG-Lc/hqdefault.jpg',
    instagramUrl: '' // No Instagram link
  }
];

export const playlists: Playlist[] = [
  {
    id: 'all',
    title: 'All Videos',
    videos: ['Oz7wdg5fxcg', 'QqAvLkQwaek', 'DKrXsRJeM3w', 'ixMdxWLG-Lc'],
  },
  {
    id: 'featured',
    title: 'Featured',
    videos: ['Oz7wdg5fxcg', 'ixMdxWLG-Lc'],
  },
  {
    id: 'courses',
    title: 'Courses',
    videos: ['ixMdxWLG-Lc'],
  },
  {
    id: 'reels',
    title: 'Reels',
    videos: ['Oz7wdg5fxcg', 'QqAvLkQwaek', 'DKrXsRJeM3w'],
  }
];
