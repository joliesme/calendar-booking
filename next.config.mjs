/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow external image domains for ads
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ]
  }
}

export default nextConfig
