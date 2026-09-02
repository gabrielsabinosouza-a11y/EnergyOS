import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations for network drives
  experimental: {
    // Reduce memory usage and improve startup time
    optimizePackageImports: true,
    // Enable server actions
    serverActions: true,
  },
  // Image optimization
  images: {
    // Disable image optimization for local development on network drives
    disableStaticImages: process.env.NODE_ENV === 'development',
    // Allow images from external domains
    remotePatterns: [
      { protocol: 'https', hostname: '*' },
    ],
    // Increase memory limit for image optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Compilation optimizations
  compiler: {
    // Reduce bundle size
    removeConsole: process.env.NODE_ENV === 'production',
    // Enable styled-components optimization
    styledComponents: true,
  },
  // Compression
  compress: true,
  // Enable HTTP/2 server push
  httpAgentOptions: {
    keepAlive: true,
  },
};

export default nextConfig;
