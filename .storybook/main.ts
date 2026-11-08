import type { StorybookConfig } from "@nuxtjs/storybook";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.ts"],
  framework: { name: "@storybook-vue/nuxt", options: {} },
  staticDirs: ["../public"],
};

export default config;
