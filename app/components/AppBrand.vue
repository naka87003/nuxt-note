<script setup lang="ts">
withDefaults(defineProps<{ hero?: boolean }>(), { hero: false });
</script>

<template>
  <span class="brand" :class="hero ? 'brand-hero' : 'brand-header'">
    <img
      src="/nuxt.svg"
      alt=""
      :width="hero ? 72 : 34"
      :height="hero ? 48 : 23"
    />
    <span class="brand-title">Nuxt Note</span>
  </span>
</template>

<style scoped>
.brand-header {
  font-size: 1.5rem;
}
.brand-hero {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 800;
}
.brand-hero img {
  width: 1.5em;
  height: auto;
}
@media (max-width: 639px) {
  .brand-header {
    font-size: 1.25rem;
  }
  .brand-header img {
    width: 28px;
    height: auto;
  }
}
</style>
