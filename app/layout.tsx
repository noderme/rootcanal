import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RootCanal — Dental Growth Intelligence",
  description:
    "See how your dental clinic ranks on Google. Free report in 30 seconds.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Paddle.js — payment checkout */}
        <script src="https://cdn.paddle.com/paddle/v2/paddle.js" async></script>
        {/* Contentsquare (Hotjar) */}
        <script src="https://t.contentsquare.net/uxa/d9829673fa46e.js"></script>
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
