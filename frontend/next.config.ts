import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  agentRules: false,
  async rewrites() {
    // Vercel's root Services routing sends /api/* directly to FastAPI.
    if (process.env.VERCEL) return [];

    // Plain local Next.js development still proxies to the local FastAPI server.
    const upstream = process.env.API_UPSTREAM_URL || "http://localhost:8000";
    const url = new URL(upstream);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("API_UPSTREAM_URL must be an origin without a path, query, or fragment.");
    }
    return [{ source: "/api/:path*", destination: url.origin + "/api/:path*" }];
  },
};

export default nextConfig;