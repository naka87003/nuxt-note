import { fileURLToPath } from "node:url";

// Match Nuxt's built-in aliases in tests that run without a Nuxt environment.
export const aliases = {
  "~": fileURLToPath(new URL("../app", import.meta.url)),
  "~~": fileURLToPath(new URL("..", import.meta.url)),
  "#shared": fileURLToPath(new URL("../shared", import.meta.url)),
};
