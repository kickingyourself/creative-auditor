import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Playwright and @sparticuz/chromium must NOT be bundled by webpack —
   * they rely on the Node.js file system, child_process, and native binaries.
   * Listing them here tells Next.js to require() them at runtime instead.
   */
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
};

export default nextConfig;
