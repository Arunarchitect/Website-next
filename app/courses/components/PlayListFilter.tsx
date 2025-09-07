import { Playlist } from '../types';

interface PlaylistFilterProps {
  playlists: Playlist[];
  selectedPlaylist: string;
  onPlaylistChange: (id: string) => void;
}

export default function PlaylistFilter({ 
  playlists, 
  selectedPlaylist, 
  onPlaylistChange 
}: PlaylistFilterProps) {
  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {playlists.map((playlist) => (
        <button
          key={playlist.id}
          onClick={() => onPlaylistChange(playlist.id)}
          className={`px-4 py-2 rounded-full text-sm border ${
            selectedPlaylist === playlist.id
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600'
          } hover:bg-blue-100 dark:hover:bg-gray-700 transition`}
        >
          {playlist.title}
        </button>
      ))}
    </div>
  );
}