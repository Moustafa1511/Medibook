/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // No `images.remotePatterns`: every image in this app is local (Section 3).
  // Server Actions are left on their default configuration (C13).
};

export default nextConfig;
