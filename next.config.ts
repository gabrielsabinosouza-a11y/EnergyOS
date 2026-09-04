import type { NextConfig } from "next";

// Content-Security-Policy: allows Firebase Auth/Identity Toolkit, GA and
// Cloudinary; blocks framing, object embeds and form action hijacking.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://api.cloudinary.com https://*.cloudinary.com https://www.google-analytics.com https://*.google-analytics.com wss://*.firebaseio.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Image optimization
  images: {
    // Disable image optimization for local development on network drives
    disableStaticImages: process.env.NODE_ENV === 'development',
    // Allow images only from known hosts. Live-data check (photo_url /
    // banner_image_url across all profiles) found only res.cloudinary.com in
    // use; Google profile photos come from *.googleusercontent.com.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
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
  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
  // Performance: move .next to local drive if on network storage
  // turbopack: {
  //   root: process.env.NODE_ENV === 'development' ? './.next' : undefined,
  // },
};

export default nextConfig;
