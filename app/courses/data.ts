// data.ts
import { Video, Playlist } from './types';

export const videoData: Video[] = [
  {
    id: 'Oz7wdg5fxcg',
    title: 'OPEN SOURCE SOFTWARES',
    category: 'Reels',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/Oz7wdg5fxcg',
    thumbnail: 'https://img.youtube.com/vi/Oz7wdg5fxcg/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet'
  },
  {
    id: 'QqAvLkQwaek',
    title: 'Reel 2: Quick Tips',
    category: 'Reels',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/QqAvLkQwaek',
    thumbnail: 'https://img.youtube.com/vi/QqAvLkQwaek/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet' // Add your Instagram URL
  },
  {
    id: 'DKrXsRJeM3w',
    title: 'Reel 3: Design Hack',
    category: 'Reels',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/DKrXsRJeM3w',
    thumbnail: 'https://img.youtube.com/vi/DKrXsRJeM3w/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet' // Add your Instagram URL
  },
];

export const playlists: Playlist[] = [
  {
    id: 'all',
    title: 'All Reels',
    videos: ['Oz7wdg5fxcg', 'QqAvLkQwaek', 'DKrXsRJeM3w'],
  },
  {
    id: 'featured',
    title: 'Featured',
    videos: ['Oz7wdg5fxcg'],
  },
];