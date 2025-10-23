import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude @napi-rs/canvas from client-side bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@napi-rs/canvas': false,
      }
    }

    // Ignore .node files and optional native modules
    config.module.rules.push({
      test: /\.node$/,
      loader: 'node-loader',
    })

    // Mark all @napi-rs/canvas platform-specific packages as external
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push({
        '@napi-rs/canvas': 'commonjs @napi-rs/canvas',
      })
    }

    // Suppress warnings for optional native dependencies
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Failed to parse source map/,
      /Can't resolve '\.\/(skia|canvas)\..*\.node'/,
      /Can't resolve '@napi-rs\/canvas-.*'/,
      /Module not found.*@napi-rs\/canvas/,
    ]

    return config
  },
}

export default withNextIntl(nextConfig)