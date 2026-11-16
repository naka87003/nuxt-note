<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <div class="chat-progress-label" role="status">
    {{ label }}
  </div>
</template>

<style scoped>
.chat-progress-label {
  margin-left: 0.25rem;
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
</style>
