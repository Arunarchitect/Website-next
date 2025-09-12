"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { videoData, playlists } from "./data";
import VideoCard from "./components/VideoCard";
import SearchBar from "./components/SearchBar";
import Image from "next/image";

export default function CoursesPageClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState("all");
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const playlistContainerRef = useRef<HTMLDivElement>(null);

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

  // Check scroll position and update arrow visibility
  const updateArrowVisibility = () => {
    if (playlistContainerRef.current) {
      const container = playlistContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;

      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  // Scroll playlist container horizontally to a specific playlist
  const scrollToPlaylist = (direction: "left" | "right" | "start" | "end") => {
    if (playlistContainerRef.current) {
      const container = playlistContainerRef.current;
      const scrollAmount = container.clientWidth;

      if (direction === "left") {
        container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      } else if (direction === "right") {
        container.scrollBy({ left: scrollAmount, behavior: "smooth" });
      } else if (direction === "start") {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else if (direction === "end") {
        container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
      }
    }
  };

  // Update arrow visibility on scroll and resize
  useEffect(() => {
    const container = playlistContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateArrowVisibility);
      window.addEventListener("resize", updateArrowVisibility);
      updateArrowVisibility(); // Initial check

      return () => {
        container.removeEventListener("scroll", updateArrowVisibility);
        window.removeEventListener("resize", updateArrowVisibility);
      };
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Skill Up for Free
      </h1>

      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Explore free short-form and long-form content to level up your skills —
        all shared on{" "}
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
      <div className="flex items-center justify-between mt-10 mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Playlists
        </h2>
      </div>

      {/* Playlist Cards Container with Horizontal Scrolling */}
      <div className="relative">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scrollToPlaylist("left")}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Scroll left"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700 dark:text-gray-300"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scrollToPlaylist("right")}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Scroll right"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700 dark:text-gray-300"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        <div
          ref={playlistContainerRef}
          className="flex overflow-x-auto pb-4 hide-scrollbar scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {playlists.map((playlist) => {
            const coverVideo = videoData.find((v) =>
              playlist.id === "all" ? true : v.playlists.includes(playlist.id)
            );

            if (!coverVideo) return null;

            return (
              <div
                key={playlist.id}
                onClick={() => setSelectedPlaylist(playlist.id)}
                className="flex-shrink-0 w-64 snap-start group cursor-pointer transition-all duration-300 hover:scale-105 relative mx-2 first:ml-0 last:mr-0"
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
                  <div
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 rounded-t-xl rounded-b-lg overflow-hidden shadow-xl z-10 border ${
                      selectedPlaylist === playlist.id
                        ? "ring-2 ring-blue-600 dark:ring-blue-400 border-blue-300 dark:border-blue-600"
                        : "border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-500 z-20" />
                    <div className="relative w-full h-full">
                      <Image
                        src={coverVideo.thumbnail}
                        alt={playlist.title}
                        fill
                        className="object-cover mt-1 brightness-90 group-hover:brightness-75 transition-all duration-300"
                      />
                    </div>

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
      </div>

      {/* 🔹 Videos Section */}
      <div className="mt-12 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {selectedPlaylistData?.title || "All Videos"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {filteredVideos.length} video{filteredVideos.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 mt-6">
          No videos found. Try a different search term or playlist.
        </p>
      )}

      {/* Custom CSS to hide scrollbar */}
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}