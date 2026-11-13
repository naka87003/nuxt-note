export default defineNuxtConfig({
  compatibilityDate: "2026-11-03",
  devtools: { enabled: true },
  modules: ["@comark/nuxt", "@nuxt/ui", "@nuxt/eslint", "nuxt-auth-utils"],
  css: ["@fontsource-variable/inter/index.css", "~/assets/css/main.css"],
  ui: {
    prose: false,
    fonts: false,
    colorMode: false,
  },
  vite: {
    optimizeDeps: {
      // Keep Shiki and its grammar engine in the same browser dependency bundle.
      include: ["@comark/nuxt/plugins/shiki/core"],
    },
  },
  runtimeConfig: {
    mcpAllowedOrigins: "",
    openaiApiKey: "",
    openaiModel: "gpt-6.1-sol",
    public: {
      siteUrl: "https://nuxt-note-ivory.vercel.app",
    },
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
    },
  },
});
