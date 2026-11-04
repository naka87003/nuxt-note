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
