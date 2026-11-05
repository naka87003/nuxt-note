<script setup lang="ts">
import { neutralColors, primaryColors } from "~/utils/theme";

const appConfig = useAppConfig();
const groups = [
  { key: "primary", label: "Accent color", colors: primaryColors },
  { key: "neutral", label: "Neutral color", colors: neutralColors },
] as const;

function reset() {
  appConfig.ui.colors.primary = "green";
  appConfig.ui.colors.neutral = "gray";
}
</script>

<template>
  <UPopover :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-palette"
      color="primary"
      variant="ghost"
      class="min-h-11 min-w-11 justify-center"
      aria-label="Customize theme colors"
    />
    <template #content>
      <div class="w-72 max-w-[calc(100vw-2rem)] space-y-4 p-4">
        <h2 class="font-semibold">Theme colors</h2>
        <fieldset v-for="group in groups" :key="group.key">
          <legend class="mb-2 text-sm text-muted">{{ group.label }}</legend>
          <div class="grid grid-cols-5 gap-1">
            <button
              v-for="color in group.colors"
              :key="color"
              type="button"
              class="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-md p-1 text-[10px] capitalize hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
              :class="{
                'bg-elevated': appConfig.ui.colors[group.key] === color,
              }"
              :aria-label="`${group.label}: ${color}`"
              :aria-pressed="appConfig.ui.colors[group.key] === color"
              @click="appConfig.ui.colors[group.key] = color"
            >
              <span
                class="flex size-5 items-center justify-center rounded-full text-white"
                :style="{
                  backgroundColor: `var(--color-${color === 'neutral' ? 'old-neutral' : color}-500)`,
                }"
              >
                <UIcon
                  v-if="appConfig.ui.colors[group.key] === color"
                  name="i-lucide-check"
                  class="size-3.5"
                />
              </span>
              {{ color }}
            </button>
          </div>
        </fieldset>
        <UButton color="neutral" variant="outline" block @click="reset">
          Reset to default
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
