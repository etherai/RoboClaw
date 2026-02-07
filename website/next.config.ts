import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Mark server-only packages to be excluded from client bundle
  serverExternalPackages: ['ssh2'],
}

export default nextConfig
