import colors from "tailwindcss/colors";
import { nuxtSymbolPath } from "~/utils/brand";
import { neutralColors, primaryColors, resolveThemeColor } from "~/utils/theme";

export default defineNuxtPlugin((nuxtApp) => {
  const appConfig = useAppConfig();
  const options = {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    path: "/",
  };
  const primary = useCookie<string>("nuxt-note-primary", options);
  const neutral = useCookie<string>("nuxt-note-neutral", options);

  function restoreTheme() {
    appConfig.ui.colors.primary = resolveThemeColor(
      primary.value,
      primaryColors,
      "green",
    );
    appConfig.ui.colors.neutral = resolveThemeColor(
      neutral.value,
      neutralColors,
      "gray",
    );
  }

  if (import.meta.client && nuxtApp.payload.prerenderedAt) {
    // Match the static HTML before restoring this browser's saved colors.
    nuxtApp.hook("app:mounted", restoreTheme);
  } else {
    restoreTheme();
  }

  useHead(() => {
    const name = resolveThemeColor(
      appConfig.ui.colors.primary,
      primaryColors,
      "green",
    );
    const color = name === "green" ? "#00c16a" : colors[name][500];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 54 324 216"><path fill="${color}" d="${nuxtSymbolPath}"/></svg>`;
    return {
      link: [
        {
          key: "favicon",
          rel: "icon",
          type: "image/svg+xml",
          href: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        },
      ],
    };
  });

  if (import.meta.client) {
    watch(
      () => appConfig.ui.colors.primary,
      (value) => {
        primary.value = value;
      },
    );
    watch(
      () => appConfig.ui.colors.neutral,
      (value) => {
        neutral.value = value;
      },
    );
  }
});
