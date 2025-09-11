import { Video, Playlist } from './types';

export const videoData: Video[] = [
  {
    id: 'Oz7wdg5fxcg',
    title: 'What is OpenBIM',
    category: 'OpenBIM',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/Oz7wdg5fxcg',
    thumbnail: 'https://img.youtube.com/vi/Oz7wdg5fxcg/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet',
    playlists: ['all', 'featured', 'reels']
  },
  {
    id: 'QqAvLkQwaek',
    title: 'What is BIM in reality?',
    category: 'OpenBIM',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/QqAvLkQwaek',
    thumbnail: 'https://img.youtube.com/vi/QqAvLkQwaek/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet',
    playlists: ['all', 'reels']
  },
  {
    id: 'DKrXsRJeM3w',
    title: 'Go #OpenSource  Go #OpenBIM',
    category: 'OpenBIM',
    type: 'reel',
    youtubeUrl: 'https://youtube.com/shorts/DKrXsRJeM3w',
    thumbnail: 'https://img.youtube.com/vi/DKrXsRJeM3w/hqdefault.jpg',
    instagramUrl: 'https://www.instagram.com/reel/DN99rXsDL2C/?utm_source=ig_web_button_share_sheet',
    playlists: ['all', 'reels']
  },
  {
    id: 'ixMdxWLG-Lc',
    title: 'How to Install Inkscape',
    category: 'Open Source 2D',
    type: 'video',
    youtubeUrl: 'https://youtu.be/ixMdxWLG-Lc',
    thumbnail: 'https://img.youtube.com/vi/ixMdxWLG-Lc/hqdefault.jpg',
    instagramUrl: '',
    playlists: ['all', 'featured', 'courses']
  }
];

export const playlists: Playlist[] = [
  { id: 'all', title: 'All Videos' },
  { id: 'featured', title: 'Featured' },
  { id: 'courses', title: 'Courses' },
  { id: 'reels', title: 'Reels' }
];
