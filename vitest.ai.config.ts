import { defineConfig } from "vitest/config";
import { aliases } from "./tests/aliases.ts";

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    name: "ai",
    environment: "node",
    fsModuleCache: false,
    include: ["tests/ai/**/*.test.ts"],
  },
});
