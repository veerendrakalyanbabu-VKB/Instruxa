import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages serves this MVP as a static export. The normal Sites/
  // Vinext build remains unchanged when CF_PAGES_STATIC is not enabled.
  ...(process.env.CF_PAGES_STATIC === "1"
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
