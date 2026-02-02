import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude ssh2 and its dependencies from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }

    // Exclude native modules from webpack bundling
    config.externals = config.externals || []
    config.externals.push({
      'ssh2': 'commonjs ssh2',
    })

    return config
  },
}

export default nextConfig
