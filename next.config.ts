import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "http", hostname: "127.0.0.1", port: "9199" },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/__/auth/:path*",
          destination: "https://astera-oms-prod.firebaseapp.com/__/auth/:path*",
        },
      ],
    };
  },
  turbopack: {
    // Playwright worktrees can set this to their shared repository root so
    // Turbopack may resolve the existing dependency directory safely.
    root: process.env.NEXT_TURBOPACK_ROOT ?? process.cwd(),
  },
};

export default nextConfig;
