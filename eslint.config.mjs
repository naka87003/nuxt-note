// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  // Prettier owns the formatting of HTML void elements.
  rules: { "vue/html-self-closing": "off" },
});
