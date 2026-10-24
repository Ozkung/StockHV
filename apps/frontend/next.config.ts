import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Browser calls go to /backend/* on the same origin and are proxied to the NestJS API,
  // so no CORS or public API URL is needed. (/api/* is reserved for NextAuth.)
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
