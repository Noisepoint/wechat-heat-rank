/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['mp.weixin.qq.com', 'example.com'],
  },
}

module.exports = nextConfig