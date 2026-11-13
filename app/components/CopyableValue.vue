<script setup lang="ts">
const props = withDefaults(
  defineProps<{ value: string; copyLabel?: string; copiedMessage?: string }>(),
  { copyLabel: "Copy value", copiedMessage: "Copied to clipboard." },
);
const { state, pending, feedback, copy } = useCopyFeedback(
  computed(() => props.value),
  () => props.copiedMessage,
);
</script>

<template>
  <div class="copyable-value">
    <code>{{ value }}</code>
    <UButton
      class="value-copy"
      type="button"
      :icon="feedback.icon"
      :color="feedback.color"
      variant="ghost"
      size="sm"
      :disabled="pending"
      :aria-label="copyLabel"
      :data-state="state"
      @click="copy"
    />
    <span class="sr-only" role="status">{{ feedback.message }}</span>
  </div>
</template>

<style scoped>
.copyable-value {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--ui-bg-muted);
}
.copyable-value code {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: all;
  font-family: var(--font-mono);
  font-size: 0.875rem;
}
.value-copy {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  justify-content: center;
}
</style>
