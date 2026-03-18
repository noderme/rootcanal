import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://buy.paddle.com https://checkout-service.paddle.com https://maps.googleapis.com https://www.clarity.ms",
              "frame-src 'self' https://buy.paddle.com https://checkout-service.paddle.com",
              "connect-src 'self' https://*.paddle.com https://checkout-service.paddle.com https://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com https://*.clarity.ms",
              "style-src 'self' 'unsafe-inline' https://buy.paddle.com https://fonts.googleapis.com",
              "img-src 'self' data: https://*.paddle.com https://maps.googleapis.com https://maps.gstatic.com https://*.ggpht.com",
              "font-src 'self' data: https://buy.paddle.com https://fonts.gstatic.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
