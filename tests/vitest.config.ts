import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// This file lives in tests/; the project (and the "@" import root) is one level up.
const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/property/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
});
