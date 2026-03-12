import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://buy.paddle.com https://checkout-service.paddle.com",
              "frame-src 'self' https://buy.paddle.com https://checkout-service.paddle.com",
              "connect-src 'self' https://*.paddle.com https://checkout-service.paddle.com https://*.supabase.co",
              "style-src 'self' 'unsafe-inline' https://buy.paddle.com",
              "img-src 'self' data: https://*.paddle.com",
              "font-src 'self' data: https://buy.paddle.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
