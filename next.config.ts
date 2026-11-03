import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly from disk and pg/exceljs use Node internals: never bundle them.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  // The migration runner reads drizzle/*.sql at runtime: make sure they ship with the server.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./assets/fonts/*", "./public/images/y2k26-logo.png"] },
  redirects: async () => [{ source: "/refunds", destination: "/terms", permanent: true }],
  // Private and per-user pages must never be indexed. Test hosts (aws.*) are kept out of search completely.
  headers: async () => {
    const host = (() => { try { return new URL(process.env.APP_URL || "https://www.projecty2k.com").hostname; } catch { return "www.projecty2k.com"; } })();
    const testHost = /^(aws|test|staging|preview)\./.test(host) || host === "localhost";
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      ...(testHost ? [{ source: "/:path*", headers: noindex }] : []),
      { source: "/:area(admin|scan|login|order|t|api|checkout|find-ticket)", headers: noindex },
      { source: "/:area(admin|scan|login|order|t|api|checkout|find-ticket)/:rest*", headers: noindex },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
