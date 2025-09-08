import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      // ✅ YouTube Thumbnails
      "img.youtube.com",
      "i.ytimg.com",

      // ✅ Instagram CDN (this may vary based on region and user content)
      "instagram.fdel1-1.fna.fbcdn.net",
      "scontent.cdninstagram.com",

      // ✅ Vimeo Thumbnails
      "i.vimeocdn.com",

      // ✅ Optional: Other common CDNs (for flexibility)
      "cdn.pixabay.com",
      "media.istockphoto.com",
      "res.cloudinary.com",
    ],
  },
};

export default nextConfig;
