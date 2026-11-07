import { defineConfig } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Avoid cached transforms referencing a different pnpm Vitest installation.
    fsModuleCache: false,
    projects: [
      {
        resolve: {
          alias: {
            "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
          },
        },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      await defineVitestProject({
        test: {
          name: "nuxt",
          environment: "nuxt",
          include: ["tests/nuxt/**/*.test.ts"],
          setupFiles: ["./tests/nuxt/setup.ts"],
          environmentOptions: {
            nuxt: {
              dotenv: { fileName: ".env.test" },
              overrides: { devtools: { enabled: false } },
            },
          },
        },
      }),
    ],
  },
});
