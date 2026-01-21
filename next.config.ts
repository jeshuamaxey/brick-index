import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.rebrickable.com',
        pathname: '/media/**',
      },
    ],
  },
  // Mark pino and related packages as external to prevent Turbopack from
  // bundling them (they contain test files with intentional syntax errors)
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
};

export default nextConfig;
