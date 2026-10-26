import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly from disk and pg/exceljs use Node internals: never bundle them.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  // The migration runner reads drizzle/*.sql at runtime: make sure they ship with the server.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
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
