<script setup lang="ts">
defineProps<{ content: string }>();
</script>

<template>
  <MarkdownContent :content="content" />
</template>
