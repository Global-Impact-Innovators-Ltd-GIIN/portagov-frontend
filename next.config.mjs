const api = (process.env.NEXT_PUBLIC_API_URL || "https://eliberia-backend.onrender.com").trim();
const apiOrigin = api.replace(/\/$/, "");
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  /* A wallet PDF is shown in an iframe from a blob: URL (a saved
     file arrives as a data: URL and is turned into a blob: URL in
     DocumentViewer). Without frame-src, it falls back to
     default-src 'self', and blob: is not 'self', so Chrome blocks
     the iframe with "This content is blocked" while the same blob:
     URL opens fine in a new tab (top-level navigation is not
     governed by frame-src) and images work because img-src already
     allows blob:. object-src covers the same PDF viewer path when
     it is loaded as a plugin. frame-ancestors 'none' and
     X-Frame-Options DENY below are unrelated: they stop other
     sites framing this page, not this page framing a blob: URL,
     so they stay as they are. */
  "frame-src 'self' blob:",
  "object-src 'self' blob:",
  "font-src 'self' data:",
  /* blob: and data: are needed here: the wallet viewer turns a saved
     file's data: URL into a blob: URL, and fetch(data:) was silently
     blocked by connect-src before, so no blob: URL was ever made and
     the PDF preview sat on "Preparing preview..." forever. Both are
     local to the citizen's own browser, not new outside origins. */
  `connect-src 'self' blob: data: ${api}`,
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
