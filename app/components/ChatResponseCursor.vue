<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), {
  label: "Generating response…",
});
</script>

<template>
  <div class="chat-typing-indicator" role="status">
    <span aria-hidden="true">▋</span>
    <span class="sr-only">{{ label }}</span>
  </div>
</template>

<style scoped>
.chat-typing-indicator {
  display: inline-block;
  margin-left: 0.25rem;
  animation: chat-cursor-pulse 1s ease infinite;
}

@keyframes chat-cursor-pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-typing-indicator {
    animation: none;
  }
}
</style>
