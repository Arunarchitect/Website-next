// CoursesPage.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { videoData, playlists } from './data';
import VideoCard from './components/VideoCard';
import PlaylistFilter from './components/PlayListFilter';
import SearchBar from './components/SearchBar';

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('all');

  const selectedPlaylistData = playlists.find(p => p.id === selectedPlaylist);
  const videoIdsInPlaylist = selectedPlaylistData?.videos || [];

  const filteredVideos = videoData.filter(video =>
    videoIdsInPlaylist.includes(video.id) &&
    video.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Skill Up for Free
      </h1>

      <p className="text-gray-700 dark:text-gray-300 mb-4">
        Explore free short-form and long-form content to level up your skills — all shared on{' '}
        <a
          href="https://www.youtube.com/@Modelflick?app=desktop"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
        >
          YouTube
        </a>{' '}
        and{' '}
        <a
          href="https://www.instagram.com/modelflick/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-600 dark:text-pink-400 underline hover:text-pink-800 dark:hover:text-pink-300"
        >
          Instagram
        </a>{' '}
        channels. No sign-ups, just value.
      </p>

      {/* Stylish Donation Button */}
      <div className="mb-8">
        <Link
          href="/donate"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 transition-colors duration-200 dark:bg-green-500 dark:hover:bg-green-600"
        >
          ❤️ Support the Creator
        </Link>
      </div>

      <SearchBar 
        searchTerm={searchTerm} 
        onSearchChange={setSearchTerm} 
      />

      <PlaylistFilter 
        playlists={playlists}
        selectedPlaylist={selectedPlaylist}
        onPlaylistChange={setSelectedPlaylist}
      />

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 mt-6">No videos found.</p>
      )}
    </div>
  );
}
