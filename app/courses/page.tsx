"use client";

import { useState } from "react";
import Link from "next/link";
import { videoData, playlists } from "./data";
import VideoCard from "./components/VideoCard";
import SearchBar from "./components/SearchBar";

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState("all");

  // Selected playlist
  const selectedPlaylistData = playlists.find((p) => p.id === selectedPlaylist);

  // Filtered videos (based on playlist + search)
  const filteredVideos = videoData.filter((video) => {
    const inPlaylist =
      selectedPlaylist === "all" || video.playlists.includes(selectedPlaylist);
    const matchesSearch = video.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return inPlaylist && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Skill Up for Free
      </h1>

      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Explore free short-form and long-form content to level up your skills — all shared on{" "}
        <a
          href="https://www.youtube.com/@Modelflick?app=desktop"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
        >
          YouTube
        </a>{" "}
        and{" "}
        <a
          href="https://www.instagram.com/modelflick/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-600 dark:text-pink-400 underline hover:text-pink-800 dark:hover:text-pink-300"
        >
          Instagram
        </a>{" "}
        channels. No sign-ups, just value.
      </p>

      {/* Donation Button */}
      <div className="mb-8">
        <Link
          href="/donate"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 transition-colors duration-200 dark:bg-green-500 dark:hover:bg-green-600"
        >
          ❤️ Support the Creator
        </Link>
      </div>

      {/* Search */}
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      {/* 🔹 Playlist Section */}
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-10 mb-4">
        Playlists
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {playlists.map((playlist) => {
          const coverVideo = videoData.find((v) =>
            playlist.id === "all" ? true : v.playlists.includes(playlist.id)
          );

          if (!coverVideo) return null;

          return (
            <div
              key={playlist.id}
              onClick={() => setSelectedPlaylist(playlist.id)}
              className={`group cursor-pointer transition-all duration-300 hover:scale-105 relative ${
                selectedPlaylist === playlist.id
                  ? "ring-2 ring-blue-600 dark:ring-blue-400 rounded-lg"
                  : ""
              }`}
            >
              {/* Stacked Playlist Thumbnail Container - Apple Wallet Style */}
              <div className="relative w-full h-48">
                {/* Back card 4 (farthest) */}
                <div className="absolute top-7 left-1/2 -translate-x-1/2 w-[85%] h-40 rounded-xl bg-gradient-to-b from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700 shadow-lg" />
                
                {/* Back card 3 */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[88%] h-42 rounded-xl bg-gradient-to-b from-gray-300 to-gray-400 dark:from-gray-500 dark:to-gray-600 shadow-md" />
                
                {/* Back card 2 */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[92%] h-44 rounded-xl bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-400 dark:to-gray-500 shadow-sm" />
                
                {/* Back card 1 (closest to front) */}
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-[95%] h-46 rounded-xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-300 dark:to-gray-400" />
                
                {/* Main card (front) - Apple Wallet style with curved top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 rounded-t-xl rounded-b-lg overflow-hidden shadow-xl z-10 border border-gray-200 dark:border-gray-600">
                  <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-500 z-20" />
                  <img
                    src={coverVideo.thumbnail}
                    alt={playlist.title}
                    className="w-full h-full object-cover mt-1"
                  />
                  
                  {/* Playlist Title Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 text-center z-30">
                    <h3 className="font-semibold text-white text-lg leading-tight">
                      {playlist.title}
                    </h3>
                    <p className="text-sm text-gray-200 mt-1">
                      {playlist.id === "all"
                        ? `${videoData.length} videos`
                        : `${
                            videoData.filter((v) =>
                              v.playlists.includes(playlist.id)
                            ).length
                          } videos`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 🔹 Videos Section */}
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-12 mb-4">
        {selectedPlaylistData?.title || "Videos"}
      </h2>

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