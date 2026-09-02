import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image optimization
  images: {
    // Disable image optimization for local development on network drives
    disableStaticImages: process.env.NODE_ENV === 'development',
    // Allow images from external domains
    remotePatterns: [
      { protocol: 'https', hostname: '*' },
    ],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Compilation optimizations
  compiler: {
    // Reduce bundle size in production
    removeConsole: process.env.NODE_ENV === 'production',
    // Enable styled-components optimization
    styledComponents: true,
  },
  // Enable compression
  compress: true,
  // HTTP agent options
  httpAgentOptions: {
    keepAlive: true,
  },
  // Performance: move .next to local drive if on network storage
  // turbopack: {
  //   root: process.env.NODE_ENV === 'development' ? './.next' : undefined,
  // },
};

export default nextConfig;
