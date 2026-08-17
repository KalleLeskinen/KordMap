import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*', // Catches every single URL (e.g. /customs, /settings)
        destination: 'https://kordmap.wiki', // Forwards them to your new domain
        permanent: true, // 301 Permanent Redirect (Great for SEO and transferring Google rankings!)
      },
    ];
  },
};

export default nextConfig;