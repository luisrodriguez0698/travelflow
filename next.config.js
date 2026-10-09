const path = require('path');
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  // Las reglas propias van ANTES que las de fabrica (que cachean todo GET /api/*)
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        // Stream SSE de avisos: conexion abierta que nunca termina; el service
        // worker no debe interceptarla ni intentar guardarla en cache.
        urlPattern: ({ url }) => url.pathname.startsWith('/api/activity/stream'),
        handler: 'NetworkOnly',
        method: 'GET',
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
};

module.exports = withPWA(nextConfig);
