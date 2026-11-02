import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // each file boots its own in-memory Postgres (WASM); parallel workers crash on low memory
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { AUTH_SECRET: "test-secret-test-secret-test-secret", ALLOW_FAKE_PAYMENTS: "1" },
  },
});
