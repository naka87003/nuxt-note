<template>
  <header class="app-header">
    <div class="header-side">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        class="min-h-11"
        aria-label="Back to home"
      />
    </div>
    <NuxtLink to="/" aria-label="Nuxt Note home">
      <AppBrand />
    </NuxtLink>
    <div class="header-side header-right">
      <ThemePicker />
      <ProfileMenu />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4rem;
  padding-inline: 1rem;
  background: var(--ui-bg-muted);
  border-bottom: 1px solid var(--ui-border);
}
.header-side {
  display: flex;
  flex: 1;
  min-width: 44px;
}
.header-right {
  justify-content: flex-end;
}
</style>
