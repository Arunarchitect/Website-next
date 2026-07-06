"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import type { Subtitle } from "../api/videoApi";

interface Props {
  src: string;
  poster: string;
  subtitles?: Subtitle[];
}

export default function VideoPlayer({ src, poster, subtitles = [] }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHlsSource = src.endsWith(".m3u8");

    if (isHlsSource && Hls.isSupported()) {
      // Adaptive HLS streaming via hls.js (Chrome, Firefox, Edge, etc.)
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (isHlsSource && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari has native HLS support, no hls.js needed
      video.src = src;
    } else {
      // Regular mp4/webm source, no adaptive streaming needed
      video.src = src;
    }

    // Initialize Plyr for consistent custom controls UI
    const player = new Plyr(video, {
      captions: { active: true, update: true, language: "auto" },
      quality: {
        default: 576,
        options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240],
      },
    });
    playerRef.current = player;

    return () => {
      player.destroy();
      hlsRef.current?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      playsInline
      controls
      crossOrigin="anonymous"
      style={{
        width: "100%",
        aspectRatio: "16/9",
        backgroundColor: "black",
      }}
    >
      {subtitles.map((track) => (
        <track
          key={track.language}
          src={track.src}
          kind="subtitles"
          srcLang={track.language}
          label={track.label}
          default={track.default}
        />
      ))}
    </video>
  );
}