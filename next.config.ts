import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baileys ve gateway native/ESM paketleri Next bundle'ına girmesin;
  // runtime'da gateway/server.mjs üzerinden yüklenir.
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "qrcode",
    "pino",
    "pino-pretty",
  ],
  // Hostinger / NFT prune Baileys'i atmasın (yalnızca gateway'den import edilir).
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@whiskeysockets/baileys/**/*",
      "./gateway/**/*",
    ],
  },
  // Hostinger CDN was caching RSC flight payloads for /login as if they were HTML.
  // Force private/no-store on app routes so document navigations always get real HTML.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Vary",
            value: "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
