import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/*": ["./data/pdfs/**/*"],
  },
};

export default nextConfig;
