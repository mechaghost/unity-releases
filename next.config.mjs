/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/guides/ai-with-unity", destination: "/guides/agentic-coding-with-unity", permanent: true }];
  },
  distDir: process.env.NEXT_DIST_DIR ?? ".next"
};

export default nextConfig;
