import type { NextConfig } from 'next'

/** Capacitor/APK builds need a fully static `out/` export. Web (Vercel) keeps API routes. */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1'

const nextConfig: NextConfig = {
  ...(isCapacitorBuild ? { output: 'export' as const } : {}),
  trailingSlash: true,
  // Avoid 308 redirects on /api/* POSTs (redirects drop the JSON body).
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
