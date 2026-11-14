<template>
  <div
    class="flex min-h-0 flex-1 items-center justify-center gap-2 p-8 text-sm text-dimmed"
    role="status"
    aria-busy="true"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="size-5 motion-safe:animate-spin"
      aria-hidden="true"
    />
    <span>Loading…</span>
  </div>
</template>
