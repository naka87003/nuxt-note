export default defineNuxtConfig({
  compatibilityDate: "2026-11-03",
  devtools: { enabled: true },
  modules: ["@nuxt/ui", "@nuxt/eslint", "nuxt-auth-utils"],
  css: ["@fontsource-variable/inter/index.css", "~/assets/css/main.css"],
  ui: { fonts: false },
  colorMode: { preference: "dark", fallback: "dark" },
  runtimeConfig: {
    openaiApiKey: "",
    openaiModel: "gpt-6.1-sol",
  },
  app: {
    head: {
      htmlAttrs: { lang: "en", class: "dark" },
      title: "Nuxt Note",
      meta: [
        {
          name: "description",
          content: "Capture ideas, write in Markdown, and keep what you learn.",
        },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/nuxt.svg" }],
    },
  },
});
