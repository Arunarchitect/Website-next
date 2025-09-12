import Image from 'next/image';
import { Video } from '../types';

interface VideoCardProps {
  video: Video;
}

export default function VideoCard({ video }: VideoCardProps) {
  const handleInstagramClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ✅ Prevent triggering the YouTube link
    if (video.instagramUrl) {
      window.open(video.instagramUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="relative group overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition aspect-square">
      {/* Thumbnail with darkness controls */}
      <div className="relative w-full h-full">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className="object-cover brightness-75 group-hover:brightness-50 transition-all duration-300"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Overlay clickable link for YouTube */}
      <a
        href={video.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10"
        aria-label={`Watch ${video.title} on YouTube`}
      />

      {/* Instagram Icon with gradient colors */}
      {video.instagramUrl && (
        <button
          onClick={handleInstagramClick}
          className="absolute top-2 right-2 z-20 bg-white/90 dark:bg-gray-800/90 rounded-full p-2 hover:scale-110 transition-all duration-200 shadow-md"
          aria-label="View on Instagram"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            {/* Instagram gradient background */}
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fdf497" />
                <stop offset="5%" stopColor="#fdf497" />
                <stop offset="30%" stopColor="#fd5949" />
                <stop offset="45%" stopColor="#d6249f" />
                <stop offset="80%" stopColor="#285AEB" />
              </linearGradient>
            </defs>
            
            {/* Outer circle with gradient */}
            <path
              d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z"
              fill="url(#instagram-gradient)"
            />
            
            {/* Inner circle (white) */}
            <path
              d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"
              fill="white"
            />
            
            {/* Dot for camera (white) */}
            <circle cx="18.406" cy="5.594" r="1.44" fill="white" />
          </svg>
        </button>
      )}

      {/* Video Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 text-white">
        <h3 className="text-lg font-semibold">{video.title}</h3>
        <span className="text-sm opacity-90">{video.type === 'reel' ? 'Reel' : 'Video'}</span>
      </div>
    </div>
  );
}