// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import storybook from "eslint-plugin-storybook";
import stylistic from "@stylistic/eslint-plugin";

export default withNuxt(
  {
    ignores: ["storybook-static/**"],
    plugins: { "@stylistic": stylistic },
    rules: {
      curly: ["error", "multi-line", "consistent"],
      // Separate control flow and multiline declarations without splitting short declarations.
      "@stylistic/padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: "*",
          next: ["return", "block-like", "multiline-const", "multiline-let"],
        },
        {
          blankLine: "always",
          prev: ["block-like", "multiline-const", "multiline-let"],
          next: "*",
        },
      ],
      // Prettier owns the formatting of HTML void elements.
      "vue/html-self-closing": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts,vue}"],
    languageOptions: {
      parserOptions: {
        project: [
          "./tsconfig.json",
          "./.nuxt/tsconfig.server.json",
          "./.storybook/tsconfig.json",
          "./tsconfig.eslint.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
    },
  },
  {
    files: ["tests/**"],
    rules: {
      // Tests intentionally construct partial mocks and invalid inputs.
      "@typescript-eslint/no-unsafe-type-assertion": "off",
    },
  },
).append(storybook.configs["flat/recommended"]);
