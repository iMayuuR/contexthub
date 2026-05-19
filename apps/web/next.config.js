/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@contexthub/core', '@contexthub/shared-types']
};

module.exports = nextConfig;