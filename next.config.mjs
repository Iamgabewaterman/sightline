/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "@supabase/ssr", "@anthropic-ai/sdk"],
    // Client Router Cache: reuse already-visited pages so back-navigation is
    // instant instead of refetching. dynamic=30s covers rapid back-and-forth
    // between the job list and a job; static=300s (5 min) covers everything else.
    staleTimes: { dynamic: 30, static: 300 },
  },
  async headers() {
    return [
      {
        // Service worker must never be cached so updates are picked up immediately.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type",  value: "application/javascript" },
        ],
      },
      {
        // Manifest must not be stale-cached or Chrome may miss icon/display updates.
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type",  value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default nextConfig;
