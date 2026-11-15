import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    name: "integration",
    environment: "node",
    fsModuleCache: false,
    include: ["tests/integration/**/*.test.ts"],
  },
});
