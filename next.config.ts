import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Enable React's new compiler (if using React 19+)
  experimental: {
    // Optimize package imports for better tree-shaking
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-slot",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
    ],
    // Enable experimental optimizations
    optimizeCss: true,
    optimizeServerReact: true,
  },

  // Configure image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Transpile specific packages
  transpilePackages: ["lucide-react", "recharts"],

  // Compiler configuration
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },

  // TypeScript configuration
  typescript: {
    // Set to false to enable type checking during build
    ignoreBuildErrors: false,
  },

  // General Next.js optimizations
  poweredByHeader: false,
  reactStrictMode: true,

  // Performance optimizations
  productionBrowserSourceMaps: false,

  // Turbopack configuration
  // Note: component-tagger-loader disabled — causes Turbopack panic on Windows
  // (tries to read src/app directory as a file). Re-enable when Turbopack fixes this.
  turbopack: {},
};

// Apply Axiom logging, then Sentry wrapping (single pass)
const configWithAxiom = withAxiom(nextConfig);

export default withSentryConfig(configWithAxiom, {
  org: "paul-carpenter",
  project: "eval-ai",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // Note: This route must NOT match any Next.js middleware matcher pattern.
  tunnelRoute: "/monitoring",

  // Automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
});
