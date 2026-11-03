import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "integration",
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
    // Runs before any test file is loaded - sets env vars before module initialization
    globalSetup: ["./src/__tests__/helpers/setup.ts"],
  },
});
