import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  images: {
    // Self-hosted: skip the image optimizer so the container needs no sharp binary.
    unoptimized: true,
  },
};

export default nextConfig;
