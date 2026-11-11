<script setup lang="ts">
import { siteDescription, siteTitle } from "~/utils/seo";

const config = useRuntimeConfig();
const imageUrl = new URL("/images/og-image.png", config.public.siteUrl).href;

useSeoMeta({
  ogType: "website",
  ogSiteName: "Nuxt Note",
  ogTitle: siteTitle,
  ogDescription: siteDescription,
  ogImage: imageUrl,
  ogImageType: "image/png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: siteTitle,
  twitterCard: "summary_large_image",
  twitterTitle: siteTitle,
  twitterDescription: siteDescription,
  twitterImage: imageUrl,
  twitterImageAlt: siteTitle,
});
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <UnsavedChangesModal />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
