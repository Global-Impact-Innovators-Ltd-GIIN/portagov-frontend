const api = (process.env.NEXT_PUBLIC_API_URL || "https://eliberia-backend.onrender.com").trim();
const apiOrigin = api.replace(/\/$/, "");
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${api}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    // Same-origin proxy to the Flask backend on Render. The browser calls
    // /pg-api/* on this site and Next.js forwards it to Render, so the
    // live site never hits Render CORS directly. The adapter paths
    // already start with /api (for example /pg-api/api/auth/register),
    // so the proxy must NOT add /api again: the old destination
    // `${apiOrigin}/api/:path*` doubled it to /api/api/auth/register
    // and the backend answered 404 "Not found" for every sign-up and
    // sign-in. Direct calls to Render from the live Vercel origin are
    // still blocked by the backend's CORS_ORIGINS, which must also be
    // set in the Render dashboard.
    return [
      {
        source: "/pg-api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera is needed for remote biometric capture
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
