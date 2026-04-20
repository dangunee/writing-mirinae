/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["postgres"],
  },

  async headers() {
    return [
      {
        // use Next.js recommended matcher
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",

              // allow external scripts (Stripe / OAuth)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",

              // styles
              "style-src 'self' 'unsafe-inline' https:",

              // images
              "img-src 'self' data: blob: https:",

              // fonts
              "font-src 'self' data: https:",

              // API / Supabase / WebSocket
              "connect-src 'self' https: wss:",

              // IMPORTANT: allow iframe-based integrations (Stripe etc.)
              "frame-src 'self' https:",

              // security restrictions
              "frame-ancestors 'self'",
              "base-uri 'self'",

              // allow external form post (Stripe)
              "form-action 'self' https:",

              // support workers if needed
              "worker-src 'self' blob:",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), camera=(), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
