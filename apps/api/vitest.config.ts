import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "unit",
    include: ["src/__tests__/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ["./src/__tests__/helpers/setup.ts"],
  },
});
