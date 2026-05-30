/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  /**
   * Proxy all /api/v1/* requests through Next.js to the backend.
   *
   * Why this matters in production:
   *   - Frontend is on nex-talk-khaki.vercel.app
   *   - Backend is on a different domain (e.g. Render)
   *   - Browsers only send cookies to the domain that set them
   *   - The nx_token cookie is set by the backend response
   *   - With rewrites, the browser sees the cookie as coming from the Vercel domain
   *   - proxy.js (Next.js middleware) can then read it for route protection
   *
   * In development this is handled by the dev server proxy (proxy.js / next.config).
   */
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
