'use client';

import { Playlist } from '../types';

interface PlaylistFilterProps {
  playlists: Playlist[];
  selectedPlaylist: string;
  onPlaylistChange: (id: string) => void;
}

export default function PlaylistFilter({ playlists, selectedPlaylist, onPlaylistChange }: PlaylistFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {playlists.map((playlist) => (
        <button
          key={playlist.id}
          onClick={() => onPlaylistChange(playlist.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedPlaylist === playlist.id
              ? 'bg-blue-600 text-white dark:bg-blue-500'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {playlist.title}
        </button>
      ))}
    </div>
  );
}
