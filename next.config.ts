import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: [
      "img.youtube.com",
      "i.ytimg.com",
      "instagram.fdel1-1.fna.fbcdn.net",
      "scontent.cdninstagram.com",
      "i.vimeocdn.com",
      "cdn.pixabay.com",
      "media.istockphoto.com",
      "res.cloudinary.com",
    ],
    unoptimized: true,
  },
};

export default nextConfig;