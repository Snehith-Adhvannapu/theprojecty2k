import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly from disk and pg/exceljs use Node internals: never bundle them.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  // The migration runner reads drizzle/*.sql at runtime: make sure they ship with the server.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./assets/fonts/*", "./public/images/y2k26-logo.png"] },
  redirects: async () => [{ source: "/refunds", destination: "/terms", permanent: true }],
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
