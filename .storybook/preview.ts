import type { Preview } from "@nuxtjs/storybook";
import { UApp } from "#components";
import { useAppConfig, useHead } from "#imports";
import "./preview.css";

const preview: Preview = {
  decorators: [
    () => ({
      components: { UApp },
      setup() {
        const config = useAppConfig();
        config.ui.colors.primary = "green";
        config.ui.colors.neutral = "gray";
        useHead({ htmlAttrs: { lang: "en", class: "dark" } });
      },
      template: "<UApp><story /></UApp>",
    }),
  ],
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [390, 1280] },
  },
};

export default preview;
