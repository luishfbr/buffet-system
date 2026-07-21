import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship compiled ESM in dist; no transpile needed.
};

export default nextConfig;
