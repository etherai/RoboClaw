import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // For GitHub Pages project sites, set BASE_PATH env var to /repository-name
  // For user/org pages (username.github.io), leave BASE_PATH unset
  basePath: process.env.BASE_PATH || '',
  // Next.js 16 uses Turbopack by default
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
