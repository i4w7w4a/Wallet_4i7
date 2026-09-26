import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Review builds use their own output so a running preview keeps its immutable assets.
  ...(process.env.NOVEX_NEXT_DIST_DIR ? { distDir: process.env.NOVEX_NEXT_DIST_DIR } : {}),
};

export default nextConfig;
