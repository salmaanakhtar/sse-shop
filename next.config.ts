import type { NextConfig } from "next";

// The Docker image runs the standalone server; `next start` does not support
// that output mode, so it is opt-in per build target.
const isDockerBuild = process.env.NEXT_BUILD_TARGET === "docker";

const nextConfig: NextConfig = {
  ...(isDockerBuild ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
};

export default nextConfig;
