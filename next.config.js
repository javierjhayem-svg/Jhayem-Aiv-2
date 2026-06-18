/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    // Prevent webpack from trying to bundle URL-based dynamic imports (esm.run, etc.)
    config.module.rules.push({
      test: /\.js$/,
      resourceQuery: /url/,
      type: 'asset/source',
    })

    // Tell webpack to ignore https:// imports — they're handled at runtime by the browser
    config.externals = config.externals || []
    if (!isServer) {
      // No-op: browser handles https imports at runtime
    }

    // Suppress webpack warnings for dynamic URL imports
    config.module.unknownContextCritical = false
    config.module.exprContextCritical = false

    return config
  },
}
module.exports = nextConfig
