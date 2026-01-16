/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add this line to prevent the font fetch timeout error
  optimizeFonts: false, 
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    externalDir: true,
    serverComponentsExternalPackages: ['fs'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
        stream: false,
        crypto: false
      };
    }
    return config;
  },
};

module.exports = nextConfig;