import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/reportesmba",
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

export default nextConfig;
