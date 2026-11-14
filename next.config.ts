import type { NextConfig } from "next";

// The Docker image runs the standalone server; `next start` does not support
// that output mode, so it is opt-in per build target.
const isDockerBuild = process.env.NEXT_BUILD_TARGET === "docker";

export const nextConfig: NextConfig = {
  ...(isDockerBuild ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Product images are re-encoded server-side; the default 1 MB ceiling is
      // smaller than a phone photo.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
