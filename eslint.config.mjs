// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import storybook from "eslint-plugin-storybook";

export default withNuxt({
  ignores: ["storybook-static/**"],
  // Prettier owns the formatting of HTML void elements.
  rules: { "vue/html-self-closing": "off" },
}).append(storybook.configs["flat/recommended"]);
