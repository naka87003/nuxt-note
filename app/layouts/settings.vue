<template>
  <div class="min-h-dvh">
    <header class="settings-header sticky top-0 z-20">
      <div class="header-side">
        <UButton
          to="/notes"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          class="min-h-11"
          aria-label="Back to Notes"
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
    <main><slot /></main>
  </div>
</template>

<style scoped>
.settings-header {
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
