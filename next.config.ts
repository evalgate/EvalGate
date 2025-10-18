import { withSentryConfig } from "@sentry/nextjs"
import { withAxiom } from "next-axiom"
import type { NextConfig } from 'next'
import path from "node:path";

const LOADER = path.resolve(__dirname, 'src/visual-edits/component-tagger-loader.js');

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Enable React's new compiler (if using React 19+)
  experimental: {
    // Optimize package imports for better tree-shaking
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-slot',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
    // Enable experimental optimizations
    optimizeCss: true,
    optimizeServerReact: true,
  },
  
  // Configure image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  
  // Transpile specific packages
  transpilePackages: ['lucide-react', 'recharts'],
  
  // Compiler configuration
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
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
      }
    }
    return config
  },
  
  // TypeScript configuration
  typescript: {
    // Set to false to enable type checking during build
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    // Set to false to enable ESLint during build
    ignoreDuringBuilds: false,
  },
  
  // General Next.js optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Performance optimizations
  productionBrowserSourceMaps: false,
  
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [LOADER],
      },
    },
  },
}

// Apply Sentry and Axiom configurations
const configWithPlugins = withAxiom(
  process.env.SENTRY_AUTH_TOKEN ? withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }) : nextConfig
)

export default configWithPlugins
