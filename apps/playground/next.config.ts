import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship ESM dist; let Next transpile them uniformly.
  transpilePackages: ["pageskim", "@pageskim/core"],
};

export default nextConfig;
