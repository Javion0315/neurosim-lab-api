import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  agentRules: false,
  async rewrites() {
    const configured = process.env.API_UPSTREAM_URL;
    const upstream = configured || (process.env.VERCEL ? "" : "http://localhost:8000");
    if (!upstream) {
      throw new Error("API_UPSTREAM_URL must be set for Vercel deployments.");
    }
    const url = new URL(upstream);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("API_UPSTREAM_URL must be an origin without a path, query, or fragment.");
    }
    if (process.env.VERCEL && url.protocol !== "https:") {
      throw new Error("API_UPSTREAM_URL must use HTTPS on Vercel.");
    }
    return [{ source: "/api/:path*", destination: url.origin + "/api/:path*" }];
  },
};
export default nextConfig;