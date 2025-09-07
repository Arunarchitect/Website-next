'use client';

import { useState } from 'react';
import { videoData, playlists } from './data';
import VideoCard from './components/VideoCard';
import PlaylistFilter from './components/PlayListFilter';
import SearchBar from './components/SearchBar';

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('all');

  // Filter videos by playlist
  const selectedPlaylistData = playlists.find(p => p.id === selectedPlaylist);
  const videoIdsInPlaylist = selectedPlaylistData?.videos || [];

  // Final filtered list
  const filteredVideos = videoData.filter(video =>
    videoIdsInPlaylist.includes(video.id) &&
    video.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 rounded-md">
        <p className="text-sm">
          This section is under development. This is a trial sketch for the Courses page.
        </p>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Reels</h1>

      {/* Search Bar */}
      <SearchBar 
        searchTerm={searchTerm} 
        onSearchChange={setSearchTerm} 
      />

      {/* Playlist Filters */}
      <PlaylistFilter 
        playlists={playlists}
        selectedPlaylist={selectedPlaylist}
        onPlaylistChange={setSelectedPlaylist}
      />

      {/* Video Grid */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {/* Empty state */}
      {filteredVideos.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 mt-6">No videos found.</p>
      )}
    </div>
  );
}